import WebSocket from 'ws'
import * as Y from 'yjs'
import * as syncProtocol from 'y-protocols/sync'
import * as awarenessProtocol from 'y-protocols/awareness'
import { encoding, decoding } from 'lib0'

const messageSync = 0
const messageAwareness = 1

function createWebSocketClient(roomName) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:3001/${roomName}`)
    const doc = new Y.Doc()
    const text = doc.getText('content')
    
    ws.binaryType = 'arraybuffer'
    
    ws.on('open', () => {
      console.log(`🔗 Connected to room: ${roomName}`)
      
      // Add some content to the document
      text.insert(0, `Hello from WebSocket client in room ${roomName}!`)
      console.log(`📝 Added content to document`)
      
      // Wait a bit then close
      setTimeout(() => {
        ws.close()
        resolve()
      }, 2000)
    })
    
    ws.on('message', (data) => {
      const decoder = decoding.createDecoder(new Uint8Array(data))
      const encoder = encoding.createEncoder()
      const messageType = decoding.readVarUint(decoder)
      
      switch (messageType) {
        case messageSync:
          encoding.writeVarUint(encoder, messageSync)
          const syncMessageType = syncProtocol.readSyncMessage(decoder, encoder, doc, null)
          if (encoding.length(encoder) > 1) {
            ws.send(encoding.toUint8Array(encoder))
          }
          break
        case messageAwareness:
          // Handle awareness updates
          break
      }
    })
    
    ws.on('error', reject)
    ws.on('close', () => {
      console.log(`📤 Disconnected from room: ${roomName}`)
    })
  })
}

async function testRoomCreation() {
  console.log('🧪 Testing WebSocket room creation...')
  
  try {
    // Create multiple rooms
    await createWebSocketClient('test-room-1')
    await createWebSocketClient('test-room-2')
    await createWebSocketClient('default')
    
    console.log('✅ All rooms created successfully!')
    
    // Wait a bit for Redis to sync
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    console.log('🔍 Checking Redis keys...')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testRoomCreation() 