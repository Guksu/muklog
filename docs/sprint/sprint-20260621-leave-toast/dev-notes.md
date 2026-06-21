# Dev Notes: 로그 나가기/삭제 성공 토스트

## 변경 파일
- `src/navigation/screens/LogScreen.tsx` — `handleLeave` 두 성공 분기에 전역 토스트 추가.
- `src/navigation/screens/LogScreen.spec.tsx` — 커플/솔로 성공 토스트 단언 + 실패 미노출 단언(T10).

## 구현
`handleLeave`(LogScreen.tsx:452-471), `leaveRoom({roomId})` 결과로 분기:
- `res.roomDeleted === true`(솔로 즉시 삭제) → `showToast({ message: '로그를 삭제했어요', tone: 'positive' })` → `goBack()`. 전역 토스트(S4 ToastProvider)라 홈 복귀 후에도 표시 유지.
- `else`(커플 24h 예약) → `refresh()`(예약 배너) → `showToast({ message: '로그에서 나갔어요 · 24시간 뒤 삭제돼요', tone: 'positive' })`. 화면 유지.
- `catch`(실패) → 토스트 없음. 기존 `useLeaveRoom.error` → LeaveLogSheets 인라인 유지.

## 경계면
- 생산자 `useLeaveRoom.leaveRoom` 반환 `{ scheduled, roomDeleted, deleteScheduledAt, roomId }` ↔ 소비자 `handleLeave`의 `res.roomDeleted` 분기.
- 토스트 표시: 전역 `useToastController.showToast`(LogScreen:250, S4) → 루트 `ToastProvider` 단일 `<Toast>`.
- SPEC §4-1 문구와 바이트 일치(가운뎃점 U+00B7).

## 결정
- tone=positive: S4 상세 삭제 토스트("먹로그를 삭제했어요")와 동일 컨벤션(완료 확인=초록 체크).
- 커플 분기: SPEC §4-1은 표면상 "→ 홈"이나 RN은 room-lifecycle 설계상 화면 유지(예약 배너) — 의도적 기존 동작. 토스트만 SPEC 정합으로 추가(plan AC2가 governing).

## 결과
- `tsc --noEmit`: 0 에러
- `npm test`: 140 suites / 1278 tests green (회귀 0)
- qa-logic: PASS (SPEC 문구 바이트 일치, 분기/실패 load-bearing 확인)

## 사용자 전담
- 디바이스 스모크(토스트 표시·타이밍), 커밋.
