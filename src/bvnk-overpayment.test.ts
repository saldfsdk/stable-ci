import { describe, expect, it } from 'vitest'
import { createBvnkProvider } from './providers/bvnk.js'

describe('BVNK overpayment event model', () => {
  it('renders overpayment as COMPLETE with actual above expected', () => {
    const provider = createBvnkProvider('test-secret')

    const rendered = provider.render({
      eventId: 'evt_overpayment_1',
      paymentId: 'pay_1',
      eventType: 'transactionConfirmed',
      status: 'completed',
      amount: 100,
      actualAmount: 140,
      asset: 'USDC',
    })

    const body = JSON.parse(rendered.body)

    expect(body.source).toBe('payment')
    expect(body.event).toBe('transactionConfirmed')
    expect(body.data.status).toBe('COMPLETE')
    expect(body.data.paidCurrency.amount).toBe(100)
    expect(body.data.paidCurrency.actual).toBe(140)
  })
})