/** @type {import('next').NextConfig} */

// Parse CDN URL for remote image patterns
const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL || ''
const remotePatterns = []

if (cdnUrl) {
  try {
    const url = new URL(cdnUrl)
    remotePatterns.push({
      protocol: url.protocol.replace(':', ''),
      hostname: url.hostname,
      pathname: '/**',
    })
  } catch {
    // Invalid URL — skip remote patterns
  }
}

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns,
  },
}

export default nextConfig
