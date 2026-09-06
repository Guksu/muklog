// src/components/PhotoViewer/PhotoViewer.tsx
// 풀스크린 사진 뷰어 — photo-viewer plan §3.2·§4 (UX 백로그 U56).
//   킷 templates/muklog는 이 표면에 침묵한다 → 판단 기준은 ux-principles이고, 비주얼 어휘(토큰·글래스·radius)는
//   앱이 이미 쓰는 것을 그대로 승계한다. 새 어휘는 배경 토큰(viewerBg) 하나뿐이다.
//
// 어휘 승계(비주얼 충실도 근거 — 새로 발명한 값 0)
//   · 상단바 위치      = 상세 글래스 바(MuklogDetailScreen.tsx:318-322) top=inset+8 / 좌우 12, 좌=나가기·우=위치.
//   · 닫기 X          = 상세 GlassBtn(mk-log:245-255 RN 근사) — scrimStrong 원형 + primaryFg 아이콘 20 + IconButton 40×40.
//   · 카운터 pill      = 킷 사진수 배지(mk-log:94 → MuklogCard.tsx:69-89) scrimStrong + radius.full + badge/primaryFg + 6·8 패딩.
//   · 배경            = viewerBg 신규 토큰(§3.4). 컴포넌트에 raw hex 0.
//
// 모션(§3.5)
//   진입 = 배경 페이드 + 콘텐츠가 살짝 작은 데서(0.96) 제자리 확대되며 페이드. translate는 0이다.
//     · 왜 순수 페이드가 아닌가: fe-craft §3이 "초기 transform 없는 순수 페이드 진입"을 즉시 플래그로 잡고,
//       #5가 진입 스케일을 0.9~0.97로 규정한다. fe-skills `swipe-dismiss-viewer`도 출발 썸네일이 없을 때는
//       "살짝 작은 상태에서 페이드로 연다"를 뷰어의 기본 관례로 둔다 — 그 판단값만 RN으로 옮겼다(웹 코드 복사 0).
//     · 배경은 스케일하지 않는다 — absoluteFill을 0.96으로 줄이면 가장자리에 뒤 화면이 새어 보인다.
//       그래서 배경(페이드)과 콘텐츠(페이드+스케일)를 별도 레이어로 나눈다.
//   감소 모션: 스케일(이동 성격)은 통째로 제거하고 페이드만 남긴다(fe-craft #8 — 제거가 아니라 완화).
//   퇴장은 연출 없음(닫기는 시스템 응답 — 비대칭, fe-craft #9). Modal 언마운트로 끝난다.
//   진입 연출과 무관하게 사진은 곧바로 마운트된다(Sheet E1) — 연출 도중 스크린리더·테스트가 빈 화면을 보지 않게.
//
// RN 제약 근사
//   · 상단 컨트롤의 킷 글래스(backdrop-filter blur)는 RN 미지원 → scrimStrong 반투명 검정만(흐림 없음).
//     상세 GlassBtn·카드 사진수 배지가 이미 같은 근사를 쓰므로 앱 안에서 어휘가 일치한다.
//   · ScrollView의 `contentOffset`은 iOS 전용이라 Android는 첫 콘텐츠 측정 시 scrollTo로 같은 자리를 잡는다.
import React, { useLayoutEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  MOTION_DURATION,
  MOTION_EASE_OUT,
  MotionKind,
  resolveMotionDuration,
  useReduceMotion,
  useTheme,
} from '@/theme';

import { FadeInImage } from '../FadeInImage';
import { IconName } from '../Icon';
import { IconButton } from '../IconButton';
import { resolveModalTopInset } from '../modalInsets';
import { Text } from '../Text';
import { clampPhotoIndex, resolvePageIndex } from './photoViewerIndex';

/**
 * 진입 시간(ms). 화면을 가로지르는 이동이 없어(제자리 스케일 + 페이드) 시트 진입(260, 40px 슬라이드 동반)보다
 *   짧은 쪽을 택했다 — 같은 시간이면 이동 거리가 없는 연출이 더 굼뜨게 읽힌다.
 *   fe-craft #4의 모달·드로어 예산(200~500ms) 하단이자 원칙 4(150~300ms) 안이다.
 */
const VIEWER_ENTER_DURATION = MOTION_DURATION.swapEnter;

/**
 * 진입 시작 스케일 — fe-craft #5가 정한 진입 스케일 구간(0.9~0.97)의 가장 옅은 쪽.
 *   뷰어는 "새 화면이 튀어나오는" 것이 아니라 "사진이 덮으며 자리잡는" 표면이라 확대감이 눈에 띄면 안 된다.
 *   테스트·QA가 매직 넘버가 아니라 이 상수를 참조하도록 export한다(Sheet.SHEET_ENTER_TRANSLATE 선례).
 *   ⚠️ export는 스펙이 실제로 소비할 때만 값을 한다 — `PhotoViewer.spec.tsx`가 이 상수를 import해
 *   "진입 시작 스케일 = 이 값" + "값이 fe-craft #5 구간(0.9~0.97) 안"을 단언한다(Sheet E2·E4와 같은 형태).
 */
export const PHOTO_VIEWER_ENTER_SCALE = 0.96;

/** 닫기 아이콘 한 변(px) — 상세 GlassBtn과 동일(사진 위 컨트롤 어휘 일치). */
const CLOSE_ICON_SIZE = 20;

/** 뷰어가 표시하는 사진 1장. 도메인 무관 — 호출자가 자기 데이터를 이 shape으로 매핑한다. */
export type PhotoViewerPhoto = {
  /** 표시할 이미지 URL(먹로그는 signed URL). */
  uri: string;
  /** 스크린리더가 읽을 라벨. 없으면 `사진 {n}`으로 폴백(n은 1-based). */
  accessibilityLabel?: string;
};

export type PhotoViewerProps = {
  /** 열림 여부. false면 아무것도 렌더하지 않는다(null). */
  visible: boolean;
  /** 표시 순서대로의 사진 목록. 빈 배열이면 visible이어도 렌더하지 않는다(null). */
  photos: PhotoViewerPhoto[];
  /** 열릴 때 처음 보여줄 0-based 인덱스. 범위 밖·음수·소수는 0~length-1로 클램프. 기본 0. */
  initialIndex?: number;
  /** 닫기 요청(X 탭 · Android 하드웨어 뒤로가기). 인자 없음 — 호출자가 자기 상태를 닫는다. */
  onClose: () => void;
};

export const PhotoViewer = ({ visible, photos, initialIndex = 0, onClose }: PhotoViewerProps) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const { width, height } = useWindowDimensions();

  const count = photos.length;
  const isOpen = visible && count > 0;

  // 현재 보고 있는 페이지(0-based). 열 때 initialIndex를 접어 넣고, 이후엔 스크롤이 갱신한다.
  const [pageIndex, setPageIndex] = useState(() => clampPhotoIndex({ index: initialIndex, count }));
  // 트랙의 **진입** 오프셋(px). ⚠️ 열림 시점에만 확정되고 스크롤로는 절대 바뀌지 않는다.
  //   RN의 `contentOffset`은 값이 바뀔 때마다 네이티브 UIScrollView의 오프셋을 다시 "설정"하는 제어 prop이다
  //   (RCTScrollViewManager: contentOffset → scrollView.contentOffset). 이걸 pageIndex에 묶으면
  //   손가락이 닿아 있는 중에 페이지 절반을 넘는 순간 트랙이 다음 페이지로 끌려가 한 번 튀고(iOS),
  //   폭 0으로 보고되는 스크롤 이벤트가 한 번 끼면 트랙이 1페이지로 되감긴다. 그래서 원래 의도(§7 A3
  //   "진입 위치를 잡는 초기값")대로 열림 상승 엣지에서만 갱신한다. 열려 있는 동안의 이동은 네이티브 몫이다.
  const [initialOffsetX, setInitialOffsetX] = useState(
    () => clampPhotoIndex({ index: initialIndex, count }) * width,
  );
  // 표시 직전에 한 번 더 접는다 — 열려 있는 동안 목록이 줄어드는 재렌더(공용 프리미티브 재사용처)에서
  //   pageIndex가 범위 밖에 남아 카운터가 `5 / 3`을 띄우는 것을 막는다. 진입·스크롤과 같은 클램프 함수다.
  const safePageIndex = clampPhotoIndex({ index: pageIndex, count });
  // 실제로 측정된 트랙 높이. 가로 ScrollView의 페이지는 세로로 늘어날 근거가 없어(교차축이 콘텐츠 크기)
  //   `height:'100%'`가 0으로 접힌다 → 페이지 높이를 숫자로 못 박아야 사진이 보인다.
  //   측정 전 첫 프레임은 창 높이로 대신한다(0 높이 프레임 방지). 단위 테스트로는 관측되지 않는 레이아웃이라
  //   실기기 스모크 DS6(긴 사진이 잘리지 않는지)이 최종 확인점이다.
  const [trackHeight, setTrackHeight] = useState(0);
  // 진입 진행도 — 페이드와 스케일을 별도 값으로 나눈다. 감소 모션에서 스케일만 접고 페이드는 남기기 위해서다
  //   (Sheet의 entry/enterFade 분리와 같은 구조, fe-craft #8).
  const enterFade = useRef(new Animated.Value(0)).current;
  const enterZoom = useRef(new Animated.Value(0)).current;
  // 이번 열림에서 진입을 이미 재생했는지 — 열려 있는 동안의 재렌더가 연출을 되감지 않게 한다(Sheet enteredRef 선례).
  const openedRef = useRef(false);
  const trackRef = useRef<ScrollView>(null);
  // Android는 contentOffset을 무시하므로 첫 콘텐츠 측정 때 한 번만 진입 위치로 이동시킨다.
  const scrolledToInitialRef = useRef(false);

  // 열릴 때마다 진입 인덱스를 다시 접고 진입 연출을 1회 재생한다.
  //   ⚠️ visible의 상승 엣지에서만 — 열려 있는 동안 부모가 재렌더해도 인덱스가 초기값으로 되돌아가지 않는다(B8).
  //   ⚠️ useLayoutEffect — 페인트 뒤에 0으로 되돌리면 정착 상태가 한 프레임 보였다가 다시 스며든다(Sheet S5).
  const playViewerEnter = () => {
    if (!isOpen) {
      openedRef.current = false;
      return;
    }
    if (openedRef.current) return;
    openedRef.current = true;
    scrolledToInitialRef.current = false;
    const entryIndex = clampPhotoIndex({ index: initialIndex, count });
    setPageIndex(entryIndex);
    setInitialOffsetX(entryIndex * width);
    enterFade.setValue(0);
    enterZoom.setValue(0);
    Animated.parallel([
      Animated.timing(enterFade, {
        toValue: 1,
        duration: resolveMotionDuration({
          durationMs: VIEWER_ENTER_DURATION,
          kind: MotionKind.Fade,
          reduceMotion,
        }),
        easing: Easing.bezier(...MOTION_EASE_OUT),
        useNativeDriver: true,
      }),
      Animated.timing(enterZoom, {
        toValue: 1,
        duration: resolveMotionDuration({
          durationMs: VIEWER_ENTER_DURATION,
          kind: MotionKind.Move,
          reduceMotion,
        }),
        easing: Easing.bezier(...MOTION_EASE_OUT),
        useNativeDriver: true,
      }),
    ]).start();
  };
  useLayoutEffect(playViewerEnter, [isOpen, initialIndex, count, reduceMotion]);

  // 외부(RN) 콜백 시그니처 — named-args 컨벤션 예외.
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = resolvePageIndex({
      offsetX: event.nativeEvent.contentOffset.x,
      pageWidth: event.nativeEvent.layoutMeasurement.width,
      count,
    });
    if (next !== pageIndex) setPageIndex(next);
  };

  // Android 보정: contentOffset이 iOS 전용이라, 콘텐츠가 처음 측정된 시점에 한 번만 진입 위치로 이동시킨다.
  //   (열림마다 scrolledToInitialRef가 리셋되므로 다시 열 때도 한 번씩 동작한다.)
  const handleContentSizeChange = () => {
    if (scrolledToInitialRef.current) return;
    scrolledToInitialRef.current = true;
    if (safePageIndex === 0) return;
    trackRef.current?.scrollTo({ x: safePageIndex * width, animated: false });
  };

  // 외부(RN) 콜백 시그니처 — named-args 컨벤션 예외.
  const handleTrackLayout = (event: LayoutChangeEvent) => {
    const measured = event.nativeEvent.layout.height;
    if (measured !== trackHeight) setTrackHeight(measured);
  };

  if (!isOpen) return null;

  const pageHeight = trackHeight > 0 ? trackHeight : height;

  // 감소 모션이면 transform 키를 아예 만들지 않는다(스케일 제거 · 페이드 유지 — SwapTransition과 같은 형태).
  const enterScale = enterZoom.interpolate({
    inputRange: [0, 1],
    outputRange: [PHOTO_VIEWER_ENTER_SCALE, 1],
  });
  const contentMotionStyle = reduceMotion
    ? { opacity: enterFade }
    : { opacity: enterFade, transform: [{ scale: enterScale }] };

  // 사진 위 컨트롤의 글래스 근사(scrimStrong) — 닫기 원형과 카운터 pill이 같은 배경 어휘를 공유한다.
  const glassBackground = { backgroundColor: theme.color.scrimStrong, borderRadius: theme.radius.full };

  return (
    // statusBarTranslucent: Android에서 뷰어 배경이 상태바까지 빈틈없이 덮는다(U57 — 없으면 상단에 밝은 띠가 남는다).
    //   대가로 컨테이너 위쪽 inset이 0이 되므로 상단바 여백은 resolveModalTopInset이 되돌린다.
    // animationType="none": 진입 연출은 아래 페이드 레이어가 담당하고, 퇴장은 즉시다(§3.5 비대칭).
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.fill}>
        {/* 배경은 페이드만 한다 — 스케일하면 화면 가장자리로 뒤 화면이 새어 보인다. */}
        <Animated.View
          testID="photo-viewer-backdrop"
          style={[styles.backdrop, { backgroundColor: theme.color.viewerBg, opacity: enterFade }]}
        />

        {/* 콘텐츠 레이어 — 사진·상단바가 함께 살짝 확대되며 스며든다(감소 모션이면 페이드만). */}
        <Animated.View testID="photo-viewer-enter-layer" style={[styles.fill, contentMotionStyle]}>
          {/* 가로 페이징 트랙 — 한 페이지 = 화면 폭 1장. 폭은 useWindowDimensions에서 읽는다(하드코딩 금지, E12). */}
          <ScrollView
            ref={trackRef}
            testID="photo-viewer-track"
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            onContentSizeChange={handleContentSizeChange}
            onLayout={handleTrackLayout}
            scrollEventThrottle={16}
            contentOffset={{ x: initialOffsetX, y: 0 }}
            style={styles.fill}
          >
            {photos.map((photo, index) => (
              <View
                key={`${index}-${photo.uri}`}
                testID="photo-viewer-page"
                style={[styles.page, { width, height: pageHeight }]}
              >
                {/* 로드/실패 시 페이드로 자리를 잡는다(fail-visible — 만료 URL도 빈칸으로 남지 않는다, E5). */}
                <FadeInImage
                  testID="photo-viewer-photo"
                  accessibilityLabel={photo.accessibilityLabel ?? `사진 ${index + 1}`}
                  source={{ uri: photo.uri }}
                  resizeMode="contain"
                  style={styles.photo}
                />
              </View>
            ))}
          </ScrollView>

          {/* 상단바 — 좌=나가기 / 우=위치(상세 글래스 바 어휘 승계). 사진 탭을 가로막지 않게 box-none. */}
          <View
            testID="photo-viewer-topbar"
            pointerEvents="box-none"
            style={[
              styles.topBar,
              {
                paddingTop:
                  resolveModalTopInset({
                    insetTop: insets.top,
                    statusBarHeight: StatusBar.currentHeight,
                  }) + theme.spacing[8],
                paddingHorizontal: theme.spacing[12],
              },
            ]}
          >
            <View style={[styles.glass, glassBackground]}>
              <IconButton
                testID="photo-viewer-close"
                name={IconName.Close}
                size={CLOSE_ICON_SIZE}
                color="primaryFg"
                accessibilityLabel="닫기"
                onPress={onClose}
              />
            </View>

            {/* 카운터 — 1장이면 정보량이 0이라 렌더하지 않는다(상세 도트가 1장에서 숨는 것과 같은 규칙, E2). */}
            {count > 1 ? (
              <View
                testID="photo-viewer-counter"
                accessible
                accessibilityLabel={`${count}장 중 ${safePageIndex + 1}번째 사진`}
                style={[
                  styles.counter,
                  glassBackground,
                  {
                    paddingVertical: theme.spacing[6],
                    paddingHorizontal: theme.spacing[8],
                  },
                ]}
              >
                <Text variant="badge" color="primaryFg">
                  {`${safePageIndex + 1} / ${count}`}
                </Text>
              </View>
            ) : null}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject },
  // 한 페이지 = 화면 폭. 세로는 트랙 높이만큼 늘어나고 사진은 그 안에서 가운데 정렬된다.
  page: { justifyContent: 'center', alignItems: 'center' },
  photo: { width: '100%', height: '100%' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // 글래스 원형/pill은 자식 크기에 맞춘다(닫기는 IconButton 40×40이 크기를 정한다).
  glass: { overflow: 'hidden' },
  counter: { alignItems: 'center', justifyContent: 'center' },
});
