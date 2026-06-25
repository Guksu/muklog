// src/features/profile/ProfileProvider.spec.tsx
// 본인 프로필(state/refresh)을 트리에 공유하는 context (#2 — 닉네임/아바타 변경 전파).
//   여러 소비자가 같은 단일 상태를 읽고, 한 곳의 refresh()가 모두에 반영되는지 검증.
import React from 'react';
import { Text } from 'react-native';
import { act, render, renderHook, waitFor } from '@testing-library/react-native';

// supabase 모킹 — useProfile 내부 조회 가로채기.
const maybeSingle = jest.fn();
const eq = jest.fn(() => ({ maybeSingle }));
const select = jest.fn(() => ({ eq }));
const from = jest.fn(() => ({ select }));
jest.mock('@/lib/supabase', () => ({ supabase: { from: (...a: unknown[]) => fromProxy(...a) } }));
const fromProxy = (...a: unknown[]) => from(...(a as []));

import { ProfileProvider, useProfileContext } from './ProfileProvider';

beforeEach(() => {
  maybeSingle.mockReset();
  from.mockClear();
});

describe('ProfileProvider / useProfileContext (#2)', () => {
  it('Provider 바깥에서 useProfileContext 호출 시 throw 한다', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useProfileContext())).toThrow();
    spy.mockRestore();
  });

  it('두 소비자가 같은 단일 상태를 공유한다 (조회 1회)', async () => {
    maybeSingle.mockResolvedValue({ data: { nickname: '닉A', avatar_url: 'urlA' }, error: null });

    const Consumer = () => {
      const { state } = useProfileContext();
      const nick = state.status === 'ready' ? state.profile.nickname : 'loading';
      return <Text>{nick}</Text>;
    };

    const { findAllByText } = render(
      <ProfileProvider userId="u1">
        <Consumer />
        <Consumer />
      </ProfileProvider>,
    );

    const nodes = await findAllByText('닉A');
    expect(nodes).toHaveLength(2);
    // 단일 useProfile 인스턴스 → profiles 조회는 마운트 1회.
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('refresh() 호출 시 공유 상태가 갱신돼 모든 소비자에 전파된다', async () => {
    maybeSingle.mockResolvedValueOnce({ data: { nickname: '옛닉', avatar_url: null }, error: null });

    let sharedRefresh: (() => Promise<void>) | null = null;
    const Consumer = () => {
      const { state, refresh } = useProfileContext();
      sharedRefresh = refresh;
      const nick = state.status === 'ready' ? state.profile.nickname : 'loading';
      return <Text>{nick}</Text>;
    };

    const { findByText, queryByText } = render(
      <ProfileProvider userId="u1">
        <Consumer />
      </ProfileProvider>,
    );
    await findByText('옛닉');

    maybeSingle.mockResolvedValueOnce({ data: { nickname: '새닉', avatar_url: null }, error: null });
    await act(async () => {
      await sharedRefresh!();
    });

    await waitFor(() => expect(queryByText('새닉')).not.toBeNull());
  });
});
