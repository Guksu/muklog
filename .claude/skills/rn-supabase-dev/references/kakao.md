# Kakao 구현 참조

지도 렌더링(핀)과 장소 데이터(음식점 검색)를 Kakao로 해결. **REST 키는 Edge Function에만**, 지도 SDK는 네이티브 앱 키 사용.

## 1. 키 종류 구분
- **JavaScript/네이티브 앱 키**: Kakao Map SDK(앱 내 지도 렌더링)용. 앱에 포함되지만 플랫폼(번들ID/패키지명) 제한으로 보호.
- **REST API 키**: Local 장소검색용. **절대 클라이언트에 두지 않는다.** Supabase Edge Function 환경변수로만 보관.

## 2. 지도 SDK (Expo Dev Client)
- RN용 Kakao Map 라이브러리 + Expo config plugin 사용 → `expo prebuild` + Dev Client 빌드. Expo Go 불가.
- 네이티브 앱 키를 plugin 설정에 주입. iOS/Android 각각 키 등록 필요.
- 핀 2종: 저장된 먹로그(강조 스타일) + 주변 일반 음식점(기본 스타일). 일반 핀 탭 → MuklogEditor 프리필.

## 3. 위치 권한
- `expo-location`으로 현재 위치 권한 요청 → 지도 디폴트 센터. 거부 시 폴백 센터(예: 마지막 먹로그 위치) + 안내.

## 4. Local API 프록시 (`supabase/functions/place-search`)
Kakao Local REST를 프록시. 클라이언트는 이 함수만 호출.

- **키워드 검색**: `GET /v2/local/search/keyword.json?query=...&x=lng&y=lat&radius=...`
- **카테고리 검색(음식점)**: `GET /v2/local/search/category.json?category_group_code=FD6&x=lng&y=lat&radius=...` (FD6 = 음식점)
- 헤더: `Authorization: KakaoAK {REST_KEY}` (함수 환경변수).
- 응답에서 앱이 쓰는 필드만 정규화해 반환:
  ```
  { id, place_name, category_name, address_name, road_address_name, x(lng), y(lat) }
  ```
  → 프론트 타입과 이 shape을 **반드시 일치**시킨다(경계면 버그 예방).

## 5. 비용 가드레일 (필수)
- 지도 일반 음식점 핀은 **현재 보이는 영역(viewport) 기준**으로만 조회. 전체/광역 조회 금지.
- 검색 입력·지도 이동에 **디바운스**(예: 400ms) 적용.
- 동일 좌표/쿼리 결과는 짧게 **캐싱**해 중복 호출 차단.
- 페이지네이션은 필요한 만큼만(첫 페이지 우선).

## 6. 좌표 주의
- Kakao는 `x = 경도(lng)`, `y = 위도(lat)`. DB(`lat`, `lng`)와 매핑 시 뒤바뀌지 않게 주의 — 자주 나는 버그.
