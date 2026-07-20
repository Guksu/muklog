# dev-notes — sprint-20260720-half-star-rating (별점 0.5 단위)

developer(데이터·로직) 담당분. Stars 컴포넌트(표시/입력)는 ui-publisher 영역이라 미터치.

## 변경 파일

| 파일 | 변경 |
|------|------|
| `supabase/migrations/20260720120000_rating_half_step.sql` | **신규**. (1) `muklogs.rating` smallint→numeric(2,1) alter, (2) `enforce_muklog_fields` 0.5 단위 체크 추가(범위·visited_at 보존), (3) `list_my_muklog_pins()` drop+recreate(rating numeric(2,1)) |
| `src/features/muklog/validate/validate.ts` | rating 검사에 0.5 단위(`rating*2 === trunc(rating*2)`) 추가. 위반 시 기존 `RATING_OUT_OF_RANGE` throw |
| `src/features/muklog/validate/validate.spec.ts` | AC1 케이스 추가(4.5·5.0 허용 / 4.3 거부 / 0.5·5.5 거부). TDD Red→Green 확인 |
| `src/features/muklog/types/types.ts` | `Muklog.rating`·`CreateMuklogInput.rating` 주석 `1~5` → `1~5, 0.5 단위` |

## 생산자 ↔ 소비자 계약 매핑

- **데이터 계약(단일 출처)**: rating ∈ {1.0, 1.5, …, 5.0} ∪ {null}. 규칙 `1≤r≤5 AND r×2 정수`. 위반 토큰 `RATING_OUT_OF_RANGE`(신규 토큰 없음).
- **생산자(앱 1차)** `validate.ts::normalizeMuklogInput` → **소비자** `useCreateMuklog`/`useUpdateMuklog`가 `toMuklogRow`로 snake row 생성. rating은 number 그대로 전달(변환 없음).
- **생산자(DB 최종방어)** 트리거 `enforce_muklog_fields` (`RATING_OUT_OF_RANGE` raise) ↔ **소비자** `errors.ts::mapMuklogError`가 토큰→"별점은 1~5 사이로 선택해 주세요." 매핑. 앱·SQL 규칙 동일.
- **생산자** RPC `list_my_muklog_pins()` 반환 `rating numeric(2,1)` ↔ **소비자** map-tab 핀 훅(rating은 number라 자동 호환, 별도 파싱 없음).
- **DB 컬럼** `muklogs.rating numeric(2,1)` ↔ **소비자** `useMuklogs` select(`rating`)·`toMuklog`(`rating: number | null` 패스스루)·`MuklogCard`/`MuklogDetailScreen`/`SelectedSpotCard`/`MuklogEditor`. 전부 number 취급 — 정수 가정 없음.

## 정수 가정 정적 확인 (영향도)

- `MuklogEditor.tsx:187` `useState(initial?.rating ?? 0)` + `:564` `<Stars value={rating} editable onChange={setRating} />` + `:565` `rating > 0` + `:566` `rating.toFixed(1)` → 0.5 값 정상. 배선 변경 없음(기대값과 일치).
- `MuklogDetailScreen.tsx:224` `muklog.rating!.toFixed(1)` → 소수 정상.
- `home_log_stats`(`list_my_rooms`)는 `count(*)`·`max(created_at)`만 사용 — **avg(rating) 없음**. numeric 전환 영향 0.
- 별점 반올림/`%`/parseInt 등 정수 강제 코드 없음(grep 확인).

## 테스트 결과

- `npx jest src/features/muklog` → **30 suites / 332 tests 전부 통과**(회귀 0, AC4).
- `npx tsc --noEmit` → 통과.
- SQL/RPC·트리거는 단위 대상 아님 → AC5 정적 검토(위 계약 매핑) + 라이브 스모크(사용자 `supabase db push` 후).

## 미완/사용자 전담

- `supabase db push`(마이그레이션 라이브 반영)와 git 작업은 사용자 전담.
- Stars 표시/입력(반 별 렌더·좌우 반 탭)·AC2·AC3은 ui-publisher(`src/components/Stars/`) 담당.
