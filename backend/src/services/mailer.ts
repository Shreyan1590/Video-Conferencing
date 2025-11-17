import nodemailer from 'nodemailer';

import { ENV } from '../config/env';

let transporter: nodemailer.Transporter | null = null;
let isConfigured = false;

const getTransporter = async (): Promise<nodemailer.Transporter> => {
  if (transporter && isConfigured) return transporter;

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
    },
    // Add connection timeout
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
    socketTimeout: 10000
  });

  // Verify connection configuration before returning
  try {
    await new Promise<void>((resolve, reject) => {
      transporter!.verify((error) => {
        if (error) {
          // eslint-disable-next-line no-console
          console.error('SMTP connection verification failed:', {
            message: error.message,
            code: (error as any).code,
            command: (error as any).command,
            response: (error as any).response,
            responseCode: (error as any).responseCode
          });
          isConfigured = false;
          reject(error);
        } else {
          // eslint-disable-next-line no-console
          console.log('✅ SMTP server is ready to send emails');
          // eslint-disable-next-line no-console
          console.log(`   Host: ${ENV.MAIL_HOST}:${ENV.MAIL_PORT}`);
          // eslint-disable-next-line no-console
          console.log(`   User: ${ENV.MAIL_USER}`);
          isConfigured = true;
          resolve();
        }
      });
    });
  } catch (error) {
    isConfigured = false;
    throw error;
  }

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

    // eslint-disable-next-line no-console
    console.log(`📧 Attempting to send OTP email to: ${to}`);

    const t = await getTransporter();

    const mailOptions = {
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
    };

    // eslint-disable-next-line no-console
    console.log(`📤 Sending email via ${ENV.MAIL_HOST}:${ENV.MAIL_PORT}...`);

    const info = await t.sendMail(mailOptions);

    // eslint-disable-next-line no-console
    console.log('✅ Email sent successfully!', {
      messageId: info.messageId,
      response: info.response,
      accepted: info.accepted,
      rejected: info.rejected,
      pending: info.pending
    });

    if (info.rejected && info.rejected.length > 0) {
      // eslint-disable-next-line no-console
      console.error('❌ Email was rejected:', info.rejected);
      throw new Error(`Email rejected: ${info.rejected.join(', ')}`);
    }

    return info;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const errorDetails = err instanceof Error ? err.stack : String(err);
    const errorCode = (err as any)?.code;
    const errorCommand = (err as any)?.command;
    const errorResponse = (err as any)?.response;
    const errorResponseCode = (err as any)?.responseCode;
    
    // eslint-disable-next-line no-console
    console.error('❌ Failed to send OTP email:', {
      to,
      error: errorMessage,
      code: errorCode,
      command: errorCommand,
      response: errorResponse,
      responseCode: errorResponseCode,
      details: errorDetails,
      mailConfig: {
        host: ENV.MAIL_HOST,
        port: ENV.MAIL_PORT,
        secure: ENV.MAIL_SECURE,
        user: ENV.MAIL_USER ? `${ENV.MAIL_USER.substring(0, 3)}***` : 'NOT SET',
        passSet: !!ENV.MAIL_PASS
      }
    });
    
    // Fallback: log the OTP for development
    // eslint-disable-next-line no-console
    console.log(`[FALLBACK] OTP for ${to}: ${otp}`);
    
    // Re-throw the error so the calling code knows it failed
    throw err;
  }
};


