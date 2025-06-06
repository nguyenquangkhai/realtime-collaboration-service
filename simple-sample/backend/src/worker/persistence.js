import * as Y from 'yjs'
import { processingRooms, updateRoomActivity, checkRoomActiveConnections } from './room-discovery.js'
import { extractDocumentJson, sendApiCallback } from './api-callbacks.js'

/**
 * Persist room data from Redis to storage
 * @param {string} roomName 
 * @param {RedisPersistence} redisPersistence
 * @param {Storage} storage
 * @param {boolean} apiCallbackEnabled
 */
export async function persistRoomData(roomName, redisPersistence, storage, apiCallbackEnabled = true) {
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
        await new Promise(resolve => setTimeout(resolve, 1000))
        
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
    
    // Extract JSON data and send API callback
    if (apiCallbackEnabled) {
      try {
        const jsonData = extractDocumentJson(roomName, doc)
        if (jsonData.metadata.hasContent) {
          await sendApiCallback(jsonData)
          console.info(`🔔 API callback sent for room: ${roomName}`)
        } else {
          console.debug(`🔍 Skipping API callback for empty room: ${roomName}`)
        }
      } catch (callbackError) {
        console.error(`❌ Error in API callback for room ${roomName}:`, callbackError)
      }
    }
    
    console.info(`✅ Successfully persisted room: ${roomName}`)
    
    // Check if room has active connections by looking at activity
    const redis = redisPersistence.redis
    if (redis) {
      try {
        // Check if there are any recent activity notifications in worker queue for this room
        const isRoomActive = await checkRoomActiveConnections(roomName, redisPersistence)
        
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
 * Persist a specific document (for when we have the actual document)
 * @param {string} roomName 
 * @param {Y.Doc} doc 
 * @param {Storage} storage
 */
export async function persistDocument(roomName, doc, storage) {
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