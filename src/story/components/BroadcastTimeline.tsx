import { useRef, type PointerEvent, type ReactNode } from "react";
import { playSound } from "../../app/sound";
import type { TimelineFrame } from "../engine/storyTypes";

const mmss = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

interface Props {
  frames: TimelineFrame[];
  /** 영상 길이(초) */
  lengthSec: number;
  current: string;
  onSeek: (id: string) => void;
  /** 영상 길이 표시를 조사했는가, 조사할 때 */
  lengthNoted: boolean;
  onLength: () => void;
  /** 시간 줄의 오른쪽에 놓을 것 (조사 현황) */
  aside?: ReactNode;
}

/**
 * 방송 기록의 타임라인. 주요 시점 넷이 눈금으로 찍혀 있고 눈금마다 시각이 적혀 있다.
 * 눈금은 고르게 놓는다(실제 시간 비율대로 놓으면 06:40 과 07:00 이 붙어서 누르기 어렵다).
 * 눈금을 누르거나, 막대를 끌거나, 앞뒤 단추로 시점을 옮긴다. 끄는 동안에는 가장 가까운 시점에 달라붙는다.
 */
export function BroadcastTimeline({ frames, lengthSec, current, onSeek, lengthNoted, onLength, aside }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const index = Math.max(0, frames.findIndex((f) => f.id === current));
  const now = frames[index];

  const seek = (id: string) => {
    if (id === current) return;
    playSound("tick");
    onSeek(id);
  };

  /** 막대 위의 자리(0~1)에서 가장 가까운 시점 */
  const nearest = (clientX: number) => {
    const box = trackRef.current!.getBoundingClientRect();
    const at = Math.max(0, Math.min(1, (clientX - box.left) / box.width));
    return frames[Math.round(at * (frames.length - 1))];
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    seek(nearest(event.clientX).id);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) seek(nearest(event.clientX).id);
  };
  const stop = () => {
    dragging.current = false;
  };

  return (
    <div className="tline" data-testid="timeline">
      <button type="button" className="tline__step" aria-label="앞 시점" disabled={index === 0} onClick={() => seek(frames[index - 1].id)} data-testid="timeline-prev">
        ◀
      </button>

      <div className="tline__track" ref={trackRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={stop} onPointerCancel={stop}>
        <span className="tline__rail" aria-hidden="true" />
        <span className="tline__fill" aria-hidden="true" style={{ width: `${(index / (frames.length - 1)) * 100}%` }} />
        {frames.map((f, i) => (
          <button
            key={f.id}
            type="button"
            className="tline__tick"
            style={{ left: `${(i / (frames.length - 1)) * 100}%` }}
            aria-pressed={f.id === current}
            aria-label={`${mmss(f.at)} 시점으로`}
            data-testid={`tick-${f.id}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => seek(f.id)}
          >
            <span className="num" aria-hidden="true">
              {mmss(f.at)}
            </span>
          </button>
        ))}
      </div>

      <button type="button" className="tline__step" aria-label="다음 시점" disabled={index === frames.length - 1} onClick={() => seek(frames[index + 1].id)} data-testid="timeline-next">
        ▶
      </button>

      <div className="tline__time">
        <p className="tline__clock num">
          <span data-testid="timeline-now">{mmss(now.at)}</span>
          <span aria-hidden="true"> / </span>
          {/* 영상 길이도 조사할 수 있는 곳이다 */}
          <button type="button" className="tline__length" data-noted={lengthNoted} onClick={onLength} aria-label={`영상 길이 ${mmss(lengthSec)} 조사`} data-testid="point-length">
            전체 {mmss(lengthSec)}
          </button>
        </p>
        {aside}
      </div>
    </div>
  );
}
