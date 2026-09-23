"use client";

import { useCallback, useRef, useState } from "react";

const OPTIONS = ["동", "명", "형", "부", "전", "접", "대", "감", "숙", "구", "한"];
const ADD_OPTION = "__add_part_of_speech__";

export default function PartOfSpeechInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const previousValue = useRef(value);
  const focusInput = useCallback((input: HTMLInputElement | null) => {
    input?.focus();
  }, []);
  const custom = !!value && !OPTIONS.includes(value);

  return (
    <div
      className="relative shrink-0"
      style={{ width: editing ? 100 : custom ? Math.min(140, Math.max(66, value.length * 13 + 36)) : 66 }}
    >
      {editing ? (
        <input
          ref={focusInput}
          aria-label="품사 직접 입력"
          value={value}
          placeholder="직접 입력"
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => {
            onChange(value.trim() || previousValue.current);
            setEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              onChange(previousValue.current);
              setEditing(false);
            }
          }}
          className="h-10 w-full rounded-xl border border-[#587fa3] px-3 text-center text-[13px] outline-none"
        />
      ) : (
        <>
          <select
            aria-label="품사"
            value={value}
            onChange={(event) => {
              if (event.target.value === ADD_OPTION) {
                previousValue.current = value;
                onChange("");
                setEditing(true);
              } else {
                onChange(event.target.value);
              }
            }}
            className="h-10 w-full appearance-none rounded-xl border border-[#ddeaf3] pl-5 pr-7 text-center text-[13px] [text-align-last:center] outline-none"
          >
            {OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            {custom && <option value={value}>{value}</option>}
            <option value={ADD_OPTION}>추가</option>
          </select>
          <span aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#8a94a6]">
            <span className="folder-symbol text-[14px]">▽</span>
          </span>
        </>
      )}
    </div>
  );
}
