/**
 * Header keamanan HTTP. Murni (tanpa import Node) agar bisa di-test.
 * Di production dipakai penuh; di development CSP dilonggarkan agar HMR
 * Next.js (yang memakai eval) tetap jalan.
 */
export interface SecurityHeader {
  key: string;
  value: string;
}

const PROD_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' accounts.google.com",
].join("; ");

const DEV_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: https:",
  "connect-src 'self' ws: wss:",
  "frame-ancestors 'none'",
].join("; ");

export function securityHeaders(isProduction: boolean): SecurityHeader[] {
  return [
    { key: "Content-Security-Policy", value: isProduction ? PROD_CSP : DEV_CSP },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ...(isProduction
      ? [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ]
      : []),
  ];
}
