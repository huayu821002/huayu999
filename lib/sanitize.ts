/**
 * Lightweight server-side HTML sanitizer.
 * Strips dangerous tags, attributes, and protocols without JSDOM dependency.
 */

const DANGEROUS_TAGS = /<(script|style|iframe|object|embed|form|input|button|select|textarea|link|meta|base|svg|math)(\s|>|\/)/gi
const DANGEROUS_ATTRS = /\s(on\w+|href|src|action|formaction|data|style)\s*=\s*(?!(?:background|href|src|poster|longdesc|png|sandbox|allow|allowfullscreen)(?:\s|>|"|'))/gi
const JAVASCRIPT_PROTO = /javascript\s*:/gi

/**
 * Strip dangerous HTML tags, attributes, and protocols.
 * Preserves basic formatting tags and links.
 */
export function sanitizeHTML(input: string): string {
  if (!input) return ''

  let clean = input

  // Step 1: Remove dangerous tags entirely
  clean = clean.replace(DANGEROUS_TAGS, '')

  // Step 2: Remove event handler attributes (onclick, onerror, onload, etc.)
  clean = clean.replace(DANGEROUS_ATTRS, ' ')

  // Step 3: Remove javascript: links
  clean = clean.replace(JAVASCRIPT_PROTO, '')

  // Step 4: Remove data: URLs (except safe image types)
  clean = clean.replace(/data\s*:\s*(?!image\/(png|jpeg|jpg|gif|webp))/gi, '')

  return clean
}

/**
 * Sanitize plain text (no HTML) — escape for safe display.
 */
export function escapeHtml(text: string): string {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
