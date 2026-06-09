# 코드 컨벤션

> 본 프로젝트의 모든 코드는 이 컨벤션을 100% 따른다. 위반 시 즉시 수정 대상이다.
> 원본: 별도 assignment 프로젝트의 동일 컨벤션 → muklog(React Native)에 맞게 "스타일링" 항목만 조정.

## 주석 규칙

**util 함수와 커스텀 훅에는 반드시 주석을 단다.** 형식(JSDoc):

```typescript
/**
 * 입력값을 charset 기준으로 정규화한다.
 * @param raw 사용자가 입력한 원본 문자열
 * @returns 정규화된 문자열
 */
export const normalizeInviteCodeInput = ({ raw }: { raw: string }): string => { ... }
```

UI 컴포넌트는 props 타입에 JSDoc을 다는 정도면 충분. 자명한 컴포넌트는 주석 생략 가능.

## useEffect 규칙

**effect 콜백을 화살표 함수로 직접 주입하지 않는다.** 함수를 분리해 이름을 붙인다. 타이머/리스너 등 내부 콜백도 이름을 붙인다.

```typescript
// 나쁜 예
useEffect(() => {
  const id = setInterval(() => setElapsed((prev) => prev + 1), 1000);
  return () => clearInterval(id);
}, [isRunning]);

// 좋은 예
useEffect(
  function startElapsedTimer() {
    if (!isRunning) return;
    const tick = () => setElapsed((prev) => prev + 1);
    const id = setInterval(tick, 1000);
    return function stopElapsedTimer() {
      clearInterval(id);
    };
  },
  [isRunning],
);
```

이유: 디버깅 시 스택 트레이스에 함수 이름이 표시되고, 가독성이 향상된다.

> useEffect 의존성에서 함수 안정성이 필요해 보일 때 **useCallback으로 감싸지 말고**, 함수를 effect 내부로 옮기거나(내부 헬퍼) 원시 의존성(예: `userId`)만 deps에 둔다. 매 렌더 새 함수 참조가 만들어져도 deps가 원시값이면 재실행 루프가 생기지 않는다.

## 스타일링 — 원티드 토큰 (React Native)

**스타일은 원티드 디자인 토큰을 `useTheme()`로 가져와 적용한다.** raw hex/named-color/매직 넘버 색상을 하드코딩하지 않는다.

- 색·간격·타이포·radius·shadow는 전부 `theme.color.*` / `theme.spacing[n]` / `theme.typography.*` / `theme.radius.*` / `theme.shadow.*` 경유.
- 정적 스타일은 파일 하단 `StyleSheet.create`로, 토큰 의존 스타일은 인라인 배열(`style={[styles.x, { backgroundColor: theme.color.bg }]}`)로 합성한다.
- 컴포넌트별 별도 스타일 파일을 새로 만들지 않는다(같은 파일 하단 StyleSheet).
- 토큰 정의 단일 출처는 `src/theme/tokens.ts`. 값 출처는 `.claude/skills/rn-supabase-dev/references/wanted-tokens.md`.

## useCallback / useMemo 지양

**`useCallback`과 `useMemo`는 최대한 쓰지 않는다.** 기본은 일반 함수 정의와 직접 계산이다.

이유:

- 대부분의 경우 메모이제이션의 성능 이점보다 의존성 배열 관리 비용·복잡도가 더 크다.
- 잘못된/누락된 deps는 stale closure 같은 미묘한 버그를 만든다.
- 불필요한 메모이제이션은 가독성을 해치고, 정작 필요한 곳을 가린다.

```typescript
// 나쁜 예 — 불필요한 useCallback
const handlePress = useCallback(() => doSomething(id), [id]);
// 좋은 예 — 일반 함수
const handlePress = () => doSomething(id);
```

**제한적 예외 (정말 필요할 때만):**

- 참조 동일성이 실제로 요구되는 경우 — `React.memo`로 감싼 자식에 함수/객체를 props로 넘기거나, `useEffect` 의존성에서 안정성이 반드시 필요할 때.
- 프로파일링으로 **확인된** 고비용 계산(큰 리스트 가공 등).

예외로 쓸 때는 "왜 필요한지"를 주석으로 남긴다. 막연한 "성능을 위해"는 사유가 아니다.

## 함수 정의 스타일

**기본은 화살표 함수.** React 컴포넌트·커스텀 훅도 화살표 `const`로 정의한다. 일반 `function` 선언/표현식은 다음 경우에만 허용한다:

- `useEffect` 콜백·cleanup·내부 헬퍼 (위 "useEffect 규칙" 그대로)
- 그 외는 의도가 명확한 경우에만 예외 허용 (드물게)

```typescript
// 좋은 예
export const formatTime = ({ seconds }: { seconds: number }): string => { ... };
export const SplashView = () => { ... };           // 컴포넌트
export const useMembership = ({ userId }: { userId: string }) => { ... };  // 훅

// 나쁜 예 (useEffect 밖)
export function formatTime(seconds: number): string { ... }
```

## 매개변수는 항상 객체 (named arguments)

**우리가 정의하는 함수의 매개변수는 개수와 무관하게 항상 객체 형태로 받는다.** 훅·액션 함수·유틸 모두 포함.

이유:

- 인자 순서 실수에 의한 휴먼 에러를 차단한다 (특히 같은 타입 두 개 — `(size, ratio)`는 위험).
- 호출 사이트에서 매개변수의 의미가 코드만 보고도 명확해진다.
- 매개변수 추가/제거 시 호출 사이트가 깨지지 않는다.

```typescript
// 나쁜 예
export const joinRoom = (code: string) => { ... };
joinRoom('ABC123');
// 좋은 예
export const joinRoom = ({ code }: { code: string }) => { ... };
joinRoom({ code: 'ABC123' });
```

**예외 — 외부 API가 시그니처를 강제하는 곳:**

- `array.map((item, i) => ...)`, `.filter((x) => ...)`, `.reduce((acc, x) => ...)` 등 배열 콜백
- `setState((prev) => ...)` 등 React setter 콜백
- `onPress={() => ...}`, `onChangeText={(t) => ...}` 등 RN/DOM 이벤트 핸들러
- `onAuthStateChange((event, session) => ...)` 등 라이브러리가 정의한 콜백 contract
- Supabase `rpc('fn', { p_x })`처럼 외부 API의 인자 형태

React 컴포넌트의 props는 이미 객체 형태이므로 자연스럽게 부합한다.

## 도메인 식별 문자열은 enum-style 상수로

**상태(status), 종류(kind), 타입(type) 등 한정된 집합의 식별 문자열은 문자열 리터럴을 직접 비교하지 않는다.** 한 곳(`as const` 객체)에서 정의하고 동일 이름의 타입을 같이 export해 import해 쓴다.

```typescript
export const Routes = {
  Onboarding: 'Onboarding',
  RoomTabs: 'RoomTabs',
  MuklogTab: 'MuklogTab',
  MapTab: 'MapTab',
} as const;
```

> 판별 유니온의 `status`(예: `'loading' | 'authenticated' | 'error'`)처럼 타입에 이미 좁혀지고 `switch`에서 `never` 가드로 망라되는 경우는 리터럴 사용 허용(컴파일러가 오타·누락을 잡아줌).

**TypeScript `enum` 키워드는 사용하지 않는다.** `as const` 객체로 충분하다.

## 네이밍

- 컴포넌트: `PascalCase`
- 훅: `useCamelCase`
- util: `camelCase`, 동사로 시작 (e.g. `normalizeInviteCodeInput`, `mapRoomError`)
- 타입/인터페이스: `PascalCase`, 접두사 `I` 금지
- 상수: `UPPER_SNAKE_CASE` (e.g. `INVITE_CODE_LENGTH`)
- 파일명: **파일의 대표 export 심볼명과 일치시킨다.** (한 파일 = 한 대표 심볼)
  - 컴포넌트: `PascalCase.tsx` / 훅: `useCamelCase.ts` / util: `camelCase.ts`
  - 상수/타입 묶음: 대표 심볼명 `PascalCase.ts`
  - 슬라이스/세그먼트 폴더: `kebab-case`
  - 예외: 대표 심볼이 없는 묶음 파일(배럴 `index.ts` 등)은 의미 기반 허용
