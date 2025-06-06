import React, { forwardRef, useEffect, useRef, useState, useCallback } from 'react';
import ReactDataSheet from 'react-datasheet';
import 'react-datasheet/lib/react-datasheet.css';
import DoUsername from 'do_username';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { faker } from '@faker-js/faker';

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
  
  const ydocRef = useRef(null);
  const providerRef = useRef(null);
  const yarrayRef = useRef(null);
  const isUpdatingFromYjs = useRef(false);
  const userColorRef = useRef(null);
  const observerRef = useRef(null);
  const onConnectionChangeRef = useRef(onConnectionChange);
  const onDataChangeRef = useRef(onDataChange);

  // Update refs when props change
  useEffect(() => {
    onConnectionChangeRef.current = onConnectionChange;
    onDataChangeRef.current = onDataChange;
  }, [onConnectionChange, onDataChange]);

  // Helper function to generate sample data based on column type
  const generateSampleData = useCallback((columnIndex, columnHeaders) => {
    if (!columnHeaders || columnHeaders.length === 0) {
      return faker.lorem.word();
    }

    const header = columnHeaders[columnIndex]?.value?.toLowerCase() || '';
    
    // Generate data based on column header
    if (header.includes('name') || header.includes('person') || header.includes('user')) {
      return faker.person.fullName();
    } else if (header.includes('email') || header.includes('mail')) {
      return faker.internet.email();
    } else if (header.includes('age')) {
      return faker.number.int({ min: 18, max: 80 }).toString();
    } else if (header.includes('city')) {
      return faker.location.city();
    } else if (header.includes('country')) {
      return faker.location.country();
    } else if (header.includes('address')) {
      return faker.location.streetAddress();
    } else if (header.includes('phone')) {
      return faker.phone.number();
    } else if (header.includes('company') || header.includes('organization')) {
      return faker.company.name();
    } else if (header.includes('score') || header.includes('rating') || header.includes('points')) {
      return faker.number.int({ min: 0, max: 100 }).toString();
    } else if (header.includes('price') || header.includes('cost') || header.includes('amount')) {
      return faker.commerce.price();
    } else if (header.includes('date') || header.includes('time')) {
      return faker.date.recent().toLocaleDateString();
    } else if (header.includes('department') || header.includes('team')) {
      return faker.commerce.department();
    } else if (header.includes('product')) {
      return faker.commerce.product();
    } else if (header.includes('description') || header.includes('comment')) {
      return faker.lorem.sentence();
    } else if (header.includes('status')) {
      return faker.helpers.arrayElement(['Active', 'Inactive', 'Pending', 'Complete']);
    } else if (header.includes('gender')) {
      return faker.person.sex();
    } else if (header.includes('job') || header.includes('title') || header.includes('position')) {
      return faker.person.jobTitle();
    } else if (header.includes('color')) {
      return faker.color.human();
    } else {
      // Default to various data types for unknown columns
      const dataTypes = [
        () => faker.person.firstName(),
        () => faker.location.city(),
        () => faker.number.int({ min: 1, max: 999 }).toString(),
        () => faker.commerce.product(),
        () => faker.lorem.word()
      ];
      return faker.helpers.arrayElement(dataTypes)();
    }
  }, []);

  // Helper function to generate new column header
  const generateColumnHeader = useCallback(() => {
    const headerTypes = [
      'Name', 'Email', 'Age', 'City', 'Country', 'Company', 
      'Score', 'Department', 'Phone', 'Status', 'Product', 'Price'
    ];
    return faker.helpers.arrayElement(headerTypes);
  }, []);

  // Initialize Yjs document and WebSocket connection
  useEffect(() => {
    // Create Yjs document
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // Create shared array for table data
    const yarray = ydoc.getArray('table');
    yarrayRef.current = yarray;

    // Create WebSocket provider
    const wsUrl = `ws://localhost:3001/${roomName}?appType=${appType}`;
    console.log('Connecting to WebSocket:', wsUrl);
    const provider = new WebsocketProvider(wsUrl, roomName, ydoc);
    const awareness = provider.awareness;
    providerRef.current = provider;

    // Handle connection status changes
    provider.on('status', (event) => {
      onConnectionChangeRef.current?.(event.status === 'connected');
    });

    // Handle connection events
    provider.on('connection-close', () => {
      onConnectionChangeRef.current?.(false);
    });

    provider.on('connection-error', () => {
      onConnectionChangeRef.current?.(false);
    });

    // Set up user color and awareness
    const usercolors = [
      '#30bced', '#6eeb83', '#ffbc42', '#ecd444', 
      '#ee6352', '#9ac2c9', '#8acb88', '#1be7ff'
    ];
    const myColor = usercolors[Math.floor(Math.random() * usercolors.length)];
    userColorRef.current = myColor;

    // Generate a random username
    const randomUsername = DoUsername.generate(15);
    
    // Set user awareness state
    awareness.setLocalStateField('user', { 
      name: randomUsername, 
      color: myColor 
    });

    // Find username input and set its value
    const inputElement = document.querySelector('#table-username');
    if (inputElement) {
      inputElement.value = randomUsername;
      
      // Update awareness when username changes
      const setUsername = () => {
        awareness.setLocalStateField('user', { 
          name: inputElement.value, 
          color: myColor 
        });
      };
      
      inputElement.addEventListener('input', setUsername);
    }

    // Initialize grid if empty
    if (yarray.length === 0) {
      // Create initial 10x5 grid with sample data
      const initialGrid = [
        [
          { value: 'Name', readOnly: false },
          { value: 'Age', readOnly: false },
          { value: 'City', readOnly: false },
          { value: 'Country', readOnly: false },
          { value: 'Score', readOnly: false }
        ],
        [
          { value: 'Alice Johnson', readOnly: false },
          { value: '28', readOnly: false },
          { value: 'New York', readOnly: false },
          { value: 'USA', readOnly: false },
          { value: '95', readOnly: false }
        ],
        [
          { value: 'Bob Smith', readOnly: false },
          { value: '34', readOnly: false },
          { value: 'London', readOnly: false },
          { value: 'UK', readOnly: false },
          { value: '87', readOnly: false }
        ],
        [
          { value: 'Carol Davis', readOnly: false },
          { value: '29', readOnly: false },
          { value: 'Paris', readOnly: false },
          { value: 'France', readOnly: false },
          { value: '92', readOnly: false }
        ]
      ];
      
      // Add empty rows to make it 10 total
      for (let i = initialGrid.length; i < 10; i++) {
        const row = [];
        for (let j = 0; j < 5; j++) {
          row.push({ value: '', readOnly: false });
        }
        initialGrid.push(row);
      }
      
      isUpdatingFromYjs.current = true;
      yarray.delete(0, yarray.length); // Clear any existing data
      yarray.insert(0, initialGrid.map(row => new Y.Array(row.map(cell => new Y.Map(Object.entries(cell))))));
      isUpdatingFromYjs.current = false;
    }

    // Observe changes to Yjs array
    const observer = (event) => {
      if (isUpdatingFromYjs.current) return;
      
      const newGrid = [];
      yarray.forEach(yrow => {
        const row = [];
        yrow.forEach(ycell => {
          const cell = {};
          ycell.forEach((value, key) => {
            cell[key] = value;
          });
          row.push(cell);
        });
        newGrid.push(row);
      });
      
      setGrid(newGrid);
      onDataChangeRef.current?.(newGrid);
    };
    
    observerRef.current = observer;
    yarray.observe(observer);

    // Initial sync
    if (yarray.length > 0) {
      observer();
    }

    // Update user list
    const updateUserList = () => {
      const users = [];
      awareness.getStates().forEach((state, clientId) => {
        if (clientId !== awareness.clientID && state.user) {
          users.push(state.user.name);
        }
      });
      
      const userListElement = document.querySelector('#table-users');
      if (userListElement) {
        userListElement.innerHTML = users.length > 0 
          ? `👥 ${users.length + 1} user(s): ${[randomUsername, ...users].join(', ')}`
          : `👤 Just you: ${randomUsername}`;
      }
    };

    awareness.on('change', updateUserList);
    updateUserList();

    // Cleanup function
    return () => {
      if (observerRef.current && yarrayRef.current) {
        yarrayRef.current.unobserve(observerRef.current);
      }
      if (providerRef.current) {
        providerRef.current.destroy();
      }
      if (ydocRef.current) {
        ydocRef.current.destroy();
      }
    };
  }, [roomName, appType]);

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
    onDataChangeRef.current?.(newGrid);
  }, [grid]);

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
  }, [grid, generateSampleData]);

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
  }, [generateSampleData, generateColumnHeader]);

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
  }, [grid]);

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
  }, [grid, handleCellsChanged, generateSampleData, generateColumnHeader]);

  return (
    <div className="datasheet-editor">
      <div className="datasheet-controls">
        <button 
          onClick={() => {
            const btn = event.target;
            btn.disabled = true;
            btn.textContent = '⏳ Generating...';
            setTimeout(() => {
              addRowsWithSampleData(3);
              btn.disabled = false;
              btn.textContent = '🎲 Add 3 Rows (Sample Data)';
            }, 100);
          }}
          className="control-button sample-button"
        >
          🎲 Add 3 Rows (Sample Data)
        </button>
        <button 
          onClick={() => {
            const btn = event.target;
            btn.disabled = true;
            btn.textContent = '⏳ Generating...';
            setTimeout(() => {
              addColumnsWithSampleData(2);
              btn.disabled = false;
              btn.textContent = '🎲 Add 2 Columns (Sample Data)';
            }, 100);
          }}
          className="control-button sample-button"
        >
          🎲 Add 2 Columns (Sample Data)
        </button>
        <button 
          onClick={() => ensureGridSize(grid.length + 5, grid[0]?.length || 5)}
          className="control-button empty-button"
        >
          ➕ Add 5 Empty Rows
        </button>
        <button 
          onClick={() => ensureGridSize(grid.length, (grid[0]?.length || 0) + 3)}
          className="control-button empty-button"
        >
          ➕ Add 3 Empty Columns
        </button>
        <span className="grid-info">
          Grid size: {grid.length} × {grid[0]?.length || 0}
        </span>
      </div>
      
      <ReactDataSheet
        data={grid}
        valueRenderer={(cell) => cell.value}
        onCellsChanged={handleCellsChanged}
        onContextMenu={handleContextMenu}
      />
      
      <style jsx>{`
        .datasheet-editor {
          width: 100%;
        }
        
        .datasheet-controls {
          display: flex;
          gap: 1rem;
          align-items: center;
          margin-bottom: 1rem;
          padding: 1rem;
          background: #f8f9fa;
          border-radius: 6px;
        }
        
        .control-button {
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9rem;
          transition: all 0.2s ease;
          margin-right: 0.5rem;
        }
        
        .sample-button {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        
        .sample-button:hover {
          background: linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%);
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3);
        }
        
        .empty-button {
          background: #6c757d;
          color: white;
        }
        
        .empty-button:hover {
          background: #5a6268;
        }
        
        .control-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }
        
        .control-button:disabled:hover {
          transform: none;
          box-shadow: none;
        }
        
        .grid-info {
          color: #666;
          font-size: 0.9rem;
          margin-left: auto;
        }
        
        :global(.react-datasheet .cell.selected) {
          background: rgba(102, 126, 234, 0.2);
          border: 2px solid #667eea;
        }
        
        :global(.react-datasheet .cell) {
          border: 1px solid #ddd;
          padding: 4px 8px;
          min-width: 80px;
          min-height: 30px;
        }
        
        :global(.react-datasheet .cell.editing) {
          background: white;
          border: 2px solid #667eea;
        }
        
        :global(.react-datasheet .cell input) {
          border: none;
          outline: none;
          background: transparent;
          width: 100%;
          height: 100%;
          padding: 0;
          font-family: inherit;
          font-size: inherit;
        }
        
        :global(.react-datasheet table) {
          border-collapse: collapse;
          width: 100%;
          max-width: 100%;
          table-layout: auto;
        }
        
        :global(.react-datasheet th) {
          background: #f8f9fa;
          font-weight: 600;
          border: 1px solid #ddd;
          padding: 8px;
          text-align: center;
          color: #333;
        }
        
        :global(.react-datasheet .cell:hover) {
          background: rgba(102, 126, 234, 0.1);
        }
      `}</style>
    </div>
  );
});

DatasheetEditor.displayName = 'DatasheetEditor';

export default DatasheetEditor; 