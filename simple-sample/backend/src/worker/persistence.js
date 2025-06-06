import * as Y from 'yjs'
import { processingRooms, updateRoomActivity, checkRoomActiveConnections } from './room-discovery.js'
import { extractDocumentJson, sendApiCallback } from './api-callbacks.js'

/**
 * Check if a Yjs document has meaningful content structure
 * @param {Y.Doc} doc - The Yjs document to check
 * @param {string} roomName - Room name for logging context
 * @returns {boolean} - True if document has content structure
 */
function checkDocumentStructure(doc, roomName) {
  if (!doc || !doc.store) {
    console.log(`📄 Document ${roomName}: No store structure`)
    return false
  }

  // Check if the document has any shared types with actual content
  const roomPrefix = roomName.split('-')[0]
  
  try {
    switch (roomPrefix) {
      case 'text': {
        const textContent = doc.getText('quill')
        const hasTextContent = textContent && textContent.length > 0
        console.log(`📄 Document ${roomName}: Text content length = ${textContent?.length || 0}`)
        return hasTextContent
      }
      case 'table': {
        const tableArray = doc.getArray('table')
        const hasTableContent = tableArray && tableArray.length > 0
        console.log(`📄 Document ${roomName}: Table array length = ${tableArray?.length || 0}`)
        return hasTableContent
      }
      case 'nodes': {
        const nodesArray = doc.getArray('nodes')
        const edgesArray = doc.getArray('edges')
        const hasNodesContent = (nodesArray && nodesArray.length > 0) || (edgesArray && edgesArray.length > 0)
        console.log(`📄 Document ${roomName}: Nodes array length = ${nodesArray?.length || 0}, Edges array length = ${edgesArray?.length || 0}`)
        return hasNodesContent
      }
      default: {
        // For unknown types, check if there's any content at all
        const contentText = doc.getText('content')
        const hasDefaultContent = contentText && contentText.length > 0
        console.log(`📄 Document ${roomName}: Default content length = ${contentText?.length || 0}`)
        
        // Also check if there are any shared types at all
        const sharedTypes = Object.keys(doc.share || {})
        console.log(`📄 Document ${roomName}: Shared types = ${JSON.stringify(sharedTypes)}`)
        
        return hasDefaultContent || sharedTypes.length > 0
      }
    }
  } catch (error) {
    console.error(`❌ Error checking document structure for ${roomName}:`, error)
    return false
  }
}

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
      
      // Debug: Check what type of object we actually got
      console.log(`🔍 Document type: ${typeof doc}, constructor: ${doc.constructor?.name}`)
      console.log(`🔍 Document has getText: ${typeof doc.getText}, has store: ${!!doc.store}`)
      
      // Check if this is actually a Y.Doc object
      if (typeof doc.getText !== 'function') {
        console.log(`🔍 PersistenceDoc properties: ${Object.keys(doc)}`)
        console.log(`🔍 PersistenceDoc.doc exists: ${!!doc.doc}`)
        console.log(`🔍 PersistenceDoc.ydoc exists: ${!!doc.ydoc}`)
        console.log(`🔍 PersistenceDoc._doc exists: ${!!doc._doc}`)
        
        // Try to access the underlying Y.Doc from common property names
        const possibleDocs = [doc.doc, doc.ydoc, doc._doc, doc.document];
        for (let i = 0; i < possibleDocs.length; i++) {
          const possibleDoc = possibleDocs[i];
          if (possibleDoc && typeof possibleDoc.getText === 'function') {
            console.log(`✅ Found Y.Doc at property index ${i}`);
            doc = possibleDoc; // Use the actual Y.Doc
            break;
          }
        }
        
        // If we still don't have a proper Y.Doc, skip
        if (typeof doc.getText !== 'function') {
          console.warn(`⚠️ Document ${roomName} from Redis persistence is not a proper Y.Doc object, skipping`)
          return
        }
      }
      
      // Ensure shared types are accessible for existing documents
      const roomPrefix = roomName.split('-')[0]
      console.log(`🔧 Ensuring shared types for existing document ${roomName} (type: ${roomPrefix})`)
      
      // Access the shared types to ensure they're properly initialized
      try {
        switch (roomPrefix) {
          case 'text':
            doc.getText('quill') // Ensure text type is accessible
            break
          case 'table':
            doc.getArray('table') // Ensure array type is accessible
            break
          case 'nodes':
            doc.getArray('nodes') // Ensure nodes array is accessible
            doc.getArray('edges') // Ensure edges array is accessible
            break
          default:
            doc.getText('content') // Default fallback
        }
      } catch (accessError) {
        console.warn(`⚠️ Could not access shared types for ${roomName}:`, accessError.message)
      }
    } else {
      // Create a new document for loading state
      doc = new Y.Doc()
      shouldCleanupDoc = true
      
      // Initialize document structure based on room name prefix
      const roomPrefix = roomName.split('-')[0]
      console.log(`🔧 Initializing document structure for ${roomName} (type: ${roomPrefix})`)
      
      // Initialize the expected data structures based on app type
      switch (roomPrefix) {
        case 'text':
          doc.getText('quill') // Initialize text structure for Quill
          break
        case 'table':
          doc.getArray('table') // Initialize array structure for table data
          break
        case 'nodes':
          doc.getArray('nodes') // Initialize nodes array for node diagrams
          doc.getArray('edges') // Initialize edges array for node diagrams
          break
        default:
          console.warn(`⚠️ Unknown room type: ${roomPrefix}, using default text structure`)
          doc.getText('content') // Default fallback
      }
      
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
    
    // Better validation - check for actual content rather than just store existence
    const hasValidStructure = checkDocumentStructure(doc, roomName)
    console.log(`📄 Document ${roomName} has valid structure: ${hasValidStructure}`)
    if (!hasValidStructure) {
      console.info(`📄 Document ${roomName} has no meaningful content, skipping persistence`)
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