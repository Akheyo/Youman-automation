'use client';

import { useEffect } from 'react';

/**
 * postMessage the document height to the parent window so the host page can
 * resize the iframe smoothly. Pairs with `wordpress/iframe-snippet.html`.
 */
export default function EmbedResizer() {
  useEffect(() => {
    if (typeof window === 'undefined' || window === window.parent) return;
    let last = 0;
    function send() {
      const h = document.documentElement.scrollHeight;
      if (h !== last) {
        last = h;
        window.parent.postMessage({ type: 'ab-pv-resize', height: h }, '*');
      }
    }
    send();
    const ro = new ResizeObserver(send);
    ro.observe(document.documentElement);
    const interval = setInterval(send, 800);
    return () => {
      ro.disconnect();
      clearInterval(interval);
    };
  }, []);
  return null;
}
