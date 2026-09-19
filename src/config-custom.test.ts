import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest'
import { loadConfig } from './config.js'

const tempDirs: string[] = []

function createDir() {
  const dir = mkdtempSync(
    join(tmpdir(), 'stable-ci-config-'),
  )

  tempDirs.push(dir)

  mkdirSync(join(dir, 'fixtures'))

  return dir
}

function writeFixture(
  dir: string,
  name: string,
) {
  writeFileSync(
    join(dir, 'fixtures', name + '.json'),
    JSON.stringify({
      eventId: '{{eventId}}',
      paymentId: '{{paymentId}}',
      status: '{{status}}',
      amount: '{{amount}}',
    }),
  )
}

function writeConfig(
  dir: string,
  lines: string[],
) {
  const path = join(dir, 'stable-ci.yml')

  writeFileSync(
    path,
    lines.join('\n'),
  )

  return path
}

function baseConfig(
  scenarios: string[],
) {
  return [
    'provider: custom',
    '',
    'customProvider:',
    '  name: test-provider',
    '  fixtures:',
    '    completed: fixtures/completed.json',
    '',
    'target:',
    '  name: test-app',
    '  baseUrl: http://127.0.0.1:4310',
    '  endpoints:',
    '    reset: /reset',
    '    webhook: /webhook',
    '    state: /state',
    '',
    'payment:',
    '  id: pay_1',
    '  amount: 100',
    '  asset: USDC',
    '',
    'scenarios:',
    ...scenarios.map(
      (scenario) => '  - ' + scenario,
    ),
  ]
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, {
      recursive: true,
      force: true,
    })
  }
})

describe('custom provider config validation', () => {
  it('rejects a missing fixture required by a scenario', () => {
    const dir = createDir()

    writeFixture(dir, 'completed')

    const path = writeConfig(
      dir,
      baseConfig([
        'out_of_order_webhook',
      ]),
    )

    expect(() => loadConfig(path)).toThrow(
      'missing the pending webhook fixture',
    )
  })

  it('requires signature config for invalid_signature', () => {
    const dir = createDir()

    writeFixture(dir, 'completed')

    const path = writeConfig(
      dir,
      baseConfig([
        'invalid_signature',
      ]),
    )

    expect(() => loadConfig(path)).toThrow(
      'invalid_signature requires customProvider.signature',
    )
  })

  it('requires webhookSecret when signing custom webhooks', () => {
    const dir = createDir()

    writeFixture(dir, 'completed')

    const lines = baseConfig([
      'duplicate_webhook',
    ])

    const customIndex =
      lines.indexOf('  fixtures:')

    lines.splice(
      customIndex,
      0,
      '  signature:',
      '    header: x-provider-signature',
      '    algorithm: sha256',
      '    encoding: base64',
    )

    const path =
      writeConfig(dir, lines)

    expect(() => loadConfig(path)).toThrow(
      'customProvider.signature requires webhookSecret',
    )
  })
})