# QA Report — Logic (sprint-20260720-half-star-rating)

> 담당: qa-logic. 범위: 로직·통합 정합성(퍼블리싱 제외). 비주얼 충실도(Stars 모양)는 qa-visual.
> 검증일: 2026-07-20. 1차 검증 — **`src/components/Stars/`는 지시에 따라 제외(보류)**.
> 실행: `npx jest src/features/muklog` → **30 suites / 332 tests 전부 통과**. `npx tsc --noEmit` → **통과(exit 0)**.

## 종합 판정

**로직 검증 최종 통과.** 데이터 계약(§1)·변경 지점(§2)·인수조건 AC1~AC5 전부 코드 근거로 충족됨. Stars 경계(AC2·AC3 및 방출값↔validate↔DB 체인)까지 2차 검증 완료 — 블로커 없음. 경미한 관찰 2건(비블로커)과 라이브 스모크 확인 1건만 남음.
`npx jest src/components/Stars src/features/muklog src/features/map` → **66 suites / 651 tests 전부 통과**.

---

## 1. 신규 마이그레이션 검증 (AC5 — 정적 검토)

파일: `supabase/migrations/20260720120000_rating_half_step.sql`

### 1-1. rating 컬럼 alter (통과)
- `alter column rating type numeric(2,1)` (`:22-23`). 기존 `smallint`(`20260611130000_muklog_list.sql:40`, `20260614140000_map_tab_pins.sql:32`)의 정수 1~5는 numeric(2,1)로 **무손실 암시 캐스트**. USING 절 불필요.
- `numeric(2,1)` 최대값 9.9 → 5.0 수용 OK. rating은 컬럼 CHECK 제약이 없어(전수 grep: check/constraint/between 0건) 트리거만이 검증 주체 → alter가 잔존 제약과 충돌 없음.

### 1-2. `enforce_muklog_fields` 교체 (통과 — 유예 로직·검증 전부 보존)
최신본 `20260619120000_muklog_visited_future_tz.sql`와 라인 대조:
- PLACE_NAME_REQUIRED 검증 **동일 보존**(`:34-36`).
- visited_at `current_date + 1` 유예 로직 **동일 보존**(`:43-44`) — 타임존 false-positive 방지 그대로.
- rating 검증에 0.5 단위 체크만 추가: `new.rating * 2 <> trunc(new.rating * 2)`(`:38-41`). numeric 산술은 정확 → **4.5**: `9.0 <> 9`=false(통과), **4.3**: `8.6 <> 8`=true(RATING_OUT_OF_RANGE), **경계 1·5**: `2<>2`/`10<>10`=false(통과), **0.5<1·5.5>5**: 범위절에서 거부. SQL 정확.
- 토큰 `RATING_OUT_OF_RANGE`가 앱(`src/features/muklog/errors/errors.ts:12` `MuklogErrorToken.RatingOutOfRange`)과 **단일 출처**. 신규 토큰 없음.

### 1-3. `list_my_muklog_pins()` drop+recreate (통과 — 권한·격리 전부 보존)
원본 `20260614140000_map_tab_pins.sql`와 대조, rating 타입(`smallint`→`numeric(2,1)`, `:63`) 외 전부 동일:
- `security definer`(`:68`) ✓ · `set search_path = public`(`:69`) ✓
- `revoke all ... from public, anon`(`:87`) ✓ · `grant execute ... to authenticated`(`:88`) ✓
- 방 격리 `where rm.user_id = auth.uid()`(`:81`) ✓ · 좌표 null 필터 `lat is not null and lng is not null`(`:82-83`) ✓
- 투영 컬럼(muklog_id/room_id/place_name/category/area/rating/lat/lng) 동일 ✓
- `drop function if exists` 후 recreate — returns 시그니처 변경이라 필수(create or replace 불가). 올바름.

---

## 2. 앱 validate.ts ↔ 소비자 경계 (AC1 · AC4)

### 2-1. 0.5 단위 검사 로직 — 부동소수 함정 없음 (통과)
`src/features/muklog/validate/validate.ts:62-69`:
```
const isHalfStep = input.rating * 2 === Math.trunc(input.rating * 2);
if (input.rating < 1 || input.rating > 5 || !isHalfStep) throw RatingOutOfRange;
```
- 0.5 배수(1.5·2.5·…·4.5)와 정수는 IEEE754에서 **정확 표현** → `×2` 후 정수 판정 안전(주석 `:60-61`이 근거 명시). 4.5×2=9(정확), 4.3×2=8.599…≠8. 부동소수 오차 없음.
- 0/null/undefined 미평가 규칙 보존(`:63` `input.rating != null && input.rating !== 0` 게이트) → null 반환.
- 앱 규칙 = DB 트리거 규칙 = errors 토큰: **3중 단일 출처 일치**.

### 2-2. 테스트 유의미성 (AC1 전 케이스 커버 — 통과)
`validate/validate.spec.ts`:
- 4.5·5.0 허용(`:40-43`, `.rating` 값 단언) / 4.3 거부(`:45-49`) / 0.5·5.5 범위 거부(`:51-58`) / 6·-1 거부(`:31-38`) / 0·null→null(`:60-63`).
- 4.3(범위 내·스텝 위반)이 half-step 분기를 range 분기와 **분리 검증** → 의미 있음. 핵심 단언(값/throw)을 깨면 red 전환 확인.

### 2-3. 소비자 배선 (통과 — 변경 없음이 기대값과 일치)
- `useCreateMuklog.ts:81` → `normalizeMuklogInput` 경유, rating number 그대로 `toMuklogRow`(`validate.ts:140`)가 snake `rating`으로.
- `useUpdateMuklog.ts:99-114` → `normalizeMuklogInput` 경유, `:123` `rating: normalized.rating`로 update payload. 0→null 회귀 테스트(`useUpdateMuklog.spec.ts:281-290`) 그대로 green.
- `MuklogEditor.tsx:187` `useState(initial?.rating ?? 0)` · `:564` `<Stars value={rating} editable onChange={setRating}>` · `:565-566` `rating > 0 ? rating.toFixed(1)` — 배선 변경 없음. 0.5 값 정상(`toFixed(1)` → "3.5").

---

## 3. dev-notes 영향도 주장 재확인 (통과)

- `MuklogDetailScreen.tsx:224` `muklog.rating!.toFixed(1)` (dev-notes는 :224로 지목) — 실제 코드 일치, 소수 정상. `:223` `hasRating = rating !== null`로 null 가드.
- `home_log_stats`/`list_my_rooms`에 **avg(rating) 부재** — 전수 grep 확인(0건). numeric 전환 영향 0. dev-notes 주장 정확.
- rating 정수 강제 코드(parseInt/Math.round·floor·ceil/`toFixed(0`/smallint 캐스트) — src 전수 grep **0건**. 정수 가정 없음 확인.

---

## 4. 관찰 사항 (비블로커)

### 4-1. [확인 권장 — 라이브 스모크] numeric PostgREST 직렬화 ↔ toMuklogPin 패스스루
- 경계: `list_my_muklog_pins()` rating `numeric(2,1)` ⟶ `src/features/map/toMuklogPin/toMuklogPin.ts:19` `rating: row.rating` (**Number() 캐스팅 없이 패스스루**). 바로 옆 lat/lng는 방어적으로 `Number(row.lat)` 캐스팅(`:20-21`, "드라이버 차이" 주석).
- 판정: **안전**. PostgREST는 pg의 JSON 직렬화(numeric→**unquoted JSON number**)를 사용 → supabase-js `JSON.parse` 결과가 number. `useMuklogs`/`useMuklog` 직접 select의 rating도 동일(JSON number). 소비자 `.toFixed(1)`(MuklogDetailScreen·MuklogEditor)이 문자열로 깨질 위험 없음.
- 단, **본 스프린트가 프로젝트 최초의 numeric 컬럼**(기존 numeric/decimal 전무)이라 런타임 선례가 없음. 사용자 `supabase db push` 후 라이브 스모크로 (a) 지도 핀 rating 표시, (b) 상세 화면 별점 "4.5" 표기가 정상인지 1회 확인 권장. (원한다면 toMuklogPin에도 lat/lng와 동일한 `Number()` 방어 캐스트를 추가하면 belt-and-suspenders — 필수는 아님.)

### 4-2. [경미 — UX 카피] half-step 거부 시 메시지 부정확
- `errors.ts:38` `RATING_OUT_OF_RANGE` → "별점은 1~5 사이로 선택해 주세요." 4.3(범위 내·스텝 위반) 거부 시 이 문구는 부정확(1~5 사이임). 단, UI Stars는 0.5 스텝만 방출 → 실사용자는 이 경로 도달 불가(직접 API 호출 시에만). 방어심층 경로라 비블로커. 신규 토큰 추가는 계약(§1 "신규 토큰 없음")에 반해 권장하지 않음.

### 4-3. [문서 nit] `src/features/map/types/types.ts:24` MuklogPin.rating 주석 `// 1~5` — `1~5, 0.5 단위`로 갱신 시 types.ts(`:15`, `:79`)와 일관. 비블로커.

---

## 5. Stars 경계 검증 (2차 — 완료, 통과)

ui-publisher의 `src/components/Stars/Stars.tsx` 확정 후 검증. 전 체인 통과.

### 5-1. editable 방출값 집합 ⊆ validate 허용 집합 (통과)
`Stars.tsx:79` `leftValue = Math.max(1, position - 0.5)`, `:89`/`:103`/`:109` onChange 방출:
- 별1: `max(1, 0.5)=1` → `leftValue===position`(`:81`) → 반 분할 없이 단일 Pressable, 좌/우 모두 **1** 방출.
- 별2~5: 좌 = {1.5, 2.5, 3.5, 4.5}, 우 = {2, 3, 4, 5}.
- **방출 가능 집합 = {1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5}** ⊆ validate 허용 {1, 1.5, …, 5}. **0.5·계약 위반값 방출 경로 없음**(클램프로 0.5 차단). onChange 외 rating 변경 경로 없음(0으로 되돌리는 clear 탭 부재 — 기존 동작, 스프린트 범위 밖).
- 테스트 `Stars.spec.tsx:74-81`(좌 3.5 / 우 4), `:83-91`(별1 단일 탭 → 1, `not.toHaveBeenCalledWith(0.5)`) — 클램프 회귀 방어 유의미.

### 5-2. 소수 rating 무유실 전달 체인 (통과)
`MuklogEditor.tsx:564` `onChange={setRating}` → `:334`/`:362` 저장 시 `rating` state를 input에 실음 → `normalizeMuklogInput`(validate.ts:62-69, 3.5 허용) → `toMuklogRow`(rating 3.5 그대로) → `useCreateMuklog`/`useUpdateMuklog`(`:123` `rating: normalized.rating`) payload → DB `numeric(2,1)`.
- **반올림·유실 지점 없음**: `toFixed(1)`은 `MuklogEditor.tsx:566` **보조 텍스트 표시 전용**(저장값에 미적용). 3.5 → 화면 "3.5"(number 3.5는 그대로 저장). JS number 3.5 → JSON `3.5` → numeric(2,1) exact.

### 5-3. 표시 소비처 소수 안전성 (통과)
전 소비처가 `<Stars value={rating} />`로 rating을 직접 전달, Stars가 null·소수를 자체 처리:
- `MuklogCard.tsx:124`(size 14) · `SelectedSpotCard.tsx:75`(size 13, props rating=MuklogPin.rating) · `MuklogDetailScreen.tsx:387`(size STARS_SIZE) · `MuklogEditor.tsx:564`(size 32, editable).
- `Stars.resolveState`(`:39-43`): 3.5 → pos1~3 filled, pos4 half(`3.5≤3.5`), pos5 empty. 로직은 size 무관(size는 px·`halfClip` = size/2만 영향) → 13/14/15/32 전부 정상. null → filled 0(모두 빈 별). `Stars.spec.tsx:53-72`가 3.5 렌더(꽉3+반1+빈1)·정수 회귀·오버레이 근사 검증.

---

## 6. 인수조건 대응표

| AC | 내용 | 판정 | 근거 |
|----|------|------|------|
| AC1 | validate: 4.5·5.0 허용 / 4.3·0.5·5.5 거부 / 0·null→null | ✅ 통과 | validate.ts:62-69, validate.spec.ts:40-63 |
| AC2 | Stars 표시(반 별): 3.5→꽉3+반1+빈1, 3→회귀, 0/null→빈 | ✅ 통과 | Stars.tsx:39-64, Stars.spec.tsx:53-72, §5-3 |
| AC3 | Stars 입력(좌/우 반 탭): 좌 3.5·우 4·별1 클램프 1 | ✅ 통과 | Stars.tsx:79-113, Stars.spec.tsx:74-91, §5-1 |
| AC4 | 정수 별점 회귀 없음 | ✅ 통과 | jest 651/651 green, tsc 0 |
| AC5 | 마이그레이션 정적 검토(트리거·RPC 타입·권한/definer) | ✅ 통과 | §1-1·1-2·1-3 |
