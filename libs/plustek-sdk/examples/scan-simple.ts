/**
 * This example provides a basic CLI to wait for and scan a single sheet.
 * 
 * Run it:
 * 
 *   pnpx ts-node -T examples/scan-simple.ts
 * 
 * With debugging:
 * 
 *   DEBUG=* pnpx ts-node -T examples/scan-simple.ts
 */

import makeDebug from 'debug'
import { createClient, PaperStatus, ScannerClient } from '../src'

const debug = makeDebug('plustek-sdk:example')

main().catch((error) => {
  console.error('CRASH:', error.stack)
  return 1
}).then((code) => {
  process.exitCode = code
})

async function main(): Promise<number> {
  debug('opening')
  const openResult = await createClient()

  debug('open result: %s', openResult.isOk() ? 'ok' : 'not ok')
  if (openResult.isErr()) {
    console.error('failed to open scanner:', openResult.unwrapErr())
    return
  }

  const scanner = openResult.unwrap()
  await waitUntilReadyToScan(scanner)
  const scanResult = await scanner.scan()

  if (scanResult.isOk()) {
    for (const file of scanResult.ok().files) {
      process.stdout.write(`${file}\n`)
    }
  } else {
    process.stderr.write(`failed to scan: ${scanResult.unwrapErr()}\n`)
  }

  await scanner.close()
  return scanResult.isOk() ? 0 : 1
}

async function waitUntilReadyToScan(scanner: ScannerClient): Promise<void> {
  let hasPrintedWaitingMessage = false
  while (!(await isReadyToScan(scanner))) {
    debug('not ready yet, sleeping a bit')
    if (!hasPrintedWaitingMessage) {
      hasPrintedWaitingMessage = true
      process.stderr.write('waiting for paper…\n')
    }
    await sleep(100)
  }
}

async function isReadyToScan(scanner: ScannerClient): Promise<boolean> {
  debug('getting paper status')
  return (await scanner.getPaperStatus()).unwrap() === PaperStatus.VtmReadyToScan
}

async function sleep(duration: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, duration)
  })
}