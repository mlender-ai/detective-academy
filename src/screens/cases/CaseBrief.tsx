import type { Puzzle } from "../../engine/types";

interface Props {
  puzzle: Puzzle;
  hints: { text: string }[];
  /** 끄면 제목과 수사 지원만 놓는다 (할 일은 화면의 다른 자리가 말할 때) */
  description?: boolean;
  /** 제목 옆에 늘 적어 둘 짧은 글 (예: 증거 조합의 "네 사람 · 세 곳") */
  aside?: string;
}

/** 사건의 머리: 제목, 할 일 한두 문장, 열어 본 수사 지원 */
export function CaseBrief({ puzzle, hints, description = true, aside }: Props) {
  return (
    <article className="exampaper leaf casebrief" style={{ viewTransitionName: "exam-sheet" }}>
      <header className="exampaper__head">
        <div className="casebrief__top">
          <h1 className="exampaper__title">{puzzle.title}</h1>
          {aside && (
            <p className="casebrief__aside" data-testid="case-aside">
              {aside}
            </p>
          )}
        </div>
        {description && <p className="exampaper__text">{puzzle.description}</p>}
        {hints.map((hint, i) => (
          <p className="exampaper__hint" key={i} data-testid={`brief-hint-${i + 1}`}>
            <b className="hand">수사 지원 {i + 1}</b>
            <span>{hint.text}</span>
          </p>
        ))}
      </header>
    </article>
  );
}
