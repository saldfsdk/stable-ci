import {
  startDemoPaymentApp,
  type DemoPaymentState,
  type HttpDemoProfile,
} from '../core/demo-payment-app.js'
import type {
  ChainStatus,
  PaymentAdapter,
  PaymentObservation,
  ProviderStatus,
  ScenarioName,
} from '../types.js'

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

  if (!response.ok && response.status !== 409) {
    throw new Error(
      'HTTP ' + response.status + ' from ' + path
    )
  }

  return response
}

async function getState(
  baseUrl: string,
): Promise<DemoPaymentState> {
  const response = await fetch(baseUrl + '/state')

  if (!response.ok) {
    throw new Error(
      'Failed to read demo application state.'
    )
  }

  return await response.json() as DemoPaymentState
}

export function createHttpDemoAdapter(
  profile: HttpDemoProfile,
): PaymentAdapter {
  return {
    name: 'http-demo:' + profile,

    async runScenario(
      scenario: ScenarioName,
    ): Promise<PaymentObservation> {
      const app = await startDemoPaymentApp(profile)

      const paymentId = 'pay_http_001'
      const amount = 100

      let providerStatus: ProviderStatus = 'completed'
      let chainStatus: ChainStatus = 'confirmed'

      const webhook = async (
        eventId: string,
        status: 'pending' | 'completed' | 'failed',
      ) => {
        await post(app.baseUrl, '/webhook', {
          eventId,
          paymentId,
          status,
          amount,
        })
      }

      try {
        await post(app.baseUrl, '/reset')

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
            await post(app.baseUrl, '/reconcile', {
              paymentId,
              chainStatus: 'confirmed',
              amount,
            })
            break

          case 'provider_timeout_after_broadcast':
            providerStatus = 'timeout'
            await post(app.baseUrl, '/mark-unknown')
            await post(app.baseUrl, '/retry', {
              paymentId,
              amount,
            })
            await post(app.baseUrl, '/reconcile', {
              paymentId,
              chainStatus: 'confirmed',
              amount,
            })
            break

          case 'late_chain_confirmation':
            providerStatus = 'timeout'
            await post(app.baseUrl, '/mark-unknown')
            await post(app.baseUrl, '/retry', {
              paymentId,
              amount,
            })
            await new Promise((resolve) =>
              setTimeout(resolve, 10)
            )
            await post(app.baseUrl, '/reconcile', {
              paymentId,
              chainStatus: 'confirmed',
              amount,
            })
            break

          case 'retry_after_unknown_settlement':
            providerStatus = 'timeout'
            await post(app.baseUrl, '/mark-unknown')
            await post(app.baseUrl, '/retry', {
              paymentId,
              amount,
            })
            await post(app.baseUrl, '/reconcile', {
              paymentId,
              chainStatus: 'confirmed',
              amount,
            })
            break
        }

        const state = await getState(app.baseUrl)

        return {
          scenario,
          paymentId,
          expectedAmount: amount,
          providerStatus,
          chainStatus,
          webhookDeliveries: state.webhookDeliveries,
          ledgerEntries: state.ledgerEntries,
          creditedAmount: state.creditedAmount,
          applicationStatus: state.applicationStatus,
          retryAttempts: state.retryAttempts,
          settlementWasUnknown: state.settlementWasUnknown,
          recovered: state.recovered,
        }
      } finally {
        await app.close()
      }
    },
  }
}