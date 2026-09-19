import { describe, expect, it } from 'vitest'
import { createDemoAdapter } from './adapters/demo.js'
import { runSuite } from './core/runner.js'

describe('stable-ci reliability engine', () => {
  it('passes a resilient payment implementation', async () => {
    const results = await runSuite(createDemoAdapter('safe'))

    expect(results.every((result) => result.passed)).toBe(true)
  })

  it('detects failures in an unsafe payment implementation', async () => {
    const results = await runSuite(createDemoAdapter('unsafe'))

    expect(results.some((result) => !result.passed)).toBe(true)
  })

  it('detects duplicate ledger posting', async () => {
    const results = await runSuite(createDemoAdapter('unsafe'))
    const duplicate = results.find(
      (result) => result.scenario.name === 'duplicate_webhook'
    )

    expect(duplicate?.passed).toBe(false)
    expect(
      duplicate?.invariants.some(
        (result) =>
          result.name === 'payment_posts_exactly_once' &&
          !result.passed
      )
    ).toBe(true)
  })
})