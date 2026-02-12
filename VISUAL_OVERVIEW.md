# Global Storage Sync System - Visual Overview

## 🎯 Main Concept

Multiple users **simultaneously** edit the scouting app, and all their changes **instantly sync** across everyone's browsers.

```
┌─────────────────────────────────────────────────────┐
│                 Browser Windows                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Scout A         Scout B         Scout C           │
│  page2.html      page3.html      page2.html        │
│  (Adding        (Filling        (Editing          │
│   teams)         form)            notes)            │
│     │               │               │               │
│     └───────────────┼───────────────┘               │
│                     │                               │
│                Real-time sync                       │
│              (Server-Sent Events)                   │
│                     │                               │
└─────────────────────┼───────────────────────────────┘
                      │
                      ↓
            ┌──────────────────────┐
            │   Node.js Server     │
            │   (server.js)        │
            │                      │
            │  URL: localhost:8080 │
            └──────────────────────┘
                      │
                      ↓
            ┌──────────────────────┐
            │  storage.json        │
            │  (persistent data)   │
            │                      │
            │  { "data": "here" }  │
            └──────────────────────┘
```

---

## 📡 How Syncing Works

### Step 1: User Makes Change
```
Scout A types in page2.html:
"Add Team 1234"
        ↓
JavaScript calls:
globalStorageAdapter.setSharedValue('list-entries', [...])
```

### Step 2: Data Sent to Server
```
HTTP PUT request:
PUT /api/storage/list-entries
Headers: Content-Type: application/json
Body: {"entries": [...]}
        ↓
Server receives data
```

### Step 3: Server Stores Data
```
Server saves to memory:
GLOBAL_STORAGE['list-entries'] = {...}
        ↓
Server saves to disk:
storage.json updated
```

### Step 4: Broadcast to All Users
```
Server sends via SSE (/api/stream):
"data: {key: 'list-entries', value: [...]}\n\n"
        ↓
Scout B receives: "Data changed by Scout A!"
Scout C receives: "Data changed by Scout A!"
        ↓
Their browsers update localStorage and UI
```

### Complete Timeline:
```
Scout A                    Server                    Scout B, C
  │                          │                          │
  ├─ Click "Add" ────────────→ Listen on SSE          │
  │                          ├─ Save data              │
  │                          ├─ Broadcast update ────→ ├─ Show new data
  │                          │                        │
  └─ 30ms total delay ───────────────────────────────┘
```

---

## 🏗️ Component Architecture

### Layer 1: Server-Side (Node.js)
```
server.js
├── HTTP Server (port 8080)
├── API Endpoints:
│  ├─ GET /api/storage           (get all keys)
│  ├─ GET /api/storage/:key      (get one key)
│  ├─ PUT /api/storage/:key      (save key)
│  ├─ DELETE /api/storage/:key   (delete key)
│  └─ GET /api/stream            (SSE broadcast)
└── GLOBAL_STORAGE (in-memory)
    └─ Persisted to storage.json
```

### Layer 2: Client-Side Libraries
```
Browser
├─ storageSync.js (low-level)
│  ├─ EventSource('/api/stream')   [SSE connection]
│  ├─ fetch('/api/storage/...')    [HTTP API calls]
│  └─ Callbacks on update
│
└─ globalStorageAdapter.js (high-level)
   ├─ setSharedValue(key, val)
   ├─ getSharedValue(key)
   ├─ onValueChange(key, cb)
   └─ Helper functions
```

### Layer 3: App Integration
```
app.js + appStorageSync.js
├─ List rendering
├─ Form handling
├─ Auto-sync list entries globally
└─ Listen for updates from other users
```

### Layer 4: UI (HTML)
```
index.html, page2.html, page3.html
├─ Display current data
├─ Handle user input
└─ Show updates in real-time
```

---

## 📊 Data Flow Diagram

```
┌─ User Action (click, type, submit)
│
├─→ app.js function called
│   └─→ addOrUpdateListEntry(...)
│
├─→ appStorageSync detects change
│   └─→ globalStorageAdapter.setSharedValue()
│
├─→ globalStorageAdapter
│   ├─→ Update localStorage (fast, local)
│   └─→ Call storageSync.setKey()
│
├─→ storageSync.setKey()
│   └─→ fetch('/api/storage/key', method: 'PUT')
│
├─→ Server receives PUT
│   ├─→ Save to GLOBAL_STORAGE
│   ├─→ Write to storage.json
│   └─→ broadcastUpdate() to all SSE clients
│
├─→ storageSync SSE listener
│   └─→ eventSource.onmessage
│
├─→ globalStorageAdapter.onUpdate
│   └─→ Call registered callbacks
│
└─→ UI Updates
    └─→ User sees change in 30ms
```

---

## 🔄 Sync States

### State Machine:
```
┌──────────────┐
│   No Sync    │  (page first loads)
│              │
└────────┬─────┘
         │ init()
         ↓
┌──────────────┐
│  Connecting  │  (connecting to /api/stream)
│              │
└────────┬─────┘
         │ SSE connection established
         ↓
┌──────────────────┐
│  Ready to Sync   │  (listening for updates)
│                  │
│  ✅ Can read     │
│  ✅ Can write    │
│  ✅ Gets live    │
│     updates      │
└──────────────────┘
```

---

## 🗂️ Example: List Entries Sync

### Operation: User adds "Team 1234"

#### Browser A (Scout adding team):
```javascript
// In page2.html:

// 1. User clicks "Add Entry"
addEntry() -> addOrUpdateListEntry('1', 'Team 1234')

// 2. appStorageSync intercepts
isLocalChange = true
setListEntries([{id: '1', text: 'Team 1234'}])
localStorage.setItem('list-entries', JSON.stringify(...))

// 3. Push to global storage
globalStorageAdapter.setSharedValue('list-entries', [...])

// 4. storageSync sends to server
fetch('/api/storage/list-entries', {
  method: 'PUT',
  body: JSON.stringify([...])
})

// 5. List re-renders locally instantly
render()  // User sees it immediately
```

#### Server:
```javascript
// In server.js:

// 6. Server receives PUT request
GLOBAL_STORAGE['list-entries'] = [...]
ss.writeFileSync('storage.json', JSON.stringify(...))

// 7. Broadcast to ALL clients
broadcastUpdate('list-entries', [...])
res.write(`data: {...}\n\n`)
```

#### Browser B (Other Scout):
```javascript
// In page2.html:

// 8. SSE listener receives update
eventSource.onmessage = {
  payload = { key: 'list-entries', value: [...] }
  
  // 9. Update local cache
  localStorage.setItem('shared-list-entries', JSON.stringify([...]))
  
  // 10. Trigger callback
  globalStorageAdapter.onUpdate(payload)
  // -> onValueChange listeners called
  
  // 11. UI Re-renders with new data
  renderList([...])  // Scout B sees team added!
}
```

### Result:
```
📱 Scout A:  ✅ Sees "Team 1234" in 0ms
📱 Scout B:  ✅ Sees "Team 1234" in 30ms
💾 Server:  ✅ Persisted for next restart
📄 storage.json: ✅ Updated
```

---

## 🌐 Multi-User Scenario

```
Timeline: Scout A adds team, Scout B adds team, Scout C refreshes

1. 00:00 Scout A: "Add Team 100"
        → Server: {team100}
        → Scout B sees it
        
2. 00:05 Scout B: "Add Team 101"
        → Server: {team100, team101}
        → Scout C sees it
        
3. 00:10 Scout A: "Add Team 102"
        → Server: {team100, team101, team102}
        → Scout B, C see it
        
4. 00:15 Scout C: Refreshes browser
        → Browser loads page2.html
        → Calls globalStorageAdapter.init()
        → Pulls from /api/storage
        → Gets {team100, team101, team102}
        → Scout C sees all teams!
```

---

## 🎛️ Control Flow

```
Each Page Load:
1. HTML loads
2. storageSync.js loaded
3. globalStorageAdapter.js loaded
4. app.js loaded
5. appStorageSync.js loaded
6. DOMContentLoaded event fires
7. await globalStorageAdapter.init()
   ├─ Connect to /api/stream (SSE)
   ├─ Pull existing data from /api/storage
   └─ Merge with localStorage
8. await appStorageSync.init()
   ├─ Get 'list-entries' from server
   └─ Setup listeners
9. appStorageSync.hookAppFunctions()
   ├─ Replace addOrUpdateListEntry
   └─ Replace removeListEntryById
10. Now all sync is automatic!
```

---

## 💾 Storage Hierarchy

```
When data is updated, it's stored in multiple places:

1. Browser Memory (JavaScript Objects)
   - Fastest access
   - Lost on refresh

2. Browser localStorage
   - Survives refresh
   - Survives restart
   - Can't sync between browsers

3. Server Memory (GLOBAL_STORAGE)
   - Shared across all users
   - Lost on server restart

4. Disk (storage.json)
   - Permanent storage
   - Survives everything
   - ~100KB per 1000 entries
```

---

## 🚨 Failure Modes

### Lost connection:
```
Browser offline → Can still edit locally
              ↓
      localStorage cached
              ↓
Back online → Push local changes to server
```

### Server crash:
```
Server dies
      ↓
storage.json safe
      ↓
Restart server
      ↓
Load storage.json into GLOBAL_STORAGE
      ↓
Browser reconnects
      ↓
All data restored!
```

### Browser refresh:
```
Browser refresh
      ↓
Page reloads
      ↓
globalStorageAdapter.init()
      ↓
Pull from /api/storage
      ↓
Data restored
      ↓
All good!
```

---

## 📈 Scalability

### Small Team (1-5 scouts):
- ✅ Single server instance
- ✅ storage.json sufficient
- ✅ No performance issues

### Medium Team (5-50 scouts):
- ✅ Still fine
- ✅ Consider database for larger datasets

### Large Scale (50+ scouts):
- ✅ Add application-level caching
- ✅ Switch to database backend (MongoDB, PostgreSQL)
- ✅ Add load balancer
- ✅ Add authentication

---

## 🎓 Key Concepts

### SSE (Server-Sent Events):
```
Regular HTTP: Client polls "Any updates?"
              Server: "No"
              
SSE: Server pushes "NEW DATA!"
     Client: "Got it!"
     
= More efficient, faster, simpler
```

### Last-Write-Wins:
```
Scout A sets value X at 1:00
Scout B sets value Y at 1:01
                    ↓
             Server has Y
           (B's more recent)
```

### Eventual Consistency:
```
Scout A updates → Scout B sees it in <100ms
              (not instant, but very fast)
```

---

## ✅ What's Working Now

- ✅ Real-time sync across all tabs/windows
- ✅ List entries auto-sync globally
- ✅ Persistent storage (survives restart)
- ✅ Offline support via localStorage
- ✅ Simple API for developers
- ✅ No database needed
- ✅ No complicated setup

## 🔜 Ready to Use!

1. Start server: `npm start`
2. Open http://localhost:8080
3. Open in 2-3 browser windows
4. Add data in one window
5. Watch it appear in others instantly!

---

**Made with ❤️ for R.O.B.B.E. Robotics Team**
