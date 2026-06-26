// plugins/withAndroidLaunchMode.js
// MainActivity 의 launchMode 를 Expo 기본 singleTask → singleTop 으로 변경.
//
// 왜:
//   Android 에서 expo-image-picker 의 launchImageLibraryAsync 가 사진 선택 후
//   onActivityResult 콜백을 못 받아 promise 가 영영 resolve 안 됨(hang). iOS 는 정상,
//   Android 만 발생(아바타·먹로그 사진 둘 다). 원인은 singleTask launchMode 가
//   startActivityForResult/onActivityResult 결과 라우팅을 막는 Android 동작.
//   getPendingResultAsync(MainActivity 파괴 복구)로도 안 잡힘 = 파괴가 아니라 콜백 유실.
//
// 해결:
//   singleTop 은 picker 의 startActivityForResult 결과를 정상 수신하면서,
//   딥링크/OAuth(muklog:// 리다이렉트)도 onNewIntent 로 동일하게 처리 → 호환.
//   ⚠️ Google/Apple 로그인(OAuth 딥링크) 회귀 여부는 빌드 후 디바이스에서 확인 필요.
//
// Expo 는 android/ 를 prebuild 로 재생성(.gitignore)하므로 plugin 으로 박아야 매번 적용된다.
// 제거 시점: expo-image-picker 가 singleTask 에서도 동작하도록 수정되면 삭제.
const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withAndroidLaunchMode(config) {
  return withAndroidManifest(config, (cfg) => {
    const application = cfg.modResults.manifest.application?.[0];
    const mainActivity = application?.activity?.find(
      (activity) => activity.$['android:name'] === '.MainActivity',
    );
    if (mainActivity) {
      mainActivity.$['android:launchMode'] = 'singleTop';
    }
    return cfg;
  });
};
