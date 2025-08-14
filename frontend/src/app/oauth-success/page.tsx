'use client';

export default function OAuthSuccessDeprecated() {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const locationId = params.get('locationId');
    const base = window.location.origin;
    const redirect = `${base}/app/custom-page${locationId ? `?locationId=${encodeURIComponent(locationId)}` : ''}`;
    window.location.replace(redirect);
  }
  return null;
}
