// src/features/map/components/MapWebView.tsx
// 지도 WebView 컨테이너 — 프리젠테이션 전용 (map-tab 슬라이스 1, plan §3.5/§4).
//   책임: react-native-webview를 지도 영역(flex:1)으로 꽉 채우고, props{ html, onMessage, style }를 그대로 forward.
//          자식(children)을 WebView 위 오버레이로 absolute 배치(범례·선택 카드·상태 오버레이의 z-순서/레이아웃).
//   NON-책임(developer 몫): HTML 생성·INIT 직렬화·메시지 파싱·SET_MARKERS injectJavaScript 등 비즈니스 로직.
//          이 컴포넌트는 html 문자열과 onMessage 콜백을 받기만 한다(가공하지 않음).
//
//   ⚠️ 의존성: react-native-webview는 developer가 설치한다(plan §5 "의존성 추가").
//      미설치 동안 아래 import에 일시적 타입 에러(빨간줄)가 날 수 있음 — 정상(설치 후 해소).
import React from 'react';
import { StyleSheet, View } from 'react-native';
// eslint-disable-next-line import/no-unresolved -- developer가 설치(plan §5). 미설치 시 일시 빨간줄 무방.
import { WebView } from 'react-native-webview';

import type { StyleProp, ViewStyle } from 'react-native';

// onMessage 이벤트의 최소 형태(webview 타입 의존 없이 forward 시그니처 고정).
//   실제 react-native-webview WebViewMessageEvent와 구조 호환(nativeEvent.data:string).
export type MapWebViewMessageEvent = { nativeEvent: { data: string } };

// RN → WebView 주입 핸들(injectJavaScript)만 노출. developer가 INIT/SET_MARKERS 스크립트를 주입한다.
//   ⚠️ 비주얼 아님 — 메시지 계약(plan §3.5) 배선용 ref forward. ui-publisher 검토 요청(dev-notes).
export type MapWebViewHandle = { injectJavaScript: (script: string) => void };

// WebView source.baseUrl — Kakao JS SDK가 origin 화이트리스트를 검증할 때 쓰는 로컬 HTML의 origin.
//   ⚠️ 비주얼 아님(SDK 도메인 검증용 plumbing). 카카오 콘솔 Web 플랫폼 등록 도메인과 **글자 그대로 일치**해야 한다
//      — scheme 포함(https, http 아님)·끝 슬래시 없음. 불일치 시 SDK가 ERROR(인증 실패)로 응답한다(dev-notes §6).
export const MAP_WEBVIEW_BASE_URL = 'https://localhost' as const;

export type MapWebViewProps = {
  /** 지도 HTML(Kakao Map JS SDK 임베드). 생성은 developer 몫 — 받기만 한다. */
  html: string;
  /** WebView → RN postMessage 핸들러. 파싱/디스패치는 developer 몫. */
  onMessage: (event: MapWebViewMessageEvent) => void;
  /** RN → WebView 주입 핸들. developer가 READY 후 INIT·refresh 후 SET_MARKERS를 주입한다(비주얼 아님). */
  webviewRef?: React.Ref<MapWebViewHandle>;
  /** 컨테이너 추가 스타일(지도 영역 크기 등). */
  style?: StyleProp<ViewStyle>;
  /** WebView 위에 얹을 오버레이(범례·선택 스팟 카드·상태 오버레이). */
  children?: React.ReactNode;
};

export const MapWebView = ({ html, onMessage, webviewRef, style, children }: MapWebViewProps) => (
  <View style={[styles.container, style]}>
    <WebView
      testID="map-webview"
      ref={webviewRef as React.Ref<WebView>}
      style={styles.webview}
      originWhitelist={['*']}
      source={{ html, baseUrl: MAP_WEBVIEW_BASE_URL }}
      onMessage={onMessage}
    />
    {/* 오버레이 — 지도 위 absolute 레이어. pointerEvents box-none으로 지도 제스처는 통과시키고 칩/카드만 입력 받음. */}
    {children ? (
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {children}
      </View>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  webview: { flex: 1 },
});
