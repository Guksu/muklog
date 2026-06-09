// T0 셋업 스모크 — jest-expo preset·moduleNameMapper·transform이 정상 부팅하는지 확인.
describe('jest 인프라 부팅', () => {
  it('기본 단언이 동작한다', () => {
    expect(1 + 1).toBe(2);
  });

  it('@/ alias(moduleNameMapper)가 해석된다', () => {
    const code = require('@/features/room/code');
    expect(code.INVITE_CODE_LENGTH).toBe(6);
  });
});
