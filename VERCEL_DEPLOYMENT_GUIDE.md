# Step-by-Step Guide: Deploy Frontend to Vercel

## Prerequisites

1. ✅ Your code is pushed to GitHub: `https://github.com/Shreyan1590/Video-Conferencing`
2. ✅ Backend is deployed and running (e.g., on Render)
3. ✅ You have a Vercel account (sign up at https://vercel.com - free)

---

## Step 1: Update Frontend Code for Production

Before deploying, we need to make the backend URL configurable. The frontend currently has hardcoded `localhost` URLs that need to be replaced with environment variables.

### Files to Update:

1. **`frontend/src/context/SocketContext.tsx`** - Update Socket.IO connection
2. **`frontend/src/services/api.ts`** - Already uses relative URLs (good!)

---

## Step 2: Create Vercel Account & Connect GitHub

1. **Sign Up / Log In**
   - Go to https://vercel.com
   - Click **"Sign Up"** or **"Log In"**
   - Use **"Continue with GitHub"** (recommended)

2. **Import Project**
   - Click **"Add New..."** → **"Project"**
   - Click **"Import Git Repository"**
   - Select your repository: `Shreyan1590/Video-Conferencing`
   - Click **"Import"**

---

## Step 3: Configure Project Settings

### Basic Configuration:

1. **Project Name**: `video-conferencing-frontend` (or your preferred name)

2. **Framework Preset**: 
   - Select **"Vite"** (Vercel should auto-detect this)

3. **Root Directory**: 
   - Click **"Edit"** next to Root Directory
   - Set to: `frontend` ⚠️ **IMPORTANT**

4. **Build and Output Settings**:
   - **Build Command**: `npm run build` (default, should auto-detect)
   - **Output Directory**: `dist` (default for Vite)
   - **Install Command**: `npm install` (default)

---

## Step 4: Configure Environment Variables

Click on **"Environment Variables"** and add:

### Required Variables:

1. **Backend API URL**
   - Key: `VITE_API_URL`
   - Value: Your Render backend URL
   - Example: `https://video-conferencing-backend.onrender.com`
   - ⚠️ **No trailing slash**

2. **Socket.IO Server URL**
   - Key: `VITE_SOCKET_URL`
   - Value: Same as API URL (your Render backend)
   - Example: `https://video-conferencing-backend.onrender.com`
   - ⚠️ **No trailing slash**

### Optional Variables (for WebRTC):

3. **TURN Server URL** (if using TURN for WebRTC)
   - Key: `VITE_TURN_URL`
   - Value: Your TURN server URL (if applicable)

---

## Step 5: Configure Vercel Rewrites (for API Proxy)

Since your frontend uses relative `/api` paths, you may want to proxy API requests through Vercel to avoid CORS issues.

1. **Create `vercel.json`** in the `frontend` directory:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://your-backend-url.onrender.com/api/:path*"
    },
    {
      "source": "/socket.io/:path*",
      "destination": "https://your-backend-url.onrender.com/socket.io/:path*"
    }
  ]
}
```

**OR** (Recommended): Update your code to use the environment variable directly (see Step 1 updates).

---

## Step 6: Deploy

1. **Review Settings**
   - ✅ Root Directory: `frontend`
   - ✅ Build Command: `npm run build`
   - ✅ Output Directory: `dist`
   - ✅ Environment variables are set

2. **Deploy**
   - Click **"Deploy"** button
   - Vercel will:
     1. Install dependencies
     2. Run `npm run build`
     3. Deploy the `dist` folder

3. **Monitor Deployment**
   - Watch build logs in real-time
   - Build should complete successfully

---

## Step 7: Verify Deployment

1. **Check Deployment Status**
   - Status should be **"Ready"** (green)
   - Your app will be live at: `https://your-project-name.vercel.app`

2. **Test the Application**
   - Open your Vercel URL in a browser
   - Test login/registration
   - Test video conferencing features
   - Check browser console for errors

3. **Check Network Tab**
   - Verify API calls are going to your Render backend
   - Verify Socket.IO connection is established

---

## Step 8: Configure Custom Domain (Optional)

1. **Add Domain**
   - Go to Project Settings → **"Domains"**
   - Enter your domain (e.g., `app.yourdomain.com`)
   - Follow DNS configuration instructions

2. **SSL Certificate**
   - Vercel automatically provisions SSL certificates
   - Wait for DNS propagation (can take a few minutes)

---

## Troubleshooting

### ❌ Error: "Cannot find module" or build fails
**Solution**: 
- Verify Root Directory is set to `frontend`
- Check that `package.json` exists in `frontend` directory
- Review build logs for specific errors

### ❌ API calls failing / CORS errors
**Solution**:
- Verify `VITE_API_URL` environment variable is set correctly
- Check backend CORS settings include your Vercel domain
- Update backend `CORS_ORIGIN` to include: `https://your-project.vercel.app`

### ❌ Socket.IO connection fails
**Solution**:
- Verify `VITE_SOCKET_URL` is set correctly
- Check backend Socket.IO CORS settings
- Ensure WebSocket connections are allowed (Vercel supports this)

### ❌ 404 errors on page refresh
**Solution**:
- Add `vercel.json` with rewrites (see Step 5)
- Or configure Vercel to handle SPA routing:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### ❌ Environment variables not working
**Solution**:
- Vite requires `VITE_` prefix for environment variables
- Rebuild after adding environment variables
- Check that variables are set for **Production**, **Preview**, and **Development** environments

---

## Quick Reference: Vercel Settings Summary

```
Project Name: video-conferencing-frontend
Root Directory: frontend
Framework: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

---

## Environment Variables Checklist

- [ ] `VITE_API_URL` = Your Render backend URL
- [ ] `VITE_SOCKET_URL` = Your Render backend URL (same as API URL)
- [ ] `VITE_TURN_URL` = TURN server URL (optional, for WebRTC)

---

## Post-Deployment Checklist

1. ✅ Frontend deployed and accessible
2. ✅ Environment variables configured
3. ✅ Backend CORS updated to include Vercel domain
4. ✅ Test login/registration
5. ✅ Test video conferencing
6. ✅ Test Socket.IO real-time features
7. ✅ Custom domain configured (if applicable)

---

## Updating Backend CORS

After deploying frontend, update your Render backend environment variable:

1. Go to Render Dashboard → Your Backend Service
2. Go to **Environment** tab
3. Update `CORS_ORIGIN`:
   - Add your Vercel URL: `https://your-project.vercel.app`
   - Or use: `https://your-project.vercel.app,http://localhost:5173` (for both prod and dev)
4. Save and redeploy backend

---

## Next Steps

1. ✅ Frontend deployed on Vercel
2. ✅ Backend deployed on Render
3. 🔗 Both services connected and working
4. 🧪 Full application testing
5. 🚀 Production ready!

---

## Support

If you encounter issues:
1. Check Vercel build logs
2. Check browser console for errors
3. Verify all environment variables are set
4. Test backend API directly: `https://your-backend.onrender.com/api/health`

