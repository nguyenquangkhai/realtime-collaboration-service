import React from 'react';

const NodeDiagramHeader = ({ 
  roomName, 
  onRoomChange, 
  username, 
  onUsernameChange, 
  isConnected, 
  connectedUsers 
}) => {
  return (
    <header className="app-header">
      <h1>🔗 Collaborative Node Diagram</h1>
      <p>Built with Yjs + React Flow - Real-time node collaboration!</p>
      
      <div className="room-controls">
        <label>
          Room Name: 
          <input
            type="text"
            value={roomName}
            onChange={onRoomChange}
            placeholder="Enter room name"
          />
        </label>
        
        <label>
          Your username:
          <input
            type="text"
            value={username}
            onChange={onUsernameChange}
            placeholder="Enter username"
          />
        </label>
        
        <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </span>
      </div>

      <div className="users">
        <strong>Connected Users:</strong>
        {connectedUsers.map((user, index) => (
          <span key={index} className="user-item" style={{ color: user.color }}>
            • {user.name}
          </span>
        ))}
      </div>
    </header>
  );
};

export default NodeDiagramHeader; 