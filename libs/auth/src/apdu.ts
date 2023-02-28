/* eslint-disable max-classes-per-file */
import { Buffer } from 'buffer';
import { Byte, isByte } from '@votingworks/types';
import { assert } from '@votingworks/basics';

/**
 * The max length of an APDU
 */
export const MAX_APDU_LENGTH = 260;

/**
 * The max length of a command APDU's data. The `- 5` accounts for the CLA, INS, P1, P2, and Lc
 * (see CommandApdu below).
 */
const MAX_COMMAND_APDU_DATA_LENGTH = MAX_APDU_LENGTH - 5;

/**
 * Because APDUs have a max length, commands involving larger amounts of data have to be sent as
 * multiple, chained APDUs. The APDU CLA indicates whether more data has yet to be provided.
 */
const CLA = {
  STANDARD: 0x00,
  CHAINED: 0x10,
} as const;

/**
 * APDU status words are analogous to HTTP status codes. Every response APDU ends with one, each
 * consisting of two bytes, commonly referred to as SW1 and SW2.
 *
 * - 0x90 0x00 is equivalent to an HTTP 200.
 * - 0x61 0xXX is also equivalent to an HTTP 200 but indicates that XX more bytes of response data
 *   have yet to be retrieved via a GET RESPONSE command. Like command APDUs, response APDUs have a
 *   max length.
 */
export const STATUS_WORD = {
  SUCCESS: { SW1: 0x90, SW2: 0x00 },
  SUCCESS_MORE_DATA_AVAILABLE: { SW1: 0x61 },
} as const;

/**
 * The SELECT command is a standard command for selecting an applet.
 */
export const SELECT = {
  INS: 0xa4,
  P1: 0x04,
  P2: 0x00,
} as const;

/**
 * The GET RESPONSE command is a standard command for retrieving additional APDU response data.
 */
export const GET_RESPONSE = {
  INS: 0xc0,
  P1: 0x00,
  P2: 0x00,
} as const;

/**
 * An APDU, or application protocol data unit, is the communication unit between a smart card
 * reader and a smart card. The smart card reader issues command APDUs to the smart card, and the
 * smart card sends response APDUs back.
 *
 * See https://docs.yubico.com/yesdk/users-manual/yubikey-reference/apdu.html for a great overview.
 */
export class CommandApdu {
  /** CLA: Class */
  private readonly cla: Byte;
  /** INS: Instruction */
  private readonly ins: Byte;
  /** P1: Param 1 */
  private readonly p1: Byte;
  /** P2: Param 2 */
  private readonly p2: Byte;
  /** Lc: Length of data */
  private readonly lc: Byte;
  /** Data */
  private readonly data: Buffer;

  constructor(input: {
    chained?: boolean;
    ins: Byte;
    p1: Byte;
    p2: Byte;
    data?: Buffer;
  }) {
    const cla = input.chained ? CLA.CHAINED : CLA.STANDARD;
    const data = input.data ?? Buffer.from([]);

    if (data.length > MAX_COMMAND_APDU_DATA_LENGTH) {
      throw new Error('APDU data exceeds max command APDU data length');
    }
    assert(isByte(data.length));
    const lc = data.length;

    this.cla = cla;
    this.ins = input.ins;
    this.p1 = input.p1;
    this.p2 = input.p2;
    this.lc = lc;
    this.data = data;
  }

  asBuffer(): Buffer {
    return Buffer.concat([
      Buffer.from([this.cla, this.ins, this.p1, this.p2, this.lc]),
      this.data,
    ]);
  }
}

/**
 * A TLV, or tag-length-value, is a byte array that consists of:
 * 1. A tag indicating what the value is
 * 2. A length indicating the size of the value in bytes
 * 3. The value itself
 * The data in command and response APDUs is often comprised of TLVs.
 */
export function constructTlv(
  tagAsByteOrBuffer: Byte | Buffer,
  value: Buffer
): Buffer {
  const tag: Buffer = Buffer.isBuffer(tagAsByteOrBuffer)
    ? tagAsByteOrBuffer
    : Buffer.from([tagAsByteOrBuffer]);

  /**
   * The convention for TLV length is as follows:
   * - 0xXX           if value length < 128 bytes
   * - 0x81 0xXX      if value length > 128 and < 256 bytes
   * - 0x82 0xXX 0xXX if value length > 256 and < 65536 bytes
   *
   * For example:
   * - 51 bytes   --> Buffer.from([51])            --> 0x33           (33 is 51 in hex)
   * - 147 bytes  --> Buffer.from([0x81, 147])     --> 0x81 0x93      (93 is 147 in hex)
   * - 3017 bytes --> Buffer.from([0x82, 11, 201]) --> 0x82 0x0b 0xc9 (bc9 is 3017 in hex)
   */
  let tlvLength: Buffer;
  const valueNumBytes = value.length;
  if (valueNumBytes < 128) {
    tlvLength = Buffer.from([valueNumBytes]);
  } else if (valueNumBytes < 256) {
    tlvLength = Buffer.from([0x81, valueNumBytes]);
  } else if (valueNumBytes < 65536) {
    // eslint-disable-next-line no-bitwise
    tlvLength = Buffer.from([0x82, valueNumBytes >> 8, valueNumBytes & 255]);
  } else {
    throw new Error('TLV value is too large');
  }

  return Buffer.concat([tag, tlvLength, value]);
}

/**
 * A response APDU with a non-success status word
 */
export class ResponseApduError extends Error {
  private readonly sw1: Byte;
  private readonly sw2: Byte;

  constructor(statusWord: [Byte, Byte]) {
    const [sw1, sw2] = statusWord;
    super(
      'Received response APDU with non-success status: ' +
        `${sw1.toString(16)} ${sw2.toString(16)}`
    );
    this.sw1 = sw1;
    this.sw2 = sw2;
  }

  statusWord(): [Byte, Byte] {
    return [this.sw1, this.sw2];
  }
}