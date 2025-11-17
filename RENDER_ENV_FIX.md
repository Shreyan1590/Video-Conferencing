# Fix Your Render Environment Variables

## Issues Found and How to Fix

### 1. ❌ JWT_SECRET - CRITICAL FIX NEEDED

**Current Value**: `openssl rand -base64 32`  
**Problem**: This is the command, not the actual secret!

**Fix**:
1. Generate a real JWT secret. You can:
   - Run in terminal: `openssl rand -base64 32` (copy the output)
   - Or use online generator: https://generate-secret.vercel.app/32
   - Or use: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

2. Update in Render:
   - Go to Environment Variables
   - Change `JWT_SECRET` to the generated string (e.g., `aB3xK9mP2qR7vT1wY5zA8bC4dE6fG0hI3jK5lM8nO2pQ`)

### 2. ⚠️ MAIL_PASS - Remove Spaces

**Current Value**: `hbvy ncdb sijn ylls`  
**Problem**: Gmail app passwords should not have spaces

**Fix**:
- Change to: `hbvyncdbsijnylls` (remove all spaces)
- Or if your app password actually has spaces, keep them but ensure they're preserved correctly

### 3. ⚠️ CORS_ORIGIN - Remove Trailing Slash

**Current Value**: `https://proveloce-meet.vercel.app/`  
**Problem**: Trailing slash can cause CORS issues

**Fix**:
- Change to: `https://proveloce-meet.vercel.app` (no trailing slash)

## Updated Environment Variables

Here's what your environment variables should look like:

```
NODE_ENV=production
PORT=(leave empty - Render auto-assigns)
MONGODB_URI=mongodb+srv://cliqtrix_proveloce:Kanchijiljil%402025@cliqtrixcluster.krqrdwc.mongodb.net/cliqtrix?rotrudritos-truckm-maioritus.annName-CliatrisCluster
MONGODB_DB_NAME=cliqtrix
JWT_SECRET=<your-generated-secret-here>  ⚠️ FIX THIS
CORS_ORIGIN=https://proveloce-meet.vercel.app  ⚠️ Remove trailing slash
MAIL_USER=developers@proveloce.com
MAIL_PASS=hbvyncdbsijnylls  ⚠️ Remove spaces
MAIL_HOST=smtp.gmail.com
MAIL_PORT=465
MAIL_SECURE=true
```

## Steps to Fix in Render

1. **Go to Render Dashboard** → Your Backend Service
2. **Click "Environment"** tab
3. **Update these variables**:
   - `JWT_SECRET`: Generate and paste the actual secret (not the command)
   - `MAIL_PASS`: Remove spaces → `hbvyncdbsijnylls`
   - `CORS_ORIGIN`: Remove trailing slash → `https://proveloce-meet.vercel.app`
4. **Save Changes**
5. **Redeploy** your service

## After Fixing

1. **Check Logs** for:
   - ✅ `SMTP server is ready to send emails` (email working)
   - ✅ `Backend listening on port XXXX` (server started)

2. **Test Email**:
   - Try sending an OTP
   - Check logs for "Email sent successfully"
   - If you see errors, check the detailed error message in logs

## Quick Generate JWT Secret

If you have Node.js installed locally:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Or use this online: https://generate-secret.vercel.app/32

Copy the output and paste it as your `JWT_SECRET` value.

