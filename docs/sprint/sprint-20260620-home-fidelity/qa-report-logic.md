# QA Report — Logic / Integration (sprint-20260620-home-fidelity)

검증자: qa-logic · 일자: 2026-06-20 · 범위: 로직·통합 정합성·집계 정확성·가드레일·TDD·컨벤션 (비주얼 충실도 제외 → qa-visual)

## 종합 판정: **로직 PASS** (라이브 DB 적용은 사용자 전담 — 적용 후 스모크 1건 필요)

모든 경계면(RPC↔MyLogRow↔toMyLog↔LogCard) 정합, 집계 의미 정확, 비용 가드레일 준수, TDD load-bearing 확인, `npm test`(139 suites / 1259 passed) + `npx tsc --noEmit`(0 에러) 직접 실행 통과. 신규 위반 0건.

---

## 1. RPC↔매핑↔카드 경계면 (PASS)
생산자 SQL ↔ 소비자 양쪽을 같이 읽어 대조.

- **RETURNS TABLE 컬럼 순서 ↔ SELECT 표현식 순서 1:1**: 마이그레이션(`20260620120000_home_log_stats.sql:22-34` 11컬럼) ↔ select 표현식(`:39-63` 11개)이 순서·타입·별칭 정합. `spot_count`(:32, :61 `count(*)::int`), `last_muklog_at`(:33, :63 `max(created_at)`)이 말미에 동일 위치. 값 뒤섞임 없음.
- **snake→camel 일관**: `spot_count`/`last_muklog_at`(SQL) → `MyLogRow.spot_count?`/`last_muklog_at?`(`useMyLogs.ts:48-49`) → `toMyLog`가 `spotCount: row.spot_count ?? 0`·`lastMuklogAt: row.last_muklog_at ?? null`(`:67-68`) → `MyLog.spotCount: number`/`lastMuklogAt: string|null`(`:28-29`).
- **타입 정합**: int→number, timestamptz→ISO string, null 흡수 모두 일치. `MyLogRow` 두 필드가 옵셔널(`?`)이라 레거시 행 누락도 타입 안전.
- **카드 소비**: `LogCard`가 `log.spotCount`/`log.lastMuklogAt`/`log.previewPaths`를 직접 read(`LogListScreen.tsx:242-243`, 별도 바인딩 파일 없음 → 충돌 없음). `LogStatsRow`(`:159`)·`LogPhotoStrip`(`:61`)에 그대로 전달.

## 2. 집계 정확성 (PASS)
- `spot_count = (select count(*)::int from public.muklogs mk2 where mk2.room_id = r.id)`(SQL:61) = room별 muklog COUNT. `last_muklog_at = (select max(mk3.created_at) ...)`(SQL:63) = MAX(created_at).
- **테이블/컬럼명 실스키마 일치**: `public.muklogs`·`room_id`·`created_at timestamptz not null default now()` 확인(`20260611130000_muklog_list.sql:1,3,18`). dev-notes 근거 재확인 완료(추측 아님). 인덱스 `idx_muklogs_room_visited(room_id, …)`(:48-49)로 room별 집계 효율 — 추가 페치 0.
- **"마지막 기록" = created_at(timestamptz) 채택 타당**: `visited_at`은 `date`(시간 정보 없음·null 허용)라 `last_muklog_at timestamptz`/`MyLog.lastMuklogAt: ISO` 계약에 부적합. created_at이 의미상 정확.
- **0/NULL 분기**: 맛집 0 → count 0·max NULL → `MyLog{spotCount:0, lastMuklogAt:null}` → `LogCard.isEmpty`(`:199`) → 빈카드(`LogEmptyBody`). 일관.
- **DEFINER·기존 컬럼·GRANT 보존**: 직전 적용본(`20260619130000_log_preview_photos.sql`)과 1:1 비교 — 9컬럼 순서·타입·`security definer`·`set search_path = public`·preview_paths 서브쿼리·`revoke all … from public, anon`·`grant execute … to authenticated` **전부 불변**, 집계 2컬럼만 추가. DEFINER라 멤버십 RLS 우회 집계(member_count와 동일 패턴)로 전 멤버 맛집을 셈 — 의도대로.

## 3. 거짓 카운트 가드 (PASS)
- 레거시/누락 행: `?? 0`/`?? null` 폴백(`useMyLogs.ts:67-68`) → 빈카드 경로 → 거짓 숫자 노출 0. `useMyLogs.spec.ts:108-123`가 "두 키 자체 없는 레거시 행" 케이스로 고정.
- `+N` 음수 불가: `more = Math.max(0, spotCount - PHOTO_STRIP_SLOTS)`(`LogListScreen.tsx:71`). `spotCount===4`면 more=0(오버레이 없음), `spec.tsx:180-190`로 고정.
- **spotCount>0 ∧ lastMuklogAt=null 모순 불가**: count와 max가 같은 muklogs 행에서 파생, created_at은 not-null → spotCount>0이면 max는 항상 non-null. "기록 없음" 폴백(`:180`)은 레거시/비정합 데이터에서만 동작하는 안전망. 정상.

## 4. 비용 가드레일 §8 (PASS)
- 추가 페치/폴링 0: 기존 `list_my_rooms` 1회 호출에 컬럼만 추가(상관 서브쿼리), signed URL 배치(`useLogPreviewUrls`)는 기존 유지(`LogListScreen.tsx:418-419`). `useMyLogs`는 진입 1회 + refresh만(`:97-108`, 폴링 없음, spec:222-237로 고정). AWS 미사용.

## 5. 상대시간 유틸 (PASS)
- `relativeTimeLabel`(`relativeTimeLabel.ts:19-35`): 경계 오늘(days<=0)/어제(===1)/N일(<7)/N주(<28)/N개월(<365)/N년. 미래·null·파싱불가 → 안전 폴백. `now` 주입으로 결정성.
- 개월/년 `Math.max(1, …)` 클램프로 킷의 "0개월 전" 약점 보정(`:33-34`) — 의도적 개선, spec:34-36이 28일 경계를 고정.
- **테스트 load-bearing 확인(뮤테이션)**: `days===1 → '오늘'`로 변조 시 spec 2건 즉시 red("어제" 단언). 껍데기 아님.

## 6. TDD / 회귀 / 종료기준 (PASS — 직접 실행)
- `npx tsc --noEmit` → **exit 0 (0 에러)**.
- 타깃 3 spec(`useMyLogs`·`relativeTimeLabel`·`LogListScreen`) → **3 suites / 48 tests passed**.
- `npm test` 전체 → **Test Suites: 139 passed / Tests: 1259 passed** (회귀 0). dev-notes(138/1240)는 신규 home-fidelity 테스트 추가 전 수치로, 증가분만큼 정합.
- **인수조건↔테스트 대응**: AC1(useMyLogs.spec 존재/누락 2케이스 :88-123) · AC2(빈카드/스트립/+N/항상4칸 :117-191) · AC3(통계행+상대시간 :193-211, relativeTimeLabel.spec 전 경계) · AC4(헤드라인+합계 :214-239) · AC5(빈상태 히어로+두갈래+onCreate/onJoin :261-285) · AC6(tsc+full green) 모두 충족.
- **뮤테이션 표본 2건**: `spotCount ?? 0`→`?? 999` 변조 시 useMyLogs.spec 2건 red. 의미 있는 단언 확인.

## 7. 시크릿 / 컨벤션 (PASS)
- 마이그레이션·변경 코드에 비밀값 0 (password/secret/key/token/service_role 스캔 none).
- 신규 컨벤션 위반 0: `export function` 0건, 인라인 `useEffect(()=>` 0건. `useCallback`은 `LogListScreen.tsx:407`의 useFocusEffect 안정 ref 패턴 1건뿐 — **이번 스프린트 신규 아님**(LogScreen 선례, 컨벤션 허용 예외로 주석 명시). useMyLogs/relativeTimeLabel은 useCallback/useMemo 0.

---

## 비주얼 위임 (qa-visual 영역 — 로직 판정에 영향 없음)
- `MoreOverlay` 딤이 `theme.color.scrimStrong`(`rgba(0,0,0,0.32)`, tokens.ts:47) 재사용. 킷/plan 명세는 `rgba(20,12,8,.46)`(웜톤·불투명도 .46). 토큰 경유는 지켜졌으나 **시안 색/투명도 대조는 qa-visual** 판단 영역으로 위임(`LogListScreen.tsx:119`).

## 미검증 (사유 명시)
- **라이브 DB 스모크**: 로컬에 psql/supabase-cli/docker 부재로 마이그레이션 라이브 실행 불가(정상 — 사용자 전담). SQL은 정적 구조 검증(컬럼=표현식 11:11, dollar-quote, revoke/grant 보존)까지 완료. **적용 후 스모크 필요**: 맛집 있는 로그 카드 "맛집 N곳"·"마지막 기록 N일 전" 노출 / 맛집 0 로그 빈카드 / `+N` 오버레이.
- **디바이스 레이아웃 스모크**(스트립 4칸 wrap·헤어라인 렌더): 메모 [[qa-layout-blind-spot]]에 따라 레이아웃 무거운 카드라 재빌드 후 육안 권장 — 사용자 영역.
