// src/features/appVersion/resolveVersionGate/resolveVersionGate.spec.ts
// 게이트 판정 단위 테스트 (app-version-gate plan §5 T3·§5-1).
//   force/suggest/ok/unknown 4분기 + 결측 3종(current·min·latest null) 각 fail-open/적정 + 경계(==min·==latest).
import { resolveVersionGate, VersionGateDecision } from './resolveVersionGate';

describe('resolveVersionGate (T3)', () => {
  it('current < minSupported → force(차단)', () => {
    expect(
      resolveVersionGate({ current: '1.0.0', minSupported: '2.0.0', latest: '3.0.0' }),
    ).toBe(VersionGateDecision.Force);
  });

  it('minSupported <= current < latest → suggest(권유)', () => {
    expect(
      resolveVersionGate({ current: '1.5.0', minSupported: '1.0.0', latest: '2.0.0' }),
    ).toBe(VersionGateDecision.Suggest);
  });

  it('current >= latest → ok', () => {
    expect(
      resolveVersionGate({ current: '2.0.0', minSupported: '1.0.0', latest: '2.0.0' }),
    ).toBe(VersionGateDecision.Ok);
    expect(
      resolveVersionGate({ current: '3.0.0', minSupported: '1.0.0', latest: '2.0.0' }),
    ).toBe(VersionGateDecision.Ok);
  });

  it('경계: current == minSupported이고 < latest면 suggest', () => {
    expect(
      resolveVersionGate({ current: '1.0.0', minSupported: '1.0.0', latest: '2.0.0' }),
    ).toBe(VersionGateDecision.Suggest);
  });

  it('current 결측(null) → unknown(fail-open)', () => {
    expect(
      resolveVersionGate({ current: null, minSupported: '1.0.0', latest: '2.0.0' }),
    ).toBe(VersionGateDecision.Unknown);
  });

  it('minSupported 결측(null) → unknown(fail-open)', () => {
    expect(
      resolveVersionGate({ current: '1.0.0', minSupported: null, latest: '2.0.0' }),
    ).toBe(VersionGateDecision.Unknown);
  });

  it('latest 결측(null) → unknown(suggest 미발화, fail-open)', () => {
    expect(
      resolveVersionGate({ current: '1.5.0', minSupported: '1.0.0', latest: null }),
    ).toBe(VersionGateDecision.Unknown);
  });

  it('형불량 버전(비 semver)은 unknown(fail-open) — 강제 게이트 오설정 안전판', () => {
    expect(
      resolveVersionGate({ current: '1.0', minSupported: '1.0.0', latest: '2.0.0' }),
    ).toBe(VersionGateDecision.Unknown);
    expect(
      resolveVersionGate({ current: '1.5.0', minSupported: 'bad', latest: '2.0.0' }),
    ).toBe(VersionGateDecision.Unknown);
  });
});
