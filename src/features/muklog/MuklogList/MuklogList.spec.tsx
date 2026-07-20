// src/features/muklog/MuklogList.spec.tsx
// LogScreen 'log' 세그 맛집 섹션 — loading/error/empty/ready 분기 + 섹션 헤더 "우리 맛집 N" + FAB→에디터 라우트 이동
//   (plan §6.1 / §5 T10, AC1·AC2·AC11·AC12). state/refresh는 props 주입(presentational) — useMuklogs 소유는 LogScreen.
//   ⚠️ wishlist 스프린트: 데이터 조회·포커스 refresh가 LogScreen으로 이관 → 이 spec은 props 기반 렌더만 검증.
//   ⚠️ FLAG-1: 입력 시트→풀스크린 에디터 라우트 전환. FAB는 navigate(MuklogEditor)만(장소검색은 에디터 컨테이너로 이동).
import React from 'react';
import { View } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';
import { spacing } from '@/theme';

import { type Muklog, type MuklogsState } from '../types';

// RN 스타일 배열/중첩을 단일 객체로 평탄화(테스트 단언용).
const flattenStyle = (style: unknown): Record<string, number> =>
  Object.assign({}, ...[].concat(style as never).filter(Boolean));

// 카드 탭 → navigate(MuklogDetail, { muklogId }) / FAB → navigate(MuklogEditor, { roomId }) 배선 검증용 navigation 모킹.
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

import { MuklogList } from './MuklogList';

const muklog = (over?: Partial<Muklog>): Muklog => ({
  id: 'm1',
  roomId: 'r1',
  placeName: '트라토리아 보나',
  category: 'pasta',
  area: '연남동',
  memo: '맛있었다',
  rating: 5,
  visitedAt: '2026-02-14',
  createdBy: 'me-uid',
  createdAt: '2026-02-14T00:00:00.000Z',
  photoCount: 0,
  coverUri: null,
  ...over,
});

const refresh = jest.fn();
const renderList = ({ state }: { state: MuklogsState }) =>
  renderWithTheme(<MuklogList roomId="r1" meId="me-uid" state={state} refresh={refresh} />);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('MuklogList', () => {
  it('loading이면 로더를 표시한다', () => {
    renderList({ state: { status: 'loading' } });
    expect(screen.getByTestId('muklog-list-loading')).toBeTruthy();
  });

  it('error면 메시지 + 다시 시도 버튼을 표시한다 (AC11)', () => {
    renderList({
      state: { status: 'error', message: '맛집 목록을 불러오지 못했어요. 다시 시도해 주세요.' },
    });
    expect(screen.getByText('맛집 목록을 불러오지 못했어요. 다시 시도해 주세요.')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('다시 시도'));
    expect(refresh).toHaveBeenCalled();
  });

  it('빈 목록이면 빈 상태 문구를 표시한다 (AC1)', () => {
    renderList({ state: { status: 'ready', muklogs: [] } });
    expect(screen.getByText('아직 기록한 맛집이 없어요')).toBeTruthy();
    expect(screen.getByText('우리 맛집 0')).toBeTruthy();
  });

  it('빈 상태 이모지(🍽️)에 fontSize보다 큰 lineHeight 헤드룸을 줘 세로 클리핑을 막는다', () => {
    renderList({ state: { status: 'ready', muklogs: [] } });
    const emojiNode = screen.getByText('🍽️');
    const flat = Object.assign(
      {},
      ...[].concat(emojiNode.props.style as never).filter(Boolean),
    ) as { fontSize: number; lineHeight: number };
    expect(flat.lineHeight).toBeGreaterThan(flat.fontSize);
  });

  it('ready면 섹션 헤더 "우리 맛집 N"과 카드 N개를 표시한다', () => {
    renderList({
      state: { status: 'ready', muklogs: [muklog({ id: 'm1' }), muklog({ id: 'm2', placeName: '어니언' })] },
    });
    expect(screen.getByText('우리 맛집 2')).toBeTruthy();
    expect(screen.getByText('트라토리아 보나')).toBeTruthy();
    expect(screen.getByText('어니언')).toBeTruthy();
  });

  it('FAB 탭 시 에디터 라우트로 navigate(MuklogEditor, { roomId })를 호출한다 (AC2, FLAG-1)', () => {
    renderList({ state: { status: 'ready', muklogs: [] } });
    fireEvent.press(screen.getByLabelText('새 먹로그'));
    expect(mockNavigate).toHaveBeenCalledWith('MuklogEditor', { roomId: 'r1' });
  });
});

describe('MuklogList — 헤더 슬롯 정렬(참여자 블록 ↔ "우리 맛집" 라인 정합)', () => {
  const renderWithHeader = () =>
    renderWithTheme(
      <MuklogList
        roomId="r1"
        meId="me-uid"
        state={{ status: 'ready', muklogs: [] }}
        refresh={refresh}
        header={<View testID="injected-header" />}
      />,
    );

  // 킷 mk-log.jsx: scroll 컨테이너는 무패딩이고 각 섹션이 자체 20px 좌우 패딩을 소유(참여자 :81, "우리 맛집" :108).
  //   RN은 contentContainer에 일괄 패딩(20)을 두므로, 주입 블록(자체 20 소유)이 이중 패딩이 되지 않게
  //   헤더 슬롯이 컨테이너 좌우/상단 패딩을 negative margin으로 상쇄해야 두 요소가 같은 20px 그리드에 선다.
  it('헤더 슬롯이 컨테이너 좌우 패딩을 정확히 상쇄해 주입 블록을 20px 그리드에 정렬한다 (AC1)', () => {
    renderWithHeader();
    const containerPad = flattenStyle(
      screen.getByTestId('muklog-list-scroll').props.contentContainerStyle,
    ).padding;
    const wrapper = flattenStyle(screen.getByTestId('muklog-list-header').props.style);
    expect(wrapper.marginHorizontal).toBe(-containerPad);
  });

  it('헤더 슬롯이 컨테이너 상단 패딩을 상쇄해 이중 상단 패딩을 제거한다 (AC2)', () => {
    renderWithHeader();
    const containerPad = flattenStyle(
      screen.getByTestId('muklog-list-scroll').props.contentContainerStyle,
    ).padding;
    const wrapper = flattenStyle(screen.getByTestId('muklog-list-header').props.style);
    // 상단 패딩(=padding)을 상쇄 → segment→participant 리듬은 블록 자체 top(킷 12)이 결정.
    expect(wrapper.marginTop).toBe(-containerPad);
  });

  it('헤더 슬롯 하단 여백 = 킷 참여자→"우리 맛집" 리듬(블록 bottom 2 + 슬롯 16 = 18) (AC2)', () => {
    renderWithHeader();
    const wrapper = flattenStyle(screen.getByTestId('muklog-list-header').props.style);
    expect(wrapper.marginBottom).toBe(spacing[16]);
  });

  it('header가 없으면 헤더 슬롯을 렌더하지 않는다(회귀: 로딩/미로드 상태)', () => {
    renderList({ state: { status: 'loading' } });
    expect(screen.queryByTestId('muklog-list-header')).toBeNull();
  });
});

describe('MuklogList — 카테고리 필터 (B2)', () => {
  const mixed: MuklogsState = {
    status: 'ready',
    muklogs: [
      muklog({ id: 'm1', category: 'pasta', placeName: '파스타집' }),
      muklog({ id: 'm2', category: 'cafe', placeName: '카페집' }),
    ],
  };

  it('ready면 "전체" + 리스트에 존재하는 카테고리 칩을 표시한다', () => {
    renderList({ state: mixed });
    // 칩 존재는 testID로 검증 — §2-2로 카드 배지도 라벨만 노출해 라벨 텍스트가 칩·배지 양쪽에 중복(getByText 모호) → 칩 식별자로 스코프.
    expect(screen.getByTestId('chip-all')).toBeTruthy();
    expect(screen.getByTestId('chip-pasta')).toBeTruthy();
    expect(screen.getByTestId('chip-cafe')).toBeTruthy();
  });

  it('초기엔 "전체" 선택 + 모든 카드 표시, "우리 맛집 N"=전체 수', () => {
    renderList({ state: mixed });
    expect(screen.getByText('파스타집')).toBeTruthy();
    expect(screen.getByText('카페집')).toBeTruthy();
    expect(screen.getByText('우리 맛집 2')).toBeTruthy();
  });

  it('카테고리 칩 탭 시 해당 cat만 필터하고 "우리 맛집 N"은 전체 수 유지', () => {
    renderList({ state: mixed });
    fireEvent.press(screen.getByTestId('chip-cafe'));
    expect(screen.queryByText('파스타집')).toBeNull();
    expect(screen.getByText('카페집')).toBeTruthy();
    // N은 필터 무관 전체 수 유지(킷 mk-log.jsx:55 log.muklogs.length).
    expect(screen.getByText('우리 맛집 2')).toBeTruthy();
  });

  it('"전체" 칩 탭 시 필터 해제(모두 표시)', () => {
    renderList({ state: mixed });
    fireEvent.press(screen.getByTestId('chip-cafe'));
    expect(screen.queryByText('파스타집')).toBeNull();
    fireEvent.press(screen.getByTestId('chip-all'));
    expect(screen.getByText('파스타집')).toBeTruthy();
    expect(screen.getByText('카페집')).toBeTruthy();
  });

  it('빈 목록이면 필터 칩 행을 표시하지 않는다', () => {
    renderList({ state: { status: 'ready', muklogs: [] } });
    expect(screen.queryByText('전체')).toBeNull();
  });
});

describe('MuklogList — 상세 진입 배선 (plan §4.3)', () => {
  it('카드 탭 시 navigate(MuklogDetail, { muklogId: 카드 id })를 호출한다', () => {
    renderList({
      state: { status: 'ready', muklogs: [muklog({ id: 'm-target', placeName: '트라토리아 보나' })] },
    });
    fireEvent.press(screen.getByLabelText('트라토리아 보나 상세 보기'));
    expect(mockNavigate).toHaveBeenCalledWith('MuklogDetail', { muklogId: 'm-target' });
  });
});

// 장소검색 컨테이너 배선(usePlaceSearch/usePlaceSelection)은 FLAG-1 전환으로 MuklogEditorRoute로 이동 →
//   해당 검증은 MuklogEditorRoute.spec / MuklogEditor.spec에서 다룬다.
