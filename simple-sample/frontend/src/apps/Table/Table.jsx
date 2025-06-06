import React, { useState, useEffect, useCallback } from 'react';
import DatasheetEditor from './DatasheetEditor';
import './Table.css';

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


    </div>
  );
};

export default Table; 