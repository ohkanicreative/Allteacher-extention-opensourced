/**
 * Student Client Telemetry Manager
 * Captures typing speeds, focus shifts, paste payloads, and handles submit operations.
 */

(function () {
  'use strict';

  // State registry holding metrics per field ID
  const studentMetrics = {
    studentId: 'STU_89210',
    examId: 'EXAM_HIST_2026',
    fields: {}
  };

  let heartbeatInterval = null;

  // Initialize monitoring on target textareas
  function initializeTelemetry() {
    const fields = document.querySelectorAll('textarea');

    fields.forEach((field) => {
      studentMetrics.fields[field.id] = {
        fieldName: field.name,
        keystrokes: [],
        pastes: [],
        blurCount: 0,
        focusCount: 0,
        startTime: Date.now(),
        lastKeystrokeTime: null
      };

      // 1. Keystroke timing listener
      field.addEventListener('keydown', (e) => {
        const fieldData = studentMetrics.fields[field.id];
        const now = Date.now();
        
        fieldData.keystrokes.push({
          key: e.key.length === 1 ? 'CHAR' : e.key, // Mask individual characters for privacy
          timestamp: now,
          interval: fieldData.lastKeystrokeTime ? now - fieldData.lastKeystrokeTime : 0
        });

        fieldData.lastKeystrokeTime = now;
      });

      // 2. Paste event interception
      field.addEventListener('paste', (e) => {
        const fieldData = studentMetrics.fields[field.id];
        const clipboardText = (e.clipboardData || window.clipboardData).getData('text');

        fieldData.pastes.push({
          timestamp: Date.now(),
          charCount: clipboardText.length,
          snippet: clipboardText.substring(0, 50)
        });
      });

      // 3. Field Focus Tracking
      field.addEventListener('focus', () => {
        studentMetrics.fields[field.id].focusCount += 1;
      });

      field.addEventListener('blur', () => {
        studentMetrics.fields[field.id].blurCount += 1;
      });
    });

    // 4. Global Window Focus/Blur Monitoring (Tab switching)
    window.addEventListener('blur', () => {
      // Record globally across all fields
      Object.keys(studentMetrics.fields).forEach((key) => {
        studentMetrics.fields[key].blurCount += 1;
      });
    });

    // Start background heartbeats to verify continuous student connectivity
    startHeartbeat();
  }

  // Periodic heartbeat sent to the server to prevent anti-cheat script termination
  function startHeartbeat() {
    heartbeatInterval = setInterval(() => {
      fetch('http://127.0.0.1:8000/api/v1/student/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: studentMetrics.studentId,
          examId: studentMetrics.examId,
          timestamp: Date.now()
        })
      }).catch((err) => console.warn('Heartbeat connection warning:', err.message));
    }, 5000);
  }

  // Handle Form Submission
  const form = document.getElementById('assessmentForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearInterval(heartbeatInterval);

    const payload = {
      studentId: studentMetrics.studentId,
      examId: studentMetrics.examId,
      submissionTime: Date.now(),
      responses: []
    };

    // Compile state for each form field
    Object.keys(studentMetrics.fields).forEach((fieldId) => {
      const fieldElement = document.getElementById(fieldId);
      const metrics = studentMetrics.fields[fieldId];
      const durationSeconds = (Date.now() - metrics.startTime) / 1000;
      const textContent = fieldElement.value;

      payload.responses.push({
        fieldId: fieldId,
        fieldName: metrics.fieldName,
        text: textContent,
        textLength: textContent.length,
        durationSeconds: durationSeconds,
        totalKeystrokes: metrics.keystrokes.length,
        keystrokeIntervals: metrics.keystrokes.map(k => k.interval),
        pasteEvents: metrics.pastes,
        blurCount: metrics.blurCount
      });
    });

    // Dispatch completed dataset to backend API
    try {
      const response = await fetch('http://127.0.0.1:8000/api/v1/student/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      
      const statusBanner = document.getElementById('statusBanner');
      statusBanner.style.display = 'block';
      statusBanner.className = 'status-banner status-success';
      statusBanner.innerText = `Assessment submitted successfully. Confirmation ID: ${result.submissionId}`;
      document.getElementById('submitBtn').disabled = true;

    } catch (err) {
      alert('Failed to submit assessment. Please check network connectivity.');
    }
  });

  document.addEventListener('DOMContentLoaded', initializeTelemetry);
})();