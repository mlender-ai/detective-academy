import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { playSound } from "../../app/sound";
import { gameStore, useGame } from "../../app/store";
import { Sprite } from "../../art/pixel";
import { CreditTag } from "../../components/CreditReward";
import { canAfford, hintCost } from "../../engine/creditEngine";
import { sceneReachable } from "../engine/storyEngine";
import type { ChapterProgress, Evidence, StoryCase, StoryChapter } from "../engine/storyTypes";

/** 장면 화면이 받는 것 */
export interface SceneProps {
  c: StoryCase;
  ch: StoryChapter;
  p: ChapterProgress;
  /** 다른 장면으로 간다 */
  go: (id: string) => void;
  onExit: () => void;
}

/** 증거 한 장: 번호, 이름, 줄마다 이름표와 값 */
export function EvidenceCard({ evidence, fresh = false, compact = false }: { evidence: Evidence; fresh?: boolean; compact?: boolean }) {
  return (
    <article className="evcard" data-fresh={fresh} data-compact={compact} data-testid={`evidence-${evidence.id}`}>
      <h3 className="evcard__head">
        <span className="evcard__no">{evidence.no}</span>
        <span className="evcard__title">{evidence.title}</span>
      </h3>
      <dl className="evcard__lines">
        {evidence.lines.map((line) => (
          <div key={line.label}>
            <dt>{line.label}</dt>
            <dd className="num">{line.value}</dd>
          </div>
        ))}
      </dl>
      {evidence.note && <p className="evcard__note">{evidence.note}</p>}
    </article>
  );
}

/** 화면 아래에서 올라오는 창 (수사 노트, 수사 지원) */
function Sheet({ title, side, onClose, children, testId }: { title: string; side?: ReactNode; onClose: () => void; children: ReactNode; testId: string }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <>
      <div className="sheet-backdrop sheet-backdrop--paper" onClick={onClose} />
      <section className="sheet hints hints--paper storysheet" role="dialog" aria-modal="true" aria-label={title} data-testid={testId}>
        <div className="sheet__head">
          <h2 className="sheet__title">{title}</h2>
          {side}
          <button type="button" className="iconbtn" aria-label={`${title} 닫기`} onClick={onClose} ref={closeRef} data-testid={`${testId}-close`}>
            <span className="pxclose">닫기</span>
          </button>
        </div>
        <div className="sheet__body">{children}</div>
      </section>
    </>
  );
}

/** 수사 노트: 지금까지 얻은 증거, 확정한 사실, 조사하며 적은 것. 어느 장면에서든 다시 펼쳐 본다. */
export function InvestigationNotebook({ ch, p, onClose }: { ch: StoryChapter; p: ChapterProgress; onClose: () => void }) {
  const evidence = ch.evidence.filter((e) => p.evidence.includes(e.id));
  const facts = ch.scenes.flatMap((s) => (s.kind === "link" ? s.facts.filter((f) => p.facts.includes(f.id)) : []));
  const notes = ch.scenes.flatMap((s) => (s.kind === "timeline" ? s.points.filter((point) => p.notes.includes(point.id)) : []));
  const empty = evidence.length + facts.length + notes.length === 0;
  return (
    <Sheet title="수사 노트" onClose={onClose} testId="notebook">
      {empty && <p className="storysheet__empty">아직 적은 것이 없다. 화면의 곳곳을 눌러 조사하면 여기에 적힌다.</p>}
      {evidence.length > 0 && (
        <section className="storysheet__sec" aria-label="증거">
          <h3 className="storysheet__label">증거 {evidence.length}</h3>
          {evidence.map((e) => (
            <EvidenceCard key={e.id} evidence={e} compact />
          ))}
        </section>
      )}
      {facts.length > 0 && (
        <section className="storysheet__sec" aria-label="확정한 사실">
          <h3 className="storysheet__label">확정한 사실 {facts.length}</h3>
          <ul className="storysheet__list">
            {facts.map((f) => (
              <li key={f.id} data-testid={`note-fact-${f.id}`}>
                <b>{f.no}</b>
                {f.text}
              </li>
            ))}
          </ul>
        </section>
      )}
      {notes.length > 0 && (
        <section className="storysheet__sec" aria-label="조사 메모">
          <h3 className="storysheet__label">조사 메모 {notes.length}</h3>
          <ul className="storysheet__list">
            {notes.map((point) => (
              <li key={point.id} data-testid={`note-${point.id}`}>
                {point.note}
              </li>
            ))}
          </ul>
        </section>
      )}
    </Sheet>
  );
}

const TIER_NAMES = ["접근 방향", "구체적인 추론 도움"];

/** 수사 지원: 문제의 힌트와 같은 값(수사 크레딧)으로 연다 */
function StoryHints({ c, ch, p, onClose }: { c: StoryCase; ch: StoryChapter; p: ChapterProgress; onClose: () => void }) {
  const game = useGame();
  return (
    <Sheet title="수사 지원" side={<CreditTag credits={game.credits} />} onClose={onClose} testId="story-hints">
      {ch.hints.map((text, tier) => {
        const opened = tier < p.hintsUsed;
        const isNext = tier === p.hintsUsed;
        const cost = hintCost(tier) ?? 0;
        const affordable = canAfford(game.credits, cost);
        return (
          <article className="hint" key={tier} data-opened={opened} data-testid={`story-hint-${tier + 1}`}>
            <h3 className="hint__name">
              <span className="hint__tier num">{tier + 1}</span>
              {TIER_NAMES[tier] ?? `힌트 ${tier + 1}`}
            </h3>
            {opened ? (
              <p className="hint__text">{text}</p>
            ) : (
              <>
                <button
                  type="button"
                  className="inkbtn inkbtn--sm hint__open"
                  disabled={!isNext || !affordable}
                  onClick={() => {
                    if (gameStore.storyHint(c, ch).kind === "opened") playSound("place");
                  }}
                  data-testid={`story-hint-${tier + 1}-open`}
                >
                  <span className="num">{isNext ? `${cost} 크레딧으로 열기` : "앞 단계를 먼저 여세요"}</span>
                </button>
                {isNext && !affordable && (
                  <p className="hint__short" role="status" data-testid="story-hint-short">
                    크레딧이 {cost - game.credits} 모자랍니다. 수사 지원 없이도 사건은 끝까지 풀 수 있습니다.
                  </p>
                )}
              </>
            )}
          </article>
        );
      })}
      <p className="hints__note">수사 지원은 결론을 대신 내려 주지 않습니다. 어디를 볼지만 짚어 줍니다.</p>
    </Sheet>
  );
}

/** 장면 안에서 수사 노트를 펼치는 길 (틀이 내준다) */
const ShellContext = createContext<{ openNotebook: () => void }>({ openNotebook: () => {} });

/** 장면 안에 두는 "수사 노트 펼치기" 단추 */
export function NotebookLink({ children, testId }: { children: ReactNode; testId?: string }) {
  const { openNotebook } = useContext(ShellContext);
  return (
    <button type="button" className="inkbtn inkbtn--sm" onClick={openNotebook} data-testid={testId}>
      {children}
    </button>
  );
}

interface ShellProps extends SceneProps {
  /** 지금 있는 장면의 id */
  current: string;
  children: ReactNode;
  /** 아래 단추 줄의 주 단추(들) */
  foot: ReactNode;
  /** 수사 지원 단추를 둘 것인가 (조사만 하는 장면에는 두지 않는다) */
  hints?: boolean;
  className?: string;
}

/**
 * 사건 화면의 틀: 위 막대(뒤로 · 사건과 장 · 수사 노트) → 장면 이동 줄 → 장면 → 아래 단추 줄.
 * 장면 이동 줄에서 이미 가 본 장면으로 곧바로 돌아간다.
 */
export function StoryShell({ c, ch, p, go, onExit, current, children, foot, hints = true, className }: ShellProps) {
  const [sheet, setSheet] = useState<"notebook" | "hints" | null>(null);
  const hintsLeft = ch.hints.length - p.hintsUsed;
  const count = p.evidence.length + p.facts.length;

  return (
    <div className={["screen desk inkworld story", className].filter(Boolean).join(" ")} data-scene={current} data-testid="story-screen">
      <header className="deskbar">
        <button type="button" className="tilebtn" aria-label="학원 복도로" onClick={onExit} data-testid="story-back">
          <Sprite name="arrow-left" />
        </button>
        <p className="deskbar__tag leaf">
          <span className="deskbar__type" data-testid="story-title">
            {c.code} · {ch.no}장
          </span>
        </p>
        <button type="button" className="notebtn leaf" onClick={() => setSheet("notebook")} data-testid="notebook-open" aria-label={`수사 노트, 기록 ${count}개`}>
          수사 노트
          <span className="notebtn__count num">{count}</span>
        </button>
      </header>

      <nav className="steps" aria-label="장면 이동">
        {ch.scenes.map((scene, i) => {
          const open = sceneReachable(p, ch, scene.id);
          return (
            <button
              key={scene.id}
              type="button"
              className="steps__chip"
              aria-current={scene.id === current ? "step" : undefined}
              disabled={!open}
              data-testid={`step-${scene.id}`}
              onClick={() => scene.id !== current && go(scene.id)}
            >
              <span className="num">{i + 1}</span>
              {scene.step}
            </button>
          );
        })}
      </nav>

      <ShellContext.Provider value={{ openNotebook: () => setSheet("notebook") }}>{children}</ShellContext.Provider>

      <footer className="deskfoot">
        {hints && (
          <button type="button" className="inkbtn deskfoot__hint" onClick={() => setSheet("hints")} data-testid="story-hint-button">
            수사 지원
            <span className="deskfoot__count num" aria-label={`남은 힌트 ${hintsLeft}개`}>
              {hintsLeft}
            </span>
          </button>
        )}
        {foot}
      </footer>

      {sheet === "notebook" && <InvestigationNotebook ch={ch} p={p} onClose={() => setSheet(null)} />}
      {sheet === "hints" && <StoryHints c={c} ch={ch} p={p} onClose={() => setSheet(null)} />}
    </div>
  );
}

/** 증거를 얻었을 때 화면 위에 잠깐 뜨는 창. 누르면 닫힌다. */
export function EvidenceGain({ evidence, onClose }: { evidence: Evidence[]; onClose: () => void }) {
  useEffect(() => {
    playSound("stamp");
  }, []);
  return (
    <div className="gain" role="dialog" aria-modal="true" aria-label="증거 획득" data-testid="evidence-gain">
      <button type="button" className="gain__veil" aria-label="닫기" onClick={onClose} />
      <div className="gain__box">
        <p className="gain__kicker">증거 획득</p>
        {evidence.map((e) => (
          <EvidenceCard key={e.id} evidence={e} fresh />
        ))}
        <button type="button" className="inkbtn inkbtn--wine inkbtn--block" onClick={onClose} data-testid="evidence-gain-ok">
          수사 노트에 넣기
        </button>
      </div>
    </div>
  );
}
