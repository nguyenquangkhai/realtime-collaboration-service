import React, { forwardRef, useState } from 'react';
import ReactDataSheet from 'react-datasheet';
import 'react-datasheet/lib/react-datasheet.css';
import { useTableCollaboration } from './hooks/useTableCollaboration';
import { useGridOperations } from './hooks/useGridOperations';
import DatasheetControls from './components/DatasheetControls';
import './DatasheetEditor.css';

const DatasheetEditor = forwardRef(({ 
  onConnectionChange, 
  onDataChange,
  roomName = 'default-room', 
  appType = 'table' 
}, ref) => {
  const [grid, setGrid] = useState([
    [{ value: '', readOnly: false }, { value: '', readOnly: false }, { value: '', readOnly: false }],
    [{ value: '', readOnly: false }, { value: '', readOnly: false }, { value: '', readOnly: false }],
    [{ value: '', readOnly: false }, { value: '', readOnly: false }, { value: '', readOnly: false }]
  ]);
  
  // Use table collaboration hook
  const { ydocRef, yarrayRef, isUpdatingFromYjs } = useTableCollaboration(
    roomName, 
    appType, 
    onConnectionChange, 
    onDataChange, 
    setGrid
  );

  // Use grid operations hook  
  const {
    handleCellsChanged,
    addRowsWithSampleData,
    addColumnsWithSampleData,
    ensureGridSize,
    handleContextMenu
  } = useGridOperations(grid, setGrid, ydocRef, yarrayRef, isUpdatingFromYjs);






  return (
    <div className="datasheet-editor">
      <DatasheetControls
        onAddRowsWithSampleData={addRowsWithSampleData}
        onAddColumnsWithSampleData={addColumnsWithSampleData}
        onEnsureGridSize={ensureGridSize}
        gridRows={grid.length}
        gridCols={grid[0]?.length || 0}
      />
      
      <ReactDataSheet
        data={grid}
        valueRenderer={(cell) => cell.value}
        onCellsChanged={handleCellsChanged}
        onContextMenu={handleContextMenu}
      />
    </div>
  );
});

DatasheetEditor.displayName = 'DatasheetEditor';

export default DatasheetEditor; 