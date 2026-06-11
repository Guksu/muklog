// src/features/muklog/MuklogList.tsx
// LogScreen 맛집 섹션 — mk-log.jsx LogScreen 섹션(54–78) 재현 (plan §6.1 / §5 T10, AC1·AC2·AC11·AC12).
//   섹션 헤더("우리 맛집 N" + "최근 순") + 상태 분기(loading/error/empty/ready) + MuklogCard 리스트 + FAB → 입력 시트.
//   N = 조회된 리스트 길이(D7, 추가 쿼리 없음). 저장 성공 → refresh + 시트 닫기(AC2·AC12).
//   useMuklogs(진입 1회+refresh)·useCreateMuklog(시트 내부)를 소유. 스타일은 토큰만(raw hex 0), 이모지 허용.
//
// 소비: LogScreen이 초대 카드 아래에 <MuklogList roomId meId /> 마운트(roomId=route.params, meId=auth uid).
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Icon, IconName, Text } from '@/components';
import { useTheme } from '@/theme';

import { MuklogCard } from './MuklogCard';
import { MuklogEntrySheet } from './MuklogEntrySheet';
import { useMuklogs } from './useMuklogs';

export type MuklogListProps = {
  /** 조회 대상 로그 id(LogScreen route.params.roomId). */
  roomId: string;
  /** 현재 사용자 uid — 카드 작성자 라벨 파생용. */
  meId: string;
};

export const MuklogList = ({ roomId, meId }: MuklogListProps) => {
  const theme = useTheme();
  const { state, refresh } = useMuklogs({ roomId });
  const [sheetOpen, setSheetOpen] = useState(false);

  // 섹션 헤더의 N(D7) — ready일 때만 실제 개수, 그 외 0.
  const count = state.status === 'ready' ? state.muklogs.length : 0;

  const handleSaved = async () => {
    setSheetOpen(false);
    await refresh();
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing[20], paddingBottom: theme.spacing[80] }}
      >
        {/* 섹션 헤더 */}
        <View style={[styles.headerRow, { marginBottom: theme.spacing[10] }]}>
          <Text variant="h3" color="fg">
            우리 맛집 {count}
          </Text>
          <Text variant="sectionCaption" color="fgMuted">
            최근 순
          </Text>
        </View>

        {state.status === 'loading' ? (
          <View style={[styles.center, { paddingVertical: theme.spacing[40] }]}>
            <ActivityIndicator testID="muklog-list-loading" color={theme.color.primary} />
          </View>
        ) : null}

        {state.status === 'error' ? (
          <View
            style={[styles.center, { paddingVertical: theme.spacing[32], gap: theme.spacing[12] }]}
          >
            <Text variant="bodySm" color="error" style={styles.centerText}>
              {state.message}
            </Text>
            <Button
              title="다시 시도"
              accessibilityLabel="다시 시도"
              variant="secondary"
              onPress={() => void refresh()}
            />
          </View>
        ) : null}

        {state.status === 'ready' && state.muklogs.length === 0 ? (
          <View
            style={[styles.center, { paddingVertical: theme.spacing[40], gap: theme.spacing[8] }]}
          >
            <Text style={styles.emptyEmoji}>🍽️</Text>
            <Text variant="emptyTitle" color="fg" style={styles.centerText}>
              아직 기록한 맛집이 없어요
            </Text>
            <Text variant="bodySm" color="fgWeak" style={styles.centerText}>
              아래 + 버튼으로 첫 맛집을 남겨보세요
            </Text>
          </View>
        ) : null}

        {state.status === 'ready' && state.muklogs.length > 0 ? (
          <View style={{ gap: theme.spacing[14] }}>
            {state.muklogs.map((item) => (
              <MuklogCard key={item.id} muklog={item} meId={meId} />
            ))}
          </View>
        ) : null}
      </ScrollView>

      {/* FAB — 새 먹로그 입력 시트 오픈 */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="새 먹로그"
        onPress={() => setSheetOpen(true)}
        style={[
          styles.fab,
          {
            backgroundColor: theme.color.primary,
            borderRadius: theme.radius.full,
            bottom: theme.spacing[24],
            right: theme.spacing[20],
          },
          theme.shadow.md,
        ]}
      >
        <Icon name={IconName.Plus} size={26} color="primaryFg" />
      </Pressable>

      <MuklogEntrySheet
        visible={sheetOpen}
        roomId={roomId}
        onClose={() => setSheetOpen(false)}
        onSaved={() => void handleSaved()}
      />
    </View>
  );
};

const FAB_SIZE = 58;

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  center: { alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center' },
  emptyEmoji: { fontSize: 44 },
  fab: {
    position: 'absolute',
    width: FAB_SIZE,
    height: FAB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
