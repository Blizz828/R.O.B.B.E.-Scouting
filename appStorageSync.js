/* appStorageSync.js
 * Integrates app.js with global storage.
 * Automatically syncs list entries across all users.
 * 
 * Usage:
 *   - Include this script AFTER storageSync, globalStorageAdapter, and app.js
 *   - Call appStorageSync.init() on page load
 */

const appStorageSync = (function () {
  const GLOBAL_KEY = 'list-entries'; // Where to store list data globally
  let isInitialized = false;
  let isLocalChange = false; // Flag to prevent feedback loops

  /**
   * Initialize app storage sync
   * Pulls global list entries and sets up listeners
   */
  async function init() {
    if (isInitialized) return;
    isInitialized = true;

    try {
      // Try to get list entries from global storage
      const globalList = await globalStorageAdapter.getSharedValue(GLOBAL_KEY);
      
      if (globalList && Array.isArray(globalList)) {
        console.log('Syncing global list entries to local storage:', globalList.length, 'items');
        setListEntries(globalList); // Update localStorage with global data
        updateListPageUI(); // Refresh the UI
      } else if (localStorage.getItem('list-entries')) {
        // If local has data but global doesn't, push local to global
        console.log('Pushing local list entries to global storage');
        const localList = getListEntries();
        await globalStorageAdapter.setSharedValue(GLOBAL_KEY, localList);
      }

      // Listen for changes from other users
      globalStorageAdapter.onValueChange(GLOBAL_KEY, (newList) => {
        if (isLocalChange) {
          isLocalChange = false;
          return; // Skip if this change came from us
        }
        console.log('List entries updated by another user:', newList);
        setListEntries(newList);
        updateListPageUI();
      });

      console.log('App storage sync initialized');
    } catch (e) {
      console.error('Failed to initialize app storage sync:', e);
    }
  }

  /**
   * Update an entry and sync globally
   * This wraps the existing addOrUpdateListEntry function
   */
  async function addOrUpdateListEntryGlobal(id, text, meta) {
    const originalFn = window.addOrUpdateListEntry;
    isLocalChange = true; // Flag so we ignore the broadcast
    
    // Call original function to update localStorage
    originalFn(id, text, meta);
    
    // Get updated list and push to global
    const updatedList = getListEntries();
    try {
      await globalStorageAdapter.setSharedValue(GLOBAL_KEY, updatedList);
      console.log('List entry synced to global storage');
    } catch (e) {
      console.warn('Failed to sync list entry to global storage:', e);
      // Data is still saved locally, so not a complete failure
    }
  }

  /**
   * Remove an entry and sync globally
   * This wraps the existing removeListEntryById function
   */
  async function removeListEntryByIdGlobal(id) {
    const originalFn = window.removeListEntryById;
    isLocalChange = true;
    
    // Call original function to update localStorage
    originalFn(id);
    
    // Get updated list and push to global
    const updatedList = getListEntries();
    try {
      await globalStorageAdapter.setSharedValue(GLOBAL_KEY, updatedList);
      console.log('List entry deletion synced to global storage');
    } catch (e) {
      console.warn('Failed to sync list deletion to global storage:', e);
    }
  }

  /**
   * Replace the global functions in window with syncing versions
   */
  function hookAppFunctions() {
    // Store originals
    const originalAddOrUpdate = window.addOrUpdateListEntry;
    const originalRemove = window.removeListEntryById;

    // Replace with global-aware versions
    window.addOrUpdateListEntry = function(id, text, meta) {
      return addOrUpdateListEntryGlobal(id, text, meta);
    };

    window.removeListEntryById = function(id) {
      return removeListEntryByIdGlobal(id);
    };
  }

  /**
   * Refresh the list page UI by finding the list element
   * and triggering a re-render
   */
  function updateListPageUI() {
    // This is called when we receive updates from global storage
    // Find and trigger the renderList function if it exists
    const listElement = document.querySelector('#number-list');
    if (!listElement) return; // Not on list page

    // The renderList function should already be using getListEntries()
    // So we just need to find it in the page context
    // Dispatch a custom event that the page can listen to
    const event = new CustomEvent('list-entries-updated', {
      detail: { list: getListEntries() }
    });
    document.dispatchEvent(event);
  }

  return {
    init,
    hookAppFunctions,
    addOrUpdateListEntryGlobal,
    removeListEntryByIdGlobal
  };
})();

// Expose on window
if (typeof window !== 'undefined') window.appStorageSync = appStorageSync;
