/**
 * DemandVerse AI - Centralized Data Quality & Protection Utilities
 * Protects frontend against NaN, null, undefined, Infinity, and empty-string crashes.
 */

/**
 * Validates if a value is a strict, finite number.
 * @param {any} val - The value to check
 * @returns {boolean} True if the value is a valid number
 */
export const isValidNumber = (val) => {
  if (val === null || val === undefined || val === '') return false;
  const num = Number(val);
  return !Number.isNaN(num) && Number.isFinite(num);
};

/**
 * Safely parses and formats a number to a fixed decimal string.
 * @param {any} val - The value to parse
 * @param {number} decimals - Number of decimal places (default 1)
 * @param {string} fallback - String returned if validation fails
 * @returns {string} Formatted number string or fallback
 */
export const safeNumber = (val, decimals = 1, fallback = 'Data unavailable') => {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'string' && (val.toLowerCase() === 'nan' || val.toLowerCase() === 'infinity')) return fallback;
  const num = Number(val);
  if (Number.isNaN(num) || !Number.isFinite(num)) return fallback;
  return num.toFixed(decimals);
};

/**
 * Safely parses and formats a number to USD currency.
 * @param {any} val - The numeric value to parse
 * @param {string} fallback - String returned if validation fails
 * @returns {string} USD formatted currency or fallback
 */
export const safeCurrency = (val, fallback = 'Price unavailable') => {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'string' && (val.toLowerCase() === 'nan' || val.toLowerCase() === 'infinity')) return fallback;
  const num = Number(val);
  if (Number.isNaN(num) || !Number.isFinite(num)) return fallback;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
};

/**
 * Safely parses and formats a number to a percentage string.
 * @param {any} val - The numeric value to parse
 * @param {number} decimals - Number of decimal places (default 1)
 * @param {string} fallback - String returned if validation fails
 * @returns {string} Percentage formatted string or fallback
 */
export const safePercentage = (val, decimals = 1, fallback = 'Data unavailable') => {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'string' && (val.toLowerCase() === 'nan' || val.toLowerCase() === 'infinity')) return fallback;
  const num = Number(val);
  if (Number.isNaN(num) || !Number.isFinite(num)) return fallback;
  return `${num.toFixed(decimals)}%`;
};

/**
 * Safely formats textual values, avoiding empty strings or undefined labels.
 * @param {any} val - The text value to parse
 * @param {string} fallback - Fallback string (default 'N/A')
 * @returns {string} Clean string or fallback
 */
export const safeText = (val, fallback = 'N/A') => {
  if (val === null || val === undefined || String(val).trim() === '') return fallback;
  return String(val).trim();
};

// Aliases for seamless backwards-compatibility across existing modules
export const safeFormatNum = safeNumber;
export const safeFormatCurrency = safeCurrency;

/**
 * Safely parses and formats a number to an integer string.
 */
export const safeInteger = (val, fallback = 'Data unavailable') => {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'string' && (val.toLowerCase() === 'nan' || val.toLowerCase() === 'infinity')) return fallback;
  const num = Number(val);
  if (Number.isNaN(num) || !Number.isFinite(num)) return fallback;
  return Math.round(num).toString();
};

/**
 * Safely formats a number into a compact string (e.g., 1.5K, 2M).
 */
export const safeCompactNumber = (val, fallback = 'Data unavailable') => {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'string' && (val.toLowerCase() === 'nan' || val.toLowerCase() === 'infinity')) return fallback;
  const num = Number(val);
  if (Number.isNaN(num) || !Number.isFinite(num)) return fallback;
  return new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short' }).format(num);
};

/**
 * Safely parses and formats a date string.
 */
export const safeDate = (val, fallback = 'Date unavailable') => {
  if (!val) return fallback;
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};
