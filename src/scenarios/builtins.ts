import type { ScenarioDefinition } from '../types.js'

export const scenarios: ScenarioDefinition[] = [
  {
    name: 'duplicate_webhook',
    description: 'The same payment webhook is delivered more than once.',
    risk: 'Duplicate ledger posting or duplicate credit',
    expected: {
      applicationStatus: 'completed',
      ledgerEntries: 1,
      credit: 'exact_expected',
    },
  },
  {
    name: 'out_of_order_webhook',
    description: 'Payment lifecycle events arrive out of order.',
    risk: 'State regression or incorrect final payment state',
    expected: {
      applicationStatus: 'completed',
      ledgerEntries: 1,
      credit: 'exact_expected',
    },
  },
  {
    name: 'missing_webhook',
    description: 'The provider completes the payment but the webhook is never delivered.',
    risk: 'Confirmed payment never reaches the internal ledger',
    expected: {
      applicationStatus: 'completed',
      ledgerEntries: 1,
      credit: 'exact_expected',
    },
  },
  {
    name: 'provider_timeout_after_broadcast',
    description: 'The provider times out after broadcasting the transaction.',
    risk: 'Unsafe retry can create a duplicate payment',
    expected: {
      applicationStatus: 'completed',
      ledgerEntries: 1,
      credit: 'exact_expected',
      retryAttempts: 0,
    },
  },
  {
    name: 'late_chain_confirmation',
    description: 'The chain confirms after the application has already observed a timeout.',
    risk: 'Application and blockchain disagree about settlement',
    expected: {
      applicationStatus: 'completed',
      ledgerEntries: 1,
      credit: 'exact_expected',
      retryAttempts: 0,
    },
  },
  {
    name: 'retry_after_unknown_settlement',
    description: 'A retry is requested while the original settlement outcome is still unknown.',
    risk: 'Double payment or duplicate payout',
    expected: {
      applicationStatus: 'completed',
      ledgerEntries: 1,
      credit: 'exact_expected',
      retryAttempts: 0,
    },
  },
  {
    name: 'invalid_signature',
    description: 'A webhook is delivered with an invalid provider signature.',
    risk: 'Forged payment events may be accepted and credited',
    expected: {
      applicationStatus: 'none',
      ledgerEntries: 0,
      credit: 'none',
      webhookAccepted: false,
    },
  },
  {
    name: 'underpayment',
    description: 'The customer sends less than the requested payment amount.',
    risk: 'Partial payment may be incorrectly treated as fully paid',
    expected: {
      applicationStatus: 'manual_review',
      ledgerEntries: 0,
      credit: 'none',
    },
  },
]