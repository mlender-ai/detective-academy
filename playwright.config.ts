import { defineConfig } from "@playwright/test";

const PORT = 4183;

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
    storageState: {
      cookies: [],
      origins: [{ origin: `http://127.0.0.1:${PORT}`, localStorage: [{ name: "detective-academy:cine", value: "off" }] }],
    },
  },
  webServer: {
    command: `npm run build && npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
