// src/features/notif/NotifSettingsView.tsx
// 알림 설정 화면(프리젠테이셔널) — 킷 mk-extra.jsx:128-175 NotifSettingsScreen 재현 (notif-settings).
//   구조: Screen + SubBar "알림 설정" → ScrollView(마스터 토글 카드 + "로그별 알림" 섹션 카드 + 안내 카피).
//   마스터 off → 로그별 카드 dim(opacity 0.45) + 입력 비활성(pointerEvents none + MkSwitch disabled), 저장값 보존(D2).
//   카드 radius는 킷 ex.card(mk-extra:229) = 20(radius.sheet)로 정합 — 공용 Card(22)와 달라 본 화면 전용 골격으로 구현.
//   데이터(영속·로그목록·displayLogName·아바타 신원)는 props 주입 — developer가 useNotifPrefs/useMyLogs/useProfile로 배선.
//   스타일은 토큰만(raw hex/숫자 색 0). 이모지 허용(킷 기준 🔔).
import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, MkSwitch, Screen, SubBar, Text } from '@/components';
import { useTheme } from '@/theme';

/** 로그별 토글 행 1건의 뷰모델. developer가 MyLog + useProfile + resolveLogEnabled로 매핑해 주입. */
export type NotifLogItem = {
  /** 영속 perLog 맵 키이자 토글 식별자. */
  roomId: string;
  /** 표시 로그명(displayLogName 결과). 1줄 ellipsis. */
  name: string;
  /** 멤버 수(2+ → 커플: 아바타 2개 겹침). */
  memberCount: number;
  /** 해당 로그 토글 상태(resolveLogEnabled 결과). */
  enabled: boolean;
  /** 본인 아바타 — 결정적 디폴트 파생 키(userId). */
  meUserId?: string | null;
  /** 본인 아바타 이미지 URL(있으면 우선). */
  meAvatarUrl?: string | null;
  /** 파트너 아바타 파생 키(커플일 때). 없으면 익명 폴백. */
  partnerUserId?: string | null;
  /** 파트너 아바타 이미지 URL. */
  partnerAvatarUrl?: string | null;
};

export type NotifSettingsViewProps = {
  /** 마스터 토글 상태. */
  master: boolean;
  /** 마스터 토글 변경 콜백(developer: setMaster). */
  onToggleMaster: (args: { enabled: boolean }) => void;
  /** 로그별 토글 행 목록(빈 배열 = 빈 안내). */
  logs: NotifLogItem[];
  /** 로그별 토글 변경 콜백(developer: setLogEnabled). */
  onToggleLog: (args: { roomId: string; enabled: boolean }) => void;
  /** 로그 목록 로딩 중이면 플레이스홀더 표시(T8). 기본 false. */
  isLogsLoading?: boolean;
  /** 뒤로 가기(developer: navigation.goBack). */
  onBack: () => void;
};

// 킷 mk-extra 실측 상수.
const ICON_TILE = 38; // 🔔 타일 38×38(mk-extra:141)
const ICON_EMOJI_SIZE = 19; // 🔔 fontSize 19(mk-extra:141)
const AVATAR_SIZE = 32; // 로그 행 아바타 32(mk-extra:159)
const AVATAR_OVERLAP = -10; // 커플 파트너 겹침 marginLeft -10(mk-extra:160)
const DIM_OPACITY = 0.45; // 마스터 off dim(mk-extra:152)

export const NotifSettingsView = ({
  master,
  onToggleMaster,
  logs,
  onToggleLog,
  isLogsLoading = false,
  onBack,
}: NotifSettingsViewProps) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // 킷 ex.card(mk-extra:229): surface + radius 20(sheet) + 소프트 섀도우 + overflow hidden(행 구분선 클립).
  const cardStyle: ViewStyle = {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.sheet,
    overflow: 'hidden',
    ...theme.shadow.card,
  };
  // 로그별 카드 — 마스터 off면 dim + 입력 비활성(저장값 보존, D2).
  const logsCardStyle: ViewStyle = { ...cardStyle, opacity: master ? 1 : DIM_OPACITY };

  return (
    <Screen edges={['left', 'right']} style={styles.screen}>
      {/* 'top' 제외: SubBar가 insets.top을 직접 처리(기존 SubBar 화면 동일 패턴).
          'bottom' 제외: 비-GNB 엣지투엣지 하단 빈 띠 방지 — 콘텐츠 paddingBottom+insets.bottom으로 인디케이터 클리어. */}
      <SubBar title="알림 설정" onBack={onBack} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing[20],
          paddingTop: theme.spacing[12],
          paddingBottom: theme.spacing[28] + insets.bottom,
        }}
      >
        {/* 마스터 토글 카드(킷 mk-extra:139-148) */}
        <View style={cardStyle}>
          <View style={styles.masterRow}>
            <View
              style={[
                styles.iconTile,
                { backgroundColor: theme.color.primaryWeak, borderRadius: theme.radius.lg },
              ]}
            >
              <Text style={styles.iconEmoji}>🔔</Text>
            </View>
            <View style={styles.masterText}>
              <Text variant="notifItemTitle" color="fg">
                새 먹로그 알림
              </Text>
              <Text variant="notifItemDesc" color="fgMuted" style={styles.masterDesc}>
                참여한 로그에 새 기록이 올라오면 알려드려요
              </Text>
            </View>
            <MkSwitch
              value={master}
              onValueChange={(next) => onToggleMaster({ enabled: next })}
              accessibilityLabel="새 먹로그 알림"
            />
          </View>
        </View>

        {/* "로그별 알림" 섹션 라벨(킷 mk-extra:151) */}
        <Text variant="notifSectionLabel" color="fgMuted" style={styles.sectionLabel}>
          로그별 알림
        </Text>

        {/* 로딩 / 빈 / 목록 분기 */}
        {isLogsLoading ? (
          <View style={[cardStyle, styles.stateBox]}>
            <ActivityIndicator testID="notif-logs-loading" color={theme.color.primary} />
          </View>
        ) : logs.length === 0 ? (
          <View style={[cardStyle, styles.stateBox]}>
            <Text variant="notifLogName" color="fgMuted">
              아직 참여한 로그가 없어요
            </Text>
          </View>
        ) : (
          // 마스터 off → pointerEvents none(입력 차단) + dim. MkSwitch disabled로 a11y 상태도 정합.
          <View style={logsCardStyle} pointerEvents={master ? 'auto' : 'none'}>
            {logs.map((item, index) => {
              const isCouple = item.memberCount >= 2;
              return (
                <View
                  key={item.roomId}
                  style={[
                    styles.logRow,
                    index > 0
                      ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.color.hairlineAlt }
                      : null,
                  ]}
                >
                  <View style={styles.avatars}>
                    <Avatar url={item.meAvatarUrl} userId={item.meUserId} size={AVATAR_SIZE} />
                    {isCouple ? (
                      <View style={{ marginLeft: AVATAR_OVERLAP }}>
                        <Avatar
                          url={item.partnerAvatarUrl}
                          userId={item.partnerUserId}
                          size={AVATAR_SIZE}
                        />
                      </View>
                    ) : null}
                  </View>
                  <Text variant="notifLogName" color="fg" numberOfLines={1} style={styles.logName}>
                    {item.name}
                  </Text>
                  <MkSwitch
                    value={item.enabled}
                    disabled={!master}
                    onValueChange={(next) => onToggleLog({ roomId: item.roomId, enabled: next })}
                    accessibilityLabel={`${item.name} 알림`}
                  />
                </View>
              );
            })}
          </View>
        )}

        {/* 안내 카피(킷 mk-extra:168-170) */}
        <Text variant="notifHint" color="fgAssistive" style={styles.hint}>
          알림은 기기 설정에서도 켜져 있어야 받을 수 있어요.
        </Text>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: { padding: 0 },
  scroll: { flex: 1 },
  // 킷 mk-extra:140 마스터 행 — gap 13, padding 16/16.
  masterRow: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16 },
  iconTile: { width: ICON_TILE, height: ICON_TILE, alignItems: 'center', justifyContent: 'center' },
  iconEmoji: { fontSize: ICON_EMOJI_SIZE, textAlign: 'center' },
  masterText: { flex: 1 },
  masterDesc: { marginTop: 3 }, // 킷 mk-extra:144 marginTop 3
  // 킷 mk-extra:151 섹션 라벨 margin "22 4 10".
  sectionLabel: { marginTop: 22, marginBottom: 10, marginHorizontal: 4 },
  // 킷 mk-extra:157 로그 행 — gap 12, padding 13/16.
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 16 },
  avatars: { flexDirection: 'row' },
  logName: { flex: 1 },
  // 빈/로딩 상태 박스 — 카드 안 중앙(킷 미정의: 앱 정책).
  stateBox: { paddingVertical: 28, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  // 킷 mk-extra:168 안내 카피 margin "14 6 0".
  hint: { marginTop: 14, marginHorizontal: 6 },
});
