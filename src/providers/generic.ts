import type { WebhookProvider } from './types.js'

export function createGenericProvider(): WebhookProvider {
  return {
    name: 'generic',
    render(event) {
      return {
        body: JSON.stringify(event),
        headers: {
          'content-type': 'application/json',
        },
      }
    },
  }
}