import { createS3Storage } from './s3.js'
import { createMemoryStorage } from './memory.js'
import * as env from 'lib0/environment'

/**
 * @typedef {Object} AbstractStorage
 * @property {function(string, string, import('yjs').Doc): Promise<void>} persistDoc
 * @property {function(string, string): Promise<{ doc: Uint8Array, references: Array<string> } | null>} retrieveDoc
 * @property {function(string, string): Promise<Uint8Array|null>} retrieveStateVector
 * @property {function(string, string, Array<string>): Promise<void>} deleteReferences
 * @property {function(): Promise<void>} destroy
 */

/**
 * Create storage provider based on environment configuration
 * @param {string} prefix - Optional prefix for app-specific storage isolation
 * @returns {AbstractStorage}
 */
export const createStorage = (prefix = 'default') => {
  const storageType = env.getConf('STORAGE_TYPE') || 'memory'
  
  console.log(`📦 Creating storage for prefix '${prefix}': ${storageType.toUpperCase()}`)
  
  switch (storageType) {
    case 's3':
      const bucketName = env.ensureConf('s3-bucket')
      const endpoint = env.ensureConf('s3-endpoint')
      console.log(`🪣 S3 Storage Config: bucket="${bucketName}", endpoint="${endpoint}", prefix="${prefix}"`)
      return createS3Storage(bucketName, prefix)
    case 'memory':
    default:
      console.log(`💾 Memory Storage Config: prefix="${prefix}" (data will not persist)`)
      return createMemoryStorage(prefix)
  }
}

export { createS3Storage, createMemoryStorage } 