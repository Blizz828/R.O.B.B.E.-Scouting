/* 
 * GLOBAL STORAGE SYNC INTEGRATION GUIDE
 * ====================================
 * 
 * This application now includes a global storage system that syncs data across
 * all users in real-time. This document explains how to use it.
 * 
 * KEY FEATURES:
 * - Real-time sync across all connected browsers
 * - Persistent storage on the server (storage.json)
 * - LocalStorage fallback for offline access
 * - Server-Sent Events (SSE) for live updates
 * - Simple API for developers
 * 
 * ====================================
 * ARCHITECTURE
 * ====================================
 * 
 * 1. SERVER SIDE (server.js):
 *    - Maintains GLOBAL_STORAGE in memory and persists to storage.json
 *    - HTTP API: GET/PUT/DELETE /api/storage/<key>
 *    - SSE Stream: GET /api/stream broadcasts updates to all clients
 * 
 * 2. CLIENT LIBRARIES:
 *    - storageSync.js: Low-level client library (handles SSE, API calls)
 *    - globalStorageAdapter.js: High-level wrapper (easier to use)
 * 
 * ====================================
 * QUICK START
 * ====================================
 * 
 * 1. On page load, initialize:
 *    await globalStorageAdapter.init();
 * 
 * 2. Set a shared value (syncs to all users):
 *    await globalStorageAdapter.setSharedValue('teams-data', teamArray);
 * 
 * 3. Get a shared value:
 *    const teams = await globalStorageAdapter.getSharedValue('teams-data');
 * 
 * 4. Listen for changes:
 *    globalStorageAdapter.onValueChange('teams-data', (newValue) => {
 *      console.log('Teams updated:', newValue);
 *      updateUI(newValue);
 *    });
 * 
 * ====================================
 * API REFERENCE
 * ====================================
 * 
 * INITIALIZATION:
 *   globalStorageAdapter.init(options)
 *   - Initializes the storage system
 *   - options.autoPull (bool): Pull server data on init (default: true)
 *   - options.overwrite (bool): Overwrite local with server data (default: false)
 * 
 * SETTING & GETTING:
 *   await globalStorageAdapter.setSharedValue(key, value)
 *   - Sets a value in global storage, syncs to all clients
 *   - Returns Promise with the value
 * 
 *   await globalStorageAdapter.getSharedValue(key)
 *   - Gets value from server
 *   - Returns Promise with value or null
 * 
 *   globalStorageAdapter.getSharedValueSync(key)
 *   - Gets cached value from localStorage (synchronous)
 *   - Faster but might be stale
 * 
 * LISTENERS:
 *   unsub = globalStorageAdapter.onValueChange(key, callback)
 *   - Callback is called when value changes
 *   - Returns unsubscribe function
 * 
 * MANAGEMENT:
 *   await globalStorageAdapter.deleteSharedValue(key)
 *   - Deletes a key from global storage
 * 
 *   await globalStorageAdapter.getAllSharedValues()
 *   - Gets all keys and values
 * 
 *   await globalStorageAdapter.clearAllSharedValues()
 *   - WARNING: Clears all global storage!
 * 
 *   await globalStorageAdapter.syncLocalToGlobal(keys)
 *   - Pushes existing localStorage keys to global storage
 * 
 * ====================================
 * COMMON PATTERNS
 * ====================================
 * 
 * PATTERN 1: Sync a list of items
 * 
 *   // On page load:
 *   async function setupListSync() {
 *     const list = await globalStorageAdapter.getSharedValue('scouting-list');
 *     if (list) renderList(list);
 *     
 *     // Listen for updates
 *     globalStorageAdapter.onValueChange('scouting-list', (newList) => {
 *       console.log('List updated by another user');
 *       renderList(newList);
 *     });
 *   }
 *   
 *   // When user adds an item:
 *   async function addItem(item) {
 *     let list = await globalStorageAdapter.getSharedValue('scouting-list') || [];
 *     list.push(item);
 *     await globalStorageAdapter.setSharedValue('scouting-list', list);
 *   }
 * 
 * PATTERN 2: Migrate existing localStorage to global
 * 
 *   // On first load, migrate local data to global:
 *   await globalStorageAdapter.syncLocalToGlobal(['teams-data', 'scout-data']);
 * 
 * PATTERN 3: Local + Global (hybrid approach)
 * 
 *   // Keep some data local (passwords, UI state) and sync other data (team info)
 *   function updateTeamInfo(teamId, info) {
 *     // Update local (fast)
 *     localStorage.setItem(`team-${teamId}`, JSON.stringify(info));
 *     
 *     // Also sync globally (async)
 *     globalStorageAdapter.setSharedValue(`team-${teamId}`, info).catch(err => {
 *       console.warn('Failed to sync globally, will sync next update', err);
 *     });
 *   }
 * 
 * ====================================
 * SECURITY NOTES
 * ====================================
 * 
 * - Global storage is NOT encrypted and visible to all users
 * - DO NOT store sensitive data (passwords, auth tokens) in global storage
 * - Each user can modify any data (no access control yet)
 * - Add authentication/authorization if needed
 * 
 * ====================================
 * TROUBLESHOOTING
 * ====================================
 * 
 * Q: Data isn't syncing across browsers
 * A: Make sure globalStorageAdapter.init() is called and check browser console for errors
 * 
 * Q: Why am I seeing stale data?
 * A: Call getSharedValue() for fresh data, or check that you're listening to onValueChange
 * 
 * Q: Server crashed but data was already in localStorage
 * A: Local data persists. When server restarts, run syncLocalToGlobal() to push data back
 * 
 * Q: How do I clear all data?
 * A: Run await globalStorageAdapter.clearAllSharedValues() (careful!)
 * 
 * ====================================
 * EXAMPLES
 * ====================================
 * 
 * See README.md for full examples.
 */

// Default initialization pattern for HTML pages:
/*
document.addEventListener('DOMContentLoaded', async () => {
  await globalStorageAdapter.init({ autoPull: true, overwrite: false });
  console.log('Global storage ready');
  
  // Now you can use globalStorageAdapter in your app logic
});
*/

export { globalStorageAdapter };
