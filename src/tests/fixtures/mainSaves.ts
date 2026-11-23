/**
 * 지금 배포본(main 브랜치)의 저장 형식으로 된 저장 둘. 손으로 짜 맞춘 것이 아니라 main 의 엔진
 * (enroll · markOpened · addElapsed · requestHint · recordInput · submitAnswer)을 실제로 돌려 얻은 값이다(2026-11-24).
 * main 의 저장에는 exam · examDays · story 가 없고 settings 에는 sound 뿐이다. 문제는 셋(오늘의 추리 100 · 연습 60 · 승급 시험 150)이었다.
 * - MAIN_SAVE_F: F급. 오늘의 추리를 힌트 한 단계 쓰고 한 번 틀린 뒤 해결, 연습 과제는 풀다 만 상태, 효과음 켬
 * - MAIN_SAVE_D: D급. 세 문제를 모두 풀어 승급한 사용자
 */
export const MAIN_SAVE_F: unknown = {
  "version": 1,
  "enrolled": true,
  "nickname": "옛 탐정",
  "detectiveNo": "DA-314159",
  "enrolledAt": "2026-11-22T03:00:00.000Z",
  "rank": "F",
  "credits": 120,
  "puzzles": {
    "daily-code-001": {
      "status": "solved",
      "input": null,
      "hintsUsed": 1,
      "elapsedMs": 187000,
      "attempts": 2,
      "rewardClaimed": true,
      "opened": true,
      "solvedAt": "2026-11-22T03:03:00.000Z",
      "solvedDateKey": "2026-11-22",
      "solvedElapsedMs": 187000,
      "solvedAttempts": 2,
      "solvedHints": 1
    },
    "practice-truth-001": {
      "status": "in_progress",
      "input": {
        "type": "truth",
        "suspect": "hana",
        "memos": {
          "hana": {
            "junho": true,
            "sera": true,
            "daon": false
          }
        },
        "pinned": [
          "hana"
        ]
      },
      "hintsUsed": 0,
      "elapsedMs": 42000,
      "attempts": 0,
      "rewardClaimed": false,
      "opened": false,
      "solvedAt": null,
      "solvedDateKey": null,
      "solvedElapsedMs": null,
      "solvedAttempts": null,
      "solvedHints": null
    }
  },
  "promotions": [],
  "settings": {
    "sound": true
  }
};

export const MAIN_SAVE_D: unknown = {
  "version": 1,
  "enrolled": true,
  "nickname": "승급한 탐정",
  "detectiveNo": "DA-271828",
  "enrolledAt": "2026-11-22T03:00:00.000Z",
  "rank": "D",
  "credits": 350,
  "puzzles": {
    "daily-code-001": {
      "status": "solved",
      "input": null,
      "hintsUsed": 0,
      "elapsedMs": 95000,
      "attempts": 1,
      "rewardClaimed": true,
      "opened": true,
      "solvedAt": "2026-11-22T03:10:00.000Z",
      "solvedDateKey": "2026-11-22",
      "solvedElapsedMs": 95000,
      "solvedAttempts": 1,
      "solvedHints": 0
    },
    "practice-truth-001": {
      "status": "solved",
      "input": null,
      "hintsUsed": 0,
      "elapsedMs": 125000,
      "attempts": 1,
      "rewardClaimed": true,
      "opened": true,
      "solvedAt": "2026-11-22T03:15:00.000Z",
      "solvedDateKey": "2026-11-22",
      "solvedElapsedMs": 125000,
      "solvedAttempts": 1,
      "solvedHints": 0
    },
    "exam-schedule-f-d": {
      "status": "solved",
      "input": null,
      "hintsUsed": 0,
      "elapsedMs": 155000,
      "attempts": 1,
      "rewardClaimed": true,
      "opened": true,
      "solvedAt": "2026-11-22T03:20:00.000Z",
      "solvedDateKey": "2026-11-22",
      "solvedElapsedMs": 155000,
      "solvedAttempts": 1,
      "solvedHints": 0
    }
  },
  "promotions": [
    {
      "from": "F",
      "to": "D",
      "at": "2026-11-22T03:20:00.000Z"
    }
  ],
  "settings": {
    "sound": false
  }
};
