import { useEffect, useState, type CSSProperties } from "react";
import { NEXT_STEP_ACTION, nextStep } from "../app/flow";
import { prefersReducedMotion } from "../app/motion";
import { navigate } from "../app/router";
import { playSound } from "../app/sound";
import { useGame } from "../app/store";
import { FX_ASCII } from "../app/variant";
import { CoinsArt } from "../art/objects";
import { PenMark, Sprite } from "../art/pixel";
import { Portrait } from "../art/portraits";
import { DeskWood } from "../components/DeskWood";
import { useCountUp } from "../components/CreditReward";
import { FxCoin } from "../fx/FxCanvas";
import { Stamp } from "../components/Stamp";
import { getProgress, type SubmitOutcome } from "../engine/progressEngine";
import { allCards, derivationPath } from "../engine/evidence";
import { truthValues } from "../engine/puzzleValidator";
import { pressSeal, sealFace } from "../engine/seal";
import { formatDuration, seoulDateLabel } from "../engine/time";
import type { Puzzle, PuzzleProgress } from "../engine/types";
import { LockOpen } from "../games/CodeBreaker/CodeBreaker";
import { josa } from "../games/logic";
import { DotGrid, gridWords } from "../games/SealMatch/SealMatch";

/** 결과 화면에서 돌아갈 곳: 단추의 글자(둘이 나란할 때의 짧은 것, 혼자일 때의 것)와 가는 길 */
export interface ResultBack {
  short: string;
  label: string;
  go: () => void;
}

const HOME_BACK: ResultBack = { short: "학원 홀", label: "학원 홀로", go: () => navigate({ name: "home" }, { replace: true }) };

interface Props {
  puzzle: Puzzle;
  /** 방금 제출한 결과. null 이면 예전에 해결한 기록을 보는 중이다. */
  outcome: SubmitOutcome | null;
  onReplay?: () => void;
  /** 돌아갈 곳. 없으면 학원 홀 */
  back?: ResultBack;
}

/** 인장이 찍힌 뒤에 크레딧이 올라간다 */
const STAMP_DELAY_MS = 460;
const REWARD_DELAY_MS = 900;

/**
 * 판정 문구가 한 글자씩 찍힌다(90년대 어드벤처 게임의 대사 출력).
 * 화면을 읽는 프로그램에는 처음부터 전체 문장을 준다. 단추는 기다리지 않고 바로 눌린다.
 */
export function Typed({ text, startMs }: { text: string; startMs: number }) {
  const [count, setCount] = useState(() => (prefersReducedMotion() ? text.length : 0));

  useEffect(() => {
    if (count >= text.length) return;
    const id = window.setTimeout(() => setCount((c) => c + 1), count === 0 ? startMs : 26);
    return () => window.clearTimeout(id);
  }, [count, text.length, startMs]);

  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {text.slice(0, count)}
        {count < text.length && <i className="pxcaret" />}
      </span>
    </>
  );
}

export function Reward({ amount, balance, delayMs = REWARD_DELAY_MS }: { amount: number; balance: number; delayMs?: number }) {
  const shown = useCountUp(amount, 0, 720, delayMs);
  const total = useCountUp(balance, balance - amount, 720, delayMs);
  return (
    <div className="graded__reward" data-testid="reward" data-fx={FX_ASCII ? "coin" : undefined}>
      <Sprite name="sparkle" className="pxsparkle" />
      <Sprite name="sparkle" className="pxsparkle" />
      {/* 보상 애니메이션 실험(?fx=ascii): 동전 더미 대신 크레딧 한 닢이 숫자가 오르기 시작할 때 한 바퀴 돌고 멈춘다 */}
      {FX_ASCII ? <FxCoin className="graded__coins" delayMs={delayMs} /> : <CoinsArt className="graded__coins" />}
      <p className="graded__amount num">
        <span className="sr-only">획득한 수사 크레딧 </span>+{shown}
      </p>
      <p className="graded__balance num">보유 {total.toLocaleString("ko-KR")}</p>
    </div>
  );
}

/** 채점표: 풀이 시간 · 제출 횟수 · 힌트 */
export function GradedFacts({ progress }: { progress: PuzzleProgress }) {
  const hints = progress.solvedHints ?? progress.hintsUsed;
  return (
    <dl className="graded__facts">
      <div>
        <dt>풀이 시간</dt>
        <dd className="hand num">{formatDuration(progress.solvedElapsedMs ?? progress.elapsedMs)}</dd>
      </div>
      <div>
        <dt>제출 횟수</dt>
        <dd className="hand num">{progress.solvedAttempts ?? progress.attempts}회</dd>
      </div>
      <div>
        <dt>힌트</dt>
        <dd className="hand" data-testid="record-hints">
          {hints === 0 ? "미사용" : `${hints}단계 사용`}
        </dd>
      </div>
    </dl>
  );
}

/** 풀이 과정: 접어 두었다가 펼쳐 본다 */
export function GradedExplain({ puzzle }: { puzzle: Puzzle }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="graded__explain">
      <button
        type="button"
        className="graded__toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        data-testid="explain-toggle"
      >
        풀이 과정 {open ? "접기" : "보기"}
        <Sprite name={open ? "chevron-up" : "chevron-down"} />
      </button>
      {open && (
        <ol className="graded__steps" data-testid="explain-steps">
          {puzzle.explanation.map((item, i) => (
            <li key={i}>
              <span className="graded__no hand">{i + 1}</span>
              <p>{item.text}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** 해결한 뒤에만 보여 주는 정답. 풀던 물건이 정답을 드러낸 채 책상에 남는다. */
function Solution({ puzzle }: { puzzle: Puzzle }) {
  if (puzzle.type === "code") return <LockOpen digits={puzzle.solution} />;

  if (puzzle.type === "truth") {
    const culprit = puzzle.rules.people.find((p) => p.id === puzzle.solution)!;
    const values = truthValues(puzzle.rules, puzzle.solution);
    return (
      <section className="solution leaf" data-testid="solution">
        <h2 className="solution__label hand">
          {puzzle.rules.item ?? "답안지"}
          {josa(puzzle.rules.item ?? "답안지", "을", "를")} 숨긴 사람
        </h2>
        <p className="solution__person">
          <span className="solution__photo">
            <Portrait person={culprit} />
            <PenMark kind="circle" />
          </span>
          {culprit.name}
        </p>
        <ul className="solution__statements">
          {puzzle.rules.statements.map((statement, i) => {
            const speaker = puzzle.rules.people.find((p) => p.id === statement.speaker)!;
            return (
              <li key={statement.speaker}>
                <span className="solution__speaker">{speaker.name}</span>
                <span className="solution__quote">“{statement.text}”</span>
                <span className="solution__truth" data-true={values[i]}>
                  {values[i] ? "참" : "거짓"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  if (puzzle.type === "evidence") {
    const cards = allCards(puzzle.rules);
    const label = (id: string) => cards.find((card) => card.id === id)?.label ?? id;
    const statement = cards.find((card) => card.id === puzzle.solution.statement)!;
    const against = cards.find((card) => card.id === puzzle.solution.against)!;
    const speaker = puzzle.rules.people.find((p) => p.id === statement.speaker)!;
    const path = derivationPath(puzzle.rules, against.id);
    return (
      <section className="solution leaf solution--evidence" data-testid="solution">
        <h2 className="solution__label hand">기록과 맞지 않는 진술</h2>
        <p className="solution__person">
          <span className="solution__photo">
            <Portrait person={speaker} />
            <PenMark kind="cross" />
          </span>
          {speaker.name}
        </p>
        <p className="solution__lie">“{statement.text}”</p>
        <h2 className="solution__label hand">이 진술을 깬 증거</h2>
        {path.length === 0 ? (
          <p className="solution__fact">{against.text}</p>
        ) : (
          <ol className="solution__chain">
            {path.map((step) => (
              <li key={step.card.id}>
                <span className="solution__from">
                  {label(step.from[0])} + {label(step.from[1])}
                </span>
                <span className="solution__fact">{step.card.text}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    );
  }

  if (puzzle.type === "spatial") {
    const stamp = puzzle.rules.stamps.find((s) => s.id === puzzle.solution.stamp)!;
    const { turn } = puzzle.solution;
    const cell = puzzle.rules.size >= 6 ? 10 : 12;
    return (
      <section className="solution leaf solution--seal" data-testid="solution">
        <h2 className="solution__label hand">자국을 낸 도장</h2>
        <p className="solution__stamp">
          {stamp.name} · {["돌리지 않고", "한 번 돌려", "두 번 돌려", "세 번 돌려"][turn]} 찍음
        </p>
        <div className="solution__seals">
          <figure>
            <DotGrid grid={sealFace(stamp.face, turn)} cell={cell} label={`도장 면. ${gridWords(sealFace(stamp.face, turn))}`} />
            <figcaption>도장 면</figcaption>
          </figure>
          <span className="solution__arrow" aria-hidden="true">
            찍으면
          </span>
          <figure>
            <DotGrid grid={pressSeal(stamp.face, turn)} cell={cell} label={`찍힌 자국. ${gridWords(pressSeal(stamp.face, turn))}`} />
            <figcaption>찍힌 자국</figcaption>
          </figure>
        </div>
      </section>
    );
  }

  return (
    <section className="solution leaf" data-testid="solution">
      <h2 className="solution__label hand">{puzzle.rules.title ?? "발표 순서"}</h2>
      <ol className="solution__order" style={{ "--cols": puzzle.solution.length } as CSSProperties}>
        {puzzle.solution.map((id, i) => {
          const person = puzzle.rules.people.find((p) => p.id === id)!;
          return (
            <li key={id}>
              <span className="solution__time num">{puzzle.rules.slots[i].label}</span>
              <Portrait person={person} />
              <span className="solution__name">{person.name}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * 채점된 시험지. 책상은 그대로이고, 풀던 시험지에 인장이 찍힌다.
 * 풀린 자물쇠는 풀이 때와 같은 자리에서 암호를 보여 준다.
 */
export function DeskResult({ puzzle, outcome, onReplay, back = HOME_BACK }: Props) {
  const game = useGame();
  const progress = getProgress(game, puzzle.id);
  const fresh = outcome !== null;
  const rewarded = fresh && outcome.reward > 0;
  const step = nextStep(game);
  const next = step === "none" ? null : NEXT_STEP_ACTION[step];

  useEffect(() => {
    if (!fresh) return;
    const id = window.setTimeout(() => playSound("stamp"), STAMP_DELAY_MS + 120);
    return () => window.clearTimeout(id);
  }, [fresh]);

  const goHome = back.go;

  const lead = !fresh
    ? `${progress.solvedAt ? seoulDateLabel(new Date(progress.solvedAt)) : ""}에 해결한 수사 과제입니다.`
    : rewarded
      ? "추론이 정확했습니다. 수사 과제를 해결했습니다."
      : "다시 풀어도 정확합니다. 보상은 처음 해결했을 때 한 번만 지급됩니다.";

  return (
    <div className="screen desk desk--result inkworld" data-type={puzzle.type} data-testid="result-screen" data-fresh={fresh}>
      <DeskWood />

      <div className="screen__scroll desk__scroll">
        <article className="exampaper graded leaf" style={{ viewTransitionName: "exam-sheet" }}>
          <Stamp
            className="graded__stamp"
            label={fresh ? "추론 성공" : "조사 완료"}
            size={112}
            animate={fresh}
            delayMs={STAMP_DELAY_MS}
          />

          <h1 className="exampaper__title">{puzzle.title}</h1>
          <p className="graded__lead" data-testid="result-lead">
            {fresh ? <Typed text={lead} startMs={STAMP_DELAY_MS + 200} /> : lead}
          </p>

          {puzzle.outro && (
            <p className="graded__outro" data-testid="result-outro">
              {fresh ? <Typed text={puzzle.outro} startMs={STAMP_DELAY_MS + 200 + lead.length * 26 + 300} /> : puzzle.outro}
            </p>
          )}

          <GradedFacts progress={progress} />

          <div className="graded__prize">
            {rewarded ? (
              <Reward amount={outcome.reward} balance={game.credits} />
            ) : (
              <p className="graded__claimed num" data-testid="reward-claimed">
                <CoinsArt count={2} />
                보상 +{puzzle.reward} 수령 완료
              </p>
            )}
            {fresh && outcome.noHint && (
              <p className="graded__nohint hand" data-testid="no-hint">
                힌트 미사용 기록
              </p>
            )}
          </div>

          <GradedExplain puzzle={puzzle} />
        </article>

        <Solution puzzle={puzzle} />

        {onReplay && !fresh && (
          <button type="button" className="desk__replay" onClick={onReplay} data-testid="replay">
            보상 없이 다시 풀어 보기
          </button>
        )}
      </div>

      <footer className="deskfoot">
        {next ? (
          <>
            <button type="button" className="inkbtn deskfoot__hint" onClick={goHome} data-testid="result-home">
              {back.short}
            </button>
            <button
              type="button"
              className="inkbtn inkbtn--wine deskfoot__submit"
              // fresh: 오늘의 추리를 풀다 자정을 넘겼으면 다음 할 일이 같은 주소(#/daily)의 새 문제다
              onClick={() => navigate(next.route, { replace: true, fresh: true })}
              data-testid="result-next"
            >
              {next.label}
            </button>
          </>
        ) : (
          <button type="button" className="inkbtn inkbtn--wine deskfoot__submit" onClick={goHome} data-testid="result-home">
            {back.label}
          </button>
        )}
      </footer>
    </div>
  );
}
