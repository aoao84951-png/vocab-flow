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
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f2a5f",
        }}
      >
        <div
          style={{
            width: "420px",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            color: "#f2b8c6",
            fontFamily: "Arial, Helvetica, sans-serif",
            fontWeight: 900,
            letterSpacing: "-8px",
            marginLeft: "46px",
            marginTop: "12px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: "118px",
              lineHeight: 0.82,
              marginRight: "12px",
            }}
          >
            Vocab
          </div>
          <div
            style={{
              display: "flex",
              fontSize: "154px",
              lineHeight: 0.82,
            }}
          >
            Flow
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
