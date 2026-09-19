import { evaluateInvariants } from '../invariants/builtins.js'
import { scenarios } from '../scenarios/builtins.js'
import type { PaymentAdapter, ScenarioResult } from '../types.js'

export async function runSuite(
  adapter: PaymentAdapter,
): Promise<ScenarioResult[]> {
  const results: ScenarioResult[] = []

  for (const scenario of scenarios) {
    const observation = await adapter.runScenario(scenario.name)
    const invariantResults = evaluateInvariants(observation)

    results.push({
      scenario,
      observation,
      invariants: invariantResults,
      passed: invariantResults.every((result) => result.passed),
    })
  }

  return results
}