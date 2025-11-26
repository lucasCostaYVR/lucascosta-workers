import type { ProcessedEvent } from '../../schemas';
import type { Bindings } from '../../types';
import { createLogger } from '../../lib/utils';
import { processWebEvent } from './web-events';
import { createTelegramClient } from '../../lib/clients';

export async function processContact(event: ProcessedEvent, env: Bindings): Promise<void> {
  const logger = createLogger(env);
  const telegram = createTelegramClient(env);

  // Extract fields BEFORE processing (to get the original values)
  const traits = event.traits as Record<string, any>;
  const subject = traits.subject;
  const message = traits.message;
  const name = traits.name; // Should be from user.name
  const email = traits.email || event.identity_value;
  
  logger.info('Contact form - traits inspection', {
    extractedName: name,
    extractedEmail: email,
    hasUserObject: !!traits.user,
    userObjectName: traits.user?.name,
    identityValue: event.identity_value
  });

  // 1. Process as a standard web event (DB insert, identity merge)
  await processWebEvent(event, env);
  
  // Fallback values
  const senderName = name || email?.split('@')[0] || 'Unknown';
  const senderEmail = email || 'no-reply@lucascosta.tech';
  const emailSubject = subject || 'New Contact Form Submission';

  // 2. Send Telegram notification
  if (telegram) {
    try {
      const messagePreview = message && message.length > 150 
        ? message.substring(0, 150) + '...' 
        : message || '(No message)';
      
      await telegram.notify('📨', 'New Contact Form', {
        'Name': senderName,
        'Email': senderEmail,
        'Subject': emailSubject,
        'Message': messagePreview
      });
    } catch (telegramError) {
      logger.error('Failed to send Telegram notification', {
        error: telegramError instanceof Error ? telegramError.message : String(telegramError)
      });
    }
  }

  // 3. Send Notification Email via Resend
  if (!env.RESEND_API_KEY) {
    logger.warn('Skipping contact email notification: RESEND_API_KEY not set');
    return;
  }

  const emailBody = `
    <h2>New Contact Form Submission</h2>
    <p><strong>Name:</strong> ${senderName}</p>
    <p><strong>Email:</strong> ${senderEmail}</p>
    <p><strong>Subject:</strong> ${emailSubject}</p>
    <hr />
    <h3>Message:</h3>
    <p>${message}</p>
    <br />
    <p><small>Sent from lucascosta.tech</small></p>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Lucas Costa <system@lucascosta.tech>',
        to: ['lucas.costa.1194@gmail.com'], 
        reply_to: senderEmail,
        subject: `[Contact Form] ${emailSubject}`,
        html: emailBody
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Resend API error: ${res.status} ${errorText}`);
    }

    logger.info('Contact notification email sent', { 
      to: 'lucas.costa.1194@gmail.com',
      subject: emailSubject
    });

  } catch (error) {
    logger.error('Failed to send contact notification email', {
      error: error instanceof Error ? error.message : String(error)
    });
    // We don't throw here because the event was already saved to DB.
    // If email fails, we log it. Retrying might cause duplicate DB inserts if processWebEvent isn't idempotent (it is mostly idempotent).
  }
}
