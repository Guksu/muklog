# QA Report — Logic / Integration (sprint-20260620-editor-fidelity)

**검증자:** qa-logic · **일자:** 2026-06-20 · **범위:** 로직·통합 정합성·TDD·컨벤션 (비주얼 제외, qa-visual 담당)
**종합 판정: PASS** — AC1~AC4 전부 통과, 회귀 0, 종료기준(test·tsc) 직접 재확인 완료.

---

## 1. 경계면 교차검증 — 토스트 배선 (AC1) · PASS

생산자 `MuklogEditor.handleSave` ↔ 소비자 `useToast`/`<Toast>` 양쪽을 같이 읽어 대조.

| 경로 | 생산자 | 소비자 | 판정 |
|------|--------|--------|------|
| 작성 성공 | `MuklogEditor.tsx:374` `showToast({ message: SAVE_TOAST_CREATE, tone: 'positive' })` (`await createMuklog` resolve 직후, `try` 내부) | `useToast.show` (`useToast.ts:18`) → `<Toast>` (`MuklogEditor.tsx:626`) | ✅ |
| 편집 성공 | `MuklogEditor.tsx:346` `showToast({ message: SAVE_TOAST_EDIT, tone: 'positive' })` (`await onSubmit` resolve 직후, `try` 내부) | 동일 | ✅ |

- **성공 시에만 도달**: 작성·편집 모두 `showToast`가 `await …` **이후·`onSaved()` 이전**, `try` 블록 안에 위치(`:344-347`, `:371-375`). reject 시 제어가 `catch`(`:348-350`, `:376-378`)로 빠져 `showToast` 미도달 — 빈 catch라 기존 인라인 에러(`createError`/`submitError`)가 `:619-623`에서 그대로 표시됨. **실패 시 토스트 미도달 + 기존 에러 유지** 계약 일치.
- **신규/편집 분기**: `isEdit = initial !== undefined` (`:174`)로 `handleSave`가 두 분기로 갈리고, 각 분기에 올바른 상수 배선 — create→`SAVE_TOAST_CREATE`('맛집을 기록했어요! 🍽️', `:70`), edit→`SAVE_TOAST_EDIT`('기록을 수정했어요', `:71`). 카피·tone 계약(dev-notes 표)과 일치.
- **화면 전환 충돌 없음**: `showToast()` → `onSaved()` 순서(`:346-347`, `:374-375`). 토스트 `<Toast>`는 에디터 `Screen` 하단 플로팅(`:626`, host `position:absolute`)이라 `onSaved`(컨테이너 goBack) 직전 화면에서 표시. 컨테이너(`MuklogEditorRoute`) 무변경 — 에디터가 토스트를 자체 소유. 계약 정합.
- **계약 shape 정합**: `show({ message, tone })` 인자형(`useToast.ts:18`)과 호출 인자(`{ message, tone: 'positive' }`)·`tone:'positive'`(`Toast.tsx:14` `ToastTone`) 일치, snake/camel 변환 이슈 없음(순수 클라이언트 상태).

## 2. 회귀 불변 가드 (AC4) · PASS

- **`canSave` 불변**: `MuklogEditor.tsx:318-319` `memoLongEnough(메모 trim ≥ MEMO_MIN_LENGTH) && placeName.trim().length>0 && !loading` — 메모 5자 필수 로직 그대로. 토스트/별점텍스트 추가가 게이팅 미접촉.
- **카테고리 8종 칩 불변**: `:511-538` `MUKLOG_CATEGORY_KEYS.map` 수동선택 필드 유지(자동결정 미도입). 기존 테스트(`:131-135`, `:328-346`) green.
- **저장 payload 불변**: `createMuklog`/`onSubmit` input shape(`:326-343`, `:355-370`) 그대로 — 토스트는 payload 무관 부수효과(성공 후 show), 별점 보조텍스트는 display-only. 기존 payload 단언 테스트(`:101-109`, `:305-326`, `:494-526`, `:752-768`) 전부 green.
- **별점 0 허용 그대로**: `:563-565` 보조텍스트는 `rating` 표시만(`rating>0 ? toFixed(1) : '어땠어요?'`), `rating` state·저장 로직(`:186`, payload `rating`) 미접촉. rating 0 저장 가능 불변.

## 3. 별점 보조 텍스트 (AC2) · PASS · 검색 카피 (AC3) · PASS

- **AC2**: `:563-565` `<Text variant="ratingNum" color={rating>0 ? 'fg' : 'fgAssistive'}>{rating>0 ? rating.toFixed(1) : '어땠어요?'}</Text>`. 선택=fg / 미선택=fgAssistive, `ratingRow` gap 12(`:639`). 색 토큰 경유(raw 0). 순수 표시 — 분기 로직 정확.
- **AC3**: `:489-491` 미선택 searchBtn 라벨 `'맛집 이름을 검색해요'`. 구 카피 `'장소 검색 (카카오)'` grep 부재 확인.

## 4. TDD — 신규 6테스트 load-bearing (AC1~AC3) · PASS

신규 describe `editor-fidelity` (`:641-708`) 6테스트가 인수조건과 1:1 대응:
- AC1: 작성 토스트 노출(`:643`)·편집 토스트 노출(`:653`)·실패 미노출(`:664`, 두 카피 모두 `queryByText(...).toBeNull()`).
- AC2: 미선택 '어땠어요?'(`:683`)·선택 '4.0' + 미선택 카피 소멸(`:688`).
- AC3: 검색 카피 '맛집 이름을 검색해요' 노출 + 구 카피 부재(`:696`).

**뮤테이션 사고실험(load-bearing 확인)**:
- `showToast`를 `await` 앞으로 이동하거나 `catch`로 옮기면 → AC1 실패-미노출 테스트(`:664-680`)가 red(reject 후에도 토스트 노출되므로 `toBeNull` 깨짐). ✅ load-bearing.
- `rating>0` 분기를 항상 `toFixed(1)`로 바꾸면 → 미선택 '어땠어요?' 테스트(`:683`)가 '0.0' 렌더로 red. ✅
- 검색 카피 상수를 구문구로 되돌리면 → AC3 `queryByText('장소 검색 (카카오)').toBeNull()`이 아니라 `getByText('맛집 이름을 검색해요')`가 red. ✅
- 단위 경계 준수: `useCreateMuklog` 모킹(`:11`), expo-image-picker 모킹(`:14`) — 외부 SDK/훅 모킹, 화면 동작만 RN Testing Library로 검증. 적정.

## 5. 종료기준 — 직접 실행 재확인 · PASS

```
$ npx jest src/features/muklog/MuklogEditor.spec.tsx
  Test Suites: 1 passed, 1 total
  Tests:       42 passed, 42 total   (신규 6 + 기존 36, 회귀 0)

$ npm test
  Test Suites: 139 passed, 139 total
  Tests:       1265 passed, 1265 total

$ npx tsc --noEmit
  exit 0 (타입 에러 0)
```
dev-notes 기재치(42 / 139·1265 / exit 0)와 정확히 일치.

## 6. 제외 항목·코드 품질·시크릿 · PASS

- **영상 카피 제외 확인**: `grep '2초 영상|🎬|영상'` → 부재. plan 제외 사유(RN 영상 기능 미존재) 준수.
- **저장조건·카테고리 미변경 확인**: §2 회귀 가드로 입증.
- **코드 품질**: editor에 raw hex 0(`grep '#[0-9A-Fa-f]{3,6}'` 부재) — 색·radius·spacing 모두 `theme` 토큰 경유. `ratingRow` gap만 리터럴 12(킷 gap, 기존 패턴과 동일 — 경미, 비주얼 영역).
- **컨벤션**: `useCallback`/`useMemo` 0건, `export function`(컴포넌트/훅) 0건, 인라인 `useEffect(() =>` 0건(`Toast.tsx`의 `animateIn`/`autoHide`, MuklogEditor `syncFromSelectedPlace` 모두 명명 함수), enum-style 상수(`SAVE_TOAST_CREATE/EDIT`) 사용. 파일명=심볼명 일치.
- **시크릿**: .env·키 미열람.

---

## 미검증 (사용자 영역 — 통과 처리 아님)
- 디바이스 스모크: 토스트 표시 타이밍·키보드 겹침, goBack 전환과 토스트 잔상의 실기기 시각 동작(plan §리스크 명시). 단위 경계 밖이라 본 QA 범위 외.

## 종합
모든 로직 인수조건(AC1~AC4) **통과**, 경계면(handleSave↔useToast↔Toast) 계약 정합, 회귀 0, 신규 테스트 load-bearing, 종료기준 직접 재확인 완료. **로직·통합 관점 스프린트 완료 가능.**
