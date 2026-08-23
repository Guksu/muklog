// src/features/map/nearbyTrace/nearbyTrace.ts
// nearby 로딩 계측 — 선로딩·캐시·invoke·첫 렌더 갭을 개발 번들에서만 관측한다 (map-pin-loading plan §4.6).
//
// 생산자: useNearbyPlaces(preload/cache/invoke) + MapTabScreen(map:ready·render:first).
// 소비자: 개발자(Metro 콘솔)뿐 — 앱 로직은 이 모듈의 반환값에 의존하지 않는다(부수효과 전용).
// 프로덕션 오버헤드 0(§10·B8): `__DEV__`가 아니면 첫 줄에서 return하고, 모듈 전역에 타이머·리스너·상태가 0이다.
//   (계측이 자기 무게를 갖는 순간 "측정하려던 성능"을 측정이 바꾼다 — 그래서 폴링·버퍼링을 두지 않는다.)

/** 계측 이벤트 토큰(enum-style 단일 출처) — 로그 grep 키이자 계약. */
export const NearbyTraceEvent = {
  PreloadStart: 'preload:start', // { source: 'coords' | 'pins' }
  PreloadSkip: 'preload:skip', // { reason: 'no-signal' }
  CacheHydrate: 'cache:hydrate', // { areas, items, ageMs }
  CacheHit: 'cache:hit', // { key }
  InvokeStart: 'invoke:start', // { key, trigger }
  InvokeEnd: 'invoke:end', // { key, ms, count, ok }
  MapReady: 'map:ready', // {} — READY 수신(gapMs의 t0)
  FirstRender: 'render:first', // { kind, gapMs }
} as const;
export type NearbyTraceEvent = (typeof NearbyTraceEvent)[keyof typeof NearbyTraceEvent];

/** invoke 트리거 출처(enum-style) — 첫 진입 invoke가 어느 경로로 샜는지 로그만 보고 판별하기 위함. */
export const NearbyInvokeTrigger = {
  Preload: 'preload',
  FirstBounds: 'first-bounds',
  Correction: 'correction',
  Research: 'research',
} as const;
export type NearbyInvokeTrigger =
  (typeof NearbyInvokeTrigger)[keyof typeof NearbyInvokeTrigger];

/**
 * nearby 로딩 계측 1건을 기록한다 — 개발 번들에서만 콘솔로 나가고, 그 외에는 완전한 no-op이다.
 * @param event 계측 이벤트 토큰
 * @param detail 이벤트별 페이로드(없으면 빈 객체로 기록)
 */
export const traceNearby = ({
  event,
  detail,
}: {
  event: NearbyTraceEvent;
  detail?: Record<string, unknown>;
}): void => {
  if (!__DEV__) return;
  console.log(`[nearby] ${event}`, detail ?? {});
};

/**
 * READY(t0) 대비 첫 렌더 갭(ms)을 낸다 — INIT에 함께 실렸으면 0(=목표 상태)이다.
 * 음수(READY보다 먼저 실린 경우)는 0으로 클램프하고, READY 미수신(t0 없음)이면 null로 "측정 없음"을 구분한다.
 * @param readyAt READY 수신 시각(ms epoch). 미수신이면 null
 * @param at 해당 kind가 지도에 처음 실린 시각(ms epoch)
 * @returns 갭(ms, 0 이상) 또는 null(측정 불가)
 */
export const nearbyRenderGapMs = ({
  readyAt,
  at,
}: {
  readyAt: number | null;
  at: number;
}): number | null => {
  if (readyAt === null) return null;
  return Math.max(0, at - readyAt);
};
