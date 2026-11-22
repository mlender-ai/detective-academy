import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../../app/motion";
import { playSound } from "../../app/sound";
import { Stamp } from "../../components/Stamp";
import { PLATFORM } from "../cases/d001/case";
import { EvidenceCard } from "../components/StoryParts";
import { StreamView } from "../components/StreamView";
import type { ChapterProgress, StoryCase, StoryChapter } from "../engine/storyTypes";

interface Props {
  c: StoryCase;
  ch: StoryChapter;
  p: ChapterProgress;
  /** 사건 기록으로 */
  onRecord: () => void;
  /** 학원 복도로 */
  onHome: () => void;
}

type Stage = "tape" | "lines" | "evidence" | "result";
const ORDER: Stage[] = ["tape", "lines", "evidence", "result"];
const TYPE_MS = 44;

/**
 * 장의 끝. 그날 밤의 방송이 다시 돌아가고, 화면 구석의 LIVE 표시가 꺼진 자리에 "예약 영상"이 찍힌다.
 * 이어서 끝 글 두 줄, 새로 드러난 기록 한 장, 수사 결과. 화면을 누르면 다음으로 가고, 한 번에 건너뛸 수도 있다.
 */
export function ChapterEnding({ c, ch, p, onRecord, onHome }: Props) {
  const still = prefersReducedMotion();
  // 이미 본 끝 장면을 다시 볼 때는 보상을 "받음"으로 적는다
  const [replay] = useState(p.endingSeen);
  const [stage, setStage] = useState<Stage>(still ? "result" : "tape");
  const [relabeled, setRelabeled] = useState(still);
  const [line, setLine] = useState(0);
  const [count, setCount] = useState(0);
  const { lines, next } = ch.ending;
  const evidence = ch.evidence.find((e) => e.id === ch.ending.evidence)!;
  const typed = count >= lines[line].length;
  const at = ORDER.indexOf(stage);
  const sounded = useRef(false);

  // 테이프: LIVE 표시가 두어 번 깜빡이다 꺼지고, 그 자리에 예약 영상이라고 찍힌다
  useEffect(() => {
    if (stage !== "tape") return;
    const swap = window.setTimeout(() => {
      setRelabeled(true);
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
    if (stage === "tape") {
      setRelabeled(true);
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
    setRelabeled(true);
    setLine(lines.length - 1);
    setCount(999);
    setStage("result");
  };

  return (
    <div className="screen inkworld story ending" data-stage={stage} data-testid="story-ending">
      {stage !== "result" && (
        <button type="button" className="storyintro__skip" onClick={skip} data-testid="ending-skip">
          건너뛰기
        </button>
      )}

      {stage !== "result" ? (
        <button type="button" className="ending__stage" onClick={advance} aria-label="다음" data-testid="ending-next">
          <span className="crt ending__crt" data-relabeled={relabeled}>
            <span className="crt__bar">
              <span>{PLATFORM.name}</span>
              <span>{PLATFORM.channel} · 2026.11.21 다시보기</span>
            </span>
            <span className="crt__screen">
              <StreamView frame={relabeled ? "t0640" : "t0015"} />
              {relabeled ? (
                <span className="crt__live crt__live--tape" data-testid="ending-label">
                  예약 영상
                </span>
              ) : (
                <span className="crt__live crt__live--dying" data-testid="ending-label">
                  <i />
                  LIVE
                </span>
              )}
            </span>
          </span>

          {at >= 1 && (
            <span className="ending__lines">
              {lines.slice(0, line + 1).map((t, i) => (
                <span className="ending__line" key={i}>
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
            {at >= 1 ? lines[line] : "그날 밤의 방송이 다시 재생된다."}
          </span>
        </button>
      ) : (
        <div className="ending__result" data-testid="story-result">
          <p className="ending__case">{c.code}</p>
          <p className="ending__kicker">CHAPTER {String(ch.no).padStart(2, "0")} CLEARED</p>
          <h1 className="ending__title">{ch.title}</h1>
          <Stamp label="조사 완료" animate={!still} />
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
            <li>
              <span>새 사건 기록</span>
              <b>{evidence.no} 획득</b>
            </li>
          </ul>
          <ul className="ending__closing">
            {lines.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          {next && (
            <p className="ending__next" data-testid="result-next">
              <span>다음 장</span>
              <b>
                제{next.no}장 · {next.title}
              </b>
              <span>준비 중</span>
            </p>
          )}
        </div>
      )}

      <footer className="storyintro__foot ending__foot">
        {stage === "result" ? (
          <>
            <button type="button" className="inkbtn" onClick={onRecord} data-testid="result-record">
              사건 기록 보기
            </button>
            <button type="button" className="inkbtn inkbtn--wine" onClick={onHome} data-testid="result-home">
              탐정학원으로
            </button>
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
