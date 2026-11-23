import { defineConfig } from "@playwright/test";

// 여러 작업 폴더에서 동시에 돌릴 때는 E2E_PORT 로 포트를 나눈다(같은 포트면 남의 빌드를 재사용한다).
const PORT = Number(process.env.E2E_PORT ?? 4183);

/** 실제 빌드 결과물(vite preview)을 모바일 화면으로 띄워 주요 플레이 흐름을 검증한다. */
export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    browserName: "chromium",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    trace: "retain-on-failure",
    // 사건을 열 때 뜨는 자막 화면은 꺼 두고 흐름을 본다. 자막 화면 자체는 mono.spec.ts 가 켜고 확인한다.
    // 게임 날짜는 달력의 첫날로 고정한다: 오늘의 추리가 날마다 바뀌므로(그날은 '자료실 금고의 암호'), 언제 돌려도 같은 문제로 흐름을 본다.
    // 날짜가 바뀌는 것 자체는 growth.spec.ts 가 확인한다.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: `http://127.0.0.1:${PORT}`,
          localStorage: [
            { name: "detective-academy:cine", value: "off" },
            { name: "detective-academy:date", value: "2026-11-22" },
          ],
        },
      ],
    },
  },
  webServer: {
    command: `npm run build && npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
