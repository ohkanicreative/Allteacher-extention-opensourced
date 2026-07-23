/**
 * Extension Background Service Worker
 * Routes telemetry data to local/remote analysis endpoints.
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'ANALYZE_SUBMISSION') {
    const payload = message.data;

    fetch('http://127.0.0.1:8000/api/v1/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
      .then((response) => response.json())
      .then((analysis) => {
        console.warn('Cheating Risk Assessment:', analysis);
        // Persist findings in local extension storage for display in teacher popup
        chrome.storage.local.set({ [payload.fieldName]: analysis });
        sendResponse({ status: 'SUCCESS', result: analysis });
      })
      .catch((error) => {
        console.error('Analysis Endpoint Error:', error);
        sendResponse({ status: 'ERROR', error: error.message });
      });

    return true; // Keep message port open for async response
  }
});