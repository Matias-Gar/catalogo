"""Launch the reviewed installer, retaining its preflight and approval checks."""
import argparse
import hashlib
import json
import os
import pathlib
import runpy
import sys

parser = argparse.ArgumentParser()
parser.add_argument('--accept-storage-risk', action='store_true',
                    help='Acknowledge the known degraded RAID; does not bypass installer preflight')
parser.add_argument('--use-ram-compose', action='store_true',
                    help='Use the checksum-verified official Compose plugin staged in RAM')
parser.add_argument('--resume', action='store_true', help='Verify and resume the partial relay installation')
parser.add_argument('--use-ram-systemctl', action='store_true', help='Use the verified copy of systemctl in RAM')
options = parser.parse_args()
stage = pathlib.Path('/dev/shm/catalogo-gmail-prep-20261029-2227')
expected = '1ec9dfc767a97c5a93c50c47c16d7fc253eed2b239f124b2f6e5d18639dfb9eb'
if os.geteuid() != 0:
    raise SystemExit('Ejecuta con sudo. No se hizo ningun cambio.')
if (stage / 'storage-critical-block.json').exists() and not options.accept_storage_risk:
    raise SystemExit('Activacion suspendida: la controladora PERC registra errores de medio irrecuperables. Revisar almacenamiento antes de recrear Auth. No se hizo ningun cambio.')
if options.accept_storage_risk:
    print('Riesgo de RAID degradado aceptado expresamente. Se mantienen las comprobaciones de Docker, Auth, integridad y rollback; el RAID no se modifica.', flush=True)
manifest = stage / 'bundle-manifest.json'
if hashlib.sha256(manifest.read_bytes()).hexdigest() != expected:
    raise SystemExit('El manifiesto cambio. No se hizo ningun cambio.')
installer = stage / 'install-catalogo-gmail.py'
if hashlib.sha256(installer.read_bytes()).hexdigest() != json.loads(manifest.read_text())['install-catalogo-gmail.py']:
    raise SystemExit('El instalador cambio. No se hizo ningun cambio.')
if options.use_ram_compose:
    config = stage / 'docker-client-ram'
    plugin = config / 'cli-plugins/docker-compose'
    plugin_hash = '47737f4236e6d3ccea7291995203f8f018058783b4c3a9469119811a0b5db8c0'
    if config.is_symlink() or plugin.is_symlink() or hashlib.sha256(plugin.read_bytes()).hexdigest() != plugin_hash:
        raise SystemExit('Compose en RAM no coincide con la descarga oficial verificada. Sin cambios.')
    if json.loads((config / 'config.json').read_text()) != {}:
        raise SystemExit('Configuracion Docker temporal inesperada. Sin cambios.')
    os.environ['DOCKER_CONFIG'] = str(config)
    print('Compose oficial 5.6.1 verificado en RAM. La instalacion Docker del sistema no se reemplaza.', flush=True)
if options.resume:
    os.environ['CATALOGO_RESUME_GMAIL'] = '1'
if options.use_ram_systemctl:
    os.environ['CATALOGO_USE_RAM_SYSTEMCTL'] = '1'
sys.argv = [str(installer), str(stage), expected]
runpy.run_path(str(installer), run_name='__main__')
