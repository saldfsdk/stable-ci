import fs from 'node:fs'
import path from 'node:path'
import type { ScenarioResult } from '../types.js'

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function failureText(result: ScenarioResult): string {
  return result.invariants
    .filter((invariant) => !invariant.passed)
    .map((invariant) => {
      if (invariant.message) {
        return invariant.name + ': ' + invariant.message
      }

      return invariant.name
    })
    .join('\n')
}

export function renderJUnit(
  adapterName: string,
  results: ScenarioResult[],
): string {
  const failures = results.filter(
    (result) => !result.passed
  ).length

  const testcases = results.map((result) => {
    const name = escapeXml(result.scenario.name)
    const className = escapeXml(
      'stable-ci.' + adapterName
    )

    if (result.passed) {
      return [
        '  <testcase',
        '    classname="' + className + '"',
        '    name="' + name + '"',
        '  />',
      ].join('\n')
    }

    const message = failureText(result)

    return [
      '  <testcase',
      '    classname="' + className + '"',
      '    name="' + name + '"',
      '  >',
      '    <failure message="Stablecoin reliability invariant failed">',
      escapeXml(message),
      '    </failure>',
      '  </testcase>',
    ].join('\n')
  })

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<testsuite',
    '  name="stable-ci"',
    '  tests="' + results.length + '"',
    '  failures="' + failures + '"',
    '>',
    ...testcases,
    '</testsuite>',
    '',
  ].join('\n')
}

export function writeJUnit(
  filePath: string,
  adapterName: string,
  results: ScenarioResult[],
): void {
  const directory = path.dirname(
    path.resolve(filePath)
  )

  fs.mkdirSync(directory, {
    recursive: true,
  })

  fs.writeFileSync(
    filePath,
    renderJUnit(adapterName, results),
    'utf8',
  )
}