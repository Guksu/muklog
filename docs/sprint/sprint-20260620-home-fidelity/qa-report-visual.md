# QA Report — Visual 충실도 (sprint-20260620-home-fidelity)

검증자: qa-visual · 디자인 SSOT: `.claude/skills/ui-design/templates/muklog/mk-home.jsx`
대상 RN: `src/navigation/screens/LogListScreen.tsx` · `relativeTimeLabel.ts` · `src/theme/tokens.ts`(heroGradient)
방법: 킷 JSX ↔ RN 동시 대조(3축: 레이아웃·구조 / 비주얼·토큰 / 텍스트·카피).

## 종합 판정: 통과 (PASS) — 불일치 0 · 근사 허용 5 · 경미 관찰 2(비차단)

홈 한 화면의 모든 킷 구조·토큰·카피가 정합. raw hex 0(히어로 장식 rgba 2건은 ui-spec §5 근사 #4의 킷 verbatim 웜톤). 발견된 폰트 weight 미세차(spotCount·+N)는 모두 기존 역할 토큰 정책에 따른 의도된 정수/weight 근사로, ui-spec에 기록됨.

---

## 1. LogCard 본문 분기 — 킷 28-104

### 1.1 빈카드(spotCount===0) — 킷 63-71 ↔ `LogEmptyBody`(128-156)
| 축 | 킷 | RN | 판정 |
|---|---|---|---|
| 구조 | 가로 박스 아이콘배지+텍스트+plus, marginTop14, padding 14/16 | `styles.emptyBody`(551-552 pad 14/16) + `marginTop spacing[14]`(135) | 통과 |
| radius/보더 | radius16 + `fill-alt` + `1px dashed accent-line` | `radius.xl`(16,137) + `fillAlt`(137) + `accentLine` dashed(138,541·554) | 통과 |
| 🍽️ 배지 | 40×40 radius12 `accent-weak` fontSize20 | 40×40(556) + `radius.lg`(12,142) + `primaryWeak`(142) + fontSize20(557) | 통과 |
| 카피 | "아직 기록한 맛집이 없어요"(700/14) / "이 로그를 열어 첫 맛집을 남겨보세요"(500/12.5) | 동일 문구, `cardTitle`/`meta`(146·149) | 통과 |
| plus | size18 accent-strong | `Plus` 18 accentStrong(153) | 통과 |

### 1.2 사진 4칸 스트립 — 킷 74-91 ↔ `LogPhotoStrip`(61-113)
| 축 | 킷 | RN | 판정 |
|---|---|---|---|
| gap/marginTop | `gap:7 marginTop:14` | `strip` gap 7(537) + `marginTop spacing[14]`(79) | 통과 |
| 슬롯 | `flex:1 aspectRatio:1/1 radius14` | `slot` flex1 aspectRatio1(538) + `radius.control`(14,86) | 통과 |
| 부족분 빈슬롯 | `fill-alt` + `1px dashed line` | `fillAlt`+`hairline` dashed(103·541), 항상 4칸(80 PHOTO_STRIP_SLOTS) | 통과 |
| +N 오버레이 | 4번째·`more=spots-4`·rgba(20,12,8,.46) 흰 800/17 | `more=max(0,spotCount-4)`(71), isLast 4번째(82-83), `scrimStrong` 딤(119) + 흰 텍스트(120) | 통과(근사 #5·폰트관찰) |

근사: 채움 = **실사진 Image**(88-91, ui-spec §5 #1) — 킷 FoodCover 대비 더 충실. 미발급 path는 점선 빈슬롯 강등(72-75) = 깨진이미지 방지, 킷 빈슬롯 비주얼과 동일.

### 1.3 통계행 — 킷 92-99 ↔ `LogStatsRow`(159-184)
| 축 | 킷 | RN | 판정 |
|---|---|---|---|
| 상단 헤어라인 | `borderTop 1px line-alt` | `borderTopWidth hairlineWidth`(565) + `hairlineAlt`(169) | 통과 |
| location | 아이콘15 accent | `Location` 15 `primary`(174) | 통과 |
| "맛집 N곳" | 700/13.5 | `spotCount` 토큰(600/14)(175) | 통과(근사·아래 관찰①) |
| 마지막 기록 | 600/12.5 "{AGO}" | `meta` + 상대시간(179-180), null→"기록 없음" | 통과(거짓시각 0) |

## 2. 인사 헤드라인 — 킷 116-122 ↔ `GreetingHeader`(251-267)
- "{닉}님, 오늘은\n어디 다녀왔어요?" 줄바꿈 포함 일치, `emptyTitle`(800/21≈22)(255-256). 통과.
- 합계 "지금까지 함께 {Σ}곳을 기록했어요", `{Σ}곳`만 `accentStrong` 중첩(259-263). Σ = `state.logs.reduce(+spotCount)`(471) = 킷 `logs.reduce(+spots)`. 통과.
- 킷 한 줄 캡션 제거 확인(ui-spec 2.4). 통과.

## 3. EmptyLogs — 킷 136-181 ↔ `EmptyLogs`(312-389)
| 축 | 킷 | RN | 판정 |
|---|---|---|---|
| 컨테이너 | padding 10/20/28 | `emptyScroll` 10/20/28(574), ScrollView(326) | 통과 |
| 인사 | "{닉}님,\n먹로그를 시작해볼까요?" + 본문 2줄 | 동일 문구(329-334), `emptyTitle`/`sectionCaption` | 통과 |
| 히어로 박스 | 172h radius-card 그라데이션 overflow:hidden | `HERO_HEIGHT`172(42) + `radius.card`(343) + overflow hidden(577) | 통과 |
| 그라데이션 | `linear-gradient(150deg,#EAF0FF→#FFE7DD)` | `heroGradient`(338) start{0,0}→end{1,1}(44-45) | 통과(근사 #2) |
| 음식핀 4(🍝☕🍣🍰) | HeroPill 36 원형 fontSize19, 위치 22/24·30/28·24/34·30/30 | `HeroPill`(345-348,382-389) 36(612)·fontSize19(617)·위치 동일(618-621) | 통과 |
| 아바타+💕+🙂 | AV62 + 💕(30 흰원) + 🙂(62 반투명) | AV62(350) + `heroHeart`30(580-594) + `heroPartner`62(596-606) | 통과(근사 #3·#4) |
| 두 갈래 카드 | 🥢 새 로그 만들기 / 💌 초대코드로 입장 + 설명 | `StartActionCard`×2(362-374), 문구 일치 | 통과 |

배선: onJoin → `Routes.JoinLog`(432) = ui-spec 2.5 / plan §7. 통과.
StartActionCard: radius18(`radius.action`,290) + 헤어라인보더·그림자 off(629-632), 46 배지 radius14 `primaryWeak`(295) — 킷 SheetAction 203-218 정합. 통과.

## 4. 상대시간 포맷 — 킷 agoLabel(mk-ui:256-265) ↔ `relativeTimeLabel`(19-35)
임계값 7/28/365, 나눗셈 7/30/365 모두 보존. `<=0`→오늘 / `===1`→어제 / `<7`→N일 / `<28`→N주 / `<365`→N개월 / else→N년 = 킷과 동일.
- 의도된 보정 1건: 개월·년 `Math.max(1,…)` 클램프(33-34) — 킷의 "0개월 전"(28일에서 floor(28/30)=0) 약점 교정. ui-spec §4.2 / 파일주석 8-9에 사유 기록. **거짓스러운 "0개월" 회피 = 합리적, 통과.**
- iso null/파싱불가 → '' 폴백, 호출부 "기록 없음" 처리(180). 통과.

## 5. 카드 헤더 — 킷 40-60 ↔ LogCard 헤더(202-235)
- 아바타 겹침: 본인 + (커플) 짝꿍 `marginLeft:-12`(213 `-spacing[12]`) = 킷 44. 통과.
- 짝꿍 ring: 킷 44 partner `ring`, RN Avatar `ring` 기본 true(Avatar.tsx:25·38)이므로 익명 짝꿍(214)도 ring 적용 = 정합. 통과.
- 이름 700/17(`cardTitle`,219) + `displayLogName` numberOfLines1. 통과.
- MemberBadge(227) + "YYYY.MM.DD 시작"(`meta` 500/12.5,228-229). 킷은 커플 시 "함께한 지 N일"이나 RN은 `Date.now` 비결정 회피로 "시작" 통일(ui-spec 2.1 / 기존정책). 통과(정책 근사).
- chevron 18 / fgAssistive(234) = 킷 59. 통과.

## 6. 근사 허용 5건 — ui-spec §5 검토
| # | 근사 | 합리성 | 판정 |
|---|---|---|---|
| 1 | 실사진 Image(74-91) | plan §3.3 실사진 우선, 더 충실. 빈슬롯 동일 | 합리·허용 |
| 2 | 그라데이션 150deg→대각 start{0,0}→{1,1}(152) | RN deg 직접지정 불가, 살구 우하단·stops 정확 | 합리·허용 |
| 3 | 컬러그림자→검정 근사(💕 .16 / 핀 shadow.seg) | RN 컬러그림자 미지원, 떠있는 칩 그림자 유지 | 합리·허용 |
| 4 | 🙂 반투명흰+inset ring → bg rgba(.7)+borderWidth2 rgba(120,90,70,.12)(167-170) | inset box-shadow→border 근사, 킷 웜톤 verbatim | 합리·허용 |
| 5 | +N 딤 rgba(20,12,8,.46)→`scrimStrong`(.32) | 기존 글래스 토큰 재사용, raw rgba 신규 하드코딩 회피 | 합리·허용 |

히어로 장식 rgba 2건(`heroPartner` 602·604)은 시맨틱 컬러 아닌 킷 verbatim 장식값 — 토큰화 대상 아님(ui-spec §5 각주). 토큰화 raw hex 적발 0.

---

## 경미 관찰(비차단 — ui-publisher 참고용, 수정 선택)
- **관찰① "맛집 N곳" weight**: 킷 96 = `700/13.5`, RN = `spotCount` 토큰 `600/14`(tokens.ts:210). ui-spec 2.3에 "600/14 근사"로 기록됨. 0.5px·1단계 weight 차로 육안 거의 무차이 — **허용**. 엄밀 정합 원하면 `spotCount` 토큰 family를 `SUIT-Bold`(700)로 올리는 선택지 있으나, 역할 토큰 공유 영향 검토 필요(현 권장: 유지).
- **관찰② "+N" weight**: 킷 83 = `800/17`, RN = `cardTitle`(`700/17`)(120). 크기17 일치, weight만 700(킷 800). 사진 위 오버레이라 육안 영향 미미 — **허용**. 정합 원하면 `emptyTitle`(800)류 토큰 검토 가능하나 크기(21)가 달라 부적합 → 현 cardTitle 유지가 합리.

> 위 2건은 모두 ui-spec에 의도된 정수·weight 근사로 기록되어 있고, 기존 역할 토큰 정책(킷 소수 weight를 시맨틱 토큰으로 정수 근사)에 부합. 차단 사유 아님.

## 디바이스 스모크 권장(메모 qa-layout-blind-spot)
RN/픽셀 미렌더 검증이라 아래는 디바이스 육안 확인 권장(미검증 아님, 정적 정합은 통과):
- 스트립 4칸 wrap 없이 한 줄 유지(flex1 aspectRatio1 narrow 기기).
- 통계행 헤어라인(`hairlineWidth`) 실렌더.
- 히어로 핀 4개 위치(절대배치 22/24·30/28·24/34·30/30)가 박스 모서리 밖으로 안 잘림.
