import nodemailer from 'nodemailer';

import { ENV } from '../config/env';

let transporter: nodemailer.Transporter | null = null;
let isConfigured = false;

const getTransporter = () => {
  if (transporter) return transporter;

  if (!ENV.MAIL_USER || !ENV.MAIL_PASS) {
    const errorMsg = 'MAIL_USER or MAIL_PASS not set; OTP emails will not be sent.';
    // eslint-disable-next-line no-console
    console.error(errorMsg);
    throw new Error(errorMsg);
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

  // Verify connection configuration
  transporter.verify((error) => {
    if (error) {
      // eslint-disable-next-line no-console
      console.error('SMTP connection verification failed:', error);
      isConfigured = false;
    } else {
      // eslint-disable-next-line no-console
      console.log('SMTP server is ready to send emails');
      isConfigured = true;
    }
  });

  return transporter;
};

export const sendOtpEmail = async (to: string, otp: string) => {
  try {
    // Check if mail is configured
    if (!ENV.MAIL_USER || !ENV.MAIL_PASS) {
      const errorMsg = 'Email service not configured. Please set MAIL_USER and MAIL_PASS environment variables.';
      // eslint-disable-next-line no-console
      console.error(errorMsg);
      // eslint-disable-next-line no-console
      console.log(`[FALLBACK] OTP for ${to}: ${otp}`);
      throw new Error(errorMsg);
    }

    const t = getTransporter();

    const info = await t.sendMail({
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

    // eslint-disable-next-line no-console
    console.log('Email sent successfully:', info.messageId);
    return info;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const errorDetails = err instanceof Error ? err.stack : String(err);
    
    // eslint-disable-next-line no-console
    console.error('Failed to send OTP email:', {
      to,
      error: errorMessage,
      details: errorDetails,
      mailConfig: {
        host: ENV.MAIL_HOST,
        port: ENV.MAIL_PORT,
        secure: ENV.MAIL_SECURE,
        user: ENV.MAIL_USER ? `${ENV.MAIL_USER.substring(0, 3)}***` : 'NOT SET'
      }
    });
    
    // Fallback: log the OTP for development
    // eslint-disable-next-line no-console
    console.log(`[FALLBACK] OTP for ${to}: ${otp}`);
    
    // Re-throw the error so the calling code knows it failed
    throw err;
  }
};


