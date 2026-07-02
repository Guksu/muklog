// src/navigation/tabBarStyle.spec.ts
// #1 Android 하단 탭바(GNB) safe-area — buildTabBarStyle이 insets.bottom을 탭바 하단 패딩/높이에 반영하는지 단언.
//   근본원인: 기존 HomeTabs는 react-navigation의 자동 bottom inset에 의존했는데, Android(비 edge-to-edge)에서
//   insets.bottom=0으로 보고돼 시스템 내비바에 GNB가 가려졌다. → 컴포넌트가 직접 insets.bottom을 적용.
import { type MyLog, type MyLogsState } from '@/features/room';
import { themes } from '@/theme/tokens';

import { TAB_BAR_CONTENT_HEIGHT, buildTabBarStyle, shouldHideTabBar } from './tabBarStyle';

const theme = themes.light;

describe('buildTabBarStyle (#1 GNB safe-area)', () => {
  it('bottom inset이 있으면(Android 제스처/3버튼·iOS 홈인디케이터) 하단 패딩·높이에 그만큼 더한다', () => {
    const insetBottom = 48;
    const style = buildTabBarStyle({ insets: { bottom: insetBottom }, theme });

    // 하단 패딩 = 시스템 내비바 inset(콘텐츠가 내비바 위로 클리어).
    expect(style.paddingBottom).toBe(insetBottom);
    // 전체 높이 = 콘텐츠 높이 + inset → 바가 inset만큼 위로 자라 GNB가 가려지지 않는다.
    expect(style.height).toBe(TAB_BAR_CONTENT_HEIGHT + insetBottom);
  });

  it('bottom inset이 0이면(인셋 없는 기기) 콘텐츠 높이만, 추가 하단 패딩 없음 — 회귀 방지', () => {
    const style = buildTabBarStyle({ insets: { bottom: 0 }, theme });

    expect(style.paddingBottom).toBe(0);
    expect(style.height).toBe(TAB_BAR_CONTENT_HEIGHT);
  });

  it('킷 비주얼 토큰 유지: surface 배경·hairlineAlt 상단 보더·paddingTop spacing[8]', () => {
    const style = buildTabBarStyle({ insets: { bottom: 24 }, theme });

    expect(style.backgroundColor).toBe(theme.color.surface);
    expect(style.borderTopColor).toBe(theme.color.hairlineAlt);
    expect(style.paddingTop).toBe(theme.spacing[8]);
  });
});

describe('shouldHideTabBar (킷 §3 첫 실행 빈 상태 탭바 숨김)', () => {
  it('ready & 로그 0개 → true(온보딩 집중, 탭바 숨김)', () => {
    const logsState: MyLogsState = { status: 'ready', logs: [] };
    expect(shouldHideTabBar({ logsState })).toBe(true);
  });

  it('ready & 로그 1개 이상 → false(정상 탭바)', () => {
    // shouldHideTabBar는 logs.length만 보므로 요소 내용은 무관(최소 객체로 충분).
    const logsState: MyLogsState = { status: 'ready', logs: [{} as MyLog] };
    expect(shouldHideTabBar({ logsState })).toBe(false);
  });

  it('loading 중엔 숨기지 않는다(false) — 깜빡임 방지', () => {
    expect(shouldHideTabBar({ logsState: { status: 'loading' } })).toBe(false);
  });

  it('error 상태에선 숨기지 않는다(false) — 다시 시도 UI 접근 보존', () => {
    expect(shouldHideTabBar({ logsState: { status: 'error', message: 'x' } })).toBe(false);
  });
});
