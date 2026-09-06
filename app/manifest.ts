import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VOCAB FLOW",
    short_name: "VOCAB FLOW",
    description: "VOCAB FLOW",
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
