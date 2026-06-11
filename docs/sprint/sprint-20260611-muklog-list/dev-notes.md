# Dev Notes — `muklog-list` (로그 안 맛집 카드 리스트 + 최소 입력)

> 스프린트: `sprint-20260611-muklog-list` · 구현 완료 · TDD(Red→Green→Refactor)
> 완료 기준 충족: `npm test` 276/276 통과(베이스라인 217 → +59), `npx tsc --noEmit` 0 에러, 코드 컨벤션 100%(useCallback/useMemo 0·raw hex 0·named-args·enum-style 상수·토큰 스타일).

---

## 1. 생산자 ↔ 소비자 매핑 (QA 교차검증용)

| 경계면 | 생산자 | 소비자 | 계약(shape/인자) |
|--------|--------|--------|------------------|
| **조회** | `muklogs` 테이블 직접 `select`(RLS 하, RPC 아님) — `useMuklogs.ts` `MUKLOG_SELECT_COLUMNS` | `MuklogList` → `MuklogCard` | `from('muklogs').select('id, room_id, place_name, category, area, memo, rating, visited_at, created_by, created_at').eq('room_id', roomId).order('visited_at',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false})` → snake→camel `toMuklog` → `Muklog` |
| **생성** | `auth.getUser()`로 `created_by` 확보 + `from('muklogs').insert(row).select('id').single()` — `useCreateMuklog.ts` | `MuklogEntrySheet`(저장 버튼) | `createMuklog({ input: CreateMuklogInput })` → `{ id }`. row = `toMuklogRow({ input: normalized, userId })`(snake, `created_by` 포함) |
| **검증 토큰** | 마이그레이션 `enforce_muklog_fields()` raise `PLACE_NAME_REQUIRED`/`RATING_OUT_OF_RANGE`/`VISITED_AT_IN_FUTURE` + 앱단 `normalizeMuklogInput` 동일 토큰 throw | `mapMuklogError`(errors.ts) → 한국어 메시지 | 토큰 문자열이 SQL ↔ `errors.ts`(`MuklogErrorToken`) ↔ `validate.ts` 단일 출처 |
| **카테고리** | `categories.ts` `MUKLOG_CATEGORIES`(8종, mk-data.js CAT 정합) | `MuklogCard` 칩 · `MuklogEntrySheet` 칩 | key: pasta·cafe·noodle·sushi·bakery·chinese·burger·izakaya. `categoryLabel/Emoji`가 미지 key→`''`(드리프트 안전) |
| **작성자 라벨** | `Muklog.createdBy`(uuid) vs `meId`(=`useAuth().userId`) | `MuklogCard` | `createdBy === meId` → "내가 기록" / else "짝꿍이 기록"(파트너 프로필 read OUT, 라벨만) |
| **roomId 흐름** | `LogScreen` `route.params.roomId` | `MuklogList(roomId)` → `useMuklogs({roomId})` → `eq('room_id', roomId)` 및 시트 insert `room_id` | 동일 값 전파 |
| **LogScreen 통합** | `useRoom`(불변) + `useAuth`(meId) | `<MuklogList roomId meId />`(초대 카드 아래) | placeholder 제거 → 리스트 마운트. 커플/솔로 무관 동일 |

---

## 2. 신규/변경 파일

### 마이그레이션 (신규)
- `supabase/migrations/20260611130000_muklog_list.sql` — `public.muklogs` 테이블(전체 컬럼 선반영, `lat`/`lng` nullable[D2], `area` nullable[D4]) + RLS(`muklogs_select_member`/`muklogs_insert_member`) + 인덱스 `idx_muklogs_room_visited(room_id, visited_at desc, created_at desc)` + 트리거 `enforce_muklog_fields`/`trg_muklog_fields` + `grant select,insert ... to authenticated`. idempotent(if not exists/drop policy if exists/create or replace/drop trigger if exists). **기존 마이그레이션 미수정**.

### 신규 소스 (features/muklog/)
- `categories.ts` (+spec) — `MUKLOG_CATEGORIES`·`MUKLOG_CATEGORY_KEYS`·`categoryLabel`·`categoryEmoji`·`MuklogCategoryKey`.
- `errors.ts` (+spec) — `MuklogErrorToken`(enum-style)·`MUKLOG_ERROR_MESSAGES`·`DEFAULT_MUKLOG_ERROR_MESSAGE`·`mapMuklogError`.
- `types.ts` — `Muklog`·`MuklogsState`·`CreateMuklogInput`·`NormalizedMuklogInput`.
- `validate.ts` (+spec) — `normalizeMuklogInput`(장소명 필수·rating 1~5·미래일 차단·trim→null)·`toMuklogRow`(snake, created_by)·`todayLocalDate`.
- `formatVisitedDate.ts` (+spec) — `formatVisitedDate`(YYYY-MM-DD→YYYY.MM.DD, null/형식불일치→"날짜 미정").
- `useMuklogs.ts` (+spec) — 조회 훅(진입 1회+refresh, snake→camel `toMuklog`).
- `useCreateMuklog.ts` (+spec) — 생성 훅(getUser→created_by, insert, loading/error).
- `MuklogCard.tsx` (+spec) — 카드(커버 이모지+칩, 장소명+별점, 위치줄, 메모 2줄, 작성자 라벨).
- `MuklogEntrySheet.tsx` (+spec) — 최소 입력 시트(장소명·카테고리 칩·별점·메모·방문일).
- `MuklogList.tsx` (+spec) — 섹션 헤더("우리 맛집 N")+상태 분기+카드 리스트+FAB+시트.
- `index.ts` — 공개 표면 배럴.

### 신규 컴포넌트 (components/)
- `Stars.tsx` (+spec) — 별점 표시/입력(value 1~5, editable→onChange, 0/null=빈 별). `components/index.ts`에 export 추가.

### 변경
- `src/navigation/screens/LogScreen.tsx` — 초대 카드/멤버 배지 **불변**. placeholder 제거 → 상단 초대 영역(비스크롤 헤더) + `<MuklogList roomId meId />`(남은 공간 flex 채움, FAB 고정). `useAuth`로 meId 파생. 미사용 `placeholder` 스타일 제거.
- `src/navigation/screens/LogScreen.spec.tsx` — `@/features/auth`(meId)·`@/features/muklog`(MuklogList 더블) 모킹 추가 + 통합 테스트 2건(placeholder 제거·리스트 마운트 props·커플/솔로 무관).

---

## 3. 모킹 경계(테스트)
- `@/lib/supabase` 모킹: `from`(체이닝 빌더 select/eq/order, 마지막 order thenable), `auth.getUser`. RPC 아님(직접 select/insert).
- `useMuklogs`/`useCreateMuklog`/`MuklogEntrySheet`/`MuklogList`는 상위 spec에서 더블로 대체(경계 격리).
- SQL/RLS/트리거는 단위 대상 아님 → 클라 계약(쿼리 인자·row shape·토큰)만 검증. 실 RLS/트리거는 디바이스/DB 스모크.
- ⚠️ jest 규칙: `jest.mock` 팩토리 내부 참조 변수는 `mock` 접두사 필요 → spec들은 `supabase.from as jest.Mock` 또는 `mock*` 네이밍 사용.

---

## 4. 핵심 결정 반영(plan §4 대비)
- **D2/D4 승인 반영**: `lat`/`lng` nullable, `area` nullable 컬럼 — 마이그레이션 §1 그대로.
- **D3**: 조회=클라 직접 select(RLS 하), RPC 아님. insert `with check(created_by=auth.uid())`로 위조 차단(AC8).
- **D5/D6/D7/D8 OUT**: muklog_photos 미생성, 카드 탭 navigate 없음(onPress 미연결), list_my_rooms 미변경(섹션 N=리스트 길이), 필터 칩 없음.
- **별점 색**: 킷 앰버(#FFB23E)는 raw hex 금지 → 토큰 `warning`(채움)/`borderStrong`(빈)으로 근사. (디자인 QA 시 토큰 추가 여지.)
- **커버**: FoodCover 그라데이션 → `primaryWeak` 단색 웜 배경 + 카테고리 이모지로 축약(디바이스 스모크 대상).

---

## 5. 사용자 액션 (필수)
1. **마이그레이션 원격 적용** (developer가 git/db 미수행):
   ```bash
   supabase db push
   ```
   또는 Supabase 대시보드 SQL 에디터에서 `supabase/migrations/20260611130000_muklog_list.sql` 전체 실행.
2. **DB/디바이스 스모크**(plan §13):
   - 실 RLS 타방 격리: A방 멤버가 B방 먹로그 select → 0건.
   - 트리거 raise: `place_name` 빈/`rating` 6/미래 `visited_at` insert → 각 토큰 에러.
   - `created_by` 위조: 타인 uid로 insert → RLS with check 거부.
   - 카드/시트 실기기 렌더·저장·FAB·빈 상태.

---

## 6. OUT / 미완 (이번 스프린트 의도적 제외 — plan §2 Out-of-scope)
- Kakao 장소검색·좌표(lat/lng)·주소·kakao_place_id → `muklog-editor`(컬럼만 nullable 선반영).
- 사진(`muklog_photos`+Storage)·2초 영상(video_path) → `muklog-editor`/`muklog-video`(UI/업로드 없음).
- 먹로그 상세(MuklogDetail)·카드 탭 navigate → `muklog-detail`.
- 수정/삭제(update/delete 정책·RPC·UI) → 차기(이번은 생성+조회만, update/delete RLS 정책 없음).
- 카테고리 필터 칩 → 차기. Realtime 동시 편집 반영 → MVP 이후(진입 1회+refresh만).
- 방문일 네이티브 데이트 피커 → 1차는 `YYYY-MM-DD` 텍스트 입력(미래는 트리거+앱 검증 최종 방어). 네이티브 피커는 차기/디바이스.
- LogList "맛집 N곳" 카운트(list_my_rooms 변경) → `muklog-spot-count`(D7, 회귀 표면 분리).
