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
  CategoryFilterBar,
  LogPickerSheet,
  MapLegend,
  MapLocateButton,
  MapStatusOverlay,
  MapStatusTone,
  MapWebView,
  NearbySpotCard,
  SelectedSpotCard,
  WishSpotCard,
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
import { filterByAppCategory } from '@/features/map/filterByAppCategory';
import { filterNearbyByCategory } from '@/features/map/filterNearbyByCategory';
import { mergeMapMarkers } from '@/features/map/mergeMapMarkers';
import { nearbyCategoryEmoji } from '@/features/map/nearbyCategoryEmoji';
import { nearbyToMapMarkers } from '@/features/map/nearbyToMapMarkers';
import { parseMapMessage } from '@/features/map/parseMapMessage';
import { pinsToMapMarkers } from '@/features/map/pinsToMapMarkers';
import {
  LocationCoordsSource,
  LocationPermissionStatus,
  MapInboundType,
  MapPinKind,
  type MuklogPin,
  type WishPin,
} from '@/features/map/types';
import { useLocationPermission } from '@/features/map/useLocationPermission';
import { useMuklogPins } from '@/features/map/useMuklogPins';
import { useNearbyPlaces } from '@/features/map/useNearbyPlaces';
import { useWishPins } from '@/features/map/useWishPins';
import { wishPinEmoji, wishToMapMarkers } from '@/features/map/wishToMapMarkers';
import { type MuklogCategoryKey } from '@/features/muklog/categories';
import { displayLogName } from '@/features/room/logName';
import { useAddNearbyWish } from '@/features/wishlist';
import { env } from '@/lib/env';
import { useTheme } from '@/theme';

import { useRefreshOnFocus } from '../../useRefreshOnFocus';

// 상태 안내 카피(ui-spec §4 권고값 — 해요체, 차단 아님). 카피 단일 출처.
const MAP_COPY = {
  loading: '지도를 불러오는 중이에요',
  permissionDenied: '위치 권한을 허용하면 현재 위치를 볼 수 있어요',
  pinsError: '먹로그를 불러오지 못했어요',
  sdkError: '지도를 불러오지 못했어요',
  retry: '다시 시도',
} as const;

/**
 * 좌표 출처를 정밀도 순위로 환산한다(폴백 0 < warm 1 < fresh 2).
 * 지도 센터를 "더 정밀한 좌표가 도착했을 때만" 보정하기 위한 단조 비교의 단일 출처다.
 * @param source 좌표 출처(좌표가 없거나 폴백 센터면 null)
 * @returns 정밀도 순위(0~2)
 */
const rankCoordsSource = ({ source }: { source: LocationCoordsSource | null }): number => {
  if (source === LocationCoordsSource.Fresh) return 2;
  if (source === LocationCoordsSource.Warm) return 1;
  return 0;
};

export const MapTabScreen = () => {
  const theme = useTheme();
  const { state, refresh } = useMuklogPins();
  const permission = useLocationPermission();
  const nearby = useNearbyPlaces();
  // map-wish-pins: 내 모든 로그의 좌표 있는 위시 핀(크로스-로그, RLS 스코프). 마운트 1회 + 포커스/add-후 refresh.
  const wishPins = useWishPins();
  // map-nearby-wish: 주변 카드 "위시에 담기" 오케스트레이션(로그 0/1/2+ 분기·중복 가드·토스트는 훅 내부).
  //   화면은 액션→requestAdd·시트(choosing) 렌더·선택→chooseLog 배선만 하고 비주얼은 컴포넌트가 소유(임의 변경 금지).
  //   onAdded: 담기 성공 직후 위시 핀 즉시 refresh(같은 화면 반영 — map-wish-pins §4.3).
  const nearbyWish = useAddNearbyWish({ onAdded: wishPins.refresh });

  // 선택 상태는 {id, kind} 쌍 — kind(saved|nearby|wish)로 id 네임스페이스 충돌 방지 + 카드 3분기(map-wish-pins §3.4).
  const [selected, setSelected] = useState<{ id: string; kind: MapPinKind } | null>(null);
  // map-category-filter: 카테고리 필터(클라 전용 state, null="전체"). 백엔드·조회 재실행 0 — 이미 받은 데이터의 표시 필터.
  const [category, setCategory] = useState<MuklogCategoryKey | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapErrored, setMapErrored] = useState(false);
  const webviewRef = useRef<MapWebViewHandle>(null);
  // #4·map-initial-location: 지도 센터가 "지금 어떤 정밀도의 좌표로 그려져 있는지"를 기록한다
  //   (null=폴백 센터(서울/핀 bbox) · Warm=OS 캐시 근사 · Fresh=정밀 픽스).
  //   더 정밀한 좌표가 도착할 때만 1회 보정하므로(단조 승격) 별도의 "자동 센터링 1회" 플래그가 필요 없다 —
  //   폴백→warm, warm→fresh는 각각 1회 발화하고, 같은 정밀도의 좌표 갱신(사용자 이동)은 따라가지 않는다.
  const centeredSourceRef = useRef<LocationCoordsSource | null>(null);

  // 현재 핀 목록(ready일 때만, 아니면 빈 배열 — 지도/INIT는 항상 유효하게 유지).
  const pins: MuklogPin[] = state.status === 'ready' ? state.pins : [];
  // 위시 핀 목록(ready일 때만 — 조회 실패/로딩이어도 지도·먹로그·주변은 정상, 위시 핀만 생략 best-effort §4.2).
  const wishPinsList: WishPin[] = wishPins.state.status === 'ready' ? wishPins.state.pins : [];
  // saved(내 맛집) + wish(위시) + nearby(주변) 3-way 머지(좌표 근접 dedup, 우선순위 saved>wish>nearby) → 지도뷰 전체 마커.
  // map-category-filter: 3소스를 마커 변환 "전에" 카테고리로 필터(순수 파생, 재조회 0). category=null이면 원본 통과.
  //   saved/wish는 category 필드 직접 비교(filterByAppCategory), nearby는 mapKakaoCategory 파생 비교(filterNearbyByCategory).
  const savedMarkers = pinsToMapMarkers({ pins: filterByAppCategory({ items: pins, category }) });
  const wishMarkers = wishToMapMarkers({ pins: filterByAppCategory({ items: wishPinsList, category }) });
  const nearbyMarkers = nearbyToMapMarkers({
    items: filterNearbyByCategory({ items: nearby.items, category }),
  });
  const markers = mergeMapMarkers({ saved: savedMarkers, wish: wishMarkers, nearby: nearbyMarkers });
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

  // 지도 탭 포커스마다 위시 핀 + 먹로그(saved) 핀 재조회(로그에서 추가/삭제·방 나가기 후 복귀 반영). 폴링 아님 — 포커스 단위.
  //   바텀탭 화면은 첫 진입 후 언마운트되지 않으므로 마운트 1회 조회만으로는 세션 내내 stale(H1) — 위시 핀과 대칭으로 saved 핀도 refresh한다.
  //   첫 포커스도 갱신해야 하므로 skipFirst:false(refresh가 loading으로 되돌리지 않아 마운트 조회와 중복이어도 무해, §4.3).
  useRefreshOnFocus({
    refresh: () => {
      void wishPins.refresh();
      void refresh();
    },
    skipFirst: false,
  });

  const sendInit = () => {
    // INIT이 어떤 좌표로 그려지는지를 그대로 기록한다 — 좌표가 없으면 폴백 센터(null)다.
    //   좌표 "보유" 여부로 뭉뚱그리면 두 방향으로 어긋난다: warm으로 INIT한 뒤 정밀 픽스가 막히거나(원버그),
    //   폴백으로 INIT한 뒤 도착한 warm이 지도에 반영되지 않는다(qa-report-logic L1).
    centeredSourceRef.current = permission.coords ? permission.coordsSource : null;
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
    const fix = await permission.refreshCoords();
    if (!fix) return;
    // 지도 센터를 방금 리센터한 좌표의 **실제 출처**로 기록한다 — 자동 보정이 같은 좌표를 한 번 더
    //   주입하지 않게 하면서(L2), 재취득이 실패해 warm 좌표로 폴백한 경우엔 이후 정밀 픽스 보정이
    //   그대로 살아있게 한다. "FAB로 받았으니 fresh"라고 단정하면 근사 좌표에 정밀 딱지가 붙는다.
    centeredSourceRef.current = fix.source;
    webviewRef.current?.injectJavaScript(buildRecenterScript({ me: fix.coords }));
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
      // kind로 카드 분기(id 단독 lookup 금지 — id 네임스페이스 충돌 방어, map-wish-pins §6).
      setSelected({ id: message.id, kind: message.kind });
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
  const markersKey = markers.map((m) => `${m.id}:${m.kind}`).join('|');
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

  // 활성 핀 정리 — 선택된 핀이 표시 마커(필터·머지·dedup 후 최종 집합)에서 빠지면 selection 해제
  //   → 카드 자동 닫힘 + SET_SELECTED(null) 일관. nearby viewport 이탈·wish 삭제·카테고리 필터아웃(T4)을
  //   한 곳에서 처리(map-pin-select 선례 일반화, 3 kind 공통). saved도 필터아웃되면 정리된다.
  useEffect(
    function clearSelectionWhenPinGone() {
      if (!selected) return;
      const present = markers.some((m) => m.id === selected.id);
      if (!present) setSelected(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- markersKey(마커 집합 요약)로 발화. markers 배열은 매 렌더 새 참조라 제외(본문 setSelected(null) 가드로 루프 없음).
    [selected, markersKey],
  );

  // #4·map-initial-location: 지금 지도에 그려진 센터보다 "더 정밀한" 좌표가 도착하면 1회 RECENTER.
  //   폴백 센터(서울/핀 bbox) → warm 도착: 보정한다(qa L1 — 손에 쥔 좌표가 지도에 반영되지 않던 경로).
  //   warm 센터 → fresh 도착: 보정한다(원버그 — 정밀 픽스가 막히면 me 마커가 최대 1km 어긋난 채 고정).
  //   같은 정밀도의 갱신(warm→warm·fresh→fresh = 사용자 이동)은 따라가지 않는다 — 재센터는 FAB로만.
  const myCoords = permission.coords;
  const myCoordsSource = permission.coordsSource;
  useEffect(
    function recenterOnMorePreciseCoords() {
      if (!mapReady) return;
      if (!myCoords) return;
      const centered = rankCoordsSource({ source: centeredSourceRef.current });
      if (rankCoordsSource({ source: myCoordsSource }) <= centered) return;
      centeredSourceRef.current = myCoordsSource;
      webviewRef.current?.injectJavaScript(buildRecenterScript({ me: myCoords }));
    },
    [mapReady, myCoords, myCoordsSource],
  );

  // 재시도: 핀 에러는 refresh, 지도 SDK 에러는 INIT 재주입(SDK가 살아있으면 즉시 복구) + 핀 재조회.
  const handleRetry = () => {
    setMapErrored(false);
    void refresh();
    sendInit();
  };

  // kind 3분기: saved → SelectedSpotCard / nearby → NearbySpotCard / wish → WishSpotCard(각 컬렉션 lookup).
  const selectedPin =
    selected?.kind === MapPinKind.Saved
      ? pins.find((p) => p.muklogId === selected.id) ?? null
      : null;
  const selectedNearby =
    selected?.kind === MapPinKind.Nearby
      ? nearby.items.find((it) => it.kakaoPlaceId === selected.id) ?? null
      : null;
  const selectedWish =
    selected?.kind === MapPinKind.Wish
      ? wishPinsList.find((w) => w.id === selected.id) ?? null
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
        {/* 카테고리 필터 바 — 최상단 full-width strip(ui-spec §2: top 12, edge-bleed 가로 스크롤). 위치는 부모가 배치. */}
        <View style={[styles.filterBar, { top: theme.spacing[12] }]}>
          <CategoryFilterBar
            selected={category}
            onSelect={({ category: next }) => setCategory(next)}
          />
        </View>

        {/* 범례 — 필터 바 아래로 하강(ui-spec §2: top 56 = 12 + 필터바 ~34 + gap ~10). left 불변. */}
        <View style={[styles.legend, { top: theme.spacing[56], left: theme.spacing[16] }]}>
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

      {/* 위시 스팟 카드 — wish 핀 탭 시 하단 도킹(이름·카테고리·area, 별점/heart/거리/액션 없음).
          coverEmoji는 핀(wishToMapMarkers)과 동일한 wishPinEmoji로 산출·주입(카드↔핀 단일 출처, plan §7-6). */}
      {selectedWish ? (
        <WishSpotCard
          placeName={selectedWish.placeName}
          category={selectedWish.category}
          coverEmoji={wishPinEmoji({ category: selectedWish.category })}
          area={selectedWish.area}
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
  // 카테고리 필터 바 — 최상단 full-width 절대배치(top은 인라인 토큰). left/right 0으로 edge-bleed 가로 스크롤.
  filterBar: { position: 'absolute', left: 0, right: 0 },
  legend: { position: 'absolute' },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  // 현재위치 FAB — 우하단 절대배치(right/bottom은 인라인 토큰, ui-spec §4.2).
  locate: { position: 'absolute' },
});
