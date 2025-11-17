# Step-by-Step Guide: Deploy Backend to Render

## Prerequisites

1. ✅ Your code is pushed to GitHub: `https://github.com/Shreyan1590/Video-Conferencing`
2. ✅ You have a MongoDB database (MongoDB Atlas or Render MongoDB)
3. ✅ You have a Render account (sign up at https://render.com)

---

## Step 1: Create a New Web Service in Render

1. **Log in to Render Dashboard**
   - Go to https://dashboard.render.com
   - Sign in with your GitHub account

2. **Create New Web Service**
   - Click **"New +"** button (top right)
   - Select **"Web Service"**

3. **Connect Your Repository**
   - Click **"Connect account"** if you haven't connected GitHub
   - Select your repository: `Shreyan1590/Video-Conferencing`
   - Click **"Connect"**

---

## Step 2: Configure Basic Settings

Fill in the following:

- **Name**: `video-conferencing-backend` (or any name you prefer)
- **Region**: Choose closest to your users (e.g., `Oregon (US West)`)
- **Branch**: `main` (or your default branch)
- **Root Directory**: `backend` ⚠️ **IMPORTANT: This must be `backend`**
- **Runtime**: `Node`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`

---

## Step 3: Configure Environment Variables

Click on **"Environment"** tab and add these variables:

### Required Variables:

1. **NODE_ENV**
   - Key: `NODE_ENV`
   - Value: `production`

2. **PORT**
   - Key: `PORT`
   - Value: Leave empty (Render will auto-assign)

3. **MONGODB_URI**
   - Key: `MONGODB_URI`
   - Value: Your MongoDB connection string
   - Example: `mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority`

4. **MONGODB_DB_NAME**
   - Key: `MONGODB_DB_NAME`
   - Value: `cliqtrix_video` (or your preferred database name)

5. **JWT_SECRET**
   - Key: `JWT_SECRET`
   - Value: Generate a strong random string (e.g., use: `openssl rand -base64 32`)
   - ⚠️ **Keep this secret!**

6. **CORS_ORIGIN**
   - Key: `CORS_ORIGIN`
   - Value: Your frontend URL (e.g., `https://your-frontend.onrender.com` or `http://localhost:5173` for local dev)

### Optional Variables (for email features):

7. **MAIL_USER**
   - Key: `MAIL_USER`
   - Value: Your email address (if using email features)

8. **MAIL_PASS**
   - Key: `MAIL_PASS`
   - Value: Your email app password (if using email features)

9. **MAIL_HOST**
   - Key: `MAIL_HOST`
   - Value: `smtp.gmail.com` (default, or your SMTP host)

10. **MAIL_PORT**
    - Key: `MAIL_PORT`
    - Value: `465` (default)

11. **MAIL_SECURE**
    - Key: `MAIL_SECURE`
    - Value: `true` (default)

---

## Step 4: Advanced Settings (Optional)

1. **Auto-Deploy**: Keep enabled (deploys on every push to `main`)
2. **Health Check Path**: `/api/health` (your backend has this endpoint)
3. **Instance Type**: 
   - **Free tier**: `Free` (512 MB RAM)
   - **Paid tier**: `Starter` or higher for better performance

---

## Step 5: Deploy

1. **Review Settings**
   - Double-check:
     - ✅ Root Directory: `backend`
     - ✅ Build Command: `npm install && npm run build`
     - ✅ Start Command: `npm start`
     - ✅ All environment variables are set

2. **Create Service**
   - Click **"Create Web Service"** at the bottom
   - Render will start building and deploying

3. **Monitor Deployment**
   - Watch the build logs in real-time
   - Build should:
     1. Install all dependencies (including TypeScript)
     2. Run `npm run build` to compile TypeScript
     3. Start the server with `npm start`

---

## Step 6: Verify Deployment

1. **Check Build Logs**
   - Look for: `Backend listening on port XXXX`
   - No errors should appear

2. **Test Health Endpoint**
   - Your service URL will be: `https://video-conferencing-backend.onrender.com`
   - Test: `https://video-conferencing-backend.onrender.com/api/health`
   - Should return: `{"status":"ok"}`

3. **Check Service Status**
   - Status should be **"Live"** (green)

---

## Troubleshooting

### ❌ Error: "Cannot find module 'dist/server.js'"
**Solution**: 
- Verify Root Directory is set to `backend`
- Verify Build Command includes `npm run build`
- Check build logs to ensure TypeScript compiled successfully

### ❌ Error: "MongoDB connection failed"
**Solution**:
- Verify `MONGODB_URI` is correct
- Check MongoDB Atlas IP whitelist (add `0.0.0.0/0` to allow all IPs)
- Verify database credentials are correct

### ❌ Build fails with TypeScript errors
**Solution**:
- Check build logs for specific TypeScript errors
- Fix errors locally, commit, and push
- Render will auto-redeploy

### ❌ Service keeps restarting
**Solution**:
- Check logs for runtime errors
- Verify all environment variables are set correctly
- Check MongoDB connection

### ❌ CORS errors from frontend
**Solution**:
- Update `CORS_ORIGIN` environment variable with your frontend URL
- Include protocol: `https://your-frontend.onrender.com` (not just domain)

---

## Quick Reference: Render Settings Summary

```
Name: video-conferencing-backend
Root Directory: backend
Build Command: npm install && npm run build
Start Command: npm start
Node Version: 22.16.0 (or latest)
```

---

## Environment Variables Checklist

- [ ] `NODE_ENV=production`
- [ ] `PORT` (auto-set by Render)
- [ ] `MONGODB_URI` (your MongoDB connection string)
- [ ] `MONGODB_DB_NAME=cliqtrix_video`
- [ ] `JWT_SECRET` (strong random string)
- [ ] `CORS_ORIGIN` (your frontend URL)
- [ ] `MAIL_USER` (optional)
- [ ] `MAIL_PASS` (optional)
- [ ] `MAIL_HOST` (optional, default: smtp.gmail.com)
- [ ] `MAIL_PORT` (optional, default: 465)
- [ ] `MAIL_SECURE` (optional, default: true)

---

## Next Steps

1. ✅ Backend deployed and running
2. 🔄 Deploy frontend (separate service or static site)
3. 🔗 Update frontend API URLs to point to Render backend
4. 🧪 Test the full application

---

## Support

If you encounter issues:
1. Check Render logs (in dashboard)
2. Verify all settings match this guide
3. Test locally first: `cd backend && npm install && npm run build && npm start`

