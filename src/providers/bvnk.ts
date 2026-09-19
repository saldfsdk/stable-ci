import { createHmac } from 'node:crypto'
import type {
  CanonicalWebhookEvent,
  WebhookProvider,
} from './types.js'

function toBvnkStatus(
  status: CanonicalWebhookEvent['status'],
) {
  switch (status) {
    case 'pending':
      return 'PROCESSING'
    case 'completed':
      return 'COMPLETE'
    case 'failed':
      return 'EXPIRED'
    case 'underpaid':
      return 'UNDERPAID'
  }
}

export function createBvnkProvider(
  webhookSecret = 'stable-ci-local-secret',
): WebhookProvider {
  return {
    name: 'bvnk',

    render(event) {
      const eventType =
        event.eventType ?? 'statusChanged'

      const actualAmount =
        event.actualAmount ?? event.amount

      const payload = {
        source: 'payment',
        event: eventType,
        data: {
          uuid: event.paymentId,
          reference: event.eventId,
          type: 'IN',
          subType: 'merchantPayIn',
          status: toBvnkStatus(event.status),
          displayCurrency: {
            currency: event.asset,
            amount: event.amount,
            actual: actualAmount,
          },
          paidCurrency: {
            currency: event.asset,
            amount: event.amount,
            actual: actualAmount,
          },
        },
      }

      const body = JSON.stringify(payload)

      const signature = createHmac(
        'sha256',
        webhookSecret,
      )
        .update(body, 'utf8')
        .digest('base64')

      return {
        body,
        headers: {
          'content-type': 'application/json',
          'x-signature': signature,
        },
      }
    },
  }
}