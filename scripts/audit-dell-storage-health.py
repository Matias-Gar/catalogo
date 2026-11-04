"""Read-only host storage diagnosis. No service control, repairs or SMART writes."""
import datetime
import errno
import json
import os
import pathlib
import re
import signal
import subprocess
import time

report = {'checked_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'production_changed': False, 'memory': {}, 'pressure': {}, 'root_devices': []}
for line in pathlib.Path('/proc/meminfo').read_text().splitlines():
    key, value = line.split(':', 1)
    if key in ['MemTotal', 'MemAvailable', 'SwapTotal', 'SwapFree']:
        report['memory'][key] = value.strip()
for kind in ['io', 'memory']:
    report['pressure'][kind] = pathlib.Path('/proc/pressure/' + kind).read_text().strip()

names = set()
def discover(name):
    if name in names: return
    names.add(name)
    node = pathlib.Path('/sys/class/block') / name
    if (node / 'slaves').is_dir():
        for slave in (node / 'slaves').iterdir(): discover(slave.name)
    if (node / 'partition').exists(): discover(node.resolve().parent.name)

root_device = os.stat('/').st_dev
sys_device = pathlib.Path('/sys/dev/block') / (str(os.major(root_device)) + ':' + str(os.minor(root_device)))
if sys_device.exists(): discover(sys_device.resolve().name)
def stats():
    return {name: list(map(int, (pathlib.Path('/sys/class/block') / name / 'stat').read_text().split())) for name in names}
start = time.monotonic(); before = stats(); time.sleep(2); after = stats(); elapsed = time.monotonic() - start
for name in sorted(names):
    first, last = before[name], after[name]
    reads, writes = last[0] - first[0], last[4] - first[4]
    row = {'device': name, 'sample_seconds': round(elapsed, 2), 'reads_completed': reads,
           'writes_completed': writes, 'inflight': last[8],
           'read_average_ms': round((last[3] - first[3]) / reads, 2) if reads else None,
           'write_average_ms': round((last[7] - first[7]) / writes, 2) if writes else None,
           'busy_percent': round(min(100, (last[9] - first[9]) / elapsed / 10), 2)}
    for field in ['model', 'vendor', 'state']:
        target = pathlib.Path('/sys/class/block') / name / 'device' / field
        if target.exists(): row[field] = target.read_text().strip()
    report['root_devices'].append(row)

report['installed_storage_tools'] = [name for name in ['/usr/sbin/smartctl', '/usr/bin/smartctl',
    '/opt/MegaRAID/perccli/perccli64', '/opt/MegaRAID/storcli/storcli64'] if pathlib.Path(name).is_file()]
if os.geteuid() == 0 and '/usr/sbin/smartctl' in report['installed_storage_tools'] and any(
        row['device'] == 'sda' and 'PERC' in row.get('model', '') for row in report['root_devices']):
    # Only read health/attributes/identity of physical drive 0 behind the root
    # filesystem's PERC adapter. No self-test, settings change or repair.
    probe = subprocess.Popen(['/usr/sbin/smartctl', '-j', '-H', '-A', '-i', '-d', 'megaraid,0', '/dev/sda'],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, start_new_session=True)
    try:
        output, _ = probe.communicate(timeout=10)
        try:
            health = json.loads(output)
            report['physical_drive_0_probe'] = {
                'smartctl_exit': probe.returncode,
                'health_passed': health.get('smart_status', {}).get('passed'),
                'model': health.get('model_name', health.get('product')),
                'messages': [message.get('string', '')[:300] for message in health.get('smartctl', {}).get('messages', [])],
                'selected_ata_attributes': [{'id': row['id'], 'name': row.get('name'), 'raw': row.get('raw', {}).get('value')}
                    for row in health.get('ata_smart_attributes', {}).get('table', []) if row['id'] in [5, 9, 187, 188, 197, 198, 199]],
                'scsi_grown_defect_list': health.get('scsi_grown_defect_list'),
                'limitation': 'One physical ID queried; not a complete RAID/controller health assessment'}
        except (ValueError, TypeError):
            report['physical_drive_0_probe'] = {'result': 'No valid JSON returned', 'exit': probe.returncode}
    except subprocess.TimeoutExpired:
        os.killpg(probe.pid, signal.SIGKILL)
        try: probe.communicate(timeout=2)
        except subprocess.TimeoutExpired: pass
        report['physical_drive_0_probe'] = {'result': 'Read-only SMART probe timed out after 10 seconds'}
report['kernel_storage_messages'] = []
pattern = re.compile(r'I/O error|Buffer I/O|EXT4-fs.*(error|warn)|blk_update_request|reset.*(scsi|ata|sd[a-z])|megaraid|blocked for more than|device-mapper|nvme.*(error|timeout)|sd[a-z].*(error|fail|timeout)', re.I)
try:
    descriptor = os.open('/dev/kmsg', os.O_RDONLY | os.O_NONBLOCK)
    report['kernel_readable'] = True
    try:
        for _ in range(20000):
            try: record = os.read(descriptor, 16384).decode(errors='replace')
            except BlockingIOError: break
            except OSError as error:
                if error.errno == errno.EPIPE: continue
                raise
            if not record: break
            header, _, message = record.partition(';')
            if pattern.search(message):
                report['kernel_storage_messages'].append({'boot_seconds': round(int(header.split(',')[2]) / 1000000, 2), 'message': message.strip()[:700]})
                report['kernel_storage_messages'] = report['kernel_storage_messages'][-50:]
    finally: os.close(descriptor)
except PermissionError:
    report['kernel_readable'] = False
    report['kernel_limitation'] = 'Root access required to read kernel messages'

target = pathlib.Path('/dev/shm/catalogo-storage-health-' + str(int(time.time())) + '.json')
report['report_path'] = str(target)
with os.fdopen(os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as file:
    json.dump(report, file, indent=2)
if os.geteuid() == 0:
    import pwd
    user = pwd.getpwnam('matias'); os.chown(target, user.pw_uid, user.pw_gid)
print(json.dumps(report, indent=2))
