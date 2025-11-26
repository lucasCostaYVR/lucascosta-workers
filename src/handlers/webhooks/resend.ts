import type { WebhookContext } from "../../types";
import { ResendWebhookSchema } from "../../schemas";
import { createLogger } from "../../lib/utils";

// Resend handler
export async function handleResend(c: WebhookContext): Promise<Response> {
    const logger = createLogger(c.env);
    
    try {
        const payload = await c.req.json();
        const event = ResendWebhookSchema.parse(payload);
        
        logger.info('Received Resend webhook', { type: event.type });

        // Extract the primary email (recipient)
        let email: string | undefined;

        if (event.data.email) {
            // Contact event
            email = event.data.email;
        } else if (event.data.to && event.data.to.length > 0) {
            // Email event
            email = event.data.to[0];
        }

        if (!email) {
            logger.warn('Resend event missing recipient email', { payload });
            return c.text('Missing email', 400);
        }

        // Map to ProcessedEvent
        const processedEvent = {
            source: 'resend' as const,
            type: event.type, // e.g. 'email.opened', 'contact.created'
            identity_type: 'email' as const,
            identity_value: email,
            timestamp: event.created_at,
            traits: {
                email: email,
                subject: event.data.subject,
                email_id: event.data.email_id,
                url: event.data.url, // For clicks
                bounceType: event.data.bounce?.type, // For bounces
                bounceMessage: event.data.bounce?.message,
                contactId: event.data.id, // For contact events
                audienceId: event.data.audience_id,
                firstName: event.data.first_name,
                lastName: event.data.last_name,
                unsubscribed: event.data.unsubscribed
            },
            raw: payload
        };

        // Send to Queue
        await c.env.QUEUE.send(processedEvent);
        
        return c.json({ status: 'queued' }, 200);

    } catch (error) {
        logger.error('Failed to process Resend webhook', { error: error instanceof Error ? error.message : String(error) });
        return c.text('Error processing webhook', 500);
    }
}