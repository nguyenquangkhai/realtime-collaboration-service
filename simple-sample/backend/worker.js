import 'dotenv/config'
import * as Y from 'yjs'
import { RedisPersistence } from 'y-redis'
import { createStorage } from './src/storage/index.js'
// Simple delay function
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// Configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379/1'
const WORKER_ID = process.env.WORKER_ID || `worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
const PERSIST_INTERVAL = parseInt(process.env.PERSIST_INTERVAL) || 30000 // 30 seconds
const CLEANUP_INTERVAL = parseInt(process.env.CLEANUP_INTERVAL) || 300000 // 5 minutes
const ROOM_INACTIVE_THRESHOLD = parseInt(process.env.ROOM_INACTIVE_THRESHOLD) || 86400000 // 24 hours
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 10 // Process 10 documents at a time

console.log('🔧 Starting y-redis persistence worker...')
console.log(`🆔 Worker ID: ${WORKER_ID}`)
console.log(`🔗 Redis: ${REDIS_URL}`)
console.log(`⏱️  Persist Interval: ${PERSIST_INTERVAL}ms`)
console.log(`🧹 Cleanup Interval: ${CLEANUP_INTERVAL}ms`)
console.log(`⏰ Room Inactive Threshold: ${ROOM_INACTIVE_THRESHOLD}ms (${Math.round(ROOM_INACTIVE_THRESHOLD / 3600000)}h)`)

// Create Redis persistence and storage using database isolation
const redisPersistence = new RedisPersistence({
  redisOpts: { url: REDIS_URL }
})

const storage = createStorage()

// Track processing state and room activities
const processingRooms = new Set()
const roomActivities = new Map() // roomName -> timestamp
let isRunning = true

// Keep track of known rooms (in a real implementation, this would come from Redis)
const knownRooms = new Set()

/**
 * Register room activity (called when users connect/disconnect)
 */
function updateRoomActivity(roomName) {
  roomActivities.set(roomName, Date.now())
  console.info(`📝 Updated activity for room: ${roomName}`)
}

/**
 * Handle empty room notification - persist and cleanup
 */
async function handleEmptyRoom(roomName) {
  try {
    console.info(`🗑️ Handling empty room: ${roomName}`)
    
    // First, try to persist any remaining data
    await persistRoomData(roomName)
    
    // Then clean up Redis keys for this room
    const redis = redisPersistence.redis
    if (redis) {
      const keysToDelete = await redis.keys(`${roomName}:*`)
      if (keysToDelete.length > 0) {
        await redis.del(...keysToDelete)
        console.info(`🗑️ Cleaned up ${keysToDelete.length} Redis keys for empty room: ${roomName}`)
      } else {
        console.info(`✅ No Redis keys to clean for room: ${roomName}`)
      }
    }
    
    // Remove from activity tracking
    roomActivities.delete(roomName)
    
  } catch (error) {
    console.error(`❌ Error handling empty room ${roomName}:`, error)
  }
}

/**
 * Check if a room has active connections by looking at recent activity
 */
async function checkRoomActiveConnections(roomName) {
  try {
    const redis = redisPersistence.redis
    if (!redis) return false

    // Check for recent activity messages in worker queue
    const results = await redis.xrevrange('y:worker', '+', '-', 'COUNT', 50)
    
    const RECENT_THRESHOLD = 60000 // 1 minute
    const now = Date.now()
    
    for (const [id, fields] of results) {
      // Parse timestamp from Redis stream ID (format: timestamp-sequence)
      const timestamp = parseInt(id.split('-')[0])
      
      if ((now - timestamp) > RECENT_THRESHOLD) {
        break // Stop checking older messages
      }
      
      // Check if this message is about our room
      for (let i = 0; i < fields.length; i += 2) {
        if (fields[i] === 'room' && fields[i + 1] === roomName) {
          // Check if it's an activity message (connection)
          if (fields.includes('activity')) {
            console.info(`🔍 Found recent activity for room ${roomName}`)
            return true
          }
        }
      }
    }
    
    // Also check if room has very recent activity in our local tracking
    const lastActivity = roomActivities.get(roomName)
    if (lastActivity && (now - lastActivity) < RECENT_THRESHOLD) {
      console.info(`🔍 Room ${roomName} has recent local activity`)
      return true
    }
    
    console.info(`🔍 No recent activity found for room ${roomName}`)
    return false
    
  } catch (error) {
    console.error(`❌ Error checking room activity for ${roomName}:`, error)
    return true // Assume active if we can't check (safer approach)
  }
}

/**
 * Discover active rooms from Redis keys
 */
async function discoverActiveRooms() {
  try {
    const redis = redisPersistence.redis
    if (!redis) {
      console.info('📡 Redis client not available for room discovery')
      return []
    }

    // Get all y-redis keys and analyze their types
    const allKeys = await redis.keys('*')
    console.log('🔍 Found Redis keys:', allKeys.length)
    
    // Debug: Check what types these keys actually are
    const rooms = new Set()
    for (const key of allKeys) {
      try {
        const keyType = await redis.type(key)
        console.log(`🔍 Key: ${key}, Type: ${keyType}`)
        
                 // y-redis typically uses room names as prefixes
         // Look for keys that might indicate active rooms
         if (key.includes(':') && key.endsWith(':updates')) {
           // Only consider keys ending with :updates as room indicators
           const roomName = key.replace(':updates', '')
           if (roomName && roomName !== '' && !roomName.startsWith('y:')) {
             rooms.add(roomName)
             updateRoomActivity(roomName)
           }
         }
      } catch (keyError) {
        console.debug(`⚠️ Could not get type for key ${key}:`, keyError.message)
      }
    }

    const roomsArray = Array.from(rooms)
    console.log('🔍 Discovered rooms:', roomsArray)
    return roomsArray
  } catch (error) {
    console.error('❌ Error discovering rooms from Redis:', error)
    return []
  }
}

/**
 * Worker queue management - coordinate with other workers
 */
async function processWorkerQueue() {
  try {
    const redis = redisPersistence.redis
    if (!redis) return

    // Check for pending work in worker queue
    const queueKey = 'y:worker'
    
    // Try to claim work from the queue (using Redis streams with consumer groups)
    try {
      const results = await redis.xreadgroup(
        'GROUP', 'workers', WORKER_ID,
        'COUNT', BATCH_SIZE,
        'BLOCK', 1000, // 1 second timeout
        'STREAMS', queueKey, '>'
      )
      
      if (results && results.length > 0) {
        const [, entries] = results[0]
        console.log(`📋 Processing ${entries.length} work items from queue`)
        
        for (const [id, fields] of entries) {
          const roomName = fields[1] // Assuming format ['room', roomName, 'action', actionType]
          const action = fields[3] // action type: 'activity' or 'empty'
          
          if (roomName) {
            if (action === 'empty') {
              console.log(`📢 Received empty notification for room: ${roomName}`)
              await handleEmptyRoom(roomName)
            } else {
              await persistRoomData(roomName)
            }
            // Acknowledge processing
            await redis.xack(queueKey, 'workers', id)
          }
        }
      }
    } catch (groupError) {
      // Consumer group might not exist, create it
      if (groupError.message.includes('NOGROUP')) {
        try {
          await redis.xgroup('CREATE', queueKey, 'workers', '0', 'MKSTREAM')
          console.log('✅ Created worker consumer group')
        } catch (createError) {
          if (!createError.message.includes('BUSYGROUP')) {
            console.error('❌ Error creating consumer group:', createError)
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Error processing worker queue:', error)
  }
}

/**
 * Cleanup inactive rooms from Redis
 */
async function cleanupInactiveRooms() {
  try {
    console.info('🧹 Starting cleanup of inactive rooms...')
    const redis = redisPersistence.redis
    if (!redis) return

    const now = Date.now()
    let cleanedCount = 0

    // Check all known rooms for inactivity
    for (const [roomName, lastActivity] of roomActivities.entries()) {
      const inactiveTime = now - lastActivity
      
      if (inactiveTime > ROOM_INACTIVE_THRESHOLD) {
        console.info(`🗑️ Cleaning inactive room: ${roomName} (inactive for ${Math.round(inactiveTime / 3600000)}h)`)
        
        try {
          // Clean up Redis keys for this room
          const keysToDelete = await redis.keys(`${roomName}:*`)
          if (keysToDelete.length > 0) {
            await redis.del(...keysToDelete)
            console.info(`🗑️ Deleted ${keysToDelete.length} Redis keys for room: ${roomName}`)
          }
          
          // Remove from activity tracking
          roomActivities.delete(roomName)
          cleanedCount++
          
        } catch (cleanupError) {
          console.error(`❌ Error cleaning room ${roomName}:`, cleanupError)
        }
      }
    }

    if (cleanedCount > 0) {
      console.info(`✅ Cleanup completed: ${cleanedCount} inactive rooms cleaned`)
    } else {
      console.info('✅ Cleanup completed: No inactive rooms found')
    }
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error)
  }
}

/**
 * Main worker loop
 */
async function workerLoop() {
  while (isRunning) {
    try {
      console.info('🔄 Worker heartbeat - discovering active rooms...')
      
      // Discover active rooms
      const activeRooms = await discoverActiveRooms()
      console.info(`📋 Found ${activeRooms.length} active rooms`)
      
      // Process worker queue for coordinated work
      await processWorkerQueue()
      
      // Persist active rooms (if not already being processed)
      for (const roomName of activeRooms) {
        if (!processingRooms.has(roomName)) {
          await persistRoomData(roomName)
        }
      }
      
    } catch (error) {
      console.error('❌ Error in worker loop:', error)
    }
    
    // Wait before next iteration
    await delay(PERSIST_INTERVAL)
  }
}

/**
 * Cleanup loop (runs less frequently)
 */
async function cleanupLoop() {
  while (isRunning) {
    try {
      await cleanupInactiveRooms()
    } catch (error) {
      console.error('❌ Error in cleanup loop:', error)
    }
    
    // Wait before next cleanup cycle
    await delay(CLEANUP_INTERVAL)
  }
}

/**
 * Persist room data from Redis to storage
 * @param {string} roomName 
 */
async function persistRoomData(roomName) {
  if (processingRooms.has(roomName)) {
    return // Already processing
  }

  processingRooms.add(roomName)
  
  try {
    console.info(`💾 Persisting room data: ${roomName}`)
    
    // Update room activity timestamp
    updateRoomActivity(roomName)
    
    let doc = null
    let shouldCleanupDoc = false
    
    // Check if room is already bound to avoid "already bound" error
    if (redisPersistence.docs.has(roomName)) {
      console.info(`📄 Room ${roomName} already bound, using existing document`)
      doc = redisPersistence.docs.get(roomName)
      
      if (!doc) {
        console.info(`📄 Document ${roomName} not found in persistence, skipping`)
        return
      }
    } else {
      // Create a new document for loading state
      doc = new Y.Doc()
      shouldCleanupDoc = true
      
      try {
        // Bind to Redis to load existing state
        await redisPersistence.bindState(roomName, doc)
        
        // Wait for data to load and stabilize
        await delay(1000)
        
      } catch (bindError) {
        console.error(`❌ Error binding document ${roomName}:`, bindError)
        doc.destroy()
        return
      }
    }
    
    // Simple validation - just check if store exists
    if (!doc.store) {
      console.info(`📄 Document ${roomName} has no store, skipping persistence`)
      if (shouldCleanupDoc) doc.destroy()
      return
    }
    
    // Try to encode the document to see if it's valid
    try {
      const update = Y.encodeStateAsUpdateV2(doc)
      if (!update || update.length === 0) {
        console.info(`📄 Document ${roomName} produces empty update, skipping persistence`)
        if (shouldCleanupDoc) doc.destroy()
        return
      }
      console.log(`📄 Document ${roomName} encoded successfully (${update.length} bytes)`)
    } catch (encodeError) {
      console.error(`❌ Document ${roomName} cannot be encoded:`, encodeError.message)
      if (shouldCleanupDoc) doc.destroy()
      return
    }

    // Persist to permanent storage (S3, Memory, etc.)
    await storage.persistDoc(roomName, 'default', doc)
    
    console.info(`✅ Successfully persisted room: ${roomName}`)
    
    // Check if room has active connections by looking at activity
    const redis = redisPersistence.redis
    if (redis) {
      try {
        // Check if there are any recent activity notifications in worker queue for this room
        const isRoomActive = await checkRoomActiveConnections(roomName)
        
        if (!isRoomActive) {
          console.info(`🧹 Room ${roomName} has no active connections, cleaning Redis keys...`)
          
          // Clean up Redis keys for this room
          const keysToDelete = await redis.keys(`${roomName}:*`)
          if (keysToDelete.length > 0) {
            await redis.del(...keysToDelete)
            console.info(`🗑️ Deleted ${keysToDelete.length} Redis keys for inactive room: ${roomName}`)
          }
        } else {
          console.info(`👥 Room ${roomName} has active connections, keeping Redis data`)
        }
      } catch (cleanupError) {
        console.error(`❌ Error checking/cleaning room ${roomName}:`, cleanupError)
      }
    }
    
    // Clean up the document only if we created it (keep active docs in memory)
    if (shouldCleanupDoc) {
      doc.destroy()
    }
    
  } catch (error) {
    console.error(`❌ Error persisting room ${roomName}:`, error)
  } finally {
    processingRooms.delete(roomName)
  }
}

/**
 * Register a room for monitoring
 * This would typically be called when a new document is created
 */
function registerRoom(roomName) {
  knownRooms.add(roomName)
  console.info(`📝 Registered room for monitoring: ${roomName}`)
}

/**
 * Persist a specific document (for when we have the actual document)
 * @param {string} roomName 
 * @param {Y.Doc} doc 
 */
async function persistDocument(roomName, doc) {
  if (processingRooms.has(roomName)) {
    return // Already processing
  }

  processingRooms.add(roomName)
  
  try {
    console.info(`📝 Persisting document: ${roomName}`)
    
    // Check if document has content worth persisting
    // Safe way to check if document has content
    const hasContent = doc.store && doc.store.structs && 
                      Object.keys(doc.store.structs).length > 0
    
    if (!hasContent) {
      console.info(`📄 Document ${roomName} is empty, skipping persistence`)
      return
    }

    // Persist to permanent storage (S3, Memory, etc.)
    await storage.persistDoc(roomName, 'default', doc)
    
    console.info(`✅ Successfully persisted document: ${roomName}`)
    
  } catch (error) {
    console.error(`❌ Error persisting document ${roomName}:`, error)
  } finally {
    processingRooms.delete(roomName)
  }
}

/**
 * Graceful shutdown
 */
async function shutdown() {
  console.log('\n🛑 Shutting down worker...')
  isRunning = false
  
  // Wait for current processing to complete
  while (processingRooms.size > 0) {
    console.log(`⏳ Waiting for ${processingRooms.size} documents to finish processing...`)
    await delay(1000)
  }
  
  try {
    await storage.destroy()
    await redisPersistence.destroy()
    console.log('✅ Worker shutdown complete')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error during shutdown:', error)
    process.exit(1)
  }
}

// Handle graceful shutdown
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

// Handle unhandled errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error)
  shutdown()
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error)
  shutdown()
})

// Start the worker
console.log('✅ y-redis worker started successfully!')
console.log('🔄 Worker will persist documents from Redis to storage')
console.log('🧹 Worker will cleanup inactive rooms based on activity')
console.log(`💾 Storage backend: ${process.env.STORAGE_TYPE || 'memory'}`)
console.log(`📋 Worker queue coordination: y:worker stream`)

// Start both worker loops
Promise.all([
  workerLoop().catch(error => {
    console.error('❌ Fatal error in worker loop:', error)
    shutdown()
  }),
  cleanupLoop().catch(error => {
    console.error('❌ Fatal error in cleanup loop:', error)
    shutdown()
  })
])

// Export functions for potential use by the server
export { registerRoom, persistDocument, updateRoomActivity } 