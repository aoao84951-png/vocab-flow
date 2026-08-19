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
          background: "#ffffff",
        }}
      >
        <svg
          width="300"
          height="300"
          viewBox="0 0 320 320"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M38 93L78 53L170 83L225 28L263 35L272 73L217 128L247 242L209 280L153 187L116 224L124 266L92 298L58 238L18 204L50 172L92 180L129 143L38 93Z"
            stroke="#0f2a5f"
            strokeWidth="22"
            strokeLinejoin="miter"
          />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}
