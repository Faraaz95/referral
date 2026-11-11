import type { NextConfig } from 'next';

// The browser only talks to Next.js; /api and /media are proxied to Django so the
// session cookie and CSRF token stay on one origin. In Docker, BACKEND_URL is the
// backend container (set at build time — rewrites are baked into the build).
const API = process.env.BACKEND_URL ?? 'http://localhost:8000';

const nextConfig: NextConfig = {
  output: 'standalone', // small self-contained server for the production Docker image
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      { source: '/api/:path*/', destination: `${API}/api/:path*/` },
      { source: '/api/:path*', destination: `${API}/api/:path*/` },
      { source: '/media/:path*', destination: `${API}/media/:path*` },
    ];
  },
};

export default nextConfig;
