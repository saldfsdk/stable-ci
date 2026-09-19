import type {
  PaymentAdapter,
  PaymentObservation,
  ScenarioName,
} from '../types.js'

export type DemoProfile = 'safe' | 'unsafe'

const baseObservation = (
  scenario: ScenarioName,
): PaymentObservation => ({
  scenario,
  paymentId: 'pay_demo_001',
  expectedAmount: 100,
  providerStatus: 'completed',
  chainStatus: 'confirmed',
  webhookDeliveries: 1,
  ledgerEntries: 1,
  creditedAmount: 100,
  applicationStatus: 'completed',
  retryAttempts: 0,
  settlementWasUnknown: false,
  recovered: false,
})

function safeObservation(
  scenario: ScenarioName,
): PaymentObservation {
  const o = baseObservation(scenario)

  switch (scenario) {
    case 'duplicate_webhook':
      return { ...o, webhookDeliveries: 2 }

    case 'out_of_order_webhook':
      return { ...o, webhookDeliveries: 3 }

    case 'missing_webhook':
      return { ...o, webhookDeliveries: 0, recovered: true }

    case 'provider_timeout_after_broadcast':
    case 'late_chain_confirmation':
    case 'retry_after_unknown_settlement':
      return {
        ...o,
        providerStatus: 'timeout',
        webhookDeliveries: 0,
        settlementWasUnknown: true,
        recovered: true,
      }

    case 'invalid_signature':
      return {
        ...o,
        providerStatus: 'failed',
        chainStatus: 'not_broadcast',
        applicationStatus: 'none',
        webhookDeliveries: 0,
        ledgerEntries: 0,
        creditedAmount: 0,
        webhookAccepted: false,
      }
  }
}

function unsafeObservation(
  scenario: ScenarioName,
): PaymentObservation {
  const safe = safeObservation(scenario)

  switch (scenario) {
    case 'duplicate_webhook':
      return {
        ...safe,
        ledgerEntries: 2,
        creditedAmount: 200,
      }

    case 'out_of_order_webhook':
    case 'missing_webhook':
      return {
        ...safe,
        ledgerEntries: 0,
        creditedAmount: 0,
      }

    case 'provider_timeout_after_broadcast':
    case 'late_chain_confirmation':
    case 'retry_after_unknown_settlement':
      return {
        ...safe,
        retryAttempts: 1,
        ledgerEntries: 2,
        creditedAmount: 200,
      }

    case 'invalid_signature':
      return {
        ...safe,
        providerStatus: 'failed',
        chainStatus: 'not_broadcast',
        applicationStatus: 'completed',
        webhookDeliveries: 1,
        ledgerEntries: 1,
        creditedAmount: 100,
        webhookAccepted: true,
      }
  }
}

export function createDemoAdapter(
  profile: DemoProfile,
): PaymentAdapter {
  return {
    name: 'demo:' + profile,
    async runScenario(scenario) {
      return profile === 'safe'
        ? safeObservation(scenario)
        : unsafeObservation(scenario)
    },
  }
}