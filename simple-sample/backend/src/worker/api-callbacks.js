/**
 * Extract JSON data from Yjs document for API callbacks
 * @param {string} roomName 
 * @param {Y.Doc} doc 
 * @returns {Object} JSON representation of the document data
 */
export function extractDocumentJson(roomName, doc) {
  try {
    const jsonData = {
      roomName,
      timestamp: new Date().toISOString(),
      data: {}
    }

    // Extract different types of shared data structures
    const sharedTypes = doc.share || new Map()
    
    // Convert Y.Doc to JSON - this extracts all shared types
    const fullJson = doc.toJSON()
    jsonData.data = fullJson

    // For node diagrams specifically, try to extract nodes and edges arrays
    if (doc.getArray && typeof doc.getArray === 'function') {
      try {
        const nodesArray = doc.getArray('nodes')
        const edgesArray = doc.getArray('edges')
        
        if (nodesArray) {
          jsonData.data.nodes = nodesArray.toArray()
        }
        
        if (edgesArray) {
          jsonData.data.edges = edgesArray.toArray()
        }
      } catch (arrayError) {
        console.debug(`🔍 Could not extract arrays from room ${roomName}:`, arrayError.message)
      }
    }

    // For text editors, try to extract text content
    if (doc.getText && typeof doc.getText === 'function') {
      try {
        const textContent = doc.getText('text')
        if (textContent) {
          jsonData.data.text = textContent.toString()
        }
      } catch (textError) {
        console.debug(`🔍 Could not extract text from room ${roomName}:`, textError.message)
      }
    }

    // Add metadata about the document
    jsonData.metadata = {
      clientCount: doc.clientID ? 1 : 0,
      hasContent: Object.keys(jsonData.data).length > 0,
      dataSize: JSON.stringify(jsonData.data).length
    }

    return jsonData
  } catch (error) {
    console.error(`❌ Error extracting JSON from room ${roomName}:`, error)
    return {
      roomName,
      timestamp: new Date().toISOString(),
      error: error.message,
      data: {},
      metadata: { hasContent: false, dataSize: 0 }
    }
  }
}

/**
 * Send room data to external API (currently just logs)
 * @param {Object} roomData - JSON data extracted from Yjs document
 */
export async function sendApiCallback(roomData) {
  try {
    console.log('🔔 API CALLBACK - Room Data:', JSON.stringify(roomData, null, 2))
    
    // In a real implementation, you would make an HTTP request here:
    // const response = await fetch(process.env.API_CALLBACK_URL, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(roomData)
    // })
    
    return { success: true }
  } catch (error) {
    console.error(`❌ Error sending API callback for room ${roomData.roomName}:`, error)
    return { success: false, error: error.message }
  }
} 