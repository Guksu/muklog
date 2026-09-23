// src/components/PhotoViewer/photoViewerIndex.spec.ts
// 뷰어 인덱스 계산(순수) — plan §5-1 A (TC-U1~U5) + 페이지 환산 가드.
import { clampPhotoIndex, resolvePageIndex } from './photoViewerIndex';

describe('clampPhotoIndex — 진입 인덱스를 목록 범위로 접는다', () => {
  // TC-U1
  it('정상 범위는 그대로 둔다', () => {
    expect(clampPhotoIndex({ index: 2, count: 5 })).toBe(2);
  });

  // TC-U2
  it('상한을 넘으면 마지막 인덱스로 접는다', () => {
    expect(clampPhotoIndex({ index: 5, count: 5 })).toBe(4);
    expect(clampPhotoIndex({ index: 9, count: 5 })).toBe(4);
  });

  // TC-U3
  it('음수는 0으로 접는다', () => {
    expect(clampPhotoIndex({ index: -1, count: 5 })).toBe(0);
  });

  // TC-U4
  it('소수는 정수(내림)로 만든다', () => {
    expect(clampPhotoIndex({ index: 1.7, count: 5 })).toBe(1);
  });

  // TC-U5
  it('빈 목록(count 0)이면 0이다 — 호출부가 렌더 자체를 막는다', () => {
    expect(clampPhotoIndex({ index: 3, count: 0 })).toBe(0);
  });

  it('NaN 같은 실패 입력에서도 0으로 안전하게 떨어진다(크래시·빈 화면 금지, E4)', () => {
    expect(clampPhotoIndex({ index: Number.NaN, count: 5 })).toBe(0);
  });
});

describe('resolvePageIndex — 스크롤 오프셋을 페이지 번호로 환산한다', () => {
  it('페이지 폭의 배수에서 그 페이지를 가리킨다', () => {
    expect(resolvePageIndex({ offsetX: 0, pageWidth: 390, count: 5 })).toBe(0);
    expect(resolvePageIndex({ offsetX: 390, pageWidth: 390, count: 5 })).toBe(1);
  });

  it('페이지 중앙을 넘어가면 다음 페이지로 반올림한다(스냅 전 중간값)', () => {
    expect(resolvePageIndex({ offsetX: 600, pageWidth: 390, count: 5 })).toBe(2);
    expect(resolvePageIndex({ offsetX: 500, pageWidth: 390, count: 5 })).toBe(1);
  });

  it('바운스로 범위를 벗어난 오프셋도 목록 안으로 접는다', () => {
    expect(resolvePageIndex({ offsetX: -80, pageWidth: 390, count: 5 })).toBe(0);
    expect(resolvePageIndex({ offsetX: 9999, pageWidth: 390, count: 5 })).toBe(4);
  });

  it('폭이 0으로 보고돼도 0을 돌려준다(NaN 카운터 방지)', () => {
    expect(resolvePageIndex({ offsetX: 120, pageWidth: 0, count: 5 })).toBe(0);
  });
});
