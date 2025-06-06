import React, { useRef, useState, useEffect } from 'react';
import Editor from './Editor';

const App = () => {
  const [range, setRange] = useState();
  const [lastChange, setLastChange] = useState();
  const [readOnly, setReadOnly] = useState(false);
  const [roomName, setRoomName] = useState('collaborative-room');
  const [isConnected, setIsConnected] = useState(false);

  // Use a ref to access the quill instance directly
  const quillRef = useRef();

  const handleRoomChange = (e) => {
    setRoomName(e.target.value);
  };

  const handleConnectionChange = (connected) => {
    setIsConnected(connected);
  };

  // Add cursor styles
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      /* Cursor styles for collaborative editing - more specific and visible */
      .ql-cursor-flag {
        background-color: #000 !important;
        border-radius: 3px !important;
        color: white !important;
        font-size: 12px !important;
        font-weight: bold !important;
        padding: 3px 6px !important;
        position: absolute !important;
        white-space: nowrap !important;
        z-index: 10000 !important;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2) !important;
        margin-top: -25px !important;
        margin-left: -3px !important;
      }
      
      .ql-cursor-caret {
        background-color: #000 !important;
        height: 100% !important;
        position: absolute !important;
        width: 2px !important;
        z-index: 9999 !important;
        pointer-events: none !important;
      }
      
      .ql-cursor {
        position: absolute !important;
        z-index: 9999 !important;
        pointer-events: none !important;
      }
      
      .ql-cursor-selection {
        background-color: rgba(0, 0, 255, 0.3) !important;
        position: absolute !important;
        pointer-events: none !important;
        z-index: 9998 !important;
      }

      /* Ensure quill editor allows cursor positioning */
      .ql-editor {
        position: relative !important;
      }
      
      /* User list styling */
      #users {
        margin-top: 10px;
        font-size: 14px;
      }
      
      #users div {
        padding: 2px 0;
        font-weight: 500;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>🚀 Collaborative Editor</h1>
        <p>Built with Yjs + Quill - Real-time collaboration made simple!</p>
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
          roomName={roomName}
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

export default App;