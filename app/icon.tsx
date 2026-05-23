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
        <svg width="300" height="300" viewBox="0 0 300 300">
          <path
            d="M58 52 L132 238 Q150 276 168 238 L242 52"
            fill="none"
            stroke="#f7f8fb"
            strokeWidth="48"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M58 52 L132 238 Q150 276 168 238 L242 52"
            fill="none"
            stroke="#b8bec8"
            strokeWidth="48"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.75"
            transform="translate(9 10)"
          />
          <path
            d="M58 52 L132 238 Q150 276 168 238 L242 52"
            fill="none"
            stroke="#f7f8fb"
            strokeWidth="48"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    size
  );
}