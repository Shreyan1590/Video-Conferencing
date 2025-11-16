import nodemailer from 'nodemailer';

import { ENV } from '../config/env';

let transporter: nodemailer.Transporter | null = null;

const getTransporter = () => {
  if (transporter) return transporter;

  if (!ENV.MAIL_USER || !ENV.MAIL_PASS) {
    // eslint-disable-next-line no-console
    console.warn('MAIL_USER or MAIL_PASS not set; OTP emails will not be sent.');
    throw new Error('Mail transport not configured');
  }

  transporter = nodemailer.createTransport({
    host: ENV.MAIL_HOST,
    port: ENV.MAIL_PORT,
    secure: ENV.MAIL_SECURE,
    auth: {
      user: ENV.MAIL_USER,
      pass: ENV.MAIL_PASS
    }
  });

  return transporter;
};

export const sendOtpEmail = async (to: string, otp: string) => {
  try {
    const t = getTransporter();

    await t.sendMail({
      from: `"Cliqtrix - ProVeloce" <${ENV.MAIL_USER}>`,
      to,
      subject: 'Your Cliqtrix - ProVeloce verification code',
      text: `Your One-Time Password (OTP) to verify your email is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you did not request this, you can ignore this email.`,
      html: `<div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 16px;">
  <h2 style="margin-bottom: 12px;">Verify your email for Cliqtrix - ProVeloce</h2>
  <p style="margin: 0 0 12px;">Use the following One-Time Password (OTP) to complete your sign up:</p>
  <p style="font-size: 24px; font-weight: 600; letter-spacing: 0.2em; margin: 0 0 12px;">${otp}</p>
  <p style="margin: 0 0 8px;">This code will expire in <strong>10 minutes</strong>.</p>
  <p style="font-size: 12px; color: #6b7280; margin-top: 16px;">If you didn&apos;t request this, you can safely ignore this email.</p>
</div>`
    });
  } catch (err) {
    // Fallback: log the OTP but don't crash registration flow.
    // eslint-disable-next-line no-console
    console.error('Failed to send OTP email, falling back to console log:', err);
    // eslint-disable-next-line no-console
    console.log(`OTP for ${to}: ${otp}`);
  }
};


