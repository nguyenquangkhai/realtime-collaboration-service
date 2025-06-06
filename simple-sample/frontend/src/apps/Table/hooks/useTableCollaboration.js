import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import DoUsername from 'do_username';
import { generateInitialSampleGrid } from '../utils/sampleDataGenerator';

/**
 * Custom hook for Yjs collaboration in DatasheetEditor
 */
export const useTableCollaboration = (roomName, appType, onConnectionChange, onDataChange, setGrid) => {
  const ydocRef = useRef(null);
  const providerRef = useRef(null);
  const yarrayRef = useRef(null);
  const isUpdatingFromYjs = useRef(false);
  const userColorRef = useRef(null);
  const observerRef = useRef(null);
  const onConnectionChangeRef = useRef(onConnectionChange);
  const onDataChangeRef = useRef(onDataChange);

  // Update refs when props change
  useEffect(() => {
    onConnectionChangeRef.current = onConnectionChange;
    onDataChangeRef.current = onDataChange;
  }, [onConnectionChange, onDataChange]);

  // Initialize Yjs document and WebSocket connection
  useEffect(() => {
    // Create Yjs document
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // Create shared array for table data
    const yarray = ydoc.getArray('table');
    yarrayRef.current = yarray;

    // Create WebSocket provider
    const wsUrl = `ws://localhost:3001/${roomName}?appType=${appType}`;
    console.log('Connecting to WebSocket:', wsUrl);
    const provider = new WebsocketProvider(wsUrl, roomName, ydoc);
    const awareness = provider.awareness;
    providerRef.current = provider;

    // Handle connection status changes
    provider.on('status', (event) => {
      onConnectionChangeRef.current?.(event.status === 'connected');
    });

    // Handle connection events
    provider.on('connection-close', () => {
      onConnectionChangeRef.current?.(false);
    });

    provider.on('connection-error', () => {
      onConnectionChangeRef.current?.(false);
    });

    // Set up user color and awareness
    const usercolors = [
      '#30bced', '#6eeb83', '#ffbc42', '#ecd444', 
      '#ee6352', '#9ac2c9', '#8acb88', '#1be7ff'
    ];
    const myColor = usercolors[Math.floor(Math.random() * usercolors.length)];
    userColorRef.current = myColor;

    // Generate a random username
    const randomUsername = DoUsername.generate(15);
    
    // Set user awareness state
    awareness.setLocalStateField('user', { 
      name: randomUsername, 
      color: myColor 
    });

    // Find username input and set its value
    const inputElement = document.querySelector('#table-username');
    if (inputElement) {
      inputElement.value = randomUsername;
      
      // Update awareness when username changes
      const setUsername = () => {
        awareness.setLocalStateField('user', { 
          name: inputElement.value, 
          color: myColor 
        });
      };
      
      inputElement.addEventListener('input', setUsername);
    }

    // Initialize grid if empty
    if (yarray.length === 0) {
      // Create initial 10x5 grid with sample data
      const initialGrid = generateInitialSampleGrid();
      
      // Add empty rows to make it 10 total
      for (let i = initialGrid.length; i < 10; i++) {
        const row = [];
        for (let j = 0; j < 5; j++) {
          row.push({ value: '', readOnly: false });
        }
        initialGrid.push(row);
      }
      
      isUpdatingFromYjs.current = true;
      yarray.delete(0, yarray.length); // Clear any existing data
      yarray.insert(0, initialGrid.map(row => new Y.Array(row.map(cell => new Y.Map(Object.entries(cell))))));
      isUpdatingFromYjs.current = false;
    }

    // Observe changes to Yjs array
    const observer = (event) => {
      if (isUpdatingFromYjs.current) return;
      
      const newGrid = [];
      yarray.forEach(yrow => {
        const row = [];
        yrow.forEach(ycell => {
          const cell = {};
          ycell.forEach((value, key) => {
            cell[key] = value;
          });
          row.push(cell);
        });
        newGrid.push(row);
      });
      
      setGrid(newGrid);
      onDataChangeRef.current?.(newGrid);
    };
    
    observerRef.current = observer;
    yarray.observe(observer);

    // Initial sync
    if (yarray.length > 0) {
      observer();
    }

    // Update user list
    const updateUserList = () => {
      const users = [];
      awareness.getStates().forEach((state, clientId) => {
        if (clientId !== awareness.clientID && state.user) {
          users.push(state.user.name);
        }
      });
      
      const userListElement = document.querySelector('#table-users');
      if (userListElement) {
        userListElement.innerHTML = users.length > 0 
          ? `👥 ${users.length + 1} user(s): ${[randomUsername, ...users].join(', ')}`
          : `👤 Just you: ${randomUsername}`;
      }
    };

    awareness.on('change', updateUserList);
    updateUserList();

    // Cleanup function
    return () => {
      if (observerRef.current && yarrayRef.current) {
        yarrayRef.current.unobserve(observerRef.current);
      }
      if (providerRef.current) {
        providerRef.current.destroy();
      }
      if (ydocRef.current) {
        ydocRef.current.destroy();
      }
    };
  }, [roomName, appType, setGrid]);

  return {
    ydocRef,
    yarrayRef,
    isUpdatingFromYjs,
    userColorRef
  };
}; 