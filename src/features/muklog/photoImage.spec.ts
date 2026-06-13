// src/features/muklog/photoImage.spec.ts
// 먹로그 사진 처리 유틸 명세 (plan §3.4 / §5 ② / §8). 비용 가드레일: 장변 1280 리사이즈 + JPEG q0.7.
//   image.ts(아바타)와 달리 정사각 강제 X — 장변만 1280으로 제한(가로/세로 비율 보존).
//   expo-image-manipulator는 모킹 — 우리 코드의 호출 인자/반환 매핑만 검증.
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
}));

import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { PHOTO_COMPRESS, PHOTO_MAX_EDGE, processMuklogPhoto } from './photoImage';

const manipulate = manipulateAsync as jest.Mock;

beforeEach(() => {
  manipulate.mockReset();
});

describe('processMuklogPhoto', () => {
  it('장변(1280) resize + JPEG + compress 0.7로 manipulateAsync를 호출한다 (가드레일)', async () => {
    manipulate.mockResolvedValueOnce({ uri: 'file:///out.jpg', width: 1280, height: 960 });

    await processMuklogPhoto({ uri: 'file:///in.heic' });

    expect(manipulate).toHaveBeenCalledWith(
      'file:///in.heic',
      [{ resize: { width: PHOTO_MAX_EDGE } }],
      { compress: PHOTO_COMPRESS, format: SaveFormat.JPEG },
    );
  });

  it('처리된 결과 uri를 반환한다 (HEIC→JPEG 변환 출력)', async () => {
    manipulate.mockResolvedValueOnce({ uri: 'file:///out.jpg', width: 1280, height: 960 });

    const result = await processMuklogPhoto({ uri: 'file:///in.heic' });

    expect(result).toEqual({ uri: 'file:///out.jpg' });
  });

  it('상수는 1280 / 0.7', () => {
    expect(PHOTO_MAX_EDGE).toBe(1280);
    expect(PHOTO_COMPRESS).toBe(0.7);
  });
});
