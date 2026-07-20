# Dev Notes — sprint-20260720-avatar-cover

## 변경 파일

- `src/features/profile/image/image.ts` — `processAvatarImage` 로직 교체(양축 강제 리사이즈 → 중앙 정사각 크롭 → 512 리사이즈). 파일 상단 "왜곡 허용" 주석을 object-cover 등가 동작으로 갱신.
- `src/features/profile/image/image.spec.ts` — AC1~AC5 실패 테스트 선작성(Red) 후 통과(Green).

## 구현 요지 (object-fit: cover 등가)

1. `manipulateAsync(uri, [])` no-op 호출로 원본 치수(w,h) 획득 — 추가 의존성 없음(기존 top-level import 재사용).
2. `side = min(w,h)`, 중앙 기준 `originX = round((w-side)/2)`, `originY = round((h-side)/2)`.
3. `[{ crop: { originX, originY, width: side, height: side } }, { resize: 512×512 }]` + JPEG q0.7. 크롭 후 정사각이므로 왜곡 없음.

`AVATAR_SIZE`(512)·`AVATAR_COMPRESS`(0.7) 비용 가드레일 유지. crop은 원본 `uri` 기준(no-op 반환 uri 아님) — 좌표계 일치.

## 생산자 ↔ 소비자 매핑 (불변)

- 생산자: `processAvatarImage({ uri })` → `ProcessedImage { uri, width, height }` — 시그니처·반환 shape 불변.
- 소비자1: `uploadAvatarFromUri` (정상 업로드 경로) — 수정 없음.
- 소비자2: `useRecoverPendingPick` (복구 경로) — 수정 없음.
- 렌더: `src/components/Avatar/Avatar.tsx` `resizeMode="cover"` — 무관(원본이 이미 정사각 저장되므로 이중 안전).

## 결정 사항

- 원본 치수 획득에 별도 이미지 크기 API 대신 `expo-image-manipulator` no-op 호출 사용(plan §2-1 권고). manipulateAsync 2회 호출(치수 → 크롭+리사이즈).
- `Math.round`로 홀수 차이의 origin 소수점 방지.

## 테스트 결과

- `npx jest src/features/profile` — 16 suites / 113 tests 전부 통과.
- `npx tsc --noEmit` — image.ts/image.spec.ts 관련 에러 0. 유일한 에러는 `src/lib/supabase/supabase.ts`의 `expo-secure-store` 타입 미해결(이 작업과 무관한 기존 환경 이슈, node_modules 설치는 존재).

## 미완 / 범위 외

- 크롭 위치 조정 UI(사용자 드래그)는 out-of-scope(plan §4). 항상 중앙 크롭.
