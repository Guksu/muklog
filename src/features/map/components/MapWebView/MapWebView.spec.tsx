// src/features/map/components/MapWebView.spec.tsx
// 지도 WebView 컨테이너 — 프리젠테이션만(react-native-webview 래핑 + props forward).
//   비즈니스 로직(HTML 생성·메시지 파싱·INIT 직렬화)은 developer 몫 → 여기선 forward만 검증.
//   react-native-webview는 developer가 설치(미설치 시 일시 빨간줄 무방) → 테스트는 모듈을 모킹한다.
//   map-webview-recovery(plan §3.2·§5-1 A W1~W6): 종료 이벤트 2종 → onTerminated, webviewKey → 안쪽 WebView만 새로,
//   webviewMounted=false → 안쪽 WebView·ref 없음(컨테이너·오버레이는 그대로).
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';

// react-native-webview 모킹 — 실물처럼 ref에 주입 핸들을 붙이고(forwardRef + useImperativeHandle) prop을 **전부** 전달한다.
//   · prop 전부 전달: 종료 prop이 "넘어가지 않음"(W3)을 보려면 mock이 prop을 버리지 않아야 한다 — 버리면 W3이 늘 초록이다.
//   · ref 핸들: webviewMounted=false면 ref가 null로 남는지(W6)를 보려면 기본값에서 ref가 채워져야 한다(대조군).
//   virtual:true → 패키지 미설치(developer가 추후 설치, plan §5) 상태에서도 모킹 가능.
const mockInjectJavaScript = jest.fn();
jest.mock(
  'react-native-webview',
  () => {
    const Rn = require('react-native');
    const ReactLib = require('react');
    const WebView = ReactLib.forwardRef((props: any, ref: any) => {
      ReactLib.useImperativeHandle(ref, () => ({ injectJavaScript: mockInjectJavaScript }));
      return (
        <Rn.View {...props} testID="mock-webview" accessibilityLabel={props.source?.html ?? ''}>
          <Rn.Text>webview</Rn.Text>
        </Rn.View>
      );
    });
    return { WebView };
  },
  { virtual: true },
);

import { renderWithTheme } from '@/test/renderWithTheme';

import { MapWebView, MAP_WEBVIEW_BASE_URL, type MapWebViewHandle } from './MapWebView';

const noop = () => {};

describe('MapWebView', () => {
  it('html을 WebView source로 forward한다', () => {
    renderWithTheme(<MapWebView html="<html>지도</html>" onMessage={() => {}} />);
    expect(screen.getByLabelText('<html>지도</html>')).toBeTruthy();
  });

  it('source.baseUrl을 카카오 콘솔 등록 도메인(https://localhost)과 글자 그대로 일치시킨다 (R2 origin 검증)', () => {
    // ⚠️ 불변식: 카카오 Web 플랫폼 등록 도메인 === source.baseUrl. 글자 한 자라도 다르면 SDK origin 검증 실패.
    expect(MAP_WEBVIEW_BASE_URL).toBe('https://localhost');
    renderWithTheme(<MapWebView html="<html></html>" onMessage={() => {}} />);
    const webview = screen.getByTestId('mock-webview');
    expect(webview.props.source.baseUrl).toBe('https://localhost');
  });

  it('onMessage 핸들러를 WebView로 forward한다', () => {
    const onMessage = jest.fn();
    renderWithTheme(<MapWebView html="<html></html>" onMessage={onMessage} />);
    const webview = screen.getByTestId('mock-webview');
    expect(webview.props.onMessage).toBe(onMessage);
  });

  // map-feedback U5: WebView가 HTML을 페인트하기 전 첫 프레임은 RN 뷰 배경이다 — 미지정(흰색)이면
  //   mapHtml의 배경만으로는 그 한 프레임이 흰 여백으로 남는다. 지도 캔버스 소유자가 자기 배경을 갖는다
  //   (MapPrewarm의 숨은 WebView에도 자동 적용).
  it('컨테이너 배경이 지도 톤(mapSurface #EFEAE3)이다 — 부팅 첫 프레임 흰 점멸 제거', () => {
    renderWithTheme(<MapWebView html="<html></html>" onMessage={() => {}} />);
    const container = screen.getByTestId('map-webview-container');
    expect(StyleSheet.flatten(container.props.style).backgroundColor).toBe('#EFEAE3');
  });

  it('자식 오버레이(범례·카드)를 WebView 위에 렌더한다', () => {
    renderWithTheme(
      <MapWebView html="<html></html>" onMessage={() => {}}>
        <Text>범례 오버레이</Text>
      </MapWebView>,
    );
    expect(screen.getByText('범례 오버레이')).toBeTruthy();
  });
});

// ── map-webview-recovery (plan §3.2 seam ① · §5-1 A) ──────────────────────────
//   seam: MapWebView props 계약(onTerminated · webviewKey · webviewMounted)과 그 결과(mock WebView 요소의 prop·유무·동일성,
//   ref 핸들 유무). 실제 WKWebView·Android WebView의 종료는 디바이스 스모크 몫이다.
//   요소 동일성은 === 로 본다(toBe의 실패 diff는 렌더 트리 전체를 출력한다 — integration.spec 선례).
describe('MapWebView — 종료 복구 배선(map-webview-recovery)', () => {
  it('W1 iOS 콘텐츠 프로세스 종료(onContentProcessDidTerminate)를 onTerminated 1회로 올린다 — 인자 없음', () => {
    const onTerminated = jest.fn();
    renderWithTheme(<MapWebView html="<html></html>" onMessage={noop} onTerminated={onTerminated} />);

    fireEvent(screen.getByTestId('mock-webview'), 'contentProcessDidTerminate', {
      nativeEvent: { url: 'https://localhost' },
    });

    expect(onTerminated).toHaveBeenCalledTimes(1);
    // 플랫폼 이벤트 객체를 그대로 흘리지 않는다 — 화면은 "끝났다"만 알면 된다(계약: 인자 없음).
    expect(onTerminated).toHaveBeenCalledWith();
  });

  it.each([true, false])(
    'W2 Android 렌더 프로세스 종료(onRenderProcessGone, didCrash=%s)도 onTerminated 1회로 올린다',
    (didCrash) => {
      const onTerminated = jest.fn();
      renderWithTheme(<MapWebView html="<html></html>" onMessage={noop} onTerminated={onTerminated} />);

      fireEvent(screen.getByTestId('mock-webview'), 'renderProcessGone', { nativeEvent: { didCrash } });

      expect(onTerminated).toHaveBeenCalledTimes(1);
      expect(onTerminated).toHaveBeenCalledWith();
    },
  );

  it('W3 onTerminated를 주지 않으면 두 종료 prop을 WebView에 넘기지 않는다(프리워머·미니맵 동작 불변)', () => {
    renderWithTheme(<MapWebView html="<html></html>" onMessage={noop} />);
    const webview = screen.getByTestId('mock-webview');
    expect(webview.props.onContentProcessDidTerminate).toBeUndefined();
    expect(webview.props.onRenderProcessGone).toBeUndefined();
  });

  it('W4 webviewKey가 바뀌면 안쪽 WebView만 새로 만들고 컨테이너·오버레이는 그대로다', () => {
    const { rerender } = renderWithTheme(
      <MapWebView html="<html></html>" onMessage={noop} webviewKey={0}>
        <Text>범례 오버레이</Text>
      </MapWebView>,
    );
    const webviewBefore = screen.getByTestId('mock-webview');
    const containerBefore = screen.getByTestId('map-webview-container');
    const overlayBefore = screen.getByText('범례 오버레이');

    rerender(
      <MapWebView html="<html></html>" onMessage={noop} webviewKey={1}>
        <Text>범례 오버레이</Text>
      </MapWebView>,
    );

    expect(screen.getByTestId('mock-webview') !== webviewBefore).toBe(true);
    expect(screen.getByTestId('map-webview-container') === containerBefore).toBe(true);
    expect(screen.getByText('범례 오버레이') === overlayBefore).toBe(true);
  });

  it('W5 같은 webviewKey로 다시 그리면(html·onMessage 새 참조) 안쪽 WebView를 그대로 둔다 — 대조군', () => {
    const { rerender } = renderWithTheme(
      <MapWebView html="<html></html>" onMessage={() => {}} webviewKey={2} />,
    );
    const webviewBefore = screen.getByTestId('mock-webview');

    rerender(<MapWebView html={'<html>' + '</html>'} onMessage={() => {}} webviewKey={2} />);

    expect(screen.getByTestId('mock-webview') === webviewBefore).toBe(true);
  });

  it('W6 webviewMounted=false면 안쪽 WebView와 ref가 없고, 컨테이너 배경·오버레이는 같은 요소로 남는다', () => {
    const ref = React.createRef<MapWebViewHandle>();
    const { rerender } = renderWithTheme(
      <MapWebView html="<html></html>" onMessage={noop} webviewRef={ref}>
        <Text>범례 오버레이</Text>
      </MapWebView>,
    );
    // 대조군: 기본값(붙어 있음)이면 ref에 주입 핸들이 있다 — 없으면 아래 null 단언이 늘 초록이다.
    expect(typeof ref.current?.injectJavaScript).toBe('function');
    const containerBefore = screen.getByTestId('map-webview-container');
    const overlayBefore = screen.getByText('범례 오버레이');

    rerender(
      <MapWebView html="<html></html>" onMessage={noop} webviewRef={ref} webviewMounted={false}>
        <Text>범례 오버레이</Text>
      </MapWebView>,
    );

    expect(screen.queryByTestId('mock-webview')).toBeNull();
    expect(ref.current).toBeNull();
    const container = screen.getByTestId('map-webview-container');
    expect(container === containerBefore).toBe(true);
    expect(StyleSheet.flatten(container.props.style).backgroundColor).toBe('#EFEAE3');
    expect(screen.getByText('범례 오버레이') === overlayBefore).toBe(true);
  });
});
