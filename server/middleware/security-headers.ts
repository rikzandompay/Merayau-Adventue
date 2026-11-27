const isProd = process.env.NODE_ENV === 'production'

const CSP_HEADER = [
  "default-src 'self'",
  isProd ? "script-src 'self' 'unsafe-inline'" : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com https://*.vercel-storage.com",
  "frame-src 'self' https://maps.google.com https://www.google.com",
  isProd ? "connect-src 'self'" : "connect-src 'self' ws: wss:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ')

export default defineEventHandler((event) => {
  const cleanPath = (event.path.split('?')[0] || '').toLowerCase()

  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  setHeader(event, 'X-Frame-Options', 'SAMEORIGIN')
  setHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin')
  setHeader(event, 'Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()')

  if (!cleanPath.startsWith('/uploads/')) {
    setHeader(event, 'Content-Security-Policy', CSP_HEADER)
  }

  if (isProd) {
    setHeader(event, 'Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }

  if (cleanPath.startsWith('/api/admin') || cleanPath.startsWith('/api/auth')) {
    setHeader(event, 'Cache-Control', 'no-store, private')
  }
})

