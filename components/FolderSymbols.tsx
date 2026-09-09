"use client";

import { useState } from "react";

const coloredSymbols = [
  { value: "blue-circle", label: "시그니처 파란색 원" },
  { value: "sky-double-circle", label: "하늘색 이중 원" },
  { value: "sky-double-square", label: "하늘색 이중 네모" },
];

export function FolderSymbolGlyph({ symbol }: { symbol: string }) {
  if (!coloredSymbols.some((item) => item.value === symbol)) return <>{symbol}</>;

  return (
    <svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 24 24" fill="#ecf5ff" stroke="#849db0" strokeWidth="1.8" className="inline-block shrink-0 align-middle">
      {symbol === "blue-circle" ? (
        <circle cx="12" cy="12" r="9" />
      ) : symbol === "sky-double-circle" ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="4.5" />
        </>
      ) : (
        <>
          <rect x="3" y="3" width="18" height="18" rx="1.5" />
          <rect x="7.5" y="7.5" width="9" height="9" rx="0.7" />
        </>
      )}
    </svg>
  );
}

const common = ["#", "♡", "○", "△", "☆", "♥", "●", "▲", "★", "◇", "□", "♧", "♬", "♪", "※", "◎", "◐", "◑", "♤", "♠", "♣", "◆", "■", "▽", "▷", "◁"];
const more = Array.from("←↑→↓↔↕↖↗↘↙⇒⇔•‥…†‡‰′″℃℉ℓ№℡™ΩÅ⅓⅔⅛⅜⅝⅞①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⓐⓑⓒⓓⓔⓕⓖⓗⓘⓙⓚⓛⓜⓝⓞⓟⓠⓡⓢⓣⓤⓥⓦⓧⓨⓩ▣▤▥▦▧▨▩◈☎☏☜☞♀♂♨♩♭\ue00a\ue00b\ue00c\ue00d");

export function FolderSymbol({ symbol = "#" }: { symbol?: string }) {
  if (symbol === "") return null;
  return <span aria-hidden="true" className="folder-symbol mr-3 inline-flex w-5 shrink-0 items-center justify-center text-[21px] font-normal text-[#858b94]"><FolderSymbolGlyph symbol={symbol} /></span>;
}

export function FolderSymbolPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <fieldset className="min-w-0">
      <legend className="mb-3 text-[12px] font-medium text-[#737b88]">폴더 기호</legend>
      <div className="grid grid-cols-7 gap-2" role="group" aria-label="폴더 기호 선택">
        {["", ...coloredSymbols.map((item) => item.value), ...(expanded ? [...common, ...more] : common)].map((symbol) => (
          <button key={symbol} type="button" aria-label={coloredSymbols.find((item) => item.value === symbol)?.label ?? (symbol ? `기호 ${symbol}` : "기호 없음")} title={coloredSymbols.find((item) => item.value === symbol)?.label} aria-pressed={value === symbol}
            onClick={() => onChange(symbol)}
            className={`folder-symbol flex h-10 items-center justify-center rounded-xl border text-[23px] transition-colors ${value === symbol ? "border-[#587fa3] bg-[#eff7fc] text-[#303236]" : "border-transparent bg-[#f7f7f6] text-[#737b88] hover:bg-[#eeeeed]"}`}
          >{symbol ? <FolderSymbolGlyph symbol={symbol} /> : <span className="font-sans text-[12px]">없음</span>}</button>
        ))}
      </div>
      <button type="button" onClick={() => setExpanded(!expanded)} className="mt-3 text-[12px] text-[#737b88]">{expanded ? "접기" : "기호 더 보기"}</button>
      <label className="mt-3 flex items-center gap-3 text-[12px] text-[#737b88]">
        직접 입력
        <input aria-label="폴더 기호 직접 입력" value={coloredSymbols.some((item) => item.value === value) ? "" : value} onChange={(event) => onChange(Array.from(event.target.value).slice(0, 1).join(""))} className="folder-symbol h-10 w-14 rounded-xl border border-[#e4e8f0] text-center text-[23px] text-[#303236]" />
      </label>
    </fieldset>
  );
}
