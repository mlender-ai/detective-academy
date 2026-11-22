// 탐정학원의 진입점. 화풍은 1비트 흑백 도트다(2026-11-22 확정).
// 배치(@layer layout) → 격자 규칙의 바탕(mono-pixel.css, @layer skin) → 겉모습(mono*.css) 순서로 입힌다.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/art.css";
import "./styles/hall.css";
import "./styles/desk.css";
import "./styles/rooms.css";
import "./styles/mono-pixel.css";
import "./styles/mono.css";
import "./styles/mono-rooms.css";
import "./styles/live.css";
import "./styles/codeux.css";
import "./styles/cases.css";
import "./styles/growth.css";
import "./styles/story.css";

import { App } from "./app/App";
import { ALL_PUZZLES } from "./data/puzzles";
import { verifyGuidance, verifyPuzzle } from "./engine/puzzleValidator";

// 개발 중에는 문제 데이터를 고칠 때마다 정답 유일성과 힌트·해설 일관성을 바로 확인한다.
// (같은 검사를 npm test 가 자동으로 수행한다.)
if (import.meta.env.DEV) {
  for (const puzzle of ALL_PUZZLES) {
    const solved = verifyPuzzle(puzzle);
    const guidance = verifyGuidance(puzzle);
    if (!solved.ok) console.error(`[문제 검증 실패] ${puzzle.id}: 정답 ${solved.solutions.length}개`, solved);
    if (!guidance.ok) console.error(`[힌트·해설 검증 실패] ${puzzle.id}`, guidance.issues);
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
