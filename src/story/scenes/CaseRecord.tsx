import { useState } from "react";
import { playSound } from "../../app/sound";
import { gameStore, useGame } from "../../app/store";
import { Sprite } from "../../art/pixel";
import { DeskWood } from "../../components/DeskWood";
import { Stamp } from "../../components/Stamp";
import { playableChapters } from "../cases";
import { EvidenceCard, Sheet } from "../components/StoryParts";
import { caseEvidence, caseSolved, chapterCleared, chapterStatus, getChapter, nextChapter, recordOf } from "../engine/storyEngine";
import type { StoryCase, StoryChapter } from "../engine/storyTypes";

interface Props {
  c: StoryCase;
  /** 그 장을 연다 (수사 시작 · 이어 하기 · 끝 장면 · 다시 풀기) */
  onOpen: (chapterId: string) => void;
  onExit: () => void;
}

const STATUS_TEXT = { locked: "잠김", new: "새 장", open: "수사 중", cleared: "해결" } as const;

/**
 * 사건 기록. 사건의 장들이 차례로 놓여 있다: 잠긴 장(점선, 누를 수 없다) · 새 장 · 수사 중 · 해결.
 * 풀 차례의 장은 아래의 큰 단추로 이어 가고, 해결한 장은 펼쳐서 확인된 것과 아직 모르는 것을 다시 읽고,
 * 끝 장면을 다시 보거나 처음부터 다시 푼다(보상은 처음 한 번뿐이다). 모은 증거는 증거 기록에서 다시 연다.
 */
export function CaseRecord({ c, onOpen, onExit }: Props) {
  const game = useGame();
  const chapters = playableChapters(c);
  const cleared = chapters.filter((ch) => chapterCleared(getChapter(game, c, ch)));
  // 처음에는 네 장이 한눈에 보이게 모두 접어 둔다. 해결한 장을 누르면 그 장의 기록이 펼쳐진다
  const [open, setOpen] = useState<string | null>(null);
  const [explain, setExplain] = useState(false);
  const [sheet, setSheet] = useState(false);
  const next = nextChapter(game, c);
  const solved = caseSolved(game, c.id);
  const evidence = caseEvidence(game, c);
  const evidenceCount = evidence.reduce((n, group) => n + group.evidence.length, 0);

  const enter = (ch: StoryChapter) => {
    playSound("place");
    onOpen(ch.id);
  };

  return (
    <div className="screen desk inkworld story caserecord" data-solved={solved} data-testid="story-record">
      <DeskWood />
      <header className="deskbar">
        <button type="button" className="tilebtn" aria-label="학원 홀로" onClick={onExit} data-testid="story-back">
          <Sprite name="arrow-left" />
        </button>
        <p className="deskbar__tag leaf">
          <span className="deskbar__type">{c.code} · 사건 기록</span>
        </p>
      </header>

      <div className="story__scroll">
        <section className="record leaf">
          <div className="record__head">
            <div>
              <p className="record__case">
                {c.code} · 전 {c.plannedChapters}장
              </p>
              <h1 className="record__chapter">{c.title}</h1>
              <p className="record__progress" data-testid="record-progress" aria-label={`${chapters.length}장 가운데 ${cleared.length}장 해결`}>
                {chapters.map((ch) => (
                  <i key={ch.id} data-on={cleared.includes(ch)} />
                ))}
                <span className="num">
                  {solved ? "사건 해결" : `해결 ${cleared.length}/${chapters.length}`}
                </span>
              </p>
            </div>
            {solved && <Stamp label="사건 해결" size={72} />}
          </div>

          <ol className="chapters">
            {chapters.map((ch) => {
              const status = chapterStatus(game, c, ch);
              const p = getChapter(game, c, ch);
              const replaying = p.archive !== null;
              const label = replaying ? "해결 · 다시 푸는 중" : STATUS_TEXT[status];
              const head = (
                <>
                  <span className="chapters__no num">제{ch.no}장</span>
                  <span className="chapters__title">{ch.title}</span>
                  <span className="chapters__status" data-testid={`chapter-${ch.id}-status`}>
                    {label}
                  </span>
                </>
              );
              if (status === "locked") {
                return (
                  <li key={ch.id} className="chapters__row" data-status="locked" data-testid={`chapter-${ch.id}`} aria-disabled="true">
                    <div className="chapters__head">{head}</div>
                    <p className="chapters__hint">앞 장을 해결하면 열린다</p>
                  </li>
                );
              }
              if (status !== "cleared") {
                // 풀 차례의 장: 줄을 눌러도 들어간다
                return (
                  <li key={ch.id} className="chapters__row" data-status={status}>
                    <button type="button" className="chapters__head" onClick={() => enter(ch)} data-testid={`chapter-${ch.id}`} data-status={status}>
                      {head}
                    </button>
                    <p className="chapters__hint num">
                      예상 {ch.minutes} · 보상 +{ch.reward}
                    </p>
                  </li>
                );
              }
              const record = recordOf(p);
              const deduce = ch.scenes.find((s) => s.kind === "deduce");
              const conclusion = deduce?.kind === "deduce" ? deduce.choices.find((x) => x.id === record.deduction.choice)?.text : null;
              const facts = ch.scenes.flatMap((s) => (s.kind === "link" ? s.facts.filter((f) => record.facts.includes(f.id)) : []));
              const shown = open === ch.id;
              return (
                <li key={ch.id} className="chapters__row" data-status="cleared" data-open={shown}>
                  <button
                    type="button"
                    className="chapters__head"
                    aria-expanded={shown}
                    onClick={() => {
                      playSound("tick");
                      setOpen(shown ? null : ch.id);
                      setExplain(false);
                    }}
                    data-testid={`chapter-${ch.id}`}
                    data-status="cleared"
                  >
                    {head}
                  </button>
                  {shown && (
                    <div className="chapters__body" data-testid={`chapter-${ch.id}-body`}>
                      <h2 className="record__label">확인된 것</h2>
                      <p className="record__conclusion" data-testid="record-conclusion">
                        {conclusion}
                      </p>
                      {facts.length > 0 && (
                        <ul className="record__facts">
                          {facts.map((f) => (
                            <li key={f.id}>
                              <b>{f.no}</b>
                              {f.text}
                            </li>
                          ))}
                        </ul>
                      )}
                      {ch.explanation && (
                        <>
                          <button type="button" className="record__more" aria-expanded={explain} onClick={() => setExplain(!explain)} data-testid="record-explain">
                            해설 {explain ? "접기 ▲" : "펼치기 ▼"}
                          </button>
                          {explain && (
                            <ol className="record__steps" data-testid="record-explanation">
                              {ch.explanation.map((line) => (
                                <li key={line.text}>{line.text}</li>
                              ))}
                            </ol>
                          )}
                        </>
                      )}
                      <h2 className="record__label">아직 모르는 것</h2>
                      <ul className="record__open" data-testid="record-open">
                        {ch.ending.open.map((q) => (
                          <li key={q.claim}>{q.text}</li>
                        ))}
                      </ul>
                      <div className="chapters__acts">
                        <button
                          type="button"
                          className="inkbtn inkbtn--sm"
                          onClick={() => {
                            gameStore.storyGo(c, ch, "ending");
                            onOpen(ch.id);
                          }}
                          disabled={replaying}
                          data-testid="record-ending"
                        >
                          끝 장면
                        </button>
                        {replaying ? (
                          <>
                            <button type="button" className="inkbtn inkbtn--sm" onClick={() => gameStore.storyCancelReplay(c, ch)} data-testid="record-cancel">
                              그만두기
                            </button>
                            <button type="button" className="inkbtn inkbtn--sm" onClick={() => enter(ch)} data-testid="record-resume">
                              이어서 풀기
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="inkbtn inkbtn--sm"
                            onClick={() => {
                              gameStore.storyRestart(c, ch);
                              enter(ch);
                            }}
                            data-testid="record-replay"
                          >
                            다시 풀기
                          </button>
                        )}
                      </div>
                      <p className="chapters__hint" data-testid="record-replay-note">
                        다시 풀어도 보상은 다시 받지 않는다. 처음의 기록은 그대로 남는다.
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      <footer className="deskfoot">
        <button type="button" className="inkbtn" onClick={() => setSheet(true)} data-testid="record-evidence">
          증거 기록
          <span className="deskfoot__count num">{evidenceCount}</span>
        </button>
        {next ? (
          <button type="button" className="inkbtn inkbtn--wine deskfoot__submit" data-long="true" onClick={() => enter(next)} data-testid="record-continue">
            제{next.no}장 {getChapter(game, c, next).status === "new" ? "수사 시작" : "이어서 수사"}
          </button>
        ) : (
          <button type="button" className="inkbtn inkbtn--wine deskfoot__submit" onClick={onExit} data-testid="record-home">
            학원 홀로
          </button>
        )}
      </footer>

      {sheet && (
        <Sheet title="증거 기록" onClose={() => setSheet(false)} testId="case-evidence">
          {evidenceCount === 0 && <p className="storysheet__empty">아직 모은 증거가 없다.</p>}
          {evidence
            .filter((group) => group.evidence.length > 0)
            .map((group) => (
              <section className="storysheet__sec" key={group.chapter.id} aria-label={`제${group.chapter.no}장의 증거`}>
                <h3 className="storysheet__label">
                  제{group.chapter.no}장 · {group.chapter.title} · {group.evidence.length}
                </h3>
                {group.evidence.map((e) => (
                  <EvidenceCard key={e.id} evidence={e} compact />
                ))}
              </section>
            ))}
        </Sheet>
      )}
    </div>
  );
}
