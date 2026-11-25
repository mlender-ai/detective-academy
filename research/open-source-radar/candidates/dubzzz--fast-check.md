# fast-check

- 추천일: 2026-11-26
- 상태: NOMINATED
- 공식: https://github.com/dubzzz/fast-check
- 릴리스: https://github.com/dubzzz/fast-check/releases/tag/v4.11.0 (2026-11-21)
- 라이선스: MIT
- 문서: https://fast-check.dev/

## 적용
TypeScript 속성 기반 테스트로 승급, 크레딧, 힌트 및 생성 퍼즐의 경계 조건을 검증한다. 기존 전수 탐색 검증기를 유지한다. 공개 main package.json에 직접 의존성 없음. 개발 브랜치 및 로컬 환경 전체는 미확인.

## 비용 및 검증
1~2일 추정, API 비용 없음. 기존 Vitest에 테스트 전용으로 연결하고 고정 seed 재현, 실패 사례 축소, 크레딧 음수 방지 및 유효 입력에서 정답 유일성 검증을 확인한다. 자연어 의미 검증은 별도. 콘텐츠 확장 전에 도입 검토. 설치 및 실행 미수행.
