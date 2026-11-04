"""Authenticate without sending mail, from the running Auth network namespace."""
import ctypes
import json
import os
import pathlib
import smtplib
import sys

def probe(pid):
    if os.geteuid() != 0 or not isinstance(pid, int) or pid <= 1:
        raise RuntimeError('Expected root and a running Auth PID')
    config = json.loads(pathlib.Path('/srv/garblac/catalogo-gmail-relay/config.json').read_text())
    descriptor = os.open('/proc/' + str(pid) + '/ns/net', os.O_RDONLY)
    try:
        libc = ctypes.CDLL(None, use_errno=True)
        if libc.setns(descriptor, 0x40000000) != 0:
            raise RuntimeError('Could not enter Auth network namespace')
    finally:
        os.close(descriptor)
    with smtplib.SMTP(config['bind_host'], config['port'], timeout=5) as smtp:
        smtp.login(config['smtp_user'], config['smtp_password'])
    return {'smtp_authentication_verified': True, 'mail_sent': False}

if __name__ == '__main__':
    try:
        print(json.dumps(probe(int(sys.argv[1]))), flush=True)
    except Exception as error:
        print(json.dumps({'smtp_authentication_verified': False, 'mail_sent': False,
                          'error_type': type(error).__name__}), flush=True)
        raise SystemExit(1)
