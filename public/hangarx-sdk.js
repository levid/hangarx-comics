/**
 * HangarX SDK
 * 
 * Enables:
 * - Iframe navigation tracking for chat agents
 * - Web analytics (pageviews, sessions)
 * - Knowledge Graph content ingestion
 * - GDPR consent mode
 * 
 * Usage:
 * <script src="https://your-agent-domain.com/hangarx-sdk.js"></script>
 * <script>
 *   HangarX.init({
 *     apiKey: 'YOUR_API_KEY',
 *     consentMode: 'pending' // 'granted', 'denied', or 'pending' (default: 'granted')
 *   });
 *
 *   // When user accepts cookies/tracking:
 *   HangarX.setConsent('granted');
 *
 *   // When user declines:
 *   HangarX.setConsent('denied');
 * </script>
 */

(function (window) {
    'use strict';

    const API_BASE_URL = 'http://localhost:8082'; // Replace with production URL
    const CONSENT_STORAGE_KEY = 'hangarx_consent';

    let config = {
        apiKey: null,
        autoTrack: true,
        consentMode: null // null = use stored value or default to 'granted'
    };

    // --- Consent Management ---
    function getStoredConsent() {
        try {
            return localStorage.getItem(CONSENT_STORAGE_KEY);
        } catch (e) {
            return null;
        }
    }

    function storeConsent(value) {
        try {
            localStorage.setItem(CONSENT_STORAGE_KEY, value);
        } catch (e) { /* localStorage unavailable */ }
    }

    function getConsent() {
        return config.consentMode || getStoredConsent() || 'granted';
    }

    function isTrackingAllowed() {
        return getConsent() === 'granted';
    }

    // --- Iframe Tracking (Legacy Support) ---
    function initIframeTracking() {
        if (window.self === window.top) return;

        function sendUrl() {
            try {
                window.parent.postMessage({
                    type: 'iframe-navigation',
                    url: window.location.href
                }, '*');
            } catch (e) { }
        }

        sendUrl();

        // Track history changes
        const pushState = history.pushState;
        const replaceState = history.replaceState;

        history.pushState = function () {
            pushState.apply(this, arguments);
            sendUrl();
            if (config.autoTrack && isTrackingAllowed()) trackPageview();
        };

        history.replaceState = function () {
            replaceState.apply(this, arguments);
            sendUrl();
            if (config.autoTrack && isTrackingAllowed()) trackPageview();
        };

        window.addEventListener('popstate', () => {
            sendUrl();
            if (config.autoTrack && isTrackingAllowed()) trackPageview();
        });

        window.addEventListener('hashchange', () => {
            sendUrl();
            if (config.autoTrack && isTrackingAllowed()) trackPageview();
        });
    }

    // --- Analytics ---
    async function trackPageview() {
        if (!config.apiKey || !isTrackingAllowed()) return;

        try {
            await fetch(`${API_BASE_URL}/api/analytics/event`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apiKey: config.apiKey,
                    eventType: 'pageview',
                    url: window.location.href,
                    title: document.title,
                    referrer: document.referrer,
                    timestamp: new Date().toISOString()
                })
            });
            console.log('[HangarX] Pageview tracked');
        } catch (e) {
            console.error('[HangarX] Failed to track pageview', e);
        }
    }

    // --- Knowledge Graph Ingestion ---
    async function captureContent() {
        if (!config.apiKey || !isTrackingAllowed()) return;

        try {
            // Simple text extraction
            const content = document.body.innerText;

            await fetch(`${API_BASE_URL}/api/knowledge/ingest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apiKey: config.apiKey,
                    url: window.location.href,
                    title: document.title,
                    content: content,
                    timestamp: new Date().toISOString()
                })
            });
            console.log('[HangarX] Content captured for Knowledge Graph');
        } catch (e) {
            console.error('[HangarX] Failed to capture content', e);
        }
    }

    // --- Public API ---
    window.HangarX = {
        init: function (options) {
            config = { ...config, ...options };

            // If consentMode was explicitly passed, persist it
            if (options && options.consentMode) {
                storeConsent(options.consentMode);
                config.consentMode = options.consentMode;
            }

            initIframeTracking();

            if (config.autoTrack && isTrackingAllowed()) {
                trackPageview();
                setTimeout(captureContent, 2000);
            }
        },

        /**
         * Update consent state at runtime.
         * @param {'granted'|'denied'|'pending'} consent
         */
        setConsent: function (consent) {
            const validValues = ['granted', 'denied', 'pending'];
            if (!validValues.includes(consent)) {
                console.warn('[HangarX] Invalid consent value. Use: granted, denied, or pending');
                return;
            }
            const previousConsent = getConsent();
            config.consentMode = consent;
            storeConsent(consent);
            console.log('[HangarX] Consent updated to:', consent);

            // If consent was just granted and autoTrack is on, fire deferred pageview
            if (consent === 'granted' && previousConsent !== 'granted' && config.autoTrack) {
                trackPageview();
                setTimeout(captureContent, 500);
            }
        },

        /**
         * Get current consent state.
         * @returns {'granted'|'denied'|'pending'}
         */
        getConsent: function () {
            return getConsent();
        },

        track: trackPageview,
        capture: captureContent
    };

})(window);

