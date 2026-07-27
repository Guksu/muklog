# QA Report — Logic / Integration (push-receive-ux, S4)

> 검증자: qa-logic. 방법: 경계면 생산자↔소비자 양쪽 동시 읽기 + 전체 테스트/tsc 실행 + 핵심 로직 mutation(load-bearing) 표본.
> 결과: **로직·통합 전 항목 PASS. 블로킹 이슈 0.** `npm test` 187 suites / 1749 tests green, `tsc --noEmit` 0 에러.

---

## 1. 요약

| 구분 | 결과 |
|------|------|
| 통합 정합성(경계면 8종) | ✅ PASS |
| 기능 스펙(AC1~AC22) | ✅ PASS (단, 실기기 3케이스는 계획대로 디바이스 스모크 이월) |
| 보안·비용 가드레일 | ✅ PASS (DB/Edge/마이그레이션/네이티브 모듈/폴링/Realtime 변경 0) |
| TDD·테스트 품질 | ✅ PASS (load-bearing mutation 확인) |
| 코드 컨벤션 | ✅ PASS (useCallback/useMemo 0, 화살표 함수, named-object 인자, useEffect 명명, 파일명=심볼) |
| 메모리 규칙(네이티브 lazy require) | ✅ PASS |

---

## 2. 경계면 교차검증 (양쪽 동시 읽기)

**① 발송 payload ↔ resolveNotificationTarget** — PASS
- 생산자 `send-muklog-push/index.ts:143-144,178`: `roomId`/`muklogId`는 항상 string(비string→`''`), `data:{roomId, muklogId}`. roomId 빈값이면 400으로 발송 자체 차단(:145) → 수신 payload의 roomId는 항상 비어있지 않음.
- 소비자 `notificationTarget.ts:13,32-40`: `nonEmptyString`이 `''`를 "없음"으로 정확히 배제 → muklogId 비면 LogScreen 폴백. 발송 폴백 빈값 계약과 정합.

**② resolveNotificationTarget 출력 ↔ Routes/AppStackParamList** — PASS
- `NotificationTarget`이 `typeof Routes.MuklogDetail`/`typeof Routes.LogScreen` 리터럴에 바인딩(`notificationTarget.ts:8-10`) → 라우트명 오타 컴파일 타임 차단.
- 파라미터명: `MuklogDetail`={muklogId}, `LogScreen`={roomId} — `routes.ts:38,41`와 일치. MuklogDetail에 roomId 미전달(자체 조회, routes.ts:40 주석) 정합.

**③ expo-notifications ↔ usePushReceive** — PASS
- `setNotificationHandler`(1회)·`addNotificationResponseReceivedListener`(+`remove`)·`getLastNotificationResponseAsync`(1회) 호출 시그니처·횟수·언마운트 해제 모두 spec에서 검증(AC11·AC15·AC16). 데이터 경로 `notification.request.content.data`(`usePushReceive.ts:29-34`)가 모킹 shape와 일치.

**④ 네이티브 probe ↔ SDK 접촉** — PASS
- `usePushReceive.ts:41-50` `requireOptionalNativeModule('ExpoNotificationsHandlerModule')`·`('ExpoNotificationsEmitter')` 둘 다 non-null일 때만 `require('expo-notifications')`(:63-68). 미탑재→SDK 미접촉·throw 0(AC17 검증). **S1 패턴·메모리 규칙(native-module-lazy-require) 준수** — expo-notifications는 top-level import 아님, 함수 내부 require+try/catch.

**⑤ 대기 큐 ↔ nav ready/authenticated 게이트** — PASS
- `deepLinkRouter.ts:29-35` navigateToTarget: ready→navigate / not-ready→setPending. `:41-46` consumePendingDeepLink: not-ready면 큐 유지(no-op), ready+pending이면 1회 소비·비움. spec에서 unauth→pending, auth+ready→navigate·큐 비움 검증(AC9·AC18~AC20).

**⑥ navigationRef ↔ NavigationContainer** — PASS
- `AuthGate.tsx:51` `<NavigationContainer ref={navigationRef} onReady={handleNavReady}>`. onReady→consumePendingDeepLink 배선 spec 검증(AuthGate.spec `:164-173`). NavigationContainer는 authenticated 트리에서만 렌더 → `isReady()=true`가 곧 "authenticated+렌더 완료"라는 설계 가정 성립.

**⑦ 회귀(S1·useAuth·기존 네비)** — PASS
- 전체 187 suites green. 변경 파일은 App.tsx(usePushReceive 1회 구동)·AuthGate.tsx(ref+onReady) 2건뿐, 기존 화면 비주얼/로직 무변경.

**⑧ 포그라운드 핸들러 shape** — PASS
- `FOREGROUND_BEHAVIOR = { shouldShowAlert:true, shouldPlaySound:true, shouldSetBadge:false }`(`usePushReceive.ts:18-22`). 설치된 0.29.14 실키(`shouldShowAlert`)에 정합 — plan §3.3의 실측 정정과 일치. 테스트는 "배너 노출 + 뱃지 false" 관찰로 표현(특정 키 과결합 회피, AC11). 뱃지 OUT(§3.5 A안) 정합.

---

## 3. TDD·테스트 품질

- **인수조건↔테스트 대응**: AC1~AC22 전부 대응 spec 존재(notificationTarget 8·pendingDeepLink 3·deepLinkRouter 6·usePushReceive 9·AuthGate onReady 1·App AC21 1).
- **load-bearing 표본 확인**: `notificationTarget.ts`의 빈문자열 가드(`length > 0`)를 `>= 0`으로 일시 변경 → 2 test 즉시 red(AC2·AC4). 원복 완료. 껍데기 단언 아님.
- **경계·실패 경로**: 빈 문자열·키 부재·비객체(null/string/number/undefined)·비문자열 id·판정 불가·네이티브 미탑재·언마운트·멱등 모두 커버.
- **단위 경계 준수**: 외부 SDK(expo-notifications)·navigationRef는 모킹, 순수 유틸·훅만 단위. 실 배너/탭/콜드스타트는 디바이스 스모크로 분리(testing-strategy 준수).

## 4. 가드레일·컨벤션

- `git diff --stat HEAD -- supabase/ package.json app.json plugins/` → 변경 0. **DB·Edge·마이그레이션·네이티브 모듈 추가 0** 확인.
- 신규 notif/navigationRef 코드에 `setInterval/setTimeout/subscribe/realtime/channel` grep 0 → **폴링·Realtime·상시연결 0**. 라우팅 전부 로컬(외부 호출 0). AWS 0.
- 컨벤션: `useCallback/useMemo` grep 0, `export function` 0(모두 화살표 const), 우리 정의 함수 인자 named-object, useEffect 콜백 명명(`initPushReceiveOnMount`)·내부 함수 명명(`handleForegroundNotification`·`routeColdStart`·`cleanupPushReceive`), 파일명=대표 export.

## 5. 비블로킹 관찰(수정 불요, 디바이스 스모크 감시 항목)

- **콜드스타트 이중 전달 가능성**: 일부 expo-notifications 버전에서 킬 상태 탭이 `getLastNotificationResponseAsync`와 `addNotificationResponseReceivedListener` 양쪽에 전달될 수 있음. 이 경우 동일 target 2회 navigate가 되나, react-navigation의 같은 라우트·params navigate는 사실상 no-op(중복 push 없음)이라 무해. plan이 실 동작을 디바이스 스모크로 이월했으므로 코드 결함 아님 — 실기기에서 이중 진입 없는지만 확인 권장.
- **초기 마운트 가드(`initializedRef`)**: 단일 마운트 흐름에선 실질 트리거되지 않는(cleanup이 리셋) 방어 코드지만 무해. AC16 멱등 요건 충족.

## 6. 미검증(계획상 이월 — 사용자 환경)

- 실기기 디바이스 스모크 3케이스(발송→포그라운드 배너 / 백그라운드 탭 딥링크 / 킬 상태 탭 콜드스타트). 시뮬레이터 실 푸시 제약으로 단위 불가 — plan §9·dev-notes §5대로 이월.

---

## 판정

**로직·통합 QA 통과.** 블로킹 이슈 0, 수정 요청 없음. DoD의 코드/모킹 항목 전부 충족(디바이스 스모크만 이월). 스프린트 "로직 완료" 가능.
