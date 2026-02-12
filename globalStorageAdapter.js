/* globalStorageAdapter.js
 * High-level wrapper around storageSync for managing shared application data.
 * Handles syncing app state changes to global storage and responding to updates.
 *
 * Usage:
 *   - Call globalStorageAdapter.init() on page load
 *   - Use globalStorageAdapter.setSharedValue(key, value) to update shared state
 *   - Register listeners: globalStorageAdapter.onValueChange(key, callback)
 *   - Get current value: globalStorageAdapter.getSharedValue(key)
 */

const globalStorageAdapter = (function () {
  const valueChangeCallbacks = {}; // key -> [callbacks]
  let isInitialized = false;

  /**
   * Initialize the adapter (call once on page load)
   * @param {Object} options
   * @param {boolean} options.autoPull - Pull existing global storage on init (default: true)
   * @param {boolean} options.overwrite - Overwrite local values with global (default: false)
   */
  async function init(options = {}) {
    if (isInitialized) return;
    isInitialized = true;

    try {
      // Initialize storageSync (connects to server and pulls data)
      await storageSync.init(options);

      // Set up listener for global updates from server
      storageSync.onUpdate = ({ key, value }) => {
        if (key && valueChangeCallbacks[key]) {
          valueChangeCallbacks[key].forEach(cb => {
            try {
              cb(value);
            } catch (e) {
              console.error('Error in value change callback', e);
            }
          });
        }
      };

      console.log('Global storage adapter initialized');
    } catch (e) {
      console.error('Failed to initialize global storage adapter', e);
    }
  }

  /**
   * Set a value in global (synced) storage
   * @param {string} key - Storage key
   * @param {*} value - Value to store (must be JSON-serializable)
   * @returns {Promise<*>} The value that was set
   */
  async function setSharedValue(key, value) {
    try {
      await storageSync.setKey(key, value);
      // Also update localStorage for offline access
      try {
        localStorage.setItem(`shared-${key}`, JSON.stringify(value));
      } catch (e) {
        console.warn('Failed to update localStorage', e);
      }
      return value;
    } catch (e) {
      console.error(`Failed to set shared value for key: ${key}`, e);
      throw e;
    }
  }

  /**
   * Get a value from global storage
   * @param {string} key - Storage key
   * @returns {Promise<*>} The stored value, or null if not found
   */
  async function getSharedValue(key) {
    try {
      return await storageSync.getKey(key);
    } catch (e) {
      console.error(`Failed to get shared value for key: ${key}`, e);
      return null;
    }
  }

  /**
   * Get current value (from cache/localStorage)
   * Useful for synchronous access when you've already fetched the value
   * @param {string} key
   * @returns {*} The cached value or null
   */
  function getSharedValueSync(key) {
    try {
      const raw = localStorage.getItem(`shared-${key}`);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Register a callback to be invoked when a shared value changes
   * @param {string} key - Storage key to watch
   * @param {Function} callback - Called with (newValue) when value changes
   * @returns {Function} Unsubscribe function
   */
  function onValueChange(key, callback) {
    if (!valueChangeCallbacks[key]) {
      valueChangeCallbacks[key] = [];
    }
    valueChangeCallbacks[key].push(callback);

    // Return unsubscribe function
    return () => {
      valueChangeCallbacks[key] = valueChangeCallbacks[key].filter(cb => cb !== callback);
    };
  }

  /**
   * Delete a value from global storage
   * @param {string} key - Storage key to delete
   */
  async function deleteSharedValue(key) {
    try {
      const res = await fetch(`/api/storage/${encodeURIComponent(key)}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete key');
      localStorage.removeItem(`shared-${key}`);
    } catch (e) {
      console.error(`Failed to delete shared value for key: ${key}`, e);
      throw e;
    }
  }

  /**
   * Get all shared values
   * @returns {Promise<Object>} All key-value pairs
   */
  async function getAllSharedValues() {
    try {
      return await storageSync.getAll();
    } catch (e) {
      console.error('Failed to get all shared values', e);
      return {};
    }
  }

  /**
   * Clear all shared storage (careful - affects everyone!)
   */
  async function clearAllSharedValues() {
    try {
      const all = await getAllSharedValues();
      const keys = Object.keys(all);
      for (const key of keys) {
        await deleteSharedValue(key);
      }
    } catch (e) {
      console.error('Failed to clear all shared values', e);
      throw e;
    }
  }

  /**
   * Merge local app state into global storage
   * Useful for syncing application state that's already in localStorage
   * @param {Array<string>} keys - Keys to sync from localStorage to global
   */
  async function syncLocalToGlobal(keys) {
    try {
      for (const key of keys) {
        const raw = localStorage.getItem(key);
        if (raw !== null) {
          let value;
          try {
            value = JSON.parse(raw);
          } catch {
            value = raw;
          }
          await setSharedValue(key, value);
        }
      }
    } catch (e) {
      console.error('Failed to sync local to global', e);
      throw e;
    }
  }

  return {
    init,
    setSharedValue,
    getSharedValue,
    getSharedValueSync,
    onValueChange,
    deleteSharedValue,
    getAllSharedValues,
    clearAllSharedValues,
    syncLocalToGlobal,
    // For advanced usage
    storageSync: () => storageSync
  };
})();

// Expose on window
if (typeof window !== 'undefined') window.globalStorageAdapter = globalStorageAdapter;
