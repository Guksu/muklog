# QA Visual — sprint-20260620-global-toast

**검증자:** qa-visual · **일자:** 2026-06-20 · **종합 판정:** ✅ PASS (불일치 0 / 근사 허용 0 / 미검증 0)

비주얼 단일 출처: 킷 `templates/muklog`(`index.html` `.mk-toast`, `SPEC.md` §전역 토스트 패턴·§5 삭제). 본 스프린트는 토스트를 **표시층 이관(화면별 → 전역 ToastProvider)** 하는 변경이라, 비주얼 컴포넌트(`Toast.tsx`)·토큰은 불변이고 호출부만 교체됨 → "비주얼 변화 없음"이 정상 기대치. 검증 결과 그대로 충족.

---

## 1. 삭제 토스트 문구 + positive 톤 (킷 SPEC §5) — ✅ 통과

| 축 | 킷 | RN | 결과 |
|----|----|----|----|
| 텍스트·카피 | `index.html:135` `showToast({ msg: "먹로그를 삭제했어요", tone: "positive" })`; `SPEC.md:104` "먹로그를 삭제했어요"(positive) | `MuklogDetailRoute.tsx:85` `showToast({ message: '먹로그를 삭제했어요', tone: 'positive' })` | 문구 완전 일치(해요체) |
| 비주얼 | positive = 초록 배경 + ✓ | tone='positive' → `Toast.tsx:69` `toastPositiveBg`(#1E7A47) 배경 + `:84-87` ✓ prefix | 일치 |
| 타이밍 | goBack 전 show → 복귀 LogScreen 위 표시 | `MuklogDetailRoute.tsx:85-86` show → 그 다음 줄 goBack | 킷 순서 일치 |

## 2. 전역 토스트 비주얼 = 기존 Toast 그대로 (킷 .mk-toast 정합 유지) — ✅ 통과

`Toast.tsx`는 본 스프린트에서 변경 없음(프리젠테이셔널 그대로). 킷 `.mk-toast`(index.html:38-43) 대비:

| 속성 | 킷 | RN `Toast.tsx` | 결과 |
|----|----|----|----|
| 위치 | `bottom: 104px` (탭바 위 고정) | `TOAST_BOTTOM = 104` (`:33`, host `:102`) | 일치 |
| 가로 중앙 | `left:50% + translateX(-50%)` | host `left/right:0 + alignItems:'center'`(`:99-103`) | 일치(RN 관용 변환) |
| radius | `border-radius: 14px` | `theme.radius.control`(`:70`, =14) | 일치 |
| 인버스 배경 | neutral `--mk-ink` #2A2422 | `toastBg`(#2A2422, tokens.ts:124) | 일치 |
| positive 배경 | `.pos #1E7A47` | `toastPositiveBg`(#1E7A47, tokens.ts:125) | 일치 |
| padding / gap | `13px 18px` / `gap 9` | `paddingVertical:13, paddingHorizontal:18, gap:9`(`:108-113`) | 일치 |
| 폰트 | `600 14px/1.4` | `spotCount`(SemiBold) + `fontSize:14, lineHeight:20`(`:118`) | 일치 |
| ✓ 크기 | `fontSize:15` | `check fontSize:15`(`:116`) | 일치 |
| 그림자 | `0 10px 30px rgba(0,0,0,.28)` | `shadow.toast`(opacity .28, radius 30, offset 0/10, tokens.ts:175) | 일치 |
| 자동 사라짐 | `setTimeout … 2200` | `DEFAULT_DURATION_MS = 2200`(`:30,59`) | 일치 |
| 진입 애니메이션 | `mkToast .26s`, translateY 14→0 | `ENTER_MS=260`, `ENTER_TRANSLATE_Y=14`(`:31-32,50,76`) | 일치 |
| z-order | `z-index: 95` | `zIndex: 95`(`:104`) | 일치 |

이관으로 비주얼 변화 없음 — 정상.

## 3. 이관된 저장·위시 토스트 문구·tone 불변 (회귀 0) — ✅ 통과

| 토스트 | 킷(SPEC) | RN | 결과 |
|----|----|----|----|
| 신규 저장 | `SPEC.md:116` "맛집을 기록했어요! 🍽️"(신규) | `MuklogEditor.tsx:70` `SAVE_TOAST_CREATE`='맛집을 기록했어요! 🍽️', `:375` positive | 일치 |
| 편집 저장 | "기록을 수정했어요"(편집) | `:71` `SAVE_TOAST_EDIT`='기록을 수정했어요', `:347` positive | 일치 |
| 위시 추가 | `SPEC.md:91` "위시리스트에 담았어요 📍" | `LogScreen.tsx:79` `WISH_ADDED_TOAST`='위시리스트에 담았어요 📍', `:318` positive | 일치 |
| 예약취소 에러 | (비킷, 기존 인라인성 안내) | `LogScreen.tsx:474` neutral tone 유지 | tone 보존 |

화면별 `<Toast>`/로컬 `useToast` 잔존 0 — `grep`상 소비처는 전부 `useToastController`이고, `useToast`/`<Toast>` 직접 참조는 provider 내부(`ToastProvider.tsx`)·훅 정의·테스트뿐. (플레이풀 이모지 🍽️ 📍 는 muklog 킷 허용 — 위반 아님.)

## 4. 위치(탭바/하단)·tone별 색 토큰 경유 — ✅ 통과

- 위치: 킷 `bottom:104px`(고정, 탭바 위) ↔ RN `TOAST_BOTTOM=104`(고정 absolute). 킷도 safe-area inset이 아닌 고정 104px이므로 동일 방식 — 정합. Provider는 `App.tsx:75-77` SafeAreaProvider/ThemeProvider **안**, AuthGate(네비게이터) **밖**에 위치 → 토큰·inset 컨텍스트 접근 가능 + 화면 전환 독립.
- tone 색: 둘 다 raw hex 미사용, `theme.color.toastBg`/`toastPositiveBg` 토큰 경유(`Toast.tsx:69`). 토큰 실값은 킷과 일치(tokens.ts:124-125), `tokens.spec.ts`가 #2A2422·#1E7A47·success와의 의미 분리를 단언.
- raw hex 적발: `Toast.tsx`·`ToastProvider.tsx`·`MuklogDetailRoute`(토스트 라인) 내 토스트 비주얼 관련 raw `#RRGGBB` 0건.

---

## 종합

| 분류 | 건수 |
|----|----|
| 통과 | 4/4 항목 |
| 불일치 | 0 |
| 근사 허용 | 0 |
| 미검증 | 0 |

**판정: ✅ 비주얼 완료(PASS).** 토스트 이관으로 비주얼 변화 없음이 정상이며, 킷 `.mk-toast`(위치·radius·인버스 배경·positive 초록·2.2초·✓·진입 애니메이션) 정합과 삭제/저장/위시 문구·tone 모두 보존됨. ui-publisher로 보낼 수정 요청 없음.
