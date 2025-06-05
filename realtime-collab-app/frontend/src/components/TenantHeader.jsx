import React from 'react';

const TenantHeader = ({ 
  orgId, 
  isConnected, 
  connectedUsers, 
  currentUser, 
  onAddNode 
}) => {
  return (
    <div style={{ padding: '10px', background: '#f0f0f0', borderBottom: '1px solid #ccc' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '5px' }}>
        <span style={{ fontWeight: 'bold', color: '#2563eb' }}>
          🏢 Tenant: {orgId}
        </span>
        <button onClick={onAddNode} style={{ marginRight: '10px' }}>
          Add Node
        </button>
        <span style={{ color: isConnected ? 'green' : 'red' }}>
          {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </span>
        <span style={{ color: 'blue' }}>
          👥 Users: {connectedUsers.length}
        </span>
      </div>
      
      {/* User avatars */}
      <div style={{ display: 'flex', marginTop: '5px', color: 'blue' }}>
        {connectedUsers.map(user => (
          user && user.id &&
          <div key={user.id} title={`${user.name} (ID: ${user.id})`} style={{
            width: '20px', 
            height: '20px', 
            backgroundColor: user.color, 
            borderRadius: '50%',
            marginRight: '5px', 
            border: currentUser && user.id === currentUser.id ? '2px solid black' : '2px solid transparent'
          }}></div>
        ))}
      </div>
      
      {/* Current user info */}
      {currentUser && (
        <p style={{ color: 'blue', margin: '5px 0 0 0' }}>
          You: {currentUser.name} (Color: <span style={{color: currentUser.color, fontWeight:'bold'}}>{currentUser.color}</span>)
        </p>
      )}
    </div>
  );
};

export default TenantHeader; 