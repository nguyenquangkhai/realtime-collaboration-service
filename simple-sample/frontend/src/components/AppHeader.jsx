import React, { useEffect } from 'react';
import '@material/web/textfield/outlined-text-field.js';
import '@material/web/switch/switch.js';
import { generateRandomUsername } from '../utils/userUtils';
import './AppHeader.css';

const AppHeader = ({ 
  icon,
  title, 
  subtitle,
  roomName, 
  onRoomChange, 
  username, 
  onUsernameChange, 
  isConnected,
  connectedUsers = [],
  showUsers = false,
  generateRandomUsernameOnMount = true
}) => {
  
  // Generate random username if empty and requested
  useEffect(() => {
    if (generateRandomUsernameOnMount && !username && onUsernameChange) {
      const randomUsername = generateRandomUsername();
      onUsernameChange({ target: { value: randomUsername } });
    }
  }, [generateRandomUsernameOnMount, username, onUsernameChange]);
  return (
    <header className="app-header">
      <h1>{icon} {title}</h1>
      <p>{subtitle}</p>
      
      <div className="room-controls">
        <md-outlined-text-field
          label="Room Name"
          value={roomName}
          onInput={onRoomChange}
          placeholder="Enter room name"
        />
        <md-outlined-text-field
          id="username"
          label="Your username"
          value={username}
          onInput={onUsernameChange}
          placeholder="Enter username"
        />
        <div className="connection-control">
          <label className="connection-label">
            <span className="connection-icon">{isConnected ? '📶' : '📵'}</span>
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
            <md-switch 
              selected={isConnected}
              disabled
              className={`connection-switch ${isConnected ? 'connected' : 'disconnected'}`}
              style={{
                '--md-switch-selected-track-color': isConnected ? '#4caf50' : '#f44336',
                '--md-switch-unselected-track-color': '#f44336',
                '--md-switch-selected-handle-color': '#ffffff',
                '--md-switch-unselected-handle-color': '#ffffff'
              }}
            />
          </label>
        </div>
      </div>

      {showUsers && (
        <div className="users">
          <strong>Connected Users:</strong>
          {connectedUsers.length > 0 ? (
            connectedUsers.map((user, index) => (
              <span key={index} className="user-item" style={{ color: user.color }}>
                • {user.name}
              </span>
            ))
          ) : (
            <span className="user-item" style={{ opacity: 0.7 }}>
              No users connected yet
            </span>
          )}
        </div>
      )}
    </header>
  );
};

export default AppHeader; 