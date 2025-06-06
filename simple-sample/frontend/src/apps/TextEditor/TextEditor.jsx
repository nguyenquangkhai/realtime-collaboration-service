import React, { useRef, useState, useEffect } from 'react';
import Editor from './Editor';
import './TextEditor.css';

const TextEditor = ({ roomName: initialRoomName = 'text-collaborative-room' }) => {
  const [range, setRange] = useState();
  const [lastChange, setLastChange] = useState();
  const [readOnly, setReadOnly] = useState(false);
  const [roomName, setRoomName] = useState(initialRoomName);
  const [isConnected, setIsConnected] = useState(false);

  // Use a ref to access the quill instance directly
  const quillRef = useRef();

  const handleRoomChange = (e) => {
    setRoomName(e.target.value);
  };

  const handleConnectionChange = (connected) => {
    setIsConnected(connected);
  };

  return (
    <div className="text-editor-app">
      <header className="app-header">
        <h1>📝 Collaborative Text Editor</h1>
        <p>Built with Yjs + Quill - Real-time text collaboration!</p>
      </header>

      <div className="room-selector">
        <label>
          Room Name: 
          <input
            type="text"
            value={roomName}
            onChange={handleRoomChange}
            placeholder="Enter room name"
          />
        </label>
        <label>
          Your username:
          <input id="username" type="text" />
        </label>
        <div id="users"></div>
        <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </span>
      </div>

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
      </div>

      <div className="controls">
        <label>
          Read Only:{' '}
          <input
            type="checkbox"
            checked={readOnly}
            onChange={(e) => setReadOnly(e.target.checked)}
          />
        </label>
        <button
          className="controls-button"
          type="button"
          onClick={() => {
            const length = quillRef.current?.getLength();
            alert(`Content length: ${length} characters`);
          }}
        >
          Get Content Length
        </button>
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