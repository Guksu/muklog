// src/components/Sheet.tsx
// 공용 하단 시트(액션시트/모달 베이스) — mk-ui Sheet 재현 (plan §6.4, T4).
//   딤 배경 + 하단 패널(핸들바 + 옵션 title + children). 딤 탭 → onClose, 패널 탭은 전파 차단.
//   RN Modal(transparent) 위에 absolute 오버레이를 깔아 네비 스택과 무관하게 화면 전체를 덮는다.
//   스타일은 토큰만(raw hex 0). radius=sheet(20 위쪽 라운드는 26 근사 — 킷 26,26,0,0), 딤=반투명 잉크.
import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { Text } from './Text';

const SHEET_TOP_RADIUS = 26; // mk-ui Sheet: 26px 26px 0 0 (상단 라운드)
const HANDLE_WIDTH = 40;
const HANDLE_HEIGHT = 5;
// 딤 배경(rgba(20,12,8,.32)) — 따뜻한 잉크 톤. 토큰엔 동일 색이 없어 fg(웜 잉크) 위에 투명도로 근사.
const BACKDROP_OPACITY = 0.32;

export type SheetProps = {
  /** 표시 여부. false면 미렌더(children 마운트 안 함). */
  visible: boolean;
  /** 딤 배경 탭/요청 시 닫기. */
  onClose: () => void;
  /** 시트 상단 제목(가운데). 생략 가능. */
  title?: string;
  children: React.ReactNode;
};

export const Sheet = ({ visible, onClose, title, children }: SheetProps) => {
  const theme = useTheme();

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      {/* 딤 배경 — 탭하면 닫힘 */}
      <Pressable
        testID="sheet-backdrop"
        accessibilityRole="button"
        accessibilityLabel="닫기"
        onPress={onClose}
        style={[styles.backdrop, { backgroundColor: theme.color.fg, opacity: BACKDROP_OPACITY }]}
      />
      {/* 하단 패널 — 탭해도 닫히지 않음(딤 위에 별도 레이어로 전파 차단) */}
      <View style={styles.panelWrap} pointerEvents="box-none">
        <Pressable
          testID="sheet-panel"
          style={[
            styles.panel,
            {
              backgroundColor: theme.color.surface,
              paddingTop: theme.spacing[10],
              paddingHorizontal: theme.spacing[20],
              paddingBottom: theme.spacing[32],
            },
            theme.shadow.lg,
          ]}
        >
          <View
            style={[
              styles.handle,
              { backgroundColor: theme.color.hairline, marginBottom: theme.spacing[14] },
            ]}
          />
          {title ? (
            <Text variant="h3" color="fg" style={[styles.title, { marginBottom: theme.spacing[16] }]}>
              {title}
            </Text>
          ) : null}
          {children}
        </Pressable>
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
  },
  handle: { width: HANDLE_WIDTH, height: HANDLE_HEIGHT, borderRadius: HANDLE_HEIGHT, alignSelf: 'center' },
  title: { textAlign: 'center' },
});
