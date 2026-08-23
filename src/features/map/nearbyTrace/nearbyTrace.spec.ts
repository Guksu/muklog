// src/features/map/nearbyTrace/nearbyTrace.spec.ts
// nearby 로딩 계측 — __DEV__ 가드·페이로드 계약·프로덕션 오버헤드 0 (map-pin-loading plan §4.6·W0 A0-1~A0-3).
//   프로덕션 번들에서 단 한 줄도 로그하지 않는 것이 이 모듈의 유일한 안전 요구다(B8) → 가드를 최우선으로 잠근다.
import { readFileSync } from 'fs';
import { join } from 'path';

import { setDevMode } from '@/test/setDevMode';

import { NearbyTraceEvent, nearbyRenderGapMs, traceNearby } from './nearbyTrace';

// console 전 채널을 감시한다 — 가드가 빠지면 어느 채널로든 새어나가므로 log만 보면 놓친다.
const consoleSpies = () => ({
  log: jest.spyOn(console, 'log').mockImplementation(() => {}),
  info: jest.spyOn(console, 'info').mockImplementation(() => {}),
  warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
  error: jest.spyOn(console, 'error').mockImplementation(() => {}),
  debug: jest.spyOn(console, 'debug').mockImplementation(() => {}),
});

afterEach(() => {
  jest.restoreAllMocks();
  setDevMode({ isDev: true }); // jest-expo 기본값 복원.
});

describe('traceNearby (A0-1·A0-2)', () => {
  it('A0-1 __DEV__=false면 20회 호출해도 console 채널 전부 0회(프로덕션 오버헤드 0)', () => {
    setDevMode({ isDev: false });
    const spies = consoleSpies();
    for (let i = 0; i < 20; i += 1) {
      traceNearby({ event: NearbyTraceEvent.InvokeStart, detail: { key: `k${i}` } });
    }
    expect(spies.log).not.toHaveBeenCalled();
    expect(spies.info).not.toHaveBeenCalled();
    expect(spies.warn).not.toHaveBeenCalled();
    expect(spies.error).not.toHaveBeenCalled();
    expect(spies.debug).not.toHaveBeenCalled();
  });

  it('A0-2 __DEV__=true면 invoke:end 페이로드({ms,count,ok})를 그대로 싣는다', () => {
    setDevMode({ isDev: true });
    const spies = consoleSpies();
    traceNearby({
      event: NearbyTraceEvent.InvokeEnd,
      detail: { key: 'k1', ms: 412, count: 15, ok: true },
    });
    expect(spies.log).toHaveBeenCalledTimes(1);
    const [label, detail] = spies.log.mock.calls[0];
    expect(String(label)).toContain(NearbyTraceEvent.InvokeEnd);
    expect(detail).toEqual({ key: 'k1', ms: 412, count: 15, ok: true });
  });

  it('detail 없이 호출해도 안전하다(빈 객체)', () => {
    setDevMode({ isDev: true });
    const spies = consoleSpies();
    traceNearby({ event: NearbyTraceEvent.MapReady });
    expect(spies.log).toHaveBeenCalledTimes(1);
    expect(spies.log.mock.calls[0][1]).toEqual({});
  });

  it('이벤트 토큰은 enum-style 상수로 고정된다(계약 오타 방어)', () => {
    expect(NearbyTraceEvent.PreloadStart).toBe('preload:start');
    expect(NearbyTraceEvent.PreloadSkip).toBe('preload:skip');
    expect(NearbyTraceEvent.CacheHydrate).toBe('cache:hydrate');
    expect(NearbyTraceEvent.CacheHit).toBe('cache:hit');
    expect(NearbyTraceEvent.InvokeStart).toBe('invoke:start');
    expect(NearbyTraceEvent.InvokeEnd).toBe('invoke:end');
    expect(NearbyTraceEvent.MapReady).toBe('map:ready');
    expect(NearbyTraceEvent.FirstRender).toBe('render:first');
  });
});

describe('nearbyRenderGapMs (§4.6 gapMs 정의)', () => {
  it('READY 이후 렌더 시각과의 차이를 ms로 낸다', () => {
    expect(nearbyRenderGapMs({ readyAt: 1_000, at: 1_320 })).toBe(320);
  });

  it('INIT 동시 탑재(같은 시각)면 0 — 목표 상태', () => {
    expect(nearbyRenderGapMs({ readyAt: 1_000, at: 1_000 })).toBe(0);
  });

  it('음수는 0으로 클램프한다(READY 이전 렌더도 gap 0으로 취급)', () => {
    expect(nearbyRenderGapMs({ readyAt: 1_000, at: 900 })).toBe(0);
  });

  it('readyAt이 null(READY 미수신)이면 null — 없는 측정을 0으로 위조하지 않는다', () => {
    expect(nearbyRenderGapMs({ readyAt: null, at: 900 })).toBeNull();
  });
});

describe('nearbyTrace 정적 규율 (A0-3)', () => {
  it('모듈 전역에 타이머·리스너·구독이 0개다', () => {
    const source = readFileSync(join(__dirname, 'nearbyTrace.ts'), 'utf8');
    expect(source).not.toContain('setInterval');
    expect(source).not.toContain('setTimeout');
    expect(source).not.toContain('addEventListener');
    expect(source).not.toContain('AppState');
    expect(source).not.toContain('requestAnimationFrame');
  });

  it('__DEV__ 가드를 통과하지 않는 console 호출이 없다(가드 1개 · console 1개)', () => {
    const source = readFileSync(join(__dirname, 'nearbyTrace.ts'), 'utf8');
    const consoleCalls = source.match(/console\./g) ?? [];
    expect(consoleCalls).toHaveLength(1);
    expect(source).toContain('if (!__DEV__) return');
  });
});
