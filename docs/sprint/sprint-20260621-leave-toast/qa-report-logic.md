# QA 로직·정합 리포트 — sprint-20260621-leave-toast

**대상:** 로그 나가기/삭제 성공 토스트(SPEC §4-1)
**범위:** 로직·통합 정합성·기능 스펙·TDD·컨벤션 (비주얼은 qa-visual)
**판정: 통과 (PASS)** — AC1~AC4 전부 통과, 회귀 0.

---

## 1. 분기 경계 정합성 (AC1·AC2) — 통과

생산자 `useLeaveRoom`(`src/features/room/useLeaveRoom.ts:17-22,56-61`)이 반환하는 `LeaveRoomResult.roomDeleted: boolean` ↔ 소비자 `handleLeave`(`src/navigation/screens/LogScreen.tsx:454-470`) 분기를 양쪽 동시 확인.

- **AC1 솔로(roomDeleted=true)** — `LogScreen.tsx:458-462`: `res.roomDeleted` true 분기에서 `showToast({ message: '로그를 삭제했어요', tone: 'positive' })` 후 `navigation.goBack()` + early return. SPEC §4-1(SPEC.md:85) 문구 일치. tone=positive(S4 상세삭제 컨벤션과 동일, MuklogDetailRoute.tsx:85 일관).
- **AC2 커플(roomDeleted=false)** — `LogScreen.tsx:464-466`: `await refresh()` 후 `showToast({ message: '로그에서 나갔어요 · 24시간 뒤 삭제돼요', tone: 'positive' })`. goBack 호출 없음(화면 유지). SPEC §4-1(SPEC.md:84) 문구 일치.
- `setConfirmOpen(false)`는 성공 분기 진입 전(`:457`)에서 1회 — 두 분기 공통, 회귀 없음.

**SPEC 문구 바이트 단위 일치 확인:** 가운뎃점은 U+00B7(`c2 b7`), 양옆 ASCII 공백. SPEC.md·LogScreen.tsx·LogScreen.spec.tsx 세 곳의 `나갔어요 · 24시간` 바이트열이 완전 동일(`eb82 98ea b094 ec96 b4ec 9a94 20c2 b720 3234 ...`). 전각 가운뎃점(・)·콜론 오타 없음.

**참고(결함 아님):** SPEC §4-1 커플 행은 표면적으로 "→ 홈 + 토스트"로 적혀 있으나, plan(§14-15·AC2·리스크)은 의도적으로 커플 분기를 **화면 유지(refresh, goBack 안 함)**로 정의하고 예약 배너와 토스트를 공존시킴. plan이 governing 계약이고 테스트가 이를 lock하므로 정상. (SPEC의 "홈"은 시트→홈 복귀 카피 맥락이며 커플 화면 유지 정책은 plan 결정.)

## 2. 실패 미노출 (AC3) — 통과

- `handleLeave` catch(`LogScreen.tsx:467-469`)는 비어 있음(토스트 호출 없음). 에러는 `useLeaveRoom.error`(`useLeaveRoom.ts:62-64` mapRoomError + throw) → LeaveLogSheets `leaveError` 인라인으로만 노출. 확인 시트는 닫지 않음(성공 분기에서만 `setConfirmOpen(false)`).
- **테스트 load-bearing 확인:** `LogScreen.spec.tsx:902-919` 실패 케이스가 ① `mockGoBack` 미호출, ② `refresh` 미호출, ③ `confirm:true`(시트 유지), ④ leaveError 인라인('세션이 만료됐어요') 노출, ⑤ `queryByText('로그에서 나갔어요 · …').toBeNull()` 5개를 동시 단언.
  - 사고실험: 토스트를 catch로 옮기면 ⑤가 red. 분기를 뒤집으면(roomDeleted 분기 swap) AC1/AC2의 goBack/refresh·문구 단언이 red. 문구를 바꾸면 AC1/AC2의 `getByText` 가 red.
  - 토스트 단언이 **실제 렌더 경유**임을 검증: `renderWithTheme`(src/test/renderWithTheme.tsx)가 실제 `ToastProvider`를 트리에 포함하고, `@/components`는 `jest.requireActual` 부분 모킹이라 `useToastController`/`Toast`가 실 구현. 따라서 `getByText`/`queryByText`는 mock 호출 카운트가 아닌 실제 토스트 DOM을 검사 → 껍데기 단언 아님.

## 3. 회귀 0 (AC4) — 통과

- 나머지 leave 로직 불변: `setConfirmOpen`·`refresh`·`goBack` 경로 동일(T10 커플/솔로 기존 단언 `LogScreen.spec.tsx:858-900` 그대로 green).
- 예약취소 토스트 `handleCancelDeletion`(`LogScreen.tsx:474-482`) 불변 — 실패 시 `mapRoomError` neutral 토스트 + refresh, 대응 테스트(`:965-978`) green.
- 위시 토스트(`LogScreen.tsx:318`, WISH_ADDED_TOAST positive) 불변.
- 전 토스트가 전역 `useToastController`(`LogScreen.tsx:250`) 경유(S4) — 신규 로컬 토스트 상태 도입 없음. 소스에서 leave 토스트 문구는 LogScreen.tsx 1곳에만 존재(grep 확인, 중복 정의 0).

## 4. 종료기준 — 직접 실행 통과

- `npx tsc --noEmit` → **exit 0**(에러 0).
- `npm test` → **Test Suites: 140 passed, 140 total / Tests: 1278 passed, 1278 total** (Snapshots 0, 4.8s). 실패·skip 0.

## 5. 시크릿·컨벤션 — 통과

- 시크릿: 신규 코드에 키·.env 참조 없음.
- 컨벤션: 신규 핸들러 `handleLeave`는 화살표 const, useCallback/useMemo 미사용. LogScreen 내 유일한 `useCallback`은 기존 `handleFocus`(`:259-260`, useFocusEffect 참조안정 — 문서화된 예외)로 이번 스프린트와 무관. enum-style/named-args/파일명 규칙 위반 신규 발생 없음. 문구는 인라인 리터럴이나 단발 토스트 메시지로 기존 패턴(`MuklogDetailRoute.tsx:85`)과 동일.

---

## 미검증 (사유)
- **디바이스 스모크**(토스트 실제 표시·타이밍·솔로 goBack 후 전역 잔존 표시): plan §28대로 사용자 영역. 단위 레벨에서 전역 ToastProvider 경유·문구·tone은 검증 완료.

## 종합
모든 로직 인수조건(AC1~AC4) 통과. 경계면(roomDeleted ↔ 토스트/nav 분기), 실패 미노출, 회귀 0, SPEC 문구 바이트 일치, test/tsc 직접 실행 통과. **스프린트 로직 완료(PASS).**
