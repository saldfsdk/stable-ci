import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { createHmac } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import type { ApplicationStatus } from '../types.js'

export type HttpDemoProfile = 'safe' | 'unsafe'

export type DemoPaymentState = {
  paymentId: string
  applicationStatus: ApplicationStatus
  webhookDeliveries: number
  ledgerEntries: number
  creditedAmount: number
  retryAttempts: number
  settlementWasUnknown: boolean
  recovered: boolean
  seenEventIds: string[]
}

function initialState(): DemoPaymentState {
  return {
    paymentId: '',
    applicationStatus: 'none',
    webhookDeliveries: 0,
    ledgerEntries: 0,
    creditedAmount: 0,
    retryAttempts: 0,
    settlementWasUnknown: false,
    recovered: false,
    seenEventIds: [],
  }
}

async function readJson(
  req: IncomingMessage,
): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []

  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk))
  }

  const raw = Buffer.concat(chunks).toString('utf8')

  if (!raw) {
    return {}
  }

  return JSON.parse(raw) as Record<string, unknown>
}

async function readRawJson(
  req: IncomingMessage,
): Promise<{
  raw: string
  body: Record<string, unknown>
}> {
  const chunks: Buffer[] = []

  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk))
  }

  const raw = Buffer.concat(chunks).toString('utf8')

  return {
    raw,
    body: raw
      ? JSON.parse(raw) as Record<string, unknown>
      : {},
  }
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

export async function startDemoPaymentApp(
  profile: HttpDemoProfile,
  port = 0,
) {
  let state = initialState()

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(
        req.url ?? '/',
        'http://127.0.0.1',
      )

      if (req.method === 'POST' && url.pathname === '/reset') {
        state = initialState()
        sendJson(res, 200, state)
        return
      }

      if (req.method === 'POST' && url.pathname === '/mark-unknown') {
        state.settlementWasUnknown = true
        sendJson(res, 200, state)
        return
      }

      if (req.method === 'POST' && url.pathname === '/webhook') {
        const { body, raw } = await readRawJson(req)

        const data =
          typeof body.data === 'object' &&
          body.data !== null
            ? body.data as Record<string, unknown>
            : undefined

        const displayCurrency =
          data &&
          typeof data.displayCurrency === 'object' &&
          data.displayCurrency !== null
            ? data.displayCurrency as Record<string, unknown>
            : undefined

        const isBvnk =
          body.source === 'payment' &&
          body.event === 'statusChanged' &&
          data !== undefined

        if (profile === 'safe' && isBvnk) {
          const suppliedSignature = String(
            req.headers['x-signature'] ?? ''
          )

          const expectedSignature = createHmac(
            'sha256',
            'stable-ci-local-secret',
          )
            .update(raw, 'utf8')
            .digest('base64')

          if (suppliedSignature !== expectedSignature) {
            sendJson(res, 401, {
              error: 'Invalid BVNK webhook signature',
            })
            return
          }
        }

        const rawStatus = isBvnk
          ? String(data.status ?? '')
          : String(body.status ?? 'pending')

        const status: ApplicationStatus =
          rawStatus === 'COMPLETE'
            ? 'completed'
            : rawStatus === 'PROCESSING'
              ? 'pending'
              : rawStatus === 'EXPIRED'
                ? 'failed'
                : rawStatus === 'UNDERPAID'
                  ? 'manual_review'
                  : rawStatus as ApplicationStatus

        const paymentId = isBvnk
          ? String(data.uuid ?? '')
          : String(body.paymentId ?? '')

        const eventId = isBvnk
          ? String(data.reference ?? '') +
            ':' +
            rawStatus
          : String(body.eventId ?? '')

        const amount = isBvnk
          ? Number(displayCurrency?.amount ?? 0)
          : Number(body.amount ?? 0)

        state.paymentId = paymentId
        state.webhookDeliveries += 1

        const duplicate =
          state.seenEventIds.includes(eventId)

        if (profile === 'safe' && duplicate) {
          sendJson(res, 200, {
            duplicate: true,
            state,
          })
          return
        }

        state.seenEventIds.push(eventId)

        if (profile === 'safe') {
          if (
            status === 'pending' &&
            state.applicationStatus === 'completed'
          ) {
            sendJson(res, 200, state)
            return
          }

          state.applicationStatus = status

          if (
            status === 'completed' &&
            state.ledgerEntries === 0
          ) {
            state.ledgerEntries = 1
            state.creditedAmount = amount
          }
        } else {
          if (rawStatus === 'UNDERPAID') {
            state.applicationStatus = 'completed'
            state.ledgerEntries += 1
            state.creditedAmount += amount
          } else {
            state.applicationStatus = status

            if (status === 'completed') {
              state.ledgerEntries += 1
              state.creditedAmount += amount
            }
          }
        }

        sendJson(res, 200, state)
        return
      }

      if (req.method === 'POST' && url.pathname === '/retry') {
        const { body, raw } = await readRawJson(req)
        const amount = Number(body.amount ?? 0)

        if (
          profile === 'safe' &&
          state.settlementWasUnknown
        ) {
          sendJson(res, 409, {
            error: 'Settlement outcome is unknown. Reconcile before retrying.',
          })
          return
        }

        state.retryAttempts += 1

        if (profile === 'unsafe') {
          state.applicationStatus = 'completed'
          state.ledgerEntries += 1
          state.creditedAmount += amount
        }

        sendJson(res, 200, state)
        return
      }

      if (req.method === 'POST' && url.pathname === '/reconcile') {
        const { body, raw } = await readRawJson(req)
        const chainStatus = String(body.chainStatus ?? '')
        const amount = Number(body.amount ?? 0)

        if (
          profile === 'safe' &&
          chainStatus === 'confirmed'
        ) {
          if (state.ledgerEntries === 0) {
            state.ledgerEntries = 1
            state.creditedAmount = amount
          }

          state.applicationStatus = 'completed'
          state.recovered = true
        }

        sendJson(res, 200, state)
        return
      }

      if (req.method === 'GET' && url.pathname === '/state') {
        sendJson(res, 200, state)
        return
      }

      sendJson(res, 404, { error: 'Not found' })
    } catch (error) {
      sendJson(res, 500, {
        error: error instanceof Error
          ? error.message
          : 'Unknown error',
      })
    }
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolve)
  })

  const address = server.address() as AddressInfo

  return {
    baseUrl: 'http://127.0.0.1:' + address.port,
    async close() {
      await new Promise<void>((resolve) => {
        server.close(() => resolve())
      })
    },
  }
}