import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { playSound } from "../../app/sound";
import { gameStore, useGame } from "../../app/store";
import { Sprite } from "../../art/pixel";
import { CreditTag } from "../../components/CreditReward";
import { canAfford, hintCost } from "../../engine/creditEngine";
import { chapterCleared, differencesOf, getChapter, heldEvidence, hintsFor, sceneReachable } from "../engine/storyEngine";
import type { ChapterProgress, Evidence, StoryCase, StoryChapter } from "../engine/storyTypes";

/** 장면 화면이 받는 것 */
export interface SceneProps {
  c: StoryCase;
  ch: StoryChapter;
  p: ChapterProgress;
  /** 다른 장면으로 간다 */
  go: (id: string) => void;
  onExit: () => void;
  /** 뒤로 단추가 가는 곳의 이름 (화면 낭독기). 비우면 학원 홀 */
  exitLabel?: string;
}

/** 다음 장면으로 가는 주 단추의 글: 다음이 최종 추론이면 "결론 내리기", 아니면 그 장면의 이름 */
export function nextLabel(ch: StoryChapter, sceneId: string): string {
  const next = ch.scenes[ch.scenes.findIndex((s) => s.id === sceneId) + 1];
  if (!next) return "끝 장면 보기";
  return next.kind === "deduce" ? "결론 내리기" : `다음 · ${next.title}`;
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

/** 화면 아래에서 올라오는 창 (수사 노트, 수사 지원, 증거 기록) */
export function Sheet({ title, side, onClose, children, testId }: { title: string; side?: ReactNode; onClose: () => void; children: ReactNode; testId: string }) {
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

/** 수사 노트: 이 장에서 얻은 증거, 확정한 사실, 조사하며 적은 것, 그리고 앞 장에서 넘어온 증거. 어느 장면에서든 다시 펼쳐 본다. */
export function InvestigationNotebook({ c, ch, p, onClose }: { c: StoryCase; ch: StoryChapter; p: ChapterProgress; onClose: () => void }) {
  const game = useGame();
  const [openPrev, setOpenPrev] = useState<string | null>(null);
  const evidence = ch.evidence.filter((e) => p.evidence.includes(e.id));
  const facts = ch.scenes.flatMap((s) => (s.kind === "link" ? s.facts.filter((f) => p.facts.includes(f.id)) : []));
  // 조사 메모: 방송 화면에서 조사한 곳, 두 판에서 찾아낸 달라진 곳
  const notes = ch.scenes.flatMap((s) => {
    if (s.kind === "timeline") return s.points.filter((point) => p.notes.includes(point.id)).map((point) => ({ id: point.id, text: point.note }));
    if (s.kind === "compare") return differencesOf(s).filter((d) => p.notes.includes(d.key)).map((d) => ({ id: d.key, text: d.field.note }));
    return [];
  });
  // 진술 대조: 기록과 어긋난 진술, 기록이 받친 진술
  const talks = ch.scenes.flatMap((s) =>
    s.kind === "testimony"
      ? s.statements
          .filter((x) => p.exposed.includes(x.id) || p.verified.includes(x.id))
          .map((x) => ({ id: x.id, who: s.people.find((person) => person.id === x.speaker)?.name ?? "", text: x.text, broken: p.exposed.includes(x.id) }))
      : [],
  );
  // 앞 장에서 넘어온 증거 (앞 장을 해결해야 이 장이 열린다)
  const index = c.chapters.findIndex((x) => x.id === ch.id);
  const earlier = c.chapters.slice(0, Math.max(0, index)).filter((prev) => chapterCleared(getChapter(game, c, prev)));
  const empty = evidence.length + facts.length + notes.length + talks.length + earlier.length === 0;
  return (
    <Sheet title="수사 노트" onClose={onClose} testId="notebook">
      {empty && <p className="storysheet__empty">아직 적은 것이 없다. 화면의 곳곳을 눌러 조사하면 여기에 적힌다.</p>}
      {evidence.length > 0 && (
        <section className="storysheet__sec" aria-label="증거">
          <h3 className="storysheet__label">{earlier.length > 0 ? "이 장의 증거" : "증거"} {evidence.length}</h3>
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
      {talks.length > 0 && (
        <section className="storysheet__sec" aria-label="진술 대조">
          <h3 className="storysheet__label">진술 대조 {talks.length}</h3>
          <ul className="storysheet__list">
            {talks.map((t) => (
              <li key={t.id} data-testid={`note-talk-${t.id}`}>
                <b>
                  {t.who} · {t.broken ? "기록과 어긋남" : "기록과 맞음"}
                </b>
                {t.text}
              </li>
            ))}
          </ul>
        </section>
      )}
      {notes.length > 0 && (
        <section className="storysheet__sec" aria-label="조사 메모">
          <h3 className="storysheet__label">조사 메모 {notes.length}</h3>
          <ul className="storysheet__list">
            {notes.map((note) => (
              <li key={note.id} data-testid={`note-${note.id}`}>
                {note.text}
              </li>
            ))}
          </ul>
        </section>
      )}
      {earlier.length > 0 && (
        <section className="storysheet__sec" aria-label="앞 장의 증거">
          <h3 className="storysheet__label">앞 장의 증거 {heldEvidence(game, c, ch).length - evidence.length}</h3>
          {earlier.map((prev) => {
            const open = openPrev === prev.id;
            return (
              <div className="storysheet__fold" key={prev.id}>
                <button type="button" className="storysheet__foldbtn" aria-expanded={open} onClick={() => setOpenPrev(open ? null : prev.id)} data-testid={`notebook-prev-${prev.id}`}>
                  <span>
                    제{prev.no}장 · {prev.title}
                  </span>
                  <span className="num">
                    증거 {prev.evidence.length} {open ? "▲" : "▼"}
                  </span>
                </button>
                {open && prev.evidence.map((e) => <EvidenceCard key={e.id} evidence={e} compact />)}
              </div>
            );
          })}
        </section>
      )}
    </Sheet>
  );
}

const TIER_NAMES = ["접근 방향", "구체적인 추론 도움"];

/** 수사 지원: 문제의 힌트와 같은 값(수사 크레딧)으로 연다. 장면에 따로 있으면 그 장면의 것을, 없으면 장 전체의 것을 보여 준다. */
function StoryHints({ c, ch, p, scene, onClose }: { c: StoryCase; ch: StoryChapter; p: ChapterProgress; scene: string; onClose: () => void }) {
  const game = useGame();
  const { texts, used } = hintsFor(p, ch, scene);
  return (
    <Sheet title="수사 지원" side={<CreditTag credits={game.credits} />} onClose={onClose} testId="story-hints">
      {texts.map((text, tier) => {
        const opened = tier < used;
        const isNext = tier === used;
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
                    if (gameStore.storyHint(c, ch, scene).kind === "opened") playSound("place");
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
export function StoryShell({ c, ch, p, go, onExit, exitLabel = "학원 홀로", current, children, foot, hints = true, className }: ShellProps) {
  const game = useGame();
  const [sheet, setSheet] = useState<"notebook" | "hints" | null>(null);
  const support = hintsFor(p, ch, current);
  const hintsLeft = support.texts.length - support.used;
  const count = heldEvidence(game, c, ch).length + p.facts.length;
  const replaying = p.archive !== null;

  return (
    <div className={["screen desk inkworld story", className].filter(Boolean).join(" ")} data-scene={current} data-chapter={ch.id} data-replay={replaying} data-testid="story-screen">
      <header className="deskbar">
        <button type="button" className="tilebtn" aria-label={exitLabel} onClick={onExit} data-testid="story-back">
          <Sprite name="arrow-left" />
        </button>
        <p className="deskbar__tag leaf">
          <span className="deskbar__type" data-testid="story-title">
            {c.code} · {ch.no}장{replaying ? " · 다시 풀기" : ""}
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

      {sheet === "notebook" && <InvestigationNotebook c={c} ch={ch} p={p} onClose={() => setSheet(null)} />}
      {sheet === "hints" && <StoryHints c={c} ch={ch} p={p} scene={current} onClose={() => setSheet(null)} />}
    </div>
  );
}

/** 증거를 얻었을 때 화면 위에 잠깐 뜨는 창. 누르면 닫힌다. 여러 장이면 카드가 쌓이고, 단추는 늘 아래에 보인다. */
export function EvidenceGain({ evidence, onClose }: { evidence: Evidence[]; onClose: () => void }) {
  useEffect(() => {
    playSound("stamp");
  }, []);
  return (
    <div className="gain" role="dialog" aria-modal="true" aria-label="증거 획득" data-testid="evidence-gain">
      <button type="button" className="gain__veil" aria-label="닫기" onClick={onClose} />
      <div className="gain__box" data-many={evidence.length > 1}>
        <p className="gain__kicker">증거 획득{evidence.length > 1 ? ` ${evidence.length}` : ""}</p>
        <div className="gain__cards">
          {evidence.map((e) => (
            <EvidenceCard key={e.id} evidence={e} fresh={evidence.length === 1} compact={evidence.length > 1} />
          ))}
        </div>
        <button type="button" className="inkbtn inkbtn--wine inkbtn--block" onClick={onClose} data-testid="evidence-gain-ok">
          수사 노트에 넣기
        </button>
      </div>
    </div>
  );
}
