# 테스트 구현 참조 (TDD · Jest/jest-expo · RN/Expo)

`docs/testing-strategy.md`의 전략을 코드로. **기본은 TDD(Red→Green→Refactor), 러너는 jest-expo.**

## 1. 셋업 (최초 1회)

```bash
npx expo install jest-expo
npm i -D jest @testing-library/react-native @types/jest
```

`package.json`:
```json
{
  "scripts": { "test": "jest", "test:watch": "jest --watch" },
  "jest": {
    "preset": "jest-expo",
    "setupFilesAfterEnv": ["<rootDir>/jest.setup.ts"],
    "transformIgnorePatterns": [
      "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@react-navigation/.*|@supabase/.*))"
    ]
  }
}
```

`jest.setup.ts` — 공통 모킹(필요 시):
```ts
// 네이티브 전용 모듈 모킹 예시
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn().mockResolvedValue(undefined) }));
```

> 파일명은 콜로케이션 `*.spec.ts(x)`. 외부 SDK(Supabase/Kakao/expo)는 모킹.

## 2. 순수 유틸 (가장 먼저, ROI 최고)

```ts
// src/features/room/code.spec.ts
import { normalizeInviteCodeInput, isInviteCodeComplete } from './code';

describe('normalizeInviteCodeInput', () => {
  it('대문자화 + 혼동문자(0,O,1,I)·공백 제거 + 6자 컷', () => {
    expect(normalizeInviteCodeInput({ raw: ' ab0o1i cdefg ' })).toBe('ABCDEF');
  });
});
describe('isInviteCodeComplete', () => {
  it('6자일 때만 true', () => {
    expect(isInviteCodeComplete({ code: 'ABCDE' })).toBe(false);
    expect(isInviteCodeComplete({ code: 'ABCDEF' })).toBe(true);
  });
});
```

`errors.ts`도 토큰 5종 + 기본 메시지 + 포함매칭을 각각 단언.

## 3. 훅 (supabase 모킹 + renderHook)

```ts
// src/features/room/useJoinRoom.spec.ts
import { renderHook, act } from '@testing-library/react-native';

jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));
import { supabase } from '@/lib/supabase';
import { useJoinRoom } from './useJoinRoom';

const rpc = supabase.rpc as jest.Mock;
beforeEach(() => rpc.mockReset());

it('성공 시 room_id(snake) → roomId(camel) 매핑', async () => {
  rpc.mockResolvedValueOnce({ data: { room_id: 'r1' }, error: null });
  const { result } = renderHook(() => useJoinRoom());
  let res;
  await act(async () => { res = await result.current.joinRoom({ code: 'ABCDEF' }); });
  expect(res).toEqual({ roomId: 'r1' });
});

it('INVALID_CODE 토큰 → 한국어 메시지를 error에 세팅', async () => {
  rpc.mockResolvedValueOnce({ data: null, error: new Error('INVALID_CODE') });
  const { result } = renderHook(() => useJoinRoom());
  await act(async () => {
    await expect(result.current.joinRoom({ code: 'ZZZZZZ' })).rejects.toBeTruthy();
  });
  expect(result.current.error).toBe('초대코드를 다시 확인해 주세요.');
});
```

> `useMembership`은 `from('room_members').select().eq().maybeSingle()` 체이닝을 모킹해 in-room/no-room/error 분기 검증.

## 4. 화면 (render + 상호작용 + 훅 모킹)

```tsx
// src/navigation/screens/OnboardingScreen.spec.tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
// useCreateRoom/useJoinRoom/useMembershipContext/네비게이션을 모킹하고,
// "초대코드 입력" → 6자 입력 → "입장" 클릭 시 joinRoom({code}) 호출 / 에러 메시지 노출을 검증.
```

> ThemeProvider 필요 컴포넌트는 `renderWithTheme`(<ThemeProvider>로 감쌈) 헬퍼를 만든다.

## 5. 경계 (테스트하지 않는 것)

- SQL/RPC/RLS/트리거 자체는 단위 아님 → 클라 측은 **모킹된 응답/에러**로 계약만. 실 DB는 사용자 스모크.
- 외부 SDK 내부 동작 검증 금지 — 우리의 호출·매핑·에러 처리만.

## 6. TDD 사이클

1. plan.md 인수조건 1개 → 실패 테스트 작성(Red), `npm test` 빨강 확인.
2. 최소 구현(Green).
3. 리팩터(컨벤션 정합 포함), 초록 유지.
4. 반복. 끝나면 `npm test` 전체 green + `npx tsc --noEmit`.
