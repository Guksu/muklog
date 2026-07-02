// src/features/notif/useRegisterPushToken.ts
// 디바이스 토큰 등록 훅 + 로그아웃 폐기 (push-notifications S1 plan §5 T3·T6).
//
// 생산자: 이 훅이 expo-notifications 권한+Expo push token을 취득해 device_tokens에 upsert(onConflict:expo_push_token).
// 소비자: AuthProvider — authenticated(userId) 시 1회 구동(T4). 로그아웃 시 unregisterDeviceToken로 현재 기기 토큰 폐기.
//
// 정책(비용 가드레일):
//   · 폴링/상시연결 0. authenticated 진입(userId 변경) 시에만 effect 1회 실행 → 토큰 취득은 앱당 변경 시에만.
//   · best-effort: 비실기기·권한 거부·토큰 취득/네트워크 실패는 조용히 종료(throw 금지, 앱 흐름 차단 0).
//   · 멱등 가드(processedUserIdRef): 동일 userId 재실행 차단(중복 upsert 방지). userId 비면 가드 리셋(재로그인 재등록).
//
// ⚠️ 경계면: upsert 페이로드는 pushToken.buildDeviceTokenUpsert(§3.3) 단일 출처. onConflict 키='expo_push_token'.
// ⚠️ 권한 요청(requestPermissionsAsync)은 등록 경로에서만. 로그아웃 폐기는 다이얼로그를 띄우지 않는다(allowRequest=false).
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
// requireOptionalNativeModule: 네이티브 모듈이 없으면 null 반환(로그·throw 없음) — 조용한 가용성 probe용.
import { requireOptionalNativeModule } from 'expo-modules-core';

import { supabase } from '@/lib/supabase';

import {
  buildDeviceTokenUpsert,
  isPushCapable,
  PushPermissionDecision,
  resolveDevicePlatform,
  resolvePermissionDecision,
  type DeviceTokenPlatform,
} from '../pushToken';

const DEVICE_TOKENS_TABLE = 'device_tokens';

type AcquiredToken = {
  token: string;
  platform: DeviceTokenPlatform;
  deviceName: string | null;
};

/** app.json extra.eas.projectId(공개 값) — getExpoPushTokenAsync에 명시 전달(plan §3.4·§7-5). */
const resolveProjectId = (): string | undefined => {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId;
};

/**
 * 푸시 네이티브 모듈(ExpoDevice/ExpoPushTokenManager)이 현재 빌드에 탑재됐는지 조용히 확인한다.
 *   requireOptionalNativeModule은 미탑재 시 throw/로그 없이 null을 반환 → Dev Client 재빌드 전엔
 *   여기서 false가 되어 expo-device의 throw하는 require를 아예 호출하지 않는다(콘솔 에러 스팸 방지).
 */
const arePushNativeModulesAvailable = (): boolean => {
  try {
    return (
      requireOptionalNativeModule('ExpoDevice') != null &&
      requireOptionalNativeModule('ExpoPushTokenManager') != null
    );
  } catch {
    return false;
  }
};

/**
 * 실기기·지원 플랫폼·권한 granted를 모두 만족할 때만 Expo push token을 취득한다(SDK 접촉부, 단위 대상 아님).
 *   allowRequest=true(등록): 미결정이면 OS 권한 요청. allowRequest=false(로그아웃 폐기): 요청 없이 기존 granted만.
 * @param allowRequest 미결정 권한에 대해 OS 요청 다이얼로그를 띄울지
 * @returns 취득한 토큰·플랫폼·기기명 또는 조건 미충족 시 null(skip)
 */
const acquireExpoPushToken = async ({
  allowRequest,
}: {
  allowRequest: boolean;
}): Promise<AcquiredToken | null> => {
  // ⚠️ 네이티브 모듈 미탑재(Dev Client 재빌드 전)면 여기서 조용히 skip한다.
  //   top-level static import는 모듈 로드 시 네이티브 접근→throw로 앱 크래시, 무방비 require는 콘솔 에러 스팸.
  //   → requireOptionalNativeModule로 먼저 가용성만 확인(에러 없음), 탑재됐을 때만 require(throw 안 함).
  if (!arePushNativeModulesAvailable()) return null;

  let Device: typeof import('expo-device');
  let Notifications: typeof import('expo-notifications');
  try {
    // 가용성 확인 후 require — 동기 require로 jest 모킹/spy 참조가 그대로 적용된다.
    Device = require('expo-device') as typeof import('expo-device');
    Notifications = require('expo-notifications') as typeof import('expo-notifications');
  } catch (error) {
    // 가용성 확인을 통과했는데도 실패하면 예외적 — 조용히 skip(앱 흐름 차단 0).
    console.warn('[useRegisterPushToken] 푸시 SDK 로드 예외(무해 흡수):', error);
    return null;
  }

  if (!isPushCapable({ isDevice: Device.isDevice })) return null;

  const platform = resolveDevicePlatform({ os: Platform.OS });
  if (platform === null) return null;

  const current = await Notifications.getPermissionsAsync();
  let decision = resolvePermissionDecision({
    existingStatus: current.status,
    canAskAgain: current.canAskAgain,
  });

  if (decision === PushPermissionDecision.Ask) {
    if (!allowRequest) return null;
    const requested = await Notifications.requestPermissionsAsync();
    decision =
      requested.status === PushPermissionDecision.Granted
        ? PushPermissionDecision.Granted
        : PushPermissionDecision.Denied;
  }

  if (decision !== PushPermissionDecision.Granted) return null;

  const projectId = resolveProjectId();
  const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : {});
  return { token, platform, deviceName: Device.deviceName ?? null };
};

/**
 * 로그아웃 시 현재 기기의 push token 행을 폐기한다(T6, 오배달 방지). best-effort.
 *   권한 다이얼로그를 띄우지 않고(allowRequest=false), 기존 granted+실기기일 때만 토큰을 재취득해 delete.
 *   토큰 미보유·실패는 무해 흡수(로그아웃 차단 0). RLS가 본인 토큰만 노출하므로 expo_push_token eq로 충분.
 *   ⚠️ supabase.auth.signOut() 이전에 호출해야 한다(auth.uid() 유효 구간에서 delete).
 * @param userId 로그아웃하는 사용자 id(현재 auth.uid())
 */
export const unregisterDeviceToken = async ({ userId }: { userId: string }): Promise<void> => {
  if (!userId) return;
  try {
    const acquired = await acquireExpoPushToken({ allowRequest: false });
    if (acquired === null) return;
    const { error } = await supabase
      .from(DEVICE_TOKENS_TABLE)
      .delete()
      .eq('expo_push_token', acquired.token);
    if (error) {
      console.warn('[useRegisterPushToken] 토큰 폐기 실패(무해 흡수):', error.message);
    }
  } catch (error) {
    console.warn('[useRegisterPushToken] 토큰 폐기 중 예외(무해 흡수):', error);
  }
};

/**
 * authenticated 사용자의 실기기에서 푸시 권한·토큰을 취득해 device_tokens에 등록(upsert)하는 훅.
 *   userId 변경(authenticated 진입) 시 1회 실행. 빈 userId면 no-op(가드 리셋 → 재로그인 시 재등록).
 *   거부·시뮬레이터·실패는 조용히 종료(best-effort, 앱 흐름 차단 0). 폴링 없음.
 * @param userId 인증된 사용자 id(=auth.uid()). 빈 문자열이면 미인증으로 보고 동작 안 함.
 */
export const useRegisterPushToken = ({ userId }: { userId: string }): void => {
  // 동일 userId 중복 등록을 막는 멱등 가드(완료/진행 모두 포함). 리렌더로 중복 upsert되지 않음.
  const processedUserIdRef = useRef<string | null>(null);

  useEffect(
    function registerPushTokenOnAuth() {
      if (!userId) {
        // 로그아웃 등으로 미인증 → 가드 리셋(다음 로그인 시 재등록 허용).
        processedUserIdRef.current = null;
        return;
      }
      if (processedUserIdRef.current === userId) return;
      processedUserIdRef.current = userId;

      const registerToken = async () => {
        try {
          const acquired = await acquireExpoPushToken({ allowRequest: true });
          if (acquired === null) return;
          const payload = buildDeviceTokenUpsert({
            userId,
            token: acquired.token,
            platform: acquired.platform,
            deviceName: acquired.deviceName,
            nowIso: new Date().toISOString(),
          });
          const { error } = await supabase
            .from(DEVICE_TOKENS_TABLE)
            .upsert(payload, { onConflict: 'expo_push_token' });
          if (error) {
            console.warn('[useRegisterPushToken] 토큰 등록 실패(다음 실행 재시도):', error.message);
          }
        } catch (error) {
          console.warn('[useRegisterPushToken] 토큰 등록 중 예외(무해 흡수):', error);
        }
      };

      void registerToken();
    },
    // userId 변경 시에만 재실행(폴링 방지). 가드는 ref로 동일 userId 중복을 차단한다.
    [userId],
  );
};
