import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Modal, StatusBar, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReduceMotion, useTheme } from '@/theme';
import { Icon, IconName } from '../Icon';
import { MotionPressable } from '../MotionPressable';
import { Text } from '../Text';
import { clampPhotoTransform, containSize, swipePhotoIndex, zoomAtPoint, type PhotoPoint, type PhotoSize, type PhotoTransform } from './photoViewerGeometry';

export type PhotoViewerProps = {
  visible: boolean;
  photos: ReadonlyArray<{ uri: string; orderIndex: number }>;
  initialIndex: number;
  placeName: string;
  onClose: () => void;
};
const ImageStatus = { Loading: 'loading', Ready: 'ready', Error: 'error' } as const;
const INITIAL_TRANSFORM: PhotoTransform = { scale: 1, x: 0, y: 0 };
const EMPTY_SIZE = { width: 0, height: 0 };
const TRANSITION_MS = 200;

export const PhotoViewer = (props: PhotoViewerProps) =>
  props.visible ? <ViewerSession {...props} /> : null;

const ViewerSession = ({ photos, initialIndex, placeName, onClose }: PhotoViewerProps) => {
  // 열린 동안 signed URI 배열의 identity를 고정하고, 재열 때만 최신 props를 사용한다.
  const [session] = useState(() => photos.map((photo) => ({ ...photo })));
  const [index, setIndex] = useState(() => Math.max(0, Math.min(session.length - 1, Number.isFinite(initialIndex) ? Math.trunc(initialIndex) : 0)));
  const theme = useTheme();
  const closed = useRef(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReduceMotion();
  const [isClosing, setIsClosing] = useState(false);
  useEffect(function animateViewerEntry() {
    Animated.timing(opacity, { toValue: 1, duration: reduceMotion ? 80 : 180, useNativeDriver: true }).start();
    return function stopViewerOpacity() { opacity.stopAnimation(); };
  }, [opacity, reduceMotion]);
  const close = () => {
    if (closed.current) return;
    closed.current = true;
    setIsClosing(true);
    Animated.timing(opacity, { toValue: 0, duration: reduceMotion ? 80 : 150, useNativeDriver: true }).start(({ finished }) => { if (finished) onClose(); });
  };
  if (session.length === 0) return null;
  return (
    <Modal testID="photo-viewer-modal" visible animationType="none" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={close}>
      <GestureHandlerRootView style={[styles.fill, { backgroundColor: theme.color.mediaViewerBg }]}>
        <StatusBar barStyle="light-content" />
        <Animated.View pointerEvents={isClosing ? 'none' : 'auto'} style={[styles.fill, { opacity }]}>
        <PhotoPage key={index} uri={session[index].uri} index={index} count={session.length} placeName={placeName}
          onClose={close} onMove={({ next }) => { if (!closed.current) setIndex(next); }} />
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
};

type PhotoPageProps = { uri: string; index: number; count: number; placeName: string; onClose: () => void; onMove: ({ next }: { next: number }) => void };
const PhotoPage = ({ uri, index, count, placeName, onClose, onMove }: PhotoPageProps) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const [viewport, setViewport] = useState<PhotoSize>(EMPTY_SIZE);
  const [image, setImage] = useState<PhotoSize>(EMPTY_SIZE);
  const [status, setStatus] = useState<(typeof ImageStatus)[keyof typeof ImageStatus]>(ImageStatus.Loading);
  const [displayScale, setDisplayScale] = useState(1);
  const transform = useRef<PhotoTransform>({ ...INITIAL_TRANSFORM });
  const values = useRef({ scale: new Animated.Value(1), x: new Animated.Value(0), y: new Animated.Value(0), opacity: new Animated.Value(0) }).current;
  const fitted = containSize({ image, viewport });
  const panStart = useRef({ ...INITIAL_TRANSFORM });
  const panOrigin = useRef<PhotoPoint>({ x: 0, y: 0 });
  const rebasePan = useRef(false);
  const pinchStart = useRef({ transform: { ...INITIAL_TRANSFORM }, origin: { x: 0, y: 0 }, gestureScale: 1, pointers: 2 });
  const pinching = useRef(false);
  const pinched = useRef(false);
  const closing = useRef(false);
  const moving = useRef(false);

  const apply = ({ next }: { next: PhotoTransform }) => {
    transform.current = next;
    values.scale.setValue(next.scale);
    values.x.setValue(next.x);
    values.y.setValue(next.y);
  };
  const bounded = ({ next }: { next: PhotoTransform }) => clampPhotoTransform({ ...next, image: fitted, viewport });
  const settle = () => {
    if (moving.current || closing.current) return;
    const next = bounded({ next: transform.current });
    transform.current = next;
    setDisplayScale(next.scale);
    Animated.parallel([
      Animated.timing(values.x, { toValue: next.x, duration: reduceMotion ? 0 : TRANSITION_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(values.y, { toValue: next.y, duration: reduceMotion ? 0 : TRANSITION_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  };
  useEffect(function animatePageEntry() {
    const animation = Animated.timing(values.opacity, { toValue: 1, duration: reduceMotion ? 80 : 180, useNativeDriver: true });
    animation.start();
    return function stopPageAnimation() { animation.stop(); values.x.stopAnimation(); values.y.stopAnimation(); values.scale.stopAnimation(); };
  }, [values, reduceMotion]);
  useEffect(function resetViewportTransform() {
    transform.current = { ...INITIAL_TRANSFORM };
    values.scale.setValue(1); values.x.setValue(0); values.y.setValue(0);
    setDisplayScale(1);
    pinching.current = false; pinched.current = false;
  }, [viewport.width, viewport.height, values]);

  const move = ({ next }: { next: number }) => {
    if (closing.current || moving.current || next === index || next < 0 || next >= count) return;
    moving.current = true;
    Animated.timing(values.x, { toValue: next > index ? -viewport.width : viewport.width, duration: reduceMotion ? 0 : TRANSITION_MS,
      easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
        moving.current = false;
        if (finished && !closing.current) onMove({ next });
        else apply({ next: bounded({ next: transform.current }) });
      });
  };
  const zoom = ({ increase }: { increase: boolean }) => {
    if (status !== ImageStatus.Ready || closing.current || moving.current) return;
    const scale = increase ? Math.floor(transform.current.scale + 0.001) + 1 : Math.ceil(transform.current.scale - 0.001) - 1;
    apply({ next: bounded({ next: zoomAtPoint({ start: transform.current, scale, origin: { x: 0, y: 0 }, focal: { x: 0, y: 0 } }) }) });
    setDisplayScale(transform.current.scale);
  };
  const close = () => {
    if (closing.current) return;
    closing.current = true;
    onClose();
  };
  const pan = Gesture.Pan().runOnJS(true).withTestId('photo-viewer-pan').minDistance(5)
    .onBegin((event) => { if (moving.current || closing.current) return; pinched.current = pinching.current || event.numberOfPointers > 1; rebasePan.current = false; panStart.current = { ...transform.current }; panOrigin.current = { x: 0, y: 0 }; values.x.stopAnimation(); values.y.stopAnimation(); })
    .onUpdate((event) => {
      if (closing.current || moving.current) return;
      if (pinching.current || event.numberOfPointers !== 1) { pinched.current = true; rebasePan.current = true; return; }
      if (rebasePan.current) { panStart.current = { ...transform.current }; panOrigin.current = { x: event.translationX, y: event.translationY }; rebasePan.current = false; }
      const x = panStart.current.x + event.translationX - panOrigin.current.x;
      const y = panStart.current.y + event.translationY - panOrigin.current.y;
      if (transform.current.scale > 1) apply({ next: bounded({ next: { ...transform.current, x, y } }) });
      else if (!pinched.current) apply({ next: { scale: 1, x, y: 0 } });
    })
    .onEnd((event, success) => {
      if (!success || closing.current || moving.current || pinching.current) return;
      if (transform.current.scale === 1) {
        move({ next: swipePhotoIndex({ index, count, width: viewport.width, x: event.translationX, y: event.translationY, pinched: pinched.current }) });
      }
    })
    .onFinalize(() => { if (!pinching.current) settle(); });
  const pinch = Gesture.Pinch().runOnJS(true).withTestId('photo-viewer-pinch').enabled(status === ImageStatus.Ready)
    .onStart((event) => {
      if (moving.current || closing.current) return;
      pinching.current = true; pinched.current = true; rebasePan.current = true;
      values.x.stopAnimation(); values.y.stopAnimation();
      pinchStart.current = { transform: { ...transform.current }, origin: { x: event.focalX - viewport.width / 2, y: event.focalY - viewport.height / 2 }, gestureScale: event.scale, pointers: event.numberOfPointers };
    })
    .onUpdate((event) => {
      if (closing.current || moving.current) return;
      if (event.numberOfPointers !== pinchStart.current.pointers) {
        pinchStart.current = { transform: { ...transform.current }, origin: { x: event.focalX - viewport.width / 2, y: event.focalY - viewport.height / 2 }, gestureScale: event.scale, pointers: event.numberOfPointers };
        return;
      }
      apply({ next: bounded({ next: zoomAtPoint({ start: pinchStart.current.transform, scale: pinchStart.current.transform.scale * event.scale / pinchStart.current.gestureScale,
        origin: pinchStart.current.origin, focal: { x: event.focalX - viewport.width / 2, y: event.focalY - viewport.height / 2 } }) }) });
    })
    .onFinalize(() => { pinching.current = false; rebasePan.current = true; settle(); });

  const control = ({ label, disabled, onPress, icon }: { label: string; disabled?: boolean; onPress: () => void; icon?: IconName }) => (
    <MotionPressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} disabled={disabled}
      onPress={onPress} hitSlop={theme.spacing[4]} pressSize="sm" pressedOpacity={0.6}
      style={[styles.control, { opacity: disabled ? 0.4 : 1, padding: theme.spacing[8] }]}>
      {icon ? <Icon name={icon} color="mediaViewerFg" size={24} /> : <Text variant="bodySm" color="mediaViewerFg">{label}</Text>}
    </MotionPressable>
  );
  return (
    <View style={[styles.fill, { backgroundColor: theme.color.mediaViewerBg }]}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing[8], paddingHorizontal: theme.spacing[12] }]}>
        {control({ label: '사진 보기 닫기', onPress: close, icon: IconName.Close })}
        <Text variant="bodySm" color="mediaViewerFg" accessibilityLiveRegion="polite">{`${index + 1} / ${count}`}</Text>
        <View style={styles.control} />
      </View>
      <GestureDetector gesture={Gesture.Simultaneous(pan, pinch)}>
        <View testID="viewer-viewport" collapsable={false} style={styles.viewport} onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setViewport((prev) => prev.width === width && prev.height === height ? prev : { width, height });
        }}>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: values.opacity, transform: [{ translateX: values.x }, { translateY: values.y }, { scale: values.scale }] }]}>
            <Image testID="viewer-image" source={{ uri }} resizeMode="contain" accessibilityLabel={`${placeName} 사진 ${index + 1}`}
              style={styles.fill} onLoad={(event) => { const { width, height } = event.nativeEvent.source; setImage({ width, height }); setStatus(ImageStatus.Ready); }}
              onError={() => { setStatus(ImageStatus.Error); apply({ next: { ...INITIAL_TRANSFORM } }); setDisplayScale(1); }} />
          </Animated.View>
          {status !== ImageStatus.Ready ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.message]}>
            <Text variant="bodySm" color="mediaViewerFg">{status === ImageStatus.Loading ? '사진을 불러오는 중이에요' : '사진을 불러오지 못했어요'}</Text>
            {status === ImageStatus.Error ? <Text variant="caption" color="mediaViewerFg">닫고 다시 열어 주세요</Text> : null}
          </View> : null}
        </View>
      </GestureDetector>
      <View style={{ paddingHorizontal: theme.spacing[20], paddingBottom: insets.bottom + theme.spacing[16], gap: theme.spacing[12] }}>
        <Text variant="caption" color="mediaViewerFg" style={styles.scale} accessibilityLiveRegion="polite">{`${Number(displayScale.toFixed(1))}배`}</Text>
        <View style={styles.controls}>
          {control({ label: '이전 사진', icon: IconName.ChevronLeft, disabled: index === 0, onPress: () => move({ next: index - 1 }) })}
          {control({ label: '축소', disabled: status !== ImageStatus.Ready || displayScale <= 1, onPress: () => zoom({ increase: false }) })}
          {control({ label: '확대', icon: IconName.Plus, disabled: status !== ImageStatus.Ready || displayScale >= 3, onPress: () => zoom({ increase: true }) })}
          {control({ label: '다음 사진', icon: IconName.ChevronRight, disabled: index === count - 1, onPress: () => move({ next: index + 1 }) })}
        </View>
      </View>
    </View>
  );
};
const styles = StyleSheet.create({
  fill: { flex: 1 },
  viewport: { flex: 1, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  control: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  message: { alignItems: 'center', justifyContent: 'center' },
  scale: { textAlign: 'center' },
});
