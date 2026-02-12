# Netlify Deployment Guide for Global Storage Sync

This guide explains how to deploy R.O.B.B.E. Scouting to Netlify with global storage synchronization working.

## Overview

The application has been updated to support Netlify deployment. The main changes:
- **storageSync.js** now supports both SSE (Server-Sent Events) and polling modes
- **netlify.toml** provides the necessary configuration
- Multiple backend options are available

## Deployment Options

### Option 1: Netlify + External Node.js Server (Recommended for existing setup)

Keep your current Node.js server running somewhere and just deploy the static files to Netlify.

#### Setup Steps:

1. **Deploy static files to Netlify:**
   - Connect your GitHub repo to Netlify (https://app.netlify.com)
   - Set publish directory to `.`
   - Deploy

2. **Keep your Node.js server running:**
   - Run on Heroku, Railway, Render, Fly.io, or anywhere else
   - Get the public URL (e.g., `https://my-server.herokuapp.com`)

3. **Configure the API endpoint:**
   Add this to your `index.html` before loading storageSync.js:
   ```html
   <script>
     window.STORAGE_API_URL = 'https://my-server.herokuapp.com/api';
   </script>
   ```

4. **Done!** Global sync will work using SSE with your existing server.

---

### Option 2: Netlify + Firebase Realtime Database (Serverless)

Use Firebase as your backend for a fully serverless setup.

#### Setup Steps:

1. **Create a Firebase project:**
   - Go to https://console.firebase.google.com
   - Click "Add Project" and follow the steps
   - Enable Realtime Database

2. **Install Firebase SDK in your app:**
   ```bash
   npm install firebase
   ```

3. **Create a Firebase adapter:**
   
   Create `firebaseStorageAdapter.js` in your project:
   ```javascript
   // Initialize Firebase
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_PROJECT.firebaseapp.com",
     databaseURL: "https://YOUR_PROJECT.firebaseio.com",
     projectId: "YOUR_PROJECT",
     storageBucket: "YOUR_PROJECT.appspot.com",
     messagingSenderId: "YOUR_SENDER_ID",
     appId: "YOUR_APP_ID"
   };
   
   firebase.initializeApp(firebaseConfig);
   const db = firebase.database();
   
   // Override storageSync to use Firebase
   const storageSync = {
     init: async function(options) {
       console.log('Using Firebase Realtime Database');
     },
     setKey: async function(key, value) {
       await db.ref('storage/' + key).set(value);
       return { key, value };
     },
     getKey: async function(key) {
       const snap = await db.ref('storage/' + key).once('value');
       return snap.val();
     },
     getAll: async function() {
       const snap = await db.ref('storage').once('value');
       return snap.val() || {};
     },
     onUpdate: null
   };
   ```

4. **Deploy to Netlify and use Firebase backend.**

---

### Option 3: Netlify Functions + External Database (Advanced)

For a completely serverless architecture on Netlify using their functions feature with an external database.

#### What you need:
- Netlify Functions (already configured in netlify.toml)
- A database service:
  - MongoDB Atlas (free tier available)
  - Supabase (PostgreSQL + real-time)
  - DynamoDB
  - Firebase

#### The netlify.toml already redirects `/api/*` to `/.netlify/functions/api/*`

To use this approach:
1. Create `.netlify/functions/api.js` to handle storage endpoints
2. Connect to your chosen database
3. Deploy to Netlify

---

## Quick Start: Option 1 (Recommended)

This is the easiest for existing setups:

1. **Update your Node.js server's CORS settings** (in `server.js`):
   ```javascript
   // Add after the server creation
   app.use((req, res, next) => {
     res.header('Access-Control-Allow-Origin', '*');
     res.header('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
     res.header('Access-Control-Allow-Headers', 'Content-Type');
     if (req.method === 'OPTIONS') res.sendStatus(200);
     else next();
   });
   ```

2. **Add to your `index.html`** (before storageSync.js):
   ```html
   <script>
     // Point to your server running elsewhere
     window.STORAGE_API_URL = 'https://your-server-url.com/api';
   </script>
   ```

3. **Deploy static files to Netlify**
   - Push to GitHub
   - Connect to Netlify
   - All done!

---

## Configuration Variables

You can customize storageSync behavior by setting these in your HTML before loading the script:

```html
<script>
  // Override API endpoint (default: /api)
  window.STORAGE_API_URL = 'https://my-api.example.com/api';
  
  // Force polling mode instead of SSE (default: false)
  window.STORAGE_USE_POLLING = true;
  
  // Change polling interval in milliseconds (default: 2000)
  window.STORAGE_POLL_INTERVAL = 5000;
</script>
```

---

## Testing Locally

To test with Netlify locally:

```bash
npm install -g netlify-cli
netlify dev
```

This runs on `http://localhost:8888` and simulates your Netlify environment.

---

## Troubleshooting

### "API requests are failing"
- Check that the `STORAGE_API_URL` is correct
- Ensure your server enables CORS
- Check browser console for specific error messages

### "Updates aren't syncing"
- By default, Netlify Functions + polling mode is used
- Real-time updates are slower (2-5 second delay) vs SSE
- For real-time, use Option 1 (external server) or Firebase

### "CORS errors"
- Your API server needs to allow requests from your Netlify domain
- Add proper CORS headers to your Node.js server
- Or use a CORS proxy service

---

## What Changed

### storageSync.js
- Now supports both SSE and polling
- API endpoint is configurable
- Automatic fallback from SSE to polling if server is unreachable
- Added `stop()` method to cleanup

### netlify.toml
- New file for Netlify configuration
- Redirects `/api/*` to Netlify Functions
- Fallback routing for single-page app

### Configuration
- All changes are backward compatible
- Existing setups continue to work
- No code changes required in app.js or HTML files
