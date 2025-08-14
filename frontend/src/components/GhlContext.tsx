'use client';

import React, { useEffect } from 'react';

interface GhlContextProps {
  enc: string;
}

const GhlContext: React.FC<GhlContextProps> = ({ enc }) => {
  useEffect(() => {
    if (enc) {
      try {
        window.__WLINK_GHL_ENC__ = enc;
        document.cookie = `wlink_ghlctx=${encodeURIComponent(enc)}; Path=/; Max-Age=600; SameSite=None; Secure`;
      } catch (e) {
        console.error('Failed to set GHL context:', e);
      }
    }
  }, [enc]);

  return null;
};

export default GhlContext;
