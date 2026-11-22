import type { SubmitOutcome } from "../../engine/progressEngine";
import type { CodePuzzle } from "../../engine/types";

/** 암호 풀이 화면(자료실 장면, 수사 수첩)이 받는 것 */
export interface CodePlayProps {
  puzzle: CodePuzzle;
  /** exam: 승급 시험으로 치른다(위 막대에 '승급 시험'이 붙는다). 자료실 장면만 받는다. */
  variant?: "case" | "exam";
  /** 이미 해결한 문제를 기록·보상 없이 다시 푼다 */
  replay?: boolean;
  onExit: () => void;
  /** 정답 연출이 끝나면 호출된다 */
  onSolved: (outcome: SubmitOutcome) => void;
}
