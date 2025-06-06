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
  
  switch (storageType) {
    case 's3':
      const bucketName = env.ensureConf('s3-bucket')
      return createS3Storage(bucketName, prefix)
    case 'memory':
    default:
      return createMemoryStorage(prefix)
  }
}

export { createS3Storage, createMemoryStorage } 