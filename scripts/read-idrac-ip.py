"""One read-only IPMI Get LAN Configuration Parameter request (IP address only).

Uses the Linux IPMI userspace ABI, not a shell tool or a network login.
Never sends Set LAN, reset, storage, password, or user-management commands.
References: Linux include/uapi/linux/ipmi.h; ipmitool Get LAN implementation.
"""
import ctypes as C
import json
import os
import select
import socket
import sys
import time


class Address(C.Structure):
    _fields_ = [('addr_type', C.c_int), ('channel', C.c_short), ('lun', C.c_ubyte)]


class Message(C.Structure):
    _fields_ = [('netfn', C.c_ubyte), ('cmd', C.c_ubyte), ('data_len', C.c_ushort), ('data', C.c_void_p)]


class Request(C.Structure):
    _fields_ = [('addr', C.c_void_p), ('addr_len', C.c_uint), ('msgid', C.c_long), ('msg', Message)]


class Receive(C.Structure):
    _fields_ = [('recv_type', C.c_int), ('addr', C.c_void_p), ('addr_len', C.c_uint), ('msgid', C.c_long), ('msg', Message)]


def ioctl_number(direction, number, size):
    return direction << 30 | size << 16 | ord('i') << 8 | number


def build_query():
    address = Address(0x0c, 0x0f, 0)
    # LAN channel 1, parameter 3 = IPv4 address, selectors 0 and 0.
    payload = (C.c_ubyte * 4)(1, 3, 0, 0)
    message = Message(0x0c, 0x02, 4, C.addressof(payload))
    request = Request(C.addressof(address), C.sizeof(address), 1, message)
    return request, address, payload


def parse_response(data):
    if not data or data[0] != 0:
        return {'error': 'BMC did not return a successful LAN response', 'completion_code': data[0] if data else None}
    if len(data) < 6:
        return {'error': 'Incomplete LAN address response'}
    ip = socket.inet_ntoa(data[2:6])
    return {'idrac_ipv4': ip, 'usable_address_reported': ip not in ['0.0.0.0', '255.255.255.255']}


def validate_abi():
    if C.sizeof(C.c_void_p) != 8 or tuple(map(C.sizeof, [Address, Message, Request, Receive])) != (8, 16, 40, 48):
        raise RuntimeError('Unsupported IPMI ABI; no request sent')
    if ioctl_number(2, 13, 40) != 0x8028690d or ioctl_number(3, 12, 48) != 0xc030690c:
        raise RuntimeError('Unexpected ioctl constants; no request sent')


def query():
    validate_abi()
    libc = C.CDLL(None, use_errno=True)
    libc.ioctl.argtypes = [C.c_int, C.c_ulong, C.c_void_p]
    libc.ioctl.restype = C.c_int
    descriptor = os.open('/dev/ipmi0', os.O_RDWR | os.O_NONBLOCK)
    try:
        request, address, payload = build_query()
        # The only sent message is Transport/Get LAN Config, never a write.
        if request.msg.netfn != 0x0c or request.msg.cmd != 0x02 or bytes(payload) != bytes([1, 3, 0, 0]):
            raise RuntimeError('Read-only command validation failed')
        if libc.ioctl(descriptor, ioctl_number(2, 13, C.sizeof(Request)), C.byref(request)) < 0:
            raise OSError(C.get_errno(), 'IPMI query rejected')
        deadline = time.monotonic() + 3
        while time.monotonic() < deadline:
            if not select.select([descriptor], [], [], max(0, deadline - time.monotonic()))[0]:
                break
            addr = C.create_string_buffer(64); data = C.create_string_buffer(256)
            response = Receive(0, C.addressof(addr), 64, 0, Message(0, 0, 256, C.addressof(data)))
            if libc.ioctl(descriptor, ioctl_number(3, 12, C.sizeof(Receive)), C.byref(response)) < 0:
                raise OSError(C.get_errno(), 'IPMI response unavailable')
            if response.msgid == 1 and response.msg.netfn == 0x0d and response.msg.cmd == 0x02:
                return parse_response(data.raw[:response.msg.data_len])
        return {'error': 'BMC address query timed out after 3 seconds'}
    finally:
        os.close(descriptor)


if __name__ == '__main__':
    report = {'production_changed': False, 'configuration_changed': False, 'query': 'Read IPv4 address of BMC LAN channel 1'}
    try:
        if '--self-test' in sys.argv:
            validate_abi(); request, address, payload = build_query()
            assert (request.msg.netfn, request.msg.cmd, bytes(payload)) == (12, 2, bytes([1, 3, 0, 0]))
            assert parse_response(bytes([0, 17, 192, 168, 0, 120]))['idrac_ipv4'] == '192.168.0.120'
            assert not parse_response(bytes([0, 17, 0, 0, 0, 0]))['usable_address_reported']
            assert 'error' in parse_response(bytes([0xc1]))
            assert 'error' in parse_response(bytes([0, 17, 192]))
            report.update(self_test_passed=True, hardware_accessed=False)
        else:
            if os.geteuid() != 0: raise RuntimeError('Run with sudo to read /dev/ipmi0')
            report.update(query())
    except Exception as error:
        report['error'] = str(error) if isinstance(error, RuntimeError) else type(error).__name__
    print(json.dumps(report, indent=2))
