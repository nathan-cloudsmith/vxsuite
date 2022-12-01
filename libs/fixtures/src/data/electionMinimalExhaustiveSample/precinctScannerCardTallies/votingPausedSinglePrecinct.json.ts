/* Generated by res-to-ts. DO NOT EDIT */
/* eslint-disable */
/* istanbul ignore file */

import { Buffer } from 'buffer';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, sep } from 'path';

/**
 * Data of data/electionMinimalExhaustiveSample/precinctScannerCardTallies/votingPausedSinglePrecinct.json encoded as base64.
 *
 * SHA-256 hash of file data: 8697f48d895fa7e49199b9f571493033bbde08d5b45258026aa68f21c8448301
 */
const resourceDataBase64 = 'ewogICJ0YWxseU1hY2hpbmVUeXBlIjogInByZWNpbmN0X3NjYW5uZXIiLAogICJ0b3RhbEJhbGxvdHNTY2FubmVkIjogOTcsCiAgImlzTGl2ZU1vZGUiOiBmYWxzZSwKICAicG9sbHNUcmFuc2l0aW9uIjogInBhdXNlX3ZvdGluZyIsCiAgIm1hY2hpbmVJZCI6ICIwMDAwIiwKICAidGltZVNhdmVkIjogMTY2NTYxNjA2OTc2OSwKICAidGltZVBvbGxzVHJhbnNpdGlvbmVkIjogMTY2NTYxNjA2OTc2OSwKICAicHJlY2luY3RTZWxlY3Rpb24iOiB7CiAgICAia2luZCI6ICJTaW5nbGVQcmVjaW5jdCIsCiAgICAicHJlY2luY3RJZCI6ICJwcmVjaW5jdC0xIgogIH0KfQo=';

/**
 * MIME type of data/electionMinimalExhaustiveSample/precinctScannerCardTallies/votingPausedSinglePrecinct.json.
 */
export const mimeType = 'application/json';

/**
 * Path to a file containing this file's contents.
 *
 * SHA-256 hash of file data: 8697f48d895fa7e49199b9f571493033bbde08d5b45258026aa68f21c8448301
 */
export function asFilePath(): string {
  const directoryPath = mkdtempSync(tmpdir() + sep);
  const filePath = join(directoryPath, 'votingPausedSinglePrecinct.json');
  writeFileSync(filePath, asBuffer());
  return filePath;
}

/**
 * Convert to a `data:` URL of data/electionMinimalExhaustiveSample/precinctScannerCardTallies/votingPausedSinglePrecinct.json, suitable for embedding in HTML.
 *
 * SHA-256 hash of file data: 8697f48d895fa7e49199b9f571493033bbde08d5b45258026aa68f21c8448301
 */
export function asDataUrl(): string {
  return `data:${mimeType};base64,${resourceDataBase64}`;
}

/**
 * Raw data of data/electionMinimalExhaustiveSample/precinctScannerCardTallies/votingPausedSinglePrecinct.json.
 *
 * SHA-256 hash of file data: 8697f48d895fa7e49199b9f571493033bbde08d5b45258026aa68f21c8448301
 */
export function asBuffer(): Buffer {
  return Buffer.from(resourceDataBase64, 'base64');
}

/**
 * Text content of data/electionMinimalExhaustiveSample/precinctScannerCardTallies/votingPausedSinglePrecinct.json.
 *
 * SHA-256 hash of file data: 8697f48d895fa7e49199b9f571493033bbde08d5b45258026aa68f21c8448301
 */
export function asText(): string {
  return asBuffer().toString('utf-8');
}