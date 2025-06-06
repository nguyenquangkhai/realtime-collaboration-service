import React, { useRef, useState, useEffect } from 'react';
import Editor from './Editor';
import AppHeader from '../../components/AppHeader';
import { useCollaborationUsers } from './hooks/useCollaborationUsers';
import '@material/web/textfield/outlined-text-field.js';
import '@material/web/button/filled-button.js';
import '@material/web/checkbox/checkbox.js';
import '@material/web/labs/badge/badge.js';
import './TextEditor.css';

const TextEditor = ({ roomName: initialRoomName = 'text-collaborative-room' }) => {
  const [range, setRange] = useState();
  const [lastChange, setLastChange] = useState();
  const [readOnly, setReadOnly] = useState(false);
  const [roomName, setRoomName] = useState(initialRoomName);
  const [username, setUsername] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  // Use a ref to access the quill instance directly
  const quillRef = useRef();
  
  // Track connected users
  const { connectedUsers } = useCollaborationUsers();

  const handleRoomChange = (e) => {
    setRoomName(e.target.value);
  };

  const handleUsernameChange = (e) => {
    setUsername(e.target.value);
  };

  const handleConnectionChange = (connected) => {
    setIsConnected(connected);
  };

  return (
    <div className="text-editor-app">
      <AppHeader
        icon="📝"
        title="Collaborative Text Editor"
        subtitle="Built with Yjs + Quill - Real-time text collaboration!"
        roomName={roomName}
        onRoomChange={handleRoomChange}
        username={username}
        onUsernameChange={handleUsernameChange}
        isConnected={isConnected}
        connectedUsers={connectedUsers}
        showUsers={true}
      />

      <div className="editor-container">
        <Editor
          ref={quillRef}
          readOnly={readOnly}
          roomName={`text-${roomName}`}
          appType="text"
          onSelectionChange={setRange}
          onTextChange={setLastChange}
          onConnectionChange={handleConnectionChange}
        />
        {/* Hidden div for Yjs to write user information */}
        <div id="users" style={{ display: 'none' }}></div>
      </div>

      <div className="controls">
        <label className="checkbox-label">
          Read Only:
          <md-checkbox
            checked={readOnly}
            onChange={(e) => setReadOnly(e.target.checked)}
          />
        </label>
        <md-filled-button
          className="controls-button"
          onClick={() => {
            const length = quillRef.current?.getLength();
            alert(`Content length: ${length} characters`);
          }}
        >
          Get Content Length
        </md-filled-button>
      </div>

      <div className="info-panel">
        <div className="info-section">
          <h3>Current Selection:</h3>
          <pre>{range ? JSON.stringify(range, null, 2) : 'No selection'}</pre>
        </div>
        <div className="info-section">
          <h3>Last Change:</h3>
          <pre>{lastChange ? JSON.stringify(lastChange.ops, null, 2) : 'No changes yet'}</pre>
        </div>
      </div>

      <div className="instructions">
        <h3>How to test collaboration:</h3>
        <ol>
          <li>Open this page in multiple browser tabs or windows</li>
          <li>Make sure all tabs use the same room name</li>
          <li>Start typing in one tab and see changes appear in others!</li>
          <li>Try selecting text to see cursor positions</li>
        </ol>
      </div>
    </div>
  );
};

export default TextEditor; 