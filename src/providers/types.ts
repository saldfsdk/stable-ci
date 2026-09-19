export type CanonicalWebhookEvent = {
  eventId: string
  paymentId: string
  status: 'pending' | 'completed' | 'failed' | 'underpaid'
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
  render: (event: CanonicalWebhookEvent) => RenderedWebhook
}