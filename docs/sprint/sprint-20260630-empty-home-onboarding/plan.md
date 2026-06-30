# Sprint: empty-home-onboarding (2026-06-30)

## 단일 기능
ui-design 킷 2026-06-30 델타 **§3 — 첫 실행(데이터 없음) 상태**. 로그 0개 첫 실행 화면을 온보딩에 집중시킨다.

> 출처: `HANDOFF-2026-06-30.md §3`, 킷 `mk-home.jsx` EmptyLogs / `index.html:120` showTabs.

## 현황 (이미 구현된 부분 — 변경 없음)
- **EmptyLogs 온보딩 자체는 이미 존재**(`LogListScreen.tsx:316-384`, `:463 if (state.logs.length === 0)`). 히어로 + 두 갈래 CTA("새 로그 만들기" / "초대코드로 입장") = home-fidelity 스프린트 산출. 재구현 불필요.

## S3 실제 델타 (좁음)
1. **빈 상태 히어로 웜톤** — `heroGradient` 토큰을 킷 §3 신값으로: `[#EAF0FF, #FFE7DD]`(블루) → **`[#FFF1EC, #FFE0D4]`**(웜, 킷 `linear-gradient(150deg,#FFF1EC,#FFE0D4)`).
2. **빈 상태일 때 하단 탭바 숨김** — 킷 `index.html:120 showTabs = … && !emptyHome`. RN: `HomeTabs`가 `useMyLogsContext()`를 읽어 **`ready && logs.length===0`이면 탭바 숨김**(`tabBarStyle: { display:'none' }`). 로그 있으면 정상 탭바.
   - 헤더(`HomeHeader`)는 **유지**(킷 mk-home:106이 EmptyLogs 위에 HomeHeader 그대로 렌더 — 탭바만 숨김).
   - 첫 실행(로그 0) = 지도/프로필 탭 의미 없음 → 온보딩 집중. 로그 합류/생성 시 탭바 복귀.

## 명시적 비스코프 (S3 아님)
- 히어로 **중앙 콘텐츠**(💕 하트·🙂 파트너 이모지)와 카피("먼저 시작하고 연인을 초대해요")는 **§4(voice: 연인→함께, 인앱 이모지 💕 제거)** 영역 → **S4**에서. S3는 히어로 **배경 톤**과 **탭바 숨김**만.
- `LogEmptyBody`의 🍽️(개별 로그 0스팟 본문)도 §4 → S4.
- 인앱 액센트색·기타 화면 불변.

## 구현 (TDD)
1. **`src/theme/tokens.ts:51`** — `heroGradTop/Bottom` 웜 repoint + 주석을 HANDOFF §3 신값으로 갱신.
2. **`src/theme/tokens.spec.ts:170`** — heroGradient 기대값 `['#FFF1EC', '#FFE0D4']`로 갱신(Red→Green).
3. **`src/navigation/tabBarStyle.ts`** — 순수 헬퍼 `shouldHideTabBar({ logsState }): boolean` 추가(`logsState.status==='ready' && logsState.logs.length===0`). 단위 테스트(`tabBarStyle.spec.ts` 신설/추가).
4. **`src/navigation/HomeTabs.tsx`** — `useMyLogsContext()` 소비 → `shouldHideTabBar`로 `tabBarStyle` 분기.
5. **`src/navigation/HomeTabs.spec.tsx`(신설)** — ready+empty → 탭바 hidden(display none), ready+logs → 정상 탭바 스타일 적용 검증(MyLogsProvider/SafeArea 모킹).

## 인수조건
- AC1. heroGradient = `['#FFF1EC', '#FFE0D4']`(웜). EmptyLogs 히어로가 이 토큰 사용. 다른 소비처 없음(회귀 0).
- AC2. `shouldHideTabBar`: ready+빈 → true, ready+logs → false, loading → false, error → false.
- AC3. HomeTabs가 ready+빈에서 탭바를 숨기고(헤더 유지), 로그 있으면 `buildTabBarStyle` 정상 적용.
- AC4. `npm test` 전체 통과 + `npx tsc --noEmit` 0 에러.

## 완료 기준
- AC1~4 + qa-report-visual(웜 히어로 톤·탭바 숨김 킷 충실도) + qa-report-logic(분기 정합·context 소비·회귀) PASS.
- **디바이스 스모크 권장**(탭바 숨김/복귀 + safe-area는 네이티브 렌더 의존 — `qa-layout-blind-spot` 취지). 순수 JS 변경이라 **재빌드 불필요**(Metro 리로드).

## 데이터 계약
- 변경 없음. `useMyLogs`/`list_my_rooms` RPC·상태 shape 불변(읽기만).
