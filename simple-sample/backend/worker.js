import 'dotenv/config'
import * as Y from 'yjs'
import { RedisPersistence } from 'y-redis'
import { createStorage } from './src/storage/index.js'
// Simple delay function
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// Configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
const WORKER_ID = process.env.WORKER_ID || `worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
const PERSIST_INTERVAL = parseInt(process.env.PERSIST_INTERVAL) || 30000 // 30 seconds
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 10 // Process 10 documents at a time

console.log('🔧 Starting y-redis persistence worker...')
console.log(`🆔 Worker ID: ${WORKER_ID}`)
console.log(`🔗 Redis: ${REDIS_URL}`)
console.log(`⏱️  Persist Interval: ${PERSIST_INTERVAL}ms`)

// Create Redis persistence and storage
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
 * Simplified worker that demonstrates the concept
 * In a real y-redis implementation, this would be more sophisticated
 */
async function workerLoop() {
  while (isRunning) {
    try {
      console.info('🔄 Worker heartbeat - ready to persist documents...')
      
      // For now, this is a simplified worker that just demonstrates
      // the persistence concept. In a real implementation, you would:
      //
      // 1. Monitor Redis streams for documents that need persistence
      // 2. Use y-redis APIs to get document states
      // 3. Persist to your storage backend
      // 4. Clean up old Redis data
      //
      // Since the exact y-redis API for getting all rooms isn't clear,
      // we'll just log that the worker is running and ready.
      
      if (knownRooms.size > 0) {
        console.info(`📋 Monitoring ${knownRooms.size} known rooms for persistence`)
        
        // Here you would normally:
        // - Check which documents need persistence
        // - Load documents from Redis
        // - Save to permanent storage
        // - Clean up Redis cache
        
        for (const roomName of knownRooms) {
          if (!processingRooms.has(roomName)) {
            console.info(`💤 Room ${roomName} up to date`)
          }
        }
      } else {
        console.info('💤 No active rooms to monitor')
      }
      
    } catch (error) {
      console.error('❌ Error in worker loop:', error)
    }
    
    // Wait before next iteration
    await delay(PERSIST_INTERVAL)
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
    if (doc.store.structs.clients.size === 0) {
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