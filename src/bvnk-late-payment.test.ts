import { describe, expect, it } from 'vitest'
import { createBvnkProvider } from './providers/bvnk.js'

describe('BVNK late payment event model', () => {
  it('renders a transactionLate event while payment remains expired', () => {
    const provider = createBvnkProvider('test-secret')

    const rendered = provider.render({
      eventId: 'evt_late_payment_1',
      paymentId: 'pay_1',
      eventType: 'transactionLate',
      status: 'expired',
      amount: 100,
      actualAmount: 100,
      asset: 'USDC',
    })

    const body = JSON.parse(rendered.body)

    expect(body.source).toBe('payment')
    expect(body.event).toBe('transactionLate')
    expect(body.data.status).toBe('EXPIRED')
    expect(body.data.walletCurrency.actual).toBe(100)
  })
})