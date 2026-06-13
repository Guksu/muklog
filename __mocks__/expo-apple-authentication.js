// __mocks__/expo-apple-authentication.js
// expo-apple-authentication 글로벌 모킹(testing-strategy: 외부 SDK = 모킹·스모크).
//   배럴 경유 import로 테스트가 깨지지 않게 한다. 기본은 취소(개별 동작은 spec에서 세밀 제어).
//   실제 Apple 로그인은 디바이스 스모크(키 발급 후)에서 검증.
const AppleAuthenticationScope = { FULL_NAME: 0, EMAIL: 1 };

module.exports = {
  __esModule: true,
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  signInAsync: jest.fn(() => Promise.reject({ code: 'ERR_REQUEST_CANCELED' })),
  AppleAuthenticationScope,
};
