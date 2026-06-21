# QA Report (Visual/Copy) — sprint-20260621-copy-fidelity (S6+S7)

검증 범위: 킷 SSOT 문자열·상수 ↔ RN 전수 대조(카피·미세 비주얼). 수정 없음(검증·리포트만).

킷 SSOT: `.claude/skills/ui-design/templates/muklog/` (mk-home/extra/auth/ui.jsx, SPEC.md §2-2)

## 항목별 판정

### A. JoinLog — `src/navigation/screens/JoinLogScreen.tsx` — 통과
| 위치 | 킷 | RN | 판정 |
|---|---|---|---|
| SubBar | mk-home:226 "초대코드 입력" | :53 "초대코드 입력" | ✅ |
| 제목 | mk-home:229 "연인의 로그에 들어가기" | :69 동일 | ✅ |
| 본문 | mk-home:230-231 "연인이 보낸 6자리 코드를 입력하면\n같은 로그에서 함께 기록해요." | :76 동일(`\n` 정확) | ✅ |
| 버튼/a11yLabel | mk-home:237 "들어가기" | :89-90 "들어가기"/"들어가기" | ✅ |
| 성공 토스트 | SPEC §2-2:48 "로그에 들어왔어요! 💕"(positive) | :42 `showToast({ message: '로그에 들어왔어요! 💕', tone: 'positive' })` | ✅ **신규 추가 확인** |

토스트는 ui-spec.md가 "무변경"으로 분류했으나 RN은 이미 SPEC §2-2 정합 문자열을 positive tone으로 발화하도록 구현돼 있음(:42). 킷 일치 확인.

### B. RoomCreated — `src/navigation/screens/RoomCreatedScreen.tsx` — 통과
| 위치 | 킷 | RN | 판정 |
|---|---|---|---|
| 제목 | mk-home:279 "우리 로그가 만들어졌어요" | :44 동일 | ✅ |
| 본문 | mk-home:280-281 "아래 코드를 연인에게 보내면\n둘이 함께 기록할 수 있어요." | :52 동일 | ✅ |

### C. AddSheet — `src/navigation/AddSheet.tsx` — 통과
| 위치 | 킷 | RN | 판정 |
|---|---|---|---|
| 타이틀 | mk-home:195 "어떻게 시작할까요?" | :80 동일 | ✅ |
| 행1 title | mk-home:197 "새 로그 만들기"(불변) | :84 동일 | ✅ |
| 행1 desc | mk-home:197 "먼저 시작하고 연인을 초대해요" | :85 동일 | ✅ |
| 행2 title | mk-home:198 "초대코드로 들어가기" | :91 동일 | ✅ |
| 행2 desc | mk-home:198 "연인이 보낸 6자리 코드가 있어요" | :92 동일 | ✅ |

### D. Wishlist — `src/features/wishlist/WishlistView.tsx` — 통과
| 위치 | 킷 | RN | 판정 |
|---|---|---|---|
| 빈 제목 | mk-extra:183 "다음엔 여기 어때요?" | :61 동일 | ✅ |
| 빈 본문 | mk-extra:184-185 "가보고 싶은 맛집을 미리 담아두면\n다음 데이트가 더 쉬워져요." | :68 동일 | ✅ |
| 작성자 라벨 | mk-extra:211 "{닉}님이 담았어요" | :157 `{authorName}님이 담았어요` | ✅ |

### E. Login — `src/navigation/screens/LoginScreen.tsx` — 통과
| 위치 | 킷 | RN | 판정 |
|---|---|---|---|
| LOGIN_COPY | mk-auth:96-98 "둘이 다녀온 맛집을\n오래오래 함께 기억해요." | :32 동일 | ✅ |

### F. Stars 기본 size — `src/components/Stars.tsx` — 통과
| 위치 | 킷 | RN | 판정 |
|---|---|---|---|
| 기본 size | mk-ui:32 `size = 15` | :24 `size = 15` | ✅ |
| JSDoc | — | :16 "기본 15(킷 mk-ui:32)" | ✅ |

`size = 14` 잔존 0. 명시 size 미주입 소비처 영향만 받으나 모든 소비처가 명시 주입 → 비주얼 영향 0.

## 구 문자열 잔존 검사(grep)
구 카피("초대코드 입장", "연인의 로그에 입장하기", "연인이 공유한 6자리", "입장하기", "새 로그가 만들어졌어요", "아래 초대코드를 연인에게", "무엇을 할까요", "혼자 시작하고", "연인이 보낸 6자리 코드 입력", "가보고 싶은 곳을 모아요", "위시리스트에 담아두세요", "님이 추가", "데이트하며 다닌 맛집을") 소스 잔존 **0**.

잔존하나 킷 정상(stale 아님):
- `LogListScreen.tsx:371` / `LogListScreen.spec.tsx` "초대코드로 입장" = 킷 EmptyLogs(mk-home:177, 별개 요소, title 그대로). **정상·불변** — AddSheet(mk-home:198)만 "들어가기".
- `Sheet.spec.tsx` "무엇을 할까요?" = 공용 Sheet 프리미티브 제너릭 테스트 prop(AddSheet 카피 아님). **정상**.

## 제외 항목(정상)
- MemberBadge "혼자" 색: RN 가독성 우선 plan 결정(의도적). 카피 아님 → 변경 없음. **정상**.
- Sheet 컨테이너 radius: 이미 킷 일치 → 변경 없음. **정상**.

## 종합 판정: 통과 (PASS)
A~F 6개 항목 전부 킷 SSOT 문자열·상수와 정확히 일치(`\n` 줄바꿈·a11yLabel 포함). 구 문자열 소스 잔존 0. 잔존 "초대코드로 입장"/"무엇을 할까요?"는 각각 EmptyLogs·Sheet 프리미티브 별개 요소로 킷 정상. 비주얼/카피 충실도 불일치 없음.
