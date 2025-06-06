import 'dotenv/config'
import { WebSocketServer } from 'ws'
import { initializeAppInstances } from './src/server/app-config.js'
import { setupWSConnection } from './src/server/websocket-handler.js'
import { cleanupInactiveDocuments } from './src/server/room-manager.js'

// Configuration
const PORT = process.env.PORT || 3001
const HOST = process.env.HOST || 'localhost'
const BASE_REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
const DOC_CLEANUP_INTERVAL = parseInt(process.env.DOC_CLEANUP_INTERVAL) || 600000 // 10 minutes

console.log('🚀 Starting y-redis collaborative server...')
console.log(`📡 Server: http://${HOST}:${PORT}`)
console.log(`🔗 Base Redis: ${BASE_REDIS_URL}`)
console.log(`🧹 Document cleanup interval: ${DOC_CLEANUP_INTERVAL}ms`)

// Log storage configuration
const storageType = process.env.STORAGE_TYPE || 'memory'
console.log(`💾 Storage Type: ${storageType.toUpperCase()}`)
if (storageType === 's3') {
  const bucket = process.env.S3_BUCKET || 'not set'
  const endpoint = process.env.S3_ENDPOINT || 'not set'
  console.log(`🪣 S3 Configuration: bucket="${bucket}", endpoint="${endpoint}"`)
}

// Initialize app-specific instances
const { redisPersistenceInstances, storageInstances } = initializeAppInstances(BASE_REDIS_URL)

// WebSocket server
const wss = new WebSocketServer({ 
  port: PORT,
  host: HOST
})

// Setup periodic cleanup
setInterval(() => cleanupInactiveDocuments(DOC_CLEANUP_INTERVAL), DOC_CLEANUP_INTERVAL)

// Setup WebSocket connection handler
wss.on('connection', setupWSConnection(redisPersistenceInstances, storageInstances))

console.log('✅ y-redis server started successfully!')
console.log('💡 Frontend can now connect to ws://localhost:3001')

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...')
  
  // Destroy all Redis persistence instances
  for (const [appType, persistence] of redisPersistenceInstances) {
    console.log(`🔌 Closing Redis connection for ${appType}...`)
    persistence.destroy()
  }
  
  wss.close(() => {
    console.log('✅ Server closed')
    process.exit(0)
  })
})

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down...')
  
  // Destroy all Redis persistence instances
  for (const [appType, persistence] of redisPersistenceInstances) {
    persistence.destroy()
  }
  
  wss.close(() => {
    process.exit(0)
  })
}) 