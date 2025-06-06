import * as Y from 'yjs'
import { getAppInstances } from './app-config.js'

// Store documents and awareness instances (for active rooms only)
export const docs = new Map()
export const docAwareness = new Map()
export const roomConnections = new Map() // Track active connections per room
export const roomLastActivity = new Map() // Track last activity per room

/**
 * Update room activity and notify worker queue
 */
export async function updateRoomActivity(docName, appType, redisPersistenceInstances) {
  roomLastActivity.set(docName, Date.now())
  
  // Notify worker queue for coordination
  try {
    const { redisPersistence } = getAppInstances(appType, redisPersistenceInstances, new Map())
    const redis = redisPersistence.redis
    if (redis) {
      await redis.xadd('y:worker', '*', 'room', docName, 'action', 'activity', 'appType', appType)
    }
  } catch (error) {
    console.error(`❌ Error notifying worker queue for room ${docName}:`, error)
  }
}

/**
 * Load initial document state from Redis and persistent storage
 */
export async function loadInitialDocumentState(docName, doc, appType, redisPersistenceInstances, storageInstances) {
  try {
    console.log(`📥 Loading initial state for room: ${docName} (app: ${appType})`)
    
    const { redisPersistence, storage, config } = getAppInstances(appType, redisPersistenceInstances, storageInstances)
    
    // First, try to load from persistent storage (S3, etc.)
    try {
      const persistedData = await storage.retrieveDoc(docName, 'default')
      if (persistedData && persistedData.doc) {
        console.log(`📦 ✅ RESTORED: Loaded ${persistedData.doc.length} bytes from ${config.storagePrefix} storage for room: ${docName}`)
        if (storage.bucketName) {
          console.log(`🪣 S3 Source: bucket="${storage.bucketName}", prefix="${storage.prefix}"`)
        }
        Y.applyUpdateV2(doc, persistedData.doc)
      } else {
        console.log(`📦 ❌ NO DATA: No persisted data found for room ${docName} in ${config.storagePrefix}`)
      }
    } catch (storageError) {
      console.log(`📦 ❌ ERROR: Failed to load persisted data for room ${docName} in ${config.storagePrefix}:`, storageError.message)
    }
    
    // Then, bind to Redis for real-time updates
    await redisPersistence.bindState(docName, doc)
    console.log(`🔗 Bound room ${docName} to Redis DB ${config.redisDatabase}`)
    
  } catch (error) {
    console.error(`❌ Error loading initial state for ${docName}:`, error)
    throw error
  }
}

/**
 * Track connection counts per room
 */
export function addRoomConnection(docName, conn, appType, redisPersistenceInstances) {
  if (!roomConnections.has(docName)) {
    roomConnections.set(docName, new Set())
  }
  roomConnections.get(docName).add(conn)
  updateRoomActivity(docName, appType, redisPersistenceInstances)
  console.log(`👥 Room ${docName} (${appType}) now has ${roomConnections.get(docName).size} connections`)
}

/**
 * Remove room connection and handle empty rooms
 */
export async function removeRoomConnection(docName, conn, appType, redisPersistenceInstances) {
  if (roomConnections.has(docName)) {
    roomConnections.get(docName).delete(conn)
    const remainingConnections = roomConnections.get(docName).size
    
    console.log(`👥 Room ${docName} (${appType}) now has ${remainingConnections} connections`)
    
    if (remainingConnections === 0) {
      roomConnections.delete(docName)
      console.log(`📤 Room ${docName} (${appType}) is now empty`)
      
      // Notify worker that room is now empty
      try {
        const { redisPersistence } = getAppInstances(appType, redisPersistenceInstances, new Map())
        const redis = redisPersistence.redis
        if (redis) {
          await redis.xadd('y:worker', '*', 'room', docName, 'action', 'empty', 'appType', appType)
          console.log(`📢 Notified worker that room ${docName} (${appType}) is empty`)
        }
      } catch (error) {
        console.error(`❌ Error notifying worker about empty room ${docName}:`, error)
      }
    }
  }
}

/**
 * Cleanup inactive documents from server memory
 */
export async function cleanupInactiveDocuments(cleanupInterval) {
  const now = Date.now()
  const INACTIVE_THRESHOLD = cleanupInterval * 2 // 20 minutes by default
  
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