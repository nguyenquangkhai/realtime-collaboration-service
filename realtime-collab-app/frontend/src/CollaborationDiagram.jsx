import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
} from 'reactflow';
import 'reactflow/dist/style.css';
import * as Y from 'yjs';
// import { Awareness, /* encodeAwarenessUpdate, */ applyAwarenessUpdate } from 'y-protocols/awareness.js';
// import { Buffer } from 'buffer'; // Removed - using Uint8Array instead
// import { WebsocketProvider } from 'y-websocket'; // Removed

// Define user colors (same as backend, or fetchable if dynamic)
const USER_COLORS = [
  '#FF69B4', // DeepPink
  '#00CED1', // DarkTurquoise
  '#FFD700', // Gold
  '#32CD32', // LimeGreen
  '#9370DB',  // MediumPurple
];
// Removed nextColorIndex since we now use clientID for color assignment

const getNodeId = () => `node_${+new Date()}_${Math.random().toString(36).substr(2, 9)}`;

// Message types (must match backend)
const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

const WEBSOCKET_URL = 'ws://localhost:1234/diagram-room'; // Room name in URL

const CollaborationDiagram = () => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  // const [awareness, setAwareness] = useState(null); // Direct ref now
  const [connectedUsers] = useState([]); // setConnectedUsers temporarily unused with awareness disabled
  const [currentUser, setCurrentUser] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionInitialized, setConnectionInitialized] = useState(false);

  const ydocRef = useRef(null);
  const yNodesRef = useRef(null);
  const yEdgesRef = useRef(null);
  const awarenessRef = useRef(null); // Using a ref for awareness instance
  const wsRef = useRef(null); // WebSocket connection ref

  // Light throttling to prevent feedback loops
  const positionUpdateTimeouts = useRef(new Map());

  // Removed complex state management - keeping it simple

  const sendToServer = (messageType, data) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        // Use Uint8Array instead of Buffer
        const messageTypeArray = new Uint8Array([messageType]);
        const dataArray = new Uint8Array(data);
        const finalMessage = new Uint8Array(messageTypeArray.length + dataArray.length);
        finalMessage.set(messageTypeArray, 0);
        finalMessage.set(dataArray, messageTypeArray.length);
        
        wsRef.current.send(finalMessage);
      } catch (error) {
        console.error('Error sending message to server:', error);
      }
    } else {
      console.warn('Cannot send message: WebSocket not open');
    }
  };

  useEffect(() => {
    // Prevent multiple initializations
    if (connectionInitialized) {
      console.log('Connection already initialized, skipping');
      return;
    }
    
    console.log('Initializing WebSocket connection...');
    setConnectionInitialized(true);

    const doc = new Y.Doc();
    ydocRef.current = doc;
    yNodesRef.current = doc.getMap('nodes');
    yEdgesRef.current = doc.getArray('edges');

    // Temporarily disable awareness completely
    // const awarenessInstance = new Awareness(doc);
    // awarenessRef.current = awarenessInstance;

    // Assign a color and initial state to the current user
    // Use clientID to ensure consistent color assignment across sessions
    const colorIndex = doc.clientID % USER_COLORS.length;
    const color = USER_COLORS[colorIndex];
    
    const user = {
      id: doc.clientID, // Yjs clientID is fine for awareness state id
      name: `User ${doc.clientID.toString().slice(-4)}`,
      color: color,
      selectedNode: null,
    };
    setCurrentUser(user);
    console.log(`Assigned color ${color} to user ${user.name} (clientID: ${doc.clientID})`);
    // awarenessInstance.setLocalStateField('user', user);

    // Prevent multiple connections in React Strict Mode
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected, skipping new connection');
      return;
    }

    const ws = new WebSocket(WEBSOCKET_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected successfully');
      setIsConnected(true);
      
      // Send ONLY initial state vector, don't respond to every server message with another state vector
      try {
        const stateVector = Y.encodeStateVector(doc);
        sendToServer(MESSAGE_SYNC, stateVector);
        console.log('Sent initial state vector to server');
      } catch (error) {
        console.error('Error sending initial state vector:', error);
      }
    };

    ws.onmessage = (event) => {
      const message = event.data;
      const processMessage = async () => {
        try {
          let messageBuffer;
          if (message instanceof Blob) {
              messageBuffer = new Uint8Array(await message.arrayBuffer());
          } else if (message instanceof ArrayBuffer) {
              messageBuffer = new Uint8Array(message);
          } else if (typeof message === 'string') {
              console.warn('Received string message, expected binary for Yjs');
              return; 
          } else {
              messageBuffer = new Uint8Array(message);
          }

          if (messageBuffer.length === 0) {
            console.warn('Received empty message');
            return;
          }

          const messageType = messageBuffer[0];
          const data = messageBuffer.slice(1);

          if (messageType === MESSAGE_SYNC) {
              if (data.length > 0) {
                // Only apply if it looks like a valid Yjs update (not empty or malformed)
                try {
                  // Check if this looks like a valid update before applying
                  if (data.length > 2) { // Valid Yjs updates are usually > 2 bytes
                    Y.applyUpdate(doc, data, wsRef.current);
                    // console.log('Applied document update from server'); // Reduced logging
                  } else {
                    console.log('Ignoring small/invalid sync message');
                  }
                } catch (updateError) {
                  console.error('Error applying update:', updateError);
                }
              }
          } else if (messageType === MESSAGE_AWARENESS) {
              // Awareness temporarily disabled
              // if (data.length > 0) {
              //   applyAwarenessUpdate(awarenessRef.current, data, wsRef.current);
              // }
          } else {
              console.warn(`Unknown message type: ${messageType}`);
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
          console.error('Message data:', message);
        }
      };
      processMessage();
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    ws.onclose = (event) => {
      console.log('WebSocket disconnected. Code:', event.code, 'Reason:', event.reason || 'No reason');
      setIsConnected(false);
      // Remove awareness state using the awareness instance, not Y namespace
      // awarenessInstance.setLocalState(null); // Clear local awareness state
    };

    // Send local Yjs doc updates to server
    const onDocUpdate = (update, origin) => {
      if (origin !== wsRef.current) { // Don't send if update came from server
        sendToServer(MESSAGE_SYNC, update);
      }
    };
    doc.on('update', onDocUpdate);

    // Send local awareness updates to server (temporarily disabled to debug message loop)
    // const onAwarenessUpdate = () => {
    //   // Temporarily disabled to stop message loop
    //   // if (origin !== wsRef.current) {
    //   //   const changedClients = added.concat(updated).concat(removed);
    //   //   const awarenessUpdate = encodeAwarenessUpdate(awarenessInstance, changedClients);
    //   //   sendToServer(MESSAGE_AWARENESS, awarenessUpdate);
    //   // }
    // };
    // awarenessInstance.on('update', onAwarenessUpdate);

    return () => {
      console.log('Cleaning up WebSocket and Yjs resources');
      // awarenessInstance.off('update', onAwarenessUpdate);
      doc.off('update', onDocUpdate);
      
      // Properly close WebSocket connection
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;
        
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.close(1000, 'Component unmounting');
        }
        wsRef.current = null;
      }
      
      // Clean up timeouts
      positionUpdateTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId));
      positionUpdateTimeouts.current.clear();
      
      doc.destroy();
      setIsConnected(false);
    };
  }, []);

  // Simple Yjs observer - direct sync
  const handleNodesChange = useCallback(() => {
    if (!yNodesRef.current) return;
    const currentNodesMap = yNodesRef.current.toJSON();
    const nodesFromYjs = Object.values(currentNodesMap);
    // Direct sync - Yjs is the single source of truth
    setNodes(nodesFromYjs);
  }, []);

  // Subscribe to Yjs shared types changes for UI updates
  useEffect(() => {
    if (!yNodesRef.current || !yEdgesRef.current) return;
    
    const handleEdgesChange = () => {
      setEdges(yEdgesRef.current.toArray());
    };

    // Temporarily disable awareness UI updates
    // const handleAwarenessUiUpdate = () => {
    //   const states = Array.from(awarenessRef.current.getStates().values());
    //   setConnectedUsers(states.map(state => state.user).filter(Boolean));
    //   setNodes(prevNodes => 
    //     prevNodes.map(node => {
    //       const selectingUser = states.find(state => state.user && state.user.selectedNode === node.id)?.user;
    //       if (selectingUser) {
    //         return { ...node, style: { ...node.style, border: `3px solid ${selectingUser.color}`, boxShadow: `0 0 10px ${selectingUser.color}` } };
    //       }
    //       return { ...node, style: { ...node.style, border: '1px solid #555', boxShadow: 'none' } }; 
    //     })
    //   );
    // };

    yNodesRef.current.observeDeep(handleNodesChange);
    yEdgesRef.current.observeDeep(handleEdgesChange);
    // awarenessRef.current.on('change', handleAwarenessUiUpdate); // Disabled
    
    // Initial UI load from local Yjs data
    handleNodesChange();
    handleEdgesChange();
    // handleAwarenessUiUpdate(); // Disabled

    return () => {
      yNodesRef.current.unobserveDeep(handleNodesChange);
      yEdgesRef.current.unobserveDeep(handleEdgesChange);
      // awarenessRef.current.off('change', handleAwarenessUiUpdate); // Disabled
    };
  }, [currentUser]); // Rerun if currentUser changes


  // React Flow event handlers - single source of truth with light throttling
  const onNodesChange = useCallback((changes) => {
    if (!yNodesRef.current || !ydocRef.current) return;
    
    changes.forEach(change => {
      if (change.type === 'position' && change.position) {
        const node = yNodesRef.current.get(change.id);
        if (node) {
          if (change.dragging) {
            // Light throttling during drag to prevent feedback loops
            const timeoutId = positionUpdateTimeouts.current.get(change.id);
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
            
            const newTimeoutId = setTimeout(() => {
              const currentNode = yNodesRef.current.get(change.id);
              if (currentNode) {
                ydocRef.current.transact(() => {
                  yNodesRef.current.set(change.id, { ...currentNode, position: change.position });
                });
              }
              positionUpdateTimeouts.current.delete(change.id);
            }, 50); // 50ms = 20fps, light but prevents loops
            
            positionUpdateTimeouts.current.set(change.id, newTimeoutId);
          } else {
            // Drag ended: immediate update
            ydocRef.current.transact(() => {
              yNodesRef.current.set(change.id, { ...node, position: change.position });
            });
            // Clear any pending update
            const timeoutId = positionUpdateTimeouts.current.get(change.id);
            if (timeoutId) {
              clearTimeout(timeoutId);
              positionUpdateTimeouts.current.delete(change.id);
            }
          }
        }
      }
    });
  }, []);

  const onEdgesChange = useCallback(() => {
    // Edge modifications are handled by onConnect and onEdgesDelete
  }, []);

  const onConnect = useCallback((params) => {
    if (!yEdgesRef.current || !ydocRef.current) return;
    const newEdge = { id: `edge-${params.source}-${params.target}-${Date.now()}`, ...params };
    const existingEdges = yEdgesRef.current.toArray();
    if (!existingEdges.find(e => e.source === params.source && e.target === params.target)) {
       ydocRef.current.transact(() => {
          yEdgesRef.current.push([newEdge]);
       });
    }
  }, []);
  
  const onNodeClick = useCallback((event, node) => {
    if (awarenessRef.current && currentUser) {
      const currentAwarenessState = awarenessRef.current.getLocalState();
      const currentSelectedNode = currentAwarenessState?.user?.selectedNode;
      const newSelectedNodeId = currentSelectedNode === node.id ? null : node.id;
      
      awarenessRef.current.setLocalStateField('user', { 
        ...currentUser, 
        selectedNode: newSelectedNodeId 
      });
      // Optimistically update local current user state for immediate UI feedback
      setCurrentUser(prev => ({...prev, selectedNode: newSelectedNodeId }));
    }
  }, [currentUser]);

  const addNode = () => {
    if (!yNodesRef.current || !ydocRef.current) return;
    
    const newNodeId = getNodeId();
    const newNode = {
      id: newNodeId, type: 'default',
      data: { label: `Node ${Object.keys(yNodesRef.current.toJSON()).length + 1}` },
      position: { x: Math.random() * (window.innerWidth - 200), y: Math.random() * (window.innerHeight - 400) },
      style: { border: '1px solid #555', padding: 10, background: '#fff' },
    };
    
    ydocRef.current.transact(() => {
      yNodesRef.current.set(newNodeId, newNode);
    });
  };

  const onNodesDelete = useCallback((nodesToDelete) => {
    if (!yNodesRef.current || !yEdgesRef.current || !ydocRef.current) return;
    ydocRef.current.transact(() => {
      nodesToDelete.forEach(node => {
        yNodesRef.current.delete(node.id);
        const edgesToRemove = yEdgesRef.current.toArray().filter(edge => edge.source === node.id || edge.target === node.id);
        edgesToRemove.forEach(edge => {
            const index = yEdgesRef.current.toArray().findIndex(e => e.id === edge.id);
            if (index !== -1) yEdgesRef.current.delete(index, 1);
        });
      });
    });
  }, []);
  
   const onEdgesDelete = useCallback((edgesToDelete) => {
    if (!yEdgesRef.current || !ydocRef.current) return;
     ydocRef.current.transact(() => {
        edgesToDelete.forEach(edgeToDelete => {
            const index = yEdgesRef.current.toArray().findIndex(e => e.id === edgeToDelete.id);
            if (index !== -1) yEdgesRef.current.delete(index, 1);
        });
     });
   }, []);

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px', background: '#f0f0f0', borderBottom: '1px solid #ccc' }}>
        <button onClick={addNode} style={{ marginRight: '10px' }}>Add Node</button>
        <span style={{ color: isConnected ? 'green' : 'red' }}>Status: {isConnected ? 'Connected' : 'Disconnected'}</span>
        <span style={{ marginLeft: '10px', color: 'blue' }}>Users: {connectedUsers.length}</span>
        <div style={{ display: 'flex', marginTop: '5px', color: 'blue' }}>
          {connectedUsers.map(user => (
            user && user.id &&
            <div key={user.id} title={`${user.name} (ID: ${user.id})`} style={{
              width: '20px', height: '20px', backgroundColor: user.color, borderRadius: '50%',
              marginRight: '5px', border: currentUser && user.id === currentUser.id ? '2px solid black' : '2px solid transparent'
            }}></div>
          ))}
        </div>
         {currentUser && <p style={{ color: 'blue' }}>You: {currentUser.name} (Color: <span style={{color: currentUser.color, fontWeight:'bold'}}>{currentUser.color}</span>)</p>}
      </div>
      <div style={{ flexGrow: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          fitView
          attributionPosition="bottom-left"
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  );
};

export default CollaborationDiagram;