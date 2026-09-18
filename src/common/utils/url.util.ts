import { Request } from 'express';

/**
 * Extract base URL (protocol + host) from request object or environment variables.
 */
export function getBaseUrl(req?: Request): string {
  if (req) {
    const protocol = req.protocol || 'http';
    const host = req.get('host') || req.headers.host;
    if (host) {
      return `${protocol}://${host}`;
    }
  }
  const port = process.env.PORT || 4000;
  return process.env.BASE_URL || `http://localhost:${port}`;
}

/**
 * Format relative image path into a full absolute URL.
 * If already a full URL (http:// or https://), returns as is.
 */
export function formatImageUrl(imagePath?: string | null, baseUrl?: string): string {
  if (!imagePath) return '';
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  const base = baseUrl || process.env.BASE_URL || `http://localhost:${process.env.PORT || 4000}`;
  const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  return `${base}${cleanPath}`;
}
