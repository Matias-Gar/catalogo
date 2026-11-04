"""Bounded read-only metadata calls, without Docker's /version negotiation."""
import http.client
import json
import os
import re
import socket


class DockerMetadataError(RuntimeError):
    pass


class UnixHTTP(http.client.HTTPConnection):
    def __init__(self, socket_path, timeout):
        super().__init__('localhost', timeout=timeout)
        self.socket_path = socket_path

    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(self.timeout)
        self.sock.connect(self.socket_path)


def read_metadata(route, socket_path='/var/run/docker.sock', timeout=6):
    if route != '/containers/supabase-auth/json' and not re.fullmatch('/networks/[A-Za-z0-9_.-]+', route):
        raise DockerMetadataError('Unsupported metadata route')
    connection = UnixHTTP(socket_path, timeout)
    try:
        connection.request('GET', route)
        response = connection.getresponse()
        if response.status != 200:
            raise DockerMetadataError('Docker metadata HTTP ' + str(response.status))
        version = response.getheader('Api-Version', '')
        if not re.fullmatch(r'1\.\d{2,3}', version):
            raise DockerMetadataError('Docker did not advertise a valid API version')
        return json.load(response), version
    except DockerMetadataError:
        raise
    except TimeoutError:
        raise DockerMetadataError('Docker metadata timed out: ' + route) from None
    except Exception:
        raise DockerMetadataError('Docker metadata unavailable: ' + route) from None
    finally:
        connection.close()


def cli_environment(version):
    if not re.fullmatch(r'1\.\d{2,3}', version):
        raise DockerMetadataError('Invalid Docker API version')
    environment = dict(os.environ)
    for name in ['DOCKER_CONTEXT', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']:
        environment.pop(name, None)
    environment.update({'DOCKER_HOST': 'unix:///var/run/docker.sock', 'DOCKER_API_VERSION': version})
    return environment
