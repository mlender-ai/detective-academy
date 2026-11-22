import type { CodePuzzle } from "../../engine/types";

/**
 * 암호 해독의 짧은 이야기: 자료실의 잠긴 금고.
 * 금고를 발견하고, 시도 기록을 확인하고, 잠금장치를 돌리고, 금고가 열려 안의 기록을 찾는다.
 * 문장은 장면마다 한두 줄로만 쓴다. 숫자(시도 횟수·자릿수)는 문제 데이터에서 읽는다.
 */
export function vaultStory(puzzle: CodePuzzle) {
  const { rules } = puzzle;
  const range = `${rules.digits[0]}~${rules.digits[rules.digits.length - 1]}`;
  const rule = `${range} 가운데 서로 다른 숫자 ${rules.length}개`;
  return {
    rule,
    /** 자료실에 들어섰을 때 */
    arrive: puzzle.intro ?? "자료실. 책상 위에 누군가 남긴 기록이 놓여 있다.",
    /** 책상 앞: 기록을 살핀다 */
    desk: `금고를 열려던 시도 ${rules.clues.length}번의 기록이다. 암호는 ${rule}.`,
    /** 금고 앞: 잠금장치를 돌린다 */
    safe: `금고 앞. 숫자 드럼 ${rules.length}개를 돌려 암호를 맞춘다.`,
    /** 금고가 열렸을 때 */
    solved: puzzle.outro ?? "철컥. 금고가 열렸다. 안에 출입 기록부가 들어 있다.",
    /** 혼합형의 도입: 장면 하나에 세 문장 */
    intro: `자료실 구석에 낡은 금고가 있다. 책상 위에는 금고를 열려던 시도 ${rules.clues.length}번의 기록. 암호는 ${rule}다.`,
  };
}
