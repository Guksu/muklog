# Sprint: 전역 토스트 시스템 + 상세 삭제 토스트 (sprint-20260620-global-toast)

## 단일 기능
앱 전역 토스트 인프라(`ToastProvider` + `useToastController`)를 도입하고, 기존 화면별 토스트를 이관한 뒤 **맛집 상세 삭제 성공 토스트**(킷 SPEC §5)를 정확히 띄운다.

## 왜 (문제)
- 현재 토스트는 **화면별**: `<Toast>`를 `MuklogEditor.tsx`·`LogScreen.tsx`가 각자 렌더(`useToast` 로컬 상태).
- **언마운트 레이스**: 저장(S3)·삭제는 `showToast` 직후 `goBack()` → 토스트를 띄운 화면이 즉시 언마운트 → 토스트가 안 보이거나 1프레임만 깜빡(상세 삭제는 상세에 토스트 자체가 없어 아예 불가).
- 킷은 **앱 레벨 전역 토스트**(`App()`의 `showToast`)다 → RN도 전역이 정합·정답.

## 설계
1. **`ToastProvider`**(신규, `src/components/`): 앱 루트(App.tsx 프로바이더 트리 — SafeArea/Theme 안, AuthGate/네비게이터 **바깥**)에서 단일 `<Toast>`를 렌더하고 컨텍스트로 `showToast({ message, tone })` 제공. 내부 상태는 기존 `useToast`(visible/message/tone) 재사용. Toast의 자동 사라짐 타이머는 기존대로.
2. **`useToastController()`**(신규 훅): 컨텍스트의 `showToast` 반환. 화면/라우트 어디서나 호출 → 루트의 `<Toast>`가 화면 마운트와 무관하게 표시(언마운트 레이스 해소).
3. **이관**: `MuklogEditor.tsx`(저장 토스트, S3)·`LogScreen.tsx`(위시 토스트)의 로컬 `useToast`+`<Toast>` 제거 → `useToastController` 호출로 교체. 문구·tone 불변.
4. **상세 삭제 토스트**(킷 SPEC §5): `MuklogDetailRoute.handleConfirmDelete` 성공 시 `goBack()` **전에** `showToast({ message: '먹로그를 삭제했어요', tone: 'positive' })`. 루트 토스트라 복귀한 LogScreen 위에서 표시. 실패(catch)는 토스트 없음(기존 인라인 에러 유지).

## 인수조건 (= 테스트, TDD)
- **AC1** `ToastProvider`로 감싼 트리에서 `useToastController().showToast(...)` 호출 시 단일 루트 `<Toast>`가 message/tone으로 노출. Provider 밖 사용 시 명확한 에러(개발 가드).
- **AC2** 상세 삭제 성공 → "먹로그를 삭제했어요"(positive) 토스트 + `goBack()`. 삭제 실패 → 토스트 미노출, 기존 에러 유지.
- **AC3** 이관 후 저장 토스트(신규/편집 문구)·위시 토스트가 **동일 문구·tone**으로 계속 동작(회귀 0). 화면별 `<Toast>`/로컬 `useToast` 잔존 0(전역만).
- **AC4** 토스트 표시가 화면 언마운트와 독립(루트 렌더) — 테스트로 "showToast 후 트리거 화면 언마운트해도 Toast 유지" 단언.
- **AC5** `npm test` green + `tsc --noEmit` 0. App.tsx 프로바이더 트리 변경 후에도 기존 스모크/렌더 테스트 통과.

## 경계/리스크
- **프로바이더 위치**: 네비게이터 바깥(루트)에 둬야 화면 전환과 무관히 토스트 유지. Theme 안(토큰 사용)·SafeArea 안(하단 inset). App.tsx 트리: GestureHandler→SafeArea→Theme→**ToastProvider**→Auth→AuthGate.
- 안전: provider 도입은 표시층만 — 데이터·네비 로직 불변. 위시/저장 문구·tone 보존(이관은 호출부만 교체).
- `useToast`(프리젠테이셔널 상태 훅)는 provider 내부 구현으로 유지(삭제 아님) — 외부 직접 사용처만 provider로 수렴.
- 디바이스 스모크(토스트 위치·키보드 겹침·연속 토스트)는 사용자 영역.

## 작업 목록
1. (dev, TDD) ToastProvider + useToastController + 테스트(AC1·AC4).
2. (dev) App.tsx 트리에 ToastProvider 삽입.
3. (dev) MuklogEditor·LogScreen 토스트 이관(로컬 제거 → controller), 문구·tone 불변 테스트(AC3).
4. (dev) MuklogDetailRoute 삭제 성공 토스트(AC2).
5. (qa-logic) provider↔consumer 경계·언마운트 독립·회귀 0·TDD / (qa-visual) 토스트 비주얼·문구 킷 정합.
