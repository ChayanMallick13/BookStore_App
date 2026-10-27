import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { errorDetails } from '../utils/errorDetails.js';
import { logger } from '../utils/logger.js';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

export function escapeEmailHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]!);
}

export interface EmailConfig {
  provider: 'smtp' | 'resend';
  nodeEnv: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  resendApiKey?: string;
  from: string;
}

interface EmailDependencies {
  fetcher?: typeof fetch;
  smtpSend?: (config: EmailConfig, message: EmailMessage) => Promise<string | undefined>;
}

export class EmailDeliveryError extends AppError {
  public readonly provider: EmailConfig['provider'];
  public readonly providerCode?: string;
  public readonly cause?: unknown;

  constructor(
    provider: EmailConfig['provider'],
    providerCode?: string,
    cause?: unknown,
  ) {
    super(
      'Email could not be sent. Check the email provider configuration and try again.',
      503,
      'EMAIL_DELIVERY_FAILED',
    );
    this.name = 'EmailDeliveryError';
    this.provider = provider;
    this.providerCode = providerCode;
    this.cause = cause;
  }
}

function providerCode(error: unknown) {
  if (!error || typeof error !== 'object') return undefined;
  const details = error as { code?: unknown; responseCode?: unknown };
  if (typeof details.code === 'string') return details.code;
  if (typeof details.responseCode === 'number') return String(details.responseCode);
  return undefined;
}

async function sendResend(config: EmailConfig, message: EmailMessage, fetcher: typeof fetch) {
  if (!config.resendApiKey) {
    throw new AppError(
      'Resend email is selected but RESEND_API_KEY is missing. Add the key to the server environment.',
      503,
      'EMAIL_NOT_CONFIGURED',
    );
  }

  const response = await fetcher('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: config.from, ...message }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const error = new Error(`Resend returned HTTP ${response.status}`) as Error & { code?: string };
    error.code = `HTTP_${response.status}`;
    throw error;
  }

  const result = (await response.json()) as { id?: unknown };
  return typeof result.id === 'string' ? result.id : undefined;
}

export function createEmailSender(
  config: EmailConfig,
  dependencies: EmailDependencies = {},
) {
  const fetcher = dependencies.fetcher ?? globalThis.fetch;
  let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

  return async function deliverEmail(message: EmailMessage) {
    if (
      config.nodeEnv === 'test' &&
      !config.smtpHost &&
      !config.resendApiKey
    ) {
      logger.info('Email delivery skipped in test environment', { provider: config.provider });
      return { status: 'skipped' as const };
    }

    try {
      let messageId: string | undefined;
      if (config.provider === 'resend') {
        messageId = await sendResend(config, message, fetcher);
      } else if (dependencies.smtpSend) {
        messageId = await dependencies.smtpSend(config, message);
      } else {
        if (!config.smtpHost) {
          throw new AppError(
            'SMTP email is selected but SMTP_HOST is missing. Configure SMTP or select the Resend provider.',
            503,
            'EMAIL_NOT_CONFIGURED',
          );
        }
        transporter ??= nodemailer.createTransport({
          host: config.smtpHost,
          port: config.smtpPort ?? 587,
          connectionTimeout: 10_000,
          greetingTimeout: 10_000,
          socketTimeout: 15_000,
          auth: config.smtpUser ? { user: config.smtpUser, pass: config.smtpPass } : undefined,
        });
        const result = await transporter.sendMail({ from: config.from, ...message });
        messageId = result.messageId;
      }

      logger.info('Email accepted by provider', {
        operation: 'email.send',
        provider: config.provider,
        messageId,
      });
      return { status: 'accepted' as const, provider: config.provider, messageId };
    } catch (error) {
      const code = providerCode(error);
      logger.error('Email provider request failed', {
        operation: 'email.send',
        provider: config.provider,
        providerCode: code,
        error: errorDetails(error),
      });
      if (error instanceof AppError) throw error;
      throw new EmailDeliveryError(config.provider, code, error);
    }
  };
}

export const sendEmail = createEmailSender({
  provider: env.EMAIL_PROVIDER,
  nodeEnv: env.NODE_ENV,
  smtpHost: env.SMTP_HOST,
  smtpPort: env.SMTP_PORT,
  smtpUser: env.SMTP_USER,
  smtpPass: env.SMTP_PASS,
  resendApiKey: env.RESEND_API_KEY,
  from: env.EMAIL_FROM,
});

logger.info('Email provider selected', {
  operation: 'email.configure',
  provider: env.EMAIL_PROVIDER,
});
