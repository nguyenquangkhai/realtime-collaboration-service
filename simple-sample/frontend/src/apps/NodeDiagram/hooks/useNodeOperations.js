import { useCallback, useRef, useEffect } from 'react';
import { applyNodeChanges, applyEdgeChanges } from 'reactflow';

/**
 * Custom hook for handling node and edge operations in NodeDiagram
 */
export const useNodeOperations = (
  nodes, 
  setNodes, 
  edges, 
  setEdges, 
  ynodesRef, 
  yedgesRef, 
  isConnected, 
  username
) => {
  const isUpdatingFromYjs = useRef(false);

  // Setup Yjs observers for data synchronization
  useEffect(() => {
    if (!ynodesRef.current || !yedgesRef.current) return;

    // Listen to nodes changes from Yjs
    const updateNodesFromYjs = () => {
      if (isUpdatingFromYjs.current) {
        console.log('Skipping nodes update - currently updating from Yjs');
        return;
      }
      
      const yNodesArray = ynodesRef.current?.toArray() || [];
      console.log('Updating nodes from Yjs:', yNodesArray.length, 'nodes');
      setNodes(yNodesArray);
    };

    // Listen to edges changes from Yjs
    const updateEdgesFromYjs = () => {
      if (isUpdatingFromYjs.current) {
        console.log('Skipping edges update - currently updating from Yjs');
        return;
      }
      
      const yEdgesArray = yedgesRef.current?.toArray() || [];
      console.log('Updating edges from Yjs:', yEdgesArray.length, 'edges');
      setEdges(yEdgesArray);
    };

    const ynodes = ynodesRef.current;
    const yedges = yedgesRef.current;

    ynodes.observe(updateNodesFromYjs);
    yedges.observe(updateEdgesFromYjs);

    // Load initial state
    updateNodesFromYjs();
    updateEdgesFromYjs();

    // Cleanup
    return () => {
      ynodes.unobserve(updateNodesFromYjs);
      yedges.unobserve(updateEdgesFromYjs);
    };
  }, [ynodesRef, yedgesRef, setNodes, setEdges]);

  // Handle nodes changes and sync to Yjs
  const handleNodesChange = useCallback((changes) => {
    console.log('handleNodesChange called with changes:', changes);
    const newNodes = applyNodeChanges(changes, nodes);
    
    // Check if this is a delete operation
    const deletedNodes = changes.filter(change => change.type === 'remove');
    
    if (deletedNodes.length > 0 && ynodesRef.current) {
      console.log('Deleting nodes from Yjs:', deletedNodes);
      isUpdatingFromYjs.current = true;
      
      // Remove deleted nodes from Yjs array
      deletedNodes.forEach(change => {
        const nodeIndex = ynodesRef.current.toArray().findIndex(node => node.id === change.id);
        if (nodeIndex !== -1) {
          ynodesRef.current.delete(nodeIndex, 1);
        }
      });
      
      isUpdatingFromYjs.current = false;
    }
    
    setNodes(newNodes);
  }, [nodes, ynodesRef, setNodes]);

  // Handle edges changes and sync to Yjs
  const handleEdgesChange = useCallback((changes) => {
    console.log('handleEdgesChange called with changes:', changes);
    const newEdges = applyEdgeChanges(changes, edges);
    
    // Check if this is a delete operation
    const deletedEdges = changes.filter(change => change.type === 'remove');
    
    if (deletedEdges.length > 0 && yedgesRef.current) {
      console.log('Deleting edges from Yjs:', deletedEdges);
      isUpdatingFromYjs.current = true;
      
      // Remove deleted edges from Yjs array
      deletedEdges.forEach(change => {
        const edgeIndex = yedgesRef.current.toArray().findIndex(edge => edge.id === change.id);
        if (edgeIndex !== -1) {
          yedgesRef.current.delete(edgeIndex, 1);
        }
      });
      
      isUpdatingFromYjs.current = false;
    }
    
    setEdges(newEdges);
  }, [edges, yedgesRef, setEdges]);

  // Handle edge creation
  const onConnect = useCallback((params) => {
    const newEdge = {
      ...params,
      id: `edge-${Date.now()}-${Math.random()}`,
    };
    
    if (yedgesRef.current) {
      console.log('Creating new edge:', newEdge);
      yedgesRef.current.push([newEdge]);
      
      // Force immediate update from Yjs to React state
      setTimeout(() => {
        const currentEdges = yedgesRef.current?.toArray() || [];
        console.log('Force updating React state with', currentEdges.length, 'edges');
        setEdges([...currentEdges]);
      }, 0);
    }
  }, [yedgesRef, setEdges]);

  // Add new node
  const addNode = useCallback(() => {
    console.log('Add node clicked, connected:', isConnected, 'ynodesRef:', ynodesRef.current);
    
    if (!isConnected) {
      alert('Please wait for connection to be established');
      return;
    }
    
    if (!ynodesRef.current) {
      console.warn('Yjs nodes array not ready yet');
      alert('Collaboration system not ready yet, please try again');
      return;
    }

    const newNode = {
      id: `node-${Date.now()}-${Math.random()}`,
      type: 'default',
      position: { 
        x: Math.random() * 400, 
        y: Math.random() * 400 
      },
      data: { 
        label: `Node ${Date.now()}`,
        createdBy: username
      },
      style: {
        width: 160,
        height: 60,
        fontSize: '14px'
      }
    };

    console.log('Creating new node:', newNode);
    
    try {
      // Don't set isUpdatingFromYjs flag when adding nodes - let Yjs observer update React state
      ynodesRef.current.push([newNode]);
      console.log('Node added to Yjs array, current length:', ynodesRef.current.length);
      
      // Force immediate update from Yjs to React state
      setTimeout(() => {
        const currentNodes = ynodesRef.current?.toArray() || [];
        console.log('Force updating React state with', currentNodes.length, 'nodes');
        setNodes([...currentNodes]);
      }, 0);
      
    } catch (error) {
      console.error('Error adding node:', error);
      alert('Error adding node: ' + error.message);
    }
  }, [username, isConnected, ynodesRef, setNodes]);

  // Remove a specific node
  const removeNode = useCallback((nodeId) => {
    console.log('Remove node called for:', nodeId, 'connected:', isConnected);
    
    if (!isConnected) {
      alert('Please wait for connection to be established');
      return;
    }
    
    if (!ynodesRef.current || !yedgesRef.current) {
      console.warn('Yjs arrays not ready yet');
      alert('Collaboration system not ready yet, please try again');
      return;
    }

    try {
      // Find and remove the node
      const nodes = ynodesRef.current.toArray();
      const nodeIndex = nodes.findIndex(node => node.id === nodeId);
      
      if (nodeIndex !== -1) {
        ynodesRef.current.delete(nodeIndex, 1);
        console.log('Node removed from Yjs array');
      }
      
      // Remove all edges connected to this node
      const edges = yedgesRef.current.toArray();
      const edgesToRemove = [];
      
      edges.forEach((edge, index) => {
        if (edge.source === nodeId || edge.target === nodeId) {
          edgesToRemove.unshift(index); // Add to front so we can delete in reverse order
        }
      });
      
      // Delete edges in reverse order to maintain correct indices
      edgesToRemove.forEach(index => {
        yedgesRef.current.delete(index, 1);
      });
      
      if (edgesToRemove.length > 0) {
        console.log('Removed', edgesToRemove.length, 'connected edges');
      }
      
      // Force immediate update from Yjs to React state
      setTimeout(() => {
        const currentNodes = ynodesRef.current?.toArray() || [];
        const currentEdges = yedgesRef.current?.toArray() || [];
        console.log('Force updating React state after node removal - nodes:', currentNodes.length, 'edges:', currentEdges.length);
        setNodes([...currentNodes]);
        setEdges([...currentEdges]);
      }, 0);
      
    } catch (error) {
      console.error('Error removing node:', error);
      alert('Error removing node: ' + error.message);
    }
  }, [isConnected, ynodesRef, yedgesRef, setNodes, setEdges]);

  // Clear all nodes
  const clearNodes = useCallback(() => {
    console.log('Clear nodes clicked, connected:', isConnected, 'ynodesRef:', ynodesRef.current, 'yedgesRef:', yedgesRef.current);
    
    if (!isConnected) {
      alert('Please wait for connection to be established');
      return;
    }
    
    if (!ynodesRef.current || !yedgesRef.current) {
      console.warn('Yjs arrays not ready yet');
      alert('Collaboration system not ready yet, please try again');
      return;
    }

    if (!confirm('Are you sure you want to clear all nodes and edges?')) {
      return;
    }

    try {
      // Don't set isUpdatingFromYjs flag - let Yjs observer update React state
      ynodesRef.current.delete(0, ynodesRef.current.length);
      yedgesRef.current.delete(0, yedgesRef.current.length);
      console.log('All nodes and edges cleared');
      
      // Force immediate update from Yjs to React state
      setTimeout(() => {
        const currentNodes = ynodesRef.current?.toArray() || [];
        const currentEdges = yedgesRef.current?.toArray() || [];
        console.log('Force updating React state - nodes:', currentNodes.length, 'edges:', currentEdges.length);
        setNodes([...currentNodes]);
        setEdges([...currentEdges]);
      }, 0);
      
    } catch (error) {
      console.error('Error clearing nodes:', error);
      alert('Error clearing nodes: ' + error.message);
    }
  }, [isConnected, ynodesRef, yedgesRef, setNodes, setEdges]);

  // Handle node position changes (drag)
  const handleNodeDragStop = useCallback((event, node) => {
    console.log('Node drag stopped:', node.id, 'new position:', node.position);
    
    if (!ynodesRef.current) return;
    
    // Find and update the node in Yjs array
    const nodes = ynodesRef.current.toArray();
    const nodeIndex = nodes.findIndex(n => n.id === node.id);
    
    if (nodeIndex !== -1) {
      const updatedNode = { ...nodes[nodeIndex], position: node.position };
      
      // Update the specific node in Yjs array
      ynodesRef.current.delete(nodeIndex, 1);
      ynodesRef.current.insert(nodeIndex, [updatedNode]);
      
      console.log('Updated node position in Yjs');
    }
  }, [ynodesRef]);

  return {
    handleNodesChange,
    handleEdgesChange,
    onConnect,
    addNode,
    removeNode,
    clearNodes,
    handleNodeDragStop
  };
}; 