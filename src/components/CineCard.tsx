import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../app/motion";

/**
 * 장면이 바뀔 때 잠깐 뜨는 검은 자막 화면.
 * 제목이 한 자씩 찍히고, 잠시 머문 뒤 격자가 걷히며 사라진다. 화면을 누르면 바로 걷힌다.
 * 주소에 cine=0 을 붙이거나 저장소에 CINE_KEY 를 "off" 로 두면 뜨지 않는다(캡처·자동 테스트용).
 * 모션 줄이기 설정에서도 뜨지 않는다.
 */
export const CINE_KEY = "detective-academy:cine";

export function cineEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (prefersReducedMotion()) return false;
  if (new URLSearchParams(window.location.search).get("cine") === "0") return false;
  try {
    return window.localStorage.getItem(CINE_KEY) !== "off";
  } catch {
    return true;
  }
}

interface Props {
  /** 제목 위의 작은 글자 (예: 사건 기록) */
  kicker: string;
  title: string;
  /** 제목 아래 한 줄 (예: 유형) */
  sub?: string;
  /** 사건을 여는 한두 문장. 제목이 다 찍힌 뒤에 나오고, 읽을 만큼 더 머문다. */
  text?: string;
}

const TYPE_MS = 55;
const HOLD_MS = 800;
/** 여는 글 한 자를 읽는 데 주는 시간 */
const READ_MS = 42;
const OUT_MS = 300;

/** 자막 화면이 떠 있는 시간(ms). 뜨지 않는 설정이면 0. 시험의 시계를 그만큼 늦게 돌리는 데 쓴다. */
export function cineDuration(title: string, text?: string): number {
  if (!cineEnabled()) return 0;
  return title.length * TYPE_MS + HOLD_MS + (text ? text.length * READ_MS : 0) + OUT_MS;
}

export function CineCard({ kicker, title, sub, text }: Props) {
  const [enabled] = useState(cineEnabled);
  const [count, setCount] = useState(0);
  const [stage, setStage] = useState<"type" | "out" | "gone">("type");
  const timer = useRef(0);

  useEffect(() => {
    if (!enabled || stage !== "type") return;
    if (count < title.length) {
      timer.current = window.setTimeout(() => setCount((n) => n + 1), TYPE_MS);
    } else {
      timer.current = window.setTimeout(() => setStage("out"), HOLD_MS + (text ? text.length * READ_MS : 0));
    }
    return () => window.clearTimeout(timer.current);
  }, [enabled, stage, count, title.length, text]);

  useEffect(() => {
    if (stage !== "out") return;
    const id = window.setTimeout(() => setStage("gone"), OUT_MS);
    return () => window.clearTimeout(id);
  }, [stage]);

  if (!enabled || stage === "gone") return null;

  return (
    <div className="cine" data-stage={stage} data-testid="cine-card" aria-hidden="true" onPointerDown={() => setStage((s) => (s === "type" ? "out" : s))}>
      <p className="cine__kicker">{kicker}</p>
      <p className="cine__title">
        {title.slice(0, count)}
        <i className="narr__caret" />
      </p>
      <p className="cine__sub" data-shown={count >= title.length}>
        {sub ?? ""}
      </p>
      {text && (
        <p className="cine__text" data-shown={count >= title.length}>
          {text}
        </p>
      )}
    </div>
  );
}
