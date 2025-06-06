import 'dotenv/config'
import { RedisPersistence } from 'y-redis'
import { createStorage } from './src/storage/index.js'
import { 
  discoverActiveRooms, 
  processWorkerQueue, 
  processingRooms, 
  roomActivities, 
  registerRoom 
} from './src/worker/room-discovery.js'
import { persistRoomData, persistDocument } from './src/worker/persistence.js'
import { extractDocumentJson, sendApiCallback } from './src/worker/api-callbacks.js'
import { maintainStream } from './src/worker/stream-cleanup.js'

// Simple delay function
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// Configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379/1'
const WORKER_ID = process.env.WORKER_ID || `worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
const PERSIST_INTERVAL = parseInt(process.env.PERSIST_INTERVAL) || 30000 // 30 seconds
const CLEANUP_INTERVAL = parseInt(process.env.CLEANUP_INTERVAL) || 300000 // 5 minutes
const ROOM_INACTIVE_THRESHOLD = parseInt(process.env.ROOM_INACTIVE_THRESHOLD) || 86400000 // 24 hours
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 10 // Process 10 documents at a time
const API_CALLBACK_INTERVAL = parseInt(process.env.API_CALLBACK_INTERVAL) || 60000 // 60 seconds
const API_CALLBACK_ENABLED = process.env.API_CALLBACK_ENABLED !== 'false' // Enable by default
const STREAM_CLEANUP_INTERVAL = parseInt(process.env.STREAM_CLEANUP_INTERVAL) || 3600000 // 1 hour
const STREAM_MAX_LENGTH = parseInt(process.env.STREAM_MAX_LENGTH) || 10000 // Max messages in stream
const STREAM_MAX_AGE = parseInt(process.env.STREAM_MAX_AGE) || 86400000 // 24 hours

console.log('🔧 Starting y-redis persistence worker...')
console.log(`🆔 Worker ID: ${WORKER_ID}`)
console.log(`🔗 Redis: ${REDIS_URL}`)
console.log(`⏱️  Persist Interval: ${PERSIST_INTERVAL}ms`)
console.log(`🧹 Cleanup Interval: ${CLEANUP_INTERVAL}ms`)
console.log(`⏰ Room Inactive Threshold: ${ROOM_INACTIVE_THRESHOLD}ms (${Math.round(ROOM_INACTIVE_THRESHOLD / 3600000)}h)`)
console.log(`🔔 API Callback Interval: ${API_CALLBACK_INTERVAL}ms`)
console.log(`🔔 API Callback Enabled: ${API_CALLBACK_ENABLED}`)
console.log(`🧹 Stream Cleanup Interval: ${STREAM_CLEANUP_INTERVAL}ms (${Math.round(STREAM_CLEANUP_INTERVAL / 3600000)}h)`)
console.log(`📏 Stream Max Length: ${STREAM_MAX_LENGTH} messages`)
console.log(`⏰ Stream Max Age: ${STREAM_MAX_AGE}ms (${Math.round(STREAM_MAX_AGE / 3600000)}h)`)

// Log storage configuration for worker
const storageType = process.env.STORAGE_TYPE || 'memory'
console.log(`💾 Worker Storage Type: ${storageType.toUpperCase()}`)
if (storageType === 's3') {
  const bucket = process.env.S3_BUCKET || 'not set'
  const endpoint = process.env.S3_ENDPOINT || 'not set'
  console.log(`🪣 Worker S3 Configuration: bucket="${bucket}", endpoint="${endpoint}"`)
}

// Create Redis persistence and storage using database isolation
const redisPersistence = new RedisPersistence({
  redisOpts: { url: REDIS_URL }
})

const storage = createStorage()

let isRunning = true

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
      const activeRooms = await discoverActiveRooms(redisPersistence)
      console.info(`📋 Found ${activeRooms.length} active rooms`)
      
      // Process worker queue for coordinated work
      await processWorkerQueue(
        redisPersistence, 
        WORKER_ID, 
        BATCH_SIZE, 
        (roomName) => persistRoomData(roomName, redisPersistence, storage, API_CALLBACK_ENABLED)
      )
      
      // Persist active rooms (if not already being processed)
      for (const roomName of activeRooms) {
        if (!processingRooms.has(roomName)) {
          await persistRoomData(roomName, redisPersistence, storage, API_CALLBACK_ENABLED)
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
 * API callback loop - periodically send updates for all active rooms
 */
async function apiCallbackLoop() {
  if (!API_CALLBACK_ENABLED) {
    console.info('🔔 API callback disabled, skipping callback loop')
    return
  }

  console.info('🔔 Starting API callback loop...')
  
  while (isRunning) {
    try {
      await delay(API_CALLBACK_INTERVAL)
      
      if (!isRunning) break
      
      console.info('🔔 Running periodic API callback...')
      
      // Get all active rooms with documents
      const activeRooms = Array.from(redisPersistence.docs.keys())
      
      if (activeRooms.length === 0) {
        console.debug('🔍 No active rooms for API callback')
        continue
      }
      
      console.info(`🔔 Processing API callbacks for ${activeRooms.length} active rooms`)
      
      for (const roomName of activeRooms) {
        try {
          const doc = redisPersistence.docs.get(roomName)
          if (doc && doc.store) {
            const jsonData = extractDocumentJson(roomName, doc)
            if (jsonData.metadata.hasContent) {
              await sendApiCallback(jsonData)
              console.debug(`🔔 Periodic API callback sent for room: ${roomName}`)
            }
          }
        } catch (roomError) {
          console.error(`❌ Error processing API callback for room ${roomName}:`, roomError)
        }
        
        // Small delay between room callbacks to avoid overwhelming the API
        await delay(100)
      }
      
      console.info(`🔔 Completed periodic API callbacks for ${activeRooms.length} rooms`)
      
    } catch (error) {
      console.error('❌ Error in API callback loop:', error)
      await delay(5000) // Wait 5 seconds before retrying
    }
  }
  
  console.info('🔔 API callback loop stopped')
}

/**
 * Stream cleanup loop - periodically clean Redis streams to prevent infinite growth
 */
async function streamCleanupLoop() {
  console.info('🧹 Starting stream cleanup loop...')
  
  while (isRunning) {
    try {
      await delay(STREAM_CLEANUP_INTERVAL)
      
      if (!isRunning) break
      
      console.info('🧹 Running periodic stream cleanup...')
      
      const redis = redisPersistence.redis
      if (!redis) {
        console.debug('🔍 No Redis client available for stream cleanup')
        continue
      }
      
      // Clean up the worker queue stream
      const streamKey = 'y:worker'
      const groupName = 'workers'
      
      const result = await maintainStream(redis, streamKey, groupName, {
        maxLength: STREAM_MAX_LENGTH,
        maxAge: STREAM_MAX_AGE,
        trimStrategy: 'MAXLEN', // Keep most recent messages
        cleanupProcessed: true,
        minIdleTime: 2 * 60 * 60 * 1000, // 2 hours
        logResults: true
      })
      
      if (result.error) {
        console.error(`❌ Stream cleanup failed: ${result.error}`)
      } else {
        console.info(`✅ Stream cleanup completed - trimmed: ${result.streamTrim?.trimmed || 0}, processed: ${result.processedCleanup?.processed || 0}`)
      }
      
    } catch (error) {
      console.error('❌ Error in stream cleanup loop:', error)
      await delay(10000) // Wait 10 seconds before retrying
    }
  }
  
  console.info('🧹 Stream cleanup loop stopped')
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

// Start all worker loops
Promise.all([
  workerLoop().catch(error => {
    console.error('❌ Fatal error in worker loop:', error)
    shutdown()
  }),
  cleanupLoop().catch(error => {
    console.error('❌ Fatal error in cleanup loop:', error)
    shutdown()
  }),
  apiCallbackLoop().catch(error => {
    console.error('❌ Fatal error in API callback loop:', error)
    shutdown()
  }),
  streamCleanupLoop().catch(error => {
    console.error('❌ Fatal error in stream cleanup loop:', error)
    shutdown()
  })
])

// Export functions for potential use by the server
export { registerRoom, persistDocument } 