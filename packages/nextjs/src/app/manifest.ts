import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CryptoCampus",
    short_name: "CryptoCampus",
    description: "Plataforma universitaria basada en blockchain — UCM",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0d12",
    theme_color: "#3b82f6",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
