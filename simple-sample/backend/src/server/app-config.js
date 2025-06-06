import { RedisPersistence } from 'y-redis'
import { createStorage } from '../storage/index.js'

// App-specific configurations
export const APP_CONFIGS = {
  text: {
    redisDatabase: 1,
    storagePrefix: 'text-docs',
    description: 'Text Editor'
  },
  nodes: {
    redisDatabase: 2,
    storagePrefix: 'node-diagrams',
    description: 'Node Diagrams'
  },
  default: {
    redisDatabase: 0,
    storagePrefix: 'default-docs',
    description: 'Default'
  }
}

/**
 * Initialize app-specific Redis persistence and storage instances
 */
export function initializeAppInstances(baseRedisUrl) {
  const redisPersistenceInstances = new Map()
  const storageInstances = new Map()

  for (const [appType, config] of Object.entries(APP_CONFIGS)) {
    const redisUrl = `${baseRedisUrl}/${config.redisDatabase}`
    console.log(`🔧 Setting up ${config.description} (${appType}): Redis DB ${config.redisDatabase}, Storage: ${config.storagePrefix}`)
    
    redisPersistenceInstances.set(appType, new RedisPersistence({
      redisOpts: { url: redisUrl }
    }))
    
    storageInstances.set(appType, createStorage(config.storagePrefix))
  }

  return { redisPersistenceInstances, storageInstances }
}

/**
 * Helper function to get app type from room name or query params
 */
export function getAppTypeFromRequest(req, docName) {
  // Check query parameters first
  const url = new URL(req.url, `http://${req.headers.host}`)
  const appType = url.searchParams.get('appType')
  if (appType && APP_CONFIGS[appType]) {
    return appType
  }
  
  // Fallback: detect from room name prefix
  if (docName.startsWith('text-')) {
    return 'text'
  } else if (docName.startsWith('nodes-')) {
    return 'nodes'
  }
  
  return 'default'
}

/**
 * Helper function to get app-specific instances
 */
export function getAppInstances(appType, redisPersistenceInstances, storageInstances) {
  const redisPersistence = redisPersistenceInstances.get(appType)
  const storage = storageInstances.get(appType)
  
  if (!redisPersistence || !storage) {
    console.warn(`⚠️ No instances found for app type: ${appType}, falling back to default`)
    return {
      redisPersistence: redisPersistenceInstances.get('default'),
      storage: storageInstances.get('default'),
      config: APP_CONFIGS.default
    }
  }
  
  return {
    redisPersistence,
    storage,
    config: APP_CONFIGS[appType]
  }
} 