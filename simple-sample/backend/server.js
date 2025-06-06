import 'dotenv/config'
import { WebSocketServer } from 'ws'
import * as Y from 'yjs'
import { RedisPersistence } from 'y-redis'
import * as syncProtocol from 'y-protocols/sync'
import * as awarenessProtocol from 'y-protocols/awareness'
import { encoding, decoding, map } from 'lib0'
import { createStorage } from './src/storage/index.js'

// Configuration
const PORT = process.env.PORT || 3001
const HOST = process.env.HOST || 'localhost'
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379/1'
const DOC_CLEANUP_INTERVAL = parseInt(process.env.DOC_CLEANUP_INTERVAL) || 600000 // 10 minutes

console.log('🚀 Starting y-redis collaborative server...')
console.log(`📡 Server: http://${HOST}:${PORT}`)
console.log(`🔗 Redis: ${REDIS_URL}`)
console.log(`🧹 Document cleanup interval: ${DOC_CLEANUP_INTERVAL}ms`)

// Create Redis persistence using database isolation
const redisPersistence = new RedisPersistence({
  redisOpts: { url: REDIS_URL }
})

// Create storage provider (S3, Memory, etc.)
const storage = createStorage()

// Store documents and awareness instances (for active rooms only)
const docs = new Map()
const docAwareness = new Map()
const roomConnections = new Map() // Track active connections per room
const roomLastActivity = new Map() // Track last activity per room

// WebSocket server
const wss = new WebSocketServer({ 
  port: PORT,
  host: HOST
})

const messageSync = 0
const messageAwareness = 1

const send = (conn, message) => {
  if (conn.readyState !== conn.CONNECTING && conn.readyState !== conn.OPEN) {
    conn.close()
  } else {
    conn.send(message, err => err != null && conn.close())
  }
}

/**
 * Update room activity and notify worker queue
 */
async function updateRoomActivity(docName) {
  roomLastActivity.set(docName, Date.now())
  
  // Notify worker queue for coordination
  try {
    const redis = redisPersistence.redis
    if (redis) {
      await redis.xadd('y:worker', '*', 'room', docName, 'action', 'activity')
    }
  } catch (error) {
    console.error(`❌ Error notifying worker queue for room ${docName}:`, error)
  }
}

/**
 * Load initial document state from Redis and persistent storage
 */
async function loadInitialDocumentState(docName, doc) {
  try {
    console.log(`📥 Loading initial state for room: ${docName}`)
    
    // First, try to load from persistent storage (S3, etc.)
    try {
      const persistedData = await storage.retrieveDoc(docName, 'default')
      if (persistedData && persistedData.doc) {
        console.log(`📦 Loaded ${persistedData.doc.length} bytes from persistent storage`)
        Y.applyUpdateV2(doc, persistedData.doc)
      }
    } catch (storageError) {
      console.log(`📦 No persisted data found for room ${docName}:`, storageError.message)
    }
    
    // Then, bind to Redis for real-time updates
    await redisPersistence.bindState(docName, doc)
    console.log(`🔗 Bound room ${docName} to Redis streams`)
    
  } catch (error) {
    console.error(`❌ Error loading initial state for ${docName}:`, error)
    throw error
  }
}

/**
 * Track connection counts per room
 */
function addRoomConnection(docName, conn) {
  if (!roomConnections.has(docName)) {
    roomConnections.set(docName, new Set())
  }
  roomConnections.get(docName).add(conn)
  updateRoomActivity(docName)
  console.log(`👥 Room ${docName} now has ${roomConnections.get(docName).size} connections`)
}

async function removeRoomConnection(docName, conn) {
  if (roomConnections.has(docName)) {
    roomConnections.get(docName).delete(conn)
    const remainingConnections = roomConnections.get(docName).size
    
    console.log(`👥 Room ${docName} now has ${remainingConnections} connections`)
    
    if (remainingConnections === 0) {
      roomConnections.delete(docName)
      console.log(`📤 Room ${docName} is now empty`)
      
      // Notify worker that room is now empty
      try {
        const redis = redisPersistence.redis
        if (redis) {
          await redis.xadd('y:worker', '*', 'room', docName, 'action', 'empty')
          console.log(`📢 Notified worker that room ${docName} is empty`)
        }
      } catch (error) {
        console.error(`❌ Error notifying worker about empty room ${docName}:`, error)
      }
    }
  }
}

const setupWSConnection = async (conn, req, { docName = req.url.slice(1).split('?')[0] || 'default' } = {}) => {
  conn.binaryType = 'arraybuffer'
  
  // Track this connection
  addRoomConnection(docName, conn)
  
  // Get or create document
  let doc = docs.get(docName)
  let awareness = docAwareness.get(docName)
  
  if (!doc) {
    doc = new Y.Doc()
    docs.set(docName, doc)
    
    // Load initial state from persistent storage + Redis
    try {
      await loadInitialDocumentState(docName, doc)
    } catch (error) {
      console.error(`❌ Failed to load initial state for ${docName}:`, error)
      // Continue with empty document
    }
    
    console.log(`📄 Created new document: ${docName}`)
  }
  
  // Ensure awareness exists (might be missing even if doc exists)
  if (!awareness) {
    awareness = new awarenessProtocol.Awareness(doc)
    docAwareness.set(docName, awareness)
    console.log(`📡 Created awareness for existing document: ${docName}`)
  }

  const encoder = encoding.createEncoder()
  const decoder = decoding.createDecoder()
  
  // Send sync step 1
  encoding.writeVarUint(encoder, messageSync)
  syncProtocol.writeSyncStep1(encoder, doc)
  send(conn, encoding.toUint8Array(encoder))
  
  const awarenessChangeHandler = ({ added, updated, removed }, origin) => {
    const changedClients = added.concat(updated).concat(removed)
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, messageAwareness)
    encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients))
    send(conn, encoding.toUint8Array(encoder))
  }
  
  awareness.on('update', awarenessChangeHandler)
  
  // Send awareness states
  if (awareness.getStates().size > 0) {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, messageAwareness)
    encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(awareness.getStates().keys())))
    send(conn, encoding.toUint8Array(encoder))
  }
  
  // Handle messages
  conn.on('message', (message) => {
    const encoder = encoding.createEncoder()
    const decoder = decoding.createDecoder(new Uint8Array(message))
    const messageType = decoding.readVarUint(decoder)
    
    switch (messageType) {
      case messageSync:
        encoding.writeVarUint(encoder, messageSync)
        const syncMessageType = syncProtocol.readSyncMessage(decoder, encoder, doc, null)
        if (encoding.length(encoder) > 1) {
          send(conn, encoding.toUint8Array(encoder))
        }
        break
      case messageAwareness:
        awarenessProtocol.applyAwarenessUpdate(awareness, decoding.readVarUint8Array(decoder), conn)
        break
    }
  })
  
  // Handle close
  conn.on('close', () => {
    awareness.off('update', awarenessChangeHandler)
    removeRoomConnection(docName, conn)
    console.log(`📤 Client disconnected from: ${docName}`)
  })
  
  console.log(`📥 Client connected to: ${docName}`)
}

/**
 * Cleanup inactive documents from server memory
 */
async function cleanupInactiveDocuments() {
  const now = Date.now()
  const INACTIVE_THRESHOLD = DOC_CLEANUP_INTERVAL * 2 // 20 minutes by default
  
  for (const [docName, lastActivity] of roomLastActivity.entries()) {
    // Only cleanup if no active connections and inactive for threshold time
    if (!roomConnections.has(docName) && (now - lastActivity) > INACTIVE_THRESHOLD) {
      console.log(`🧹 Cleaning up inactive document: ${docName}`)
      
      // Clean up document and awareness
      const doc = docs.get(docName)
      const awareness = docAwareness.get(docName)
      
      if (awareness) {
        awareness.destroy()
        docAwareness.delete(docName)
      }
      
      if (doc) {
        doc.destroy()
        docs.delete(docName)
      }
      
      roomLastActivity.delete(docName)
    }
  }
}

// Setup periodic cleanup
setInterval(cleanupInactiveDocuments, DOC_CLEANUP_INTERVAL)

wss.on('connection', setupWSConnection)

console.log('✅ y-redis server started successfully!')
console.log('💡 Frontend can now connect to ws://localhost:3001')

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...')
  redisPersistence.destroy()
  wss.close(() => {
    console.log('✅ Server closed')
    process.exit(0)
  })
})

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down...')
  redisPersistence.destroy()
  wss.close(() => {
    process.exit(0)
  })
}) 