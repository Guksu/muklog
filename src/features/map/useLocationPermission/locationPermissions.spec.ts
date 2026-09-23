import { readFileSync } from 'fs';
import { join } from 'path';

// Expo 설정 계약: 기본값을 생략하면 미사용 Always 권한 문구가 재생성된다.
const config = JSON.parse(readFileSync(join(__dirname, '../../../../app.json'), 'utf8'));
const plugin = config.expo.plugins.find((entry: unknown) => Array.isArray(entry) && entry[0] === 'expo-location');

describe('사용 중 위치 권한만 요청하는 앱 설정', () => {
  it('사용하지 않는 두 Always 권한 문구를 제거한다', () => {
    expect(plugin?.[1].locationAlwaysAndWhenInUsePermission).toBe(false);
    expect(plugin?.[1].locationAlwaysPermission).toBe(false);
  });

  it('사용 중 위치 권한의 용도 설명은 유지한다', () => {
    expect(plugin?.[1].locationWhenInUsePermission).toBe('근처 맛집을 지도에 보여주려면 위치 권한이 필요해요.');
  });
});
