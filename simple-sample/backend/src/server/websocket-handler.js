import * as Y from 'yjs'
import * as syncProtocol from 'y-protocols/sync'
import * as awarenessProtocol from 'y-protocols/awareness'
import { encoding, decoding } from 'lib0'
import { getAppTypeFromRequest, getAppInstances } from './app-config.js'
import { 
  docs, 
  docAwareness, 
  addRoomConnection, 
  removeRoomConnection, 
  loadInitialDocumentState 
} from './room-manager.js'

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
 * Setup WebSocket connection for collaborative editing
 */
export const setupWSConnection = (redisPersistenceInstances, storageInstances) => {
  return async (conn, req, { docName = req.url.slice(1).split('?')[0] || 'default' } = {}) => {
    conn.binaryType = 'arraybuffer'
    
    // Determine app type from request
    const appType = getAppTypeFromRequest(req, docName)
    const { config } = getAppInstances(appType, redisPersistenceInstances, storageInstances)
    
    console.log(`🔌 New connection to room: ${docName} (app: ${appType})`)
    
    // Track this connection
    addRoomConnection(docName, conn, appType, redisPersistenceInstances)
    
    // Get or create document
    let doc = docs.get(docName)
    let awareness = docAwareness.get(docName)
    
    if (!doc) {
      doc = new Y.Doc()
      docs.set(docName, doc)
      
      // Load initial state from persistent storage + Redis
      try {
        await loadInitialDocumentState(docName, doc, appType, redisPersistenceInstances, storageInstances)
      } catch (error) {
        console.error(`❌ Failed to load initial state for ${docName}:`, error)
        // Continue with empty document
      }
      
      console.log(`📄 Created new document: ${docName} (${config.description})`)
    }
    
    // Ensure awareness exists (might be missing even if doc exists)
    if (!awareness) {
      awareness = new awarenessProtocol.Awareness(doc)
      docAwareness.set(docName, awareness)
      console.log(`📡 Created awareness for existing document: ${docName} (${config.description})`)
    }

    const encoder = encoding.createEncoder()
    
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
      removeRoomConnection(docName, conn, appType, redisPersistenceInstances)
      console.log(`📤 Client disconnected from: ${docName} (${appType})`)
    })
    
    console.log(`📥 Client connected to: ${docName} (${appType})`)
  }
} 