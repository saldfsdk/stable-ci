import { describe, expect, it } from 'vitest'
import { createBvnkProvider } from './providers/bvnk.js'

describe('BVNK exception event model', () => {
  it('renders underpayment as transactionConfirmed with expected and actual amounts', () => {
    const provider = createBvnkProvider('test-secret')

    const rendered = provider.render({
      eventId: 'evt_underpayment_1',
      paymentId: 'pay_1',
      eventType: 'transactionConfirmed',
      status: 'underpaid',
      amount: 100,
      actualAmount: 60,
      asset: 'USDC',
    })

    const body = JSON.parse(rendered.body)

    expect(body.source).toBe('payment')
    expect(body.event).toBe('transactionConfirmed')
    expect(body.data.status).toBe('UNDERPAID')
    expect(body.data.paidCurrency.amount).toBe(100)
    expect(body.data.paidCurrency.actual).toBe(60)
  })
})