import { describe, expect, it } from 'vitest'
import { createHttpDemoAdapter } from './adapters/http-demo.js'
import { runSuite } from './core/runner.js'

describe('stable-ci HTTP fault injection', () => {
  it('passes a resilient HTTP payment application', async () => {
    const results = await runSuite(
      createHttpDemoAdapter('safe')
    )

    expect(
      results.every((result) => result.passed)
    ).toBe(true)
  })

  it('detects failures through real HTTP requests', async () => {
    const results = await runSuite(
      createHttpDemoAdapter('unsafe')
    )

    expect(
      results.some((result) => !result.passed)
    ).toBe(true)
  })

  it('detects out-of-order application state regression', async () => {
    const results = await runSuite(
      createHttpDemoAdapter('unsafe')
    )

    const result = results.find(
      (item) =>
        item.scenario.name === 'out_of_order_webhook'
    )

    expect(result?.passed).toBe(false)
    expect(
      result?.invariants.some(
        (item) =>
          item.name === 'confirmed_payment_must_end_completed' &&
          !item.passed
      )
    ).toBe(true)
  })
})