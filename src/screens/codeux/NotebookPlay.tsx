import { useEffect, useRef, useState } from "react";
import { DeskWood } from "../../components/DeskWood";
import { cineEnabled } from "../../components/CineCard";
import { LiveScene, type LiveSceneHandle } from "../../components/LiveScene";
import { Narration } from "../../components/Narration";
import type { CodeInput, CodePuzzle } from "../../engine/types";
import { ClueLegend, ClueStrip, CodeLock, MemoPad, clueText, memoSummary, useCodeBoard } from "../../games/CodeBreaker/CodeBreaker";
import type { GameProps } from "../../games/logic";
import { VaultScene, type VaultSpot } from "../../scene/vaultScene";
import { PlayBar, PlayFoot, PlayNotice, PlayOverlays, REACTION_MS } from "../playParts";
import { usePlaySession } from "../usePlaySession";
import type { CodePlayProps } from "./FoldPlay";
import { vaultStory } from "./story";
import { useStored } from "./useStored";

/** 수첩의 상태: 접힘 · 간편 보기(기록의 숫자와 표시만) · 전체 보기(모든 조건과 메모) */
type NoteMode = "closed" | "peek" | "full";

/** 도입 장면이 스스로 걷히기까지: 글이 다 찍힌 뒤 잠시 머문다 */
const INTRO_TYPE_MS = 36;
const INTRO_HOLD_MS = 1500;

interface IntroProps {
  title: string;
  text: string;
  onDone: () => void;
}

/**
 * 짧은 도입 장면: 탐정이 자료실에 들어와 금고 앞에 서고, 그 아래에 상황 세 문장이 찍힌다.
 * 다 찍히면 스스로 걷히고, 화면을 누르면 바로 걷힌다. 자막 화면을 끈 설정(자동 테스트·모션 줄이기)에서는 뜨지 않는다.
 */
function VaultIntro({ title, text, onDone }: IntroProps) {
  const sceneRef = useRef<LiveSceneHandle<VaultSpot>>(null);

  useEffect(() => {
    const walk = window.setTimeout(() => sceneRef.current?.go("safe"), 300);
    const close = window.setTimeout(onDone, 400 + text.length * INTRO_TYPE_MS + INTRO_HOLD_MS);
    return () => {
      window.clearTimeout(walk);
      window.clearTimeout(close);
    };
    // 뜰 때 한 번만 한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <button type="button" className="vaultintro" onClick={onDone} data-testid="intro" aria-label={`사건 도입: ${text} 누르면 넘어갑니다.`}>
      <span className="vaultintro__kicker">사건 기록</span>
      <span className="vaultintro__title">{title}</span>
      <LiveScene ref={sceneRef} kind="vault" make={() => new VaultScene()} className="vaultscene" state={{ open: false }} />
      <Narration text={text} />
      <span className="vaultintro__skip">누르면 넘어간다</span>
    </button>
  );
}

/**
 * 암호 풀이 C안 · 혼합형 (V3 GATE 03 비교안, ?play=c).
 * 짧은 도입 장면 뒤, 자물쇠를 크게 두고 조건은 수사 수첩에 담는다.
 * 수첩은 세 가지로 쓴다: 접어 둔다 / 기록의 숫자와 표시만 보는 간편 보기 / 모든 조건과 메모를 보는 전체 보기.
 * 수첩을 펴고 접어도 자물쇠의 숫자는 그대로다. 수첩의 상태와 중요 표시는 기기에 기억된다.
 */
export function NotebookPlay({ puzzle, replay = false, onExit, onSolved }: CodePlayProps) {
  const session = usePlaySession(puzzle, { replay, reactionMs: REACTION_MS.code, onSolved });
  const input = session.input as CodeInput;
  const board = useCodeBoard({
    input,
    onChange: session.change as GameProps<CodePuzzle, CodeInput>["onChange"],
    verdict: session.verdict,
    wrongCount: session.wrongCount,
  });
  const story = vaultStory(puzzle);
  const { rules } = puzzle;

  const [mode, setMode] = useStored<NoteMode>(`note:${puzzle.id}`, "peek");
  /** 중요하다고 표시한 기록(번호). 간편 보기는 표시한 기록을 글과 함께 먼저 보여 준다. */
  const [flags, setFlags] = useStored<number[]>(`flags:${puzzle.id}`, []);
  // 처음 여는 사건에만 도입 장면을 보여 준다(풀다가 돌아왔을 때는 바로 자물쇠 앞이다)
  const [intro, setIntro] = useState(() => cineEnabled() && !replay && session.progress.elapsedMs < 1000 && session.progress.attempts === 0);

  const { out, maybe } = memoSummary(puzzle, input.memo);
  const marks = out.length + maybe.length;
  const flagged = rules.clues.map((clue, i) => ({ clue, i })).filter(({ i }) => flags.includes(i));
  const toggleFlag = (i: number) => setFlags((now) => (now.includes(i) ? now.filter((n) => n !== i) : [...now, i].sort((a, b) => a - b)));
  const full = mode === "full";

  const memoLine =
    marks === 0 ? (
      <span>표시한 숫자 없음</span>
    ) : (
      <>
        {out.length > 0 && (
          <span>
            제외 <i className="num">{out.join(" ")}</i>
          </span>
        )}
        {maybe.length > 0 && (
          <span>
            후보 <i className="num">{maybe.join(" ")}</i>
          </span>
        )}
      </>
    );

  return (
    <div className="screen desk inkworld noteplay" data-ux="c" data-type="code" data-phase={session.phase} data-note={mode} data-testid="play-screen">
      <DeskWood />
      <PlayBar puzzle={puzzle} session={session} variant="case" replay={replay} onExit={onExit} />

      {/* 수사 수첩: 책상 위에 놓인 물건. 표지를 누르면 접히고 펴진다. */}
      <section className="notebook" data-mode={mode === "closed" ? "closed" : "peek"} aria-label="수사 수첩">
        <button
          type="button"
          className="notebook__cover"
          aria-expanded={mode !== "closed"}
          onClick={() => setMode(mode === "closed" ? "peek" : "closed")}
          data-testid="note-toggle"
        >
          <span className="notebook__rings" aria-hidden="true" />
          <span className="notebook__name">수사 수첩</span>
          <span className="notebook__sum">
            기록 {rules.clues.length}
            {flags.length > 0 && ` · 중요 ${flags.length}`}
            {marks > 0 && ` · 메모 ${marks}`}
            {session.openedHints.length > 0 && ` · 지원 ${session.openedHints.length}`}
          </span>
          <span className="notebook__do">{mode === "closed" ? "펼치기" : "접기"}</span>
        </button>

        {mode !== "closed" && (
          <div className="notebook__peek" data-testid="note-peek">
            <p className="notebook__rule">{story.rule}</p>
            {flagged.length > 0 ? (
              // 중요 표시한 기록은 글과 함께 보여 준다
              <ol className="clues__list notebook__flagged" aria-label="중요 표시한 기록">
                {flagged.map(({ clue, i }) => (
                  <li className="clue" key={i}>
                    <span className="clue__digits num" aria-label={`입력 ${clue.guess.join("")}`}>
                      {clue.guess.map((digit, j) => (
                        <span className="clue__digit" key={j} data-memo={input.memo[String(digit)] ?? "none"} aria-hidden="true">
                          {digit}
                        </span>
                      ))}
                    </span>
                    <span className="clue__pegs" aria-hidden="true">
                      {Array.from({ length: rules.length }, (_, k) => (
                        <i key={k} className="peg" data-kind={k < clue.inPlace ? "place" : k < clue.match ? "digit" : "none"} />
                      ))}
                    </span>
                    <span className="clue__text">{clueText(clue)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <ClueStrip puzzle={puzzle} memo={input.memo} />
            )}
            <div className="notebook__foot">
              <p className="notebook__memo" data-testid="note-memo">
                {memoLine}
              </p>
              <button type="button" className="notebook__more" onClick={() => setMode("full")} data-testid="note-full">
                전체 보기
              </button>
            </div>
          </div>
        )}
      </section>

      <div className="noteplay__stage lockstage">
        <CodeLock puzzle={puzzle} input={input} locked={session.locked} verdict={session.verdict} board={board} />
      </div>

      <PlayNotice puzzle={puzzle} session={session} />
      <PlayFoot puzzle={puzzle} session={session} />

      {/* 전체 보기: 수첩이 화면을 덮는다. 아래의 자물쇠는 그대로 남아 있어 닫으면 돌리던 숫자 그대로다. */}
      {full && session.phase === "playing" && (
        <div className="notefull" role="dialog" aria-modal="true" aria-label="수사 수첩 전체 보기" data-testid="note-page">
          <header className="notefull__head">
            <span className="notebook__rings" aria-hidden="true" />
            <h2 className="notefull__title">수사 수첩</h2>
            <button type="button" className="notefull__close" onClick={() => setMode("peek")} data-testid="note-close">
              접기
            </button>
          </header>
          <div className="notefull__page">
            <section className="notefull__sec">
              <h3>사건</h3>
              <p className="notefull__case">{puzzle.title}</p>
              <p>{puzzle.description}</p>
            </section>

            <section className="notefull__sec">
              <h3>
                시도 기록 <ClueLegend />
              </h3>
              <ol className="clues__list notefull__clues">
                {rules.clues.map((clue, i) => {
                  const on = flags.includes(i);
                  return (
                    <li className="clue" key={i} data-flag={on}>
                      <span className="clue__digits num" aria-label={`입력 ${clue.guess.join("")}`}>
                        {clue.guess.map((digit, j) => (
                          <span className="clue__digit" key={j} data-memo={input.memo[String(digit)] ?? "none"} aria-hidden="true">
                            {digit}
                          </span>
                        ))}
                      </span>
                      <span className="clue__pegs" aria-hidden="true">
                        {Array.from({ length: rules.length }, (_, k) => (
                          <i key={k} className="peg" data-kind={k < clue.inPlace ? "place" : k < clue.match ? "digit" : "none"} />
                        ))}
                      </span>
                      <span className="clue__text">{clueText(clue)}</span>
                      <button
                        type="button"
                        className="notefull__flag"
                        aria-pressed={on}
                        aria-label={`${clue.guess.join("")} 기록을 중요로 표시`}
                        onClick={() => toggleFlag(i)}
                        data-testid={`flag-${i}`}
                      >
                        중요
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>

            <section className="notefull__sec">
              <h3>숫자 메모</h3>
              <MemoPad puzzle={puzzle} memo={input.memo} locked={session.locked} onCycle={board.cycleMemo} head={false} />
            </section>

            <section className="notefull__sec">
              <h3>수사 지원</h3>
              {session.openedHints.length === 0 ? (
                <p>받은 수사 지원이 없다.</p>
              ) : (
                session.openedHints.map((hint, i) => (
                  <p className="notefull__hint" key={i} data-testid={`brief-hint-${i + 1}`}>
                    <b>{i + 1}</b>
                    <span>{hint.text}</span>
                  </p>
                ))
              )}
            </section>
          </div>
          <footer className="notefull__foot">
            <button type="button" className="inkbtn inkbtn--wine inkbtn--block" onClick={() => setMode("peek")} data-testid="note-back">
              금고로 돌아가기
            </button>
          </footer>
        </div>
      )}

      {/* 사건을 여는 자막 화면 대신 자료실의 도입 장면을 쓴다 */}
      <PlayOverlays puzzle={puzzle} session={session} variant="case" replay={replay} cine={false} />
      {intro && <VaultIntro title={puzzle.title} text={story.intro} onDone={() => setIntro(false)} />}
    </div>
  );
}
