import { useCallback } from 'react';
import { generateSampleData, generateColumnHeader } from '../utils/sampleDataGenerator';
import * as Y from 'yjs';

/**
 * Custom hook for grid operations in DatasheetEditor
 */
export const useGridOperations = (grid, setGrid, ydocRef, yarrayRef, isUpdatingFromYjs) => {

  // Handle cell changes from react-datasheet
  const handleCellsChanged = useCallback((changes) => {
    if (!yarrayRef.current || !ydocRef.current || isUpdatingFromYjs.current) return;

    // Use transaction for batch changes
    ydocRef.current.transact(() => {
      isUpdatingFromYjs.current = true;

      changes.forEach(({ row, col, value }) => {
        // Ensure the grid is large enough
        while (yarrayRef.current.length <= row) {
          const newRow = new Y.Array();
          for (let j = 0; j < Math.max(5, (yarrayRef.current.get(0)?.length || 0)); j++) {
            newRow.push(new Y.Map([['value', ''], ['readOnly', false]]));
          }
          yarrayRef.current.push([newRow]);
        }

        const yrow = yarrayRef.current.get(row);
        while (yrow.length <= col) {
          yrow.push([new Y.Map([['value', ''], ['readOnly', false]])]);
        }

        const ycell = yrow.get(col);
        ycell.set('value', value);
      });

      isUpdatingFromYjs.current = false;
    });

    // Update local grid immediately for better UX
    const newGrid = [...grid];
    changes.forEach(({ row, col, value }) => {
      if (!newGrid[row]) {
        // Extend grid if needed
        while (newGrid.length <= row) {
          const newRow = [];
          for (let j = 0; j < Math.max(5, (newGrid[0]?.length || 0)); j++) {
            newRow.push({ value: '', readOnly: false });
          }
          newGrid.push(newRow);
        }
      }
      
      if (!newGrid[row][col]) {
        // Extend row if needed
        while (newGrid[row].length <= col) {
          newGrid[row].push({ value: '', readOnly: false });
        }
      }
      
      newGrid[row][col] = { ...newGrid[row][col], value };
    });
    
    setGrid(newGrid);
  }, [grid, ydocRef, yarrayRef, isUpdatingFromYjs, setGrid]);

  // Add more rows/columns with sample data
  const addRowsWithSampleData = useCallback((numRows) => {
    if (!yarrayRef.current || !ydocRef.current) return;
    
    const columnHeaders = grid[0] || [];
    
    // Use Yjs transaction to batch all operations
    ydocRef.current.transact(() => {
      isUpdatingFromYjs.current = true;
      
      for (let i = 0; i < numRows; i++) {
        const newRow = [];
        for (let col = 0; col < grid[0]?.length || 5; col++) {
          const sampleValue = generateSampleData(col, columnHeaders);
          newRow.push({ value: sampleValue, readOnly: false });
        }
        
        const yNewRow = new Y.Array();
        newRow.forEach(cell => {
          yNewRow.push([new Y.Map(Object.entries(cell))]);
        });
        yarrayRef.current.push([yNewRow]);
      }
      
      isUpdatingFromYjs.current = false;
    });
  }, [grid, ydocRef, yarrayRef, isUpdatingFromYjs]);

  // Add more columns with sample data
  const addColumnsWithSampleData = useCallback((numCols) => {
    if (!yarrayRef.current || !ydocRef.current) return;
    
    // Use Yjs transaction to batch all operations
    ydocRef.current.transact(() => {
      isUpdatingFromYjs.current = true;
      
      for (let colOffset = 0; colOffset < numCols; colOffset++) {
        const newColumnHeader = generateColumnHeader();
        
        yarrayRef.current.forEach((yrow, rowIndex) => {
          let cellValue = '';
          if (rowIndex === 0) {
            // Header row
            cellValue = newColumnHeader;
          } else {
            // Data rows - generate sample data based on the new header
            const fakeColumnHeaders = [{ value: newColumnHeader }];
            cellValue = generateSampleData(0, fakeColumnHeaders);
          }
          yrow.push([new Y.Map([['value', cellValue], ['readOnly', false]])]);
        });
      }
      
      isUpdatingFromYjs.current = false;
    });
  }, [ydocRef, yarrayRef, isUpdatingFromYjs]);

  // Add more rows/columns when needed (empty)
  const ensureGridSize = useCallback((minRows, minCols) => {
    const currentRows = grid.length;
    const currentCols = grid[0]?.length || 0;
    
    if (minRows <= currentRows && minCols <= currentCols) return;
    
    const newGrid = [...grid];
    
    // Add more columns to existing rows
    if (minCols > currentCols) {
      newGrid.forEach(row => {
        while (row.length < minCols) {
          row.push({ value: '', readOnly: false });
        }
      });
    }
    
    // Add more rows
    while (newGrid.length < minRows) {
      const newRow = [];
      for (let j = 0; j < Math.max(minCols, currentCols); j++) {
        newRow.push({ value: '', readOnly: false });
      }
      newGrid.push(newRow);
    }
    
    setGrid(newGrid);
  }, [grid, setGrid]);

  // Handle right-click context menu (for adding rows/columns)
  const handleContextMenu = useCallback((e, cell, i, j) => {
    e.preventDefault();
    
    const action = window.prompt(
      `Cell (${i},${j})\nWhat would you like to do?\n\n` +
      `1. Add row below (with sample data)\n` +
      `2. Add column to the right (with sample data)\n` +
      `3. Add empty row below\n` +
      `4. Add empty column to the right\n` +
      `5. Clear cell\n` +
      `6. Cancel\n\n` +
      `Enter number (1-6):`
    );
    
    if (action === '1') {
      // Add row below with sample data
      const columnHeaders = grid[0] || [];
      const newRow = [];
      for (let col = 0; col < grid[0]?.length || 5; col++) {
        const sampleValue = generateSampleData(col, columnHeaders);
        newRow.push({ value: sampleValue, readOnly: false });
      }
      
      if (yarrayRef.current && ydocRef.current) {
        ydocRef.current.transact(() => {
          isUpdatingFromYjs.current = true;
          const yNewRow = new Y.Array();
          newRow.forEach(cell => {
            yNewRow.push([new Y.Map(Object.entries(cell))]);
          });
          yarrayRef.current.insert(i + 1, [yNewRow]);
          isUpdatingFromYjs.current = false;
        });
      }
    } else if (action === '2') {
      // Add column to the right with sample data
      const newColumnHeader = generateColumnHeader();
      
      if (yarrayRef.current && ydocRef.current) {
        ydocRef.current.transact(() => {
          isUpdatingFromYjs.current = true;
          yarrayRef.current.forEach((yrow, rowIndex) => {
            let cellValue = '';
            if (rowIndex === 0) {
              // Header row
              cellValue = newColumnHeader;
            } else {
              // Data rows - generate sample data based on the new header
              const fakeColumnHeaders = [{ value: newColumnHeader }];
              cellValue = generateSampleData(0, fakeColumnHeaders);
            }
            yrow.insert(j + 1, [new Y.Map([['value', cellValue], ['readOnly', false]])]);
          });
          isUpdatingFromYjs.current = false;
        });
      }
    } else if (action === '3') {
      // Add empty row below
      const newRow = [];
      for (let col = 0; col < grid[0]?.length || 5; col++) {
        newRow.push({ value: '', readOnly: false });
      }
      
      if (yarrayRef.current) {
        isUpdatingFromYjs.current = true;
        const yNewRow = new Y.Array();
        newRow.forEach(cell => {
          yNewRow.push([new Y.Map(Object.entries(cell))]);
        });
        yarrayRef.current.insert(i + 1, [yNewRow]);
        isUpdatingFromYjs.current = false;
      }
    } else if (action === '4') {
      // Add empty column to the right
      if (yarrayRef.current) {
        isUpdatingFromYjs.current = true;
        yarrayRef.current.forEach(yrow => {
          yrow.insert(j + 1, [new Y.Map([['value', ''], ['readOnly', false]])]);
        });
        isUpdatingFromYjs.current = false;
      }
    } else if (action === '5') {
      // Clear cell
      handleCellsChanged([{ row: i, col: j, value: '' }]);
    }
  }, [grid, handleCellsChanged, ydocRef, yarrayRef, isUpdatingFromYjs]);

  return {
    handleCellsChanged,
    addRowsWithSampleData,
    addColumnsWithSampleData,
    ensureGridSize,
    handleContextMenu
  };
}; 