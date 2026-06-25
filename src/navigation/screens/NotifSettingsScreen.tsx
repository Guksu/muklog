// src/navigation/screens/NotifSettingsScreen.tsx
// 알림 설정 컨테이너(배선) — notif-settings. 비주얼은 NotifSettingsView 소유, 여기서는 데이터/영속/네비만 주입.
//   진입: ProfileScreen "알림 설정" 행 → navigate(NotifSettings). 자체 SubBar(AppNavigator headerShown:false).
//
// 생산자: useNotifPrefs(영속 master/perLog) · useMyLogsContext(로그 목록, 공유 캐시 — 추가 RPC 0) · useProfile(셀프 닉/아바타).
// 소비자: NotifSettingsView(프리젠테이셔널 props 계약). MyLog → NotifLogItem 매핑(displayLogName·resolveLogEnabled·아바타 신원).
//   파트너 신원은 profiles RLS self-only → partner* 생략 → Avatar 익명 폴백(기존 앱 동작과 일치).
import React from 'react';
import { useNavigation } from '@react-navigation/native';

import { Screen, Text } from '@/components';
import { useAuth } from '@/features/auth';
import { NotifSettingsView, type NotifLogItem } from '@/features/notif';
import { useNotifPrefs } from '@/features/notif/useNotifPrefs';
import { DEFAULT_NOTIF_PREFS, resolveLogEnabled } from '@/features/notif/notifPrefs';
import { defaultNickname, useProfileContext } from '@/features/profile';
import { displayLogName, useMyLogsContext } from '@/features/room';

export const NotifSettingsScreen = () => {
  const { state } = useAuth();
  // 인증 트리(HomeTabs) 하위에서만 진입하지만 방어적으로 분기(미인증 시 진입 차단).
  if (state.status !== 'authenticated') {
    return (
      <Screen center>
        <Text variant="body" color="fgWeak">
          알림 설정을 불러오는 중…
        </Text>
      </Screen>
    );
  }
  return <NotifSettingsContent userId={state.userId} />;
};

const NotifSettingsContent = ({ userId }: { userId: string }) => {
  const navigation = useNavigation();
  const { state: prefsState, setMaster, setLogEnabled } = useNotifPrefs({ userId });
  const { state: myLogsState } = useMyLogsContext();
  // #2: 공유 프로필 context(ProfileScreen 변경 즉시 전파).
  const { state: profileState } = useProfileContext();

  // 영속 read 전이거나 토글 직전이면 DEFAULT로 해석(master on, perLog 빈 = 전부 기본 on).
  const prefs = prefsState.status === 'ready' ? prefsState.prefs : DEFAULT_NOTIF_PREFS;
  // #3: 닉네임 미설정 시 결정적 기본 닉네임(동물명+숫자)으로 폴백 → displayLogName "{닉}의 기록"이 일관 표기.
  const readyNickname = profileState.status === 'ready' ? profileState.profile.nickname : null;
  const selfNickname =
    readyNickname && readyNickname.length > 0 ? readyNickname : defaultNickname({ userId });
  const selfAvatarUrl = profileState.status === 'ready' ? profileState.profile.avatarUrl : null;

  // error는 빈 목록으로 흡수(plan T8): ready만 실제 목록, 그 외(loading/error)는 [].
  const myLogs = myLogsState.status === 'ready' ? myLogsState.logs : [];
  const isLogsLoading = myLogsState.status === 'loading';

  // MyLog → NotifLogItem 매핑. name=표시명(이미 계산), enabled=resolve 완료값(View는 logName/resolve 로직 모름).
  const logs: NotifLogItem[] = myLogs.map((log) => ({
    roomId: log.roomId,
    name: displayLogName({ name: log.name, memberCount: log.memberCount, selfNickname }),
    memberCount: log.memberCount,
    enabled: resolveLogEnabled({ prefs, roomId: log.roomId }),
    meUserId: userId,
    meAvatarUrl: selfAvatarUrl,
    // 파트너 신원 미상(RLS self-only) → 생략 → Avatar 익명 폴백.
  }));

  return (
    <NotifSettingsView
      master={prefs.master}
      onToggleMaster={setMaster}
      logs={logs}
      onToggleLog={setLogEnabled}
      isLogsLoading={isLogsLoading}
      onBack={() => navigation.goBack()}
    />
  );
};
