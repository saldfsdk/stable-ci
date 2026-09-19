import type { ScenarioDefinition } from '../types.js'

export const scenarios: ScenarioDefinition[] = [
  {
    name: 'duplicate_webhook',
    description: 'The same payment webhook is delivered more than once.',
    risk: 'Duplicate ledger posting or duplicate credit',
  },
  {
    name: 'out_of_order_webhook',
    description: 'Payment lifecycle events arrive out of order.',
    risk: 'State regression or incorrect final payment state',
  },
  {
    name: 'missing_webhook',
    description: 'The provider completes the payment but the webhook is never delivered.',
    risk: 'Confirmed payment never reaches the internal ledger',
  },
  {
    name: 'provider_timeout_after_broadcast',
    description: 'The provider times out after broadcasting the transaction.',
    risk: 'Unsafe retry can create a duplicate payment',
  },
  {
    name: 'late_chain_confirmation',
    description: 'The chain confirms after the application has already observed a timeout.',
    risk: 'Application and blockchain disagree about settlement',
  },
  {
    name: 'retry_after_unknown_settlement',
    description: 'A retry is requested while the original settlement outcome is still unknown.',
    risk: 'Double payment or duplicate payout',
  },
]