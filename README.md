# stable-ci

**Break your stablecoin integration before production.**

`stable-ci` injects deterministic payment failures into stablecoin payment integrations and verifies that your application and ledger still converge to the expected financial state.

It is designed for CI: define your payment policy, run failure scenarios against your integration, and fail the build when money moves incorrectly.

## What it catches

`stable-ci` currently tests:

- Duplicate webhooks
- Out-of-order webhooks
- Missing webhooks
- Provider timeout after broadcast
- Late blockchain confirmation
- Retry while settlement is unknown
- Invalid webhook signatures
- Underpayments
- Overpayments
- Late payments

It verifies outcomes such as:

- exactly-once ledger posting
- credited amount
- final application state
- retry behavior
- webhook acceptance
- recovery after missing events

## Example

A broken overpayment handler:

```text
FAIL  overpayment
      ledger_delta_equals_settlement_amount
      Expected USD 100.00, ledger credited USD 140.00.
```

Instead of only asking whether an API request succeeded, `stable-ci` checks whether the resulting financial state is correct.

## Install

```bash
npm install --save-dev stable-ci
```

Or run it directly:

```bash
npx stable-ci --help
```

## Quick start

Create `stable-ci.yml`:

```yaml
provider: bvnk

webhookSecret: your-test-webhook-secret

target:
  name: payment-app
  baseUrl: http://127.0.0.1:4310
  endpoints:
    reset: /reset
    webhook: /webhook
    state: /state
    reconcile: /reconcile

payment:
  id: pay_test_001
  amount: 100
  asset: USDC

scenarios:
  - duplicate_webhook
  - out_of_order_webhook
  - missing_webhook
  - invalid_signature
  - underpayment
  - overpayment
  - late_payment

expectations:
  underpayment:
    applicationStatus: manual_review
    ledgerEntries: 0
    credit: none

  overpayment:
    applicationStatus: completed
    ledgerEntries: 1
    credit: exact_expected

  late_payment:
    applicationStatus: manual_review
    ledgerEntries: 0
    credit: none
```

Run:

```bash
npx stable-ci run --config stable-ci.yml
```

Example output:

```text
Stablecoin Reliability CI
=========================
Adapter: payment-app [bvnk]

PASS  duplicate_webhook
PASS  out_of_order_webhook
PASS  missing_webhook
PASS  invalid_signature
PASS  underpayment
FAIL  overpayment
PASS  late_payment

6 passed, 1 failed
```

A failed scenario causes a non-zero exit code, so it can fail CI.

## Expected outcomes

Different applications may intentionally handle payment exceptions differently.

For example, an overpayment may credit only the requested amount:

```yaml
expectations:
  overpayment:
    applicationStatus: completed
    ledgerEntries: 1
    credit: exact_expected
```

While another application may intentionally credit the entire received amount:

```yaml
expectations:
  overpayment:
    applicationStatus: completed
    ledgerEntries: 1
    credit: received_amount
```

`stable-ci` tests against your declared financial policy instead of assuming that every integration has the same correct outcome.

## GitHub Actions

This repository includes a composite GitHub Action.

```yaml
steps:
  - uses: actions/checkout@v4

  - uses: saldfsdk/stable-ci@v0.1.1
    with:
      config: stable-ci.yml
      junit: reports/stable-ci.xml
```

The action runs the configured scenarios and writes a JUnit report.

## JUnit

You can generate a JUnit XML report directly:

```bash
npx stable-ci run \
  --config stable-ci.yml \
  --junit reports/stable-ci.xml
```

JUnit reports are written even when reliability scenarios fail.

## JSON output

For machine-readable output:

```bash
npx stable-ci test --profile safe --json
```

## Built-in scenarios

List all scenarios:

```bash
npx stable-ci scenarios
```

Current scenarios include:

- `duplicate_webhook`
- `out_of_order_webhook`
- `missing_webhook`
- `provider_timeout_after_broadcast`
- `late_chain_confirmation`
- `retry_after_unknown_settlement`
- `invalid_signature`
- `underpayment`
- `overpayment`
- `late_payment`

## Provider support

### BVNK

The current BVNK adapter models payment webhook behavior including:

- signed webhook delivery
- `statusChanged`
- `transactionConfirmed`
- `transactionLate`
- underpayments
- overpayments
- late payments

Provider payload fixtures are based on publicly documented behavior and are intended for reliability testing.

`stable-ci` is not affiliated with or endorsed by BVNK.

### Generic

A generic provider adapter is also included for provider-independent testing.

## Architecture

```text
stable-ci.yml
     |
     v
Scenario Runner
     |
     v
Fault Injection
     |
     v
Provider / Webhook / Application
     |
     v
Observed State
     |
     v
Expected Outcome + Invariant Engine
     |
     +---- PASS
     |
     +---- FAIL
             |
             +-- CLI
             +-- JSON
             +-- JUnit
```

## Why stable-ci?

Payment integrations can fail even when individual API calls appear successful.

Examples include:

- the same webhook being delivered twice
- lifecycle events arriving out of order
- a payment being confirmed after an application timeout
- retrying while settlement is still unknown
- an invalid webhook being accepted
- an underpayment being treated as fully paid
- an overpayment being credited incorrectly
- an expired payment being revived after late funds arrive

These are not only API correctness problems.

They are **money movement correctness** problems.

`stable-ci` is designed to test the final financial outcome, not only whether a request returned HTTP 200.

## Current status

`stable-ci` is an early-stage developer tool.

The current version focuses on deterministic local and CI testing.

It does not yet provide full production blockchain observation or hosted monitoring.

Planned areas include:

- additional provider adapters
- richer CI reporting
- blockchain/RPC observers
- provider sandbox drift detection
- hosted reliability testing

## Development

Install dependencies:

```bash
npm install
```

Run all tests and build:

```bash
npm run check
```

Run the local safe demo:

```bash
npm run build
node dist/index.js test-http --profile safe
```

Expected result:

```text
10 passed, 0 failed
```

Run the intentionally unsafe demo:

```bash
node dist/index.js test-http --profile unsafe
```

Expected result:

```text
0 passed, 10 failed
```

The unsafe profile intentionally contains broken payment-handling behavior so that the reliability checks can demonstrate what they detect.

## License

MIT