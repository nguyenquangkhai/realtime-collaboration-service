import DoUsername from 'do_username';

// User colors for collaboration
export const userColors = [
  '#30bced', '#6eeb83', '#ffbc42', '#ecd444', 
  '#ee6352', '#9ac2c9', '#8acb88', '#1be7ff'
];

/**
 * Generate a random username using DoUsername
 * @param {number} length - Maximum length of username (default: 15)
 * @returns {string} Random username
 */
export const generateRandomUsername = (length = 15) => {
  return DoUsername.generate(length);
};

/**
 * Get a random color from the predefined color palette
 * @returns {string} Hex color code
 */
export const getRandomUserColor = () => {
  return userColors[Math.floor(Math.random() * userColors.length)];
};

/**
 * Generate random user data (username + color)
 * @param {number} usernameLength - Maximum length of username (default: 15)
 * @returns {object} Object with name and color properties
 */
export const generateRandomUser = (usernameLength = 15) => {
  return {
    name: generateRandomUsername(usernameLength),
    color: getRandomUserColor()
  };
}; 