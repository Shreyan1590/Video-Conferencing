# Email Setup Guide - Troubleshooting Mail Not Sending

## Common Issues and Solutions

### 1. Environment Variables Not Set

**Problem**: `MAIL_USER` or `MAIL_PASS` environment variables are not configured.

**Solution**: 
- Go to your Render dashboard → Backend Service → Environment
- Add the following environment variables:
  - `MAIL_USER` = Your email address
  - `MAIL_PASS` = Your email app password (see below)
  - `MAIL_HOST` = `smtp.gmail.com` (for Gmail)
  - `MAIL_PORT` = `465`
  - `MAIL_SECURE` = `true`

### 2. Gmail App Password Setup

**Problem**: Gmail requires an "App Password" instead of your regular password.

**Steps to create Gmail App Password:**

1. **Enable 2-Step Verification** (if not already enabled):
   - Go to https://myaccount.google.com/security
   - Enable "2-Step Verification"

2. **Create App Password**:
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Enter name: "Cliqtrix Backend"
   - Click "Generate"
   - Copy the 16-character password (no spaces)

3. **Use in Render**:
   - Set `MAIL_PASS` = the 16-character app password (not your regular Gmail password)

### 3. Other Email Providers

#### Outlook/Hotmail
```
MAIL_HOST=smtp-mail.outlook.com
MAIL_PORT=587
MAIL_SECURE=false
```

#### Yahoo Mail
```
MAIL_HOST=smtp.mail.yahoo.com
MAIL_PORT=465
MAIL_SECURE=true
```

#### Custom SMTP Server
```
MAIL_HOST=your-smtp-server.com
MAIL_PORT=465 (or 587)
MAIL_SECURE=true (for 465) or false (for 587)
```

### 4. Check Server Logs

After updating environment variables, check your Render logs:

1. Go to Render Dashboard → Your Backend Service
2. Click on "Logs" tab
3. Look for:
   - ✅ `SMTP server is ready to send emails` (success)
   - ❌ `SMTP connection verification failed` (error)
   - ❌ `MAIL_USER or MAIL_PASS not set` (missing config)

### 5. Test Email Configuration

The improved mailer service now:
- ✅ Verifies SMTP connection on startup
- ✅ Logs detailed error messages
- ✅ Shows configuration status in logs
- ✅ Provides fallback OTP logging for development

### 6. Common Error Messages

#### "Invalid login: 535-5.7.8 Username and Password not accepted"
**Solution**: 
- Use App Password, not regular password
- Make sure 2-Step Verification is enabled

#### "Connection timeout"
**Solution**:
- Check `MAIL_HOST` is correct
- Check `MAIL_PORT` is correct (465 for SSL, 587 for TLS)
- Check firewall/network settings

#### "MAIL_USER or MAIL_PASS not set"
**Solution**:
- Verify environment variables are set in Render
- Make sure variable names are exact: `MAIL_USER` and `MAIL_PASS`
- Redeploy after adding variables

### 7. Development vs Production

**Development (Local)**:
- Create `.env` file in `backend/` directory:
```env
MAIL_USER=your-email@gmail.com
MAIL_PASS=your-app-password
MAIL_HOST=smtp.gmail.com
MAIL_PORT=465
MAIL_SECURE=true
```

**Production (Render)**:
- Set environment variables in Render dashboard
- No `.env` file needed
- Variables are automatically available to the app

### 8. Security Best Practices

1. **Never commit `.env` files** to Git
2. **Use App Passwords** instead of regular passwords
3. **Rotate passwords** regularly
4. **Use environment variables** in production (not hardcoded)

### 9. Alternative: Use Email Service Providers

If SMTP is too complex, consider using:
- **SendGrid** (free tier: 100 emails/day)
- **Mailgun** (free tier: 5,000 emails/month)
- **AWS SES** (very cheap, pay-as-you-go)
- **Resend** (modern, developer-friendly)

### 10. Debugging Steps

1. **Check Environment Variables**:
   ```bash
   # In Render logs, you should see (with masked email):
   # mailConfig: { host: 'smtp.gmail.com', port: 465, secure: true, user: 'you***' }
   ```

2. **Check SMTP Verification**:
   - Look for "SMTP server is ready to send emails" in startup logs
   - If you see "SMTP connection verification failed", check credentials

3. **Check Email Sending**:
   - Look for "Email sent successfully: <messageId>" in logs
   - If you see "Failed to send OTP email", check the error details

4. **Test with Fallback**:
   - If email fails, check logs for `[FALLBACK] OTP for <email>: <otp>`
   - This means OTP was generated but email failed

### 11. Quick Checklist

- [ ] `MAIL_USER` environment variable set in Render
- [ ] `MAIL_PASS` environment variable set (using App Password for Gmail)
- [ ] `MAIL_HOST` set correctly for your provider
- [ ] `MAIL_PORT` set correctly (465 for SSL, 587 for TLS)
- [ ] `MAIL_SECURE` set correctly (true for 465, false for 587)
- [ ] 2-Step Verification enabled (for Gmail)
- [ ] App Password generated and used (for Gmail)
- [ ] Backend service redeployed after adding variables
- [ ] Checked Render logs for SMTP verification message

---

## Need More Help?

1. Check Render logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test with a different email provider
4. Consider using a dedicated email service (SendGrid, Mailgun, etc.)

