// Track processing state and room activities
export const processingRooms = new Set()
export const roomActivities = new Map() // roomName -> timestamp
export const knownRooms = new Set()

/**
 * Register room activity (called when users connect/disconnect)
 */
export function updateRoomActivity(roomName) {
  roomActivities.set(roomName, Date.now())
  console.info(`📝 Updated activity for room: ${roomName}`)
}

/**
 * Handle empty room notification - persist and cleanup
 */
export async function handleEmptyRoom(roomName, redisPersistence) {
  try {
    console.info(`🗑️ Handling empty room: ${roomName}`)
    
    // Clean up Redis keys for this room
    const redis = redisPersistence.redis
    if (redis) {
      const keysToDelete = await redis.keys(`${roomName}:*`)
      if (keysToDelete.length > 0) {
        await redis.del(...keysToDelete)
        console.info(`🗑️ Cleaned up ${keysToDelete.length} Redis keys for empty room: ${roomName}`)
      } else {
        console.info(`✅ No Redis keys to clean for room: ${roomName}`)
      }
    }
    
    // Remove from activity tracking
    roomActivities.delete(roomName)
    
  } catch (error) {
    console.error(`❌ Error handling empty room ${roomName}:`, error)
  }
}

/**
 * Check if a room has active connections by looking at recent activity
 */
export async function checkRoomActiveConnections(roomName, redisPersistence) {
  try {
    const redis = redisPersistence.redis
    if (!redis) return false

    // Check for recent activity messages in worker queue
    const results = await redis.xrevrange('y:worker', '+', '-', 'COUNT', 50)
    
    const RECENT_THRESHOLD = 60000 // 1 minute
    const now = Date.now()
    
    for (const [id, fields] of results) {
      // Parse timestamp from Redis stream ID (format: timestamp-sequence)
      const timestamp = parseInt(id.split('-')[0])
      
      if ((now - timestamp) > RECENT_THRESHOLD) {
        break // Stop checking older messages
      }
      
      // Check if this message is about our room
      for (let i = 0; i < fields.length; i += 2) {
        if (fields[i] === 'room' && fields[i + 1] === roomName) {
          // Check if it's an activity message (connection)
          if (fields.includes('activity')) {
            console.info(`🔍 Found recent activity for room ${roomName}`)
            return true
          }
        }
      }
    }
    
    // Also check if room has very recent activity in our local tracking
    const lastActivity = roomActivities.get(roomName)
    if (lastActivity && (now - lastActivity) < RECENT_THRESHOLD) {
      console.info(`🔍 Room ${roomName} has recent local activity`)
      return true
    }
    
    console.info(`🔍 No recent activity found for room ${roomName}`)
    return false
    
  } catch (error) {
    console.error(`❌ Error checking room activity for ${roomName}:`, error)
    return true // Assume active if we can't check (safer approach)
  }
}

/**
 * Discover active rooms from Redis keys
 */
export async function discoverActiveRooms(redisPersistence) {
  try {
    const redis = redisPersistence.redis
    if (!redis) {
      console.info('📡 Redis client not available for room discovery')
      return []
    }

    // Get all y-redis keys and analyze their types
    const allKeys = await redis.keys('*')
    console.log('🔍 Found Redis keys:', allKeys.length)
    
    // Debug: Check what types these keys actually are
    const rooms = new Set()
    for (const key of allKeys) {
      try {
        const keyType = await redis.type(key)
        console.log(`🔍 Key: ${key}, Type: ${keyType}`)
        
        // y-redis typically uses room names as prefixes
        // Look for keys that might indicate active rooms
        if (key.includes(':') && key.endsWith(':updates')) {
          // Only consider keys ending with :updates as room indicators
          const roomName = key.replace(':updates', '')
          if (roomName && roomName !== '' && !roomName.startsWith('y:')) {
            rooms.add(roomName)
            updateRoomActivity(roomName)
          }
        }
      } catch (keyError) {
        console.debug(`⚠️ Could not get type for key ${key}:`, keyError.message)
      }
    }

    const roomsArray = Array.from(rooms)
    console.log('🔍 Discovered rooms:', roomsArray)
    return roomsArray
  } catch (error) {
    console.error('❌ Error discovering rooms from Redis:', error)
    return []
  }
}

/**
 * Worker queue management - coordinate with other workers
 */
export async function processWorkerQueue(redisPersistence, workerId, batchSize, persistRoomDataCallback) {
  try {
    const redis = redisPersistence.redis
    if (!redis) return

    // Check for pending work in worker queue
    const queueKey = 'y:worker'
    
    // Try to claim work from the queue (using Redis streams with consumer groups)
    try {
      const results = await redis.xreadgroup(
        'GROUP', 'workers', workerId,
        'COUNT', batchSize,
        'BLOCK', 1000, // 1 second timeout
        'STREAMS', queueKey, '>'
      )
      
      if (results && results.length > 0) {
        const [, entries] = results[0]
        console.log(`📋 Processing ${entries.length} work items from queue`)
        
        for (const [id, fields] of entries) {
          const roomName = fields[1] // Assuming format ['room', roomName, 'action', actionType]
          const action = fields[3] // action type: 'activity' or 'empty'
          
          if (roomName) {
            if (action === 'empty') {
              console.log(`📢 Received empty notification for room: ${roomName}`)
              await handleEmptyRoom(roomName, redisPersistence)
            } else {
              await persistRoomDataCallback(roomName)
            }
            // Acknowledge processing
            await redis.xack(queueKey, 'workers', id)
          }
        }
      }
    } catch (groupError) {
      // Consumer group might not exist, create it
      if (groupError.message.includes('NOGROUP')) {
        try {
          await redis.xgroup('CREATE', queueKey, 'workers', '0', 'MKSTREAM')
          console.log('✅ Created worker consumer group')
        } catch (createError) {
          if (!createError.message.includes('BUSYGROUP')) {
            console.error('❌ Error creating consumer group:', createError)
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Error processing worker queue:', error)
  }
}

/**
 * Register a room for monitoring
 * This would typically be called when a new document is created
 */
export function registerRoom(roomName) {
  knownRooms.add(roomName)
  console.info(`📝 Registered room for monitoring: ${roomName}`)
} 