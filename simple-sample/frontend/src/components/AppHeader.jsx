import React, { useEffect } from 'react';
import { generateRandomUsername } from '../utils/userUtils';

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
    <header className="text-center bg-gradient-to-r from-blue-600 to-purple-600 text-white p-8 rounded-2xl my-8 mx-4 shadow-lg relative backdrop-blur-sm">
      <h1 className="text-3xl md:text-4xl font-semibold mb-2 leading-tight">
        {icon} {title}
      </h1>
      <p className="text-lg opacity-90 mb-6 font-light">
        {subtitle}
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center mt-4 bg-white/10 p-6 rounded-xl backdrop-blur-md border border-white/20">
        <div className="w-full">
          <label className="block text-sm font-medium text-white mb-2">Room Name</label>
          <input
            type="text"
            value={roomName}
            onChange={onRoomChange}
            placeholder="Enter room name"
            className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/70 focus:ring-2 focus:ring-white/50 focus:border-white/60 outline-none transition-all duration-200 backdrop-blur-sm"
          />
        </div>
        
        <div className="w-full">
          <label className="block text-sm font-medium text-white mb-2">Your Username</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={onUsernameChange}
            placeholder="Enter username"
            className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/70 focus:ring-2 focus:ring-white/50 focus:border-white/60 outline-none transition-all duration-200 backdrop-blur-sm"
          />
        </div>
        
        <div className="justify-self-center md:justify-self-end bg-white/10 px-4 py-3 rounded-xl backdrop-blur-sm border border-white/20">
          <div className="flex items-center gap-3 text-white text-sm font-medium">
            <span className="text-xl">{isConnected ? '📶' : '📵'}</span>
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
            <div className="relative">
              <input
                type="checkbox"
                checked={isConnected}
                disabled
                className="sr-only"
              />
              <div className={`w-12 h-6 rounded-full transition-colors duration-200 ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 translate-y-0.5 ${
                  isConnected ? 'translate-x-6' : 'translate-x-0.5'
                }`}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showUsers && (
        <div className="text-center mt-4 text-sm text-white/90">
          <strong className="text-white font-medium">Connected Users:</strong>
          {connectedUsers.length > 0 ? (
            connectedUsers.map((user, index) => (
              <span 
                key={index} 
                className="ml-2 font-semibold text-white/95" 
                style={{ color: user.color }}
              >
                • {user.name}
              </span>
            ))
          ) : (
            <span className="ml-2 font-semibold text-white/70">
              No users connected yet
            </span>
          )}
        </div>
      )}
    </header>
  );
};

export default AppHeader; 