// src/features/notif — 알림 설정(notif-settings)
export {
  NotifSettingsView,
  type NotifSettingsViewProps,
  type NotifLogItem,
} from './NotifSettingsView';
export { useNotifPrefs, type NotifPrefsState } from './useNotifPrefs';
// ⚠️ useRegisterPushToken/unregisterDeviceToken은 supabase 클라이언트를 끌어오므로 바렐에서 재노출하지 않는다
//    (이 바렐을 쓰는 화면 spec에 불필요한 supabase 의존을 전가하지 않기 위함). 소비처는 직접 경로로 import한다:
//    import { useRegisterPushToken } from '@/features/notif/useRegisterPushToken';
export {
  buildDeviceTokenUpsert,
  isPushCapable,
  resolveDevicePlatform,
  resolvePermissionDecision,
  DeviceTokenPlatform,
  PushPermissionDecision,
  type DeviceTokenUpsert,
} from './pushToken';
export { DEFAULT_NOTIF_PREFS, resolveLogEnabled, type NotifPrefs } from './notifPrefs';
