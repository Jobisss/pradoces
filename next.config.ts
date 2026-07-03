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
      allowedOrigins: ['luizinhaconfeitaria.com.br', 'www.luizinhaconfeitaria.com.br', 'localhost:3000'],
      bodySizeLimit: '1mb',
    },
  },
}

export default nextConfig
