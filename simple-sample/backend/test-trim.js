import { RedisPersistence } from 'y-redis'

async function test() {
  const redis = new RedisPersistence({ 
    redisOpts: { url: 'redis://localhost:6379/1' } 
  })
  
  try {
    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const r = redis.redis
    
    console.log('🔍 Testing aggressive stream trimming...')
    console.log('📏 Before:', await r.xlen('y:worker'), 'messages')
    
    // Use exact trimming (without ~) to force immediate trim
    const result = await r.xtrim('y:worker', 'MAXLEN', '5')
    console.log('✂️ Trimmed:', result, 'messages')
    console.log('📏 After:', await r.xlen('y:worker'), 'messages')
    
    // Show remaining messages
    const remaining = await r.xrevrange('y:worker', '+', '-', 'COUNT', 10)
    console.log('📝 Remaining messages:')
    for (const [id, fields] of remaining) {
      const data = {}
      for (let i = 0; i < fields.length; i += 2) {
        data[fields[i]] = fields[i + 1]
      }
      console.log(`   • ${id}: ${JSON.stringify(data)}`)
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await redis.destroy()
    console.log('✅ Done!')
  }
}

test() 