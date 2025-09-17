/**
 * JoeyJob Iframe Auto-Resizer
 * 
 * This script enables automatic height resizing for embedded JoeyJob booking forms.
 * Include this script on your website to automatically resize JoeyJob iframes based on their content.
 * 
 * Usage:
 * 1. Include this script before your iframe
 * 2. The script will automatically detect and resize all JoeyJob iframes on the page
 * 
 * @version 1.0.0
 * @author JoeyJob
 */

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    // Allowed origins for security (JoeyJob domains)
    allowedOrigins: [
      'https://app.joeyjob.com',
      'https://joeyjob.com',
      'http://localhost:3000', // Development
      'http://localhost:5173', // Vite dev
      'http://localhost:5722', // TanStack Start dev
    ],
    // Selector for JoeyJob iframes
    iframeSelector: 'iframe[src*="joeyjob.com"], iframe[src*="localhost:3000"], iframe[src*="localhost:5173"], iframe[src*="localhost:5722"]',
    // Debug mode (set to true for development)
    debug: true,
    // Minimum and maximum heights for safety
    minHeight: 300,
    maxHeight: 5000
  };

  // Debug logging
  function debugLog(message, data) {
    if (CONFIG.debug && window.console && window.console.log) {
      console.log('[JoeyJob IframeResizer]', message, data || '');
    }
  }

  // Validate origin for security
  function isValidOrigin(origin) {
    return CONFIG.allowedOrigins.some(allowedOrigin => {
      // Handle wildcards and exact matches
      if (allowedOrigin.endsWith('*')) {
        return origin.startsWith(allowedOrigin.slice(0, -1));
      }
      return origin === allowedOrigin;
    });
  }

  // Find iframe by source URL
  function findIframeBySource(sourceOrigin) {
    const iframes = document.querySelectorAll(CONFIG.iframeSelector);
    for (let iframe of iframes) {
      try {
        const iframeOrigin = new URL(iframe.src).origin;
        if (iframeOrigin === sourceOrigin) {
          return iframe;
        }
      } catch (e) {
        debugLog('Error parsing iframe URL:', iframe.src);
      }
    }
    return null;
  }


  // Main message handler
  function handleMessage(event) {
    debugLog('Received message:', {
      origin: event.origin,
      type: event.data?.type,
      data: event.data
    });

    // Validate origin
    if (!isValidOrigin(event.origin)) {
      debugLog('Blocked message from invalid origin:', event.origin);
      return;
    }

    // Handle different message types
    const data = event.data;
    if (!data || typeof data !== 'object') {
      return;
    }

    switch (data.type) {
      case 'iframeResize':
        handleResize(event);
        break;
      case 'bookingSubmitted':
        handleBookingSubmitted(event);
        break;
      default:
        debugLog('Unknown message type:', data.type);
    }
  }

  // Handle iframe resize messages
  function handleResize(event) {
    const { payload } = event.data;
    if (!payload || typeof payload.height !== 'number') {
      debugLog('Invalid resize payload:', payload);
      return;
    }

    const iframe = findIframeBySource(event.origin);
    if (!iframe) {
      debugLog('Could not find iframe for origin:', event.origin);
      return;
    }

    // Validate height bounds
    let newHeight = Math.max(CONFIG.minHeight, Math.min(CONFIG.maxHeight, payload.height));
    
    debugLog('Resizing iframe:', {
      currentHeight: iframe.offsetHeight,
      newHeight: newHeight,
      requestedHeight: payload.height
    });

    // Apply new height
    iframe.style.height = newHeight + 'px';

    // Dispatch custom event for advanced users
    const resizeEvent = new CustomEvent('joeyJobIframeResize', {
      detail: {
        iframe: iframe,
        oldHeight: iframe.offsetHeight,
        newHeight: newHeight,
        origin: event.origin
      }
    });
    window.dispatchEvent(resizeEvent);
  }

  // Handle booking submission messages
  function handleBookingSubmitted(event) {
    const { payload } = event.data;
    debugLog('Booking submitted:', payload);

    // Dispatch custom event for tracking/analytics
    const bookingEvent = new CustomEvent('joeyJobBookingSubmitted', {
      detail: {
        success: payload.success,
        formId: payload.formId,
        data: payload.data,
        error: payload.error,
        origin: event.origin
      }
    });
    window.dispatchEvent(bookingEvent);
  }

  // Initialize the iframe resizer
  function init() {
    debugLog('Initializing JoeyJob Iframe Resizer...');

    // Add message event listener
    if (window.addEventListener) {
      window.addEventListener('message', handleMessage, false);
    } else if (window.attachEvent) {
      // IE8 fallback
      window.attachEvent('onmessage', handleMessage);
    }

    // Set initial iframe properties
    const iframes = document.querySelectorAll(CONFIG.iframeSelector);
    debugLog(`Found ${iframes.length} JoeyJob iframes`);

    iframes.forEach((iframe, index) => {
      // Ensure iframe has proper attributes for resizing
      iframe.style.display = 'block';
      iframe.style.width = '100%';
      iframe.scrolling = 'no';
      
      debugLog(`Initialized iframe ${index + 1}:`, iframe.src);
    });

    debugLog('JoeyJob Iframe Resizer initialized successfully');
  }

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose API for advanced users
  window.JoeyJobIframeResizer = {
    init: init,
    config: CONFIG,
    handleMessage: handleMessage,
    version: '1.0.0'
  };

  debugLog('JoeyJob Iframe Resizer script loaded');
})();