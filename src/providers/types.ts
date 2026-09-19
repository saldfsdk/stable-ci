export type CanonicalWebhookEventType =
  | 'statusChanged'
  | 'transactionConfirmed'
  | 'transactionLate'

export type CanonicalWebhookEvent = {
  eventId: string
  paymentId: string
  eventType?: CanonicalWebhookEventType
  status:
    | 'pending'
    | 'completed'
    | 'failed'
    | 'underpaid'
    | 'expired'
  amount: number
  actualAmount?: number
  asset: string
}

export type RenderedWebhook = {
  body: string
  headers: Record<string, string>
}

export type WebhookProvider = {
  name: string
  signatureHeader?: string
  render: (event: CanonicalWebhookEvent) => RenderedWebhook
}