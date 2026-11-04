"""Private SMTP -> Gmail API adapter for catalogue Auth. Never logs mail or tokens.

Run inside the isolated venv documented in install-catalogo-gmail.py.
No externally routable SMTP listener: bind only the catalogue Docker bridge.
"""
import argparse
import asyncio
import base64
import email.policy
import email.utils
import hmac
import ipaddress
import json
import logging
import pathlib
import signal
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from email.parser import BytesParser

from aiosmtpd.controller import Controller
from aiosmtpd.smtp import AuthResult, LoginPassword

SCOPE = 'https://www.googleapis.com/auth/gmail.send'
MAX_BYTES = 262144


class DeliveryError(Exception):
    """Contains a fixed, non-sensitive code, never a provider response."""


class Gmail:
    def __init__(self, config):
        self.config = config
        self.access_token = None
        self.expires_at = 0
        self.lock = threading.Lock()

    def refresh(self):
        with self.lock:
            if self.access_token and time.monotonic() < self.expires_at:
                return
            fields = {k: self.config[k] for k in ['client_id', 'client_secret', 'refresh_token']}
            fields['grant_type'] = 'refresh_token'
            request = urllib.request.Request('https://oauth2.googleapis.com/token',
                data=urllib.parse.urlencode(fields).encode(), method='POST')
            try:
                with urllib.request.urlopen(request, timeout=12) as response:
                    token = json.load(response)
            except Exception:
                raise DeliveryError('oauth_refresh_failed') from None
            if not token.get('access_token') or SCOPE not in token.get('scope', '').split():
                raise DeliveryError('oauth_scope_missing')
            self.access_token = token['access_token']
            self.expires_at = time.monotonic() + max(0, int(token.get('expires_in', 0)) - 120)

    def send(self, raw):
        self.refresh()
        request = urllib.request.Request('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
            data=json.dumps({'raw': base64.urlsafe_b64encode(raw).decode()}).encode(),
            headers={'Authorization': 'Bearer ' + self.access_token, 'Content-Type': 'application/json'},
            method='POST')
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                sent = json.load(response)
            if not sent.get('id'):
                raise DeliveryError('gmail_delivery_unconfirmed')
        except DeliveryError:
            raise
        except urllib.error.HTTPError as error:
            if error.code == 401:
                self.expires_at = 0
            raise DeliveryError('gmail_send_failed') from None
        except Exception:
            raise DeliveryError('gmail_send_failed') from None


def authenticate(config, server, session, envelope, mechanism, auth_data):
    allowed = ipaddress.ip_address(session.peer[0]) in ipaddress.ip_network(config['allowed_cidr'])
    valid = allowed and isinstance(auth_data, LoginPassword) and (
        hmac.compare_digest(auth_data.login, config['smtp_user'].encode()) and
        hmac.compare_digest(auth_data.password, config['smtp_password'].encode()))
    return AuthResult(success=valid, handled=False)


class Handler:
    def __init__(self, config, gmail):
        self.config = config
        self.gmail = gmail
        self.allowed = ipaddress.ip_network(config['allowed_cidr'])

    async def handle_DATA(self, server, session, envelope):
        if not session.authenticated or ipaddress.ip_address(session.peer[0]) not in self.allowed:
            return '530 Authentication required'
        if not envelope.content or len(envelope.content) > MAX_BYTES:
            return '552 Message size limit'
        try:
            message = BytesParser(policy=email.policy.SMTP).parsebytes(envelope.content)
            sender = self.config['sender'].lower()
            from_addresses = email.utils.getaddresses(message.get_all('From', []))
            to_addresses = email.utils.getaddresses(message.get_all('To', []))
            if (envelope.mail_from.lower() != sender or len(from_addresses) != 1 or
                    from_addresses[0][1].lower() != sender):
                return '550 Sender not allowed'
            if (len(envelope.rcpt_tos) != 1 or len(to_addresses) != 1 or
                    not to_addresses[0][1] or to_addresses[0][1].lower() != envelope.rcpt_tos[0].lower() or
                    message.get_all('Cc') or message.get_all('Bcc') or
                    any(name.lower().startswith('resent-') for name in message.keys())):
                return '550 Exactly one matching recipient required'
            # Preserve the actual Supabase MIME message, its links and tokens.
            await asyncio.to_thread(self.gmail.send, envelope.content)
            print('catalogo_mail accepted_by_gmail', flush=True)
            return '250 Accepted by Gmail'
        except DeliveryError as error:
            print('catalogo_mail ' + str(error), flush=True)
            return '451 Gmail delivery unavailable'
        except Exception:
            print('catalogo_mail message_rejected', flush=True)
            return '451 Message processing unavailable'


def controller(config, gmail=None):
    handler = Handler(config, gmail or Gmail(config))
    # Plain SMTP exists only on the private Docker bridge, authenticated with a
    # random project-specific credential. Gmail requests always use HTTPS.
    return Controller(handler, hostname=config['bind_host'], port=int(config['port']),
        authenticator=lambda *args: authenticate(config, *args),
        auth_required=True, auth_require_tls=False, decode_data=False,
        enable_SMTPUTF8=False, data_size_limit=MAX_BYTES,
        timeout=30, command_call_limit=50, ready_timeout=10)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', required=True)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    config_path = pathlib.Path(args.config)
    if config_path.stat().st_mode & 0o077:
        raise SystemExit('Private config must be mode 600')
    try:
        config = json.loads(config_path.read_text())
        if config['sender'] != 'garblac01@gmail.com' or len(config['smtp_password']) < 40:
            raise ValueError('Invalid project settings')
        gmail = Gmail(config)
        gmail.refresh()
        if args.check:
            print(json.dumps({'oauth_refresh_verified': True, 'mail_sent': False}))
            return
        logging.getLogger('mail').setLevel(logging.CRITICAL)
        server = controller(config, gmail)
        server.start()
        stopped = threading.Event()
        for signum in (signal.SIGINT, signal.SIGTERM):
            signal.signal(signum, lambda *_: stopped.set())
        print('catalogo_mail ready', flush=True)
        stopped.wait()
        server.stop()
    except Exception:
        raise SystemExit('Catalogue relay unavailable; no credentials logged') from None


if __name__ == '__main__':
    main()
