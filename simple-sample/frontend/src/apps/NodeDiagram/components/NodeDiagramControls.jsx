import React from 'react';

const NodeDiagramControls = ({ onAddNode, onClearNodes }) => {
  return (
    <div className="controls">
      <button onClick={onAddNode} className="add-node-btn">
        ➕ Add Node
      </button>
      <button onClick={onClearNodes} className="clear-btn">
        🗑️ Clear All
      </button>
    </div>
  );
};

export default NodeDiagramControls; 