/* storageSync.js
 * Client helper to sync localStorage with server-side global storage.
 * Supports both SSE (traditional server) and polling (serverless/Netlify).
 * 
 * Configuration via environment:
 *   - Set window.STORAGE_API_URL to override default API endpoint
 *   - Set window.STORAGE_POLL_INTERVAL to change polling frequency (ms)
 *   - Set window.STORAGE_USE_POLLING = true to force polling mode
 * 
 * Usage:
 *   - Call `storageSync.init()` on page load to pull global storage into localStorage.
 *   - Use `storageSync.setKey(key, value)` to update server and broadcast.
 *   - Listen for updates: storageSync.onUpdate = ({key, value}) => { ... }
 */

const storageSync = (function () {
  // Configuration
  const API_URL = window.STORAGE_API_URL || '/api'; // Base API URL
  const POLL_INTERVAL = window.STORAGE_POLL_INTERVAL || 2000; // Poll every 2 seconds
  const USE_POLLING = window.STORAGE_USE_POLLING || false;
  
  let eventSource = null;
  let onUpdate = null; // user-provided callback
  let lastKnownValues = {}; // Track last known values for polling
  let pollingTimer = null;
  let usePolling = USE_POLLING;

  async function getAll() {
    const res = await fetch(API_URL + '/storage');
    if (!res.ok) throw new Error('Failed to fetch global storage');
    return await res.json();
  }

  async function getKey(key) {
    const res = await fetch(API_URL + '/storage/' + encodeURIComponent(key));
    if (!res.ok) return null;
    return await res.json();
  }

  async function setKey(key, value) {
    const res = await fetch(API_URL + '/storage/' + encodeURIComponent(key), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value)
    });
    if (!res.ok) throw new Error('Failed to set key');
    return await res.json();
  }

  // Utility to merge server storage into localStorage (doesn't overwrite keys that are already present unless overwrite true)
  async function pullIntoLocal({ overwrite = false } = {}) {
    const globalStorage = await getAll();
    Object.keys(globalStorage).forEach(k => {
      try {
        const v = JSON.stringify(globalStorage[k]);
        if (overwrite || localStorage.getItem(k) === null) {
          localStorage.setItem(k, v);
        }
      } catch (e) {
        console.warn('Failed to set localStorage key', k, e);
      }
    });
    // Initialize lastKnownValues for polling
    lastKnownValues = { ...globalStorage };
    return globalStorage;
  }

  // Push a local key to global storage
  async function pushLocalKey(key) {
    const raw = localStorage.getItem(key);
    if (raw == null) return null;
    let value;
    try { value = JSON.parse(raw); } catch (e) { value = raw; }
    return await setKey(key, value);
  }

  // Poll for updates (for serverless/Netlify compatibility)
  function startPolling() {
    if (pollingTimer) return;
    
    async function poll() {
      try {
        const current = await getAll();
        // Check for changes
        Object.keys(current).forEach(key => {
          const lastValue = lastKnownValues[key];
          const currentValue = current[key];
          if (JSON.stringify(lastValue) !== JSON.stringify(currentValue)) {
            // Value changed
            try {
              localStorage.setItem(key, JSON.stringify(currentValue));
            } catch (e) { }
            if (typeof onUpdate === 'function') {
              onUpdate({ key, value: currentValue });
            }
            lastKnownValues[key] = currentValue;
          }
        });
        
        // Check for deleted keys
        Object.keys(lastKnownValues).forEach(key => {
          if (!(key in current)) {
            delete lastKnownValues[key];
            if (typeof onUpdate === 'function') {
              onUpdate({ key, value: undefined });
            }
          }
        });
      } catch (e) {
        console.warn('Polling error:', e);
      }
    }
    
    // Poll immediately, then on interval
    poll();
    pollingTimer = setInterval(poll, POLL_INTERVAL);
  }

  // Subscribe to server-sent events for live updates
  function subscribeToUpdates() {
    if (eventSource) return eventSource;
    
    // Try SSE first, fall back to polling if it fails
    eventSource = new EventSource(API_URL + '/stream');
    
    eventSource.onmessage = function (msg) {
      try {
        const payload = JSON.parse(msg.data);
        if (payload && typeof payload.key === 'string') {
          // update localStorage with new value
          try {
            localStorage.setItem(payload.key, JSON.stringify(payload.value));
          } catch (e) {}
          lastKnownValues[payload.key] = payload.value;
        }
        if (typeof onUpdate === 'function') onUpdate(payload);
      } catch (e) {
        console.warn('Invalid message from server', e);
      }
    };
    
    eventSource.onerror = function (e) {
      console.warn('SSE connection errored, falling back to polling:', e);
      eventSource.close();
      eventSource = null;
      usePolling = true;
      startPolling();
    };
    
    return eventSource;
  }

  async function init({ autoPull = true, overwrite = false, pollInterval = POLL_INTERVAL } = {}) {
    if (autoPull) await pullIntoLocal({ overwrite });
    
    if (usePolling) {
      console.log('Using polling mode for global storage updates');
      startPolling();
    } else {
      try {
        subscribeToUpdates();
      } catch (e) {
        console.warn('Failed to connect via SSE, using polling:', e);
        usePolling = true;
        startPolling();
      }
    }
  }

  return {
    init,
    pullIntoLocal,
    pushLocalKey,
    setKey,
    getAll,
    getKey,
    subscribeToUpdates,
    onUpdate: null,
    // convenience: set user callback
    set onUpdateCallback(cb) { onUpdate = cb; },
    get onUpdateCallback() { return onUpdate; },
    // Stop updates (cleanup)
    stop() {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      if (pollingTimer) {
        clearInterval(pollingTimer);
        pollingTimer = null;
      }
    }
  };
})();

// Expose on window for pages to use
if (typeof window !== 'undefined') window.storageSync = storageSync;

// If using bundlers or ESM, you can import this file separately and export default.
// We avoid a bare `export` here so the script can be included directly via <script> in browsers.