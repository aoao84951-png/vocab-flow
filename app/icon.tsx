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
          background: "#f7f8fb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "110px",
        }}
      >
        <div
          style={{
            width: 330,
            height: 330,
            borderRadius: 88,
            background: "#ffffff",
            border: "10px solid #dce2ee",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 24px 70px rgba(15, 42, 95, 0.16)",
          }}
        >
          <span
            style={{
              color: "#0f2a5f",
              fontSize: 96,
              fontWeight: 800,
              letterSpacing: "-6px",
            }}
          >
            VF
          </span>
        </div>
      </div>
    ),
    size
  );
}