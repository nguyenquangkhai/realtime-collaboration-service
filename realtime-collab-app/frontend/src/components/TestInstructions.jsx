import React, { useState } from 'react';

const TestInstructions = ({ orgId }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const testUrls = [
    `${window.location.origin}${window.location.pathname}?orgId=org1`,
    `${window.location.origin}${window.location.pathname}?orgId=org2`,
    `${window.location.origin}${window.location.pathname}?orgId=org3`,
  ];

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('URL copied to clipboard!');
    });
  };

  if (!isExpanded) {
    return (
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        backgroundColor: '#1e40af',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '8px',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        zIndex: 1000
      }} onClick={() => setIsExpanded(true)}>
        🧪 Test Multi-User
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      backgroundColor: 'white',
      border: '2px solid #1e40af',
      borderRadius: '8px',
      padding: '16px',
      maxWidth: '400px',
      boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
      zIndex: 1000
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, color: '#1e40af' }}>🧪 Multi-User Testing</h3>
        <button 
          onClick={() => setIsExpanded(false)}
          style={{ 
            backgroundColor: 'transparent', 
            border: 'none', 
            fontSize: '18px', 
            cursor: 'pointer',
            color: '#6b7280',
            padding: '4px'
          }}
        >
          ✕
        </button>
      </div>
      
      <div style={{ fontSize: '14px', lineHeight: '1.4', color: '#374151' }}>
        <p style={{ margin: '0 0 8px 0', color: '#374151' }}>
          <strong style={{ color: '#1f2937' }}>Current tenant:</strong> <code style={{ backgroundColor: '#f1f5f9', padding: '2px 4px', borderRadius: '3px', color: '#1f2937' }}>{orgId}</code>
        </p>
        
        <p style={{ margin: '8px 0', color: '#374151' }}>
          <strong style={{ color: '#1f2937' }}>To test collaboration:</strong>
        </p>
        
        <ol style={{ margin: '8px 0', paddingLeft: '20px', color: '#374151' }}>
          <li>Open new browser tabs/windows</li>
          <li>Use these test URLs (click to copy):</li>
        </ol>
        
        <div style={{ marginTop: '8px' }}>
          {testUrls.map((url, index) => (
            <div key={index} style={{ marginBottom: '4px' }}>
              <button
                onClick={() => copyToClipboard(url)}
                style={{
                  fontSize: '11px',
                  padding: '4px 8px',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                  fontFamily: 'monospace',
                  color: '#1f2937'
                }}
              >
                📋 Tenant: org{index + 1}
              </button>
            </div>
          ))}
        </div>
        
        <div style={{ 
          marginTop: '12px', 
          padding: '8px', 
          backgroundColor: '#fef3c7', 
          borderRadius: '4px',
          fontSize: '12px',
          color: '#92400e'
        }}>
          <strong style={{ color: '#78350f' }}>💡 What to expect:</strong>
          <ul style={{ margin: '4px 0', paddingLeft: '16px', color: '#92400e' }}>
            <li>Same tenant = shared canvas</li>
            <li>Different tenants = isolated</li>
            <li>User count & colors update live</li>
            <li>Node changes sync in real-time</li>
            <li>Dragging nodes shows user colors</li>
            <li>Live indicators: 🖱️ dragging, ✋ selected</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TestInstructions; 