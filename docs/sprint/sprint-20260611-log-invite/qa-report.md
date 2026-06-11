# QA Report — `log-invite` (커플 초대 흐름 완성)

> 슬러그: `sprint-20260611-log-invite` · 검증일: 2026-06-11 · 검증자: qa-inspector
> 방법론: 경계면 교차검증(생산자↔소비자 양쪽 동시 읽기) + RED-check(핵심 단언 변조→빨개짐 표본 확인)
> **결론: PASS** — 인수조건 AC1–AC17 충족, 217/217 테스트 통과, tsc 0, 보안 핵심(C4-RLS) 실재 확인, 회귀 없음.

---

## 1. 실행 수치 (직접 실행)

| 항목 | 결과 |
|------|------|
| `npm test` | **217 passed / 217 total** (34 suites) — dev-notes 명시(217)와 일치 |
| `npx tsc --noEmit` | **에러 0** (EXIT 0) |
| useCallback/useMemo (비주석) | **0건** (`grep -rn` 전수) |
| `export function` 컴포넌트/훅 | **0건** |
| 인라인 `useEffect(() =>` | **0건** (모두 명명 함수: `loadRoomOnId`/`clearCopiedFeedback` 등) |
| raw hex(theme 외) | **0건** |

> 참고(비차단): `useMyLogs.ts:75` act() 경고가 콘솔에 출력되나 **이번 스프린트 산출물 아님**(기존 multi-log-home). 테스트는 통과. 차기 정리 권장.

---

## 2. 경계면 교차검증 (생산자 ↔ 소비자 양쪽 동시 읽기)

| ID | 경계면 | 생산자 | 소비자 | 결과 |
|----|--------|--------|--------|------|
| **C1** | get_room 응답(snake) ↔ useRoom 매핑(camel) | `20260611120000_log_invite.sql:65-70` `jsonb_build_object('room_id','invite_code','member_count','mode')` | `useRoom.ts:67-74` `roomId/inviteCode/memberCount/mode` | ✅ 키 4개 정확 매핑, 누락·오타 없음 |
| **C2** | SQL `raise '<TOKEN>'` ↔ errors.ts | SQL raise: `NOT_AUTHENTICATED`(L38)·`ROOM_NOT_FOUND`(L48)·`NOT_A_MEMBER`(L57) | `errors.ts:20-21` `NOT_A_MEMBER`/`ROOM_NOT_FOUND` 한국어, 기존 7토큰 불변(총 9) | ✅ 양쪽 문자열 정확 일치. `errors.spec.ts`가 "정확히 9토큰" 단언으로 잠금 |
| **C3** | RPC 인자명 ↔ 훅 호출 | 시그니처 `get_room(p_room_id uuid)` / `join_room(p_code)` | `useRoom.ts:51` `rpc('get_room',{p_room_id})` / `useJoinRoom.ts:28` `rpc('join_room',{p_code})` | ✅ 인자명 정확 일치(조용한 실패 없음) |
| **C4-RLS** | get_room DEFINER 본문 멤버십 검사 | `log_invite.sql:53-58` `if not exists(select 1 from room_members where room_id=p_room_id and user_id=v_uid) then raise 'NOT_A_MEMBER'` | (서버 보안) | ✅ **실재(주석 아님). 보안 핵심 통과** |
| **C5-RLS** | member_count 출처 | `log_invite.sql:61-63` DEFINER `count(*) from room_members` | useRoom/LogScreen 솔로·커플 분기 | ✅ 클라 직접 select 아님 — RLS self-only 우회 위해 DEFINER 집계 사용 |
| **C6** | charset ↔ CodeInput 정규화 | `code.ts` `normalizeInviteCodeInput`/`INVITE_CODE_LENGTH` | `CodeInput.tsx:8,37` 유틸 위임(자체 정규식 재작성 없음), `code` 직접 import(배럴 우회 — 테스트 환경 보호) | ✅ 단일 출처 위임 |
| **C7** | 네비 라우트 | `routes.ts:11` `JoinLog` + `AppNavigator.tsx:42-46` 스크린 등록 | PlusHeaderButton `navigate(JoinLog)`(L41)·JoinLogScreen `replace(LogScreen,{roomId})`(L36) | ✅ 라우트명·params 정합 |
| **C8** | join 성공 후 상태 흐름 | join_room 성공 | `JoinLogScreen.tsx:33-36` `joinRoom({code})→refresh()→replace(LogScreen,{roomId})` → LogScreen이 memberCount로 커플 반영 | ✅ 흐름 정합 |
| **C10** | clipboard 인자 | `InviteCodeCard.tsx:41` `Clipboard.setStringAsync(code)` | 표시 코드 `room.inviteCode` | ✅ 인자 = 표시 코드 동일. spec이 `setStringAsync('ABCDEF')` 단언 |

**RED-check(테스트 load-bearing 표본 검증):**
- C1 변조(`inviteCode: row.invite_code` → `""`) → `useRoom.spec.ts` 매핑/refresh 2건 **RED** ✅
- C8 변조(`replace(LogScreen,{roomId})` → `replace(JoinLog)`) → `JoinLogScreen.spec.tsx` AC12 **RED** ✅
- 변조 후 백업에서 byte-exact 복원 확인(`diff` 일치), 최종 217/217 재통과.

---

## 3. 인수조건 (AC1–AC17)

| AC | 내용 | 대응 테스트 | 결과 |
|----|------|------------|------|
| AC1 | 솔로 LogScreen → inviteCode 표시 | `LogScreen.spec`(솔로) · `InviteCodeCard.spec`(코드 표시) | ✅ |
| AC2 | 복사 → `setStringAsync(code)` + "복사됨" | `InviteCodeCard.spec`(2·3) | ✅ |
| AC3 | 커플(≥2) → 코드 숨김 + "둘이 함께 기록 중" | `LogScreen.spec`(커플) | ✅ |
| AC4 | roomId 없음/`{}` → 안전 메시지(회귀) | `LogScreen.spec`(roomId 없음·params undefined 2건) | ✅ |
| AC5 | get_room 에러 → 에러+재시도, 코드 미표시 | `LogScreen.spec`(error) | ✅ |
| AC6 | + 탭 → 2액션 시트 | `PlusHeaderButton.spec`(AC6) | ✅ |
| AC7 | 생성 → createRoom→navigate(LogScreen)+refresh | `PlusHeaderButton.spec`(AC7) | ✅ |
| AC8 | 입장 → navigate(JoinLog) | `PlusHeaderButton.spec`(AC8) | ✅ |
| AC9 | 생성 실패 → Alert, navigate/refresh 없음 | `PlusHeaderButton.spec`(AC9) | ✅ |
| AC10 | 정규화(대문자/공백/혼동문자 제거) | `CodeInput.spec`(정규화·혼동문자) | ✅ |
| AC11 | 5자 비활성 / 6자 활성 | `JoinLogScreen.spec`(AC11) | ✅ |
| AC12 | 성공 → joinRoom→refresh→replace(LogScreen) | `JoinLogScreen.spec`(AC12) | ✅ |
| AC13 | INVALID_CODE → 인라인 에러, 네비 없음 | `JoinLogScreen.spec`(AC13) | ✅ |
| AC14 | ROOM_FULL → 인라인 에러 | `JoinLogScreen.spec`(AC14) | ✅ |
| AC15 | 이미 멤버 코드 → 멱등 성공, 그 로그 이동 | **서버 보장**: `join_room`(20260610150000) L144 `if exists(...) return {room_id}` 멱등. 클라는 성공 일률 처리 → replace. (SQL/RPC = 단위 OUT, 스모크) | ✅(서버 보장 확인) |
| AC16 | 비멤버 임의 roomId → NOT_A_MEMBER(코드 미노출) | DB 스모크 + 단위 토큰→메시지(`useRoom.spec` NOT_A_MEMBER) | ✅(토큰 경로) / 실 DB는 스모크 |
| AC17 | 내가 멤버인 로그만 코드 표시 | C4-RLS 멤버십 검사(L53-58) 교차검증 | ✅ |

---

## 4. 보안 검사 (치명도 최우선)

- **C4-RLS (PASS):** `get_room`은 `security definer`(L28)로 RLS를 우회한다. 본문 L53-58에 **실제 `raise exception 'NOT_A_MEMBER'`** 가 존재(주석 아님). 검사 순서: 미인증→`ROOM_NOT_FOUND`(L47)→**멤버십 검사**(L53)→count→반환. 비멤버는 존재하는 코드라도 거부 → **임의 로그 invite_code 노출 차단**. plan §4 D1·C4-RLS 의도 100% 충족.
- **권한 (PASS):** `revoke all ... from public, anon`(L75) + `grant execute ... to authenticated`(L76). anon 차단.
- **additive/idempotent (PASS):** `create or replace`만, 기존 `join_room`/`create_room` 미수정(이 파일 내 join_room/create_room 참조 0건). 권한 재선언으로 재실행 안전.

---

## 5. 회귀 / 의도된 변경 구분

**의도된 변경(회귀 아님 — plan §D2/§7 T7 명시):**
- `PlusHeaderButton`: 단일 생성("화면 전환 없음") → AddSheet 분기 + 생성 후 `navigate(LogScreen)`. spec도 함께 갱신(AC6–AC9). **정당** — plan D2가 명시한 UX 개선(생성자가 코드 즉시 확인).
- `LogScreen`: stub placeholder → useRoom 분기. spec 갱신.
- `errors.spec`: 7→9 토큰.

**불변 확인(회귀 없음):**
- `create_room`/`join_room`/`list_my_rooms`/`leave_room` 마이그레이션 미수정. `join_room`은 `p_code` 인자·멱등·ROOM_FULL 그대로.
- `useMyLogs`/`useJoinRoom`/`useCreateRoom`/`code.ts`/profile/ui-redesign 토큰·동작 불변(전체 217 통과로 회귀 부재 확인).
- 기존 spec 단언 삭제 없음 — 추가/의도적 갱신만.

---

## 6. 범위 준수 (오버구현 점검)

명시적 OUT 항목 전수 grep — **오버구현 없음**:
- 파트너 신원(닉네임/아바타) 조회: 미구현 ✅ (LogScreen은 memberCount 기반 "혼자/둘이"만)
- `CreatedScreen`: 미도입 ✅
- OS 공유시트(`Share.share`): 미사용 ✅
- 로그 나가기 UI: `useLeaveRoom`은 어떤 화면에도 미연결(dormant 유지) ✅
- 맛집(먹로그) 엔트리: LogScreen 하단 placeholder만 ✅
- 카카오/지도: 무관 ✅

---

## 7. UI 디자인 / 비용 가드레일

- **토큰만 사용(PASS):** raw hex 0건. InviteCodeCard(primaryWeak·radius.sheet)·Sheet(radius 26·딤 fg+opacity)·CodeInput(primary 보더+glow)·AddSheet 모두 `useTheme()` 토큰. 이모지(🥢💌💑🍽️) 허용 정책 준수. 복사 버튼은 텍스트 라벨(D4 — 글리프 아이콘 없음) ✅
- **비용 가드레일(PASS):** `useRoom`은 진입 1회 + 명시 refresh(폴링/Realtime 없음). get_room 1 round-trip. clipboard 로컬. AWS 미사용 ✅

---

## 8. 미검증 (사유 명시 — 통과로 처리하지 않음)

| 항목 | 사유 |
|------|------|
| 마이그레이션 실 DB 적용(AC16 실 거부, AC15 실 멱등) | `get_room` RPC가 **원격 DB 미적용**(에이전트 DB push 미수행, dev-notes §4). 사용자 `supabase db push` 필요. SQL 본문은 정적 검증 통과, 클라는 토큰 경로 단위 검증. **실 DB 스모크는 사용자 액션.** |
| 디바이스 스모크(실 클립보드/Modal 슬라이드/키보드 포커스/2번째 join 커플화) | 네이티브 동작 — 단위 대상 외(testing-strategy 경계). 사용자 디바이스 스모크 필요. |

> 위 2건은 **단위 검증 경계 밖**이며 plan/testing-strategy가 사용자 액션으로 명시한 항목. 코드/계약 결함이 아니라 "환경 의존 미수행"으로 분류.

---

## 9. 발견 이슈

**차단 이슈: 없음.** 모든 경계면·인수조건·보안 검사 통과.

**비차단(권장, 차기):**
1. (기존) `useMyLogs.ts:75` 테스트 act() 경고 — 이번 스프린트 무관, 차기 정리 권장. 테스트 통과엔 영향 없음.

---

## 10. 완료 기준 점검 (plan §13)

- [x] AC1–AC17 대응 테스트 존재 + `npm test` 217/217 통과
- [x] `npx tsc --noEmit` 0
- [x] 코드 컨벤션 100%(useCallback/useMemo 0·raw hex 0·화살표·명명 effect·named-args)
- [x] ui-design 킷 재현(웜 토큰·이모지·텍스트 글리프 아이콘 금지)
- [x] 마이그레이션 additive·idempotent (실 적용은 사용자 환경)
- [x] 회귀 없음 / 의도된 spec 갱신만
- [x] git 작업 없음(검증자 수정 0 — RED-check는 byte-exact 복원)

**스프린트 상태: 완료 가능(PASS).** 단, 사용자가 `supabase db push`로 `get_room` 적용 + 디바이스 스모크를 수행해야 실 환경 동작이 보증됨(§8).
