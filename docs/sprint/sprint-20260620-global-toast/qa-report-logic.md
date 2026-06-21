# QA Report — Logic / Integration (sprint-20260620-global-toast)

검증자: qa-logic · 일자: 2026-06-21 · 범위: 로직·통합 정합성·TDD·컨벤션(비주얼 제외)
판정: **로직 통과 (PASS)** — AC1~AC5 전부 충족, 경계면 불일치 0, 신규 코드 컨벤션 위반 0.

---

## 종료 기준 (직접 실행 재확인)

| 항목 | 결과 |
|------|------|
| `npx tsc --noEmit` | **EXIT 0** (오류 0) |
| `npm test` | **140 passed / 140 total · 1272 passed / 1272 total** (5.3s) |

dev-notes §6의 수치(140 suites / 1272 tests, tsc 0)와 일치. App.tsx 트리·renderWithTheme 변경 후에도 기존 스모크/렌더 스위트 전부 green.

---

## 경계면 교차검증 (양쪽 동시 읽기)

### 1. provider ↔ consumer 계약 (AC1) — 통과
- 생산자 `ToastProvider.tsx:24-37`: `useToast()`(visible/message/tone)를 재사용, `controller = { showToast: show }`를 컨텍스트로 노출, `{children}` **뒤**에 단일 `<Toast {...toast} onHide={hide} />` 렌더(`:34`).
- 소비자 `useToastController()` `:43-49`: `useContext===null`이면 `throw new Error('useToastController()는 <ToastProvider> 트리 안에서만…')`. ThemeProvider 동일 패턴.
- 계약 shape `ShowToastInput = { message; tone? }`(`:13`)가 `useToast.show`의 인자(`useToast.ts:18`)와 1:1. 세 소비처(`MuklogEditor.tsx:347,375`·`LogScreen.tsx:318,474`·`MuklogDetailRoute.tsx:85`) 모두 `{ message, tone }` 객체로 호출 — named-args 일치.
- spec `ToastProvider.spec.tsx`: 초기 미표시·showToast 노출(`:39`)·positive ✓(`:51`)·자동사라짐 2200ms(`:64`)·언마운트 독립(`:78`)·Provider 밖 throw(`:109`). **load-bearing 확인**: 루트 `<Toast>` 렌더를 제거하면 6건 중 4건 red(아래).

### 2. App.tsx 트리 위치 — 통과
- `App.tsx:73-86`: `GestureHandlerRootView → SafeAreaProvider → ThemeProvider → ToastProvider → AuthProvider → AuthGate`. plan §경계·dev-notes §2 명세와 정확히 일치.
- ToastProvider가 **AuthProvider/AuthGate(=네비게이터) 바깥** → 화면 전환·언마운트와 무관히 단일 루트 `<Toast>` 유지. **Theme 안**(토큰)·**SafeArea 안**(하단 inset). 위치 정합.
- `renderWithTheme.tsx:19-25`: 실제 트리와 동일 순서(SafeArea→Theme→ToastProvider)로 ToastProvider 포함 → 이관된 화면 spec이 추가 래핑 없이 루트 `<Toast>`를 그대로 노출. Provider-밖 throw 테스트만 순수 `render`(`ToastProvider.spec.tsx:114`) — 적정.

### 3. 언마운트 독립 (AC4) — 통과 (load-bearing 확인)
- `ToastProvider.spec.tsx:78-107`: `Host`가 `showToast(...)` 직후 `setMounted(false)`로 트리거를 언마운트. 단언 `:105` 트리거 텍스트 null + `:106` 토스트 텍스트 `getByText('먹로그를 삭제했어요')` 존속. → showToast→goBack 레이스 논리적 해소 검증.
- **변이 테스트**: `ToastProvider.tsx:34`의 `<Toast …/>`를 제거하면 `ToastProvider.spec.tsx` **4 failed / 2 passed**(`:106` 포함 red). 단언이 실제 부하를 받는다(껍데기 아님).

### 4. 상세 삭제 토스트 (AC2) — 통과 (load-bearing 확인)
- `MuklogDetailRoute.tsx:76-90`: 성공 경로에서만 `deleteMuklog()` await 성공 → `showToast({ message:'먹로그를 삭제했어요', tone:'positive' })`(`:85`) → `navigation.goBack()`(`:86`). catch(`:87-89`)는 토스트·goBack 없음, 기존 `deleteError` 인라인 유지(주석 명시).
- spec `MuklogDetailRoute.spec.tsx`: `@/components` 모킹으로 `mockShowToast`(`:42-43`). 성공 시 `{message,tone}` 호출 + goBack(`:204-217`), 실패 시 `mockShowToast`·`mockGoBack` **미호출**(`:219-231`).
- **변이 테스트**: catch 블록에 showToast+goBack을 추가하면 실패-경로 테스트(`:229` goBack 미호출 단언) red(**1 failed / 13 passed**). 실패 경로 단언이 load-bearing.

### 5. 이관 회귀 0 (AC3) — 통과
- **잔존 0 (grep 전수)**: 앱 코드에서 비주석 `<Toast>` 렌더는 `ToastProvider.tsx:34` **단 1곳**(나머지는 spec/주석). `useToast`(non-controller) 참조는 `ToastProvider.tsx` + `useToast.ts`/`useToast.spec.ts`/`Toast.tsx` 주석/index export뿐 — 세 화면(MuklogEditor·LogScreen·MuklogDetailRoute)에 로컬 `useToast`/`<Toast>` 0건.
- **import 교체 확인**: 세 화면 모두 `@/components`에서 `useToastController`만 임포트(`MuklogEditor.tsx:21`·`LogScreen.tsx:38`·`MuklogDetailRoute.tsx:22`). `Toast`/`useToast` 직접 임포트 없음.
- **문구·tone 불변**:
  - MuklogEditor 작성 `맛집을 기록했어요! 🍽️`/positive(`:70,375`), 편집 `기록을 수정했어요`/positive(`:71,347`) — 성공 경로에서만 show, catch는 미호출.
  - LogScreen 위시 `위시리스트에 담았어요 📍`/positive(`:79,318`), 예약취소 실패 `mapRoomError(...)`/neutral(`:474`).
  - 회귀 spec은 **실제 ToastProvider 경유**(`MuklogEditor.spec.tsx:643-680` renderWithTheme로 루트 `<Toast>` 텍스트 직접 단언; 성공=노출, 실패=`queryByText(...).toBeNull()`). 모킹이 아닌 통합 검증이라 AC3·AC4를 동시에 보증.
- `useToast.ts`·`Toast.tsx`·`index.ts`의 `useToast` export **불변**(provider 내부 재사용) — 회귀 표면 0.

### 6. 보안·컨벤션 — 통과
- 시크릿 미접근. 신규/수정 파일에 `useCallback`/`useMemo` 실호출 0(`ToastProvider.tsx:27`·`App.tsx:61`은 주석뿐). 컴포넌트·훅 화살표 const, named-args, `<Toast>` 자동타이머 useEffect는 기명 함수(`Toast.tsx:47 animateIn`/`:57 autoHide`, 기존). 파일명=심볼명.

---

## 이슈

없음(블로킹). 아래는 **이번 스프린트 범위 밖 기존 사항**으로 참고만.

- (info, out-of-scope) `MuklogDetailRoute.tsx:53` `React.useCallback`(useFocusEffect 참조 안정용) — commit `b86ba45`의 기존 코드로 이번 스프린트가 도입하지 않음. `LogScreen.tsx:260`도 동일 패턴(주석으로 "useFocusEffect 예외 케이스" 명시). 컨벤션 예외 처리가 일관되며 본 스프린트와 무관.

---

## 미검증 (사용자 영역, plan §경계 명시)
- 디바이스 스모크: 토스트 하단 위치·키보드 겹침·연속 토스트 큐잉(현재 단일 토스트=마지막 메시지로 갱신). RN 단위 테스트 경계 밖.
- 비주얼 충실도(토스트 pill·✓·카피 킷 정합)는 **qa-visual** 담당.

## 종합 판정
**로직 통과.** AC1~AC5 전부 충족, provider↔consumer·App 트리·언마운트 독립·삭제 성공/실패 분기·이관 회귀 0 모두 경계면 양쪽 확인. 핵심 단언 2종(AC4 언마운트 독립·AC2 실패 경로) 변이로 load-bearing 확인. `tsc 0` + `npm test 1272 green` 직접 재현. 신규 코드 컨벤션 위반 0.
