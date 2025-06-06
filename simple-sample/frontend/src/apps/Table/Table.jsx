import React, { useState, useEffect, useCallback } from 'react';
import DatasheetEditor from './DatasheetEditor';

const Table = ({ roomName: initialRoomName = 'table-collaborative-room' }) => {
  const [roomName, setRoomName] = useState(initialRoomName);
  const [isConnected, setIsConnected] = useState(false);
  const [currentData, setCurrentData] = useState([]);

  const handleRoomChange = (e) => {
    setRoomName(e.target.value);
  };

  const handleConnectionChange = useCallback((connected) => {
    setIsConnected(connected);
  }, []);

  const handleDataChange = useCallback((data) => {
    setCurrentData(data);
  }, []);

  return (
    <div className="table-app">
      <header className="app-header">
        <h1>📋 Collaborative Table Editor</h1>
        <p>Built with Yjs + React-Datasheet - Real-time spreadsheet collaboration!</p>
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
          <input id="table-username" type="text" />
        </label>
        <div id="table-users"></div>
        <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </span>
      </div>

      <div className="table-container">
        <DatasheetEditor
          roomName={`table-${roomName}`}
          appType="table"
          onConnectionChange={handleConnectionChange}
          onDataChange={handleDataChange}
        />
      </div>

      <div className="table-stats">
        <div className="stats-section">
          <h3>Table Stats:</h3>
          <p>Rows: {currentData.length}</p>
          <p>Columns: {currentData.length > 0 ? currentData[0]?.length || 0 : 0}</p>
          <p>Total Cells: {currentData.reduce((total, row) => total + (row?.length || 0), 0)}</p>
        </div>
      </div>

      <div className="instructions">
        <h3>How to collaborate on tables:</h3>
        <ol>
          <li>Open this page in multiple browser tabs or windows</li>
          <li>Make sure all tabs use the same room name</li>
          <li>Click on any cell to start editing</li>
          <li>Use Tab, Enter, or arrow keys to navigate between cells</li>
          <li>Copy/paste data to and from other spreadsheet applications</li>
          <li>Use the sample data buttons to generate realistic test data with Faker.js</li>
          <li>Right-click on any cell for context menu options</li>
          <li>See real-time changes from other collaborators!</li>
        </ol>
        
        <div className="keyboard-shortcuts">
          <h4>Keyboard Shortcuts:</h4>
          <ul>
            <li><strong>Enter/Tab:</strong> Confirm edit and move to next cell</li>
            <li><strong>Escape:</strong> Cancel current edit</li>
            <li><strong>Arrow keys:</strong> Navigate between cells</li>
            <li><strong>Delete/Backspace:</strong> Clear selected cells</li>
            <li><strong>Ctrl+C/Ctrl+V:</strong> Copy and paste cells</li>
            <li><strong>Double-click:</strong> Edit cell content</li>
          </ul>
        </div>
      </div>

      <style jsx>{`
        .table-app {
          max-width: 1400px;
          margin: 0 auto;
          padding: 2rem;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        }

        .app-header {
          text-align: center;
          margin-bottom: 2rem;
          padding-bottom: 1rem;
          border-bottom: 2px solid #e9ecef;
        }

        .app-header h1 {
          font-size: 2.5rem;
          margin-bottom: 0.5rem;
          color: #333;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .app-header p {
          font-size: 1.1rem;
          color: #666;
          margin: 0;
        }

        .room-selector {
          background: #f8f9fa;
          padding: 1.5rem;
          border-radius: 8px;
          margin-bottom: 2rem;
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          align-items: center;
        }

        .room-selector label {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          color: #333;
          font-weight: 500;
        }

        .room-selector input {
          padding: 0.75rem;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 1rem;
          min-width: 200px;
        }

        .room-selector input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .connection-status {
          padding: 0.5rem 1rem;
          border-radius: 20px;
          font-weight: 500;
          font-size: 0.9rem;
        }

        .connection-status.connected {
          background: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }

        .connection-status.disconnected {
          background: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }

        #table-users {
          font-size: 0.9rem;
          color: #666;
          margin-left: auto;
        }

        .table-container {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          padding: 1rem;
          margin-bottom: 2rem;
          overflow-x: auto;
        }

        .table-stats {
          background: #f8f9fa;
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 2rem;
        }

        .stats-section h3 {
          margin: 0 0 1rem 0;
          color: #333;
          font-size: 1.1rem;
        }

        .stats-section p {
          margin: 0.25rem 0;
          color: #666;
          font-size: 0.9rem;
        }

        .instructions {
          background: #e3f2fd;
          padding: 2rem;
          border-radius: 8px;
          margin-top: 2rem;
        }

        .instructions h3 {
          margin: 0 0 1rem 0;
          color: #1565c0;
          font-size: 1.3rem;
        }

        .instructions h4 {
          margin: 1.5rem 0 0.5rem 0;
          color: #1565c0;
          font-size: 1.1rem;
        }

        .instructions ol {
          margin: 0;
          padding-left: 1.5rem;
          color: #333;
        }

        .instructions ol li {
          margin: 0.5rem 0;
          line-height: 1.5;
        }

        .keyboard-shortcuts {
          margin-top: 1.5rem;
        }

        .keyboard-shortcuts ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .keyboard-shortcuts li {
          padding: 0.5rem 0;
          border-bottom: 1px solid rgba(21, 101, 192, 0.1);
          color: #333;
        }

        .keyboard-shortcuts li:last-child {
          border-bottom: none;
        }

        .keyboard-shortcuts strong {
          color: #1565c0;
          min-width: 120px;
          display: inline-block;
        }

        @media (max-width: 768px) {
          .table-app {
            padding: 1rem;
          }

          .app-header h1 {
            font-size: 2rem;
          }

          .room-selector {
            flex-direction: column;
            align-items: stretch;
          }

          .room-selector input {
            min-width: unset;
          }

          .table-container {
            padding: 0.5rem;
          }
        }
      `}</style>
    </div>
  );
};

export default Table; 