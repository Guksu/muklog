// src/features/map/components/MuklogMiniMap.spec.tsx
// 먹로그 상세 미니맵 — 좌표+KAKAO_JS_KEY 있으면 지도(WebView), 없으면 텍스트 폴백.
//   env(KAKAO_JS_KEY)·react-native-webview 모킹으로 분기만 검증(실 지도 렌더는 디바이스 스모크).
import React from 'react';
import { screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

// env: 기본 키 있음(지도 경로). 키 없는 폴백은 테스트에서 오버라이드.
jest.mock('@/lib/env', () => ({ env: { KAKAO_JS_KEY: 'test-js-key' } }));
// react-native-webview: 실제 WebView(네이티브 모듈) 대신 testID 스텁. virtual:true — MapWebView.spec와 동일(네이티브 모듈 회피).
jest.mock(
  'react-native-webview',
  () => {
    const Rn = require('react-native');
    return { WebView: (props: Record<string, unknown>) => <Rn.View testID="webview" {...props} /> };
  },
  { virtual: true },
);

import { env } from '@/lib/env';
import { MuklogMiniMap } from './MuklogMiniMap';

const envMock = env as { KAKAO_JS_KEY: string };

beforeEach(() => {
  envMock.KAKAO_JS_KEY = 'test-js-key';
});

describe('MuklogMiniMap', () => {
  it('좌표+키가 있으면 미니맵(WebView)을 렌더한다', () => {
    renderWithTheme(<MuklogMiniMap lat={37.5} lng={127.0} fallbackText="서울 어딘가" />);
    expect(screen.getByTestId('muklog-detail-minimap')).toBeTruthy();
    expect(screen.queryByTestId('muklog-detail-map-stub')).toBeNull();
  });

  it('좌표가 없으면(null) 지도 대신 폴백 텍스트 박스를 렌더한다', () => {
    renderWithTheme(<MuklogMiniMap lat={null} lng={null} fallbackText="위치 정보가 아직 없어요" />);
    expect(screen.queryByTestId('muklog-detail-minimap')).toBeNull();
    expect(screen.getByTestId('muklog-detail-map-stub')).toBeTruthy();
    expect(screen.getByText('위치 정보가 아직 없어요')).toBeTruthy();
  });

  it('KAKAO_JS_KEY가 없으면 좌표가 있어도 폴백한다(키 없으면 빈 지도 → 폴백)', () => {
    envMock.KAKAO_JS_KEY = '';
    renderWithTheme(<MuklogMiniMap lat={37.5} lng={127.0} fallbackText="서울 어딘가" />);
    expect(screen.queryByTestId('muklog-detail-minimap')).toBeNull();
    expect(screen.getByTestId('muklog-detail-map-stub')).toBeTruthy();
  });
});
