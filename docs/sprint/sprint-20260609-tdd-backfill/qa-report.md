# QA Report — tdd-backfill (테스트 품질·정합성 검증)

> 검증자: qa-inspector · 입력: `plan.md`(§5/§5-1), `dev-notes.md`, room 소스 + `supabase/migrations/20260609120000_invite_room.sql`
> 방식: 인수조건↔spec 대응 · `npm test`/`tsc --noEmit` 직접 실행 · load-bearing 표본 변이 · 경계면(C1/C2/C3/C6) 양쪽 동시 읽기 · 컨벤션/모킹 경계
> 진행: **1차(유틸+로직 훅) + 2차(OnboardingScreen 화면) 전부 검증 완료**

---

## 결론

**전부 통과.** 6개 spec(`code`/`errors`/`useCreateRoom`/`useJoinRoom`/`useMembership`/`OnboardingScreen`) + T0 스모크가 인수조건을 load-bearing하게 검증하며, 경계면 계약(SQL↔TS)이 1:1 일치한다. §5-1 (1)~(6) 케이스 전수 존재.

- `npx jest` 전체 → **52 passed / 7 suites** (3회 반복 안정, 순서 의존 실패 없음)
- `npx tsc --noEmit` → **에러 0** (클린)

---

## ✅ 통과

### 실행 게이트
- `npm test` 전체 green(52/52, OnboardingScreen 2차 포함). 2회 반복 재현 — flaky 아님.
- `tsc --noEmit` 클린. (검증 중 한때 `OnboardingScreen.spec.tsx`의 `toBeDisabled/toBeEnabled` 타입 에러 2건 관측 → developer가 동시 수정 완료, 현재 0건.)

### 인수조건 ↔ spec 대응 (plan §5-1 (1)~(5) 전수 존재)
| 케이스 | spec | 상태 |
|--------|------|------|
| (1) normalizeInviteCodeInput 5 + isInviteCodeComplete 4 + 상수 3 | `code.spec.ts` (13 it) | ✅ |
| (2) 토큰5종 + 키개수 + 포함매칭/기본/빈 + 타입추출 4 | `errors.spec.ts` (13 it) | ✅ |
| (3) snake→camel + loading + rpcError + bad-response + data null | `useCreateRoom.spec.ts` (5 it) | ✅ |
| (4) p_code 인자 + roomId 매핑 + INVALID_CODE/ROOM_FULL + bad-response + error 리셋 | `useJoinRoom.spec.ts` (5 it) | ✅ |
| (5) in-room/no-room/error 3분기 + 초기 loading + refresh 재조회 + eq 계약 | `useMembership.spec.ts` (5 it) | ✅ |
| (6) choose 2 + join(정규화 반영·6자 disabled/enabled·joinRoom({code})+reset+refresh·joinError 노출/step 유지) + create-result(코드표시·복사·방으로가기 reset+refresh·실패 choose유지) | `OnboardingScreen.spec.tsx` (10 it) | ✅ |
| (T0) jest 인프라 부팅 + @/ alias 해석 | `__smoke__/setup.spec.ts` (2 it) | ✅ |

### 경계면 교차검증 (양쪽 동시 읽기)
- **C6 charset**: SQL `v_charset := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'`(migration:114) ↔ `INVITE_CODE_CHARSET`(code.ts:8) **문자열 완전 동일**(32자, 0/O/1/I 제외). `code.spec`이 길이32·혼동문자 미포함을 단언. ✅
- **C2 토큰**: SQL `raise exception`이 발생시키는 5종(NOT_AUTHENTICATED/ALREADY_IN_ROOM/CODE_GENERATION_FAILED/INVALID_CODE/ROOM_FULL) ↔ `ROOM_ERROR_MESSAGES` 5키 **1:1**. `errors.spec`이 `Object.keys(...).sort()`로 정확히 5키임을 단언(누락/추가 0 회귀 방지). ✅
- **C1 snake→camel**: RPC jsonb `room_id`/`invite_code` ↔ 훅 `roomId`/`inviteCode`. `useCreateRoom.spec`/`useJoinRoom.spec`이 모킹 응답으로 매핑·`'create_room'`/`'join_room',{p_code}` 호출 인자까지 단언. bad-response throw도 커버. ✅
- **C3 멤버십 체인**: RLS `user_id=auth.uid()` ↔ `from('room_members').select('room_id').eq('user_id',userId).maybeSingle()`. `useMembership.spec`이 from/select/eq 인자를 단언. ✅

### load-bearing 검증 (껍데기 단언 적발 — 실제 변이→red→원복)
핵심 단언 3곳을 일시 변이해 실제 red 확인 후 전부 원복(소스 무손상):
1. `errors.ts` INVALID_CODE 메시지 변조 → `errors.spec` + `useJoinRoom.spec`(공유 단언) red ✅
2. `code.ts` INVITE_CODE_LENGTH 6→7 → `code.spec` red ✅
3. `useCreateRoom.ts` 매핑 `roomId: room_id`→`invite_code` → `useCreateRoom.spec` red ✅
4. (2차) `OnboardingScreen.tsx` `navigation.reset` 라우트명 `RoomTabs`→`Onboarding` → 화면 spec C8 전이 단언 2건 red ✅
→ 유틸/훅 변이 시 10 failed→원복 후 green, 화면 변이 시 2 failed→원복 후 green. 단언이 인수조건에 결합돼 있음 확인.

### 테스트 경계 준수 (단위 vs 모킹/스모크)
- 모킹 대상은 `@/lib/supabase`(rpc/from 체인), `@/features/room`(화면 partial), `@react-navigation/native`, `expo-clipboard`뿐 — **외부 SDK 내부동작·실 DB·RPC/RLS/트리거 자체는 미검증**(plan §2 out-of-scope 준수). 우리 코드의 호출/매핑/처리만 검증. ✅
- `useMembership.spec` 폴링 없음 검증: `refresh()` 명시 호출로만 재조회 전이 — 비용 가드레일(§8) 표현. ✅

### 코드 컨벤션 (테스트 코드)
- `useCallback`/`useMemo` 0건, `export function` 0건. ✅
- 우리 함수 호출 전부 named-object 인자(`{ raw }`/`{ code }`/`{ error }`/`{ userId }`). 위반 0건. ✅
- 파일명 = 대상 심볼 + `.spec.ts`. ✅

---

## ❌ 실패
없음.

---

## ⚠️ 미검증 / 후속
- **C6/C2 단일 출처 물리 분리**: charset·토큰 문자열이 SQL과 TS에 이중 정의(dev-notes도 명시). 이번엔 양쪽 육안+테스트로 동기화 확인했으나, **런타임 동일성 자동검증은 불가**(SQL은 단위 대상 아님). 향후 토큰/charset 변경 시 양쪽 동시 수정 필수 — 회귀 위험 상존.
- **C5(DB 동시성)·C9(RPC 권한)**: 실 Supabase+디바이스 의존 → 단위 범위 밖, 스모크(사용자 환경). 이번 스프린트 미대상. (C8 네비 전이는 화면 spec에서 reset+refresh 호출로 단위 검증 완료.)

---

## 관측 메모 (참고)
- 검증 도중 1회 전체 실행에서 `code.spec`/`useJoinRoom.spec` 2건 일시 실패 관측 → developer 동시 편집(파일 저장) 레이스로 판단. 직후 3회 연속 재실행 모두 52/52 green, isolation도 green — **순서 의존/flaky 아님**으로 결론.
</content>
</invoke>
