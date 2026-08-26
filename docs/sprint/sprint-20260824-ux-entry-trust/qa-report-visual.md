# QA Report — Visual (sprint-20260824-ux-entry-trust)

> 검증자: qa-visual · 검증일 2026-08-24 · 대상: 작업 트리(본 트리, 읽기 전용)
> 범위: 킷 `templates/muklog` 시안 대비 비주얼 충실도 + 이 스프린트가 계약한 **비주얼·토큰 변경 0** 검증.
> **로직·경계면·테스트 정합은 qa-logic 담당 — 이 리포트에서 다루지 않는다.**
> 이 스프린트에는 `ui-spec.md`가 없다(비주얼 변경 0 계약이라 ui-publisher 산출물 부재). 검증 출발점은 plan §3-3(소비처별 킷 근거)·§4(화면·UX 표)로 대체했다.

## 판정: **통과**

킷이 정의한 진입·생성 플로우 4종이 RN 구현과 일치하고, 수정된 4개 화면에서 스타일·토큰·레이아웃 회귀는 **0건**이다. 불일치(수정 요청) 0건, 근사 허용 1건, 관찰·기록 3건(전부 비차단).

---

## 1. U1 플로우 킷 정합 — 통과

킷의 진입 상태 기계는 `index.html:114-131`(`doCreate`/`doJoin`/`onAdd` 배선)과 `mk-home.jsx`(렌더)에 나뉘어 있다. 네 경로 전부 대조했다.

| # | 플로우 | 킷 근거 | RN 구현 | 판정 |
|---|---|---|---|---|
| ① | 빈 상태 "새 로그 만들기" → **생성 직행 → created 축하화면** | `mk-home.jsx:133` `<EmptyLogs onCreate={onCreate}>` → `index.html:127` `onCreate={doCreate}` → `index.html:116` `doCreate = () => { setAddOpen(false); setNewCode(randomCode()); setView("created") }` | `LogListScreen.tsx:434` `onCreate={() => void createLog()}` → `useStartLogFlow.ts:36-48` `createRoom() → refresh() → navigate(Routes.RoomCreated, { roomId, code: inviteCode })` | ✅ 시트 경유 없이 직행 + 축하화면 도달. 킷의 `randomCode()`가 실제 RPC 코드로 대체된 것 외 구조 동일 |
| ② | 빈 상태 "초대코드로 입장" → join 화면 | `mk-home.jsx:133` `onJoin` → `index.html:127` `onJoin={doJoin}` → `index.html:117` `doJoin = () => { setAddOpen(false); setView("join") }` | `LogListScreen.tsx:435` `onJoin={goToJoin}` → `useStartLogFlow.ts:50` `navigate(Routes.JoinLog)` | ✅ |
| ③ | 목록 하단 "새 로그 시작하기" → **AddSheet 오픈**(생성 아님) | `mk-home.jsx:120` `<button onClick={onAdd}>` → `index.html:127` `onAdd={() => setAddOpen(true)}` · `SPEC.md:36` "「새 로그 시작하기」 탭 → `AddSheet` 열림" | `LogListScreen.tsx:467` `<CreateLogCta onPress={() => setSheetOpen(true)} …>` + `:471-477` `<AddSheet visible={sheetOpen} …>` 마운트 | ✅ **이번 스프린트의 핵심 교정**. 종전 `onPress={() => void handleCreate()}`(즉시 생성)에서 킷대로 복귀 |
| ④ | AddSheet 두 행 구성·카피 | `mk-home.jsx:189-198` `<SHEET title="어떻게 시작할까요?">` + `SheetAction` 2행 · `SPEC.md:41-43` | `AddSheet.tsx:80-95`(**변경 0** — 기존 컴포넌트 재사용) | ✅ 아래 §3 카피 표 참조 |

**킷 상태 기계 재현 확인 2건**

- 킷 `doCreate`/`doJoin`은 둘 다 `setAddOpen(false)`를 **먼저** 실행한다. RN도 시트 경로에서 `setSheetOpen(false)` 후 훅 호출(`LogListScreen.tsx:411-419`) — 순서 일치. 헤더 +버튼(`PlusHeaderButton.tsx:23-30`)도 동일 순서라 두 소비처의 시트 닫힘 타이밍이 같다.
- 킷 `EmptyLogs`(`mk-home.jsx:136-181`)에는 하단 "새 로그 시작하기" 행이 **없다**(그 행은 `logs.length > 0` 분기 전용, `mk-home.jsx:112-124`). RN도 빈 상태에서 `EmptyLogs`를 early return(`LogListScreen.tsx:430-439`)해 CTA·시트를 마운트하지 않는다 — 킷과 일치. 빈 상태에 시트가 딸려오는 오염 없음.

---

## 2. 비주얼 회귀 0 확인 — 통과

`git diff` 전량 + 소스 대조로 4개 경로를 확인했다. **스타일 값·토큰·레이아웃 구조 변경 0건.**

| 파일 | 진단 |
|---|---|
| `LogListScreen.tsx` | 신규 `StyleSheet` 항목 **0**. 기존 `styles.*` 값 변경 **0**. 렌더 트리 변화는 `<AddSheet>` 1개 추가뿐이며, 닫힌 상태의 `Sheet`는 `Modal visible={false}`(`components/Sheet/Sheet.tsx`)라 **렌더 산출물 0**. 나머지 diff는 import 정리·주석·핸들러 배선 |
| `PlusHeaderButton.tsx` | JSX 렌더부 무변경(diff는 import·핸들러 본문·주석만). `<AddSheet onCreate>`가 `() => void handleCreate()` → `handleCreate`로 바뀐 것은 참조 형태 변경일 뿐 렌더 영향 0 |
| `JoinLogScreen.tsx` | 아래 별도 표로 정밀 검증 |
| `AuthErrorView` 경로 | **파일 미수정**(`git status`에 없음). 변경된 것은 주입되는 `message` 문자열뿐 — 레이아웃·토큰 불변 |
| `AddSheet.tsx` / `Sheet.tsx` / `RoomCreatedScreen.tsx` / `CodeInput.tsx` / `src/theme/*` | 전부 **미수정** — 비주얼 원천 무손상 |

### 2-1. JoinLogScreen KAV 래핑 — 레이아웃 값 불변 (정밀)

| 항목 | 변경 전 | 변경 후 | 판정 |
|---|---|---|---|
| `<Screen edges>` | `['left','right']` | `['left','right']` (`JoinLogScreen.tsx:62`) | ✅ safe-area 정책 불변(하단 인디케이터는 콘텐츠 패딩이 클리어) |
| `contentContainerStyle` | `paddingTop: spacing[12]` / `paddingHorizontal: spacing[24]` / `paddingBottom: spacing[24] + insets.bottom` | 동일 (`:79-81`) | ✅ 값·토큰 경유 모두 불변 |
| 신규 스타일 | — | `avoider: { flex: 1 }` (`:125`) | ✅ 유일 신규. 색·radius·간격 없음 |
| 콘텐츠 내부 | 💌 `display` / h2 / body / `CodeInput` / 인라인 에러 / `Button` + 각 `marginTop` 토큰 | 전부 동일(들여쓰기만 이동, `:85-115`) | ✅ |

**정지 상태(키보드 내려간 상태) 높이 동등성 확인**: 종전 `Screen(flex:1) → ScrollView`에서 `ScrollView`는 RN 기본 `baseVertical`(`flexGrow:1, flexShrink:1`)로 `SubBar` 아래 잔여 높이를 채웠다. 변경 후 `Screen → KAV(flex:1) → ScrollView`에서 KAV가 그 잔여 높이를 그대로 받고 ScrollView가 KAV를 채운다. 형제인 `SubBar`는 `flexShrink` 기본값 0이라 두 경우 모두 축소 대상에서 제외된다 → **정지 상태 렌더 결과 동일**. 킷 `JoinScreen`(`mk-home.jsx:222` `padding:"12px 24px", flex:1`)의 단일 flex 본문 구조와도 여전히 일치.

### 2-2. raw hex / 토큰 우회 — 신규 0건

이 스프린트가 만진 파일 전수 grep(`#[0-9a-fA-F]{3,6}`) 결과 2건이며 **둘 다 기존 코드, 이번 diff와 무관**:

- `PlusHeaderButton.tsx:51` — 주석 안의 킷 값 표기(`accent-strong(#1F4FE0)`), 스타일 아님
- `LogListScreen.tsx:567` — `heroHeart.shadowColor: '#000'`(킷 `mk-home:161` `boxShadow rgba(120,90,70,.16)` 근사, 히어로 칩 전용). 이번 diff가 건드리지 않은 기존 라인

신규 파일 `useStartLogFlow.ts`는 스타일·JSX가 없는 순수 배선 훅이라 비주얼 표면 0.

---

## 3. 카피 검증 — 통과

### 3-1. AddSheet 행 카피 (킷 문자 단위 대조)

| 요소 | 킷 | RN | 판정 |
|---|---|---|---|
| 시트 제목 | `mk-home.jsx:189` `title="어떻게 시작할까요?"` | `AddSheet.tsx:80` `title="어떻게 시작할까요?"` | ✅ 완전 일치 |
| 1행 제목/설명 | `mk-home.jsx:191` `"새 로그 만들기"` / `"새로 시작하고 사람을 초대해요"` | `AddSheet.tsx:84-85` | ✅ 완전 일치 |
| 2행 제목/설명 | `mk-home.jsx:192` `"초대코드로 들어가기"` / `"받은 초대코드로 들어가요"` | `AddSheet.tsx:91-92` | ✅ 완전 일치 |
| 빈 상태 1행 | `mk-home.jsx:177` `"새 로그 만들기"` / `"새로 시작하고 사람을 초대해요"` | `LogListScreen.tsx:361-362` | ✅ 완전 일치 |
| 빈 상태 2행 | `mk-home.jsx:178` `"초대코드로 입장"` / `"받은 초대코드로 들어가요"` | `LogListScreen.tsx:368-369` | ✅ 완전 일치(§5 관찰 O-1 참조) |
| 하단 CTA | `mk-home.jsx:122` `"새 로그 시작하기"` | `LogListScreen.tsx:499` | ✅ 완전 일치 |

### 3-2. 신규 문구 (킷 침묵 영역 — 해요체·보이스 심사)

이 스프린트의 신규 카피는 `AUTH_ERROR_MESSAGES[BootstrapFailed]` **1건**뿐이다(plan §3-5·D4).

| 문구 | 심사 | 판정 |
|---|---|---|
| `'잠시 후 다시 시도해 주세요.'` (`errors.ts`) | 해요체 ✅ / 시스템 용어·영어 원문 0 ✅ / 사용자에게 다음 행동을 지시 ✅ / 기존 `TokenExchangeFailed`("로그인에 실패했어요. 잠시 후 다시 시도해 주세요.")의 후반부와 동일 어법이라 앱 내 보이스 일관 ✅ | ✅ |

**제거된 문구 2건이 카피 품질을 올린다**: `'프로필 초기화에 실패했습니다.'`(합쇼체 — 해요체 위반)와 `'알 수 없는 인증 오류'`(체언 종결·시스템 용어)가 코드베이스에서 사라졌다(`AuthProvider.tsx` diff). 영어 SDK 원문이 화면에 도달하는 경로도 `messageForAuthFailure`가 항상 `AUTH_ERROR_MESSAGES` 값만 반환하므로 차단된다.

**AuthErrorView 최종 표시 조합**(코드 변경 0, 문구만 교체):
- 네트워크 실패 → "연결에 문제가 있어요" + "네트워크 연결을 확인해 주세요." + [다시 시도] ✅ 정합
- 비네트워크 실패 → "연결에 문제가 있어요" + "잠시 후 다시 시도해 주세요." + [다시 시도] — §5 관찰 O-2

---

## 4. RoomCreated 노출 경로 회귀 — 통과

새로 열린 두 진입 경로(빈 상태 카드 ①, 목록 시트 ③→④)가 도달하는 축하화면이 킷과 여전히 일치하는지 확인했다. `RoomCreatedScreen.tsx`·`InviteCodeCard`는 **미수정**이며, `RoomCreatedRoute.tsx`는 **주석 1블록만** 변경(코드 변경 0, diff로 확인).

| 요소 | 킷 `CreatedScreen`(`mk-home.jsx:269-289`) | RN `RoomCreatedScreen.tsx` | 판정 |
|---|---|---|---|
| SubBar 제목 | `:272` `"로그 만들기"` | `:30` | ✅ |
| 본문 패딩 | `:273` `padding:"12px 24px"`, `flex:1` column | `:35` `paddingTop spacing[12]` / `paddingHorizontal spacing[24]` / `paddingBottom spacing[24]+insets.bottom` | ✅ 토큰 경유 |
| 🎉 | `:274` `fontSize 56`, center, `margin:"24px 0 4px"` | `:39-41` `fontSize 56` + `marginTop spacing[24]` | ✅ |
| 제목 | `:275` `"우리 로그가 만들어졌어요"` 800/22/1.35 | `:44` `variant="profileName"` + `lineHeight 30` | ✅ |
| 본문 | `:276-277` `"아래 코드를 보내면\n함께 기록할 수 있어요."` | `:52` | ✅ 완전 일치 |
| 초대코드 카드 | `:278` `<InviteCodeCard code>` | `:55` `<InviteCodeCard code={inviteCode} />` | ✅ **U1 목표(코드 노출)의 실제 끝단** |
| 스페이서 | `:279` `<div style={{flex:1}}/>` | `:58` `spacer: { flex:1, minHeight:24 }` | ✅ |
| 하단 버튼 2종 | `:280-282` `"로그 열기"` / gap 10 / ghost `"나중에"` | `:60-62` `size="lg"` + `spacing[10]` + `variant="ghost"` | ✅ |

세 진입 경로(헤더 +버튼 · 빈 상태 카드 · 목록 시트) 모두 `useStartLogFlow.ts:41`의 **동일한** `navigate(Routes.RoomCreated, …)`를 거치므로, 경로별 축하화면 비주얼 분기는 구조적으로 발생할 수 없다.

---

## 5. 관찰·기록 (비차단 — 수정 요청 아님)

**O-1. 킷 내부 불일치(킷 자체 문제, RN은 정답을 골랐다)** — 빈 상태 두 번째 카드 라벨이 킷 안에서 갈린다: `SPEC.md:33`은 "초대코드로 **들어가기**", 렌더 원천인 `mk-home.jsx:178`은 "초대코드로 **입장**". RN은 JSX(렌더 진실)를 따라 "초대코드로 입장"을 쓴다(`LogListScreen.tsx:368`) — **올바른 선택**. 킷 SPEC의 산문 요약이 낡은 것으로 보이며, 킷은 외부 스킬 소유라 이번 스프린트에서 고칠 대상이 아니다. 기록만 남긴다.

**O-2. `AuthErrorView` 제목이 비네트워크 실패에 오귀인할 수 있다 (라우팅: sprint-planner → 백로그)** — 제목 "연결에 문제가 있어요"는 고정인데, 이번에 신설된 `BootstrapFailed`는 정의상 **네트워크가 아닌** 실패(예: 클레임 불일치)에 붙는다. 즉 원인이 연결이 아닌데 제목이 연결을 지목한다. 다만 이는 **이번 스프린트가 만든 회귀가 아니다** — 종전에는 같은 제목 아래 영어 원문이 붙어 있었으므로 카피 품질은 순증했고, plan §4가 `AuthErrorView` 변경 0을 명시적으로 계약했다. 후속 백로그(U49 인접)에서 제목을 매핑 토큰과 함께 갈래 짓는 것을 권한다. **이번 판정에는 영향 없음.**

**O-3. `AddSheet.tsx:4` 주석이 낡았다 (라우팅: developer, 코스메틱)** — `"부수효과는 부모(PlusHeaderButton)가 주입"`이라고 적혀 있으나 이제 부모가 `PlusHeaderButton`·`LogListScreen` 둘이다. `RoomCreatedRoute.tsx`는 같은 성격의 주석을 이번에 갱신했으므로(dev-notes §5 D-3) 동일 처리가 일관적이다. **렌더 산출물 영향 0.**

---

## 6. 근사 허용

**A-1. iOS `KeyboardAvoidingView behavior="padding"` + 콘텐츠 `insets.bottom` 이중 여백 (허용)** — 키보드가 올라온 동안 KAV가 키보드 높이만큼 하단 패딩을 넣는데, 이 값은 홈 인디케이터 영역을 이미 포함한다. 여기에 `contentContainerStyle`의 `spacing[24] + insets.bottom`(`JoinLogScreen.tsx:81`)이 더해져 키보드 위 여백이 `insets.bottom`(≈34px)만큼 넉넉해진다. **키보드가 내려간 정지 상태에는 영향이 없고**(§2-1 동등성 확인), 킷은 웹 프레임이라 이 상황 자체를 정의하지 않는다(RN 전용 영역). 방향이 "버튼이 가려짐"이 아니라 "여백이 조금 더 넓음"이라 U2 의도(다음 행동을 가리지 않기)와 상충하지 않는다 → **근사 허용**. 실제 여백감은 dev-notes §7의 디바이스 스모크 ②(iPhone SE급 화면)에서 눈으로 확인할 것을 권한다.

---

## 7. 미검증 (사유 명시)

| 항목 | 사유 |
|---|---|
| 키보드 노출 중 "들어가기" 첫 탭의 **실제 픽셀 반응** | 정적 소스 대조로는 prop 존재까지만 확인 가능. 디바이스 스모크 필요(dev-notes §7 ①) — 메모 `qa-layout-blind-spot` 대응 |
| iPhone SE급 화면에서 KAV 적용 후 버튼 가림 여부 및 A-1 여백감 | 렌더 픽셀 미측정. 디바이스 스모크 ② |
| 6자 완성 후 셀 탭 재포커스가 `keyboardShouldPersistTaps="handled"`에 막히는지 | 네이티브 터치 전파 영역, jest 미도달. 디바이스 스모크 ③ |
| 오프라인 콜드스타트 `AuthErrorView` 실제 문구 렌더 | 네트워크 상태 의존. 디바이스 스모크 ④ |

위 4건은 모두 plan §9·dev-notes §7이 **이미 스모크 항목으로 선언**한 것이며, 단위·정적 검증의 구조적 사각지대다. 비주얼 판정을 보류할 사유는 아니다.

---

## 8. 결론

**비주얼 완료 — 통과.** 이 스프린트는 "킷이 이미 정의한 플로우로 되돌리는" 작업이라는 plan의 자기규정대로, 킷 진입 플로우 4종을 정확히 복원했고(특히 ③ 하단 CTA의 즉시 생성 → AddSheet 오픈), 계약한 **비주얼·토큰 변경 0**을 지켰다. ui-publisher에 라우팅할 불일치 **0건**. 남은 것은 실기기 스모크 4종뿐이다.
