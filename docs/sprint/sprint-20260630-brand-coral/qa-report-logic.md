# QA Report — Logic / 통합 정합성 (sprint-20260630-brand-coral)

판정: **PASS** (FAIL 0건)

검증 주체: 리더(이번 스프린트는 데이터·로직·계약 변경이 없어 qa-logic을 리더가 직접 수행).

## 범위
순수 비주얼·에셋·토큰 변경. DB·RPC·Edge Function·네비게이션 계약 **변경 없음** → 경계면(생산자↔소비자) 신규 위험 없음. 회귀·TDD·가드레일 위주로 검증.

## 인수조건 점검 (plan.md AC1~7)
- **AC1~4 (AppMark·tokens·SplashView 비주얼/토큰):** qa-report-visual.md에서 PASS(킷 verbatim 정합). 로직 측면 — 토큰 타입·소비처 동기화 tsc로 보증.
- **AC5 (app.json):** ✅ `node -e JSON.parse` 유효. adaptiveIcon `#FF4D6D`, splash 풀이미지 cover `#FFF1EC`, icon 3종 경로 유효. `expo-notifications` color `#3366FF`(인앱 액센트) 보존.
- **AC6 (에셋):** ✅ `assets/` 3종 1024²/1024²/1242×2688, 킷 코럴본과 바이트 동일(qa-visual 해시 일치 확인). 구 블루 마크 잔존 0.
- **AC7 (테스트·tsc·회귀):** ✅
  - `npx tsc --noEmit` → **exit 0**.
  - 브랜드 관련 5스위트 99 tests PASS(tokens·SplashView·AppMark·LoginScreen·AuthGate). ui-publisher 전체 실행 보고: **1399 passed / 150 suites, 0 fail**.
  - **AppMark 소비처 회귀:** JSX 사용처는 `SplashView.tsx:37`·`LoginScreen.tsx:65` 2곳뿐 — 둘 다 이번에 함께 갱신. props 계약(size/radius/bg/tint/style) 불변 → 그 외 회귀 표면 없음.

## 가드레일
- **인앱 액센트 블루 유지 제약 준수:** `theme.color.primary`(#3366FF)·`accentShadow`(블루)·`primaryWeak`·notifications color 모두 불변(qa-visual 코럴 번짐 0건 확인). 코럴 전환은 브랜드 마크/스플래시/로그인 비주얼로 한정됨 — 스코프 정확.
- **AWS·비용:** 백엔드 무변경 → 영향 없음.
- **시크릿:** 변경 파일에 키·토큰 없음.
- **컨벤션:** raw hex 직접 사용 적발 0건(qa-visual). 색은 tokens 경유.

## 근사 항목 (로직 영향 없음 — 비주얼 근사라 qa-visual 관할)
- "먹" 글자 RN `<Text>` 오버레이 근사(SVG `<Text>` jest-expo 미지원·한글 렌더 리스크 회피). 중앙정렬 수식 정확(qa-visual 검증). 테스트 가능성↑(부수 이득).

## 미해결 / 후속
- **실기기 확인 필요(완료 기준의 네이티브 부분):** 런처 아이콘·네이티브 스플래시(cover 크롭)·인앱 스플래시·로그인 코럴 — **dev build 재빌드**로 확인. OTA 불가. 사용자 빌드 단계.
- 정보성: iOS 아이콘 `hasAlpha=yes`(코럴 풀블리드라 코너 투명 노출 위험 없음, 출시 전 알파 제거 권장 — qa-visual 메모).
