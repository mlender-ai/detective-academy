import type { CSSProperties } from "react";

interface Props {
  /** 인장 가운데 글자 (예: 추론 성공, 조사 완료, 합격) */
  label: string;
  size?: number;
  animate?: boolean;
  delayMs?: number;
  className?: string;
}

/** 점으로 찍은 네모 인장. 기울이지 않는다(점이 뭉개지지 않게). 네 글자는 두 줄로 찍는다. */
export function Stamp({ label, size = 112, animate = false, delayMs = 0, className }: Props) {
  const chars = [...label.replace(/\s+/g, "")];
  const twoRows = chars.length === 4;
  return (
    <span
      className={["pxstamp", className].filter(Boolean).join(" ")}
      style={{ "--stamp-delay": `${delayMs}ms`, "--stamp-size": `${Math.round(size * 0.78)}px` } as CSSProperties}
      data-animate={animate}
      data-rows={twoRows ? 2 : 1}
      role="img"
      aria-label={`${label} 인장`}
    >
      {twoRows ? (
        <>
          <span aria-hidden="true">{chars.slice(0, 2).join("")}</span>
          <span aria-hidden="true">{chars.slice(2).join("")}</span>
        </>
      ) : (
        <span aria-hidden="true">{chars.join("")}</span>
      )}
    </span>
  );
}
