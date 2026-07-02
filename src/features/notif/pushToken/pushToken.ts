// src/features/notif/pushToken.ts
// 푸시 토큰 순수 유틸 (push-notifications S1 plan §3.3·§5 T2). 단위 테스트 대상(외부 SDK 미접촉).
//   권한 결정·upsert 페이로드 구성·실기기 판정·플랫폼 매핑을 SDK 호출과 분리해 테스트 가능하게 한다.
//   SDK 접촉(권한 요청·토큰 취득·upsert)은 useRegisterPushToken이 담당.

/** 권한 결정 결과 — 한정 집합이라 enum-style 상수로(리터럴 직접 비교 금지). */
export const PushPermissionDecision = {
  /** 이미 허용됨 → 토큰 취득 진행. */
  Granted: 'granted',
  /** 미결정 + 재요청 가능 → OS 권한 요청. */
  Ask: 'ask',
  /** 거부(재요청 불가 포함) → 토큰 취득 진입 금지. */
  Denied: 'denied',
} as const;
export type PushPermissionDecision =
  (typeof PushPermissionDecision)[keyof typeof PushPermissionDecision];

/** device_tokens.platform CHECK 집합과 일치(ios/android 외 미지원). */
export const DeviceTokenPlatform = {
  Ios: 'ios',
  Android: 'android',
} as const;
export type DeviceTokenPlatform = (typeof DeviceTokenPlatform)[keyof typeof DeviceTokenPlatform];

/** device_tokens upsert 페이로드(경계면 단일 출처, plan §3.3). 컬럼명/타입을 SQL과 정확히 일치시킨다. */
export type DeviceTokenUpsert = {
  user_id: string;
  expo_push_token: string;
  platform: DeviceTokenPlatform;
  device_name: string | null;
  updated_at: string;
};

/**
 * 권한 상태로부터 다음 행동(granted/ask/denied)을 결정한다.
 *   이미 granted면 재요청 불필요. undetermined+재요청가능이면 ask. 그 외(거부·재요청불가)는 denied.
 * @param existingStatus expo-notifications getPermissionsAsync의 status('granted'|'denied'|'undetermined' 등)
 * @param canAskAgain OS가 추가 요청을 허용하는지
 * @returns 'granted' | 'ask' | 'denied'
 */
export const resolvePermissionDecision = ({
  existingStatus,
  canAskAgain,
}: {
  existingStatus: string;
  canAskAgain: boolean;
}): PushPermissionDecision => {
  if (existingStatus === PushPermissionDecision.Granted) return PushPermissionDecision.Granted;
  if (existingStatus === 'undetermined' && canAskAgain) return PushPermissionDecision.Ask;
  return PushPermissionDecision.Denied;
};

/**
 * device_tokens upsert 페이로드를 구성한다(plan §3.3). platform은 호출부에서 이미 좁혀 전달.
 * @param userId auth.uid()(RLS with check 일치 필수)
 * @param token getExpoPushTokenAsync().data
 * @param platform 'ios' | 'android'
 * @param deviceName 표시용 기기명(없으면 null)
 * @param nowIso 갱신 시각 ISO 문자열(new Date().toISOString())
 * @returns SQL 컬럼과 1:1 매핑된 upsert payload
 */
export const buildDeviceTokenUpsert = ({
  userId,
  token,
  platform,
  deviceName,
  nowIso,
}: {
  userId: string;
  token: string;
  platform: DeviceTokenPlatform;
  deviceName: string | null;
  nowIso: string;
}): DeviceTokenUpsert => ({
  user_id: userId,
  expo_push_token: token,
  platform,
  device_name: deviceName,
  updated_at: nowIso,
});

/**
 * 실기기에서만 푸시 토큰을 취득할 수 있다(시뮬레이터/에뮬레이터는 실 토큰 불가).
 * @param isDevice expo-device Device.isDevice
 * @returns 토큰 취득 단계 진입 가능 여부
 */
export const isPushCapable = ({ isDevice }: { isDevice: boolean }): boolean => isDevice;

/**
 * react-native Platform.OS를 device_tokens.platform 집합으로 매핑한다. 미지원 OS는 null(skip).
 * @param os Platform.OS('ios'|'android'|'web'|'windows'|'macos')
 * @returns 'ios' | 'android' | null
 */
export const resolveDevicePlatform = ({ os }: { os: string }): DeviceTokenPlatform | null => {
  if (os === DeviceTokenPlatform.Ios) return DeviceTokenPlatform.Ios;
  if (os === DeviceTokenPlatform.Android) return DeviceTokenPlatform.Android;
  return null;
};
