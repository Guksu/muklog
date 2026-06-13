# Dev Notes — 먹로그 수정·삭제 (muklog-edit)

> 작성 developer · 2026-06-13. 데이터·로직·배선 구현 기록(비주얼은 ui-publisher 소유). git 미수행.
> 종료 기준: `npm test` 전체 **540 통과** + `tsc --noEmit` **통과**.

---

## 1. 변경/생성 파일

### 마이그레이션 (신규)
- `supabase/migrations/20260613130000_muklog_edit.sql` — update 정책 2종(아래 §2).

### 데이터·로직 (신규)
- `src/features/muklog/reconcileMuklogPhotos.ts` — `planPhotoReconcile` 순수 함수 + `PhotoReconcilePlan` 타입.
- `src/features/muklog/useUpdateMuklog.ts` — 필드 update + reconcile 실행(삭제→업로드→reindex).
- `src/features/muklog/useDeleteMuklog.ts` — Storage remove → row delete.

### 데이터·로직 (확장)
- `src/features/muklog/uploadMuklogPhotos.ts` — `startOrderIndex?: number`(기본 0) 인자 추가. 편집 신규 사진을 임의 order로 insert. **create 호출(미지정=0)은 0,1,2 회귀 유지.**
- `src/features/muklog/useMuklog.ts` — `MuklogDetail.photoStoragePaths: string[]` 추가(임베드 매핑, **추가 쿼리 0**). signed URL 발급 성공/실패와 무관하게 전체 path 보존(삭제용).
- `src/features/muklog/types.ts` — `UpdateMuklogInput` 타입 추가.
- `src/features/muklog/index.ts` — `useUpdateMuklog`/`useDeleteMuklog`/`planPhotoReconcile`/`UpdateMuklogInput` export.

### 배선
- `src/navigation/screens/MuklogDetailRoute.tsx` — `canManage`/`onEdit`/`onConfirmDelete`/`deleting`/`deleteError` 배선 + 편집 시트(initial 매핑) 오버레이 + update/delete 훅 연결. 삭제 성공 시 `goBack`.
- `src/features/muklog/MuklogList.tsx` — `useFocusEffect`로 **재포커스 시 refresh**(첫 마운트 포커스는 가드로 스킵 — 마운트 로드 중복 회피).

### 테스트 (신규/확장)
- 신규: `reconcileMuklogPhotos.spec.ts`, `useUpdateMuklog.spec.ts`, `useDeleteMuklog.spec.ts`, `muklogEditMigration.spec.ts`.
- 확장: `uploadMuklogPhotos.spec.ts`(startOrderIndex), `useMuklog.spec.ts`(photoStoragePaths), `MuklogList.spec.tsx`(포커스 refresh), `MuklogDetailRoute.spec.tsx`(canManage/편집/삭제 배선).
- (ui-publisher 작성) `MuklogEntrySheet.spec.tsx`/`MuklogDetailScreen.spec.tsx` 편집·삭제 시트 — 변경 없이 통과 확인.

---

## 2. 마이그레이션 요약 (`20260613130000_muklog_edit.sql`)

| 정책 | for | 조건(using + with check) | grant |
|------|-----|--------------------------|-------|
| `muklogs_update_own` (신규) | update | `created_by=auth.uid()` + 내 방(room_members) | `grant update on muklogs` |
| `muklog_photos_update_member` (신규) | update | 상위 먹로그가 내 방 + 내가 만든 것(insert와 동일) | `grant update on muklog_photos` |

- **재사용(재선언 금지)**: `muklogs_delete_own`(20260613120000 photos 마이그레이션, grant delete 포함) — 삭제 UI가 그대로 사용. `enforce_muklog_fields` 트리거는 이미 `before insert OR update`라 update 시에도 place_name/rating/visited_at 2차 방어 발화. `muklog_photos` insert/delete RLS·storage 정책·FK CASCADE 모두 기존 재사용.
- idempotent: `drop policy if exists` → `create policy`.
- SQL 스모크(`muklogEditMigration.spec.ts`)가 update 정책 2종·grant·using+with check 존재 + **delete 정책/트리거 재선언 없음**을 grep으로 가드.

---

## 3. 계약 (생산자 ↔ 소비자 매핑)

| 생산자 | 소비자 | 계약 |
|--------|--------|------|
| `muklogs_update_own` RLS | `useUpdateMuklog` update | payload에 created_by/room_id **미포함**(위변조 차단). 0행 → throw(`UPDATE_MUKLOG_NOT_FOUND`). |
| `muklog_photos_update_member` RLS | reconcile reindex `update({order_index}).eq('storage_path')` | 내 방·내 먹로그 사진만 order_index update. |
| `planPhotoReconcile({initial,next})` | `useUpdateMuklog.executePhotoReconcile` | `{toDelete:string[], toAdd:{uri,orderIndex}[], toReindex:{storagePath,orderIndex}[]}`. 판정 키=storage_path. 최종 배열 인덱스=order_index. |
| `uploadMuklogPhotos({...,startOrderIndex})` | reconcile 신규 업로드 | new 1장씩 `startOrderIndex=add.orderIndex`로 insert(흩어진 order 대응). |
| `useMuklog.photoStoragePaths` | `useDeleteMuklog.photoPaths` + 편집 `initialPhotos.storagePath` | order_index 오름차순 전체 path. signed URL 실패와 무관. |
| `useMuklog`(MuklogDetail) | `MuklogDetailRoute` → `MuklogEditInitial` | photos[i].uri + photoStoragePaths[orderIndex] 결합해 ExistingPhoto 시드. |
| `MuklogEntrySheet.onSubmit({input:MuklogEditSubmitInput})` | `MuklogDetailRoute.handleSubmitEdit` → `useUpdateMuklog({input, initialPhotos})` | EditorPhoto[] 최종 순서 전달. initialPhotos는 Route가 보유. |
| `useDeleteMuklog`(remove→delete) | Route `handleConfirmDelete` | 성공 시 goBack / 실패 시 deleteError(시트 유지·재시도). |
| `createdBy===meId` | Route `canManage` → 화면 more 버튼 | 작성자만 노출(RLS 최종 방어). |
| 삭제/편집 후 goBack | `MuklogList` 포커스 refresh | 재포커스 1회 refresh(첫 마운트 가드). |

---

## 4. reconciliation 실행 순서·일관성·orphan 정책

**실행 순서(엄수, plan §3.4)**: ① 삭제(muklog_photos 행 `delete().in('storage_path', toDelete)` → Storage `remove(toDelete)`) → ② 신규 업로드(uploadMuklogPhotos, 각 add를 startOrderIndex로) → ③ reindex(유지 existing `update({order_index})`).
- **삭제 행 먼저**: reindex 시 잔여행/충돌 회피. 5장 상한 트리거는 `before insert`만이라 reindex update는 무관.
- **storage_path 기준 판정**: signed URL 만료(편집 1h 체류)와 무관하게 유지/삭제 정확.

**일관성(create와 다름 — 롤백 없음)**: 필드 update를 먼저, reconcile를 나중에. 필드 update 0행/에러는 사진 손대기 전 빠른 실패. reconcile 단계 실패는 best-effort:
- 신규 업로드 실패 → uploadMuklogPhotos가 그 세션 파일/행을 정리하고 throw. **이미 저장된 필드·기존 사진은 보존**(기존 먹로그 소실 방지 우선).
- Storage remove 실패(삭제 단계) → 행은 이미 지워졌으므로 파일 orphan만 남음(best-effort, 차기 정리 잡).
- reindex 실패 → "순서만 어긋남"(손실 없음). 다음 진입 시 order_index 정렬로 자연 복구.

**삭제 orphan 정책**: Storage **먼저** remove → "row 삭제됨+파일 남음" 역전 미발생. 반대(파일 지움+row 삭제 실패)는 재시도 시 row 삭제(remove no-op). orphan 허용(무료 티어 영향 미미).

---

## 5. useMuklog 확장 회귀

- `photoStoragePaths` 추가는 **임베드 매핑만**(`muklog_photos(storage_path, order_index)`는 detail 스프린트가 이미 조회 중) → 추가 쿼리 0. detail select 컬럼·signed URL 1회 배치 발급·notFound/error 분기 모두 무변경.
- detail 스프린트 회귀: `useMuklog.spec.ts` 기존 케이스(매핑/정렬/배치발급/best-effort/notFound/error/폴링)는 `photoStoragePaths:[]` 한 줄만 추가하고 전부 통과. signed URL 전부 실패해도 photoStoragePaths는 전체 path 유지 케이스 신규 추가.
- `MuklogDetailViewData`(화면)는 photoStoragePaths를 갖지 않음 — Route가 state를 그대로 전달하나 구조적 초과 필드는 무시(타입 호환 유지).

---

## 6. 비용 가드레일

- AWS 미사용(Supabase Storage/Postgres만). Kakao 미사용(장소 텍스트만).
- 편집 신규 사진만 processMuklogPhoto(장변 1280·q0.7) — existing은 재업로드 0(reindex는 order_index update만).
- 삭제·reconcile Storage remove는 전송량 무관(무료).
- 조회: 포커스 1회 refresh(폴링/Realtime 미도입). signed URL은 useMuklog 발급분 재사용.

---

## 7. 디바이스 스모크(미검증 — 실기기 필요)

> 단위/모킹으로 호출·순서·계약은 검증. 아래는 실 Supabase + 네이티브 동작이라 디바이스에서 별도 확인 필요.

1. **마이그레이션 적용**: `supabase db push`(또는 SQL 에디터)로 `20260613130000_muklog_edit.sql` 실행 후 update 정책 활성 확인.
2. **편집 저장(실 데이터)**: 텍스트 수정 → 상세/리스트 반영. 사진 추가/삭제 혼합 → Storage 파일 실제 추가/삭제 + order_index 재부여 확인.
3. **사진 reindex**: 유지 사진 순서 변경 후 재진입 시 order 유지(`muklog_photos_update_member` RLS 통과) 확인.
4. **삭제(실 데이터)**: 삭제하기 → Storage 파일 일괄 remove + row+사진행 CASCADE 삭제 + goBack + 리스트에서 제거 확인.
5. **권한(RLS)**: 짝꿍 먹로그 상세에서 more 미노출(canManage=false) + (강제 호출 시) update/delete 0행 거부 확인.
6. **네이티브 picker**: 편집 신규 사진 갤러리 선택·권한 거부 흐름.
7. **signed URL 만료**: 편집 시트 1h+ 체류 후 저장 — existing 썸네일 깨짐(표시만) but reconcile는 path 기준이라 정상 동작 확인.

---

## 8. ui-publisher 협의 사항

- 없음. ui-spec.md props 계약(`canManage`/`onEdit`/`onConfirmDelete`/`deleting`/`deleteError`, `initial`/`onSubmit`/`submitting`/`submitError`)대로 데이터만 주입. `negative`/`negativeFg` 토큰·MenuRow·아이콘은 ui-publisher가 이미 반영 → 비주얼 변경 없음.
