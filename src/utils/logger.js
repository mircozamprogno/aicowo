// utils/logger.js

/**
 * Centralized logging utility for PowerCowo
 * Controls all console output via REACT_APP_ENABLE_LOGS environment variable
 * 
 * Usage:
 * import logger from './utils/logger';
 * logger.log('Debug info:', data);
 * logger.error('Error:', error);
 */

// Check if logging is enabled via environment variables.
// Each key is read statically: a dynamic import.meta.env[key] makes Vite inline
// every VITE_* variable (secrets included) into the bundle.
const isTrue = (value) => value === 'true';

// Individual switches for each log type
const isLogEnabled = isTrue(import.meta.env.VITE_ENABLE_LOG);
const isInfoEnabled = isTrue(import.meta.env.VITE_ENABLE_INFO);
const isDebugEnabled = isTrue(import.meta.env.VITE_ENABLE_DEBUG);
const isWarnEnabled = isTrue(import.meta.env.VITE_ENABLE_WARN);
const isErrorEnabled = isTrue(import.meta.env.VITE_ENABLE_ERROR);

// Master switch - if true, enables all logs regardless of individual switches
const masterSwitch = isTrue(import.meta.env.VITE_ENABLE_LOGS);

const logger = {
  /**
   * Standard log output
   */
  log: (...args) => {
    if (masterSwitch || isLogEnabled) {
      console.log(...args);
    }
  },

  /**
   * Error logging - always enabled for critical errors
   * Use logError for debugging errors that should respect the flag
   */
  error: (...args) => {
    // Errors are always logged, even in production
    console.error(...args);
  },

  /**
   * Error logging that respects the enable flag
   * Use this for debugging errors that aren't critical
   */
  logError: (...args) => {
    if (masterSwitch || isErrorEnabled) {
      console.error(...args);
    }
  },

  /**
   * Warning output
   */
  warn: (...args) => {
    if (masterSwitch || isWarnEnabled) {
      console.warn(...args);
    }
  },

  /**
   * Info output
   */
  info: (...args) => {
    if (masterSwitch || isInfoEnabled) {
      console.info(...args);
    }
  },

  /**
   * Debug output
   */
  debug: (...args) => {
    if (masterSwitch || isDebugEnabled) {
      console.debug(...args);
    }
  },

  /**
   * Table output for structured data
   */
  table: (data) => {
    if (masterSwitch || isLogEnabled) {
      console.table(data);
    }
  },

  /**
   * Group logs together
   */
  group: (label) => {
    if (masterSwitch || isLogEnabled) {
      console.group(label);
    }
  },

  groupCollapsed: (label) => {
    if (masterSwitch || isLogEnabled) {
      console.groupCollapsed(label);
    }
  },

  groupEnd: () => {
    if (masterSwitch || isLogEnabled) {
      console.groupEnd();
    }
  },

  /**
   * Time measurement
   */
  time: (label) => {
    if (masterSwitch || isLogEnabled) {
      console.time(label);
    }
  },

  timeEnd: (label) => {
    if (masterSwitch || isLogEnabled) {
      console.timeEnd(label);
    }
  },

  /**
   * Check if logging is currently enabled
   */
  isEnabled: () => masterSwitch || isLogEnabled || isInfoEnabled || isDebugEnabled || isWarnEnabled || isErrorEnabled,

  /**
   * Log current logging status (useful for debugging the logger itself)
   */
  logStatus: () => {
    console.log('[Logger] Status:');
    console.log('  Master Switch:', masterSwitch);
    console.log('  LOG:', masterSwitch || isLogEnabled);
    console.log('  INFO:', masterSwitch || isInfoEnabled);
    console.log('  DEBUG:', masterSwitch || isDebugEnabled);
    console.log('  WARN:', masterSwitch || isWarnEnabled);
    console.log('  ERROR (debug):', masterSwitch || isErrorEnabled);
    console.log('  ERROR (critical): always enabled');
  }
};

export default logger;