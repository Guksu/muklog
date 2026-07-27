# Sprint: 푸시 수신 UX (push-receive-ux)

> 백로그 `push-notifications` **S4(수신 UX)**. architecture.md §5·§7. 선행: S1(토큰등록 ✅)·`push-send`(S2 발송·S3 prefs ✅).
> 발송은 이미 완성됐고(`send-muklog-push` Edge Function이 `data:{roomId, muklogId}`로 Expo Push 발송), **이번 스프린트는 "받은 알림을 앱이 처리하는 것"만** 다룬다.
> TDD 기본, git 금지, 비용 가드레일(폴링/Realtime 0·AWS 0). 외부 SDK(`expo-notifications`)는 **모킹 경계**, 실제 배너·탭·콜드스타트는 **디바이스 스모크(이월)**.

---

## 1. 기능 한줄 정의

푸시 알림을 받은 사용자가 (a) **앱을 켜놓은 상태에서도** 알림 배너를 보고, (b) 알림을 **탭하면** 해당 로그(또는 먹로그 상세)로 이동한다 — 앱이 포그라운드/백그라운드/완전종료(콜드스타트) 어느 상태였든.

---

## 2. 범위

**In-scope**
1. **포그라운드 표시**: `setNotificationHandler`로 앱 사용 중 수신 시 OS 알림 배너를 노출한다(기본은 iOS/Android가 포그라운드 알림을 억제 → 명시 설정 필요).
2. **탭 딥링크 라우팅** (3개 진입 상태 모두):
   - 백그라운드 → 탭: `addNotificationResponseReceivedListener`
   - 콜드스타트(종료 상태에서 탭으로 실행): `getLastNotificationResponseAsync`
   - `data.muklogId` 있으면 **MuklogDetail**, 없으면(로그 단위) **LogScreen** 으로 이동.
3. **네비게이션 준비 타이밍 가드**: 응답이 네비게이터(=AuthGate `authenticated` 트리) 준비 전에 도착하면 **대기(pending) 큐**에 넣고, `authenticated` + navigation ready 시점에 소비. (핵심 엣지케이스 — 아래 §6)
4. **네이티브 안전 로딩**: S1과 동일하게 SDK를 함수 내부 `require`+probe(`requireOptionalNativeModule`)로 로드(Dev Client 미탑재 시 크래시/no-op).

**Out-of-scope (일부러 안 함)**
- **iOS 앱 아이콘 뱃지 카운트** — §3.5 트레이드오프 분석 후 **이번 제외 권장**(발송 페이로드에 `badge` 없음 + 미읽음 카운트 모델 부재). 발송측 변경이 선행되어야 하는 별도 후속.
- **인앱 토스트로 포그라운드 알림 대체** — 기존 `ToastProvider` 인프라로 가능하나 v1은 OS 배너로 통일(§4.1 결정). 토스트는 옵션 후속.
- **Expo receipt 폴링 / 무효 토큰 전체 정리** — `push-send`에서 이미 push ticket의 `DeviceNotRegistered` best-effort 삭제 처리. receipt 기반 전수 정리는 후속.
- **Android 알림 채널 세분화** — 기본 채널 유지(app.json `expo-notifications` 플러그인 기본값). 채널별 중요도/소리 분리는 후속.
- **딥링크 back-stack 재구성**(MuklogDetail 진입 시 뒤로가기가 LogScreen을 거치도록 스택 reset) — §4.2 D5에서 v1은 단순 `navigate` 채택, 트레이드오프만 기록.
- **발송측 변경 일절 없음** — `send-muklog-push`·`useCreateMuklog` 트리거·prefs 게이팅은 이번 스프린트에서 건드리지 않는다(수신 전용).

---

## 3. 데이터 · API 계약

> **DB 변경 0, 마이그레이션 0, Edge Function 0.** 이번 스프린트는 순수 클라이언트(JS-only). 발송이 이미 보내는 페이로드를 **소비**할 뿐이다.

### 3.1 수신 페이로드 (생산자 = `send-muklog-push`, 재확인)

발송 메시지 shape (`supabase/functions/send-muklog-push/index.ts:35-41, 173-179`):
```ts
{ to, title, body, sound: 'default', data: { roomId: string; muklogId: string } }
```
- `data.roomId`: string (항상 존재)
- `data.muklogId`: string — 발송 body에서 없으면 `''`(빈 문자열)로 채워짐. **빈 문자열을 "없음"으로 취급해야 함**(아래 유틸 계약).
- `badge`: **미포함**. `sound: 'default'` 고정.

수신 측에서 `data`는 `Notifications.NotificationResponse.notification.request.content.data` 경로로 도착하며 타입은 `Record<string, unknown>` → 유틸에서 안전 파싱.

### 3.2 순수 유틸 — `notificationTarget.ts` (신규, SDK 미접촉·단위 테스트 대상)

```ts
// 딥링크 목적지 결정 (앱 상태·SDK와 무관한 순수 함수)
type NotificationTarget =
  | { screen: 'MuklogDetail'; params: { muklogId: string } }
  | { screen: 'LogScreen'; params: { roomId: string } };

// data(Record<string, unknown>)에서 목적지를 결정. 판정 불가 시 null.
resolveNotificationTarget({ data }: { data: unknown }): NotificationTarget | null;
```
**판정 규칙 (단일 출처)**:
1. `data`가 객체가 아니면 → `null`.
2. `muklogId`가 **비어있지 않은 문자열**이면 → `{ screen: 'MuklogDetail', params: { muklogId } }`.
3. 아니고 `roomId`가 비어있지 않은 문자열이면 → `{ screen: 'LogScreen', params: { roomId } }`.
4. 둘 다 없으면 → `null`(라우팅 안 함, no-op).

> `Routes.MuklogDetail`/`Routes.LogScreen` 라우트명·파라미터명은 `src/navigation/routes/routes.ts:38,41`과 **정확히 일치**해야 한다(`LogScreen`={roomId}, `MuklogDetail`={muklogId}). MuklogDetail은 muklogId만으로 roomId를 자체 조회하므로(routes.ts:40 주석) roomId를 넘기지 않는다.

### 3.3 포그라운드 핸들러 설정 계약

`setNotificationHandler({ handleNotification: async () => (...) })` 반환값(**설치된 expo-notifications@0.29.14 실측 shape**):
```ts
{ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }
```
- ⚠️ 실측 정정(구현 확인, 2026-07-27): **0.29.14의 `NotificationBehavior`는 여전히 구 키 `shouldShowAlert`** 이며 `shouldShowBanner`/`shouldShowList`는 없다. (기획 당시 "SDK52에서 분리됐다"는 가정은 오검 — 분리키는 이후 버전 도입.) 구현은 `{ shouldShowAlert:true, shouldPlaySound:true, shouldSetBadge:false }`. 테스트는 "배너 노출 + 뱃지 false" 관찰로 표현(특정 키 하드코딩 과결합 금지). 향후 SDK 업그레이드로 분리키가 도입되면 `FOREGROUND_BEHAVIOR` 상수만 갱신.
- `shouldSetBadge: false` — 뱃지 OUT(§3.5)와 정합.

### 3.4 네비게이션 라우팅 계약 (신규 도입)

현재 코드에 `navigationRef`·`linking` 설정 **없음**(정찰 확인). NavigationContainer는 `AuthGate` `authenticated` 케이스에서만 렌더(`src/navigation/AuthGate/AuthGate.tsx:45`). 따라서:

- **`navigationRef` 신규**: `createNavigationContainerRef<AppStackParamList>()` 를 `src/navigation`에 두고 `<NavigationContainer ref={navigationRef}>`에 부착. `navigationRef.isReady()`로 준비 확인.
- **대기 큐(pending) 모듈** — `pendingDeepLink.ts`(모듈 싱글턴, 순수·테스트 대상): `setPending(target)`, `takePending(): NotificationTarget | null`(소비 시 비움), `peekPending()`. React 트리 밖에서도 접근 가능해야 함(리스너가 AuthProvider보다 먼저 등록될 수 있으므로).
- **소비 규칙**: `navigationRef.isReady() === true`(=authenticated 트리 렌더됨)일 때만 `navigationRef.navigate(target.screen, target.params)` 호출. 준비 전이면 `setPending`. navigation ready 시점(또는 authenticated 전이 시)에 `takePending` → 있으면 navigate.

### 3.5 뱃지 트레이드오프 (planner 판단 → **OUT 권장**)

| 옵션 | 내용 | 판단 |
|---|---|---|
| A. 뱃지 미구현 (권장) | 발송 페이로드에 `badge` 없음 + 서버에 "미읽음 카운트" 모델 없음 → 정확한 숫자를 만들 수 없다. `shouldSetBadge:false`로 두고 뱃지 자체를 다루지 않음. | ✅ **이번 채택.** 잘못된 뱃지(항상 1, 안 지워짐)는 오히려 UX 악화. |
| B. 앱 활성 시 뱃지 0으로 클리어 | `setBadgeCountAsync(0)`을 앱 foreground 시 호출. | 현재 뱃지를 세팅하는 주체가 없어 **실질 no-op**. 세팅 없이 클리어만 하는 코드는 죽은 코드. |
| C. 발송에 `badge` 추가 + 미읽음 모델 | 발송측(`send-muklog-push`)이 수신자별 미읽음 수를 계산해 payload `badge`에 실음. | 발송측 변경 + 미읽음 상태 테이블/조회 필요 = **별도 스프린트**(수신 UX 범위 초과). |

**결정 제안**: **A 채택**(뱃지 OUT). C는 "미읽음 카운트" 기능을 별도 백로그로 분리 제안. — ★ 리더 확인 포인트지만 리더 지시대로 "트레이드오프와 함께 제안"에 해당하므로 A로 진행하고 flag만.

---

## 4. 화면 · UX

전용 신규 화면 **없음**. 기존 화면으로의 이동 + OS 알림 배너만.

### 4.1 포그라운드 표시 방식 결정 (D — planner)
- **D1: OS 배너(`setNotificationHandler`)** 채택. 인앱 토스트 대비 장점: (1) React 트리/Provider 위치 제약 없음(핸들러는 전역), (2) 배경/포그라운드 시각 일관, (3) 테스트가 핸들러 반환 관찰로 단순. `ToastProvider` 기반 인앱 토스트는 **옵션 후속**으로 남김.

### 4.2 딥링크 목적지·네비게이션 UX 결정
- **D2**: `muklogId`(비어있지 않음) → **MuklogDetail**, 로그 단위(muklogId 없음) → **LogScreen**. (발송은 항상 muklogId를 실으므로 사실상 MuklogDetail이 기본 경로.)
- **D3**: 세 진입 상태(포그라운드 유지 중 탭·백그라운드 탭·콜드스타트) 모두 동일 목적지로 수렴.
- **D4**: 인증 안 된 상태에서 알림 탭 → **로그인 완료(authenticated)+nav ready 후 목적지로 이동**(대기 큐). 로그인 안 하면 이동 보류(폐기 아님, authenticated 전이 시 소비). 큐는 1건만 유지(최신 탭이 이전 대기 대체).
- **D5**: v1은 `navigationRef.navigate`(단순). MuklogDetail 진입 시 뒤로가기는 HomeTabs(LogList)로 감 — LogScreen을 거치지 않음. 스택 reset으로 `[HomeTabs, LogScreen, MuklogDetail]` 재구성은 **OUT**(트레이드오프: 정확한 back nav vs 복잡도, v1은 홈 복귀 허용).

### 4.3 상태별 UX
- **성공(정상)**: 탭 → 해당 상세/로그로 이동.
- **판정 불가**(data에 roomId·muklogId 둘 다 없음): no-op(크래시 없음, 앱은 기본 화면 유지).
- **대상 삭제됨**(먹로그/로그가 이미 삭제): MuklogDetail/LogScreen 진입 후 각 화면의 기존 로딩/에러/빈 상태가 처리(이번 스프린트가 새 에러 UI를 만들지 않음 — 기존 화면 계약에 위임).
- **권한 거부**: 애초에 알림이 안 오므로 수신 UX 무관(권한은 S1 소관).

### 4.4 원티드 토큰
- 신규 UI 없음 → 토큰 사용 지점 없음. OS 배너는 시스템 표준(app.json `expo-notifications` 플러그인의 color `#3366FF`는 기존값 유지).

---

## 5. 작업 목록 (각 인수조건 포함 · TDD)

- [ ] **T1. 순수 유틸 `notificationTarget.ts`** (`src/features/notif/notificationTarget/`) — 단위 테스트 ✅
  - AC1: `data={muklogId:'m1', roomId:'r1'}` → `{screen:'MuklogDetail', params:{muklogId:'m1'}}`.
  - AC2: `data={roomId:'r1', muklogId:''}`(빈 문자열) → `{screen:'LogScreen', params:{roomId:'r1'}}`.
  - AC3: `data={roomId:'r1'}`(muklogId 키 부재) → LogScreen.
  - AC4: `data={}` / `data=null` / `data='x'`(비객체) → `null`.
  - 테스트: `resolveNotificationTarget` 정상·경계(빈 문자열·키 부재)·실패(비객체) 표.

- [ ] **T2. 대기 큐 `pendingDeepLink.ts`** (모듈 싱글턴) — 단위 테스트 ✅
  - AC5: `setPending(t)` 후 `peekPending()`==t, `takePending()`==t 그리고 이후 `peekPending()`==null(소비 시 비움).
  - AC6: `setPending` 2회 → 최신값만 유지(1건 큐).
  - AC7: 초기 `takePending()`==null.
  - 테스트: set/peek/take 상태 전이, 비움, 덮어쓰기.

- [ ] **T3. navigationRef 도입 + 라우팅 디스패처** — 훅/함수 테스트 ✅(navigationRef 모킹)
  - `navigateToTarget({ target })`: `navigationRef.isReady()` true → `navigate(target.screen, target.params)`; false → `setPending(target)`.
  - AC8: ready=true → `navigationRef.navigate`가 정확한 라우트명·params로 1회 호출, 큐 비움.
  - AC9: ready=false → navigate 미호출, `pendingDeepLink`에 저장.
  - AC10: `<NavigationContainer ref={navigationRef}>` 배선(AuthGate.tsx:45) — 렌더 후 `navigationRef.isReady()` 접근 가능(스모크/단위: 컨테이너 모킹 렌더).

- [ ] **T4. 수신 훅 `usePushReceive`** (`src/features/notif/usePushReceive/`) — 훅 테스트 ✅(`expo-notifications` 모킹, S1 패턴 재사용)
  - 마운트 시(네이티브 가용): (a) `setNotificationHandler`로 포그라운드 배너 설정, (b) `addNotificationResponseReceivedListener` 등록, (c) `getLastNotificationResponseAsync`로 콜드스타트 응답 1회 확인 → 각 응답을 `resolveNotificationTarget`→`navigateToTarget`.
  - AC11(포그라운드 설정): 마운트 시 `setNotificationHandler`가 1회 호출되고 반환 핸들러가 배너 노출(shouldShowBanner 계열 true)을 반환한다.
  - AC12(백그라운드 탭): 리스너 콜백에 `{notification:{request:{content:{data:{muklogId:'m1'}}}}}` 전달 → `navigateToTarget({screen:'MuklogDetail',...})` 경로.
  - AC13(콜드스타트): `getLastNotificationResponseAsync`가 응답 반환 → 동일 라우팅. null 반환 → no-op.
  - AC14(판정 불가): data에 id 없음 → navigate/setPending 미호출.
  - AC15(언마운트): 리스너 `remove()`/subscription 해제(중복 등록·누수 방지).
  - AC16(멱등): 재마운트 시 `setNotificationHandler`·리스너·콜드스타트 조회가 중복 폭주하지 않음(가드 — S1 ref 가드 준용).
  - AC17(네이티브 미탑재): `requireOptionalNativeModule` probe null → SDK 접촉 0, throw 없음(Dev Client 미탑재 안전).

- [ ] **T5. 대기 큐 소비 배선** — authenticated + nav ready 시 pending 소비
  - AC18: unauthenticated에서 탭 응답 도착 → `pendingDeepLink`에 저장, navigate 미호출.
  - AC19: 이후 `authenticated` 전이 + nav ready → `takePending`으로 목적지 navigate 1회, 큐 비움. (테스트: navigationRef ready 토글 + pending 존재 → navigate 발생)
  - AC20: pending 없음 상태로 authenticated 전이 → navigate 미호출(no-op).

- [ ] **T6. 진입부 배선** — `usePushReceive`를 앱 트리에 1회 구동
  - 포그라운드 핸들러/리스너는 전역이라 인증 무관하게 살아있어야 하고(콜드스타트 탭이 로그인 전에도 도착), 라우팅은 authenticated 트리에서 소비. 배치: 리스너/핸들러 등록은 상위(AuthProvider 또는 App 트리), navigate 소비는 navigationRef ready 게이트로.
  - AC21: 앱 부팅 시 `usePushReceive`가 1회 구동(핸들러·리스너 등록). 기존 소비처 회귀 0.
  - AC22(회귀): `useRegisterPushToken`(S1) 동작·`useAuth` 계약 불변(`npm test` green).

- [ ] **T7. `npm test` 전체 green + `tsc --noEmit` 0 에러** — 신규 spec 포함 회귀 0(완료 기준).

---

## 5-1. 테스트 케이스 (TDD)

**단위 (순수 유틸 — SDK 미접촉)**
- `notificationTarget.spec.ts`: AC1~AC4(정상 MuklogDetail / 경계 빈 muklogId·키 부재→LogScreen / 실패 비객체·빈객체→null).
- `pendingDeepLink.spec.ts`: AC5~AC7(set/peek/take/비움/덮어쓰기/초기 null).

**훅 (expo-notifications·navigationRef 모킹 — S1 spec 패턴 재사용)**
- `usePushReceive.spec.ts`: AC11~AC17.
  - 모킹: `jest.mock('expo-notifications', () => ({ setNotificationHandler: jest.fn(), addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })), getLastNotificationResponseAsync: jest.fn() }))` + `jest.mock('expo-modules-core', ...)` probe non-null 기본, 미탑재 케이스 null 오버라이드(S1 `useRegisterPushToken.spec.ts:8-19, 202` 방식).
  - `jest.requireMock`으로 참조 취득(외부 변수 팩토리 타이밍 회피 — S1 주석 준용).
- `navigateToTarget`/디스패처 spec: AC8~AC9(ready true/false 분기).
- 대기 큐 소비 spec: AC18~AC20(unauth→pending, auth+ready→navigate).

**모킹/스모크 경계 (단위 대상 아님 — testing-strategy 준수)**
- 실제 OS 배너 렌더, 실제 알림 탭, 실제 콜드스타트 실행 → **디바이스 스모크(이월)**. 실기기에서 발송→포그라운드 배너·백그라운드 탭·킬 상태 탭 3케이스 확인.
- `expo-notifications` 자체 동작은 테스트 안 함 — 우리 코드의 호출/매핑/라우팅만 검증.

---

## 6. 엣지케이스 (다각도)

- **네비게이션 준비 타이밍(핵심)**: 콜드스타트 시 `getLastNotificationResponseAsync` 응답이 NavigationContainer(=authenticated 트리) 렌더 전에 도착 → **즉시 navigate 불가**. → 대기 큐 저장 후 nav ready+authenticated에서 소비(D4·T5). navigationRef가 아직 `isReady()=false`인 구간을 반드시 통과.
- **인증 상태**: (a) 로그아웃 상태에서 탭 → 로그인 화면 거쳐야 함 → pending 유지, authenticated 후 이동. (b) 세션 만료로 재로그인 → 동일. (c) 다른 계정으로 로그인 → 그 계정이 해당 로그 멤버가 아니면 LogScreen/MuklogDetail가 RLS로 빈/에러(기존 화면 처리, 이번 스프린트 무관).
- **권한**: 알림 권한 거부 상태 → 애초에 수신 없음(수신 UX 무관). 나중에 OS 설정에서 허용 → 이후 알림부터 정상.
- **동시성(커플 2명·다기기)**: 두 기기 각각 독립 수신·독립 라우팅. 한 사용자 다기기도 각 기기에서 개별 처리(공유 상태 없음). 발송은 작성자 제외 다른 멤버에게만(발송측 게이팅) → 수신 측 추가 필터 불필요.
- **대상 삭제/부재**: 탭한 먹로그/로그가 이미 삭제됨 → MuklogDetail/LogScreen 진입 후 기존 로딩→빈/에러 상태가 흡수(이번 스프린트가 새 방어 UI를 만들지 않음, 크래시만 없으면 됨). `muklogId=''`(발송이 빈값 실은 경우) → LogScreen 폴백(§3.2 규칙 2).
- **네트워크 실패**: 라우팅 자체는 로컬(네트워크 불요). 목적지 화면의 데이터 로드 실패는 그 화면 책임.
- **중복/연타**: 짧은 시간 여러 알림 탭 → 대기 큐 1건 유지(최신 우선, D4). 리스너 중복 등록은 언마운트 `remove`+멱등 가드로 방지(AC15·AC16).
- **입력 한계/이상 페이로드**: `data`가 없음/문자열/숫자/빈 객체 → `resolveNotificationTarget`이 `null`로 안전 흡수(AC4). muklogId만 있고 roomId 없음 → MuklogDetail(자체 roomId 조회).
- **네이티브 미탑재(Dev Client)**: probe null → 핸들러/리스너 미등록, throw 없음(AC17). Expo Go/미탑재 빌드에서 크래시 0.
- **포그라운드 중복 표시**: 사용자가 바로 그 먹로그 상세를 보고 있는데 배너가 뜸 → v1 허용(억제 로직은 후속 폴리시).

---

## 7. QA 교차검증 경계면 (qa-logic)

1. **발송 payload `data:{roomId, muklogId}` ↔ `resolveNotificationTarget`** — 키명(`roomId`/`muklogId`) 정확 일치, `muklogId:''`(발송 폴백 빈값) 처리, MuklogDetail vs LogScreen 분기.
2. **`resolveNotificationTarget` 출력 ↔ `Routes`/`AppStackParamList`** — 라우트명(`MuklogDetail`/`LogScreen`)·파라미터명(`muklogId`/`roomId`)이 `src/navigation/routes/routes.ts:38,41`와 일치. MuklogDetail에 roomId 미전달(자체 조회) 정합.
3. **`expo-notifications` 모킹 ↔ `usePushReceive`** — `setNotificationHandler`/`addNotificationResponseReceivedListener`(+`remove`)/`getLastNotificationResponseAsync` 호출 시그니처·횟수·언마운트 해제.
4. **네이티브 probe(`requireOptionalNativeModule`) ↔ SDK 접촉** — 미탑재 null 시 SDK 미호출·throw 0(S1과 동일 패턴).
5. **대기 큐 ↔ navigation ready/authenticated 게이트** — unauth/nav-not-ready에서 저장, authenticated+ready에서 1회 소비·큐 비움. 중복 소비 없음.
6. **`navigationRef` ↔ NavigationContainer(AuthGate.tsx:45)** — ref 부착, `isReady()` 게이트, `navigate` 호출 계약.
7. **회귀** — S1 `useRegisterPushToken`·`useAuth`(authenticated.userId)·기존 네비게이션 흐름 불변(`npm test`/`tsc` green).
8. **포그라운드 핸들러 shape** — SDK 52 `NotificationBehavior`(shouldShowBanner/shouldShowList) 실제 타입과 정합, 배너 노출 반환.

*(qa-visual: 신규 UI 없음 → 비주얼 충실도 대상 없음. OS 배너는 시스템 표준. 사실상 no-op — 인앱 토스트를 후속에서 도입하면 그때 활성.)*

---

## 8. 비용 가드레일 체크

- **폴링 0 / Realtime 0 / 상시연결 0**: 수신은 OS 푸시 이벤트/리스너 기반(수동 조회 없음). `getLastNotificationResponseAsync`는 콜드스타트 1회.
- **외부 호출 0**: 라우팅은 전부 로컬. Kakao·Supabase 신규 호출 없음(목적지 화면의 기존 조회는 기존대로).
- **AWS 0 / 신규 인프라 0**: DB·Edge Function·마이그레이션 변경 없음. Expo Push는 발송측(S2, 무료)이며 수신은 클라 로컬 처리.
- **네이티브 재빌드 불필요**: `expo-notifications`는 S1에서 이미 추가·링크됨. S4는 **JS-only**(핸들러/리스너/라우팅) → Dev Client 재빌드 없이 Metro 리로드로 반영. 단 **실제 배너/탭/콜드스타트 검증은 실기기 디바이스 스모크**(시뮬레이터는 실 푸시 수신 제약) — 이월.

---

## 9. 완료 기준 (Definition of Done)

- [ ] T1~T7 완료. 신규 spec 포함 **`npm test` green**(회귀 0) + **`tsc --noEmit` 0 에러**.
- [ ] 순수 유틸(`resolveNotificationTarget`·`pendingDeepLink`) 정상·경계·실패 케이스 통과.
- [ ] `usePushReceive` 훅의 포그라운드 설정·백그라운드 탭·콜드스타트·미탑재·언마운트·멱등 케이스 통과(SDK 모킹).
- [ ] 대기 큐 타이밍 가드(unauth→pending, auth+ready→소비) 통과.
- [ ] 비용 가드레일 체크(§8) 충족: 폴링/Realtime/외부호출/AWS 0, 재빌드 불필요.
- [ ] **실기기 디바이스 스모크(발송→포그라운드 배너·백그라운드 탭·킬 상태 탭 3케이스)는 사용자 환경 이월.**

## 10. architecture.md 갱신 제안 (구현·확정 후 반영)
- **§5 백로그**: `push-notifications S4(수신 UX)` 행 상태를 "예정(출시 후 후속)"에서 "구현(코드·모킹 통과, 디바이스 스모크 이월)"로 갱신.
- **§7 미해결**: 푸시 항목에 S4 수신 UX 완료(포그라운드 배너·탭 딥링크·콜드스타트·대기 큐 타이밍 가드, 뱃지 OUT) 기록. 뱃지 카운트는 별도 "미읽음 모델" 백로그로 분리 제안.
