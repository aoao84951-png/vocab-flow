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
        src: "/icon?v=2",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon?v=2",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
