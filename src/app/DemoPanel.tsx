import { useState } from "react";
import { buildDemoState, DEMO_PRESETS, type DemoPreset } from "../engine/progressEngine";
import { CASES } from "../story/cases";
import { dateOverride, gameNow, shiftDate, todayKey } from "./clock";
import { navigate } from "./router";
import { gameStore, STORAGE_KEY } from "./store";

/** 사건 수사를 등급과 상관없이 바로 열어 보는 QA 전용 저장 칸. 실제 플레이 기록(기본 저장 칸)과 따로 논다. */
const STORY_SLOT = "qa-story";
const BASE_KEY = "detective-academy:v1";

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

  /**
   * 사건을 처음부터 연다: QA 전용 저장 칸에 그 사건을 맡을 수 있는 등급의 상태를 새로 만들어 넣고 그 칸으로 옮겨 간다.
   * 지금 보고 있던 저장 칸(실제 플레이 기록)은 건드리지 않는다.
   */
  const openStory = (id: string) => {
    try {
      window.localStorage.setItem(`${BASE_KEY}:${STORY_SLOT}`, JSON.stringify(buildDemoState("promoted", gameNow())));
    } catch {
      // 저장하지 못하면 그 칸은 입학 화면에서 시작한다
    }
    window.location.href = `${window.location.pathname}?demo=1&save=${STORY_SLOT}#/story/${id}`;
  };
  const onQaSlot = STORAGE_KEY !== BASE_KEY;

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
          <p data-testid="demo-slot">{onQaSlot ? `QA 저장 칸 (${STORAGE_KEY.slice(BASE_KEY.length + 1)}) · 실제 기록과 분리됨` : "사건 수사 · 등급과 상관없이 열기"}</p>
          {CASES.map((c) => (
            <button key={c.id} type="button" onClick={() => openStory(c.id)} data-testid={`demo-story-${c.id}`}>
              {c.code} 처음부터 (QA 저장 칸)
            </button>
          ))}
          {onQaSlot && (
            <button type="button" onClick={() => (window.location.href = `${window.location.pathname}?demo=1#/`)} data-testid="demo-real-save">
              실제 기록으로 돌아가기
            </button>
          )}
        </div>
      )}
      <button type="button" className="demo__toggle" aria-label="QA 상태 전환 패널" aria-expanded={open} onClick={() => setOpen((v) => !v)} data-testid="demo-toggle">
        QA
      </button>
    </div>
  );
}
