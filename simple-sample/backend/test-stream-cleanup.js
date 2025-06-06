#!/usr/bin/env node

import 'dotenv/config'
import { RedisPersistence } from 'y-redis'
import { maintainStream, cleanupStream, cleanupProcessedMessages } from './src/worker/stream-cleanup.js'

// Configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379/1'
const STREAM_KEY = 'y:worker'
const GROUP_NAME = 'workers'

console.log('🧪 Testing Redis Stream Cleanup')
console.log('================================')
console.log(`🔗 Redis: ${REDIS_URL}`)
console.log(`📋 Stream: ${STREAM_KEY}`)
console.log(`👥 Group: ${GROUP_NAME}`)
console.log('')

async function testStreamCleanup() {
  let redisPersistence = null
  
  try {
    // Connect to Redis
    console.log('🔌 Connecting to Redis...')
    redisPersistence = new RedisPersistence({
      redisOpts: { url: REDIS_URL }
    })
    
    const redis = redisPersistence.redis
    
    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Show initial stream info
    console.log('\n📊 BEFORE CLEANUP:')
    await showStreamInfo(redis, STREAM_KEY, GROUP_NAME)
    
    // Add some test messages if stream is empty
    const streamExists = await redis.exists(STREAM_KEY)
    if (!streamExists) {
      console.log('\n➕ Stream is empty, adding test messages...')
      for (let i = 0; i < 15; i++) {
        await redis.xadd(STREAM_KEY, '*', 'room', `test-room-${i}`, 'action', 'activity', 'timestamp', Date.now())
      }
      console.log('✅ Added 15 test messages')
    }
    
    // Show updated stream info
    console.log('\n📊 STREAM STATUS:')
    await showStreamInfo(redis, STREAM_KEY, GROUP_NAME)
    
    // Test different cleanup methods
    console.log('\n🧹 TESTING CLEANUP METHODS:')
    console.log('='*50)
    
    // Test 1: Basic stream trimming
    console.log('\n1️⃣ Testing basic stream trimming (MAXLEN: 10)...')
    const trimResult = await cleanupStream(redis, STREAM_KEY, {
      maxLength: 10,
      trimStrategy: 'MAXLEN'
    })
    console.log('📋 Trim result:', JSON.stringify(trimResult, null, 2))
    
    // Test 2: Age-based trimming
    console.log('\n2️⃣ Testing age-based trimming (older than 1 minute)...')
    const ageResult = await cleanupStream(redis, STREAM_KEY, {
      maxAge: 60 * 1000, // 1 minute
      trimStrategy: 'MINID'
    })
    console.log('📋 Age trim result:', JSON.stringify(ageResult, null, 2))
    
    // Test 3: Consumer group cleanup
    console.log('\n3️⃣ Testing consumer group cleanup...')
    const groupResult = await cleanupProcessedMessages(redis, STREAM_KEY, GROUP_NAME, {
      minIdleTime: 10 * 1000 // 10 seconds
    })
    console.log('📋 Group cleanup result:', JSON.stringify(groupResult, null, 2))
    
    // Test 4: Full maintenance
    console.log('\n4️⃣ Testing full stream maintenance...')
    const maintainResult = await maintainStream(redis, STREAM_KEY, GROUP_NAME, {
      maxLength: 8,
      maxAge: 30 * 1000, // 30 seconds
      trimStrategy: 'MAXLEN',
      cleanupProcessed: true,
      minIdleTime: 5 * 1000, // 5 seconds
      logResults: false
    })
    console.log('📋 Maintenance result:', JSON.stringify(maintainResult, null, 2))
    
    // Show final stream info
    console.log('\n📊 AFTER CLEANUP:')
    await showStreamInfo(redis, STREAM_KEY, GROUP_NAME)
    
    console.log('\n✅ Stream cleanup test completed successfully!')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  } finally {
    if (redisPersistence) {
      try {
        await redisPersistence.destroy()
        console.log('🔌 Redis connection closed')
      } catch (closeError) {
        console.error('❌ Error closing Redis:', closeError)
      }
    }
  }
}

async function showStreamInfo(redis, streamKey, groupName) {
  try {
    // Stream info
    const streamInfo = await redis.xinfo('STREAM', streamKey).catch(() => null)
    
    if (!streamInfo) {
      console.log(`❌ Stream '${streamKey}' does not exist`)
      return
    }
    
    // Parse stream info (Redis returns array format)
    const length = streamInfo[streamInfo.indexOf('length') + 1]
    const firstEntry = streamInfo[streamInfo.indexOf('first-entry') + 1]
    const lastEntry = streamInfo[streamInfo.indexOf('last-entry') + 1]
    
    console.log(`📏 Stream length: ${length} messages`)
    
    if (firstEntry && firstEntry.length > 0) {
      console.log(`🥇 First message ID: ${firstEntry[0]} (${new Date(parseInt(firstEntry[0].split('-')[0])).toISOString()})`)
    }
    
    if (lastEntry && lastEntry.length > 0) {
      console.log(`🥉 Last message ID: ${lastEntry[0]} (${new Date(parseInt(lastEntry[0].split('-')[0])).toISOString()})`)
    }
    
    // Consumer group info
    try {
      const groupInfo = await redis.xinfo('GROUPS', streamKey)
      if (groupInfo && groupInfo.length > 0) {
        for (let i = 0; i < groupInfo.length; i++) {
          const group = groupInfo[i]
          const name = group[group.indexOf('name') + 1]
          const pending = group[group.indexOf('pending') + 1]
          const consumers = group[group.indexOf('consumers') + 1]
          
          if (name === groupName) {
            console.log(`👥 Group '${name}': ${pending} pending, ${consumers} consumers`)
            
            // Show pending details if any
            if (pending > 0) {
              const pendingDetails = await redis.xpending(streamKey, groupName, '-', '+', 10)
              console.log(`📋 Pending messages:`)
              for (const [msgId, consumer, idle, deliveryCount] of pendingDetails) {
                console.log(`   • ${msgId} (consumer: ${consumer}, idle: ${idle}ms, deliveries: ${deliveryCount})`)
              }
            }
          }
        }
      } else {
        console.log(`👥 No consumer groups found for stream '${streamKey}'`)
      }
    } catch (groupError) {
      console.log(`👥 Consumer group '${groupName}' does not exist`)
    }
    
    // Recent messages sample
    const recentMessages = await redis.xrevrange(streamKey, '+', '-', 'COUNT', 3)
    if (recentMessages && recentMessages.length > 0) {
      console.log('📝 Recent messages (last 3):')
      for (const [id, fields] of recentMessages) {
        const timestamp = new Date(parseInt(id.split('-')[0])).toISOString()
        const data = {}
        for (let i = 0; i < fields.length; i += 2) {
          data[fields[i]] = fields[i + 1]
        }
        console.log(`   • ${id} (${timestamp}): ${JSON.stringify(data)}`)
      }
    }
    
  } catch (error) {
    console.error(`❌ Error getting stream info: ${error.message}`)
  }
}

// Add some helper functions for interactive testing
async function addTestMessages(count = 10) {
  const redisPersistence = new RedisPersistence({
    redisOpts: { url: REDIS_URL }
  })
  
  try {
    const redis = redisPersistence.redis
    await new Promise(resolve => setTimeout(resolve, 500))
    
    console.log(`➕ Adding ${count} test messages...`)
    for (let i = 0; i < count; i++) {
      await redis.xadd(STREAM_KEY, '*', 
        'room', `test-room-${i}`, 
        'action', i % 2 === 0 ? 'activity' : 'empty',
        'appType', 'test',
        'timestamp', Date.now(),
        'worker', 'test-script'
      )
    }
    console.log(`✅ Added ${count} test messages to ${STREAM_KEY}`)
    
  } catch (error) {
    console.error('❌ Error adding test messages:', error)
  } finally {
    await redisPersistence.destroy()
  }
}

// Command line interface
const command = process.argv[2]

switch (command) {
  case 'add':
    const count = parseInt(process.argv[3]) || 10
    addTestMessages(count)
    break
  case 'info':
    showStreamStatus()
    break
  default:
    testStreamCleanup()
}

async function showStreamStatus() {
  const redisPersistence = new RedisPersistence({
    redisOpts: { url: REDIS_URL }
  })
  
  try {
    const redis = redisPersistence.redis
    await new Promise(resolve => setTimeout(resolve, 500))
    
    console.log('\n📊 CURRENT STREAM STATUS:')
    await showStreamInfo(redis, STREAM_KEY, GROUP_NAME)
    
  } catch (error) {
    console.error('❌ Error showing status:', error)
  } finally {
    await redisPersistence.destroy()
  }
} 