import { Context } from 'hono';

const PIXEL_SCRIPT = `(function(window, document) {
  'use strict';

  const CONFIG = {
    endpoint: 'https://api.lucascosta.tech/events/ingest',
    storageKey: 'lc_tracking_consent',
    bannerId: 'lc-consent-banner'
  };

  let _consent = localStorage.getItem(CONFIG.storageKey);

  // ==========================================
  // CONSENT UI
  // ==========================================
  function showConsentBanner() {
    if (document.getElementById(CONFIG.bannerId)) return;

    // Create Overlay
    const overlay = document.createElement('div');
    overlay.id = CONFIG.bannerId;
    overlay.style.cssText = \`
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      box-sizing: border-box;
    \`;

    // Create Modal
    const modal = document.createElement('div');
    modal.style.cssText = \`
      background: white;
      color: #1f2937;
      padding: 2rem;
      border-radius: 1rem;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      font-family: system-ui, -apple-system, sans-serif;
      text-align: center;
      animation: fadeIn 0.3s ease-out;
    \`;

    // Add animation keyframes
    const styleSheet = document.createElement("style");
    styleSheet.innerText = \`
      @keyframes fadeIn {
        from { opacity: 0; transform: scale(0.95); }
        to { opacity: 1; transform: scale(1); }
      }
    \`;
    document.head.appendChild(styleSheet);

    // Title
    const title = document.createElement('h2');
    title.textContent = '🍪 We value your privacy';
    title.style.cssText = \`
      margin: 0 0 1rem 0;
      font-size: 2rem;
      font-weight: 700;
      color: #111827;
      line-height: 1.2;
    \`;

    // Text
    const text = document.createElement('p');
    text.innerHTML = 'We use cookies to enhance your browsing experience and analyze our traffic. By clicking "Accept All", you consent to our use of cookies. <a href="/privacy" style="color: #2563eb; text-decoration: underline;">Read our Privacy Policy</a>.';
    text.style.cssText = \`
      margin: 0 0 2rem 0;
      font-size: 1.25rem;
      line-height: 1.6;
      color: #4b5563;
    \`;

    // Button Group
    const btnGroup = document.createElement('div');
    btnGroup.style.cssText = \`
      display: flex;
      flex-direction: column;
      gap: 1rem;
    \`;

    // Common Button Style
    const btnStyle = \`
      padding: 1rem 2rem;
      border-radius: 0.5rem;
      border: none;
      cursor: pointer;
      font-weight: 600;
      font-size: 1.25rem;
      transition: all 0.2s;
      width: 100%;
    \`;

    // Accept Button
    const acceptBtn = document.createElement('button');
    acceptBtn.textContent = 'Accept All';
    acceptBtn.style.cssText = btnStyle + 'background: #2563eb; color: white; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);';
    acceptBtn.onmouseover = () => acceptBtn.style.background = '#1d4ed8';
    acceptBtn.onmouseout = () => acceptBtn.style.background = '#2563eb';
    acceptBtn.onclick = () => setConsent('granted');

    // Deny Button
    const denyBtn = document.createElement('button');
    denyBtn.textContent = 'Reject Non-Essential';
    denyBtn.style.cssText = btnStyle + 'background: transparent; color: #4b5563; border: 1px solid #d1d5db;';
    denyBtn.onmouseover = () => { denyBtn.style.background = '#f3f4f6'; denyBtn.style.color = '#111827'; };
    denyBtn.onmouseout = () => { denyBtn.style.background = 'transparent'; denyBtn.style.color = '#4b5563'; };
    denyBtn.onclick = () => setConsent('denied');

    btnGroup.appendChild(acceptBtn);
    btnGroup.appendChild(denyBtn);

    modal.appendChild(title);
    modal.appendChild(text);
    modal.appendChild(btnGroup);
    overlay.appendChild(modal);

    document.body.appendChild(overlay);
    
    // Prevent scrolling while modal is open
    document.body.style.overflow = 'hidden';
  }

  function hideConsentBanner() {
    const banner = document.getElementById(CONFIG.bannerId);
    if (banner) banner.remove();
    document.body.style.overflow = ''; // Restore scrolling
  }

  function setConsent(status) {
    _consent = status;
    localStorage.setItem(CONFIG.storageKey, status);
    hideConsentBanner();
    
    // If granted, we might want to re-trigger a page view or just let the next event handle it.
    // For now, we just log it.
    console.log(\`[LucasPixel] Consent set to: \${status}\`);
  }

  // ==========================================
  // TRACKING CORE
  // ==========================================
  async function sendEvent(eventName, properties = {}, user = {}) {
    // If consent is not yet decided, show banner and default to 'denied' for this request
    
    if (!_consent) {
      showConsentBanner();
    }

    const consentHeader = _consent || 'denied'; // Default to denied if not set

    const payload = {
      name: eventName,
      timestamp: new Date().toISOString(),
      user: user, // Include user identity if provided
      context: {
        page: {
          url: window.location.href,
          path: window.location.pathname,
          referrer: document.referrer,
          title: document.title
        },
        userAgent: navigator.userAgent,
        screen: {
          width: window.screen.width,
          height: window.screen.height
        }
      },
      properties: properties
    };

    try {
      const res = await fetch(CONFIG.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tracking-Consent': consentHeader
        },
        credentials: 'include', // IMPORTANT: Sends/Receives cookies
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        console.error('[LucasPixel] Failed to send event:', res.status);
      } else {
        const data = await res.json();
        console.debug('[LucasPixel] Event sent. AnonID:', data.anonymousId);
      }
    } catch (err) {
      console.error('[LucasPixel] Error:', err);
    }
  }

  // ==========================================
  // FORM TRACKING
  // ==========================================
  function enableFormTracking() {
    document.addEventListener('submit', (e) => {
      const form = e.target;
      // Try to find an email field
      const emailInput = form.querySelector('input[type="email"], input[name="email"], input[name*="email"]');
      
      if (emailInput && emailInput.value) {
        const email = emailInput.value;
        console.debug('[LucasPixel] Intercepted form submission with email:', email);
        
        // Send identify event or attach to form_submit
        sendEvent('form_submit', {
          formId: form.id,
          formName: form.name,
          formAction: form.action
        }, { email: email });
      }
    });
  }

  // ==========================================
  // PUBLIC API
  // ==========================================
  window.Lucas = {
    init: (options = {}) => {
      if (options.endpoint) CONFIG.endpoint = options.endpoint;
      if (options.autoTrackForms) enableFormTracking();
      if (!_consent) showConsentBanner();
    },
    page: (properties) => {
      sendEvent('page_view', properties);
    },
    track: (eventName, properties) => {
      sendEvent(eventName, properties);
    },
    identify: (email, properties = {}) => {
      sendEvent('identify', properties, { email });
    },
    reset: () => {
      localStorage.removeItem(CONFIG.storageKey);
      _consent = null;
      showConsentBanner();
    }
  };

  // Auto-init if configured via data attributes script tag? 
  // For simplicity, user calls Lucas.init()

})(window, document);
`;

export async function handleServePixel(c: Context) {
  return c.text(PIXEL_SCRIPT, 200, {
    'Content-Type': 'application/javascript',
    'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
  });
}
