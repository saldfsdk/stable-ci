import type {
  ExpectedOutcome,
  InvariantResult,
  PaymentObservation,
} from '../types.js'

const moneyEqual = (a: number, b: number) =>
  Math.abs(a - b) < 0.005

function expectedStatuses(
  expected: ExpectedOutcome,
) {
  if (expected.applicationStatus === undefined) {
    return undefined
  }

  return Array.isArray(expected.applicationStatus)
    ? expected.applicationStatus
    : [expected.applicationStatus]
}

export function evaluateInvariants(
  o: PaymentObservation,
  expected: ExpectedOutcome,
): InvariantResult[] {
  const results: InvariantResult[] = []

  if (expected.ledgerEntries !== undefined) {
    const passed =
      o.ledgerEntries === expected.ledgerEntries

    results.push({
      name: expected.ledgerEntries === 1
        ? 'payment_posts_exactly_once'
        : 'expected_ledger_entries',
      passed,
      message: passed
        ? undefined
        : 'Expected ' +
          expected.ledgerEntries +
          ' ledger entry/entries, observed ' +
          o.ledgerEntries +
          '.'
    })
  }

  if (expected.credit === 'exact_expected') {
    const passed = moneyEqual(
      o.creditedAmount,
      o.expectedAmount,
    )

    results.push({
      name: 'ledger_delta_equals_settlement_amount',
      passed,
      message: passed
        ? undefined
        : 'Expected USD ' +
          o.expectedAmount.toFixed(2) +
          ', ledger credited USD ' +
          o.creditedAmount.toFixed(2) +
          '.'
    })
  }

  if (expected.credit === 'none') {
    const passed = moneyEqual(o.creditedAmount, 0)

    results.push({
      name: 'failed_payment_never_credits_balance',
      passed,
      message: passed
        ? undefined
        : 'Expected no credit, but USD ' +
          o.creditedAmount.toFixed(2) +
          ' was credited.'
    })
  }

  if (expected.credit === 'received_amount') {
    const hasReceivedAmount =
      o.receivedAmount !== undefined

    const passed =
      hasReceivedAmount &&
      moneyEqual(
        o.creditedAmount,
        o.receivedAmount as number,
      )

    results.push({
      name: 'ledger_delta_equals_received_amount',
      passed,
      message: passed
        ? undefined
        : hasReceivedAmount
          ? 'Expected received USD ' +
            (o.receivedAmount as number).toFixed(2) +
            ', ledger credited USD ' +
            o.creditedAmount.toFixed(2) +
            '.'
          : 'Scenario did not report receivedAmount.'
    })
  }

  const allowedStatuses = expectedStatuses(expected)

  if (allowedStatuses !== undefined) {
    const passed =
      allowedStatuses.includes(o.applicationStatus)

    const completedOnly =
      allowedStatuses.length === 1 &&
      allowedStatuses[0] === 'completed'

    results.push({
      name: completedOnly
        ? 'confirmed_payment_must_end_completed'
        : 'expected_application_status',
      passed,
      message: passed
        ? undefined
        : 'Expected application state ' +
          allowedStatuses.join(' or ') +
          ', observed ' +
          o.applicationStatus +
          '.'
    })
  }

  if (expected.retryAttempts !== undefined) {
    const passed =
      o.retryAttempts === expected.retryAttempts

    results.push({
      name: expected.retryAttempts === 0
        ? 'unknown_settlement_must_not_be_retried'
        : 'expected_retry_attempts',
      passed,
      message: passed
        ? undefined
        : 'Expected ' +
          expected.retryAttempts +
          ' retry attempt(s), observed ' +
          o.retryAttempts +
          '.'
    })
  }

  if (expected.webhookAccepted !== undefined) {
    const passed =
      o.webhookAccepted === expected.webhookAccepted

    results.push({
      name: expected.webhookAccepted === false
        ? 'invalid_signature_must_be_rejected'
        : 'expected_webhook_acceptance',
      passed,
      message: passed
        ? undefined
        : 'Expected webhookAccepted=' +
          expected.webhookAccepted +
          ', observed ' +
          String(o.webhookAccepted) +
          '.'
    })
  }

  if (o.scenario === 'duplicate_webhook') {
    const passed =
      o.webhookDeliveries <= 1 ||
      o.ledgerEntries <= 1

    results.push({
      name: 'duplicate_webhook_must_not_duplicate_ledger',
      passed,
      message: passed
        ? undefined
        : o.webhookDeliveries +
          ' webhook deliveries created ' +
          o.ledgerEntries +
          ' ledger entries.'
    })
  }

  return results
}