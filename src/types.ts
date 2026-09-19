export type ScenarioName =
  | 'duplicate_webhook'
  | 'out_of_order_webhook'
  | 'missing_webhook'
  | 'provider_timeout_after_broadcast'
  | 'late_chain_confirmation'
  | 'retry_after_unknown_settlement'
  | 'invalid_signature'
  | 'underpayment'
  | 'overpayment'
  | 'late_payment'

export type ProviderStatus =
  | 'pending'
  | 'completed'
  | 'failed'
  | 'timeout'
  | 'underpaid'
  | 'expired'

export type ChainStatus =
  | 'not_broadcast'
  | 'pending'
  | 'confirmed'
  | 'reverted'

export type ApplicationStatus =
  | 'none'
  | 'pending'
  | 'completed'
  | 'failed'
  | 'manual_review'

export type CreditExpectation =
  | 'exact_expected'
  | 'none'
  | 'received_amount'
  | 'any'

export type ExpectedOutcome = {
  applicationStatus?: ApplicationStatus | ApplicationStatus[]
  ledgerEntries?: number
  credit?: CreditExpectation
  retryAttempts?: number
  webhookAccepted?: boolean
}

export type PaymentObservation = {
  scenario: ScenarioName
  paymentId: string
  expectedAmount: number
  receivedAmount?: number
  providerStatus: ProviderStatus
  chainStatus: ChainStatus
  webhookDeliveries: number
  ledgerEntries: number
  creditedAmount: number
  applicationStatus: ApplicationStatus
  retryAttempts: number
  settlementWasUnknown: boolean
  recovered: boolean
  webhookAccepted?: boolean
}

export type ScenarioDefinition = {
  name: ScenarioName
  description: string
  risk: string
  expected: ExpectedOutcome
}

export type InvariantResult = {
  name: string
  passed: boolean
  message?: string
}

export type ScenarioResult = {
  scenario: ScenarioDefinition
  observation: PaymentObservation
  invariants: InvariantResult[]
  passed: boolean
}

export type PaymentAdapter = {
  name: string
  runScenario: (scenario: ScenarioName) => Promise<PaymentObservation>
}