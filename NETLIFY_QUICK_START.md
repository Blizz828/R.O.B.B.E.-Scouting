# Quick Start: Deploying to Netlify

## 3-Minute Setup

### Step 1: Add Config to HTML
Add this to the `<head>` of `index.html` (before any `<script src="storageSync.js">` tags):

```html
<script>
  window.STORAGE_API_URL = 'https://your-server-url/api';
</script>
```

Replace `https://your-server-url/api` with:
- Your Node.js server URL if running externally (e.g., Heroku, Railway)
- Or `/api` if your Node.js server is on the same domain

### Step 2: Deploy to Netlify
1. Push your code to GitHub (if not already)
2. Go to https://app.netlify.com
3. Click "Connect from Git"
4. Select your repo
5. Deploy!

### Step 3: Configure API Endpoint (if using external server)

If your API server is on a different domain:

1. In Netlify dashboard, go to **Site settings**
2. Navigate to **Build & Deploy → Environment**
3. Add a new variable:
   - **Key:** `API_URL`
   - **Value:** `https://your-server-url/api`

### That's it! 🎉

Global storage sync will now work on Netlify. All users will see real-time updates to shared data.

---

## Where to Put Your Config

Choose **one** of these approaches:

#### Option A: Hardcoded in HTML (Simple, for stable servers)
```html
<script>
  window.STORAGE_API_URL = 'https://my-server.herokuapp.com/api';
</script>
```

#### Option B: Dynamic Configuration (Flexible)
Add to `index.html`:
```html
<script>
  // Auto-detect environment
  window.STORAGE_API_URL = 
    window.location.hostname === 'localhost' 
      ? '/api'  // Local dev
      : 'https://my-server.herokuapp.com/api';  // Production
</script>
```

#### Option C: Keep Server Locally
If you want to run your Node.js server on the same Netlify deployment:
- Not recommended (Netlify doesn't support long-running servers)
- Use Option 1 or 2 instead, hosting your Node.js server elsewhere

---

## Troubleshooting

**"API calls failing with CORS errors"**
- Make sure your server has CORS enabled
- The `STORAGE_API_URL` must be accessible from the browser
- Check your server logs

**"Updates aren't syncing"**
- Give it 2-5 seconds (they sync via polling)
- Open browser DevTools console and check for errors
- Verify the API endpoint is correct

**"Want real-time instead of polling?"**
- Use Option 1 above (external server with SSE)
- Or upgrade to Supabase/Firebase with real-time APIs

---

See `NETLIFY_DEPLOYMENT.md` for advanced options.
