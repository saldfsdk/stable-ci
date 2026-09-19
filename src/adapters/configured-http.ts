import { z } from 'zod'
import type { StableCiConfig } from '../config.js'
import { createBvnkProvider } from '../providers/bvnk.js'
import { createGenericProvider } from '../providers/generic.js'
import type { WebhookProvider } from '../providers/types.js'
import type {
  PaymentAdapter,
  PaymentObservation,
  ScenarioName,
} from '../types.js'

const stateSchema = z.object({
  applicationStatus: z.enum([
    'none',
    'pending',
    'completed',
    'failed',
  ]),
  webhookDeliveries: z.number(),
  ledgerEntries: z.number(),
  creditedAmount: z.number(),
  retryAttempts: z.number().default(0),
  settlementWasUnknown: z.boolean().default(false),
  recovered: z.boolean().default(false),
})

function getProvider(
  config: StableCiConfig,
): WebhookProvider {
  if (config.provider === 'bvnk') {
    return createBvnkProvider(
      config.webhookSecret ?? 'stable-ci-local-secret'
    )
  }

  return createGenericProvider()
}

async function postJson(
  baseUrl: string,
  path: string,
  body: Record<string, unknown> = {},
) {
  const response = await fetch(baseUrl + path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(
      'HTTP ' + response.status + ' from ' + path
    )
  }
}

async function sendWebhook(
  config: StableCiConfig,
  provider: WebhookProvider,
  eventId: string,
  status: 'pending' | 'completed' | 'failed',
) {
  const rendered = provider.render({
    eventId,
    paymentId: config.payment.id,
    status,
    amount: config.payment.amount,
    asset: config.payment.asset,
  })

  const response = await fetch(
    config.target.baseUrl +
    config.target.endpoints.webhook,
    {
      method: 'POST',
      headers: rendered.headers,
      body: rendered.body,
    }
  )

  if (!response.ok) {
    throw new Error(
      'Webhook returned HTTP ' + response.status
    )
  }

  return response.status
}

async function sendInvalidSignatureWebhook(
  config: StableCiConfig,
  provider: WebhookProvider,
): Promise<boolean> {
  const rendered = provider.render({
    eventId: 'evt_invalid_signature',
    paymentId: config.payment.id,
    status: 'completed',
    amount: config.payment.amount,
    asset: config.payment.asset,
  })

  const response = await fetch(
    config.target.baseUrl +
    config.target.endpoints.webhook,
    {
      method: 'POST',
      headers: {
        ...rendered.headers,
        'x-signature': 'invalid-signature',
      },
      body: rendered.body,
    }
  )

  return response.ok
}
async function getState(
  config: StableCiConfig,
) {
  const response = await fetch(
    config.target.baseUrl +
    config.target.endpoints.state
  )

  if (!response.ok) {
    throw new Error(
      'Failed to read target application state.'
    )
  }

  return stateSchema.parse(await response.json())
}

export function createConfiguredHttpAdapter(
  config: StableCiConfig,
): PaymentAdapter {
  const provider = getProvider(config)

  return {
    name: config.target.name + ' [' + provider.name + ']',

    async runScenario(
      scenario: ScenarioName,
    ): Promise<PaymentObservation> {
      const baseUrl = config.target.baseUrl
      const endpoints = config.target.endpoints
      const payment = config.payment

      await postJson(baseUrl, endpoints.reset)

      let providerStatus: PaymentObservation['providerStatus'] = 'completed'
      let chainStatus: PaymentObservation['chainStatus'] = 'confirmed'
      let webhookAccepted: boolean | undefined

      switch (scenario) {
        case 'duplicate_webhook':
          await sendWebhook(
            config,
            provider,
            'evt_complete_1',
            'completed',
          )
          await sendWebhook(
            config,
            provider,
            'evt_complete_1',
            'completed',
          )
          break

        case 'out_of_order_webhook':
          await sendWebhook(
            config,
            provider,
            'evt_complete_1',
            'completed',
          )
          await sendWebhook(
            config,
            provider,
            'evt_pending_2',
            'pending',
          )
          break

        case 'missing_webhook':
          if (endpoints.reconcile) {
            await postJson(baseUrl, endpoints.reconcile, {
              paymentId: payment.id,
              chainStatus: 'confirmed',
              amount: payment.amount,
              asset: payment.asset,
            })
          }
          break

        case 'invalid_signature':
          if (provider.name !== 'bvnk') {
            throw new Error(
              'invalid_signature currently requires the BVNK provider.'
            )
          }

          webhookAccepted =
            await sendInvalidSignatureWebhook(
              config,
              provider,
            )

          providerStatus = 'failed'
          chainStatus = 'not_broadcast'
          break

        default:
          throw new Error(
            'Scenario is not supported by the configured HTTP adapter yet: ' +
            scenario
          )
      }

      const state = await getState(config)

      return {
        scenario,
        paymentId: payment.id,
        expectedAmount: payment.amount,
        providerStatus,
        chainStatus,
        webhookDeliveries: state.webhookDeliveries,
        ledgerEntries: state.ledgerEntries,
        creditedAmount: state.creditedAmount,
        applicationStatus: state.applicationStatus,
        retryAttempts: state.retryAttempts,
        settlementWasUnknown: state.settlementWasUnknown,
        recovered: state.recovered,
        webhookAccepted,
      }
    },
  }
}