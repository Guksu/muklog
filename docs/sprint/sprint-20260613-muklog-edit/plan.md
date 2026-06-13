# Sprint: 먹로그 수정·삭제 (muklog-edit)

> 작성일 2026-06-13 · planner. 디자인 단일 출처 = 킷 `templates/muklog/mk-log.jsx`의 `MuklogEditor`(initial 프리필) + `MuklogDetail`의 more 메뉴/삭제 확인 시트(UI는 ui-publisher).
> `muklog-editor` 슬라이스 진행: **photos✅ → detail✅ → edit(이번) → place(예정)**.
> 선행: `muklog-photos`(✅ 비공개 버킷·signed URL·`muklog_photos`·`muklogs_delete_own` 정책), `muklog-detail`(✅ 읽기전용 상세·`useMuklog`·`MuklogDetailScreen`/`MuklogDetailRoute`).

---

## 1. 기능 한줄 정의

상세 화면의 more(···) 메뉴에서 **편집** 또는 **삭제**로 진입해, 편집은 기존 값(텍스트 + 사진)을 프리필한 에디터에서 필드·사진(추가/삭제)을 고쳐 저장하면 `muklogs`가 update되고 사진이 reconcile되며, 삭제는 확인 시트 후 먹로그 row + 사진 행 + **Storage 파일**까지 제거되고 리스트로 복귀해 목록이 갱신된다.

---

## 2. 범위

### In-scope (이번 스프린트)
- **`muklogs_update_own` RLS 정책 신설 마이그레이션**(created_by=auth.uid() + 내 방). update 검증 트리거는 이미 `before insert or update`로 존재(재사용).
- **편집 진입**: 상세 more 메뉴(편집/삭제) + 삭제 확인 시트 **렌더 + 배선**(detail 스프린트에서 미렌더였음).
- **편집 데이터**: `useUpdateMuklog` — `muklogs` 필드 update + **사진 reconciliation**(유지/삭제/신규 구분, order_index 재부여, Storage add/remove).
- **삭제 데이터**: `useDeleteMuklog` — muklog delete(FK CASCADE로 `muklog_photos` 행 자동 삭제) + **Storage 파일 일괄 remove**(orphan 정리).
- **편집 UI**: `MuklogEntrySheet`를 dual-mode(create/edit, initial 프리필)로 확장 — §3.5 결정.
- 편집 후 상세·리스트 갱신, 삭제 후 리스트 복귀 + 목록 갱신, 네비게이션 배선.
- RLS: 본인이 만든 먹로그만 수정/삭제(타인 명의·타 방 거부).

### Out-of-scope (의도적으로 안 함)
- **Kakao 장소검색·좌표/주소**(place_name 외 lat/lng/address/kakao_place_id) → `muklog-place`. 편집에서도 장소명 텍스트만 수정(킷 PlaceSearch 비활성).
- **사진 순서 변경(드래그 재정렬)** — 이번엔 reconciliation 시 **남은 순서대로 0..N-1 재부여**만(명시적 드래그 UI는 추후).
- **2초 영상** 추가/교체/삭제 → `muklog-video`.
- **공유**(share 글래스 버튼) — detail에서 계속 미렌더.
- **삭제 24h 유예/휴지통** — 즉시 하드 삭제(`room-lifecycle` 무관).
- **카메라 직접 촬영** — 편집의 신규 사진도 갤러리 선택만(create와 동일).

---

## 3. 데이터 · API 계약

### 3.1 마이그레이션 — `muklogs_update_own` 정책 1종만 (신규)

**파일**: `supabase/migrations/20260613130000_muklog_edit.sql` (additive, idempotent).

```sql
-- update: 본인이 만든 + 내 방 먹로그만 수정. using(현재 행) + with check(수정 후 행) 모두 동일 조건
--   → 타인 명의·타 방으로의 위변조(created_by/room_id 변경) 차단.
drop policy if exists "muklogs_update_own" on public.muklogs;
create policy "muklogs_update_own" on public.muklogs
  for update
  using (
    created_by = auth.uid()
    and room_id in (select room_id from public.room_members where user_id = auth.uid())
  )
  with check (
    created_by = auth.uid()
    and room_id in (select room_id from public.room_members where user_id = auth.uid())
  );
grant update on public.muklogs to authenticated;
```

- **이미 존재(재사용, 추가 안 함)**: `muklogs_delete_own`(photos 마이그레이션, `grant delete` 포함), `enforce_muklog_fields` 트리거(`before insert **or update**` — place_name/rating/visited_at 값 검증을 update에도 적용), `muklog_photos` insert/delete RLS + storage select/insert/delete 정책, FK `ON DELETE CASCADE`.
- **OUT**: `muklog_photos` update 정책 — 재정렬을 update가 아닌 **delete+insert**로 처리하므로 update 정책 불필요(§3.4).
- **검증 트리거 재확인**: update 시 트리거가 발화하므로 별점/미래일/장소명 빈 값은 DB가 2차 방어. 앱 1차는 `normalizeMuklogInput` 재사용.

### 3.2 입력 타입 (types.ts 확장)

```ts
// 편집 진입 시 프리필 원본(상세 조회 결과에서 파생). 사진은 "기존(remote)" 자산.
export type ExistingPhoto = {
  storagePath: string;   // 'roomId/muklogId/uuid.jpg' — reconciliation 키(유지/삭제 판정)
  orderIndex: number;    // 현재 순서
  uri: string;           // 표시용 signed URL(useMuklog photos[].uri 재사용)
};

// 에디터가 다루는 사진 슬롯 — 기존(remote) | 신규(local) 합집합. order = 배열 인덱스.
export type EditorPhoto =
  | { kind: 'existing'; storagePath: string; uri: string }   // 유지 후보(× 누르면 배열에서 빠짐 = 삭제)
  | { kind: 'new'; uri: string };                            // 신규 pick(local uri) — 업로드 대상

export type MuklogEditInitial = {
  muklogId: string;
  roomId: string;
  placeName: string;
  category: string | null;
  area: string | null;
  rating: number | null;
  memo: string | null;
  visitedAt: string | null;   // 'YYYY-MM-DD'
  photos: ExistingPhoto[];    // order_index 오름차순(useMuklog 정렬 계승)
};

// update 입력(필드 + 최종 사진 슬롯 배열). 최종 배열의 순서 = 새 order_index(0..N-1).
export type UpdateMuklogInput = {
  muklogId: string;
  roomId: string;
  placeName: string;
  category?: string | null;
  area?: string | null;
  rating?: number | null;
  memo?: string | null;
  visitedAt?: string | null;
  photos: EditorPhoto[];      // 0~5. existing(유지) + new(신규)가 섞인 최종 순서
};
```

### 3.3 `useUpdateMuklog` (신규 — developer)

**파일**: `src/features/muklog/useUpdateMuklog.ts` (+ `.spec.ts`)

```ts
useUpdateMuklog() => {
  updateMuklog: ({ input }: { input: UpdateMuklogInput }) => Promise<{ id: string }>;
  loading: boolean;
  error: string | null;
}
```

**동작 순서(부분 실패 정책 §6 반영)**
1. `normalizeMuklogInput`(create와 공유 — placeName 필수·rating 1~5·미래일 차단). 위반 시 토큰 throw(앱 1차).
2. **사진 reconciliation 먼저 수행 후 필드 update** — 또는 역순? → **결정: 필드 update를 먼저, 사진 reconcile를 나중**. 이유: 필드 update 실패(검증/RLS)는 사진을 건드리기 전에 빠르게 실패시켜 일관성 위험을 줄인다. (사진 reconcile 실패는 §6에서 best-effort + 에러 노출로 처리.)
3. `supabase.from('muklogs').update({ place_name, category, area, rating, memo, visited_at }).eq('id', muklogId).select('id').single()`. **created_by/room_id는 update payload에 넣지 않는다**(불변 — RLS with check가 위변조를 막지만 payload 자체를 보내지 않아 사고 차단).
   - 0행/에러 → throw(RLS 거부 시 0행 → `mapMuklogError` 기본 메시지 또는 권한 토큰).
4. **사진 reconciliation**(§3.4) 실행. 실패 시 §6 정책(필드는 이미 저장됨 — best-effort 정리 + 에러).

> create와 달리 **롤백 없음**: 편집은 "기존 먹로그가 사라지면 안 됨"이 더 중요. 부분 실패는 사용자에게 알리고 재시도하게 한다(§6).

### 3.4 사진 reconciliation 설계 (핵심 복잡도)

**입력**: `input.photos: EditorPhoto[]`(최종 순서) + `initial.photos: ExistingPhoto[]`(현재 DB 상태).
**유틸 분리**: `reconcileMuklogPhotos.ts`(순수 함수, 단위 테스트) + reconcile 실행은 훅.

순수 계산 함수 `planPhotoReconcile({ initial, next })`:
```ts
{
  toDelete: string[];                                  // initial에 있으나 next.existing에 없는 storagePath → delete
  toAdd: { uri: string; orderIndex: number }[];        // next의 kind:'new' → 업로드 대상(최종 order)
  toReindex: { storagePath: string; orderIndex: number }[]; // 유지 existing 중 order_index가 바뀐 것
}
```

**계산 규칙**
- `keepPaths` = next에서 `kind:'existing'`인 storagePath 집합.
- **toDelete** = initial.storagePath 중 keepPaths에 없는 것(× 눌러 제거된 기존 사진).
- **toAdd** = next의 `kind:'new'` 각각 — 최종 배열 인덱스를 orderIndex로.
- **toReindex** = 유지 existing 각각의 최종 인덱스가 initial의 order_index와 다르면 재부여 대상.
- **order_index 재부여**: 최종 `input.photos` 배열 순서가 곧 0..N-1. existing 유지분은 reindex(필요 시), new는 그 인덱스로 insert.

**실행 순서(중요)**
1. **삭제 먼저**: `muklog_photos` 행 delete(`in('storage_path', toDelete)`) → Storage `remove(toDelete)`. (행 먼저 지워 reindex 시 unique 충돌·잔여행 회피.)
2. **신규 업로드**: `uploadMuklogPhotos`의 단건 로직 재사용 — processMuklogPhoto → upload → `muklog_photos.insert({order_index})`. (단, 기존 `uploadMuklogPhotos`는 order_index를 0부터 부여하므로 **편집용 시그니처 확장 필요**: `startOrderIndex` 또는 명시적 orderIndex 배열. §작업 ②에서 처리.)
3. **재정렬(reindex)**: 유지 existing의 order_index update. → ⚠️ `muklog_photos` **update RLS 정책 없음**.
   - **결정: reindex도 update가 아니라 delete→insert로 하지 않는다**(Storage 파일 재업로드 비용). 대신 **`muklog_photos` update 정책을 이 마이그레이션에 추가**할지, 아니면 **order_index 충돌을 피하는 2단계 update**(임시 큰 값 → 최종 값)로 할지 결정 필요.
   - **채택: `muklog_photos_update_member` 정책 신설**(insert와 동일 조건: 내 방 + 내 먹로그) + order_index 충돌 회피를 위해 **유지 사진 전체를 (muklog_id 기준) 한 번에 재부여**하되 unique 제약이 없으므로(테이블에 order_index unique 없음 — 인덱스만 존재) **단순 순차 update로 충분**. → 마이그레이션에 `muklog_photos_update_member` + `grant update` 추가.

   > ⚠️ **정정**: §3.1에서 "muklog_photos update 정책 OUT"이라 했으나, reindex를 delete+재업로드 없이 하려면 update 정책이 필요하다. **결정: update 정책을 추가**(아래 작업 ①에 포함). delete+insert reindex는 Storage 파일을 지웠다 다시 올려야 해 비용·orphan 위험이 크다.

**실패 처리(§6)**: 각 단계는 best-effort 경계. 업로드 성공·insert 실패 시 그 파일 remove. reindex 실패는 "순서만 어긋남"(데이터 손실 아님) → 경고 후 ready. 자세히는 §6.

### 3.5 편집 UI — `MuklogEntrySheet` dual-mode (결정)

| 후보 | 결정 | 사유 |
|------|------|------|
| 별도 `MuklogEditSheet`/화면 신설 | ❌ | 필드·검증·picker가 create와 99% 동일 → 중복. |
| **`MuklogEntrySheet` dual-mode(`initial?` prop)** | ✅ | 킷 `MuklogEditor`가 `initial`로 create/edit 겸용(`isEdit = !!initial`). 시트 제목·저장 토스트·초기값만 분기. |

**확장 계약**(MuklogEntrySheet props 추가):
```ts
// 기존: visible, roomId, onClose, onSaved, photos?, onAddPhoto?, onRemovePhoto?
initial?: MuklogEditInitial;   // 주어지면 편집 모드. 없으면 기존 create.
```
- `initial` 있으면: useState 초기값 = initial.*(placeName/category/rating/memo/visitedAt). 사진 슬롯 = initial.photos를 `EditorPhoto{kind:'existing'}`로 + picker 신규 추가분 `{kind:'new'}`.
- 제목: 편집 시 "먹로그 편집"(킷 SUBBAR), create 시 "새 먹로그 🍽️".
- 저장: `initial` 있으면 `useUpdateMuklog.updateMuklog`, 없으면 기존 `useCreateMuklog.createMuklog`.
- **사진 상태 통합**: 현재 picker는 `PickedPhoto[]`(uri만)만 다룸 → 편집은 existing+new 혼합 슬롯이 필요. **`useMuklogPhotoPicker`를 EditorPhoto 기반으로 일반화**하거나, 시트에서 existing 슬롯 + picker(new) 슬롯을 합쳐 렌더. → §작업 ④에서 결정(권장: 시트가 `editorPhotos` 상태 보유, picker는 new만 append, existing ×는 슬롯 제거).
- `PhotoPickerGrid`: 기존 썸네일 표시가 local uri 기반 → existing은 signed URL uri로 동일하게 표시 가능(둘 다 `{uri}`). 5장 제한은 existing+new 합산.

### 3.6 삭제 — `useDeleteMuklog` (신규 — developer)

**파일**: `src/features/muklog/useDeleteMuklog.ts` (+ `.spec.ts`)

```ts
useDeleteMuklog() => {
  deleteMuklog: ({ muklogId, roomId, photoPaths }: { muklogId: string; roomId: string; photoPaths: string[] }) => Promise<void>;
  loading: boolean;
  error: string | null;
}
```

**동작 순서**
1. **Storage 파일 먼저 remove** — `photoPaths`(상세에서 보유한 전체 storage_path) 일괄 `supabase.storage.from(MUKLOG_PHOTOS_BUCKET).remove(photoPaths)`. best-effort(실패해도 진행 — DB 삭제가 더 중요, 잔여는 orphan).
   - ⚠️ `photoPaths`는 상세 화면이 `useMuklog`로 이미 보유. **단 useMuklog의 photos는 signed URL만 노출하고 storage_path는 미노출** → §작업 ⑤에서 `useMuklog` 반환에 `storagePaths` 추가(또는 삭제 직전 별도 select). **결정: useMuklog가 `photoStoragePaths: string[]`도 노출**(이미 임베드로 조회 중 — 매핑만 추가, 추가 쿼리 0).
2. **muklog delete** — `supabase.from('muklogs').delete().eq('id', muklogId)`. RLS `muklogs_delete_own`로 본인 행만. FK `ON DELETE CASCADE`로 `muklog_photos` 행 자동 삭제.
   - 0행/에러 → throw(권한 없음/네트워크). Storage는 이미 지웠으나 row가 안 지워졌으면 사용자 재시도(파일은 orphan 가능 — 차기 정리 잡).
3. 성공 → 상세에서 `navigation.goBack()`(리스트 복귀) + 리스트 refresh(§4).

> **순서 근거**: row 먼저 지우면 Storage 정책(`select room_id from room_members`)은 통과하나 muklog_id 행이 사라져도 Storage 파일 경로는 room_id 기반이라 remove 가능. 그러나 **Storage 먼저**가 안전: row 삭제 후 앱이 죽으면 파일 orphan을 정리할 단서(photoPaths)를 잃는다. Storage 먼저 지우면 잔여 위험이 row 1건으로 축소.

### 3.7 비용/만료
- signed URL TTL 3600s(useMuklog 계승). 편집 시 existing 사진은 이미 발급된 signed URL로 표시.
- 신규 사진만 압축·업로드(processMuklogPhoto 재사용, 장변 1280·q0.7).
- 삭제·reconcile의 Storage remove는 무료(전송량 무관).

---

## 4. 네비게이션 · 갱신 계약

### 4.1 편집 진입 — 결정: **상세 위에 시트 오버레이**(새 라우트 없음)
- 상세(`MuklogDetailScreen`)의 more 메뉴 "편집" → 상세가 보유한 `MuklogEntrySheet`(initial=현재 muklog) 열기.
- 이유: 편집은 상세 컨텍스트에서 즉시 수정 후 같은 화면으로 복귀가 자연스럽고, 새 라우트·param 직렬화(사진 슬롯)가 불필요.
- **저장 성공** → 시트 닫기 + `useMuklog.refresh()`(상세 갱신) + 리스트 갱신은 §4.3.
- **대안(검토 후 미채택)**: 별도 `MuklogEdit` 라우트로 push — initial 데이터를 param 또는 재조회해야 해 복잡. 시트가 가볍다.

### 4.2 more 메뉴 / 삭제 확인 — 렌더 위치
- `MuklogDetailScreen`에 `onEdit`/`onDelete` 콜백 prop 추가 + more 글래스 버튼 렌더(detail에서 미렌더였음) + 메뉴 시트(편집/삭제) + 삭제 확인 시트(킷 mk-log:195-217). `Sheet` 프리미티브 재사용.
- share 버튼은 계속 미렌더(OUT).
- 배선은 `MuklogDetailRoute`: `onEdit` → 시트 open, `onDelete` → 확인 시트 → `useDeleteMuklog` → goBack + 리스트 갱신.

### 4.3 리스트 갱신(삭제·편집 후) — 결정
- 문제: 상세는 리스트에서 push됐고, 삭제/편집 후 goBack하면 리스트는 stale(`useMuklogs`는 진입 1회 + refresh만).
- **채택: `useFocusEffect`로 LogScreen/MuklogList 복귀 시 refresh** — 또는 navigate 시 `onResult` 콜백. → **결정: `MuklogList`가 `useFocusEffect(refresh)`로 상세에서 돌아올 때 자동 재조회**(폴링 아님 — 포커스 시 1회). 비용 가드레일 부합(진입/포커스 1회). 첫 마운트 중복 호출은 가드(이미 로드됨 플래그 또는 허용 — 1회 추가 조회는 무해).
  - 대안(미채택): navigation params로 `deletedId` 전달해 로컬 제거 — 편집 변경(썸네일/필드)까지 반영하려면 결국 refresh가 필요.

---

## 5. 화면 · UX (UI는 ui-publisher)

| 영역 | 킷 | 이번 처리 |
|------|----|-----------|
| more 글래스 버튼 | mk-log:144 | 상세 상단 우측 렌더(share는 미렌더, more만). |
| more 메뉴 시트 | mk-log:195-202 `MenuRow` | `Sheet` + MenuRow(편집 `setting`·아이콘 / 삭제 `trash` danger). 사이 헤어라인 구분. |
| 삭제 확인 시트 | mk-log:204-217 | 제목 "먹로그를 삭제할까요?" + 본문 "'{place}' 기록과 사진이 함께 사라져요. 이 작업은 되돌릴 수 없어요." + **삭제하기**(negative/`status-negative`) + 취소(ghost). |
| 편집 시트 | mk-log:281-368 `MuklogEditor` | `MuklogEntrySheet` dual-mode. 제목 "먹로그 편집", 프리필, 사진 그리드(existing+new). 장소는 텍스트 입력 유지(Kakao 검색 OUT). |
| 사진 그리드 | mk-log:319-339 | existing 썸네일(signed URL) + new 썸네일(local) + 추가 타일(<5). 각 × 삭제. hint `N/5`. |

**상태/UX**
- 편집 시트 저장 버튼: placeName 빈값/loading 시 비활성(create 계승). 변경 없이 저장도 허용(§6).
- 삭제: 확인 시트 "삭제하기" 누르면 loading(중복 차단) → 성공 시 시트 닫고 goBack → 리스트 토스트/갱신.
- 삭제 진행 중 에러: 확인 시트 인라인 에러 + 재시도 가능(시트 유지).
- danger 색: `status-negative` 토큰(ui-publisher가 `theme/`에 매핑 확인 — 없으면 신설).

---

## 6. 엣지케이스

**사진 reconciliation / 일관성 (핵심)**
- **편집 중 사진 0장으로 만들기**: 모든 existing × → toDelete=전체, toAdd=[] → 사진 없는 먹로그(정상, 카드 FoodCover 폴백). 
- **5장 초과 시도**: existing+new 합산이 5 초과 시 추가 타일 숨김 + picker 합산 5 컷(useMuklogPhotoPicker MAX 계승). 트리거 `PHOTO_LIMIT_EXCEEDED` 2차 방어(insert 시).
- **사진만 변경 / 텍스트만 변경 / 변경 없음**: 
  - 텍스트만 → update 실행, reconcile는 toDelete/toAdd/toReindex 모두 빈 → no-op.
  - 사진만 → 필드 update는 동일 값으로 실행(무해) + reconcile.
  - 변경 없음 → update(동일 값) + reconcile no-op → 성공(굳이 변경 감지 skip 안 함 — 단순성; 추후 dirty 체크 최적화 가능).
- **reconcile 부분 실패**:
  - 삭제 단계 실패(행 delete 또는 Storage remove) → best-effort, 남은 단계 진행. 행은 남아 카드 장수 불일치 가능 → 에러 노출 + refresh로 실제 상태 반영.
  - 신규 업로드 중 실패 → 그 파일 best-effort remove, 이미 올린 new는 유지(부분 추가). 에러 노출. (create와 달리 롤백 안 함 — 기존 먹로그 보존 우선.)
  - reindex 실패 → 순서만 어긋남(손실 없음), 경고. 다음 진입 시 order_index 기준 재정렬.
- **삭제 도중 실패(row 삭제됐는데 Storage 남음 = orphan 허용?)**: Storage **먼저** 지우므로 이 순서 역전은 발생 안 함. 반대(Storage 지움 + row 삭제 실패) → row 잔존 + 파일 orphan → 사용자 재시도 시 row 삭제, 파일은 이미 없음(remove no-op). **orphan은 허용**(무료 티어 영향 미미, 차기 정리 잡 — photos 스프린트 orphan 메모 계승).

**입력 한계**
- placeName 빈값 → 저장 비활성 + 트리거 `PLACE_NAME_REQUIRED` 2차.
- rating 0(미평가)로 변경 → null update(허용).
- 미래 방문일 → 앱 1차 + 트리거 `VISITED_AT_IN_FUTURE`.

**권한 / RLS**
- 본인이 만든 것만: `muklogs_update_own`/`muklogs_delete_own`이 created_by=auth.uid()로 제한. 타인 먹로그 update/delete → 0행 → 에러("권한이 없거나 찾을 수 없어요").
- 짝꿍이 만든 먹로그 상세에서 편집/삭제 시도 → RLS 0행 거부. **UX: more 메뉴를 작성자에게만 노출**(상세가 `createdBy === meId`일 때만 more 버튼 렌더) → 권한 없는 시도 자체를 차단(서버 RLS가 최종 방어). → §작업 ⑤ 인수조건.

**동시성 (커플 2명)**
- 상대가 같은 먹로그를 동시 수정: 본인은 created_by 아니므로 애초에 편집 불가(짝꿍 것). **작성자만 수정/삭제** → 동시 수정 충돌은 구조적으로 발생 안 함(한 먹로그의 작성자는 1명).
- 한 명이 상세를 보는 중 작성자(본인)가 다른 기기에서 삭제: 보는 중 화면은 stale, refresh/재진입 시 `notFound`(useMuklog maybeSingle 0행). 보는 중 즉시 반영은 Realtime OUT.
- 짝꿍이 보는 중 작성자가 삭제: 짝꿍의 상세는 다음 refresh/재진입 시 notFound.

**signed URL 만료**
- 편집 시트 체류 1h 초과 후 저장: existing 사진의 표시 URL 만료(깨진 썸네일 가능)하나 reconcile는 **storage_path 기준**이라 영향 없음(유지/삭제 판정 정확). 표시만 깨짐 — 재진입 시 새 발급.

**삭제 후 상세 화면 처리**
- 삭제 성공 → `navigation.goBack()`으로 즉시 리스트 복귀(상세 unmount). notFound 화면 노출 안 함(이미 떠남).

---

## 7. 작업 목록 (각 인수조건 + 테스트)

- [ ] **① 마이그레이션 `muklogs_update_own` + `muklog_photos_update_member`** (developer) — `20260613130000_muklog_edit.sql`.
  - 인수조건: `muklogs_update_own`(for update, using+with check = created_by=auth.uid() and 내 방) + `grant update on muklogs`. `muklog_photos_update_member`(for update, insert와 동일 조건) + `grant update on muklog_photos`. idempotent(drop policy if exists). `muklogs_delete_own`/검증 트리거는 추가 안 함(기존 재사용 — 파일 주석에 명시).
  - 테스트: SQL 정합 스모크(파일 존재 + `muklogs_update_own`/`muklog_photos_update_member` 라인 grep + `created_by = auth.uid()` 포함 + delete 정책 재선언 안 함 확인).

- [ ] **② `uploadMuklogPhotos` 편집용 확장 + `reconcileMuklogPhotos`** (developer).
  - 인수조건 a(uploadMuklogPhotos): 명시적 시작 order_index(또는 orderIndex 배열) 인자 지원 — 편집 신규 사진을 임의 order로 insert 가능. 기존 create 호출(0부터)은 무변경 동작(기본값 0).
  - 인수조건 b(`planPhotoReconcile` 순수 함수): initial/next로 toDelete/toAdd(uri,orderIndex)/toReindex(storagePath,orderIndex) 정확 계산. §3.4 규칙.
  - 테스트: `reconcileMuklogPhotos.spec.ts` — (유지만/삭제만/추가만/혼합/0장/순서변경) 케이스로 세 집합 단언. uploadMuklogPhotos.spec 확장(startOrderIndex로 insert order 검증).

- [ ] **③ `useUpdateMuklog`** (developer) — §3.3.
  - 인수조건 a: 필드 update 호출(place_name 등, created_by/room_id 미포함) → select('id').single().
  - 인수조건 b: reconcile 실행(삭제→업로드→reindex 순), 각 단계 supabase 호출 검증.
  - 인수조건 c: update 0행/에러 → throw + mapMuklogError 메시지, reconcile 미실행.
  - 인수조건 d: reconcile 부분 실패 → best-effort 정리 + error 세팅 + throw(필드는 보존, 롤백 없음).
  - 테스트: `useUpdateMuklog.spec.ts` — supabase 모킹으로 a~d. normalizeMuklogInput 재사용(placeName 빈→throw, update 미호출).

- [ ] **④ `MuklogEntrySheet` dual-mode(편집)** (ui-publisher + developer) — §3.5.
  - 인수조건 a: `initial` 주입 시 모든 필드 프리필(placeName/category/rating/memo/visitedAt), 제목 "먹로그 편집".
  - 인수조건 b: existing 사진 썸네일(signed URL) 표시 + × 삭제 시 슬롯 제거(toDelete 후보), 신규 추가 시 합산 5 제한.
  - 인수조건 c: 저장 → `useUpdateMuklog`(initial 있을 때) 호출, EditorPhoto[] 최종 순서 전달. create 모드(initial 없음)는 기존 동작 무변경.
  - 인수조건 d: 변경 없이 저장 → 성공(no-op reconcile).
  - 테스트: `MuklogEntrySheet.spec.tsx` 확장 — initial props로 프리필 단언, existing × 제거, 저장 시 updateMuklog 호출(올바른 photos), create 모드 회귀.

- [ ] **⑤ 상세 more 메뉴 + 삭제 확인 시트 렌더·배선 + `useDeleteMuklog`** (ui-publisher + developer).
  - 인수조건 a(UI): 작성자(createdBy==meId)일 때만 more 버튼 렌더(짝꿍 것은 미렌더). more 탭 → 메뉴 시트(편집/삭제). 삭제 탭 → 확인 시트(킷 카피).
  - 인수조건 b(편집 배선): 메뉴 "편집" → MuklogEntrySheet(initial) open. 저장 성공 → 시트 닫기 + useMuklog.refresh.
  - 인수조건 c(삭제 배선): 확인 "삭제하기" → useDeleteMuklog(Storage remove → muklog delete) → goBack. 에러 시 인라인 + 재시도.
  - 인수조건 d(useDeleteMuklog): Storage remove(photoPaths) → muklogs delete(eq id) 순, 0행/에러 throw. photoPaths는 useMuklog가 노출.
  - 인수조건 e(useMuklog 확장): 반환에 `photoStoragePaths: string[]`(임베드 매핑, 추가 쿼리 0) — 삭제용. 기존 photos(signed URL) 무변경.
  - 테스트: `MuklogDetailScreen.spec.tsx` 확장(more 작성자 분기·메뉴·확인 시트 렌더, share 부재 유지), `useDeleteMuklog.spec.ts`(모킹 — remove→delete 순서·0행 에러), `MuklogDetailRoute.spec.tsx`(편집/삭제 콜백 배선), `useMuklog.spec.ts`(photoStoragePaths 매핑).

- [ ] **⑥ 리스트/상세 복귀 갱신** (developer) — §4.3.
  - 인수조건: 삭제/편집 후 goBack → `MuklogList`가 포커스 시 refresh(목록에서 삭제분 제거·편집분 썸네일/필드 반영). 폴링 아님(포커스 1회).
  - 테스트: `MuklogList.spec.tsx` — useFocusEffect 모킹으로 포커스 시 refresh 1회 호출(첫 마운트 중복 가드 확인).

> 의존: ①(정책)은 ③⑤의 전제. ②(reconcile/upload)는 ③의 전제. ④는 ②③·types. ⑤는 ③(delete 훅)·useMuklog 확장·④(편집 시트 open). ⑥은 ⑤(삭제)·④(편집) 후.

---

## 7-1. 테스트 케이스 (TDD)

> 단위(유틸·훅·화면) ✅ jest-expo+RTL / 모킹·스모크(SQL·Storage SDK·ImagePicker) / 실 디바이스 편집·삭제·네이티브 업로드·Storage 정리는 **디바이스 스모크** 분리. 경계는 `docs/testing-strategy.md`.

**reconcile 순수 함수 (단위)**
- 유지만(existing 3, new 0, 삭제 0) → toDelete=[], toAdd=[], toReindex=[](순서 동일).
- 삭제만(existing 3 → 1 제거) → toDelete=[제거 path], 나머지 reindex(인덱스 당겨짐).
- 추가만(existing 2 + new 1) → toAdd=[{uri,orderIndex:2}], toDelete=[].
- 혼합(existing 2 중 1 삭제 + new 1) → toDelete 1 + toAdd 1 + 유지분 reindex.
- 0장(existing 전부 삭제) → toDelete=전체.
- 순서변경(existing 순서 뒤집기) → toReindex 전부, toDelete/Add=[].

**uploadMuklogPhotos 확장 (모킹)**
- startOrderIndex=3, 2장 → insert order_index 3,4. 0(기본) → 0,1(회귀).

**useUpdateMuklog (모킹)**
- 정상: 텍스트만 변경 → muklogs.update(필드, created_by 미포함) + reconcile no-op → {id}.
- 정상: 사진 추가/삭제 혼합 → delete→upload→reindex 순 호출.
- 경계: 변경 없음 → update(동일) + reconcile no-op 성공.
- 실패: update 0행 → throw + error, reconcile 미호출.
- 실패: 신규 업로드 실패 → 그 파일 remove(best-effort) + throw, 기존 필드/사진 보존.
- 검증: placeName 빈값 → normalizeMuklogInput throw, update 미호출.

**useDeleteMuklog (모킹)**
- 정상: photoPaths 3 → storage.remove(3) → muklogs.delete(eq id) 순, 성공.
- 경계: photoPaths 0 → remove 미호출(또는 빈 배열 no-op) → delete만.
- 실패: delete 0행/에러 → throw + error(Storage는 이미 remove 호출됨).
- best-effort: Storage remove 실패해도 delete 진행.

**MuklogEntrySheet 편집 (화면, picker 모킹)**
- initial 주입 → 필드 프리필 + 제목 "먹로그 편집".
- existing 썸네일 N + × 제거 → 슬롯 감소.
- 신규 추가 → existing+new 합산 5 컷.
- 저장 → updateMuklog 호출(EditorPhoto 최종 배열).
- create 모드(initial 없음) → 기존 createMuklog 회귀.

**상세 more/삭제 (화면)**
- createdBy==meId → more 렌더 / 짝꿍 것 → more 미렌더. share 계속 부재.
- more 탭 → 메뉴 시트, 편집/삭제 row.
- 삭제 → 확인 시트(카피 "되돌릴 수 없어요") → 삭제하기 → onDelete 호출.
- 편집 → onEdit 호출(시트 open).

**useMuklog 확장 (모킹)**
- 임베드 → photoStoragePaths(order 오름차순 path[]) 매핑. 사진 0 → [].

**리스트 갱신 (화면)**
- 포커스 시 refresh 1회(useFocusEffect 모킹).

**SQL 스모크**
- `muklogs_update_own` + `created_by = auth.uid()` + with check 라인 grep.
- `muklog_photos_update_member` + grant update 라인.
- `muklogs_delete_own` **재선언 없음**(기존 파일 재사용 — 중복 정의 회피).

**종료 기준**: `npm test` 전체 통과 + `tsc` 통과.

---

## 8. QA 교차검증 경계면 (생산자 ↔ 소비자)

| 생산자 | 소비자 | 점검 포인트 |
|--------|--------|-------------|
| `muklogs_update_own` RLS(created_by·room) | `useUpdateMuklog` update | 본인·내 방만 0행 외 update, payload에 created_by/room_id 미포함 |
| `muklog_photos_update_member` RLS | reconcile reindex update | 내 방·내 먹로그 사진만 order_index update 가능 |
| `enforce_muklog_fields`(insert **or update**) | useUpdateMuklog update | update 시에도 place_name/rating/visited_at 트리거 발화(2차 방어) |
| `planPhotoReconcile` 세 집합 | reconcile 실행 훅 | toDelete/toAdd(orderIndex)/toReindex 정확, 실행 순서(삭제→업로드→reindex) |
| `EditorPhoto`(existing/new) | MuklogEntrySheet 사진 상태 ↔ useUpdateMuklog | kind 구분·최종 순서=order_index, 합산 5 제한 |
| `MuklogEditInitial`(useMuklog 파생) | MuklogEntrySheet initial 프리필 | 필드명·null 처리, existing 사진 uri/storagePath 둘 다 보유 |
| `useMuklog.photoStoragePaths` | `useDeleteMuklog` photoPaths | Storage remove 대상 path 정확(order/전체), 추가 쿼리 0 |
| `useDeleteMuklog` 순서(remove→delete) | 상세 삭제 배선 | Storage 먼저·muklog delete·0행 처리·goBack |
| 상세 `createdBy==meId` | more 버튼 렌더 분기 | 작성자만 more 노출(권한 없는 시도 차단, RLS 최종 방어) |
| 삭제/편집 후 goBack | `MuklogList` 포커스 refresh | 목록에서 삭제분 제거·편집분 반영(stale 회피) |
| 킷 삭제 확인 카피 | 삭제 확인 시트 | "되돌릴 수 없어요" 카피·negative 버튼·취소(ghost) |

---

## 9. 비용 가드레일 체크 (architecture §6)

- [x] **AWS 미사용** — Supabase Postgres/Storage만.
- [x] **이미지 압축** — 편집 신규 사진만 processMuklogPhoto(장변 1280·q0.7) 재사용. existing은 재업로드 안 함.
- [x] **reconcile 최소 변경** — 유지 사진은 order_index update만(재업로드 0). 삭제는 Storage remove(전송량 무관).
- [x] **삭제 Storage 정리** — muklog 삭제 시 파일 일괄 remove로 orphan 최소화(무료 티어 1GB 보호). 잔여 orphan(앱 죽음)은 차기 정리 잡.
- [x] **조회 1회 + 포커스 refresh** — 폴링/Realtime 미도입. 삭제·편집 후 포커스 시 1회 재조회.
- [ ] **Kakao 미사용** — 장소검색 OUT(muklog-place).
- [x] **signed URL 재사용** — 편집 existing 사진은 useMuklog 발급분 재사용(추가 발급 0).

---

## 10. 종료 기준 (Definition of Done)

- [ ] `npm test` 전체 통과(신규 reconcile/useUpdateMuklog/useDeleteMuklog/시트편집/상세메뉴 spec 포함).
- [ ] `tsc` 타입 통과.
- [ ] 마이그레이션 `20260613130000_muklog_edit.sql` 생성(라이브 적용은 사용자 `supabase db push`).
- [ ] 외부 키 불필요(Kakao/OAuth 무관) → 코드/모킹으로 편집·삭제·reconcile 경로 끝까지 검증. **실 디바이스 편집·삭제·Storage 정리는 디바이스 스모크 분리**(체크리스트 dev-notes).
- [ ] architecture §5 백로그 `muklog-edit` 상태 = **진행**, muklogs update 정책 추가 사실 반영.

---

## 부록: architecture.md 갱신 (이 스프린트로 반영)

- §5 백로그 `muklog-edit` 행: 상태 `예정` → **진행**. 설명에 슬라이스 관계(photos✅→detail✅→**edit**→place) + "muklogs update RLS(`muklogs_update_own`) 신설 / muklog_photos update RLS(reindex용) 신설 / 삭제 시 Storage 파일 정리" 명시.
- §3 제약/정책: muklogs에 update 정책(`muklogs_update_own`) 추가 사실, muklog_photos에 update 정책(reindex) 추가 사실 한 줄 반영(단일 출처 정합).
