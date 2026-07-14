// src/navigation/screens/MapTabScreen.tsx
// 지도 탭 — 권한·핀·지도 상태 오케스트레이션 (map-tab 슬라이스 1, plan §4·§5·ui-spec §3 조립 가이드).
//
// 배선(소비): useMuklogPins(핀) + useLocationPermission(현재위치·refreshCoords) + ui-publisher 컴포넌트
//   (MapWebView·MapLegend·MapStatusOverlay·SelectedSpotCard·MapLocateButton). 순수 유틸 mapHtml·
//   pinsToMapMarkers·initialRegion·parseMapMessage·buildInitScript·buildSetMarkersScript·buildRecenterScript로
//   WebView 메시지 계약(§3.5)을 배선한다. handleLocate: FAB 탭 → 위치 재취득 → RECENTER inject(map-locate-button).
//
// 정책: 진입 1회 핀 조회 + 권한 1회 요청 + 명시적 refresh만(폴링/Realtime 없음, 비용 가드레일 §8).
//   현재위치는 RN expo-location으로 받아 INIT.me로 주입(WebView geolocation 미사용 — plan §9.2).
//   ⚠️ 비주얼은 ui-publisher 컴포넌트로만(임의 변경 금지). 상태→tone/message 판단만 여기서 한다.
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  LogPickerSheet,
  MapLegend,
  MapLocateButton,
  MapStatusOverlay,
  MapStatusTone,
  MapWebView,
  NearbySpotCard,
  SelectedSpotCard,
  type LogPickerItem,
  type MapWebViewHandle,
  type MapWebViewMessageEvent,
} from '@/features/map/components';
import {
  buildInitScript,
  buildRecenterScript,
  buildSetMarkersScript,
  buildSetSelectedScript,
} from '@/features/map/mapMessages';
import { formatDistance } from '@/features/map/formatDistance';
import { initialRegion } from '@/features/map/initialRegion';
import { lastCategorySegment } from '@/features/map/lastCategorySegment';
import { mapHtml } from '@/features/map/mapHtml';
import { mergeMapMarkers } from '@/features/map/mergeMapMarkers';
import { nearbyCategoryEmoji } from '@/features/map/nearbyCategoryEmoji';
import { parseMapMessage } from '@/features/map/parseMapMessage';
import { pinsToMapMarkers } from '@/features/map/pinsToMapMarkers';
import { LocationPermissionStatus, MapInboundType, type MuklogPin } from '@/features/map/types';
import { useLocationPermission } from '@/features/map/useLocationPermission';
import { useMuklogPins } from '@/features/map/useMuklogPins';
import { useNearbyPlaces } from '@/features/map/useNearbyPlaces';
import { displayLogName } from '@/features/room/logName';
import { useAddNearbyWish } from '@/features/wishlist';
import { env } from '@/lib/env';
import { useTheme } from '@/theme';

// 상태 안내 카피(ui-spec §4 권고값 — 해요체, 차단 아님). 카피 단일 출처.
const MAP_COPY = {
  loading: '지도를 불러오는 중이에요',
  permissionDenied: '위치 권한을 허용하면 현재 위치를 볼 수 있어요',
  pinsError: '먹로그를 불러오지 못했어요',
  sdkError: '지도를 불러오지 못했어요',
  retry: '다시 시도',
} as const;

export const MapTabScreen = () => {
  const theme = useTheme();
  const { state, refresh } = useMuklogPins();
  const permission = useLocationPermission();
  const nearby = useNearbyPlaces();
  // map-nearby-wish: 주변 카드 "위시에 담기" 오케스트레이션(로그 0/1/2+ 분기·중복 가드·토스트는 훅 내부).
  //   화면은 액션→requestAdd·시트(choosing) 렌더·선택→chooseLog 배선만 하고 비주얼은 컴포넌트가 소유(임의 변경 금지).
  const nearbyWish = useAddNearbyWish();

  // 선택 상태는 {id, saved} 쌍 — saved(muklogId) vs nearby(kakaoPlaceId) id 충돌 방지(plan §4·§6).
  const [selected, setSelected] = useState<{ id: string; saved: boolean } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapErrored, setMapErrored] = useState(false);
  const webviewRef = useRef<MapWebViewHandle>(null);
  // #4: 첫 진입 현위치 자동 센터링 1회 가드. READY 시 coords가 아직 없으면 INIT은 폴백(서울/핀 bbox)
  //   센터를 쓰므로, GPS 첫 픽스로 coords가 도착하면 1회 RECENTER로 현위치에 맞춘다(이후 사용자 이동은 따라가지 않음).
  const autoCenteredRef = useRef(false);

  // 현재 핀 목록(ready일 때만, 아니면 빈 배열 — 지도/INIT는 항상 유효하게 유지).
  const pins: MuklogPin[] = state.status === 'ready' ? state.pins : [];
  // saved 핀(내 맛집) + nearby 핀(주변 음식점) 머지(좌표 근접 dedup) → 지도뷰 전체 마커(plan §3.4·§3.6).
  const savedMarkers = pinsToMapMarkers({ pins });
  const markers = mergeMapMarkers({ saved: savedMarkers, nearby: nearby.markers });
  const center = initialRegion({ coords: permission.coords, pins });
  // HTML은 1회 생성(키 주입). INIT/SET_MARKERS는 injectJavaScript로 주입(SDK 재로드 없음).
  const html = mapHtml({ jsKey: env.KAKAO_JS_KEY });

  // 진입 시 위치 권한 1회 요청(undetermined일 때). request 내부에 중복 가드가 있어 재호출 안전.
  useEffect(
    function requestLocationOnEnter() {
      if (permission.status === LocationPermissionStatus.Undetermined) {
        void permission.request();
      }
    },
    [permission.status],
  );

  const sendInit = () => {
    // INIT center가 이미 현위치면(coords 존재) 자동 RECENTER 불필요 — 1회 가드를 소진한 것으로 본다(#4).
    if (permission.coords) autoCenteredRef.current = true;
    webviewRef.current?.injectJavaScript(
      buildInitScript({ center, markers, me: permission.coords }),
    );
  };

  // 현재위치 FAB 탭(plan §3.7) — 탭당 1회 위치 재취득 후 RECENTER inject(폴링 없음, 비용 가드 §8).
  //   미결정이면 권한 요청 → 거부면 no-op(기존 permissionDenied 배너가 안내, 중복 금지).
  //   refreshCoords가 granted 아니거나 실패+직전coords없음이면 null → no-op(무한 로딩·에러배너 없음).
  const handleLocate = async () => {
    if (permission.status === LocationPermissionStatus.Undetermined) {
      await permission.request();
    }
    if (permission.status === LocationPermissionStatus.Denied) return;
    const me = await permission.refreshCoords();
    if (!me) return;
    webviewRef.current?.injectJavaScript(buildRecenterScript({ me }));
  };

  // WebView → RN 메시지 디스패치(파싱은 parseMapMessage). 비JSON/미지는 조용히 무시.
  const handleMessage = (event: MapWebViewMessageEvent) => {
    const message = parseMapMessage({ raw: event.nativeEvent.data });
    if (!message) return;

    if (message.type === MapInboundType.Ready) {
      setMapErrored(false);
      setMapReady(true);
      sendInit();
      return;
    }
    if (message.type === MapInboundType.MarkerTap) {
      // saved 플래그로 카드 분기(id 단독 lookup 금지 — 좌표 충돌 방어).
      setSelected({ id: message.id, saved: message.saved });
      return;
    }
    if (message.type === MapInboundType.BoundsChanged) {
      // idle viewport bbox → nearby 조회(디바운스/캐시/임계는 useNearbyPlaces가 전담).
      nearby.setBounds({ sw: message.sw, ne: message.ne });
      return;
    }
    if (message.type === MapInboundType.MapTap) {
      // map-pin-select: 지도 빈 곳 탭 → 선택 해제(카드 닫힘 + 활성 강조 해제). SET_SELECTED(null)는 effect가 주입.
      setSelected(null);
      return;
    }
    if (message.type === MapInboundType.Error) {
      setMapErrored(true);
    }
  };

  // nearby 마커 변경(또는 saved 핀 변경) 시 SET_MARKERS 재주입 — READY 이후에만(SDK 준비 전 무의미).
  //   slice1 경로(SET_MARKERS) 재사용 — 신규 outbound 메시지 불필요(plan §3.6). markers 키로 발화.
  const markersKey = markers.map((m) => `${m.id}:${m.saved ? 1 : 0}`).join('|');
  useEffect(
    function reinjectMarkersOnChange() {
      if (!mapReady) return;
      webviewRef.current?.injectJavaScript(buildSetMarkersScript({ markers }));
    },
    [markersKey, mapReady],
  );

  // map-pin-select: 선택 변경 시 SET_SELECTED 주입(활성 핀 id·해제 시 null). markers 채널과 독립 —
  //   selection 변경이 마커 재생성을 유발하지 않고(markersKey에 selection 미포함), HTML은 클래스만 토글(§3.6).
  const selectedId = selected ? selected.id : null;
  useEffect(
    function syncSelectionToMap() {
      if (!mapReady) return;
      webviewRef.current?.injectJavaScript(buildSetSelectedScript({ selectedId }));
    },
    [selectedId, mapReady],
  );

  // map-pin-select(T7): 선택된 nearby 핀이 목록에서 사라지면(viewport 이탈/dedup) selected 정리 →
  //   NearbySpotCard 자동 닫힘과 SET_SELECTED(null)를 일관되게 맞춘다. saved 핀은 항상 렌더라 해당 없음.
  const nearbyItems = nearby.items;
  useEffect(
    function clearSelectionWhenNearbyGone() {
      if (!selected || selected.saved) return;
      const stillPresent = nearbyItems.some((it) => it.kakaoPlaceId === selected.id);
      if (!stillPresent) setSelected(null);
    },
    [selected, nearbyItems],
  );

  // #4: READY 이후 현위치(coords)가 처음 도착하면 1회 자동 RECENTER(서울 폴백 고정 해제).
  //   READY 시 coords가 있었으면 INIT이 이미 현위치 센터라 sendInit이 가드를 소진 → 여기선 no-op.
  //   1회 가드(autoCenteredRef)로 이후 사용자 이동(coords 변경)은 따라가지 않는다(FAB로만 재센터).
  const myCoords = permission.coords;
  useEffect(
    function autoRecenterOnFirstFix() {
      if (!mapReady) return;
      if (autoCenteredRef.current) return;
      if (!myCoords) return;
      autoCenteredRef.current = true;
      webviewRef.current?.injectJavaScript(buildRecenterScript({ me: myCoords }));
    },
    [mapReady, myCoords],
  );

  // 재시도: 핀 에러는 refresh, 지도 SDK 에러는 INIT 재주입(SDK가 살아있으면 즉시 복구) + 핀 재조회.
  const handleRetry = () => {
    setMapErrored(false);
    void refresh();
    sendInit();
  };

  // saved 핀 선택 → SelectedSpotCard. nearby 핀 선택 → NearbySpotCard(item lookup + 거리 포맷).
  const selectedPin =
    selected && selected.saved ? pins.find((p) => p.muklogId === selected.id) ?? null : null;
  const selectedNearby =
    selected && !selected.saved
      ? nearby.items.find((it) => it.kakaoPlaceId === selected.id) ?? null
      : null;
  // 로그 2+개 담기 분기 시트 항목 — choosing.logs(MyLog[])를 LogPickerItem으로 매핑.
  //   label은 displayLogName으로 산출(퍼블리셔 미소유). selfNickname은 미주입(null) — 표시명 폴백은
  //   커플 "우리 로그"/솔로 "내 로그"(닉네임은 같은 사용자 로그 간 구분에 무의미하므로 이름 우선).
  const pickerLogs: LogPickerItem[] = (nearbyWish.choosing?.logs ?? []).map((log) => ({
    roomId: log.roomId,
    label: displayLogName({ name: log.name, memberCount: log.memberCount, selfNickname: null }),
    memberCount: log.memberCount,
  }));
  // 하단 스팟 카드 도킹 여부 — FAB가 카드에 가려지지 않게 위로 띄우는 데 사용(ui-spec §4).

  // 상태 → 오버레이(tone/message) 판단(ui-spec §3 매핑). 우선순위: 지도 SDK 에러 → 핀 에러 → 로딩 → 빈/권한안내.
  const overlay = ((): {
    tone: MapStatusTone;
    message: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null => {
    if (mapErrored) {
      return {
        tone: MapStatusTone.Error,
        message: MAP_COPY.sdkError,
        actionLabel: MAP_COPY.retry,
        onAction: handleRetry,
      };
    }
    if (state.status === 'error') {
      return {
        tone: MapStatusTone.Error,
        message: MAP_COPY.pinsError,
        actionLabel: MAP_COPY.retry,
        onAction: handleRetry,
      };
    }
    if (state.status === 'loading') {
      return { tone: MapStatusTone.Loading, message: MAP_COPY.loading };
    }
    // ready: 권한 거부 안내만(빈 상태 안내는 제거 — 사용자 요청. 핀 0개여도 지도만 깔끔히 표시).
    if (permission.status === LocationPermissionStatus.Denied) {
      return { tone: MapStatusTone.Info, message: MAP_COPY.permissionDenied };
    }
    return null;
  })();

  return (
    <View style={styles.root}>
      <MapWebView html={html} onMessage={handleMessage} webviewRef={webviewRef}>
        {/* 범례 — 좌상단 오버레이(ui-spec §2.2: top/left 배치는 부모 책임). */}
        <View style={[styles.legend, { top: theme.spacing[14], left: theme.spacing[16] }]}>
          <MapLegend />
        </View>

        {/* 상태 오버레이 — 차단 아님(지도 위 배너). */}
        {overlay ? (
          <View pointerEvents="box-none" style={styles.overlay}>
            <MapStatusOverlay
              tone={overlay.tone}
              message={overlay.message}
              actionLabel={overlay.actionLabel}
              onAction={overlay.onAction}
            />
          </View>
        ) : null}

        {/* 현재위치 FAB — 지도 영역(MapWebView) 우하단 16px 고정(킷 mk-home:290-298: 지도 div 내 right/bottom 16).
            카드(SelectedSpot/NearbySpot)는 MapWebView 바깥 형제라, 도킹 시 MapWebView(flex:1)가 줄고
            FAB는 지도 영역 바닥 16px 고정이라 자동으로 카드 위에 온다 — offset 변동 없이 항상 같은 위치. */}
        <View style={[styles.locate, { right: theme.spacing[16], bottom: theme.spacing[16] }]}>
          <MapLocateButton testID="map-locate-button" onPress={handleLocate} />
        </View>
      </MapWebView>

      {/* 선택 스팟 카드 — saved 핀 탭 시 하단 도킹(내 맛집). */}
      {selectedPin ? (
        <SelectedSpotCard
          placeName={selectedPin.placeName}
          rating={selectedPin.rating}
          category={selectedPin.category}
          area={selectedPin.area}
        />
      ) : null}

      {/* 주변 스팟 카드 — nearby 핀 탭 시 하단 도킹(이름·카테고리·거리, 별점/area/heart 없음).
          "위시에 담기" 액션(onAddWish) → requestAdd가 로그 개수 분기·담기를 처리. adding=담는 중 로딩 가드. */}
      {selectedNearby ? (
        <NearbySpotCard
          placeName={selectedNearby.placeName}
          categoryName={lastCategorySegment({ categoryName: selectedNearby.categoryName })}
          coverEmoji={nearbyCategoryEmoji({
            categoryName: selectedNearby.categoryName,
            categoryGroupCode: selectedNearby.categoryGroupCode,
          })}
          distanceText={formatDistance({ distance: selectedNearby.distance })}
          onAddWish={() => nearbyWish.requestAdd({ item: selectedNearby })}
          adding={nearbyWish.submitting}
        />
      ) : null}

      {/* 대상 로그 선택 시트 — 로그 2+개일 때만 훅이 choosing을 세팅(visible). 행 탭 → chooseLog(그 roomId로 담기),
          딤/드래그-다운(onClose) → dismiss(담기 미발생). 로그 0/1개는 시트 없이 훅이 처리. */}
      <LogPickerSheet
        visible={nearbyWish.choosing !== null}
        onClose={nearbyWish.dismiss}
        logs={pickerLogs}
        onSelect={nearbyWish.chooseLog}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  legend: { position: 'absolute' },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  // 현재위치 FAB — 우하단 절대배치(right/bottom은 인라인 토큰, ui-spec §4.2).
  locate: { position: 'absolute' },
});
