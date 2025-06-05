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
  // Get tenant from URL
  const orgId = getOrgIdFromUrl();
  
  // Create tenant-aware WebSocket URL
  const WEBSOCKET_URL = `ws://localhost:1234/flow-diagram?orgId=${encodeURIComponent(orgId)}`;
  
  console.log('🏢 Current Tenant:', orgId);
  console.log('📡 WebSocket URL:', WEBSOCKET_URL);
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

  // Light throttling to prevent feedback loops
  const positionUpdateTimeouts = useRef(new Map());

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
      
      // Clean up timeouts
      positionUpdateTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId));
      positionUpdateTimeouts.current.clear();
      
      doc.destroy();
      setIsConnected(false);
    };
  }, []);

  // Separate function to apply awareness styles to current nodes
  // Create a computed version of nodes with awareness styles (no setNodes!)
  const styledNodes = useMemo(() => {
    if (!awarenessRef.current) return nodes;
    
    const states = Array.from(awarenessRef.current.getStates().values());
    
    // Check if any styling is needed
    const hasActiveInteractions = states.some(state => 
      state.user && (state.user.selectedNode || state.user.isDragging)
    );
    
    if (!hasActiveInteractions) {
      return nodes; // Return original nodes if no styling needed
    }
    
    console.log('🎨 Computing styled nodes with awareness. Input nodes:', nodes.map(n => ({id: n.id, pos: n.position})));
    
    return nodes.map(node => {
      const interactingUser = states.find(state => state.user && state.user.selectedNode === node.id)?.user;
      
      if (interactingUser) {
        console.log('🎨 Styling node:', node.id, 'INPUT position:', node.position, 'user:', interactingUser.name);
        const isDragging = interactingUser.isDragging;
        const baseStyle = {
          border: '1px solid #555',
          padding: 10,
          backgroundColor: '#fff'
        };
        
        const { background: _background, ...cleanStyle } = node.style || {};
        
        const styledNode = { 
          ...node,
          style: { 
            ...baseStyle,
            ...cleanStyle,
            border: isDragging 
              ? `3px solid ${interactingUser.color}` 
              : `2px solid ${interactingUser.color}`,
            boxShadow: isDragging 
              ? `0 0 8px ${interactingUser.color}80, 0 0 0 2px ${interactingUser.color}30`
              : `0 0 4px ${interactingUser.color}60`,
            backgroundColor: '#fff',
            // FIXED: Use margin instead of transform to avoid position corruption
            // transform causes visual displacement while maintaining data position
            marginTop: isDragging ? '-2px' : '0px',
            marginLeft: isDragging ? '-2px' : '0px',
            zIndex: isDragging ? 1000 : 1,
            transition: 'all 0.15s ease-in-out'
          }
        };
        console.log('🎨 OUTPUT styled node:', styledNode.id, 'OUTPUT position:', styledNode.position);
        return styledNode;
      }
      
      return node; // Return original node if no styling needed
    });
  }, [nodes, connectedUsers]); // Depend on nodes and connectedUsers (which updates with awareness)

  // Simple Yjs observer - direct sync
  const handleNodesChange = useCallback(() => {
    if (!yNodesRef.current) return;
    const currentNodesMap = yNodesRef.current.toJSON();
    const nodesFromYjs = Object.values(currentNodesMap);
    console.log('📊 handleNodesChange TRIGGERED - Nodes updated from Yjs:', nodesFromYjs.length, 'nodes');
    
    // Debug: Check if positions are valid
    nodesFromYjs.forEach(node => {
      if (!node.position || typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
        console.warn('⚠️ Invalid node position detected:', node.id, node.position);
      } else {
        console.log('✅ Valid node:', node.id, 'at', node.position);
      }
    });
    
    // CRITICAL FIX: Don't override position of actively interacted nodes
    const currentAwarenessState = awarenessRef.current?.getLocalState();
    const interactedNodeId = currentAwarenessState?.user?.selectedNode || null;
    const isDragging = currentAwarenessState?.user?.isDragging || false;
    
    // VALIDATION: Only protect nodes that actually exist in Yjs
    const nodeExists = interactedNodeId && nodesFromYjs.some(node => node.id === interactedNodeId);
    
    if (interactedNodeId && nodeExists && !isDragging) {
      // ONLY protect selected nodes (not dragging ones) - allow real-time drag updates
      console.log('🚫 Protecting SELECTED node from Yjs position override:', interactedNodeId);
      // Apply Yjs updates only to non-interacted nodes
      setNodes(prevNodes => {
        const result = nodesFromYjs.map(yNode => {
          if (yNode.id === interactedNodeId) {
            // Keep current position for selected node, update other properties
            const currentNode = prevNodes.find(n => n.id === yNode.id);
            const finalNode = currentNode ? { ...yNode, position: currentNode.position } : yNode;
            console.log('🛡️ Protected SELECTED node position - Yjs:', yNode.position, 'Kept:', finalNode.position);
            return finalNode;
          }
          return yNode; // Apply Yjs state for non-interacted nodes
        });
        console.log('🛡️ Final protected setNodes result:', result.map(n => ({id: n.id, pos: n.position})));
        return result;
      });
    } else if (interactedNodeId && nodeExists && isDragging) {
      // ALLOW real-time position updates during dragging for smooth UX
      console.log('✅ Allowing real-time drag updates for node:', interactedNodeId);
      console.log('🔄 handleNodesChange setNodes called with:', nodesFromYjs.map(n => ({id: n.id, pos: n.position})));
      console.log('🔄 FULL NODE DATA:', nodesFromYjs);
      setNodes(nodesFromYjs);
    } else {
      // Clean up stale awareness state if node doesn't exist
      if (interactedNodeId && !nodeExists) {
        console.log('🧹 Cleaning stale awareness state for non-existent node:', interactedNodeId);
        awarenessRef.current.setLocalStateField('user', { 
          ...currentUser, 
          selectedNode: null,
          isDragging: false
        });
      }
      
      // Direct sync - Yjs is the single source of truth for position and data
      console.log('🔄 handleNodesChange setNodes called with:', nodesFromYjs.map(n => ({id: n.id, pos: n.position})));
      console.log('🔄 FULL NODE DATA:', nodesFromYjs);
      setNodes(nodesFromYjs);
    }
    
    // Styling is now handled by styledNodes useMemo - no need to trigger here
      }, []);

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
      console.log('👥 Awareness update - Total states:', states.length, 'Users:', users.length, users);
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


  // React Flow event handlers - single source of truth with light throttling
  const onNodesChange = useCallback((changes) => {
    if (!yNodesRef.current || !ydocRef.current || !awarenessRef.current || !currentUser) return;
    
    console.log('🔄 onNodesChange triggered with changes:', changes.map(c => ({type: c.type, id: c.id, dragging: c.dragging, position: c.position, ...c})));
    
    let shouldUpdateAwareness = false;
    let newAwarenessState = { ...currentUser };
    
    changes.forEach(change => {
      console.log('🔍 Processing change:', change.type, 'for node:', change.id, 'Full change:', change);
      
      if (change.type === 'position') {
        if (change.position) {
          // Position change WITH coordinates
          const node = yNodesRef.current.get(change.id);
          if (node) {
            if (change.dragging) {
              console.log('📍 Position change with dragging=true for node:', change.id, 'Position:', change.position);
              
              // Only update awareness if we're starting a new drag (not during drag)
              const currentAwarenessState = awarenessRef.current.getLocalState();
              if (!currentAwarenessState?.user?.isDragging || currentAwarenessState?.user?.selectedNode !== change.id) {
                console.log('🎯 Setting awareness to dragging for node:', change.id);
                newAwarenessState = {
                  ...currentUser,
                  selectedNode: change.id,
                  isDragging: true
                };
                shouldUpdateAwareness = true;
              }
              
              // IMPORTANT: Allow immediate position updates during drag for responsiveness
              // Don't throttle the first drag event
              if (!positionUpdateTimeouts.current.has(change.id)) {
                const currentNode = yNodesRef.current.get(change.id);
                if (currentNode) {
                  ydocRef.current.transact(() => {
                    yNodesRef.current.set(change.id, { ...currentNode, position: change.position });
                  });
                }
              }

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
              // Drag ended: clear selection state and immediate update
              console.log('✋ Drag ended for node:', change.id, 'Position:', change.position);
              newAwarenessState = {
                ...currentUser,
                selectedNode: null,
                isDragging: false
              };
              shouldUpdateAwareness = true;

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
        } else {
          // Position change WITHOUT coordinates - this is the bug!
          console.log('🚫 IGNORED: Position change without coordinates for node:', change.id, 'Change:', change);
          
          // Only clear awareness if it's a non-dragging position event (like click end)
          if (!change.dragging) {
            console.log('🧹 Clearing awareness state for position event without coordinates');
            newAwarenessState = {
              ...currentUser,
              selectedNode: null,
              isDragging: false
            };
            shouldUpdateAwareness = true;
          }
        }
      } else {
        // Log non-position changes for debugging
        console.log('🔧 Non-position change:', change.type, 'for node:', change.id, 'Change:', change);
      }
    });
    
    // Only update awareness when actually needed (start/end drag, not during)
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
    console.log('👆 Node clicked:', node.id, 'at position:', node.position);
    
    // DEBUG: Check if DOM position matches data position
    setTimeout(() => {
      const nodeElement = document.querySelector(`[data-id="${node.id}"]`);
      if (nodeElement) {
        const rect = nodeElement.getBoundingClientRect();
        const parent = nodeElement.closest('.react-flow__viewport');
        const parentRect = parent?.getBoundingClientRect();
        
        if (parentRect) {
          const domPosition = {
            x: rect.left - parentRect.left,
            y: rect.top - parentRect.top
          };
          console.log('🔍 DOM vs Data position check:');
          console.log('  📊 Data position:', node.position);
          console.log('  🏠 DOM position:', domPosition);
          console.log('  📏 Difference:', {
            x: Math.abs(domPosition.x - node.position.x),
            y: Math.abs(domPosition.y - node.position.y)
          });
        }
      }
    }, 100); // Wait for any animations/transitions to complete
    
    if (awarenessRef.current && currentUser) {
      const currentAwarenessState = awarenessRef.current.getLocalState();
      const currentSelectedNode = currentAwarenessState?.user?.selectedNode;
      const newSelectedNodeId = currentSelectedNode === node.id ? null : node.id;
      
      console.log('👆 Selection change:', currentSelectedNode, '->', newSelectedNodeId);
      
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
    console.log(`🚀 Adding node. Current nodes in Yjs:`, nodeCount, Object.keys(currentNodes));
    
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
      console.log(`🔄 Used grid fallback position for node ${nodeCount + 1}:`, position);
    }
    
    const newNodeId = getNodeId();
    const newNode = {
      id: newNodeId, 
      type: 'default',
      data: { label: `Node ${nodeCount + 1}` },
      position: position,
      style: { border: '1px solid #555', padding: 10, backgroundColor: '#fff' },
    };
    
    console.log(`🆕 Creating new node at position:`, position, 'after', attempts, 'attempts');
    console.log(`🔍 Full node object:`, newNode);
    
    // Validate position before adding
    if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
      console.error('❌ Invalid position, aborting node creation:', position);
      return;
    }
    
    ydocRef.current.transact(() => {
      yNodesRef.current.set(newNodeId, newNode);
      console.log(`💾 Node ${newNodeId} added to Yjs map`);
    });
  };

  const clearAllNodes = () => {
    if (!yNodesRef.current || !ydocRef.current) return;
    
    ydocRef.current.transact(() => {
      yNodesRef.current.clear();
    });
  };

  // DEBUGGING: Manual test of awareness styles
  const testAwarenessStyles = () => {
    console.log('🧪 MANUAL TEST: Styling is now automatic via styledNodes');
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
      <button 
        onClick={testAwarenessStyles}
        style={{
          position: 'absolute',
          top: '50px',
          right: '10px',
          zIndex: 1000,
          padding: '5px 10px',
          backgroundColor: '#ef4444',
          color: 'white',
          border: 'none',
          borderRadius: '4px'
        }}
      >
        🧪 Test Awareness
      </button>
      <div style={{ flexGrow: 1 }}>
        <ReactFlow
          nodes={styledNodes}
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