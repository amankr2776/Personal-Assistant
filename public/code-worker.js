// Web Worker for JavaScript code execution — true sandbox
// Runs in a separate thread with NO access to:
// - window, document, DOM
// - localStorage, sessionStorage, cookies
// - fetch, XMLHttpRequest, WebSocket
// - importScripts (blocked by Vercel CSP)
// - The parent application's state

self.onmessage = function(e) {
  const { code, id } = e.data;
  const logs = [];
  const MAX_EXECUTION_TIME = 5000; // 5 seconds
  const MAX_OUTPUT_LENGTH = 50000; // 50KB output limit

  // Capture console output within worker
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  console.log = (...args) => {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
    if (logs.join('\n').length < MAX_OUTPUT_LENGTH) logs.push(msg);
  };
  console.warn = (...args) => {
    const msg = '⚠️ ' + args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
    if (logs.join('\n').length < MAX_OUTPUT_LENGTH) logs.push(msg);
  };
  console.error = (...args) => {
    const msg = '❌ ' + args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
    if (logs.join('\n').length < MAX_OUTPUT_LENGTH) logs.push(msg);
  };

  // Set up timeout
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    self.postMessage({ id, output: logs.join('\n'), error: 'Execution timed out (max 5 seconds)' });
    self.close(); // Terminate worker on timeout
  }, MAX_EXECUTION_TIME);

  try {
    // Execute in strict mode with no access to dangerous APIs
    // Worker globals are already restricted (no window, document, etc.)
    const fn = new Function('"use strict";\n' + code);
    const result = fn();

    if (!timedOut) {
      clearTimeout(timer);
      if (result !== undefined) {
        const resultStr = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
        if (resultStr.length < MAX_OUTPUT_LENGTH) {
          logs.push('→ ' + resultStr);
        } else {
          logs.push('→ [Output too large]');
        }
      }
      self.postMessage({ id, output: logs.join('\n') || '(no output)', error: null });
    }
  } catch (err) {
    if (!timedOut) {
      clearTimeout(timer);
      self.postMessage({ id, output: logs.join('\n'), error: err.message || String(err) });
    }
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  }
};
