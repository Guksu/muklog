# Dev Notes — push-notifications S1 (디바이스 토큰 등록)

> 구현자: developer. TDD(Red→Green). git 작업 없음. 외부 SDK(expo-notifications/expo-device)는 모킹.
> 종료 기준 충족: `npm test` **132 suites / 1124 tests green**(회귀 0) · `npx tsc --noEmit` **EXIT 0**.
> 범위: 토큰 **등록/폐기까지**. 발송·prefs DB이전·딥링크·무효토큰 정리는 **S2/S3/S4 (OUT)**.

## 1. 변경/신규 파일

| 파일 | 종류 | 내용 |
|---|---|---|
| `supabase/migrations/20260617120000_device_tokens.sql` | 신규 | `device_tokens` 테이블 + RLS 4종 + `idx_device_tokens_user_id` + `updated_at` 자동갱신 트리거 + grant. additive·idempotent. |
| `src/features/notif/pushToken.ts` | 신규 | 순수 유틸 + enum-style 상수(`PushPermissionDecision`·`DeviceTokenPlatform`) + `DeviceTokenUpsert` 타입. |
| `src/features/notif/pushToken.spec.ts` | 신규 | 순수 유틸 단위 테스트(11). 정상/경계/실패. |
| `src/features/notif/useRegisterPushToken.ts` | 신규 | 등록 훅 `useRegisterPushToken` + 로그아웃 폐기 `unregisterDeviceToken` + 내부 SDK 헬퍼 `acquireExpoPushToken`. |
| `src/features/notif/useRegisterPushToken.spec.ts` | 신규 | 훅·폐기 테스트(14). SDK·supabase 모킹. |
| `src/features/auth/AuthProvider.tsx` | 수정 | authenticated 진입 시 훅 1회 구동 + signOut 시 토큰 폐기(폐기→signOut 순서). |
| `src/features/auth/AuthProvider.spec.tsx` | 수정 | 배선 테스트 3건(AC10 ×2, T6 폐기) + 훅/폐기 모킹. |
| `src/features/notif/index.ts` | 수정 | 순수 유틸(pushToken)만 재노출. **supabase 의존 훅은 바렐에서 제외**(직접 경로 import). |
| `app.json` | 수정 | `expo-notifications` 플러그인 추가(`color: #3366FF` = Android 알림 accent, 브랜드 블루). `withFmtConstevalFix` 유지. |
| `package.json` | 수정 | `expo-notifications ~0.29.14`, `expo-device ~7.0.3` (`npx expo install`로 SDK52 핀). |

## 2. 경계면 매핑 (생산자 ↔ 소비자) — qa-logic 교차검증용

### 2.1 `device_tokens` 컬럼 ↔ upsert 페이로드(§3.3) — 단일 출처 = `pushToken.buildDeviceTokenUpsert`
| SQL 컬럼 | 페이로드 키 | 비고 |
|---|---|---|
| `user_id uuid → profiles(id)` | `user_id` | `auth.uid()`(RLS insert with check 일치) |
| `expo_push_token text UNIQUE` | `expo_push_token` | onConflict 키 |
| `platform text CHECK in (ios,android)` | `platform` | `resolveDevicePlatform({ os: Platform.OS })`로 좁힘(그 외 null→skip) |
| `device_name text NULL` | `device_name` | `expo-device deviceName ?? null` |
| `updated_at timestamptz` | `updated_at` | `new Date().toISOString()` + DB 트리거가 최종 갱신 |
| `id`/`created_at` | (미전달) | DB default |

- **upsert 호출**: `supabase.from('device_tokens').upsert(payload, { onConflict: 'expo_push_token' })` — 기기 계정 전환 시 1행 유지·`user_id` 이전(plan AC13).

### 2.2 RLS ↔ 클라 쿼리 (plan §7-2)
- 4정책 전부 `user_id = auth.uid()` (select/insert/update/delete). 타인 토큰 노출·조작 불가.
- 등록 = insert(신규) 또는 update(onConflict, update_own 정책). 폐기 = delete(delete_own).
- **S2 DEFINER RPC는 이번 미생성**(상대 토큰 조회는 S2에서 `list_room_push_targets` 등으로). 컬럼·인덱스만 선반영.

### 2.3 SDK 모킹 ↔ `useRegisterPushToken` (plan §7-3)
- `getPermissionsAsync` → `resolvePermissionDecision` → granted/ask/denied.
  - ask일 때만 `requestPermissionsAsync` 호출(등록 경로, `allowRequest=true`). **폐기 경로는 요청 안 함**(`allowRequest=false`, 로그아웃 시 권한 다이얼로그 금지).
- `Device.isDevice` → `isPushCapable`(시뮬레이터 false → skip). `Device.deviceName` → device_name.
- `getExpoPushTokenAsync({ projectId })` — projectId = `Constants.expoConfig.extra.eas.projectId`(app.json, plan §7-5). 미존재 시 인자 없이 호출(EAS 빌드 자동탐지 폴백).
- ⚠️ **모킹 패턴 주의**: expo 네이티브 모듈은 `import * as` 네임스페이스 interop이 jest에서 깨진다 → 훅은 **named import**, spec은 **팩토리 내부 jest.fn 정의 + `jest.requireMock`** 으로 제어(외부 변수 참조 팩토리는 타이밍 취약). 후속 슬라이스도 동일 패턴 사용.

### 2.4 `useRegisterPushToken` ↔ AuthProvider (plan §7-4·AC10/AC11)
- `activeUserId = state.status==='authenticated' ? state.userId : ''`. 매 렌더 `useRegisterPushToken({ userId: activeUserId })`.
- 훅 effect deps `[userId]`: authenticated 진입 시 1회 실행. unauthenticated/loading은 `userId=''` → no-op(AC9). 기존 `userId:string` 소비처 회귀 0(전체 green).
- signOut: `unregisterDeviceToken({ userId: activeUserId })` **→ `supabase.auth.signOut()`** 순서(auth.uid() 유효 구간 delete).

### 2.5 멱등 가드 ↔ 재렌더 (plan §7-6·AC7)
- 훅 내부 `processedUserIdRef`: 동일 userId 재실행 차단(중복 upsert 방지). 리렌더는 deps 불변 → 재실행 안 함. userId가 ''로 바뀌면 ref 리셋 → 재로그인 시 재등록(검증 테스트 포함).

### 2.6 비용 가드레일 (plan §7-7)
- **폴링/Realtime/상시연결 0.** 토큰 취득은 authenticated 진입(userId 변경) 시 1회.
- 외부 호출: 등록 = `getExpoPushTokenAsync` 1회. 폐기 = 로그아웃 시 토큰 재취득 1회(권한 다이얼로그 없음, 명시적 사용자 행동, 폴링 아님).
- best-effort: 비실기기·거부·네트워크 실패는 warn 후 흡수(throw 0, 앱/로그아웃 흐름 차단 0).
- AWS 미사용. Supabase 무료티어(테이블 1 + RLS + 인덱스 + 트리거).

## 3. AC 커버리지
- T2(순수): resolvePermissionDecision(granted/ask/denied+canAskAgain=false 경계), buildDeviceTokenUpsert(매핑/null), isPushCapable, resolveDevicePlatform(ios/android/그외 null).
- T3(훅): AC4 정상 upsert·페이로드·onConflict, AC4-b ask→request→granted, AC5 거부, AC6 시뮬레이터, AC7 멱등, AC8/AC8-b 실패 흡수, AC9 빈 userId, 재로그인 재등록.
- T4(배선): AC10 authenticated만 userId로 구동·미인증 ''.
- T6(폐기): AC14 delete(expo_push_token eq), 요청 미발생, 시뮬레이터 skip, 실패 흡수, 빈 userId no-op.
- T5(마이그레이션): 파일 작성 완료. **라이브 RLS 스모크(AC12/AC13)는 사용자 환경 이월**.

## 4. 라이브 스모크 이월 체크리스트 (사용자 배치 — 코드/모킹은 완료)
- [ ] **Dev Client 재빌드**: `expo-notifications`·`expo-device`는 네이티브 모듈 → JS 핫리로드 불가. `npm run ios:sim`은 시뮬레이터(실 토큰 미취득) → **iOS 실기기** 빌드 필요. Android는 `expo run:android`/EAS.
- [ ] **iOS 실기기 토큰 스모크**: 로그인 → OS 권한 다이얼로그 → 허용 → `device_tokens`에 `platform='ios'` 행 1개 생성 확인. 거부 시 행 없음·앱 정상.
- [ ] **Android FCM 셋업**(S2 발송 전 전제): `google-services.json` + EAS push 자격증명. 미설정 시 Android 토큰 취득 실패(warn·skip) — S1 코드는 동작, 토큰만 비어있음.
- [ ] **마이그레이션 적용**: `supabase db push`(또는 SQL 에디터 실행). 본인 토큰 select/insert 통과, 타인 user_id insert는 RLS 42501, 동일 expo_push_token 다른 user_id upsert → 1행 user_id 갱신(AC12/AC13).
- [ ] EAS `projectId`(`extra.eas.projectId`) 빌드 반영 확인 — `getExpoPushTokenAsync`가 사용.

## 5. 명시적 OUT (이번 미포함)
- 푸시 **발송**(트리거/Edge Function/Expo Push API 호출/무효토큰 정리) = **S2**.
- prefs **로컬→DB 이전**(`notification_prefs`, gating) = **S3**.
- 탭 딥링크·앱 뱃지·포그라운드 인앱 표시 = **S4**.
- Android 런타임 알림 채널 생성(수신 표시용)·전용 권한 안내 배너 = 후속(수신 UX).
