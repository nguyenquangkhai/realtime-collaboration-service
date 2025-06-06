import { useEffect, useState } from 'react';

/**
 * Hook to track connected users from awareness state for Table app
 */
export const useCollaborationUsers = () => {
  const [connectedUsers, setConnectedUsers] = useState([]);

  useEffect(() => {
    // Function to extract users from the global table-users div that DatasheetEditor creates
    const updateUsersFromDOM = () => {
      const usersDiv = document.querySelector('#table-users');
      if (usersDiv) {
        // Extract user information from the DOM
        const userElements = usersDiv.querySelectorAll('div');
        const users = Array.from(userElements).map(element => {
          const text = element.textContent || '';
          // Parse color from style if available
          const style = element.getAttribute('style') || '';
          const colorMatch = style.match(/color:\s*([^;]+)/);
          const color = colorMatch ? colorMatch[1] : '#30bced';
          
          return {
            name: text.trim(),
            color: color
          };
        }).filter(user => user.name); // Filter out empty names
        
        setConnectedUsers(users);
      }
    };

    // Set up a mutation observer to watch for changes in the table-users div
    const observer = new MutationObserver(updateUsersFromDOM);
    
    // Start observing
    const usersDiv = document.querySelector('#table-users');
    if (usersDiv) {
      observer.observe(usersDiv, { 
        childList: true, 
        subtree: true, 
        characterData: true 
      });
      
      // Initial update
      updateUsersFromDOM();
    }

    // Also set up a periodic check as fallback
    const interval = setInterval(updateUsersFromDOM, 1000);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, []);

  return { connectedUsers };
}; 