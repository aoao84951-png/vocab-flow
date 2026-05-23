import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#30343b",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            position: "relative",
            width: 250,
            height: 275,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: "translateY(-4px)",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 16,
              top: 18,
              width: 72,
              height: 245,
              background: "#f4f5f7",
              borderRadius: 18,
              boxShadow: "6px 6px 0 #aeb4bf",
              transform: "skewX(18deg)",
            }}
          />

          <div
            style={{
              position: "absolute",
              right: 16,
              top: 18,
              width: 72,
              height: 245,
              background: "#f4f5f7",
              borderRadius: 18,
              boxShadow: "6px 6px 0 #aeb4bf",
              transform: "skewX(-18deg)",
            }}
          />

          <div
            style={{
              position: "absolute",
              bottom: 4,
              width: 116,
              height: 74,
              background: "#f4f5f7",
              borderRadius: 20,
              boxShadow: "6px 6px 0 #aeb4bf",
              transform: "rotate(0deg)",
            }}
          />
        </div>
      </div>
    ),
    size
  );
}