# UI Spec — 먹로그 수정·삭제 (muklog-edit)

> 작성 ui-publisher · 2026-06-13. 디자인 단일 출처 = 킷 `.claude/skills/ui-design/templates/muklog/mk-log.jsx`.
> 담당 범위: **비주얼/프리미티브/토큰**(편집 시트 dual-mode · 상세 more 메뉴 · 삭제 확인 시트).
> 경계: update/delete 훅·photo reconciliation·Storage 정리·RLS/마이그레이션·네비 갱신 = **developer**(아래 props로 노출).

---

## 1. 킷 라인 ↔ RN 매핑

### 1.1 편집 시트 — 킷 `MuklogEditor`(mk-log:281-368) → `MuklogEntrySheet` dual-mode

| 킷 (파일:라인) | RN | 비고 |
|----------------|----|------|
| `isEdit = !!initial`(283) | `isEdit = initial !== undefined`(MuklogEntrySheet.tsx) | 작성/편집 분기 단일 기준 |
| SUBBAR title `isEdit ? "먹로그 편집" : "새 먹로그"`(295) | `Sheet title={isEdit ? '먹로그 편집' : '새 먹로그 🍽️'}` | RN은 화면이 아니라 **시트 오버레이**(plan §4.1) — SubBar 대신 Sheet 헤더 |
| 저장 버튼 `isEdit ? "수정했어요" : "맛집을 기록했어요"`(296) | Button `title={isEdit ? '수정' : '저장'}` | 토스트는 developer(부모) |
| `place` 초기값 = `initial`(283) | `placeName` useState = `initial?.placeName ?? ''` | 장소 텍스트만(Kakao 검색 OUT, plan §2) |
| `rating`/`memo`/`visitedAt` 초기값(285-288) | 동명 useState = `initial?.* ?? 기본` | category도 동일 프리필 |
| 사진 슬롯 `Math.min(initial.photos,5)`(287) | `editorPhotos` useState = `initial.photos` → `{kind:'existing'}` 시드 | existing(remote) + new(local) 혼합 |
| 사진 그리드(319-339) | `PhotoPickerGrid`(기존 재사용) | uri 기반이라 existing(signed URL)·new(local) 동일 렌더 |
| 썸네일 ×(325) | `handleRemovePhoto` → `editorPhotos.filter` | existing × = toDelete 후보 / new × = 미업로드분 제거 |
| 추가 타일 `<5`(328-333) | `gridPhotos.length < PHOTO_MAX(5)` | 합산 5 컷(existing+new) |
| hint `${photos}/5`(320) | PhotoPickerGrid `N/5`(기존) | — |

> 작성 모드 회귀 0: `initial` 미주입 시 기존 `useCreateMuklog` 경로·controlled photos props·내부 picker 모두 무변경.

### 1.2 상세 more 메뉴 — 킷 `MuklogDetail`(mk-log:122-217) → `MuklogDetailScreen`

| 킷 (파일:라인) | RN | 비고 |
|----------------|----|------|
| `GlassBtn more`(144) | 글래스바 우측 `GlassBtn name=MoreHorizontal`(canManage일 때만) | share(143)는 계속 OUT 미렌더 |
| `menuOpen`/`confirmOpen` state(124-125) | `menuOpen`/`confirmOpen` useState | 동일 |
| more 메뉴 Sheet(195-202) | `Sheet`(title 없음) + `MenuRow` ×2 | — |
| `MenuRow icon="setting" label="편집"`(198) | `MenuRow icon={Setting} label="편집"` → `onEdit` | — |
| 구분 헤어라인 `height:1 line-alt`(199) | `menuDivider` hairlineWidth, `hairlineAlt` | — |
| `MenuRow icon="trash" label="삭제" danger`(200) | `MenuRow icon={Trash} danger` → confirm 열기 | danger tint=`negative` 토큰 |
| `MenuRow`(223-234): icon 21 + 라벨 600/16 | `Icon size 21` + `Text variant="body"`(16/Medium) | danger color = `negative` / 기본 `fg` |

### 1.3 삭제 확인 시트 — 킷(mk-log:204-217)

| 킷 (파일:라인) | RN | 비고 |
|----------------|----|------|
| Sheet title "먹로그를 삭제할까요?"(205) | `Sheet title="먹로그를 삭제할까요?"` | — |
| 본문 "‘{place}’ 기록과 사진이 함께 사라져요.<br/>이 작업은 되돌릴 수 없어요."(206-208) | `Text` 가운데정렬, `‘${placeName}’ 기록과 사진이 함께 사라져요.\n이 작업은 되돌릴 수 없어요.` | place는 `state.muklog.placeName` |
| 삭제하기 버튼 `status-negative #E5484D` 흰 글자 700/16(210-214) | `Pressable` bg=`negative` 토큰, `Text variant="button" color="negativeFg"` | `onConfirmDelete`. 확인 시트는 닫지 않음(developer 성공 시 goBack) |
| 취소 `BTN2 full variant="ghost"`(215) | `Button variant="ghost" full` → confirm 닫기 | — |

---

## 2. 토큰 변경

| 토큰 | 값 | 출처 | 비고 |
|------|----|------|------|
| `negative` | `#E5484D` | 킷 mk-log `var(--status-negative, #E5484D)` | 킷 index.html에 `--status-negative` 미정의 → 인라인 폴백 `#E5484D`가 실값(킷=SSOT). 기존 `error`(#FF4242)/`errorStrong`(#E52222)와 의미 분리(error=검증/조회 실패 텍스트, negative=파괴 CTA) |
| `negativeFg` | `#FFFFFF` | 킷 삭제하기 버튼 `color:#fff` | 버튼 글자색 |

- light/dark 공통(darkColor가 lightColor spread → 자동 미러). 파괴 red는 다크에서도 동일 대비 충분.
- raw hex 하드코딩 0 — 컴포넌트는 `theme.color.negative`/`negativeFg`만 사용.

---

## 3. 신규/수정 프리미티브·아이콘

- **아이콘 추가**(`assets/icons/icons.ts` + `IconName`): `more-horizontal`(킷 mk-log:144), `trash`(킷 mk-log:200). ui-design `assets/icons/*.svg` verbatim(width/height 제거, viewBox 유지) → `IconName.MoreHorizontal`/`IconName.Trash`.
- **`MenuRow`**(MuklogDetailScreen 내부): 킷 `MenuRow`(mk-log:223-234) 재현. 화면 전용(공용화 안 함 — 현재 단일 소비처).
- **`GlassBtn`**(기존): more 버튼에 재사용. 변경 없음.
- **`PhotoPickerGrid`**(기존): 변경 없음 — existing(signed URL uri)·new(local uri) 모두 `{uri}`로 표시 가능 확인(plan §3.5 호환 OK).
- **`useMuklogPhotoPicker`**: `pickPhotoAssets({remaining})` 추가(권한+선택 → `PickedPhoto[]` 반환, 내부 상태 미변경). 편집 시트가 자체 `editorPhotos`에 append하려 반환값만 사용(작성 상태와 분리). 기존 `addPhotos`는 이를 재사용 — 회귀 0.

---

## 4. props 계약 (developer 연결 지점)

### 4.1 `MuklogEntrySheet`(작성/편집 dual-mode)

| prop | 타입 | 출처(developer) | 비고 |
|------|------|-----------------|------|
| `visible` | `boolean` | 상세 화면 상태 | 기존 |
| `roomId` | `string` | 현재 로그 id | 기존 |
| `onClose` | `() => void` | 시트 닫기 | 기존 |
| `onSaved` | `() => void` | 저장 성공 → 닫기 + `useMuklog.refresh` | 기존 |
| **`initial`** | `MuklogEditInitial \| undefined` | `useMuklog` 결과를 매핑(plan §3.2). 주어지면 편집 모드 | photos = `ExistingPhoto[]`(storagePath·orderIndex·uri) |
| **`onSubmit`** | `({input}: {input: MuklogEditSubmitInput}) => Promise<unknown>` | **`useUpdateMuklog.updateMuklog`** 연결. 성공 resolve / 실패 reject | 검증·필드 update·photo reconciliation 전부 developer |
| **`submitting`** | `boolean` | `useUpdateMuklog.loading` | 저장 버튼 로딩/비활성 |
| **`submitError`** | `string \| null` | `useUpdateMuklog.error` | 인라인 표시 |
| `photos`/`onAddPhoto`/`onRemovePhoto` | (기존) | 작성 모드 controlled 사진 | 편집 모드에선 무시(내부 editorPhotos 사용) |

`MuklogEditSubmitInput`(시트 → developer 훅):
```ts
{ muklogId, roomId, placeName, category, area, rating, memo, visitedAt, photos: EditorPhoto[] }
// photos = existing(유지) + new(신규) 최종 순서. 배열 인덱스 = 새 order_index(0..N-1).
// developer: planPhotoReconcile({ initial: initial.photos, next: photos })로 toDelete/toAdd/toReindex 계산.
```

> `EditorPhoto = {kind:'existing'; storagePath; uri} | {kind:'new'; uri}`. reconciliation 키 = `storagePath`(existing). new는 local uri(업로드 대상).

### 4.2 `MuklogDetailScreen`(more 메뉴 + 삭제 확인)

| prop | 타입 | 출처(developer) | 비고 |
|------|------|-----------------|------|
| **`canManage`** | `boolean`(기본 false) | `state.muklog.createdBy === meId`(작성자) | false면 more 버튼 미렌더(권한 없는 시도 차단, RLS가 최종 방어) |
| **`onEdit`** | `() => void` | 메뉴 "편집" → `MuklogEntrySheet(initial)` open(plan §4.1) | — |
| **`onConfirmDelete`** | `() => void` | 확인 "삭제하기" → `useDeleteMuklog`(remove→delete) → 성공 시 `goBack`(plan §3.6) | 확인 시트는 화면이 닫지 않음 — developer가 성공 후 goBack/실패 시 deleteError 세팅 |
| **`deleting`** | `boolean`(기본 false) | `useDeleteMuklog.loading` | 삭제하기 버튼 비활성/로딩(중복 차단) |
| **`deleteError`** | `string \| null` | `useDeleteMuklog.error` | 확인 시트 인라인(시트 유지·재시도) |

> developer 책임: `useDeleteMuklog` photoPaths는 `useMuklog.photoStoragePaths`(plan §3.6 e)에서. 편집 저장 성공 시 `onSaved`에서 refresh, 리스트 복귀 갱신은 `MuklogList` useFocusEffect(plan §4.3).

---

## 5. RN 근사 + 사유

| 킷 | RN 한계 | 근사 | 사유 |
|----|---------|------|------|
| GlassBtn `backdrop-filter: blur(10px)`(mk-log:249) | RN blur 미지원(기본) | `scrimStrong`(rgba(0,0,0,.42)) 반투명 검정 + 흰 아이콘 | 기존 상세 글래스바와 동일 근사(detail 스프린트 계승). 사진 위 대비 확보 |
| 삭제하기 버튼 `WebkitTapHighlightColor`(212) | RN 무관 | `Pressable` pressed opacity 0.85 | 탭 피드백 토큰 방식 |
| Sheet 상단 라운드 `26 26 0 0`(mk-ui) | — | `Sheet` 프리미티브 기존 26 라운드 재사용 | 정합 |
| MenuRow danger 컬러 그림자 없음 | — | 없음(킷도 그림자 없음) | 1:1 |

> 컬러 그림자·실제 blur는 이 스프린트에서 신규 도입 없음(기존 근사 재사용).

---

## 6. Self-check (킷 충실도 체크리스트)

- [x] 편집 제목 "먹로그 편집"·저장 라벨 "수정" (킷 295-296)
- [x] 모든 필드 프리필(placeName/category/rating/memo/visitedAt) (킷 283-288)
- [x] existing 사진 썸네일(signed URL) + × 제거 = toDelete 후보 (킷 287/325)
- [x] 신규 사진 추가 시 합산 5 컷 (킷 287/328)
- [x] more 버튼 작성자(canManage)만 노출 (킷 144 + plan §5⑤a)
- [x] 메뉴 편집/삭제(danger), 사이 헤어라인 (킷 198-200)
- [x] 삭제 확인 카피 "‘{place}’ … 되돌릴 수 없어요" (킷 206-208)
- [x] 삭제하기 = negative 토큰 / 취소 = ghost (킷 210-215)
- [x] share 버튼 계속 미렌더 (킷 143 OUT)
- [x] raw hex 0(토큰만) / 이모지 허용(킷 기준)
- [x] `npm test` 전체 통과(502) + `tsc --noEmit` 통과

---

## 7. 변경 파일

- `assets/icons/icons.ts` — `more-horizontal`·`trash` SVG 추가.
- `src/components/Icon.tsx` — `IconName.MoreHorizontal`·`Trash`.
- `src/theme/tokens.ts` — `negative`·`negativeFg` 토큰(킷 status-negative).
- `src/features/muklog/types.ts` — `ExistingPhoto`·`EditorPhoto`·`MuklogEditInitial`.
- `src/features/muklog/MuklogEntrySheet.tsx` — dual-mode(initial/onSubmit/submitting/submitError) + `MuklogEditSubmitInput`.
- `src/features/muklog/useMuklogPhotoPicker.ts` — `pickPhotoAssets({remaining})` 추가(편집 신규 사진 선택).
- `src/navigation/screens/MuklogDetailScreen.tsx` — more 버튼(canManage) + 메뉴 시트 + 삭제 확인 시트 + `MenuRow`.
- `src/features/muklog/index.ts` — 신규 타입·`MuklogEditSubmitInput` export.
- specs: `MuklogEntrySheet.spec.tsx`·`MuklogDetailScreen.spec.tsx` 확장.
