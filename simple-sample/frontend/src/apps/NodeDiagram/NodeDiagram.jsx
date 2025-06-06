import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
} from 'reactflow';
import 'reactflow/dist/style.css';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import DoUsername from 'do_username';

const NodeDiagram = ({ roomName: initialRoomName = 'nodes-collaborative-room' }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [roomName, setRoomName] = useState(initialRoomName);
  const [isConnected, setIsConnected] = useState(false);
  const [username, setUsername] = useState('');
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [selectedNodes, setSelectedNodes] = useState([]);
  const [userSelections, setUserSelections] = useState(new Map());

  // Yjs refs
  const ydocRef = useRef(null);
  const providerRef = useRef(null);
  const ynodesRef = useRef(null);
  const yedgesRef = useRef(null);
  const awarenessRef = useRef(null);
  const isUpdatingFromYjs = useRef(false);
  const userColor = useRef(null);

  // User colors for collaboration
  const userColors = [
    '#30bced', '#6eeb83', '#ffbc42', '#ecd444', 
    '#ee6352', '#9ac2c9', '#8acb88', '#1be7ff'
  ];

  const handleRoomChange = (e) => {
    setRoomName(e.target.value);
  };

  const handleUsernameChange = (e) => {
    const newUsername = e.target.value;
    setUsername(newUsername);
    
    if (awarenessRef.current && userColor.current) {
      awarenessRef.current.setLocalStateField('user', { 
        name: newUsername, 
        color: userColor.current
      });
    }
  };

  // Initialize Yjs collaboration
  useEffect(() => {
    // Generate random username and assign color
    const randomUsername = DoUsername.generate(15);
    const assignedColor = userColors[Math.floor(Math.random() * userColors.length)];
    setUsername(randomUsername);
    userColor.current = assignedColor;

    // Create Yjs document
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // Create shared arrays for nodes and edges
    const ynodes = ydoc.getArray('nodes');
    const yedges = ydoc.getArray('edges');
    ynodesRef.current = ynodes;
    yedgesRef.current = yedges;

    // Create WebSocket provider
    const fullRoomName = `nodes-${roomName}`;
    const wsUrl = `ws://localhost:3001/${fullRoomName}?appType=nodes`;
    console.log('Connecting to WebSocket:', wsUrl);
    const provider = new WebsocketProvider(wsUrl, fullRoomName, ydoc);
    providerRef.current = provider;

    // Setup awareness
    const awareness = provider.awareness;
    awarenessRef.current = awareness;
    
    awareness.setLocalStateField('user', { 
      name: randomUsername, 
      color: assignedColor
    });

    // Handle connection status
    provider.on('status', (event) => {
      setIsConnected(event.status === 'connected');
    });

    provider.on('connection-close', () => {
      setIsConnected(false);
    });

    provider.on('connection-error', () => {
      setIsConnected(false);
    });

    // Listen to awareness changes for user list, selections, and drag states
    awareness.on('change', () => {
      const users = [];
      const interactions = new Map();
      
      awareness.getStates().forEach((state, clientId) => {
        if (state.user) {
          users.push(state.user);
          
          // Track user interactions (excluding our own) - both selections and dragging
          if (clientId !== awareness.clientID) {
            const userInteraction = {
              user: state.user,
              selectedNodes: state.selectedNodes || [],
              draggedNode: state.draggedNode || null
            };
            
            // Only add to map if user has any interactions
            if (userInteraction.selectedNodes.length > 0 || userInteraction.draggedNode) {
              interactions.set(clientId, userInteraction);
            }
          }
        }
      });
      
      setConnectedUsers(users);
      setUserSelections(interactions);
    });

    // Listen to nodes changes from Yjs
    const updateNodesFromYjs = () => {
      if (isUpdatingFromYjs.current) {
        console.log('Skipping nodes update - currently updating from Yjs');
        return;
      }
      
      const yNodesArray = ynodesRef.current?.toArray() || [];
      console.log('Updating nodes from Yjs:', yNodesArray.length, 'nodes');
      setNodes(yNodesArray);
    };

    // Listen to edges changes from Yjs
    const updateEdgesFromYjs = () => {
      if (isUpdatingFromYjs.current) {
        console.log('Skipping edges update - currently updating from Yjs');
        return;
      }
      
      const yEdgesArray = yedgesRef.current?.toArray() || [];
      console.log('Updating edges from Yjs:', yEdgesArray.length, 'edges');
      setEdges(yEdgesArray);
    };

    ynodes.observe(updateNodesFromYjs);
    yedges.observe(updateEdgesFromYjs);

    // Load initial state
    updateNodesFromYjs();
    updateEdgesFromYjs();

    // Cleanup
    return () => {
      ynodes.unobserve(updateNodesFromYjs);
      yedges.unobserve(updateEdgesFromYjs);
      provider?.destroy();
      ydoc?.destroy();
    };
  }, [roomName]);

  // Handle nodes changes and sync to Yjs
  const handleNodesChange = useCallback((changes) => {
    console.log('handleNodesChange called with changes:', changes);
    const newNodes = applyNodeChanges(changes, nodes);
    
    // Check if this is a delete operation
    const deletedNodes = changes.filter(change => change.type === 'remove');
    
    if (deletedNodes.length > 0 && ynodesRef.current) {
      console.log('Deleting nodes from Yjs:', deletedNodes);
      isUpdatingFromYjs.current = true;
      
      // Remove deleted nodes from Yjs array
      deletedNodes.forEach(change => {
        const nodeIndex = ynodesRef.current.toArray().findIndex(node => node.id === change.id);
        if (nodeIndex !== -1) {
          ynodesRef.current.delete(nodeIndex, 1);
        }
      });
      
      isUpdatingFromYjs.current = false;
    }
    
    setNodes(newNodes);
  }, [nodes]);

  // Handle edges changes and sync to Yjs
  const handleEdgesChange = useCallback((changes) => {
    console.log('handleEdgesChange called with changes:', changes);
    const newEdges = applyEdgeChanges(changes, edges);
    
    // Check if this is a delete operation
    const deletedEdges = changes.filter(change => change.type === 'remove');
    
    if (deletedEdges.length > 0 && yedgesRef.current) {
      console.log('Deleting edges from Yjs:', deletedEdges);
      isUpdatingFromYjs.current = true;
      
      // Remove deleted edges from Yjs array
      deletedEdges.forEach(change => {
        const edgeIndex = yedgesRef.current.toArray().findIndex(edge => edge.id === change.id);
        if (edgeIndex !== -1) {
          yedgesRef.current.delete(edgeIndex, 1);
        }
      });
      
      isUpdatingFromYjs.current = false;
    }
    
    setEdges(newEdges);
  }, [edges]);

  // Handle edge creation
  const onConnect = useCallback((params) => {
    const newEdge = {
      ...params,
      id: `edge-${Date.now()}-${Math.random()}`,
    };
    
    if (yedgesRef.current) {
      console.log('Creating new edge:', newEdge);
      yedgesRef.current.push([newEdge]);
      
      // Force immediate update from Yjs to React state
      setTimeout(() => {
        const currentEdges = yedgesRef.current?.toArray() || [];
        console.log('Force updating React state with', currentEdges.length, 'edges');
        setEdges([...currentEdges]);
      }, 0);
    }
  }, []);

  // Add new node
  const addNode = useCallback(() => {
    console.log('Add node clicked, connected:', isConnected, 'ynodesRef:', ynodesRef.current);
    
    if (!isConnected) {
      alert('Please wait for connection to be established');
      return;
    }
    
    if (!ynodesRef.current) {
      console.warn('Yjs nodes array not ready yet');
      alert('Collaboration system not ready yet, please try again');
      return;
    }

    const newNode = {
      id: `node-${Date.now()}-${Math.random()}`,
      type: 'default',
      position: { 
        x: Math.random() * 400, 
        y: Math.random() * 400 
      },
      data: { 
        label: `Node ${Date.now()}`,
        createdBy: username
      },
    };

    console.log('Creating new node:', newNode);
    
    try {
      // Don't set isUpdatingFromYjs flag when adding nodes - let Yjs observer update React state
      ynodesRef.current.push([newNode]);
      console.log('Node added to Yjs array, current length:', ynodesRef.current.length);
      
      // Force immediate update from Yjs to React state
      setTimeout(() => {
        const currentNodes = ynodesRef.current?.toArray() || [];
        console.log('Force updating React state with', currentNodes.length, 'nodes');
        setNodes([...currentNodes]);
      }, 0);
      
    } catch (error) {
      console.error('Error adding node:', error);
      alert('Error adding node: ' + error.message);
    }
  }, [username, isConnected]);

  // Clear all nodes
  const clearNodes = useCallback(() => {
    console.log('Clear nodes clicked, connected:', isConnected, 'ynodesRef:', ynodesRef.current, 'yedgesRef:', yedgesRef.current);
    
    if (!isConnected) {
      alert('Please wait for connection to be established');
      return;
    }
    
    if (!ynodesRef.current || !yedgesRef.current) {
      console.warn('Yjs arrays not ready yet');
      alert('Collaboration system not ready yet, please try again');
      return;
    }

    if (!confirm('Are you sure you want to clear all nodes and edges?')) {
      return;
    }

    try {
      // Don't set isUpdatingFromYjs flag - let Yjs observer update React state
      ynodesRef.current.delete(0, ynodesRef.current.length);
      yedgesRef.current.delete(0, yedgesRef.current.length);
      console.log('All nodes and edges cleared');
      
      // Force immediate update from Yjs to React state
      setTimeout(() => {
        const currentNodes = ynodesRef.current?.toArray() || [];
        const currentEdges = yedgesRef.current?.toArray() || [];
        console.log('Force updating React state - nodes:', currentNodes.length, 'edges:', currentEdges.length);
        setNodes([...currentNodes]);
        setEdges([...currentEdges]);
      }, 0);
      
    } catch (error) {
      console.error('Error clearing nodes:', error);
      alert('Error clearing nodes: ' + error.message);
    }
  }, [isConnected]);

  // Handle node position changes (drag)
  const handleNodeDragStart = useCallback((event, node) => {
    console.log('Node drag started:', node.id);
    
    // Broadcast drag start to other users via awareness
    if (awarenessRef.current && userColor.current) {
      awarenessRef.current.setLocalStateField('draggedNode', node.id);
      awarenessRef.current.setLocalStateField('user', { 
        name: username, 
        color: userColor.current 
      });
    }
  }, [username]);

  const handleNodeDrag = useCallback((event, node) => {
    // Continue broadcasting that we're dragging this node
    if (awarenessRef.current && userColor.current) {
      awarenessRef.current.setLocalStateField('draggedNode', node.id);
    }
  }, []);

  // Handle node position changes (drag)
  const handleNodeDragStop = useCallback((event, node) => {
    console.log('Node drag stopped:', node.id, 'new position:', node.position);
    
    // Clear dragged node from awareness
    if (awarenessRef.current) {
      awarenessRef.current.setLocalStateField('draggedNode', null);
    }
    
    if (!ynodesRef.current) return;
    
    // Find and update the node in Yjs array
    const nodes = ynodesRef.current.toArray();
    const nodeIndex = nodes.findIndex(n => n.id === node.id);
    
    if (nodeIndex !== -1) {
      const updatedNode = { ...nodes[nodeIndex], position: node.position };
      
      // Update the specific node in Yjs array
      ynodesRef.current.delete(nodeIndex, 1);
      ynodesRef.current.insert(nodeIndex, [updatedNode]);
      
      console.log('Updated node position in Yjs');
    }
  }, []);

  // Handle selection changes
  const handleSelectionChange = useCallback((params) => {
    const selectedNodeIds = params.nodes;
    console.log('Selection changed:', selectedNodeIds);
    
    setSelectedNodes(selectedNodeIds);
    
    // Broadcast selection to other users via awareness
    if (awarenessRef.current) {
      awarenessRef.current.setLocalStateField('selectedNodes', selectedNodeIds);
    }
  }, []);

  // Create styled nodes with user interaction highlights (selection + dragging)
  const getStyledNodes = useCallback(() => {
    return nodes.map(node => {
      let style = { 
        ...node.style,
        // Default style for unselected nodes
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        backgroundColor: '#ffffff',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
      };
      
      let interactingUser = null;
      let interactionType = null;
      
      // Check if this node is being interacted with by any other user (not ourselves)
      for (const [clientId, interaction] of userSelections) {
        // Check if user is dragging this node
        if (interaction.draggedNode === node.id) {
          interactingUser = interaction.user;
          interactionType = 'dragging';
          break;
        }
        // Check if user has selected this node (only if not dragging)
        else if (interaction.selectedNodes.includes(node.id)) {
          interactingUser = interaction.user;
          interactionType = 'selected';
          // Don't break here, dragging takes priority
        }
      }
      
      // Apply styling for other users' interactions
      if (interactingUser) {
        const borderWidth = interactionType === 'dragging' ? '3px' : '2px';
        const shadowIntensity = interactionType === 'dragging' ? '80' : '40';
        const shadowSize = interactionType === 'dragging' ? '16px' : '8px';
        
        style = {
          ...style,
          border: `${borderWidth} solid ${interactingUser.color}`,
          boxShadow: `0 0 ${shadowSize} ${interactingUser.color}${shadowIntensity}`,
          backgroundColor: '#ffffff'
        };
      }
      
      // Add special highlight for our own selection (takes priority over other users)
      if (selectedNodes.includes(node.id)) {
        style = {
          ...style,
          border: `3px solid ${userColor.current}`,
          boxShadow: `0 0 12px ${userColor.current}60`,
          backgroundColor: '#ffffff'
        };
      }
      
      return { ...node, style };
    });
  }, [nodes, userSelections, selectedNodes]);

  return (
    <div className="node-diagram-app" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="app-header" style={{ padding: '1rem', background: '#f5f5f5', borderBottom: '1px solid #ddd' }}>
        <h1>🔗 Collaborative Node Diagram</h1>
        <p>Built with Yjs + React Flow - Real-time node collaboration!</p>
        
        <div className="room-controls" style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '0.5rem' }}>
          <label>
            Room Name: 
            <input
              type="text"
              value={roomName}
              onChange={handleRoomChange}
              placeholder="Enter room name"
              style={{ marginLeft: '0.5rem' }}
            />
          </label>
          
          <label>
            Your username:
            <input
              type="text"
              value={username}
              onChange={handleUsernameChange}
              placeholder="Enter username"
              style={{ marginLeft: '0.5rem' }}
            />
          </label>
          
          <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </span>
        </div>

        <div className="controls" style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          <button onClick={addNode} style={{ padding: '0.5rem 1rem', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}>
            ➕ Add Node
          </button>
          <button onClick={clearNodes} style={{ padding: '0.5rem 1rem', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px' }}>
            🗑️ Clear All
          </button>
        </div>

        <div className="users" style={{ marginTop: '0.5rem' }}>
          <strong>Connected Users:</strong>
          {connectedUsers.map((user, index) => (
            <span key={index} style={{ marginLeft: '0.5rem', color: user.color, fontWeight: 'bold' }}>
              • {user.name}
            </span>
          ))}
        </div>
      </header>

      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={getStyledNodes()}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onNodeDragStart={handleNodeDragStart}
          onNodeDrag={handleNodeDrag}
          onNodeDragStop={handleNodeDragStop}
          onSelectionChange={handleSelectionChange}
          fitView
          multiSelectionKeyCode="Shift"
          deleteKeyCode="Delete"
        >
          <Controls />
          <MiniMap />
          <Background variant="dots" gap={12} size={1} />
        </ReactFlow>
      </div>

      <div className="info-panel" style={{ padding: '1rem', background: '#f9f9f9', borderTop: '1px solid #ddd' }}>
        <div style={{ display: 'flex', gap: '2rem' }}>
          <div>
            <h3>Nodes: {nodes.length}</h3>
            <div style={{ fontSize: '0.8rem', color: '#666' }}>
              {nodes.length > 0 && `Latest: ${nodes[nodes.length - 1]?.data?.label || 'N/A'}`}
            </div>
          </div>
          <div>
            <h3>Edges: {edges.length}</h3>
          </div>
        </div>
        
        <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
          <strong>Instructions:</strong> 
          <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
            <li>Click "Add Node" to create nodes</li>
            <li>Drag nodes to move them (others see your user color border while dragging)</li>
            <li>Click nodes to select them (others see your user color border when selected)</li>
            <li>Hold Shift to select multiple nodes</li>
            <li>Drag between nodes to connect them</li>
            <li>Press Delete to remove selected items</li>
          </ul>
          <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.5rem' }}>
            <strong>Visual Feedback:</strong> Node borders show user colors when interacting - thicker borders for dragging, thinner for selection
          </div>
        </div>
      </div>
    </div>
  );
};

export default NodeDiagram; 