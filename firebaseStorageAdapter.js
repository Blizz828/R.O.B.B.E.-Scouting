/* firebaseStorageAdapter.js
 * Replaces storageSync.js with Firebase Realtime Database backend.
 * 
 * Setup:
 *   1. Create Firebase project at https://console.firebase.google.com
 *   2. Enable Realtime Database
 *   3. Set security rules (see FIREBASE_SETUP.md)
 *   4. Get your config from Firebase console
 *   5. Load this script after Firebase SDK
 * 
 * Usage:
 *   - Same API as storageSync.js
 *   - storageSync.init() - Initialize
 *   - storageSync.setKey(key, value) - Set a value
 *   - storageSync.getKey(key) - Get a value
 *   - storageSync.getAll() - Get all values
 *   - storageSync.onUpdate = callback - Listen for updates
 */

const storageSync = (function () {
  let db = null; // Firebase Realtime Database reference
  let onUpdate = null; // Callback for updates
  let listeners = {}; // Track active listeners by key
  const STORAGE_NODE = 'global-storage'; // Root node in database

  /**
   * Initialize Firebase (call once on page load)
   * Requires that firebase has already been imported via CDN or npm
   * 
   * @param {Object} options
   * @param {boolean} options.autoPull - Pull existing data (default: true)
   * @param {boolean} options.overwrite - Overwrite local values (default: false)
   */
  async function init({ autoPull = true, overwrite = false } = {}) {
    if (!window.firebase) {
      throw new Error('Firebase SDK not loaded. Include Firebase SDK before storageSync.js');
    }

    // Initialize Firebase (if not already done by another script)
    if (!firebase.apps || firebase.apps.length === 0) {
      throw new Error('Firebase not initialized. Call firebase.initializeApp(config) first.');
    }

    try {
      db = firebase.database();
      console.log('Firebase Realtime Database initialized');

      if (autoPull) {
        await pullIntoLocal({ overwrite });
      }

      // Set up listener for all storage changes
      setupGlobalListener();
    } catch (e) {
      console.error('Failed to initialize Firebase storage adapter:', e);
      throw e;
    }
  }

  /**
   * Get all values from Firebase
   */
  async function getAll() {
    if (!db) throw new Error('Firebase not initialized. Call init() first.');
    
    try {
      const snapshot = await db.ref(STORAGE_NODE).once('value');
      return snapshot.val() || {};
    } catch (e) {
      console.error('Failed to get all values from Firebase:', e);
      throw e;
    }
  }

  /**
   * Get a single value from Firebase
   */
  async function getKey(key) {
    if (!db) throw new Error('Firebase not initialized. Call init() first.');
    
    try {
      const snapshot = await db.ref(STORAGE_NODE + '/' + encodeURIComponent(key)).once('value');
      return snapshot.val();
    } catch (e) {
      console.error('Failed to get key from Firebase:', e, key);
      throw e;
    }
  }

  /**
   * Set a value in Firebase
   */
  async function setKey(key, value) {
    if (!db) throw new Error('Firebase not initialized. Call init() first.');
    
    try {
      const encodedKey = encodeURIComponent(key);
      await db.ref(STORAGE_NODE + '/' + encodedKey).set(value);
      
      // Also update localStorage
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {}

      return { key, value };
    } catch (e) {
      console.error('Failed to set key in Firebase:', e, key, value);
      throw e;
    }
  }

  /**
   * Delete a value from Firebase
   */
  async function deleteKey(key) {
    if (!db) throw new Error('Firebase not initialized. Call init() first.');
    
    try {
      const encodedKey = encodeURIComponent(key);
      await db.ref(STORAGE_NODE + '/' + encodedKey).remove();
      
      // Also remove from localStorage
      try {
        localStorage.removeItem(key);
      } catch (e) {}

      return { key, value: undefined };
    } catch (e) {
      console.error('Failed to delete key from Firebase:', e, key);
      throw e;
    }
  }

  /**
   * Pull all Firebase data into localStorage
   */
  async function pullIntoLocal({ overwrite = false } = {}) {
    try {
      const globalStorage = await getAll();
      Object.keys(globalStorage).forEach(k => {
        try {
          const v = JSON.stringify(globalStorage[k]);
          if (overwrite || localStorage.getItem(k) === null) {
            localStorage.setItem(k, v);
          }
        } catch (e) {
          console.warn('Failed to set localStorage key:', k, e);
        }
      });
      return globalStorage;
    } catch (e) {
      console.error('Failed to pull data into local storage:', e);
      throw e;
    }
  }

  /**
   * Push a local key to Firebase
   */
  async function pushLocalKey(key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return null;
      let value;
      try {
        value = JSON.parse(raw);
      } catch (e) {
        value = raw;
      }
      return await setKey(key, value);
    } catch (e) {
      console.error('Failed to push local key to Firebase:', e, key);
      throw e;
    }
  }

  /**
   * Set up a listener for all changes under STORAGE_NODE
   * Broadcasts updates to the onUpdate callback
   */
  function setupGlobalListener() {
    if (!db) return;
    
    try {
      db.ref(STORAGE_NODE).on('child_changed', (snapshot) => {
        const key = decodeURIComponent(snapshot.key);
        const value = snapshot.val();
        
        // Update localStorage
        try {
          localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {}
        
        // Call user callback
        if (typeof onUpdate === 'function') {
          try {
            onUpdate({ key, value });
          } catch (e) {
            console.error('Error in onUpdate callback:', e);
          }
        }
      });

      db.ref(STORAGE_NODE).on('child_added', (snapshot) => {
        const key = decodeURIComponent(snapshot.key);
        const value = snapshot.val();
        
        // Update localStorage
        try {
          localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {}
        
        // Call user callback
        if (typeof onUpdate === 'function') {
          try {
            onUpdate({ key, value });
          } catch (e) {
            console.error('Error in onUpdate callback:', e);
          }
        }
      });

      db.ref(STORAGE_NODE).on('child_removed', (snapshot) => {
        const key = decodeURIComponent(snapshot.key);
        
        // Remove from localStorage
        try {
          localStorage.removeItem(key);
        } catch (e) {}
        
        // Call user callback
        if (typeof onUpdate === 'function') {
          try {
            onUpdate({ key, value: undefined });
          } catch (e) {
            console.error('Error in onUpdate callback:', e);
          }
        }
      });

      db.ref(STORAGE_NODE).on('error', (error) => {
        console.error('Firebase listener error:', error);
      });

      console.log('Global Firebase listener initialized');
    } catch (e) {
      console.error('Failed to set up global listener:', e);
    }
  }

  /**
   * Subscribe to updates (for compatibility with storageSync API)
   * With Firebase, updates are automatic via setupGlobalListener
   */
  function subscribeToUpdates() {
    console.log('Updates are automatically subscribed via Firebase listeners');
    return null;
  }

  /**
   * Stop all listeners and cleanup
   */
  function stop() {
    if (db) {
      try {
        db.ref(STORAGE_NODE).off(); // Remove all listeners
        console.log('Firebase listeners stopped');
      } catch (e) {
        console.warn('Error stopping Firebase listeners:', e);
      }
    }
  }

  // Public API - compatible with storageSync.js
  return {
    init,
    pullIntoLocal,
    pushLocalKey,
    setKey,
    getKey,
    getAll,
    deleteKey,
    subscribeToUpdates,
    stop,
    onUpdate: null,
    // Convenience setters
    set onUpdateCallback(cb) { onUpdate = cb; },
    get onUpdateCallback() { return onUpdate; }
  };
})();

// Expose on window for pages to use
if (typeof window !== 'undefined') window.storageSync = storageSync;
