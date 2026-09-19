import { z } from 'zod'
import type { StableCiConfig } from '../config.js'
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

async function post(
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
  return {
    name: config.target.name,

    async runScenario(
      scenario: ScenarioName,
    ): Promise<PaymentObservation> {
      const baseUrl = config.target.baseUrl
      const endpoints = config.target.endpoints
      const payment = config.payment

      await post(baseUrl, endpoints.reset)

      const webhook = async (
        eventId: string,
        status: 'pending' | 'completed' | 'failed',
      ) => {
        await post(baseUrl, endpoints.webhook, {
          eventId,
          paymentId: payment.id,
          status,
          amount: payment.amount,
          asset: payment.asset,
        })
      }

      switch (scenario) {
        case 'duplicate_webhook':
          await webhook('evt_complete_1', 'completed')
          await webhook('evt_complete_1', 'completed')
          break

        case 'out_of_order_webhook':
          await webhook('evt_complete_1', 'completed')
          await webhook('evt_pending_2', 'pending')
          break

        case 'missing_webhook':
          if (endpoints.reconcile) {
            await post(baseUrl, endpoints.reconcile, {
              paymentId: payment.id,
              chainStatus: 'confirmed',
              amount: payment.amount,
              asset: payment.asset,
            })
          }
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
        providerStatus: 'completed',
        chainStatus: 'confirmed',
        webhookDeliveries: state.webhookDeliveries,
        ledgerEntries: state.ledgerEntries,
        creditedAmount: state.creditedAmount,
        applicationStatus: state.applicationStatus,
        retryAttempts: state.retryAttempts,
        settlementWasUnknown: state.settlementWasUnknown,
        recovered: state.recovered,
      }
    },
  }
}