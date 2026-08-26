#!/usr/bin/env python3
'''
Pure-python AM32 ESC bootloader emulator for CI.

Serves the bootloader serial protocol on a pty so the protocol stack in
this repo (driven via cli/am32cli.mjs) can be tested without hardware.
Two transports:

  --mode direct   a single-wire serial adapter on the ESC signal pad:
                  every byte the client writes is echoed back before the
                  reply, since the app's direct mode paces itself on the
                  adapter's self-echo of the shared wire
  --mode 4way     a Betaflight-style FC: minimal MSP plus BLHeli 4-way
                  passthrough to the emulated bootloader

Two bootloader generations, modelled on the AM32-bootloader sources:

  --generation new   V19-era, BOOTLOADER_PROTOCOL_VERSION 3 with the
                     magic devinfo block at CMD_SET_ADDRESS 0x23
  --generation old   V17-era, protocol version 2: EEPROM/FILE_NAME/
                     CONTINUE magics only, 0x23 gets BAD_ACK

Prints the pty slave path on stdout, then serves until killed.
'''

import argparse
import os
import pty
import select
import struct
import sys
import time
import tty

MCU_FLASH_START = 0x08000000

# 4-way frame markers and acks (betaflight serial_4way.h)
REQ_MARK = 0x2F
RESP_MARK = 0x2E
ACK_OK = 0x00
ACK_I_INVALID_CMD = 0x02
ACK_D_GENERAL_ERROR = 0x0F

# bootloader serial acks
GOOD_ACK = 0x30
BAD_ACK = 0xC1
BAD_CRC_ACK = 0xC2

DEVINFO_MAGIC1 = 0x5925E3DA
DEVINFO_MAGIC2 = 0x4EB863D9

# where the devinfo struct lives inside the (emulated) bootloader flash
DEVINFO_FLASH_OFFSET = 0x0D00

# per --flash-size identity: FLASH_SIZE_CODE (deviceInfo byte 4, high byte
# of the app-side signature), eeprom offset, app start, address shift and
# a file name whose trailing token matches the MCU type in src/mcu.ts
FLASH_VARIANTS = {
    32: {
        'size_code': 0x1F,       # signature 0x1F06 (STM32F051)
        'eeprom_offset': 0x7C00,
        'fw_start': 0x1000,
        'shift': 0,
        'pin_code': 0x14,        # PB4
        'file_name': 'AM32_CITEST_F051',
    },
    64: {
        'size_code': 0x35,       # signature 0x3506 (ARM64K)
        'eeprom_offset': 0xF800,
        'fw_start': 0x1000,
        'shift': 0,
        'pin_code': 0x02,        # PA2
        'file_name': 'AM32_CITEST_L431',
    },
    128: {
        'size_code': 0x2B,       # signature 0x2B06 (STM32G431)
        'eeprom_offset': 0x1F800,
        'fw_start': 0x4000,      # CAN-class bootloader, 16k
        'shift': 2,              # wire addresses are real offsets >> 2
        'pin_code': 0x14,        # PB4
        'file_name': 'AM32_CITEST_G431',
    },
}

LAYOUT_SIZE = 0xB8


def crc16_direct(data):
    '''bootloader frame CRC: poly 0xA001, init 0, LSB first'''
    crc = 0
    for b in data:
        for _ in range(8):
            if (b ^ crc) & 1:
                crc = (crc >> 1) ^ 0xA001
            else:
                crc >>= 1
            b >>= 1
    return crc


def crc16_xmodem(data, crc=0):
    for b in data:
        crc ^= b << 8
        for _ in range(8):
            if crc & 0x8000:
                crc = ((crc << 1) ^ 0x1021) & 0xFFFF
            else:
                crc = (crc << 1) & 0xFFFF
    return crc


def default_settings(bl_version):
    '''a plausible 184-byte settings block (src/eeprom.ts EepromLayout)'''
    s = bytearray(LAYOUT_SIZE)
    vals = {
        0x00: 1,            # BOOT_BYTE
        0x01: 4,            # LAYOUT_REVISION
        0x02: bl_version,   # BOOT_LOADER_REVISION
        0x03: 2,            # MAIN_REVISION
        0x04: 18,           # SUB_REVISION
        0x05: 32,           # MAX_RAMP
        0x09: 100,          # CURRENT_P
        0x0A: 45,           # CURRENT_I
        0x0C: 10,           # ACTIVE_BRAKE_POWER
        0x14: 1,            # COMPLEMENTARY_PWM
        0x15: 1,            # VARIABLE_PWM_FREQUENCY
        0x16: 1,            # STUCK_ROTOR_PROTECTION
        0x17: 2,            # TIMING_ADVANCE
        0x18: 24,           # PWM_FREQUENCY
        0x19: 100,          # STARTUP_POWER
        0x1A: 55,           # MOTOR_KV
        0x1B: 14,           # MOTOR_POLES
        0x1E: 5,            # BEEP_VOLUME
        0x20: 128,          # SERVO_LOW_THRESHOLD
        0x21: 128,          # SERVO_HIGH_THRESHOLD
        0x22: 128,          # SERVO_NEUTRAL
        0x23: 50,           # SERVO_DEAD_BAND
        0x25: 50,           # LOW_VOLTAGE_THRESHOLD
        0x28: 5,            # SINE_MODE_RANGE
        0x29: 10,           # BRAKE_STRENGTH
        0x2A: 10,           # RUNNING_BRAKE_LEVEL
        0x2B: 141,          # TEMPERATURE_LIMIT
        0x2C: 102,          # CURRENT_LIMIT
        0x2D: 5,            # SINE_MODE_POWER
    }
    for off, v in vals.items():
        s[off] = v
    return bytes(s)


class EscModel(object):
    '''the bootloader-visible state of one emulated ESC: its flash and
    the command handling of AM32-bootloader bootloader/main.c'''

    def __init__(self, generation, flash_kb, run_seconds=2.0, log=None):
        self.generation = generation
        v = FLASH_VARIANTS[flash_kb]
        self.flash_size = flash_kb * 1024
        self.eeprom_add = MCU_FLASH_START + v['eeprom_offset']
        self.app_add = MCU_FLASH_START + v['fw_start']
        self.shift = v['shift']
        self.pin_code = v['pin_code']
        self.size_code = v['size_code']
        self.bl_version = 19 if generation == 'new' else 17
        self.protocol_version = 3 if generation == 'new' else 2
        self.run_seconds = run_seconds
        self.log = log or (lambda s: None)

        self.flash = bytearray(b'\xFF' * self.flash_size)
        eep = v['eeprom_offset']
        self._store(eep, default_settings(self.bl_version))
        name = v['file_name'].encode().ljust(32, b'\0')
        self._store(eep - 32, name)
        if generation == 'new':
            self._store(DEVINFO_FLASH_OFFSET, self._devinfo_block())

        self.address = 0
        self.continue_address = 0
        self.payload = b''
        self.payload_size = 0
        self.running_until = 0.0

    def _store(self, offset, data):
        self.flash[offset:offset + len(data)] = data

    def device_info(self):
        return bytes([ord('4'), ord('7'), ord('1'), self.pin_code,
                      self.size_code, 0x06, 0x06, self.protocol_version,
                      GOOD_ACK])

    def _devinfo_block(self):
        '''packed devinfo struct, layout as in bootloader/main.c: the
        uint16_t starts are (address >> shift) truncated to 16 bits'''
        fw_rel = self.app_add - MCU_FLASH_START
        return struct.pack(
            '<II9sBBHHHH',
            DEVINFO_MAGIC1, DEVINFO_MAGIC2, self.device_info(),
            27, self.shift,
            (fw_rel >> self.shift) & 0xFFFF,
            ((self.eeprom_add - 32) >> self.shift) & 0xFFFF,
            (self.eeprom_add >> self.shift) & 0xFFFF,
            ((self.eeprom_add + 48) >> self.shift) & 0xFFFF)

    # -- state ---------------------------------------------------------

    @property
    def running(self):
        '''True while "the application is running": quiet on the wire.
        Returns to the bootloader when the app quiet-times-out.'''
        return time.time() < self.running_until

    def run(self):
        self.log('CMD_RUN: running the app for %.1fs' % self.run_seconds)
        self.running_until = time.time() + self.run_seconds
        self.address = 0
        self.continue_address = 0

    # -- commands ------------------------------------------------------

    def set_address(self, addr16):
        '''CMD_SET_ADDRESS body: returns GOOD_ACK or BAD_ACK'''
        if addr16 == 0x20:                       # ADDRESS_MAGIC_EEPROM
            self.address = self.eeprom_add
        elif addr16 == 0x21:                     # ADDRESS_MAGIC_FILE_NAME
            self.address = self.eeprom_add - 32
        elif addr16 == 0x22:                     # ADDRESS_MAGIC_CONTINUE
            self.address = self.continue_address
        elif addr16 == 0x23 and self.generation == 'new':
            self.address = MCU_FLASH_START + DEVINFO_FLASH_OFFSET
        elif addr16 < 1024:
            # reserved (includes 0x23 on the old generation)
            return BAD_ACK
        else:
            self.address = MCU_FLASH_START + (addr16 << self.shift)
        return GOOD_ACK

    def read_mem(self, size):
        '''CMD_READ_FLASH_SIL: data bytes, or None for BAD_ACK'''
        if self.address == 0:
            return None
        off = self.address - MCU_FLASH_START
        data = bytes(self.flash[off:off + size])
        data += b'\xFF' * (size - len(data))
        self.continue_address = self.address + size
        self.address = 0
        return data

    def set_buffer(self, size):
        self.payload = b''
        self.payload_size = size

    def store_payload(self, data):
        self.payload = bytes(data)

    def prog_flash(self):
        '''CMD_PROG_FLASH: returns GOOD_ACK or BAD_ACK'''
        if self.address < self.app_add:
            return BAD_ACK
        off = self.address - MCU_FLASH_START
        if off + len(self.payload) > self.flash_size:
            return BAD_ACK
        data = bytearray(self.payload)
        if self.address == self.eeprom_add and len(data) > 2:
            # the bootloader stamps its version into the settings block
            data[2] = self.bl_version
        self._store(off, bytes(data))
        return GOOD_ACK

    def erase(self):
        '''CMD_ERASE_FLASH only validates the address'''
        return GOOD_ACK if self.address >= self.app_add else BAD_ACK


class PtyEndpoint(object):
    def __init__(self):
        self.master, self.slave = pty.openpty()
        # raw now, or the line discipline echoes the client at us
        tty.setraw(self.slave)
        self.path = os.ttyname(self.slave)

    def read(self, timeout=0.02):
        try:
            ready, _, _ = select.select([self.master], [], [], timeout)
        except (OSError, ValueError):
            return b''
        if not ready:
            return b''
        try:
            return os.read(self.master, 4096)
        except OSError:
            return b''

    def write(self, data):
        os.write(self.master, data)


class DirectServer(object):
    '''the single-wire adapter view of the bootloader: self-echo of every
    client byte, then the bootloader reply. Frames are recognised by
    their known lengths; a bare CMD_RUN (4 zero bytes, a prefix of the
    21-byte BLHeli probe) is resolved by a short idle timeout, standing
    in for the line-idle gap that ends a frame on the real wire.'''

    RUN_IDLE = 0.05

    def __init__(self, esc, log):
        self.esc = esc
        self.log = log
        self.ep = PtyEndpoint()
        self.buf = b''
        self.last_rx = 0.0
        self.expect_payload = False
        self.was_running = False

    def serve_forever(self):
        while True:
            chunk = self.ep.read(0.02)
            now = time.time()
            if self.esc.running:
                # the app answers nothing; the adapter still self-echoes
                if chunk:
                    self.ep.write(chunk)
                self.buf = b''
                self.expect_payload = False
                self.was_running = True
                continue
            if self.was_running:
                self.was_running = False
                self.log('back in bootloader')
            if chunk:
                self.ep.write(chunk)        # adapter self-echo, reply after
                self.buf += chunk
                self.last_rx = now
            self._parse(now)

    def _parse(self, now):
        while self.buf and not self.esc.running:
            if self.expect_payload:
                need = self.esc.payload_size + 2
                if len(self.buf) < need:
                    return
                frame, self.buf = self.buf[:need], self.buf[need:]
                self._handle_payload(frame)
                continue
            n = self._frame_length(now)
            if n is None:
                return
            if n == 0:      # unknown junk: answer like the bootloader
                self.buf = b''
                self.ep.write(bytes([BAD_ACK]))
                return
            if len(self.buf) < n:
                return
            frame, self.buf = self.buf[:n], self.buf[n:]
            self._handle_frame(frame)

    def _frame_length(self, now):
        '''expected frame length for the buffered bytes; None = wait'''
        b0 = self.buf[0]
        if b0 in (0xFF, 0xFE):
            return 6                     # SET_ADDRESS / SET_BUFFER
        if b0 in (0x01, 0x02, 0x03, 0xFD):
            return 4                     # PROG / ERASE / READ / KEEP_ALIVE
        if b0 == 0x00:
            # CMD_RUN (4 zeros) or the 21-byte BLHeli init probe
            if len(self.buf) >= 21:
                return 21
            probe_prefix = b'\0' * 12 + b'\x0dBLHeli\xF4\x7D'
            if self.buf == probe_prefix[:len(self.buf)]:
                if len(self.buf) == 4 and now - self.last_rx > self.RUN_IDLE:
                    return 4             # idle gap: it was CMD_RUN
                return None              # could still grow into the probe
            return 0
        return 0

    def _handle_frame(self, frame):
        esc = self.esc
        if len(frame) == 21:
            if frame[20] == 0x7D and frame[12] == 13 and frame[13] == 66:
                self.log('BLHeli probe -> deviceInfo')
                self.ep.write(esc.device_info())
            return
        cmd = frame[0]
        if cmd == 0x00:                  # CMD_RUN
            esc.run()
            return
        if cmd == 0xFF:                  # CMD_SET_ADDRESS
            if not self._crc_ok(frame, 4):
                return
            self.ep.write(bytes([esc.set_address((frame[2] << 8) | frame[3])]))
            return
        if cmd == 0xFE:                  # CMD_SET_BUFFER: no ack
            if crc16_direct(frame[:4]) != (frame[4] | (frame[5] << 8)):
                self.ep.write(bytes([BAD_CRC_ACK]))
                return
            esc.set_buffer(256 if frame[2] == 0x01 else frame[3])
            self.expect_payload = True
            return
        if not self._crc_ok(frame, 2):
            return
        if cmd == 0x01:                  # CMD_PROG_FLASH
            self.ep.write(bytes([esc.prog_flash()]))
        elif cmd == 0x02:                # CMD_ERASE_FLASH
            self.ep.write(bytes([esc.erase()]))
        elif cmd == 0x03:                # CMD_READ_FLASH_SIL
            if esc.address == 0:
                self.ep.write(bytes([BAD_ACK]))
                return
            size = frame[1] or 256
            data = esc.read_mem(size)
            crc = crc16_direct(data)
            self.ep.write(data + bytes([crc & 0xFF, crc >> 8, GOOD_ACK]))
        elif cmd == 0xFD:                # CMD_KEEP_ALIVE answers 0xC1
            self.ep.write(bytes([BAD_ACK]))
        else:
            self.ep.write(bytes([BAD_ACK]))

    def _handle_payload(self, frame):
        data, crc = frame[:-2], frame[-2] | (frame[-1] << 8)
        self.expect_payload = False
        if crc16_direct(data) != crc:
            self.ep.write(bytes([BAD_CRC_ACK]))
            return
        self.esc.store_payload(data)
        self.ep.write(bytes([GOOD_ACK]))

    def _crc_ok(self, frame, body_len):
        if crc16_direct(frame[:body_len]) == \
                (frame[body_len] | (frame[body_len + 1] << 8)):
            return True
        self.ep.write(bytes([BAD_CRC_ACK]))
        return False


class FourWayFC(object):
    '''a Betaflight-style FC: minimal MSP, then BLHeli 4-way passthrough
    after MSP_SET_PASSTHROUGH. Each 4-way command becomes bootloader
    transactions against the EscModel, mirroring what a real FC does on
    the one-wire side.'''

    def __init__(self, esc, log):
        self.esc = esc
        self.log = log
        self.ep = PtyEndpoint()
        self.in_fourway = False
        self.buf = b''

    def serve_forever(self):
        while True:
            chunk = self.ep.read(0.05)
            if not chunk:
                continue
            self.buf += chunk
            if self.in_fourway:
                self._fourway_parse()
            else:
                self._msp_parse()

    # -- MSP -----------------------------------------------------------

    def _msp_reply(self, cmd, payload=b''):
        hdr = bytes([len(payload), cmd])
        ck = 0
        for b in hdr + payload:
            ck ^= b
        self.ep.write(b'$M>' + hdr + payload + bytes([ck]))

    def _msp_parse(self):
        while True:
            start = self.buf.find(b'$M<')
            if start < 0:
                self.buf = b''
                return
            self.buf = self.buf[start:]
            if len(self.buf) < 6:
                return
            size = self.buf[3]
            if len(self.buf) < 6 + size:
                return
            cmd = self.buf[4]
            payload = self.buf[5:5 + size]
            ck = 0
            for b in self.buf[3:5 + size]:
                ck ^= b
            good = ck == self.buf[5 + size]
            self.buf = self.buf[6 + size:]
            if good:
                self._msp_handle(cmd, payload)
            if self.in_fourway:
                self._fourway_parse()
                return

    def _msp_handle(self, cmd, payload):
        if cmd == 1:        # MSP_API_VERSION
            self._msp_reply(cmd, struct.pack('<BBB', 0, 1, 46))
        elif cmd == 2:      # MSP_FC_VARIANT
            self._msp_reply(cmd, b'BTFL')
        elif cmd == 130:    # MSP_BATTERY_STATE
            self._msp_reply(cmd, struct.pack('<BHBHH', 4, 1500, 126, 0, 0))
        elif cmd == 131:    # MSP_MOTOR_CONFIG
            self._msp_reply(cmd, struct.pack('<HHHBBBB',
                                             1070, 2000, 1000, 4, 14, 1, 0))
        elif cmd == 104:    # MSP_MOTOR
            self._msp_reply(cmd, struct.pack('<8H', *([1000] * 8)))
        elif cmd == 245:    # MSP_SET_PASSTHROUGH
            self._msp_reply(cmd, bytes([1]))
            self.in_fourway = True
            self.log('4-way passthrough started')
        else:
            self.ep.write(b'$M!' + bytes([0, cmd, cmd]))

    # -- 4-way ---------------------------------------------------------

    def _fourway_parse(self):
        while True:
            start = self.buf.find(bytes([REQ_MARK]))
            if start < 0:
                self.buf = b''
                return
            self.buf = self.buf[start:]
            if len(self.buf) < 5:
                return
            size = self.buf[4] or 256
            total = 7 + size
            if len(self.buf) < total:
                return
            frame, self.buf = self.buf[:total], self.buf[total:]
            if struct.unpack('>H', frame[-2:])[0] != crc16_xmodem(frame[:-2]):
                self.log('bad 4-way request crc, dropped')
                continue
            self.ep.write(self._handle(frame))
            if not self.in_fourway:
                return

    def _reply(self, cmd, address, params, ack):
        body = (bytes([RESP_MARK, cmd, (address >> 8) & 0xFF, address & 0xFF,
                       len(params) & 0xFF]) + bytes(params) + bytes([ack]))
        return body + struct.pack('>H', crc16_xmodem(body))

    def _connect(self):
        '''probe until the ESC is back in its bootloader, as an FC's
        passthrough retries do; bounded so a dead ESC still errors'''
        deadline = time.time() + 3.0
        while self.esc.running and time.time() < deadline:
            time.sleep(0.05)
        return not self.esc.running

    def _handle(self, frame):
        esc = self.esc
        cmd = frame[1]
        address = (frame[2] << 8) | frame[3]
        size = frame[4] or 256
        params = frame[5:5 + size]

        if cmd == 0x31:              # cmd_ProtocolGetVersion
            return self._reply(cmd, address, [107], ACK_OK)
        if cmd == 0x32:              # cmd_InterfaceGetName
            return self._reply(cmd, address, b'm4wFCIntf', ACK_OK)
        if cmd == 0x33:              # cmd_InterfaceGetVersion
            return self._reply(cmd, address, [20, 1], ACK_OK)
        if cmd == 0x34:              # cmd_InterfaceExit
            self.in_fourway = False
            self.log('4-way interface exited')
            return self._reply(cmd, address, [0], ACK_OK)
        if cmd in (0x3F, 0x3C):      # SetMode / C2CK_LOW
            return self._reply(cmd, address, [0], ACK_OK)
        if cmd == 0x30:              # cmd_InterfaceTestAlive
            ack = ACK_OK if not esc.running else ACK_D_GENERAL_ERROR
            return self._reply(cmd, address, [0], ack)
        if cmd == 0x37:              # cmd_DeviceInitFlash
            if params and params[0] != 0:
                return self._reply(cmd, address, [0], ACK_I_INVALID_CMD)
            if not self._connect():
                return self._reply(cmd, address, [0], ACK_D_GENERAL_ERROR)
            info = esc.device_info()
            # escDeviceInfo_t: signature LE from bytes 4/5, then the pin
            # code and boot-pages slots
            return self._reply(cmd, address,
                               [info[5], info[4], info[3], info[6]], ACK_OK)
        if cmd == 0x35:              # cmd_DeviceReset
            esc.run()
            return self._reply(cmd, address, [0], ACK_OK)
        if cmd in (0x3A, 0x3D):      # cmd_DeviceRead / ReadEEprom
            if esc.running:
                return self._reply(cmd, address, [0], ACK_D_GENERAL_ERROR)
            rd_size = (params[0] or 256) if params else 256
            if esc.set_address(address) != GOOD_ACK:
                return self._reply(cmd, address, [0], ACK_D_GENERAL_ERROR)
            data = esc.read_mem(rd_size)
            if data is None:
                return self._reply(cmd, address, [0], ACK_D_GENERAL_ERROR)
            return self._reply(cmd, address, data, ACK_OK)
        if cmd in (0x3B, 0x3E):      # cmd_DeviceWrite / WriteEEprom
            if esc.running or not params:
                return self._reply(cmd, address, [0], ACK_D_GENERAL_ERROR)
            if esc.set_address(address) != GOOD_ACK:
                return self._reply(cmd, address, [0], ACK_D_GENERAL_ERROR)
            esc.set_buffer(len(params))
            esc.store_payload(params)
            ack = ACK_OK if esc.prog_flash() == GOOD_ACK \
                else ACK_D_GENERAL_ERROR
            return self._reply(cmd, address, [0], ack)
        if cmd == 0x39:              # cmd_DevicePageErase
            if esc.running or esc.set_address(address) != GOOD_ACK:
                return self._reply(cmd, address, [0], ACK_D_GENERAL_ERROR)
            ack = ACK_OK if esc.erase() == GOOD_ACK else ACK_D_GENERAL_ERROR
            return self._reply(cmd, address, params[:1] or [0], ack)
        if cmd == 0x38:              # cmd_DeviceEraseAll: never supported
            return self._reply(cmd, address, [0], ACK_I_INVALID_CMD)
        return self._reply(cmd, address, [0], ACK_I_INVALID_CMD)


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[1])
    parser.add_argument('--mode', choices=['direct', '4way'],
                        default='direct')
    parser.add_argument('--generation', choices=['old', 'new'],
                        default='new')
    parser.add_argument('--flash-size', type=int, choices=[32, 64, 128],
                        default=32)
    parser.add_argument('--run-seconds', type=float, default=2.0,
                        help='how long the "app" runs after CMD_RUN '
                             'before quiet-timing-out into the bootloader')
    parser.add_argument('--verbose', action='store_true')
    args = parser.parse_args()

    def log(msg):
        if args.verbose:
            print('sim: %s' % msg, file=sys.stderr, flush=True)

    esc = EscModel(args.generation, args.flash_size,
                   run_seconds=args.run_seconds, log=log)
    if args.mode == 'direct':
        server = DirectServer(esc, log)
    else:
        server = FourWayFC(esc, log)
    print(server.ep.path, flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == '__main__':
    sys.exit(main())
