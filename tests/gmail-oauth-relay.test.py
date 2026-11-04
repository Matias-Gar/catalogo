"""Real SMTP exchanges with a fake Gmail sender; never contacts Google."""
import email.message
import importlib.util
import pathlib
import smtplib
import socket
import unittest

spec = importlib.util.spec_from_file_location('catalogo_relay', pathlib.Path(__file__).resolve().parents[1]/'scripts/gmail_oauth_relay.py')
relay = importlib.util.module_from_spec(spec)
spec.loader.exec_module(relay)


class FakeGmail:
    def __init__(self): self.messages = []
    def send(self, raw): self.messages.append(raw)


class RelaySecurity(unittest.TestCase):
    def setUp(self):
        with socket.socket() as probe:
            probe.bind(('127.0.0.1', 0)); port = probe.getsockname()[1]
        self.config = {'bind_host': '127.0.0.1', 'port': port, 'allowed_cidr': '127.0.0.0/8',
            'smtp_user': 'catalogo-auth', 'smtp_password': 'test-private-password-not-a-real-credential',
            'sender': 'garblac01@gmail.com'}
        self.gmail = FakeGmail()
        self.server = relay.controller(self.config, self.gmail)
        self.server.start()
        self.smtp = smtplib.SMTP('127.0.0.1', port, timeout=5)

    def tearDown(self):
        self.smtp.close(); self.server.stop()

    def login(self): self.smtp.login(self.config['smtp_user'], self.config['smtp_password'])

    def message(self, sender='garblac01@gmail.com', recipient='customer@example.invalid'):
        msg = email.message.EmailMessage()
        msg['From'] = sender; msg['To'] = recipient; msg['Subject'] = 'Recovery test'
        msg.set_content('https://garblac.duckdns.org/auth/v1/verify?token=fixture&type=recovery')
        return msg

    def test_unauthenticated_sender_rejected(self):
        with self.assertRaises(smtplib.SMTPSenderRefused): self.smtp.send_message(self.message())
        self.assertEqual(self.gmail.messages, [])

    def test_wrong_password_rejected(self):
        with self.assertRaises(smtplib.SMTPAuthenticationError): self.smtp.login('catalogo-auth', 'wrong')
        self.assertEqual(self.gmail.messages, [])

    def test_peer_outside_project_network_rejected(self):
        self.config['allowed_cidr'] = '192.0.2.0/24'
        with self.assertRaises(smtplib.SMTPAuthenticationError): self.login()
        self.assertEqual(self.gmail.messages, [])

    def test_authorized_message_preserves_recovery_link(self):
        self.login(); self.smtp.send_message(self.message())
        self.assertEqual(len(self.gmail.messages), 1)
        self.assertIn(b'garblac.duckdns.org/auth/v1/verify?token=fixture&type=recovery', self.gmail.messages[0])

    def test_sender_spoof_rejected(self):
        self.login()
        with self.assertRaises(smtplib.SMTPDataError): self.smtp.send_message(self.message('attacker@example.invalid'))
        self.assertEqual(self.gmail.messages, [])

    def test_header_recipient_mismatch_rejected(self):
        self.login()
        with self.assertRaises(smtplib.SMTPDataError):
            self.smtp.sendmail('garblac01@gmail.com', ['other@example.invalid'], self.message().as_bytes())
        self.assertEqual(self.gmail.messages, [])

    def test_extra_cc_rejected(self):
        self.login(); msg = self.message(); msg['Cc'] = 'hidden@example.invalid'
        with self.assertRaises(smtplib.SMTPDataError):
            self.smtp.sendmail('garblac01@gmail.com', ['customer@example.invalid'], msg.as_bytes())
        self.assertEqual(self.gmail.messages, [])


if __name__ == '__main__': unittest.main(verbosity=2)
