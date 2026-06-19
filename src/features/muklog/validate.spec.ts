// src/features/muklog/validate.spec.ts
// 입력 정규화/검증 + snake row 빌더 (plan §5 T3, §5.3, AC3·AC4·AC5·AC9).
//   today 고정을 위해 todayLocalDate를 주입 가능하게 두고 테스트에서 고정값을 넣는다.
import { MuklogErrorToken } from './errors';
import { normalizeMuklogInput, toMuklogRow, todayLocalDate } from './validate';

const baseInput = {
  roomId: 'r1',
  placeName: '트라토리아 보나',
  category: 'pasta',
  area: '연남동',
  rating: 5,
  memo: '맛있었어요',
  visitedAt: '2026-02-14',
};

describe('normalizeMuklogInput', () => {
  it('정상 입력을 trim하여 통과시킨다', () => {
    const result = normalizeMuklogInput({ input: { ...baseInput, placeName: '  보나  ' } });
    expect(result.placeName).toBe('보나');
    expect(result.category).toBe('pasta');
    expect(result.rating).toBe(5);
  });

  it('장소명이 비면 PLACE_NAME_REQUIRED를 throw한다 (AC3)', () => {
    expect(() => normalizeMuklogInput({ input: { ...baseInput, placeName: '   ' } })).toThrow(
      MuklogErrorToken.PlaceNameRequired,
    );
  });

  it('rating이 1~5 밖이면 RATING_OUT_OF_RANGE를 throw한다 (AC4)', () => {
    expect(() => normalizeMuklogInput({ input: { ...baseInput, rating: 6 } })).toThrow(
      MuklogErrorToken.RatingOutOfRange,
    );
    expect(() => normalizeMuklogInput({ input: { ...baseInput, rating: -1 } })).toThrow(
      MuklogErrorToken.RatingOutOfRange,
    );
  });

  it('rating 0/null은 미평가로 허용하고 null로 정규화한다 (AC4)', () => {
    expect(normalizeMuklogInput({ input: { ...baseInput, rating: 0 } }).rating).toBeNull();
    expect(normalizeMuklogInput({ input: { ...baseInput, rating: null } }).rating).toBeNull();
  });

  it('미래 방문일이면 VISITED_AT_IN_FUTURE를 throw한다 (AC5)', () => {
    expect(() =>
      normalizeMuklogInput({ input: { ...baseInput, visitedAt: '2999-01-01' } }),
    ).toThrow(MuklogErrorToken.VisitedAtInFuture);
  });

  it('visitedAt 미지정 시 오늘 날짜로 채운다', () => {
    const result = normalizeMuklogInput({ input: { ...baseInput, visitedAt: undefined } });
    expect(result.visitedAt).toBe(todayLocalDate());
  });

  it('빈/공백 카테고리·area는 null로 정규화한다(데이터 결측)', () => {
    const result = normalizeMuklogInput({
      input: { ...baseInput, category: null, area: '' },
    });
    expect(result.category).toBeNull();
    expect(result.area).toBeNull();
  });

  it('메모가 없거나 공백/5자 미만이면 MEMO_TOO_SHORT를 throw한다(메모 필수·최소 5자)', () => {
    expect(() => normalizeMuklogInput({ input: { ...baseInput, memo: '   ' } })).toThrow(
      MuklogErrorToken.MemoTooShort,
    );
    expect(() => normalizeMuklogInput({ input: { ...baseInput, memo: '맛' } })).toThrow(
      MuklogErrorToken.MemoTooShort,
    );
    expect(() => normalizeMuklogInput({ input: { ...baseInput, memo: null } })).toThrow(
      MuklogErrorToken.MemoTooShort,
    );
  });

  it('메모 5자 이상이면 trim해서 통과한다', () => {
    const result = normalizeMuklogInput({ input: { ...baseInput, memo: '  맛있었어요  ' } });
    expect(result.memo).toBe('맛있었어요');
  });

  // 장소검색(muklog-place) — place 필드 통과/정규화 (plan §3.8 / T8·T9).
  it('place 필드(kakaoPlaceId/address/roadAddress/lat/lng)를 통과시킨다', () => {
    const result = normalizeMuklogInput({
      input: {
        ...baseInput,
        kakaoPlaceId: '26338954',
        address: '서울 마포구 연남동 227-15',
        roadAddress: '서울 마포구 동교로 123',
        lat: 37.561,
        lng: 126.925,
      },
    });
    expect(result.kakaoPlaceId).toBe('26338954');
    expect(result.address).toBe('서울 마포구 연남동 227-15');
    expect(result.roadAddress).toBe('서울 마포구 동교로 123');
    expect(result.lat).toBe(37.561);
    expect(result.lng).toBe(126.925);
  });

  it('place 필드 미지정(수동입력 폴백) → 모두 null', () => {
    const result = normalizeMuklogInput({ input: baseInput });
    expect(result.kakaoPlaceId).toBeNull();
    expect(result.address).toBeNull();
    expect(result.roadAddress).toBeNull();
    expect(result.lat).toBeNull();
    expect(result.lng).toBeNull();
  });

  it('빈/공백 주소는 null, NaN 좌표는 쌍 무결성 위해 둘 다 null로 방어', () => {
    const result = normalizeMuklogInput({
      input: { ...baseInput, address: '  ', roadAddress: '', lat: Number.NaN, lng: 126.9 },
    });
    expect(result.address).toBeNull();
    expect(result.roadAddress).toBeNull();
    expect(result.lat).toBeNull();
    expect(result.lng).toBeNull();
  });
});

describe('toMuklogRow', () => {
  it('정규화 입력 + userId로 snake row(created_by + place 필드 포함)를 만든다 (AC2·AC8)', () => {
    const normalized = normalizeMuklogInput({
      input: {
        ...baseInput,
        kakaoPlaceId: '26338954',
        address: '서울 마포구 연남동 227-15',
        roadAddress: '서울 마포구 동교로 123',
        lat: 37.561,
        lng: 126.925,
      },
    });
    const row = toMuklogRow({ input: normalized, userId: 'u9' });
    expect(row).toEqual({
      room_id: 'r1',
      place_name: '트라토리아 보나',
      category: 'pasta',
      area: '연남동',
      memo: '맛있었어요',
      rating: 5,
      visited_at: '2026-02-14',
      created_by: 'u9',
      kakao_place_id: '26338954',
      address: '서울 마포구 연남동 227-15',
      road_address: '서울 마포구 동교로 123',
      lat: 37.561,
      lng: 126.925,
    });
  });

  it('place 필드 없으면 snake row에 NULL로 매핑(좌표 nullable, §7-4)', () => {
    const normalized = normalizeMuklogInput({ input: baseInput });
    const row = toMuklogRow({ input: normalized, userId: 'u9' });
    expect(row.kakao_place_id).toBeNull();
    expect(row.address).toBeNull();
    expect(row.road_address).toBeNull();
    expect(row.lat).toBeNull();
    expect(row.lng).toBeNull();
  });
});
