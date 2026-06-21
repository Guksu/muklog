# dev-notes — sprint-20260620-global-toast

앱 전역 토스트 인프라 도입 + 기존 화면별 토스트 이관 + 상세 삭제 토스트. TDD(Red→Green), 회귀 0.

## 1. ToastProvider + useToastController (AC1·AC4)

**파일:** `src/components/ToastProvider.tsx` (신규), `src/components/ToastProvider.spec.tsx` (신규), `src/components/index.ts` (export 추가).

**API 계약:**
```ts
type ShowToastInput = { message: string; tone?: ToastTone }; // ToastTone = 'neutral' | 'positive'
type ToastController = { showToast: (input: ShowToastInput) => void };

<ToastProvider>{children}</ToastProvider>          // 루트에서 children + 단일 <Toast> 렌더
const { showToast } = useToastController();          // 컨텍스트 소비. Provider 밖 호출 시 throw(/ToastProvider/)
```

**내부 구현:** 기존 프리젠테이셔널 상태 훅 `useToast`(visible/message/tone)와 `<Toast>`(자동 사라짐 타이머 2200ms)를 **그대로 재사용** — 표시층만 루트로 끌어올림. `showToast = useToast().show`를 컨텍스트 값으로 노출(useCallback 지양, 컨벤션). `<Toast>`는 `{children}` **뒤**에 렌더돼 화면 트리 바깥에서 표시된다.

**언마운트 독립 근거(AC4):** `<Toast>`가 `ToastProvider` 본문(children 형제)에서 렌더되므로, `showToast`를 호출한 트리거 컴포넌트/화면이 언마운트돼도 토스트 상태(provider의 `useToast`)와 `<Toast>` 노드는 그대로 유지된다. spec `"트리거 컴포넌트를 언마운트해도 토스트는 유지된다"`가 `setMounted(false)` 후에도 토스트 텍스트가 보임을 단언해 검증.

**Provider 밖 가드:** `useContext === null`이면 `useToastController()는 <ToastProvider> 트리 안에서만 호출할 수 있습니다.` throw (ThemeProvider 패턴 동일).

## 2. 프로바이더 트리 위치 (AC5)

**파일:** `App.tsx`.

트리(바깥→안): `GestureHandlerRootView → SafeAreaProvider → ThemeProvider → ToastProvider → AuthProvider → StatusBar/AuthGate`.
- ToastProvider가 **AuthProvider/AuthGate(=네비게이터) 바깥** → 화면 전환·언마운트와 무관히 루트 단일 `<Toast>` 유지(언마운트 레이스 해소).
- **SafeArea/Theme 안** → Toast가 `useTheme()` 토큰·하단 inset 사용 가능.

**테스트 인프라:** `src/test/renderWithTheme.tsx`도 동일 순서로 `ToastProvider`를 포함(SafeArea→Theme→ToastProvider). 이관된 화면 spec이 추가 래핑 없이 `useToastController` + 루트 `<Toast>` 노출을 그대로 검증한다. (Provider-밖 throw 검증 테스트만 순수 `render` 사용.)

## 3. 이관 — 생산자(트리거) ↔ 소비자(루트 Toast) 매핑 (AC3, 회귀 0)

이관은 **호출부만 교체**, 문구·tone 불변. 화면별 `<Toast>`/로컬 `useToast` 잔존 0(grep 확인 — 매치는 주석뿐, JSX/호출 0).

| 화면 | 트리거(전) | 트리거(후) | 문구 / tone (불변) |
|------|-----------|-----------|--------------------|
| `MuklogEditor.tsx` 저장(작성) | 로컬 `useToast().show` + `<Toast>` | `useToastController().showToast` | `맛집을 기록했어요! 🍽️` / positive |
| `MuklogEditor.tsx` 저장(편집) | 〃 | 〃 | `기록을 수정했어요` / positive |
| `LogScreen.tsx` 위시 추가 | 로컬 `useToast().show` + `<Toast>` | `useToastController().showToast` | `위시리스트에 담았어요 📍` / positive |
| `LogScreen.tsx` 예약삭제 취소 실패 | 〃 | 〃 | `mapRoomError(...)` / neutral |

각 화면 하단의 `<Toast {...toast} onHide={hideToast} />` 제거(주석으로 전역 이관 명시). import에서 `Toast, useToast` → `useToastController`로 교체.

## 4. 상세 삭제 토스트 (AC2)

**파일:** `src/navigation/screens/MuklogDetailRoute.tsx`.

`handleConfirmDelete` 성공 경로: `deleteMuklog(...)` 성공 → `showToast({ message: '먹로그를 삭제했어요', tone: 'positive' })` → `navigation.goBack()`. 전역 토스트라 goBack 직전 show해도 복귀한 LogScreen 위에서 표시(킷 SPEC §5). 실패(catch)는 토스트 없음 — 기존 `deleteError` 인라인 유지(불변).

배선 검증: spec에서 `@/components` 모킹(`useToastController: () => ({ showToast: mockShowToast })`)으로 성공 시 `mockShowToast`가 `{ message:'먹로그를 삭제했어요', tone:'positive' }`로 호출됨 + 실패 시 `mockShowToast` 미호출·`goBack` 미호출을 단언.

## 5. 회귀 0 근거

- `useToast.ts`(프리젠테이셔널 상태 훅)·`Toast.tsx`(프리젠테이셔널 컴포넌트)·`index.ts`의 `useToast` export **불변** — provider 내부 구현으로 재사용, 외부 직접 사용처만 provider로 수렴.
- 이관은 트리거 호출부 교체뿐 — 데이터·네비 로직, 문구, tone 모두 보존.
- 기존 toast-노출 단언 spec(`MuklogEditor.spec`·`LogScreen.spec`)은 `renderWithTheme`가 ToastProvider를 포함해 그대로 green.

## 6. 테스트 / tsc 결과

```
npm test → Test Suites: 140 passed, 140 total / Tests: 1272 passed, 1272 total
npx tsc --noEmit → EXIT 0 (오류 0)
```
(act 경고는 Toast 진입 애니메이션 기존 노이즈 — 실패 아님.)

## 7. 변경 파일

- 신규: `src/components/ToastProvider.tsx`, `src/components/ToastProvider.spec.tsx`
- 수정: `src/components/index.ts`, `src/test/renderWithTheme.tsx`, `App.tsx`,
  `src/features/muklog/MuklogEditor.tsx`, `src/navigation/screens/LogScreen.tsx`,
  `src/navigation/screens/MuklogDetailRoute.tsx`, `src/navigation/screens/MuklogDetailRoute.spec.tsx`

## 8. 미완 / 사용자 영역

- 디바이스 스모크(토스트 하단 위치·키보드 겹침·연속 토스트 큐잉)는 사용자 영역(plan §경계). 현재는 단일 토스트 — 빠른 연속 호출 시 마지막 메시지로 갱신(기존 useToast 동작 유지).
