# 스프린트 계획 — 위시리스트(가보고 싶은 곳)

> 슬러그: `sprint-20260616-wishlist` · 단일 기능 = **위시리스트** · 날짜: 2026-06-16
> 단일 출처: 디자인 킷 `templates/muklog`(`mk-extra.jsx:178-224` WishlistView · `mk-log.jsx:55-72` 세그먼트 · `mk-log.jsx:119` FAB 조건 · `mk-data.js:45-54` wish[]) · 설계 `docs/design/architecture.md`(이번 스프린트로 위시리스트 **추가**) · 발굴 `docs/sprint/_kit-delta-discovery.md`(델타 #1·#3·#5, §4 D-1, §5).
> TDD 기본(Red→Green→Refactor). git 작업 금지. 테스트 경계 = `docs/testing-strategy.md`.

---

## 1. 기능 한줄 정의 · 사용자 가치

**한 로그(=커플 공간) 안에서 "다음에 가보고 싶은 맛집"을 모아두고, 다녀온 뒤엔 한 번에 먹로그로 옮길 수 있는 위시리스트.**

- **가치**: 커플 둘이 "여기 가보자" 후보를 같은 공간에 쌓아두고(누가 담았는지 표시), 실제로 다녀오면 "다녀왔어요"로 작성 화면에 자동 채워 기록으로 승격한다. 데이트 계획 ↔ 기록의 연결고리.
- 위시리스트는 **로그 내부 세그먼트**(기록 N / 위시리스트 N)로 표시된다. 별도 탭/화면이 아니다(킷 정합).

---

## 2. 범위 (Scope)

### In-scope
1. **`wishlist_items` 테이블 + RLS**(룸 멤버 격리, 기존 `muklogs` RLS 패턴 재사용) — 마이그레이션 신규.
2. **위시 목록 조회 / 추가 / 삭제** — 일반 select·insert·delete(RLS로 격리). **DEFINER RPC·Realtime 미사용**(비용 가드레일).
3. **LogScreen 세그먼트 컨트롤**(기록 N / 위시리스트 N) + 세그별 본문 스위치 + **FAB는 기록 세그에서만**(델타 #3).
4. **WishlistView**(빈 상태 / 항목 카드 리스트 / "가보고 싶은 곳 추가") — 비주얼 책임은 ui-publisher.
5. **위시 추가 플로우**: "추가" → 기존 **PlaceSearchView**(Kakao Local, muklog-place 재사용) 풀스크린 스왑 → 장소 선택 → `wishlist_items` insert.
6. **"다녀왔어요" → 먹로그 생성 prefill**: 위시 항목 → MuklogEditor **생성 모드**에 place/category/area/road/lat/lng/kakao_place_id를 채운 채 진입. **위시 삭제 시점 = 먹로그 생성 성공 시**(취소 시 위시 보존). 서버 이동 아님(클라 prefill + 성공 후 위시 삭제).
7. **added_by 표시 매핑**: `added_by uuid` 저장 + 표시단에서 본인/짝꿍 매핑(본인=내 닉/아바타, 파트너=익명 "짝꿍" — 로그명 폴백과 동일 RLS 제약).
8. **ProfileScreen "위시리스트" 행 제거**(델타 #5, 킷 정합).

### Out-of-scope (이번 스프린트 밖 — 다음 후보)
- **알림 설정**(NotifSettingsScreen·MkSwitch·`notification_prefs`) — 발굴 후보 B, 별도 스프린트.
- **이름변경 다이얼로그 패턴 교체**(LogNameSheet→RenameDialog, 초대코드 동봉) — 발굴 후보 C, 리더 결정 대기.
- **DatePickerSheet**(방문일 캘린더 시트) — 발굴 #6, 별도.
- **위시 항목 메모 입력 UI** — 킷 추가 플로우(`mk-log.jsx:30-34`)는 `note:""`로 빈값 저장(장소만 담음). `note` 컬럼은 선반영하되 **입력 UI는 OUT**(표시는 값 있으면 렌더).
- **위시 항목 편집**(담은 뒤 수정), **카테고리 필터/정렬**, **드래그 재정렬** — OUT.
- **Realtime 동기화**(파트너가 담은 위시 실시간 반영) — 비용 가드레일상 OUT. 화면 재진입/refresh로 갱신.
- **ProfileScreen 다른 행(알림 설정·이용 안내·설정) 재정의** — 발굴 #5의 나머지는 알림 스프린트로 흡수, 이번엔 "위시리스트" 행만 제거.

---

## 3. 스코프 결정 (발굴 §5 미해결 — 근거와 함께 확정)

| 결정 항목 | 결정 | 근거 |
|----------|------|------|
| **addedBy 모델** | `added_by uuid NOT NULL → profiles`(auth user) 저장. 표시단에서 `added_by === meId`면 본인(내 닉·아바타), 아니면 **짝꿍 익명**("짝꿍님이 추가" + 익명 아바타). | 킷은 `me`/`partner` 리터럴(`mk-data.js:46`)이지만, 앱은 파트너 프로필이 **RLS상 비노출**("짝꿍" 고정 — `log-name` 폴백과 동일 제약, architecture §5). user_id 저장이 정규적이고, 표시 매핑은 클라에서 안전하게 처리. |
| **위시리스트 위치** | **로그 내부 세그먼트**(LogScreen 기록/위시리스트). 별도 화면/탭 아님. → 세그먼트 컨트롤(#3)이 이 기능에 **포함**. | 킷 `mk-log.jsx:55-72`가 세그먼트로 구현. WishlistView는 로그 컨텍스트(`log` prop)에 의존. |
| **ProfileScreen "위시리스트" 행** | **제거**(세그로 유도). | 킷 프로필(`mk-log.jsx:538-546`)에 위시리스트 행 없음. 위시는 로그 세그먼트에 존재하므로 중복 진입점 제거. |
| **"다녀왔어요" 위시 삭제 시점** | **먹로그 생성 성공 콜백에서 삭제**. 에디터 진입 시 즉시 삭제하지 않음. 사용자가 에디터를 **취소하면 위시는 보존**. | 진입 즉시 삭제하면 작성 취소 시 위시가 유실됨. 생성 성공 시점 삭제가 데이터 손실 0. |
| **삭제 권한(RLS)** | **룸 멤버 누구나** 위시 삭제 가능(공유 리스트 semantics). | "우리 위시리스트"는 커플 공유 목록 — 어느 멤버든 정리 가능해야 자연스럽다. (cf. `muklogs`는 본인 작성만 삭제지만, 위시는 경량 공유 후보 목록.) |
| **조회/추가/삭제 인터페이스** | **일반 쿼리**(`.from('wishlist_items')` select/insert/delete) + RLS. DEFINER RPC 미사용. | 비용 가드레일(발굴 §5: "위시 목록은 일반 select"). insert는 `muklogs`와 동일하게 RLS `with check (added_by=auth.uid())`로 격리(별도 RPC 불필요). |
| **카테고리** | 자유 `text`(앱이 8종 enum 강제), nullable. PlaceSearch 결과 category 그대로 저장. | `muklogs.category`와 동일 정책(스키마 변경 없음). 미지 key는 표시단 폴백(`cafe`). |

---

## 4. 데이터 계약 (Data Contract)

### 4.1 테이블 — `wishlist_items` (신규 마이그레이션)

> 명명은 `muklogs`와 정렬(`place_name`·`road_address`·`category`·`area`·`lat`·`lng`·`kakao_place_id`). 작성자 컬럼만 `added_by`(킷 `addedBy`).

```
wishlist_items
  id             uuid PK default gen_random_uuid()
  room_id        uuid NOT NULL → rooms(id) ON DELETE CASCADE
  place_name     text NOT NULL
  category       text                 -- 8종 중 하나(앱 강제), nullable
  area           text                 -- 동네 표시(예: "성수동"), nullable
  road_address   text                 -- 킷 road, nullable
  lat            double precision      -- nullable(수동/검색 미선택 시 NULL)
  lng            double precision      -- nullable
  kakao_place_id text                  -- Kakao 장소 id, nullable
  note           text                  -- nullable(이번 스프린트 입력 UI OUT, 표시만)
  added_by       uuid NOT NULL → profiles(id)
  created_at     timestamptz NOT NULL default now()
```

**인덱스**: `create index on wishlist_items (room_id, created_at desc)` — 목록 정렬(최신 추가 우선).

### 4.2 RLS 정책 (기존 `muklogs` 패턴 재사용)

```sql
alter table public.wishlist_items enable row level security;

-- select: 내가 멤버인 방의 위시만
create policy "wishlist_select_member" on public.wishlist_items
  for select using (
    room_id in (select room_id from public.room_members where user_id = auth.uid())
  );

-- insert: added_by=본인 AND 내 방
create policy "wishlist_insert_member" on public.wishlist_items
  for insert with check (
    added_by = auth.uid()
    and room_id in (select room_id from public.room_members where user_id = auth.uid())
  );

-- delete: 룸 멤버 누구나(공유 리스트) — 내 방이면 삭제 허용
create policy "wishlist_delete_member" on public.wishlist_items
  for delete using (
    room_id in (select room_id from public.room_members where user_id = auth.uid())
  );
```

> update 정책 없음(편집 OUT). 2차 검증 트리거: `place_name` 공백 거부(`muklogs.enforce_*` 동일 스타일, 선택). category 범위는 앱 강제(자유 text 유지).

### 4.3 클라이언트 쿼리 시그니처 (훅 ↔ 화면 경계)

**조회** — `useWishlist({ roomId })`
```ts
// 호출: supabase.from('wishlist_items')
//   .select('id, room_id, place_name, category, area, road_address, lat, lng, kakao_place_id, note, added_by, created_at')
//   .eq('room_id', roomId)
//   .order('created_at', { ascending: false });
type WishlistState =
  | { status: 'loading' }
  | { status: 'ready'; items: WishlistItem[] }
  | { status: 'error'; message: string };
// 반환: { state: WishlistState, refresh: () => Promise<void> }
// useEffect 의존성 = [roomId] (폴링 금지, 재진입/mutation 후 refresh로만 갱신)
```

**추가** — `useAddWishlist()`
```ts
addWishlist({ input }: { input: AddWishlistInput }): Promise<{ id: string }>
type AddWishlistInput = {
  roomId: string;
  placeName: string;
  category: string | null;
  area: string | null;
  roadAddress: string | null;
  lat: number | null;
  lng: number | null;
  kakaoPlaceId: string | null;
  note?: string | null;       // 이번 스프린트는 항상 null
};
// 내부: auth.getUser().id → added_by, snake_case row insert → .select('id').single()
// 반환: { addWishlist, loading, error }
```

**삭제** — `useRemoveWishlist()`
```ts
removeWishlist({ id }: { id: string }): Promise<void>
// 내부: supabase.from('wishlist_items').delete().eq('id', id) (RLS로 멤버만)
// 반환: { removeWishlist, loading, error }
```

### 4.4 응답 shape — `WishlistItem` (행 → 화면 매핑)

```ts
type WishlistItem = {
  id: string;
  roomId: string;
  placeName: string;
  category: string | null;
  area: string | null;
  roadAddress: string | null;
  lat: number | null;
  lng: number | null;
  kakaoPlaceId: string | null;
  note: string | null;
  addedBy: string;        // uuid
  addedByMe: boolean;     // 파생: added_by === meId
  createdAt: string;
};
// addedByMe=true → 내 프로필(닉/아바타). false → 익명 "짝꿍"(닉 "짝꿍", 익명 아바타).
```

### 4.5 "다녀왔어요" → MuklogEditor prefill 계약

```ts
// onVisit(item) → navigation.navigate(Routes.MuklogEditor, { roomId, prefill, fromWishlistId })
type MuklogEditorPrefill = {
  placeName: string;
  category: string | null;
  area: string | null;
  roadAddress: string | null;
  lat: number | null;
  lng: number | null;
  kakaoPlaceId: string | null;
};
// 라우트 파라미터 확장: { roomId: string; muklogId?: string; prefill?: MuklogEditorPrefill; fromWishlistId?: string }
// - muklogId 없음 + prefill 있음 → "생성 모드 + 프리필"(신규 분기, developer 구현)
// - 저장(생성) 성공 콜백에서 fromWishlistId 있으면 removeWishlist({ id: fromWishlistId })
// - 사용자가 에디터 취소 시 위시 보존(삭제 호출 없음)
```

---

## 5. 화면 / 컴포넌트 (비주얼 책임 = ui-publisher)

| 컴포넌트 | 출처(킷) | 역할 |
|----------|---------|------|
| **세그먼트 컨트롤** | `mk-log.jsx:56-72` | LogScreen 헤더 아래 `기록 N` / `위시리스트 N` 2탭. `fill-alt` 트랙·radius 12·선택칸 카드+그림자·800/13.5. seg 상태로 본문 스위치. |
| **WishlistView** | `mk-extra.jsx:178-224` | 위시 본문. 빈 상태 / 추가 버튼 / 항목 카드 리스트. |
| **빈 상태** | `mk-extra.jsx:179-189` | 📍 + "가보고 싶은 곳을 모아요" + 안내문 + "위시리스트에 추가"(soft 버튼). |
| **추가 버튼(목록 상단)** | `mk-extra.jsx:193-196` | 점선 보더 "가보고 싶은 곳 추가"(plus, accent-strong). |
| **위시 항목 카드** | `mk-extra.jsx:200-219` | FoodCover(56·cat·radius14·emoji26) + place·area + note(2줄 clamp) + "{닉}님이 추가"(아바타18) + "다녀왔어요" 버튼(accent-weak) + 닫기(삭제). |
| **FAB(기록 전용)** | `mk-log.jsx:119` | 위시 세그에선 FAB 숨김. |
| **PlaceSearchView**(재사용) | muklog-place | 추가 플로우 풀스크린 검색. 기존 컴포넌트 재사용. |

**LogScreen 상태 흐름**:
```
seg: 'log' | 'wish'  (기본 'log')
- 'log'  → 기존 MuklogList + FAB
- 'wish' → WishlistView(useWishlist 데이터) + FAB 숨김
세그 카운트: 기록 = muklogs.length, 위시 = wishlist items.length
→ 위시 카운트 표시 위해 LogScreen 진입 시 useWishlist 1회 로드(세그와 무관, 단일 select).
추가 플로우: WishlistView '추가' → PlaceSearchView 풀스크린 → 선택 → addWishlist → refresh → 토스트 "위시리스트에 담았어요 📍"
```

**토스트 카피**(킷 정합): 추가 성공 = `위시리스트에 담았어요 📍`(`mk-log.jsx:33`).

---

## 6. 인수조건 = 테스트 케이스 (Red→Green 대상)

> 단위 대상(✅ jest-expo + @testing-library): 훅·유틸·매핑·화면 상호작용. SQL/RLS = 모킹·스모크(디바이스/`supabase db push` 후). 경계는 `docs/testing-strategy.md`.

### TC-1 빈 상태
- **정상**: `wishlist_items` 0건 → WishlistView가 빈 상태 렌더("가보고 싶은 곳을 모아요" + "위시리스트에 추가" 버튼). 카드 리스트·상단 추가 버튼 미표시.
- **경계**: 세그 카운트 `위시리스트 0` 표시.

### TC-2 추가
- **정상**: PlaceSearch 결과 pick → `useAddWishlist.addWishlist({input})`가 `wishlist_items`에 insert 호출. payload snake_case에 `room_id`·`place_name`·`category`·`area`·`road_address`·`lat`·`lng`·`kakao_place_id`·`added_by=<내 uid>` 포함. 반환 `{id}`. refresh 후 목록 맨 위(최신)에 항목 추가. 토스트 "위시리스트에 담았어요 📍".
- **경계**: `lat/lng/kakao_place_id`가 없는 검색결과 → null로 저장(insert 성공).
- **실패**: insert error(네트워크/RLS) → `error` 한국어 메시지 세팅 + throw(입력 컨텍스트 보존). 목록 불변.

### TC-3 목록 표시 + addedBy 매핑
- **정상**: items 렌더 — 각 카드에 FoodCover(category), place_name, area, note(있을 때만 2줄 clamp), "다녀왔어요"·삭제 버튼.
- **본인**: `added_by === meId` → 내 닉·아바타 + "{내닉}님이 추가".
- **짝꿍**: `added_by !== meId` → "짝꿍님이 추가" + 익명 아바타(파트너 실프로필 비노출, RLS 제약).
- **경계**: `category` null/미지 key → FoodCover 폴백(cafe emoji). `note` null → 메모 미렌더. `road_address` null 허용.

### TC-4 삭제
- **정상**: 카드 닫기(✕) → `useRemoveWishlist.removeWishlist({id})`가 `.delete().eq('id', id)` 호출. 성공 후 목록에서 항목 제거(refresh 또는 낙관적 제거).
- **실패**: delete error → 에러 메시지 + 항목 유지(낙관적 제거 시 롤백).

### TC-5 다녀왔어요 → prefill
- **정상**: "다녀왔어요" → `navigate(MuklogEditor, { roomId, prefill, fromWishlistId })`. prefill에 placeName/category/area/roadAddress/lat/lng/kakaoPlaceId 매핑. 에디터가 생성 모드 + 프리필로 진입(필드 채워짐).
- **성공 삭제**: 먹로그 생성 성공 콜백 → `fromWishlistId` 있으면 `removeWishlist({id})` 호출 → 위시 목록에서 사라짐.
- **취소 보존**: 에디터 취소(뒤로가기) → 위시 삭제 호출 없음 → 위시 보존.
- **경계**: 좌표 없는 위시(lat/lng null) → prefill에 null 전달, 에디터 정상 진입.

### TC-6 세그먼트 컨트롤 (#3)
- **정상**: LogScreen seg 토글 — 'log' → MuklogList + FAB 표시 / 'wish' → WishlistView + FAB 숨김.
- **카운트**: `기록 {muklogs.length}` / `위시리스트 {wishlist.length}` 정확.
- **기본값**: 진입 시 seg='log'.

### TC-7 RLS (모킹·스모크)
- **정상**: 멤버 select → 내 방 위시만 반환.
- **거부**: 비멤버 select → 0행. 비멤버/타인-as-added_by insert → RLS 거부(error). 비멤버 delete → 0행 영향.
- **격리**: 다른 방 위시는 보이지 않음.

### TC-8 엣지 (아래 §7 참조 — 빈/권한/동시성/네트워크/입력한계)

---

## 7. 엣지케이스 (여러 각도)

**빈/경계 상태**
- 위시 0건 빈 상태 ↔ 1건 이상 리스트 전환.
- 매우 긴 place_name/area/note → ellipsis/2줄 clamp(킷 정합).
- category null·미지 key → cafe 폴백.
- road_address/lat/lng/kakao_place_id 모두 null(수동·좌표없는 검색) → 저장·prefill 정상.

**권한 / RLS**
- 비멤버가 room_id 추측해 select/insert/delete 시도 → 정책으로 차단(0행/error).
- 솔로 로그(파트너 없음)에서도 위시 추가/표시 정상(addedByMe=true만 존재).
- 로그아웃 상태에서 mutation → `NOT_AUTHENTICATED` 처리.

**동시성 (커플 2명)**
- 파트너가 같은 장소를 동시에 담음 → 중복 행 허용(dedup OUT). 표시 중복 가능, 데이터 무결.
- 파트너가 내 화면에 보이는 위시를 먼저 삭제 → 내가 "다녀왔어요"/삭제 시 이미 없는 행: delete는 0행(무해), prefill 후 생성 성공 콜백의 removeWishlist도 0행(무해, 에러 아님).
- Realtime 없음 → 파트너 변경은 재진입/refresh 시 반영(실시간 미반영은 의도된 스코프).

**네트워크 실패**
- 추가 insert 실패 → 에러 메시지 + 목록 불변 + 토스트 없음.
- 조회 실패 → `status:'error'` + 재시도(refresh) 경로.
- 삭제 실패(낙관적 제거 시) → 항목 롤백 복원.
- 다녀왔어요 생성 성공했으나 removeWishlist 실패 → 먹로그는 생성됨(우선), 위시는 남음(다음 refresh/수동삭제로 정리). 데이터 손실 0.

**입력 한계**
- PlaceSearch 빈 결과/취소 → 위시 추가 없이 폼 복귀.
- 사진/인원 한계는 이 기능 무관(먹로그 측 책임).

---

## 8. 작업 목록 (체크박스 · 각 인수조건 포함)

> 비주얼(레이아웃·토큰·카피)은 ui-publisher가 ui-spec.md로 선행. developer는 데이터·훅·배선 + 비주얼 임의 변경 금지.

### DB / 마이그레이션
- [ ] `wishlist_items` 테이블 + 인덱스 + RLS 3정책(select/insert/delete) 마이그레이션 작성 — **AC**: 멤버 select/insert/delete만 통과, 비멤버 차단(스모크). (TC-7)
- [ ] (선택) `place_name` 공백 거부 트리거(`muklogs` 스타일) — **AC**: 빈 place_name insert 거부.

### 데이터 훅 (TDD)
- [ ] `useWishlist({ roomId })` — **AC**: select 호출 인자(`eq room_id`·`order created_at desc`)·매핑(`addedByMe`)·status 전이·`[roomId]` 의존성. (TC-3)
- [ ] `useAddWishlist()` — **AC**: snake_case payload + `added_by=내 uid` insert, `{id}` 반환, error 매핑/throw. (TC-2)
- [ ] `useRemoveWishlist()` — **AC**: `.delete().eq('id', id)`, error 매핑. (TC-4)
- [ ] `toWishlistItem`(row→뷰) / `toWishlistRow`(input→row) 순수 유틸 — **AC**: 필드 매핑·null 처리 단위 테스트.

### 화면 / 배선
- [ ] LogScreen 세그먼트 컨트롤 + 본문 스위치 + FAB 조건 — **AC**: seg 토글·카운트·FAB 숨김. (TC-6)
- [ ] WishlistView(빈상태/추가버튼/카드) 배선(데이터·핸들러) — **AC**: 빈상태·리스트·addedBy 표시. (TC-1·TC-3)
- [ ] 추가 플로우(PlaceSearchView 재사용 → addWishlist → refresh → 토스트) — **AC**: pick→insert→목록갱신. (TC-2)
- [ ] 삭제 핸들러 배선 — **AC**: ✕→removeWishlist→제거. (TC-4)
- [ ] "다녀왔어요" → MuklogEditor 라우트 파라미터 확장(`prefill`/`fromWishlistId`) + 생성모드 프리필 분기 + 성공 콜백 위시 삭제 — **AC**: prefill 진입·성공시 삭제·취소시 보존. (TC-5)
- [ ] ProfileScreen "위시리스트" 행 제거 — **AC**: `SETTINGS_ROWS`에서 제외, 테스트 갱신. (델타 #5)

### 문서
- [ ] `architecture.md`에 위시리스트 반영(§3 테이블·RLS / §4 LogScreen 세그 / §5 백로그 행) — **이 plan과 함께 갱신(아래 §11)**.

---

## 9. QA가 교차검증할 경계면 (qa-logic 선지정)

| # | 생산자 ↔ 소비자 | 점검 포인트 |
|---|----------------|------------|
| B1 | `wishlist_items` 컬럼 ↔ select 컬럼 리스트 ↔ `WishlistItem` 타입 ↔ 카드 렌더 | snake↔camel 매핑 누락/오타, nullable 처리 |
| B2 | insert payload(snake) ↔ RLS `with check(added_by=auth.uid())` | `added_by`를 auth.uid()로 채우는지, 타인 uid 거부 |
| B3 | select 쿼리 ↔ RLS membership ↔ 다른 방 격리 | 비멤버 0행, 방 간 누수 없음 |
| B4 | `added_by` uuid ↔ `addedByMe` 파생 ↔ 짝꿍 익명("짝꿍") 표시 | meId 비교 정확, 파트너 실프로필 비노출 |
| B5 | MuklogEditor `prefill`/`fromWishlistId` 파라미터 ↔ 위시 필드 ↔ 생성 payload | 필드 매핑, 생성모드 분기(muklogId 없음+prefill) |
| B6 | 생성 성공 콜백 ↔ `removeWishlist(fromWishlistId)` | 성공시에만 삭제, 취소시 미삭제, 0행 무해 |
| B7 | 세그 카운트 ↔ `wishlist.length`/`muklogs.length` ↔ FAB 조건 | 카운트 정확, 위시 세그 FAB 숨김 |
| B8 | PlaceSearchView 결과 shape ↔ `AddWishlistInput` | category/area/road/lat/lng/kakao_place_id 전달 일치 |
| B9 | ProfileScreen 행 제거 ↔ 기존 테스트(`settings-row-위시리스트`) | 잔존 참조/테스트 깨짐 없음 |

---

## 10. 비용 가드레일 체크

- [x] **Realtime 신규 도입 0** — 위시 목록은 일반 select. 파트너 변경은 refresh/재진입 반영(실시간 OUT).
- [x] **신규 Kakao 호출 0** — 추가 플로우는 **기존** `place-search` Edge Function(muklog-place) 재사용. 디바운스/캐싱은 기존 `usePlaceSearch` 그대로.
- [x] **폴링 없음** — `useWishlist` useEffect 의존성 `[roomId]`, mutation 후 명시적 refresh만.
- [x] **AWS 미사용 · Supabase 무료 티어** — 테이블 1개·RLS·일반 쿼리만. 새 인프라 0.
- [x] **이미지/Storage 영향 없음** — 위시는 텍스트·좌표만 저장(사진 없음).

---

## 11. architecture.md 반영 (이 스프린트와 함께 갱신)

- **§3 데이터 모델**: `muklog_photos` 뒤에 `wishlist_items` 블록 추가 + 제약/정책에 RLS 3정책 bullet.
- **§4 화면**: LogScreen 항목에 "세그먼트(기록/위시리스트)" + WishlistView 추가, ProfileScreen "위시리스트" 행 제거 메모.
- **§5 백로그**: `log-name` 행 뒤에 `wishlist` 행 추가(상태: 진행).

---

## 완료 기준 (Definition of Done)

- [ ] `npm test` 전부 green(신규 위시 훅·유틸·화면·매핑 테스트 포함, 회귀 0).
- [ ] `npx tsc --noEmit` 통과.
- [ ] 마이그레이션 작성(라이브 `supabase db push`·디바이스 스모크는 이월 가능, 코드/모킹 테스트는 완성).
- [ ] qa-logic(정합성·TDD·가드레일) · qa-visual(킷 충실도) 병렬 검증 통과.
- [ ] architecture.md 반영 완료.
