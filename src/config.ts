import fs from 'node:fs'
import {
  dirname,
  resolve,
} from 'node:path'
import { parse } from 'yaml'
import { z } from 'zod'
import type {
  ExpectedOutcome,
  ScenarioName,
} from './types.js'

const scenarioSchema = z.enum([
  'duplicate_webhook',
  'out_of_order_webhook',
  'missing_webhook',
  'invalid_signature',
  'underpayment',
  'overpayment',
  'late_payment',
])

const applicationStatusSchema = z.enum([
  'none',
  'pending',
  'completed',
  'failed',
  'manual_review',
])

const expectedOutcomeSchema = z.object({
  applicationStatus: z.union([
    applicationStatusSchema,
    z.array(applicationStatusSchema),
  ]).optional(),
  ledgerEntries:
    z.number().int().nonnegative().optional(),
  credit: z.enum([
    'exact_expected',
    'none',
    'received_amount',
    'any',
  ]).optional(),
  retryAttempts:
    z.number().int().nonnegative().optional(),
  webhookAccepted: z.boolean().optional(),
})

const fixtureSchema = z.object({
  pending: z.string().min(1).optional(),
  completed: z.string().min(1).optional(),
  failed: z.string().min(1).optional(),
  underpaid: z.string().min(1).optional(),
  expired: z.string().min(1).optional(),
})

const customProviderSchema = z.object({
  name: z.string().min(1).default('custom'),
  fixtures: fixtureSchema,
  headers: z.record(
    z.string(),
    z.string(),
  ).optional(),
  signature: z.object({
    header: z.string().min(1),
    algorithm:
      z.literal('sha256').default('sha256'),
    encoding:
      z.enum(['base64', 'hex']).default('base64'),
  }).optional(),
})

const configSchema = z.object({
  provider: z.enum([
    'generic',
    'bvnk',
    'custom',
  ]).default('generic'),

  webhookSecret:
    z.string().min(1).optional(),

  customProvider:
    customProviderSchema.optional(),

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

  scenarios:
    z.array(scenarioSchema).min(1),

  expectations: z.record(
    z.string(),
    expectedOutcomeSchema,
  ).optional(),
})

export type CustomProviderConfig = {
  name: string
  fixtures: {
    pending?: string
    completed?: string
    failed?: string
    underpaid?: string
    expired?: string
  }
  headers?: Record<string, string>
  signature?: {
    header: string
    algorithm: 'sha256'
    encoding: 'base64' | 'hex'
  }
}

export type StableCiConfig = {
  provider: 'generic' | 'bvnk' | 'custom'
  webhookSecret?: string
  customProvider?: CustomProviderConfig

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

  expectations?: Partial<
    Record<ScenarioName, ExpectedOutcome>
  >
}

function resolveFixtures(
  fixtures: CustomProviderConfig['fixtures'],
  configDir: string,
): CustomProviderConfig['fixtures'] {
  return Object.fromEntries(
    Object.entries(fixtures).map(
      ([status, fixturePath]) => [
        status,
        resolve(configDir, fixturePath),
      ],
    ),
  ) as CustomProviderConfig['fixtures']
}

export function loadConfig(
  configPath: string,
): StableCiConfig {
  if (!fs.existsSync(configPath)) {
    throw new Error(
      'Config file not found: ' + configPath,
    )
  }

  const raw =
    fs.readFileSync(configPath, 'utf8')

  const parsed =
    configSchema.parse(parse(raw))

  const configDir =
    dirname(resolve(configPath))

  const customProvider =
    parsed.customProvider
      ? {
          ...parsed.customProvider,
          fixtures: resolveFixtures(
            parsed.customProvider.fixtures,
            configDir,
          ),
        }
      : undefined

  if (
    parsed.provider === 'custom' &&
    !customProvider
  ) {
    throw new Error(
      'provider custom requires customProvider configuration.',
    )
  }

  if (
    parsed.provider === 'custom' &&
    customProvider
  ) {
    const requiredFixtures = new Set<
      keyof CustomProviderConfig['fixtures']
    >()

    for (const scenario of parsed.scenarios) {
      switch (scenario) {
        case 'duplicate_webhook':
        case 'overpayment':
        case 'invalid_signature':
          requiredFixtures.add('completed')
          break

        case 'out_of_order_webhook':
          requiredFixtures.add('completed')
          requiredFixtures.add('pending')
          break

        case 'underpayment':
          requiredFixtures.add('underpaid')
          break

        case 'late_payment':
          requiredFixtures.add('expired')
          break

        case 'missing_webhook':
          break
      }
    }

    for (const status of requiredFixtures) {
      if (!customProvider.fixtures[status]) {
        throw new Error(
          'Custom provider is missing the ' +
            status +
            ' webhook fixture required by the configured scenarios.',
        )
      }
    }

    if (
      customProvider.signature &&
      !parsed.webhookSecret
    ) {
      throw new Error(
        'customProvider.signature requires webhookSecret.',
      )
    }

    if (
      parsed.scenarios.includes(
        'invalid_signature',
      ) &&
      !customProvider.signature
    ) {
      throw new Error(
        'invalid_signature requires customProvider.signature.',
      )
    }
  }

  return {
    ...parsed,
    customProvider,
    scenarios:
      parsed.scenarios as ScenarioName[],
    expectations:
      parsed.expectations as
        | Partial<
            Record<
              ScenarioName,
              ExpectedOutcome
            >
          >
        | undefined,
  }
}