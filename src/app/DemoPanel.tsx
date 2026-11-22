import { useState } from "react";
import { DEMO_PRESETS, type DemoPreset } from "../engine/progressEngine";
import { dateOverride, shiftDate, todayKey } from "./clock";
import { navigate } from "./router";
import { gameStore } from "./store";

/** 주소에 ?demo=1 이 있을 때만 켜진다. 일반 사용자 화면에는 나오지 않는다. */
export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("demo") === "1";
}

/** 상태별 화면을 바로 확인하기 위한 QA 패널 */
export function DemoPanel() {
  const [open, setOpen] = useState(false);
  const [, bump] = useState(0);

  const apply = (preset: DemoPreset) => {
    gameStore.applyPreset(preset);
    navigate({ name: "home" }, { replace: true });
    setOpen(false);
  };

  /** 날짜를 옮긴다: 오늘의 추리와 하루 응시 횟수가 그 날짜를 따른다 */
  const shift = (days: number | null) => {
    shiftDate(days);
    gameStore.refresh();
    bump((n) => n + 1);
  };

  return (
    <div className="demo" data-testid="demo-panel">
      {open && (
        <div className="demo__panel" role="group" aria-label="QA 상태 전환">
          <p>QA 전용 · 저장된 진행 상태를 바꿉니다</p>
          {DEMO_PRESETS.map((preset) => (
            <button key={preset.id} type="button" onClick={() => apply(preset.id)} data-testid={`demo-${preset.id}`}>
              {preset.label}
            </button>
          ))}
          <p data-testid="demo-date">
            게임 날짜 {todayKey()}
            {dateOverride() ? " (옮김)" : ""}
          </p>
          <button type="button" onClick={() => shift(1)} data-testid="demo-next-day">
            다음 날로 (오늘의 추리·응시 횟수)
          </button>
          <button type="button" onClick={() => shift(null)} data-testid="demo-real-day">
            실제 날짜로
          </button>
          <button type="button" onClick={() => gameStore.resetExamDays()} data-testid="demo-reset-attempts">
            오늘 응시 횟수 되돌리기
          </button>
        </div>
      )}
      <button type="button" className="demo__toggle" aria-label="QA 상태 전환 패널" aria-expanded={open} onClick={() => setOpen((v) => !v)} data-testid="demo-toggle">
        QA
      </button>
    </div>
  );
}
