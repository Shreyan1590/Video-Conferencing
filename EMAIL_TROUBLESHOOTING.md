# Email Troubleshooting Guide

## Check Render Logs First

After deploying the updated code, check your Render logs when sending an OTP. You should see detailed information about what's happening.

### What to Look For:

1. **On Server Start:**
   - ✅ `✅ SMTP server is ready to send emails` = Connection successful
   - ❌ `SMTP connection verification failed` = Connection problem

2. **When Sending OTP:**
   - ✅ `📧 Attempting to send OTP email to: <email>`
   - ✅ `📤 Sending email via smtp.gmail.com:465...`
   - ✅ `✅ Email sent successfully!` with messageId
   - ❌ `❌ Failed to send OTP email:` with error details

## Common Issues and Solutions

### 1. ❌ "Invalid login: 535-5.7.8 Username and Password not accepted"

**Problem**: Gmail app password is incorrect or has spaces

**Solution**:
- Go to https://myaccount.google.com/apppasswords
- Generate a NEW app password
- Copy the 16-character password (NO SPACES)
- In Render, set `MAIL_PASS` = the password without spaces
- Example: `hbvyncdbsijnylls` (not `hbvy ncdb sijn ylls`)

### 2. ❌ "Connection timeout" or "ECONNREFUSED"

**Problem**: SMTP server connection failing

**Solution**:
- Verify `MAIL_HOST` = `smtp.gmail.com`
- Verify `MAIL_PORT` = `465`
- Verify `MAIL_SECURE` = `true`
- Check if Render's network allows outbound SMTP connections

### 3. ✅ Email "sent" but not received

**Possible causes:**

#### A. Email in Spam Folder
- Check the recipient's spam/junk folder
- Gmail might mark automated emails as spam initially

#### B. Email Address Typo
- Verify the email address is correct
- Check logs for the exact email address being sent to

#### C. Gmail Rate Limiting
- Gmail has sending limits (500 emails/day for free accounts)
- If you've sent many emails, wait a few hours

#### D. Email Rejected by Server
- Check logs for `rejected` array in the response
- Common reasons:
  - Invalid email address
  - Domain doesn't exist
  - Mailbox full

### 4. ❌ "SMTP connection verification failed"

**Check the error details in logs:**
- `code`: Error code (e.g., `EAUTH`, `ETIMEDOUT`)
- `command`: SMTP command that failed
- `response`: Server response message

**Common fixes:**
- Verify app password is correct (regenerate if needed)
- Ensure 2-Step Verification is enabled
- Check if Gmail account is locked or restricted

### 5. ❌ "EAUTH" Error

**Problem**: Authentication failed

**Solution**:
1. Verify `MAIL_USER` = your full Gmail address (e.g., `developers@proveloce.com`)
2. Verify `MAIL_PASS` = 16-character app password (no spaces)
3. Make sure 2-Step Verification is enabled
4. Regenerate app password if still failing

## Step-by-Step Debugging

### Step 1: Check Environment Variables in Render

Verify these are set correctly:
```
MAIL_USER=developers@proveloce.com
MAIL_PASS=hbvyncdbsijnylls  (NO SPACES!)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=465
MAIL_SECURE=true
```

### Step 2: Check Render Logs on Startup

Look for:
```
✅ SMTP server is ready to send emails
   Host: smtp.gmail.com:465
   User: developers@proveloce.com
```

If you see an error here, fix it before trying to send emails.

### Step 3: Try Sending OTP and Check Logs

Look for:
```
📧 Attempting to send OTP email to: user@example.com
📤 Sending email via smtp.gmail.com:465...
✅ Email sent successfully! { messageId: '...', accepted: [...], rejected: [] }
```

### Step 4: Check Email Delivery

1. **Check Inbox** - Wait 1-2 minutes
2. **Check Spam/Junk** - Gmail might mark it as spam
3. **Check Logs** - Look for `rejected` array in the response

## Quick Test Checklist

- [ ] `MAIL_USER` is set to full email address
- [ ] `MAIL_PASS` is set to 16-character app password (NO SPACES)
- [ ] `MAIL_HOST` = `smtp.gmail.com`
- [ ] `MAIL_PORT` = `465`
- [ ] `MAIL_SECURE` = `true`
- [ ] 2-Step Verification enabled on Gmail account
- [ ] App password generated (not regular password)
- [ ] Backend redeployed after setting variables
- [ ] Checked Render logs for SMTP verification message
- [ ] Checked spam folder for test email

## Alternative: Use a Different Email Service

If Gmail continues to cause issues, consider:

1. **SendGrid** (Free: 100 emails/day)
   ```
   MAIL_HOST=smtp.sendgrid.net
   MAIL_PORT=587
   MAIL_SECURE=false
   MAIL_USER=apikey
   MAIL_PASS=<your-sendgrid-api-key>
   ```

2. **Mailgun** (Free: 5,000 emails/month)
   ```
   MAIL_HOST=smtp.mailgun.org
   MAIL_PORT=587
   MAIL_SECURE=false
   MAIL_USER=<your-mailgun-smtp-user>
   MAIL_PASS=<your-mailgun-smtp-password>
   ```

3. **Resend** (Modern, developer-friendly)
   - Requires code changes (not just SMTP config)

## Next Steps

1. **Deploy the updated code** with better logging
2. **Check Render logs** when sending OTP
3. **Look for the specific error** in the detailed logs
4. **Fix the issue** based on the error message
5. **Test again** and verify email delivery

The improved logging will show you exactly what's failing!

