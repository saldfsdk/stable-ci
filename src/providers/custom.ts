import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type {
  CanonicalWebhookEvent,
  WebhookProvider,
} from './types.js'

export type CustomProviderOptions = {
  name: string
  fixtures: Partial<
    Record<CanonicalWebhookEvent['status'], string>
  >
  headers?: Record<string, string>
  signature?: {
    header: string
    algorithm: 'sha256'
    encoding: 'base64' | 'hex'
  }
  webhookSecret?: string
}

type TemplateValues =
  Record<string, string | number | null>

function templateValues(
  event: CanonicalWebhookEvent,
): TemplateValues {
  return {
    eventId: event.eventId,
    paymentId: event.paymentId,
    status: event.status,
    amount: event.amount,
    actualAmount:
      event.actualAmount ?? event.amount,
    asset: event.asset,
    eventType: event.eventType ?? null,
  }
}

function renderString(
  value: string,
  values: TemplateValues,
): string | number | null {
  const exact = value.match(
    /^\{\{(eventId|paymentId|status|amount|actualAmount|asset|eventType)\}\}$/,
  )

  if (exact) {
    return values[exact[1]]
  }

  return value.replace(
    /\{\{(eventId|paymentId|status|amount|actualAmount|asset|eventType)\}\}/g,
    (_match, key: string) =>
      String(values[key] ?? ''),
  )
}

function renderTemplateValue(
  value: unknown,
  values: TemplateValues,
): unknown {
  if (typeof value === 'string') {
    return renderString(value, values)
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      renderTemplateValue(item, values),
    )
  }

  if (
    typeof value === 'object' &&
    value !== null
  ) {
    return Object.fromEntries(
      Object.entries(value).map(
        ([key, item]) => [
          key,
          renderTemplateValue(item, values),
        ],
      ),
    )
  }

  return value
}

function renderBodyTemplate(
  template: string,
  event: CanonicalWebhookEvent,
) {
  const parsed =
    JSON.parse(template) as unknown

  const rendered = renderTemplateValue(
    parsed,
    templateValues(event),
  )

  return JSON.stringify(rendered)
}

function renderHeaderTemplate(
  template: string,
  event: CanonicalWebhookEvent,
) {
  const values = templateValues(event)

  return template.replace(
    /\{\{(eventId|paymentId|status|amount|actualAmount|asset|eventType)\}\}/g,
    (_match, key: string) =>
      String(values[key] ?? ''),
  )
}

export function createCustomProvider(
  options: CustomProviderOptions,
): WebhookProvider {
  if (
    options.signature &&
    !options.webhookSecret
  ) {
    throw new Error(
      'custom provider signature requires webhookSecret.',
    )
  }

  return {
    name: options.name,
    signatureHeader:
      options.signature?.header,

    render(event) {
      const fixturePath =
        options.fixtures[event.status]

      if (!fixturePath) {
        throw new Error(
          'No custom webhook fixture configured for status: ' +
            event.status,
        )
      }

      const template =
        readFileSync(fixturePath, 'utf8')

      const body =
        renderBodyTemplate(template, event)

      const headers: Record<string, string> = {
        'content-type': 'application/json',
      }

      for (
        const [name, value] of
        Object.entries(options.headers ?? {})
      ) {
        headers[name] =
          renderHeaderTemplate(value, event)
      }

      if (options.signature) {
        const signature = createHmac(
          options.signature.algorithm,
          options.webhookSecret as string,
        )
          .update(body, 'utf8')
          .digest(options.signature.encoding)

        headers[options.signature.header] =
          signature
      }

      return {
        body,
        headers,
      }
    },
  }
}