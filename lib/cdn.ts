/**
 * CDN URL utility for HangarX Comics
 * 
 * When NEXT_PUBLIC_CDN_URL is set, all comic page images and videos
 * will be served from the CDN instead of the local /public directory.
 * 
 * This enables:
 * - Hosting assets on Cloudflare R2, S3, or any CDN
 * - Keeping the repo lightweight (no large binary files in git)
 * - Contributors can fork and point to their own CDN
 * 
 * Directory structure on CDN should mirror /public:
 *   cdn.example.com/comic/vol1/ep1/P01.webp
 *   cdn.example.com/video/vol1/ep1/P01.mp4
 */

/**
 * The CDN base URL, without a trailing slash.
 * Falls back to empty string (relative paths) for local development.
 */
export const CDN_URL = (process.env.NEXT_PUBLIC_CDN_URL || '').replace(/\/+$/, '')

/**
 * Prefix an asset path with the CDN URL if configured.
 * 
 * @param path - Asset path starting with / (e.g. "/comic/vol1/ep1/P01.webp")
 * @returns Full URL if CDN is configured, otherwise the original path
 * 
 * @example
 * // With CDN_URL = "https://assets.hangarx.ai"
 * assetUrl("/comic/vol1/ep1/P01.webp")
 * // → "https://assets.hangarx.ai/comic/vol1/ep1/P01.webp"
 * 
 * @example
 * // Without CDN (local dev)
 * assetUrl("/comic/vol1/ep1/P01.webp")
 * // → "/comic/vol1/ep1/P01.webp"
 */
export function assetUrl(path: string): string {
  if (!path) return path
  // If path is already an absolute URL, return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return CDN_URL ? `${CDN_URL}${path}` : path
}
