import type { NextConfig } from "next";

// Headers de seguridad aplicados a todas las rutas. CSP se omite a propósito:
// con wagmi/viem y posibles iframes futuros conviene definirla con cuidado
// antes de imponerla en producción.
const securityHeaders = [
  // SAMEORIGIN (no DENY) porque el detalle de impresión carga el PDF en un
  // <iframe> apuntando a /api/printer/files/[filename] del mismo origen.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  // HSTS solo tiene efecto sobre HTTPS; lo dejamos preparado para producción.
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
