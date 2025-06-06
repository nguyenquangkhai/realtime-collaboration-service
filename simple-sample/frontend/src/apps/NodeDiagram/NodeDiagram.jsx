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
import AppHeader from '../../components/AppHeader';
import NodeDiagramControls from './components/NodeDiagramControls';
import NodeDiagramInfoPanel from './components/NodeDiagramInfoPanel';
import NodeContextMenu from './components/NodeContextMenu';
import './NodeDiagram.css';

const NodeDiagram = ({ roomName: initialRoomName = 'nodes-collaborative-room' }) => {
  const [nodes, setNodes] = useNodesState([]);
  const [edges, setEdges] = useEdgesState([]);
  const [roomName, setRoomName] = useState(initialRoomName);
  const [selectedNodes, setSelectedNodes] = useState([]);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, nodeId: null, nodeName: '' });

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
    removeNode,
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

  // Handle right-click on node
  const handleNodeContextMenu = useCallback((event, node) => {
    event.preventDefault();
    console.log('Context menu for node:', node.id);
    
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      nodeId: node.id,
      nodeName: node.data.label || `Node ${node.id}`
    });
  }, []);

  // Close context menu
  const handleCloseContextMenu = useCallback(() => {
    setContextMenu({ visible: false, x: 0, y: 0, nodeId: null, nodeName: '' });
  }, []);

  // Handle remove node from context menu
  const handleRemoveNodeFromMenu = useCallback(() => {
    if (contextMenu.nodeId) {
      removeNode(contextMenu.nodeId);
    }
  }, [contextMenu.nodeId, removeNode]);

  // Get styled nodes using utility function
  const styledNodes = getStyledNodes(nodes, userSelections, selectedNodes, userColor);

  return (
    <div className="node-diagram-app">
      <AppHeader
        icon="🔗"
        title="Collaborative Node Diagram"
        subtitle="Built with Yjs + React Flow - Real-time node collaboration!"
        roomName={roomName}
        onRoomChange={handleRoomChange}
        username={username}
        onUsernameChange={handleUsernameChange}
        isConnected={isConnected}
        connectedUsers={connectedUsers}
        showUsers={true}
        generateRandomUsernameOnMount={false}
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
          onNodeContextMenu={handleNodeContextMenu}
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

      <NodeContextMenu
        isVisible={contextMenu.visible}
        position={{ x: contextMenu.x, y: contextMenu.y }}
        onClose={handleCloseContextMenu}
        onRemove={handleRemoveNodeFromMenu}
        nodeName={contextMenu.nodeName}
      />
    </div>
  );
};

export default NodeDiagram; 