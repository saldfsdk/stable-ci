import type { InvariantResult, PaymentObservation } from '../types.js'

type Invariant = {
  name: string
  check: (observation: PaymentObservation) => InvariantResult
}

const moneyEqual = (a: number, b: number) =>
  Math.abs(a - b) < 0.005

export const invariants: Invariant[] = [
  {
    name: 'payment_posts_exactly_once',
    check: (o) => {
      if (o.chainStatus !== 'confirmed') {
        return { name: 'payment_posts_exactly_once', passed: true }
      }

      const passed = o.ledgerEntries === 1

      return {
        name: 'payment_posts_exactly_once',
        passed,
        message: passed
          ? undefined
          : 'Expected 1 ledger entry, observed ' + o.ledgerEntries + '.'
      }
    },
  },
  {
    name: 'failed_payment_never_credits_balance',
    check: (o) => {
      const definitelyFailed =
        o.chainStatus === 'reverted' ||
        (o.providerStatus === 'failed' && o.chainStatus !== 'confirmed')

      const passed = !definitelyFailed || moneyEqual(o.creditedAmount, 0)

      return {
        name: 'failed_payment_never_credits_balance',
        passed,
        message: passed
          ? undefined
          : 'Failed payment credited USD ' + o.creditedAmount.toFixed(2) + '.'
      }
    },
  },
  {
    name: 'unknown_settlement_must_not_be_retried',
    check: (o) => {
      const passed =
        !o.settlementWasUnknown ||
        o.retryAttempts === 0

      return {
        name: 'unknown_settlement_must_not_be_retried',
        passed,
        message: passed
          ? undefined
          : 'Observed ' + o.retryAttempts + ' retry attempt(s) after settlement became unknown.'
      }
    },
  },
  {
    name: 'confirmed_payment_requires_ledger_entry',
    check: (o) => {
      const passed =
        o.chainStatus !== 'confirmed' ||
        o.ledgerEntries === 1

      return {
        name: 'confirmed_payment_requires_ledger_entry',
        passed,
        message: passed
          ? undefined
          : 'Confirmed onchain payment did not converge to exactly one ledger entry.'
      }
    },
  },
  {
    name: 'ledger_delta_equals_settlement_amount',
    check: (o) => {
      const passed =
        o.chainStatus !== 'confirmed' ||
        moneyEqual(o.creditedAmount, o.expectedAmount)

      return {
        name: 'ledger_delta_equals_settlement_amount',
        passed,
        message: passed
          ? undefined
          : 'Expected USD ' + o.expectedAmount.toFixed(2) + ', ledger credited USD ' + o.creditedAmount.toFixed(2) + '.'
      }
    },
  },
  {
    name: 'confirmed_payment_must_end_completed',
    check: (o) => {
      const passed =
        o.chainStatus !== 'confirmed' ||
        o.applicationStatus === 'completed'

      return {
        name: 'confirmed_payment_must_end_completed',
        passed,
        message: passed
          ? undefined
          : 'Chain confirmed but application ended in ' + o.applicationStatus + ' state.'
      }
    },
  },
  {
    name: 'duplicate_webhook_must_not_duplicate_ledger',
    check: (o) => {
      const passed =
        o.webhookDeliveries <= 1 ||
        o.ledgerEntries <= 1

      return {
        name: 'duplicate_webhook_must_not_duplicate_ledger',
        passed,
        message: passed
          ? undefined
          : o.webhookDeliveries + ' webhook deliveries created ' + o.ledgerEntries + ' ledger entries.'
      }
    },
  },
]

export function evaluateInvariants(
  observation: PaymentObservation,
): InvariantResult[] {
  return invariants.map((invariant) =>
    invariant.check(observation)
  )
}