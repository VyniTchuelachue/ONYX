import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Location for finding help, microphone for dictating to the assistant — nothing else.
  { key: 'Permissions-Policy', value: 'geolocation=(self), microphone=(self), camera=(), payment=()' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The shared core package ships TypeScript source.
  transpilePackages: ['@onyx/core'],
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
