import { createHmac } from 'node:crypto'
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:http'
import type {
  IncomingMessage,
  ServerResponse,
} from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest'
import {
  createConfiguredHttpAdapter,
} from './adapters/configured-http.js'
import { loadConfig } from './config.js'
import { runSuite } from './core/runner.js'
import { scenarios } from './scenarios/builtins.js'

const tempDirs: string[] = []
const servers: Array<{
  close: () => Promise<void>
}> = []

function createTempDir() {
  const path = mkdtempSync(
    join(tmpdir(), 'stable-ci-custom-http-'),
  )

  tempDirs.push(path)

  return path
}

function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
) {
  res.writeHead(status, {
    'content-type': 'application/json',
  })

  res.end(JSON.stringify(body))
}

async function readRaw(
  req: IncomingMessage,
) {
  const chunks: Buffer[] = []

  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk))
  }

  return Buffer.concat(chunks).toString('utf8')
}

async function startPaymentApp(
  secret: string,
) {
  let state = {
    applicationStatus:
      'none' as
        | 'none'
        | 'pending'
        | 'completed'
        | 'failed'
        | 'manual_review',
    webhookDeliveries: 0,
    ledgerEntries: 0,
    creditedAmount: 0,
    retryAttempts: 0,
    settlementWasUnknown: false,
    recovered: false,
    seenEvents: [] as string[],
  }

  const reset = () => {
    state = {
      applicationStatus: 'none',
      webhookDeliveries: 0,
      ledgerEntries: 0,
      creditedAmount: 0,
      retryAttempts: 0,
      settlementWasUnknown: false,
      recovered: false,
      seenEvents: [],
    }
  }

  const server = createServer(
    async (req, res) => {
      const url = new URL(
        req.url ?? '/',
        'http://127.0.0.1',
      )

      if (
        req.method === 'POST' &&
        url.pathname === '/reset'
      ) {
        reset()
        sendJson(res, 200, state)
        return
      }

      if (
        req.method === 'GET' &&
        url.pathname === '/state'
      ) {
        sendJson(res, 200, state)
        return
      }

      if (
        req.method === 'POST' &&
        url.pathname === '/reconcile'
      ) {
        const raw = await readRaw(req)

        const body = JSON.parse(raw) as {
          amount: number
        }

        state.applicationStatus =
          'completed'
        state.ledgerEntries = 1
        state.creditedAmount =
          body.amount
        state.recovered = true

        sendJson(res, 200, state)
        return
      }

      if (
        req.method === 'POST' &&
        url.pathname === '/webhook'
      ) {
        const raw = await readRaw(req)

        const suppliedSignature =
          String(
            req.headers[
              'x-switch-signature'
            ] ?? '',
          )

        const expectedSignature =
          createHmac('sha256', secret)
            .update(raw, 'utf8')
            .digest('base64')

        if (
          suppliedSignature !==
          expectedSignature
        ) {
          sendJson(res, 401, {
            error: 'invalid signature',
          })
          return
        }

        const body = JSON.parse(raw) as {
          id: string
          paymentId: string
          status:
            | 'pending'
            | 'completed'
            | 'underpaid'
            | 'expired'
          amount: number
          actualAmount: number
          asset: string
        }

        state.webhookDeliveries += 1

        if (
          state.seenEvents.includes(body.id)
        ) {
          sendJson(res, 200, state)
          return
        }

        state.seenEvents.push(body.id)

        if (
          body.status === 'pending'
        ) {
          if (
            state.applicationStatus !==
            'completed'
          ) {
            state.applicationStatus =
              'pending'
          }

          sendJson(res, 200, state)
          return
        }

        if (
          body.status === 'underpaid'
        ) {
          state.applicationStatus =
            'manual_review'

          sendJson(res, 200, state)
          return
        }

        if (
          body.status === 'expired'
        ) {
          state.applicationStatus =
            'manual_review'

          sendJson(res, 200, state)
          return
        }

        if (
          body.status === 'completed'
        ) {
          state.applicationStatus =
            'completed'

          if (
            state.ledgerEntries === 0
          ) {
            state.ledgerEntries = 1

            // This test app intentionally credits
            // only the requested amount.
            state.creditedAmount =
              body.amount
          }

          sendJson(res, 200, state)
          return
        }

        sendJson(res, 400, {
          error: 'unsupported status',
        })
        return
      }

      sendJson(res, 404, {
        error: 'not found',
      })
    },
  )

  await new Promise<void>(
    (resolve, reject) => {
      server.once('error', reject)

      server.listen(
        0,
        '127.0.0.1',
        () => resolve(),
      )
    },
  )

  const address =
    server.address() as AddressInfo

  const handle = {
    baseUrl:
      'http://127.0.0.1:' +
      address.port,

    async close() {
      await new Promise<void>(
        (resolve) => {
          server.close(
            () => resolve(),
          )
        },
      )
    },
  }

  servers.push(handle)

  return handle
}

afterEach(async () => {
  while (servers.length > 0) {
    const server = servers.pop()

    if (server) {
      await server.close()
    }
  }

  while (tempDirs.length > 0) {
    const path = tempDirs.pop()

    if (path) {
      rmSync(path, {
        recursive: true,
        force: true,
      })
    }
  }
})

describe(
  'custom provider configured HTTP integration',
  () => {
    it(
      'runs custom webhook fixtures through a real HTTP target',
      async () => {
        const secret =
          'custom-test-secret'

        const app =
          await startPaymentApp(secret)

        const dir = createTempDir()
        const fixturesDir =
          join(dir, 'fixtures')

        mkdirSync(fixturesDir)

        const fixture = {
          id: '{{eventId}}',
          paymentId: '{{paymentId}}',
          status: '{{status}}',
          amount: '{{amount}}',
          actualAmount:
            '{{actualAmount}}',
          asset: '{{asset}}',
        }

        for (
          const status of [
            'pending',
            'completed',
            'underpaid',
            'expired',
          ]
        ) {
          writeFileSync(
            join(
              fixturesDir,
              status + '.json',
            ),
            JSON.stringify(
              fixture,
              null,
              2,
            ),
          )
        }

        const configPath =
          join(dir, 'stable-ci.yml')

        writeFileSync(
          configPath,
          [
            'provider: custom',
            'webhookSecret: custom-test-secret',
            '',
            'customProvider:',
            '  name: onswitch-like',
            '  fixtures:',
            '    pending: fixtures/pending.json',
            '    completed: fixtures/completed.json',
            '    underpaid: fixtures/underpaid.json',
            '    expired: fixtures/expired.json',
            '  signature:',
            '    header: x-switch-signature',
            '    algorithm: sha256',
            '    encoding: base64',
            '',
            'target:',
            '  name: external-payment-app',
            `  baseUrl: ${app.baseUrl}`,
            '  endpoints:',
            '    reset: /reset',
            '    webhook: /webhook',
            '    state: /state',
            '    reconcile: /reconcile',
            '',
            'payment:',
            '  id: pay_custom_001',
            '  amount: 100',
            '  asset: USDC',
            '',
            'scenarios:',
            '  - duplicate_webhook',
            '  - out_of_order_webhook',
            '  - missing_webhook',
            '  - invalid_signature',
            '  - underpayment',
            '  - overpayment',
            '  - late_payment',
            '',
          ].join('\n'),
        )

        const config =
          loadConfig(configPath)

        expect(
          config.customProvider
            ?.fixtures.completed,
        ).toBe(
          join(
            fixturesDir,
            'completed.json',
          ),
        )

        const adapter =
          createConfiguredHttpAdapter(
            config,
          )

        const selected =
          scenarios.filter((scenario) =>
            config.scenarios.includes(
              scenario.name,
            ),
          )

        const results =
          await runSuite(
            adapter,
            selected,
          )

        expect(results).toHaveLength(7)

        expect(
          results.every(
            (result) =>
              result.passed,
          ),
        ).toBe(true)

        const invalidSignature =
          results.find(
            (result) =>
              result.scenario.name ===
              'invalid_signature',
          )

        expect(
          invalidSignature
            ?.observation
            .webhookAccepted,
        ).toBe(false)

        const overpayment =
          results.find(
            (result) =>
              result.scenario.name ===
              'overpayment',
          )

        expect(
          overpayment
            ?.observation
            .receivedAmount,
        ).toBe(140)

        expect(
          overpayment
            ?.observation
            .creditedAmount,
        ).toBe(100)
      },
    )
  },
)