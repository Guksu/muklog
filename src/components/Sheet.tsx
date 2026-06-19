// src/components/Sheet.tsx
// 공용 하단 시트(액션시트/모달 베이스) — mk-ui Sheet 재현 (plan §6.4, T4).
//   딤 배경 + 하단 패널(핸들바 + 옵션 title + children). 딤 탭 → onClose, 패널 탭은 전파 차단.
//   핸들 영역 드래그-to-dismiss(PanResponder + Animated, RN 내장 — 네이티브 모듈/재빌드 불필요).
//     아래로 SHEET_DISMISS_DISTANCE 초과 또는 SHEET_DISMISS_VELOCITY 초과 속도면 닫고, 아니면 제자리 스냅백.
//     ⚠️ 본문(장소검색 등) 스크롤과 충돌하지 않도록 panHandlers는 핸들 영역에만 부착(본문은 정상 스크롤).
//   RN Modal(transparent) 위에 absolute 오버레이를 깔아 네비 스택과 무관하게 화면 전체를 덮는다.
//   스타일은 토큰만(raw hex 0). radius=sheet(20 위쪽 라운드는 26 근사 — 킷 26,26,0,0), 딤=반투명 잉크.
import React, { useRef } from 'react';
import { Animated, Modal, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

import { Text } from './Text';

const SHEET_TOP_RADIUS = 26; // mk-ui Sheet: 26px 26px 0 0 (상단 라운드)
const HANDLE_WIDTH = 40;
const HANDLE_HEIGHT = 5;
// 딤 배경(rgba(20,12,8,.32)) — 따뜻한 잉크 톤. 토큰엔 동일 색이 없어 fg(웜 잉크) 위에 투명도로 근사.
const BACKDROP_OPACITY = 0.32;
// 패널 상단 캡 — 내용(장소검색 결과 등)이 길어져도 상태바를 침범하지 않게 화면의 88%까지만(나머지는 내부 스크롤).
//   킷 Sheet는 디바이스 프레임 inset:0 안에서 자라므로 RN에선 maxHeight + 하단 safe-area inset으로 번역.
const PANEL_MAX_HEIGHT_RATIO = '88%';

// 드래그-to-dismiss 임계 — 거리(px) 또는 속도(px/ms) 중 하나만 넘어도 닫는다(자연스러운 플릭/슬로우드래그 모두 지원).
export const SHEET_DISMISS_DISTANCE = 80;
export const SHEET_DISMISS_VELOCITY = 0.5;
// 닫힐 때 패널을 화면 밖으로 밀어내는 거리(대부분 기기 높이 미만이라 충분).
const SHEET_DISMISS_TRANSLATE = 700;

/**
 * 드래그 릴리스 시 시트를 닫을지 결정한다(순수 — 단위 테스트 대상).
 *   아래로 충분히 끌었거나(dy>거리) 빠르게 아래로 플릭(vy>속도)하면 닫는다. 위로 끈 건(dy<=0) 닫지 않음.
 * @param dy 시작점 대비 세로 이동(px, 아래로 +)
 * @param vy 세로 속도(px/ms, 아래로 +)
 */
export const shouldDismissSheet = ({ dy, vy }: { dy: number; vy: number }): boolean =>
  dy > SHEET_DISMISS_DISTANCE || vy > SHEET_DISMISS_VELOCITY;

export type SheetProps = {
  /** 표시 여부. false면 미렌더(children 마운트 안 함). */
  visible: boolean;
  /** 딤 배경 탭/핸들 드래그-다운/요청 시 닫기. */
  onClose: () => void;
  /** 시트 상단 제목(가운데). 생략 가능. */
  title?: string;
  children: React.ReactNode;
};

export const Sheet = ({ visible, onClose, title, children }: SheetProps) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // 패널 세로 오프셋(드래그 추종). 닫힘/스냅백 후 0으로 복원해 다음 오픈을 깨끗이.
  const translateY = useRef(new Animated.Value(0)).current;
  // onClose는 렌더마다 바뀔 수 있어 ref로 최신값을 읽는다(PanResponder는 1회 생성).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const panResponder = useRef(
    PanResponder.create({
      // 아래로 4px 이상 움직이고 세로 우세일 때만 드래그로 인식(탭·가로 제스처 보존).
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        gesture.dy > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      // 아래로만 추종(위로 끌어도 0 고정 — 시트가 위로 안 솟게).
      onPanResponderMove: (_evt, gesture) => {
        if (gesture.dy > 0) translateY.setValue(gesture.dy);
      },
      onPanResponderRelease: (_evt, gesture) => {
        if (shouldDismissSheet({ dy: gesture.dy, vy: gesture.vy })) {
          Animated.timing(translateY, {
            toValue: SHEET_DISMISS_TRANSLATE,
            duration: 180,
            useNativeDriver: false,
          }).start(() => {
            onCloseRef.current();
            translateY.setValue(0); // 다음 오픈을 위해 복원.
          });
        } else {
          // 임계 미달 → 제자리로 스냅백.
          Animated.spring(translateY, { toValue: 0, bounciness: 0, useNativeDriver: false }).start();
        }
      },
    }),
  ).current;

  if (!visible) return null;

  return (
    // animationType="none": fade면 닫히는 모달이 페이드아웃되는 동안 이전 시트 내용이 잔상으로 보임
    //   (시트→다른 시트 전환 시). none으로 즉시 마운트/언마운트해 잔상 제거(딤=즉시 피드백, 드래그 슬라이드는 유지).
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      {/* 딤 배경 — 탭하면 닫힘 */}
      <Pressable
        testID="sheet-backdrop"
        accessibilityRole="button"
        accessibilityLabel="닫기"
        onPress={onClose}
        style={[styles.backdrop, { backgroundColor: theme.color.fg, opacity: BACKDROP_OPACITY }]}
      />
      {/* 하단 패널 — 탭해도 닫히지 않음(딤 위에 별도 레이어로 전파 차단). 드래그 추종 transform. */}
      <View style={styles.panelWrap} pointerEvents="box-none">
        <Animated.View
          testID="sheet-panel"
          style={[
            styles.panel,
            {
              backgroundColor: theme.color.surface,
              paddingHorizontal: theme.spacing[20],
              // 하단 = 킷 34 근사(20) + 홈 인디케이터 safe-area inset(침범 방지).
              paddingBottom: insets.bottom + theme.spacing[20],
              transform: [{ translateY }],
            },
            theme.shadow.lg,
          ]}
        >
          {/* 핸들 영역(드래그-to-dismiss) — panHandlers는 여기에만. paddingVertical로 터치 타깃 확대. */}
          <View
            testID="sheet-handle"
            style={[styles.handleZone, { paddingTop: theme.spacing[10], paddingBottom: theme.spacing[14] }]}
            {...panResponder.panHandlers}
          >
            <View style={[styles.handle, { backgroundColor: theme.color.hairline }]} />
          </View>
          {title ? (
            <Text
              variant="sheetTitle"
              color="fg"
              style={[styles.title, { marginBottom: theme.spacing[16] }]}
            >
              {title}
            </Text>
          ) : null}
          {/* body — maxHeight 캡 아래에서 줄어들 수 있게 flexShrink. 내부 ScrollView가 이 영역 안에서 스크롤. */}
          <View style={styles.body}>{children}</View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject },
  panelWrap: { flex: 1, justifyContent: 'flex-end' },
  panel: {
    borderTopLeftRadius: SHEET_TOP_RADIUS,
    borderTopRightRadius: SHEET_TOP_RADIUS,
    maxHeight: PANEL_MAX_HEIGHT_RATIO,
  },
  // 핸들 드래그 영역 — 핸들바를 가운데 두고 위아래 패딩으로 잡기 쉽게.
  handleZone: { alignItems: 'center' },
  handle: { width: HANDLE_WIDTH, height: HANDLE_HEIGHT, borderRadius: HANDLE_HEIGHT },
  title: { textAlign: 'center' },
  body: { flexShrink: 1 },
});
