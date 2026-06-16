// src/theme/tokens.spec.ts
// 토큰 정합(muklog 웜 변형 킷) 값 단언 — AC-1/2/5. (plan §6 A, T2 / ui-redesign 디테일 보정)
//   primary #3366FF · accentStrong #1F4FE0 · primaryWeak #EAF0FF · accentLine #BFD0FF · accentShadow rgba(51,102,255,.30)
//   · fg 웜잉크 #2A2422 / fgWeak #5C5550 · brand #0066FF · hairline·surfaceAlt·fgAssistive 키 존재
//   · radius.control=14 / card=22 / sheet=20 · shadow.card 웜 섀도우 · body 계열 family = Pretendard-Medium.
import { themes, radius, shadow, typography, brandGradient, authVisualGradient } from './tokens';

describe('tokens — 컬러 (muklog 웜 변형, AC-1)', () => {
  it('primary가 포인트 블루 #3366FF다', () => {
    expect(themes.light.color.primary).toBe('#3366FF');
  });

  it('accentStrong가 강조 블루 #1F4FE0(배지·CTA 텍스트)다', () => {
    expect(themes.light.color.accentStrong).toBe('#1F4FE0');
  });

  it('primaryWeak가 muklog accent-weak #EAF0FF다', () => {
    expect(themes.light.color.primaryWeak).toBe('#EAF0FF');
  });

  it('accentLine이 점선 보더용 #BFD0FF다', () => {
    expect(themes.light.color.accentLine).toBe('#BFD0FF');
  });

  it('accentShadow가 primary 버튼 그림자 rgba(51,102,255,0.30)다', () => {
    expect(themes.light.color.accentShadow).toBe('rgba(51,102,255,0.30)');
  });

  it('fg/fgWeak가 웜 잉크(#2A2422/#5C5550)다', () => {
    expect(themes.light.color.fg).toBe('#2A2422');
    expect(themes.light.color.fgWeak).toBe('#5C5550');
  });

  it('brand가 시그니처 블루 #0066FF로 분리되어 있다', () => {
    expect(themes.light.color.brand).toBe('#0066FF');
  });
});

describe('tokens — 신규 시맨틱 키 (AC-2)', () => {
  it('hairline / hairlineAlt / surfaceAlt / fgAssistive 키가 존재한다', () => {
    const { color } = themes.light;
    expect(color.hairline).toBeDefined();
    expect(color.hairlineAlt).toBeDefined();
    expect(color.surfaceAlt).toBeDefined();
    expect(color.fgAssistive).toBeDefined();
  });

  it('hairline은 반투명 헤어라인 색(rgba 112,115,124,.22)이다', () => {
    expect(themes.light.color.hairline).toBe('rgba(112,115,124,0.22)');
  });

  it('surface가 카드면(white)으로 재정의된다', () => {
    expect(themes.light.color.surface).toBe('#FFFFFF');
  });
});

describe('tokens — radius (muklog 킷)', () => {
  it('control=14 / card=22 / sheet=20가 정의된다', () => {
    expect(radius.control).toBe(14);
    expect(radius.card).toBe(22);
    expect(radius.sheet).toBe(20);
  });

  it('action=18(AddSheet 액션 카드)가 정의된다', () => {
    expect(radius.action).toBe(18);
  });
});

describe('tokens — negative (파괴 액션색, muklog-edit 삭제 CTA)', () => {
  it('negative가 킷 status-negative #E5484D다(삭제하기 버튼/MenuRow danger)', () => {
    expect(themes.light.color.negative).toBe('#E5484D');
  });

  it('negativeFg가 삭제 버튼 글자 흰색 #FFFFFF다', () => {
    expect(themes.light.color.negativeFg).toBe('#FFFFFF');
  });

  it('negative는 error(#FF4242)/errorStrong(#E52222)과 의미·값이 분리된다', () => {
    expect(themes.light.color.negative).not.toBe(themes.light.color.error);
    expect(themes.light.color.negative).not.toBe(themes.light.color.errorStrong);
  });
});

describe('tokens — starFill (Stars 채움색, A6)', () => {
  it('채운 별 색이 킷 #FFB23E다(warning #FF9200과 구분)', () => {
    expect(themes.light.color.starFill).toBe('#FFB23E');
    expect(themes.light.color.starFill).not.toBe(themes.light.color.warning);
  });
});

describe('tokens — mapNearbyPin (지도 주변 음식점 핀/범례 dot, map-tab)', () => {
  it('주변 음식점 dot 색이 킷 웜그레이 #B6ABA0다(fgMuted 쿨뉴트럴과 구분)', () => {
    expect(themes.light.color.mapNearbyPin).toBe('#B6ABA0');
    expect(themes.light.color.mapNearbyPin).not.toBe(themes.light.color.fgMuted);
  });

  it('라이트/다크 공통(지도 위 마커라 톤 고정)', () => {
    expect(themes.dark.color.mapNearbyPin).toBe('#B6ABA0');
  });
});

describe('tokens — mapLocate (지도 현재위치 FAB 아이콘 블루, map-locate-button)', () => {
  it('locate FAB 아이콘색이 킷 verbatim #3B82F6다(브랜드 primary #3366FF와 구분)', () => {
    expect(themes.light.color.mapLocate).toBe('#3B82F6');
    expect(themes.light.color.mapLocate).not.toBe(themes.light.color.primary);
  });

  it('라이트/다크 공통(흰 surface FAB 위 고정 톤)', () => {
    expect(themes.dark.color.mapLocate).toBe('#3B82F6');
  });
});

describe('tokens — splashBg (브랜드 스플래시 배경, brand-assets)', () => {
  it('스플래시 배경 토큰이 킷 splash 상단 라이트블루 #EBF1FF다', () => {
    expect(themes.light.color.splashBg).toBe('#EBF1FF');
  });
});

describe('tokens — shadow.card (muklog 소프트 웜 섀도우)', () => {
  it('카드용 웜 섀도우(베이스 #785A46) 토큰이 존재한다', () => {
    expect(shadow.card).toBeDefined();
    expect(shadow.card.shadowColor).toBe('#785A46');
    expect(shadow.card.elevation).toBe(2);
  });
});

describe('tokens — 인증(social-auth) 토큰 (킷 mk-auth.jsx)', () => {
  it('brandGradient가 킷 AppMark 블루 그라데이션 [#5B85FF, #2A55E6]이다', () => {
    expect(brandGradient).toEqual(['#5B85FF', '#2A55E6']);
  });

  it('authVisualGradient가 킷 스플래시/로그인 상단 비주얼 [#EAF0FF, #FFFFFF]이다', () => {
    expect(authVisualGradient).toEqual(['#EAF0FF', '#FFFFFF']);
  });

  it('lineStrong이 킷 SocialButton 보더(--line-strong rgba 112,115,124,.52)다', () => {
    expect(themes.light.color.lineStrong).toBe('rgba(112,115,124,0.52)');
  });

  it('소셜 버튼 색 토큰(apple 검정/google 흰+잉크)이 킷 값이다', () => {
    const { color } = themes.light;
    expect(color.socialAppleBg).toBe('#000000');
    expect(color.socialAppleFg).toBe('#FFFFFF');
    expect(color.socialGoogleBg).toBe('#FFFFFF');
    expect(color.socialGoogleFg).toBe('#1F1F1F');
  });
});

describe('tokens — 다크 미러링 (엣지1)', () => {
  it('darkColor도 신규 키를 동일하게 보유한다(키 누락 방지)', () => {
    const lightKeys = Object.keys(themes.light.color).sort();
    const darkKeys = Object.keys(themes.dark.color).sort();
    expect(darkKeys).toEqual(lightKeys);
  });
});

describe('tokens — typography (AC-5)', () => {
  it('body/bodyLg/bodySm의 기본 family가 Pretendard-Medium이다', () => {
    expect(typography.body.fontFamily).toBe('Pretendard-Medium');
    expect(typography.bodyLg.fontFamily).toBe('Pretendard-Medium');
    expect(typography.bodySm.fontFamily).toBe('Pretendard-Medium');
  });

  it('muklog 킷 역할 토큰(wordmark/cardTitle/emptyTitle/badge)의 크기를 정합한다', () => {
    expect(typography.wordmark.fontSize).toBe(26);
    expect(typography.cardTitle.fontSize).toBe(17);
    expect(typography.emptyTitle.fontSize).toBe(21);
    expect(typography.badge.fontSize).toBe(12);
  });

  it('sectionTitle이 킷 섹션 헤더 800/19(Bold)다 (LogScreen "우리 맛집 N")', () => {
    expect(typography.sectionTitle.fontSize).toBe(19);
    expect(typography.sectionTitle.fontFamily).toBe('Pretendard-Bold');
  });

  it('navTitle이 킷 로그 헤더 700/16(Bold)다 (LogScreen 헤더 로그명, 킷 mk-log:25)', () => {
    expect(typography.navTitle.fontSize).toBe(16);
    expect(typography.navTitle.fontFamily).toBe('Pretendard-Bold');
  });

  it('ui-fidelity-audit 추가 역할 토큰이 킷 실값과 정합한다', () => {
    // 시트 타이틀 700/18(킷 mk-ui:167), 상세 섹션 800/16(mk-log:175), 필드 라벨 800/15(mk-log:373).
    expect(typography.sheetTitle.fontSize).toBe(18);
    expect(typography.sheetTitle.fontFamily).toBe('Pretendard-Bold');
    expect(typography.sectionLabel.fontSize).toBe(16);
    expect(typography.sectionLabel.fontFamily).toBe('Pretendard-Bold');
    expect(typography.fieldLabel.fontSize).toBe(15);
    // 메모 본문 500/15(mk-log:177), 별점 숫자 700/15(mk-log:165).
    expect(typography.memoBody.fontSize).toBe(15);
    expect(typography.memoBody.fontFamily).toBe('Pretendard-Medium');
    expect(typography.ratingNum.fontSize).toBe(15);
    // 초대코드 800/26(mk-home:225), 프로필 닉네임 800/22(mk-log:440).
    expect(typography.inviteCode.fontSize).toBe(26);
    expect(typography.profileName.fontSize).toBe(22);
  });
});

describe('tokens — fillAlt (세그먼트 트랙, wishlist)', () => {
  it('세그먼트 트랙 배경이 킷 --fill-alt rgba(112,115,124,.05)다(mk-log:58)', () => {
    expect(themes.light.color.fillAlt).toBe('rgba(112,115,124,0.05)');
  });

  it('fillAlt(채움)는 hairlineAlt(.08 라인)와 의미·값이 분리된다', () => {
    expect(themes.light.color.fillAlt).not.toBe(themes.light.color.hairlineAlt);
  });

  it('다크 세그 트랙은 더 진한 rgba(112,115,124,.12)다', () => {
    expect(themes.dark.color.fillAlt).toBe('rgba(112,115,124,0.12)');
  });
});

describe('tokens — shadow.seg (세그먼트 선택칸, wishlist)', () => {
  it('선택칸 그림자가 킷 mk-log:65(0 1px 4px rgba(0,0,0,.08)) 정합이다', () => {
    expect(shadow.seg.shadowOpacity).toBe(0.08);
    expect(shadow.seg.shadowRadius).toBe(4);
    expect(shadow.seg.shadowOffset).toEqual({ width: 0, height: 1 });
  });

  it('seg는 카드 섀도우(shadow.card)와 분리된 떠있는 컨트롤 전용이다', () => {
    expect(shadow.seg).not.toBe(shadow.card);
  });
});

describe('tokens — toast (하단 플로팅 토스트, wishlist)', () => {
  it('neutral 배경이 킷 .mk-toast --mk-ink #2A2422다(index.html:39)', () => {
    expect(themes.light.color.toastBg).toBe('#2A2422');
  });

  it('positive 배경이 킷 .mk-toast.pos #1E7A47다(index.html:42)', () => {
    expect(themes.light.color.toastPositiveBg).toBe('#1E7A47');
  });

  it('positive 토스트색은 success(#00BF40)/successStrong과 의미·값이 분리된다', () => {
    expect(themes.light.color.toastPositiveBg).not.toBe(themes.light.color.success);
    expect(themes.light.color.toastPositiveBg).not.toBe(themes.light.color.successStrong);
  });

  it('인버스 pill이라 라이트/다크 공통이다(항상 어두운 배경)', () => {
    expect(themes.dark.color.toastBg).toBe('#2A2422');
    expect(themes.dark.color.toastPositiveBg).toBe('#1E7A47');
  });

  it('shadow.toast가 킷 .mk-toast(0 10px 30px rgba(0,0,0,.28)) 정합이다', () => {
    expect(shadow.toast.shadowOpacity).toBe(0.28);
    expect(shadow.toast.shadowRadius).toBe(30);
    expect(shadow.toast.shadowOffset).toEqual({ width: 0, height: 10 });
  });
});

describe('tokens — scrimStrong (킷 정합)', () => {
  it('사진 위 글래스 배지 scrim 불투명도가 킷 .32다(mk-log:94)', () => {
    expect(themes.light.color.scrimStrong).toBe('rgba(0,0,0,0.32)');
  });
});

describe('tokens — spacing 보강', () => {
  it('4px 그리드에 28이 포함된다', () => {
    // 동적 import로 spacing 참조 — 28 보강 확인.
    const { spacing } = require('./tokens');
    expect(spacing[28]).toBe(28);
  });

  it('킷 보강 spacing 7·18·22·26이 포함된다(plan A8 / 에디터 필드 gap 22)', () => {
    const { spacing } = require('./tokens');
    expect(spacing[7]).toBe(7);
    expect(spacing[18]).toBe(18);
    expect(spacing[22]).toBe(22); // 킷 mk-log:299 에디터 필드 그룹 gap 22
    expect(spacing[26]).toBe(26);
  });
});

describe('tokens — fgDisabled (킷 --text-disable)', () => {
  it('비활성 텍스트색이 킷 --text-disable rgba(55,56,60,.16)다(figma-variables.css:207)', () => {
    expect(themes.light.color.fgDisabled).toBe('rgba(55,56,60,0.16)');
  });
});
