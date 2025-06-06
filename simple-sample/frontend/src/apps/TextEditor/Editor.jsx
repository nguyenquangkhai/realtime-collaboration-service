import React, { forwardRef, useEffect, useLayoutEffect, useRef } from 'react';
import Quill from 'quill';
import QuillCursors from 'quill-cursors';
import DoUsername from 'do_username';
import * as Y from 'yjs';
import { QuillBinding } from 'y-quill';
import { WebsocketProvider } from 'y-websocket';

// Register the cursors module
Quill.register('modules/cursors', QuillCursors);

// Editor is an uncontrolled React component
const Editor = forwardRef(
  ({ readOnly, defaultValue, onTextChange, onSelectionChange, onConnectionChange, roomName = 'default-room', appType = 'text' }, ref) => {
    const containerRef = useRef(null);
    const defaultValueRef = useRef(defaultValue);
    const onTextChangeRef = useRef(onTextChange);
    const onSelectionChangeRef = useRef(onSelectionChange);
    const onConnectionChangeRef = useRef(onConnectionChange);
    const ydocRef = useRef(null);
    const providerRef = useRef(null);
    const bindingRef = useRef(null);

    useLayoutEffect(() => {
      onTextChangeRef.current = onTextChange;
      onSelectionChangeRef.current = onSelectionChange;
      onConnectionChangeRef.current = onConnectionChange;
    });

    useEffect(() => {
      ref.current?.enable(!readOnly);
    }, [ref, readOnly]);

    useEffect(() => {
      const container = containerRef.current;
      const editorContainer = container.appendChild(
        container.ownerDocument.createElement('div'),
      );

      // Create Quill instance with collaboration features
      const quill = new Quill(editorContainer, {
        modules: {
          cursors: {
            hideDelayMs: 5000,
            hideSpeedMs: 300,
            transformOnTextChange: true
          },
          toolbar: [
            // Basic Quill content features
            [{ header: [1, 2, false] }],
            ['bold', 'italic', 'underline'],
            ['image', 'code-block'],
            ['clean'] // remove formatting button
          ],
          history: {
            // Local undo shouldn't undo changes from remote users
            userOnly: true
          }
        },
        placeholder: 'Start collaborating...',
        theme: 'snow'
      });

      ref.current = quill;

      // Create Yjs document
      const ydoc = new Y.Doc();
      ydocRef.current = ydoc;

      // Define a shared text type on the document
      const ytext = ydoc.getText('quill');

      // Create WebSocket provider to sync with backend - include app type in URL
      const wsUrl = `ws://localhost:3001/${roomName}?appType=${appType}`;
      console.log('Connecting to WebSocket:', wsUrl);
      const provider = new WebsocketProvider(wsUrl, roomName, ydoc);
      // All network providers implement the awareness protocol. You can use it to propagate information about yourself.
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

      // Each user should be associated to a color.
      // One approach is to pick a random color from a pool of colors that work well with your project.
      const usercolors = [
        '#30bced',
        '#6eeb83',
        '#ffbc42',
        '#ecd444',
        '#ee6352',
        '#9ac2c9',
        '#8acb88',
        '#1be7ff'
      ]
      const myColor = usercolors[Math.floor(Math.random() * usercolors.length)]

      // Generate a random username
      const randomUsername = DoUsername.generate(15);
      
      // Set user awareness state immediately
      awareness.setLocalStateField('user', { 
        name: randomUsername, 
        color: myColor 
      });

      // Create editor binding to sync Quill with Yjs
      const binding = new QuillBinding(ytext, quill, awareness);
      bindingRef.current = binding;

      // Integrate QuillCursors with Awareness for collaborative cursors
      const cursors = quill.getModule('cursors');
      
             // Listen to awareness changes and manually update cursors
       const updateCursors = () => {
         const states = awareness.getStates();
         
         states.forEach((state, clientId) => {
           if (clientId !== awareness.clientID && state.user) {
             const user = state.user;
             const cursor = state.cursor;
             
             if (cursor && cursor.anchor && cursor.head) {
               try {
                 // Convert Yjs relative positions to absolute positions
                 const anchorAbsolute = Y.createAbsolutePositionFromRelativePosition(cursor.anchor, ydoc);
                 const headAbsolute = Y.createAbsolutePositionFromRelativePosition(cursor.head, ydoc);
                 
                 if (anchorAbsolute !== null && headAbsolute !== null) {
                   const range = {
                     index: Math.min(anchorAbsolute.index, headAbsolute.index),
                     length: Math.abs(headAbsolute.index - anchorAbsolute.index)
                   };
                   
                   // Create or update cursor
                   cursors.createCursor(clientId.toString(), user.name, user.color);
                   cursors.moveCursor(clientId.toString(), range);
                 } else {
                   // Remove cursor if position conversion failed
                   cursors.removeCursor(clientId.toString());
                 }
               } catch (error) {
                 console.debug('Error converting cursor position:', error);
                 cursors.removeCursor(clientId.toString());
               }
             } else {
               // Remove cursor if no position data
               cursors.removeCursor(clientId.toString());
             }
           }
         });
        
        // Remove cursors for disconnected clients
        Object.keys(cursors.cursors || {}).forEach(clientId => {
          const id = parseInt(clientId);
          if (!states.has(id) || !states.get(id)?.user) {
            cursors.removeCursor(clientId);
          }
        });
      };
      
      // Listen to awareness changes
      awareness.on('change', updateCursors);
      
      // Initial cursor update
      updateCursors();

      // (optional) Remove the selection when the iframe is blurred
      window.addEventListener('blur', () => { quill.blur() })

      // Set initial content if provided
      if (defaultValueRef.current && ytext.length === 0) {
        quill.setContents(defaultValueRef.current);
      }

      // Find username input in the parent component and set its value
      const inputElement = document.querySelector('#username');
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

      // Render a list of usernames next to the editor whenever new information is available from the awareness instance
      awareness.on('change', () => {
        // Map each awareness state to a dom-string
        const strings = [];
        awareness.getStates().forEach(state => {
          console.log('Awareness state:', state);
          if (state.user) {
            strings.push(`<div style="color:${state.user.color};">• ${state.user.name}</div>`);
          }
        });
        
        const usersElement = document.querySelector('#users');
        if (usersElement) {
          usersElement.innerHTML = strings.join('');
        }
      });

      // // Handle text changes
      // quill.on(Quill.events.TEXT_CHANGE, (...args) => {
      //   onTextChangeRef.current?.(...args);
      // });

      // // Handle selection changes
      // quill.on(Quill.events.SELECTION_CHANGE, (...args) => {
      //   onSelectionChangeRef.current?.(...args);
      // });

      // Cleanup function
      return () => {
        bindingRef.current?.destroy();
        providerRef.current?.destroy();
        ydocRef.current?.destroy();
        ref.current = null;
        container.innerHTML = '';
      };
    }, [ref, roomName, appType]);

    return <div ref={containerRef}></div>;
  },
);

Editor.displayName = 'Editor';

export default Editor; 