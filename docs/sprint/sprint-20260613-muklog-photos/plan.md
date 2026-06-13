# Sprint: 먹로그 사진 첨부 (muklog-photos)

> `muklog-editor`의 **첫 슬라이스** = 사진. 작성(create) 흐름에 사진(최대 5장) 첨부 + 카드/리스트 썸네일·장수 표시만 다룬다.
> Kakao 장소검색·위치(좌표/주소)·편집(수정) 모드·영상은 **범위 밖**(다음 슬라이스).

---

## 1. 기능 한줄 정의

사용자가 먹로그를 작성할 때 갤러리에서 사진을 **0~5장** 골라 첨부하면, 압축본이 비공개 Storage에 업로드되고 `muklog_photos`에 기록되며, 먹로그 카드/리스트에서 **대표 썸네일 + 사진 장수 배지**를 볼 수 있다.

---

## 2. 범위

### In-scope
- `muklog_photos` 테이블 + **비공개 Storage 버킷 `muklog-photos`** + RLS/Storage 정책 마이그레이션.
- 사진 picker(갤러리 다중선택, 최대 5) + 리사이즈/압축 + 업로드 훅.
- `MuklogEntrySheet`에 사진 필드 추가(킷 MuklogEditor의 사진 그리드: 0~5 추가/삭제, `N/5` hint).
- `useCreateMuklog`에 사진 연동 — muklogs insert 성공 후 사진 업로드 + `muklog_photos` insert, **실패 시 정리(orphan 방지) 정책**.
- 카드/리스트 **대표 썸네일(signed URL) + 장수 배지** 표시.
- 사진 0장도 정상 생성(사진은 필수 아님).
- 갤러리 권한 메시지 일반화(프로필 전용 → 공용).

### Out-of-scope (다음 슬라이스)
- **Kakao 장소검색·위치**(주소/좌표/카테고리 자동) — `muklog-place`.
- **편집(수정) 모드** — 기존 먹로그의 사진 추가/삭제/재정렬 — `muklog-edit`.
- **2초 영상** — `muklog-video`.
- 상세 화면 **사진 캐러셀** — `muklog-detail`(카드 썸네일까지만; 캐러셀은 detail 슬라이스).
- 사진 **순서 변경(드래그 재정렬)** — 이번엔 선택 순서대로 `order_index` 고정.
- 카메라 직접 촬영(이번엔 갤러리 선택만).

---

## 3. 데이터 · API 계약

### 3.1 결정 — 버킷 공개여부: **비공개(private)** ✅

| 후보 | 결정 | 사유 |
|------|------|------|
| public (아바타와 동일) | ❌ | 먹로그 사진은 **커플의 사적 기록**. public이면 경로만 알면 누구나 CDN으로 열람 가능 → 프라이버시 위반. |
| **private + RLS(경로 room_id) + signed URL** | ✅ | 멤버만 읽기. URL은 만료(예: 1h) signed URL로 발급해 외부 유출 시에도 제한적. Storage 정책으로 멤버십 검증. |

> 아바타(`avatars`, public)와 의도적으로 다르다. 아바타는 비민감·파트너 표시 대비라 public이지만, 먹로그 사진은 민감하므로 private.

### 3.2 테이블 `muklog_photos` (신규)

architecture.md §3에 선언된 스키마를 그대로 생성한다. **컬럼명은 `order_index`**(architecture §3 기준 — `sort_order` 아님, 단일 출처 준수).

```sql
muklog_photos
  id           uuid PK default gen_random_uuid()
  muklog_id    uuid NOT NULL → muklogs(id) ON DELETE CASCADE
  storage_path text NOT NULL          -- 버킷 내부 키: {room_id}/{muklog_id}/{uuid}.jpg
  order_index  smallint NOT NULL      -- 0~4 (트리거로 범위·중복 방어)
  created_at   timestamptz NOT NULL default now()
```

- **인덱스**: `(muklog_id, order_index)` — 먹로그별 사진 정렬 조회.
- **트리거** `enforce_muklog_photo_fields` (before insert/update): `order_index` 0~4 범위 밖이면 `PHOTO_ORDER_OUT_OF_RANGE`, (선택) 먹로그당 5장 초과 시 `PHOTO_LIMIT_EXCEEDED` (count 검사). 토큰은 SQL ↔ `features/muklog/errors.ts` 단일 출처.
- **grant**: `select, insert, delete on public.muklog_photos to authenticated` (delete는 orphan 정리·차기 편집 대비; update 불필요).

### 3.3 RLS 정책 `muklog_photos`

상위 muklog의 room 멤버십으로 검증(architecture §3).

```sql
-- select: 상위 먹로그가 내 방이면 read
muklog_photos_select_member:
  for select using (
    muklog_id in (
      select id from public.muklogs
      where room_id in (select room_id from public.room_members where user_id = auth.uid())
    )
  )

-- insert: 상위 먹로그가 내 방 + 그 먹로그를 내가 만든 것일 때만
muklog_photos_insert_member:
  for insert with check (
    muklog_id in (
      select id from public.muklogs
      where created_by = auth.uid()
        and room_id in (select room_id from public.room_members where user_id = auth.uid())
    )
  )

-- delete: insert와 동일 조건(내 방·내가 만든 먹로그의 사진) — orphan 정리·차기 편집 대비
muklog_photos_delete_member: 위 insert와 동일 using 절
```

### 3.4 Storage 버킷 `muklog-photos` + 정책 (모두 마이그레이션 SQL로 생성)

경로 규약: **`{room_id}/{muklog_id}/{uuid}.jpg`** (버킷 내부 키. 첫 세그먼트=room_id가 정책의 멤버십 판정 기준).

```sql
insert into storage.buckets (id, name, public)
values ('muklog-photos', 'muklog-photos', false)  -- ⚠️ public=false
on conflict (id) do nothing;

-- 읽기: 첫 세그먼트(room_id)가 내 방일 때만 (private이므로 select 정책 필수 — signed URL도 이 정책 통과 필요 X,
--   service가 발급하지만 authenticated 직접 download는 정책 검증). 멤버 검증.
storage muklog_photos_select_member (for select to authenticated):
  using ( bucket_id = 'muklog-photos'
    and (storage.foldername(name))[1] in (
      select room_id::text from public.room_members where user_id = auth.uid() ) )

-- insert: 첫 세그먼트(room_id)가 내 방일 때만
storage muklog_photos_insert_member (for insert to authenticated):
  with check ( bucket_id = 'muklog-photos'
    and (storage.foldername(name))[1] in (
      select room_id::text from public.room_members where user_id = auth.uid() ) )

-- delete: 동일(orphan 정리)
storage muklog_photos_delete_member (for delete to authenticated): 위 using 동일
```

> ⚠️ 버킷명 `muklog-photos` / 경로 첫 세그먼트=room_id 규약은 `src/features/muklog/photoPath.ts`(신규)와 **단일 출처**.

### 3.5 프론트 계약 — 타입·훅 시그니처

**입력 확장** (`types.ts`):
```ts
// 시트가 고른 로컬 사진 자산(업로드 전).
type PickedPhoto = { uri: string };   // 갤러리 자산 uri만 — 처리/업로드는 훅 책임

// CreateMuklogInput 에 추가:
//   photos?: PickedPhoto[];   // 0~5장, 선택 순서 = order_index
```

**경로 유틸** (`photoPath.ts`, 신규 — avatarPath 패턴):
```ts
MUKLOG_PHOTOS_BUCKET = 'muklog-photos'
buildMuklogPhotoPath({ roomId, muklogId, fileId }): `${roomId}/${muklogId}/${fileId}.jpg`
createPhotoFileId(): string   // time+rand
```

**이미지 처리** (`photoImage.ts`, 신규 — image.ts 패턴, 단 정사각 강제 X):
```ts
PHOTO_MAX_EDGE = 1280      // 장변 1280px (비용 가드레일 §8)
PHOTO_COMPRESS = 0.7       // JPEG q0.7
processMuklogPhoto({ uri }): Promise<{ uri }>   // 장변 1280 리사이즈 + JPEG q0.7 (HEIC→JPEG 자동 변환)
```

**업로드 훅** (`useUploadMuklogPhotos.ts`, 신규 — 또는 useCreateMuklog 내부 함수):
```ts
// muklogId·roomId 확정 후 N장 순차 업로드 → muklog_photos insert.
uploadMuklogPhotos({ roomId, muklogId, photos }): Promise<{ uploadedPaths: string[] }>
//   각 장: processMuklogPhoto → arrayBuffer → storage.upload(path, {contentType:'image/jpeg', upsert:false})
//          → muklog_photos.insert({ muklog_id, storage_path, order_index: i })
//   실패 시 throw + 이미 올린 파일/행 best-effort 정리(orphan 방지).
```

**조회 확장** (`useMuklogs.ts`): 카드가 쓸 **대표 사진 1장 + 장수**를 함께 조회.
```ts
// 옵션 A(채택): muklogs select에 muklog_photos 임베드(대표 1장만).
//   .select('...기존..., muklog_photos(storage_path, order_index)')
//   훅에서 order_index 최소(0) 1장만 대표로 추출 + 개수.
// Muklog 타입에 추가:
//   photoCount: number;             // 0~5
//   coverPath: string | null;       // 대표(order_index 가장 작은) storage_path, 없으면 null
//   coverSignedUrl: string | null;  // coverPath의 signed URL(만료 1h) — 훅이 배치 발급
```
> signed URL은 `supabase.storage.from(bucket).createSignedUrls(paths, 3600)`로 **목록 한 번에 배치 발급**(개별 호출 N회 방지 — 비용/성능).

**카드 소비** (`MuklogCard.tsx`): `coverSignedUrl` 있으면 `<Image>` 커버, 없으면 기존 `FoodCover`(카테고리 이모지) 폴백. `photoCount > 0`이면 우상단 카메라+숫자 배지(킷 mk-log.jsx:94-97).

---

## 4. 화면 · UX

| 컴포넌트 | 역할 | 담당 |
|----------|------|------|
| `MuklogEntrySheet` | 사진 필드 추가(별점 위 또는 메모 아래 — 킷 순서: 장소→**사진**→별점→메모→방문일). 0~5 썸네일 그리드 + "추가" 타일 + 각 썸네일 삭제(×). hint `N/5`. | ui-publisher(UI) + developer(상태/picker 연동) |
| `MuklogCard` | 대표 썸네일(signed URL) or FoodCover 폴백 + 사진 장수 배지(`photoCount>0`). | ui-publisher(비주얼) + developer(데이터 배선) |
| `MuklogList` | 변경 없음(카드가 데이터 받음). 저장 후 refresh가 새 썸네일 반영. | — |

**상태(사진 한정)**:
- 빈 사진: 추가 타일만(카드 커버는 FoodCover 폴백).
- 선택 중: 그리드에 로컬 썸네일(업로드 전 로컬 uri 미리보기).
- 업로드 중: 시트 저장 버튼 `loading`(기존 패턴) — 사진 업로드 포함 전체 진행 동안 비활성.
- 업로드 실패: 인라인 에러(기존 `error` 표시) + 입력/선택 보존(시트 유지).
- 5장 도달: "추가" 타일 숨김 + (초과 시도 시) 토스트/무시.

**원티드 토큰 사용 지점**: 썸네일 `radius.card`(킷 14≈card), 추가 타일 hairline 보더 + `primary` 카메라 아이콘, 배지 글래스 근사(불투명 surface, MuklogCard 칩 패턴 계승). 상세는 ui-publisher가 ui-spec로.

---

## 5. 작업 목록 (각 인수조건 포함)

- [ ] **① 마이그레이션** `supabase/migrations/20260613120000_muklog_photos.sql` — `muklog_photos` 테이블 + 인덱스 + RLS(select/insert/delete) + 트리거(order 0~4·5장 상한) + 버킷 `muklog-photos`(private) + storage 정책 3종 + grant. **(developer)** — 인수조건: 마이그레이션 SQL이 idempotent(if not exists/drop policy if exists/create or replace)하며, 버킷 public=false, RLS가 멤버십·created_by 검증. — 테스트: SQL 정합 스모크(파일 존재·핵심 정책/버킷 라인 grep) + 토큰이 errors.ts와 일치.
- [ ] **② 경로·이미지 유틸** `photoPath.ts` + `photoImage.ts` — **(developer)** — 인수조건: `buildMuklogPhotoPath`가 `{roomId}/{muklogId}/{fileId}.jpg` 생성; `processMuklogPhoto`가 장변≤1280·JPEG q0.7 처리본 반환(원본 직업로드 0). — 테스트: 경로 빌더 단위 테스트(형식·첫 세그먼트=roomId), 이미지 처리는 manipulator 모킹 스모크.
- [ ] **③ 업로드 훅/함수** `useUploadMuklogPhotos`(또는 useCreateMuklog 내부) — **(developer)** — 인수조건: N장 순차 업로드 → `muklog_photos` insert(order_index=선택순), 중간 실패 시 업로드된 파일·행 best-effort 정리 후 throw. — 테스트: supabase storage/from 모킹 — 3장 성공/2번째 실패 시 정리 호출 검증.
- [ ] **④ useCreateMuklog 사진 연동** — **(developer)** — 인수조건: muklogs insert 성공 → 사진 있으면 업로드, 사진 업로드 실패 시 **방금 만든 muklog row 삭제**(또는 정책상 보존+사진만 재시도 — §6 결정 채택) 후 에러. 사진 0장이면 업로드 단계 스킵하고 성공. — 테스트: 모킹 — 0장 경로(업로드 미호출), 5장 성공, 사진 실패 시 muklog 정리 호출.
- [ ] **⑤ 에디터 사진 UI** `MuklogEntrySheet` 사진 그리드 — **(ui-publisher + developer)** — 인수조건: 추가 타일 탭→picker, 0~5 썸네일 표시, 각 ×로 삭제, 5장째에 추가 타일 숨김, hint `N/5`. — 테스트: 화면 테스트(picker 모킹) — 추가/삭제로 N 변화, 5장에서 추가 타일 미표시.
- [ ] **⑥ 카드 썸네일·장수** `useMuklogs` 임베드+signed URL + `MuklogCard` 커버/배지 — **(developer 배선 + ui-publisher 비주얼)** — 인수조건: 사진 있는 먹로그 카드는 대표 썸네일 + `photoCount` 배지; 없는 먹로그는 FoodCover 폴백·배지 없음. — 테스트: useMuklogs 매핑 단위(임베드 row→coverPath/photoCount), MuklogCard 렌더 분기(썸네일 vs 폴백).
- [ ] **⑦ 권한 메시지 일반화** — **(developer)** — 인수조건: 갤러리 권한 거부 시 사진·아바타 공통 한국어 메시지. — 테스트: 권한 거부 모킹 시 토큰/메시지.

> ②③④는 직렬 의존(유틸→업로드→연동). ①은 ③④의 계약 전제(테이블/버킷). ⑥은 ①(테이블) 의존. ⑤는 ②(picker)·types 의존.

---

## 5-1. 테스트 케이스 (TDD)

> 단위(유틸·훅·화면) ✅ jest-expo+RTL / 모킹·스모크(SQL·Storage SDK·ImagePicker·manipulator) / 네이티브 실제 선택·업로드는 **디바이스 스모크**로 분리. 경계는 `docs/testing-strategy.md`.

**경로/이미지 유틸 (단위)**
- 정상: `buildMuklogPhotoPath({roomId:'r',muklogId:'m',fileId:'f'}) === 'r/m/f.jpg'`.
- 정상: `createPhotoFileId()` 매 호출 상이(충돌 회피).
- 스모크(모킹): `processMuklogPhoto` → manipulateAsync가 resize(1280)·JPEG·0.7 인자로 호출됨.

**업로드 훅 (모킹)**
- 정상: 3장 → upload 3회 + muklog_photos.insert 3회(order_index 0,1,2).
- 경계: 0장 → upload/insert 미호출, `{uploadedPaths:[]}`.
- 실패: 2번째 upload 에러 → throw + 이미 올린 1장 storage.remove + (insert된 행 delete) best-effort 호출.

**useCreateMuklog 연동 (모킹)**
- 정상: 사진 0장 → 기존 동작 그대로(muklog insert만, 업로드 미호출).
- 정상: 사진 2장 → muklog insert 후 uploadMuklogPhotos 호출, `{id}` 반환.
- 실패(경계): 사진 업로드 실패 → 방금 muklog **delete 호출** 후 mapMuklogError throw(시트 입력/사진 보존).
- 실패: muklog insert 자체 실패 → 업로드 미호출(기존).

**에디터 사진 UI (화면, picker 모킹)**
- 정상: 추가 타일 탭→2장 선택→그리드 2 썸네일 + hint `2/5`.
- 경계: 5장 선택 후 추가 타일 미렌더.
- 경계: picker가 6장 반환 → 5장만 채택(앞 5장) + (초과 무시).
- 정상: 썸네일 ×탭→해당 제거, hint 감소.
- 정상: picker 취소 → 변화 없음(에러 아님).

**카드 썸네일·장수 (단위/렌더)**
- 매핑: 임베드 row(photos 3, order_index 2/0/1) → `coverPath`=order 0의 path, `photoCount`=3.
- 매핑: 사진 0 임베드 → `coverPath=null, photoCount=0`.
- 렌더: `coverSignedUrl` 존재 → `<Image>` 커버 + 배지 "3" 표시.
- 렌더: `coverSignedUrl=null` → FoodCover 폴백 + 배지 미표시.

**RLS/Storage (SQL 스모크 — 모킹 경계)**
- 파일 존재 + `public) values ('muklog-photos','muklog-photos',false)` 라인 grep.
- select/insert 정책에 `room_members where user_id = auth.uid()` 포함.
- 트리거 토큰 `PHOTO_ORDER_OUT_OF_RANGE` 가 errors.ts와 일치.

**종료 기준**: `npm test` 전체 통과 + `tsc` 통과.

---

## 6. 엣지케이스

**일관성/정리 (핵심 결정)**
- **muklog insert 성공 + 사진 업로드 실패** → 결정: **방금 만든 muklog를 delete + 업로드된 파일/행 정리 후 에러**. 이유: "사진 있는 먹로그를 의도했는데 사진 없이 남는" 어중간한 상태 회피, 사용자는 재시도(입력 보존). (대안=muklog 보존+부분 사진 — 채택 안 함: 부분 성공은 카드 장수 불일치를 부른다.)
  - ⚠️ muklogs에 **delete RLS 정책 없음**(muklog-list에서 update/delete 미도입). → 이 마이그레이션에서 **`muklogs_delete_own` 정책 추가**(created_by=auth.uid() and 내 방)해 정리 delete를 가능케 한다. (사진 정리 한정 용도; 일반 삭제 UI는 여전히 OUT.)
- **업로드 중 앱 종료/네트워크 끊김** → 부분 업로드 파일이 Storage에 남을 수 있음(orphan). best-effort 정리는 같은 세션에서만 가능 → 잔여 orphan은 차기 `room-lifecycle`/정리 잡으로 위임(이번 범위 밖, 주석 명시).
- **muklog 삭제 시 사진** → `muklog_photos` FK `ON DELETE CASCADE`로 행은 자동 삭제. **Storage 파일은 자동 삭제 안 됨** → 차기 정리 잡 위임(이번 슬라이스는 muklog 삭제 UI 자체가 없음).

**입력 한계**
- 5장 도달 후 추가 차단(앱 1차) + 트리거 `order_index 0~4`·5장 상한(2차).
- picker가 6장+ 반환 → 앞 5장만 채택.
- 0장 → 정상 생성(사진 필수 아님).

**미디어/포맷**
- **HEIC(iOS 기본)** → `expo-image-manipulator`가 JPEG로 변환 출력(processMuklogPhoto가 항상 JPEG) → contentType `image/jpeg` 정합.
- 대용량 원본(예: 12MP) → 장변 1280·q0.7로 다운스케일 후 업로드(원본 직업로드 0, §8).
- 손상/0바이트 자산 → upload 에러 → ③ 정리 경로.

**권한**
- 갤러리 권한 거부 → 한국어 메시지(공통), picker 미실행.
- (영구 거부 — 설정에서 해제 안내는 OUT, 메시지만).

**동시성 (커플 2명)**
- 두 명이 각자 먹로그를 동시에 만들어 사진 업로드 → 경로에 `muklog_id`(각자 다름) 포함이라 충돌 없음.
- 한 명이 만든 먹로그의 사진을 다른 멤버가 조회 → RLS select(상위 muklog 내 방)로 허용. insert는 created_by 본인만(타인이 남의 먹로그에 사진 추가 차단).

**RLS**
- 타방 먹로그 사진 select/insert 시도 → 정책으로 0건/거부.
- 남이 만든 내 방 먹로그에 사진 insert → `created_by=auth.uid()` 조건으로 거부.
- Storage: 타방 room_id 경로 업로드/다운로드 → storage 정책 거부.

---

## 7. QA 교차검증 경계면 (생산자 ↔ 소비자)

| 생산자 | 소비자 | 검증 포인트 |
|--------|--------|-------------|
| `muklog_photos` 컬럼(`order_index`, `storage_path`) | `useMuklogs` 임베드 select / 매핑 | 컬럼명 정확(`order_index` ≠ `sort_order`), 임베드 alias 일치 |
| Storage 경로 `{room_id}/{muklog_id}/{uuid}.jpg` | storage 정책 `foldername[1]=room_id` | 첫 세그먼트=room_id 규약 일치(photoPath.ts ↔ SQL) |
| 버킷 `muklog-photos` private | `createSignedUrls` 발급 코드 | 버킷명 단일 출처, public=false인데 getPublicUrl 안 씀(signed만) |
| RLS insert(`created_by`·room) | muklog_photos.insert order_index | 내 방·내 먹로그만 insert, order 0~4 |
| 트리거 토큰(`PHOTO_*`) | `features/muklog/errors.ts` mapMuklogError | 토큰 문자열 단일 출처 동기화 |
| `useUploadMuklogPhotos` 반환·실패 | `useCreateMuklog` 정리 분기 | 실패 시 muklog delete 호출 + orphan 정리 |
| `Muklog.coverSignedUrl/photoCount` | `MuklogCard` 커버/배지 분기 | null→폴백, count→배지, 타입 일치 |
| `MuklogEntrySheet` photos 상태 | `useCreateMuklog` photos 입력 | PickedPhoto[] shape·최대 5 일치 |

---

## 8. 비용 가드레일 체크

- **AWS 미사용** — Supabase Storage(무료 1GB)만. ✅
- **이미지 리사이즈/압축**: 업로드 전 `processMuklogPhoto`로 **장변 1280px·JPEG q0.7** 처리본만 업로드(원본 직업로드 금지). 1장 대략 100~300KB → 5장 ≈ 1MB 내외. 무료 티어 1GB ≈ 먹로그 ~1000건분 여유.
- **사진당 최대**: 처리 후 장변 1280·q0.7로 사실상 상한. (필요 시 차기 슬라이스에서 바이트 상한 가드 추가.)
- **signed URL 배치 발급**: 목록 N개 대표 사진 URL은 `createSignedUrls` **1회 배치**(개별 N회 호출 금지).
- **조회 전송량**: 카드용 임베드는 대표 1장 path만(전체 5장 path·바이너리 미조회). 상세 캐러셀(OUT)에서 전체 조회.
- **Realtime/폴링 미도입**: 기존 "진입 1회 + refresh" 정책 계승.
- **Kakao 미사용**(이 슬라이스는 장소검색 OUT).

---

## 9. architecture.md 백로그 갱신 (이 스프린트에서 반영)

§5 백로그를 다음과 같이 정정/추가한다(별도 작업으로 본 plan 작성 시 함께 적용):
- `muklog-editor` 행 → **슬라이스로 분해 기록**: `muklog-photos`(사진) / `muklog-place`(Kakao 장소·좌표) / `muklog-edit`(수정).
- `muklog-photos` 행 신규 추가, 상태: **진행**.
- **stale 정정**: `log-invite` ✅ 완료(폴더 `sprint-20260611-log-invite` + 커밋 존재), `muklog-list` ✅ 완료(폴더 + 커밋), `social-auth` 진행→✅ 완료로 정정.

---

## 10. 종료 기준 (Definition of Done)

- [ ] `npm test` 전체 통과(신규 단위/모킹/스모크 포함).
- [ ] `tsc` 타입 통과.
- [ ] 마이그레이션 파일 생성(`20260613120000_muklog_photos.sql`) — 라이브 적용은 사용자 환경(`supabase db push`).
- [ ] 외부 키 불필요(Kakao/OAuth 무관) → 코드/모킹으로 업로드 경로까지 검증 가능. **실제 디바이스 사진 선택·네이티브 업로드는 디바이스 스모크로 분리**(체크리스트만 dev-notes에).
- [ ] architecture.md §5 백로그 갱신 반영.
