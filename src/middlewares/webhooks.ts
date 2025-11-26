import type { WebhookContext } from "../types";

export const validateWebhookKey = async (c: WebhookContext, next: () => Promise<void>) => {
  // Check query param 'key' OR header 'x-webhook-secret'
  const key = c.req.query('key') || c.req.header('x-webhook-secret');
  
  if (key !== c.env.WEBHOOK_SECRET) {
    return c.text('Unauthorized: Invalid API Key', 401)
  }
  await next()
}