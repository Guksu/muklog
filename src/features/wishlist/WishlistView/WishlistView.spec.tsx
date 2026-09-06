// src/features/wishlist/WishlistView.spec.tsx
// 위시리스트 본문(프리젠테이셔널) — 킷 mk-extra.jsx:178-224 정합.
//   빈 상태(TC-1) / 리스트·addedBy 매핑·note·area 분기(TC-3) / 핸들러(onAdd·onVisit·onRemove).
//   데이터·삭제·prefill 배선은 developer. 여기선 props만 검증.
import React from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { WishlistView } from './WishlistView';
import { type WishlistItem } from '../types';

const item = (over?: Partial<WishlistItem>): WishlistItem => ({
  id: 'w1',
  roomId: 'r1',
  placeName: '연남 파스타',
  category: 'pasta',
  area: '연남동',
  roadAddress: null,
  lat: null,
  lng: null,
  kakaoPlaceId: null,
  note: null,
  addedBy: 'me-uid',
  addedByMe: true,
  createdAt: '2026-06-16T00:00:00.000Z',
  ...over,
});

const renderView = (props?: Partial<React.ComponentProps<typeof WishlistView>>) =>
  renderWithTheme(
    <WishlistView
      items={[]}
      meNickname="민수"
      onAdd={jest.fn()}
      onVisit={jest.fn()}
      onRemove={jest.fn()}
      {...props}
    />,
  );

describe('WishlistView — 빈 상태 (TC-1)', () => {
  it('items가 비면 빈 상태 문구 + 추가 CTA를 표시한다', () => {
    renderView({ items: [] });
    expect(screen.getByText('다음엔 여기 어때요?')).toBeTruthy();
    expect(screen.getByText('위시리스트에 추가')).toBeTruthy();
  });

  it('빈 상태에서는 상단 점선 추가 버튼·항목 카드를 렌더하지 않는다', () => {
    renderView({ items: [] });
    expect(screen.queryByLabelText('가보고 싶은 곳 추가')).toBeNull();
    expect(screen.queryByText('연남 파스타')).toBeNull();
  });

  it('빈 상태에는 "기록하기" pill이 없다(TC-5, 빈 상태 CTA만 존재)', () => {
    renderView({ items: [] });
    expect(screen.queryByText('기록하기')).toBeNull();
    expect(screen.queryByLabelText(/기록하기/)).toBeNull();
  });

  it('빈 상태 CTA 탭 시 onAdd를 호출한다', () => {
    const onAdd = jest.fn();
    renderView({ items: [], onAdd });
    fireEvent.press(screen.getByText('위시리스트에 추가'));
    expect(onAdd).toHaveBeenCalled();
  });
});

describe('WishlistView — 리스트 / addedBy 매핑 (TC-3)', () => {
  it('항목이 있으면 상단 추가 버튼 + 카드(place·area)를 표시한다', () => {
    renderView({ items: [item({ id: 'w1', placeName: '연남 파스타', area: '연남동' })] });
    expect(screen.getByLabelText('가보고 싶은 곳 추가')).toBeTruthy();
    expect(screen.getByText('연남 파스타')).toBeTruthy();
    expect(screen.getByText('연남동')).toBeTruthy();
  });

  it('addedByMe=true면 내 닉으로 "{닉}님이 담았어요"를 표시한다', () => {
    renderView({ items: [item({ addedByMe: true })], meNickname: '민수' });
    expect(screen.getByText('민수님이 담았어요')).toBeTruthy();
  });

  it('addedByMe=false면 "짝꿍님이 담았어요"를 표시한다(파트너 익명, RLS 제약)', () => {
    renderView({ items: [item({ addedByMe: false, addedBy: 'partner-uid' })], meNickname: '민수' });
    expect(screen.getByText('짝꿍님이 담았어요')).toBeTruthy();
  });

  it('note가 있으면 2줄 clamp로 표시한다', () => {
    renderView({ items: [item({ id: 'w1', note: '꼭 가보자 여기' })] });
    const note = screen.getByTestId('wish-note-w1');
    expect(note.props.children).toBe('꼭 가보자 여기');
    expect(note.props.numberOfLines).toBe(2);
  });

  it('note가 null이면 메모를 렌더하지 않는다(경계)', () => {
    renderView({ items: [item({ id: 'w1', note: null })] });
    expect(screen.queryByTestId('wish-note-w1')).toBeNull();
  });

  it('area가 null이면 동네를 생략하고 place만 표시한다(경계)', () => {
    renderView({ items: [item({ id: 'w1', area: null, placeName: '좌표없는집' })] });
    expect(screen.getByText('좌표없는집')).toBeTruthy();
    expect(screen.queryByText('연남동')).toBeNull();
  });

  it('항목 카드에 액션 pill "기록하기"를 표시한다(TC-1)', () => {
    renderView({ items: [item()] });
    expect(screen.getByText('기록하기')).toBeTruthy();
  });

  it('상태 서술 카피 "다녀왔어요"는 렌더 트리·접근성 라벨 어디에도 없다(TC-2)', () => {
    renderView({ items: [item()] });
    expect(screen.queryByText('다녀왔어요')).toBeNull();
    expect(screen.queryByLabelText('연남 파스타 다녀왔어요')).toBeNull();
  });

  it('"기록하기" 탭 시 onVisit({ id })를 호출한다(TC-3)', () => {
    const onVisit = jest.fn();
    renderView({ items: [item({ id: 'w-target' })], onVisit });
    fireEvent.press(screen.getByLabelText('연남 파스타 기록하기'));
    expect(onVisit).toHaveBeenCalledWith({ id: 'w-target' });
  });

  it('항목이 여러 개면 "{장소명} 기록하기" 라벨로 각각 개별 조회된다(TC-4, 라벨 충돌 없음)', () => {
    const onVisit = jest.fn();
    renderView({
      items: [
        item({ id: 'w-a', placeName: '연남 파스타' }),
        item({ id: 'w-b', placeName: '망원 우동' }),
      ],
      onVisit,
    });
    expect(screen.getByLabelText('연남 파스타 기록하기')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('망원 우동 기록하기'));
    expect(onVisit).toHaveBeenCalledWith({ id: 'w-b' });
  });

  it('삭제(✕) 탭 시 onRemove({ id })를 호출한다', () => {
    const onRemove = jest.fn();
    renderView({ items: [item({ id: 'w-del' })], onRemove });
    fireEvent.press(screen.getByLabelText('연남 파스타 삭제'));
    expect(onRemove).toHaveBeenCalledWith({ id: 'w-del' });
  });

  it('상단 점선 추가 버튼 탭 시 onAdd를 호출한다', () => {
    const onAdd = jest.fn();
    renderView({ items: [item()], onAdd });
    fireEvent.press(screen.getByLabelText('가보고 싶은 곳 추가'));
    expect(onAdd).toHaveBeenCalled();
  });

  it('빈 상태 📍 이모지에 fontSize보다 큰 lineHeight 헤드룸을 줘 세로 클리핑을 막는다', () => {
    renderView({ items: [] });
    const emoji = screen.getByText('📍');
    const flat = Object.assign(
      {},
      ...[].concat(emoji.props.style as never).filter(Boolean),
    ) as { fontSize: number; lineHeight: number };
    expect(flat.lineHeight).toBeGreaterThan(flat.fontSize);
  });
});

// ── 프레스 부여 C4·C5·C6(motion-press-c T3 / ui-spec §2) ────────────────────────
//   seam = a11yLabel로 조회한 노드의 flatten style transform/opacity 키 유무(테스트 전용 testID 증설 금지).
//   pressedOpacity 실값·Animated 궤적은 검증하지 않는다(plan §8-2).
describe('WishlistView — 추가·기록하기·삭제 눌림 피드백(motion-press-c C4·C5·C6)', () => {
  const mockReduceMotion = ({ enabled }: { enabled: boolean }) => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockReturnValue(Promise.resolve(enabled));
  };

  afterEach(() => jest.restoreAllMocks());

  const flatten = ({ label }: { label: string }) =>
    StyleSheet.flatten(screen.getByLabelText(label).props.style) as Record<string, unknown>;

  const renderList = () => renderView({ items: [item()] });

  it('C4 점선 추가 행 — 감소 모션 OFF: transform이 부착된다', async () => {
    mockReduceMotion({ enabled: false });
    renderList();
    await waitFor(() => expect(flatten({ label: '가보고 싶은 곳 추가' }).transform).toBeDefined());
  });

  it('C4 점선 추가 행 — 감소 모션 ON: transform 없이 opacity만 남는다', async () => {
    mockReduceMotion({ enabled: true });
    renderList();
    await waitFor(() => expect(flatten({ label: '가보고 싶은 곳 추가' }).opacity).toBeDefined());
    expect(flatten({ label: '가보고 싶은 곳 추가' }).transform).toBeUndefined();
  });

  it('C5 기록하기 — 감소 모션 OFF: transform이 부착된다', async () => {
    mockReduceMotion({ enabled: false });
    renderList();
    await waitFor(() => expect(flatten({ label: '연남 파스타 기록하기' }).transform).toBeDefined());
  });

  it('C5 기록하기 — 감소 모션 ON: transform 없이 opacity만 남는다', async () => {
    mockReduceMotion({ enabled: true });
    renderList();
    await waitFor(() => expect(flatten({ label: '연남 파스타 기록하기' }).opacity).toBeDefined());
    expect(flatten({ label: '연남 파스타 기록하기' }).transform).toBeUndefined();
  });

  it('C6 삭제 ✕ — 감소 모션 OFF: transform이 부착된다', async () => {
    mockReduceMotion({ enabled: false });
    renderList();
    await waitFor(() => expect(flatten({ label: '연남 파스타 삭제' }).transform).toBeDefined());
  });

  it('C6 삭제 ✕ — 감소 모션 ON: transform 없이 opacity만 남는다', async () => {
    mockReduceMotion({ enabled: true });
    renderList();
    await waitFor(() => expect(flatten({ label: '연남 파스타 삭제' }).opacity).toBeDefined());
    expect(flatten({ label: '연남 파스타 삭제' }).transform).toBeUndefined();
  });

  it('렌더 시 console.warn 0건(정적 opacity 계약 위반 없음)', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    renderList();
    expect(warn).not.toHaveBeenCalled();
  });
});
