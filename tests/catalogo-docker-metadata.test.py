"""Exercise the socket boundary against a fake Unix HTTP server, never Docker."""
import http.server
import importlib.util
import json
import os
import pathlib
import socketserver
import tempfile
import threading
import time
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('metadata', pathlib.Path(__file__).resolve().parents[1]/'scripts/catalogo_docker_metadata.py')
metadata = importlib.util.module_from_spec(spec); spec.loader.exec_module(metadata)


class MetadataTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix='catalogo-api-test-')
        self.socket_path = str(pathlib.Path(self.directory.name)/'docker.sock')
        self.routes = []; owner = self
        class Handler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                owner.routes.append(self.path)
                if getattr(owner,'delay',False): time.sleep(0.15)
                try:
                    self.send_response(200)
                    if not getattr(owner,'missing_header',False): self.send_header('Api-Version','1.52')
                    self.send_header('Content-Type','application/json'); self.end_headers()
                    self.wfile.write(json.dumps({'State':{'Status':'running'}}).encode())
                except BrokenPipeError:pass
            def log_message(self,*args):pass
        self.server = socketserver.UnixStreamServer(self.socket_path,Handler)
        self.thread = threading.Thread(target=self.server.serve_forever,daemon=True); self.thread.start()

    def tearDown(self):
        self.server.shutdown();self.server.server_close();self.thread.join();self.directory.cleanup()

    def test_reads_auth_without_version_endpoint(self):
        body,version = metadata.read_metadata('/containers/supabase-auth/json',self.socket_path)
        self.assertEqual(body['State']['Status'],'running');self.assertEqual(version,'1.52')
        self.assertEqual(self.routes,['/containers/supabase-auth/json'])

    def test_missing_api_header_rejected(self):
        self.missing_header=True
        with self.assertRaisesRegex(metadata.DockerMetadataError,'valid API version'):
            metadata.read_metadata('/containers/supabase-auth/json',self.socket_path)

    def test_unresponsive_endpoint_has_a_deadline(self):
        self.delay=True
        with self.assertRaisesRegex(metadata.DockerMetadataError,'timed out'):
            metadata.read_metadata('/containers/supabase-auth/json',self.socket_path,timeout=0.03)

    def test_unrelated_or_mutating_routes_not_supported(self):
        for route in ['/version','/containers/other-project/json','/containers/supabase-auth/stop','/networks/../version']:
            with self.assertRaises(metadata.DockerMetadataError): metadata.read_metadata(route,self.socket_path)
        self.assertEqual(self.routes,[])

    def test_cli_pins_observed_version_to_local_socket_only(self):
        with patch.dict(os.environ,{'DOCKER_HOST':'tcp://remote.invalid','DOCKER_CONTEXT':'other','DOCKER_TLS_VERIFY':'1'}):
            configured=metadata.cli_environment('1.52')
            self.assertEqual(configured['DOCKER_API_VERSION'],'1.52')
            self.assertEqual(configured['DOCKER_HOST'],'unix:///var/run/docker.sock')
            self.assertNotIn('DOCKER_CONTEXT',configured);self.assertNotIn('DOCKER_TLS_VERIFY',configured)
            self.assertEqual(os.environ['DOCKER_HOST'],'tcp://remote.invalid')

    def test_invalid_version_rejected(self):
        with self.assertRaises(metadata.DockerMetadataError):metadata.cli_environment('not-a-version')


if __name__=='__main__':unittest.main(verbosity=2)
