import React, { useState, useEffect } from 'react';
import AppSelector from './components/AppSelector';
import TextEditor from './apps/TextEditor/TextEditor';
import NodeDiagram from './apps/NodeDiagram/NodeDiagram';
import Table from './apps/Table/Table';

const App = () => {
  const [currentApp, setCurrentApp] = useState(null);
  const [roomName, setRoomName] = useState('');

  // Check URL parameters for direct app access and restore from localStorage
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const appType = urlParams.get('app');
    const room = urlParams.get('room');
    
    if (appType && room) {
      setCurrentApp(appType);
      setRoomName(room);
      // Save to localStorage
      localStorage.setItem('lastRoomName', room);
    } else {
      // Restore last room name from localStorage
      const savedRoomName = localStorage.getItem('lastRoomName');
      if (savedRoomName) {
        setRoomName(savedRoomName);
      }
    }
  }, []);

  const handleSelectApp = (appType, selectedRoom) => {
    setCurrentApp(appType);
    setRoomName(selectedRoom);
    
    // Save to localStorage
    localStorage.setItem('lastRoomName', selectedRoom);
    
    // Update URL for sharing
    const url = new URL(window.location);
    url.searchParams.set('app', appType);
    url.searchParams.set('room', selectedRoom);
    window.history.pushState({}, '', url);
  };

  const handleBackToHome = () => {
    setCurrentApp(null);
    // Keep the room name - don't clear it
    
    // Clear URL parameters
    const url = new URL(window.location);
    url.searchParams.delete('app');
    url.searchParams.delete('room');
    window.history.pushState({}, '', url);
  };

  const renderCurrentApp = () => {
    switch (currentApp) {
      case 'text':
        return <TextEditor roomName={roomName} />;
      case 'nodes':
        return <NodeDiagram roomName={roomName} />;
      case 'table':
        return <Table roomName={roomName} />;
      default:
        return <AppSelector onSelectApp={handleSelectApp} initialRoomName={roomName} />;
    }
  };

  return (
    <div className="app">
      {currentApp && (
        <div className="back-button-container">
          <button className="back-button" onClick={handleBackToHome}>
            ← Back to Home
          </button>
        </div>
      )}
      
      {renderCurrentApp()}

      <style jsx>{`
        .app {
          min-height: 100vh;
          background: #ffffff;
        }

        .back-button-container {
          position: fixed;
          top: 1rem;
          left: 1rem;
          z-index: 1000;
        }

        .back-button {
          background: #6c757d;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9rem;
          transition: background-color 0.2s ease;
        }

        .back-button:hover {
          background: #545b62;
        }
      `}</style>
    </div>
  );
};

export default App;