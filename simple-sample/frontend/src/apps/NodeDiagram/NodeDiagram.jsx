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

  // Yjs refs
  const ydocRef = useRef(null);
  const providerRef = useRef(null);
  const ynodesRef = useRef(null);
  const yedgesRef = useRef(null);
  const awarenessRef = useRef(null);
  const isUpdatingFromYjs = useRef(false);

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
    
    if (awarenessRef.current) {
      awarenessRef.current.setLocalStateField('user', { 
        name: newUsername, 
        color: userColors[Math.floor(Math.random() * userColors.length)]
      });
    }
  };

  // Initialize Yjs collaboration
  useEffect(() => {
    // Generate random username
    const randomUsername = DoUsername.generate(15);
    setUsername(randomUsername);

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
      color: userColors[Math.floor(Math.random() * userColors.length)]
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

    // Listen to awareness changes for user list
    awareness.on('change', () => {
      const users = [];
      awareness.getStates().forEach(state => {
        if (state.user) {
          users.push(state.user);
        }
      });
      setConnectedUsers(users);
    });

    // Listen to nodes changes from Yjs
    const updateNodesFromYjs = () => {
      if (isUpdatingFromYjs.current) return;
      
      const yNodesArray = ynodesRef.current?.toArray() || [];
      setNodes(yNodesArray);
    };

    // Listen to edges changes from Yjs
    const updateEdgesFromYjs = () => {
      if (isUpdatingFromYjs.current) return;
      
      const yEdgesArray = yedgesRef.current?.toArray() || [];
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
    const newNodes = applyNodeChanges(changes, nodes);
    
    // Check if this is a delete operation
    const deletedNodes = changes.filter(change => change.type === 'remove');
    
    if (deletedNodes.length > 0 && ynodesRef.current) {
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
    const newEdges = applyEdgeChanges(changes, edges);
    
    // Check if this is a delete operation
    const deletedEdges = changes.filter(change => change.type === 'remove');
    
    if (deletedEdges.length > 0 && yedgesRef.current) {
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
      isUpdatingFromYjs.current = true;
      yedgesRef.current.push([newEdge]);
      isUpdatingFromYjs.current = false;
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
      isUpdatingFromYjs.current = true;
      ynodesRef.current.push([newNode]);
      console.log('Node added to Yjs array');
    } catch (error) {
      console.error('Error adding node:', error);
      alert('Error adding node: ' + error.message);
    } finally {
      isUpdatingFromYjs.current = false;
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
      isUpdatingFromYjs.current = true;
      ynodesRef.current.delete(0, ynodesRef.current.length);
      yedgesRef.current.delete(0, yedgesRef.current.length);
      console.log('All nodes and edges cleared');
    } catch (error) {
      console.error('Error clearing nodes:', error);
      alert('Error clearing nodes: ' + error.message);
    } finally {
      isUpdatingFromYjs.current = false;
    }
  }, [isConnected]);

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
            <span key={index} style={{ marginLeft: '0.5rem', color: user.color }}>
              • {user.name}
            </span>
          ))}
        </div>
      </header>

      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          fitView
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
          </div>
          <div>
            <h3>Edges: {edges.length}</h3>
          </div>
        </div>
        
        <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
          <strong>Instructions:</strong> Click "Add Node" to create nodes, drag to connect them, select and delete with backspace/delete key
        </div>
      </div>
    </div>
  );
};

export default NodeDiagram; 