/**
 * Academic Integrity Telemetry Collector
 * Measures keystroke intervals, paste velocity, and focus loss events.
 */

(function () {
  'use strict';

  // Store telemetry state per input field
  const inputMetrics = new Map();

  function getFieldState(element) {
    if (!inputMetrics.has(element)) {
      inputMetrics.set(element, {
        keystrokeTimestamps: [],
        pasteEvents: [],
        totalCharsInserted: 0,
        focusLostCount: 0,
        startTime: Date.now()
      });
    }
    return inputMetrics.get(element);
  }

  // 1. Detect Focus Loss (Tab Switching / Application Switching)
  window.addEventListener('blur', () => {
    document.querySelectorAll('textarea, input[type="text"]').forEach((field) => {
      const state = getFieldState(field);
      state.focusLostCount += 1;
    });
  });

  // 2. Keystroke Dynamics Tracking
  document.addEventListener('keydown', (event) => {
    const target = event.target;
    if (target.tagName === 'TEXTAREA' || (target.tagName === 'INPUT' && target.type === 'text')) {
      const state = getFieldState(target);
      state.keystrokeTimestamps.push(Date.now());
    }
  });

  // 3. Paste Event Analysis
  document.addEventListener('paste', (event) => {
    const target = event.target;
    if (target.tagName === 'TEXTAREA' || (target.tagName === 'INPUT' && target.type === 'text')) {
      const state = getFieldState(target);
      const pastedData = (event.clipboardData || window.clipboardData).getData('text');

      state.pasteEvents.push({
        timestamp: Date.now(),
        length: pastedData.length,
        contentSnippet: pastedData.substring(0, 100) // First 100 chars
      });
    }
  });

  // 4. Input Submission Analysis & Dispatch
  document.addEventListener('submit', (event) => {
    const form = event.target;
    const inputs = form.querySelectorAll('textarea, input[type="text"]');

    inputs.forEach((input) => {
      const state = getFieldState(input);
      const textValue = input.value;
      const durationSeconds = (Date.now() - state.startTime) / 1000;

      // Calculate Characters Per Minute (CPM)
      const cpm = (textValue.length / (durationSeconds / 60)) || 0;

      const payload = {
        fieldName: input.name || input.id || 'unnamed_field',
        submittedText: textValue,
        textLength: textValue.length,
        durationSeconds: durationSeconds,
        charactersPerMinute: cpm,
        totalKeystrokes: state.keystrokeTimestamps.length,
        pasteCount: state.pasteEvents.length,
        pasteData: state.pasteEvents,
        focusLostCount: state.focusLostCount
      };

      // Send payload to background service worker
      chrome.runtime.sendMessage({
        action: 'ANALYZE_SUBMISSION',
        data: payload
      });
    });
  });
})();