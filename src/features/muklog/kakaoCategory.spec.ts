// src/features/muklog/kakaoCategory.spec.ts
// Kakao 카테고리/주소 → 앱 도메인 매핑 순수 유틸 (plan §3.3·§3.4 / T3·T4, 경계면 §7-5).
//   mapKakaoCategory: category_name + category_group_code → 8종 enum key | null
//   deriveArea: address_name → 동/읍/면/가/로 토큰 | null
//   placeFieldsFromItem: PlaceSearchItem → PlaceSelection(자동채움)
import { MUKLOG_CATEGORY_KEYS } from './categories';
import { deriveArea, mapKakaoCategory, placeFieldsFromItem } from './kakaoCategory';
import { type PlaceSearchItem } from './types';

describe('mapKakaoCategory', () => {
  it('한식·면·분식·식당 → noodle', () => {
    expect(
      mapKakaoCategory({ categoryName: '음식점 > 한식 > 칼국수', categoryGroupCode: 'FD6' }),
    ).toBe('noodle');
    expect(mapKakaoCategory({ categoryName: '음식점 > 분식', categoryGroupCode: 'FD6' })).toBe(
      'noodle',
    );
  });

  it('groupCode CE7 → cafe (category_name 무관)', () => {
    expect(mapKakaoCategory({ categoryName: '음식점 > 디저트', categoryGroupCode: 'CE7' })).toBe(
      'cafe',
    );
  });

  it("'카페' 포함 → cafe", () => {
    expect(
      mapKakaoCategory({ categoryName: '음식점 > 카페 > 커피전문점', categoryGroupCode: 'FD6' }),
    ).toBe('cafe');
  });

  it('제과·베이커리 → bakery', () => {
    expect(
      mapKakaoCategory({ categoryName: '음식점 > 간식 > 제과,베이커리', categoryGroupCode: 'FD6' }),
    ).toBe('bakery');
  });

  it('일식·초밥·오마카세 → sushi', () => {
    expect(
      mapKakaoCategory({ categoryName: '음식점 > 일식 > 초밥', categoryGroupCode: 'FD6' }),
    ).toBe('sushi');
  });

  it('이자카야·선술집·사케 → izakaya (일식 미포함 시)', () => {
    expect(
      mapKakaoCategory({ categoryName: '음식점 > 술집 > 이자카야', categoryGroupCode: 'FD6' }),
    ).toBe('izakaya');
  });

  it('중식·중국 → chinese', () => {
    expect(
      mapKakaoCategory({ categoryName: '음식점 > 중식 > 중국요리', categoryGroupCode: 'FD6' }),
    ).toBe('chinese');
  });

  it('햄버거·버거·펍은 양식(pasta)보다 burger 우선', () => {
    expect(
      mapKakaoCategory({ categoryName: '음식점 > 양식 > 햄버거', categoryGroupCode: 'FD6' }),
    ).toBe('burger');
  });

  it('양식·파스타·이탈리·피자 → pasta', () => {
    expect(
      mapKakaoCategory({ categoryName: '음식점 > 양식 > 이탈리안', categoryGroupCode: 'FD6' }),
    ).toBe('pasta');
  });

  it('불명확/빈 입력 → null', () => {
    expect(mapKakaoCategory({ categoryName: '음식점 > 뷔페', categoryGroupCode: 'FD6' })).toBeNull();
    expect(mapKakaoCategory({ categoryName: '', categoryGroupCode: '' })).toBeNull();
  });

  it('null이 아니면 항상 8종 enum key 중 하나만 반환(enum 드리프트 차단 §7-5)', () => {
    const result = mapKakaoCategory({
      categoryName: '음식점 > 한식 > 국밥',
      categoryGroupCode: 'FD6',
    });
    expect(result === null || MUKLOG_CATEGORY_KEYS.includes(result)).toBe(true);
  });
});

describe('deriveArea', () => {
  it('동 토큰 추출', () => {
    expect(deriveArea({ addressName: '서울 마포구 연남동 227-15' })).toBe('연남동');
  });

  it('가/로 끝 토큰도 추출', () => {
    expect(deriveArea({ addressName: '서울 중구 을지로3가' })).toBe('을지로3가');
  });

  it('동/읍/면/가/로 토큰 없음 → null', () => {
    expect(deriveArea({ addressName: '경기 성남시 분당구' })).toBeNull();
  });

  it('빈 문자열 → null', () => {
    expect(deriveArea({ addressName: '' })).toBeNull();
    expect(deriveArea({ addressName: '   ' })).toBeNull();
  });
});

describe('placeFieldsFromItem', () => {
  const item: PlaceSearchItem = {
    kakaoPlaceId: '26338954',
    placeName: '트라토리아 보나',
    categoryName: '음식점 > 양식 > 이탈리안',
    categoryGroupCode: 'FD6',
    addressName: '서울 마포구 연남동 227-15',
    roadAddressName: '서울 마포구 동교로 123',
    lat: 37.561,
    lng: 126.925,
    phone: '02-123-4567',
  };

  it('PlaceSearchItem → PlaceSelection(placeName·category·area·좌표)', () => {
    expect(placeFieldsFromItem({ item })).toEqual({
      placeName: '트라토리아 보나',
      category: 'pasta',
      area: '연남동',
      address: '서울 마포구 연남동 227-15',
      roadAddress: '서울 마포구 동교로 123',
      kakaoPlaceId: '26338954',
      lat: 37.561,
      lng: 126.925,
    });
  });

  it('빈 주소/도로명은 null, 매핑 실패 카테고리는 null', () => {
    const result = placeFieldsFromItem({
      item: { ...item, categoryName: '음식점 > 뷔페', addressName: '', roadAddressName: '' },
    });
    expect(result.address).toBeNull();
    expect(result.roadAddress).toBeNull();
    expect(result.area).toBeNull();
    expect(result.category).toBeNull();
  });
});
