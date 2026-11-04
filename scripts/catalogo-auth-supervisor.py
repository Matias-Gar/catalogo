"""Recover only catalogue Auth after three failures; leave healthy Auth untouched."""
import json
import pathlib
import signal
import subprocess
import sys
import threading
import urllib.request

BASE=pathlib.Path('/srv/garblac/auth-continuity')
stopped=threading.Event()
for signum in [signal.SIGTERM,signal.SIGINT]:signal.signal(signum,lambda *_:stopped.set())

def main():
    configuration=json.loads((BASE/'health.json').read_text())
    failures=0
    while not stopped.is_set():
        try:
            request=urllib.request.Request('http://127.0.0.1:8000/auth/v1/health',headers={'apikey':configuration['anon_key']})
            with urllib.request.urlopen(request,timeout=3) as response:healthy=response.status==200
        except Exception:healthy=False
        failures=0 if healthy else failures+1
        if failures>=3:
            try:
                result=subprocess.run([sys.executable,str(BASE/'recover.py'),'--only-if-unhealthy'],
                                      capture_output=True,text=True,timeout=90)
                output=json.loads(result.stdout)
                print(json.dumps({'auth_continuity':output.get('status','unknown'),
                                  'auth_health_ok':output.get('auth_health_ok',False)}),flush=True)
            except Exception as error:
                print(json.dumps({'auth_continuity':'waiting','error_type':type(error).__name__}),flush=True)
            failures=0
        stopped.wait(10)

if __name__=='__main__':main()
