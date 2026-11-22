/** 문제에 나오는 학생들. 초상은 src/art/portraits.tsx 가 이름표(id)로 찾는다. */
import type { Person } from "../engine/types";

/*
 * 인물 색은 학원 팔레트의 네 가지 재질색만 쓴다: 황동, 봉랍, 녹청, 강철.
 * 사람 구분은 색에만 기대지 않고 고유 실루엣과 이름 첫 글자가 함께 맡는다.
 */
const BRASS = "#87692F";
const WAX = "#8A3F4B";
const VERDIGRIS = "#3A715E";
const STEEL = "#4F6486";

export const hana: Person = { id: "hana", name: "하나", color: VERDIGRIS, mark: "circle" };
export const junho: Person = { id: "junho", name: "준호", color: BRASS, mark: "shield" };
export const sera: Person = { id: "sera", name: "세라", color: WAX, mark: "hex" };
export const daon: Person = { id: "daon", name: "다온", color: STEEL, mark: "diamond" };

export const doyun: Person = { id: "doyun", name: "도윤", color: BRASS, mark: "shield" };
export const minjae: Person = { id: "minjae", name: "민재", color: STEEL, mark: "diamond" };
export const sea: Person = { id: "sea", name: "세아", color: WAX, mark: "circle" };
export const harin: Person = { id: "harin", name: "하린", color: VERDIGRIS, mark: "hex" };
