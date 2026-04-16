import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@refinery/ui', '@refinery/shared'],
}

export default nextConfig
