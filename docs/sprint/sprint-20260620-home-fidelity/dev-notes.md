# dev-notes — home-fidelity (백엔드/데이터 절반)

> 범위: 홈 로그 카드 통계(맛집 수·마지막 기록)를 위한 RPC 집계 추가. **UI/LogListScreen.tsx는 본 절반에서 손대지 않음**(publisher 담당).

## 변경 파일
| 파일 | 변경 |
|------|------|
| `supabase/migrations/20260620120000_home_log_stats.sql` | **신규** — `list_my_rooms()`를 drop+recreate, RETURNS TABLE 말미에 `spot_count int`·`last_muklog_at timestamptz` 추가 |
| `src/features/room/useMyLogs.spec.ts` | 매핑 테스트 추가(spot/last 존재→매핑·누락→폴백) + 기존 exact-match 테스트에 두 필드 반영 |
| `src/features/profile/profileStats.spec.ts` | `makeLog` 픽스처에 `spotCount:0`·`lastMuklogAt:null` 추가(MyLog 타입 확장 흡수, 로직 불변) |

> `src/features/room/useMyLogs.ts`(타입·`MyLogRow`·`toMyLog` 매핑)는 **리더가 이미 작성**해 둠 — 본 절반은 그 계약을 테스트로 고정하고 데이터 출처(SQL)를 채움.

## 마이그레이션 SQL 요지
- **신규 파일 정책**: 적용된 `20260619130000_log_preview_photos.sql`을 직접 수정하지 않고 신규 파일로 교체(메모리 `definer-storage-and-best-effort`).
- **drop + recreate**: RETURNS TABLE 컬럼 변경이라 `drop function ... ; create or replace ...`. 무인자라 오버로드 충돌 없음.
- **보존**: `security definer` / `set search_path = public` / 기존 9컬럼 순서·타입 / `preview_paths` 서브쿼리 / `revoke ... from public,anon` + `grant execute ... to authenticated` 전부 불변. 추가만.
- **집계 방식**(member_count의 상관 서브쿼리 패턴 미러링):
  - `spot_count` = `(select count(*)::int from public.muklogs mk2 where mk2.room_id = r.id)` → 맛집 0이면 `count(*)=0`.
  - `last_muklog_at` = `(select max(mk3.created_at) from public.muklogs mk3 where mk3.room_id = r.id)` → 맛집 0이면 `max()`가 **NULL**(SQL 의미상 빈 집합 → NULL, 별도 처리 불요).
- **NULL/0 처리**: spot_count는 count라 항상 0 이상(NULL 없음). last_muklog_at은 맛집 0일 때만 NULL. 거짓 카운트 0(실집계만).

## muklog 테이블/컬럼 출처(스키마 확인 근거 — 추측 아님)
- 테이블: `public.muklogs` — `supabase/migrations/20260611130000_muklog_list.sql:28` `create table if not exists public.muklogs (...)`.
- 컬럼: `room_id uuid`(:30), `created_at timestamptz not null default now()`(:45), `visited_at date`(:41).
- **"마지막 기록 시각" = `created_at`(timestamptz) 채택, `visited_at` 아님**: `visited_at`은 `date` 타입(시간 정보 없음)이고 NULL 허용이라 timestamptz 계약(`last_muklog_at timestamptz` / `MyLog.lastMuklogAt: ISO`)에 부적합. `created_at`이 "레코드를 기록한 시각"의 정확한 timestamptz.
  - 참고: 기존 preview_paths 정렬은 "최근 방문 대표사진" 목적이라 `visited_at desc`를 쓰지만, 통계행의 "마지막 **기록**"은 기록 시각(created_at)이 의미상 맞음.
- 인덱스: `idx_muklogs_room_visited (room_id, visited_at desc, created_at desc)`(:75) — `room_id` 선두라 room별 count/max 집계 효율(추가 페치 없음, 비용 가드레일 §8).

## 경계면 매핑 (생산자 → 소비자)
| 단계 | 출처 | 필드 |
|------|------|------|
| 생산자(RPC) | `list_my_rooms()` RETURNS TABLE | `spot_count int`, `last_muklog_at timestamptz` |
| → 행 타입 | `MyLogRow`(useMyLogs.ts) | `spot_count?: number\|null`, `last_muklog_at?: string\|null`(누락/null 흡수) |
| → 매핑 | `toMyLog`(useMyLogs.ts) | `spotCount: row.spot_count ?? 0`, `lastMuklogAt: row.last_muklog_at ?? null` |
| → 소비자 도메인 | `MyLog` | `spotCount: number`, `lastMuklogAt: string\|null` |
| → 화면(publisher 절반) | `LogCard`(LogListScreen.tsx) | `log.spotCount`·`log.lastMuklogAt`·`log.previewPaths` 직접 read |

레거시(집계 컬럼 추가 전 RPC)에서 두 키가 빠진 행 → `?? 0`/`?? null`로 안전 폴백 → 빈카드 경로(거짓 카운트 0). 테스트로 고정.

## 테스트 / tsc 결과
- `npx jest src/features/room/useMyLogs.spec.ts` → **11 passed**(신규 2건: "spot_count·last_muklog_at 투영"·"누락 레거시 폴백" 포함). Red→Green 확인(기존 exact-match가 두 필드 없어 실패하던 것 포함 정합).
- `npm test` → **Test Suites: 138 passed / Tests: 1240 passed** (회귀 0).
- `npx tsc --noEmit` → **0 에러**. (`MyLog` 필드 확장 여파로 `profileStats.spec.ts` 픽스처만 보강, 로직 불변.)

## 로컬 SQL 검증
- 환경에 psql/supabase-cli/docker 부재 → 라이브 실행 불가. **정적 구조 검증**: 괄호 균형 38/38, dollar-quote `$$` 2개, RETURNS TABLE 11컬럼 = select 표현식 11개(타입·별칭 정합) 확인.
- **라이브 DB 적용은 사용자 전담**: `supabase db push`(또는 SQL 에디터에서 본 파일 실행) 후 라이브 스모크(맛집 있는 로그 카드 "맛집 N곳"·"마지막 기록" 노출, 맛집 0 로그 빈카드 확인). git·DB push는 에이전트 미수행.

## qa-logic 교차검증 요청 포인트
- 생산자(SQL) ↔ 소비자(`toMyLog`) 컬럼명·타입 정합(`spot_count`/`spotCount`, `last_muklog_at`/`lastMuklogAt`).
- DEFINER 집계가 멤버십 RLS 우회로 전 멤버 맛집을 세는지(member_count와 동일 패턴) — 권한·GRANT 영향.
- 비용 가드레일 §8: 추가 페치 0(기존 RPC 1회에 컬럼만 추가), 폴링 0.
