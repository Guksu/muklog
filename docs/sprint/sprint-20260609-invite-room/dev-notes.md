# Dev Notes — 익명 인증 + 초대코드 방 생성/입장 (invite-room)

> 구현자: developer · 입력: `plan.md`, `docs/design/architecture.md`, setup 스프린트 산출물(`AuthProvider`/`AppNavigator`/`AuthGate`/`devFlags.ts`)
> 스택: Expo SDK 52 (RN 0.76.9) + TypeScript · Supabase JS · React Navigation 7
> 자체검증: `npx tsc --noEmit` ✅ (exit 0) · `npx expo export --platform ios` ✅ (번들 성공) · `grep -rn 'DEV_NAV\|devFlags' src` → **0건** · raw hex/rgba(tokens.ts 제외) → **0건**

---

## 1. 구현/변경한 파일 (모듈별)

### A. DB 마이그레이션 (T1~T6)
| 파일 | 내용 |
|------|------|
| `supabase/migrations/20260609120000_invite_room.sql` | **신규.** 테이블 3종 + FK + RLS + 인원2 트리거 + `create_room`/`join_room` RPC + 권한. 재실행 가능(idempotent: `create ... if not exists`, `drop policy if exists`, `create or replace`). |

### B. profiles upsert (T7)
| 파일 | 변경 |
|------|------|
| `src/features/auth/AuthProvider.tsx` | setup의 `// TODO(profile 스프린트)` 주석 제거. `ensureProfileAndAuth(userId)` 추가 — `profiles` 본인 행 upsert(`{id}`, `onConflict:'id'`, `ignoreDuplicates:true`) **성공 후에만** `authenticated` 전이. bootstrap·onAuthStateChange 양쪽이 이 함수를 사용(`profileEnsuredRef`로 동일 userId 중복 upsert 방지). upsert 실패 → `error` 상태(재시도). |

### C. room 피처 (T8·T10·T11·T12)
| 파일 | export | 내용 |
|------|--------|------|
| `src/features/room/errors.ts` | `mapRoomError`, `ROOM_ERROR_MESSAGES`, `DEFAULT_ROOM_ERROR_MESSAGE` | RPC 토큰 → 한국어. 정확 일치 우선 → 포함 매칭 → 기본 메시지. **토큰 단일 출처 측: RPC SQL과 동기화 필요.** |
| `src/features/room/code.ts` | `INVITE_CODE_CHARSET`, `INVITE_CODE_LENGTH`, `normalizeInviteCodeInput`, `isInviteCodeComplete` | charset 32자(`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`)·길이6. 입력 정규화(대문자·charset필터·6자컷). **클라 코드 생성 유틸 없음**(생성은 RPC 전담). |
| `src/features/room/useMembership.ts` | `useMembership`, `MembershipState` | `room_members.select('room_id').eq('user_id',uid).maybeSingle()`. 진입 1회 + `refresh()`. **폴링 없음.** refresh는 `loading`으로 되돌리지 않음(게이트 NavigationContainer 보존). |
| `src/features/room/MembershipProvider.tsx` | `MembershipProvider`, `useMembershipContext` | context로 `state`/`refresh` 공유. Provider 밖 호출 시 throw. |
| `src/features/room/useCreateRoom.ts` | `useCreateRoom`, `CreateRoomResult` | `rpc('create_room')` → `{roomId, inviteCode}` 매핑. `loading`/`error`(한국어). |
| `src/features/room/useJoinRoom.ts` | `useJoinRoom`, `JoinRoomResult` | `rpc('join_room',{p_code})` → `{roomId}` 매핑. `loading`/`error`. |
| `src/features/room/index.ts` | (재export) | 공개 표면. |

### D. 네비게이션 / 화면 (T9·T13·T14)
| 파일 | 변경 |
|------|------|
| `src/navigation/devFlags.ts` | **삭제.** |
| `src/navigation/AppNavigator.tsx` | `DEV_NAV` import 제거. `initialRouteName: keyof AppStackParamList` prop 받도록 변경(게이트가 주입). Onboarding/RoomTabs 모두 등록 유지(→ reset 전이 가능). |
| `src/navigation/MembershipGate.tsx` | **신규.** `useMembershipContext` 분기: loading→Splash / error→AuthErrorView(refresh) / no-room→AppNavigator(Onboarding) / in-room→AppNavigator(RoomTabs). **no-room·in-room은 동일 JSX 노드**(NavigationContainer)로 렌더 → refresh 전이 시 언마운트/리셋 충돌 방지. `never` exhaustive 가드. |
| `src/navigation/AuthGate.tsx` | authenticated 분기를 `<MembershipProvider userId>` + `<MembershipGate/>`로 교체. NavigationContainer는 MembershipGate로 이동. |
| `src/navigation/screens/OnboardingScreen.tsx` | placeholder/ dev토글 제거 → **실 3모드 UI**(choose / create-result / join). 코드 표시+복사(expo-clipboard), 코드 입력(정규화·6자검증·대문자·charset필터), 로딩/에러/성공 반영. 성공 전이 = `refresh()`+`navigation.reset(RoomTabs)`. 토큰만 사용(raw hex 0). |
| `src/navigation/screens/MuklogTabScreen.tsx` | dev 토글 버튼 제거(placeholder 텍스트만). |

### E. 의존성
| 파일 | 변경 |
|------|------|
| `package.json` / `package-lock.json` | `expo-clipboard` 추가(`npx expo install`, SDK52 호환). create-result 코드 복사용. → **dev client 재빌드 필요**(아래 §4). |

---

## 2. RPC / 쿼리 시그니처 (계약)

```
create_room() returns jsonb
  → { "room_id": <uuid>, "invite_code": "<6자리>" }
  raise: NOT_AUTHENTICATED | ALREADY_IN_ROOM | CODE_GENERATION_FAILED
  security definer, set search_path=public, grant execute to authenticated

join_room(p_code text) returns jsonb
  → { "room_id": <uuid> }   (자기 방 재입장 = 토큰없이 멱등 성공)
  raise: NOT_AUTHENTICATED | INVALID_CODE | ALREADY_IN_ROOM | ROOM_FULL
  내부: profiles 안전망 upsert → upper(trim) → 코드조회 → 멤버십분기 → rooms FOR UPDATE → count>=2 차단 → insert(트리거 최종방어)
  security definer, set search_path=public, grant execute to authenticated

room_members select (RLS): user_id = auth.uid()
profiles select/insert/update (RLS): id = auth.uid()
rooms select (RLS): id in (select room_id from room_members where user_id=auth.uid())
rooms/room_members insert·update·delete: 정책 없음 → RPC(DEFINER)만
```

---

## 3. 생산자 ↔ 소비자 매핑 (QA 교차검증용, plan §7)

| # | 생산자 (파일:심볼) | 소비자 (파일:사용) | 계약 / 확인 |
|---|--------------------|--------------------|-------------|
| **C1** | `create_room`/`join_room` jsonb (`room_id`,`invite_code` snake) — `*_invite_room.sql` | `useCreateRoom.ts`/`useJoinRoom.ts` (`data.room_id→roomId`, `data.invite_code→inviteCode`) | jsonb 객체(배열 아님). `(data ?? {})` 후 필드 누락 시 `*_BAD_RESPONSE` throw. ✅ |
| **C2** | RPC `raise` 토큰 5종 — SQL | `errors.ts:ROOM_ERROR_MESSAGES`(5키) + `mapRoomError` | 토큰 1:1, 누락 0, 기본 fallback. ⚠️ **단일 출처가 SQL/TS로 물리 분리** — 토큰 문자열 동기화 책임 명시(둘 다 본 dev-notes에 나열). |
| **C3** | `room_members` RLS select(`user_id=auth.uid()`) — SQL | `useMembership.ts` (`.eq('user_id',uid).maybeSingle()`) | self-join 재귀 없음. maybeSingle(1인1방 → 최대1행). ✅ |
| **C4** | 테이블 FK + `AuthProvider.ensureProfileAndAuth`(authenticated **전**) | RPC insert(rooms.created_by / room_members.user_id) + RPC 내부 안전망 `insert profiles on conflict do nothing` | upsert가 authenticated보다 선행 → FK 위반 0. RPC 안전망 2차. ✅ |
| **C5** | 트리거 `enforce_room_capacity` + `rooms ... for update` — SQL | `join_room` 동시성 경로 | 3번째/동시 입장 → `ROOM_FULL`. (런타임 동시성은 실 Supabase 필요 → §4) |
| **C6** | `create_room` charset(`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, SQL) | `code.ts:INVITE_CODE_CHARSET`(동일 문자열) + `normalizeInviteCodeInput` | **양쪽 charset 문자열 동일**(32자, O/I/0/1 제외)·길이6·대문자·trim. ⚠️ SQL↔TS 물리 분리 — 변경 시 동기화. |
| **C7** | `MembershipGate` state(no-room/in-room) | `AppNavigator` `initialRouteName` prop | 분기 정확. `DEV_NAV`/`devFlags` 잔존 0(grep), tsc 통과. ✅ |
| **C8** | Onboarding 성공 → `membership.refresh()` + `navigation.reset({index:0,routes:[RoomTabs]})` | MembershipGate(동일 NavigationContainer 노드 유지) + 재실행 시 useMembership | 성공 후 RoomTabs, 뒤로가기 복귀 불가, 재실행 시 in-room 곧장 RoomTabs. (실 디바이스 검증 권장 §4) |
| **C9** | `grant execute ... to authenticated` + `revoke ... from public,anon` — SQL | 익명 세션 RPC 호출 | 익명(=authenticated 역할) 호출 OK, 직접 테이블 insert는 RLS로 거부. (실 Supabase 필요 §4) |
| **C10** | `profiles` insert RLS(`with check id=auth.uid()`) — SQL | `AuthProvider` upsert payload `{ id: userId }` | 본인 행만, payload 키 `id` 일치. ✅ |

---

## 4. 미완 / 사용자 액션 필요

### ⚠️ 사용자: 마이그레이션 적용 + 권한/익명 확인 (코드/계약은 완성, 실 적용은 환경 의존)
1. **마이그레이션 적용**: `supabase/migrations/20260609120000_invite_room.sql`을 `supabase db push`(CLI 연결 시) 또는 Supabase 대시보드 **SQL 에디터**에 붙여 실행.
2. **익명 로그인 활성화**: Supabase 대시보드 → Authentication → Providers → **Anonymous sign-ins ON**(미활성 시 `signInAnonymously` 실패 → AuthError 화면).
3. **RPC 권한 확인**: 마이그레이션이 `grant execute ... to authenticated`를 포함. 적용 후 익명 세션으로 `create_room`/`join_room` 호출 성공하는지 확인.
4. **Dev Client 재빌드**: `expo-clipboard` 네이티브 모듈 추가됨 → 기존 dev client에 미포함. `npx expo run:ios`/`run:android`(또는 EAS dev build) **재빌드 필요**.

### 런타임 검증 권장 (실 Supabase + 디바이스 필요 — C5·C8·C9)
- 방 만들기 → 6자리 코드 표시·복사 → RoomTabs 진입.
- 두 번째 기기에서 코드 입력 → 입장 → 방 2명. 3번째 입장 시도 → "이미 2명…"(ROOM_FULL).
- 오타 코드 → "초대코드를 다시 확인…"(INVALID_CODE), 입력값 유지.
- 앱 재실행 → 멤버십 게이트가 곧장 RoomTabs(AsyncStorage 세션 + room_members 조회).
- 마지막 1자리 동시 입장(2기기) → 한 명 성공/한 명 ROOM_FULL.

### 의도적 범위 외 (plan §2)
- 프로필 편집(닉네임/아바타)·먹로그 CRUD·지도·Storage·Kakao·Realtime — 다음 스프린트.
- 방 나가기/재초대/코드 만료 — MVP 이후.
- 파트너(상대) 프로필 표시 — `profiles` cross-member RLS 미개방(own-only).

---

## 5. 비용 가드레일 체크 (plan §8)
- AWS 0. Supabase 무료 티어만(익명 Auth + Postgres). Storage/Edge Function/Kakao 이번 범위 없음.
- 방 생성/입장 각 **1회 RPC**로 완결(코드 생성·충돌 재시도·검증·삽입 서버 내부). 클라 왕복 최소.
- 멤버십 조회 = 진입 1회 + 성공 후 refresh만. **폴링/주기 조회 없음**, Realtime 미사용.
