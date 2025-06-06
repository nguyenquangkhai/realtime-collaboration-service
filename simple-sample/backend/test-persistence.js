import 'dotenv/config'
import * as Y from 'yjs'
import { RedisPersistence } from 'y-redis'
import { createStorage } from './src/storage/index.js'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379/1'

console.log('🧪 Testing persistence flow...')

// Create Redis persistence and storage using database isolation
const redisPersistence = new RedisPersistence({
  redisOpts: { url: REDIS_URL }
})

const storage = createStorage()

async function testPersistence() {
  try {
    // Create a test document
    const doc = new Y.Doc()
    const text = doc.getText('content')
    
    // Add some content
    text.insert(0, 'Hello, this is a test document for persistence!')
    
    const roomName = 'test-room-' + Date.now()
    console.log(`📝 Creating test document: ${roomName}`)
    
    // Bind to Redis (this simulates what the server does)
    await redisPersistence.bindState(roomName, doc)
    
    // Wait a bit for Redis to sync
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    console.log('✅ Document created and synced to Redis')
    
    // Now test persistence to S3
    console.log('💾 Testing S3 persistence...')
    await storage.persistDoc(roomName, 'default', doc)
    console.log('✅ Document persisted to S3!')
    
    // Test retrieval
    console.log('📥 Testing S3 retrieval...')
    const retrieved = await storage.retrieveDoc(roomName, 'default')
    
    if (retrieved) {
      console.log('✅ Document retrieved from S3!')
      console.log(`📄 Retrieved ${retrieved.references.length} references`)
      
      // Create a new doc and apply the retrieved state
      const newDoc = new Y.Doc()
      Y.applyUpdateV2(newDoc, retrieved.doc)
      const retrievedText = newDoc.getText('content').toString()
      console.log(`📝 Retrieved content: "${retrievedText}"`)
      
      if (retrievedText === 'Hello, this is a test document for persistence!') {
        console.log('🎉 Persistence test PASSED!')
      } else {
        console.log('❌ Content mismatch!')
      }
    } else {
      console.log('❌ Failed to retrieve document from S3')
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  } finally {
    await redisPersistence.destroy()
    await storage.destroy()
    process.exit(0)
  }
}

testPersistence() 