# QA Report — Logic / Integration (sprint-20260720-avatar-cover)

- 담당: qa-logic
- 대상: `plan.md` AC1~AC5 대비 `src/features/profile/image/image.ts` 구현 + 소비자 경계면
- 실행: `npx jest src/features/profile` → 16 suites / 113 tests **전부 통과**. `npx tsc --noEmit` → **에러 0**(dev-notes가 언급한 expo-secure-store 타입 에러는 현재 재현 안 됨 — 클린).

## 결과 요약: 전 항목 통과. 발견된 결함(수정 필요) 없음.

| 항목 | 판정 | 근거 |
|------|------|------|
| AC1 가로 원본 중앙크롭 | 통과 | image.spec.ts:37-51 (originX 500, originY 0, 3000² crop) |
| AC2 세로 원본 중앙크롭 | 통과 | image.spec.ts:53-67 (originX 0, originY 500) |
| AC3 정사각 원본 | 통과 | image.spec.ts:69-83 (origin 0, 2000² crop) |
| AC4 시그니처·반환 shape 불변 | 통과 | image.ts:20,35 ↔ 소비자 교차검증(아래) |
| AC5 비용 가드레일 512·q0.7 | 통과 | image.ts:9-10,31,33 + spec:93-96 |
| TDD·테스트 유의미성 | 통과 | 변조 표본 검증(아래) |
| 코드 컨벤션 | 통과 | 화살표 const·named-object 인자·useCallback/useMemo 0 |

## 경계면 교차검증 (생산자 ↔ 소비자)

생산자 `processAvatarImage({ uri })` → `ProcessedImage { uri, width, height }` (image.ts:20,35).

- 소비자1 `uploadAvatarFromUri.ts:55` — `const processed = await processAvatarImage({ uri })` 후 `processed.uri`만 소비(:58). width/height 미사용 → shape 확장/축소 무관. 시그니처 `{ uri }` 그대로 호출. **정합.**
- 소비자2 `useRecoverPendingPick.ts:66` — `processAvatarImage`를 직접 호출하지 않고 `uploadAvatarFromUri({ uri, userId })` 경유. 간접 소비자로 경계 불변. **정합.**
- 배럴 export `profile/index.ts:16`·`image/index.ts:1` — `processAvatarImage, AVATAR_SIZE, AVATAR_COMPRESS, ProcessedImage` 재노출 유지. **정합.**

결론: AC4 "소비자 수정 불필요" 주장 사실. 시그니처·반환·export 표면 모두 불변.

## 확인 포인트별 심층 검증 (팀리드 지정)

**① crop 좌표 계산 — 엣지케이스 안전.**
- 홀수 치수: `originX = Math.round((w-side)/2)`. w-side가 홀수(2k+1)면 round→k+1. 이때 `originX+side = k+1+side`, `w = side+2k+1` → 우측 여유 = k ≥ 0. **크롭 영역이 원본 경계를 넘지 않음(오버플로우 없음)** — 수학적으로 증명됨(round-half-up이 항상 slack 안에서 동작).
- 극단 종횡비(예 5000×10): `side=min=10`, originX=2495, 10×10 크롭 → 512 업스케일. 로직상 유효.
- 정사각: origin 0 (AC3). 정상.
- (참고) 홀수·극단 종횡비는 **명시 테스트는 없음** — 코드 경로는 안전하나 회귀 방어 관점 커버리지 갭. 결함 아님(선택적 보강 여지).

**② manipulateAsync 2회 좌표계 일치 — 정합.**
image.ts:22 no-op은 원본 치수만 획득. 크롭+리사이즈(image.ts:27-34)는 **원본 `uri` 파라미터**를 다시 넘김(no-op 반환 uri 아님). 크롭 좌표는 원본 픽셀 공간 기준이고 2차 호출도 동일 원본을 대상으로 하므로 좌표계 일치. spec:42-50이 2차 호출 인자를 `SRC_URI`(=원본)로 단언해 이 계약을 고정.

**③ 테스트 유의미성 — 표본 변조로 확인.**
`originX` 계산을 `0`으로 변조 → AC1만 정확히 red(`1 failed, 5 passed`), 원복 후 재통과. 존재 확인이 아니라 crop 파라미터 실값(originX/originY/width/height)을 `toHaveBeenNthCalledWith`로 단언 → 유의미.

**④ 비용 가드레일 유지.**
`AVATAR_SIZE=512`(image.ts:9), `AVATAR_COMPRESS=0.7`(:10), resize 512², compress q0.7, JPEG(:31,33). 원본 직업로드 없음(uploadAvatarFromUri:54-55 처리본만 업로드). AC5 상수 단언(spec:93-96). AWS 미사용·이미지 압축 규칙 준수.

**⑤ 코드 컨벤션(docs/code-convention.md).**
- 화살표 const 함수: `processAvatarImage` (image.ts:20), spec의 `mockSourceThenResult` (spec:19) ✓
- named-object 인자: `{ uri }` ✓
- useCallback/useMemo 실사용 0 ✓
- enum-style 상수: `AVATAR_SIZE`/`AVATAR_COMPRESS` 모듈 상수 ✓
- 파일명=심볼(`image.ts`), 주석이 "왜곡 허용"→object-cover 등가로 갱신됨(image.ts:6,15) ✓

## 미검증 / 범위 외
- 실제 픽셀 크롭 결과(왜곡 제거 시각 확인)는 expo-image-manipulator 모킹이라 단위 테스트 밖 — 디바이스 스모크 영역(plan §4). 로직 계약은 전부 검증됨.

## 조치 요청
없음. 로직 관점 스프린트 **완료 기준 충족**.
