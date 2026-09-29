// src/features/map/components/WishSpotCard.spec.tsx
// 위시 스팟 카드 — 킷 mk-home.jsx:374-389 스팟 카드 셸 미러(별점·heart·거리 제외).
//   위시 핀(kind:'wish') 탭 시 하단 등장: FoodCover(카테고리 tint + coverEmoji) + 가게명 + "· 카테고리 · area".
//   coverEmoji는 부모(MapTabScreen)가 pin과 동일한 categoryEmoji로 산출·주입(카드↔핀 이모지 단일 출처, plan §7-6).
//   map-wish-card-visit(U12): onVisit이 있으면 카드 아래 "기록하기" 버튼 1개(주변 카드 "위시에 담기"와 같은 Button soft/md/full),
//   없으면 기존 표시 전용 카드 그대로. 카드 본문은 버튼이 아니다.
//   데이터는 props로만 주입. 비즈니스 로직 없음.
import React from 'react';
import { AccessibilityInfo, StyleSheet, type ViewStyle } from 'react-native';
import { act, screen, userEvent, waitFor, within } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';
import { themes } from '@/theme';

import { NearbySpotCard } from '../NearbySpotCard';
import { WishSpotCard } from './WishSpotCard';

// ThemeProvider 기본은 light(MVP 고정) — 토큰 실값 비교에 themes.light 직접 참조.
const light = themes.light;

const flatten = ({ style }: { style: unknown }) =>
  (StyleSheet.flatten(style as ViewStyle) ?? {}) as ViewStyle;

// 주변 카드 버튼과 비교할 스타일 키(WC11) — 스킨·크기·폭·간격·그림자, 글자는 크기·줄높이·굵기(fontFamily)·색.
const BUTTON_STYLE_KEYS = [
  'backgroundColor',
  'borderColor',
  'borderWidth',
  'borderRadius',
  'paddingVertical',
  'paddingHorizontal',
  'alignSelf',
  'marginTop',
  'shadowColor',
  'shadowOpacity',
  'shadowRadius',
  'shadowOffset',
  'elevation',
] as const;
const LABEL_STYLE_KEYS = ['fontSize', 'lineHeight', 'fontFamily', 'color'] as const;

describe('WishSpotCard', () => {
  it('가게명을 표시한다', () => {
    renderWithTheme(
      <WishSpotCard placeName="연남 파스타" category="pasta" coverEmoji="🍝" area="연남동" />,
    );
    expect(screen.getByText('연남 파스타')).toBeTruthy();
  });

  it('카테고리 라벨과 area를 메타줄에 표시한다("· 라벨 · area")', () => {
    renderWithTheme(
      <WishSpotCard placeName="연남 파스타" category="pasta" coverEmoji="🍝" area="연남동" />,
    );
    // pasta 라벨(categories SSOT) + area.
    expect(screen.getByText('· 파스타·양식 · 연남동')).toBeTruthy();
  });

  it('area가 없으면 카테고리 라벨만 표시한다(area 조각 생략)', () => {
    renderWithTheme(
      <WishSpotCard placeName="연남 파스타" category="pasta" coverEmoji="🍝" area={null} />,
    );
    expect(screen.getByText('· 파스타·양식')).toBeTruthy();
  });

  it('coverEmoji로 받은 이모지를 커버에 렌더한다(핀과 동일 매핑 — 단일 출처)', () => {
    renderWithTheme(
      <WishSpotCard placeName="연남 파스타" category="pasta" coverEmoji="🍝" area="연남동" />,
    );
    expect(screen.getByTestId('food-cover-gradient')).toBeTruthy();
    expect(screen.getByText('🍝')).toBeTruthy();
  });

  it('별점(Stars)·heart·액션을 렌더하지 않는다(위시 최소 카드는 표시 전용)', () => {
    renderWithTheme(
      <WishSpotCard placeName="연남 파스타" category="pasta" coverEmoji="🍝" area="연남동" />,
    );
    expect(screen.queryByTestId('star-filled')).toBeNull();
    expect(screen.queryByTestId('star-empty')).toBeNull();
    expect(screen.queryByTestId('nearby-add-wish')).toBeNull();
  });

  // category/area 메타 텍스트 상단 클리핑 방지 — lineHeight > fontSize(한글 글리프 윗부분 잘림 방지).
  it('메타 텍스트의 lineHeight가 fontSize보다 커서 상단 클리핑이 없다', () => {
    renderWithTheme(
      <WishSpotCard placeName="연남 파스타" category="pasta" coverEmoji="🍝" area="연남동" />,
    );
    const meta = StyleSheet.flatten(screen.getByText('· 파스타·양식 · 연남동').props.style);
    expect(meta.lineHeight).toBeGreaterThan(meta.fontSize);
  });
});

// map-wish-card-visit(U12) — 위시 카드 "기록하기" → 새 먹로그 작성. 이동 배선(navigate)은 부모 몫이고 여기선 onVisit 효과만 본다.
//   접근성 카피는 상수를 import하지 않고 문자 그대로 적는다(상수 오타가 spec까지 따라오지 않게 — U11 선례).
//   누름은 userEvent.press로 한다(호스트 터치 응답자 → 실제 Pressability 경로, fireEvent의 조상 onPress 탐색 vacuous green 차단).
describe('WishSpotCard — 기록하기 액션(onVisit)', () => {
  const VISIT_NAME = '연남 파스타 기록하기';

  const renderVisitCard = ({ onVisit = jest.fn() }: { onVisit?: () => void } = {}) =>
    renderWithTheme(
      <WishSpotCard
        placeName="연남 파스타"
        category="pasta"
        coverEmoji="🍝"
        area="연남동"
        onVisit={onVisit}
      />,
    );

  it('"{가게명} 기록하기" 버튼이 있고 보이는 글자는 "기록하기"다(WC1)', () => {
    renderVisitCard();
    expect(screen.getByRole('button', { name: VISIT_NAME })).toBeTruthy();
    expect(screen.getByText('기록하기')).toBeTruthy();
  });

  it('버튼을 누르면 onVisit을 정확히 1회 부른다(WC2)', async () => {
    // 가짜 시간: 누름을 뗀 뒤 MotionPressable의 복귀 스프링을 act 안에서 끝낸다(안 그러면 act 밖 갱신 경고).
    jest.useFakeTimers();
    try {
      const onVisit = jest.fn();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      renderVisitCard({ onVisit });
      await user.press(screen.getByRole('button', { name: VISIT_NAME }));
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      expect(onVisit).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('버튼 힌트가 "가게 정보를 채운 채로 방문 기록을 남길 수 있어요"다(WC3)', () => {
    renderVisitCard();
    expect(screen.getByRole('button', { name: VISIT_NAME }).props.accessibilityHint).toBe(
      '가게 정보를 채운 채로 방문 기록을 남길 수 있어요',
    );
  });

  it('카드 안의 버튼은 정확히 1개이고 카드 표면·본문은 버튼이 아니다(WC5)', () => {
    renderVisitCard();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    const card = screen.getByTestId('wish-spot-card');
    expect(card.props.accessibilityRole).toBeUndefined();
    expect(within(card).getByRole('button', { name: VISIT_NAME })).toBeTruthy();
    // 가게명·메타는 버튼 밖(본문) — 버튼 안에 들어가면 카드 본문 누름이 이동을 만든다.
    const button = screen.getByRole('button', { name: VISIT_NAME });
    expect(within(button).queryByText('연남 파스타')).toBeNull();
    expect(within(button).queryByText('· 파스타·양식 · 연남동')).toBeNull();
  });

  it('버튼 이름이 placeName prop을 따른다(WC6)', () => {
    renderWithTheme(
      <WishSpotCard
        placeName="망원 우동집"
        category="noodle"
        coverEmoji="🍜"
        area="망원동"
        onVisit={jest.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: '망원 우동집 기록하기' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: VISIT_NAME })).toBeNull();
  });

  it('쉐브론·하트·별점이 없고 버튼에도 아이콘이 없다(WC7 — ›=보기 어휘와 구분, 킷 ex.visitBtn은 글자만)', () => {
    renderVisitCard();
    expect(screen.queryByTestId('icon-chevron-right')).toBeNull();
    expect(screen.queryByTestId('icon-heart')).toBeNull();
    expect(screen.queryByTestId('star-filled')).toBeNull();
    expect(screen.queryByTestId('star-empty')).toBeNull();
    const button = screen.getByRole('button', { name: VISIT_NAME });
    expect(within(button).queryAllByTestId(/^icon-/)).toHaveLength(0);
  });

  it('버튼이 있어도 긴 가게명은 1줄로 말줄임한다(WC8)', () => {
    const longName = '아주 길고 긴 이름을 가진 성수동 수제 파스타와 와인 비스트로 본점';
    renderWithTheme(
      <WishSpotCard
        placeName={longName}
        category="pasta"
        coverEmoji="🍝"
        area="성수동"
        onVisit={jest.fn()}
      />,
    );
    expect(screen.getByText(longName).props.numberOfLines).toBe(1);
    expect(screen.getByText('· 파스타·양식 · 성수동').props.numberOfLines).toBe(1);
    // 접근성 이름은 말줄임 없는 전체 가게명.
    expect(screen.getByRole('button', { name: `${longName} 기록하기` })).toBeTruthy();
  });

  // 킷 MkButton soft/md 실값(mk-ui.jsx:85-86,90,96): 패딩 13×18 · 글자 16(줄높이 1.2 → 19) · 그림자 없음.
  //   크기·그림자도 숫자로 잠근다 — sm이면 버튼 높이가 35pt로 최소 터치 44pt에 못 미친다(map-wish-card-visit QA VQ1).
  it('킷 MkButton soft/md 모양이다 — 패딩 13×18·글자 16/19·그림자 없음·카드 폭 채움·본문과 간격 14(WC9)', () => {
    renderVisitCard();
    const style = flatten({ style: screen.getByRole('button', { name: VISIT_NAME }).props.style });
    expect(style.backgroundColor).toBe(light.color.primaryWeak);
    expect(style.borderRadius).toBe(light.radius.control);
    expect(style.paddingVertical).toBe(13);
    expect(style.paddingHorizontal).toBe(18);
    expect(style.alignSelf).toBe('stretch');
    expect(style.marginTop).toBe(light.spacing[14]);
    // 그림자 없음 — iOS(shadowOpacity)·Android(elevation) 각각 확인.
    expect(style.shadowOpacity).toBeUndefined();
    expect(style.elevation).toBeUndefined();
    const label = StyleSheet.flatten(screen.getByText('기록하기').props.style);
    expect(label.color).toBe(light.color.accentStrong);
    expect(label.fontSize).toBe(16);
    expect(label.lineHeight).toBe(19);
  });

  // 같은 화면에서 카드 아래 행동 버튼은 같은 모양 — 주변 카드를 그려 버튼끼리 비교한다.
  //   아이콘(+)·로딩·접근성 이름은 의도된 차이라 스타일 비교에 들어가지 않는다.
  it('버튼·글자 스타일이 주변 카드 "위시에 담기" 버튼과 같다(WC11)', () => {
    const pickStyle = ({ style, keys }: { style: unknown; keys: readonly string[] }) => {
      const flat = flatten({ style }) as Record<string, unknown>;
      return Object.fromEntries(keys.map((key) => [key, flat[key]]));
    };

    const wishCard = renderVisitCard();
    const wishButton = pickStyle({
      style: screen.getByTestId('wish-spot-visit').props.style,
      keys: BUTTON_STYLE_KEYS,
    });
    const wishLabel = pickStyle({
      style: screen.getByText('기록하기').props.style,
      keys: LABEL_STYLE_KEYS,
    });
    wishCard.unmount();

    renderWithTheme(
      <NearbySpotCard
        placeName="연남 칼국수"
        categoryName="칼국수"
        coverEmoji="🍜"
        distanceText="320m"
        onAddWish={jest.fn()}
      />,
    );
    const nearbyButton = pickStyle({
      style: screen.getByTestId('nearby-add-wish').props.style,
      keys: BUTTON_STYLE_KEYS,
    });
    const nearbyLabel = pickStyle({
      style: screen.getByText('위시에 담기').props.style,
      keys: LABEL_STYLE_KEYS,
    });

    // 빈 스타일끼리 같다고 통과하지 않게 비교 대상이 실제 버튼인지 먼저 확인.
    expect(nearbyButton.backgroundColor).toBe(light.color.primaryWeak);
    expect(wishButton).toEqual(nearbyButton);
    expect(wishLabel).toEqual(nearbyLabel);
  });

  describe('눌림 피드백(공용 MotionPressable 경유)', () => {
    const mockReduceMotion = ({ enabled }: { enabled: boolean }) => {
      jest
        .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
        .mockReturnValue(Promise.resolve(enabled));
    };

    afterEach(() => jest.restoreAllMocks());

    it('감소 모션 OFF — 버튼에 눌림 모션(transform)이 부착된다(WC10)', async () => {
      mockReduceMotion({ enabled: false });
      renderVisitCard();
      await waitFor(() =>
        expect(
          flatten({ style: screen.getByRole('button', { name: VISIT_NAME }).props.style }).transform,
        ).toBeDefined(),
      );
    });
  });
});

describe('WishSpotCard — 표시 전용(onVisit 없음)', () => {
  it('버튼 없이 기존 카드 그대로 그린다(WC4)', () => {
    renderWithTheme(
      <WishSpotCard placeName="연남 파스타" category="pasta" coverEmoji="🍝" area="연남동" />,
    );
    expect(screen.getByTestId('wish-spot-card')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByText('기록하기')).toBeNull();
    expect(screen.getByText('연남 파스타')).toBeTruthy();
  });
});
