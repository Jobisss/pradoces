import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: 'standalone',
  experimental: {
    serverActions: {
      allowedOrigins: ['docesvalentina.com.br', 'www.docesvalentina.com.br', 'localhost:3000'],
      bodySizeLimit: '1mb',
    },
  },
}

export default nextConfig
