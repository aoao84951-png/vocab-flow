import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ᴠᴏᴄᴀ",
    short_name: "ᴠᴏᴄᴀ",
    description: "ᴠᴏᴄᴀ",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    icons: [
      {
        src: "/icon.png?v=3",
        sizes: "1254x1254",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon.png?v=3",
        sizes: "1254x1254",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
