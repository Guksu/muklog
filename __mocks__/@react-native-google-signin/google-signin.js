// __mocks__/@react-native-google-signin/google-signin.js
// google-signin 네이티브 모듈 글로벌 모킹(testing-strategy: 외부 SDK = 모킹·스모크).
//   배럴(@/features/auth)을 통해 socialSignIn이 끌려와도 네이티브 import로 테스트가 깨지지 않게 한다.
//   기본은 안전한 no-op/취소(개별 동작은 socialSignIn.spec/AuthProvider.spec이 jest.mock으로 세밀 제어).
//   실제 로그인 동작은 디바이스 스모크(키 발급 후)에서 검증.
const GoogleSignin = {
  configure: jest.fn(),
  signIn: jest.fn(() => Promise.resolve({ type: 'cancelled', data: null })),
  hasPlayServices: jest.fn(() => Promise.resolve(true)),
  signOut: jest.fn(() => Promise.resolve(null)),
};

const statusCodes = {
  SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
  IN_PROGRESS: 'IN_PROGRESS',
  PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  SIGN_IN_REQUIRED: 'SIGN_IN_REQUIRED',
};

module.exports = { __esModule: true, GoogleSignin, statusCodes };
