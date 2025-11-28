/**
 * Telegram Bot API Client
 * Sends notifications to your personal Telegram chat
 */

export interface TelegramMessage {
  text: string;
  parse_mode?: 'Markdown' | 'HTML';
}

export class TelegramClient {
  private botToken: string;
  private chatId: string;

  constructor(botToken: string, chatId: string) {
    this.botToken = botToken;
    this.chatId = chatId;
  }

  /**
   * Send a message to your Telegram chat
   */
  async sendMessage(text: string, parseMode: 'Markdown' | 'HTML' = 'Markdown'): Promise<void> {
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: this.chatId,
        text,
        parse_mode: parseMode,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Telegram API error: ${error}`);
    }
  }

  /**
   * Send a notification with emoji and formatting
   */
  async notify(emoji: string, title: string, details: Record<string, any>): Promise<void> {
    // Escape special Markdown characters in values
    const escapeMarkdown = (text: string): string => {
      return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
    };
    
    const detailsText = Object.entries(details)
      .map(([key, value]) => {
        const escapedValue = escapeMarkdown(String(value));
        return `• ${key}: ${escapedValue}`;
      })
      .join('\n');

    const message = `${emoji} *${title}*\n\n${detailsText}`;
    await this.sendMessage(message);
  }
}

/**
 * Helper to create Telegram client from env bindings
 * Returns null if Telegram is not configured (graceful degradation)
 */
export function createTelegramClient(env: { TELEGRAM_BOT_TOKEN?: string; TELEGRAM_CHAT_ID?: string }): TelegramClient | null {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return null;
  }
  return new TelegramClient(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID);
}

/**
 * Simple helper to send Telegram notification
 * Gracefully handles missing credentials
 */
export async function sendTelegramNotification(
  botToken: string | undefined,
  chatId: string | undefined,
  message: string
): Promise<void> {
  if (!botToken || !chatId) {
    console.warn('Telegram not configured, skipping notification');
    return;
  }

  try {
    const client = new TelegramClient(botToken, chatId);
    await client.sendMessage(message);
  } catch (error) {
    console.error('Failed to send Telegram notification:', error);
    // Don't throw - notification failures shouldn't break the main flow
  }
}
