// src/features/map/components/LogPickerSheet.tsx
// 대상 로그 선택 시트 — map-nearby-wish(plan §4.1·T4). 킷 직접 시안 없음(킷 MapScreen엔 로그 선택 UI 부재).
//   패턴 조합: 공용 Sheet(mk-ui:196 재현)를 셸로, 본문은 로그 행 리스트(이름 + MemberBadge + chevron-right).
//   행 = 킷 MemberBadge(mk-ui:143 혼자/N명) + 우측 chevron(리스트 진입 관례). 신규 프리미티브 0 — 기존 조합.
//   로그 2+개일 때만 부모(MapTabScreen)가 연다(로그 1개면 시트 없이 즉시 담기 — 분기는 developer).
//   데이터는 props로만: logs(표시 라벨·멤버수·roomId) + onSelect({ roomId }). 라벨 산출(displayLogName 등)·
//   목록 소스·insert는 developer 몫. 여기선 프리젠테이션 + 선택 콜백만.
import React from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

import {
  Icon,
  IconName,
  MemberBadge,
  MotionPressable,
  Sheet,
  Text,
  useSheetScrollGesture,
} from '@/components';
import { useTheme } from '@/theme';

// 기본 시트 제목(해요체, 카피 단일 출처). 부모가 title로 대체 가능.
const DEFAULT_TITLE = '어디에 담을까요?';

// 눌림 불투명도 — 치환 전 로컬 styles.pressed 실값 승계(비주얼 회귀 0). 등급은 lg(전폭 리스트 행). ui-spec §2-2 A8.
const LOG_ROW_PRESSED_OPACITY = 0.6;

/** 시트에 표시할 로그 1행. 표시 전용 최소 shape(MyLog 전체와 디커플 — developer가 매핑해 주입). */
export type LogPickerItem = {
  /** 대상 방 id(선택 시 onSelect로 되돌려줌). */
  roomId: string;
  /** 행에 표시할 로그 이름(라벨). developer가 displayLogName/logTitleFromMembers로 산출·주입. */
  label: string;
  /** 멤버 수(1=혼자 / 2+=N명). MemberBadge 표시에 사용. */
  memberCount: number;
};

export type LogPickerSheetProps = {
  /** 표시 여부. false면 미렌더(Sheet가 null 반환). */
  visible: boolean;
  /** 딤 탭/핸들 드래그-다운/취소 시 닫기. */
  onClose: () => void;
  /** 시트 제목(가운데). 기본 "어디에 담을까요?". */
  title?: string;
  /** 표시할 로그 목록(2+개일 때 부모가 연다). */
  logs: LogPickerItem[];
  /** 로그 행 탭 시 그 roomId를 되돌려준다. 담기(insert)는 부모/훅. */
  onSelect: (args: { roomId: string }) => void;
};

// 스크롤 본문 — **반드시 Sheet의 children으로 렌더돼야 한다.**
//   useSheetScrollGesture는 Sheet가 body에 깐 컨텍스트를 읽는다. Sheet를 렌더하는 쪽(부모)에서 호출하면
//   컨텍스트가 null이라 시트 드래그와의 우선순위 관계가 조용히 안 맺어진다(sheet-drag-rework QA L1).
const LogPickerBody = ({
  logs,
  onSelect,
}: Pick<LogPickerSheetProps, 'logs' | 'onSelect'>) => {
  const theme = useTheme();
  // 시트 안 유일한 내부 스크롤 — 시트 드래그-dismiss보다 스크롤이 우선권을 갖도록 명시적으로 묶는다
  //   (RNGH는 관계를 선언하지 않으면 먼저 활성화된 쪽이 이기므로, 리스트 스크롤이 죽을 수 있다).
  const scrollGesture = useSheetScrollGesture();

  // 로그 행 사이 헤어라인 구분선(첫 행 제외). 리스트 관례 — 킷 카드 리스트의 hairline 분리.
  const divider: ViewStyle = {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.color.hairlineAlt,
  };

  return (
    <GestureDetector gesture={scrollGesture}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        {logs.map((log, index) => (
          <MotionPressable
            key={log.roomId}
            testID={`log-picker-row-${log.roomId}`}
            accessibilityRole="button"
            accessibilityLabel={log.label}
            onPress={() => onSelect({ roomId: log.roomId })}
            pressSize="lg"
            pressedOpacity={LOG_ROW_PRESSED_OPACITY}
            style={[
              styles.row,
              { gap: theme.spacing[8], paddingVertical: theme.spacing[14] },
              index > 0 ? divider : null,
            ]}
          >
            <Text variant="cardTitle" color="fg" numberOfLines={1} style={styles.label}>
              {log.label}
            </Text>
            <MemberBadge memberCount={log.memberCount} />
            <Icon name={IconName.ChevronRight} size={20} color="fgMuted" />
          </MotionPressable>
        ))}
      </ScrollView>
    </GestureDetector>
  );
};

export const LogPickerSheet = ({
  visible,
  onClose,
  title = DEFAULT_TITLE,
  logs,
  onSelect,
}: LogPickerSheetProps) => (
  <Sheet visible={visible} onClose={onClose} title={title}>
    <LogPickerBody logs={logs} onSelect={onSelect} />
  </Sheet>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { flex: 1, minWidth: 0 },
});
