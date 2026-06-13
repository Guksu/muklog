# Dev Notes — 먹로그 사진 첨부 (muklog-photos)

> developer 산출물 기록. 데이터/Storage/업로드 배선. 비주얼은 ui-publisher 컴포넌트(props 주입만, 변경 없음).
> 종료 기준 충족: `npm test` 442 passed (63 suites) · `tsc --noEmit` 에러 0.

---

## 1. 생산자 ↔ 소비자 매핑 (QA 교차검증용)

전체 데이터 흐름:
`MuklogEntrySheet` → `useMuklogPhotoPicker`(선택) → `useCreateMuklog`(insert+업로드 호출) → `uploadMuklogPhotos`(순차 업로드) → Storage `muklog-photos` + `muklog_photos` 테이블 → `useMuklogs`(임베드+signed URL) → `MuklogCard`(coverUri/photoCount)

| 생산자 | 소비자 | 계약/경계 포인트 |
|--------|--------|------------------|
| `useMuklogPhotoPicker.photos` (`PickedPhoto[]`) | `MuklogEntrySheet` → `PhotoPickerGrid.photos` / `createMuklog input.photos` | 선택 순서 = order_index. 권한 거부 시 `PERMISSION_DENIED` throw → 시트가 인라인 메시지. 총합 5장 초과는 앞 5장만(`slice(0,5)`) |
| `MuklogEntrySheet` `photos` | `useCreateMuklog.createMuklog({ input: { ...,, photos } })` | controlled(onAddPhoto 주입) 우선, 아니면 내부 picker 훅. shape `PickedPhoto[]`(`{uri}`) 일치 |
| `useCreateMuklog` (muklogs insert 성공 후) | `uploadMuklogPhotos({ roomId, muklogId, photos })` | muklogId = insert 반환 id. roomId = normalized.roomId. 사진 0장이면 호출 스킵 |
| `uploadMuklogPhotos` (각 장) | `supabase.storage.from('muklog-photos').upload(path, jpeg, {contentType:'image/jpeg', upsert:false})` | path = `buildMuklogPhotoPath`(첫 세그먼트=room_id, storage 정책 판정 기준) |
| `uploadMuklogPhotos` (각 장) | `supabase.from('muklog_photos').insert({ muklog_id, storage_path, order_index })` | 컬럼명 `order_index`·`storage_path` 정확(≠ sort_order). RLS insert=내 방+내가 만든 먹로그 |
| 트리거 토큰 `PHOTO_ORDER_OUT_OF_RANGE`·`PHOTO_LIMIT_EXCEEDED` | `features/muklog/errors.ts` `MuklogErrorToken` + `mapMuklogError` | 토큰 문자열 SQL ↔ errors.ts 단일 출처 동기화 |
| `muklog_photos(storage_path, order_index)` 임베드 | `useMuklogs` `MUKLOG_SELECT_COLUMNS` → `pickCoverPath`(order_index 최소) + `createSignedUrls` 배치 | 임베드 alias 일치. 대표 1장 path만 signed URL 발급(전체 5장 미발급) |
| `useMuklogs` `coverUri`/`photoCount` | `MuklogCard` 커버 분기/배지 | coverUri null → FoodCover 폴백, photoCount>0 → 카메라+숫자 배지(타입 `string|null`/`number`) |
| `uploadMuklogPhotos` throw | `useCreateMuklog` 롤백 분기 | 실패 시 `rollbackMuklog`(muklogs delete) 호출 후 throw → 시트 입력/사진 보존 |

---

## 2. 변경/생성 파일

### 신규 (데이터/로직)
- `src/features/muklog/photoPath.ts` (+ `.spec.ts`) — `MUKLOG_PHOTOS_BUCKET`, `buildMuklogPhotoPath`(`{roomId}/{muklogId}/{fileId}.jpg`), `createPhotoFileId`.
- `src/features/muklog/photoImage.ts` (+ `.spec.ts`) — `processMuklogPhoto`(장변 1280·JPEG q0.7, 비율 보존, HEIC→JPEG), `PHOTO_MAX_EDGE`/`PHOTO_COMPRESS`.
- `src/features/muklog/uploadMuklogPhotos.ts` (+ `.spec.ts`) — 순차 업로드 + `muklog_photos` insert + 실패 시 best-effort 정리(파일 remove + 행 delete).
- `src/features/muklog/useMuklogPhotoPicker.ts` (+ `.spec.ts`) — 선택 상태 훅(권한 요청, 다중선택 selectionLimit 5, 5장 상한 slice, removePhoto, reset).
- `supabase/migrations/20260613120000_muklog_photos.sql` — 마이그레이션(§3 요약).

### 수정 (배선/계약)
- `src/features/muklog/errors.ts` (+ `.spec.ts`) — `MuklogErrorToken`에 `PhotoOrderOutOfRange`/`PhotoLimitExceeded`/`PermissionDenied`/`PhotoUploadFailed` + 메시지 추가.
- `src/features/muklog/useCreateMuklog.ts` (+ `.spec.ts`) — 사진 연동(insert 후 업로드, 실패 시 `rollbackMuklog` delete) 추가. 사진 0/undefined면 업로드 스킵(기존 호출부 호환).
- `src/features/muklog/useMuklogs.ts` (+ `.spec.ts`) — `muklog_photos(storage_path, order_index)` 임베드 + `createSignedUrls` 1회 배치 발급 → `coverUri`/`photoCount` 채움(중립 기본값 제거).
- `src/features/muklog/MuklogEntrySheet.tsx` (+ `.spec.ts`) — controlled props 유지 + 내부 picker 훅 기본 경로 추가, 권한 에러 인라인, 저장 성공 시 picker reset.
- `src/features/muklog/index.ts` — 신규 심볼 배럴 export.

> `types.ts`/`MuklogCard.tsx`/`PhotoPickerGrid.tsx`/`tokens.ts`는 ui-publisher가 선반영(developer 변경 없음 — props 주입만).

---

## 3. 마이그레이션 요약 (`20260613120000_muklog_photos.sql`)

idempotent(if not exists / drop policy if exists / create or replace / on conflict do nothing), additive(기존 마이그레이션 미수정). 라이브 적용은 사용자 환경(`supabase db push`).

1. **테이블** `public.muklog_photos`: `id`, `muklog_id`(FK → muklogs ON DELETE CASCADE), `storage_path`, `order_index`(smallint 0~4), `created_at`. 인덱스 `(muklog_id, order_index)`.
2. **RLS** (상위 muklog의 room 멤버십):
   - select = 상위 먹로그가 내 방.
   - insert/delete = 내 방 + 그 먹로그를 내가 만든 것(`created_by = auth.uid()`).
   - update 정책 없음(재정렬은 차기 muklog-edit).
3. **트리거** `enforce_muklog_photo_fields` (before insert): `order_index` 0~4 밖 → `PHOTO_ORDER_OUT_OF_RANGE`, 먹로그당 count ≥ 5 → `PHOTO_LIMIT_EXCEEDED`.
4. **grant**: `select, insert, delete on muklog_photos to authenticated`.
5. **`muklogs_delete_own`** RLS 정책 추가(롤백 한정): `created_by = auth.uid()` + 내 방. `grant delete on muklogs`. 일반 삭제 UI는 여전히 OUT.
6. **버킷** `muklog-photos` **private(public=false)**. 경로 `{room_id}/{muklog_id}/{uuid}.jpg`.
7. **storage.objects 정책** 3종(select/insert/delete): `bucket_id='muklog-photos'` + `(storage.foldername(name))[1]`(=room_id)가 내 방 멤버. private이라 select 정책 필수(signed URL/다운로드 검증).

---

## 4. 추가 의존성

- **추가된 npm 의존성 없음.** `expo-image-manipulator`(~13.0.6)·`expo-image-picker`(~16.0.6)는 프로필 슬라이스에서 이미 설치되어 재사용. (plan은 "필요시 추가"로 명시했으나 이미 존재해 신규 설치 불요.)

---

## 5. signed URL 정책

- private 버킷이므로 **`getPublicUrl` 미사용**, `createSignedUrls(paths, 3600)`(만료 1h)만 사용.
- `useMuklogs`가 목록의 **대표 path(order_index 최소) 1장씩만** 모아 **1회 배치 발급**(개별 N회 호출 금지 — 비용/성능 §8). 전체 5장 path/바이너리는 미조회(카드는 대표 1장만 필요).
- 발급 실패/누락 path는 **coverUri null로 폴백**(사진 때문에 목록 자체를 막지 않음 — 목록은 ready 유지, 카드는 FoodCover 폴백).

---

## 6. 일관성 / orphan 정책

- **부분성공 회피(핵심)**: muklog insert 성공 + 사진 업로드 실패 → `useCreateMuklog`가 `rollbackMuklog`로 **방금 만든 muklog를 delete**(muklogs_delete_own RLS). FK CASCADE로 insert된 `muklog_photos` 행도 함께 정리. 사용자는 입력/사진 보존 상태로 재시도.
- **uploadMuklogPhotos 내부 best-effort 정리**: 순차 업로드 중 실패 시 throw 전에 이미 올린 Storage 파일(`storage.remove`) + insert된 행(`delete().in('storage_path', paths)`) 정리. 정리 실패는 무시(원본 에러 노출 우선).
- **orphan(범위 밖)**: 업로드 중 앱 종료/네트워크 끊김으로 남는 파일, muklog 삭제 시 Storage 파일 자동삭제(행은 CASCADE로 사라지나 파일은 남음)는 **차기 정리 잡으로 위임**(코드/SQL 주석 명시). 이번 슬라이스는 muklog 삭제 UI 자체가 없음.

---

## 7. 비용 가드레일

- 업로드 전 `processMuklogPhoto`로 **장변 1280px·JPEG q0.7** 처리본만 업로드(원본 직업로드 0). 1장 100~300KB 추정 → 5장 ≈ 1MB. 무료 티어 1GB 내.
- signed URL 배치 1회(위 §5). 임베드는 대표 path 메타만(전송량 절감).
- AWS 미사용 / Kakao 미사용(이 슬라이스 OUT) / Realtime·폴링 미도입(진입 1회 + refresh 계승).

---

## 8. 디바이스 스모크 필요 항목 (단위 테스트 경계 밖)

단위/모킹으로 우리 코드의 호출·매핑·정리·분기는 검증함. 아래는 **실 디바이스(Expo Dev Client)에서 사용자 스모크** 필요:

1. 갤러리 권한 다이얼로그 실제 노출 + 거부 시 인라인 메시지(`expo-image-picker` 네이티브).
2. 실제 다중 사진 선택(HEIC 포함) → `expo-image-manipulator`가 JPEG로 변환·장변 1280 다운스케일.
3. 처리본 `fetch().arrayBuffer()` → Storage 실제 업로드(네트워크) 성공/실패.
4. 비공개 버킷 signed URL로 카드 커버 `<Image>` 실제 렌더(만료 동작 포함).
5. RLS/Storage 정책 실 적용(`supabase db push` 후): 타방 room_id 경로 업로드/다운로드 거부, 남의 먹로그 사진 insert 거부.
6. 업로드 중 강제 종료 시 orphan 잔존 확인(차기 정리 잡 입력).
