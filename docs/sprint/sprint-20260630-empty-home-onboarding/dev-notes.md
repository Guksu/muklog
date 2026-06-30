# Dev Notes — sprint-20260630-empty-home-onboarding

## 요약
킷 §3의 RN 델타 2건: 빈 상태 히어로 웜톤 + 첫 실행(로그 0) 탭바 숨김. EmptyLogs 온보딩 화면 자체는 home-fidelity에서 이미 구현됨(재구현 없음).

## 변경 파일
- `src/theme/tokens.ts:51` — `heroGradTop/Bottom` 웜 repoint(`#FFF1EC`/`#FFE0D4`) + 주석 §3 갱신.
- `src/theme/tokens.spec.ts:170` — heroGradient 기대값 웜으로 갱신.
- `src/navigation/tabBarStyle.ts` — 순수 헬퍼 `shouldHideTabBar({ logsState })` 신설(`MyLogsState` type-only import).
- `src/navigation/tabBarStyle.spec.ts` — shouldHideTabBar 4케이스 추가.
- `src/navigation/HomeTabs.tsx` — `useMyLogsContext()` 소비 → `shouldHideTabBar`로 `tabBarStyle: {display:'none'}` 분기(헤더 유지).

## 경계면 (생산자↔소비자)
- 생산자: `useMyLogs`(state `{status:'ready', logs: MyLog[]}`) → `MyLogsProvider`(AuthGate 최상위 마운트).
- 소비자: `HomeTabs` `useMyLogsContext()` → `shouldHideTabBar`. provider 트리 하위라 항상 가용.

## 비스코프 (S4로 이월)
- EmptyLogs 히어로 중앙 💕/🙂, "둘이/연인" 카피, `LogEmptyBody` 🍽️ — §4 voice(연인→함께, 인앱 이모지 제거)에서 처리.

## 빌드
순수 JS(토큰·네비 옵션) → **재빌드 불필요**, Metro 리로드 반영. 단 탭바 숨김/복귀·safe-area는 디바이스 스모크 권장.
