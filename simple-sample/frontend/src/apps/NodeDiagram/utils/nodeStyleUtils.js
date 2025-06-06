/**
 * Calculate styled nodes with user interaction highlights (selection + dragging)
 * @param {Array} nodes - Array of nodes
 * @param {Object} userSelections - User selections and interactions
 * @param {Array} selectedNodes - Currently selected node IDs
 * @param {string} userColor - Current user's color
 * @returns {Array} Styled nodes array
 */
export const getStyledNodes = (nodes, userSelections, selectedNodes, userColor) => {
  return nodes.map(node => {
    let style = { 
      ...node.style,
      // Default style for unselected nodes with smaller size
      width: node.style?.width || 160,
      height: node.style?.height || 60,
      fontSize: node.style?.fontSize || '14px',
      border: '3px solid transparent', // Always use 3px border to maintain consistent size
      borderRadius: '6px',
      backgroundColor: '#ffffff',
      boxSizing: 'border-box', // Prevent border from affecting overall size
      transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      outline: '1px solid #d1d5db', // Use outline for default border appearance
      outlineOffset: '-1px'
    };
    
    let interactingUser = null;
    let interactionType = null;
    
    // Check if this node is being interacted with by any other user (not ourselves)
    for (const [clientId, interaction] of Object.entries(userSelections)) {
      // Check if user is dragging this node
      if (interaction.draggedNode === node.id) {
        interactingUser = interaction.user;
        interactionType = 'dragging';
        break;
      }
      // Check if user has selected this node (only if not dragging)
      else if (interaction.selectedNodes.includes(node.id)) {
        interactingUser = interaction.user;
        interactionType = 'selected';
        // Don't break here, dragging takes priority
      }
    }
    
    // Apply styling for other users' interactions
    if (interactingUser) {
      const shadowIntensity = interactionType === 'dragging' ? '80' : '40';
      const shadowSize = interactionType === 'dragging' ? '16px' : '8px';
      
      style = {
        ...style,
        border: `3px solid ${interactingUser.color}`, // Always 3px for consistent size
        boxShadow: `0 0 ${shadowSize} ${interactingUser.color}${shadowIntensity}`,
        backgroundColor: '#ffffff',
        outline: 'none' // Remove default outline when showing user interaction
      };
    }
    
    // Add special highlight for our own selection (takes priority over other users)
    if (selectedNodes.includes(node.id) && userColor) {
      style = {
        ...style,
        border: `3px solid ${userColor}`,
        boxShadow: `0 0 12px ${userColor}60`,
        backgroundColor: '#ffffff',
        outline: 'none' // Remove default outline when showing our own selection
      };
    }
    
    return { ...node, style };
  });
}; 