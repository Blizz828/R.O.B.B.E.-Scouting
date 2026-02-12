/* EXAMPLE: How to Use Global Storage in Your App
 * 
 * This file shows practical examples of using globalStorageAdapter
 * in your R.O.B.B.E. Scouting application.
 */

// ============================================
// EXAMPLE 1: Sync Team Selection Across Users
// ============================================

async function setupTeamSelectionSync() {
  // When this page loads, check what the last selected team was (global)
  const selectedTeam = await globalStorageAdapter.getSharedValue('selected-team');
  
  if (selectedTeam) {
    console.log('Loading shared team selection:', selectedTeam);
    selectTeam(selectedTeam);
  }
  
  // Listen for when another user selects a team
  globalStorageAdapter.onValueChange('selected-team', (newTeamId) => {
    console.log('Another user selected team:', newTeamId);
    selectTeam(newTeamId);
  });
}

function selectTeam(teamId) {
  // Update UI to show selected team
  const teamElement = document.querySelector(`[data-team-id="${teamId}"]`);
  if (teamElement) {
    teamElement.classList.add('selected');
  }
  
  // Tell other users immediately
  globalStorageAdapter.setSharedValue('selected-team', teamId);
}

// ============================================
// EXAMPLE 2: Track Active Scouters
// ============================================

async function registerActiveScouter() {
  const scoterName = prompt('Enter your name:');
  if (!scoterName) return;
  
  // Get current list of active scouts
  const activeScouters = await globalStorageAdapter.getSharedValue('active-scouters') || {};
  
  // Add ourselves
  activeScouters[scoterName] = {
    name: scoterName,
    lastSeen: new Date().toISOString()
  };
  
  // Broadcast the updated list
  await globalStorageAdapter.setSharedValue('active-scouters', activeScouters);
  
  // Update periodically (heartbeat)
  setInterval(async () => {
    const current = await globalStorageAdapter.getSharedValue('active-scouters') || {};
    current[scoterName] = { name: scoterName, lastSeen: new Date().toISOString() };
    await globalStorageAdapter.setSharedValue('active-scouters', current);
  }, 30000); // Every 30 seconds
  
  // Display active scouts
  globalStorageAdapter.onValueChange('active-scouters', (scout) => {
    displayActiveScouters(scout);
  });
}

function displayActiveScouters(scouts) {
  const list = document.querySelector('#active-scouts');
  if (!list) return;
  
  list.innerHTML = Object.entries(scouts).map(([name, info]) => {
    const time = new Date(info.lastSeen);
    return `<li>${name} (last seen: ${time.toLocaleTimeString()})</li>`;
  }).join('');
}

// ============================================
// EXAMPLE 3: Shared Form Auto-Save
// ============================================

async function setupSharedFormAutoSave(formId, storageKey) {
  const form = document.getElementById(formId);
  if (!form) return;
  
  // Load previously saved data
  const saved = await globalStorageAdapter.getSharedValue(storageKey);
  if (saved) {
    console.log('Restoring form data:', saved);
    Object.entries(saved).forEach(([fieldName, value]) => {
      const input = form.querySelector(`[name="${fieldName}"]`);
      if (input) input.value = value;
    });
  }
  
  // Listen for updates from other users
  globalStorageAdapter.onValueChange(storageKey, (newData) => {
    console.log('Form updated by another user');
    Object.entries(newData).forEach(([fieldName, value]) => {
      const input = form.querySelector(`[name="${fieldName}"]`);
      if (input && input.value !== value) {
        input.value = value;
      }
    });
  });
  
  // Auto-save on form changes
  form.addEventListener('change', async () => {
    const formData = {};
    new FormData(form).forEach((value, key) => {
      formData[key] = value;
    });
    
    await globalStorageAdapter.setSharedValue(storageKey, formData);
    console.log('Form auto-saved to global storage');
  });
}

// ============================================
// EXAMPLE 4: Team Progress Tracker
// ============================================

async function trackTeamProgress() {
  const teamId = 1234; // Current team being scouted
  const progressKey = `team-${teamId}-progress`;
  
  // Get progress so far
  const progress = await globalStorageAdapter.getSharedValue(progressKey) || {
    total: 0,
    completed: 0,
    scouts: {}
  };
  
  // Display progress bar
  function updateProgressUI() {
    const percent = progress.total > 0 
      ? Math.round((progress.completed / progress.total) * 100) 
      : 0;
    document.querySelector('#progress').style.width = percent + '%';
    document.querySelector('#progress-text').textContent = 
      `${progress.completed}/${progress.total} (${percent}%)`;
  }
  
  // When this scout completes an item
  async function completeItem() {
    progress.completed++;
    progress.scouts[getCurrentScouterName()] = new Date().toISOString();
    await globalStorageAdapter.setSharedValue(progressKey, progress);
  }
  
  // Listen for progress updates
  globalStorageAdapter.onValueChange(progressKey, (newProgress) => {
    progress = newProgress;
    console.log('Progress updated:', progress);
    updateProgressUI();
  });
  
  updateProgressUI();
}

// ============================================
// EXAMPLE 5: Conflict-Free Data Merging
// ============================================

async function mergeScoutingData(localData, storageKey) {
  // Get server version
  const serverData = await globalStorageAdapter.getSharedValue(storageKey) || {};
  
  // Merge strategy: take values from both sources, resolving conflicts
  // by choosing the most recent timestamp
  const merged = {};
  
  // Start with server data
  Object.assign(merged, serverData);
  
  // Merge in local data with conflict resolution
  Object.entries(localData).forEach(([key, localValue]) => {
    const serverValue = merged[key];
    
    if (!serverValue) {
      // No conflict
      merged[key] = localValue;
    } else if (localValue.timestamp > serverValue.timestamp) {
      // Local is newer - use it
      merged[key] = localValue;
    }
    // else: keep server version (it's newer)
  });
  
  // Save merged result
  await globalStorageAdapter.setSharedValue(storageKey, merged);
  return merged;
}

// ============================================
// EXAMPLE 6: Initialize Global Storage for Your App
// ============================================

async function initializeGlobalStorageForApp() {
  console.log('Setting up global storage for app...');
  
  // Initialize the adapter
  await globalStorageAdapter.init({ 
    autoPull: true,      // Pull existing data from server
    overwrite: false     // Don't overwrite local changes
  });
  
  // Set up app-specific tracking
  registerActiveScouter();
  
  // Set up shared team selection
  setupTeamSelectionSync();
  
  // Set up any forms
  setupSharedFormAutoSave('team-form', 'current-team-form');
  setupSharedFormAutoSave('scout-form', 'current-scout-form');
  
  // Track team progress
  trackTeamProgress();
  
  console.log('Global storage initialized and ready!');
}

// Usage:
// Call this when your page loads:
// document.addEventListener('DOMContentLoaded', initializeGlobalStorageForApp);

// ============================================
// UTILITY: Get current scouter name
// ============================================

function getCurrentScouterName() {
  let name = localStorage.getItem('scouter-name');
  if (!name) {
    name = prompt('Enter your scout name:');
    if (name) localStorage.setItem('scouter-name', name);
  }
  return name || 'Anonymous';
}

// ============================================
// TESTING: Verify Global Storage Works
// ============================================

async function testGlobalStorage() {
  console.log('Testing global storage...');
  
  try {
    // Test 1: Set a value
    await globalStorageAdapter.setSharedValue('test-key', { message: 'Hello!' });
    console.log('✓ Set value succeeded');
    
    // Test 2: Get the value
    const value = await globalStorageAdapter.getSharedValue('test-key');
    if (value && value.message === 'Hello!') {
      console.log('✓ Get value succeeded');
    } else {
      console.error('✗ Get value failed');
    }
    
    // Test 3: Listen for changes
    globalStorageAdapter.onValueChange('test-key', (newValue) => {
      console.log('✓ Listener received update:', newValue);
    });
    
    // Test 4: Update the value (should trigger listener)
    await globalStorageAdapter.setSharedValue('test-key', { message: 'Updated!' });
    
    // Test 5: Delete
    await globalStorageAdapter.deleteSharedValue('test-key');
    console.log('✓ Delete succeeded');
    
    console.log('All tests passed! ✓');
  } catch (e) {
    console.error('✗ Test failed:', e);
  }
}

// Usage: testGlobalStorage() in browser console
