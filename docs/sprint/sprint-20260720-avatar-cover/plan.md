# Sprint 20260720 — avatar-cover (아바타 업로드 왜곡 수정)

> 작성: 오케스트레이터(리더) 직접 — 소형 수정 부분 재실행 모드(planner 생략).
> 사용자 요청: "프로필 이미지를 변경하면 이미지가 원에 꽉 차려고 찌그러진다. 웹의 object-fit: cover처럼 적용하고 싶다."

## 1. 문제와 근본 원인

- 렌더링(`src/components/Avatar/Avatar.tsx:56`)은 이미 `resizeMode="cover"` — 문제 아님.
- 근본 원인: `src/features/profile/image/image.ts:22` `processAvatarImage`가
  `resize: { width: 512, height: 512 }`로 **양축 강제 리사이즈** → 비정사각 원본이 업로드 시점에 이미 왜곡된 512×512 JPEG로 저장됨.
  (파일 주석에 "비정사각 원본은 512×512로 강제(왜곡 허용 — 크롭 UI는 out-of-scope)"로 명시된 과거 결정.)

## 2. 해법 (object-cover 등가)

업로드 전처리에서 **중앙 정사각 크롭 → 512 리사이즈**:
1. 원본 크기(w,h) 획득 — 추가 의존성 없이 `expo-image-manipulator`의 no-op `manipulateAsync(uri, [])` 결과 또는 동등 수단.
2. `side = min(w, h)`, 중앙 기준 `crop { originX: (w-side)/2, originY: (h-side)/2, width: side, height: side }`.
3. `resize { width: 512, height: 512 }` (크롭 후엔 정사각이므로 왜곡 없음) + JPEG q0.7 유지.

## 3. 인수조건 (테스트 케이스 = `image.spec.ts`)

- AC1: 가로 원본(예: 4000×3000) → 중앙 크롭(3000×3000, originX 500) 후 512×512. 왜곡 없음.
- AC2: 세로 원본(예: 3000×4000) → 중앙 크롭(originY 500) 후 512×512.
- AC3: 정사각 원본 → 결과 512×512 (크롭이 전체 프레임이어도 무방).
- AC4: 시그니처 `processAvatarImage({ uri })` 및 반환 `ProcessedImage` 불변 — 소비자
  `uploadAvatarFromUri`(정상 경로)·`useRecoverPendingPick`(복구 경로) 수정 불필요.
- AC5: `AVATAR_SIZE`(512)·`AVATAR_COMPRESS`(0.7) 비용 가드레일 유지.

## 4. 스코프

- 대상: `src/features/profile/image/image.ts` + `image.spec.ts` (필요 시 파일 주석 갱신).
- 제외: 크롭 위치 조정 UI(추후), Avatar 렌더링, 업로드 플로우.

## 5. 종료 기준

`npm test` 전체 통과 + `tsc --noEmit` + qa-report-logic.md 통과. git 작업은 사용자 전담.
