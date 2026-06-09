# QA 리포트 — invite-room 스프린트

- 검증자: qa-inspector
- 일자: 2026-06-09
- 방법: 경계면 **양쪽 동시 읽기**(생산자 SQL ↔ 소비자 TS) 교차검증. plan.md §7 C1~C10 계약표 기준.
- 자료: `supabase/migrations/20260609120000_invite_room.sql`, `src/features/room/*`, `src/features/auth/AuthProvider.tsx`, `src/navigation/*`, plan.md / dev-notes.md.
- 분류: **통과** / **실패** / **미검증(환경의존)**.

> 환경 제약(dev-notes §4): 마이그레이션 실적용·익명로그인 활성화·dev client 재빌드는 사용자 환경 의존.
> 따라서 본 검증은 **정적 정합성(계약/타입/토큰/charset/분기/권한 선언)** 을 확정하고, 런타임 동작은 미검증으로 분류한다.

---

## ✅ 통과 (정적 정합성 — 파일:라인 근거)

| # | 경계면 | 생산자 | 소비자 | 판정 근거 |
|---|--------|--------|--------|-----------|
| **C1** | RPC 반환 shape | `create_room` → `jsonb_build_object('room_id','invite_code')` (sql:156), `join_room` → `{room_id}` (sql:219) | `useCreateRoom.ts:26-30`(`room_id`/`invite_code`→`roomId`/`inviteCode`), `useJoinRoom.ts:26-30`(`room_id`→`roomId`) | jsonb **객체**(배열 아님) 매핑 일치. 누락 가드 `CREATE_ROOM_BAD_RESPONSE`/`JOIN_ROOM_BAD_RESPONSE` 존재. RPC 인자명 `p_code`(sql:167) ↔ `rpc('join_room',{p_code})`(useJoinRoom.ts:23) 일치 |
| **C2** | 에러토큰 5종 | SQL `raise`: `NOT_AUTHENTICATED`(122,181), `ALREADY_IN_ROOM`(130,203), `CODE_GENERATION_FAILED`(147), `INVALID_CODE`(193), `ROOM_FULL`(89,213) | `errors.ts:9-15` `ROOM_ERROR_MESSAGES` 5키 | **5종 1:1 정확 일치, 누락 0**. `mapRoomError`(정확→포함→기본 3단계) + `DEFAULT_ROOM_ERROR_MESSAGE` fallback 존재. (물리 분리된 가장 깨지기 쉬운 지점 — 일치 확인) |
| **C3** | 멤버십 RLS↔쿼리 | `room_members_select_own`: `user_id=auth.uid()`(sql:75-76), self-join 재귀 없음(명시 주석 73) | `useMembership.ts:26-30` `.from('room_members').select('room_id').eq('user_id',uid).maybeSingle()` | 컬럼명 snake 일치. 1인1방 불변식 → `maybeSingle`(0/1행) 적합. 게이트 분기 정확 |
| **C4** | FK·profiles 선행 | `AuthProvider.ts:43-54 ensureProfileAndAuth`(upsert **성공 후에만** authenticated 전이) + RPC 내부 안전망 `insert profiles on conflict do nothing`(sql:126,185) | rooms.created_by/room_members.user_id FK(sql:29,36) | upsert가 RPC보다 선행 보장 → FK 위반 0. 이중 방어(앱 upsert + RPC 안전망) |
| **C6** | charset 32자 | `create_room` `v_charset='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'`(sql:114) | `code.ts:8 INVITE_CODE_CHARSET` 동일 문자열, `INVITE_CODE_LENGTH=6` | **32자 문자열 정확 일치**(A-Z−{O,I}=24 + 0-9−{0,1}=8). 클라 `normalizeInviteCodeInput`(upper+filter+6컷) ↔ 서버 `upper(trim())` 정합 |
| **C7** | 게이트 분기·devFlags 제거 | `MembershipGate.tsx:29-37`(no-room→Onboarding, in-room→RoomTabs, **동일 NavigationContainer 노드**) | `AppNavigator.tsx:14-24` `initialRouteName` prop 수신, 두 화면 등록 | 분기 정확. **`grep -rn 'DEV_NAV\|devFlags' src/` = 0건, `devFlags.ts` 파일 삭제 확인**. exhaustive `never` 가드 유지 |
| **C8** | 성공 전이 | `OnboardingScreen.tsx:44-47 goToRoom`: `refresh()` + `navigation.reset(RoomTabs)` | MembershipGate 동일노드 렌더(언마운트 없음, 주석 8-10) | 성공 후 RoomTabs 즉시 전이, 뒤로가기 복귀 불가 설계. (재실행 런타임은 미검증) |
| **C9** | RPC 권한 선언 | `revoke all ... from public,anon` + `grant execute ... to authenticated`(sql:229-232) | 익명세션=authenticated 역할로 RPC 호출 | 권한 선언 정확. 직접 테이블 insert는 rooms/room_members에 insert 정책 없음 → 거부(sql:71,77) |
| **C10** | profiles RLS↔payload | `profiles_insert_own with check (id=auth.uid())`(sql:58-59) | `AuthProvider.ts:46-47` `upsert({id:userId},{onConflict:'id',ignoreDuplicates:true})` | payload 키 `{id}` ↔ RLS `id=auth.uid()` 일치. 본인 행만 생성, 닉네임/아바타 NULL 유지 |

### 보안 (핵심)
- ✅ **초대코드→방 해석이 RPC 경로로만**: `grep '.from('` 결과 클라 직접 테이블 접근은 `room_members`(본인행 RLS select), `profiles`(본인 upsert)뿐. **`.from('rooms')` 직접 조회 0건**(invite_code 검색은 `join_room` DEFINER RPC 내부에서만). RLS 우회 누출 없음. (plan §6 line278 보안 포인트 충족)
- ✅ 모든 테이블 RLS 활성(sql:48-50). rooms/room_members는 insert/delete 정책 미정의 → 직접 쓰기 거부, RPC(DEFINER)만 허용.
- ✅ `.rpc()` 호출은 `create_room`/`join_room` 2건뿐. service_role 키 미사용.
- ✅ invite_code UNIQUE(sql:28) ↔ 코드충돌 재시도 최대 8회 후 `CODE_GENERATION_FAILED`(sql:133-151).

### 엣지케이스 (plan §6 대조 — 정적 경로 존재 확인)
- ✅ 없는/오타 코드 → `INVALID_CODE`(sql:192-194), 입력값 유지+인라인(OnboardingScreen:64-66,169-173)
- ✅ 자기 방 재입장 → 멱등 성공(sql:198-201)
- ✅ 이미 다른 방 소속 → `ALREADY_IN_ROOM`(create sql:129-131 / join sql:202-204)
- ✅ 6자 미만 → 입장 버튼 disabled(`isInviteCodeComplete`, OnboardingScreen:178)
- ✅ 혼동문자(0/O/1/I) → charset 외 클라 필터(code.ts:17-24)
- ✅ 빈/로딩/에러 UI → Onboarding(빈), SplashView(로딩), AuthErrorView(에러), 훅 인라인 에러

### 비용·디자인 가드레일
- ✅ AWS/amazon/s3 참조 0건(package.json·src). Storage/Edge/Kakao 이번 범위 없음.
- ✅ raw hex(`#xxxxxx`) tokens.ts 외 0건 — 원티드 토큰 사용.
- ✅ 멤버십 조회 진입 1회 + refresh()만, 폴링 없음(useMembership 주석/구조, 비용 가드레일 §8).
- ✅ `expo-clipboard` 의존성 존재(package.json `~7.0.1`) — OnboardingScreen import 해소.

---

## ❌ 실패
- **없음.** 정적 정합성 전 항목 통과.

---

## ⚠️ 미검증 (환경의존 — 런타임, 사용자 환경 필요)

> 아래는 결함이 아니라 **에이전트 정적 검증 범위 밖**(마이그레이션 실적용·익명로그인 활성화·dev client 재빌드 필요). 코드/계약 레벨 정합성은 위에서 확정됨.

| 항목 | 사유 | 사용자 검증 권장 |
|------|------|------------------|
| **C5 동시성** | `rooms ... for update` 직렬화 + 트리거 최종방어는 **실 DB 동시 트랜잭션**으로만 재현 가능 | 마지막 1자리에 2세션 동시 join → 1명 성공·1명 `ROOM_FULL` |
| **C8 재실행 전이** | 앱 재시작 시 멤버십 게이트가 in-room→RoomTabs 직행은 **실 세션+DB**로만 확인 | 입장 후 앱 강제종료·재실행 → RoomTabs 직행 |
| **C9 권한 런타임** | 익명 JWT로 RPC 실행 OK / 직접 테이블 insert 거부는 **실 익명세션**으로만 | 익명세션에서 `rpc('create_room')` 성공 + `from('rooms').insert` 거부 확인 |
| 마이그레이션 적용 | `supabase db push`/SQL 에디터 실행은 사용자 몫(에이전트 git/배포 금지) | 마이그레이션 적용 후 테이블·RLS·트리거·RPC 생성 확인 |
| 익명 로그인 활성화 | Supabase 대시보드 설정 의존 | Auth > 익명 로그인 ON 확인 |

---

## 결론
- **정적 통합 정합성: 전 항목 통과.** C1~C10 계약·타입·에러토큰(5종 1:1)·charset(32자)·분기·권한 선언·보안(RPC 전용 코드해석) 모두 양쪽 일치. devFlags 완전 제거.
- **실패 0건.** 미검증 항목은 모두 환경의존 런타임(사용자 환경 필요)이며 코드 레벨 결함 아님.
- 자체검증(developer): `tsc --noEmit` exit 0, `expo export` 번들 성공 — QA 정적 검증과 일치.
