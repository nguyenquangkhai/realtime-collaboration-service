import React from 'react';
import MaterialTooltip from '../../../components/shared/MaterialTooltip';

const NodeDiagramInfoPanel = ({ nodes, edges }) => {
  const instructionsContent = (
    <div>
      <strong>Instructions:</strong>
      <ul>
        <li>Click "Add Node" to create nodes</li>
        <li>Drag nodes to move them (others see your user color border while dragging)</li>
        <li>Click nodes to select them (others see your user color border when selected)</li>
        <li>Hold Shift to select multiple nodes</li>
        <li>Drag between nodes to connect them</li>
        <li>Press Delete to remove selected items</li>
      </ul>
      <strong>Visual Feedback:</strong>
      <div style={{ fontSize: '10px', marginTop: '4px', opacity: 0.9 }}>
        Node borders show user colors when interacting - thicker borders for dragging, thinner for selection
      </div>
    </div>
  );

  return (
    <div className="info-panel-compact">
      <div className="info-stats-compact">
        <div className="stat-item">
          <span className="stat-label">Nodes:</span>
          <span className="stat-value">{nodes.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Edges:</span>
          <span className="stat-value">{edges.length}</span>
        </div>
        <div className="stat-item">
          {nodes.length > 0 && (
            <>
              <span className="stat-label">Latest:</span>
              <span className="stat-value">{nodes[nodes.length - 1]?.data?.label || 'N/A'}</span>
            </>
          )}
        </div>
        <MaterialTooltip 
          content={instructionsContent}
          position="top"
          trigger="click"
          maxWidth="320px"
        >
          <button className="help-button" aria-label="Show instructions">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z"/>
            </svg>
          </button>
        </MaterialTooltip>
      </div>
    </div>
  );
};

export default NodeDiagramInfoPanel; 