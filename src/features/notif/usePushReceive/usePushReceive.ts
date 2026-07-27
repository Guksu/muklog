// src/features/notif/usePushReceive/usePushReceive.ts
// 푸시 수신 UX 훅 (push-receive-ux plan §5 T4). 앱 트리에 1회 구동(T6).
//   (a) setNotificationHandler로 포그라운드 배너 표시, (b) 탭 응답 리스너(백그라운드), (c) 콜드스타트 응답 1회 조회.
//   각 응답 → resolveNotificationTarget → navigateToTarget(nav 준비 전이면 대기 큐).
//
// 생산자: send-muklog-push 발송 payload data:{roomId, muklogId}. 소비자: 이 훅 → deepLinkRouter → navigationRef.
// 정책(비용 가드레일 §8): 폴링/Realtime/상시연결 0. 리스너·콜드스타트는 이벤트 기반. getLastNotificationResponseAsync는 1회.
// 네이티브 안전(S1 준용): requireOptionalNativeModule probe → 미탑재(Dev Client 재빌드 전)면 SDK 미접촉·no-op·throw 0.
import { useEffect, useRef } from 'react';
// requireOptionalNativeModule: 네이티브 모듈이 없으면 null 반환(로그·throw 없음) — 조용한 가용성 probe용.
import { requireOptionalNativeModule } from 'expo-modules-core';

import { resolveNotificationTarget } from '../notificationTarget';
import { navigateToTarget } from '../deepLinkRouter';

// 포그라운드 수신 시 OS 배너 표시(뱃지 OUT §3.5). 설치된 expo-notifications(0.29.x) NotificationBehavior 실키에 정합:
//   shouldShowAlert(배너 노출) / shouldPlaySound / shouldSetBadge=false. (SDK가 shouldShowBanner로 분리되면 그때 갱신.)
const FOREGROUND_BEHAVIOR = {
  shouldShowAlert: true,
  shouldPlaySound: true,
  shouldSetBadge: false,
} as const;

/**
 * 수신 알림 응답에서 딥링크 목적지를 뽑아 라우팅한다(판정 불가·null 응답은 안전 흡수 no-op).
 *   data 경로: response.notification.request.content.data(Record<string, unknown>).
 * @param response NotificationResponse 또는 null(콜드스타트 미탑승)
 */
const routeFromResponse = ({ response }: { response: unknown }): void => {
  const data =
    (response as { notification?: { request?: { content?: { data?: unknown } } } } | null)
      ?.notification?.request?.content?.data ?? null;
  const target = resolveNotificationTarget({ data });
  if (target !== null) navigateToTarget({ target });
};

/**
 * 알림 수신 네이티브 모듈(핸들러·이미터)이 현재 빌드에 탑재됐는지 조용히 확인한다.
 *   미탑재면 requireOptionalNativeModule이 throw/로그 없이 null → 여기서 false(SDK require 자체를 안 함).
 */
const areNotificationsNativeModulesAvailable = (): boolean => {
  try {
    return (
      requireOptionalNativeModule('ExpoNotificationsHandlerModule') != null &&
      requireOptionalNativeModule('ExpoNotificationsEmitter') != null
    );
  } catch {
    return false;
  }
};

/**
 * 마운트 1회 포그라운드 핸들러·탭 리스너·콜드스타트 응답을 설정하는 훅(전역 수신 UX).
 *   네이티브 미탑재 시 no-op(throw 0). 언마운트 시 리스너 해제. 재마운트 시 재등록(멱등 가드로 단일 마운트 중복 방지).
 */
export const usePushReceive = (): void => {
  // 단일 마운트 내 중복 등록 방지(S1 ref 가드 준용). 언마운트 cleanup에서 리셋 → 재마운트 시 재등록 허용.
  const initializedRef = useRef(false);

  useEffect(function initPushReceiveOnMount() {
    if (initializedRef.current) return;
    // 네이티브 미탑재(Dev Client 재빌드 전) → SDK 접촉 0, 조용히 no-op.
    if (!areNotificationsNativeModulesAvailable()) return;

    let Notifications: typeof import('expo-notifications');
    try {
      // 가용성 확인 후 동기 require — jest 모킹/spy 참조가 그대로 적용된다(S1 패턴).
      Notifications = require('expo-notifications') as typeof import('expo-notifications');
    } catch (error) {
      console.warn('[usePushReceive] 알림 SDK 로드 예외(무해 흡수):', error);
      return;
    }
    initializedRef.current = true;

    // (a) 포그라운드 배너 — 기본은 OS가 포그라운드 알림을 억제하므로 명시 설정 필요.
    Notifications.setNotificationHandler({
      handleNotification: async function handleForegroundNotification() {
        return FOREGROUND_BEHAVIOR;
      },
    });

    // (b) 백그라운드 탭 응답 리스너.
    const onNotificationResponse = (response: unknown) => routeFromResponse({ response });
    const subscription = Notifications.addNotificationResponseReceivedListener(
      onNotificationResponse as Parameters<
        typeof Notifications.addNotificationResponseReceivedListener
      >[0],
    );

    // (c) 콜드스타트(종료 상태에서 탭으로 실행) 응답 1회 확인 → 동일 라우팅. null이면 no-op.
    void Notifications.getLastNotificationResponseAsync()
      .then(function routeColdStart(response) {
        routeFromResponse({ response });
      })
      .catch(() => {
        /* 콜드스타트 조회 실패는 무해 흡수(라우팅만 스킵) */
      });

    return function cleanupPushReceive() {
      subscription.remove();
      initializedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 앱 트리 1회 등록(폴링 방지, 마운트당 1회).
  }, []);
};
