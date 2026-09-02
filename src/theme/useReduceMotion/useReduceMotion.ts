// src/theme/useReduceMotion/useReduceMotion.ts
// 기기의 "동작 줄이기"(reduce motion) 설정을 구독하는 훅 — plan §3.2 (motion-pass-1) + qa-logic S1.
//   fe-craft #8: 감소 모션은 "모든 전이 제거"가 아니라 "이동을 크로스페이드로 완화"다.
//   실제 완화 규칙은 @/theme의 resolveMotion* 리졸버가 단일 출처로 갖고, 이 훅은 설정값만 알려준다.
//
//   ⚠️ 값은 기기 설정 하나인데 소비처는 화면당 수십 개다(리스트의 카드·칩이 전부 MotionPressable·FadeInImage).
//      그래서 구독은 **모듈 스코프 스토어 1개**만 두고, 훅은 useSyncExternalStore로 그 캐시를 읽는다:
//      네이티브 구독 1개 · 브리지 조회 1회 · 두 번째 소비자부터는 마운트 시 상태 갱신이 아예 없다.
//      마지막 소비자가 떠나면 구독을 해제하고 캐시를 비운다(다음 구독에서 다시 조회한다).
import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, type EmitterSubscription } from 'react-native';

/** RN AccessibilityInfo의 감소 모션 변경 이벤트 이름(라이브러리 계약). */
const REDUCE_MOTION_EVENT = 'reduceMotionChanged';

/** 앱 전역에서 공유하는 현재 값. 조회 전 기본은 false(모션 정상 재생 — plan E2). */
let cachedReduceMotion = false;
/** 살아 있는 네이티브 구독(없으면 null). */
let nativeSubscription: EmitterSubscription | null = null;
/** 이 스토어를 읽고 있는 소비자들의 재렌더 트리거. */
const storeListeners = new Set<() => void>();
/**
 * 조회 세대 — 구독이 끝난 뒤 뒤늦게 도착한 비동기 응답을 무시하기 위한 언마운트 가드(plan E7).
 *   구독이 해제될 때마다 세대가 올라가, 이전 세대의 응답은 캐시를 오염시키지 못한다.
 */
let queryGeneration = 0;

const notifyStoreListeners = () => {
  storeListeners.forEach((listener) => listener());
};

const setCachedReduceMotion = (next: boolean) => {
  if (cachedReduceMotion === next) return;
  cachedReduceMotion = next;
  notifyStoreListeners();
};

const startReduceMotionSubscription = () => {
  const generation = queryGeneration;
  const applyQueryResult = (enabled: boolean) => {
    // 이미 구독이 끝났다면(화면이 떠났다면) 늦게 온 응답은 버린다.
    if (generation !== queryGeneration) return;
    setCachedReduceMotion(enabled);
  };
  const ignoreQueryFailure = () => {
    // 조회 실패/미지원 — 모션을 정상 재생(false 유지)한다. 앱은 절대 죽지 않는다(plan E4).
  };
  AccessibilityInfo.isReduceMotionEnabled().then(applyQueryResult).catch(ignoreQueryFailure);
  nativeSubscription = AccessibilityInfo.addEventListener(
    REDUCE_MOTION_EVENT,
    setCachedReduceMotion,
  );
};

const stopReduceMotionSubscription = () => {
  queryGeneration += 1; // 진행 중인 조회의 응답을 무효화한다.
  nativeSubscription?.remove();
  nativeSubscription = null;
  cachedReduceMotion = false; // 구독이 없는 동안의 값은 신뢰하지 않는다 — 다음 구독에서 다시 조회한다.
};

/**
 * 스토어 구독 — 첫 소비자에서 네이티브 구독을 열고, 마지막 소비자가 떠날 때 닫는다.
 * @param onStoreChange React가 준 재렌더 트리거
 * @returns 구독 해제 함수
 */
const subscribeReduceMotionStore = (onStoreChange: () => void) => {
  storeListeners.add(onStoreChange);
  if (storeListeners.size === 1) startReduceMotionSubscription();
  return function unsubscribeReduceMotionStore() {
    storeListeners.delete(onStoreChange);
    if (storeListeners.size === 0) stopReduceMotionSubscription();
  };
};

const getReduceMotionSnapshot = (): boolean => cachedReduceMotion;

/**
 * 기기의 "동작 줄이기" 설정을 구독한다.
 *   앱 전역에서 네이티브 구독 1개·조회 1회를 공유하며, 값이 바뀌면 모든 소비처가 함께 갱신된다.
 *   초기값은 false다 — 조회가 비동기라 앱 첫 프레임 직후 한 번은 모션이 보일 수 있다(plan E2, 허용).
 * @returns 감소 모션이 켜져 있으면 true
 */
export const useReduceMotion = (): boolean =>
  useSyncExternalStore(subscribeReduceMotionStore, getReduceMotionSnapshot);
