#!/usr/bin/env node
import { Command } from 'commander'
import { createDemoAdapter } from './adapters/demo.js'
import { createHttpDemoAdapter } from './adapters/http-demo.js'
import { runSuite } from './core/runner.js'
import { scenarios } from './scenarios/builtins.js'
import type { ScenarioResult } from './types.js'

const program = new Command()

function printResults(
  adapterName: string,
  results: ScenarioResult[],
) {
  console.log('Stablecoin Reliability CI')
  console.log('=========================')
  console.log('Adapter: ' + adapterName)
  console.log('')

  for (const result of results) {
    console.log(
      (result.passed ? 'PASS' : 'FAIL') +
      '  ' +
      result.scenario.name
    )

    for (const invariant of result.invariants.filter((x) => !x.passed)) {
      console.log('      ' + invariant.name)

      if (invariant.message) {
        console.log('      ' + invariant.message)
      }
    }
  }

  const passed = results.filter((result) => result.passed).length
  const failed = results.length - passed

  console.log('')
  console.log(passed + ' passed, ' + failed + ' failed')
}

program
  .name('stable-ci')
  .description('Reliability CI for stablecoin payment integrations')
  .version('0.1.0')

program
  .command('scenarios')
  .description('List built-in reliability scenarios')
  .action(() => {
    console.log('Built-in scenarios:')

    for (const scenario of scenarios) {
      console.log('  ' + scenario.name)
      console.log('    ' + scenario.description)
      console.log('    Risk: ' + scenario.risk)
    }
  })

program
  .command('test')
  .description('Run the in-memory reliability test suite')
  .option('--profile <profile>', 'Demo profile: safe or unsafe', 'safe')
  .option('--json', 'Output JSON')
  .action(async (options) => {
    if (options.profile !== 'safe' && options.profile !== 'unsafe') {
      console.error('Profile must be safe or unsafe.')
      process.exitCode = 2
      return
    }

    const adapter = createDemoAdapter(options.profile)
    const results = await runSuite(adapter)

    if (options.json) {
      console.log(JSON.stringify({
        adapter: adapter.name,
        results,
      }, null, 2))
    } else {
      printResults(adapter.name, results)
    }

    if (results.some((result) => !result.passed)) {
      process.exitCode = 1
    }
  })

program
  .command('test-http')
  .description('Run reliability scenarios using real local HTTP fault injection')
  .option('--profile <profile>', 'HTTP demo profile: safe or unsafe', 'safe')
  .option('--json', 'Output JSON')
  .action(async (options) => {
    if (options.profile !== 'safe' && options.profile !== 'unsafe') {
      console.error('Profile must be safe or unsafe.')
      process.exitCode = 2
      return
    }

    const adapter = createHttpDemoAdapter(options.profile)
    const results = await runSuite(adapter)

    if (options.json) {
      console.log(JSON.stringify({
        adapter: adapter.name,
        results,
      }, null, 2))
    } else {
      printResults(adapter.name, results)
    }

    if (results.some((result) => !result.passed)) {
      process.exitCode = 1
    }
  })

program.parseAsync()