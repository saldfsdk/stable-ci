import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createBvnkProvider } from './providers/bvnk.js'

describe('BVNK provider profile', () => {
  it('renders a BVNK statusChanged webhook', () => {
    const provider = createBvnkProvider('test-secret')

    const rendered = provider.render({
      eventId: 'evt_1',
      paymentId: 'pay_1',
      status: 'completed',
      amount: 100,
      asset: 'USDC',
    })

    const body = JSON.parse(rendered.body)

    expect(body.source).toBe('payment')
    expect(body.event).toBe('statusChanged')
    expect(body.data.uuid).toBe('pay_1')
    expect(body.data.status).toBe('COMPLETE')
    expect(body.data.displayCurrency.amount).toBe(100)
  })

  it('signs the raw payload with HMAC-SHA256', () => {
    const secret = 'test-secret'
    const provider = createBvnkProvider(secret)

    const rendered = provider.render({
      eventId: 'evt_1',
      paymentId: 'pay_1',
      status: 'completed',
      amount: 100,
      asset: 'USDC',
    })

    const expected = createHmac('sha256', secret)
      .update(rendered.body, 'utf8')
      .digest('base64')

    expect(rendered.headers['x-signature']).toBe(expected)
  })
})