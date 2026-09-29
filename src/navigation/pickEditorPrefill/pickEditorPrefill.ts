// src/navigation/pickEditorPrefill/pickEditorPrefill.ts
// 위시 → 먹로그 에디터 생성 모드 프리필 7필드 공용 함수 (map-wish-card-visit · U12).
//   소비처 2곳: 지도 위시 카드 "기록하기"(MapTabScreen) · 위시 목록 "기록하기"(LogScreen). 두 진입이 같은 값을 싣게
//   매핑을 한 곳에 둔다. 인자 타입이 에디터 라우트 파라미터 타입(MuklogEditorPrefill)이라, 위시 핀(WishPin)이
//   7필드 중 하나라도 잃으면 호출부가 컴파일되지 않는다.
//   src/navigation에 두는 이유: 반환 타입이 라우트 파라미터이고, 지도 화면 spec은 @/features/wishlist를 통째로
//   모킹해서 거기 두면 지도 화면 테스트에서 이 함수가 사라진다.
import { type MuklogEditorPrefill } from '../routes';

/**
 * 위시(지도 위시 핀·위시 목록 항목)에서 에디터 프리필 7필드만 골라 새 객체로 만든다.
 * 펼치기(`...wish`)를 쓰지 않는다 — 위시의 id·roomId·note·addedBy 등이 라우트 파라미터로 새지 않게 하나씩 옮긴다.
 * 값은 바꾸지 않는다(null은 null 그대로).
 * @param wish 프리필 7필드를 가진 위시(그 밖의 필드는 버린다)
 * @returns 정확히 placeName·category·area·roadAddress·lat·lng·kakaoPlaceId를 가진 새 프리필 객체
 */
export const pickEditorPrefill = ({ wish }: { wish: MuklogEditorPrefill }): MuklogEditorPrefill => ({
  placeName: wish.placeName,
  category: wish.category,
  area: wish.area,
  roadAddress: wish.roadAddress,
  lat: wish.lat,
  lng: wish.lng,
  kakaoPlaceId: wish.kakaoPlaceId,
});
