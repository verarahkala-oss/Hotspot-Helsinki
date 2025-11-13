/**
 * Input validation utilities
 */

/**
 * Validate and sanitize latitude
 */
export function validateLatitude(value) {
  const num = parseFloat(value);
  if (isNaN(num) || num < -90 || num > 90) {
    throw new Error(`Invalid latitude: ${value}`);
  }
  return num;
}

/**
 * Validate and sanitize longitude
 */
export function validateLongitude(value) {
  const num = parseFloat(value);
  if (isNaN(num) || num < -180 || num > 180) {
    throw new Error(`Invalid longitude: ${value}`);
  }
  return num;
}

/**
 * Validate and sanitize radius (1-50 km)
 */
export function validateRadius(value, min = 1, max = 50) {
  const num = parseFloat(value);
  if (isNaN(num) || num < min || num > max) {
    throw new Error(`Invalid radius: ${value} (must be between ${min} and ${max})`);
  }
  return num;
}

/**
 * Validate and sanitize string input
 * Removes potentially dangerous characters
 */
export function validateString(value, maxLength = 200) {
  if (typeof value !== 'string') {
    throw new Error('Value must be a string');
  }
  
  // Remove null bytes and limit length
  const sanitized = value.replace(/\0/g, '').slice(0, maxLength).trim();
  
  if (sanitized.length === 0) {
    throw new Error('String cannot be empty');
  }
  
  return sanitized;
}

/**
 * Validate place ID format (alphanumeric with underscores/hyphens)
 */
export function validatePlaceId(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,200}$/.test(value)) {
    throw new Error('Invalid place ID format');
  }
  return value;
}

/**
 * Validate photo reference format
 */
export function validatePhotoReference(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,500}$/.test(value)) {
    throw new Error('Invalid photo reference format');
  }
  return value;
}

/**
 * Validate number within range
 */
export function validateNumber(value, min, max) {
  const num = Number(value);
  if (isNaN(num) || num < min || num > max) {
    throw new Error(`Invalid number: ${value} (must be between ${min} and ${max})`);
  }
  return num;
}

/**
 * Validate allowed action
 */
export function validateAction(value, allowedActions) {
  if (!allowedActions.includes(value)) {
    throw new Error(`Invalid action: ${value}. Allowed: ${allowedActions.join(', ')}`);
  }
  return value;
}

/**
 * Validate category
 */
export function validateCategory(value) {
  const allowedCategories = [
    'music', 'food', 'sports', 'family', 'arts', 'tech', 'nightlife', 'other'
  ];
  
  if (!allowedCategories.includes(value)) {
    throw new Error(`Invalid category: ${value}`);
  }
  
  return value;
}

/**
 * Validate bbox format (minLng,minLat,maxLng,maxLat)
 */
export function validateBbox(value) {
  if (typeof value !== 'string') {
    throw new Error('Bbox must be a string');
  }
  
  const parts = value.split(',').map(v => v.trim());
  
  if (parts.length !== 4) {
    throw new Error('Bbox must have 4 values: minLng,minLat,maxLng,maxLat');
  }
  
  const [minLng, minLat, maxLng, maxLat] = parts.map(Number);
  
  if ([minLng, minLat, maxLng, maxLat].some(isNaN)) {
    throw new Error('All bbox values must be numbers');
  }
  
  validateLongitude(minLng);
  validateLatitude(minLat);
  validateLongitude(maxLng);
  validateLatitude(maxLat);
  
  if (minLng >= maxLng || minLat >= maxLat) {
    throw new Error('Invalid bbox: min values must be less than max values');
  }
  
  return [minLng, minLat, maxLng, maxLat];
}
