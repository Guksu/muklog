# Sprint: 홈 화면 구조 정합 (sprint-20260620-home-fidelity)

## 단일 기능
홈(먹로그 탭) 화면을 디자인 킷(SSOT) `mk-home.jsx`의 `LogListScreen`/`LogCard`/`EmptyLogs`에 정합시킨다. 인사 헤드라인, 로그 카드(사진 4칸 스트립+`+N`+통계행+빈카드), 로그 0개 빈 상태(히어로+두 갈래 카드)를 모두 재현한다.

> 범위: 홈 탭 한 화면. 지도/에디터/상세/프로필/초대카피는 후속(S3~S7). 컬러·radius·간격 토큰은 변경 없음(폰트는 S1 완료).

## 핵심 사실(정찰 결과)
- `MyLog.previewPaths`가 이미 **최근 사진 4장**(storage_path) 반환, `useLogPreviewUrls`가 signed URL 발급 → **사진 4칸 스트립은 데이터 있음(퍼블리싱)**.
- `list_my_rooms` DEFINER RPC는 **맛집 수·마지막 기록 시각을 반환 안 함** → 통계행/`+N`/홈 서브카피 합계는 **RPC 집계 추가 필요(developer)**.
- 현재 RN(`LogListScreen.tsx`)은 데이터 부재 가정으로 단순화: 커버 1장·통계 없음·헤드라인 없음·빈카드 없음·단순 빈상태.

## 설계 결정 (킷 기준, 거짓 카운트 우려 → 실집계로 해소)
1. **`list_my_rooms` RPC에 집계 2컬럼 추가** (신규 마이그레이션 파일, 적용본은 신규 파일로 교체 — 메모 [[definer-storage-and-best-effort]] 정책):
   - `spot_count int` — 해당 room의 muklog(맛집) 총 개수.
   - `last_muklog_at timestamptz` (nullable) — 가장 최근 muklog의 기록 시각(없으면 null).
   - DEFINER 유지(멤버십 RLS 우회 집계). 기존 컬럼·시그니처 보존, 추가만.
2. **`MyLog` 타입 확장**: `spotCount: number`(기본 0), `lastMuklogAt: string | null`(ISO). `toMyLog` 매핑·`MyLogRow` 타입에 `spot_count`/`last_muklog_at` 흡수(누락 → 0/null).
3. **사진 스트립(킷 mk-home:74-91 재현, RN 적응)**: 가로 4칸 `flex:1 aspectRatio:1 gap:7`.
   - 채움: `previewPaths` 순서대로 signed URL 썸네일(실사진). 킷은 카테고리 커버지만 RN은 실사진 우선(더 충실).
   - 빈 슬롯: 사진이 4칸 미만이면 점선 빈 슬롯(`fill-alt` 배경 + `1px dashed line`)으로 4칸 채움.
   - `+N`: `more = max(0, spotCount - 4)`. `more > 0`이면 **4번째 슬롯**에 `rgba(20,12,8,.46)` 딤 + `+{more}`(800/17 흰색). 4번째가 사진이면 그 위 오버레이, 빈 슬롯이면 딤 박스.
4. **통계행(킷 mk-home:92-99)**: 상단 헤어라인(`1px hairlineAlt`) + 좌 `location` 아이콘(primary,15) + "맛집 {spotCount}곳"(`spotCount` 토큰) / 우 "마지막 기록 {상대시간}"(`meta`, fgMuted). 상대시간 = `lastMuklogAt` 기준 mkAgo 동등 포맷(오늘/어제/N일 전/N주 전/N개월 전/N년 전). `lastMuklogAt` null이면 통계행 우측 생략 또는 "기록 없음" — **단, spotCount=0이면 통계행 대신 빈카드(아래 5)**.
5. **빈 카드(킷 mk-home:63-71)**: `spotCount === 0`이면 사진 스트립·통계행 대신 점선 박스(🍽️ 배지 40/radius12/accentWeak + "아직 기록한 맛집이 없어요"(700/14) / "이 로그를 열어 첫 맛집을 남겨보세요"(500/12.5, fgMuted) + plus 아이콘).
6. **인사 헤드라인(킷 mk-home:116-122)**: 리스트 상단 `ListHeaderComponent` 교체 — "{닉}님, 오늘은\n어디 다녀왔어요?"(emptyTitle급 800/22) + "지금까지 함께 **{전 로그 spotCount 합}곳**을 기록했어요"(합계 강조 accentStrong/800). 현재 한 줄 캡션 제거.
7. **빈 상태 onboarding(킷 mk-home:136-181)**: `EmptyLogs` 교체 — 인사("{닉}님,\n먹로그를 시작해볼까요?") + 본문 + **히어로 비주얼**(그라데이션 박스 172h: 아바타+💕+🙂 + 음식 이모지 핀 4개) + **두 갈래 SheetAction 카드**("새 로그 만들기 🥢" / "초대코드로 입장 💌"). 현재 🍜+단일버튼 제거.
   - 히어로 그라데이션 `linear-gradient(150deg,#EAF0FF→#FFE7DD)`는 신규 토큰(`heroGradient`) — expo-linear-gradient.
   - "초대코드로 입장" 탭 → JoinScreen 네비(현 onCreate만 있음 → onJoin 추가).

## 컴포넌트 prop 계약 (publisher↔developer 병렬 경계)
- `MyLog`(developer 소유, useMyLogs.ts): `+ spotCount: number; + lastMuklogAt: string | null`.
- `LogCard`(publisher 소유, LogListScreen.tsx): props `{ log: MyLog; self; previewUrls: Record<string,string>; onPress }`. **`log.spotCount`·`log.lastMuklogAt`·`log.previewPaths`를 직접 읽는다**(별도 binding 파일 없음 → 파일 충돌 없음).
- 파일 분담(병렬 무충돌): **publisher = LogListScreen.tsx + theme 토큰(heroGradient) + 필요 시 신규 프리미티브** / **developer = useMyLogs.ts + 마이그레이션 SQL + useMyLogs.spec.ts**.

## 인수조건 (= 테스트, TDD)
- **AC1** `list_my_rooms`가 `spot_count`·`last_muklog_at` 반환(마이그레이션 SQL 존재). useMyLogs.spec: RPC 행에 두 필드 있을 때/없을 때(레거시) `toMyLog`가 `spotCount`(숫자/0)·`lastMuklogAt`(ISO/null)로 매핑.
- **AC2** LogCard: `spotCount>0`이면 스트립+통계행, `===0`이면 빈카드. `spotCount>4`면 4번째 슬롯 `+{spotCount-4}` 오버레이. previewPaths<4면 점선 빈 슬롯으로 4칸. (RN Testing Library 단언)
- **AC3** 통계행 "맛집 {spotCount}곳" + "마지막 기록 {상대시간}"이 `lastMuklogAt`에서 파생. 상대시간 포맷 유틸 단위테스트(오늘/어제/N일 전/N주/N개월/N년).
- **AC4** 인사 헤드라인 "{닉}님, 오늘은 어디 다녀왔어요?" + 합계 "함께 {ΣspotCount}곳" 렌더.
- **AC5** 빈 상태: 히어로 + 두 갈래 카드(새 로그 만들기/초대코드로 입장) 렌더, 각 onPress(onCreate/onJoin) 동작.
- **AC6** `npm test` 전체 green + `npx tsc --noEmit` 0 에러. 회귀 0.

## 엣지/리스크
- **거짓 카운트 금지**: 통계·합계·+N은 RPC 실집계만 사용. 데이터 미준비(레거시 RPC) 시 `spotCount=0` → 빈카드로 안전 폴백(거짓 숫자 노출 0).
- previewPaths(사진) vs spotCount(맛집) 비대칭: 사진 0인데 맛집>0 가능 → 스트립은 점선 빈 슬롯, 통계는 실 spotCount. 모순 표기 없음.
- 마이그레이션은 **신규 파일**로 추가(기존 적용본 직접 수정 금지). RLS·DEFINER 권한 영향 qa-logic 점검.
- 비용 가드레일 §8: 추가 페치 없음(기존 RPC 1회에 컬럼만 추가, signed URL 배치 기존 유지). 폴링 0.
- 마이그레이션 라이브 적용은 **사용자 전담**(에이전트는 SQL 파일 작성·로컬 검증까지). git·DB push 금지.
- 디바이스 스모크(스트립 wrap·헤어라인 렌더)는 사용자 영역 — 메모 [[qa-layout-blind-spot]] 따라 레이아웃 무거운 카드라 재빌드 후 육안 권장.

## 작업 목록
1. (dev) `list_my_rooms` 마이그레이션 신규 파일(spot_count·last_muklog_at 집계) + 로컬 SQL 검증. MyLog 타입·매핑·spec(TDD).
2. (pub) 상대시간 유틸(mkAgo 동등) + LogCard(스트립/+N/통계/빈카드) + 인사 헤드라인 + EmptyLogs(히어로/두갈래) + heroGradient 토큰 + ui-spec.md.
3. (pub∥dev 병렬, 계약 기준) → 완료 후 qa-visual(킷 충실도) ∥ qa-logic(RPC↔매핑↔카드 경계면·집계 정확·가드레일·TDD).
