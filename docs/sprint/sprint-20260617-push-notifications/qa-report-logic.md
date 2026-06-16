# QA Report — Logic / Integration (push-notifications S1: 디바이스 토큰 등록)

> 검증자: qa-logic-6 · 일자: 2026-06-17 · 방식: 생산자↔소비자 양쪽 동시 읽기(integration-qa)
> 대상 커밋 작업트리: `device_tokens.sql` 신규 + `notif/pushToken*`·`useRegisterPushToken*` 신규 + `AuthProvider*`·`notif/index.ts`·`app.json`·`package.json` 수정.
> **결론: 로직·통합 정합성 전 항목 PASS.** 빌드/실기기/라이브 RLS는 사용자 환경 이월(통과 처리 안 함). 코드 수정 0(검증·리포트만).

## 0. 실행 검증 결과
| 항목 | 결과 |
|---|---|
| `npx tsc --noEmit` | **EXIT 0** (재실행 확인) |
| `npx jest` 전체 | **132 suites / 1124 tests green** (회귀 0, 재확인) |
| notif+auth 포커스 | 6 suites / 71 tests green |

---

## 1. 경계면 교차검증 (생산자 ↔ 소비자)

### B1. `device_tokens` 컬럼 ↔ upsert 페이로드 — **PASS**
- 생산자(SQL `20260617120000_device_tokens.sql:31-39`): `user_id`·`expo_push_token`·`platform`·`device_name`·`created_at`·`updated_at`·`id`.
- 소비자(`pushToken.ts:62-80` `buildDeviceTokenUpsert`): `user_id`·`expo_push_token`·`platform`·`device_name`·`updated_at` 전달, `id`/`created_at`은 DB default(미전달). 컬럼명·타입 1:1 일치.
- `platform` CHECK in (`ios`,`android`) ↔ `resolveDevicePlatform`(`pushToken.ts:94-98`)이 `ios`/`android`/`null` 반환, null이면 `acquireExpoPushToken`에서 skip(`useRegisterPushToken.ts:63-64`). CHECK 위반 입력이 DB까지 도달 불가.
- `onConflict: 'expo_push_token'`(`useRegisterPushToken.ts:145`) ↔ SQL `expo_push_token text not null unique`(`:34`). upsert 충돌키 정확.

### B2. RLS ↔ 클라 쿼리 — **PASS**
- 4정책 전부 `user_id = auth.uid()`(`:48-65`): select/insert(with check)/update(using+with check)/delete(using).
- 등록 insert/update 경로: payload `user_id` = AuthProvider `activeUserId`(=`state.userId`=auth.uid()) → insert with check 일치(`AuthProvider.tsx:72-73` → `useRegisterPushToken.ts:136-145`).
- 폐기 delete 경로(`useRegisterPushToken.ts:100-103`): `.delete().eq('expo_push_token', token)` — 토큰 단일 필터지만 RLS `delete_own`가 본인 행으로 한정. **기기 계정 전환 후(토큰 소유자=B) A가 로그아웃해도 RLS가 A의 delete를 B행에 적용 못 함 → 과삭제 없음**(의도된 보호). 
- 타인 토큰 노출/조작 차단 정합. **S2 DEFINER RPC는 이번 미존재 확인**(`list_room_push_targets` 등은 주석상 예고만, `:18`).

### B3. expo SDK 모킹 ↔ `useRegisterPushToken` — **PASS**
- `getPermissionsAsync`→`resolvePermissionDecision`→granted/ask/denied(`useRegisterPushToken.ts:66-78`). ask일 때만 `requestPermissionsAsync`(등록 `allowRequest=true`), 폐기 경로는 미요청(`allowRequest=false`, `:72-74`) → 로그아웃 시 권한 다이얼로그 금지. spec이 이를 직접 단언(`useRegisterPushToken.spec.ts:166-171`).
- `Device.isDevice`→`isPushCapable`(시뮬레이터 skip), `Device.deviceName`→`device_name`(`?? null`).
- `getExpoPushTokenAsync({ projectId })` 시그니처·횟수(1회) spec 단언 일치(`spec:76-77`).
- 네임스페이스 interop 회피(named import + factory 내부 jest.fn + requireMock) 정상 — `import * as` 미사용 확인.

### B4. `useRegisterPushToken` ↔ AuthProvider 배선 — **PASS**
- `activeUserId = state.status==='authenticated' ? state.userId : ''`(`AuthProvider.tsx:72`), 매 렌더 훅 호출(`:73`). authenticated 외 상태는 `''`→no-op.
- AC10 양방향 단언(`AuthProvider.spec.tsx:240-255`): authenticated→`{userId:'u1'}`, 미인증→`{userId:''}` 且 non-empty 미호출.
- signOut 순서: `unregisterDeviceToken({userId:activeUserId})` **→** `supabase.auth.signOut()`(`AuthProvider.tsx:156-157`). auth.uid() 유효 구간에서 delete. spec이 호출 인자 검증(`spec:216-225`). 폐기 실패가 로그아웃을 막지 않음(best-effort, try/catch 흡수).
- 기존 `userId:string` 소비처 회귀 0(전체 green).

### B5. app.json `extra.eas.projectId` ↔ 토큰 취득 — **PASS**
- 생산자: `app.json:61-64` `extra.eas.projectId = ddb39563-...`. 소비자: `resolveProjectId`(`useRegisterPushToken.ts:45-48`)가 `Constants.expoConfig?.extra?.eas?.projectId` 읽어 `getExpoPushTokenAsync`에 전달.

### B6. 멱등 가드 ↔ 재렌더 — **PASS**
- `processedUserIdRef`(`useRegisterPushToken.ts:120`): 동일 userId 중복 차단, userId 비면 리셋(재로그인 재등록). deps `[userId]`. AC7·재로그인 spec 검증(`spec:116-156`).

### B7. platform 매핑(D7 양 플랫폼 공통) — **PASS**
- `Platform.OS`→`resolveDevicePlatform`만으로 분기 없음, ios/android 공통 코드. CHECK 제약과 매핑 일치.

---

## 2. 비용 가드레일 — **PASS**
- **폴링 0 / Realtime 0 / 상시연결 0**: notif 코드에 `setInterval`/`setTimeout`/`realtime`/`subscribe` 부재(grep 0건). effect deps `[userId]` → authenticated 진입 1회만.
- **외부 호출 최소**: 등록=`getExpoPushTokenAsync` 1회, 폐기=로그아웃 시 토큰 재취득 1회(권한 다이얼로그 없음, 명시적 사용자 행동). 모두 무료(Expo).
- **AWS 0**: 미사용. Supabase 무료티어(테이블 1 + RLS + 인덱스 1 + 트리거 1).
- 테스트로 강제: AC4 `getExpoPushTokenAsync` times(1), AC7 멱등 times(1), AC5/AC6/AC9 미호출 단언이 중복·불필요 호출을 차단.

## 3. 범위 가드 (S2/S3/S4 OUT) — **PASS**
- 발송(`exp.host`·`push/send`)·`pg_net`·`SECURITY DEFINER` 실제 정의·`notification_prefs`·딥링크 코드 **부재**(grep: 마이그레이션 내 `SECURITY DEFINER`/`list_room_push_targets`는 S2 예고 **주석**뿐, `:17-18`). S1에 발송 로직 혼입 없음.

## 4. 코드 컨벤션(`docs/code-convention.md`) — **PASS**
- `useCallback`/`useMemo` 0건(notif+AuthProvider grep). 컴포넌트·훅·유틸 전부 `export const … =>` 화살표. `export function` 0건.
- named-object 인자(전 함수). useEffect 명명 함수(`registerPushTokenOnAuth`·`bootstrapAuth`). enum-style `as const`(`PushPermissionDecision`·`DeviceTokenPlatform`). raw hex 0건(notif). 파일명=대표 심볼.

## 5. TDD·테스트 품질 — **PASS**
- 인수조건↔테스트 대응: T2(pushToken.spec 정상/경계/실패 11), T3(useRegisterPushToken.spec AC4·4-b·5·6·7·8·8-b·9·재로그인), T4(AuthProvider.spec AC10×2), T6(unregister 5건). plan §5 AC 전수 커버.
- 단위 경계 준수: 순수 유틸=단위, 훅=SDK·supabase 모킹, SQL=라이브 이월. testing-strategy 경계 일치.
- 실패·경계 경로 포함: 거부/시뮬레이터/빈 userId/네트워크 실패(reject·error)/권한 미요청(폐기).
- **테스트 유의미성(load-bearing)**: 단언이 구체적(정확 payload `toHaveBeenCalledWith`, `times(1)`, 미호출 `not.toHaveBeenCalled`, 호출 인자 `{userId:'u1'}`/`{projectId:'proj-1'}`) — 껍데기 단언 아님. 핵심 단언을 깨면 즉시 빨개지는 구조(예: payload 키/onConflict/횟수 변경 시 실패). *코드 수정 금지 제약상 실제 뮤테이션은 미수행, 정적 검토로 확인.*

---

## 6. 관찰 사항 (정보용 — FAIL 아님)
- **OBS1** (`useRegisterPushToken.ts:84`): projectId 부재 시 `getExpoPushTokenAsync({})`(빈 객체) 호출 — 주석은 "인자 없이 호출"로 표현. 동작상 `{}`는 EAS 자동탐지 폴백과 동일·무해. 문서 표현 미세 불일치뿐.
- **OBS2** (`useRegisterPushToken.ts:129-130`): 멱등 가드를 async 완료 전 낙관적 set → 동일 로그인 세션 내 upsert 일시 실패 시 재렌더 재시도 안 함. 단, 앱 재기동(훅 리마운트→ref 리셋) 또는 재로그인(userId 전환) 시 재시도 → plan AC8 "다음 실행 재시도"·"폴링 없음" 설계와 정합. 의도된 동작.

## 7. 라이브 이월 (사용자 배치 — **통과 처리 안 함**)
- [ ] Dev Client 재빌드(`expo-notifications`·`expo-device` 네이티브 모듈) — iOS 실기기 빌드.
- [ ] iOS 실기기 토큰 스모크: 로그인→권한 허용→`device_tokens` `platform='ios'` 행 1개, 거부 시 행 없음·앱 정상.
- [ ] Android FCM/`google-services.json` + EAS push 자격증명(S2 발송 전 전제).
- [ ] `supabase db push` 적용 + RLS 스모크(AC12 타인 user_id insert 42501 / AC13 동일 token 다른 user_id upsert→1행 user_id 갱신).
- [ ] EAS `projectId` 빌드 반영 확인.

## 8. 요약
- **로직/통합 인수조건 전부 PASS.** 경계면 7종·비용·범위·컨벤션·TDD 모두 정합, tsc 0 / 1124 green.
- 미해결 FAIL **없음**. 수정 요청 **없음**.
- 라이브(빌드·실기기·DB push·RLS) 항목은 사용자 환경 이월로 명기 — "로직 완료"는 충족, "스프린트 완전 종료"는 라이브 스모크 후.
