import fs from 'node:fs'
import { parse } from 'yaml'
import { z } from 'zod'
import type { ScenarioName } from './types.js'

const scenarioSchema = z.enum([
  'duplicate_webhook',
  'out_of_order_webhook',
  'missing_webhook',
])

const configSchema = z.object({
  provider: z.enum(['generic', 'bvnk']).default('generic'),
  webhookSecret: z.string().min(1).optional(),
  target: z.object({
    name: z.string().min(1),
    baseUrl: z.string().url(),
    endpoints: z.object({
      reset: z.string().min(1),
      webhook: z.string().min(1),
      state: z.string().min(1),
      reconcile: z.string().min(1).optional(),
    }),
  }),
  payment: z.object({
    id: z.string().min(1),
    amount: z.number().positive(),
    asset: z.string().min(1),
  }),
  scenarios: z.array(scenarioSchema).min(1),
})

export type StableCiConfig = {
  provider: 'generic' | 'bvnk'
  webhookSecret?: string
  target: {
    name: string
    baseUrl: string
    endpoints: {
      reset: string
      webhook: string
      state: string
      reconcile?: string
    }
  }
  payment: {
    id: string
    amount: number
    asset: string
  }
  scenarios: ScenarioName[]
}

export function loadConfig(
  path: string,
): StableCiConfig {
  if (!fs.existsSync(path)) {
    throw new Error('Config file not found: ' + path)
  }

  const raw = fs.readFileSync(path, 'utf8')
  const parsed = configSchema.parse(parse(raw))

  return {
    ...parsed,
    scenarios: parsed.scenarios as ScenarioName[],
  }
}