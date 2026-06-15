// src/features/map/components/MapWebView.spec.tsx
// 지도 WebView 컨테이너 — 프리젠테이션만(react-native-webview 래핑 + props forward).
//   비즈니스 로직(HTML 생성·메시지 파싱·INIT 직렬화)은 developer 몫 → 여기선 forward만 검증.
//   react-native-webview는 developer가 설치(미설치 시 일시 빨간줄 무방) → 테스트는 모듈을 모킹한다.
import React from 'react';
import { Text } from 'react-native';
import { screen } from '@testing-library/react-native';

// react-native-webview 모킹 — props(source.html/onMessage/style)를 노출하는 더미.
//   virtual:true → 패키지 미설치(developer가 추후 설치, plan §5) 상태에서도 모킹 가능.
jest.mock(
  'react-native-webview',
  () => {
    const Rn = require('react-native');
    return {
      WebView: ({ source, onMessage, style }: any) => (
        <Rn.View
          testID="mock-webview"
          accessibilityLabel={source?.html ?? ''}
          // source(html/baseUrl)·onMessage·style를 검증 가능하게 prop으로 노출
          source={source}
          onMessage={onMessage}
          style={style}
        >
          <Rn.Text>webview</Rn.Text>
        </Rn.View>
      ),
    };
  },
  { virtual: true },
);

import { renderWithTheme } from '@/test/renderWithTheme';

import { MapWebView, MAP_WEBVIEW_BASE_URL } from './MapWebView';

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

  it('자식 오버레이(범례·카드)를 WebView 위에 렌더한다', () => {
    renderWithTheme(
      <MapWebView html="<html></html>" onMessage={() => {}}>
        <Text>범례 오버레이</Text>
      </MapWebView>,
    );
    expect(screen.getByText('범례 오버레이')).toBeTruthy();
  });
});
