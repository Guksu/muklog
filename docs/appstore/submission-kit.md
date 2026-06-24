# 먹로그 — App Store 제출 키트 (복붙용)

> 작성 2026-06-23. App Store Connect 각 입력란에 그대로 붙여넣기. 글자수 제한 표기는 ASC 기준.

---

## 1. 스토어 리스트 (한국어)

### 앱 이름 (App Name · 최대 30자)
```
먹로그: 커플 맛집 기록
```
(그냥 `먹로그`만 써도 됨 — 위는 검색 노출용)

### 부제 (Subtitle · 최대 30자)
```
연인과 함께 쌓는 우리 맛집 지도
```

### 프로모션 텍스트 (Promotional Text · 최대 170자 · 심사 없이 수정 가능)
```
오늘 다녀온 맛집, 그냥 지나치지 마세요. 연인과 사진·메모·위치로 기록하면 둘만의 맛집 지도가 완성돼요. 초대코드 하나로 시작하는 우리만의 맛집 다이어리.
```

### 설명 (Description · 최대 4000자)
```
먹로그는 둘이 함께 다녀온 맛집을 사진·메모·위치로 기록하는 커플 맛집 다이어리예요.

데이트하며 발견한 맛집, 그냥 지나치기 아쉬웠죠? 먹로그에 남기면 둘만의 맛집 지도가 차곡차곡 쌓여요.

■ 이렇게 써요
· 연인을 초대해요 — 초대코드 한 번이면 둘이 같은 로그를 함께 채워요. (혼자서도 쓸 수 있어요)
· 맛집을 기록해요 — 장소 검색, 사진, 별점, 메모, 방문일까지 한 번에.
· 지도로 모아봐요 — 우리가 다녀온 맛집이 지도에 핀으로 떠요. 주변 맛집도 한눈에.
· 다음 데이트를 준비해요 — 가보고 싶은 곳은 위시리스트에 미리 담아두세요.
· 새 기록 알림 — 연인이 새 맛집을 기록하면 알려드려요.

■ 이런 분께 좋아요
· 데이트 맛집을 자꾸 까먹는 커플
· 우리만의 맛집 리스트를 만들고 싶은 연인
· 사진과 메모로 추억을 남기고 싶은 분

기록한 모든 것은 초대코드를 주고받은 두 사람에게만 보여요. 공개 피드도, 다른 사람을 찾아보는 기능도 없어요 — 둘만의 공간이에요.

오늘 다녀온 맛집, 먹로그에 남겨보세요. 둘이 함께 쌓는 맛집 지도가 시작돼요.
```

### 키워드 (Keywords · 최대 100자 · 쉼표 구분, 공백 없이)
```
맛집,커플,연인,데이트,맛집기록,맛집지도,데이트코스,맛집저장,위시리스트,커플다이어리,맛집노트,연인앱,데이트앱,맛집리스트
```

### 기타 URL
- 지원(Support) URL: (간단한 안내/문의 페이지 — 없으면 깃허브 페이지나 메일 안내 페이지)
- 마케팅 URL(선택): 생략 가능
- 개인정보 처리방침 URL: `https://guksu.github.io/muklog-privacy/privacy.html`

---

## 2. 심사 노트 (App Review Information → Notes) — 영문 권장

```
App overview
muklog (먹로그) is a private restaurant-logging diary for couples. Two partners share a "log" using a 6-character invite code and record restaurants they visit together (photos, star rating, memo, location). It also works fully in solo mode.

Sign in
- Use "Sign in with Apple" on the first screen (Google sign-in is also available).
- There is no username/password; the app only supports Apple/Google sign-in, so reviewers can sign in with their own Apple ID. No demo account is required.

How to test the core features (one device is enough)
1. Sign in with Apple.
2. Tap the "+" in the header (or "새 로그 만들기") to create a log. You will receive a 6-character invite code — this is only for inviting a partner and is optional.
3. Add a restaurant: tap the "+" floating button → search a place (Korean place search powered by Kakao) → add photo(s), a star rating, a memo, and a visit date → Save ("저장").
4. The restaurant appears in the log and as a pin on the Map tab ("지도"). The "주변" section shows nearby restaurants (requires location permission).
5. Wishlist: inside a log, switch to the "위시리스트" segment to save places to visit later.
6. Profile (top-right avatar): edit nickname, notification settings, Terms/Privacy links, and Account Deletion ("회원 탈퇴").

Optional — testing the 2-person (couple) flow
- On a second device/simulator, sign in with a different Apple ID and enter the invite code from step 2 ("초대코드로 들어가기") to join the same log as the partner.
- If a second device is not available, all features above are fully functional in solo mode.

Privacy & user content (re: Guideline 1.2)
- All content (photos, memos) is private and shared ONLY between the two partners who exchange the invite code. There is no public feed, and users cannot discover or view other users' content. It functions like a private shared notebook between two consenting people.

Account deletion (Guideline 5.1.1(v))
- In-app account deletion is available: Profile → "회원 탈퇴". It permanently deletes the account and personal data.

Permissions
- Location (when in use): to show the user's restaurants and nearby places on the map.
- Photo Library: to attach photos to a restaurant record.
- Notifications: to alert a partner when a new restaurant is added.
```

---

## 3. App Privacy 설문 가이드 (App Store Connect → App Privacy)

**공통**: 아래 모든 항목 — *Linked to the user(사용자 신원에 연결)* = **예**, *Used for tracking(추적)* = **아니오**. 사용 목적(Purpose)은 전부 **App Functionality(앱 기능)**.

| Apple 카테고리 | 세부 항목 | 비고 |
|---|---|---|
| Contact Info | **Email Address** | Apple/Google 로그인으로 계정 식별/인증에 사용(백엔드 보관). Apple "이메일 가리기"여도 선언. |
| User Content | **Photos or Videos** | 맛집 사진 |
| User Content | **Other User Content** | 메모, 맛집 이름/기록 |
| Location | **Precise Location** | 내 맛집·주변 맛집 지도 표시용. **추적 아님.** |
| Identifiers | **User ID** | 계정 식별자 |
| Identifiers | **Device ID** | 푸시 알림 토큰(기기 식별) — 푸시 기능용 |

**수집 안 함(선언 X)**: Health, Financial, Browsing History, Usage Data/분석, Diagnostics(크래시 리포팅 미사용), Search History(장소 검색어는 Kakao로 보내 결과만 받고 **저장 안 함** → 수집 X로 처리).

**Tracking(앱 추적 투명성)**: 광고/추적 SDK 없음 → "이 앱은 추적하지 않음".

> 참고: 장소/주변 검색어는 결과 조회 위해 Kakao(제3자) API로 전송되지만 저장하지 않는 일시적 데이터라 일반적으로 별도 선언 불요. 크래시/분석 도구를 추가하면 Diagnostics를 다시 선언해야 함.

---

## 4. 연령 등급 (Age Rating 설문)
- 모든 콘텐츠 문항(폭력·성적·도박·약물 등) → **None(없음)**
- Unrestricted Web Access(무제한 웹 접근) → **No** (앱 내 브라우저는 약관/개인정보 페이지와 지도 타일만 로드, 임의 웹서핑 아님)
- → 결과 **4+**
- UGC 관련(가이드 1.2): 콘텐츠가 **초대코드를 주고받은 두 사람에게만** 공개되는 비공개 구조라 공개 UGC 의무(신고·차단·검열)는 일반적으로 비해당. 리뷰어가 물으면 심사 노트의 "Privacy & user content" 문단으로 설명.

---

## 5. 기타 제출 체크
- [ ] 카테고리: 기본 **라이프스타일**(보조: 음식 및 음료 가능)
- [ ] 빌드: TestFlight 처리 완료 후 버전에 첨부
- [ ] 수출 규정: app.json `ITSAppUsesNonExemptEncryption=false` 반영됨 → 추가 질문 없이 통과
- [ ] 저작권: 예) `2026 muklog`
- [ ] 연락처(App Review): 본인 이메일·전화
- [ ] 스크린샷: 6.9" / 6.7" (SUIT 폰트·실데이터 반영 화면)
```
```
