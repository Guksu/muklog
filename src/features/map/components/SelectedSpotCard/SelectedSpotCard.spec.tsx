// src/features/map/components/SelectedSpotCard.spec.tsx
// 선택 스팟 카드 — 킷 mk-home.jsx:374-389 선택 스팟 카드 재현.
//   핀 탭 시 하단 등장: FoodCover(카테고리 이모지) + 가게명 + 별점 + "· 카테고리 · area".
//   데이터는 props로만 주입(MuklogPin 필드). 비즈니스 로직 없음.
//   map-pin-card-detail(U11): onPress가 있으면 카드 전체가 버튼 1개("{가게명} 기록 보기") + 끝 쉐브론,
//   없으면 기존 비탭 카드 그대로. 접근성 카피는 상수를 import하지 않고 문자 그대로 적는다(상수 오타가 spec까지 따라오지 않게).
//   누름은 fireEvent가 아니라 userEvent.press로 한다 — fireEvent는 조상 컴포넌트의 onPress prop까지 거슬러 올라가
//   이 카드 자신이 받은 onPress를 찾아 부르므로, Pressable에 배선하지 않은 구현도 초록이 된다(vacuous green).
//   userEvent는 호스트 터치 응답자(Pressable의 View)에 responder 이벤트를 보내 실제 Pressability 경로를 탄다.
//   탭 영역·눌림 피드백은 픽셀·애니메이션을 볼 수 없어 그 입력값으로 잠근다(선례 MapPermissionBanner.spec) —
//   패딩이 버튼에 있고 표면엔 없음(= 패딩 포함 카드 전체가 탭 영역), 감소 모션 OFF에서 transform 부착 + 정적 opacity 경고 0.
import React from 'react';
import { AccessibilityInfo, StyleSheet, type ViewStyle } from 'react-native';
import { act, screen, userEvent, waitFor, within } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';
import { themes } from '@/theme';

import { SelectedSpotCard } from './SelectedSpotCard';

// ThemeProvider 기본은 light(MVP 고정) — 토큰 실값 비교에 themes.light 직접 참조.
const light = themes.light;

type HostNode = ReturnType<typeof screen.getByTestId>;

const flatten = ({ style }: { style: unknown }) =>
  (StyleSheet.flatten(style as ViewStyle) ?? {}) as ViewStyle;

// 가장 가까운 호스트(네이티브 뷰) 조상 — 사이에 낀 컴포넌트(MotionPressable·Animated·Pressable 래퍼)는 건너뛴다.
const nearestHostParent = ({ node }: { node: HostNode }) => {
  let parent = node.parent;
  while (parent && typeof parent.type !== 'string') parent = parent.parent;
  return parent;
};

const TAPPABLE_NAME = '트라토리아 보나 기록 보기';

const renderTappableCard = () =>
  renderWithTheme(
    <SelectedSpotCard
      placeName="트라토리아 보나"
      rating={5}
      category="pasta"
      area="연남동"
      onPress={jest.fn()}
    />,
  );

describe('SelectedSpotCard', () => {
  it('가게명을 표시한다', () => {
    renderWithTheme(
      <SelectedSpotCard placeName="트라토리아 보나" rating={5} category="pasta" area="연남동" />,
    );
    expect(screen.getByText('트라토리아 보나')).toBeTruthy();
  });

  it('카테고리 라벨과 area를 메타줄에 표시한다(킷 "· 카테고리 · area")', () => {
    renderWithTheme(
      <SelectedSpotCard placeName="트라토리아 보나" rating={5} category="pasta" area="연남동" />,
    );
    expect(screen.getByText('· 파스타·양식 · 연남동')).toBeTruthy();
  });

  it('rating만큼 채운 별을 렌더한다', () => {
    renderWithTheme(
      <SelectedSpotCard placeName="스시 오마" rating={3} category="sushi" area="청담동" />,
    );
    expect(screen.getAllByTestId('star-filled')).toHaveLength(3);
    expect(screen.getAllByTestId('star-empty')).toHaveLength(2);
  });

  it('카테고리 커버(FoodCover) 그라데이션을 렌더한다', () => {
    renderWithTheme(
      <SelectedSpotCard placeName="스시 오마" rating={3} category="sushi" area="청담동" />,
    );
    expect(screen.getByTestId('food-cover-gradient')).toBeTruthy();
  });

  it('area가 null이면 카테고리 라벨만 메타줄에 표시한다', () => {
    renderWithTheme(
      <SelectedSpotCard placeName="이름만 가게" rating={null} category="cafe" area={null} />,
    );
    expect(screen.getByText('· 카페·디저트')).toBeTruthy();
  });

  it('category가 null이면 area만 메타줄에 표시한다', () => {
    renderWithTheme(
      <SelectedSpotCard placeName="무카테고리" rating={4} category={null} area="망원동" />,
    );
    expect(screen.getByText('· 망원동')).toBeTruthy();
  });

  // #5: 카테고리/area 메타 텍스트 상단 클리핑 방지 — lineHeight > fontSize(한글 글리프 윗부분 잘림 방지).
  it('메타 텍스트의 lineHeight가 fontSize보다 커서 상단 클리핑이 없다(#5)', () => {
    renderWithTheme(
      <SelectedSpotCard placeName="트라토리아 보나" rating={5} category="pasta" area="연남동" />,
    );
    const meta = StyleSheet.flatten(screen.getByText('· 파스타·양식 · 연남동').props.style);
    expect(meta.lineHeight).toBeGreaterThan(meta.fontSize);
  });
});

// map-pin-card-detail(U11) — 우리 맛집 카드 → 먹로그 상세. 이동 배선(navigate)은 부모 몫이고 여기선 onPress 효과만 본다.
describe('SelectedSpotCard — 탭 가능 카드(onPress)', () => {
  it('카드 전체가 "{가게명} 기록 보기" 버튼으로 찾힌다(SC1)', () => {
    renderWithTheme(
      <SelectedSpotCard
        placeName="트라토리아 보나"
        rating={5}
        category="pasta"
        area="연남동"
        onPress={jest.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: '트라토리아 보나 기록 보기' })).toBeTruthy();
  });

  it('버튼을 누르면 onPress를 정확히 1회 부른다(SC2)', async () => {
    // 가짜 시간: 누름을 뗀 뒤 MotionPressable의 복귀 스프링을 act 안에서 끝낸다(안 그러면 act 밖 갱신 경고).
    jest.useFakeTimers();
    try {
      const onPress = jest.fn();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      renderWithTheme(
        <SelectedSpotCard
          placeName="트라토리아 보나"
          rating={5}
          category="pasta"
          area="연남동"
          onPress={onPress}
        />,
      );
      await user.press(screen.getByRole('button', { name: '트라토리아 보나 기록 보기' }));
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      expect(onPress).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('버튼 힌트가 "방문 기록을 자세히 볼 수 있어요"다(SC3)', () => {
    renderWithTheme(
      <SelectedSpotCard
        placeName="트라토리아 보나"
        rating={5}
        category="pasta"
        area="연남동"
        onPress={jest.fn()}
      />,
    );
    const button = screen.getByRole('button', { name: '트라토리아 보나 기록 보기' });
    expect(button.props.accessibilityHint).toBe('방문 기록을 자세히 볼 수 있어요');
  });

  it('버튼 안에 이동 어포던스 쉐브론(chevron-right)이 있다(SC4)', () => {
    renderWithTheme(
      <SelectedSpotCard
        placeName="트라토리아 보나"
        rating={5}
        category="pasta"
        area="연남동"
        onPress={jest.fn()}
      />,
    );
    const button = screen.getByRole('button', { name: '트라토리아 보나 기록 보기' });
    expect(within(button).getByTestId('icon-chevron-right')).toBeTruthy();
  });

  it('카드 안의 버튼은 1개뿐이고 하트는 그 안의 장식이다(SC5)', () => {
    renderWithTheme(
      <SelectedSpotCard
        placeName="트라토리아 보나"
        rating={5}
        category="pasta"
        area="연남동"
        onPress={jest.fn()}
      />,
    );
    expect(screen.getAllByRole('button')).toHaveLength(1);
    const button = screen.getByRole('button', { name: '트라토리아 보나 기록 보기' });
    expect(within(button).getByTestId('icon-heart')).toBeTruthy();
  });

  it('가게명·표지·메타·하트 등 카드 안 요소를 눌러도 같은 onPress가 불린다(SC6)', async () => {
    // SC2와 같은 가짜 시간 — 네 번 누르는 동안의 대기도 실제 시간을 쓰지 않는다.
    jest.useFakeTimers();
    try {
      const onPress = jest.fn();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      renderWithTheme(
        <SelectedSpotCard
          placeName="트라토리아 보나"
          rating={5}
          category="pasta"
          area="연남동"
          onPress={onPress}
        />,
      );
      await user.press(screen.getByText('트라토리아 보나'));
      await user.press(screen.getByTestId('food-cover-gradient'));
      await user.press(screen.getByText('· 파스타·양식 · 연남동'));
      await user.press(screen.getByTestId('icon-heart'));
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      expect(onPress).toHaveBeenCalledTimes(4);
    } finally {
      jest.useRealTimers();
    }
  });

  it('버튼 이름이 placeName prop을 따른다(SC7)', () => {
    const { rerender } = renderWithTheme(
      <SelectedSpotCard
        placeName="트라토리아 보나"
        rating={5}
        category="pasta"
        area="연남동"
        onPress={jest.fn()}
      />,
    );
    rerender(
      <SelectedSpotCard
        placeName="스시 오마카세 본점"
        rating={4}
        category="sushi"
        area="청담동"
        onPress={jest.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: '스시 오마카세 본점 기록 보기' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '트라토리아 보나 기록 보기' })).toBeNull();
  });

  it('긴 가게명은 1줄로 말줄임한다(SC8)', () => {
    renderWithTheme(
      <SelectedSpotCard
        placeName="아주 길고 긴 이름을 가진 성수동 수제 파스타와 와인 비스트로 본점"
        rating={5}
        category="pasta"
        area="성수동"
        onPress={jest.fn()}
      />,
    );
    expect(
      screen.getByText('아주 길고 긴 이름을 가진 성수동 수제 파스타와 와인 비스트로 본점').props
        .numberOfLines,
    ).toBe(1);
  });

  it('기존 표시 요소(가게명·메타·별점·표지·하트)를 버튼 안에 그대로 그린다', () => {
    renderWithTheme(
      <SelectedSpotCard
        placeName="스시 오마"
        rating={3}
        category="sushi"
        area="청담동"
        onPress={jest.fn()}
      />,
    );
    const button = screen.getByRole('button', { name: '스시 오마 기록 보기' });
    expect(within(button).getByText('스시 오마')).toBeTruthy();
    expect(within(button).getByText('· 스시·오마카세 · 청담동')).toBeTruthy();
    expect(within(button).getAllByTestId('star-filled')).toHaveLength(3);
    expect(within(button).getByTestId('food-cover-gradient')).toBeTruthy();
    expect(within(button).getByTestId('icon-heart')).toBeTruthy();
  });

  it('카드 표면(selected-spot-card)은 버튼을 감싸는 바깥 요소로 남는다(표면은 가만히, 내용만 눌림)', () => {
    renderWithTheme(
      <SelectedSpotCard
        placeName="트라토리아 보나"
        rating={5}
        category="pasta"
        area="연남동"
        onPress={jest.fn()}
      />,
    );
    const surface = screen.getByTestId('selected-spot-card');
    const button = within(surface).getByRole('button', { name: '트라토리아 보나 기록 보기' });
    expect(button).not.toBe(surface);
  });
});

// 카드 전체(패딩 포함)가 탭 영역 — 킷 패딩 14/20/16(mk-home:376)이 표면이 아니라 버튼 안에 있어야
//   카드 위 14·아래 16·양옆 20 여백을 눌러도 이동한다(원칙 8 셀 전체 탭). SC6은 안쪽 요소만 누르므로 이 계약을 못 본다.
describe('SelectedSpotCard — 탭 영역(카드 전체, 패딩 포함)', () => {
  it('킷 패딩 14/16/20이 버튼에 있다 — 여백까지 누를 수 있는 영역이다(SC9)', () => {
    renderTappableCard();
    const button = flatten({
      style: screen.getByRole('button', { name: TAPPABLE_NAME }).props.style,
    });
    expect(button.paddingTop).toBe(light.spacing[14]);
    expect(button.paddingBottom).toBe(light.spacing[16]);
    expect(button.paddingHorizontal).toBe(light.spacing[20]);
  });

  it('표면에는 패딩이 없고 버튼이 표면 바로 안에 있다 — 버튼이 표면 가장자리까지 채운다(SC10)', () => {
    renderTappableCard();
    const surfaceNode = screen.getByTestId('selected-spot-card');
    const surface = flatten({ style: surfaceNode.props.style });
    expect(surface.padding).toBeUndefined();
    expect(surface.paddingTop).toBeUndefined();
    expect(surface.paddingBottom).toBeUndefined();
    expect(surface.paddingVertical).toBeUndefined();
    expect(surface.paddingHorizontal).toBeUndefined();
    expect(surface.paddingLeft).toBeUndefined();
    expect(surface.paddingRight).toBeUndefined();
    // 표면과 버튼 사이에 패딩을 가진 다른 뷰가 끼지 않는다.
    const button = screen.getByRole('button', { name: TAPPABLE_NAME });
    expect(nearestHostParent({ node: button })).toBe(surfaceNode);
  });
});

// 눌림 피드백(원칙 3) — 소비처가 공용 MotionPressable을 쓰는지 잠근다(값·궤적은 MotionPressable.spec 몫).
describe('SelectedSpotCard — 눌림 피드백(MotionPressable 계약)', () => {
  const mockReduceMotion = ({ enabled }: { enabled: boolean }) => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockReturnValue(Promise.resolve(enabled));
  };

  afterEach(() => jest.restoreAllMocks());

  it('감소 모션 OFF — 카드 버튼에 눌림 모션(transform)이 부착된다(SC11)', async () => {
    mockReduceMotion({ enabled: false });
    renderTappableCard();
    await waitFor(() =>
      expect(
        flatten({ style: screen.getByRole('button', { name: TAPPABLE_NAME }).props.style })
          .transform,
      ).toBeDefined(),
    );
  });

  it('style에 정적 opacity를 넘기지 않는다 — MotionPressable 경고 0건(SC12)', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    renderTappableCard();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('SelectedSpotCard — 비탭 카드(onPress 없음)', () => {
  it('버튼·쉐브론 없이 기존 카드 그대로 그린다', () => {
    renderWithTheme(
      <SelectedSpotCard placeName="트라토리아 보나" rating={5} category="pasta" area="연남동" />,
    );
    expect(screen.getByTestId('selected-spot-card')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByTestId('icon-chevron-right')).toBeNull();
    expect(screen.getByTestId('icon-heart')).toBeTruthy();
  });
});
