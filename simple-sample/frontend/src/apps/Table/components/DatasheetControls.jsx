import React, { useState } from 'react';

const DatasheetControls = ({ 
  onAddRowsWithSampleData, 
  onAddColumnsWithSampleData, 
  onEnsureGridSize, 
  gridRows, 
  gridCols 
}) => {
  const [loadingStates, setLoadingStates] = useState({
    rows: false,
    columns: false
  });

  const handleAddRowsWithSampleData = async () => {
    setLoadingStates(prev => ({ ...prev, rows: true }));
    setTimeout(() => {
      onAddRowsWithSampleData(3);
      setLoadingStates(prev => ({ ...prev, rows: false }));
    }, 100);
  };

  const handleAddColumnsWithSampleData = async () => {
    setLoadingStates(prev => ({ ...prev, columns: true }));
    setTimeout(() => {
      onAddColumnsWithSampleData(2);
      setLoadingStates(prev => ({ ...prev, columns: false }));
    }, 100);
  };

  return (
    <div className="datasheet-controls">
      <button 
        onClick={handleAddRowsWithSampleData}
        disabled={loadingStates.rows}
        className="control-button sample-button"
      >
        {loadingStates.rows ? '⏳ Generating...' : '🎲 Add 3 Rows (Sample Data)'}
      </button>
      
      <button 
        onClick={handleAddColumnsWithSampleData}
        disabled={loadingStates.columns}
        className="control-button sample-button"
      >
        {loadingStates.columns ? '⏳ Generating...' : '🎲 Add 2 Columns (Sample Data)'}
      </button>
      
      <button 
        onClick={() => onEnsureGridSize(gridRows + 5, gridCols)}
        className="control-button empty-button"
      >
        ➕ Add 5 Empty Rows
      </button>
      
      <button 
        onClick={() => onEnsureGridSize(gridRows, gridCols + 3)}
        className="control-button empty-button"
      >
        ➕ Add 3 Empty Columns
      </button>
      
      <span className="grid-info">
        Grid size: {gridRows} × {gridCols}
      </span>
    </div>
  );
};

export default DatasheetControls; 