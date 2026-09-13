import type { ReactNode } from "react";

export function StudyPointVariants({ children, decorated }: { children: ReactNode; decorated: boolean }) {
  if (!decorated) return <div className="space-y-5">{children}</div>;

  return (
    <div className="study-point-variants">
      <span aria-hidden="true" className="folder-symbol study-point-variant-star study-point-variant-star-start">☆</span>
      <div className="space-y-5">{children}</div>
      <span aria-hidden="true" className="folder-symbol study-point-variant-star study-point-variant-star-end">☆</span>
    </div>
  );
}

export default function StudyPointFrame({
  category,
  title,
  children,
}: {
  category: ReactNode;
  title?: ReactNode;
  children: ReactNode;
}) {
  return (
    <fieldset className="min-w-0 rounded-xl border border-[#d7ddea] bg-white px-3 pb-3 [overflow-wrap:anywhere] sm:px-4 sm:pb-4">
      <legend className="max-w-full px-1">
        <span className="flex items-center gap-2 text-[11px] font-bold leading-[1.5]">
          <span className="shrink-0 rounded-full bg-[#e7ecf5] px-2 py-1 text-[#303236]">
            {category}
          </span>
          {title && <span className="study-point-title min-w-0 -translate-y-px text-[14px] leading-[1.5]">{title}</span>}
        </span>
      </legend>
      <div className="space-y-5 pt-3">
        {children}
      </div>
    </fieldset>
  );
}
