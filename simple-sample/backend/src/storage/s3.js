import * as Y from 'yjs'
import * as random from 'lib0/random'
import * as promise from 'lib0/promise'
import * as minio from 'minio'
import * as env from 'lib0/environment'
import * as number from 'lib0/number'
import * as logging from 'lib0/logging'

const log = logging.createModuleLogger('@y/redis/s3')

/**
 * @typedef {import('../storage.js').AbstractStorage} AbstractStorage
 */

/**
 * @todo perform some sanity checks here before starting (bucket exists, ..)
 * @param {string} bucketName
 * @param {string} prefix - Storage prefix for app isolation
 */
export const createS3Storage = (bucketName, prefix = 'default') => {
  const endPoint = env.ensureConf('S3_ENDPOINT')
  const port = number.parseInt(env.ensureConf('S3_PORT'))
  const useSSL = !['false', '0'].includes(env.getConf('S3_SSL') || 'false')
  const accessKey = env.ensureConf('S3_ACCESS_KEY')
  const secretKey = env.ensureConf('S3_SECRET_KEY')
  return new S3Storage(bucketName, prefix, {
    endPoint,
    port,
    useSSL,
    accessKey,
    secretKey
  })
}

/**
 * @param {string} room
 * @param {string} docid
 * @param {string} prefix
 */
export const encodeS3ObjectName = (room, docid, prefix = 'default', r = random.uuidv4()) => `${prefix}/${encodeURIComponent(room)}/${encodeURIComponent(docid)}/${r}`

/**
 * @param {string} objectName
 */
export const decodeS3ObjectName = objectName => {
  const match = objectName.match(/(.*)\/(.*)\/(.*)\/(.*)$/)
  if (match == null) {
    throw new Error('Malformed y:room stream name!')
  }
  return { prefix: match[1], room: decodeURIComponent(match[2]), docid: decodeURIComponent(match[3]), r: match[4] }
}

/**
 * @typedef {Object} S3StorageConf
 * @property {string} S3StorageConf.endPoint
 * @property {number} S3StorageConf.port
 * @property {boolean} S3StorageConf.useSSL
 * @property {string} S3StorageConf.accessKey
 * @property {string} S3StorageConf.secretKey
 */

/**
 * @param {import('stream').Stream} stream
 * @return {Promise<Buffer>}
 */
const readStream = stream => promise.create((resolve, reject) => {
  /**
   * @type {Array<Buffer>}
   */
  const chunks = []
  stream.on('data', chunk => chunks.push(Buffer.from(chunk)))
  stream.on('error', reject)
  stream.on('end', () => resolve(Buffer.concat(chunks)))
})

/**
 * @implements {AbstractStorage}
 */
export class S3Storage {
  /**
   * @param {string} bucketName
   * @param {string} prefix - Storage prefix for app isolation
   * @param {S3StorageConf} conf
   */
  constructor (bucketName, prefix = 'default', { endPoint, port, useSSL, accessKey, secretKey }) {
    this.bucketName = bucketName
    this.prefix = prefix
    this.client = new minio.Client({
      endPoint,
      port,
      useSSL,
      accessKey,
      secretKey
    })
    console.log(`🏗️  S3Storage initialized: bucket="${bucketName}", prefix="${prefix}", endpoint="${endPoint}:${port}", ssl=${useSSL}`)
  }

  /**
   * @param {string} room
   * @param {string} docname
   * @param {Y.Doc} ydoc
   * @returns {Promise<void>}
   */
  async persistDoc (room, docname, ydoc) {
    const objectName = encodeS3ObjectName(room, docname, this.prefix)
    await this.client.putObject(this.bucketName, objectName, Buffer.from(Y.encodeStateAsUpdateV2(ydoc)))
  }

  /**
   * @param {string} room
   * @param {string} docname
   * @return {Promise<{ doc: Uint8Array, references: Array<string> } | null>}
   */
  async retrieveDoc (room, docname) {
    console.log(`🔍 S3 Retrieve: Searching for room="${room}", docname="${docname}", prefix="${this.prefix}" in bucket="${this.bucketName}"`)
    log('retrieving doc room=' + room + ' docname=' + docname + ' prefix=' + this.prefix)
    const objNames = await this.client.listObjectsV2(this.bucketName, encodeS3ObjectName(room, docname, this.prefix, ''), true).toArray()
    const references = objNames.map(obj => obj.name)
    console.log(`🔍 S3 Found: ${references.length} objects for room="${room}", references=${JSON.stringify(references)}`)
    log('retrieved doc room=' + room + ' docname=' + docname + ' prefix=' + this.prefix + ' refs=' + JSON.stringify(references))

    if (references.length === 0) {
      console.log(`🔍 S3 Empty: No objects found for room="${room}", docname="${docname}" in bucket="${this.bucketName}"`)
      return null
    }
    let updates = await promise.all(references.map(ref => this.client.getObject(this.bucketName, ref).then(readStream)))
    updates = updates.filter(update => update != null)
    console.log(`🔍 S3 Success: Retrieved ${updates.length} updates, total size=${updates.reduce((sum, u) => sum + u.length, 0)} bytes`)
    log('retrieved doc room=' + room + ' docname=' + docname + ' prefix=' + this.prefix + ' updatesLen=' + updates.length)
    return { doc: Y.mergeUpdatesV2(updates), references }
  }

  /**
   * @param {string} room
   * @param {string} docname
   * @return {Promise<Uint8Array|null>}
   */
  async retrieveStateVector (room, docname) {
    const r = await this.retrieveDoc(room, docname)
    return r ? Y.encodeStateVectorFromUpdateV2(r.doc) : null
  }

  /**
   * @param {string} _room
   * @param {string} _docname
   * @param {Array<string>} storeReferences
   * @return {Promise<void>}
   */
  async deleteReferences (_room, _docname, storeReferences) {
    await this.client.removeObjects(this.bucketName, storeReferences)
  }

  async destroy () {
  }
}
