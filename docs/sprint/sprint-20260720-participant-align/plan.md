# Sprint 20260720 — participant-align (로그 상세 참여자 블록 ↔ "우리 맛집" 라인 정합)

> 작성: 오케스트레이터(리더) 직접 — 소형 비주얼 수정 부분 재실행 모드(planner 생략).
> 사용자 요청: "로그 상세의 참여자 UI가 우리 맛집 타이틀과 라인이 맞지 않아 맞게 해줘."

## 1. 문제와 근본 원인 (이중 패딩)

- `MuklogList.tsx:57` ScrollView `contentContainerStyle={{ padding: spacing[20] … }}` — "우리 맛집" 섹션 헤더는 이 패딩 안(화면 기준 좌 20px).
- `MuklogList.tsx:60` 헤더 슬롯 `{header}`도 같은 패딩 안에 렌더되는데, 주입되는
  `ParticipantBlock.tsx:48`이 킷(mk-log:81 `padding: "12px 20px 2px"`)을 자체 재현해 `paddingHorizontal: spacing[20]`을 또 가짐.
- 결과: 참여자 블록만 화면 기준 좌 40px → "우리 맛집"(20px)과 세로 라인 불일치.

## 2. 킷 기준 (단일 출처 mk-log.jsx)

- 참여자 섹션(mk-log:81): `padding: "12px 20px 2px"` — 화면 기준 좌우 20.
- "우리 맛집" 섹션 헤더(mk-log:109): `padding: "16px 20px 10px"` — 화면 기준 좌우 20.
- 즉 두 요소는 **같은 20px 그리드 라인**에 정렬되어야 한다.

## 3. 인수조건

- AC1: 참여자 블록("참여자 N" 텍스트·첫 아바타 좌단)이 "우리 맛집" 타이틀과 화면 기준 동일 x(20px)에서 시작.
- AC2: 수직 리듬 킷 정합 — 세그먼트 아래 참여자 블록 상단 간격이 킷(12px)과 일치(이중 상단 패딩도 함께 점검).
- AC3: ParticipantBlock 단독 렌더 계약(테스트)과 LogScreen 주입 경로 모두 회귀 없음.
- AC4: 수정은 토큰만 사용(raw 수치 하드코딩 금지), 소비처 데이터 배선 불변.

## 4. 스코프

- 대상: `MuklogList.tsx`(헤더 슬롯 래퍼) 그리고/또는 `ParticipantBlock.tsx` 패딩 소유권 조정 — 방식은 ui-publisher가 킷 근거로 결정(예: 헤더 래퍼 negative margin, 또는 블록 패딩을 주입부로 이관).
- 제외: 참여자 데이터·초대 로직, 다른 화면.

## 5. 종료 기준

`npm test` + `tsc --noEmit` 통과, qa-report-visual.md 통과. git 작업은 사용자 전담.
