import { containSize, clampPhotoTransform, zoomAtPoint, swipePhotoIndex } from './photoViewerGeometry';
const viewport = { width: 300, height: 600 };
describe('사진 뷰어 geometry', () => {
  it('가로·세로 사진을 잘리지 않게 맞춘다', () => {
    expect(containSize({ image: { width: 600, height: 300 }, viewport })).toEqual({ width: 300, height: 150 });
    expect(containSize({ image: { width: 100, height: 300 }, viewport })).toEqual({ width: 200, height: 600 });
  });
  it('작은 축은 가운데 고정하고 큰 축만 이동한다', () => {
    expect(clampPhotoTransform({ scale: 2, x: 1000, y: 1000, image: { width: 300, height: 150 }, viewport })).toEqual({ scale: 2, x: 150, y: 0 });
  });
  it('확대 한계와 1배 위치를 보정한다', () => {
    expect(clampPhotoTransform({ scale: 9, x: 900, y: 0, image: viewport, viewport }).scale).toBe(3);
    expect(clampPhotoTransform({ scale: 0, x: 100, y: 100, image: viewport, viewport })).toEqual({ scale: 1, x: 0, y: 0 });
  });
  it('핀치 초점 아래의 이미지 점을 보존한다', () => {
    expect(zoomAtPoint({ start: { scale: 1, x: 0, y: 0 }, scale: 2, origin: { x: 50, y: 30 }, focal: { x: 50, y: 30 } })).toEqual({ scale: 2, x: -50, y: -30 });
  });
  it('좌우 임계값·수직 우세·경계·핀치 개입을 판정한다', () => {
    const base = { index: 1, count: 3, width: 300, y: 0, pinched: false };
    expect(swipePhotoIndex({ ...base, x: -100 })).toBe(2);
    expect(swipePhotoIndex({ ...base, x: 100 })).toBe(0);
    expect(swipePhotoIndex({ ...base, x: 30 })).toBe(1);
    expect(swipePhotoIndex({ ...base, x: 100, y: 100 })).toBe(1);
    expect(swipePhotoIndex({ ...base, x: -100, pinched: true })).toBe(1);
    expect(swipePhotoIndex({ ...base, index: 2, x: -100 })).toBe(2);
  });
});

it('이동 중 초점과 기존 변환에서도 같은 이미지 점을 유지한다', () => {
  const next = zoomAtPoint({ start: { scale: 2, x: 20, y: -10 }, scale: 3, origin: { x: 60, y: 30 }, focal: { x: 80, y: 40 } });
  expect(next).toEqual({ scale: 3, x: 20, y: -20 });
});
it('swipe의 48px 및 화면 15% 경계를 포함한다', () => {
  const base = { index: 0, count: 2, y: 0, pinched: false };
  expect(swipePhotoIndex({ ...base, width: 300, x: -48 })).toBe(1);
  expect(swipePhotoIndex({ ...base, width: 600, x: -89 })).toBe(0);
  expect(swipePhotoIndex({ ...base, width: 600, x: -90 })).toBe(1);
});
