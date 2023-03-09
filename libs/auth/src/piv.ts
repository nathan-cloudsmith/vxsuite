import { Buffer } from 'buffer';
import { assert } from '@votingworks/basics';
import { Byte } from '@votingworks/types';

import { STATUS_WORD } from './apdu';

/**
 * PIV-specific IDs for different cryptographic algorithms, e.g. ECC, RSA, etc.
 */
export const CRYPTOGRAPHIC_ALGORITHM_IDENTIFIER = {
  /** Elliptic curve cryptography, curve P-256 */
  ECC256: 0x11,
} as const;

/**
 * GENERAL AUTHENTICATE is a PIV command that initiates an authentication protocol.
 */
export const GENERAL_AUTHENTICATE = {
  INS: 0x87,
  DYNAMIC_AUTHENTICATION_TEMPLATE_TAG: 0x7c,
  CHALLENGE_TAG: 0x81,
  RESPONSE_TAG: 0x82,
} as const;

/**
 * GENERATE ASYMMETRIC KEY PAIR is a PIV command that generates an asymmetric key pair. The public
 * key is exported, and the private key never leaves the card.
 */
export const GENERATE_ASYMMETRIC_KEY_PAIR = {
  INS: 0x47,
  P1: 0x00,
  CRYPTOGRAPHIC_ALGORITHM_IDENTIFIER_TEMPLATE_TAG: 0xac,
  CRYPTOGRAPHIC_ALGORITHM_IDENTIFIER_TAG: 0x80,
} as const;

/**
 * GET DATA is a PIV command that retrieves a data object.
 */
export const GET_DATA = {
  INS: 0xcb,
  P1: 0x3f,
  P2: 0xff,
  TAG_LIST_TAG: 0x5c,
} as const;

/**
 * PUT DATA is a PIV command that stores a data object.
 */
export const PUT_DATA = {
  INS: 0xdb,
  P1: 0x3f,
  P2: 0xff,
  TAG_LIST_TAG: 0x5c,
  DATA_TAG: 0x53,
  CERT_TAG: 0x70,
  CERT_INFO_TAG: 0x71,
  CERT_INFO_UNCOMPRESSED: 0x00,
  ERROR_DETECTION_CODE_TAG: 0xfe,
} as const;

/**
 * RESET RETRY COUNTER is a PIV command that changes the card PIN given the PUK (PIN unblocking
 * key) and resets the remaining PIN entry attempts count to its initial value.
 */
export const RESET_RETRY_COUNTER = {
  INS: 0x2c,
  P1: 0x00,
  P2: 0x80,
} as const;

/**
 * VERIFY is a PIV command that performs various forms of user verification, including PIN checks.
 */
export const VERIFY = {
  INS: 0x20,
  P1_VERIFY: 0x00,
  P2_PIN: 0x80,
} as const;

/**
 * Data object IDs of the format 0x5f 0xc1 0xXX are a PIV convention.
 */
export function pivDataObjectId(uniqueByte: Byte): Buffer {
  return Buffer.from([0x5f, 0xc1, uniqueByte]);
}

/**
 * Converts a PIN to the padded 8-byte buffer that the VERIFY command expects
 */
export function construct8BytePinBuffer(pin: string): Buffer {
  return Buffer.concat([
    Buffer.from(pin, 'utf-8'),
    Buffer.from([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]), // Padding
  ]).subarray(0, 8);
}

/**
 * The incorrect-PIN status word has the format 0x63 0xcX, where X is the number of remaining PIN
 * entry attempts before complete lockout (X being a hex digit).
 */
export function isIncorrectPinStatusWord(statusWord: [Byte, Byte]): boolean {
  const [sw1, sw2] = statusWord;
  // eslint-disable-next-line no-bitwise
  return sw1 === STATUS_WORD.VERIFY_FAIL.SW1 && sw2 >> 4 === 0x0c;
}

/**
 * See isIncorrectPinStatusWord().
 */
export function numRemainingAttemptsFromIncorrectPinStatusWord(
  statusWord: [Byte, Byte]
): number {
  assert(isIncorrectPinStatusWord(statusWord));
  const [, sw2] = statusWord;
  // Extract the last 4 bits of SW2
  // eslint-disable-next-line no-bitwise
  return sw2 & 0x0f;
}