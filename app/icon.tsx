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
          width: "512px",
          height: "512px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "116px",
          background: "linear-gradient(145deg, #3e4650 0%, #252b33 100%)",
          overflow: "hidden",
          boxShadow:
            "inset 0 5px 12px rgba(255,255,255,0.13), inset 0 -10px 20px rgba(0,0,0,0.2)",
        }}
      >
        <svg
          width="300"
          height="280"
          viewBox="0 0 350 330"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            marginTop: "10px",
          }}
        >
          <path
            d="
              M54 30
              Q54 22 62 22
              H132
              Q139 22 141 29
              L175 178
              L209 29
              Q211 22 218 22
              H288
              Q296 22 296 30
              Q296 33 295 36
              L214 284
              Q211 294 201 294
              H149
              Q139 294 136 284
              L55 36
              Q54 33 54 30
              Z
            "
            fill="#11161d"
            opacity="0.45"
            transform="translate(12 15)"
          />

            <path
            d="
                M18 28
                Q18 18 30 18
                H112
                Q124 18 128 32
                L175 196
                L222 32
                Q226 18 238 18
                H320
                Q332 18 332 28
                Q332 36 328 46
                L236 292
                Q231 308 215 308
                H135
                Q119 308 114 292
                L22 46
                Q18 36 18 28
                Z
            "
            fill="url(#vGradient)"
            />

            <path
            d="
                M62 45
                H112
                L175 248
                L238 45
                H288
                L212 282
                H138
                L62 45
                Z
            "
            fill="rgba(255,255,255,0.26)"
            />

          <defs>
            <linearGradient id="vGradient" x1="175" y1="22" x2="175" y2="294">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="52%" stopColor="#f5f5f6" />
              <stop offset="100%" stopColor="#c9ced6" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}