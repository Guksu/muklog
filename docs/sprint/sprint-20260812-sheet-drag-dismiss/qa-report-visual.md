# QA Report — Visual (sheet-drag-dismiss)

> 검증: qa-visual-sheet-drag (2026-08-12) · 대상 커밋 범위: `HEAD`(6fefee6) ↔ 워킹트리
> 스프린트 성격상 **퍼블리싱 범위 0**(plan §4-C) → 이 리포트의 임무는 "신규 시안 재현"이 아니라 **비주얼 회귀 0 증명**이다.
> **판정: 통과 (비주얼 회귀 0).** 불일치 0건, 근사 허용 3건(전부 기존·문서화됨), 미검증 1건(디바이스 스모크).

---

## 0. 검증 방법 — 소스 대조가 아니라 **렌더 픽셀 대조**

`docs/design` 메모리의 교훈("QA가 렌더 픽셀을 안 봐서 레이아웃 버그를 놓침")을 반영해, 소스를 읽고 "안 바뀐 것 같다"로 끝내지 않았다.
`git show HEAD:src/components/Sheet/Sheet.tsx`로 **변경 전 컴포넌트를 그대로 되살려** 현재 컴포넌트와 **같은 테스트에서 나란히 렌더**하고, `StyleSheet.flatten`으로 4개 노드(딤·패널·핸들존·핸들바·제목)의 **최종 계산 스타일을 객체 단위로 `toEqual` 비교**했다.

- 결과: **완전 일치(diff 0)**. 아래 §1 표가 그 실측값이다.
- 임시 파일(`SheetBaselineTmp.tsx`·`VisualRegressionTmp.spec.tsx`)은 검증 후 **삭제 완료**(`git status`에 잔재 없음 확인).

---

## 1. 통과 — 렌더 실측값 (baseline ↔ 현재, 킷 대조)

킷: `.claude/skills/ui-design/templates/muklog/mk-ui.jsx:196-216` (`Sheet`) / 토큰 `tokens/aliases.css:40`, `templates/muklog/index.html:23-24`

| 노드 | 킷 값 | RN 렌더 실측 (baseline = 현재) | RN 파일:라인 | 판정 |
|------|-------|------------------------------|-------------|------|
| 딤 배경 | `background: rgba(20,12,8,.32)` (`mk-ui.jsx:203`) | `backgroundColor #2A2422`(`color.fg`) + **`opacity 0.32`**, `absoluteFill` | `Sheet.tsx:189-195`, `:238` | ✅ 정지 상태 값 동일 |
| 패널 배경 | `var(--mk-card)` = `#FFFFFF` (`index.html:23`) | `#FFFFFF`(`color.surface`) | `Sheet.tsx:203` | ✅ |
| 상단 라운드 | `border-radius: 26px 26px 0 0` (`mk-ui.jsx:207`) | `borderTopLeftRadius 26 / borderTopRightRadius 26` | `Sheet.tsx:241-242` (`SHEET_TOP_RADIUS`) | ✅ |
| 패널 그림자 | `box-shadow: 0 -10px 40px rgba(0,0,0,.18)` (`mk-ui.jsx:208`) | `theme.shadow.lg` (`#000`/0.12/r24/y8/elev6) | `Sheet.tsx:209` | ✅ 근사 — **킷이 시트에 한해 그림자를 명시**하므로 "헤어라인 원칙" 위반 아님 |
| 패널 좌우 패딩 | `padding: 10px 20px 34px` 중 20 | `paddingHorizontal 20`(`spacing[20]`) | `Sheet.tsx:204` | ✅ |
| 패널 상단 패딩 | 위 10 | `handleZone paddingTop 10`(`spacing[10]`) | `Sheet.tsx:216` | ✅ |
| 핸들바 | `40×5, border-radius 999, background var(--line)`, `margin 0 auto 14px` (`mk-ui.jsx:210`) | `width 40 / height 5 / borderRadius 5`(높이의 절반 이상 = 킷 999와 동일한 완전 pill) / `backgroundColor rgba(112,115,124,0.22)`, `alignItems center` + `paddingBottom 14`(`spacing[14]`) | `Sheet.tsx:214-219`, `:246-247` | ✅ `--line`은 `aliases.css:40`에서 22% 쿨그레이 = `color.hairline` **정확 일치** |
| 제목 | `700 18px/1.3 var(--font-sans)`, `color var(--mk-ink)` = `#2A2422`, `text-align center`, `margin 2px 0 16px` (`mk-ui.jsx:211`) | `fontSize 18 / lineHeight 23(=18×1.3) / SUIT-Bold / #2A2422 / textAlign center / marginBottom 16` | `Sheet.tsx:220-228`, `:248` | ✅ (`marginTop 2` 부재는 §3-③ 기존 갭) |
| 패널 최대 높이 | 킷은 디바이스 프레임 내에서 자람 | `maxHeight '88%'` | `Sheet.tsx:243` | ✅ 기존 번역 불변 |

**raw hex 전수 검사**: `grep -n "#[0-9a-fA-F]\{3,6\}" src/components/Sheet/Sheet.tsx` → **0건**. 색은 전부 `theme.color.*` 경유, 간격은 전부 `theme.spacing[*]` 경유(4px 그리드).

### 스타일 코드 변경 = 주석뿐
`Sheet.tsx` diff의 `StyleSheet.create` 블록 변경은 **주석 1줄**(`// 핸들 드래그 영역 …` → `// 핸들바를 가운데 두고 …`)이 전부다. 스타일 값 변경 0, 신규 시각 요소(하이라이트·오버레이·보더·그림자) 추가 0.

---

## 2. 통과 — 동적 비주얼 계약 (plan 상수 ↔ 구현)

정적 렌더가 불변인 상태에서, 새로 생긴 **모션**이 plan §3-B와 일치하는지 확인했다. 전부 일치(숫자 리터럴 재기입 0, 전부 명명 상수 경유).

| 항목 | plan §3-B | `Sheet.tsx` | 판정 |
|------|-----------|-------------|------|
| 딤 페이드 시작값 | `SHEET_BACKDROP_OPACITY 0.32` | `:52` = 0.32 | ✅ 킷과 동일(정지 상태) |
| 딤 페이드 종료값 | `SHEET_BACKDROP_OPACITY_MIN 0.10` | `:54` = `0.1` | ✅ |
| 페이드 구간 | `SHEET_BACKDROP_FADE_DISTANCE 240` | `:56` = 240 | ✅ 선형 + `extrapolate:'clamp'` |
| 딤 보간 배선 | `outputRange`를 유틸로 산출(값 단일 출처) | `:176-183` — `resolveBackdropOpacity({dy:0})` / `({dy: FADE_DISTANCE})` 호출 | ✅ 리터럴 이중화 없음 |
| 스냅백 | `{ bounciness: 0, speed: 14 }` spring | `:58` + `snapPanelBack` `:88-95` | ✅ 오버슈트 0 |
| 닫힘 | 200ms, `Easing.out(Easing.quad)` | `:50`·`:150-155` | ✅ (기존 180ms → 200ms, plan 승인된 변경) |
| 닫힘 이동거리 | `SHEET_DISMISS_TRANSLATE 700` | `:48` | ✅ 기존값 유지 |

**렌더 단언으로도 확인**: `Sheet.spec.tsx:331`이 드래그 전 딤 실측 opacity를 `SHEET_BACKDROP_OPACITY`(0.32)로 단언한다 — 정지 화면이 baseline과 같음을 테스트가 상시 고정한다. 44케이스 green.

### 관찰(결함 아님) — 닫힘 중 딤도 함께 옅어진다
딤 opacity가 `translateY`에 물려 있어, 닫힘 애니메이션(0→700) 동안 딤이 240px 지점까지 0.32→0.10으로 옅어진 뒤 언마운트된다. 변경 전에는 0.32를 유지하다 사라졌다.
→ **킷은 닫힘 연출을 정의하지 않으며**(`if (!open) return null`), 패널 퇴장과 딤 감쇠가 함께 가는 쪽이 드래그 추종과 일관된다. **허용된 RN 모션 확장**으로 통과 처리. 사용자가 "닫힐 때 딤이 너무 빨리 옅어진다"고 느끼면 `SHEET_BACKDROP_FADE_DISTANCE`가 아니라 별도 닫힘 전용 보간이 필요하다는 점만 기록해 둔다.

---

## 3. 근사 허용 (전부 **기존** 번역 — 이번 스프린트가 만든 차이 아님)

| # | 킷 | RN | 사유 | 상태 |
|---|-----|-----|------|------|
| ① | 딤 `rgba(20,12,8,.32)` | `color.fg(#2A2422)` + opacity 0.32 | 토큰에 `(20,12,8)` 웜 잉크가 없어 가장 가까운 `fg`로 근사. 헤더 주석에 사유 명시(`Sheet.tsx:12`) | 기존 유지 |
| ② | 패널 하단 패딩 `34px` | `insets.bottom + spacing[20]` | 홈 인디케이터 침범 방지 위해 safe-area로 번역. 노치 기기 20+34=54, 비노치 20 | 기존 유지(`Sheet.tsx:205-206`에 사유 주석) |
| ③ | 제목 `margin: 2px 0 16px` | `marginBottom 16`만 (상단 2 없음) | 2px 갭. 핸들존 `paddingBottom 14`가 이미 상단 여백을 만들어 체감 차 미미 | **기존 갭** — 이번 변경과 무관, 수정 대상 아님 |

---

## 4. Out-of-scope 결정 무변경 확인

| 항목 | 확인 |
|------|------|
| 킷 진입 애니메이션 `mkSlideUp .26s`(`mk-ui.jsx:208`) 부재 | `Modal animationType="none"`이 **그대로 유지**됐다(`Sheet.tsx:187`). 그 선택 사유를 적은 `:185-186` 주석도 무변경. `ui-fidelity-audit`의 "시트→시트 전환 잔상 제거" 결정을 이번 변경이 **건드리지 않았다** ✅ |
| 킷 딤 진입 `mkFade .2s`(`mk-ui.jsx:204`) 부재 | 위와 같은 결정에 딸린 기존 갭. 이번 diff에서 변화 없음 ✅ |
| 킷 키보드 대응 `marginBottom: kb ? KB_HEIGHT : 0`(`mk-ui.jsx:209`) 부재 | Sheet 소비처에 `TextInput` 0개(plan §6 K1). 이번 변경 없음 ✅ |

---

## 5. 소비처 비주얼 전달 경로 — diff 0 확인

```
git diff --stat -- src/navigation/AddSheet/ src/components/DatePickerSheet/ \
  src/features/map/components/LogPickerSheet/ src/features/profile/DeleteAccountSheet/ \
  src/features/room/LeaveLogSheets/ src/navigation/screens/MuklogDetailScreen/
→ (빈 출력 = 변경 0줄)
```

워킹트리 전체 변경도 `Sheet.tsx` + `Sheet.spec.tsx` + 훅 상태파일 3개뿐. `SheetProps` 시그니처 불변 → **8개 소비처가 시트에 넘기는 비주얼(제목·children)의 렌더 경로가 전혀 바뀌지 않았다.** testID 3종(`sheet-backdrop`/`sheet-panel`/`sheet-handle`)도 전부 같은 노드에 유지됐고, 특히 딤을 `Animated.createAnimatedComponent(Pressable)`로 감싸면서 `accessibilityRole="button"`·`accessibilityLabel="닫기"`·`onPress`가 **testID와 같은 노드에 남아** 있다(`Sheet.tsx:189-195`) — 스크린리더의 유일한 닫기 경로 보존 ✅.

기존 spec 4케이스(visible 토글·title/children·딤 탭·패널 탭)는 **삭제·수정 0**(spec diff의 제거 라인 13줄 전부가 구 `shouldDismissSheet` 진리표 블록). 계약 변경 1건은 plan §3-C가 사전 승인한 것.

---

## 6. 미검증 (통과 처리 아님)

| 항목 | 사유 | 이관처 |
|------|------|--------|
| 실제 드래그의 **체감 부드러움**(프레임 드랍·딤 페이드 자연스러움·스냅백 탄성) | `useNativeDriver:false` JS 스레드 애니메이션은 jsdom/jest에서 프레임을 재현할 수 없다. 렌더 픽셀은 검증했으나 **모션 품질은 디바이스에서만 보인다** | dev-notes §스모크 **S1·S2·S3·S10** — 사용자 판정 |
| 핸들바 터치 타깃 체감(패널 전체 드래그 전환 후 헤더 잡기) | 네이티브 responder 협상 | 스모크 **S6·S7** |

두 항목 모두 **비주얼 정적 충실도와는 독립**이며, 이번 리포트의 "회귀 0" 결론을 뒤집지 않는다.

---

## 7. 결론

**비주얼 회귀 0 — 통과.** 렌더 계산 스타일이 변경 전과 **객체 단위로 완전 일치**하고(§0·§1), 킷 `mk-ui.jsx:196-216`의 핸들바 40×5·`--line`·딤 0.32·라운드 26·패딩 10/20 대조도 전부 정합했다. 새로 생긴 것은 정지 화면을 건드리지 않는 **모션뿐**이며 plan 상수와 1:1 일치한다. raw hex 0건, 토큰 경유 100%.

→ **`ui-publisher`에게 라우팅할 이슈 없음.** 이번 스프린트는 비주얼 관점에서 developer 단독 완료가 맞았다(plan §4-C 판단이 옳았음을 실측으로 확인).
→ 남은 게이트는 디바이스 스모크(모션 체감)뿐이며 이는 사용자 판정 항목이다.
