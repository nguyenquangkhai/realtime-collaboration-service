import React, { useEffect, useRef } from 'react';
import './NodeContextMenu.css';

const NodeContextMenu = ({ isVisible, position, onClose, onRemove, nodeName }) => {
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        console.log('Click outside context menu, closing...');
        onClose();
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        console.log('Escape pressed, closing context menu...');
        onClose();
      }
    };

    if (isVisible) {
      // Use a small delay to prevent immediate closing from the right-click event
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('click', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
      }, 100);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  const handleRemove = () => {
    onRemove();
    onClose();
  };

  return (
    <>
      {/* Invisible overlay to catch clicks outside */}
      <div 
        className="context-menu-overlay" 
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />
      
      <div 
        ref={menuRef}
        className="node-context-menu"
        style={{
          left: position.x,
          top: position.y,
        }}
        role="menu"
        aria-label="Node actions"
      >
      <div className="context-menu-header">
        <span className="context-menu-title">{nodeName}</span>
      </div>
      
      <div className="context-menu-divider"></div>
      
      <button 
        className="context-menu-item context-menu-item--danger"
        onClick={handleRemove}
        role="menuitem"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="context-menu-icon">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
        </svg>
        Remove Node
      </button>
    </div>
    </>
  );
};

export default NodeContextMenu; 