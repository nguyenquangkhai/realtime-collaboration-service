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
  ({ readOnly, defaultValue, onTextChange, onSelectionChange, roomName = 'default-room' }, ref) => {
    const containerRef = useRef(null);
    const defaultValueRef = useRef(defaultValue);
    const onTextChangeRef = useRef(onTextChange);
    const onSelectionChangeRef = useRef(onSelectionChange);
    const ydocRef = useRef(null);
    const providerRef = useRef(null);
    const bindingRef = useRef(null);

    useLayoutEffect(() => {
      onTextChangeRef.current = onTextChange;
      onSelectionChangeRef.current = onSelectionChange;
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
          cursors: true,
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

      // Create WebSocket provider to sync with backend
      const provider = new WebsocketProvider('ws://localhost:3001', roomName, ydoc);
      // All network providers implement the awareness protocol. You can use it to propagate information about yourself.
      const awareness = provider.awareness;
      providerRef.current = provider;

      // Create editor binding to sync Quill with Yjs
      const binding = new QuillBinding(ytext, quill, awareness);
      bindingRef.current = binding;

      // Set initial content if provided
      if (defaultValueRef.current && ytext.length === 0) {
        quill.setContents(defaultValueRef.current);
      }

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

      const inputElement = document.querySelector('#username')
      // propagate the username from the input element to all users
      const setUsername = () => {
        awareness.setLocalStateField('user', { name: inputElement.value, color: myColor })
      }
      // observe changes on the input element that contains the username
      inputElement.addEventListener('input', setUsername);
      // Set a randomly generated username - this is nice for testing
      inputElement.value = DoUsername.generate(15)
      setUsername()

      // // Render a list of usernames next to the editor whenever new information is available from the awareness instance
      awareness.on('change', () => {
        // Map each awareness state to a dom-string
        const strings = []
        awareness.getStates().forEach(state => {
          console.log(state)
          if (state.user) {
            strings.push(`<div style="color:${state.user.color};">• ${state.user.name}</div>`)
          }
          document.querySelector('#users').innerHTML = strings.join('')
        })
      })

      // Handle text changes
      quill.on(Quill.events.TEXT_CHANGE, (...args) => {
        onTextChangeRef.current?.(...args);
      });

      // Handle selection changes
      quill.on(Quill.events.SELECTION_CHANGE, (...args) => {
        onSelectionChangeRef.current?.(...args);
      });

      // Cleanup function
      return () => {
        bindingRef.current?.destroy();
        providerRef.current?.destroy();
        ydocRef.current?.destroy();
        ref.current = null;
        container.innerHTML = '';
      };
    }, [ref, roomName]);

    return <div ref={containerRef}></div>;
  },
);

Editor.displayName = 'Editor';

export default Editor;