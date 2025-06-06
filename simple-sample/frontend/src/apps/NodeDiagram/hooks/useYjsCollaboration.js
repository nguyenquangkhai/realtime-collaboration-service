import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { generateRandomUser, userColors } from '../../../utils/userUtils';

/**
 * Custom hook for Yjs collaboration in NodeDiagram
 */
export const useYjsCollaboration = (roomName) => {
  const [isConnected, setIsConnected] = useState(false);
  const [username, setUsername] = useState('');
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [userSelections, setUserSelections] = useState({});

  // Yjs refs
  const ydocRef = useRef(null);
  const providerRef = useRef(null);
  const ynodesRef = useRef(null);
  const yedgesRef = useRef(null);
  const awarenessRef = useRef(null);
  const userColor = useRef(null);

  // User colors imported from shared utilities

  // Update username and awareness
  const updateUsername = (newUsername) => {
    setUsername(newUsername);
    
    if (awarenessRef.current && userColor.current) {
      awarenessRef.current.setLocalStateField('user', { 
        name: newUsername, 
        color: userColor.current
      });
    }
  };

  // Set awareness fields
  const setAwarenessField = (field, value) => {
    if (awarenessRef.current) {
      awarenessRef.current.setLocalStateField(field, value);
    }
  };

  // Initialize Yjs collaboration
  useEffect(() => {
    // Generate random username and assign color using shared utilities
    const randomUser = generateRandomUser(15);
    setUsername(randomUser.name);
    userColor.current = randomUser.color;

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
      name: randomUser.name, 
      color: randomUser.color
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
      const interactions = {};
      
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
            
            // Only add to object if user has any interactions
            if (userInteraction.selectedNodes.length > 0 || userInteraction.draggedNode) {
              interactions[clientId] = userInteraction;
            }
          }
        }
      });
      
      setConnectedUsers(users);
      setUserSelections({...interactions});
    });

    // Cleanup
    return () => {
      provider?.destroy();
      ydoc?.destroy();
    };
  }, [roomName]);

  return {
    isConnected,
    username,
    connectedUsers,
    userSelections,
    userColor: userColor.current,
    ydocRef,
    providerRef,
    ynodesRef,
    yedgesRef,
    awarenessRef,
    updateUsername,
    setAwarenessField
  };
}; 