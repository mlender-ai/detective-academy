/**
 * 연습실과 승급 시험의 문제 (GATE 05). 유형별 파일에 나눠 담는다: 연습실 15문제와 승급 시험 14문제.
 * 순서는 연습실에서 같은 등급 안의 순서가 된다.
 */
import type { Puzzle } from "../../engine/types";
import { CODE_SET } from "./code";
import { EVIDENCE_SET } from "./evidence";
import { SCHEDULE_SET } from "./schedule";
import { SEAL_SET } from "./seal";
import { TRUTH_SET } from "./truth";

export const GROWTH_SET: Puzzle[] = [...CODE_SET, ...TRUTH_SET, ...SCHEDULE_SET, ...EVIDENCE_SET, ...SEAL_SET];
