# QA Report — `muklog-list` (로그 안 맛집 카드 리스트 + 최소 입력)

> 스프린트: `sprint-20260611-muklog-list` · QA 일자: 2026-06-11 · 검증자: qa-inspector
> 방법론: 경계면 교차검증(생산자↔소비자 양쪽 동시 읽기) + 인수조건↔테스트 1:1 + 표본 mutation(RED 확인).
> **종합 판정: ✅ PASS** — 모든 인수조건 통과, 경계면 정합, 회귀 0, 범위 준수. 미해결은 "사용자 몫 DB/디바이스 스모크"뿐(사유 명시).

---

## 1. 정량 결과 (직접 실행)

| 항목 | 결과 | 근거 |
|------|------|------|
| `npx tsc --noEmit` | ✅ 0 에러 (exit 0) | 직접 실행 |
| `npm test`(전체) | ✅ **276/276 통과**, 44 suites | 직접 실행 (dev-notes의 276 주장과 일치) |
| 컨벤션 — useCallback/useMemo 실제 호출 | ✅ 0건 | `grep -rn "useCallback\|useMemo" src` → 주석만 |
| 컨벤션 — `export function` 컴포넌트/훅 | ✅ 0건 | grep 0 hits |
| 컨벤션 — 인라인 `useEffect(() =>` | ✅ 0건 (명명 `loadMuklogsOnRoom`) | grep 0 hits |
| 컨벤션 — raw hex (muklog feature + Stars) | ✅ 0건 | grep 0 hits |
| 컨벤션 — enum-style 상수 / 파일명=심볼명 | ✅ 준수 | `MuklogErrorToken`·`MUKLOG_CATEGORIES` as const, 파일명 일치 |

### 테스트 의미성(load-bearing) — 표본 mutation 2건 → 모두 RED 확인
- **정렬 계약 변조**: `useMuklogs.ts` `visited_at` `ascending:false→true` → `useMuklogs.spec` 1 fail (`toHaveBeenNthCalledWith` line 92). ✅ 깨지면 빨개짐 → 복원 확인.
- **created_by 변조**: `validate.ts` `created_by: userId → 'WRONG'` → `useCreateMuklog.spec` 1 fail (AC2·AC8 단언). ✅ 복원 확인.
- 결론: 핵심 단언이 껍데기가 아니라 실제 계약을 붙들고 있음.

---

## 2. 인수조건 ↔ 테스트 1:1 (plan §8)

| AC | 시나리오 | 대응 테스트 | 결과 |
|----|----------|-------------|------|
| AC1 | 0건 빈 상태 | `useMuklogs.spec`(빈/null→ready[]), `MuklogList.spec`(빈 문구·"우리 맛집 0") | ✅ |
| AC2 | 저장→insert(created_by·room_id)→리스트 반영 | `useCreateMuklog.spec`(insert created_by=uid), `MuklogList.spec`(저장→refresh), `validate.spec`(toMuklogRow) | ✅ |
| AC3 | 장소명 빈 차단 | `validate.spec`(throw PLACE_NAME_REQUIRED), `useCreateMuklog.spec`(insert 미호출), `MuklogEntrySheet`(canSave 비활성) | ✅ |
| AC4 | rating 0/6 경계 | `validate.spec`(6/-1 throw, 0/null→null), `Stars`(1~5 한정) | ✅ |
| AC5 | 미래 방문일 | `validate.spec`(2999 throw) + 트리거 2차 방어 | ✅ |
| AC6 | 정렬 visited_at desc, created_at desc | `useMuklogs.spec`(order 인자 nth 검증) — mutation RED 확인 | ✅ |
| AC7 | 타방 격리(RLS) | 클라 계약: `eq('room_id', roomId)` 검증 + RLS DDL 실재(§3) — 실DB는 스모크 | ✅(계약)/스모크 |
| AC8 | created_by 위조 차단 | `with check(created_by=auth.uid())` DDL + `useCreateMuklog`가 실 uid만 채움 — mutation RED | ✅(계약)/스모크 |
| AC9 | 메모 500자·2줄 클램프 | `MuklogCard.spec`(numberOfLines=2), 시트 maxLength=500 | ✅ |
| AC10 | 작성자 라벨 | `MuklogCard.spec`(me→"내가 기록"/else→"짝꿍이 기록") | ✅ |
| AC11 | 조회 네트워크 실패 | `useMuklogs.spec`(error 전이), `MuklogList.spec`(메시지+다시 시도→refresh) | ✅ |
| AC12 | 저장 후 시트 닫힘+refresh 1회 | `MuklogList.spec`(refresh toHaveBeenCalledTimes(1)) | ✅ |

전 인수조건이 의미 있는 테스트로 커버됨.

---

## 3. 경계면 교차검증 (생산자 ↔ 소비자 동시 읽기)

| # | 경계면 | 생산자 | 소비자 | 판정 |
|---|--------|--------|--------|------|
| 1 | 쿼리 컬럼 ↔ 매핑 ↔ 카드 | `MUKLOG_SELECT_COLUMNS`(snake 10개) `useMuklogs.ts:18` | `toMuklog` camel `:40-51` → `Muklog` `types.ts:7` → MuklogCard 소비 필드 | ✅ 10개 컬럼 ↔ 10개 매핑 ↔ 타입 1:1, 누락/오타 없음 |
| 2a | RLS select ↔ 쿼리 | `muklogs_select_member`(`room_id IN 내 방`) SQL:58 | `from('muklogs').select().eq('room_id',roomId)` 직접 select(RPC 아님) | ✅ D3 정합. DEFINER RPC 불필요 |
| 2b | RLS insert with check ↔ 생성 | `created_by=auth.uid() and room_id IN 내 방` SQL:65 | `useCreateMuklog`가 `auth.getUser().id`로 created_by 채움(`toMuklogRow`) | ✅ 위조 차단 계약 정합 |
| 3 | 트리거 토큰 ↔ 에러 매핑 ↔ 앱 검증 | SQL raise `PLACE_NAME_REQUIRED`/`RATING_OUT_OF_RANGE`/`VISITED_AT_IN_FUTURE` (SQL:89/92/96) | `MuklogErrorToken`(errors.ts:11-13) ↔ `validate.ts` throw(같은 토큰) | ✅ 3자 문자열 완전 동기화 |
| 4 | 카테고리 enum 드리프트 | `MUKLOG_CATEGORIES` 8키(categories.ts:8) | mk-data.js CAT 8키(`bakery burger cafe chinese izakaya noodle pasta sushi`) | ✅ 키·label·emoji 일치(categories.spec가 드리프트 테스트) |
| 5 | 정렬 계약 ↔ 인덱스 | 쿼리 order(visited_at desc, created_at desc) | 인덱스 `idx_muklogs_room_visited(room_id, visited_at desc, created_at desc)` SQL:76 | ✅ 컬럼 순서 일치(풀스캔 회피) |
| 6 | roomId 전파 | LogScreen `route.params.roomId` | `<MuklogList roomId>` → `useMuklogs({roomId})` → `eq('room_id',roomId)` → 시트 insert `room_id` | ✅ 동일 값 전파 |
| 7 | snake↔camel 일관성 | DB snake(place_name 등) | toMuklog/ toMuklogRow 양방향 매핑 | ✅ 조회·생성 양방향 모두 단일 출처 |
| 8 | null 처리 일관 | lat/lng/area/category/memo/rating/visited_at nullable | 타입 `\| null` + 카드 결측 분기(칩 숨김/날짜만/메모 숨김/날짜 미정) | ✅ 양쪽 일관 |

**경계면 불일치 0건.**

---

## 4. 보안 · RLS 검사

| 항목 | 결과 |
|------|------|
| muklogs RLS enable | ✅ `alter table ... enable row level security` (SQL:55) — 주석 아님, 실제 정책 2개 실재 |
| select 격리 | ✅ `room_id in (select room_id from room_members where user_id = auth.uid())` — 타방 read 차단 |
| insert with check | ✅ `created_by = auth.uid() and room_id in (내 방)` — 타방 insert + created_by 위조 동시 차단 |
| update/delete 정책 부재 | ✅ 의도적 부재 → 직접 수정/삭제 거부(수정/삭제 OUT, 차기 슬라이스). divergence 아님 |
| created_by 클라 위조 불가 | ✅ 앱은 `auth.getUser().id`만 사용. 임의 uid를 넣어도 RLS with check가 거부(계약). `useCreateMuklog.spec`가 실 uid 주입 검증 |
| grant 최소권한 | ✅ `grant select, insert ... to authenticated`(update/delete grant 없음) |
| Kakao 키 노출 | ✅ 해당 없음 — 이번 슬라이스 Kakao 호출 0(OUT). 키 비유입 |
| 비용 가드레일 | ✅ Kakao/Storage 0, 진입1회+refresh(폴링·Realtime 없음), select 컬럼 최소화, 정렬 인덱스 |

> ⚠️ RLS/트리거의 **실행 시 행동**은 SQL 단위 대상 아님 → 실DB 스모크 필요(아래 §7). 클라 계약(쿼리 인자·row shape·토큰)은 모두 통과.

---

## 5. 회귀 영향 (불변 확인)

| 대상 | 결과 | 근거 |
|------|------|------|
| LogScreen 초대 카드(솔로 InviteCodeCard / 커플 "둘이 함께") | ✅ 불변 | `LogScreen.spec` 솔로/커플 분기·코드 노출/숨김·멤버 배지 테스트 잔존, 단언 삭제 0. placeholder만 제거→MuklogList 마운트 |
| log-invite(useRoom·InviteCodeCard·Sheet·JoinLog) | ✅ 불변 | room 스위트 15 suites/118 통과 |
| multi-log-home(useMyLogs·list_my_rooms·LogList "0곳") | ✅ 불변 | `list_my_rooms` 미변경(D7), LogListScreen 마지막 수정=`ui-redesign` 커밋(이번 미수정) |
| profile / ui-redesign | ✅ 불변 | profile 스위트 통과, 토큰 사용 |
| 기존 마이그레이션 5종 | ✅ 미수정 | 신규 additive 파일만 추가 |
| 기존 spec 단언 삭제 | ✅ 0건 | LogScreen.spec는 placeholder→useRoom 분기로 **갱신**(의도적, 기존 AC 보존) |

---

## 6. 범위 준수 (오버구현 점검)

이번 OUT 항목이 **실제로 미구현**임을 grep으로 전수 확인 — 모두 정상(코멘트 언급만 존재, 코드 없음):

| OUT 항목 | 결과 |
|----------|------|
| muklog_photos 테이블 | ✅ 미생성(마이그레이션에 `create table` 없음, 주석 언급만) |
| Kakao 장소검색·좌표·주소 | ✅ 미구현(lat/lng/address 컬럼은 nullable 선반영만, UI/호출 0) |
| 2초 영상(video_path/duration) | ✅ nullable 컬럼 선반영만, UI 없음 |
| 먹로그 상세 / 카드 탭 navigate | ✅ MuklogCard onPress 미연결(D6) |
| 수정/삭제 RPC·정책·UI | ✅ update/delete 정책 없음 |
| LogList "맛집 N곳" 카운트(list_my_rooms 변경) | ✅ 미변경. 섹션 N="우리 맛집"은 조회 리스트 길이(D7) |
| 카테고리 필터 칩 / Realtime | ✅ 미구현 |

**오버구현 0건.** 스코프 정확.

> 참고(버그 아님): `MuklogEntrySheet`는 입력 필드에 `area`를 두지 않고 `area: null`로 고정 전달(`MuklogEntrySheet.tsx:45`). plan §6.3의 시트 필드 목록(장소명·카테고리·별점·메모·방문일)에 area가 없으므로 **의도된 설계**(area는 표시 전용 forward-compat 컬럼, 차기 editor가 Kakao 주소에서 파생). 카드는 area null을 안전 처리(날짜만). 정합.

---

## 7. 미해결 / 미검증 (사유 명시 — 통과로 처리하지 않음)

단위 테스트 경계를 벗어나 **사용자 환경(실 DB / 디바이스) 스모크가 필요**한 항목. 코드/계약은 모두 통과했으나 런타임 실증은 사용자 몫:

1. **마이그레이션 실 DB 미적용** — `supabase db push` 또는 SQL 에디터 실행이 사용자 액션(dev-notes §5). 미적용 시 런타임 테이블 부재. → **사용자 적용 필요.**
2. **실 RLS 타방 격리(AC7)** — A방 멤버가 B방 먹로그 select → 0건 확인은 실 DB에서만 가능(모킹은 eq 필터·정책 DDL까지).
3. **트리거 raise(AC3·AC4·AC5 2차)** — place_name 빈/rating 6/미래 visited_at insert 시 각 토큰 에러는 실 DB 트리거 실행 필요.
4. **created_by 위조 거부(AC8)** — 타인 uid insert→with check 거부는 실 DB.
5. **디바이스 렌더** — 카드/시트/FAB/빈 상태, 그라데이션→`primaryWeak` 단색 축약, 방문일 텍스트 입력(네이티브 피커 차기) 실기기 확인.

> 위 5건은 **단위 테스트로 검증 불가한 영역**이며 plan §13·dev-notes §5에 스모크로 명시됨. "실패"가 아니라 "디바이스/DB 스모크 대기".

---

## 8. 발견 이슈 (파일:라인 + 권장)

**기능/경계면/보안/회귀 결함 0건.** 코드 수정 요청 사항 없음.

경미 관찰(차기 백로그 후보, 이번 스프린트 차단 아님):
- `useCreateMuklog`의 미래 방문일 비교는 앱 로컬(`todayLocalDate`), 트리거는 서버 `current_date`(TZ 차이 가능). validate.ts 주석에 이미 명시됨 + 트리거가 최종 방어 → 경계 케이스 무해. 조치 불요.
- 별점 색: 킷 앰버(#FFB23E) → 토큰 `warning`으로 근사(dev-notes §4 명시). raw hex 금지 준수를 위한 의도적 근사. 디자인 토큰 추가는 선택 사항.

---

## 9. 종합 판정

**✅ PASS** — `muklog-list` 스프린트 완료 기준 충족.
- tsc 0 / test 276 통과 / 컨벤션 100% / 경계면 정합 / RLS 보안 계약 정합 / 회귀 0 / 범위 정확 / 테스트 load-bearing(mutation RED 확인).
- 잔여는 **사용자 몫 DB·디바이스 스모크**(§7)뿐. 코드 차원 차단 이슈 없음.
