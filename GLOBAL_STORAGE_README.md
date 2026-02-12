# Global Storage Sync System 🔄

A complete real-time data synchronization system for the R.O.B.B.E. Scouting application. All connected users see updates instantly when any user makes changes.

## Overview

This system allows multiple users to simultaneously work on the scouting application with their changes automatically synchronized across all browsers and devices in real-time.

### Architecture

```
User 1 Browser        User 2 Browser        User 3 Browser
      ↓                      ↓                      ↓
   [storageSync]        [storageSync]        [storageSync]
      ↓                      ↓                      ↓
   ← Global Storage Adapter (Real-time SSE sync) →
            ↓                      ↓
          [Node.js Server]
            ↓
      [storage.json]
    (persistent DB)
```

## Features

✅ **Real-time Sync** - Changes propagate to all connected users within milliseconds  
✅ **Persistent Storage** - Data saved to server disk (`storage.json`)  
✅ **Offline Support** - Data cached in localStorage for offline access  
✅ **WebSocket-free** - Uses Server-Sent Events (SSE) for simpler deployment  
✅ **No Conflicts** - Last-write-wins merging (simple but effective)  
✅ **Easy API** - High-level wrapper functions for developers  

## Quick Start

### For Users

Open the app in multiple browser tabs/windows. Any changes made in one tab instantly appear in all other tabs.

### For Developers

#### 1. Include the Scripts

In your HTML file, include these scripts **before app.js**:

```html
<!-- Core sync libraries -->
<script src="storageSync.js"></script>
<script src="globalStorageAdapter.js"></script>

<!-- Your app code -->
<script src="app.js"></script>

<!-- App-specific sync (optional) -->
<script src="appStorageSync.js"></script>

<!-- Initialize on page load -->
<script>
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize global storage
  await globalStorageAdapter.init({ autoPull: true, overwrite: false });
  
  // Initialize app sync hooks (optional - for automatic list syncing)
  await appStorageSync.init();
  appStorageSync.hookAppFunctions();
  
  console.log('Global storage ready');
});
</script>
```

#### 2. Use in Your Code

**Set a shared value:**
```javascript
await globalStorageAdapter.setSharedValue('teams-data', [
  { id: 1, name: 'Team A' },
  { id: 2, name: 'Team B' }
]);
```

**Get a shared value:**
```javascript
const teams = await globalStorageAdapter.getSharedValue('teams-data');
```

**Listen for changes:**
```javascript
globalStorageAdapter.onValueChange('teams-data', (newTeams) => {
  console.log('Teams updated:', newTeams);
  updateUI(newTeams);
});
```

## API Reference

### `globalStorageAdapter.init(options)`

Initialize the global storage system. Call once on page load.

```javascript
await globalStorageAdapter.init({
  autoPull: true,    // Pull server data on init
  overwrite: false   // Don't overwrite existing local data
});
```

### `globalStorageAdapter.setSharedValue(key, value)`

Set a value in global storage. Broadcasts to all connected clients.

```javascript
await globalStorageAdapter.setSharedValue('my-key', {
  teams: [...],
  timestamp: Date.now()
});
```

### `globalStorageAdapter.getSharedValue(key)`

Get a value from the server. Async.

```javascript
const value = await globalStorageAdapter.getSharedValue('my-key');
if (value) {
  console.log('Got:', value);
}
```

### `globalStorageAdapter.getSharedValueSync(key)`

Get a cached value (from localStorage). Synchronous and fast, but might be stale.

```javascript
const value = globalStorageAdapter.getSharedValueSync('my-key');
```

### `globalStorageAdapter.onValueChange(key, callback)`

Listen for changes to a key. Returns unsubscribe function.

```javascript
const unsubscribe = globalStorageAdapter.onValueChange('my-key', (newValue) => {
  console.log('Value changed:', newValue);
});

// Later, to stop listening:
unsubscribe();
```

### `globalStorageAdapter.deleteSharedValue(key)`

Delete a key from global storage.

```javascript
await globalStorageAdapter.deleteSharedValue('my-key');
```

### `globalStorageAdapter.getAllSharedValues()`

Get all keys and values.

```javascript
const allData = await globalStorageAdapter.getAllSharedValues();
console.log(Object.keys(allData));
```

### `globalStorageAdapter.syncLocalToGlobal(keys)`

Push existing localStorage keys to global storage.

```javascript
// Migrate existing local data to global
await globalStorageAdapter.syncLocalToGlobal(['teams-data', 'scout-data']);
```

## Common Patterns

### Pattern 1: Sync a List

```javascript
// On page load
async function setupList() {
  // Get initial data from server
  const list = await globalStorageAdapter.getSharedValue('scouting-list') || [];
  renderList(list);
  
  // Listen for updates
  globalStorageAdapter.onValueChange('scouting-list', (newList) => {
    console.log('List updated by another user!');
    renderList(newList);
  });
}

// When user adds an item
async function addItem(item) {
  const list = await globalStorageAdapter.getSharedValue('scouting-list') || [];
  list.push(item);
  await globalStorageAdapter.setSharedValue('scouting-list', list);
}

setupList();
```

### Pattern 2: Real-time Form Data

```javascript
// Share form state with other team members
async function updateTeamData(teamId, data) {
  const key = `team-${teamId}`;
  
  // Update local immediately for responsiveness
  localStorage.setItem(key, JSON.stringify(data));
  
  // Sync to global (async)
  globalStorageAdapter.setSharedValue(key, data).catch(err => {
    console.warn('Sync failed, will retry on next update');
  });
}

// Listen for other users' changes
globalStorageAdapter.onValueChange(`team-${teamId}`, (data) => {
  console.log('Team data updated by:', data.updatedBy);
  refreshTeamForm(data);
});
```

### Pattern 3: Automatic App Sync

The `appStorageSync.js` module provides automatic syncing for list entries:

```javascript
// In page2.html (List page)
document.addEventListener('DOMContentLoaded', async () => {
  await globalStorageAdapter.init();
  
  // This hooks the existing app functions to auto-sync
  await appStorageSync.init();
  appStorageSync.hookAppFunctions();
});

// Now addOrUpdateListEntry() and removeListEntryById() 
// automatically sync to global storage!
```

## File Structure

```
R.O.B.B.E.-Scouting/
├── server.js                    # Node.js server with storage API
├── storage.json                 # Persistent global storage
├── storageSync.js               # Low-level client library (SSE, API)
├── globalStorageAdapter.js      # High-level wrapper API
├── appStorageSync.js            # App-specific sync integration
├── GLOBAL_STORAGE_GUIDE.js      # Detailed documentation
├── GLOBAL_STORAGE_README.md     # This file
│
├── index.html                   # Home page (with storage sync)
├── page2.html                   # List page (with app sync)
├── page3.html                   # Form page (with storage sync)
├── app.js                       # Main app logic
└── styles.css                   # Styles
```

## How It Works

### 1. Server-Side (`server.js`)

- Maintains `GLOBAL_STORAGE` object in memory
- Persists to `storage.json` after each update
- Exposes HTTP API:
  - `GET /api/storage` - Get all keys
  - `GET /api/storage/<key>` - Get specific key
  - `PUT /api/storage/<key>` - Set key
  - `DELETE /api/storage/<key>` - Delete key
- Broadcasts updates via SSE at `/api/stream`

### 2. Low-Level Client (`storageSync.js`)

- `subscribeToUpdates()` - Opens SSE connection to `/api/stream`
- `getKey()`, `setKey()` - API calls to server
- `pullIntoLocal()` - Merges server data to localStorage
- Broadcasts messages to app when updates arrive

### 3. High-Level Wrapper (`globalStorageAdapter.js`)

- User-friendly API (async/await)
- Manages callbacks for value changes
- Handles errors gracefully
- Keeps localStorage in sync automatically

### 4. App Integration (`appStorageSync.js`)

- Hooks existing app functions
- Automatically syncs list entries to global storage
- Prevents feedback loops with flags

## Important Security Notes ⚠️

**Global storage is NOT encrypted and is visible to all users.**

- ✅ Safe: Scouting data, team info, form submissions
- ❌ Unsafe: Passwords, authentication tokens, sensitive PII

For sensitive data, add authentication/authorization to the server.

## Troubleshooting

### Data Not Syncing?

1. Check browser console for errors
2. Verify `globalStorageAdapter.init()` was called
3. Check if server is running: `curl http://localhost:8080/api/storage`
4. Check networking tab for `/api/stream` connection

### Seeing Stale Data?

- Use `await globalStorageAdapter.getSharedValue(key)` instead of `getSharedValueSync(key)`
- Make sure you're listening with `onValueChange()`

### Server Crash Lost Data?

- Check `storage.json` - data should be persisted
- Restart server and data will reload
- If needed, run `await globalStorageAdapter.syncLocalToGlobal(['key1', 'key2'])` to push any local backups

### Clear All Data?

```javascript
// WARNING: This affects all users!
await globalStorageAdapter.clearAllSharedValues();
```

## Performance Notes

- Each connection uses ~1-2 KB of memory (SSE listeners)
- Storage.json grows with data (compress if it gets large)
- Updates broadcast to all clients take <100ms typically
- No database needed - just JSON file

## Future Enhancements

- [ ] Conflict resolution (current: last-write-wins)
- [ ] Authentication/authorization
- [ ] Data encryption
- [ ] Versioning/history
- [ ] Database backend (PostgreSQL, MongoDB)
- [ ] Delta sync (sync only changed fields)
- [ ] Compression for large data

## Support

For issues or questions, check:
1. Browser console for error messages
2. Server logs
3. Network tab for failed API calls
4. GLOBAL_STORAGE_GUIDE.js for detailed docs

---

**Made with ❤️ for the R.O.B.B.E. Robotics Team**
