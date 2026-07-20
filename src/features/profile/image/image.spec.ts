// src/features/profile/image.spec.ts
// 아바타 이미지 처리 유틸 명세 (plan §3 / AC1~AC5). 비용 가드레일: 512 리사이즈 + JPEG q0.7.
// object-cover 등가: 중앙 정사각 크롭 → 512 리사이즈(왜곡 없음).
// expo-image-manipulator는 모킹 — 우리 코드의 호출 인자/시퀀스/반환 매핑만 검증.
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
}));

import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { AVATAR_COMPRESS, AVATAR_SIZE, processAvatarImage } from './image';

const manipulate = manipulateAsync as jest.Mock;

const SRC_URI = 'file:///in.png';
const OUT_URI = 'file:///out.jpg';

// 1st 호출(치수 획득, no-op)의 반환을 세팅하고 2nd 호출(크롭+리사이즈) 반환을 세팅한다.
const mockSourceThenResult = ({ width, height }: { width: number; height: number }) => {
  manipulate.mockResolvedValueOnce({ uri: SRC_URI, width, height });
  manipulate.mockResolvedValueOnce({ uri: OUT_URI, width: 512, height: 512 });
};

beforeEach(() => {
  manipulate.mockReset();
});

describe('processAvatarImage', () => {
  it('먼저 no-op manipulateAsync로 원본 치수를 획득한다', async () => {
    mockSourceThenResult({ width: 4000, height: 3000 });

    await processAvatarImage({ uri: SRC_URI });

    expect(manipulate).toHaveBeenNthCalledWith(1, SRC_URI, []);
  });

  it('AC1: 가로 원본(4000×3000) → 중앙 정사각 크롭(originX 500) 후 512 리사이즈', async () => {
    mockSourceThenResult({ width: 4000, height: 3000 });

    await processAvatarImage({ uri: SRC_URI });

    expect(manipulate).toHaveBeenNthCalledWith(
      2,
      SRC_URI,
      [
        { crop: { originX: 500, originY: 0, width: 3000, height: 3000 } },
        { resize: { width: AVATAR_SIZE, height: AVATAR_SIZE } },
      ],
      { compress: AVATAR_COMPRESS, format: SaveFormat.JPEG },
    );
  });

  it('AC2: 세로 원본(3000×4000) → 중앙 정사각 크롭(originY 500) 후 512 리사이즈', async () => {
    mockSourceThenResult({ width: 3000, height: 4000 });

    await processAvatarImage({ uri: SRC_URI });

    expect(manipulate).toHaveBeenNthCalledWith(
      2,
      SRC_URI,
      [
        { crop: { originX: 0, originY: 500, width: 3000, height: 3000 } },
        { resize: { width: AVATAR_SIZE, height: AVATAR_SIZE } },
      ],
      { compress: AVATAR_COMPRESS, format: SaveFormat.JPEG },
    );
  });

  it('AC3: 정사각 원본(2000×2000) → 크롭 전체 프레임(origin 0) 후 512 리사이즈', async () => {
    mockSourceThenResult({ width: 2000, height: 2000 });

    await processAvatarImage({ uri: SRC_URI });

    expect(manipulate).toHaveBeenNthCalledWith(
      2,
      SRC_URI,
      [
        { crop: { originX: 0, originY: 0, width: 2000, height: 2000 } },
        { resize: { width: AVATAR_SIZE, height: AVATAR_SIZE } },
      ],
      { compress: AVATAR_COMPRESS, format: SaveFormat.JPEG },
    );
  });

  it('처리된 결과(uri/width/height)를 반환한다', async () => {
    mockSourceThenResult({ width: 4000, height: 3000 });

    const result = await processAvatarImage({ uri: SRC_URI });

    expect(result).toEqual({ uri: OUT_URI, width: 512, height: 512 });
  });

  it('상수는 512 / 0.7', () => {
    expect(AVATAR_SIZE).toBe(512);
    expect(AVATAR_COMPRESS).toBe(0.7);
  });
});
