# Dev Notes — 메모 입력 최대 높이 (sprint-20260812-memo-max-height)

> 구현 단일 출처: 같은 폴더 `plan.md`. 본 문서는 "무엇을 어떻게 배선했는가" + QA 교차검증용 생산자↔소비자 매핑.
> 상태: **구현 완료(T1~T8) · `npm test` 196 suites / 1929 tests green · `npm run typecheck` 0 에러.**
> 이후 qa 검증 동안 **소스 동결**. 수정 요청이 오면 착수 전에 qa에 통지한다.

---

## 1. 변경 파일

| 파일 | 변경 | 라인 증감 | 내용 |
|------|------|----------|------|
| `src/features/muklog/MuklogEditor/memoBoxHeight.ts` | **신설** | +28 | `MEMO_INPUT_LINES = 4` + 순수 유틸 `memoBoxHeight({ lineHeight, lines, paddingVertical, borderWidth })` |
| `src/features/muklog/MuklogEditor/memoBoxHeight.spec.ts` | **신설** | +28 | U1~U5 |
| `src/theme/tokens/tokens.ts` | 수정 | +2 | `typography.memoInput` 신규 키 1개 (기존 토큰 수정 0) |
| `src/theme/tokens/tokens.spec.ts` | 수정 | +20 | U6·U7 + 기존 본문 토큰 회귀 단언 (기존 케이스 무수정, append만) |
| `src/features/muklog/MuklogEditor/MuklogEditor.tsx` | 수정 | +18 / −4 | `memoBox` 인라인 스타일 신설, 메모 TextInput 배선, `numberOfLines` 제거, `styles.memo`에서 `minHeight: 96` 제거 |
| `src/features/muklog/MuklogEditor/MuklogEditor.spec.tsx` | 수정 | +97 | S1~S8 append (기존 케이스 **한 줄도 수정 없음** — import 2줄만 추가) |

**Out-of-scope 파일 diff 0 확인**: `MuklogDetailScreen.tsx`(② memoBody 표시) · `MuklogCard.tsx`(③ numberOfLines 2) · `validate.ts`(MEMO_MIN_LENGTH) · `types.ts` · `useCreateMuklog` · `useUpdateMuklog` · `useMuklog` · `supabase/` 전체 — `git status`에 미등장.

---

## 2. 계약 shape

### 2-1. 신규 타이포 토큰 (`src/theme/tokens/tokens.ts:238`)

```ts
memoInput: makeTypography({ size: 15, ratio: 1.6, family: 'SUIT-Medium' })
// → { fontSize: 15, lineHeight: 24, fontFamily: 'SUIT-Medium' }
```

킷 `lk.textarea`(`.claude/skills/ui-design/templates/muklog/mk-log.jsx:645`) `font: "500 15px/1.6"` 번역.
바로 위 `memoBody`(15/1.7 → lh **26**, 상세 표시용)와 **별개 키**이며 memoBody는 값 불변(U7이 단언).

### 2-2. 순수 유틸 (`src/features/muklog/MuklogEditor/memoBoxHeight.ts`)

```ts
export const MEMO_INPUT_LINES = 4;
export const memoBoxHeight = ({ lineHeight, lines, paddingVertical, borderWidth }: {
  lineHeight: number; lines: number; paddingVertical: number; borderWidth: number;
}): number => lineHeight * lines + paddingVertical * 2 + borderWidth * 2;
```

RN box model(`height`가 padding·border 포함)을 그대로 식으로 옮긴 것. 예외를 던지지 않고 퇴화 입력(0)도 산술 결과를 반환한다(U4).

### 2-3. 화면 배선 (`MuklogEditor.tsx`)

```ts
const memoBoxSize = memoBoxHeight({
  lineHeight: theme.typography.memoInput.lineHeight,   // 24
  lines: MEMO_INPUT_LINES,                             // 4
  paddingVertical: theme.spacing[14],                  // 14  ← fieldInput.paddingVertical과 동일 출처
  borderWidth: StyleSheet.hairlineWidth,               // ← styles.input.borderWidth와 동일 출처
});
const memoBox = { ...theme.typography.memoInput, minHeight: memoBoxSize, maxHeight: memoBoxSize };
// style={[styles.input, styles.memo, fieldInput, memoBox]}
```

- `minHeight === maxHeight`(킷 `rows={4}` + `resize:none`) → 콘텐츠가 늘어도 박스 높이 불변, 초과분은 TextInput 내부 스크롤.
- `scrollEnabled`는 **명시하지 않음**(RN multiline 기본 `true`) — plan §4-2 결정 그대로.
- `textAlignVertical: 'top'` 유지(Android 상단 정렬), `styles.memo`에는 이제 이 한 줄만 남는다.
- `numberOfLines={4}` prop **제거** — 높이 계약의 단일 출처를 `memoBoxHeight`로 일원화.
- 하드코딩 125 없음. 화면·테스트 모두 유틸을 호출해 값을 얻는다.

**실측 높이**: hairline 0.5(=@2x, jest 환경 `PixelRatio.get() === 2`) 기준 **125**.
디바이스 픽셀비에 따라 hairline이 달라져 @3x에서는 `24×4 + 28 + 2×(1/3) ≈ 124.67`, Android(hairline≈1)에서는 최대 126까지 나온다 — 계약은 "lineHeight×4 + padding + border"이고 상수 125가 아니다(U2가 이 변주를 고정).

---

## 3. 생산자 ↔ 소비자 매핑 (qa 교차검증용)

| # | 생산자 | 소비자 | 검증 포인트 |
|---|--------|--------|------------|
| 1 | `typography.memoInput`(tokens.ts:238) | `MuklogEditor.tsx` `memoBox` 스프레드 → 메모 TextInput 스타일 | 렌더 스타일의 `fontSize 15 / lineHeight 24 / fontFamily SUIT-Medium` (S2). **신규 키라 기존 소비처 영향 0** — `memoBody`·`body`·`bodySm`·`fieldLabel` 실값 회귀 단언(tokens.spec.ts 신규 describe) |
| 2 | `memoBoxHeight` + `MEMO_INPUT_LINES`(memoBoxHeight.ts) | `MuklogEditor.tsx:memoBoxSize` → `minHeight`·`maxHeight` | 화면이 유틸을 실제 호출(하드코딩 금지), 인자 4개가 스타일 적용값과 **같은 출처**인지: `theme.typography.memoInput.lineHeight` / `MEMO_INPUT_LINES` / `theme.spacing[14]`(= `fieldInput.paddingVertical`) / `StyleSheet.hairlineWidth`(= `styles.input.borderWidth`). S1·S4가 `minHeight === maxHeight === memoBoxHeight(...)` 단언 |
| 3 | 메모 입력 `onChangeText` → `memo` state | `handleSave` → `createMuklog({ input })` / `onSubmit({ input })` | S5: 500자 입력 → payload `memo.length === 500`, 전문 일치. `maxLength={MEMO_MAX}`(500) 불변(S3) |
| 4 | `MEMO_MIN_LENGTH`(validate.ts, 5) | `memoLongEnough` → `canSave` + `memo-hint` 톤 | S6 + 기존 케이스(spec:74·82) 무수정 통과 — 저장 게이팅 회귀 0 |
| 5 | `MuklogEditSubmitInput.memo` | `useUpdateMuklog` / `useCreateMuklog` → `muklogs.memo text` | 타입·시그니처 **diff 0**(파일 미변경). DDL·RLS·Edge Function 0건 |
| 6 | `initial.memo`(편집 프리필) | 메모 TextInput `value` | S7: 400자 프리필이 잘리지 않고 전문 유지 + 박스는 여전히 고정 높이 |
| 7 | 메모 전용 `memoBox` 스타일 | 장소명 TextInput(`styles.input` + `fieldInput`) | S8: 장소명 입력에 `minHeight`/`maxHeight` 누출 0 |

---

## 4. 테스트 결과

- 신규: **U1~U5**(memoBoxHeight.spec.ts 5건) · **U6~U7 + 기존 토큰 회귀**(tokens.spec.ts 3건) · **S1~S8**(MuklogEditor.spec.tsx 8건).
- 전체: `npm test` → **196 suites / 1929 tests, 전부 통과**. `npm run typecheck`(tsc --noEmit) → **0 에러**.
- 기존 `MuklogEditor.spec.tsx` 케이스는 **한 줄도 수정하지 않았다**(계약 위반 신호 없음). 추가한 것은 상단 import 2줄 + 말미 describe 1개뿐.
- **뮤테이션 표본(격리 사본)**: 프로젝트 밖 임시 경로에 사본을 만들어 ① `lineHeight × lines` → `+`, ② padding 한쪽만, ③ border 누락, ④ ratio 1.6 → 1.7(memoBody 오용), ⑤ lines 3/5 다섯 가지 변형이 모두 계약 수치(125 / lh 24)를 벗어남을 확인 → U1·S1·S2가 변형을 잡아낸다. **측정 직후 사본 삭제 완료**(실 소스 변형 0, `git status`에 잔존물 없음).

**RNTL 한계(단언 불가 영역)**: 실제 렌더 픽셀 높이, 내부 스크롤 제스처, 캐럿 추적, 키보드 상호작용 — 레이아웃을 계산하지 않으므로 아래 스모크로 이월한다.

---

## 5. 디바이스 스모크 체크리스트 (사용자 확인 대기)

> 메모리 *qa-layout-blind-spot*(캘린더 토요일 열 wrap 선례) — 레이아웃 무거운 변경은 디바이스 확인이 필수다.
> 아래는 **에디터 진입 → 메모 필드**에서만 확인하면 된다.

- [ ] **iOS** 메모에 10줄 입력 → 박스 높이 불변, 아래 "방문일" 행이 밀리지 않음, 타이핑 중 캐럿이 항상 보임.
- [ ] **iOS** 정확히 4줄 입력 → 4번째 줄이 온전히 보임(받침·디센더 잘림 0) ← plan E2 / R3.
- [ ] **Android** 위 2건 동일 + **첫 줄 상단 위치가 어긋나지 않는지**(multiline + 명시 `lineHeight` 알려진 이슈, R2).
      → 어긋나면 fallback: `memoBox`에서 `lineHeight`만 제거하고 높이 계약은 유지(줄 수가 정확히 4가 아닐 수 있음을 기록). **임의 선반영하지 않았다 — 관측 후 결정.**
      → **4번째 줄 하단이 잘리면** 1순위 후보는 `memoBox`에 `includeFontPadding: false`(Android 기본 true라 폰트 메트릭 여분 패딩이 `lineHeight × lines` 식 밖에 붙음 — 선례 `MuklogDetailScreen.tsx:620`·`AppMark.tsx:117`), 2순위가 R3 여유 2px. (qa-logic 보강, 관측 후 적용)
- [ ] **Android** 메모 내부를 손가락으로 드래그 → 내부 스크롤 되는지 / 부모 `ScrollView`가 가로채는지 관측(E9 / R1).
      최소 보장선은 "타이핑 중 캐럿 자동 추적". 손가락 스크롤 실패 시 후속 스프린트에서 부모 스크롤 양보 검토.
- [ ] **양 플랫폼** 편집 모드로 500자 메모 진입 → 전문 스크롤 접근 가능, 저장 후 전문 보존(E7).
- [ ] **양 플랫폼** 시스템 폰트 크게 → 글자가 커져 보이는 줄이 4줄 미만이어도 **잘림 없이** 스크롤로 전부 접근 가능(E10, 허용 기준).
- [ ] **양 플랫폼** 메모 포커스 시 키보드가 입력 영역을 가리지 않음(E8) — 고정 높이로 **덜 밀리는 방향**이어야 하고 악화되면 안 됨.

---

## 6. 미완 / 이월

- **FLAG-A(planner 제기) 미해결**: 사용자가 실제로 의도한 지점이 ②(상세화면 메모 표시)였다면 킷에 접기·더보기 근거가 없어 신규 UI 창작이 필요 → ui-publisher 범위의 별도 스프린트. 본 스프린트는 킷 근거가 확실한 ①만 다뤘고 ②는 diff 0이다.
- **R2/R3 대응 보류**: Android 첫 줄 위치·4번째 줄 1px 잘림은 스모크 관측 전 추측 구현하지 않았다(plan 지시).
- **범위 밖(기록만)**: 메모 입력의 보더/라운드가 킷(`border 1.5` / `radius 16`)과 다르게 현행 `hairlineWidth` + `radius.control(14)`로 남아 있다. 이는 **전 입력 공통 이슈**라 plan §3에서 별도 퍼블리싱 스프린트로 분리됨 — 이번에 건드리지 않았다.
- **비용**: 네트워크·DB·Storage 호출 증분 **0**(순수 클라이언트 스타일·상수 변경). 마이그레이션 0건, AWS 미사용.
- **git 작업 0건**(커밋·푸시·브랜치 전부 사용자 몫).
