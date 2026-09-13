type Props = { preview?: boolean };

export default function NoCover({ preview = false }: Props) {
  return <span role="img" aria-label="표지 없음" className={`inline-flex shrink-0 overflow-hidden rounded-[20%] bg-[#f2f2f2] shadow-[0_2px_5px_rgba(65,75,90,0.05)] ${preview ? "h-16 w-11" : "h-[52px] w-9"}`}>
    <svg aria-hidden="true" viewBox="0 0 280 420" className="h-full w-full">
      <text x="140" y="210" dominantBaseline="middle" textAnchor="middle" textLength="116" lengthAdjust="spacingAndGlyphs" fill="#98a3b4" fontFamily="Arial, sans-serif" fontSize="14" fontWeight="600" letterSpacing="5">NO COVER</text>
    </svg>
  </span>;
}
