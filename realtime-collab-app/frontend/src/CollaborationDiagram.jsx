import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
} from 'reactflow';
import 'reactflow/dist/style.css';
import * as Y from 'yjs';
import TenantHeader from './components/TenantHeader';
import TestInstructions from './components/TestInstructions';
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from 'y-protocols/awareness.js';
// import { Buffer } from 'buffer'; // Removed - using Uint8Array instead
// import { WebsocketProvider } from 'y-websocket'; // Removed

// Define user colors - professional and readable palette
const USER_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ef4444', // Red
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#f97316', // Orange
];
// Removed nextColorIndex since we now use clientID for color assignment

const getNodeId = () => `node_${+new Date()}_${Math.random().toString(36).substr(2, 9)}`;

// Message types (must match backend)
const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

// Extract orgId from URL parameters
const getOrgIdFromUrl = () => {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    let orgId = urlParams.get('orgId');
    
    // Fallback manual parsing
    if (!orgId) {
      const searchString = window.location.search;
      const match = searchString.match(/[?&]orgId=([^&]*)/);
      orgId = match ? decodeURIComponent(match[1]) : null;
    }
    
    return orgId || 'default-org';
  } catch (error) {
    console.error('Error parsing URL parameters:', error);
    return 'default-org';
  }
};

const CollaborationDiagram = () => {
  // Get organization ID from URL parameter
  const orgId = getOrgIdFromUrl();
  const WEBSOCKET_URL = `ws://localhost:1234/flow-diagram?orgId=${orgId}`;
  
  // Remove noisy logging - these were causing render loops
  // console.log('🏢 Current Tenant:', orgId);
  // console.log('📡 WebSocket URL:', WEBSOCKET_URL);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionInitialized, setConnectionInitialized] = useState(false);

  const ydocRef = useRef(null);
  const yNodesRef = useRef(null);
  const yEdgesRef = useRef(null);
  const awarenessRef = useRef(null);
  const wsRef = useRef(null);

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

    // Re-enable awareness
    const awarenessInstance = new Awareness(doc);
    awarenessRef.current = awarenessInstance;

    // Assign a color and initial state to the current user
    // Use clientID to ensure consistent color assignment across sessions
    const colorIndex = doc.clientID % USER_COLORS.length;
    const color = USER_COLORS[colorIndex];
    
    const user = {
      id: doc.clientID,
      name: `User ${doc.clientID.toString().slice(-4)}`,
      color: color,
      selectedNode: null,
    };
    setCurrentUser(user);
    console.log(`Assigned color ${color} to user ${user.name} (clientID: ${doc.clientID})`);
    awarenessInstance.setLocalStateField('user', user);

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
              // Re-enable awareness handling
              if (data.length > 0) {
                applyAwarenessUpdate(awarenessRef.current, data, wsRef.current);
              }
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
      // Clear local awareness state
      awarenessInstance.setLocalState(null);
    };

    // Send local Yjs doc updates to server
    const onDocUpdate = (update, origin) => {
      if (origin !== wsRef.current) { // Don't send if update came from server
        sendToServer(MESSAGE_SYNC, update);
      }
    };
    doc.on('update', onDocUpdate);

    // Send local awareness updates to server
    const onAwarenessUpdate = ({ added, updated, removed }, origin) => {
      if (origin !== wsRef.current) {
        const changedClients = added.concat(updated).concat(removed);
        const awarenessUpdate = encodeAwarenessUpdate(awarenessInstance, changedClients);
        sendToServer(MESSAGE_AWARENESS, awarenessUpdate);
      }
    };
    awarenessInstance.on('update', onAwarenessUpdate);

    return () => {
      console.log('Cleaning up WebSocket and Yjs resources');
      awarenessInstance.off('update', onAwarenessUpdate);
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
      
      doc.destroy();
      setIsConnected(false);
    };
  }, []);

  // ROBUST: Styling logic that never loses nodes
  const styledNodes = useMemo(() => {
    // Always return the original nodes if there are any issues
    if (!nodes || nodes.length === 0) {
      return [];
    }

    // If no awareness, just return original nodes
    if (!awarenessRef.current) {
      return nodes;
    }

    try {
      const states = Array.from(awarenessRef.current.getStates().values());
      
      // Quick return if no interactions to avoid unnecessary processing
      const hasActiveInteractions = states.some(state => 
        state.user && (state.user.selectedNode || state.user.isDragging)
      );
      
      if (!hasActiveInteractions) {
        return nodes;
      }

      // SAFE: Apply styling only to interacting nodes, leave others unchanged
      const resultNodes = nodes.map(node => {
        const interactingUser = states.find(state => 
          state.user && 
          (state.user.selectedNode === node.id || 
           (state.user.isDragging && state.user.selectedNode === node.id))
        )?.user;
        
        if (!interactingUser) {
          return node; // No interaction, return original node
        }
        
        const isDragging = interactingUser.isDragging && interactingUser.selectedNode === node.id;
        const isSelected = interactingUser.selectedNode === node.id && !isDragging;
        
        if (!isDragging && !isSelected) {
          return node; // No styling needed
        }
        
        const userColor = interactingUser.color || '#8b5cf6';
        
        return {
          ...node,
          style: {
            ...node.style,
            border: `2px solid ${userColor}`,
            boxShadow: isDragging 
              ? `0 8px 25px rgba(0,0,0,0.2), 0 0 0 1px ${userColor}` 
              : `0 4px 12px rgba(0,0,0,0.15), 0 0 0 1px ${userColor}`,
            backgroundColor: '#fff',
            // Use margin instead of transform to avoid visual displacement
            marginTop: isDragging ? '-2px' : '0px',
            marginLeft: isDragging ? '-2px' : '0px',
            transition: isDragging ? 'none' : 'all 0.15s ease',
          }
        };
      });
      
      return resultNodes;
    } catch (error) {
      console.error('Error in styledNodes computation:', error);
      return nodes; // Fallback to original nodes if styling fails
    }
  }, [nodes, connectedUsers.length]); // Use length instead of full array to prevent unnecessary re-computations

  // Create a stable nodes reference for debugging
  const debugStyledNodes = useMemo(() => {
    const result = styledNodes;
    return result;
  }, [styledNodes]);

  // SIMPLIFIED: Direct Yjs sync without over-protection
  const handleNodesChange = useCallback(() => {
    if (!yNodesRef.current) return;
    
    const nodesFromYjs = Object.values(yNodesRef.current.toJSON());
    
    // Validate nodes before setting
    const validNodes = nodesFromYjs.filter(node => {
      if (!node.position || typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
        console.warn('⚠️ Filtering invalid node:', node.id, node.position);
        return false;
      }
      return true;
    });
    
    // Only log if there are validation issues
    if (nodesFromYjs.length !== validNodes.length) {
      console.warn('🔍 Node validation issues - Total from Yjs:', nodesFromYjs.length, 'Valid:', validNodes.length);
    }
    
    // Always set nodes - let React handle the comparison
    setNodes(validNodes);
  }, []); // Remove dependency to prevent circular re-subscription

  // Subscribe to Yjs shared types changes for UI updates
  useEffect(() => {
    if (!yNodesRef.current || !yEdgesRef.current || !awarenessRef.current) return;
    
    const handleEdgesChange = () => {
      setEdges(yEdgesRef.current.toArray());
    };

    // Re-enable awareness UI updates - update users and apply styles
    const handleAwarenessUiUpdate = () => {
      const states = Array.from(awarenessRef.current.getStates().values());
      const users = states.map(state => state.user).filter(Boolean);
      // Reduced logging - only log when user count changes
      if (users.length !== connectedUsers.length) {
        console.log('👥 Users:', users.length, users.map(u => u.name));
      }
      setConnectedUsers(users);
      // Styling is now handled by styledNodes useMemo automatically
    };

    yNodesRef.current.observeDeep(handleNodesChange);
    yEdgesRef.current.observeDeep(handleEdgesChange);
    awarenessRef.current.on('change', handleAwarenessUiUpdate);
    
    // Initial UI load from local Yjs data
    handleNodesChange();
    handleEdgesChange();
    handleAwarenessUiUpdate();

    return () => {
      yNodesRef.current.unobserveDeep(handleNodesChange);
      yEdgesRef.current.unobserveDeep(handleEdgesChange);
      awarenessRef.current.off('change', handleAwarenessUiUpdate);
    };
  }, []); // Remove currentUser dependency to prevent re-subscriptions


  // SIMPLIFIED: React Flow event handlers with basic awareness
  const onNodesChange = useCallback((changes) => {
    if (!yNodesRef.current || !ydocRef.current || !awarenessRef.current || !currentUser) return;
    
    // Removed excessive position change logging
    
    let shouldUpdateAwareness = false;
    let newAwarenessState = { ...currentUser };
    
    changes.forEach(change => {
      if (change.type === 'position' && change.position) {
        // Position change with valid coordinates
        const node = yNodesRef.current.get(change.id);
        if (node) {
          if (change.dragging) {
            // Start dragging: update awareness and position
            if (!currentUser.isDragging || currentUser.selectedNode !== change.id) {
              // Starting drag for node
              newAwarenessState = {
                ...currentUser,
                selectedNode: change.id,
                isDragging: true
              };
              shouldUpdateAwareness = true;
            }
            
            // Update position in Yjs immediately for real-time sync
            ydocRef.current.transact(() => {
              yNodesRef.current.set(change.id, { ...node, position: change.position });
            });
          } else {
            // End dragging: clear awareness
            // Ending drag for node
            newAwarenessState = {
              ...currentUser,
              selectedNode: null,
              isDragging: false
            };
            shouldUpdateAwareness = true;

            // Final position update
            ydocRef.current.transact(() => {
              yNodesRef.current.set(change.id, { ...node, position: change.position });
            });
          }
        }
      } else if (change.type === 'position' && !change.position) {
        // Position change without coordinates (usually end of interaction)
        if (!change.dragging) {
          newAwarenessState = {
            ...currentUser,
            selectedNode: null,
            isDragging: false
          };
          shouldUpdateAwareness = true;
        }
      }
      // Handle other change types (dimensions, select, etc.) without special logic
    });
    
    // Update awareness state when needed
    if (shouldUpdateAwareness) {
      awarenessRef.current.setLocalStateField('user', newAwarenessState);
    }
  }, [currentUser]);

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
      
      // Only update awareness if selection actually changed
      if (currentSelectedNode !== newSelectedNodeId) {
        awarenessRef.current.setLocalStateField('user', { 
          ...currentUser, 
          selectedNode: newSelectedNodeId,
          isDragging: false // Click is not dragging
        });
        // Optimistically update local current user state for immediate UI feedback
        setCurrentUser(prev => ({
          ...prev, 
          selectedNode: newSelectedNodeId,
          isDragging: false
        }));
      }
    }
  }, [currentUser]);

  const addNode = () => {
    if (!yNodesRef.current || !ydocRef.current) return;
    
    const currentNodes = yNodesRef.current.toJSON();
    const nodeCount = Object.keys(currentNodes).length;
    const existingNodes = Object.values(currentNodes);
    
    // Generate position with collision avoidance
    let position;
    let attempts = 0;
    const maxAttempts = 20;
    
    do {
      // Use a reasonable viewport area (800x600) instead of full window
      position = { 
        x: Math.random() * 700 + 50,  // 50-750px range
        y: Math.random() * 500 + 50   // 50-550px range  
      };
      
      // Check if position conflicts with existing nodes
      const hasCollision = existingNodes.some(node => {
        if (!node.position) return false;
        const distance = Math.sqrt(
          Math.pow(position.x - node.position.x, 2) + 
          Math.pow(position.y - node.position.y, 2)
        );
        return distance < 150; // Minimum 150px distance between nodes
      });
      
      if (!hasCollision) break;
      attempts++;
    } while (attempts < maxAttempts);
    
    // If we couldn't find a good position, use a grid-based fallback
    if (attempts >= maxAttempts) {
      const gridSize = 180;
      const col = nodeCount % 4; // 4 columns max
      const row = Math.floor(nodeCount / 4);
      position = {
        x: col * gridSize + 100,  // Start at x=100
        y: row * gridSize + 100   // Start at y=100
      };
    }
    
    const newNodeId = getNodeId();
    const newNode = {
      id: newNodeId, 
      type: 'default',
      data: { label: `Node ${nodeCount + 1}` },
      position: position,
      style: { border: '1px solid #555', padding: 10, backgroundColor: '#fff' },
    };
    
    // Validate position before adding
    if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
      console.error('❌ Invalid position, aborting node creation:', position);
      return;
    }
    
    ydocRef.current.transact(() => {
      yNodesRef.current.set(newNodeId, newNode);
    });
  };

  const clearAllNodes = () => {
    if (!yNodesRef.current || !ydocRef.current) return;
    
    ydocRef.current.transact(() => {
      yNodesRef.current.clear();
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
      <TenantHeader 
        orgId={orgId}
        isConnected={isConnected}
        connectedUsers={connectedUsers}
        currentUser={currentUser}
        onAddNode={addNode}
        onClearNodes={clearAllNodes}
      />
      <div style={{ flexGrow: 1 }}>
        <ReactFlow
          nodes={debugStyledNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          attributionPosition="bottom-left"
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
      <TestInstructions orgId={orgId} />
    </div>
  );
};

export default CollaborationDiagram;