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
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 10 // Process 10 documents at a time

console.log('🔧 Starting y-redis persistence worker...')
console.log(`🆔 Worker ID: ${WORKER_ID}`)
console.log(`🔗 Redis: ${REDIS_URL}`)
console.log(`⏱️  Persist Interval: ${PERSIST_INTERVAL}ms`)

// Create Redis persistence and storage using database isolation
const redisPersistence = new RedisPersistence({
  redisOpts: { url: REDIS_URL }
})

const storage = createStorage()

// Track processing state
const processingRooms = new Set()
let isRunning = true

// Keep track of known rooms (in a real implementation, this would come from Redis)
const knownRooms = new Set()

/**
 * Discover active rooms from Redis by scanning for y-redis keys
 */
async function discoverRoomsFromRedis() {
  try {
    // Get Redis client from redisPersistence
    const redis = redisPersistence.redis;
    if (!redis) {
      console.info('📡 Redis client not available for room discovery');
      return [];
    }

    // Look for y-redis stream keys ending with :updates
    // Keys will be at the database level like: room1:updates
    const allKeys = await redis.keys('*:updates');
    console.log('🔍 Found keys ending with :updates:', allKeys);
    
    // Extract room names from keys ending with :updates
    const rooms = allKeys
      .filter(key => key.endsWith(':updates'))
      .map(key => key.replace(':updates', ''))
      .filter(room => room && room !== '')
      .filter((room, index, self) => self.indexOf(room) === index); // unique rooms

    console.log('🔍 Extracted rooms:', rooms);
    return rooms;
  } catch (error) {
    console.error('❌ Error discovering rooms from Redis:', error);
    return [];
  }
}

/**
 * Worker loop that discovers and monitors active rooms
 */
async function workerLoop() {
  while (isRunning) {
    try {
      console.info('🔄 Worker heartbeat - discovering active rooms...')
      
      // Discover rooms from Redis
      const discoveredRooms = await discoverRoomsFromRedis();
      
      // Update known rooms
      const previousCount = knownRooms.size;
      knownRooms.clear();
      discoveredRooms.forEach(room => knownRooms.add(room));
      
      if (knownRooms.size !== previousCount) {
        console.info(`📋 Room discovery: ${knownRooms.size} active rooms found`);
      }
      
      if (knownRooms.size > 0) {
        console.info(`📋 Monitoring rooms: [${Array.from(knownRooms).join(', ')}]`);
        
        // Persist each room's data
        for (const roomName of knownRooms) {
          if (!processingRooms.has(roomName)) {
            await persistRoomData(roomName);
          }
        }
      } else {
        console.info('💤 No active rooms to monitor');
      }
      
    } catch (error) {
      console.error('❌ Error in worker loop:', error)
    }
    
    // Wait before next iteration
    await delay(PERSIST_INTERVAL)
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
        
        // Wait longer for data to load and stabilize
        await delay(1000)
        
        // Verify the document was properly loaded
        if (!doc.store || !doc.store.clients) {
          console.info(`📄 Document ${roomName} failed to load properly from Redis, skipping`)
          doc.destroy()
          return
        }
      } catch (bindError) {
        console.error(`❌ Error binding document ${roomName}:`, bindError)
        doc.destroy()
        return
      }
    }
    
    // Debug the actual store structure
    console.log(`🔍 Debugging document ${roomName} structure:`)
    console.log(`  - doc.store exists:`, !!doc.store)
    if (doc.store) {
      console.log(`  - doc.store.clients exists:`, !!doc.store.clients)
      console.log(`  - doc.store.clients type:`, typeof doc.store.clients)
      console.log(`  - doc.store.structs exists:`, !!doc.store.structs)
      if (doc.store.structs) {
        console.log(`  - doc.store.structs keys:`, Object.keys(doc.store.structs))
      }
      console.log(`  - Available store properties:`, Object.keys(doc.store))
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

    // Additional validation: try to get a state vector to ensure document is ready
    try {
      const stateVector = Y.encodeStateVector(doc)
      if (!stateVector || stateVector.length === 0) {
        console.info(`📄 Document ${roomName} has empty state vector, skipping persistence`)
        if (shouldCleanupDoc) doc.destroy()
        return
      }
    } catch (stateError) {
      console.error(`❌ Error getting state vector for ${roomName}:`, stateError)
      if (shouldCleanupDoc) doc.destroy()
      return
    }

    // Persist to permanent storage (S3, Memory, etc.)
    await storage.persistDoc(roomName, 'default', doc)
    
    console.info(`✅ Successfully persisted room: ${roomName}`)
    
    // Clean up the document only if we created it
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
console.log(`💾 Storage backend: ${process.env.STORAGE_TYPE || 'memory'}`)
console.log('💡 This is a simplified worker for demonstration purposes')

// Start the main worker loop
workerLoop().catch(error => {
  console.error('❌ Fatal error in worker loop:', error)
  shutdown()
})

// Export functions for potential use by the server
export { registerRoom, persistDocument } 