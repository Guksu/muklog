# UI Spec — 먹로그 사진 UI (muklog-photos)

> 담당: ui-publisher (비주얼/토큰/프리미티브). Storage 업로드·signed URL·DB는 developer.
> 디자인 단일 출처: 킷 `.claude/skills/ui-design/templates/muklog/mk-log.jsx`.
> 범위(plan §5): ⑤ 에디터 사진 그리드, ⑥ 카드 썸네일/장수 배지의 **비주얼 골격**. 데이터/콜백은 props로 노출.

---

## 1. 변경/생성 파일

| 파일 | 종류 | 내용 |
|------|------|------|
| `src/features/muklog/PhotoPickerGrid.tsx` | 신규 프리미티브 | 사진 입력 그리드(썸네일+삭제+추가타일+`N/5` hint) |
| `src/features/muklog/PhotoPickerGrid.spec.tsx` | 신규 테스트 | 렌더/콜백/경계(5장) |
| `src/features/muklog/MuklogEntrySheet.tsx` | 수정 | 사진 필드(PhotoPickerGrid) 추가 + `photos` → createMuklog input |
| `src/features/muklog/MuklogCard.tsx` | 수정 | 대표 썸네일(coverUri) or FoodCover 폴백 + 사진 장수 배지 |
| `src/features/muklog/types.ts` | 수정 | `PickedPhoto` 추가, `CreateMuklogInput.photos`, `Muklog.photoCount/coverUri` |
| `src/theme/tokens.ts` | 수정 | `color.scrimStrong` 추가(사진 배지 글래스 근사) |
| `src/features/muklog/useMuklogs.ts` | 수정(자리) | `toMuklog`에 `photoCount:0/coverUri:null` 중립 기본값 — ⚠️ developer가 임베드+signed URL로 채움 |
| `*.spec.ts(x)` 다수 | 수정 | Muklog 리터럴에 신규 필드 보강(테스트 컴파일) |

---

## 2. 킷 라인 ↔ RN 매핑

### 2.1 사진 입력 그리드 — 킷 `mk-log.jsx:319-339` (MuklogEditor 사진 Field)

| 킷 요소 (mk-log.jsx) | 킷 실값 | RN(`PhotoPickerGrid.tsx`) |
|---|---|---|
| `Field label="사진" hint={`${photos}/5`}` (320) | label 800/15, hint 600/12.5 marginLeft auto | `labelRow`: `Text sectionTitle fg`(label) + `Text meta fgMuted`(hint=`${photos.length}/${max}`) |
| 썸네일 `FC2 ... w/h 72 radius14` (324) | 72×72, radius 14(`--mk-radius-btn`) | `Image source={{uri}}` 72×72, `borderRadius=radius.control(14)` |
| 삭제 버튼 `lk.photoX` (325, 503) | 22×22 원형, top/right −6, 2px `--mk-bg` 보더, `--mk-ink` 배경, close 12 흰 | `remove` Pressable 22×22, top/right −6, `bg=color.fg`, `borderColor=color.bg`, `radius.full`, `Icon Close 12 primaryFg` |
| 추가 타일 `lk.addPhoto` (329-332, 501) | 72×72, radius 14, 2px **dashed** `--mk-accent-line`, `--mk-accent-weak` 배경, camera 24 `--mk-accent` + "추가" 600/11 `--mk-accent-strong` | `addTile` Pressable 72×72, `borderStyle dashed` 2px `accentLine`, `bg=primaryWeak`, `radius.control`, `Icon Camera 24 primary` + `Text caption accentStrong "추가"` |
| `photos < 5` 조건 (328) | 5장이면 추가 타일 미렌더 | `canAdd = photos.length < max(5)` → 추가 타일 조건부 |
| 그리드 `gap:8 flexWrap` (321) | gap 8 | `grid` flexDirection row, flexWrap wrap, `gap=spacing[8]` |
| 영상 안내 (335-338) | 🎬 "2초 영상…" | **범위 밖**(plan OUT: muklog-video) — 미구현 |

### 2.2 카드 썸네일/배지 — 킷 `mk-log.jsx:90-98` (MuklogCard 커버)

| 킷 요소 | 킷 실값 | RN(`MuklogCard.tsx`) |
|---|---|---|
| 커버 `FC2 ... aspectRatio 16/10` (90) | FoodCover 16/10 | `coverUri` 있으면 `Image resizeMode cover` 16/10, 없으면 `FoodCover` 폴백(기존) |
| 카테고리 칩 (91-93) | 좌상 12/12, rgba(255,255,255,.82)+blur, 700/11.5 ink2 | `chip`(기존 유지) — 불투명 `surface` 근사 |
| **사진 장수 배지** (94-97) | 우상 12/12, `rgba(0,0,0,.32)`+blur, camera 13 흰 + count 700/11 흰, gap 4 | `photoBadge`: top/right 12, `bg=color.scrimStrong`, `radius.full`, pad 6×8, `Icon Camera 13 primaryFg` + `Text badge primaryFg`(count), gap 4 |
| `m.photos` 조건 | 장수 표시 | `muklog.photoCount > 0`일 때만 배지 |

---

## 3. props 계약 (developer가 채울 자리)

### 3.1 `PhotoPickerGrid`
| prop | 타입 | 킷 데이터 출처 / developer 연결 |
|---|---|---|
| `photos` | `PickedPhoto[]` (`{uri:string}[]`) | 선택된 로컬 자산 uri(업로드 전 미리보기). 시트가 controlled로 주입 |
| `onAdd` | `() => void` | **developer**: expo-image-picker(다중, 최대 5) 호출 → photos 상태 추가 |
| `onRemove` | `({index}) => void` | **developer**: 해당 index 제거 |
| `max?` | `number` (기본 5) | plan 0~5 |
| `uploading?` | `boolean` | 시트 저장 진행 중 추가·삭제 비활성 |
| `label?` | `string` | "사진"(킷 Field label). hint(`N/max`)는 컴포넌트가 자동 표시 |

### 3.2 `MuklogEntrySheet` (추가 props — controlled)
| prop | 타입 | developer 연결 |
|---|---|---|
| `photos?` | `PickedPhoto[]` (기본 `[]`) | 사진 상태. **developer**가 picker 결과로 관리 |
| `onAddPhoto?` | `() => void` | picker 호출(권한 체크 포함) |
| `onRemovePhoto?` | `({index}) => void` | photos에서 제거 |
> 시트는 저장 시 `createMuklog({ input: { ...기존, photos } })`로 전달한다. **업로드/insert/orphan 정리는 useCreateMuklog(developer)**.

### 3.3 `Muklog` (카드 소비 — 추가 필드)
| 필드 | 타입 | developer 연결 |
|---|---|---|
| `photoCount` | `number` (0~5) | **developer**: useMuklogs `muklog_photos` 임베드 개수 |
| `coverUri` | `string \| null` | **developer**: 대표(order_index 최소) `storage_path`의 **signed URL** 배치 발급(`createSignedUrls`). null이면 카드가 FoodCover 폴백 |
> `useMuklogs.toMuklog`는 현재 `photoCount:0/coverUri:null` 중립 기본값만 둠. developer가 임베드 select + signed URL 매핑으로 교체(plan §3.5 옵션 A / 경계면 §7).

### 3.4 `CreateMuklogInput.photos`
- `photos?: PickedPhoto[]` — 0~5장, **선택 순서 = order_index**. 업로드는 useCreateMuklog가 담당.

---

## 4. 토큰 변경

| 토큰 | 값 | 사유 |
|---|---|---|
| `color.scrimStrong` | `rgba(0,0,0,0.42)` | 카드 사진수 배지 글래스(킷 `rgba(0,0,0,.32)`+blur) 근사. blur 미지원이라 불투명도를 .32→.42로 약간 올려 흰 텍스트 대비 확보. 라이트/다크 공통(사진 위라 항상 어두움) |

그 외 사용 토큰은 기존 정합값 재사용: `radius.control(14)`, `radius.full`, `color.accentLine`, `color.primaryWeak`, `color.primary`, `color.accentStrong`, `color.fg`, `color.bg`, `color.primaryFg`, `spacing[8/12]`. **raw hex/숫자 색 하드코딩 0** (THUMB/REMOVE 등 px 상수는 킷 실값 주석과 함께 named const).

---

## 5. RN 미재현 / 근사 항목 (사유)

| 킷 | RN 한계 | 근사 + 사유 |
|---|---|---|
| 추가 타일 `2px dashed` 보더 | RN `borderStyle:'dashed'`는 플랫폼별 대시 간격 차이(특히 iOS borderRadius 동반 시) | `borderStyle:'dashed'` 그대로 사용. 비주얼 의도(점선 CTA) 유지, 대시 간격은 플랫폼 기본 |
| 사진 배지 `backdrop-filter: blur(6px)` | RN 미지원 | `scrimStrong` 반투명 검정으로 근사(흐림 없음). expo-blur 도입은 과함(배지 1개) — 생략 |
| 카테고리 칩 흰 글래스 blur | RN 미지원(기존) | 불투명 `surface` 근사(기존 정합 유지) |
| 영상 안내(🎬 2초 영상) | — | plan OUT(muklog-video) — 의도적 미구현 |
| 썸네일 = 로컬 uri 미리보기 / 카드 = signed URL | — | PhotoPickerGrid는 로컬 uri `Image`, MuklogCard는 `coverUri`(signed). 표시 책임 분리(plan §3.5) |

---

## 6. 비주얼 충실도 self-check (ui-publishing §5)

- [x] 킷 사진 필드 구조 요소 전부: 썸네일 N개·삭제 ×·추가 타일·`N/5` hint (영상 안내만 OUT).
- [x] 킷 카드 사진 요소: 대표 썸네일 + 카메라+장수 배지 + FoodCover 폴백.
- [x] 색 전부 토큰 경유(raw 0). 신규 글래스는 `scrimStrong` 토큰화.
- [x] radius: 썸네일/추가 타일 14(control), 배지/삭제 full — 킷 일치.
- [x] 헤어라인 vs 그림자: 추가 타일=점선 보더, 카드=기존 헤어라인(그림자 변경 없음).
- [x] FoodCover 폴백 유지(coverUri null → 카테고리 그라데이션). 단색 폴백 아님.
- [x] 프리미티브 추출(PhotoPickerGrid) — 시트 인라인 중복 0. 카드 오버레이는 `coverOverlays`로 단일 정의(Image/FoodCover 공유).
- [x] 근사 항목 본 문서 §5 기록.
- [x] `npm test` 408 passed · `tsc --noEmit` 통과.

---

## 7. qa-inspector 대조 포인트

| 검증 | 킷 라인 | RN |
|---|---|---|
| 추가 타일 5장에서 숨김 | mk-log.jsx:328 `photos<5` | `PhotoPickerGrid` `canAdd` |
| hint `N/5` | mk-log.jsx:320 | `PhotoPickerGrid` labelRow hint |
| 삭제 버튼 위치/색 | mk-log.jsx:503 `lk.photoX` | `styles.remove`(fg bg, bg 보더, −6 offset) |
| 카드 사진 배지 | mk-log.jsx:94-97 | `MuklogCard` `photoBadge`(scrimStrong, camera+count) |
| coverUri 폴백 | (신규, plan §6.2) | `coverUri ? Image : FoodCover` |
| photoCount/coverUri 타입 | plan §3.5 | `types.ts Muklog` |
