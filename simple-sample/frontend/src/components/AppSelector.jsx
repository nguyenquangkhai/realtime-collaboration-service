import React, { useState } from 'react';

const AppSelector = ({ onSelectApp, initialRoomName = '' }) => {
  const [selectedRoom, setSelectedRoom] = useState(initialRoomName);

  const apps = [
    {
      id: 'text',
      name: 'Text Editor',
      description: 'Collaborative text editing with Quill',
      icon: '📝',
      features: ['Rich text editing', 'Real-time cursors', 'User awareness', 'Persistent storage']
    },
    {
      id: 'nodes',
      name: 'Node Diagram',
      description: 'Collaborative node diagrams with React Flow',
      icon: '🔗',
      features: ['Visual node editing', 'Real-time updates', 'Node connections', 'Collaborative drawing']
    }
  ];

  const handleAppSelect = (appType) => {
    const roomName = selectedRoom || `default-room-${Date.now()}`;
    onSelectApp(appType, roomName);
  };

  return (
    <div className="app-selector">
      <header className="app-selector-header">
        <h1>🚀 Collaborative Workspace</h1>
        <p>Choose your collaboration tool and start working together in real-time!</p>
      </header>

      <div className="room-input">
        <label htmlFor="room-name">
          <strong>Room Name:</strong>
        </label>
        <input
          id="room-name"
          type="text"
          value={selectedRoom}
          onChange={(e) => setSelectedRoom(e.target.value)}
          placeholder="Enter a room name (optional)"
        />
        <small>Leave empty to auto-generate a room name</small>
      </div>

      <div className="apps-grid">
        {apps.map((app) => (
          <div key={app.id} className="app-card">
            <div className="app-icon">{app.icon}</div>
            <h3>{app.name}</h3>
            <p>{app.description}</p>
            
            <ul className="app-features">
              {app.features.map((feature, index) => (
                <li key={index}>✓ {feature}</li>
              ))}
            </ul>
            
            <button 
              className="app-select-button"
              onClick={() => handleAppSelect(app.id)}
            >
              Start {app.name}
            </button>
          </div>
        ))}
      </div>

      <div className="info-section">
        <h3>How it works:</h3>
        <ol>
          <li>Choose an application type above</li>
          <li>Enter a room name (or use auto-generated)</li>
          <li>Share the URL with collaborators</li>
          <li>Start collaborating in real-time!</li>
        </ol>
        
        <div className="tech-stack">
          <h4>Built with:</h4>
          <div className="tech-tags">
            <span className="tech-tag">Yjs</span>
            <span className="tech-tag">WebSockets</span>
            <span className="tech-tag">Redis</span>
            <span className="tech-tag">React</span>
            <span className="tech-tag">Quill</span>
            <span className="tech-tag">React Flow</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .app-selector {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        }

        .app-selector-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .app-selector-header h1 {
          font-size: 2.5rem;
          margin-bottom: 0.5rem;
          color: #333;
        }

        .app-selector-header p {
          font-size: 1.1rem;
          color: #666;
          margin: 0;
        }

        .room-input {
          background: #f8f9fa;
          padding: 1.5rem;
          border-radius: 8px;
          margin-bottom: 2rem;
          text-align: center;
        }

        .room-input label {
          display: block;
          margin-bottom: 0.5rem;
          color: #333;
        }

        .room-input input {
          width: 100%;
          max-width: 400px;
          padding: 0.75rem;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 1rem;
        }

        .room-input small {
          display: block;
          margin-top: 0.5rem;
          color: #666;
        }

        .apps-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 2rem;
          margin-bottom: 3rem;
        }

        .app-card {
          background: white;
          border: 2px solid #e9ecef;
          border-radius: 12px;
          padding: 2rem;
          text-align: center;
          transition: all 0.3s ease;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .app-card:hover {
          border-color: #007bff;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }

        .app-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .app-card h3 {
          margin: 0 0 0.5rem 0;
          color: #333;
          font-size: 1.5rem;
        }

        .app-card p {
          color: #666;
          margin: 0 0 1.5rem 0;
          line-height: 1.5;
        }

        .app-features {
          list-style: none;
          padding: 0;
          margin: 0 0 2rem 0;
          text-align: left;
        }

        .app-features li {
          padding: 0.25rem 0;
          color: #555;
        }

        .app-select-button {
          background: #007bff;
          color: white;
          border: none;
          padding: 0.75rem 2rem;
          font-size: 1rem;
          border-radius: 6px;
          cursor: pointer;
          transition: background-color 0.2s ease;
          width: 100%;
        }

        .app-select-button:hover {
          background: #0056b3;
        }

        .info-section {
          background: #f8f9fa;
          padding: 2rem;
          border-radius: 8px;
          text-align: center;
        }

        .info-section h3 {
          margin-top: 0;
          color: #333;
        }

        .info-section ol {
          text-align: left;
          max-width: 600px;
          margin: 0 auto 2rem auto;
        }

        .info-section li {
          margin: 0.5rem 0;
          color: #555;
        }

        .tech-stack h4 {
          margin: 0 0 1rem 0;
          color: #333;
        }

        .tech-tags {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 0.5rem;
        }

        .tech-tag {
          background: #e9ecef;
          color: #495057;
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.875rem;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
};

export default AppSelector; 