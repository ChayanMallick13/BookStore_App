import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmailSender } from '../services/emailService.js';
import { logger } from '../utils/logger.js';

const message = {
  to: 'reader@example.com',
  subject: 'Test message',
  html: '<p>Hello</p>',
};

describe('email provider selection and failures', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses the injected SMTP sender when SMTP is selected', async () => {
    const smtpSend = vi.fn().mockResolvedValue('smtp-message-id');
    const send = createEmailSender({
      provider: 'smtp',
      nodeEnv: 'development',
      smtpHost: 'smtp.example.com',
      from: 'Books Bin <verified@example.com>',
    }, { smtpSend });

    await expect(send(message)).resolves.toMatchObject({
      status: 'accepted',
      provider: 'smtp',
      messageId: 'smtp-message-id',
    });
    expect(smtpSend).toHaveBeenCalledWith(expect.objectContaining({ smtpHost: 'smtp.example.com' }), message);
  });

  it('sends through the Resend HTTPS API when selected', async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(
      JSON.stringify({ id: 'resend-message-id' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));
    const send = createEmailSender({
      provider: 'resend',
      nodeEnv: 'production',
      resendApiKey: 'resend-test-key',
      from: 'Books Bin <verified@example.com>',
    }, { fetcher });

    await expect(send(message)).resolves.toMatchObject({
      status: 'accepted',
      provider: 'resend',
      messageId: 'resend-message-id',
    });
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer resend-test-key' }),
      }),
    );
  });

  it('returns an actionable provider error and does not log the recipient or API key', async () => {
    const errorLog = vi.spyOn(logger, 'error').mockImplementation(() => logger);
    const fetcher = vi.fn(async () => new Response('{"message":"recipient rejected"}', { status: 422 }));
    const send = createEmailSender({
      provider: 'resend',
      nodeEnv: 'production',
      resendApiKey: 'private-test-key',
      from: 'Books Bin <verified@example.com>',
    }, { fetcher });

    await expect(send(message)).rejects.toMatchObject({
      statusCode: 503,
      code: 'EMAIL_DELIVERY_FAILED',
      provider: 'resend',
      providerCode: 'HTTP_422',
    });
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain('reader@example.com');
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain('private-test-key');
  });

  it('fails clearly when a selected provider is not configured', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => logger);
    const send = createEmailSender({
      provider: 'resend',
      nodeEnv: 'production',
      from: 'Books Bin <verified@example.com>',
    });

    await expect(send(message)).rejects.toMatchObject({
      statusCode: 503,
      code: 'EMAIL_NOT_CONFIGURED',
    });
  });

  it('identifies email API timeouts without logging message content', async () => {
    const errorLog = vi.spyOn(logger, 'error').mockImplementation(() => logger);
    const timeout = Object.assign(new Error('request timed out'), { code: 'ETIMEDOUT' });
    const fetcher = vi.fn(async () => {
      throw timeout;
    });
    const send = createEmailSender({
      provider: 'resend',
      nodeEnv: 'production',
      resendApiKey: 'private-test-key',
      from: 'Books Bin <verified@example.com>',
    }, { fetcher });

    await expect(send(message)).rejects.toMatchObject({
      providerCode: 'ETIMEDOUT',
      provider: 'resend',
    });
    expect(JSON.stringify(errorLog.mock.calls)).toContain('ETIMEDOUT');
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain('reader@example.com');
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain('private-test-key');
  });
});
