import { useEffect, useState } from "react";
import { prefersReducedMotion } from "../../app/motion";
import { playSound } from "../../app/sound";
import { Sprite } from "../../art/pixel";
import { StreamView } from "../components/StreamView";
import type { StoryCase, StoryChapter } from "../engine/storyTypes";

interface Props {
  c: StoryCase;
  ch: StoryChapter;
  /** 이미 본 도입인가 (다시 볼 때는 사건 접수 화면 없이 글만 본다) */
  seen: boolean;
  onStart: () => void;
  onExit: () => void;
}

const TYPE_MS = 38;

/**
 * 사건 접수와 도입. 먼저 접수된 사건의 서류를 보고 수락하면, 검은 화면에 도입 글이 한 줄씩 찍힌다.
 * 화면을 누르면 찍히던 줄이 바로 다 나오고, 한 번 더 누르면 다음 줄로 간다. 언제든 건너뛸 수 있다.
 */
export function StoryIntro({ c, ch, seen, onStart, onExit }: Props) {
  const [stage, setStage] = useState<"file" | "lines">(seen ? "lines" : "file");
  const [line, setLine] = useState(0);
  const [count, setCount] = useState(0);
  const still = prefersReducedMotion();
  const text = ch.intro[line];
  const typed = still || count >= text.length;
  const last = line === ch.intro.length - 1;

  useEffect(() => {
    if (stage !== "lines" || still) return;
    setCount(0);
    const id = window.setInterval(() => setCount((n) => n + 1), TYPE_MS);
    return () => window.clearInterval(id);
  }, [stage, line, still]);

  const advance = () => {
    if (!typed) {
      setCount(text.length);
      return;
    }
    if (!last) {
      playSound("tick");
      setLine((n) => n + 1);
    }
  };

  if (stage === "file") {
    return (
      <div className="screen desk inkworld story storyfile" data-testid="story-file">
        <header className="deskbar">
          <button type="button" className="tilebtn" aria-label="학원 복도로" onClick={onExit} data-testid="story-back">
            <Sprite name="arrow-left" />
          </button>
          <p className="deskbar__tag leaf">
            <span className="deskbar__type">사건 수사 · 새로운 사건 접수</span>
          </p>
        </header>

        <div className="story__scroll">
          <article className="casefile leaf">
            <p className="casefile__code">
              <span>{c.code}</span>
              <span>{c.rank}급 사건</span>
            </p>
            <div className="casefile__still" aria-hidden="true">
              <StreamView frame="t0640" />
              <span className="casefile__tag">마지막 방송 · 06:40</span>
            </div>
            <h1 className="casefile__title" data-testid="story-case-title">
              {c.title}
            </h1>
            <p className="casefile__brief">{c.brief}</p>
            <dl className="casefile__meta">
              <div>
                <dt>유형</dt>
                <dd>{c.genre}</dd>
              </div>
              <div>
                <dt>이번 수사</dt>
                <dd>
                  제{ch.no}장 · {ch.title}
                </dd>
              </div>
              <div>
                <dt>예상 시간</dt>
                <dd className="num">{ch.minutes}</dd>
              </div>
            </dl>
          </article>
        </div>

        <footer className="deskfoot">
          <button
            type="button"
            className="inkbtn inkbtn--wine deskfoot__submit"
            onClick={() => {
              playSound("place");
              setStage("lines");
            }}
            data-testid="story-accept"
          >
            사건 수락
          </button>
        </footer>
      </div>
    );
  }

  return (
    <div className="screen inkworld story storyintro" data-testid="story-intro">
      <button type="button" className="storyintro__skip" onClick={onStart} data-testid="story-intro-skip">
        건너뛰기
      </button>
      <button type="button" className="storyintro__stage" onClick={advance} aria-label="다음 줄" data-testid="story-intro-next">
        <span className="storyintro__kicker">
          {c.code} · 제{ch.no}장
        </span>
        {ch.intro.slice(0, line + 1).map((t, i) => (
          <span className="storyintro__line" key={i} data-now={i === line}>
            {i === line && !still ? t.slice(0, count) : t}
            {i === line && <i className="narr__caret" />}
          </span>
        ))}
        <span className="sr-only" aria-live="polite">
          {text}
        </span>
      </button>
      <footer className="storyintro__foot">
        {last && typed ? (
          <button type="button" className="inkbtn inkbtn--wine inkbtn--block" onClick={onStart} data-testid="story-start">
            마지막 방송 확인하기
          </button>
        ) : (
          <p className="storyintro__hint" aria-hidden="true">
            화면을 누르면 다음 줄
          </p>
        )}
      </footer>
    </div>
  );
}
