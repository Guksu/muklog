# Sprint Plan — push-notifications (슬라이스 분해 + S1 상세)

> 기능: **푸시 알림(상대가 먹로그 추가 시 푸시 발송)**. architecture.md L235 "푸시 알림 — MVP 이후" 착수.
> 규모 XL → 독립 배포 가능한 슬라이스로 분해하고 **이번 스프린트는 S1(디바이스 토큰 등록) 1개만** 상세 기획한다(1 스프린트=1 기능).
> 폴더: `docs/sprint/sprint-20260617-push-notifications/`. **TDD 기본**, git 작업 금지, **비용 가드레일(AWS 미사용·Supabase 무료티어) 최우선.**

---

## A. 슬라이스 분해 (전체 그림)

발송은 "토큰이 있고(S1) → prefs를 서버가 읽을 수 있고(S3) → 이벤트가 토큰·prefs를 조회해 발송(S2)"의 사슬이다.

| 슬라이스 | 범위 | 의존 | 규모 | 산출물 핵심 |
|---|---|---|---|---|
| **S1 디바이스 토큰 등록** ⭐ *(이번)* | `expo-notifications` 권한 요청 + Expo push token 취득 + `device_tokens` 테이블 저장(user별 다기기·token unique upsert). **발송의 전제.** | 없음(기반) | M | 의존성 추가·Dev Client 재빌드·`device_tokens` 테이블/RLS·`useRegisterPushToken`·순수 유틸 |
| **S3 prefs 서버 이전** | 로컬 AsyncStorage prefs(`useNotifPrefs`) → **서버 가독 DB**(`notification_prefs`)로 이전. `useNotifPrefs` 인터페이스는 이미 캡슐화돼 있어 내부만 교체. | S1 무관(병렬 가능) | M | `notification_prefs` 테이블/RLS·`useNotifPrefs` 백엔드 스왑·기존 로컬값 1회 마이그레이션 |
| **S2 발송 트리거** | 먹로그 insert(상대 작성) → 수신자 토큰·prefs(master/perLog) gating → **Expo Push API** 발송. | **S1 + S3 필요** | L | 발송 함수(트리거/Edge Function)·`device_tokens` 조회 DEFINER RPC·prefs gating·Expo Push 호출·실패/무효토큰 정리 |
| (후속) S4 수신 UX | 탭 시 딥링크(해당 로그/먹로그 이동)·앱 뱃지·포그라운드 인앱 표시·무효토큰(DeviceNotRegistered) 정리 | S2 | M | 핸들러·라우팅·뱃지 |

**추천 1번째 = S1(디바이스 토큰 등록).** 발송의 물리적 전제(토큰 없으면 누구에게도 못 보냄)이고, 다른 슬라이스와 의존이 없어 단독 배포 가능하며, **유일하게 네이티브 모듈 추가(Dev Client 재빌드)가 필요**해 가장 먼저 빌드 사이클을 태워야 한다.

**권장 진행 순서: S1 → S3 → S2.** (S2 발송 gating이 서버 가독 prefs를 전제하므로 S3가 S2보다 앞서야 한다. S1·S3는 서로 독립이라 순서 무관하나, 재빌드 리드타임 때문에 S1을 먼저.)

---

## B. 비용 / 인프라 결정 (가드레일 — ★ = 사용자 확인 필요)

| # | 결정 항목 | 권장안 | 근거 / 무료티어 |
|---|---|---|---|
| ★1 | **푸시 발송 채널**: Expo Push Service vs FCM/APNs 직접 | **Expo Push Service** | 무료·서버 단일 HTTP 엔드포인트(`exp.host/--/api/v2/push/send`)·iOS APNs/Android FCM을 Expo가 추상화. FCM/APNs 직접은 인증서·서버키 관리 부담↑. **AWS·유료 서비스 0.** |
| ★2 | **발송 트리거 방식**(S2에서 구현, 지금은 방향만): ① Supabase Database Webhook → Edge Function ② DB 트리거 + `pg_net`으로 Expo API 직접 호출 ③ DB 트리거 → Edge Function | **②/③ 중 택1 (DB 트리거 기반)**, 1순위 = ③ DB 트리거가 발송 Edge Function 호출 | 모두 무료티어. 발송은 **이벤트 트리거(먹로그 insert)** 라 폴링 0. `pg_net` 직접 호출(②)은 Edge Function invocation을 아껴 가장 저렴하나 Expo 응답 파싱·무효토큰 정리 로직이 SQL에 묶임 → ③(Edge Function)이 로직·테스트성 우수. **S2 착수 시 ★재확인.** |
| ★3 | **prefs 로컬→DB 이전 시점** | **S3 (S2 직전)** | 발송 gating(master/perLog 토글)을 서버가 읽어야 하므로 S2 전에 필요. 단, **S1 범위 아님**(S1은 토큰만). |
| ★4 | **Dev Client 재빌드 필요?** | **필요 (S1)** | `expo-notifications`·`expo-device`는 네이티브 모듈 → JS-only 핫리로드 불가. `npm run ios:sim`(+ Android 빌드) 재빌드 후 디바이스 스모크. **시뮬레이터/에뮬레이터는 실 푸시 토큰 취득 불가 → 실기기 스모크 필요.** |
| ★5 | **Android 푸시 자격증명(FCM)** | EAS push 자격증명 사용(빌드 시 설정) | iOS는 Expo가 APNs 대행(개발 빌드). **iOS+Android 동시 출시 — Android 실 토큰은 FCM 프로젝트(`google-services.json`) + app.json expo-notifications 플러그인 설정이 전제** → 라이브 스모크 배치에서 셋업·확인. **S1 코드는 양 플랫폼 공통**(분기 없음), iOS는 즉시 실기기 스모크 가능. |
| - | 폴링·상시 연결 | **없음** | 토큰 등록은 앱 authenticated 시 **1회**. 발송은 이벤트 트리거. Realtime 미사용. |
| - | 외부 호출 | **최소** | S1의 유일한 외부 호출 = Expo push token 취득(앱당 변경 시에만, 무료). |

> ★ 사용자 확인 핵심: **①Expo Push 채널 확정 · ④Dev Client 재빌드 승인 · ⑤Android FCM 설정 필요 인지.** ②(트리거 방식)·③(prefs 이전)은 S2/S3 착수 시 확정해도 됨.

---

# C. 슬라이스 S1 상세 — 디바이스 토큰 등록

## 1. 기능 한줄 정의
로그인(authenticated)한 사용자의 **실기기**에서 푸시 권한을 요청하고 **Expo push token**을 취득해 서버 `device_tokens` 테이블에 **등록/갱신(upsert)** 한다. (발송 자체는 OUT — S2)

## 2. 범위

**In-scope**
- `expo-notifications` + `expo-device` 의존성 추가 + `app.json` 플러그인 등록 + Dev Client 재빌드(사용자).
- authenticated 시 1회: 권한 상태 확인 → 미결정이면 요청 → granted면 Expo push token 취득.
- `device_tokens` 테이블 + RLS(본인 토큰만 R/W) + `expo_push_token` UNIQUE upsert.
- 순수 유틸(권한·플랫폼·페이로드 결정) + 등록 훅 `useRegisterPushToken`(외부 SDK는 모킹).
- best-effort: 거부·시뮬레이터·네트워크 실패 시 조용히 종료(앱 흐름 차단 0).

**Out-of-scope**
- 실제 푸시 **발송**(S2) · prefs **DB 이전**(S3).
- 탭 딥링크·뱃지·포그라운드 인앱 표시·무효토큰(DeviceNotRegistered) 정리(S2/S4).
- 로그아웃 시 토큰 폐기(아래 §8 D6 결정 따름 — 기본 S1 포함 권장).
- 전용 알림 권한 안내 화면/배너(후속, NotifSettings 확장).
- Android FCM 자격증명 라이브 셋업(사용자 인프라, S2 발송 전).

## 3. 데이터 계약

### 3.1 테이블 `device_tokens` (신규 마이그레이션 `20260617120000_device_tokens.sql`)

| 컬럼 | 타입 | 제약 | 비고 |
|---|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` | |
| `user_id` | uuid | NOT NULL, → `profiles(id)` ON DELETE CASCADE | 소유자(=auth.uid()) |
| `expo_push_token` | text | NOT NULL, **UNIQUE** | `ExponentPushToken[...]` 형태. 토큰=기기 식별 단위 |
| `platform` | text | NOT NULL, CHECK in (`'ios'`,`'android'`) | 발송 디버깅·플랫폼별 정리용 |
| `device_name` | text | nullable | `expo-device` `Device.deviceName`(표시용, 옵션) |
| `created_at` | timestamptz | default `now()` | |
| `updated_at` | timestamptz | default `now()` | upsert 시 갱신 |

- 인덱스: `idx_device_tokens_user_id (user_id)` — S2에서 수신자 토큰 조회.
- **UNIQUE(`expo_push_token`)**: 한 토큰=한 행. 기기 계정 전환 시 `on conflict(expo_push_token)`로 `user_id`·`updated_at` 갱신(토큰을 새 소유자로 이전).

### 3.2 RLS 정책 (모든 정책 `auth.uid()` 기반 — 본인 토큰만)
- `device_tokens_select_own`: `select` using `user_id = auth.uid()`
- `device_tokens_insert_own`: `insert` with check `user_id = auth.uid()`
- `device_tokens_update_own`: `update` using/with check `user_id = auth.uid()`
- `device_tokens_delete_own`: `delete` using `user_id = auth.uid()`

> ⚠️ **S2 예고(이번 미구현)**: 발송 시 *상대* 의 토큰을 읽어야 하는데 위 RLS는 본인 토큰만 노출 → **S2에서 `SECURITY DEFINER` RPC(예: `list_room_push_targets(p_room_id)`)** 로 같은 방 멤버 토큰을 조회한다. S1은 컬럼·인덱스만 선반영하고 DEFINER RPC는 만들지 않는다.

### 3.3 클라 upsert 페이로드 (경계면 단일 출처)
```ts
// useRegisterPushToken → supabase.from('device_tokens').upsert(payload, { onConflict: 'expo_push_token' })
type DeviceTokenUpsert = {
  user_id: string;          // auth.uid() (RLS with check 일치 필수)
  expo_push_token: string;  // getExpoPushTokenAsync().data
  platform: 'ios' | 'android';
  device_name: string | null;
  updated_at: string;       // new Date().toISOString() (충돌 시 갱신 표시)
};
```

### 3.4 의존성 / 빌드 계약
- `package.json`: `expo-notifications`, `expo-device` 추가(Expo SDK 52 호환 버전, `npx expo install`로 핀).
- `app.json` `plugins`: `expo-notifications` 추가(아이콘·기본 채널 옵션은 기본값). 기존 `./plugins/withFmtConstevalFix` 유지.
- **EAS `projectId`**(app.json `extra.eas.projectId = ddb39563-...`) 존재 확인 — `getExpoPushTokenAsync({ projectId })`에 사용.
- Dev Client **재빌드 필요**(네이티브 모듈). `npm run ios:sim`은 시뮬레이터 → 토큰 미취득. **실기기 스모크 별도.**

## 4. 화면 / UX
- **전용 화면 없음.** UI 동반 = OS 권한 다이얼로그 1개(권한 요청 시점 OS 표준).
- 권한 거부해도 앱은 정상 동작(발송만 못 받음). 거부 안내 배너/재요청 유도는 **후속**(NotifSettings 확장).
- 권한 요청 시점: **authenticated 직후**(최초 1회). 별도 사전 설명(pre-permission) 화면은 후속.

## 5. 작업 목록 (TDD — 각 작업 Red→Green, AC는 테스트 케이스로 표현)

- [ ] **T1. 의존성·플러그인** — `expo-notifications`·`expo-device` 설치, `app.json` plugins 등록.
  - AC1: `package.json`에 두 패키지가 Expo SDK52 호환 버전으로 존재한다.
  - AC2: `app.json` `plugins`에 `"expo-notifications"`가 포함되고 `withFmtConstevalFix`가 유지된다.
  - AC3(스모크/수동): 사용자가 Dev Client 재빌드 후 앱이 정상 부팅된다(네이티브 링크 오류 0). *(빌드는 사용자 확인 후)*

- [ ] **T2. 순수 유틸 `pushToken.ts`** (단위 테스트 ✅ — 외부 SDK 미접촉 분리).
  - `resolvePermissionDecision({ existingStatus, canAskAgain })` → `'granted' | 'ask' | 'denied'`.
    - 정상: `existingStatus='granted'` → `'granted'`.
    - 경계: `'undetermined'` & `canAskAgain=true` → `'ask'`.
    - 실패: `'denied'` & `canAskAgain=false` → `'denied'`(재요청 안 함).
  - `buildDeviceTokenUpsert({ userId, token, platform, deviceName, nowIso })` → §3.3 페이로드.
    - 정상: 필드가 1:1 매핑되고 `platform`이 `'ios'|'android'`로 좁혀진다.
    - 경계: `deviceName` 누락 → `null`.
  - `isPushCapable({ isDevice })` → boolean (시뮬레이터/에뮬레이터 `false`).
    - 실패: `isDevice=false` → `false`(토큰 취득 단계 진입 금지).

- [ ] **T3. 등록 훅 `useRegisterPushToken({ userId })`** (훅 테스트 ✅, `expo-notifications`·`expo-device`·`supabase` 모킹).
  - AC4(정상): 실기기 + 권한 granted → `getExpoPushTokenAsync` 1회 호출 → `device_tokens.upsert`가 §3.3 페이로드 + `onConflict:'expo_push_token'`로 1회 호출된다.
  - AC5(권한 거부): `resolvePermissionDecision='denied'` → 토큰 취득·upsert **미호출**, throw 없음(앱 흐름 유지).
  - AC6(시뮬레이터): `isPushCapable=false` → 권한 요청·upsert **미호출**.
  - AC7(멱등): 동일 `userId`로 재마운트/리렌더 시 권한·upsert가 **중복 호출되지 않는다**(in-flight/완료 가드, useNotifPrefs의 ref 가드 패턴 준용).
  - AC8(네트워크 실패): upsert reject → `console.warn` 후 throw 없음(best-effort, 다음 실행 재시도).
  - AC9(userId 없음): `userId` 빈/미인증 → 아무 동작 안 함.

- [ ] **T4. AuthProvider/진입부 배선** — authenticated(`userId`) 시 `useRegisterPushToken({ userId })` 1회 구동.
  - AC10: `status==='authenticated'`로 전이하면 등록 흐름이 트리거되고, `unauthenticated`·`loading`에선 트리거되지 않는다(테스트: authenticated만 SDK 호출).
  - AC11: 계약 보존 — 기존 `userId:string` 소비처 회귀 0(`npm test` green).

- [ ] **T5. 마이그레이션 `20260617120000_device_tokens.sql`** — §3.1 테이블 + §3.2 RLS 4종 + 인덱스.
  - AC12(스모크/라이브 이월): `supabase db push` 후 본인 토큰 select/insert는 통과, 타인 `user_id` insert는 RLS 거부(42501).
  - AC13: 같은 `expo_push_token`을 다른 `user_id`로 upsert(onConflict) → 행 1개 유지·`user_id` 갱신(계정 전환).

- [ ] **T6.(D6 결정 시) 로그아웃 토큰 폐기** — signOut 경로에서 현재 기기 토큰 `delete`(best-effort).
  - AC14: 로그아웃 시 해당 기기 `expo_push_token` 행이 삭제된다(실패는 warn, 로그아웃 차단 0).

- [ ] **T7. `npm test` 전체 green** — 신규 spec 포함 회귀 0(완료 기준).

## 6. 엣지케이스 (다각도)

- **권한**: 미결정(첫 요청)·거부(`canAskAgain=false` → 재요청 금지)·나중에 OS 설정에서 허용(다음 authenticated 시 재시도로 회복)·iOS provisional 권한(이번엔 표준 요청만).
- **빈/환경**: 시뮬레이터·에뮬레이터(실 토큰 취득 불가 → skip)·Android FCM 미설정(토큰 취득 실패 → warn·skip, 발송은 S2)·`projectId` 누락(취득 실패 → warn).
- **동시성(커플 2명·다기기)**: 한 user가 폰+태블릿 → `device_tokens` 다행 공존(user_id별 다수). 두 멤버가 각자 등록 → 독립 행. **기기 계정 전환**(동일 폰, A→B 로그인) → `expo_push_token` UNIQUE 충돌 → onConflict로 `user_id`=B 갱신(A는 더 이상 그 토큰으로 못 받음 — 의도된 동작).
- **네트워크 실패**: upsert 타임아웃/오프라인 → warn, 앱 흐름 유지, 다음 authenticated에서 재시도(폴링 아님).
- **토큰 변경**: 앱 재설치·복원·Expo SDK 업그레이드로 토큰 회전 → 다음 실행 upsert가 새 행 insert(구 토큰 행은 S2 발송 시 DeviceNotRegistered로 정리 — S4).
- **입력 한계**: `platform`은 `ios|android`만(CHECK) — 그 외(web 등) 미지원·skip.
- **멱등/중복**: 토큰 갱신 토큰갱신 이벤트 다발 → AC7 가드로 중복 upsert 방지.
- **계정 삭제/로그아웃**: profiles 삭제 → ON DELETE CASCADE로 토큰 정리. 로그아웃 시 토큰 폐기(D6).

## 7. QA가 교차검증할 경계면 목록 (qa-logic)

1. **`device_tokens` 컬럼 ↔ §3.3 upsert 페이로드** — 컬럼명/타입/`platform` CHECK 일치, `onConflict:'expo_push_token'` 키 정확.
2. **RLS ↔ 클라 쿼리** — select/insert/update/delete 모두 `user_id=auth.uid()`; 타인 토큰 노출/조작 불가. (S2 DEFINER RPC는 이번 미존재 확인.)
3. **`expo-notifications`/`expo-device` 모킹 ↔ `useRegisterPushToken`** — `getPermissionsAsync`/`requestPermissionsAsync`/`getExpoPushTokenAsync`/`Device.isDevice` 호출 시그니처·횟수.
4. **`useRegisterPushToken` ↔ AuthProvider** — `authenticated.userId` 계약으로만 구동, 다른 상태에선 미구동(회귀 0).
5. **app.json plugin·projectId ↔ 토큰 취득** — `getExpoPushTokenAsync({ projectId })`가 `extra.eas.projectId`를 쓰는지.
6. **멱등 가드 ↔ 재렌더** — 동일 userId 중복 호출 방지(ref 가드).
7. **비용 가드레일** — 폴링/Realtime/상시연결 0, 외부 호출은 토큰 취득 1회뿐.

*(qa-visual: S1은 전용 UI 없음 → 비주얼 충실도 대상 거의 없음. OS 권한 다이얼로그는 시스템 표준. 비주얼 QA는 사실상 no-op, 후속 안내 배너 시 활성.)*

## 8. 결정 사항 (D — planner 제안, ★는 사용자 확인)
- **D1**: 발송 채널 = **Expo Push Service**(★B-1).
- **D2**: 권한 요청 시점 = **authenticated 직후 1회**(pre-permission 설명 화면은 후속).
- **D3**: 토큰 식별 단위 = **`expo_push_token` UNIQUE**(기기 계정 전환은 onConflict로 소유자 이전).
- **D4**: S1은 **토큰만**. 발송·prefs gating·딥링크·무효토큰 정리는 S2/S3/S4.
- **D5**: 외부 SDK(`expo-notifications`·`expo-device`)는 **모킹 단위/훅 테스트** + **실기기 디바이스 스모크**(testing-strategy 경계 준수). 실 토큰 취득은 시뮬레이터 불가.
- **D6 (✅확정 — 사용자 2026-06-17)**: **로그아웃 시 현재 기기 토큰 폐기 = 포함(T6 구현).** 보안·정확성(로그아웃한 계정으로 오배달 방지).
- **D7 (✅확정 — 사용자 2026-06-17, 정정)**: **iOS+Android 동시.** `platform` 컬럼은 `ios`·`android` 둘 다, **S1 코드는 양 플랫폼 공통**. **Android 실 토큰은 FCM/google-services.json + app.json expo-notifications 플러그인 전제** → 라이브 스모크 배치에서 확인. iOS는 Expo가 APNs 대행.
- **D8 (✅확정 — 사용자 2026-06-17)**: **Dev Client 재빌드 OK.** 실기기 토큰 스모크는 이월 배치(빌드 후).

## 9. 완료 기준 (Definition of Done)
- [ ] T1~T5, T7 완료(T6은 D6 확정 시). 신규 spec 포함 **`npm test` green**(회귀 0).
- [ ] `device_tokens` 마이그레이션 파일 작성(라이브 `db push`·RLS 스모크는 사용자 환경 이월).
- [ ] 순수 유틸·훅의 정상/경계/실패 케이스 테스트 통과(§5 AC).
- [ ] 비용 가드레일 체크 통과(§7-7: 폴링 0·외부 호출 최소).
- [ ] **빌드(Dev Client 재빌드)·실기기 토큰 스모크는 사용자 확인 후 진행**(★B-4).

## 10. architecture.md 갱신 제안 (이번엔 제안만 — S1 확정·구현 후 반영)
- **§3 데이터 모델**: `device_tokens` 테이블 추가(§3.1).
- **§3 RLS**: `device_tokens` 본인 토큰 R/W 정책 + (S2 예고) 발송용 DEFINER RPC 주석.
- **§5 백로그**: `push-notifications` 행을 슬라이스 분해(S1 토큰등록 / S3 prefs DB / S2 발송 / S4 수신UX)로 분기, S1 상태 갱신.
- **§7 미해결**: L235 "푸시 알림 — MVP 이후"를 "착수(슬라이스 분해, S1 진행)"로 갱신. 발송 채널=Expo Push, 트리거 방식(★S2 확정), prefs 이전(S3) 결정 기록.
- **§1 결정**: 푸시 채널·Dev Client 재빌드(expo-notifications) 결정 행 추가.

---

### 의존성 노트 (이전 스프린트와의 관계)
- `notif-settings`(완료): `useNotifPrefs`(로컬 AsyncStorage, master+perLog) — **S1과 직접 결합 없음.** prefs는 S3에서 DB 이전, S2 gating에서 소비. S1은 토큰만.
- `room-lifecycle`(진행): pg_cron(in-DB) 패턴 = S2 트리거 방식(★B-2) 후보 참고용.
- Edge Function 패턴(`place-search`·`nearby-search`, `verify_jwt=true`, 서버 시크릿) = S2 발송 Edge Function의 템플릿.
