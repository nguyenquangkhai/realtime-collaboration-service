import React, { useState, useCallback } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useYjsCollaboration } from './hooks/useYjsCollaboration';
import { useNodeOperations } from './hooks/useNodeOperations';
import { getStyledNodes } from './utils/nodeStyleUtils';
import NodeDiagramHeader from './components/NodeDiagramHeader';
import NodeDiagramControls from './components/NodeDiagramControls';
import NodeDiagramInfoPanel from './components/NodeDiagramInfoPanel';
import './NodeDiagram.css';

const NodeDiagram = ({ roomName: initialRoomName = 'nodes-collaborative-room' }) => {
  const [nodes, setNodes] = useNodesState([]);
  const [edges, setEdges] = useEdgesState([]);
  const [roomName, setRoomName] = useState(initialRoomName);
  const [selectedNodes, setSelectedNodes] = useState([]);

  // Use Yjs collaboration hook
  const {
    isConnected,
    username,
    connectedUsers,
    userSelections,
    userColor,
    ynodesRef,
    yedgesRef,
    updateUsername,
    setAwarenessField
  } = useYjsCollaboration(roomName);

  // Use node operations hook
  const {
    handleNodesChange,
    handleEdgesChange,
    onConnect,
    addNode,
    clearNodes,
    handleNodeDragStop
  } = useNodeOperations(
    nodes, 
    setNodes, 
    edges, 
    setEdges, 
    ynodesRef, 
    yedgesRef, 
    isConnected, 
    username
  );

  const handleRoomChange = (e) => {
    setRoomName(e.target.value);
  };

  const handleUsernameChange = (e) => {
    const newUsername = e.target.value;
    updateUsername(newUsername);
  };





  // Handle node position changes (drag)
  const handleNodeDragStart = useCallback((event, node) => {
    console.log('Node drag started:', node.id);
    setAwarenessField('draggedNode', node.id);
  }, [setAwarenessField]);

  const handleNodeDrag = useCallback((event, node) => {
    // Continue broadcasting that we're dragging this node
    setAwarenessField('draggedNode', node.id);
  }, [setAwarenessField]);

  // Clear drag state when dragging stops
  const handleNodeDragStopWithCleanup = useCallback((event, node) => {
    console.log('Node drag stopped:', node.id);
    
    // Clear the drag awareness state
    setAwarenessField('draggedNode', null);
    
    // Call the original drag stop handler
    handleNodeDragStop(event, node);
  }, [setAwarenessField, handleNodeDragStop]);

  // Handle selection changes
  const handleSelectionChange = useCallback((params) => {
    const selectedNodeIds = params.nodes;
    console.log('Selection changed:', selectedNodeIds);
    
    setSelectedNodes(selectedNodeIds);
    
    // Broadcast selection to other users via awareness
    setAwarenessField('selectedNodes', selectedNodeIds);
  }, [setAwarenessField]);

  // Get styled nodes using utility function
  const styledNodes = getStyledNodes(nodes, userSelections, selectedNodes, userColor);

  return (
    <div className="node-diagram-app">
      <NodeDiagramHeader
        roomName={roomName}
        onRoomChange={handleRoomChange}
        username={username}
        onUsernameChange={handleUsernameChange}
        isConnected={isConnected}
        connectedUsers={connectedUsers}
      />

      <NodeDiagramControls
        onAddNode={addNode}
        onClearNodes={clearNodes}
      />

      <div className="flow-container">
        <ReactFlow
          nodes={styledNodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onNodeDragStart={handleNodeDragStart}
          onNodeDrag={handleNodeDrag}
          onNodeDragStop={handleNodeDragStopWithCleanup}
          onSelectionChange={handleSelectionChange}
          fitView
          multiSelectionKeyCode="Shift"
          deleteKeyCode="Delete"
        >
          <Controls />
          <MiniMap />
          <Background variant="dots" gap={12} size={1} />
        </ReactFlow>
      </div>

      <NodeDiagramInfoPanel nodes={nodes} edges={edges} />
    </div>
  );
};

export default NodeDiagram; 