import { evaluateInvariants } from '../invariants/builtins.js'
import { scenarios } from '../scenarios/builtins.js'
import type { PaymentAdapter, ScenarioResult } from '../types.js'

export async function runSuite(
  adapter: PaymentAdapter,
  selectedScenarios = scenarios,
): Promise<ScenarioResult[]> {
  const results: ScenarioResult[] = []

  for (const scenario of selectedScenarios) {
    const observation = await adapter.runScenario(scenario.name)
    const invariantResults = evaluateInvariants(
      observation,
      scenario.expected,
    )

    results.push({
      scenario,
      observation,
      invariants: invariantResults,
      passed: invariantResults.every((result) => result.passed),
    })
  }

  return results
}