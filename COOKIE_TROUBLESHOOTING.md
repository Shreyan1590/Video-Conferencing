# Cookie Authentication Troubleshooting Guide

If you're experiencing "Session verification failed" errors after login, the authentication cookie is likely not being set or sent correctly. This guide will help you diagnose and fix the issue.

## Symptoms

- Login appears successful but user is redirected back to login page
- Console shows multiple `401` errors on `/api/auth/me`
- Error message: "Session verification failed. The authentication cookie may not be set correctly."

## Root Cause

For cross-origin requests (frontend and backend on different domains), cookies require specific configuration:
1. `sameSite: 'none'` - Required for cross-origin cookies
2. `secure: true` - Required when `sameSite` is `'none'`
3. Both frontend and backend must use HTTPS
4. CORS must allow credentials
5. Browser must allow third-party cookies

## Step-by-Step Fix

### 1. Verify Render Environment Variables

In your Render dashboard, check these environment variables for your backend service:

#### `CORS_ORIGIN`
- **Must match your frontend URL exactly**
- No trailing slashes
- Include the protocol (`https://`)
- Example: `https://your-frontend.vercel.app`

**Common mistakes:**
- ❌ `https://your-frontend.vercel.app/` (trailing slash)
- ❌ `your-frontend.vercel.app` (missing protocol)
- ❌ `http://your-frontend.vercel.app` (HTTP instead of HTTPS)
- ✅ `https://your-frontend.vercel.app` (correct)

#### `JWT_SECRET`
- Must be a proper secret string (not a command)
- Generate one using: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
- Should be a long random string

**Common mistakes:**
- ❌ `node -e "console.log(...)"` (the command itself)
- ❌ `change_me_in_production` (default value)
- ✅ `swbSeU0O0jxwG/MSivfybz4T2RR5uHanv44sYmyxJlo=` (generated secret)

#### `NODE_ENV`
- Should be `production` for deployed backend

### 2. Verify Both URLs Use HTTPS

- ✅ Frontend: `https://your-frontend.vercel.app`
- ✅ Backend: `https://your-backend.onrender.com`
- ❌ If either uses HTTP, cookies with `secure: true` won't work

### 3. Check Browser Cookie Settings

Some browsers block third-party cookies by default:

#### Chrome/Edge
1. Go to `chrome://settings/cookies` (or `edge://settings/cookies`)
2. Ensure "Block third-party cookies" is **disabled** (for testing)
3. Or add your backend domain to "Sites that can always use cookies"

#### Firefox
1. Go to `about:preferences#privacy`
2. Under "Cookies and Site Data", uncheck "Block cookies and site data"

#### Safari
1. Safari → Preferences → Privacy
2. Uncheck "Prevent cross-site tracking"

**Note:** For production, you may want to use a subdomain approach (e.g., `api.yourdomain.com`) to avoid third-party cookie issues.

### 4. Test the Configuration

After updating environment variables in Render:

1. **Redeploy the backend** (Render will auto-deploy on env var changes, or trigger a manual deploy)

2. **Clear browser cookies** for your frontend domain:
   - Open DevTools (F12)
   - Application → Cookies
   - Delete all cookies for your frontend domain

3. **Test login again**

4. **Check backend logs** in Render:
   - Look for "Setting auth cookie" log messages
   - Look for "Auth middleware: No cookie found" messages
   - These will show if cookies are being set but not received

### 5. Verify Cookie is Being Set

After login, check the browser:

1. Open DevTools (F12)
2. Go to **Application** → **Cookies**
3. Look for `vc_token` cookie
4. Check its attributes:
   - **Domain**: Should match your backend domain (or be empty for cross-origin)
   - **Path**: `/`
   - **HttpOnly**: ✓ (checked)
   - **Secure**: ✓ (checked)
   - **SameSite**: `None`

If the cookie is not present, the backend isn't setting it correctly.

### 6. Verify Cookie is Being Sent

1. Open DevTools (F12)
2. Go to **Network** tab
3. Try to log in
4. Find the `/api/auth/me` request
5. Click on it
6. Check **Request Headers**:
   - Look for `Cookie: vc_token=...`
   - If missing, the browser isn't sending the cookie

### 7. Use the Debug Endpoint

The backend includes a debug endpoint to check configuration:

```
GET https://your-backend.onrender.com/api/auth/debug
```

This will show:
- Current CORS_ORIGIN setting
- Request origin from your browser
- Whether cookies are being received

Compare the `corsOrigin` with `requestOrigin` - they should match (or requestOrigin should be in the CORS_ORIGIN list if multiple origins are configured).

## Common Issues and Solutions

### Issue: Cookie is set but not sent on subsequent requests

**Solution:** 
- Verify `CORS_ORIGIN` matches frontend URL exactly
- Ensure `withCredentials: true` is set in frontend API client (already configured)
- Check browser isn't blocking third-party cookies

### Issue: Cookie is sent but backend returns 401

**Solution:**
- Verify `JWT_SECRET` is correct (same value used to sign and verify)
- Check backend logs for JWT verification errors
- Ensure token hasn't expired (8 hour expiry)

### Issue: Works locally but not in production

**Solution:**
- Local: Uses `http://localhost:5173` (no `secure: true`)
- Production: Must use HTTPS for both frontend and backend
- Verify `NODE_ENV=production` in Render

## Alternative: Use Subdomain Approach

If third-party cookies continue to be problematic, consider:

1. Use a subdomain for your API: `api.yourdomain.com`
2. Set cookie domain to `.yourdomain.com` (with leading dot)
3. This makes cookies first-party instead of third-party

## Still Having Issues?

1. Check Render logs for detailed error messages
2. Check browser console for CORS errors
3. Verify all environment variables are set correctly
4. Test with a different browser to rule out browser-specific issues
5. Check if your frontend build includes the correct `VITE_API_URL`

