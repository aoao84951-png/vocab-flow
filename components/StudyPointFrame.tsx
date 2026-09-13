import type { ReactNode } from "react";

export default function StudyPointFrame({
  category,
  children,
}: {
  category: ReactNode;
  children: ReactNode;
}) {
  return (
    <fieldset className="min-w-0 rounded-xl border border-[#d7ddea] bg-white px-3 pb-3 [overflow-wrap:anywhere] sm:px-4 sm:pb-4">
      <legend className="max-w-full px-1">
        <span className="inline-block max-w-full rounded-full bg-[#e7ecf5] px-2 py-1 text-[11px] font-bold text-[#303236]">
          {category}
        </span>
      </legend>
      <div className="space-y-3 pt-3 [&>div+div]:border-t [&>div+div]:border-[#e4e8f0] [&>div+div]:pt-3">
        {children}
      </div>
    </fieldset>
  );
}
