// src/navigation/screens/MapTabScreen.tsx
// 지도 탭 — 권한·핀·지도 상태 오케스트레이션 (map-tab 슬라이스 1, plan §4·§5·ui-spec §3 조립 가이드).
//
// 배선(소비): useMuklogPins(핀) + useLocationPermission(현재위치·refreshCoords) + ui-publisher 컴포넌트
//   (MapWebView·MapLegend·MapStatusOverlay·SelectedSpotCard·MapLocateButton). 순수 유틸 mapHtml·
//   pinsToMapMarkers·initialRegion·parseMapMessage·buildInitScript·buildSetMarkersScript·buildRecenterScript로
//   WebView 메시지 계약(§3.5)을 배선한다. handleLocate: FAB 탭 → 위치 재취득 → RECENTER inject(map-locate-button).
//   map-location-denied(U7·U13 ③): 위치 권한 거부는 중앙 오버레이가 아니라 FAB 위 하단 배너(MapPermissionBanner)로
//   안내한다 — "설정 열기"(expo-linking openSettings, 실패 시 토스트) + 닫기(마운트 동안만, 비저장) + 거부 상태 FAB 탭 시
//   배너 재노출·스크린리더 알림. 설정에서 허용하고 돌아온 반영은 useLocationPermission의 재활성화 재조회가 맡는다.
//   map-nearby-feedback(U10): 재검색 pill은 훅 researchState(검색 중·실패 포함)로 그리고, 지도 가운데 안내가 있으면 숨긴다.
//   누른 조회의 0건은 토스트+스크린리더, 실패는 스크린리더만 알린다(pill이 이미 실패를 보여 준다). 지도 SDK가 10초 안에
//   READY·ERROR를 하나도 보내지 않으면 제한 시간이 SDK 오류 안내로 바꾼다(WebView 세대마다 1개, 늦은 READY는 자동 복구).
//   map-webview-recovery(U71·U62): OS가 WebView 프로세스를 끝내거나, SDK를 받지 못한 페이지에서 "다시 시도"를 누르면
//   안쪽 WebView만 새로 만든다(재마운트 — 선택·필터·카드는 RN 상태라 그대로고 핀은 READY 뒤 기존 INIT 경로가 다시 그린다).
//   지도 탭 마운트당 3회까지, 넘으면 "앱을 껐다가 다시 켜 주세요"(버튼 없음). 화면 밖에서 끝나면 돌아올 때 1회 한다.
//   map-pin-card-detail(U11): 우리 맛집 카드 → MuklogDetail({ muklogId }) 이동. 이동해도 선택을 풀지 않아 복귀 시
//   카드·핀 강조·필터가 그대로고, 편집·삭제 반영은 기존 포커스 재조회(핀·위시 각 1회)가 맡는다.
//   map-wish-card-visit(U12): 위시 카드 "기록하기" → MuklogEditor({ 위시의 로그, 프리필 7필드, fromWishlistId }) —
//   위시 목록 "기록하기"와 같은 에디터 계약. 지도 탭이 포커스를 잃은 뒤의 재탭은 무시하고, 선택은 유지하며,
//   저장(위시 삭제)·취소 반영은 같은 포커스 재조회가 맡는다(위시가 빠지면 기존 선택 정리가 카드를 닫는다).
//
// 정책: 진입 1회 핀 조회 + 권한 1회 요청 + 명시적 refresh만(폴링/Realtime 없음, 비용 가드레일 §8).
//   현재위치는 RN expo-location으로 받아 INIT.me로 주입(WebView geolocation 미사용 — plan §9.2).
//   ⚠️ 비주얼은 ui-publisher 컴포넌트로만(임의 변경 금지). 상태→tone/message 판단만 여기서 한다.
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToastController } from '@/components';
import {
  CategoryFilterBar,
  LogPickerSheet,
  MAP_LOCATE_BUTTON_SIZE,
  MAP_RESEARCH_COPY,
  MapLegend,
  MapLocateButton,
  MapPermissionBanner,
  MapResearchButton,
  MapResearchButtonState,
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
import { NEARBY_FALLBACK_SPAN, nearbyPreloadBbox } from '@/features/map/nearbyPreloadBbox';
import {
  MapWebViewRemountReason,
  NearbyTraceEvent,
  nearbyRenderGapMs,
  traceNearby,
} from '@/features/map/nearbyTrace';
import { nearbyToMapMarkers } from '@/features/map/nearbyToMapMarkers';
import { parseMapMessage } from '@/features/map/parseMapMessage';
import { pinsToMapMarkers } from '@/features/map/pinsToMapMarkers';
import {
  LocationCoordsSource,
  LocationPermissionStatus,
  MapInboundType,
  MapPinKind,
  NearbyResearchOutcome,
  NearbyResearchState,
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

import { pickEditorPrefill } from '../../pickEditorPrefill';
import { Routes, type AppStackParamList } from '../../routes';
import { useRefreshOnFocus } from '../../useRefreshOnFocus';

// 상태 안내 카피(ui-spec §4 권고값 — 해요체, 차단 아님). 카피 단일 출처.
//   map-location-denied(plan §3.4·D7): 권한 배너 문구·버튼·힌트·닫기 라벨·설정 열기 실패 토스트.
const MAP_COPY = {
  loading: '지도를 불러오는 중이에요',
  permissionDenied: '위치 권한을 허용하면 현재 위치를 볼 수 있어요',
  openSettings: '설정 열기',
  openSettingsHint: '기기 설정에서 위치 권한을 허용할 수 있어요',
  dismissPermission: '위치 안내 닫기',
  // 375pt 폭에서도 토스트 1줄(≈268pt) — 2줄이면 배너의 "설정 열기"를 가린다(qa-visual QV-2). 동사는 배너와 같은 "허용".
  openSettingsFailed: '설정을 열지 못했어요. 설정 앱에서 허용해 주세요',
  pinsError: '먹로그를 불러오지 못했어요',
  sdkError: '지도를 불러오지 못했어요',
  retry: '다시 시도',
  // map-nearby-feedback: 사용자가 누른 조회가 0건일 때만(자동 조회 0건은 무통지). 0건이면 pill도 사라지므로
  //   상태 + 다음 행동 두 절(킷 빈 상태 "…없어요 / …남겨보세요" 꼴) — 지도를 옮기면 pill이 다시 뜬다.
  //   "이 지역엔"은 뺐다: 넣으면 토스트가 ≈288pt로 넓어져 360~402pt 기기에서 현재위치 FAB(같은 하단 줄)를 덮는다.
  //   지금 ≈233pt = 320pt까지 한 줄, 360pt 이상 FAB와 안 겹침. 구분은 가운뎃점 대신 마침표 — 같은 문구를 스크린리더
  //   알림에도 쓰므로 기호 이름을 읽지 않게(openSettingsFailed와 같은 꼴). "등록된"(누가?)·"맛집"(우리 맛집 오해)은 뺐다.
  nearbyEmpty: '음식점이 없어요. 지도를 옮겨보세요',
  // map-webview-recovery(Q2): 재마운트 상한을 다 쓴 뒤의 안내 — 버튼 없음(눌러도 복구할 수 없다). 지도 탭 상태가 살아 있어
  //   앱을 잠깐 나갔다 와서는 풀리지 않으므로 "껐다가 다시 켜"를 분명히 한다. 줄바꿈은 문장 단위 — 카드 글자 폭(≈280pt)에
  //   이어 쓰면 "주세요"만 둘째 줄로 떨어진다. 스크린리더는 줄바꿈을 쉼으로 읽는다.
  restartApp: '지도를 불러오지 못했어요.\n앱을 껐다가 다시 켜 주세요',
} as const;

/**
 * 훅 researchState → pill 모양. Hidden은 null(렌더하지 않음 — 노출은 부모 소유, 컴포넌트는 자기 노출 조건을 모른다).
 * 전체 합집합 Record라 상태가 늘면 컴파일러가 여기 누락을 잡는다(map-nearby-feedback).
 */
const RESEARCH_BUTTON_STATE_BY_NEARBY: Record<NearbyResearchState, MapResearchButtonState | null> = {
  [NearbyResearchState.Hidden]: null,
  [NearbyResearchState.Idle]: MapResearchButtonState.Idle,
  [NearbyResearchState.Searching]: MapResearchButtonState.Searching,
  [NearbyResearchState.Failed]: MapResearchButtonState.Failed,
};

/**
 * 지도 준비 제한 시간(ms) — WebView 세대마다(지도 탭 마운트 뒤, 그리고 재마운트 뒤마다) 이 시간 안에 그 WebView의
 * 첫 READY·ERROR가 하나도 없으면 SDK 오류 안내로 바꾼다(map-nearby-feedback · U10 ④, map-webview-recovery).
 * 실측 부팅 최악 ≈2.9s(프리워밍 없음)의 약 3.4배라 느린 셀룰러의 SDK 다운로드 여유를 두면서 사용자가 기다림에
 * 주의를 유지하는 10초를 넘지 않는다. 늦게 READY가 오면 안내가 스스로 걷히므로 느린 망의 오탐 비용은 작다.
 */
export const MAP_BOOT_TIMEOUT_MS = 10_000;

/**
 * 지도 WebView 재마운트 상한 — 지도 탭 마운트당 3회(map-webview-recovery · UX 백로그 U71·U62).
 * 비용 가드레일: 재마운트 1회 = 카카오 지도 SDK 페이지 재요청 1회라, 탭 마운트당 SDK 로드는 최초 1 + 재마운트 3 = 최대 4다.
 * 재마운트는 종료 신호·사용자의 "다시 시도" 탭·(화면 밖 종료 뒤) 지도 탭 복귀에서만 일어난다 — 타이머·폴링·자동 반복 0.
 * 넘으면 재마운트 대신 앱을 다시 켜 달라는 안내를 띄운다(버튼 없음). 상한은 컴포넌트 상태라 로그아웃·앱 재시작으로
 * 지도 탭이 다시 마운트되면 처음부터 센다(모듈 전역 금지).
 */
export const MAP_WEBVIEW_REMOUNT_LIMIT = 3;

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
  // map-pin-card-detail: 이 화면은 HomeTabs 안의 탭이다. MuklogDetail은 부모 AppStack 라우트라 탭 라우터가 처리하지 못한
  //   navigate가 부모 스택으로 올라간다(LogListScreen → LogScreen과 같은 선례).
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  // map-headerless: 이 탭은 네이티브 헤더가 없어(HomeTabs headerShown:false) 지도가 상태바까지 차오른다.
  //   헤더가 흡수하던 top inset을 상단 오버레이(필터 바·범례)가 승계해야 노치/다이나믹 아일랜드/펀치홀에
  //   씹히지 않는다. ⚠ 컨테이너를 SafeAreaView로 감싸면 지도까지 내려와 풀블리드가 깨진다 — 오버레이만 흡수.
  const insets = useSafeAreaInsets();
  const { state, refresh } = useMuklogPins();
  const permission = useLocationPermission();
  const nearby = useNearbyPlaces();
  // map-wish-pins: 내 모든 로그의 좌표 있는 위시 핀(크로스-로그, RLS 스코프). 마운트 1회 + 포커스/add-후 refresh.
  const wishPins = useWishPins();
  // map-nearby-wish: 주변 카드 "위시에 담기" 오케스트레이션(로그 0/1/2+ 분기·중복 가드·토스트는 훅 내부).
  //   화면은 액션→requestAdd·시트(choosing) 렌더·선택→chooseLog 배선만 하고 비주얼은 컴포넌트가 소유(임의 변경 금지).
  //   onAdded: 담기 성공 직후 위시 핀 즉시 refresh(같은 화면 반영 — map-wish-pins §4.3).
  const nearbyWish = useAddNearbyWish({ onAdded: wishPins.refresh });
  // map-location-denied: 설정 앱 열기 실패 안내(루트 토스트 — 배너는 그대로 남아 복구 경로를 유지한다).
  const { showToast } = useToastController();

  // 선택 상태는 {id, kind} 쌍 — kind(saved|nearby|wish)로 id 네임스페이스 충돌 방지 + 카드 3분기(map-wish-pins §3.4).
  const [selected, setSelected] = useState<{ id: string; kind: MapPinKind } | null>(null);
  // map-category-filter: 카테고리 필터(클라 전용 state, null="전체"). 백엔드·조회 재실행 0 — 이미 받은 데이터의 표시 필터.
  const [category, setCategory] = useState<MuklogCategoryKey | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapErrored, setMapErrored] = useState(false);
  // map-webview-recovery: WebView 세대 — 0에서 시작해 재마운트마다 1씩 오른다. MapWebView의 webviewKey이자
  //   이 탭 마운트에서 쓴 재마운트 횟수다(남은 상한 = MAP_WEBVIEW_REMOUNT_LIMIT - 세대).
  const [webviewGeneration, setWebviewGeneration] = useState(0);
  // 끝난 WebView를 떼어 냈는지(렌더하지 않음). 상한이 남았으면 화면 밖에서 끝나 지도 탭 복귀를 기다리는 중이고(Q1-B),
  //   다 썼으면 소진이다 — 지도 탭이 다시 마운트될 때까지 이 상태로 끝난다(D4).
  const [webviewDetached, setWebviewDetached] = useState(false);
  // map-location-denied(D3): 권한 배너 닫힘 — 이 마운트 동안만 산다(AsyncStorage 등 영속 저장 0).
  //   바텀탭 화면은 첫 진입 뒤 언마운트되지 않아 사실상 로그인 세션 동안 유지되고, 재실행·재로그인이면 다시 보인다.
  //   거부 상태에서 현재위치 FAB를 누르면 다시 false로 되돌린다(U13 ③).
  const [permissionBannerDismissed, setPermissionBannerDismissed] = useState(false);
  const webviewRef = useRef<MapWebViewHandle>(null);
  // map-webview-recovery: 재마운트를 시작했거나 소진으로 떼어 낸 마지막 세대. 한 세대의 종료·"다시 시도"·복귀 포커스는
  //   몇 번이 와도 1회만 처리한다 — 같은 렌더 안의 두 번째 호출은 같은 클로저 값(세대·떼어 냄)을 봐서 상태만으로는 막지
  //   못하고, 그러면 계측이 두 줄 남거나 상한을 두 번 쓴다(plan §3.4 · MR15).
  const handledGenerationRef = useRef<number | null>(null);
  // #4·map-initial-location: 지도 센터가 "지금 어떤 정밀도의 좌표로 그려져 있는지"를 기록한다
  //   (null=폴백 센터(서울/핀 bbox) · Warm=OS 캐시 근사 · Fresh=정밀 픽스).
  //   더 정밀한 좌표가 도착할 때만 1회 보정하므로(단조 승격) 별도의 "자동 센터링 1회" 플래그가 필요 없다 —
  //   폴백→warm, warm→fresh는 각각 1회 발화하고, 같은 정밀도의 좌표 갱신(사용자 이동)은 따라가지 않는다.
  const centeredSourceRef = useRef<LocationCoordsSource | null>(null);
  // map-pin-loading: 선로딩은 마운트당 1회다. 좌표가 warm→fresh로 승격돼도(=effect 재실행) 재발사하지 않는다.
  const preloadFiredRef = useRef(false);
  // 계측 t0 — READY 수신 시각. 소스별 "첫 렌더까지의 갭"을 재는 기준선이다(__DEV__ 전용).
  const readyAtRef = useRef<number | null>(null);
  const firstRenderTracedRef = useRef<Set<MapPinKind>>(new Set());

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
  // map-webview-recovery: 남은 재마운트 수, 그리고 "SDK를 받지 못한 페이지의 오류"(READY 전 ERROR·제한 시간 만료).
  //   READY 뒤 ERROR는 INIT 예외라 SDK가 살아 있다(mapHtml __muklogInit catch) — INIT만 다시 넣으면 된다.
  const remountsLeft = MAP_WEBVIEW_REMOUNT_LIMIT - webviewGeneration;
  const mapBootFailed = mapErrored && !mapReady;

  // 진입 시 위치 권한 1회 요청(undetermined일 때). request 내부에 중복 가드가 있어 재호출 안전.
  useEffect(
    function requestLocationOnEnter() {
      if (permission.status === LocationPermissionStatus.Undetermined) {
        void permission.request();
      }
    },
    [permission.status],
  );

  // map-pin-loading: 탭 진입 즉시 주변 조회를 WebView 부팅(≈1.2s)과 **병렬**로 태운다(선로딩).
  //   센터는 initialRegion과 같은 우선순위(현재위치 → 핀 bbox)라 지도가 그려질 자리를 미리 받는다.
  //   신호가 하나도 없으면(좌표·핀 0) 스킵한다 — 확실히 틀릴 조회를 미리 태우면 비용만 쓰고 화면은 못 채운다.
  //   좌표·핀이 늦게 도착하면 그때 1회 발사되고(deps 재실행), 이후 정밀도 승격은 ref 가드가 흡수한다(A4-1).
  const pinsCount = pins.length;
  useEffect(
    function preloadNearbyOnce() {
      if (preloadFiredRef.current) return;
      const bbox = nearbyPreloadBbox({
        coords: permission.coords,
        pins,
        span: NEARBY_FALLBACK_SPAN,
      });
      if (!bbox) {
        traceNearby({ event: NearbyTraceEvent.PreloadSkip, detail: { reason: 'no-signal' } });
        return;
      }
      preloadFiredRef.current = true;
      traceNearby({
        event: NearbyTraceEvent.PreloadStart,
        detail: { source: permission.coords ? 'coords' : 'pins' },
      });
      nearby.preload({ bbox });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 신호(좌표·핀 개수)가 생기는 순간에만 재평가. pins 배열은 매 렌더 새 참조라 원시값으로 대체(발사는 ref 가드로 1회).
    [permission.coords, pinsCount],
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
  //   거부(탭 시점 렌더 기준)면 위치 호출 0 — 대신 닫혀 있던 권한 배너를 되살리고 스크린리더로 이유를 알린다
  //   (map-location-denied U13 ③: 무반응 → 행동 경로. FAB는 포커스를 옮기지 않아 알림이 필요 — plan §4.8·D4).
  //   미결정이면 권한 요청 → 거기서 거부로 끝나면 클로저가 이전 값(Undetermined)이라 아래 refreshCoords가 null로
  //   no-op이고, 배너는 status 전이로 자동 노출된다(OS 팝업이 이미 피드백 — 추가 알림 없음).
  //   refreshCoords가 granted 아니거나 실패+직전coords없음이면 null → no-op(무한 로딩·에러배너 없음).
  const handleLocate = async () => {
    if (permission.status === LocationPermissionStatus.Denied) {
      setPermissionBannerDismissed(false);
      AccessibilityInfo.announceForAccessibility(MAP_COPY.permissionDenied);
      return;
    }
    if (permission.status === LocationPermissionStatus.Undetermined) {
      await permission.request();
    }
    const fix = await permission.refreshCoords();
    if (!fix) return;
    // 지도 센터를 방금 리센터한 좌표의 **실제 출처**로 기록한다 — 자동 보정이 같은 좌표를 한 번 더
    //   주입하지 않게 하면서(L2), 재취득이 실패해 warm 좌표로 폴백한 경우엔 이후 정밀 픽스 보정이
    //   그대로 살아있게 한다. "FAB로 받았으니 fresh"라고 단정하면 근사 좌표에 정밀 딱지가 붙는다.
    centeredSourceRef.current = fix.source;
    webviewRef.current?.injectJavaScript(buildRecenterScript({ me: fix.coords }));
  };

  // 권한 배너 "설정 열기"(U7 ①) — OS 앱 설정으로 보낸다(플랫폼 공통, Android 팝업 재요청 분기 없음 — D5).
  //   탭당 1회, 네트워크 0. 실패하면 토스트로 직접 가는 길을 알리고 배너는 닫지 않는다(복구 경로 유지).
  //   ⚠ `.catch()` 체인 금지 — RN jest 기본 목 등은 Promise가 아닌 값을 돌려줄 수 있어 try/await/catch로 흡수한다.
  //   허용하고 돌아온 반영은 useLocationPermission의 AppState 'active' 재조회가 맡는다(여기서 폴링·타이머 0).
  const handleOpenSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      showToast({ message: MAP_COPY.openSettingsFailed, tone: 'neutral' });
    }
  };

  // WebView → RN 메시지 디스패치(파싱은 parseMapMessage). 비JSON/미지는 조용히 무시.
  const handleMessage = (event: MapWebViewMessageEvent) => {
    const message = parseMapMessage({ raw: event.nativeEvent.data });
    if (!message) return;

    if (message.type === MapInboundType.Ready) {
      setMapErrored(false);
      setMapReady(true);
      // 계측 t0 — 이 시점부터 각 소스(saved·wish·nearby)의 첫 핀이 몇 ms 뒤에 실리는지 잰다.
      //   nearby가 INIT에 함께 실리면 gapMs=0(= 목표 상태), 뒤늦게 오면 그 지연이 그대로 드러난다.
      readyAtRef.current = Date.now();
      traceNearby({ event: NearbyTraceEvent.MapReady });
      sendInit();
      return;
    }
    if (message.type === MapInboundType.MarkerTap) {
      // kind로 카드 분기(id 단독 lookup 금지 — id 네임스페이스 충돌 방어, map-wish-pins §6).
      setSelected({ id: message.id, kind: message.kind });
      return;
    }
    if (message.type === MapInboundType.BoundsChanged) {
      // map-pin-loading: 이 신호는 더 이상 "조회하라"가 아니라 **"현재 뷰포트는 여기다"** 라는 통지다.
      //   훅은 이걸로 네트워크를 태우지 않고 재검색 버튼 노출 판정·span 1회 기록만 한다(예외: 첫 조회 허용분·보정 1회).
      nearby.setBounds({ sw: message.sw, ne: message.ne });
      return;
    }
    if (message.type === MapInboundType.MapTap) {
      // map-pin-select: 지도 빈 곳 탭 → 선택 해제(카드 닫힘 + 활성 강조 해제). SET_SELECTED(null)는 effect가 주입.
      setSelected(null);
      return;
    }
    if (message.type === MapInboundType.Error) {
      // map-webview-recovery(D3): READY 전 첫 오류(SDK를 받지 못한 페이지)인데 재마운트 상한을 다 썼다 — "다시 시도" 대신
      //   소진 안내가 뜬다. 디바이스 로그로 구분한다(만료로 같은 상태가 되면 watchMapBoot가 같은 줄을 남긴다).
      if (!mapReady && !mapErrored && remountsLeft === 0) {
        traceNearby({
          event: NearbyTraceEvent.MapWebViewExhausted,
          detail: { reason: MapWebViewRemountReason.Retry },
        });
      }
      setMapErrored(true);
    }
  };

  // ── map-webview-recovery(U71·U62): 지도 WebView 재마운트 ──────────────────────────────
  //   재마운트 = 안쪽 WebView만 새 인스턴스로 바꿔 카카오 SDK 페이지를 처음부터 다시 불러오는 것(MapWebView webviewKey).
  //   · 되돌리는 것: 지도 준비·오류 상태 → 가운데 "지도를 불러오는 중이에요", 그리고 새 세대의 10초 제한 시간(watchMapBoot).
  //   · 그대로인 것: 선택·카테고리 필터·권한 배너 닫힘·핀·위시·주변 결과(전부 RN 상태). READY가 오면 기존 경로가 INIT을,
  //     이어서 mapReady 게이트 효과들이 SET_MARKERS·SET_SELECTED를 새 인스턴스에 넣는다 — 재조회 0. 지도 위치는 INIT의
  //     기본 센터로 돌아간다(이전 위치·줌 복원은 범위 밖 — Q3).
  //   · 재마운트 순간에는 아무것도 주입하지 않는다 — ref가 아직 옛 인스턴스를 가리킬 수 있다.
  //   · 비용: 1회 = 카카오 SDK 페이지 재요청 1회. 상한 MAP_WEBVIEW_REMOUNT_LIMIT, 자동 반복 없음(규칙 8).
  const remountWebView = ({ reason }: { reason: MapWebViewRemountReason }) => {
    const nextGeneration = webviewGeneration + 1;
    setMapReady(false);
    setMapErrored(false);
    setWebviewDetached(false);
    setWebviewGeneration(nextGeneration);
    traceNearby({
      event: NearbyTraceEvent.MapWebViewRemount,
      detail: { reason, count: nextGeneration },
    });
  };

  // 끝난 WebView를 떼어 낸다 — 프로세스가 끝난 WebView는 다시 쓸 수 없다(Android는 라이브러리가 늘 "처리함"을 돌려줘
  //   앱은 살지만 그 WebView는 죽은 채 남는다). 떼어 낸 동안은 webviewRef가 비어 주입 0, watchMapBoot도 타이머를 걸지 않는다.
  const detachWebView = () => {
    setMapReady(false);
    setMapErrored(false);
    setWebviewDetached(true);
  };

  /**
   * 지금 세대의 WebView를 처리할 차례를 1회만 가져간다(handledGenerationRef).
   * @returns 이번 호출이 처음이면 true, 같은 세대를 이미 처리했으면 false
   */
  const claimGeneration = (): boolean => {
    if (handledGenerationRef.current === webviewGeneration) return false;
    handledGenerationRef.current = webviewGeneration;
    return true;
  };

  // OS가 WebView 프로세스를 끝냈다(iOS 콘텐츠 프로세스·Android 렌더 프로세스 — MapWebView가 인자 없이 올린다).
  //   · 지도 탭이 화면에 없고 상한이 남았으면: 떼어 두고 지도 탭이 다시 보일 때 1회 재마운트한다(Q1-B — 사진 선택·다른 탭
  //     중에 화면 밖에서 상한과 제한 시간을 쓰면 돌아왔을 때 오류 카드만 남는다). 이 세대는 복귀 포커스가 처리하도록 남긴다.
  //     isFocused()는 호출 순간의 네비게이션 상태를 읽는다(handleVisitWish와 같은 방식). 앱 백그라운드는 보지 않는다.
  //   · 상한을 다 썼으면: 떼어 내고 소진 안내를 띄운다(D4).
  //   · 그 밖: 곧바로 재마운트한다. 스크린리더 알림은 없다 — 사용자 행동이 아니고 다른 화면에 있을 수 있다(D5).
  const handleWebViewTerminated = () => {
    if (webviewDetached) return; // 이미 떼어 낸 WebView의 늦은 신호
    if (remountsLeft > 0 && !navigation.isFocused()) {
      detachWebView();
      return;
    }
    if (!claimGeneration()) return;
    if (remountsLeft === 0) {
      detachWebView();
      traceNearby({
        event: NearbyTraceEvent.MapWebViewExhausted,
        detail: { reason: MapWebViewRemountReason.Terminated },
      });
      return;
    }
    remountWebView({ reason: MapWebViewRemountReason.Terminated });
  };

  // Q1-B: 화면 밖에서 떼어 둔 WebView를 지도 탭이 다시 보이는 순간 1회 재마운트한다. 포커스 단위 이벤트라 폴링·타이머가
  //   아니다(규칙 8). 떼어 둔 것이 없거나 소진이면 아무것도 하지 않는다 — 평소의 포커스(상세·에디터에서 복귀)는 지도를
  //   건드리지 않는다. 첫 포커스도 같은 판단이라 skipFirst:false(마운트 때는 떼어 둔 것이 없어 no-op).
  useRefreshOnFocus({
    refresh: () => {
      if (!webviewDetached || remountsLeft === 0) return;
      if (!claimGeneration()) return;
      remountWebView({ reason: MapWebViewRemountReason.Terminated });
    },
    skipFirst: false,
  });

  // map-nearby-feedback(U10 ④) · map-webview-recovery: 지도 준비 제한 시간 — SDK 스크립트 요청이 멈추면 READY도 ERROR도
  //   오지 않아 `!mapReady` 로딩 카드가 영구히 남는다(map-feedback E6). WebView **세대마다** 첫 READY·ERROR를 기다리는
  //   1회성 타이머 하나로 막는다.
  //   · 무엇을: 지금 세대 WebView의 첫 READY 또는 첫 ERROR. 폴링·반복·자동 재시도 없음, 네트워크 호출 0.
  //   · 몇 번: 세대마다 최대 1개, 동시에 1개 — 재마운트가 세대를 올리고 준비·오류 상태를 되돌릴 때만 다시 걸린다(탭
  //     마운트당 최초 1 + 재마운트 3 = 최대 4개). 떼어 낸 WebView(소진·화면 밖 대기)에는 걸지 않는다(plan I2).
  //   · 언제 해제: READY 수신 · ERROR 수신 · 만료 · 재마운트(옛 세대) · 떼어 냄 · 언마운트 중 먼저 오는 것.
  //   만료하면 SDK ERROR와 같은 안내·같은 재시도로 합류한다(상한이 남았으면 "다시 시도"가 재마운트, 다 썼으면 소진 안내).
  //   불변식 I1: "준비 전" 로딩이 보이는 동안에는 그 세대의 타이머가 정확히 1개 돈다 — 그래서 영구 로딩 경로가 없다.
  //   부팅 중 핀 오류 카드의 "다시 시도"는 이 타이머를 끄지도 다시 켜지도 않는다(끄면 그 뒤 SDK가 멈췄을 때 영구 로딩).
  //   map-nearby-feedback D8·D9("재시도는 지도 웹 화면을 다시 불러오지 않고 타이머를 다시 켜지 않는다")는
  //   map-webview-recovery가 대체했다 — SDK 없는 페이지의 재시도는 재마운트로 새 세대를 만들고, 새 세대에 새 타이머가 걸린다.
  const mapBootSettled = mapReady || mapErrored;
  useEffect(
    function watchMapBoot() {
      if (mapBootSettled || webviewDetached) return undefined;
      const expireMapBoot = () => {
        traceNearby({ event: NearbyTraceEvent.MapBootTimeout, detail: { ms: MAP_BOOT_TIMEOUT_MS } });
        if (webviewGeneration >= MAP_WEBVIEW_REMOUNT_LIMIT) {
          // 상한을 다 쓴 세대의 만료 — "다시 시도" 대신 소진 안내가 뜬다(D3). ERROR 경로와 같은 줄로 구분한다.
          traceNearby({
            event: NearbyTraceEvent.MapWebViewExhausted,
            detail: { reason: MapWebViewRemountReason.Retry },
          });
        }
        setMapErrored(true);
      };
      const timerId = setTimeout(expireMapBoot, MAP_BOOT_TIMEOUT_MS);
      return function clearMapBootWatch() {
        clearTimeout(timerId);
      };
    },
    [mapBootSettled, webviewGeneration, webviewDetached],
  );

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

  // map-pin-loading 계측: 소스별 "READY → 첫 핀 탑재" 갭을 1회씩만 기록한다(__DEV__ 전용, 프로덕션 no-op).
  //   INIT에 이미 실려 있으면 gapMs=0으로 찍히므로, 로그만 보고 "지도와 함께 도착했는가"를 판정할 수 있다.
  useEffect(
    function traceFirstMarkerRender() {
      if (!mapReady) return;
      markers.forEach((marker) => {
        if (firstRenderTracedRef.current.has(marker.kind)) return;
        firstRenderTracedRef.current.add(marker.kind);
        traceNearby({
          event: NearbyTraceEvent.FirstRender,
          detail: {
            kind: marker.kind,
            gapMs: nearbyRenderGapMs({ readyAt: readyAtRef.current, at: Date.now() }),
          },
        });
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- markersKey(마커 집합 요약)로 발화. markers 배열은 매 렌더 새 참조라 제외.
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

  // 재시도 — 가운데 오류 카드의 "다시 시도". 무엇이 실패했는지에 따라 셋으로 나뉜다(map-webview-recovery D2).
  //   · SDK를 받지 못한 페이지(READY 전 ERROR·제한 시간 만료): 그 페이지에는 `__muklogInit`이 없어 INIT을 다시 넣어도
  //     READY도 ERROR도 오지 않는다(U62) — WebView를 재마운트해 페이지를 처음부터 다시 불러온다(상한 1회 사용, 새 세대의
  //     제한 시간). 핀도 1번 다시 조회하고(기존 동작), 누른 버튼이 로딩 카드로 바뀌어 포커스를 잃으므로 스크린리더에 로딩을
  //     1회 알린다(D5). INIT은 누르는 순간 넣지 않는다 — READY가 오면 기존 경로가 새 인스턴스에 넣는다. 상한을 다 썼으면
  //     버튼 자체가 없다(D3 — centerOverlay).
  //     ⚠️ 이 경로에서 재마운트 없이 mapErrored만 내리면 `!mapReady` 로딩이 배너를 대체해 스피너가 영구 잔류한다(qa-logic F1).
  //   · SDK가 살아 있는 오류(READY 뒤 ERROR = INIT 예외): 지금처럼 오류를 걷고 핀 재조회 + INIT 재주입(재마운트 0, 상한 무관).
  //   · 핀 오류: 핀 재조회 + INIT 재주입(재마운트 0). 부팅 중이어도 제한 시간(watchMapBoot)은 건드리지 않는다.
  const handleRetry = () => {
    if (mapBootFailed) {
      if (remountsLeft === 0 || !claimGeneration()) return;
      remountWebView({ reason: MapWebViewRemountReason.Retry });
      void refresh();
      AccessibilityInfo.announceForAccessibility(MAP_COPY.loading);
      return;
    }
    if (mapReady) setMapErrored(false);
    void refresh();
    sendInit();
  };

  // 재검색 pill 탭(map-nearby-feedback U10 ②③) — 훅이 결과를 돌려주면 **사용자가 누른 조회의 결과만** 알린다.
  //   0건: 토스트 + 스크린리더(0건이면 pill이 사라져 포커스를 잃는다). 실패: 스크린리더만(pill이 이미 실패 문구로 바뀌었고,
  //   VoiceOver는 포커스 요소의 라벨 변경을 스스로 읽지 않는 경우가 많다). 성공·Skipped: 없음(핀 등장이 피드백).
  //   research()는 reject하지 않는 계약이라 try/catch가 필요 없다. 자동 조회 결과는 여기로 오지 않는다(무통지).
  const handleResearch = async () => {
    const outcome = await nearby.research();
    if (outcome === NearbyResearchOutcome.Empty) {
      showToast({ message: MAP_COPY.nearbyEmpty, tone: 'neutral' });
      AccessibilityInfo.announceForAccessibility(MAP_COPY.nearbyEmpty);
      return;
    }
    if (outcome === NearbyResearchOutcome.Failed) {
      AccessibilityInfo.announceForAccessibility(MAP_RESEARCH_COPY.failedMessage);
    }
  };

  // 위시 카드 "기록하기"(map-wish-card-visit · U12) — 위시 목록 "기록하기"(LogScreen)와 같은 에디터 계약.
  //   · roomId는 그 위시의 로그다. 지도는 여러 로그를 함께 보여 "지금 로그"가 없다 — 다른 로그로 저장되면 안 된다.
  //   · 프리필은 공용 pickEditorPrefill(7필드만, 두 진입이 같은 값). muklogId를 넣지 않는다(넣으면 편집 모드).
  //   · 지도 탭이 이미 포커스를 잃었으면(에디터로 넘어가는 중) 무시한다. 에디터는 처음 열릴 때 한 번만 프리필하므로,
  //     같은 이름 navigate의 파라미터 교체로 다른 위시가 실리면 화면의 가게와 저장 로그·지울 위시가 어긋난다.
  //     isFocused()는 호출 순간의 네비게이션 상태를 읽는다(useIsFocused 렌더 값은 같은 렌더 안의 두 번째 탭을 못 막는다).
  //     상태를 저장하지 않는 읽기라 복귀 때 풀 것이 없다 — 돌아오면 다시 포커스라 자연히 누를 수 있다.
  //   · push가 아니라 navigate, 선택(setSelected)을 풀지 않음, 조회·주입 없음(U11 카드와 같은 규칙).
  const handleVisitWish = ({ wish }: { wish: WishPin }) => {
    if (!navigation.isFocused()) return;
    navigation.navigate(Routes.MuklogEditor, {
      roomId: wish.roomId,
      prefill: pickEditorPrefill({ wish }),
      fromWishlistId: wish.id,
    });
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

  // 상태 → 중앙 오버레이(tone/message) 판단(ui-spec §3 매핑). 지도 전체에 관한 상태만 정중앙에 둔다.
  //   우선순위: 재마운트 상한 소진 → 지도 SDK 에러 → 핀 에러 → 로딩(핀 loading **또는** 지도 부팅 중) → 없음.
  //   map-location-denied(U7 ②): 권한 안내는 여기서 빠져 하단 배너(showPermissionBanner)로 옮겨 갔다 —
  //   거부만으로는 지도 정중앙을 점유하지 않는다.
  const centerOverlay = ((): {
    tone: MapStatusTone;
    message: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null => {
    // map-webview-recovery(D3·D4): 상한을 다 쓴 뒤 WebView를 떼어 냈거나(소진 뒤 종료) SDK를 받지 못한 오류가 났으면
    //   "다시 시도" 대신 앱을 다시 켜 달라는 안내만 띄운다(버튼 없음 — 눌러도 복구할 수 없다). SDK 오류 쪽은 WebView를
    //   남겨 두므로 늦게 READY가 오면 이 안내도 스스로 걷힌다. 화면 밖 대기로 떼어 둔 동안은(상한 남음) 로딩이 보인다.
    if (remountsLeft === 0 && (webviewDetached || mapBootFailed)) {
      return { tone: MapStatusTone.Error, message: MAP_COPY.restartApp };
    }
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
    // 지도 부팅(WebView + Kakao SDK, 실측 ≈1.2s) 동안에도 로딩을 알린다 — 핀은 캐시로 즉시 ready라
    //   핀 상태만 보면 부팅 구간이 통째로 무통지 흰 화면이 된다(map-feedback U5).
    //   권한 배너보다 위인 이유: 지도가 아직 없는데 권한 얘기부터 하는 건 순서가 뒤집힌 것이다.
    //   SDK 실패는 ERROR → mapErrored가 맨 위에서 가로채므로 여기서 영구 잔류하지 않는다.
    if (state.status === 'loading' || !mapReady) {
      return { tone: MapStatusTone.Loading, message: MAP_COPY.loading };
    }
    // ready: 중앙 안내 없음(빈 상태 안내는 제거 — 사용자 요청. 핀 0개여도 지도만 깔끔히 표시).
    return null;
  })();

  // 권한 배너 노출(plan §3.4·§4.4) — 중앙 오버레이(오류·로딩)가 없을 때만(기존 우선순위 보존 — D2, 원칙 1:
  //   한 번에 한 가지). 오류·로딩이 걷히면 그때 나타난다. 닫았으면 FAB 탭 전까지 숨긴다(D3·D4).
  const showPermissionBanner =
    centerOverlay === null &&
    permission.status === LocationPermissionStatus.Denied &&
    !permissionBannerDismissed;

  // 재검색 pill 모양(map-nearby-feedback) — 훅 researchState 매핑(Hidden → null). 중앙 오버레이(지도 오류·핀 오류·로딩)가
  //   있으면 어떤 상태든 숨긴다(원칙 1: 지도 자체가 준비 안 됐거나 오류일 때 주변 검색 안내를 겹치지 않는다).
  //   오버레이가 걷히면 훅이 가진 상태 그대로 다시 보인다. 권한 배너(하단)와는 자리가 달라 공존한다.
  const researchButtonState =
    centerOverlay === null ? RESEARCH_BUTTON_STATE_BY_NEARBY[nearby.researchState] : null;

  return (
    <View style={styles.root}>
      <MapWebView
        html={html}
        onMessage={handleMessage}
        webviewRef={webviewRef}
        onTerminated={handleWebViewTerminated}
        webviewKey={webviewGeneration}
        webviewMounted={!webviewDetached}
      >
        {/* 카테고리 필터 바 — 최상단 full-width strip(ui-spec §2: top 12, edge-bleed 가로 스크롤). 위치는 부모가 배치.
            map-headerless: 기준선만 상태바 아래로(+insets.top), 간격 12는 그대로. inset 0이면 현행과 동일. */}
        <View
          testID="map-overlay-filterbar"
          style={[styles.filterBar, { top: insets.top + theme.spacing[12] }]}
        >
          <CategoryFilterBar
            selected={category}
            onSelect={({ category: next }) => setCategory(next)}
          />
        </View>

        {/* 범례 — 필터 바 아래로 하강(ui-spec §2: top 56 = 12 + 필터바 ~34 + gap ~10). left 불변.
            필터 바와 같은 inset을 더해 상대 간격 44를 보존한다(한쪽에만 더하면 겹치거나 벌어진다). */}
        <View
          testID="map-overlay-legend"
          style={[styles.legend, { top: insets.top + theme.spacing[56], left: theme.spacing[16] }]}
        >
          <MapLegend />
        </View>

        {/* 재검색 pill — 범례 아래 한 단(top 96 = 56 + 40), 가로 중앙(map-pin-loading).
            범례(left:16, 3칩 ≈301pt)와 중앙 pill(≈155pt)이 모든 기기에서 가로로 겹쳐 같은 줄을 쓸 수 없다.
            ⚠ pointerEvents="box-none" — 전폭 래퍼가 지도 팬/탭 제스처를 삼키지 않게.
            좌우 16(map-nearby-feedback): 킷 지도 오버레이 좌우 여백(범례·FAB 16)과 같은 규칙 — 글자를 키우면 실패 pill(≈274pt)이
            화면 끝까지 넓어지지 않고 16 안에서 줄바꿈된다. 기본 글자 크기에선 pill이 가용 폭보다 좁아 화면 변화 0. */}
        {researchButtonState !== null ? (
          <View
            testID="map-overlay-research"
            pointerEvents="box-none"
            style={[
              styles.research,
              {
                top: insets.top + theme.spacing[56] + theme.spacing[40],
                paddingHorizontal: theme.spacing[16],
              },
            ]}
          >
            <MapResearchButton
              testID="map-research-button"
              state={researchButtonState}
              onPress={handleResearch}
            />
          </View>
        ) : null}

        {/* 중앙 상태 오버레이(로딩·지도 오류·핀 오류) — 차단 아님(지도 위 배너). */}
        {centerOverlay ? (
          <View pointerEvents="box-none" style={styles.overlay}>
            <MapStatusOverlay
              tone={centerOverlay.tone}
              message={centerOverlay.message}
              actionLabel={centerOverlay.actionLabel}
              onAction={centerOverlay.onAction}
            />
          </View>
        ) : null}

        {/* 위치 권한 거부 배너(map-location-denied U7) — 현재위치 FAB 바로 위 하단 전폭(ui-spec §4).
            bottom = FAB bottom 16 + FAB 한 변(MAP_LOCATE_BUTTON_SIZE) + 간격 10 — 리터럴 72 금지(FAB 크기 드리프트 방지).
            ⚠ pointerEvents="box-none" — 래퍼 빈 영역이 지도 팬/탭을 삼키지 않게(재검색 pill 선례).
            도킹 카드는 MapWebView 바깥 형제라 카드가 뜨면 FAB와 함께 올라가 겹치지 않는다. */}
        {showPermissionBanner ? (
          <View
            testID="map-overlay-permission"
            pointerEvents="box-none"
            style={[
              styles.permission,
              {
                left: theme.spacing[16],
                right: theme.spacing[16],
                bottom: theme.spacing[16] + MAP_LOCATE_BUTTON_SIZE + theme.spacing[10],
              },
            ]}
          >
            <MapPermissionBanner
              message={MAP_COPY.permissionDenied}
              actionLabel={MAP_COPY.openSettings}
              actionHint={MAP_COPY.openSettingsHint}
              onAction={handleOpenSettings}
              dismissLabel={MAP_COPY.dismissPermission}
              onDismiss={() => setPermissionBannerDismissed(true)}
            />
          </View>
        ) : null}

        {/* 현재위치 FAB — 지도 영역(MapWebView) 우하단 16px 고정(킷 mk-home.jsx:362-372: 지도 div 내 right/bottom 16).
            카드(SelectedSpot/NearbySpot)는 MapWebView 바깥 형제라, 도킹 시 MapWebView(flex:1)가 줄고
            FAB는 지도 영역 바닥 16px 고정이라 자동으로 카드 위에 온다 — offset 변동 없이 항상 같은 위치. */}
        <View
          testID="map-overlay-locate"
          style={[styles.locate, { right: theme.spacing[16], bottom: theme.spacing[16] }]}
        >
          <MapLocateButton testID="map-locate-button" onPress={handleLocate} />
        </View>
      </MapWebView>

      {/* 선택 스팟 카드 — saved 핀 탭 시 하단 도킹(내 맛집). 카드 탭 → 먹로그 상세(map-pin-card-detail · U11).
          · push가 아니라 navigate: 맨 위가 이미 같은 상세면 새로 쌓지 않아 연타해도 상세는 한 장이다(화면 잠금 없음 —
            잠금은 복귀 때 풀어야 해서 안 풀리면 카드가 죽는 새 실패를 만든다).
          · 선택(setSelected)을 풀지 않는다: 복귀 시 같은 카드·핀 강조·필터를 그대로 보인다.
          · 조회·주입 없음: 상세 조회는 MuklogDetailRoute가, 복귀 반영은 useRefreshOnFocus의 핀·위시 재조회가 맡는다. */}
      {selectedPin ? (
        <SelectedSpotCard
          placeName={selectedPin.placeName}
          rating={selectedPin.rating}
          category={selectedPin.category}
          area={selectedPin.area}
          onPress={() =>
            navigation.navigate(Routes.MuklogDetail, { muklogId: selectedPin.muklogId })
          }
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

      {/* 위시 스팟 카드 — wish 핀 탭 시 하단 도킹(이름·카테고리·area, 별점/heart/거리 없음).
          coverEmoji는 핀(wishToMapMarkers)과 동일한 wishPinEmoji로 산출·주입(카드↔핀 단일 출처).
          카드 아래 "기록하기"(onVisit) → 이 위시로 새 먹로그 작성(map-wish-card-visit · U12, handleVisitWish). */}
      {selectedWish ? (
        <WishSpotCard
          placeName={selectedWish.placeName}
          category={selectedWish.category}
          coverEmoji={wishPinEmoji({ category: selectedWish.category })}
          area={selectedWish.area}
          onVisit={() => handleVisitWish({ wish: selectedWish })}
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
  // 재검색 pill 래퍼 — 전폭 절대배치 + 가로 중앙(pill 자신은 alignSelf:'center'라 폭을 채우지 않는다).
  research: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  // 위치 권한 배너 래퍼 — FAB 위 하단 전폭 절대배치(left/right/bottom은 인라인 토큰 합성, ui-spec §4).
  permission: { position: 'absolute' },
  // 현재위치 FAB — 우하단 절대배치(right/bottom은 인라인 토큰, ui-spec §4.2).
  locate: { position: 'absolute' },
});
