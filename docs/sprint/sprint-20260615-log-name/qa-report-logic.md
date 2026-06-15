# QA Report — log-name (로직·통합 정합성)

> 작성: qa-logic. 범위: 통합 정합성·기능 스펙·보안/비용 가드레일·TDD·코드 컨벤션. **비주얼 충실도는 qa-visual 담당(제외).**
> 기준 문서: plan.md(§3·§5·§7·§8), dev-notes.md, integration-qa 스킬, testing-strategy.md, code-convention.md.
> 검증 방법: 경계면 생산자↔소비자 양쪽 동시 읽기 + `npm test` 전체 실행 + `tsc --noEmit` + 컨벤션 Grep + 변이(mutation) 표본.

## 종합 판정: ✅ 로직 완료 (PASS) — 발견된 결함 0건

- `npm test`: **811 passed / 107 suites green** (dev-notes 수치와 일치).
- `npx tsc --noEmit`: **0 error** (exit 0).
- 컨벤션: useCallback/useMemo 실호출 0, useEffect 인라인 0, export function 0, 파일명=심볼명 일치.
- 테스트 유의미성: 핵심 단언(displayLogName 커플 폴백) 변이 시 5개 테스트 적색 전환 확인 — load-bearing.

---

## 경계면 교차검증 (plan §7) — 전부 PASS

### #1 인자명·반환 매핑 (C-ARG) ✅
- 생산자 `rename_room(p_room_id uuid, p_name text)` (SQL:34) ↔ 소비자 `supabase.rpc('rename_room', { p_room_id: roomId, p_name: normalized })` (useRenameRoom.ts:41-44) — 인자명 정확 일치.
- 반환 `jsonb_build_object('room_id', p_room_id, 'name', v_name)` (SQL:74) ↔ 훅 매핑 `{ roomId: room_id, name }` (useRenameRoom.ts:47-51). 타입가드(`typeof === 'string'`)로 null 안전. 테스트 useRenameRoom.spec.ts:28 가 인자명·정규화 전달을 정확 단언.

### #2 에러 토큰 단일출처 ✅
- SQL raise: `NOT_AUTHENTICATED`(46) / `ROOM_NOT_FOUND`(52) / `NOT_A_MEMBER`(60) / `NAME_TOO_LONG`(68) ↔ `ROOM_ERROR_MESSAGES`(errors.ts:14·20·21·24) 4토큰 모두 매핑 존재.
- errors.spec.ts:59-74 가 키 집합을 정확히 10개로 lock(기존 9 + NAME_TOO_LONG). 정확/포함 매칭 둘 다 테스트(:77-87).

### #3 list_my_rooms / get_room 투영 ✅
- `list_my_rooms` returns table 6번째 컬럼 `name text`(SQL:98) ↔ `MyLogRow.name?`/`toMyLog`(useMyLogs.ts:38·52) `name: row.name ?? null`. 값/null/키누락 3케이스 테스트(useMyLogs.spec.ts:73-90).
- **useRoom 누락검사에 name 제외 확인**: 누락 검사 `if (!row.room_id || !row.invite_code || row.member_count == null || !row.mode)`(useRoom.ts:64)에 **name 미포함** — nullable이라 누락=정상. useRoom.spec.ts:45-59 가 "name 키 없음 → ready 유지 + name=null"을 명시 단언(BAD_RESPONSE 오판 방지 검증됨).

### #4 길이 단일출처 (C-LEN) 3중 일치 ✅
- `LOG_NAME_MAX_LENGTH = 20`(logName.ts:9) ↔ DB `char_length(v_name) > 20`(SQL:67) ↔ 입력 `maxLength={20}`(LogNameSheet.tsx:15·80). 3중 일치.
- `isLogNameTooLong`은 `[...normalized].length`(logName.ts:39) 코드포인트 카운트. 이모지 20개 false / 21개 true 테스트(logName.spec.ts:58-62).

### #5 정규화 이중 (앱↔SQL) ✅
- 앱 `normalizeLogName`: `input.trim()` 후 빈→null(logName.ts:25-28) ↔ SQL `nullif(btrim(coalesce(p_name,'')), '')`(SQL:64) — 동일 규칙. 공백만/탭·개행/내부 공백 보존 테스트(logName.spec.ts:11-35).

### #6 displayLogName 폴백 일관 (self-only) ✅
- 두 화면 모두 동일 유틸·동일 인자: LogScreen `displayLogName({ name, memberCount, selfNickname: meNickname })`(LogScreen.tsx:178) / LogList `displayLogName({ name, memberCount, selfNickname: self.nickname })`(LogListScreen.tsx:80). 둘 다 self-profile 닉만 사용 — 파트너 닉 미사용, 커플은 "짝꿍" 고정(logName.ts:71).
- 폴백 5케이스(name 우선/솔로/커플/닉부재 내로그·우리로그) 모두 테스트(logName.spec.ts:65-93, LogScreen.spec:271-282, LogListScreen.spec:189-216).
- `cardTitle`/`logTitle` 구 헬퍼 호출 잔존 0건(Grep 확인).

### #7 회귀·격리·보안 ✅
- **멤버 검증 필수**: DEFINER RLS 우회 → `NOT_A_MEMBER` 검사 존재(SQL:56-61). created_by 미검사(멤버 누구나 수정, SQL 주석 17·71). plan §결정1 정합.
- **list_my_rooms drop+recreate 회귀 0**: 기존 정의(multi_log_home.sql:176-181)는 5컬럼(room_id, mode, member_count, created_at, joined_at) — 신 정의는 동일 순서 + `name` 6번째만 추가(SQL:92-98), select·order 로직 불변. 의존 뷰/함수 0건(Grep: 정의 외 참조 없음) → drop 안전.
- **카드 탭=네비(편집 진입 없음, #8 회귀)**: LogList 카드 onPress=`navigation.navigate(Routes.LogScreen, ...)`(LogListScreen.tsx:217), 편집 진입점 없음. LogListScreen.spec:158-166 가 lock.
- 마이그레이션 additive·재실행 가능: `add column if not exists`(25)·`create or replace`·`drop function if exists`(89). 기존 마이그레이션 미수정.

### #8 비용 가드레일 (§8) ✅
- rename 성공 후 `useRoom.refresh()` **1회만**: `handleSaveName`에서 성공 경로만 `await refresh()`(LogScreen.tsx:192-200). LogScreen.spec:308-310 이 `refresh 1회` lock, 실패 시 `refresh 미호출`(:350) lock.
- LogList 자동 refresh 0(명시 호출만), Realtime 미도입, Kakao/Storage 미사용, 컬럼 1개 추가 — 전부 정합.

### #9 index.ts 공존 ✅
- developer export(useRenameRoom·LOG_NAME_MAX_LENGTH·normalizeLogName·isLogNameTooLong·displayLogName, index.ts:9-15) + ui-publisher export(LogNameSheet·LogTitleButton, :25-26) 충돌 없이 공존. 중복 export 없음. tsc green.

### #10 deviation(토스트 부재) 평가 ✅ — 인수조건 미파괴
- plan §4.2가 토스트("로그 이름을 변경했어요")를 명시하나 코드베이스에 Toast 프리미티브 부재(dev-notes §6). 대체 피드백: 성공 시 **시트 close + useRoom.refresh()로 헤더 제목 즉시 갱신**(LogScreen.tsx:194-196), 실패 시 **시트 유지 + inline error**(LogNameSheet.tsx:96-100).
- **판정**: plan §4.4 상태표가 요구하는 피드백(저장중 버튼 로딩 / 성공 시 시트 닫힘·표시명 갱신 / 실패 시 기존값 유지·에러 표시)은 모두 충족. 토스트는 "추가 확인 피드백"일 뿐 인수조건(T6: 시트 닫힘+헤더 갱신)을 깨지 않음. 피드백 존재 ✔. (토스트 프리미티브 신설은 비주얼/UX 결정 — qa-visual/오케스트레이터 판단 영역, 로직 결함 아님.)

---

## TDD·테스트 품질 ✅
- 인수조건↔테스트 대응: T1~T8 전 인수조건에 대응 spec 존재(SQL은 모킹/스모크 경계 준수 — useRenameRoom/useMyLogs/useRoom이 supabase.rpc 모킹).
- `npm test` 811 green / `tsc --noEmit` 0 error.
- 경계·실패 경로 커버: 20/21자 경계, 공백→null, 이모지 코드포인트, NAME_TOO_LONG/NOT_A_MEMBER 에러 throw, 저장 실패 시 시트 유지·refresh 미호출, saving 비활성.
- **유의미성 표본(변이)**: displayLogName 커플 폴백 `♥`→`x` 변이 시 logName/LogScreen/LogListScreen 3 suite 5 test 적색 → 단언이 load-bearing 확인. 변이 원복 완료.

## 코드 컨벤션 ✅
- useCallback/useMemo 실호출 0(주석 2건만, useMyLogs.ts:64·useRoom.ts:49).
- useEffect 인라인 0 — 명명 함수(`syncDraftOnOpen`·`loadMyLogsOnUser`·`loadRoomOnId`·`clearCompactCopied`).
- export function 컴포넌트/훅 0 — 전부 화살표 const.
- named-object 인자(normalizeLogName/isLogNameTooLong/displayLogName/renameRoom 등) 준수.
- enum-style 상수: LOG_NAME_MAX_LENGTH·COUPLE_MIN_MEMBERS·라벨 상수 `as const`성 준수(컴포넌트 수치 상수도 명명).
- 파일명=대표 심볼명: logName/useRenameRoom/LogNameSheet/LogTitleButton 모두 일치.
- 토큰 경유: LogNameSheet/LogTitleButton/LogScreen 색·radius·spacing 모두 theme 토큰. 입력 패딩/폰트(14/16/17)는 킷 컨트롤 내부 수치로 명명 상수화(raw hex 0).

## 미검증 (사유 명시 — 통과로 처리하지 않음)
- **rename_room/list_my_rooms/get_room RPC 실 DB 동작**: SQL은 단위 대상 아님(testing-strategy 경계). 정적 리뷰로 토큰·시그니처·멤버검증·정규화·길이방어 로직 정합은 확인했으나, 실 Postgres 적용(`supabase db push`)·멤버/비멤버/길이/공백 6케이스 실행은 사용자 환경 수동 스모크 필요(dev-notes §4 체크리스트). 정적 검토 한도 내 결함 없음.

---

## developer 수정 요청: 없음
경계면·로직·테스트·컨벤션 결함 0건. 토스트 부재는 로직 결함이 아니며(피드백 대체 존재, 인수조건 충족), 토스트 프리미티브 도입 여부는 qa-visual/오케스트레이터 UX 판단 사항으로 위임.
