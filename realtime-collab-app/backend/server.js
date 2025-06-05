import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import * as Y from 'yjs';
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from 'y-protocols/awareness.js';
import { RedisPersistence } from 'y-redis';
import { createClient } from 'redis';
import { v4 as uuidv4 } from 'uuid'; // For generating unique client IDs

const HOST = process.env.HOST || 'localhost';
const PORT = parseInt(process.env.PORT || '1234', 10);
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Message types (mirroring y-protocols/sync and y-protocols/awareness)
const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
// const MESSAGE_AUTH = 2; // For future use if auth is needed

// In-memory storage for documents and awareness states per room
const docs = new Map(); // Map<roomName, { ydoc: Y.Doc, awareness: Awareness, conns: Map<WebSocket, Set<number>>, persistenceDoc: PersistenceDoc }>

const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' });
  response.end('Collab backend running');
});

const wss = new WebSocketServer({ server });

const redisClient = createClient({ url: REDIS_URL });
redisClient.on('error', (err) => console.error('Redis Client Error:', err));
let redisPersistence;

async function initializeRedis() {
  try {
    await redisClient.connect();
    console.log('Connected to Redis successfully!');
    redisPersistence = new RedisPersistence(redisClient);
    console.log('Redis persistence initialized!');
  } catch (err) {
    console.error('Failed to connect to Redis or set up persistence:', err);
    process.exit(1);
  }
}

initializeRedis();

// Redis storage functions with tenant isolation
async function storeUpdateInRedis(roomName, update) {
  try {
    if (!redisClient.isOpen) {
      console.warn('Redis client not connected, cannot store update');
      return;
    }
    
    // Use tenant-aware Redis key
    const redisKey = `yjs:updates:${roomName}`;
    const base64Update = Buffer.from(update).toString('base64');
    await redisClient.rPush(redisKey, base64Update);
    console.log(`💾 Stored update for tenant room ${roomName} in Redis`);
  } catch (error) {
    console.error('Error storing update in Redis:', error);
  }
}

async function loadUpdatesFromRedis(roomName) {
  try {
    if (!redisClient.isOpen) {
      console.warn('Redis client not connected, cannot load updates');
      return [];
    }
    
    // Use tenant-aware Redis key
    const redisKey = `yjs:updates:${roomName}`;
    const base64Updates = await redisClient.lRange(redisKey, 0, -1);
    console.log(`📋 Loaded ${base64Updates.length} updates for tenant room ${roomName} from Redis`);
    
    return base64Updates.map(base64 => Buffer.from(base64, 'base64'));
  } catch (error) {
    console.error('Error loading updates from Redis:', error);
    return [];
  }
}

const getOrCreateDoc = async (roomName) => {
  if (!docs.has(roomName)) {
    const ydoc = new Y.Doc();
    const awareness = new Awareness(ydoc);
    awareness.setLocalState(null); // Server doesn't have a local state in awareness

    // Load existing document from Redis if it exists
    if (redisPersistence) {
      try {
        console.log(`Loading existing doc ${roomName} from Redis...`);
        const existingUpdates = await loadUpdatesFromRedis(roomName);
        if (existingUpdates.length > 0) {
          console.log(`Found ${existingUpdates.length} existing updates for ${roomName}`);
          existingUpdates.forEach(update => {
            try {
              Y.applyUpdate(ydoc, update);
            } catch (err) {
              console.error('Error applying stored update:', err);
            }
          });
          console.log(`Successfully loaded doc ${roomName} from Redis`);
        } else {
          console.log(`No existing data found for doc ${roomName}`);
        }
      } catch (err) {
        console.error(`Error loading doc ${roomName} from Redis:`, err);
      }
    }

    // Handle awareness changes: broadcast to other clients in the room
    awareness.on('update', ({ added, updated, removed }, connOrigin) => {
      const changedClients = added.concat(updated).concat(removed);
      const roomData = docs.get(roomName);
      if (roomData) {
        const awarenessUpdate = encodeAwarenessUpdate(awareness, changedClients);
        for (const conn of roomData.conns.keys()) {
          if (conn !== connOrigin) { // Don't send back to the originator
            send(conn, MESSAGE_AWARENESS, awarenessUpdate);
          }
        }
      }
    });

    // Handle Yjs document updates: persist and broadcast
    ydoc.on('update', async (update, originConn) => {
      // Store to Redis for persistence
      if (redisPersistence && originConn instanceof WebSocket) { // Only persist if update comes from a client
        try {
          await storeUpdateInRedis(roomName, update);
        } catch (err) {
          console.error('Error storing update to Redis:', err);
        }
      }
      
      const roomData = docs.get(roomName);
      if (roomData) {
        console.log(`Broadcasting document update to ${roomData.conns.size - 1} other clients`);
        for (const conn of roomData.conns.keys()) {
          if (conn !== originConn) {
            send(conn, MESSAGE_SYNC, update);
          }
        }
      }
    });

    docs.set(roomName, { ydoc, awareness, conns: new Map() });
  }
  return docs.get(roomName);
};

const send = (conn, messageType, data) => {
  if (conn.readyState === WebSocket.OPEN) {
    try {
        // Ensure data is a Buffer
        const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
        // Prepend message type to the data buffer
        const messageTypeBuffer = Buffer.from([messageType]);
        const finalMessage = Buffer.concat([messageTypeBuffer, dataBuffer]);
        conn.send(finalMessage);
    } catch (e) {
        console.error('Error sending message:', e);
        // Don't close connection here, let the error handler deal with it
    }
  } else {
    console.warn(`Cannot send message, WebSocket not open. ReadyState: ${conn.readyState}`);
  }
};

wss.on('connection', async (conn, req) => {
  // Parse URL to extract room and tenant info
  const url = new URL(req.url, `http://${req.headers.host}`);
  const roomName = url.pathname.slice(1) || 'default-room';
  const orgId = url.searchParams.get('orgId') || 'default-org';
  
  // Create tenant-isolated room name
  const tenantRoomName = `${orgId}:${roomName}`;
  
  const clientID = uuidv4(); // Assign a unique ID to this connection for awareness
  console.log(`👤 User ${clientID} connected to tenant '${orgId}', room '${roomName}' (${tenantRoomName})`);

  try {
    const roomData = await getOrCreateDoc(tenantRoomName);
    const { ydoc, awareness, conns } = roomData;
    
    conns.set(conn, new Set()); // Store connection
    console.log(`✅ User ${clientID} added to tenant room ${tenantRoomName}`);

    // Handle messages from client
    conn.on('message', (message) => {
      try {
          const messageBuffer = Buffer.isBuffer(message) ? message : Buffer.from(message);
          
          if (messageBuffer.length === 0) {
            console.warn('Received empty message');
            return;
          }
          
          const messageType = messageBuffer[0];
          const data = messageBuffer.slice(1);

          if (messageType === MESSAGE_SYNC) {
              if (data.length === 0) {
                console.warn('Received empty sync data');
                return;
              }
              
              // Check if this is a state vector (small size) or document update (larger)
              if (data.length <= 10) {
                // Likely a state vector - respond with full document state
                console.log(`📤 Sending document state to user ${clientID} in tenant ${orgId}`);
                const fullUpdate = Y.encodeStateAsUpdate(ydoc);
                if (fullUpdate.length > 1) {
                  send(conn, MESSAGE_SYNC, fullUpdate);
                }
              } else {
                // Likely a document update - apply it
                try {
                  console.log(`📥 Received document update from user ${clientID} in tenant ${orgId}`);
                  Y.applyUpdate(ydoc, data, conn);
                } catch (updateError) {
                  console.error('Error applying document update:', updateError);
                }
              }
          } else if (messageType === MESSAGE_AWARENESS) {
              if (data.length > 0) {
                applyAwarenessUpdate(awareness, data, conn);
              }
          } else {
              console.warn(`Unknown message type: ${messageType}`);
          }
      } catch (err) {
          console.error('Error processing message:', err);
          // Don't close connection on error, just log it
      }
    });

    // Handle client disconnection
    conn.on('close', (code, reason) => {
      console.log(`👋 User ${clientID} disconnected from tenant '${orgId}', room '${roomName}'. Code: ${code}, Reason: ${reason || 'No reason'}`);
      conns.delete(conn);
    });

    // Handle client errors
    conn.on('error', (error) => {
      console.error(`WebSocket error for user ${clientID} in tenant ${orgId}:`, error);
      conns.delete(conn);
    });

    console.log(`🔄 Preparing to send initial sync to user ${clientID} in tenant ${orgId}`);

    // Send initial sync messages with error handling
    // Delay slightly to ensure WebSocket is fully ready
    setTimeout(() => {
      if (conn.readyState === WebSocket.OPEN) {
        try {
          console.log(`🚀 Sending initial sync to user ${clientID} in tenant ${orgId}`);
          
          // Send initial sync step 1 (send entire doc state vector)
          const stateVector = Y.encodeStateVector(ydoc);
          // Always send state vector for proper sync protocol, even if empty
          send(conn, MESSAGE_SYNC, stateVector);

          // Send initial sync step 2 (send the full document state) only if there's content
          const fullDocUpdate = Y.encodeStateAsUpdate(ydoc);
          if (fullDocUpdate.length > 1) { // Only send if there's actual content
            send(conn, MESSAGE_SYNC, fullDocUpdate);
          }

          // Send current awareness states to the new client
          const awarenessStates = awareness.getStates();
          if (awarenessStates.size > 0) {
            const allAwarenessStates = encodeAwarenessUpdate(awareness, Array.from(awarenessStates.keys()));
            if (allAwarenessStates.length > 0) {
              send(conn, MESSAGE_AWARENESS, allAwarenessStates);
            }
          }
          
          console.log(`✅ Initial sync completed for user ${clientID} in tenant ${orgId}`);
        } catch (error) {
          console.error(`Error sending initial sync to user ${clientID} in tenant ${orgId}:`, error);
        }
      } else {
        console.warn(`Cannot send initial sync to user ${clientID}, WebSocket not open. ReadyState: ${conn.readyState}`);
      }
    }, 100); // 100ms delay

  } catch (error) {
    console.error(`Error setting up connection for user ${clientID} in tenant ${orgId}:`, error);
    conn.close();
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Custom collab server running at ws://${HOST}:${PORT}`);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully.');
  await redisClient.quit();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully.');
  await redisClient.quit();
  process.exit(0);
}); 