// src/features/muklog/MuklogList.tsx
// LogScreen 'log' 세그 맛집 섹션 — mk-log.jsx LogScreen 섹션(54–78) 재현 (plan §6.1 / §5 T10, AC1·AC2·AC11·AC12).
//   섹션 헤더("우리 맛집 N" + "최근 순") + 상태 분기(loading/error/empty/ready) + MuklogCard 리스트 + FAB → 에디터.
//   N = 조회된 리스트 길이(D7, 추가 쿼리 없음). 저장은 에디터 화면에서 → 복귀 시 LogScreen 포커스 refresh로 갱신(AC2·AC12).
//   ⚠️ FLAG-1: 입력 시트(MuklogEntrySheet) → 풀스크린 에디터 라우트(MuklogEditor)로 전환. FAB는 navigate만 한다.
//     장소검색/선택 상태는 에디터 컨테이너(MuklogEditorRoute)가 소유 — 리스트에서 제거.
//   ⚠️ wishlist 스프린트: 세그 카운트(기록 N)를 LogScreen이 알아야 해 useMuklogs 소유를 LogScreen으로 이관.
//     이 컴포넌트는 presentational(state/refresh props 수신) — 데이터 조회·포커스 refresh는 LogScreen이 단일 소유(이중 로드 0).
//   스타일은 토큰만(raw hex 0), 이모지 허용.
//
// 소비: LogScreen 'log' 세그에서 <MuklogList roomId meId state refresh /> 마운트(state=useMuklogs, meId=auth uid).
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import { Button, Chip, Icon, IconName, Text } from '@/components';
import { Routes, type AppStackParamList } from '@/navigation/routes';
import { useTheme } from '@/theme';

import { categoryLabel } from './categories';
import { filterMuklogsByCategory, muklogCategoriesInUse } from './filterByCategory';
import { MuklogCard } from './MuklogCard';
import { type MuklogsState } from './types';

export type MuklogListProps = {
  /** 조회 대상 로그 id(LogScreen route.params.roomId) — FAB navigate 대상. */
  roomId: string;
  /** 현재 사용자 uid — 카드 작성자 라벨 파생용. */
  meId: string;
  /** 먹로그 목록 상태(LogScreen이 useMuklogs로 소유·주입). */
  state: MuklogsState;
  /** 재조회(에러 "다시 시도") — LogScreen useMuklogs.refresh. */
  refresh: () => Promise<void>;
  /** 리스트 스크롤 영역 최상단에 끼우는 노드(초대 영역 등). 고정이 아니라 콘텐츠와 함께 스크롤된다(사용자 요청). */
  header?: React.ReactNode;
};

export const MuklogList = ({ roomId, meId, state, refresh, header }: MuklogListProps) => {
  const theme = useTheme();
  // LogScreen이 'bottom' edge를 떼면서(엣지투엣지 하단 빈 띠 제거) 이 리스트가 화면 끝까지 차므로,
  //   스크롤 tail·FAB 위치에 insets.bottom을 더해 home indicator 클리어런스를 보존한다.
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  // 카테고리 필터(B2) — null="전체". 선택 상태만 화면 보유, 도출/필터는 순수 유틸(filterByCategory).
  const [category, setCategory] = useState<string | null>(null);

  // 섹션 헤더의 N(D7) — ready일 때만 실제 개수, 그 외 0. N은 필터 무관 전체 수(킷 mk-log.jsx:55).
  const count = state.status === 'ready' ? state.muklogs.length : 0;

  // FAB → 풀스크린 에디터(작성 모드) 진입. 저장은 에디터에서, 복귀 시 포커스 refresh로 목록 갱신.
  const handleOpenEditor = () => navigation.navigate(Routes.MuklogEditor, { roomId });

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing[20], paddingBottom: theme.spacing[80] + insets.bottom }}
      >
        {/* 스크롤 헤더(초대 영역 등) — 고정이 아니라 콘텐츠와 함께 스크롤돼 위로 사라진다(사용자 요청). */}
        {header ? <View style={{ marginBottom: theme.spacing[12] }}>{header}</View> : null}

        {/* 섹션 헤더 */}
        <View style={[styles.headerRow, { marginBottom: theme.spacing[10] }]}>
          <Text variant="sectionTitle" color="fg">
            우리 맛집 {count}
          </Text>
          <Text variant="meta" color="fgMuted">
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
          <View>
            {/* 카테고리 필터 칩 행 — "전체" + 리스트에 존재하는 카테고리(가로 스크롤, gap 7). */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[
                styles.chipRow,
                { gap: theme.spacing[7], paddingHorizontal: theme.spacing[20] },
              ]}
              // 칩이 화면 좌우 끝까지 스크롤(edge-bleed) — 바깥 padding20 상쇄 후 contentContainer로 첫 칩 들여쓰기(킷 mk-log:60-64).
              style={{ marginHorizontal: -theme.spacing[20], marginBottom: theme.spacing[14] }}
            >
              <Chip
                testID="chip-all"
                label="전체"
                selected={category === null}
                onPress={() => setCategory(null)}
              />
              {muklogCategoriesInUse({ muklogs: state.muklogs }).map((key) => (
                <Chip
                  key={key}
                  testID={`chip-${key}`}
                  label={categoryLabel({ key })}
                  selected={category === key}
                  onPress={() => setCategory(key)}
                />
              ))}
            </ScrollView>

            {/* 필터된 카드 리스트(category=null이면 전체). */}
            <View style={{ gap: theme.spacing[14] }}>
              {filterMuklogsByCategory({ muklogs: state.muklogs, category }).map((item) => (
                <MuklogCard
                  key={item.id}
                  muklog={item}
                  meId={meId}
                  onPress={() => navigation.navigate(Routes.MuklogDetail, { muklogId: item.id })}
                />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* FAB — 새 먹로그 에디터(풀스크린) 진입 */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="새 먹로그"
        onPress={handleOpenEditor}
        style={[
          styles.fab,
          {
            backgroundColor: theme.color.primary,
            borderRadius: theme.radius.full,
            bottom: theme.spacing[26] + insets.bottom,
            right: theme.spacing[18],
            // 킷 mk-log:495 FAB 글로우 0 8px 22px var(--mk-accent-shadow) — 컬러(블루) 그림자. shadow.md(검정) 대신 accent 틴트.
            shadowColor: theme.color.accentShadow,
            shadowOpacity: 1,
            shadowRadius: 22,
            shadowOffset: { width: 0, height: 8 },
            elevation: 8,
          },
        ]}
      >
        <Icon name={IconName.Plus} size={26} color="primaryFg" />
      </Pressable>
    </View>
  );
};

const FAB_SIZE = 58;

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  // 필터 칩 행 — 가로 스크롤, 칩이 세로 중앙 정렬되도록 alignItems center(gap은 인라인 토큰).
  chipRow: { flexDirection: 'row', alignItems: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center' },
  // 큰 이모지는 RN에서 fontSize==lineHeight면 위/아래가 잘린다 → ×1.27 헤드룸(44→56)으로 클리핑 방지.
  //   textAlignVertical center로 잘림 시 상하 균형(Android). 디바이스 기준 56이면 🍽️ 글리프가 온전히 보인다.
  emptyEmoji: { fontSize: 44, lineHeight: 56, textAlignVertical: 'center' },
  fab: {
    position: 'absolute',
    width: FAB_SIZE,
    height: FAB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
