import { createHmac } from 'node:crypto'
import {
  mkdtempSync,
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
import {
  createCustomProvider,
} from './providers/custom.js'

const tempDirs: string[] = []

function createTempDir() {
  const path = mkdtempSync(
    join(tmpdir(), 'stable-ci-custom-'),
  )

  tempDirs.push(path)

  return path
}

afterEach(() => {
  for (const path of tempDirs.splice(0)) {
    rmSync(path, {
      recursive: true,
      force: true,
    })
  }
})

describe('custom webhook provider', () => {
  it('renders fixture placeholders with native JSON types', () => {
    const dir = createTempDir()
    const fixturePath =
      join(dir, 'completed.json')

    writeFileSync(
      fixturePath,
      JSON.stringify({
        event: '{{eventType}}',
        data: {
          id: '{{eventId}}',
          paymentId: '{{paymentId}}',
          amount: '{{amount}}',
          actualAmount: '{{actualAmount}}',
          asset: '{{asset}}',
          message:
            'payment {{paymentId}} completed',
        },
      }),
    )

    const provider = createCustomProvider({
      name: 'example-provider',
      fixtures: {
        completed: fixturePath,
      },
    })

    const rendered = provider.render({
      eventId: 'evt_123',
      paymentId: 'pay_456',
      eventType: 'transactionConfirmed',
      status: 'completed',
      amount: 100,
      actualAmount: 140,
      asset: 'USDC',
    })

    const body =
      JSON.parse(rendered.body)

    expect(body.event).toBe(
      'transactionConfirmed',
    )

    expect(body.data.id).toBe('evt_123')
    expect(body.data.paymentId).toBe(
      'pay_456',
    )

    expect(body.data.amount).toBe(100)
    expect(body.data.actualAmount).toBe(
      140,
    )

    expect(body.data.asset).toBe('USDC')

    expect(body.data.message).toBe(
      'payment pay_456 completed',
    )
  })

  it('signs the rendered raw body using a custom header', () => {
    const dir = createTempDir()
    const fixturePath =
      join(dir, 'completed.json')

    writeFileSync(
      fixturePath,
      JSON.stringify({
        eventId: '{{eventId}}',
        paymentId: '{{paymentId}}',
        amount: '{{amount}}',
      }),
    )

    const provider = createCustomProvider({
      name: 'onswitch-like',
      fixtures: {
        completed: fixturePath,
      },
      headers: {
        'x-test-payment':
          '{{paymentId}}',
      },
      signature: {
        header: 'x-switch-signature',
        algorithm: 'sha256',
        encoding: 'base64',
      },
      webhookSecret: 'test-secret',
    })

    const rendered = provider.render({
      eventId: 'evt_1',
      paymentId: 'pay_1',
      status: 'completed',
      amount: 100,
      asset: 'USDC',
    })

    const expected = createHmac(
      'sha256',
      'test-secret',
    )
      .update(rendered.body, 'utf8')
      .digest('base64')

    expect(
      rendered.headers[
        'x-switch-signature'
      ],
    ).toBe(expected)

    expect(
      rendered.headers[
        'x-test-payment'
      ],
    ).toBe('pay_1')

    expect(provider.signatureHeader).toBe(
      'x-switch-signature',
    )
  })
})