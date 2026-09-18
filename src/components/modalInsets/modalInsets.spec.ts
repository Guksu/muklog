// src/components/modalInsets/modalInsets.spec.ts
// 상태바를 덮는 Modal 안에서 콘텐츠가 상태바를 피하는 상단 여백 계산(dim-full-cover T2 / TC-B1~B6).
//   순수 함수라 플랫폼별 실값(insets.top·StatusBar.currentHeight)을 인자로 주입해 세 환경을 모두 재현한다.
import { resolveModalTopInset } from './modalInsets';

describe('resolveModalTopInset', () => {
  // TC-B1
  it('Android 비 edge-to-edge — insets.top이 0이면 상태바 높이를 쓴다', () => {
    expect(resolveModalTopInset({ insetTop: 0, statusBarHeight: 24 })).toBe(24);
  });

  // TC-B2
  it('Android edge-to-edge — 둘 다 상태바 높이면 이중 적용하지 않는다', () => {
    expect(resolveModalTopInset({ insetTop: 24, statusBarHeight: 24 })).toBe(24);
  });

  // TC-B3
  it('iOS 노치 — currentHeight가 undefined면 inset을 그대로 쓴다', () => {
    expect(resolveModalTopInset({ insetTop: 59, statusBarHeight: undefined })).toBe(59);
  });

  // TC-B4
  it('iOS 비노치·테스트 환경 — 둘 다 없으면 0', () => {
    expect(resolveModalTopInset({ insetTop: 0, statusBarHeight: undefined })).toBe(0);
  });

  // TC-B5
  it('노치·펀치홀 — inset이 상태바 높이보다 크면 큰 쪽을 쓴다', () => {
    expect(resolveModalTopInset({ insetTop: 48, statusBarHeight: 24 })).toBe(48);
  });

  // TC-B6
  it('statusBarHeight가 null이어도 throw 없이 0으로 본다', () => {
    expect(resolveModalTopInset({ insetTop: 0, statusBarHeight: null })).toBe(0);
  });
});
