/**
 * Redis Stream Cleanup Module
 * Manages stream data retention to prevent infinite accumulation
 */

/**
 * Clean up old messages from Redis streams
 * @param {Redis} redis - Redis client instance
 * @param {string} streamKey - Stream key to clean (e.g., 'y:worker')
 * @param {Object} options - Cleanup options
 */
export async function cleanupStream(redis, streamKey, options = {}) {
  const {
    maxAge = 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    maxLength = 10000, // Maximum number of messages to keep
    trimStrategy = 'MAXLEN' // 'MAXLEN' or 'MINID'
  } = options

  try {
    console.info(`🧹 Starting cleanup for stream: ${streamKey}`)
    
    // Get stream info to check current length
    const streamInfo = await redis.xinfo('STREAM', streamKey).catch(() => null)
    
    if (!streamInfo) {
      console.debug(`🔍 Stream ${streamKey} does not exist, skipping cleanup`)
      return { trimmed: 0, reason: 'stream_not_found' }
    }
    
    // Parse stream info (Redis returns an array format)
    const currentLength = streamInfo[streamInfo.indexOf('length') + 1]
    console.info(`📊 Stream ${streamKey} current length: ${currentLength}`)
    
    if (currentLength === 0) {
      console.debug(`✅ Stream ${streamKey} is empty, no cleanup needed`)
      return { trimmed: 0, reason: 'empty_stream' }
    }
    
    let trimmed = 0
    
    if (trimStrategy === 'MAXLEN' && currentLength > maxLength) {
      // Trim by maximum length (keeps most recent messages)
      const result = await redis.xtrim(streamKey, 'MAXLEN', '~', maxLength)
      trimmed = result
      console.info(`✂️ Trimmed ${trimmed} messages from ${streamKey} (MAXLEN: ${maxLength})`)
      
    } else if (trimStrategy === 'MINID') {
      // Trim by age (remove messages older than maxAge)
      const cutoffTime = Date.now() - maxAge
      const minId = `${cutoffTime}-0`
      
      const result = await redis.xtrim(streamKey, 'MINID', '~', minId)
      trimmed = result
      console.info(`✂️ Trimmed ${trimmed} messages from ${streamKey} (older than ${Math.round(maxAge / 3600000)}h)`)
    }
    
    // Get updated stream info
    const updatedInfo = await redis.xinfo('STREAM', streamKey)
    const newLength = updatedInfo[updatedInfo.indexOf('length') + 1]
    
    return {
      trimmed,
      oldLength: currentLength,
      newLength,
      strategy: trimStrategy,
      maxAge: maxAge,
      maxLength: maxLength
    }
    
  } catch (error) {
    console.error(`❌ Error cleaning up stream ${streamKey}:`, error)
    return { error: error.message, trimmed: 0 }
  }
}

/**
 * Clean up processed messages from consumer group
 * This removes messages that have been acknowledged by ALL consumers
 */
export async function cleanupProcessedMessages(redis, streamKey, groupName, options = {}) {
  const {
    minIdleTime = 60 * 60 * 1000, // 1 hour in milliseconds
    batchSize = 100
  } = options

  try {
    console.info(`🧹 Cleaning processed messages from ${streamKey} group: ${groupName}`)
    
    // Get pending messages info
    const pendingInfo = await redis.xpending(streamKey, groupName).catch(() => null)
    
    if (!pendingInfo || pendingInfo[0] === 0) {
      console.debug(`✅ No pending messages in group ${groupName}`)
      return { processed: 0, reason: 'no_pending' }
    }
    
    // Get detailed pending messages that are idle (old unprocessed)
    const pendingDetails = await redis.xpending(
      streamKey, 
      groupName, 
      'IDLE', 
      minIdleTime, 
      '-', 
      '+', 
      batchSize
    )
    
    if (!pendingDetails || pendingDetails.length === 0) {
      console.debug(`✅ No idle pending messages in group ${groupName}`)
      return { processed: 0, reason: 'no_idle_pending' }
    }
    
    let processedCount = 0
    
    // Process idle pending messages (these might be from dead consumers)
    for (const [messageId, consumerName, idleTime, deliveryCount] of pendingDetails) {
      try {
        // Acknowledge messages that have been idle too long
        await redis.xack(streamKey, groupName, messageId)
        processedCount++
        console.debug(`✅ Acknowledged idle message ${messageId} (idle: ${idleTime}ms, deliveries: ${deliveryCount})`)
      } catch (ackError) {
        console.warn(`⚠️ Failed to acknowledge message ${messageId}:`, ackError.message)
      }
    }
    
    return {
      processed: processedCount,
      idleMessagesFound: pendingDetails.length,
      minIdleTime
    }
    
  } catch (error) {
    console.error(`❌ Error cleaning processed messages from ${streamKey}:`, error)
    return { error: error.message, processed: 0 }
  }
}

/**
 * Comprehensive stream maintenance
 * Combines length trimming, age trimming, and processed message cleanup
 */
export async function maintainStream(redis, streamKey, groupName, options = {}) {
  const {
    // Stream trimming options
    maxLength = 10000,
    maxAge = 24 * 60 * 60 * 1000, // 24 hours
    trimStrategy = 'MAXLEN',
    
    // Consumer group cleanup options  
    cleanupProcessed = true,
    minIdleTime = 2 * 60 * 60 * 1000, // 2 hours
    
    // Logging
    logResults = true
  } = options

  const results = {
    timestamp: new Date().toISOString(),
    streamKey,
    groupName
  }

  try {
    // Step 1: Clean up processed/idle messages from consumer group
    if (cleanupProcessed && groupName) {
      results.processedCleanup = await cleanupProcessedMessages(redis, streamKey, groupName, {
        minIdleTime
      })
    }
    
    // Step 2: Trim stream by length or age
    results.streamTrim = await cleanupStream(redis, streamKey, {
      maxLength,
      maxAge,
      trimStrategy
    })
    
    if (logResults) {
      console.info(`🧹 Stream maintenance completed for ${streamKey}:`, {
        trimmed: results.streamTrim?.trimmed || 0,
        processed: results.processedCleanup?.processed || 0,
        newLength: results.streamTrim?.newLength || 'unknown'
      })
    }
    
    return results
    
  } catch (error) {
    console.error(`❌ Error maintaining stream ${streamKey}:`, error)
    results.error = error.message
    return results
  }
} 