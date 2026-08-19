// src/features/ota/otaConfig/otaConfig.spec.ts
// OTA 빌드 설정 계약 스모크 (expo-updates-ota plan §3.2·§3.8, T1·T2 · §5-1 "설정 계약").
//   app.json·eas.json은 EAS 서버가 해석하는 원격 계약이라 단위로 동작 검증이 불가 →
//   파일을 읽어 필드 값과 "기존 키 불변"을 단언한다(appConfigMigration.spec 계약 동기화 가드 패턴).
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '../../../..');

const readJson = ({ file }: { file: string }): Record<string, any> =>
  JSON.parse(readFileSync(join(ROOT, file), 'utf8'));

describe('app.json OTA 설정 계약 (T1)', () => {
  const expo = readJson({ file: 'app.json' }).expo as Record<string, any>;

  it('updates 블록이 EAS Update 엔드포인트를 가리킨다', () => {
    expect(expo.updates.url).toBe('https://u.expo.dev/ddb39563-4389-4043-9d83-06dd84769191');
    expect(expo.updates.enabled).toBe(true);
  });

  it('updates.url의 project id가 extra.eas.projectId와 일치한다(오배포 방지)', () => {
    expect(expo.updates.url).toBe(`https://u.expo.dev/${expo.extra.eas.projectId}`);
  });

  it('네이티브 자동 체크를 끈다(ON_ERROR_RECOVERY) — 체크 시점은 JS가 소유', () => {
    expect(expo.updates.checkAutomatically).toBe('ON_ERROR_RECOVERY');
  });

  it('콜드스타트가 네트워크를 기다리지 않는다(fallbackToCacheTimeout 0)', () => {
    expect(expo.updates.fallbackToCacheTimeout).toBe(0);
  });

  it('runtimeVersion 정책은 appVersion이다(§3.1 — 스토어 게이트와 같은 version 문자열)', () => {
    expect(expo.runtimeVersion).toEqual({ policy: 'appVersion' });
  });

  it('version은 1.2.0 그대로다(버전 bump는 릴리스 행위 — 이 스프린트 산출물 아님)', () => {
    expect(expo.version).toBe('1.2.0');
  });

  // expo-updates 플러그인은 app.json에 추가하지 않는다 — @expo/prebuild-config의 versionedExpoSDKPackages에
  // 'expo-updates'가 포함되어 설치만으로 자동 적용된다(withDefaultPlugins.js:187).
  // 2026-08-19: withAndroidLaunchMode 제거로 10 → 9. 그 플러그인이 MainActivity를 singleTop으로 바꿔
  //   커스텀탭 OAuth 리다이렉트 인텐트 전달을 깨뜨렸다(Android 구글 로그인 불가). picker hang의 실제
  //   근본 원인은 expo-file-system 누락이었고 그건 별도로 복구됨 — singleTop은 불필요한 부수 변경이었다.
  it('기존 네이티브 설정 키가 불변이다(plugins 구성·번들 식별자)', () => {
    expect(expo.plugins).toHaveLength(9);
    expect(expo.plugins).toContain('expo-dev-client');
    expect(expo.plugins).toContain('./plugins/withFmtConstevalFix');
    // launchMode 플러그인은 다시 들어오면 안 된다(OAuth 회귀 재발 방지).
    expect(expo.plugins).not.toContain('./plugins/withAndroidLaunchMode');
    expect(expo.ios.bundleIdentifier).toBe('com.muklog.app');
    expect(expo.android.package).toBe('com.muklog.app');
  });
});

describe('eas.json 채널 계약 (T2)', () => {
  const easJson = readJson({ file: 'eas.json' });

  it('세 빌드 프로필에 채널이 명시된다(EAS 기본 동작에 의존하지 않음)', () => {
    expect(easJson.build.development.channel).toBe('development');
    expect(easJson.build.preview.channel).toBe('preview');
    expect(easJson.build.production.channel).toBe('production');
  });

  it('기존 프로필 키는 무변경이다(빌드 파이프라인 회귀 0)', () => {
    expect(easJson.cli.appVersionSource).toBe('remote');
    expect(easJson.build.development.developmentClient).toBe(true);
    expect(easJson.build.development.distribution).toBe('internal');
    expect(easJson.build.preview.distribution).toBe('internal');
    expect(easJson.build.preview.environment).toBe('production');
    expect(easJson.build.preview.android).toEqual({ buildType: 'apk' });
    expect(easJson.build.production.autoIncrement).toBe(true);
    expect(easJson.build.production.environment).toBe('production');
    expect(easJson.build.production.ios).toEqual({ image: 'latest' });
  });
});
