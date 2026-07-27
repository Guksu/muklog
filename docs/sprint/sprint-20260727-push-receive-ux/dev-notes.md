# Dev Notes — push-receive-ux (S4 수신 UX)

> 구현: developer. 검증: `npm test` 전체 통과(187 suites / 1749 tests) + `npx tsc --noEmit` 0 에러.
> 범위: 순수 클라이언트(JS-only). DB/Edge/마이그레이션/재빌드 **0**. 발송(S2 `send-muklog-push`)이 이미 보내는 payload를 **수신·라우팅**만.
> 신규 UI 없음(OS 배너 + 기존 화면 이동) → qa-visual 대상 사실상 없음.

---

## 1. 생산자 ↔ 소비자 매핑 (QA 교차검증용)

### 딥링크 end-to-end
| 생산자 | 계약 shape | 소비자 |
|--------|-----------|--------|
| `send-muklog-push`(발송, 무변경) | `data: { roomId: string; muklogId: string }` (muklogId 없으면 `''` 폴백) | `usePushReceive` → `resolveNotificationTarget` |
| `resolveNotificationTarget({ data })` | `{ screen:'MuklogDetail', params:{muklogId} }` \| `{ screen:'LogScreen', params:{roomId} }` \| `null` | `navigateToTarget` / `usePushReceive` |
| `navigateToTarget({ target })` | ready→`navigationRef.navigate(screen, params)` / not-ready→`setPending({ target })` | `navigationRef`(SDK) / `pendingDeepLink` |
| `pendingDeepLink`(싱글턴 1건) | `setPending`/`takePending`/`peekPending` | `consumePendingDeepLink` |
| `consumePendingDeepLink()` | ready+pending→navigate·큐 비움 | `AuthGate` `NavigationContainer onReady` |

**라우트명·파라미터명 정합(경계면 2):** `NotificationTarget.screen`은 `typeof Routes.MuklogDetail`/`typeof Routes.LogScreen` 리터럴에 바인딩 → `AppStackParamList`(routes.ts:38,41)와 컴파일 타임 정합. `MuklogDetail`엔 `muklogId`만 전달(roomId 자체 조회, routes.ts:40 주석).

### 세 진입 상태 → 동일 목적지 수렴 (usePushReceive, T4)
| 진입 상태 | SDK 진입점 | 처리 |
|-----------|-----------|------|
| 포그라운드 수신 | `setNotificationHandler` | OS 배너 표시(`shouldShowAlert:true`, `shouldSetBadge:false`) |
| 백그라운드 탭 | `addNotificationResponseReceivedListener` | `resolveNotificationTarget`→`navigateToTarget` |
| 콜드스타트 탭 | `getLastNotificationResponseAsync`(1회) | 동일. null이면 no-op |

### 네비게이션 준비 타이밍 가드 (핵심 엣지케이스, T5)
- `navigationRef`는 `AuthGate`의 `<NavigationContainer ref={navigationRef} onReady={handleNavReady}>`에 부착. NavigationContainer는 **authenticated 트리에서만** 렌더 → `isReady()=true`는 곧 "authenticated+렌더 완료".
- 미인증/부팅 중 탭 도착 → `navigateToTarget`이 `isReady()=false`를 보고 `pendingDeepLink`에 1건 저장(navigate 안 함).
- authenticated 전이 + 컨테이너 마운트 → `onReady` 발화 → `consumePendingDeepLink`가 큐를 1회 소비·navigate·비움.

---

## 2. 구현/변경 파일

### 신규 (feature: `src/features/notif`)
- `notificationTarget/` — `resolveNotificationTarget`(순수 유틸) + `NotificationTarget` 타입. **단위**(8 케이스, AC1~AC4 + 경계).
- `pendingDeepLink/` — 모듈 싱글턴 큐(`setPending`/`takePending`/`peekPending`). **단위**(3 케이스, AC5~AC7).
- `deepLinkRouter/` — `navigateToTarget`(T3) + `consumePendingDeepLink`(T5). navigationRef+큐 통합. **단위**(6 케이스, AC8~AC9·AC18~AC20; navigationRef만 모킹, 큐는 실 싱글턴).
- `usePushReceive/` — 수신 훅(핸들러·리스너·콜드스타트). **훅 단위**(9 케이스, AC11~AC17; expo-notifications/expo-modules-core/deepLinkRouter 모킹).

### 신규 (navigation)
- `src/navigation/navigationRef/` — `createNavigationContainerRef<AppStackParamList>()` 전역 ref.

### 수정
- `src/navigation/AuthGate/AuthGate.tsx` — `<NavigationContainer>`에 `ref={navigationRef}` + `onReady={handleNavReady}`(→`consumePendingDeepLink`) 배선(T5).
- `src/navigation/AuthGate/AuthGate.spec.tsx` — react-navigation 모킹에 `createNavigationContainerRef` 추가, `deepLinkRouter` 모킹, onReady→consume 배선 테스트 1건 추가.
- `App.tsx` — 루트에서 `usePushReceive()` 1회 구동(T6).
- `App.spec.tsx` — `usePushReceive` 모킹 + AC21(1회 구동) 테스트 추가.

### 계약 세부
- **포그라운드 핸들러 shape(경계면 8):** 설치된 `expo-notifications@0.29.14`의 `NotificationBehavior`는 **`shouldShowAlert`**(구 키)이다 — plan이 가정한 SDK52 분리키(`shouldShowBanner`/`shouldShowList`)가 **아님**. plan 지침("설치된 버전 실키에 맞춘다")대로 실제 타입에 정합: `{ shouldShowAlert:true, shouldPlaySound:true, shouldSetBadge:false }`. 테스트는 "배너 노출 + 뱃지 false" 관찰(특정 키 과결합 회피).
- **네이티브 probe(경계면 4):** `requireOptionalNativeModule('ExpoNotificationsHandlerModule')`·`('ExpoNotificationsEmitter')` 둘 다 non-null일 때만 SDK 접촉(S1 패턴). 미탑재(Dev Client 재빌드 전)면 no-op·throw 0.

---

## 3. 비용 가드레일 (§8 충족)
- 폴링 0 / Realtime 0 / 상시연결 0 — 수신은 OS 푸시 이벤트/리스너 기반. `getLastNotificationResponseAsync`는 콜드스타트 1회.
- 외부 호출 0(라우팅 전부 로컬) · AWS 0 · DB/Edge/마이그레이션 0.
- 네이티브 재빌드 불필요 — `expo-notifications`는 S1에서 이미 링크됨. S4는 JS-only(Metro 리로드 반영).

---

## 4. 엣지케이스 처리
- **판정 불가(id 없음/비객체/빈 문자열)** → `resolveNotificationTarget` null → navigate/setPending 미호출(크래시 0).
- **muklogId=''(발송 폴백)** → "없음" 취급 → LogScreen 폴백.
- **미인증 탭** → pending 저장, authenticated+ready에서 소비(폐기 아님).
- **연타/중복 탭** → 큐 1건 유지(최신 우선).
- **네이티브 미탑재** → SDK 미접촉·no-op.
- **대상 삭제됨** → MuklogDetail/LogScreen 진입 후 각 화면 기존 로딩/에러/빈 상태에 위임(이번 스프린트가 새 방어 UI 안 만듦).

---

## 5. 미완/후속 (디바이스 스모크 이월 — 사용자 환경)
- **실기기 디바이스 스모크**(단위 불가): 발송→(a) 포그라운드 배너, (b) 백그라운드 탭 딥링크, (c) 킬 상태 탭 콜드스타트 3케이스. 시뮬레이터는 실 푸시 수신 제약 → 실기기 필요.
- **뱃지 카운트 OUT(§3.5 A안 채택)**: 발송 payload에 `badge` 없음 + 미읽음 모델 부재 → `shouldSetBadge:false`. "미읽음 카운트 모델"은 별도 백로그로 분리 제안(발송측 변경 필요).
- **딥링크 back-stack 재구성 OUT(D5)**: v1은 단순 `navigate`(MuklogDetail 뒤로가기 → HomeTabs). 스택 reset은 후속.
- **architecture.md 갱신 제안(§10)**: §5 백로그 S4 상태 "구현(코드·모킹 통과, 디바이스 스모크 이월)", §7 푸시 항목에 수신 UX 완료 + 뱃지 OUT 기록. — 문서 반영 별도.
