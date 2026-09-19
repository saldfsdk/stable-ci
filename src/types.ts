export type ScenarioName =
  | 'duplicate_webhook'
  | 'out_of_order_webhook'
  | 'missing_webhook'
  | 'provider_timeout_after_broadcast'
  | 'late_chain_confirmation'
  | 'retry_after_unknown_settlement'

export type ProviderStatus =
  | 'pending'
  | 'completed'
  | 'failed'
  | 'timeout'

export type ChainStatus =
  | 'not_broadcast'
  | 'pending'
  | 'confirmed'
  | 'reverted'

export type ApplicationStatus = 'none' | 'pending' | 'completed' | 'failed'

export type PaymentObservation = {
  scenario: ScenarioName
  paymentId: string
  expectedAmount: number
  providerStatus: ProviderStatus
  chainStatus: ChainStatus
  webhookDeliveries: number
  ledgerEntries: number
  creditedAmount: number
  applicationStatus: ApplicationStatus
  retryAttempts: number
  settlementWasUnknown: boolean
  recovered: boolean
}

export type ScenarioDefinition = {
  name: ScenarioName
  description: string
  risk: string
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