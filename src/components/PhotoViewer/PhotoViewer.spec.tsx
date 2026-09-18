// src/components/PhotoViewer/PhotoViewer.spec.tsx
// 풀스크린 사진 뷰어 — plan §5-1 B (TC-V1~V19).
//   렌더 계약(§3.2)만 본다: 네이티브 페이징 물리·실제 이미지 로딩·signed URL 만료는 디바이스 스모크(§5-1 E).
import React from 'react';
import { AccessibilityInfo, Dimensions, Modal, StyleSheet } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { PhotoViewer as BarrelPhotoViewer } from '@/components';
import { renderWithTheme } from '@/test/renderWithTheme';
import { themes } from '@/theme';

import { PHOTO_VIEWER_ENTER_SCALE, PhotoViewer, type PhotoViewerPhoto } from './PhotoViewer';

const photos = ({ count }: { count: number }): PhotoViewerPhoto[] =>
  Array.from({ length: count }, (_, index) => ({ uri: `https://cdn.test/p${index}.jpg` }));

const PAGE_WIDTH = 400;

/** 트랙에 가로 스크롤 이벤트를 흘려 페이지를 넘긴다(네이티브 스냅은 스모크 대상). */
const scrollToPage = ({ page }: { page: number }) => {
  fireEvent.scroll(screen.getByTestId('photo-viewer-track'), {
    nativeEvent: {
      contentOffset: { x: PAGE_WIDTH * page, y: 0 },
      contentSize: { width: PAGE_WIDTH * 5, height: 800 },
      layoutMeasurement: { width: PAGE_WIDTH, height: 800 },
    },
  });
};

// 진입 페이드가 도는 동안 Animated가 상태를 갱신한다 — 실제 타이머면 act() 밖 갱신 경고가 난다(Toast·Sheet 선례).
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const trackProps = () => screen.getByTestId('photo-viewer-track').props;

/** 카운터 pill이 실제로 그리는 문자열(`n / total`). */
const counterText = () => screen.getByTestId('photo-viewer-counter').props.children.props.children;

describe('PhotoViewer — 열림/닫힘 렌더 (P3-a)', () => {
  afterEach(() => jest.restoreAllMocks());

  // TC-V1
  it('visible=false면 아무것도 렌더하지 않는다', () => {
    renderWithTheme(<PhotoViewer visible={false} photos={photos({ count: 3 })} onClose={jest.fn()} />);
    expect(screen.queryByTestId('photo-viewer-backdrop')).toBeNull();
  });

  // TC-V2
  it('사진이 0장이면 visible이어도 렌더하지 않는다(빈 검은 화면 방지, E1)', () => {
    renderWithTheme(<PhotoViewer visible photos={[]} onClose={jest.fn()} />);
    expect(screen.queryByTestId('photo-viewer-backdrop')).toBeNull();
    expect(screen.queryByTestId('photo-viewer-close')).toBeNull();
  });

  // TC-V3
  it('visible=true·사진 3장이면 배경·트랙·사진·닫기가 즉시 마운트된다(진입 연출과 무관)', () => {
    renderWithTheme(<PhotoViewer visible photos={photos({ count: 3 })} onClose={jest.fn()} />);
    expect(screen.getByTestId('photo-viewer-backdrop')).toBeTruthy();
    expect(screen.getByTestId('photo-viewer-track')).toBeTruthy();
    expect(screen.getAllByTestId('photo-viewer-photo')).toHaveLength(3);
    expect(screen.getByTestId('photo-viewer-close')).toBeTruthy();
  });

  it('배경이 viewerBg 토큰 단색이다(raw hex 0 — 토큰 경유, B7)', () => {
    renderWithTheme(<PhotoViewer visible photos={photos({ count: 2 })} onClose={jest.fn()} />);
    const style = StyleSheet.flatten(screen.getByTestId('photo-viewer-backdrop').props.style) as {
      backgroundColor: string;
    };
    expect(style.backgroundColor).toBe(themes.light.color.viewerBg);
  });
});

describe('PhotoViewer — 초기 인덱스 (P3-b)', () => {
  // TC-V4
  it('initialIndex=2·5장이면 카운터가 3 / 5다', () => {
    renderWithTheme(
      <PhotoViewer visible photos={photos({ count: 5 })} initialIndex={2} onClose={jest.fn()} />,
    );
    expect(counterText()).toBe('3 / 5');
  });

  // TC-V5
  it('범위를 넘는 initialIndex는 마지막 사진으로 접힌다', () => {
    renderWithTheme(
      <PhotoViewer visible photos={photos({ count: 5 })} initialIndex={9} onClose={jest.fn()} />,
    );
    expect(counterText()).toBe('5 / 5');
  });

  // TC-V6
  it('음수 initialIndex는 첫 사진으로 접힌다', () => {
    renderWithTheme(
      <PhotoViewer visible photos={photos({ count: 5 })} initialIndex={-1} onClose={jest.fn()} />,
    );
    expect(counterText()).toBe('1 / 5');
  });

  it('initialIndex를 생략하면 첫 사진에서 연다', () => {
    renderWithTheme(<PhotoViewer visible photos={photos({ count: 4 })} onClose={jest.fn()} />);
    expect(counterText()).toBe('1 / 4');
  });

  it('트랙이 진입 인덱스 위치에서 시작한다(탭한 사진에서 열림 — DS1의 렌더 계약)', () => {
    renderWithTheme(
      <PhotoViewer visible photos={photos({ count: 5 })} initialIndex={2} onClose={jest.fn()} />,
    );
    expect(trackProps().contentOffset).toEqual({ x: Dimensions.get('window').width * 2, y: 0 });
  });

  // V1 — contentOffset은 "초기 위치"여야 한다. pageIndex에 묶으면 iOS에서 스크롤 도중 네이티브 오프셋이
  //   다시 설정돼 손가락이 닿아 있는 채로 트랙이 튄다(제어 prop화). 스크롤 재렌더에도 값이 불변인지를 잠근다.
  it('스크롤로 페이지를 넘겨도 트랙의 진입 오프셋이 다시 설정되지 않는다(V1 — 제어 prop 아님)', () => {
    renderWithTheme(
      <PhotoViewer visible photos={photos({ count: 5 })} initialIndex={2} onClose={jest.fn()} />,
    );
    const entryOffset = trackProps().contentOffset;
    scrollToPage({ page: 4 });
    // 재렌더가 실제로 일어났다(카운터는 따라 움직인다) — 그런데도 진입 오프셋은 그대로여야 한다.
    expect(counterText()).toBe('5 / 5');
    expect(trackProps().contentOffset).toEqual(entryOffset);
  });

  it('닫았다 다시 열면 이전 인덱스가 새어 나오지 않는다(B8)', () => {
    const { rerender } = renderWithTheme(
      <PhotoViewer visible photos={photos({ count: 5 })} initialIndex={3} onClose={jest.fn()} />,
    );
    expect(counterText()).toBe('4 / 5');
    rerender(
      <PhotoViewer visible={false} photos={photos({ count: 5 })} initialIndex={3} onClose={jest.fn()} />,
    );
    rerender(
      <PhotoViewer visible photos={photos({ count: 5 })} initialIndex={0} onClose={jest.fn()} />,
    );
    expect(counterText()).toBe('1 / 5');
  });
});

describe('PhotoViewer — 열려 있는 동안의 목록 변경 (P3-b2)', () => {
  // S1 — visible 상승 엣지 가드(playViewerEnter의 openedRef). 이 가드를 지우면 이 케이스가 Red가 된다.
  it('뷰어가 열린 채 사진이 늘어도 보고 있던 페이지를 유지한다(B8 상승 엣지)', () => {
    const { rerender } = renderWithTheme(
      <PhotoViewer visible photos={photos({ count: 5 })} initialIndex={0} onClose={jest.fn()} />,
    );
    scrollToPage({ page: 3 });
    expect(counterText()).toBe('4 / 5');

    rerender(
      <PhotoViewer visible photos={photos({ count: 6 })} initialIndex={0} onClose={jest.fn()} />,
    );
    // 가드가 없으면 initialIndex(0)로 되감겨 `1 / 6`이 된다 — 보고 있던 사진을 잃는다.
    expect(counterText()).toBe('4 / 6');
  });

  // S3 — 목록이 줄면 pageIndex가 범위 밖에 남는다. 표시 직전 재클램프가 없으면 `5 / 3`이 뜬다.
  it('뷰어가 열린 채 사진이 줄면 카운터가 목록 밖 숫자를 띄우지 않는다(S3 — 5 / 3 방지)', () => {
    const { rerender } = renderWithTheme(
      <PhotoViewer visible photos={photos({ count: 5 })} initialIndex={4} onClose={jest.fn()} />,
    );
    expect(counterText()).toBe('5 / 5');

    rerender(
      <PhotoViewer visible photos={photos({ count: 3 })} initialIndex={4} onClose={jest.fn()} />,
    );
    expect(counterText()).toBe('3 / 3');
    expect(screen.getByTestId('photo-viewer-counter').props.accessibilityLabel).toBe(
      '3장 중 3번째 사진',
    );
  });
});

describe('PhotoViewer — 가로 페이징 (P3-c)', () => {
  // TC-V7
  it('트랙이 가로 페이징 ScrollView다(스크롤바 숨김)', () => {
    renderWithTheme(<PhotoViewer visible photos={photos({ count: 5 })} onClose={jest.fn()} />);
    const props = trackProps();
    expect(props.horizontal).toBe(true);
    expect(props.pagingEnabled).toBe(true);
    expect(props.showsHorizontalScrollIndicator).toBe(false);
  });

  // TC-V8
  it('스크롤로 2페이지째에 오면 카운터가 2 / 5로 바뀐다', () => {
    renderWithTheme(<PhotoViewer visible photos={photos({ count: 5 })} onClose={jest.fn()} />);
    scrollToPage({ page: 1 });
    expect(counterText()).toBe('2 / 5');
  });

  it('마지막 페이지를 넘어가는 바운스에서도 카운터가 총 장수를 넘지 않는다', () => {
    renderWithTheme(<PhotoViewer visible photos={photos({ count: 5 })} onClose={jest.fn()} />);
    scrollToPage({ page: 8 });
    expect(counterText()).toBe('5 / 5');
  });
});

describe('PhotoViewer — 사진 1장 예외 (P3-d)', () => {
  // TC-V9
  it('사진이 1장이면 카운터를 렌더하지 않는다(정보량 0, E2)', () => {
    renderWithTheme(<PhotoViewer visible photos={photos({ count: 1 })} onClose={jest.fn()} />);
    expect(screen.queryByTestId('photo-viewer-counter')).toBeNull();
    expect(screen.getAllByTestId('photo-viewer-photo')).toHaveLength(1);
    expect(screen.getByTestId('photo-viewer-close')).toBeTruthy();
  });
});

describe('PhotoViewer — 닫기 2경로 (P3-e)', () => {
  // TC-V10
  it('X를 탭하면 onClose가 1회 호출된다', () => {
    const onClose = jest.fn();
    renderWithTheme(<PhotoViewer visible photos={photos({ count: 3 })} onClose={onClose} />);
    fireEvent.press(screen.getByTestId('photo-viewer-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // TC-V11
  it('Android 하드웨어 뒤로가기(onRequestClose)가 onClose를 1회 호출한다(E8)', () => {
    const onClose = jest.fn();
    renderWithTheme(<PhotoViewer visible photos={photos({ count: 3 })} onClose={onClose} />);
    screen.UNSAFE_getByType(Modal).props.onRequestClose();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('PhotoViewer — 이미지 렌더 계약 (P3-f)', () => {
  // TC-V12
  it('사진이 잘리지 않게 contain으로 그린다(E7 — 상세 캐러셀 cover와 의도적으로 다르다)', () => {
    renderWithTheme(<PhotoViewer visible photos={photos({ count: 2 })} onClose={jest.fn()} />);
    screen.getAllByTestId('photo-viewer-photo').forEach((photo) => {
      expect(photo.props.resizeMode).toBe('contain');
    });
  });

  it('한 페이지가 화면 폭·높이를 채운다(가로 ScrollView 교차축이 0으로 접히는 것 방지)', () => {
    renderWithTheme(<PhotoViewer visible photos={photos({ count: 2 })} onClose={jest.fn()} />);
    const window = Dimensions.get('window');
    const page = StyleSheet.flatten(
      screen.getAllByTestId('photo-viewer-page')[0].props.style,
    ) as { width: number; height: number };
    expect(page.width).toBe(window.width);
    expect(page.height).toBe(window.height);
  });

  // TC-V13
  it('사진 순서가 props 배열 순서와 일치한다(B2 — 인덱스 어긋남 방지)', () => {
    renderWithTheme(<PhotoViewer visible photos={photos({ count: 3 })} onClose={jest.fn()} />);
    const uris = screen.getAllByTestId('photo-viewer-photo').map((photo) => photo.props.source.uri);
    expect(uris).toEqual([
      'https://cdn.test/p0.jpg',
      'https://cdn.test/p1.jpg',
      'https://cdn.test/p2.jpg',
    ]);
  });
});

describe('PhotoViewer — Modal 딤 전면 커버 (P3-g)', () => {
  // TC-V14
  it('Modal이 statusBarTranslucent를 켠다(U57 회귀 방지, B3)', () => {
    renderWithTheme(<PhotoViewer visible photos={photos({ count: 2 })} onClose={jest.fn()} />);
    expect(screen.UNSAFE_getByType(Modal).props.statusBarTranslucent).toBe(true);
  });

  it('Modal이 transparent·animationType="none"이다(잔상 없이 즉시 마운트)', () => {
    renderWithTheme(<PhotoViewer visible photos={photos({ count: 2 })} onClose={jest.fn()} />);
    const props = screen.UNSAFE_getByType(Modal).props;
    expect(props.transparent).toBe(true);
    expect(props.animationType).toBe('none');
  });

  it('상단바가 상태바를 피하는 여백을 스스로 확보한다(statusBarTranslucent 대가)', () => {
    renderWithTheme(<PhotoViewer visible photos={photos({ count: 2 })} onClose={jest.fn()} />);
    const style = StyleSheet.flatten(screen.getByTestId('photo-viewer-topbar').props.style) as {
      paddingTop: number;
    };
    expect(style.paddingTop).toBeGreaterThan(0);
  });
});

describe('PhotoViewer — 접근성 (P3-h)', () => {
  // TC-V15
  it('X가 button 역할 + 라벨 "닫기"다', () => {
    renderWithTheme(<PhotoViewer visible photos={photos({ count: 2 })} onClose={jest.fn()} />);
    const close = screen.getByTestId('photo-viewer-close');
    expect(close.props.accessibilityRole).toBe('button');
    expect(close.props.accessibilityLabel).toBe('닫기');
  });

  // TC-V16
  it('사진은 props 라벨을 쓰고, 없으면 "사진 {n}"으로 폴백한다', () => {
    renderWithTheme(
      <PhotoViewer
        visible
        photos={[
          { uri: 'a', accessibilityLabel: '트라토리아 보나 사진 1' },
          { uri: 'b' },
        ]}
        onClose={jest.fn()}
      />,
    );
    const labels = screen
      .getAllByTestId('photo-viewer-photo')
      .map((photo) => photo.props.accessibilityLabel);
    expect(labels).toEqual(['트라토리아 보나 사진 1', '사진 2']);
  });

  // TC-V17
  it('카운터가 "{total}장 중 {n}번째 사진"으로 읽힌다', () => {
    renderWithTheme(
      <PhotoViewer visible photos={photos({ count: 5 })} initialIndex={2} onClose={jest.fn()} />,
    );
    expect(screen.getByTestId('photo-viewer-counter').props.accessibilityLabel).toBe(
      '5장 중 3번째 사진',
    );
  });
});

describe('PhotoViewer — 진입 모션 · 감소 모션 (P3-i)', () => {
  afterEach(() => jest.restoreAllMocks());

  const layerStyle = ({ testID }: { testID: string }) =>
    StyleSheet.flatten(screen.getByTestId(testID).props.style) as {
      opacity?: unknown;
      transform?: { scale: unknown }[];
    };

  /** 진입 레이어의 현재 스케일. 진입 프레임을 진행시키지 않았으므로 시작 스케일이 그대로 읽힌다(Sheet E2 선례). */
  const enterScaleValue = () =>
    layerStyle({ testID: 'photo-viewer-enter-layer' }).transform?.[0].scale as number;

  it('평상 경로: 콘텐츠가 살짝 작은 데서 제자리 확대되며 스며든다(fe-craft #5 — 순수 페이드 진입 금지)', () => {
    renderWithTheme(<PhotoViewer visible photos={photos({ count: 3 })} onClose={jest.fn()} />);
    const style = layerStyle({ testID: 'photo-viewer-enter-layer' });
    expect(style.opacity).toBeDefined();
    expect(style.transform).toHaveLength(1);
    expect(style.transform?.[0].scale).toBeDefined();
  });

  // C1 — 상수를 export한 이유(매직 넘버 대신 참조)를 스펙이 실제로 소비한다. Sheet의 E2·E4 선례와 같은 형태로
  //   "시작 스케일이 그 상수값이다" + "그 값이 fe-craft #5의 진입 스케일 구간 안이다"를 함께 잠근다.
  it('진입 시작 스케일이 PHOTO_VIEWER_ENTER_SCALE이고 fe-craft #5 구간(0.9~0.97) 안이다', () => {
    renderWithTheme(<PhotoViewer visible photos={photos({ count: 3 })} onClose={jest.fn()} />);
    expect(enterScaleValue()).toBe(PHOTO_VIEWER_ENTER_SCALE);
    expect(PHOTO_VIEWER_ENTER_SCALE).toBeGreaterThanOrEqual(0.9);
    expect(PHOTO_VIEWER_ENTER_SCALE).toBeLessThanOrEqual(0.97);
  });

  it('배경은 스케일하지 않는다(가장자리로 뒤 화면이 새어 보이는 것 방지)', () => {
    renderWithTheme(<PhotoViewer visible photos={photos({ count: 3 })} onClose={jest.fn()} />);
    const style = layerStyle({ testID: 'photo-viewer-backdrop' });
    expect(style.transform).toBeUndefined();
    expect(style.opacity).toBeDefined();
  });

  // TC-V18
  it('감소 모션 ON에서도 사진이 즉시 마운트되고 이동 모션이 없다(페이드는 유지, fe-craft #8)', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(Promise.resolve(true));
    renderWithTheme(<PhotoViewer visible photos={photos({ count: 3 })} onClose={jest.fn()} />);
    // ⚠️ 기다리는 조건은 단언 대상 자체여야 한다. useReduceMotion은 AccessibilityInfo를 **비동기**로 조회하므로
    //   "사진 3장 마운트"는 첫 렌더에서 즉시 참이 되고, 조회 응답이 반영되기 전에 단언이 실행돼 간헐 실패한다(N2).
    await waitFor(() =>
      expect(layerStyle({ testID: 'photo-viewer-enter-layer' }).transform).toBeUndefined(),
    );
    expect(layerStyle({ testID: 'photo-viewer-enter-layer' }).opacity).toBeDefined();
    // 사진은 감소 모션에서도 연출과 무관하게 즉시 마운트돼 있다(Sheet E1 선례).
    expect(screen.getAllByTestId('photo-viewer-photo')).toHaveLength(3);
  });
});

describe('PhotoViewer — 배럴 export (P4)', () => {
  // TC-V19
  it('@/components에서 import해 렌더된다', () => {
    renderWithTheme(<BarrelPhotoViewer visible photos={photos({ count: 2 })} onClose={jest.fn()} />);
    expect(screen.getAllByTestId('photo-viewer-photo')).toHaveLength(2);
  });
});
