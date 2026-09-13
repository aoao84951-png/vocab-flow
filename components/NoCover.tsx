type Props = { preview?: boolean };

export default function NoCover({ preview = false }: Props) {
  return <span role="img" aria-label="표지 없음" className={`inline-flex shrink-0 items-center justify-center overflow-hidden bg-[#f2f2f2] ${preview ? "h-16 w-11 rounded-md" : "h-[52px] w-9 rounded"}`}>
    <span aria-hidden="true" style={{ fontFamily: "Arial, sans-serif" }} className={`font-semibold tracking-[0.6px] text-[#939da9] ${preview ? "text-[7px]" : "text-[6px]"}`}>BOOK</span>
  </span>;
}
