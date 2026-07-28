# UI Spec: expo-updates OTA (T7 — `OtaReadyDialog`)

> 담당: ui-publisher. 범위는 **T7 하나**(`src/features/ota/OtaReadyDialog/`). 배선(`OtaUpdateGate`·`App.tsx`·훅)은 developer(T8).
> 단일 출처: `plan.md` §3.6·§4.3·§5 T7 · `docs/code-convention.md` · 킷 `templates/muklog`(= `.claude/skills/ui-design/templates/muklog/`).
> 검증 기준 문서 — qa-visual은 이 문서의 §2 매핑표를 킷 대신 대조 기준으로 쓴다.

---

## 1. 킷 비종속 사유 (qa-visual 필독)

킷 `templates/muklog`에는 **OTA/업데이트 안내 시안이 없다.** 킷 `*.jsx` 전수 grep("업데이트"·"Update"·"재시작"·"새 버전") 결과 **매치 0건** — 있는 것은 범용 확인 다이얼로그 셸인 `RenameDialog`(`mk-extra.jsx:24-64`)뿐이다.

따라서 **선행 스프린트가 확립한 선례를 그대로 따른다**:

| 단계 | 컴포넌트 | 근거 |
|---|---|---|
| 킷 원본 | `RenameDialog`(`mk-extra.jsx:24-64`) | 딤 `rgba(20,12,8,.34)`(`:33`) + 카드 84%/max320·radius 20·`0 20px 50px rgba(0,0,0,.28)`(`:35-37`) + 본문 `20px 18px 16px`(`:39`) + 상단 hairline 2버튼 행 `padding 14`·divider 1(`:56-59`) |
| 1차 파생 | `RenameDialog.tsx`(RN) | 킷 verbatim 번역(입력형) |
| 2차 파생 | `UpdateSuggestModal.tsx` (`sprint-20260702-app-version-gate` T9) | 셸만 승계한 **"입력 없는 확인형"**. 킷 비종속 신설 선례 확립 |
| **3차 파생(본 스프린트)** | **`OtaReadyDialog.tsx`** | `UpdateSuggestModal`의 셸을 **값까지 그대로** 승계. 문구·콜백만 다름 |

**qa-visual 대조 기준: 킷이 아니라 `src/features/appVersion/UpdateSuggestModal/UpdateSuggestModal.tsx`다.** 두 파일의 셸 코드가 라인 단위로 대응(§2)하므로, 셸 수치가 하나라도 어긋나면 회귀다.

### 왜 `UpdateSuggestModal`을 재사용/일반화하지 않고 새로 만드나
`plan.md §3.6`의 결정을 그대로 따른다 — 두 축(**스토어 바이너리** / **OTA JS 번들**)은 의미·조건·문구가 다르고, 동시에 뜰 수도 있는 관계(§4.2: suggest 중에는 OTA 안내 억제)다. 한 컴포넌트로 합치면 한쪽 문구·분기 변경이 다른 축으로 샌다. **셸만 공유하고 컴포넌트는 분리**한다(= `UpdateSuggestModal`이 `RenameDialog`를 일반화하지 않은 것과 같은 판단).

---

## 2. 셸 매핑표 — `UpdateSuggestModal.tsx` ↔ `OtaReadyDialog.tsx`

**단위: 파일:라인.** 좌우 값이 다르면 "차이" 열에 사유가 있어야 한다(없는데 다르면 버그).

| 셸 요소 | `UpdateSuggestModal.tsx` | `OtaReadyDialog.tsx` | 값 | 차이 |
|---|---|---|---|---|
| 딤 불투명도 상수 | `:17` | `:16` | `BACKDROP_OPACITY = 0.34` (킷 `rgba(20,12,8,.34)` 근사) | 동일 |
| 셸 레이아웃 상수 | `:19-24` | `:18-23` | `cardWidth '84%'` · `cardMaxWidth 320` · `buttonPadding 14` · `dividerWidth 1` | 동일 |
| props 타입 | `:26-35` | `:25-32` | — | props만 다름(§3) |
| `visible` 가드(미렌더) | `:44` | `:36` | `if (!visible) return null;` | 동일 |
| 카드 표면·radius | `:46-50` | `:38-42` | `color.surface` · `radius.sheet`(20) | 동일 |
| Modal | `:53` | `:45` | `transparent` · `animationType="none"` · `onRequestClose={onDismiss}` | 동일 |
| 딤 backdrop | `:55-61` | `:47-53` | `absoluteFill` + `color.fg` + opacity 0.34, 탭→dismiss | testID만 다름 |
| 정중앙 wrap | `:63` | `:55` | `flex:1` · center/center · `pointerEvents="box-none"` | 동일(둘 다 입력 없음 → 오프셋 불요) |
| 카드 Pressable | `:65-69` | `:57-61` | `shadow.dialog`(킷 `0 20px 50px rgba(0,0,0,.28)` 근사) · `overflow:'hidden'` | testID만 다름 |
| 본문 패딩 | `:71-79` | `:63-71` | `paddingTop 20` · `paddingHorizontal 18` · `paddingBottom 16` (spacing 토큰) | 동일 |
| 제목 | `:80-82` | `:72-74` | `variant="dialogTitle"`(800/17.5, SUIT-Bold) · `color="fg"` · center | **문구만** 다름(§4) |
| 본문 | `:83-89` | `:75-82` | `variant="dialogSubtitle"`(500/12.5, SUIT-Medium) · `color="fgMuted"` · center · `marginTop: spacing[6]` | **문구만** 다름(§4) |
| 버튼 행(상단 hairline) | `:94` | `:86` | `borderTopWidth: StyleSheet.hairlineWidth` · `borderTopColor: color.hairlineAlt` | 동일 |
| 좌측 버튼(취소축) | `:95-105` | `:87-97` | `variant="dialogInput"`(600/16) · `color="fgWeak"` | 문구 "나중에" 동일, testID 다름 |
| 분할선 | `:106` | `:98` | `width 1` · `backgroundColor: color.hairlineAlt` | 동일 |
| 우측 버튼(primary) | `:107-117` | `:99-109` | `variant="button"`(800/16) · `color="accentStrong"`(#1F4FE0) | **문구** 다름, testID 다름 |
| StyleSheet 블록 | `:140-151` | `:117-133` | backdrop·wrap·card·center·actions·action·divider·pressed(0.6) | 동일(포맷만 다름) |
| **조건 분기** | `:93-133` (`storeUrl` 유무로 2버튼/1버튼) | **없음** | — | **의도적 차이**(§5-1) |

### RN 미재현 항목(근사 + 사유)
`UpdateSuggestModal`에서 이미 확정된 근사를 그대로 승계한다 — 신규 근사 **0건**.
- 딤 `rgba(20,12,8,.34)` → `color.fg`(#2A2422 웜 잉크) + `opacity 0.34`. RN `Modal` 자식에 CSS rgba를 직접 못 쓰므로 색+불투명도로 분리 근사.
- `box-shadow 0 20px 50px rgba(0,0,0,.28)` → `shadow.dialog`. RN `shadowRadius`는 CSS blur(50)와 1:1이 아니어서 근사(토큰 정의 주석 `tokens.ts:197-199`에 기록됨).
- 상단 hairline: 킷 1px → RN `StyleSheet.hairlineWidth`(디바이스 픽셀비 대응). 좌우 분할선은 킷과 동일하게 정확히 1px.
- **폰트 웨이트 `800` → `SUIT-Bold`(700).** 킷 `mk-extra.jsx:40`(제목)·`:59`(primary 버튼)는 `800`이지만 SUIT 번들은 Regular/Medium/SemiBold/Bold **4종뿐**(`src/theme/fonts/fonts.ts:10-15`)이라 ExtraBold가 없다. §2 표의 "800/17.5" 표기는 **킷 원값**이며 실제 렌더는 Bold(700)다 — 앱 전역(`typography.dialogTitle`·`button`)이 이미 이 근사를 쓰고 있어 이 컴포넌트의 신규 근사가 아니다.

---

## 3. props 계약 (developer T8용)

```ts
// src/features/ota/OtaReadyDialog  (배럴: ./index.ts)
export type OtaReadyDialogProps = {
  /** 표시 여부. false면 미렌더(null). */
  visible: boolean;
  /** "지금 적용" 탭 — reloadAsync 배선은 developer. */
  onApply: () => void;
  /** "나중에" 탭 · 딤 탭 · Android 뒤로가기(onRequestClose) — dismiss 배선은 developer. */
  onDismiss: () => void;
};
```

- **상태 0 · 데이터 로직 0 · 네이티브 접근 0.** 훅(`useOtaUpdate`)도, 컨텍스트(`useAppVersionGateStatus`)도 이 컴포넌트가 읽지 않는다. 노출 판정은 전부 `OtaUpdateGate`가 한다.
- 배선 예시(T8 기준 — plan §4.2 매트릭스):
  ```tsx
  <OtaReadyDialog
    visible={state.status === OtaStatus.Ready && storeGateStatus !== 'suggest'}
    onApply={applyUpdate}
    onDismiss={dismiss}
  />
  ```
  > `visible` prop과 `OtaUpdateGate`의 조건부 렌더 중 **어느 쪽을 써도 동작은 같다**(false면 null). 다만 plan §4.2가 "suggest면 렌더하지 않는다"로 쓰여 있으므로, 게이트에서 조건부로 렌더하고 `visible`은 `ready` 여부만 넘기는 편이 매트릭스와 1:1로 읽힌다. developer 선택.
- **`onApply`/`onDismiss`는 각각 1회씩만 호출된다**(단일 탭 = 단일 콜백, 서로를 부르지 않음). 중복 실행 가드·상태 전이는 훅 책임.
- Android 하드웨어 뒤로가기는 `Modal.onRequestClose` → `onDismiss`로 이어진다. "적용"이 강제가 아니므로 의도된 동작이다.

### 배럴 export 요청 (developer)
`src/features/ota/index.ts`는 developer가 소유한다(파일 충돌 방지). 아래 1줄을 추가해 주세요.
```ts
export { OtaReadyDialog, type OtaReadyDialogProps } from './OtaReadyDialog';
```

### testID (qa-logic 배선 검증용)
| testID | 대상 | 기대 |
|---|---|---|
| `ota-ready-backdrop` | 딤 배경 | press → `onDismiss` 1회 |
| `ota-ready-card` | 카드 | press → 아무 콜백도 호출되지 않음(전파 차단) |
| `ota-dismiss` | "나중에" | press → `onDismiss` 1회 (plan §3.6 지정 ID) |
| `ota-apply` | "지금 적용" | press → `onApply` 1회 (plan §3.6 지정 ID) |

접근성: 액션 3개 모두 `accessibilityRole="button"` + `accessibilityLabel`(딤=`"닫기"`, `"나중에"`, `"지금 적용"`).

---

## 4. 카피 확정 (ui-publisher 최종)

| 슬롯 | 확정 문구 |
|---|---|
| 제목 | **개선사항을 받아뒀어요** |
| 본문 | **앱을 다시 켜면 저절로 적용돼요.**<br>**지금 적용하면 화면이 새로고침되니, 작성 중인 내용은 저장해 주세요.** |
| 좌측 버튼 | **나중에** |
| 우측 버튼(primary) | **지금 적용** |

> 본문의 줄바꿈은 첫 문장 뒤 `{'\n'}` 1개만 명시(`UpdateSuggestModal`과 동일 방식). 둘째 문장은 카드 폭(84%/max 320 − 좌우 18)에 맞춰 자연 줄바꿈된다.

### 카피 설계 근거 — 스토어 축과의 구분(plan §7 qa-visual 항목)

| | 스토어 축 `UpdateSuggestModal` | OTA 축 `OtaReadyDialog` |
|---|---|---|
| 제목 | "새 버전이 나왔어요" | "개선사항을 받아뒀어요" |
| 사용자가 할 일 | 스토어로 이동 → **다운로드·설치** | 아무것도 안 해도 됨 → **다시 켜면 적용** |
| 동사 | **나왔어요**(바깥에 있음, 가지러 감) | **받아뒀어요**(이미 기기에 있음, 완료형) |
| 버튼 | "업데이트" | "지금 적용" |
| 무게 | 무거움(앱 나감·용량·시간) | 가벼움(화면 새로고침) |

- **"버전"이라는 단어를 OTA 쪽에서 뺐다.** 스토어 모달이 이미 "새 버전"을 점유하고 있어 같은 명사를 쓰면 두 축이 같은 것으로 읽힌다. plan §3.6의 draft 제목("새 버전이 준비됐어요")은 스토어 문구("새 버전이 나왔어요")와 어미만 다른 수준이라 **채택하지 않았다**(plan §5 T7이 "카피 최종 확정은 ui-publisher"로 위임).
- **"업데이트"라는 단어도 뺐다.** 사용자 머릿속에서 "업데이트 = 스토어"이므로, 스토어에 가야 하나 하는 오해를 부른다. 대신 결과(개선사항)와 행위(적용)로 표현했다.
- **첫 문장을 "다시 켜면 저절로 적용돼요"로 앞세운 이유**: 이 다이얼로그의 진짜 메시지는 "지금 안 해도 손해 없다"이다(plan §4.3 — 무시해도 다음 콜드스타트에 자동 적용). 마찰이 낮다는 사실을 먼저 알려야 "나중에"를 부담 없이 누른다.
- **둘째 문장이 인수조건 ⑦**(작성 중 내용 저장 안내). `reloadAsync`는 앱을 재시작해 `MuklogEditor`의 미저장 입력·선택 사진을 날린다(plan §6 엣지케이스). "화면이 새로고침되니"로 원인을, "작성 중인 내용은 저장해 주세요"로 행동을 준다.
- **톤**: 전부 해요체. 과장·느낌표 없음. 원티드 규칙상 구체 숫자를 선호하나 **적용 소요 시간은 기기·번들 크기에 따라 달라 검증할 수 없어 숫자를 쓰지 않았다**(추측 금지 > 구체성).
- **이모지 없음.** 킷의 플레이풀 예외는 콘텐츠 영역(음식 커버·빈상태)에 해당하고, `RenameDialog` 계열 시스템 다이얼로그는 킷에서도 이모지가 없다.

---

## 5. `UpdateSuggestModal` 대비 의도적 차이

1. **조건 분기 제거** — `UpdateSuggestModal`은 `storeUrl === null`이면 단일 "확인" 버튼으로 접히는 분기가 있다(`:93-133`). OTA에는 그런 실패 모드가 없다: 다이얼로그가 뜨는 시점은 이미 `fetchUpdateAsync`가 성공해 번들이 로컬에 있는 상태(plan §3.5 `Ready`)이고, `reloadAsync`는 외부 URL 의존이 없다. → **항상 2버튼**, props에도 nullable 값 없음.
2. **testID 네임스페이스** — `update-suggest-*` → `ota-*`. plan §3.6이 지정한 `ota-apply`/`ota-dismiss`를 그대로 쓰고, 셸 요소는 `ota-ready-backdrop`/`ota-ready-card`로 접두사를 맞췄다.
3. **좌측 버튼 라벨은 같지만("나중에") 의미가 다르다** — 스토어 축의 "나중에"는 버전당 1회 기록되는 dismissal(`updateSuggestDismissal`)이고, OTA의 "나중에"는 **세션 한정**(마운트 1회 구조라 같은 세션 재노출 없음, 다음 콜드스타트엔 이미 적용됨). 저장소에 아무것도 남기지 않는다 — developer가 dismissal 저장 로직을 붙이지 않도록 명시.
4. **본문이 2문장**(스토어 축은 "더 좋아진 먹로그를 만나보세요. / 지금 업데이트할까요?" 2줄). 안전 안내(저장) 때문에 한 문장 더 길다 — 카드 높이가 스토어 모달보다 1~2줄 높다. 의도된 차이다.
5. **`onApply` 후에도 다이얼로그를 스스로 닫지 않는다.** `reloadAsync`가 성공하면 앱이 재시작되므로 닫을 필요가 없고, 실패하면 훅이 `idle`로 내려 게이트가 언마운트한다(plan §3.5-4). 컴포넌트에 내부 상태를 두지 않기 위한 결정.

---

## 6. 토큰 변경 · 신규 프리미티브

- **토큰 변경 0건.** 필요한 값(`color.surface`·`fg`·`fgWeak`·`fgMuted`·`hairlineAlt`·`accentStrong`, `radius.sheet`, `shadow.dialog`, `spacing[6/16/18/20]`, `typography.dialogTitle/dialogSubtitle/dialogInput/button`)이 모두 이미 존재한다.
- **신규 프리미티브 0건.** 셸이 `UpdateSuggestModal`과 동일해 추출할 새 공용 요소가 없다.
- **raw hex 0 · rgba 0** — 스펙에서 소스 문자열로 단언한다(`OtaReadyDialog.spec.tsx`의 "raw hex 색을 소스에 하드코딩하지 않는다").

> 셸이 3번째로 복제됐다(`RenameDialog` → `UpdateSuggestModal` → `OtaReadyDialog`). 지금 공용 `Dialog` 셸로 추출하지 **않은** 이유: 세 컴포넌트의 차이가 (입력 유무 × 버튼 수 × 오프셋)로 벌어져 있어 공용화하면 props가 비대해지고, 기존 소비처 4곳(LogScreen·ProfileScreen·AppVersionGate·OtaUpdateGate) 회귀 위험을 이 스프린트에 끌어들인다. **4번째 다이얼로그가 생기면 그때 추출**한다 — 후속 과제로 기록.

> **후속 2(다크 토글 스프린트 항목, qa-visual 지적).** 딤이 `color.fg` + opacity 구조라 다크 테마에서 `fg`가 반전되면 딤이 흰 스크림이 된다. 현재는 `ThemeProvider.tsx:16` light 고정 + `app.json` `userInterfaceStyle: "light"`라 발현 불가이고, `RenameDialog`·`UpdateSuggestModal`·`OtaReadyDialog` **3곳이 동일 패턴**이라 한 곳만 고치면 셸 정합이 깨진다. 다크 토글을 켜는 스프린트에서 **3곳을 동시에** 재검토한다(전용 딤 토큰 신설 후보).

---

## 7. 산출물 · 검증

**신규 파일 3개**
- `src/features/ota/OtaReadyDialog/OtaReadyDialog.tsx`
- `src/features/ota/OtaReadyDialog/OtaReadyDialog.spec.tsx`
- `src/features/ota/OtaReadyDialog/index.ts`

**테스트(TDD Red→Green, 9 케이스)** — `npx jest src/features/ota/OtaReadyDialog` **9 passed**, `npx tsc --noEmit` **0 에러**.

| # | 케이스 | 인수조건(plan §5 T7) |
|---|---|---|
| 1 | `visible=false` → 미렌더 | ④ |
| 2 | `visible=true` → 제목·2버튼 렌더 | ② |
| 3 | 본문에 "작성 중인 내용은 저장해 주세요" 포함 | ⑥/⑦ |
| 4 | "지금 적용" → `onApply` 1회, `onDismiss` 0회 | ③ |
| 5 | "나중에" → `onDismiss` 1회, `onApply` 0회 | ③ |
| 6 | 딤 탭 → `onDismiss` 1회 | ③ |
| 7 | 카드 탭 → 콜백 0(전파 차단) | ① 셸 정합 |
| 8 | 스토어 문구("새 버전이 나왔어요"·"업데이트") 부재 | 두 축 혼동 방지(§4) |
| 9 | 소스에 raw hex·rgba 0 | ⑤ |

**qa-visual 체크리스트**
- [ ] §2 매핑표의 셸 값이 `UpdateSuggestModal`과 전부 일치(딤 0.34 · 카드 84%/320 · radius 20 · buttonPadding 14 · divider 1 · hairlineAlt · shadow.dialog).
- [ ] 타이포 4종이 지정 variant(dialogTitle/dialogSubtitle/dialogInput/button)와 색 토큰(fg/fgMuted/fgWeak/accentStrong)에 정확히 매칭.
- [ ] §4 카피 전문 일치(오탈자·어미·줄바꿈 위치).
- [ ] 디바이스 스모크: 다크 배경·safe-area 위에서 카드 정중앙 · 본문 3줄이 잘리지 않음 · 긴 텍스트가 카드를 밀지 않음. (라이브 이월 — jsdom에서 레이아웃 미검증, 메모리 `qa-layout-blind-spot`)
- [ ] 스토어 모달과 나란히 놓았을 때 사용자가 두 축을 다른 것으로 인식하는지(문구 비교표 §4).
