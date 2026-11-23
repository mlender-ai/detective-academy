/**
 * 탐정학원 OST. 음원은 ACE-Step 1.5 로 로컬에서 생성해 편집한 것이다(제작 기록은 저장소 밖의 R&D 폴더, 요약은 lab/README.md).
 * 네 곡은 같은 네 마디 모티프(D 단조: D–F–A / G–E–C# / D–F–Bb / A–E–D)의 변주다.
 * 파일은 [루프의 끝 1초] + [루프] + [루프의 처음 1초]로 되어 있다: 압축 음원의 앞뒤에 붙는 짧은 공백과 상관없이 이음매가 이어진다.
 * 음악은 기본이 꺼짐이고, 켰을 때만 내려받는다(번들의 스크립트에는 들어가지 않는다).
 */
import theme from "../assets/audio/academy-theme.m4a?url";
import countdown from "../assets/audio/countdown.m4a?url";
import deduction from "../assets/audio/deduction.m4a?url";
import corridor from "../assets/audio/midnight-corridor.m4a?url";

export type TrackId = "theme" | "corridor" | "deduction" | "countdown";

export interface Track {
  title: string;
  /** 쓰이는 곳 */
  where: string;
  url: string;
  /** 파일 앞에 붙은 여유(초). 루프는 여기서 시작한다. */
  lead: number;
  /** 루프의 길이(초): 마디 수 × 4박 × 60 / BPM */
  length: number;
  /** 곡마다의 음량 보정 */
  gain: number;
}

const bars = (count: number, bpm: number) => (count * 4 * 60) / bpm;

export const TRACKS: Record<TrackId, Track> = {
  theme: { title: "Academy Theme", where: "입학 · 연습실 · 시험실 · 신분증", url: theme, lead: 1, length: bars(16, 72), gain: 1 },
  corridor: { title: "Midnight Corridor", where: "학원 복도(홈)", url: corridor, lead: 1, length: bars(16, 54), gain: 1 },
  deduction: { title: "Deduction", where: "문제 풀이 · 사건 수사", url: deduction, lead: 1, length: bars(16, 60), gain: 1 },
  countdown: { title: "Countdown", where: "제한 시간이 있는 승급 시험", url: countdown, lead: 1, length: bars(24, 96), gain: 0.9 },
};
