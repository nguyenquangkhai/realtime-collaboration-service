import React, { useState } from 'react';
import '@material/web/button/filled-button.js';
import '@material/web/textfield/outlined-text-field.js';
import '@material/web/labs/card/elevated-card.js';

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
    },
    {
      id: 'table',
      name: 'Table Editor',
      description: 'Collaborative spreadsheet editing with React Datasheet',
      icon: '📋',
      features: ['Spreadsheet interface', 'Cell editing', 'Copy/paste support', 'Faker.js sample data generation', 'Real-time collaboration']
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
        <md-outlined-text-field
          label="Room Name"
          value={selectedRoom}
          onInput={(e) => setSelectedRoom(e.target.value)}
          placeholder="Enter a room name (optional)"
          style={{ width: '100%', maxWidth: '400px' }}
        >
        </md-outlined-text-field>
        <small>Leave empty to auto-generate a room name</small>
      </div>

      <div className="apps-grid">
        {apps.map((app) => (
          <md-elevated-card key={app.id} className="app-card">
            <div className="app-icon">{app.icon}</div>
            <h3>{app.name}</h3>
            <p>{app.description}</p>
            
            <ul className="app-features">
              {app.features.map((feature, index) => (
                <li key={index}>✓ {feature}</li>
              ))}
            </ul>
            
            <md-filled-button 
              className="app-select-button"
              onClick={() => handleAppSelect(app.id)}
            >
              Start {app.name}
            </md-filled-button>
          </md-elevated-card>
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
            <span className="tech-tag">React Datasheet</span>
            <span className="tech-tag">Faker.js</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .app-selector {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
          font-family: var(--md-font-family, 'Roboto', sans-serif);
          background: var(--md-surface, #fef7ff);
          min-height: 100vh;
        }

        .app-selector-header {
          text-align: center;
          margin-bottom: 3rem;
          background: var(--md-primary-container, #eaddff);
          padding: 3rem 2rem;
          border-radius: var(--md-border-radius-xl, 28px);
          margin-bottom: 2rem;
        }

        .app-selector-header h1 {
          font-size: var(--md-font-size-display-large, 3.5rem);
          font-weight: var(--md-font-weight-regular, 400);
          margin-bottom: 1rem;
          color: var(--md-on-primary-container, #21005d);
          line-height: 1.2;
        }

        .app-selector-header p {
          font-size: var(--md-font-size-title-large, 1.375rem);
          color: var(--md-on-primary-container-variant, #4f378b);
          margin: 0;
          font-weight: 400;
        }

        .room-input {
          background: var(--md-sys-color-surface-container);
          padding: 2rem;
          border-radius: 16px;
          margin-bottom: 2rem;
          text-align: center;
          border: 1px solid var(--md-sys-color-outline-variant);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .room-input label {
          display: block;
          margin-bottom: 0.75rem;
          color: var(--md-on-surface, #1c1b1f);
          font-size: var(--md-font-size-title-medium, 1rem);
          font-weight: var(--md-font-weight-medium, 500);
        }

        .room-input input {
          width: 100%;
          max-width: 400px;
          padding: 1rem;
          border: 2px solid var(--md-outline, #79747e);
          border-radius: var(--md-border-radius-s, 4px);
          font-size: var(--md-font-size-body-large, 1rem);
          background: var(--md-surface, #fef7ff);
          color: var(--md-on-surface, #1c1b1f);
          transition: border-color 0.15s ease;
        }

        .room-input input:focus {
          outline: none;
          border-color: var(--md-primary, #6750a4);
          background: var(--md-surface-variant, #e7e0ec);
        }

        .room-input small {
          color: var(--md-sys-color-on-surface-variant);
          font-size: 0.875rem;
          margin: 0;
        }

        .apps-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 2rem;
          margin-bottom: 3rem;
        }

        .app-card {
          padding: 2rem;
          text-align: center;
          transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: default;
          background: var(--md-sys-color-surface-container-low) !important;
          color: var(--md-sys-color-on-surface) !important;
        }

        .app-card:hover {
          transform: translateY(-2px);
          background: var(--md-sys-color-surface-container) !important;
        }

        .app-card h3 {
          color: var(--md-sys-color-on-surface) !important;
          margin: 1rem 0 0.5rem 0;
          font-size: 1.5rem;
          font-weight: 500;
        }

        .app-card p {
          color: var(--md-sys-color-on-surface-variant) !important;
          margin: 0 0 1.5rem 0;
          line-height: 1.5;
        }

        .app-features li {
          color: var(--md-sys-color-on-surface-variant) !important;
          text-align: left;
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
          width: 100%;
          margin-top: 1rem;
        }

        .info-section {
          background: var(--md-surface-container, #f3edf7);
          padding: 2rem;
          border-radius: var(--md-border-radius-l, 16px);
          text-align: center;
          border: 1px solid var(--md-outline-variant, #c4c7c5);
        }

        .info-section h3 {
          margin-top: 0;
          color: var(--md-on-surface, #1c1b1f);
          font-size: var(--md-font-size-title-medium, 1rem);
          font-weight: var(--md-font-weight-medium, 500);
        }

        .info-section ol {
          text-align: left;
          max-width: 600px;
          margin: 0 auto 2rem auto;
          color: var(--md-on-surface-variant, #49454f);
          font-size: var(--md-font-size-body-medium, 0.875rem);
          line-height: 1.5;
        }

        .info-section li {
          margin: 0.5rem 0;
        }

        .tech-stack h4 {
          margin: 0 0 1rem 0;
          color: var(--md-on-surface, #1c1b1f);
          font-size: var(--md-font-size-title-small, 0.875rem);
          font-weight: var(--md-font-weight-medium, 500);
        }

        .tech-tags {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 0.5rem;
        }

        .tech-tag {
          background: var(--md-secondary-container, #e8def8);
          color: var(--md-on-secondary-container, #1d192b);
          padding: 0.375rem 0.875rem;
          border-radius: var(--md-border-radius-full, 20px);
          font-size: var(--md-font-size-label-medium, 0.75rem);
          font-weight: var(--md-font-weight-medium, 500);
          border: 1px solid var(--md-outline-variant, #c4c7c5);
        }
      `}</style>
    </div>
  );
};

export default AppSelector; 