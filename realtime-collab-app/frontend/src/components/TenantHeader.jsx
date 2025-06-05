import React, { useState, useEffect } from 'react';

const TenantHeader = ({ 
  orgId, 
  isConnected, 
  connectedUsers, 
  currentUser, 
  onAddNode,
  onClearNodes 
}) => {
  // Get total user count (including current user if not already in the list)
  const totalUsers = connectedUsers.length;
  const [previousUserCount, setPreviousUserCount] = useState(0);
  const [userChangeMessage, setUserChangeMessage] = useState('');

  // Track user join/leave notifications
  useEffect(() => {
    if (previousUserCount > 0) { // Only show notifications after initial load
      if (totalUsers > previousUserCount) {
        setUserChangeMessage('👋 User joined!');
        setTimeout(() => setUserChangeMessage(''), 3000);
      } else if (totalUsers < previousUserCount) {
        setUserChangeMessage('👋 User left');
        setTimeout(() => setUserChangeMessage(''), 3000);
      }
    }
    setPreviousUserCount(totalUsers);
  }, [totalUsers, previousUserCount]);
  
  return (
    <div style={{ padding: '10px', backgroundColor: '#f0f0f0', borderBottom: '1px solid #ccc' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '5px' }}>
        <span style={{ fontWeight: 'bold', color: '#2563eb' }}>
          🏢 Tenant: {orgId}
        </span>
        <button onClick={onAddNode} style={{ 
          padding: '4px 8px',
          backgroundColor: '#2563eb',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}>
          Add Node
        </button>
        {onClearNodes && (
          <button onClick={() => {
            if (window.confirm('Clear all nodes?')) {
              onClearNodes();
            }
          }} style={{ 
            padding: '4px 8px',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}>
            Clear All
          </button>
        )}
        <span style={{ color: isConnected ? 'green' : 'red' }}>
          {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </span>
        <span style={{ color: 'blue', fontWeight: 'bold' }}>
          👥 Users: {totalUsers}
        </span>
        {userChangeMessage && (
          <span style={{ 
            color: '#059669', 
            fontSize: '12px',
            fontStyle: 'italic'
          }}>
            {userChangeMessage}
          </span>
        )}
      </div>
      
      {/* User avatars with names */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
        {connectedUsers.map(user => (
          user && user.id && (
            <div 
              key={user.id} 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 6px',
                backgroundColor: '#fff',
                borderRadius: '12px',
                border: currentUser && user.id === currentUser.id ? '2px solid #000' : '1px solid #ddd',
                fontSize: '12px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
              }}
              title={`${user.name} (ID: ${user.id})`}
            >
              <div style={{
                width: '16px', 
                height: '16px', 
            backgroundColor: user.color, 
            borderRadius: '50%',
                border: '1px solid #fff',
                position: 'relative'
              }}>
                {/* Online indicator */}
                <div style={{
                  position: 'absolute',
                  bottom: '-1px',
                  right: '-1px',
                  width: '6px',
                  height: '6px',
                  backgroundColor: '#10b981',
                  borderRadius: '50%',
                  border: '1px solid #fff'
          }}></div>
              </div>
              <span style={{ color: '#333', fontWeight: currentUser && user.id === currentUser.id ? 'bold' : 'normal' }}>
                {user.name}
                {currentUser && user.id === currentUser.id && ' (You)'}
                {user.isDragging && ' 🖱️'}
                {user.selectedNode && !user.isDragging && ' ✋'}
              </span>
            </div>
          )
        ))}
      </div>
      
      {/* Current user info */}
      {currentUser && (
        <div style={{ 
          marginTop: '8px', 
          padding: '4px 8px', 
          backgroundColor: '#e8f4fd', 
          borderRadius: '4px',
          fontSize: '12px',
          color: '#1e40af'
        }}>
          <strong>You:</strong> {currentUser.name} • 
          <span style={{color: currentUser.color, fontWeight:'bold'}}> ●</span> {currentUser.color}
          {currentUser.selectedNode && (
            <span> • {currentUser.isDragging ? 'Dragging' : 'Selected'}: {currentUser.selectedNode}</span>
          )}
        </div>
      )}

      {/* Instructions for testing */}
      {totalUsers === 1 && (
        <div style={{
          marginTop: '8px',
          padding: '4px 8px',
          backgroundColor: '#fef3c7',
          borderRadius: '4px',
          fontSize: '11px',
          color: '#92400e'
        }}>
          💡 <strong>Test multi-user:</strong> Open another browser tab with <code>?orgId={orgId}</code> to see real-time collaboration!
        </div>
      )}
    </div>
  );
};

export default TenantHeader; 