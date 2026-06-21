# Sprint: 폰트 SUIT 전환 (sprint-20260620-font-suit)

## 단일 기능
RN 전 화면 기본 글꼴을 **Pretendard → SUIT**로 전환한다. 디자인 킷(SSOT) 업데이트로 기본 글꼴이 SUIT로 바뀐 것에 정합.

> 범위 밖(후속 스프린트 S2~S7): 홈 구조·에디터 저장조건·상세 공유버튼·프로필·카피 정합 등. 이 스프린트는 **폰트 패밀리 전환만** 다룬다. 컬러·radius·섀도우·간격 토큰은 변경하지 않는다(킷과 이미 일치).

## 근거 (킷 = 단일 출처)
- 킷 `templates/muklog/index.html:8` — `SUIT-Variable.css`(sun-typeface SUIT@2) 로드.
- 킷 `index.html:66-72` — `TWEAK_DEFAULTS.softFont: true`(기본 ON).
- 킷 `index.html:89-91` — softFont ON → `--font-sans: "SUIT Variable", "Pretendard JP", "Pretendard", -apple-system, …`(SUIT 우선, Pretendard 폴백).
- 킷 `README.md` — "폰트: SUIT(SIL OFL, 상업용 무료) 가변폰트. index.html에서 --font-sans 오버라이드."
- 현재 RN: `src/theme/fonts.ts`·`src/theme/tokens.ts` typography 전부 `Pretendard-*`.

## 기술 결정
- **가변폰트 → 정적 weight TTF.** RN/Expo는 variable font 축(weight) 동적 적용이 불안정 → Pretendard와 동일하게 정적 weight 4종을 사용. 입수처(가용성 200 확인): `https://cdn.jsdelivr.net/gh/sun-typeface/SUIT@2/fonts/static/ttf/SUIT-{Regular|Medium|SemiBold|Bold}.ttf`.
- **weight ↔ family 매핑(기존 Pretendard 구조 그대로 치환).** 800/700→SUIT-Bold, 600→SUIT-SemiBold, 500→SUIT-Medium, 400→SUIT-Regular.
- **RN 폴백 한계.** 킷의 `--font-sans` 폴백 체인(SUIT→Pretendard→system)은 웹 CSS 개념. RN `fontFamily`는 단일 정확 매칭이라 글리프 단위 폴백이 없다. 따라서 typography는 단일 `SUIT-*`로 지정하고, **로드 실패 시 시스템 폰트 폴백**은 이미 `App.tsx`의 `Font.loadAsync().catch()` 안전장치로 보장됨(영구 스플래시 방지). 별도 폴백 체인 추가하지 않는다.
- **Pretendard 자산 처리.** `fontMap`에서 Pretendard 키 제거(미참조 → expo-font 번들 제외). `.ttf` 파일은 삭제하지 않고 보존(데이터 손실 회피, 사용자가 추후 정리 가능) — dev-notes에 명시.
- 라이선스: SUIT = SIL Open Font License 1.1, 상업적 사용·임베드 허용.

## 인수조건 (= 테스트 케이스, TDD Red→Green)
- **AC1** `fontMap`에 `SUIT-Regular/Medium/SemiBold/Bold` 4키가 SUIT TTF를 가리키고, `Pretendard-*` 키는 없다.
- **AC2** `typography`의 모든 항목 `fontFamily`가 `SUIT-`로 시작한다(`Pretendard-` 0건). (spec에서 전수 단언)
- **AC3** `assets/fonts/SUIT-{Regular,Medium,SemiBold,Bold}.ttf` 4파일이 실제 존재하고 유효한 TTF다(파일 크기 > 0, 매직넘버 확인).
- **AC4** `tokens.spec.ts`의 폰트 단언(현 158~323행 Pretendard)을 SUIT로 갱신, **`npm test` 전체 green**.
- **AC5** **`npx tsc --noEmit` 0 에러**(family 문자열 변경은 타입 영향 없음, 회귀 0).
- **AC6** `App.tsx`·`fonts.ts`·`architecture.md:260`의 "Pretendard" 서술 주석을 SUIT로 갱신(문서 정합).

## 작업 목록
1. **(dev)** SUIT 정적 TTF 4종을 `assets/fonts/`로 다운로드, 유효성 검증(AC3).
2. **(dev, TDD Red)** `tokens.spec.ts` 폰트 단언을 SUIT로 변경 + "typography 전수 SUIT-* 시작" 단언 추가 → 실패 확인.
3. **(dev, Green)** `fonts.ts` fontMap을 SUIT로 재매핑(AC1), `tokens.ts` typography fontFamily `Pretendard-*`→`SUIT-*` 일괄 치환(AC2).
4. **(dev)** `App.tsx`·`fonts.ts`·`architecture.md` 주석/서술 갱신(AC6).
5. **(dev)** `npm test` + `tsc --noEmit` 통과 확인, `dev-notes.md` 작성(생산자↔소비자: fontMap 키 ↔ typography family ↔ expo-font 로딩).
6. **(qa-visual)** 킷 글꼴 의도(SUIT) 대비 RN 적용 충실도 + weight↔family 매핑 정합 검증 → `qa-report-visual.md`.
7. **(qa-logic)** fontMap 키 ↔ typography family ↔ `Font.loadAsync` 경계면 1:1 정합, 잔존 Pretendard 참조 0건, TDD·테스트·tsc·컨벤션 검증 → `qa-report-logic.md`.

## 엣지/리스크
- 다운로드 실패/네트워크 → dev가 재시도, 불가 시 사용자에 수동 배치 요청.
- 누락 키(typography가 fontMap에 없는 family 참조) → qa-logic 경계면 검증으로 차단.
- SUIT 한글 글리프 렌더 차이는 디바이스 스모크 영역(런타임) — 본 스프린트는 정합·빌드까지. 디바이스 육안 확인은 사용자 안내.
