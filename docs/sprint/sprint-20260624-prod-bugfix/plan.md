# Sprint: 실기기 프로덕션 버그픽스 8건 (sprint-20260624-prod-bugfix)

실기기(Android/iOS) 테스트에서 발견한 버그 8건. 영역별 4그룹으로 분담(파일셋 분리 → 병렬). 각 그룹 TDD.

## 그룹 A — 프로필 상태·닉네임 (#2·#3·#8)
- **#2 닉네임 변경이 다른 화면에 반영 안 됨**: ProfileScreen에서 닉네임 바꿔도 HomeHeader·LogList 등 다른 화면은 각자 `useProfile` 인스턴스라 재조회 안 함. → 공유 상태(컨텍스트) 또는 포커스 재조회로 전파. 근본 원인 조사 후 수정.
- **#3 닉네임 미설정 시 "나" → "동물명+숫자"**: `useSelfDisplay` 등의 `'나'` 폴백을 **userId 기반 결정적 기본 닉네임**으로 교체. 신규 유틸 `defaultNickname({ userId })` → 한국어 동물명 리스트(~20개) + userId 파생 숫자(예: `수달2847`). **결정적**(같은 userId면 항상 같은 값 → 화면 간 일관). 표시 폴백(persist 아님). nickname null/빈 곳 전부(HomeHeader·LogList·displayLogName·ProfileScreen·MuklogDetail 작성자 등) 일관 적용.
- **#8 프로필 이미지 변경 안 됨**: `changeAvatar`(useUpdateProfile) 흐름 — 피커→업로드→avatar_url. 안 되는 원인 조사(피커 미동작 / Storage 업로드·RLS 실패 / 변경 후 미반영=#2와 동일 전파 문제). 실제 원인 찾아 수정.
- 파일: `src/features/profile/*`, `src/navigation/HomeHeader.tsx`, `src/navigation/screens/LogListScreen.tsx`(useSelfDisplay), `src/features/room/displayLogName.ts`, `src/components/Avatar.tsx`.

## 그룹 B — 지도 (#4·#5)
- **#4 첫 진입 시 디폴트가 서울역(현위치 아님)**: 첫 로드 시 현재 위치로 센터링해야 하는데 하드코딩 디폴트(서울역)에 고정. "내 위치" 버튼은 정상. → 권한 granted면 초기 region을 현위치로(권한 없/실패 시에만 서울 폴백). `initialRegion`/`useLocationPermission`/MapTabScreen 초기화 타이밍 조사.
- **#5 음식 종류 텍스트 상단이 조금 가려짐**: 지도 관련 텍스트(주변 스팟 카드 카테고리/라벨 등) 상단 클리핑 — 한글 글리프 lineHeight<fontSize 클리핑(메모리 [[qa-layout-blind-spot]]). 해당 텍스트 컨테이너 lineHeight/padding 보정.
- 파일: `src/features/map/*`(MapTabScreen·initialRegion·NearbySpotCard·components), 카테고리 매핑 파일은 **건드리지 말 것**(그룹 C 소유).

## 그룹 C — 카테고리·검색 (#6·#7)
- **#6 "고기" 카테고리 추가**: `MUKLOG_CATEGORIES`에 🍖 "고기" 추가(따뜻한 그라데이션, 칩 순서 적절히). `kakaoCategory.ts` 매핑에 고기집/구이/삼겹/갈비/스테이크/바베큐 키워드 → 고기. 주변 핀/카드·검색 커버에도 반영.
- **#7 장소·음식점 검색에서 항상 커피 이미지만 뜸**: 검색 결과 커버가 늘 cafe로 폴백. `mapKakaoCategory`(또는 `defaultResolveCategory`)가 Kakao categoryName/categoryGroupCode를 제대로 해석 못 해 null→FoodCover 기본 cafe로 빠지는 것으로 추정. 실제 카카오 응답 매핑 조사 후 카테고리 정확 해석.
- 파일: `src/features/muklog/categories.ts`·`kakaoCategory.ts`·`PlaceSearchView.tsx`·`PlaceResultRow.tsx`·관련 spec. (지도 MapTabScreen은 건드리지 말 것 — B 소유. 단 kakaoCategory는 C 소유라 B는 안 만짐.)

## 그룹 D — Android GNB safe-area (#1)
- **#1 Android에서 하단 탭바(GNB)가 시스템 내비게이션바에 가려짐**: 하단 탭바에 bottom safe-area inset 미적용. → 탭바 컨테이너에 `insets.bottom` 반영(SafeArea). Android 제스처/3버튼 내비 양쪽 확인.
- 파일: 하단 탭 네비게이터/탭바 컴포넌트(`src/navigation/HomeTabs.tsx` 또는 탭바). HomeHeader(상단)는 A 소유라 안 만짐.

## 절대 규칙 / 진행
- git 금지. TDD(각 버그 재현 테스트 or 단언). 코드 컨벤션 100%. 시크릿 금지.
- **각 그룹은 자기 파일셋만** 수정(병렬 충돌 방지). 각 그룹은 **자기 관련 spec만 실행**(전체 suite·tsc는 리더가 통합 후 1회).
- 라이브 영향: 카테고리/마이그레이션 변경 없으면 추가 배포 불요. 단 #8이 Storage 정책 문제면 사용자 전담 배포 가능성 — 조사 결과에 따라.

## 인수조건 (요약)
- 8건 각각 재현→수정 확인. 통합 `npm test` green + `tsc --noEmit` 0. 회귀 0.
- qa-visual(#1·#5 레이아웃·#3 표시·#6·#7 커버) ∥ qa-logic(#2·#8 상태전파·#4 위치로직·#7 매핑·경계).
