// src/features/map/components/MapWebView.tsx
// 지도 WebView 컨테이너 — 프리젠테이션 전용 (map-tab 슬라이스 1, plan §3.5/§4).
//   책임: react-native-webview를 지도 영역(flex:1)으로 꽉 채우고, props{ html, onMessage, style }를 그대로 forward.
//          자식(children)을 WebView 위 오버레이로 absolute 배치(범례·선택 카드·상태 오버레이의 z-순서/레이아웃).
//   NON-책임(developer 몫): HTML 생성·INIT 직렬화·메시지 파싱·SET_MARKERS injectJavaScript 등 비즈니스 로직.
//          이 컴포넌트는 html 문자열과 onMessage 콜백을 받기만 한다(가공하지 않음).
//   map-webview-recovery(U71·U62): WebView 프로세스 종료 신호 2종(iOS 콘텐츠 프로세스·Android 렌더 프로세스)을 인자 없는
//          onTerminated 하나로 올리고, webviewKey로 안쪽 WebView만 새로 만들고, webviewMounted=false면 끝난 WebView를
//          떼어 낸다. 셋 다 선택 prop이라 주지 않는 호출처(MapPrewarm·MuklogMiniMap)의 동작은 그대로다.
//          ⚠️ 비주얼 아님 — 재마운트 판단(언제·몇 번)은 호출부(MapTabScreen) 몫이고 여기선 배선만 한다.
//
//   ⚠️ 의존성: react-native-webview는 developer가 설치한다(plan §5 "의존성 추가").
//      미설치 동안 아래 import에 일시적 타입 에러(빨간줄)가 날 수 있음 — 정상(설치 후 해소).
import React from 'react';
import { StyleSheet, View } from 'react-native';
// eslint-disable-next-line import/no-unresolved -- developer가 설치(plan §5). 미설치 시 일시 빨간줄 무방.
import { WebView } from 'react-native-webview';

import { useTheme } from '@/theme';

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
  /**
   * WebView를 그리던 프로세스가 끝났을 때 1회 호출한다. 인자 없음.
   * iOS `onContentProcessDidTerminate`, Android `onRenderProcessGone`(didCrash true·false 모두)을 하나로 합친다.
   * 주지 않으면 두 종료 prop을 WebView에 넘기지 않는다(프리워머·미니맵 동작 불변).
   */
  onTerminated?: () => void;
  /** 안쪽 WebView의 React key. 값이 바뀌면 WebView만 새로 만든다(컨테이너·children은 그대로). 기본 0. */
  webviewKey?: number;
  /**
   * false면 안쪽 WebView를 렌더하지 않는다 — 프로세스가 끝나 다시 쓸 수 없는 WebView를 떼어 낼 때.
   * 컨테이너 배경(mapSurface)과 children은 그대로 그리고, webviewRef는 null이 된다. 기본 true.
   */
  webviewMounted?: boolean;
};

export const MapWebView = ({
  html,
  onMessage,
  webviewRef,
  style,
  children,
  onTerminated,
  webviewKey = 0,
  webviewMounted = true,
}: MapWebViewProps) => {
  const theme = useTheme();
  // 종료 신호는 플랫폼 이벤트 객체를 버리고 "끝났다"만 올린다(계약: 인자 없음). onTerminated가 없으면 prop 자체를 넘기지 않는다.
  //   Android는 렌더 프로세스가 끝나도 라이브러리가 늘 "처리함"을 돌려줘 앱은 살지만 그 WebView는 다시 쓸 수 없다 —
  //   새로 만들거나 떼어 내는 책임이 호출부에 있다(webviewKey·webviewMounted).
  const handleTerminated = onTerminated ? () => onTerminated() : undefined;
  return (
    <View
      testID="map-webview-container"
      // 지도 캔버스 소유자가 자기 배경을 갖는다 — WebView가 HTML을 페인트하기 전 첫 프레임은 이 뷰 배경이라
      //   미지정(흰색)이면 mapHtml의 배경만으로는 흰 점멸이 한 프레임 남는다(map-feedback U5).
      //   MapPrewarm의 숨은 WebView에도 자동 적용된다.
      style={[styles.container, { backgroundColor: theme.color.mapSurface }, style]}
    >
      {/* 안쪽 WebView — key가 바뀌면 이 자리만 새 인스턴스가 되고, false면 비워 둔다(자리를 null로 지켜 아래 오버레이는
          같은 요소로 남는다 — 필터 바·카드가 다시 만들어지지 않는다). */}
      {webviewMounted ? (
        <WebView
          key={webviewKey}
          testID="map-webview"
          ref={webviewRef as React.Ref<WebView>}
          style={styles.webview}
          originWhitelist={['*']}
          source={{ html, baseUrl: MAP_WEBVIEW_BASE_URL }}
          onMessage={onMessage}
          onContentProcessDidTerminate={handleTerminated}
          onRenderProcessGone={handleTerminated}
        />
      ) : null}
      {/* 오버레이 — 지도 위 absolute 레이어. pointerEvents box-none으로 지도 제스처는 통과시키고 칩/카드만 입력 받음. */}
      {children ? (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          {children}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  webview: { flex: 1 },
});
