import type { NextConfig } from 'next'

// Validate env at build/boot time (INFRA-06, T-EnvLeak-01). Importing the schema
// here runs createEnv() during `next build`, so a missing/empty required var
// (e.g. DATABASE_URL) fails the build fast instead of booting with bad config.
// This is the t3-oss/env-nextjs recommended wiring.
import './lib/env'

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: 'standalone',
  experimental: {
    serverActions: {
      allowedOrigins: [
        'luizinhaconfeitaria.com.br',
        'www.luizinhaconfeitaria.com.br',
        'localhost:3000',
        '127.0.0.1:3000',
      ],
      bodySizeLimit: '1mb',
    },
  },
  // Next blocks cross-origin requests to dev-only assets/HMR by default
  // (server initialized on `localhost`) — 127.0.0.1 counts as a different
  // origin and gets silently blocked, breaking all client interactivity
  // while the initial SSR HTML still renders fine. Dev-only; production
  // never touches this.
  allowedDevOrigins: ['127.0.0.1'],
}

export default nextConfig
