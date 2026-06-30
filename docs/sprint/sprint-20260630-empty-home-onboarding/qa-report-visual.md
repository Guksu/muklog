# QA Report — Visual 충실도 (sprint-20260630-empty-home-onboarding)

판정: **PASS** (FAIL 0건, ui-publisher 라우팅 불필요)

검증: 킷 `mk-home.jsx`(EmptyLogs/HomeHeader) + `index.html:120`(showTabs) ↔ RN `tokens.ts`·`LogListScreen.tsx`·`tabBarStyle.ts`·`HomeTabs.tsx` 동시 대조(qa-visual 에이전트).

## ① 웜 히어로 톤 — PASS
- `tokens.ts:51` `heroGradTop:'#FFF1EC', heroGradBottom:'#FFE0D4'` ↔ 킷 `mk-home:152` `linear-gradient(150deg,#FFF1EC 0%,#FFE0D4 100%)` verbatim. `tokens.spec.ts:171` 기대값 일치.
- `heroGradient` 소비처 단일(`LogListScreen.tsx:344` EmptyLogs 히어로) — 회귀 0(AC1).
- 150deg → `start{0,0}→end{1,1}` 대각 근사(LogListScreen:44-45) = expo-linear-gradient 한계 내 합당, 토큰 주석에 사유 기록 → **근사 허용**.
- 구 블루(`#EAF0FF/#FFE7DD`) heroGradient 영역 잔존 0. (`#EAF0FF`는 `primaryWeak`=인앱 액센트 전용 토큰에만 — 별개, 블루 유지 의도와 일치.)

## ② 탭바 숨김 조건 — PASS (픽셀 동작은 디바이스 스모크)
- `tabBarStyle.ts` `shouldHideTabBar = status==='ready' && logs.length===0` → ready+빈에서만 true, loading/error/로그보유 false. 킷 `index.html:120 !emptyHome`을 status 가드로 더 엄밀히 번역(깜빡임·오숨김 방지). AC2/AC3.
- `HomeTabs.tsx`는 `tabBarStyle`만 `{display:'none'}` 분기, `header`(HomeHeader)는 무조건 유지 → 킷 `mk-home:106`(EmptyLogs 위 HomeHeader 유지) 일치.

## ③ 비스코프 불변 — PASS (S4 voice 영역 안 건드림)
- 히어로 중앙 💕(`LogListScreen.tsx:356`)·🙂(:359) 유지. "둘이/연인" 카피(:337,:369,:376) 유지 → §4 미착수 정상.
- `LogEmptyBody` 🍽️·categories/FoodCover·인앱 액센트 불변.

## 디바이스 스모크 권장 (차단 아님 — qa-layout-blind-spot 취지)
(a) 빈 상태 = 탭바 없음, (b) 로그 생성/합류 후 탭바 복귀 + GNB가 시스템 내비바에 안 가림(buildTabBarStyle insets.bottom), (c) 전환 시 레이아웃 점프·깜빡임 없음.

## 미해결
- 없음(blocking). §4 미반영이라 RN EmptyLogs 카피·💕/🙂는 킷 구 voice와 일치(킷 신 voice와는 의도적 불일치 = S4 스코프). S3 판정 영향 없음.

> 비고: qa-visual 에이전트는 시스템 지침상 리포트 파일을 직접 쓰지 않아 회신 내용을 리더가 본 파일로 보존(감사 추적, 하네스 규칙 3).
