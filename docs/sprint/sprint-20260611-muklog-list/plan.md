# Sprint Plan — `muklog-list` (로그 안 맛집 카드 리스트)

> 슬러그: `sprint-20260611-muklog-list` · 날짜: 2026-06-11 · 단일 기능: **LogScreen 안의 먹로그(맛집) 카드 리스트 + 최소 수동 입력**
> 설계 단일 출처: `docs/design/architecture.md` §3(muklogs·muklog_photos·RLS) · §4(LogScreen MuklogList/Editor) · §5(백로그 `muklog-list` 행).
> UI 단일 출처(최우선): `ui-design` 스킬 muklog 킷 — `mk-log.jsx`의 **LogScreen(10–78)·MuklogCard(81–118)** + `mk-data.js`(먹로그 shape·카테고리). MuklogDetail/Editor/PlaceSearch는 차기(참고만).
> 테스트 전략: `docs/testing-strategy.md`(TDD Red→Green→Refactor, jest-expo + @testing-library/react-native). 코드 컨벤션: `docs/code-convention.md`.

---

## 1. 기능 한 줄 정의

LogScreen에서 그 로그에 속한 **맛집 기록(먹로그) 카드 리스트**를 최신순으로 보여주고, 비어 있으면 빈 상태를 보여주며, **새 먹로그 버튼(FAB)** 으로 **최소 입력(장소명·카테고리·별점·메모·방문일)** 시트를 열어 저장하면 리스트에 즉시 반영한다. **Kakao 장소검색·좌표·사진·영상은 OUT**(차기 muklog-editor / muklog-video).

---

## 2. 범위 (Scope)

### In-scope
1. **`muklogs` 테이블 신규 생성**(전체 컬럼 선반영 + 일부 nullable 조정, §3.1) + **RLS**(방 멤버만 select/insert) + 인덱스 + INSERT 트리거(rating/visited_at 검증) — 마이그레이션 `20260611130000_muklog_list.sql`.
2. **리스트 조회 계약**: 한 로그(`roomId`)의 먹로그 목록을 1 round-trip으로 — **클라 직접 `from('muklogs').select()` (RLS 하)** + `created_by`로 작성자 파생. shape·정렬(`visited_at desc, created_at desc`)·snake→camel 매핑.
3. **최소 입력**: `useCreateMuklog` 훅 + **`MuklogEntrySheet`**(장소명·카테고리·별점·메모·방문일). Kakao/사진/영상 없이 직접 타이핑. 저장 후 `refresh()`.
4. **LogScreen 통합**: 기존 초대 카드(log-invite 산출물, 불변) **아래에** 섹션 헤더("우리 맛집 N") + `MuklogCard` 리스트 + 빈 상태 + **FAB("새 먹로그")**. 커플/솔로 무관하게 리스트 표시. 기존 placeholder 제거.
5. **`MuklogCard` 컴포넌트**: mk-log.jsx 81–118 재현(카테고리 칩·별점·장소명·area·방문일·메모 2줄 클램프). 좌표·사진 없는 슬라이스에 맞게 **사진 카운트 배지·area·작성자 아바타는 가용 데이터로 축약**(§4 결정).

### Out-of-scope (명시적 제외 — 추측 금지)
- **Kakao 장소검색·좌표(lat/lng)·주소(address/road_address)·kakao_place_id** → `muklog-editor`. 이번 입력은 좌표 없이 저장(§3.1 nullable 결정).
- **사진(`muklog_photos` + Storage 업로드·압축)** → `muklog-editor`. 이번 마이그레이션은 `muklog_photos` 테이블을 **만들지 않는다**(§3.4 결정).
- **2초 영상(`video_path`/`video_duration_ms` + 카메라)** → `muklog-video`. 컬럼은 nullable로 선반영만, UI/업로드 없음.
- **먹로그 상세(MuklogDetail: 캐러셀·미니맵·InfoRow)** → `muklog-detail`. 카드 탭 동작은 이번 OUT(탭해도 navigate 없음 — §4 결정).
- **수정/삭제(update/delete RPC·UI)** → 차기. 이번은 **생성+조회만**.
- **카테고리 필터 칩(mk-log.jsx 60–64)** → §4에서 OUT 결정(데이터 적은 1차엔 과함). 차기 슬라이스.
- **Realtime 구독**(상대가 추가 시 실시간 반영) → MVP 이후. 이번은 "진입 1회 + 저장 후 refresh"만.
- **작성자 아바타/닉네임 데이터**(파트너 프로필): room_members RLS=자기 행만이라 파트너 프로필 read 불가 → 차기. 이번은 "내가 기록 / 짝꿍이 기록"만 `created_by == 내 uid` 로 파생(§4 결정).

---

## 3. 사전 사실 확인 (기존 코드/스키마 정독 결과)

| 항목 | 상태 | 출처 |
|------|------|------|
| `rooms` / `room_members` 테이블 + RLS(자기 멤버 방만) | ✅ 존재 | `20260609120000_invite_room.sql` |
| `room_members` RLS = **자기 행만** select(자기참조 재귀 회피) | ✅ 주의점 | invite_room.sql 73–76 |
| DEFINER RPC 패턴(`create_room`/`join_room`/`list_my_rooms`/`get_room`/`leave_room`) | ✅ 패턴 | invite_room.sql / multi_log_home.sql |
| `get_room(p_room_id)` → LogScreen이 invite_code·member_count·mode 조회 | ✅ log-invite | `useRoom.ts`, log-invite plan |
| LogScreen 현재: 초대 카드(솔로 InviteCodeCard / 커플 "둘이 함께") + 맛집 **placeholder** | ✅ 현재 | `LogScreen.tsx` 100–115 |
| 훅 패턴: "진입 1회 + refresh", mountedRef, snake→camel `toX` 매핑, 일반 함수(no useCallback) | ✅ 패턴 | `useRoom.ts`·`useMyLogs.ts` |
| `mapRoomError`(에러 토큰→한국어) | ✅ 재사용 | `errors.ts` |
| 카테고리 enum: pasta·cafe·noodle·sushi·bakery·chinese·burger·izakaya (8종, label·emoji) | ✅ UI 출처 | `mk-data.js` CAT |
| `muklogs` 테이블 | ❌ **없음 → 이번 생성** | — |

> ⚠️ **선행 의존**: 이번 LogScreen 통합은 `log-invite`(초대 카드 + get_room/useRoom)가 **이미 머지된 상태**를 전제한다. 현 `LogScreen.tsx`가 이미 그 형태(초대 카드 + placeholder)이므로 충족. 이번 작업은 placeholder를 리스트로 **대체**한다.

---

## 4. 핵심 결정 (Decisions) — architecture 대비 divergence 명시

### D1. 스키마 범위 = **전체 컬럼 선반영**(차기 대비), 일부 NULL 허용
- **결정**: architecture §3의 muklogs 컬럼을 **전부** 만든다(`kakao_place_id`·`category`·`address`·`road_address`·`lat`·`lng`·`memo`·`rating`·`visited_at`·`video_path`·`video_duration_ms`·`created_by`·`created_at`·`updated_at`). 단, 이번 슬라이스에서 채우지 않는 컬럼은 **nullable**.
- **근거**: 점진 컬럼 추가는 마이그레이션을 늘리고 차기 editor/video가 매번 `alter table`을 떠안는다. 컬럼 선반영은 무해(NULL)하고 editor/video는 본문만 채우면 된다. multi-log-home이 `leave_room(p_room_id)`·`delete_scheduled_at`을 선반영한 선례와 일관.

### D2. ⚠️ `lat`/`lng` **NOT NULL → NULL 허용**으로 divergence (team-lead 확인 요청)
- **architecture §3**: `lat double precision (NOT NULL)`, `lng (NOT NULL)`.
- **문제**: 이번 수동 입력 슬라이스엔 Kakao 좌표가 없다. NOT NULL이면 저장 자체가 불가 → 임의 기본값(0,0)은 지도(map-tab)에 가짜 핀을 찍는 오염.
- **결정(제안)**: `lat`/`lng`를 **nullable**로 만들고, `muklog-editor`(Kakao 장소검색)에서 좌표를 채운다. 좌표 없는 먹로그는 지도 탭에서 **핀 제외**(map-tab이 `where lat is not null`로 필터). architecture §3 주석에 "수동입력 시 NULL 가능"이 `kakao_place_id`엔 이미 있으나 lat/lng엔 NOT NULL로 남아 모순 → 이 문서가 단일 출처와 어긋나므로 **임의 변경하지 않고 plan에 근거를 남기고 team-lead 승인 후 확정**한다. 승인 시 architecture §3의 lat/lng NOT NULL을 "NULL 가능(수동입력)"으로 갱신.
- **대안(기각)**: ① 0,0 기본값 → 지도 오염·정렬 오류로 기각. ② 이번에 Kakao 좌표 포함 → muklog-editor 통째 흡수라 1스프린트 초과로 기각.

### D3. 조회 방식 = **클라 직접 select(RLS 하)**, RPC 아님
- **결정**: `supabase.from('muklogs').select('id, room_id, place_name, category, area, memo, rating, visited_at, created_by, created_at').eq('room_id', roomId).order('visited_at', { ascending: false }).order('created_at', { ascending: false })`.
- **근거**: muklogs RLS가 `room_id IN (내 방)`이라 **클라 직접 select가 안전·충분**(member_count처럼 RLS 우회 집계가 필요 없음 — 행 자체가 멤버 방 한정). `list_my_rooms`/`get_room`이 DEFINER였던 이유(room_members 자기 행만이라 집계 불가)는 여기 해당 없음. RPC 불필요 → 단순.
- **작성자 파생**: `created_by === auth user id` 비교로 "내가 기록 / 짝꿍이 기록" 라벨. 파트너 닉네임·아바타는 RLS상 read 불가 → OUT(차기).

### D4. `area`(동네) 컬럼 추가 — UI 카드 표시용 최소 입력 필드
- mk-log.jsx MuklogCard는 `m.area`(예: "연남동")를 표시한다. architecture §3엔 `address`/`road_address`만 있고 `area`는 없다.
- **결정**: 카드 표시·수동 입력 편의를 위해 **`area text` nullable 컬럼을 추가**(divergence — 경미, 표시 전용). 차기 editor가 Kakao 주소에서 동네를 파생하면 area로 채우거나 road_address 표시로 전환 가능. team-lead 확인 대상(D2와 함께).
- 카드의 위치줄: `area`가 있으면 `{area} · {visitedAt}`, 없으면 `{visitedAt}`만(harden).

### D5. `muklog_photos` 테이블 = **이번 OUT**(만들지 않음)
- **근거**: 사진은 Storage 업로드·압축·order_index 트리거가 묶인 별도 무게. muklog-editor 스프린트에서 테이블+버킷+RLS를 함께 도입해야 응집도가 높다. 이번에 빈 테이블만 만들면 죽은 코드. MuklogCard의 사진 카운트 배지는 이번엔 **숨김**(photos 데이터 없음).

### D6. 카드 탭 → 상세 = **이번 OUT**(navigate 없음)
- MuklogDetail은 `muklog-detail` 스프린트. 이번 카드는 탭해도 이동하지 않음(또는 비활성). 회귀 안전 위해 `onPress` 미연결.

### D7. 카운트 반영(LogListScreen "맛집 N곳") = **이번 OUT**
- **근거**: `list_my_rooms`에 spot count를 추가하면 RPC 시그니처(반환 컬럼) 변경 → useMyLogs 매핑·MyLog 타입·LogListScreen 카드까지 회귀 표면이 넓어진다. muklogs 테이블이 갓 생긴 시점이라 카운트는 **별도 슬라이스**로 분리(아래 §11). 이번 LogScreen 섹션 헤더의 "우리 맛집 N"은 **이번에 조회한 리스트 길이**로 충분히 표시 가능(추가 쿼리 불필요).

### D8. 카테고리 필터 칩 = **이번 OUT**
- 데이터가 적은 1차엔 과함. 섹션 헤더 + "최근 순" 라벨까지만. 칩 필터는 차기.

---

## 5. 데이터·API 계약 (Contracts)

### 5.1 마이그레이션 `20260611130000_muklog_list.sql` (additive, idempotent)

**테이블 `public.muklogs`** (전체 컬럼 선반영, D1)
| 컬럼 | 타입 | NULL | 이번 사용 | 비고 |
|------|------|------|----------|------|
| `id` | uuid PK default gen_random_uuid() | NO | ✅ | |
| `room_id` | uuid NOT NULL → rooms(id) ON DELETE CASCADE | NO | ✅ | 로그 삭제 시 정리 |
| `place_name` | text NOT NULL | NO | ✅ | 입력 필수 |
| `kakao_place_id` | text | YES | — | editor |
| `category` | text | YES | ✅ | enum 8종(앱 검증) |
| `area` | text | YES | ✅ | D4 표시용 |
| `address` | text | YES | — | editor |
| `road_address` | text | YES | — | editor |
| `lat` | double precision | **YES** (D2) | — | editor(좌표) |
| `lng` | double precision | **YES** (D2) | — | editor(좌표) |
| `memo` | text | YES | ✅ | |
| `rating` | smallint | YES | ✅ | 1~5(트리거 검증) |
| `visited_at` | date | YES | ✅ | 기본 today |
| `video_path` | text | YES | — | video |
| `video_duration_ms` | integer | YES | — | video |
| `created_by` | uuid NOT NULL → profiles(id) | NO | ✅ | 작성자 파생 |
| `created_at` | timestamptz NOT NULL default now() | NO | ✅ | 정렬 보조 |
| `updated_at` | timestamptz NOT NULL default now() | NO | — | editor(수정) |

**RLS** (architecture §3 정책 그대로)
```sql
alter table public.muklogs enable row level security;

-- select: 내 방 먹로그만
create policy "muklogs_select_member" on public.muklogs
  for select using (
    room_id in (select room_id from public.room_members where user_id = auth.uid())
  );

-- insert: 내 방에만 + 작성자=나
create policy "muklogs_insert_member" on public.muklogs
  for insert with check (
    created_by = auth.uid()
    and room_id in (select room_id from public.room_members where user_id = auth.uid())
  );
-- update/delete 정책: 이번 없음(수정/삭제 OUT) → 직접 쓰기 거부
```

**인덱스**
```sql
create index if not exists idx_muklogs_room_visited
  on public.muklogs (room_id, visited_at desc, created_at desc);
```

**INSERT/UPDATE 트리거 — rating·visited_at·category 2차 검증**(앱 1차 + DB 최종 방어)
```sql
create or replace function public.enforce_muklog_fields()
returns trigger language plpgsql as $$
begin
  if new.place_name is null or length(btrim(new.place_name)) = 0 then
    raise exception 'PLACE_NAME_REQUIRED' using errcode = 'P0001';
  end if;
  if new.rating is not null and (new.rating < 1 or new.rating > 5) then
    raise exception 'RATING_OUT_OF_RANGE' using errcode = 'P0001';
  end if;
  -- 미래 방문일 차단(오늘까지 허용). NULL은 허용.
  if new.visited_at is not null and new.visited_at > current_date then
    raise exception 'VISITED_AT_IN_FUTURE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_muklog_fields on public.muklogs;
create trigger trg_muklog_fields
  before insert or update on public.muklogs
  for each row execute function public.enforce_muklog_fields();
```
> ⚠️ `created_by`/`room_id` 위변조는 **RLS `with check`** 가 막는다(다른 방·남의 명의 insert 거부). 트리거는 값 범위만.

**권한**: muklogs는 RLS 하 직접 접근이므로 RPC 권한 부여 없음. `grant select, insert on public.muklogs to authenticated;` (RLS가 행 제한).

### 5.2 조회 — 클라 직접 select (D3)

`useMuklogs({ roomId })` → `MuklogsState`
```ts
type Muklog = {
  id: string;
  roomId: string;
  placeName: string;
  category: string | null;   // CAT key (8종) | null
  area: string | null;
  memo: string | null;
  rating: number | null;     // 1~5
  visitedAt: string | null;  // 'YYYY-MM-DD'
  createdBy: string;         // uuid
  createdAt: string;         // ISO
};
type MuklogsState =
  | { status: 'loading' }
  | { status: 'ready'; muklogs: Muklog[] } // [] = 빈 상태(정상)
  | { status: 'error'; message: string };
```
- 쿼리: `from('muklogs').select('id, room_id, place_name, category, area, memo, rating, visited_at, created_by, created_at').eq('room_id', roomId).order('visited_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })`.
- snake→camel `toMuklog({ row })` 매핑(단일 출처). RLS가 방 격리.
- 정책: 진입 1회 + `refresh()`(저장 후 호출). 폴링/Realtime 금지(§10).

### 5.3 입력 — `useCreateMuklog`

```ts
type CreateMuklogInput = {
  roomId: string;
  placeName: string;          // 필수, trim 후 비면 차단
  category?: string | null;   // CAT key
  area?: string | null;
  rating?: number | null;     // 1~5
  memo?: string | null;
  visitedAt?: string | null;  // 'YYYY-MM-DD', 기본 today, 미래 차단
};
// createMuklog(input) → { id } | throw. loading/error 노출.
```
- 내부: `created_by = (await supabase.auth.getUser()).data.user.id` 채워서 `from('muklogs').insert(row).select('id').single()`. (RLS `with check`가 created_by=auth.uid() 강제 → 누락/위조 거부.)
- 에러 토큰(`PLACE_NAME_REQUIRED`/`RATING_OUT_OF_RANGE`/`VISITED_AT_IN_FUTURE`) → 한국어 메시지. `errors.ts`에 muklog 토큰 추가하거나 별도 `mapMuklogError`. **앱 1차 검증으로 대부분 차단**, 트리거는 최종 방어.

---

## 6. 화면 · UX (UI 단일 출처 = ui-design 킷)

### 6.1 LogScreen 통합 (mk-log.jsx LogScreen 10–78 기반)
- 기존(불변): 멤버 배지 + 초대 카드(솔로 InviteCodeCard / 커플 "둘이 함께 기록 중"). **log-invite 산출물 유지**.
- **추가**:
  - **섹션 헤더**: 좌측 `우리 맛집 {N}`(h2, 800 weight), 우측 `최근 순`(fgWeak). N = 조회된 리스트 길이(D7).
  - **리스트**: `MuklogCard` 세로 스택(gap 14). 원티드 muklog 웜 토큰.
  - **빈 상태**: 리스트 0건 → 이모지 + "아직 기록한 맛집이 없어요" + "아래 + 버튼으로 첫 맛집을 남겨보세요 🍽️". (기존 placeholder 제거.)
  - **FAB**: 우하단 원형 + 버튼(mk-log.jsx `lk.fab`, accent 배경 흰 + 아이콘) → `MuklogEntrySheet` 오픈. accessibilityLabel "새 먹로그".
- 로딩/에러: muklogs 조회 로딩 시 리스트 영역 로더, 에러 시 메시지 + 다시 시도(refresh). **초대 카드 영역은 useRoom 상태와 독립**(useRoom 에러여도 별개) — 단, 현 LogScreen은 useRoom ready 후에만 본문 렌더하므로 리스트는 그 안에 둔다.

### 6.2 `MuklogCard` (mk-log.jsx 81–118)
- 카드: 상단 카테고리 그라데이션 커버(이모지 큰 표시, FoodCover 대체 = 카테고리 emoji + 웜 배경) + 카테고리 칩(좌상단) + (사진 배지 OUT, D5). 본문: 장소명(좌) + 별점(우, Stars), 위치줄(아이콘 + `area · 방문일` 또는 방문일만), 메모 2줄 클램프, 작성자 라벨("내가 기록 / 짝꿍이 기록").
- 별점 표시 컴포넌트 필요 → **`Stars` 컴포넌트 신설**(`src/components/Stars.tsx`, value 1~5 채운 별, size). 입력 시트에서도 editable 버전 사용.
- 카드 탭: onPress 미연결(D6) — 또는 `accessibilityRole` 없이 비활성 View.

### 6.3 `MuklogEntrySheet` (mk-log.jsx MuklogEditor 244–331에서 **Kakao/사진/영상 제거**한 최소판)
- `Sheet`(log-invite 산출 공용 컴포넌트) 기반 바텀시트 또는 풀스크린 모달.
- 필드:
  - **장소명**(필수, text input, maxLength 60) — Kakao 검색 대신 직접 입력.
  - **카테고리**(8종 칩 선택, 선택형) — CAT enum.
  - **별점**(필수 여부는 §AC 결정 → **선택**으로 함, 1~5 editable Stars).
  - **메모**(textarea, maxLength 500).
  - **방문일**(date, 기본 today, 미래 불가). 1차는 `YYYY-MM-DD` 텍스트 또는 간단 피커(네이티브 피커는 디바이스 스모크).
- 저장 버튼: 장소명 비면 비활성. 저장 → `createMuklog` → 성공 시 시트 닫기 + `refresh()` + 토스트("맛집을 기록했어요 🍽️"). 실패 시 인라인 에러.

### 6.4 토큰
- muklog 웜 토큰(accent/card/bg/ink/line) + 이모지 허용(킷 정책). 카테고리 emoji/label은 `mk-data.js` CAT을 `src/features/muklog/categories.ts`로 옮겨 단일 출처화(label·emoji·grad는 RN 토큰으로 변환). builbook 그라데이션은 RN `LinearGradient` 또는 단색 웜 배경으로 축약(디바이스 스모크).

---

## 7. 작업 목록 (파일 단위 · TDD: Red→Green→Refactor)

> 각 작업은 `*.spec.ts(x)` 먼저(Red) → 최소 구현(Green) → 컨벤션 정합화(Refactor). 외부(supabase/native)는 모킹.

- [ ] **T1. 카테고리 enum 단일 출처** — `src/features/muklog/categories.ts` (+ `.spec.ts`)
  - AC: `MUKLOG_CATEGORIES`에 8종(key·label·emoji). `categoryLabel({ key })`·`categoryEmoji({ key })`가 미존재 key에 안전(빈 문자열/fallback). mk-data.js CAT와 key·label 일치.
- [ ] **T2. 마이그레이션** — `supabase/migrations/20260611130000_muklog_list.sql` (SQL 단위 테스트 대상 아님 — 스모크)
  - AC: `muklogs` 테이블(§5.1 전체 컬럼, lat/lng nullable) + RLS(select/insert member) + 인덱스 + `enforce_muklog_fields` 트리거 + grant. idempotent(if not exists/replace/drop policy if exists). 적용은 사용자 몫(`supabase db push`).
- [ ] **T3. 입력 매핑/검증 유틸** — `src/features/muklog/validate.ts` (+ `.spec.ts`)
  - AC: `normalizeMuklogInput`(trim placeName, 빈 → 에러 토큰), rating 1~5 외 차단, visitedAt 미래 차단(today 허용), 기본 visitedAt=today. snake row 빌더 `toMuklogRow({ input, userId })`(created_by 포함).
- [ ] **T4. 에러 매핑** — `src/features/muklog/errors.ts` (+ `.spec.ts`)
  - AC: `PLACE_NAME_REQUIRED`·`RATING_OUT_OF_RANGE`·`VISITED_AT_IN_FUTURE`·네트워크/기본 → 한국어 메시지. 미지 토큰 → 기본 메시지.
- [ ] **T5. `useMuklogs`** — `src/features/muklog/useMuklogs.ts` (+ `.spec.ts`, supabase 모킹)
  - AC: 진입 1회 select → ready/empty([])/error 전이. snake→camel 매핑(place_name→placeName 등). 정렬 인자(visited_at desc, created_at desc) 호출 확인. `refresh()`는 loading으로 되돌리지 않음. roomId 변경 시에만 재조회(폴링 방지).
- [ ] **T6. `useCreateMuklog`** — `src/features/muklog/useCreateMuklog.ts` (+ `.spec.ts`, supabase 모킹)
  - AC: createMuklog(input) → insert 호출(created_by 채움 확인) → {id}. loading/error 전이. 장소명 빈 입력 → 앱단 차단(RPC 미호출). RLS/트리거 에러 토큰 → 한국어 메시지 + throw.
- [ ] **T7. `Stars` 컴포넌트** — `src/components/Stars.tsx` (+ `.spec.tsx`)
  - AC: value 1~5 → 채워진 별 수. editable 시 별 탭 → onChange(value). value 0/null → 빈 별. size prop.
- [ ] **T8. `MuklogCard`** — `src/features/muklog/MuklogCard.tsx` (+ `.spec.tsx`)
  - AC: placeName·rating(Stars)·카테고리 칩(emoji+label)·위치줄(area 있으면 `area · 날짜`, 없으면 날짜만)·메모(있을 때만, 2줄 클램프 numberOfLines=2)·작성자 라벨(createdBy==me → "내가 기록", else "짝꿍이 기록"). category null → 칩 숨김 또는 기본.
- [ ] **T9. `MuklogEntrySheet`** — `src/features/muklog/MuklogEntrySheet.tsx` (+ `.spec.tsx`)
  - AC: 장소명 빈 → 저장 비활성. 카테고리 칩 선택 토글. 별점 editable. 방문일 기본 today·미래 차단. 저장 → createMuklog(input) 호출(필드 매핑 확인) → onSaved 콜백. 실패 → 인라인 에러.
- [ ] **T10. `MuklogList` (LogScreen 섹션)** — `src/features/muklog/MuklogList.tsx` (+ `.spec.tsx`)
  - AC: loading→로더, error→메시지+다시시도, empty→빈상태 문구, ready→MuklogCard N개 + 섹션 헤더 "우리 맛집 N". FAB 탭 → 시트 오픈.
- [ ] **T11. LogScreen 통합** — `src/navigation/screens/LogScreen.tsx` 수정 (+ 기존 spec 갱신/신규)
  - AC: 기존 초대 카드(솔로/커플)·멤버 배지 **불변**. placeholder 제거 → `MuklogList` 마운트(roomId 전달). 저장 후 리스트 refresh 반영. tsc·기존 LogScreen 테스트 통과.
- [ ] **T12. feature index** — `src/features/muklog/index.ts`
  - AC: 공개 표면(useMuklogs·useCreateMuklog·MuklogCard·MuklogList·MuklogEntrySheet·categories·types) export. 컨벤션 준수.

---

## 8. 인수조건 (TDD 테스트 케이스 — 정상·경계·실패)

| # | 시나리오 | 유형 | 기대(관찰 가능) |
|---|---------|------|----------------|
| AC1 | 먹로그 0건 로그 진입 | 정상(빈) | useMuklogs ready·muklogs=[] → 빈 상태 문구 "아직 기록한 맛집이 없어요" 표시, 에러 아님 |
| AC2 | 장소명·별점·메모·방문일 입력 후 저장 | 정상 | createMuklog insert 호출(row.created_by=내 uid, room_id=현 로그) → onSaved → refresh → 리스트에 새 카드 1개 추가, 섹션 헤더 "우리 맛집 N+1" |
| AC3 | 장소명 빈 입력으로 저장 시도 | 실패(경계) | 저장 버튼 비활성(or 차단) → insert 미호출. 강제 시 트리거 `PLACE_NAME_REQUIRED` → 한국어 메시지 |
| AC4 | rating=0 / rating=6 | 경계 | 0=별점 미선택(NULL 저장 허용), 6=앱단 불가(별 5개 한정). DB 트리거가 1~5 외 raise |
| AC5 | visited_at 미래 날짜 | 실패(경계) | 앱단 차단(미래 선택 불가) + 트리거 `VISITED_AT_IN_FUTURE` 2차 방어 |
| AC6 | 정렬 | 정상 | 리스트가 visited_at desc, 동률 시 created_at desc. 쿼리 order 인자 검증(모킹) |
| AC7 | 다른 방 격리(RLS) | 보안 | A방 멤버가 B방 먹로그 select 불가(RLS) — 모킹은 eq(room_id) 필터 + with check 계약 명시. 스모크: 실 DB에서 타방 row 0건 |
| AC8 | created_by 위조 시도 | 보안 | insert에 타인 uid 넣어도 RLS `with check (created_by=auth.uid())`가 거부 — 계약 명시(스모크) |
| AC9 | 메모 장문(500자) | 경계 | maxLength 500까지 입력·저장. 카드에서 2줄 클램프(numberOfLines=2) |
| AC10 | 작성자 라벨 | 정상 | createdBy==내 uid → "내가 기록", 아니면 "짝꿍이 기록" |
| AC11 | 조회 네트워크 실패 | 실패 | useMuklogs error → 메시지 + 다시 시도(refresh) 노출 |
| AC12 | 저장 직후 시트 닫힘·리스트 반영 | 정상 | 성공 시 시트 unmount + refresh 1회 호출 |

---

## 9. 엣지케이스 (다각도)

- **빈 상태**: 0건(빈 상태 문구) vs 조회 에러(에러+재시도) 구분. 솔로/커플 모두 동일 리스트.
- **권한/RLS**: 다른 방 먹로그 read/insert 차단(AC7·AC8). room_members RLS=자기 행만 → 파트너 프로필 read 불가(작성자 닉네임/아바타 OUT, 라벨만).
- **동시성(커플 2명)**: 두 명이 같은 로그에 거의 동시에 추가 → 각자 insert는 독립 행(충돌 없음). 단 **상대 추가분은 내 화면에 자동 반영 안 됨**(Realtime OUT) → 다음 진입/refresh에서 보임. 명세에 "실시간 아님" 기록.
- **네트워크 실패**: 조회 실패=재시도 노출. 저장 실패=인라인 에러 + 시트 유지(입력 보존). 저장 중복 탭 → loading 중 버튼 비활성으로 이중 insert 방지.
- **입력 한계**: 장소명 60자·메모 500자 maxLength. 별점 1~5(0=미평가 허용). 카테고리 미선택 허용. 방문일 미래 불가, 아주 과거(예: 2000년)는 허용(검증 없음 — 사용자 자유).
- **데이터 결측**: category null → 칩 숨김. area null → 위치줄 날짜만. memo null/빈 → 메모줄 숨김. visited_at null → 날짜 표기 fallback("날짜 미정") 또는 숨김.
- **로그 삭제 상호작용**: 방 나가기로 room 삭제 시 muklogs ON DELETE CASCADE로 정리(leave_room 0명 경로). 데이터 누수 없음.
- **카테고리 enum 드리프트**: DB는 category를 자유 text로 저장(앱이 8종 enum 강제). 미지 key가 들어오면 카드 칩 fallback(빈/기본) — categoryLabel 안전.

---

## 10. 비용 가드레일 체크

- **Kakao 호출 없음**(이번 슬라이스). 장소검색·좌표는 OUT → Local API 쿼터 소모 0. ✅
- **이미지/영상 없음** → Storage 업로드·전송 0. 사진/영상은 차기(압축 가드레일은 그때). ✅
- **조회 정책**: 진입 1회 + 저장 후 refresh만. 폴링/주기 조회·Realtime 미도입(`useRoom`/`useMyLogs` 정책 계승). ✅
- **인덱스**: `(room_id, visited_at desc, created_at desc)`로 방별 정렬 조회 효율화(풀스캔 회피). ✅
- **select 컬럼 최소화**: 카드에 필요한 컬럼만 select(lat/lng/주소/video 등 미사용 컬럼 제외) → 전송량 절감. ✅

---

## 11. QA가 교차검증할 경계면 목록 (integration-qa 대상)

1. **쿼리 컬럼 ↔ 매핑 ↔ 카드**: select 컬럼명(snake) ↔ `toMuklog` 매핑(camel) ↔ MuklogCard 소비 필드. 누락/오타 시 undefined 렌더.
2. **RLS ↔ 쿼리**: `from('muklogs')` 직접 select가 RLS(`room_id IN 내 방`)와 정합 — DEFINER RPC 아님을 확인. insert `with check(created_by=auth.uid())` ↔ useCreateMuklog가 created_by를 실제로 채우는지.
3. **트리거 토큰 ↔ 에러 매핑**: `PLACE_NAME_REQUIRED`/`RATING_OUT_OF_RANGE`/`VISITED_AT_IN_FUTURE` ↔ `errors.ts` 매핑 키 일치.
4. **카테고리 enum**: `categories.ts` key ↔ mk-data.js CAT key 일치(드리프트 시 칩 빈칸).
5. **정렬 계약**: order 인자(visited_at desc, created_at desc) ↔ 인덱스 컬럼 순서 일치.
6. **LogScreen 회귀**: 초대 카드(솔로/커플)·멤버 배지·useRoom 흐름 불변(log-invite). placeholder→리스트 교체만.
7. **roomId 전달**: LogScreen route.params.roomId ↔ MuklogList ↔ useMuklogs ↔ 쿼리 eq(room_id) 동일 값.

---

## 12. 회귀 영향 (불변 확인)

- `log-invite`(LogScreen 초대 카드·get_room·useRoom·AddSheet·JoinLog) — **불변**. 리스트는 초대 카드 아래 추가.
- `multi-log-home`(LogList 목록·useMyLogs·list_my_rooms·LogScreen 진입) — **불변**(D7로 list_my_rooms 미변경).
- `profile`·`room-leave`·`ui-redesign` — **불변**. UI는 ui-design 킷 준수.
- 기존 마이그레이션(invite_room·room_modes·room_leave·multi_log_home·log_invite) — **수정 안 함**. 이번은 additive 신규 파일.

---

## 13. 테스트 영향 + 완료 기준

- **신규 spec**: categories·validate·errors·useMuklogs·useCreateMuklog·Stars·MuklogCard·MuklogEntrySheet·MuklogList (+ LogScreen 통합 spec 갱신).
- **모킹 경계**: `@/lib/supabase`(from/select/order/eq/insert 체이닝 + auth.getUser) 모킹. 네이티브(날짜 피커·제스처)는 디바이스 스모크.
- **스모크(사용자/디바이스)**: 마이그레이션 원격 적용(`supabase db push`) 후 ① 실 RLS 타방 격리 ② 트리거 rating/visited_at/place_name raise ③ created_by 위조 거부 ④ 카드/시트 실기기 렌더·저장.
- **완료 기준**: `npm test` 전체 통과 + `tsc --noEmit` 0 에러 + 컨벤션 100% 준수 + LogScreen 회귀 없음. **마이그레이션 원격 적용은 사용자 몫**(이 plan은 SQL 파일 제공까지).

---

## 14. 분할 평가

이번 슬라이스는 **테이블 생성 + 조회 + 최소 입력 + LogScreen 통합**으로 1 스프린트에 적정(Kakao·사진·영상·상세·수정삭제·필터·카운트를 모두 OUT으로 분리). **추가 분할 불필요**. 다만 다음을 후속 슬라이스로 백로그에 제안:
- `muklog-spot-count`(D7): list_my_rooms/get_room에 맛집 수 추가 → LogList 카드 "맛집 N곳" 채움.
- `muklog-detail`: 카드 탭 → 상세(이번 OUT D6).
- `muklog-editor`: Kakao 장소검색 + 좌표/주소 채움 + 사진 5장 + 수정.
- `muklog-video`: 2초 영상.

---

## 15. architecture divergence — ✅ 승인됨 (team-lead 2026-06-11)

> 아래 2건은 architecture.md(§3)와 어긋났으나 **team-lead 승인 + architecture.md §3 갱신 완료**. 이 plan의 §5.1 DDL은 승인된 형태로 확정 반영됨.
1. **D2 — `muklogs.lat`/`lng` NOT NULL → NULL 허용 ✅ 승인**: 수동 입력 시 NULL, Kakao(muklog-editor)에서 채움. 지도(map-tab)는 `lat is not null`만 핀 표시. architecture §3 갱신 완료.
2. **D4 — `area text` nullable 컬럼 신설 ✅ 승인**: 카드 표시·수동 입력 편의용. architecture §3에 추가 완료.

> 확정 반영 확인: §5.1 DDL의 `lat`/`lng` = nullable(YES), `area text` nullable 행 존재. §4 D2·D4 결정과 정합.
