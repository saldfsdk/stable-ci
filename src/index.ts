#!/usr/bin/env node
import { Command } from 'commander'
import { createDemoAdapter } from './adapters/demo.js'
import { createHttpDemoAdapter } from './adapters/http-demo.js'
import { createConfiguredHttpAdapter } from './adapters/configured-http.js'
import { startDemoPaymentApp } from './core/demo-payment-app.js'
import { loadConfig } from './config.js'
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


program
  .command('demo-server')
  .description('Run the local demo payment application')
  .option('--profile <profile>', 'Demo profile: safe or unsafe', 'safe')
  .option('--port <port>', 'Port', '4310')
  .action(async (options) => {
    if (options.profile !== 'safe' && options.profile !== 'unsafe') {
      console.error('Profile must be safe or unsafe.')
      process.exitCode = 2
      return
    }

    const port = Number(options.port)

    if (!Number.isInteger(port) || port <= 0) {
      console.error('Port must be a positive integer.')
      process.exitCode = 2
      return
    }

    const app = await startDemoPaymentApp(
      options.profile,
      port,
    )

    console.log(
      'Demo payment app running at ' + app.baseUrl
    )
    console.log(
      'Profile: ' + options.profile
    )
    console.log('Press Ctrl+C to stop.')

    await new Promise<void>((resolve) => {
      let closing = false

      const shutdown = async () => {
        if (closing) {
          return
        }

        closing = true
        await app.close()
        resolve()
      }

      process.once('SIGINT', () => {
        void shutdown()
      })

      process.once('SIGTERM', () => {
        void shutdown()
      })
    })
  })

program
  .command('run')
  .description('Run stable-ci against a configured payment application')
  .option(
    '-c, --config <path>',
    'Path to stable-ci config',
    'stable-ci.yml',
  )
  .option('--json', 'Output JSON')
  .action(async (options) => {
    try {
      const config = loadConfig(options.config)
      const adapter = createConfiguredHttpAdapter(config)

      const selectedScenarios = scenarios
        .filter(
          (scenario) =>
            config.scenarios.includes(scenario.name)
        )
        .map((scenario) => ({
          ...scenario,
          expected: {
            ...scenario.expected,
            ...(config.expectations?.[scenario.name] ?? {}),
          },
        }))

      const results = await runSuite(
        adapter,
        selectedScenarios,
      )

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
    } catch (error) {
      console.error(
        error instanceof Error
          ? error.message
          : 'Unknown stable-ci error.'
      )
      process.exitCode = 2
    }
  })
program.parseAsync()