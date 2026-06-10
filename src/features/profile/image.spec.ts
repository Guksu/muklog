// src/features/profile/image.spec.ts
// 아바타 이미지 처리 유틸 명세 (plan §3.4 / §5-1, T4 / P7). 비용 가드레일: 512 리사이즈 + JPEG q0.7.
// expo-image-manipulator는 모킹 — 우리 코드의 호출 인자/반환 매핑만 검증.
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
}));

import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { AVATAR_COMPRESS, AVATAR_SIZE, processAvatarImage } from './image';

const manipulate = manipulateAsync as jest.Mock;

beforeEach(() => {
  manipulate.mockReset();
});

describe('processAvatarImage', () => {
  it('512×512 resize + JPEG + compress 0.7로 manipulateAsync를 호출한다 (가드레일)', async () => {
    manipulate.mockResolvedValueOnce({ uri: 'file:///out.jpg', width: 512, height: 512 });

    await processAvatarImage({ uri: 'file:///in.png' });

    expect(manipulate).toHaveBeenCalledWith(
      'file:///in.png',
      [{ resize: { width: AVATAR_SIZE, height: AVATAR_SIZE } }],
      { compress: AVATAR_COMPRESS, format: SaveFormat.JPEG },
    );
  });

  it('처리된 결과(uri/width/height)를 반환한다', async () => {
    manipulate.mockResolvedValueOnce({ uri: 'file:///out.jpg', width: 512, height: 512 });

    const result = await processAvatarImage({ uri: 'file:///in.png' });

    expect(result).toEqual({ uri: 'file:///out.jpg', width: 512, height: 512 });
  });

  it('상수는 512 / 0.7', () => {
    expect(AVATAR_SIZE).toBe(512);
    expect(AVATAR_COMPRESS).toBe(0.7);
  });
});
