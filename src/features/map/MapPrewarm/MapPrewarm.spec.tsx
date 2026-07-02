// src/features/map/MapPrewarm.spec.tsx
// 루트 숨김 WebView 프리워머 — SDK 부팅만 워밍, 권한 팝업·RPC 미보유(map-prewarm T2·T3·T4·T6).
//   전략 A′: 프리워머는 useLocationPermission·useMuklogPins을 import하지 않고 INIT도 안 보낸다(blank 부팅).
//   콜드스타트 비경합: useDeferredFlag로 첫 프레임 후/유휴 시점에만 WebView 마운트(T6).
import fs from 'fs';
import path from 'path';

import React from 'react';
import * as Location from 'expo-location';
import { screen } from '@testing-library/react-native';

// useDeferredFlag 모킹 — 기본 즉시 true(렌더 분기 검증을 단순화). T6은 플래그 false 케이스로 별도 검증.
const mockDeferredFlag = jest.fn<boolean, [unknown]>(() => true);
jest.mock('@/features/map/useDeferredFlag', () => ({
  useDeferredFlag: (args: unknown) => mockDeferredFlag(args),
}));

// react-native-webview 모킹 — injectJavaScript 캡처(프리워머가 INIT을 주입하지 않음을 검증)·source.html 노출.
const mockInjectJavaScript = jest.fn();
jest.mock(
  'react-native-webview',
  () => {
    const Rn = require('react-native');
    const ReactModule = require('react');
    const WebView = ReactModule.forwardRef(
      ({ source, onMessage, style, testID }: any, ref: any) => {
        ReactModule.useImperativeHandle(ref, () => ({ injectJavaScript: mockInjectJavaScript }));
        return (
          <Rn.View
            testID={testID ?? 'mock-webview'}
            accessibilityLabel={source?.html ?? ''}
            source={source}
            onMessage={onMessage}
            style={style}
          />
        );
      },
    );
    return { WebView };
  },
  { virtual: true },
);

// expo-location 모킹 — 프리워밍 경로에서 권한 다이얼로그가 0회임을 검증(T3).
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({ coords: { latitude: 0, longitude: 0 } }),
  Accuracy: { Balanced: 3 },
}));

// supabase.rpc 모킹 — 프리워밍 경로에서 list_my_muklog_pins가 0회임을 검증(T4).
const mockRpc = jest.fn().mockResolvedValue({ data: [], error: null });
jest.mock('@/lib/supabase', () => ({ supabase: { rpc: (...args: unknown[]) => mockRpc(...args) } }));

// env 모킹 — KAKAO_JS_KEY만 필요(실 env required throw 회피, setup 더미와 무관하게 결정적). MapTabScreen.spec과 동일.
jest.mock('@/lib/env', () => ({ env: { KAKAO_JS_KEY: 'TEST_KEY' } }));

import { renderWithTheme } from '@/test/renderWithTheme';

import { MapPrewarm } from './MapPrewarm';

const requestPermsMock = Location.requestForegroundPermissionsAsync as jest.Mock;

beforeEach(() => {
  mockInjectJavaScript.mockClear();
  requestPermsMock.mockClear();
  mockRpc.mockClear();
  mockDeferredFlag.mockReset();
  mockDeferredFlag.mockReturnValue(true);
});

// 프리워머는 접근성 트리에서 숨겨지므로(accessibilityElementsHidden) hidden 포함 쿼리로 검증.
const HIDDEN = { includeHiddenElements: true } as const;

describe('MapPrewarm (격리)', () => {
  it('enabled=false면 WebView를 렌더하지 않는다 (킬 스위치)', () => {
    renderWithTheme(<MapPrewarm enabled={false} />);
    expect(screen.queryByTestId('map-prewarm-webview', HIDDEN)).toBeNull();
  });

  it('enabled=false면 useDeferredFlag도 활성화하지 않는다 (불필요한 타이머 0)', () => {
    renderWithTheme(<MapPrewarm enabled={false} />);
    // enabled가 false면 deferred를 굳이 켜지 않음(킬 스위치는 어떤 부작용도 없어야 함).
    // useDeferredFlag는 호출돼도 그 결과로 WebView를 렌더하지 않으면 충분 — 렌더 부재로 보증.
    expect(screen.queryByTestId('map-prewarm-webview', HIDDEN)).toBeNull();
  });

  it('enabled=true + deferred=true면 mapHtml로 숨김 WebView 1개를 마운트한다', () => {
    renderWithTheme(<MapPrewarm enabled />);
    const containers = screen.queryAllByTestId('map-prewarm-webview', HIDDEN);
    expect(containers).toHaveLength(1);
    // mapHtml 임베드 확인 — MapWebView가 내부 WebView에 testID="map-webview"를 부여, source.html 노출.
    const inner = screen.getByTestId('map-webview', HIDDEN);
    expect(inner.props.source.html).toContain('kakao');
  });

  it('enabled 기본값(미지정)은 true다', () => {
    renderWithTheme(<MapPrewarm />);
    expect(screen.queryByTestId('map-prewarm-webview', HIDDEN)).toBeTruthy();
  });

  it('deferred=false면(첫 프레임 전) WebView를 마운트하지 않는다 — T6 콜드스타트 비경합', () => {
    mockDeferredFlag.mockReturnValue(false);
    renderWithTheme(<MapPrewarm enabled />);
    expect(screen.queryByTestId('map-prewarm-webview', HIDDEN)).toBeNull();
  });

  it('INIT/SET_MARKERS/RECENTER를 주입하지 않는다 (blank 부팅 — injectJavaScript 0회)', () => {
    renderWithTheme(<MapPrewarm enabled />);
    expect(mockInjectJavaScript).not.toHaveBeenCalled();
  });

  it('위치 권한 다이얼로그를 앞당기지 않는다 (requestForegroundPermissionsAsync 0회) — T3', () => {
    renderWithTheme(<MapPrewarm enabled />);
    expect(requestPermsMock).not.toHaveBeenCalled();
  });

  it('핀 RPC(list_my_muklog_pins)를 앞당기지 않는다 (rpc 0회) — T4', () => {
    renderWithTheme(<MapPrewarm enabled />);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('소스에서 useLocationPermission·useMuklogPins을 import하지 않는다 (구조적 격리 정적 검사)', () => {
    const source = fs.readFileSync(path.join(__dirname, 'MapPrewarm.tsx'), 'utf8');
    // 주석(설명)이 아닌 실제 코드에서 두 훅을 import/호출하지 않음을 검증.
    //   → 라인 주석(//)을 제거한 코드 본문에 두 식별자가 등장하면 실패(권한 팝업·RPC 앞당김 차단의 핵심).
    const codeOnly = source
      .split('\n')
      .map((line) => line.replace(/\/\/.*$/, ''))
      .join('\n');
    expect(codeOnly).not.toMatch(/useLocationPermission/);
    expect(codeOnly).not.toMatch(/useMuklogPins/);
  });
});
