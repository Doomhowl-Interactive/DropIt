/**
 * Reads the csrf_token cookie for the double-submit check. The cookie is
 * deliberately not HttpOnly so pages can echo it back.
 */
export function readCsrfToken(document: Document): string {
  const match = document.cookie.match(/(^|;)\s*csrf_token\s*=\s*([^;]+)/);
  return match ? match[2]! : '';
}
