import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (!env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ?? 587,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

export async function sendEmail(to: string, subject: string, html: string) {
  const tx = getTransporter();
  if (!tx) {
    logger.info('Email skipped (no SMTP)', { to, subject });
    return;
  }
  await tx.sendMail({ from: env.EMAIL_FROM, to, subject, html });
}
