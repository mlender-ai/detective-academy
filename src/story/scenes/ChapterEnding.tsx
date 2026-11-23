import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../../app/motion";
import { playSound } from "../../app/sound";
import { Stamp } from "../../components/Stamp";
import { EndingStill, hasEndingStill } from "../art/endingArt";
import { EvidenceCard } from "../components/StoryParts";
import type { ChapterProgress, StoryCase, StoryChapter } from "../engine/storyTypes";

interface Props {
  c: StoryCase;
  ch: StoryChapter;
  p: ChapterProgress;
  /** 사건 기록으로 */
  onRecord: () => void;
  /** 학원 홀로 */
  onHome: () => void;
  /** 다음 장으로. 마지막 장이면 없다 */
  onNext?: () => void;
}

type Stage = "still" | "lines" | "evidence" | "result";
const ORDER: Stage[] = ["still", "lines", "evidence", "result"];
const TYPE_MS = 44;

/**
 * 장의 끝. 그 장의 그림 한 장면(그림이 한 번 바뀐다) → 끝 글(사건이 끝나는 장은 마지막에 사건 해결이 찍힌다)
 * → 새로 드러난 기록 한 장 → 수사 결과. 화면을 누르면 다음으로 가고, 한 번에 건너뛸 수도 있다.
 * 이미 본 끝 장면을 다시 열면 연출 없이 결과부터 나온다(다시 보려면 결과에서 고른다).
 */
export function ChapterEnding({ c, ch, p, onRecord, onHome, onNext }: Props) {
  const still = prefersReducedMotion();
  // 이미 본 끝 장면을 다시 볼 때는 보상을 "받음"으로 적는다
  const [replay] = useState(p.endingSeen);
  const { next, closing } = ch.ending;
  // 끝 글: 걸개 두 줄, 사건이 끝나는 장은 그 뒤에 사건 해결 한 줄
  const lines = closing ? [...ch.ending.lines, closing] : ch.ending.lines;
  const art = hasEndingStill(c.id, ch.id);
  const [stage, setStage] = useState<Stage>(still || replay ? "result" : art ? "still" : "lines");
  const [after, setAfter] = useState(still || replay);
  const [line, setLine] = useState(0);
  const [count, setCount] = useState(0);
  const evidence = ch.evidence.find((e) => e.id === ch.ending.evidence)!;
  const typed = count >= lines[line].length;
  const at = ORDER.indexOf(stage);
  const sounded = useRef(false);
  const last = !next;

  // 그림: 잠깐 보여 준 뒤 한 번 바뀌고(LIVE 표시가 꺼진다, 제목이 바뀐다, 가면만 남는다), 끝 글로 넘어간다
  useEffect(() => {
    if (stage !== "still") return;
    const swap = window.setTimeout(() => {
      setAfter(true);
      playSound("stamp");
    }, 1500);
    const on = window.setTimeout(() => setStage("lines"), 2900);
    return () => {
      window.clearTimeout(swap);
      window.clearTimeout(on);
    };
  }, [stage]);

  useEffect(() => {
    if (stage !== "lines") return;
    setCount(0);
    const id = window.setInterval(() => setCount((n) => n + 1), TYPE_MS);
    return () => window.clearInterval(id);
  }, [stage, line]);

  useEffect(() => {
    if (stage !== "result" || sounded.current) return;
    sounded.current = true;
    playSound("promote");
  }, [stage]);

  const advance = () => {
    if (stage === "still") {
      setAfter(true);
      setStage("lines");
    } else if (stage === "lines") {
      if (!typed) setCount(lines[line].length);
      else if (line < lines.length - 1) setLine((n) => n + 1);
      else setStage("evidence");
    } else if (stage === "evidence") {
      setStage("result");
    }
  };

  const skip = () => {
    setAfter(true);
    setLine(lines.length - 1);
    setCount(999);
    setStage("result");
  };

  const again = () => {
    sounded.current = false;
    setAfter(false);
    setLine(0);
    setCount(0);
    setStage(art ? "still" : "lines");
  };

  return (
    <div className="screen inkworld story ending" data-stage={stage} data-chapter={ch.id} data-last={last} data-testid="story-ending">
      {stage !== "result" && (
        <button type="button" className="storyintro__skip" onClick={skip} data-testid="ending-skip">
          건너뛰기
        </button>
      )}

      {stage !== "result" ? (
        <button type="button" className="ending__stage" onClick={advance} aria-label="다음" data-testid="ending-next">
          <EndingStill caseId={c.id} chapterId={ch.id} after={after} />

          {at >= 1 && (
            <span className="ending__lines">
              {lines.slice(0, line + 1).map((t, i) => (
                <span className="ending__line" key={i} data-closing={!!closing && i === lines.length - 1}>
                  {i === line ? t.slice(0, count) : t}
                  {i === line && <i className="narr__caret" />}
                </span>
              ))}
            </span>
          )}

          {at >= 2 && (
            <span className="ending__found">
              <span className="ending__foundlabel">새로 드러난 기록</span>
              <EvidenceCard evidence={evidence} fresh />
            </span>
          )}
          <span className="sr-only" aria-live="polite">
            {at >= 1 ? lines[line] : (ch.ending.still ?? "")}
          </span>
        </button>
      ) : (
        <div className="ending__result" data-testid="story-result">
          <p className="ending__case">{c.code}</p>
          <p className="ending__kicker">CHAPTER {String(ch.no).padStart(2, "0")} CLEARED</p>
          <h1 className="ending__title">{ch.title}</h1>
          <Stamp label={closing ? "사건 해결" : "조사 완료"} animate={!still && !replay} />
          <ul className="ending__rows">
            <li>
              <span>수사 기록</span>
              <b className="num" data-testid="result-records">
                {ch.evidence.filter((e) => e.id !== evidence.id && p.evidence.includes(e.id)).length}개 확인
              </b>
            </li>
            <li>
              <span>최종 추론</span>
              <b>추론 성공</b>
            </li>
            <li>
              <span>수사 크레딧</span>
              <b className="num" data-testid="result-reward">
                +{ch.reward}
                {replay ? " 받음" : ""}
              </b>
            </li>
            {closing && !!c.reward && (
              <li>
                <span>사건 해결 보상</span>
                <b className="num" data-testid="result-case-reward">
                  +{c.reward}
                  {replay ? " 받음" : ""}
                </b>
              </li>
            )}
            <li>
              <span>새 사건 기록</span>
              <b>{evidence.no} 획득</b>
            </li>
          </ul>
          <ul className="ending__closing">
            {ch.ending.lines.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          {next ? (
            <p className="ending__next" data-testid="result-next">
              <span>다음 장</span>
              <b>
                제{next.no}장 · {next.title}
              </b>
            </p>
          ) : (
            closing && (
              <p className="ending__solved" data-testid="result-closing">
                {closing}
              </p>
            )
          )}
          {replay && (
            <button type="button" className="ending__again" onClick={again} data-testid="result-again">
              끝 장면 다시 보기
            </button>
          )}
        </div>
      )}

      <footer className="storyintro__foot ending__foot">
        {stage === "result" ? (
          <>
            <button type="button" className="inkbtn" onClick={onRecord} data-testid="result-record">
              사건 기록
            </button>
            {onNext ? (
              <>
                <button type="button" className="inkbtn" onClick={onHome} data-testid="result-home">
                  학원 홀로
                </button>
                <button type="button" className="inkbtn inkbtn--wine" onClick={onNext} data-testid="result-continue">
                  다음 장으로
                </button>
              </>
            ) : (
              <button type="button" className="inkbtn inkbtn--wine" onClick={onHome} data-testid="result-home">
                학원 홀로
              </button>
            )}
          </>
        ) : (
          <p className="storyintro__hint" aria-hidden="true">
            화면을 누르면 다음
          </p>
        )}
      </footer>
    </div>
  );
}
