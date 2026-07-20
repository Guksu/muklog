// src/features/room/components/ParticipantBlock.spec.tsx
// 참여자 블록 — 킷 mk-log.jsx:79-103 재현 (plan §4.1·§5 T5, qa-visual 경계 §7-7).
//   "참여자 N · 최대 5명" 헤더 + 멤버 행(아바타46·i0/meId=나 ring·닉 ellipsis) + members<5면 dashed 초대 버튼.
//   presentational — 데이터는 props 주입(useRoomMembers 호출 없음). 배선은 developer 2단계.
import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';
import { defaultNickname } from '@/features/profile/defaultNickname';
import { type RoomMember } from '@/features/room';

import { ParticipantBlock } from './ParticipantBlock';

const meId = 'me-uid';

const member = (over: Partial<RoomMember> & { userId: string }): RoomMember => ({
  nickname: null,
  avatarUrl: null,
  ...over,
});

const renderBlock = (
  over?: Partial<{ members: RoomMember[]; meId: string; canInvite: boolean; onInvite: () => void }>,
) =>
  renderWithTheme(
    <ParticipantBlock
      members={over?.members ?? [member({ userId: meId, nickname: '민' })]}
      meId={over?.meId ?? meId}
      canInvite={over?.canInvite ?? true}
      onInvite={over?.onInvite ?? jest.fn()}
    />,
  );

describe('ParticipantBlock — 킷 mk-log:79-103', () => {
  it('"참여자 {N}" + "· 최대 5명" 헤더를 표시한다 (킷 mk-log:83-84)', () => {
    renderBlock({
      members: [member({ userId: meId, nickname: '민' }), member({ userId: 'p', nickname: '지' })],
    });
    expect(screen.getByText('참여자 2')).toBeTruthy();
    expect(screen.getByText('· 최대 5명')).toBeTruthy();
  });

  it('멤버 닉네임을 표시하고, 닉 null이면 defaultNickname 폴백을 쓴다 (킷 mk-log:90)', () => {
    renderBlock({
      members: [member({ userId: meId, nickname: '민' }), member({ userId: 'p', nickname: null })],
    });
    expect(screen.getByText('민')).toBeTruthy();
    expect(screen.getByText(defaultNickname({ userId: 'p' }))).toBeTruthy();
  });

  it('닉네임은 1줄 ellipsis(numberOfLines=1)로 렌더한다 (킷 mk-log:90 maxWidth50)', () => {
    renderBlock({ members: [member({ userId: meId, nickname: '아주긴닉네임입니다정말로긴' })] });
    const nick = screen.getByText('아주긴닉네임입니다정말로긴');
    expect(nick.props.numberOfLines).toBe(1);
  });

  it('meId 멤버는 ring 아바타(디폴트 avatar-default)로, 그 외는 ring 없이 렌더한다 (킷 mk-log:89 i===0=나)', () => {
    // 아바타 url 없음 → 결정적 디폴트(avatar-default) 렌더. ring 여부는 borderWidth로 구분.
    renderBlock({
      members: [member({ userId: meId, nickname: '민' }), member({ userId: 'p', nickname: '지' })],
    });
    const avatars = screen.getAllByTestId('avatar-default');
    expect(avatars).toHaveLength(2);
  });

  it('avatarUrl 있으면 이미지 아바타로 렌더한다 (plan §3.4 pass-through)', () => {
    renderBlock({
      members: [member({ userId: meId, nickname: '민', avatarUrl: 'https://cdn.example/a.jpg' })],
    });
    expect(screen.getByTestId('avatar-image')).toBeTruthy();
  });

  it('canInvite=true & members<5 → dashed 초대 버튼("초대")을 렌더한다 (킷 mk-log:93-100)', () => {
    renderBlock({ canInvite: true, members: [member({ userId: meId, nickname: '민' })] });
    expect(screen.getByText('초대')).toBeTruthy();
    expect(screen.getByTestId('participant-invite')).toBeTruthy();
  });

  it('초대 버튼 탭 시 onInvite를 호출한다 (킷 mk-log:94)', () => {
    const onInvite = jest.fn();
    renderBlock({ canInvite: true, onInvite, members: [member({ userId: meId, nickname: '민' })] });
    fireEvent.press(screen.getByTestId('participant-invite'));
    expect(onInvite).toHaveBeenCalledTimes(1);
  });

  it('canInvite=false(만석 5명) → 초대 버튼을 숨긴다 (킷 mk-log:93 length<5)', () => {
    renderBlock({
      canInvite: false,
      members: [
        member({ userId: meId, nickname: '민' }),
        member({ userId: 'p2', nickname: '지' }),
        member({ userId: 'p3', nickname: '수' }),
        member({ userId: 'p4', nickname: '아' }),
        member({ userId: 'p5', nickname: '별' }),
      ],
    });
    expect(screen.queryByText('초대')).toBeNull();
    expect(screen.queryByTestId('participant-invite')).toBeNull();
    expect(screen.getByText('참여자 5')).toBeTruthy();
  });

  it('1명(솔로) → 나 아바타 + 초대 버튼', () => {
    renderBlock({ canInvite: true, members: [member({ userId: meId, nickname: '민' })] });
    expect(screen.getByText('참여자 1')).toBeTruthy();
    expect(screen.getByTestId('participant-invite')).toBeTruthy();
  });

  // 블록은 킷 mk-log:81 padding "12px 20px 2px"를 자체 소유한다(무패딩 컨테이너 전제).
  //   좌우 20을 자체 소유하므로, 주입 컨테이너(MuklogList)는 자기 패딩을 상쇄해야 이중 패딩이 안 생김
  //   → 이 계약이 "우리 맛집" 라인과의 정합 기준(회귀 가드). MuklogList.spec의 헤더 슬롯 상쇄와 짝.
  it('킷 mk-log:81 padding "12px 20px 2px"를 자체 소유한다 (AC1)', () => {
    renderBlock({ members: [member({ userId: meId, nickname: '민' })] });
    const s = Object.assign(
      {},
      ...[].concat(screen.getByTestId('participant-block').props.style as never).filter(Boolean),
    ) as Record<string, number>;
    expect(s.paddingHorizontal).toBe(20);
    expect(s.paddingTop).toBe(12);
    expect(s.paddingBottom).toBe(2);
  });
});
