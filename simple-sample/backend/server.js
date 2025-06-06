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
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

console.log('🚀 Starting y-redis collaborative server...')
console.log(`📡 Server: http://${HOST}:${PORT}`)
console.log(`🔗 Redis: ${REDIS_URL}`)

// Create Redis persistence
const redisPersistence = new RedisPersistence({
  redisOpts: { url: REDIS_URL }
})

// Create storage provider (S3, Memory, etc.)
const storage = createStorage()

// Store documents and awareness instances
const docs = new Map()
const docAwareness = new Map()

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

const setupWSConnection = (conn, req, { docName = req.url.slice(1).split('?')[0] || 'default' } = {}) => {
  conn.binaryType = 'arraybuffer'
  
  // Get or create document
  let doc = docs.get(docName)
  let awareness = docAwareness.get(docName)
  
  if (!doc) {
    doc = new Y.Doc()
    docs.set(docName, doc)
    
    // Bind Redis persistence
    redisPersistence.bindState(docName, doc)
    
    // Create awareness
    awareness = new awarenessProtocol.Awareness(doc)
    docAwareness.set(docName, awareness)
    
    console.log(`📄 Created new document: ${docName}`)
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
    awareness.destroy()
    console.log(`📤 Client disconnected from: ${docName}`)
  })
  
  console.log(`📥 Client connected to: ${docName}`)
}

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