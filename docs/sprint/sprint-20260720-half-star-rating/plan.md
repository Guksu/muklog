# Sprint 20260720 — half-star-rating (별점 0.5 단위 지원)

> 작성: 오케스트레이터(리더) 직접 — 부분 재실행 모드(planner 생략).
> 사용자 요청: "별점이 지금은 정수만 가능한데 각각 0.5점도 설정 가능하게 하고 싶다."

## 1. 데이터 계약 (단일 출처)

- **rating 허용값: `{1.0, 1.5, 2.0, …, 5.0}` 또는 null(미평가).** 0/null/undefined = 미평가 규칙 유지.
- 검증 규칙: `1 ≤ rating ≤ 5` **AND** `rating × 2`가 정수(0.5 단위). 위반 토큰은 기존
  `RATING_OUT_OF_RANGE` 재사용(SQL↔앱 토큰 단일 출처 유지, 신규 토큰 없음).

## 2. 변경 지점 (생산자↔소비자 전체)

### DB (신규 마이그레이션 — 적용된 파일 수정 금지, 새 파일로)
`supabase/migrations/20260720120000_rating_half_step.sql`:
1. `alter table public.muklogs alter column rating type numeric(2,1)` (smallint → 0.5 단위 수용).
2. `enforce_muklog_fields` 함수 교체(create or replace, 최신본은 `20260619120000_muklog_visited_future_tz.sql`
   의 body 기준): rating 검사에 0.5 단위 체크 추가(`new.rating * 2 <> trunc(new.rating * 2)` → RATING_OUT_OF_RANGE).
   visited_at의 `current_date + 1` 유예 로직은 **그대로 보존**.
3. `list_my_muklog_pins()` 반환 타입 `rating smallint → numeric(2,1)`: 반환 타입 변경은 `drop function` 후 재생성.
   security definer·`set search_path = public`·revoke(public, anon)·grant(authenticated) **동일 유지**.
4. 주석에 적용 방법(`supabase db push` — 사용자 수행) 명시.

### 앱 로직 (developer)
- `src/features/muklog/validate/validate.ts`: 1~5 범위 + 0.5 단위 검사. 위반 시 기존 rating 토큰 throw.
- `src/features/muklog/types/types.ts`: rating 주석 `1~5` → `1~5, 0.5 단위`.
- `MuklogEditor`는 `Stars editable onChange={setRating}` 경유라 **배선 변경 없음이 기대값** — 확인만.

### Stars 컴포넌트 (ui-publisher — 킷 templates/muklog 기준)
- `src/components/Stars/Stars.tsx`:
  - **표시**: 소수 value 지원 — position ≤ value ⇒ 꽉 찬 별, `position - 0.5 ≤ value < position` ⇒ 반 별,
    그 외 빈 별. 킷(mk-ui Stars)에 반 별 패턴이 없으면 "빈 별 위에 좌측 절반 클리핑된 채운 별 오버레이"로
    근사하고 사유를 ui-spec.md에 기록(오케스트레이터 에러 핸들링 §RN 근사 허용).
  - **입력**: editable일 때 각 별을 좌/우 반으로 분할 — 좌측 탭 = `position - 0.5`, 우측 탭 = `position`.
    접근성 라벨 `별점 3.5점` 형식.
  - 토큰만 사용(raw hex 0), starFill/lineStrong 유지.
- 소비 4곳(`MuklogCard`·`MuklogDetailScreen`·`SelectedSpotCard`·`MuklogEditor`)은 value가 number라 자동 호환 —
  반 별 표시가 각 size(13/14/15/32)에서 깨지지 않는지 확인.

## 3. 인수조건 (테스트 케이스)

- AC1 (validate.spec): 4.5 허용, 4.3 거부, 0.5 거부(<1), 5.0 허용, 5.5 거부, 0/null → null(미평가).
- AC2 (Stars.spec 표시): value 3.5 → 꽉 3 + 반 1 + 빈 1. value 3 → 기존과 동일(꽉 3 + 빈 2). value 0/null → 모두 빈 별.
- AC3 (Stars.spec 입력): editable에서 별4 좌측 탭 → onChange(3.5), 우측 탭 → onChange(4).
- AC4: 기존 정수 별점 데이터/테스트 전부 회귀 없음 (`npm test` 전체 green).
- AC5 (마이그레이션 정적 검토): 트리거가 4.5 허용·4.3 거부, RPC 반환 타입 일치, 권한/definer 보존.

## 4. 스코프 제외

- 평균 별점 반올림 표기 정책 변경(현행 유지), 크롭 UI, 기존 데이터 마이그레이션(smallint→numeric 캐스트는 무손실).

## 5. 종료 기준

`npm test` + `tsc --noEmit` 통과, qa-report-logic.md + qa-report-visual.md 통과. DB 반영(`supabase db push`)과 git 작업은 사용자 전담.
