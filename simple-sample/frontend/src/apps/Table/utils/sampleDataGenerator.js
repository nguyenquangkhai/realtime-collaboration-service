import { faker } from '@faker-js/faker';

/**
 * Generate sample data based on column type/header
 * @param {number} columnIndex - The column index
 * @param {Array} columnHeaders - Array of column header objects
 * @returns {string} Generated sample data
 */
export const generateSampleData = (columnIndex, columnHeaders) => {
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
};

/**
 * Generate a new column header
 * @returns {string} Generated column header
 */
export const generateColumnHeader = () => {
  const headerTypes = [
    'Name', 'Email', 'Age', 'City', 'Country', 'Company', 
    'Score', 'Department', 'Phone', 'Status', 'Product', 'Price'
  ];
  return faker.helpers.arrayElement(headerTypes);
};

/**
 * Generate initial sample grid data
 * @returns {Array} Initial grid with sample data
 */
export const generateInitialSampleGrid = () => {
  return [
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
}; 