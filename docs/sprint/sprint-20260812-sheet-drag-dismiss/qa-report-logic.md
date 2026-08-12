# QA Report — 로직·통합 정합성 (sheet-drag-dismiss)

> 작성: qa-logic-sheet-drag (2026-08-12). 범위 = 로직·통합·가드레일·TDD·컨벤션. **비주얼 충실도는 `qa-report-visual.md`(qa-visual) 담당.**
> 기준 문서: `plan.md`(개정 R2) · `dev-notes.md` · `docs/testing-strategy.md` · `docs/code-convention.md`.

## 0. 판정 요약

**로직 인수조건 AC1~AC17 전부 통과. F1·O1·O2 전건 수정 반영·재검증 완료. AC18(디바이스 스모크)만 미검증 — 사용자 실기기 판정 대기.**
**로직 측면에서 남은 차단 사유는 AC18 하나뿐이다.**

| 구분 | 건수 | 내용 |
|------|------|------|
| 통과 | AC1~AC17 (17건) | 아래 §2 표 |
| **해소** | **F1** | 중단된 닫힘이 `onClose`를 잘못 내보내던 결함 — dev가 `finished` 가드 + **D9** 회귀 테스트 반영, **재검증 통과**(§3-B) |
| **해소** | **O1·O2** | 값 단일출처를 고정하는 소스 참조 단언 추가됨 — **판별력 확인 완료**(§8) |
| 미검증 | AC18 | 스모크 S1~S16 전부 `☐` — 자동 테스트가 못 덮는 네이티브 협상. **S6가 최대 리스크** |
| 프로세스 | P1·P2 | 스펙 갱신과 QA 실행 구간 중첩(위반 아님, 재검증 완료) / 워킹트리에 하네스 산출물 혼입 |

**검증 실행 결과 (최종 상태 — F1 수정 반영 후)**

```
npm test          → 195 suites / 1913 tests, 전부 green
npm run typecheck → 0 error
Sheet.spec.tsx    → 48 tests green   (8 → 44 → 46 → 48로 증가)
git diff --numstat →  137/39  Sheet.tsx  ·  410/13  Sheet.spec.tsx
```

## 1. 뮤테이션 실험 고지 (프로세스)

dev는 소스 동결 상태였다. **테스트가 규칙을 실제로 격리하는지 확인하기 위해 `Sheet.tsx`에 일시적 뮤테이션 15종을 가했고, 매 실험 직후 원본으로 복구했다.** 검증 종료 시점에 baseline 체크섬 일치를 확인했다.

```
4cb8b438…  src/components/Sheet/Sheet.tsx      OK
a8c2ba06…  src/components/Sheet/Sheet.spec.tsx OK   (P1 반영 후 재baseline)

git diff --numstat  →  133/39  Sheet.tsx   ← dev-sheet-drag 최초 보고값과 정확히 일치(잔여물 0)
                       378/13  Sheet.spec.tsx
```

**⚠️ 방법론 지적 수용(리더 지시).** 본 QA는 뮤테이션을 **공유 트리의 실 소스에 직접** 가했다(매회 즉시 원복). 그 결과 Stop 훅 게이트가 전체 스위트를 돌릴 때 실험 중간 상태를 **2회 오탐**했다 — 무해했으나 낭비였다. dev-sheet-drag가 쓴 **격리 사본 방식**(대상 파일을 임시 경로에 복사 → 사본만 변형 → 측정 → 삭제)이 옳다. 다음 QA부터 적용한다. 본 리포트의 측정값은 전부 원복 + 전 스위트 green 재확인을 거쳤으므로 유효하다.

`Sheet.spec.tsx`는 **본 QA가 한 번도 쓰기 대상으로 삼지 않았다**(백업 복사만 수행). dev의 U1-j·U3-b 추가분은 위 체크섬으로 무손상 확인.

중단 확인용 임시 probe 파일(`SheetQaProbe.spec.tsx`)을 1회 생성해 F1을 재현한 뒤 **삭제 완료**(`src/components/Sheet/`에 `index.ts`·`Sheet.tsx`·`Sheet.spec.tsx`만 존재). git 작업은 읽기(`diff`·`status`·`show`·`numstat`)만 수행했다.

### 1-1. 뮤테이션 결과 전수

| # | 뮤테이션 | 결과 | 판정 |
|---|----------|------|------|
| M1 | **캡처 핸들러 `onMoveShouldSetPanResponderCapture: () => true` 삽입** | **D3·D3-b red**, 나머지 42 green | ✅ **planner 특별 요청 항목 — §4 참조** |
| M2 | `dy > 0` 절 제거 | 46 전부 green | ⚠️ 중복 절 확인(plan §6 E11에 무결함 명시 — §5) |
| M3 | 0 클램프 제거(`Math.max(dy,0)` → `dy`) | D4만 red | ✅ |
| M4 | 게이트의 `closingRef` 가드 제거 | D7만 red | ✅ |
| M5 | `requestClose`의 `closingRef` 가드 제거 | D7만 red | ✅ |
| M6 | **구 계약 복귀**(`dy>80 \|\| vy>0.5`) | U1-d·U1-e·U1-g·**U1-j**·상수단언 red | ✅ U1-j load-bearing 확인 |
| M7 | `SHEET_FLICK_MIN_DISTANCE = 0` | U1-d·U1-e·U3·**U3-b** red | ✅ U3-b load-bearing 확인 |
| M8 | `onPanResponderTerminationRequest` → `true` | D5만 red | ✅ |
| M9 | `onPanResponderTerminate` 스냅백 제거 | D5만 red | ✅ |
| M10 | 재오픈 오프셋 리셋 제거 | D8만 red | ✅ |
| M11 | `onClose`를 애니 시작 전에도 호출(1→2회) | D6·D6-b·D7 red | ✅ |
| M12 | 딤 `outputRange`를 리터럴 `[0.32, 0.1]`로 재기입 | **46 전부 green** | ⚠️ O1 |
| M13 | 판정 무시하고 항상 닫음 | D5-b만 red | ✅ |
| M14 | 게이트가 유틸 대신 자체 판정식 보유 | **46 전부 green** | ⚠️ O2 |
| M15 | `panHandlers`를 패널→핸들로 되돌림 | D1~D8 등 14건 red | ✅ 본체 회귀 방어 확인 |
| **M16** | **`finished` 가드 제거** — F1 수정 후 재검증, **격리 사본**에서 실행 | D9 시나리오 red(`Expected 0 / Received 1`), 해피패스 green | ✅ D9 load-bearing(§3-B) |
| **M17 (MA)** | `finished` 가드 제거 — **확장판 D9** 대상 재측정 | D9 본체 red | ✅ §3-C |
| **M18 (MB)** | `resetOffsetOnOpen`의 `closingRef` 해제 제거 | D9 **확장분**(게이트 true) red | ✅ §3-C — 리더 보강분 load-bearing |
| **M19 (MC)** | `outputRange` 리터럴 + 게이트 인라인 | O1·O2 구조 단언 red | ✅ §3-C·§8-B |

> M1~M15는 실 소스에서(1라운드), **M16~M19는 격리 사본에서** 실행했다. M17~M19의 사본은 `src/` **밖**(`<rootDir>/.qa-probe/`, spec 패턴 미매치 파일명)에 두어 `npm test`가 수집할 수 없게 했고 측정 후 디렉터리째 삭제했다. O1·O2 판별력은 파일을 변형하지 않고 소스 텍스트에 변형을 메모리상 적용해서도 교차 확인했다(§8-B).

## 2. 인수조건 대비 판정

| AC | 내용 | 근거 | 판정 |
|----|------|------|------|
| AC1 | `{dy:-100, vy:5}` → false | U1-g + **U1-j**(dy∈[−300,0]×vy∈[−5,5] 100조합) / M6에서 red | ✅ |
| AC2 | `{dy:10,vy:0.6}`→false, `{dy:40,vy:0.6}`→true | U1-c~f 경계 6행 / M7에서 red | ✅ |
| AC3 | 상수 10종 export + 리터럴 중복 0 | U3 / `Sheet.tsx` 숫자 전수 확인 — 남은 리터럴은 명명 상수 정의부, 구조적 `0`·`1`(`toValue:0`·`flex:1`), `theme.spacing[n]` 토큰 인덱스뿐 | ✅ |
| AC4 | panel에 responder 핸들러, handle엔 없음 | D1 / M15에서 red | ✅ |
| AC5 | `shouldStartSheetDrag` 진리표 + 컴포넌트는 호출만 | U1-b 6행(경계 `dy=4`·축경합 `dy=dx` 포함) + D2 4행 | ✅ (단일출처는 O2) |
| AC6 | 캡처 단계 미사용 (a)행동 (b)소스 | **D3(뮤테이션 M1로 load-bearing 입증) + D3-b** | ✅ **§4** |
| AC7 | terminationRequest=false, terminate 후 오프셋 0 | D5 / M8·M9에서 red | ✅ |
| AC8 | 딤 보간 양끝 정확값·중간 근사 | U2 5케이스 + 단조 비증가 불변식 | ✅ |
| AC9 | 딤 opacity가 `translateY` 보간이고 outputRange가 유틸 산출 | D4-b(실측 딤 값) + 코드 확인(`Sheet.tsx:175-182`) | ✅ (테스트 강제는 O1) |
| AC10 | backdrop 탭 onClose 1회, 기존 4케이스 무수정 | spec diff에 기존 4 컴포넌트 케이스 본문 삭제줄 0 + 접근성 단언 신설 | ✅ |
| AC11 | 닫힘 중 게이트 항상 false | D7 / M4에서 red | ✅ |
| AC12 | 닫힘 중 딤 탭이 onClose 추가 호출 안 함 | D7 / M5에서 red | ✅ |
| AC13 | dismiss 1회당 onClose 정확히 1회 | D6 / M11에서 red | ✅ |
| AC14 | 재오픈 시 translateY 0 리셋 | D8 / M10에서 red | ✅ |
| AC15 | 소비처 6개 디렉터리 diff 0줄 | `git diff --stat` 해당 경로 빈 출력. `<Sheet>` 사용처 8곳 전수 재확인 → 전부 diff 0 | ✅ |
| AC16 | `SheetProps` 시그니처 불변 + typecheck 0 | 타입 diff 0줄, `tsc --noEmit` 0 error | ✅ |
| AC17 | 스테일 주석 정정 | `Sheet.tsx:1-14` — "본문(장소검색 등) 스크롤" 삭제, 비캡처 정책 명문화. 파일 경로 주석 오류(`components/Sheet.tsx`)도 동반 수정 | ✅ |
| AC18 | 스모크 표 이관 + **실행 결과 기입** | dev-notes §7에 표는 이관됐으나 S1~S16 **전부 `☐`** | ⛔ **미검증** |

## 3. F1 — 중단된 닫힘 애니메이션이 `onClose`를 잘못 내보낸다 (수정 권고, 저~중)

**위치:** `src/components/Sheet/Sheet.tsx:145-154`

`Animated.timing(...).start(cb)`의 완료 콜백이 `finished` 플래그를 보지 않는다. RN은 애니메이션이 **중단**될 때도 콜백을 `{finished: false}`로 호출한다(`AnimatedValue.setValue()`가 `this._animation.stop()`을 호출 — `node_modules/react-native/Libraries/Animated/nodes/AnimatedValue.js`). 따라서 닫힘이 끝까지 가지 않았는데도 `onCloseRef.current()`가 실행된다.

**재현(임시 probe로 실측, 실행 후 삭제):** 드래그 dismiss 시작 → 200ms 애니메이션 중 50ms 시점에 부모가 `visible` false→true로 재오픈 → `resetOffsetOnOpen`의 `translateY.setValue(0)`이 진행 중이던 timing을 중단 → 완료 콜백 발화.

```
[probe] 재오픈 직후 onClose 호출횟수 = 1     ← 방금 연 시트가 즉시 닫으라는 통보를 받는다
[probe] 재오픈 직후 translateY = 0
[probe] 애니 소진 후 onClose 호출횟수 = 1
```

**영향:** 닫힘 애니메이션 200ms 창 안에서 같은 `Sheet` 인스턴스가 재오픈되는 경우에 한정된다. 현 소비처 8곳에서 이 창을 사용자가 열기는 어렵다(닫히는 동안 딤이 화면을 덮고 딤 탭·재터치는 `closingRef`로 막혀 있음). 다만 **부모가 외부 사유(네비게이션·언마운트·상태 변화)로 시트를 여닫는 경로에서는 재현 가능**하며, 증상은 "방금 연 시트가 즉시 닫힘"이라 원인 추적이 어렵다.

**수정안(1줄):**

```ts
}).start(({ finished }) => {
  if (!finished) return; // 중단된 닫힘(재오픈·언마운트)은 onClose를 내보내지 않는다
  onCloseRef.current();
  translateY.setValue(0);
  closingRef.current = false;
});
```

early-return이 상태를 굳히지 않는다는 점을 확인했다 — 중단 경로인 `resetOffsetOnOpen`이 콜백보다 **먼저** `closingRef.current = false`와 `translateY.setValue(0)`을 이미 수행한다(`Sheet.tsx:159-164`, 대입 순서상 `setValue`가 콜백을 유발하는 시점에 `closingRef`는 이미 false). 회귀 테스트는 위 probe 시나리오(닫힘 중 `visible` false→true rerender 후 `onClose` 호출 0회)를 D9로 추가하면 고정된다.

### 3-B. 수정 반영 및 재검증 — **해소 확인**

dev-sheet-drag가 리더의 상시 지시에 따라 즉시 반영했다(`Sheet.tsx` 133/39 → **137/39**). 적용된 코드는 제안과 동일하며 중단 경로의 근거까지 주석으로 남겼다.

```ts
}).start(({ finished }) => {
  // RN은 애니메이션이 중단될 때도 완료 콜백을 부른다(재오픈의 setValue가 stop을 유발).
  //   중단된 닫힘은 사용자가 시트를 닫은 게 아니므로 onClose를 내보내지 않는다.
  if (!finished) return;
  onCloseRef.current();
  translateY.setValue(0);
  closingRef.current = false;
});
```

**재검증 3축, 전부 통과:**

| 확인 | 방법 | 결과 |
|------|------|------|
| F1 해소 | **D9** 신설 — 닫힘 50ms 시점 재오픈 후 `onClose` 0회 + 애니 소진 후에도 0회 + `translateY` 0 | ✅ green |
| **해피패스 무손상**(이 수정의 진짜 리스크) | `finished` 가드가 정상 닫힘까지 막으면 D6·D6-b가 죽는다. jest fake-timer 환경에서 완료 콜백이 `finished: true`로 오는지 실측 | ✅ D6·D6-b green — `finished: true` 정상 전달 |
| D9 load-bearing | **격리 사본**(`SheetIso.tsx` = 현 소스에서 가드만 제거 + 전용 스펙)에서 D9 시나리오 재현 | ✅ **red** (`Expected 0 / Received 1`) — 가드 없으면 실제로 샌다. 같은 사본에서 해피패스는 green이라 D9가 가드만 격리함도 확인 |

격리 사본 2개는 측정 직후 삭제했고(`src/components/Sheet/`에 `index.ts`·`Sheet.tsx`·`Sheet.spec.tsx`만 잔존), 공유 트리의 `Sheet.tsx`는 이 재검증 과정에서 **한 번도 변형되지 않았다**(리더 지시 반영).

> ⚠️ 이 1라운드 사본은 `src/components/Sheet/` **안에** 만든 것이 실수였다(`SheetIso.spec.tsx`가 `**/*.spec.tsx`에 걸려 `npm test` 스위트 수를 늘릴 수 있었다). dev-sheet-drag가 지적했고 즉시 삭제했다. **2라운드부터는 `src/` 밖 + spec 패턴 미매치 파일명**으로 교정했다(§3-C).

### 3-C. 재검증 2라운드 — 확장판 D9 · 리더 보강 2건

1라운드 재검증 이후 dev가 **D9를 확장**하고(`Sheet.spec.tsx` 410/13 → **428/13**, 47 → **48**케이스) O1·O2 구조 단언을 추가했다. 확장분은 1라운드 측정 대상이 아니었으므로 **다시 측정했다.**

확장된 D9는 중단 후 꼬리 단언 2개가 붙었다 — 재오픈된 시트에서 `askToStartDrag(...)`가 `true`(= `closingRef`가 실제로 풀렸는지)이고, 이어서 다시 드래그로 닫으면 `onClose`가 **정확히 1회**(중단분을 세지 않음).

**격리 사본 방식(교정판):** `<rootDir>/.qa-probe/`(src 밖) + 파일명 `mutation.probe.tsx`(기본 `testMatch`의 `spec|test` 패턴에 걸리지 않음) → `npm test`가 구조적으로 수집할 수 없다. `moduleNameMapper`의 `^@/(.*)$ → <rootDir>/src/$1` 덕분에 src 밖에서도 임포트가 해석된다. 측정 후 `rm -rf .qa-probe`로 디렉터리째 삭제했다.

| 뮤테이션(격리 사본) | 기대 | 실측 |
|---------------------|------|------|
| **MA** — `if (!finished) return;` 제거 | D9 본체 red | ✅ red — `expect(onClose).not.toHaveBeenCalled()`에서 `Received number of calls: 1` |
| **MB** — `resetOffsetOnOpen`의 `closingRef.current = false` 제거 | D9 **확장분** red | ✅ red — `expect(askToStartDrag({dy:60}).grantedToPanel).toBe(true)`에서 `Received: false` |
| **MC** — `outputRange` 리터럴 복귀 + 게이트 판정식 인라인 | O1·O2 구조 단언 red | ✅ red — `outputRange` 정규식 불일치(jest가 첫 실패에서 멈춰 gate 단언은 §8-B에서 별도 확인) |

**세 뮤테이션이 각각 의도한 단언에서 정확히 걸린다.** 특히 MB는 리더가 요구한 "`closingRef` 해제 타이밍 일관성"이 장식이 아니라 실제 방어선임을 보여준다 — 중단 경로에서 `closingRef`를 안 풀면 재오픈된 시트가 영구히 드래그 불가 상태가 되고, 확장판 D9가 그 상태를 잡는다.

**재검증 2라운드 후 최종:** 195 suites / **1913 tests** green, `npm run typecheck` 0 error, 워킹트리 잔여물 0.

## 4. planner 특별 요청 — D3이 dedup 가드를 재고 있지 않은지 (해소)

plan §7-3·AC6-a의 우려는 **캡처 래퍼의 dedup 가드**(`PanResponder.js:451-456`, `_accountsForMovesUpTo === touchHistory.mostRecentTimeStamp`면 config와 무관하게 `false` 반환) 때문에 D3이 "캡처 부재"가 아니라 "가드 발동"을 측정할 수 있다는 것이었다. **뮤테이션으로 반증했다.**

`Sheet.tsx` config에 `onMoveShouldSetPanResponderCapture: () => true`를 삽입하고 실행한 결과:

```
✕ D3 — 캡처 단계로는 절대 가져가지 않는다(자식 ScrollView 우선)
    expect(capturedByPanel).toBe(false)
    Expected: false
    Received: true                    ← config가 실제로 호출됐다 = 가드가 막지 않았다
```

D3·D3-b **2건만** red, 나머지 42건 green. `capturedByPanel`이 `true`로 관측됐다는 것은 dedup 가드를 통과해 config 핸들러까지 도달했다는 직접 증거다. 원인은 spec의 `moveEvent`가 호출마다 `touchTimeStamp`를 증가시켜 `mostRecentTimeStamp`를 갱신하기 때문(`Sheet.spec.tsx:178-219`). **D3은 헛돌지 않으며 AC6-a는 load-bearing이다.** 소스 단언 D3-b가 이중 방어로 함께 있어 이 항목은 충분히 방어된다.

추가로 M15(`panHandlers`를 핸들로 되돌림)에서 D3을 포함한 14건이 red가 되는 것도 확인해, 부착 위치 자체가 테스트로 고정돼 있음을 검증했다.

## 5. dev 리더 판단 3건 재확인

**② `dy > 0` 죽은 조건 — 유지 결정에 이견 없음.**
독립 검증 결과 이 절은 *테스트 미도달*이 아니라 **논리적 항진**이다. `dy > 80`과 `dy > 24` 두 분기가 모두 `dy > 0`을 함의하므로 결과를 바꾸는 입력이 존재하지 않는다(M2에서 46 green). 다만 dev·planner가 이후 추가한 방어가 적절하다고 판단한다 — **U1-j**(행동 불변식: dy≤0 100조합 전부 false)는 M6(구 계약 복귀)에서 red가 되어 B1 회귀를 실제로 잡고, **U3-b**(`SHEET_FLICK_MIN_DISTANCE > 0`)는 M7에서 red가 되어 "실질 방어선이 사라지는 순간"을 알린다. 즉 `dy > 0`이 항진인 채로도 **B1 행동 자체는 테스트로 고정**됐다. plan §6 E11의 무결함 판정에 동의하며, **결함으로 분류하지 않는다.**

**③ 0 클램프 회귀 고정 — 확인.** `Sheet.tsx:132-134`의 `Math.max(gesture.dy, 0)`은 D4가 3단계(60 → −50 누적 10 → −100 누적 클램프 0)로 고정하고 있고, M3에서 D4만 red가 된다. "위로 끌 때 패널이 얼어붙던" 수정이 회귀 방어선을 갖췄다.

**① AC6 행동검증 대체 — §4에서 해소.**

## 6. 엣지케이스 교차검증

| 항목 | 확인 | 판정 |
|------|------|------|
| 닫힘 중 재터치 `onClose` 1회 | 게이트(`Sheet.tsx:129-130`)·`requestClose`(`:168-171`)·릴리스(`:139`) **3경로 모두** `closingRef` 가드. D7 + M4·M5·M11 | ✅ |
| terminate 복구 | `:136-137` — 요청 거절 + 스냅백. D5 + M8·M9 | ✅ |
| 재오픈 오프셋 리셋 | `:159-165` 명명 `useEffect`. D8 + M10 | ✅ |
| backdrop 탭 경로와의 상호작용 | 딤은 `Animated.createAnimatedComponent(Pressable)`로 **같은 노드**에 `testID`·`accessibilityRole="button"`·`accessibilityLabel="닫기"`·`onPress` 유지(`:189-195`). 기존 탭 테스트 + 접근성 단언 green (A1 보존) | ✅ |
| E4/E5 파괴적 시트 | 드래그는 `onClose`만 호출하고 danger 액션 경로를 만들지 않음 — 소비처 diff 0으로 구조적 보장 | ✅ |
| **제스처 상태 누수(신규 위험 점검)** | 패널이 이제 `ScrollView`의 **조상**이라, 리스트 스크롤 중에도 패널의 캡처 래퍼가 `gestureState.dy`를 누적한다. 다음 터치로 이월되면 미세 이동에도 게이트가 열릴 수 있어 확인함 → `onStartShouldSetResponderCapture`가 `touches.length === 1`일 때 `_initializeGestureState`로 **dx/dy를 0으로 리셋**(`PanResponder.js:433-437`, `_initializeGestureState` 실측). 새 단일터치마다 초기화되므로 누수 없음 | ✅ 비결함 |
| 멀티터치(E9) | 위 리셋이 `touches.length > 1`에선 생략됨 — plan E9가 허용 범위로 문서화한 그대로. S16으로 관찰 | ✅ 문서와 일치 |
| N1 네트워크·동시성·RLS·인증 | 해당 없음(§7 확인) | ✅ |

## 7. 가드레일 · 컨벤션

| 항목 | 결과 |
|------|------|
| `supabase/` diff | **0줄** (`git diff --stat -- supabase/` 빈 출력) |
| 신규 의존성 | **0** (`package.json`·`package-lock.json` diff 0줄) → Dev Client 재빌드 불필요 |
| 폴링·타이머·AppState | **0건** (`setInterval`/`setTimeout`/`AppState`/`requestAnimationFrame` 부재). 애니메이션은 `Animated`만 |
| Kakao / Supabase 호출 | **0건** — 순수 클라이언트 인터랙션 |
| AWS | 미사용(불변) |
| raw hex | **0건** — 색은 `theme.color.fg`·`surface`·`hairline`, 간격은 `theme.spacing[n]` |
| `useCallback`/`useMemo` | **0건** |
| `export function` 컴포넌트/훅 | **0건** (전부 화살표 const) |
| 인라인 `useEffect(() =>` | **0건** — `useEffect(resetOffsetOnOpen, [visible])` 명명 함수 |
| named-object 인자 | `shouldDismissSheet({dy,vy})`·`shouldStartSheetDrag({dy,dx})`·`resolveBackdropOpacity({dy})`·`snapPanelBack({translateY})` 전부 준수. `(_evt, gesture)`는 외부 API 콜백이라 예외 적용 |
| 파일명 = 대표 심볼 | `Sheet.tsx` → `Sheet` ✅ |
| rating-drag `Stars` 간섭 | 변경 파일에 `Stars` 없음(`git diff --name-only` = Sheet 2개 + 하네스 1개). 공유 모듈 0, 전 스위트 green으로 회귀 0 |

## 8. 관찰 (결함 아님 — 리팩터 회귀 미탐지)

**O1 — 딤 `outputRange` 단일출처가 테스트로 강제되지 않는다.** M12로 `outputRange: [0.32, 0.1]` 리터럴 재기입 시 46건 전부 green. 현 코드는 plan §7-2대로 유틸 호출로 산출돼 있어 **정상**이나, 미래에 누군가 리터럴로 되돌려도 테스트가 못 잡는다. 값이 동일해 행동 차이가 없으므로 낮은 우선순위. 필요하면 D3-b와 같은 소스 단언으로 고정 가능.

**O2 — 활성화 게이트의 유틸 위임이 테스트로 강제되지 않는다.** M14로 게이트에 판정식(`dy > 4 && …`)을 직접 인라인해도 46건 green. plan §7-3b가 요구하는 "호출만 하고 판정식 중복 보유 금지"는 현 코드가 준수하나(`Sheet.tsx:129-130`), 강제 수단은 코드리뷰뿐이다. O1과 동일한 성격·우선순위.

> O1·O2는 **plan이 요구한 계약을 현 구현이 충족**하고 있으므로 통과 판정을 바꾸지 않는다. 지적 대상은 코드가 아니라 테스트의 커버 범위다.

### 8-B. O1·O2 해소 — 소스 참조 단언 추가 (판별력 확인 완료)

dev가 D3-b와 같은 방식의 단언 1건을 추가해 두 항목을 함께 닫았다(`Sheet.spec.tsx:335-344`). 주석 제거 후 소스에서 `outputRange: [ … resolveBackdropOpacity(` 와 `shouldStartSheetDrag({` 참조를 확인한다.

**판별력을 직접 검증했다** — 파일을 변형하지 않고, 소스 텍스트에 M12·M14 변형을 메모리상에서 적용해 두 정규식의 반응만 측정했다:

| 입력 | `outputRange` 단언 | `gate` 단언 |
|------|--------------------|-------------|
| 원본(현재 소스) | PASS | PASS |
| M12 — `outputRange: [0.32, 0.1]` 리터럴 복귀 | **FAIL** ✅ | PASS |
| M14 — 게이트에 판정식 인라인 | PASS | **FAIL** ✅ |
| 게이트 호출부만 삭제(정의부는 잔존) | PASS | **FAIL** ✅ (정의부 `= ({`에 오탐하지 않음) |

두 관찰 모두 이제 회귀가 red로 드러난다. dev가 "구조 규약이라 동작으로 관측되지 않는다"는 성격을 주석에 정확히 적어둔 점도 적절하다 — 과결합 없이 참조만 고정했다.

## 9. 프로세스 지적

**P1 — QA 실행 구간과 스펙 갱신이 겹쳤다(절차 위반 아님 — 메시지 도달 지연).** 검증 착수(16:54) 후 `plan.md`가 16:55(R2), `Sheet.spec.tsx`가 17:01, `dev-notes.md`가 17:03에 갱신됐다. 초기 baseline 체크섬이 어긋나 뮤테이션 1차 결과(44 tests 기준)를 폐기하고 **재baseline 후 전 실험을 재실행**했다.

**dev-sheet-drag는 규칙대로 착수·완료를 모두 사전/직후 고지했고, 변경 범위(`Sheet.spec.tsx` only, 소스 무변경)도 정확했다** — 실제로 `Sheet.tsx`는 `133/39`로 최초 보고값과 동일함을 확인했다. 고지 메시지가 QA 실행 중에 도달해 반영이 늦었을 뿐이므로 **동결 위반으로 분류하지 않는다.** 추가분(U1-j·U3-b)은 가산적·타당하며 검증 결론에 영향이 없고, 오히려 §5의 `dy > 0` 판정을 뒷받침한다.

교훈은 QA 쪽에 있다: 장시간 측정 작업은 **착수 시 baseline 체크섬을 고지**하고, 측정 종료 시 재확인하는 절차를 기본으로 삼는다(이번에 그렇게 해서 오염을 잡아냈다).

**P2 — 워킹트리에 하네스 산출물이 섞여 있다.** `.claude/hooks/verifierGate.state.json`이 modified 상태다. 스프린트 산출물이 아니므로 **리더가 커밋할 때 스테이징에서 제외할지 판단**이 필요하다. (git 작업은 사용자 전담이라 본 QA는 읽기만 수행했다.)

## 10. 미검증 — AC18 디바이스 스모크 (사용자 판정 필요)

`dev-notes.md §7`의 S1~S16이 **전부 미기입(`☐`)** 이다. 자동 테스트는 합성 responder 이벤트까지만 검증하며, **실제 네이티브 터치 협상은 단 한 건도 덮지 못한다.** 통과로 처리하지 않고 미검증으로 분류한다.

우선순위:

1. **S6 (최대 리스크)** — `LogPickerSheet` 리스트 위 상하 스와이프에서 **리스트가 스크롤되고 시트는 안 내려가야** 한다. 비캡처 부착의 유일한 실증 경로이며, 실패 시 지도탭 위시 담기 흐름이 막힌다.
2. S9·S8 — `Pressable`(메뉴 행·날짜 셀) 위 탭/드래그 분기(termination 양보).
3. S13 — `DatePickerSheet` 날짜 그리드에서 드래그 dismiss 동작.
4. S10·S12 — 닫힘 중 재터치·재오픈 잔상(F1과 인접한 구간이므로 함께 관찰 권장).
5. 나머지 S1~S5·S7·S11·S14~S16.

## 11. 결론

**코드 측 로직 검증은 종결됐다. 남은 차단 사유는 AC18 하나뿐이다.**

AC1~AC17 전부 통과했고, 테스트가 규칙을 실제로 격리하는지 **뮤테이션 19종**으로 확인했다(planner가 우려한 D3 포함 — dedup 가드가 아니라 실제 캡처 부재를 측정 중임을 입증). 검증 중 발견한 **F1(중단된 닫힘의 spurious `onClose`)은 dev가 즉시 반영했고 재검증 2라운드를 통과**했다 — 1라운드에서 수정 자체와 해피패스 무손상을, 2라운드에서 확장판 D9와 리더 보강 2건(closingRef 해제 타이밍·O1·O2 구조 단언)이 각각 의도한 단언에서 red가 되는 것을 격리 사본으로 확인했다. 최종 195 suites / 1913 tests green, typecheck 0 error, 워킹트리 잔여물 0.

**AC18 스모크 미실행** — 사용자 실기기 판정 전에는 "로직 완료"로 표시하지 않는다. 자동 테스트는 합성 responder 이벤트까지만 검증하며 실제 네이티브 터치 협상은 한 건도 덮지 못한다. **S6(`LogPickerSheet` 리스트 스크롤 vs 시트 드래그)** 가 최우선이며, 실패 시 지도탭 위시 담기 흐름이 막힌다. F1을 건드린 구간과 인접한 **S10·S12**(닫힘 중 재터치 / 재오픈 잔상)도 이번 수정 검증을 겸해 함께 확인하기를 권한다.

P1·P2는 리더 판단 사항이다.
