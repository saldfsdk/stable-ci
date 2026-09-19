import { describe, expect, it } from 'vitest'
import { renderJUnit } from './reporters/junit.js'
import type { ScenarioResult } from './types.js'

describe('JUnit reporter', () => {
  it('renders passing and failing scenarios', () => {
    const results: ScenarioResult[] = [
      {
        scenario: {
          name: 'duplicate_webhook',
          description: 'duplicate',
          risk: 'duplicate credit',
          expected: {
            ledgerEntries: 1,
          },
        },
        observation: {
          scenario: 'duplicate_webhook',
          paymentId: 'pay_1',
          expectedAmount: 100,
          providerStatus: 'completed',
          chainStatus: 'confirmed',
          webhookDeliveries: 2,
          ledgerEntries: 1,
          creditedAmount: 100,
          applicationStatus: 'completed',
          retryAttempts: 0,
          settlementWasUnknown: false,
          recovered: false,
        },
        invariants: [
          {
            name: 'payment_posts_exactly_once',
            passed: true,
          },
        ],
        passed: true,
      },
      {
        scenario: {
          name: 'overpayment',
          description: 'overpayment',
          risk: 'incorrect credit',
          expected: {
            credit: 'exact_expected',
          },
        },
        observation: {
          scenario: 'overpayment',
          paymentId: 'pay_2',
          expectedAmount: 100,
          receivedAmount: 140,
          providerStatus: 'completed',
          chainStatus: 'confirmed',
          webhookDeliveries: 1,
          ledgerEntries: 1,
          creditedAmount: 140,
          applicationStatus: 'completed',
          retryAttempts: 0,
          settlementWasUnknown: false,
          recovered: false,
        },
        invariants: [
          {
            name: 'ledger_delta_equals_settlement_amount',
            passed: false,
            message: 'Expected USD 100.00, ledger credited USD 140.00.',
          },
        ],
        passed: false,
      },
    ]

    const xml = renderJUnit(
      'local-bvnk-payment-app',
      results,
    )

    expect(xml).toContain('tests="2"')
    expect(xml).toContain('failures="1"')
    expect(xml).toContain(
      'name="duplicate_webhook"'
    )
    expect(xml).toContain(
      'name="overpayment"'
    )
    expect(xml).toContain('<failure')
    expect(xml).toContain(
      'Expected USD 100.00, ledger credited USD 140.00.'
    )
  })
})