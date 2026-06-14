// src/features/muklog/kakaoCategory.ts
// Kakao Local 결과 → 앱 도메인 매핑 순수 유틸 (plan §3.3·§3.4, 경계면 §7-5).
//   mapKakaoCategory: category_name(브레드크럼) + category_group_code → 8종 enum key | null(불명확).
//   deriveArea: address_name(지번) → 동/읍/면/가/로 토큰 | null(보조 표시값, 실패 무해).
//   placeFieldsFromItem: PlaceSearchItem(Edge 응답) → PlaceSelection(시트 자동채움).
//   ⚠️ mapKakaoCategory는 항상 8종 enum key 또는 null만 반환(enum 드리프트 차단). 규칙 순서 = 우선순위(plan §3.3 표).
import { type MuklogCategoryKey } from './categories';
import { type PlaceSearchItem, type PlaceSelection } from './types';

// Kakao category_name 키워드 → 8종 enum 매핑 규칙(plan §3.3 표 순서 = 우선순위, 위→아래 부분일치).
//   cafe를 베이커리보다 먼저(plan), burger를 pasta보다 먼저(양식>햄버거), izakaya는 일식 미포함 술집 계열.
const CATEGORY_RULES: { keywords: string[]; key: MuklogCategoryKey }[] = [
  { keywords: ['카페', '커피'], key: 'cafe' },
  { keywords: ['베이커리', '제과', '빵'], key: 'bakery' },
  { keywords: ['일식', '초밥', '스시', '오마카세', '회'], key: 'sushi' },
  { keywords: ['이자카야', '선술집', '사케'], key: 'izakaya' },
  { keywords: ['중식', '중국'], key: 'chinese' },
  { keywords: ['햄버거', '버거', '펍', '바(bar)', 'bar'], key: 'burger' },
  { keywords: ['양식', '파스타', '이탈리', '스파게티', '피자'], key: 'pasta' },
  { keywords: ['국수', '면', '칼국수', '한식', '분식', '식당'], key: 'noodle' },
];

/**
 * Kakao category_name + category_group_code를 8종 enum key로 매핑한다(plan §3.3).
 * groupCode CE7(카페)는 category_name과 무관하게 cafe로 우선 처리한다.
 * 매칭 없으면 null(사용자가 칩 수동 선택).
 * @param categoryName Kakao 브레드크럼 카테고리(예 "음식점 > 한식 > 칼국수")
 * @param categoryGroupCode Kakao category_group_code(FD6/CE7/'')
 * @returns 8종 enum key 또는 null
 */
export const mapKakaoCategory = ({
  categoryName,
  categoryGroupCode,
}: {
  categoryName: string;
  categoryGroupCode: string;
}): MuklogCategoryKey | null => {
  if ((categoryGroupCode ?? '').toUpperCase() === 'CE7') return 'cafe';
  const haystack = (categoryName ?? '').toLowerCase();
  if (haystack.trim().length === 0) return null;
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))) {
      return rule.key;
    }
  }
  return null;
};

/**
 * 지번 주소(address_name)에서 동/읍/면/가/로로 끝나는 어절을 추출한다(plan §3.4).
 * 토큰을 못 찾으면 null(area는 보조 표시값이라 실패해도 무해).
 * @param addressName Kakao address_name(공백 구분) 또는 null/undefined
 * @returns area 토큰 또는 null
 */
export const deriveArea = ({
  addressName,
}: {
  addressName: string | null | undefined;
}): string | null => {
  const tokens = (addressName ?? '').trim().split(/\s+/).filter(Boolean);
  const areaToken = tokens.find((token) => /(동|읍|면|가|로)$/.test(token));
  return areaToken ?? null;
};

/**
 * 빈/공백 문자열을 null로 정규화한다(주소 결측 단일 처리).
 * @param value 원본 문자열
 * @returns trim 결과 또는 null
 */
const textOrNull = ({ value }: { value: string }): string | null => {
  const trimmed = (value ?? '').trim();
  return trimmed.length === 0 ? null : trimmed;
};

/**
 * 좌표 number를 유한값만 통과시킨다(NaN/Infinity → null, 쌍 무결성은 호출측 placeFieldsFromItem이 보장).
 * @param value 좌표 number
 * @returns 유한 number 또는 null
 */
const finiteOrNull = ({ value }: { value: number }): number | null =>
  Number.isFinite(value) ? value : null;

/**
 * Edge Function 응답 1건(PlaceSearchItem)을 시트 자동채움값(PlaceSelection)으로 변환한다(plan §4.1).
 * category는 mapKakaoCategory, area는 deriveArea로 파생. 좌표는 lat·lng 둘 다 유한일 때만 채운다(쌍 무결성 — 지도 핀 보호).
 * @param item place-search 결과 항목
 * @returns 입력에 머지할 자동채움값
 */
export const placeFieldsFromItem = ({ item }: { item: PlaceSearchItem }): PlaceSelection => {
  const lat = finiteOrNull({ value: item.lat });
  const lng = finiteOrNull({ value: item.lng });
  const hasCoordPair = lat !== null && lng !== null;
  return {
    placeName: item.placeName,
    category: mapKakaoCategory({
      categoryName: item.categoryName,
      categoryGroupCode: item.categoryGroupCode,
    }),
    area: deriveArea({ addressName: item.addressName }),
    address: textOrNull({ value: item.addressName }),
    roadAddress: textOrNull({ value: item.roadAddressName }),
    kakaoPlaceId: item.kakaoPlaceId,
    lat: hasCoordPair ? lat : null,
    lng: hasCoordPair ? lng : null,
  };
};
