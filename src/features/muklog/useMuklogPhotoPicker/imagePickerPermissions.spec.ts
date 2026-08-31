// src/features/muklog/useMuklogPhotoPicker/imagePickerPermissions.spec.ts
// expo-image-picker 권한 문구 계약 스모크 (otaConfig.spec의 "설정 계약" 가드 패턴).
//   app.json plugins는 EAS/prebuild가 해석하는 원격 계약이라 단위로 동작 검증이 불가 →
//   파일을 읽어 필드 값을 단언한다.
//
// 배경(2026-08-31 App Store 심사 리젝): expo-image-picker의 config plugin은 옵션을 주지 않으면
//   NSMicrophoneUsageDescription·NSCameraUsageDescription에 영문 기본 문구
//   ("Allow $(PRODUCT_NAME) to access your microphone")를 **자동 주입**한다
//   (plugin/build/withImagePicker.js의 MICROPHONE_USAGE·CAMERA_USAGE).
//   Apple 자동 분석이 이를 placeholder로 판정해 심사가 중단됐다.
//   앱은 launchImageLibraryAsync(mediaTypes: ['images'])만 쓰므로 마이크·카메라를 아예 쓰지 않는다
//   → 문구를 다듬는 게 아니라 **권한 자체를 제거**하는 것이 Apple 안내의 정답이다.
//   @expo/config-plugins의 applyPermissions는 값이 false면 `delete infoPlist[permission]` 한다.
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '../../../..');

const readAppJson = (): Record<string, any> =>
  JSON.parse(readFileSync(join(ROOT, 'app.json'), 'utf8'));

const findImagePickerPlugin = ({ plugins }: { plugins: any[] }): any[] | undefined =>
  plugins.find((entry) => Array.isArray(entry) && entry[0] === 'expo-image-picker');

describe('expo-image-picker 권한 문구 계약', () => {
  const plugins = readAppJson().expo.plugins as any[];
  const picker = findImagePickerPlugin({ plugins });

  it('expo-image-picker 플러그인이 옵션 객체와 함께 등록된다', () => {
    expect(picker).toBeDefined();
    expect(typeof picker?.[1]).toBe('object');
  });

  it('사진 권한 문구는 한국어 실문구다(용도를 구체적으로 설명)', () => {
    expect(picker?.[1].photosPermission).toBe(
      '사진을 첨부하려면 사진 보관함 접근 권한이 필요해요.',
    );
  });

  // ⚠️ false를 지우면 영문 placeholder가 자동으로 되살아나 심사에서 다시 막힌다.
  //    영상 기록(muklog-video, 설계 §4 예정)을 붙일 때 cameraPermission을 한국어 실문구로 되살린다.
  it('쓰지 않는 마이크 권한을 Info.plist에서 제거한다(false)', () => {
    expect(picker?.[1].microphonePermission).toBe(false);
  });

  it('쓰지 않는 카메라 권한을 Info.plist에서 제거한다(false)', () => {
    expect(picker?.[1].cameraPermission).toBe(false);
  });
});
