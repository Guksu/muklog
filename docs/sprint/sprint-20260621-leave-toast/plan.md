# Sprint: 로그 나가기/삭제 성공 토스트 (sprint-20260621-leave-toast)

## 단일 기능
로그 나가기/삭제 성공 시 토스트를 띄운다(SPEC §4-1). 현재 UI 설계(킷/SPEC)엔 토스트가 명세돼 있으나 실제 RN(`LogScreen.handleLeave`)엔 nav·refresh만 있고 **토스트가 없다**(grep "나갔어요"/"삭제했어요" 소스 0건).

## 현재 흐름 (LogScreen.tsx:452-465 handleLeave)
- `leaveRoom({roomId})` → `res.roomDeleted`로 분기:
  - `roomDeleted === true`(**솔로 즉시 삭제**) → `goBack()`(홈 복귀). **토스트 없음**.
  - else(**커플 24h 예약**) → `refresh()`(예약 배너 표시·화면 유지). **토스트 없음**.
- 전역 토스트(`showToast`)는 LogScreen에 이미 주입됨(:250, S4 전역 ToastProvider). 위시/예약취소에서 사용 중.

## 설계 (SPEC §4-1)
두 성공 분기에 `showToast` 추가:
- **솔로(roomDeleted)** → `goBack()` 직전 `showToast({ message: '로그를 삭제했어요', tone: 'positive' })`. 전역이라 복귀한 홈(LogListScreen) 위에서 표시.
- **커플(예약)** → `refresh()` 후 `showToast({ message: '로그에서 나갔어요 · 24시간 뒤 삭제돼요', tone: 'positive' })`. 화면 유지(배너와 공존).
- 실패(catch)는 토스트 없음(기존 `leaveError` 인라인 유지).
- tone=positive: S4 상세 삭제 토스트와 동일 컨벤션(완료 확인 = 초록 체크).

## 인수조건 (= 테스트, TDD)
- **AC1** leaveRoom 성공 + roomDeleted=true → "로그를 삭제했어요"(positive) 토스트 + goBack.
- **AC2** leaveRoom 성공 + roomDeleted=false → "로그에서 나갔어요 · 24시간 뒤 삭제돼요"(positive) 토스트 + refresh(화면 유지·goBack 안 함).
- **AC3** leaveRoom 실패(throw) → 토스트 미노출, 기존 인라인 에러(leaveError) 유지, 확인 시트 유지.
- **AC4** `npm test` green + `tsc --noEmit` 0. 회귀 0(나머지 leave 로직·예약취소 토스트 불변).

## 리스크
- 커플 분기 토스트가 예약 배너와 의미 중복일 수 있으나 SPEC 명세대로 액션 완료 피드백 제공(배너=상태 지속, 토스트=즉시 확인).
- 전역 토스트라 솔로 goBack 후에도 표시 유지(언마운트 무관, S4 검증).
- 디바이스 스모크(토스트 표시·타이밍)는 사용자 영역.

## 작업
1. (dev, TDD) handleLeave 두 분기 토스트 + LogScreen.spec 단언(AC1~AC3).
2. (qa-logic) leaveRoom 결과 분기 ↔ 토스트/nav 경계, 실패 미노출, 회귀 0.
