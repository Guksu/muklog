// src/features/muklog/PlaceSearchView.tsx
// 장소검색 풀스크린 뷰 — 킷 mk-log.jsx:383-414 PlaceSearch 재현 (FLAG-1b, 에디터 searching 스왑).
//   킷 구조: 헤더(뒤로 IconBtn + 검색 pill) + 스크롤(섹션 라벨 + 결과 리스트). 상태(plan §4.2): loading/empty/error.
//   표시 전용(controlled) — query/results/status/onSelectResult는 developer(usePlaceSearch)가 주입,
//     searching 진입/복귀 상태머신은 컨테이너(MuklogEditor)가 소유(onBack=복귀). 토큰만(raw hex 0), 이모지 허용.
import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, IconName, IconButton, MotionPressable, Screen, Text } from '@/components';
import { useTheme } from '@/theme';

import { PlaceResultRow } from '../PlaceResultRow';
import { type MuklogCategoryKey } from '../categories';
import { mapKakaoCategory } from '../kakaoCategory';
import { type PlaceSearchItem, type PlaceSearchStatus } from '../types';

// resolveCategory 미주입 시 기본 해석 — Kakao 브레드크럼을 9종 enum으로 매핑(미매핑 null).
//   ⚠️ #7 근본원인 2: 위시리스트 검색(LogScreen)이 resolveCategory를 안 넘겨 모든 결과가 category=null → cafe 커버였다.
//   기본값을 mapKakaoCategory로 둬 전 소비처(에디터·위시)에서 일관 동작(에디터의 defaultResolveCategory와 동치).
const resolveByKakaoCategory = ({ item }: { item: PlaceSearchItem }): MuklogCategoryKey | null =>
  mapKakaoCategory({ categoryName: item.categoryName, categoryGroupCode: item.categoryGroupCode });

const SEARCH_ICON_SIZE = 18; // 킷 mk-log:391
const EMPTY_MESSAGE = '검색 결과가 없어요. 직접 입력해도 돼요.'; // plan §4.2
const IDLE_LABEL = '장소 이름을 검색해 보세요'; // 킷 "연남동 주변 추천"(목업) 대체 — 일반 안내

// 눌림 불투명도 — 치환 전 로컬 styles.pressed 실값 승계(비주얼 회귀 0). 등급은 lg(전폭 보더 행). ui-spec §2-2 A10.
const MANUAL_ROW_PRESSED_OPACITY = 0.6;

// 제출 진행 중(U6-b) 기본 문구 — 소비처가 submittingLabel로 흐름별 카피를 주입한다(위시=담는 중…).
const DEFAULT_SUBMITTING_LABEL = '처리 중…';
// 비활성 dim — PlaceResultRow와 같은 Button 비활성 실값(0.45) 승계. 신규 실값 0(plan §4-3).
const MANUAL_ROW_DISABLED_OPACITY = 0.45;

export type PlaceSearchViewProps = {
  /** 검색어(controlled). usePlaceSearch.query. */
  query: string;
  /** 입력 변경 → developer 디바운스 트리거(usePlaceSearch.setQuery). */
  onChangeQuery: (text: string) => void;
  /** 검색 상태(plan §4.2). */
  status: PlaceSearchStatus;
  /** 최신 결과(빈 배열 = 0건/미검색). */
  results: PlaceSearchItem[];
  /** 결과 행 탭 → 선택(컨테이너가 자동채움 + searching 복귀). */
  onSelectResult: ({ item }: { item: PlaceSearchItem }) => void;
  /** 결과 항목 → 매핑 카테고리(커버/라벨). developer가 mapKakaoCategory 주입. */
  resolveCategory?: ({ item }: { item: PlaceSearchItem }) => MuklogCategoryKey | string | null;
  /** error 상태 인라인 안내(usePlaceSearch.errorMessage). */
  errorMessage?: string | null;
  /** 뒤로/취소 → 에디터로 복귀(searching=false). */
  onBack: () => void;
  /** 뒤로 버튼 접근성 라벨. 기본 '뒤로 가기'(에디터 검색 스왑에선 '검색 취소'). */
  backLabel?: string;
  /** "직접 입력" 폴백(plan §4.2) — 검색어 있고 0건/에러일 때 노출. 탭→검색어를 장소명 채택(developer가 좌표 null + 복귀). */
  onUseManualInput?: () => void;
  /** 입력 placeholder. 킷 mk-log:392. */
  placeholder?: string;
  /** 제출(위시 담기) 진행 중 — 결과행·직접입력행 비활성 + 진행 표시(U6-b). 기본 false.
   *  ⚠️ optional: 장소 선택이 동기라 제출 개념이 없는 MuklogEditor는 넘기지 않는다(검색뷰 회귀 0). */
  submitting?: boolean;
  /** 진행 표시 문구. submitting=true일 때만 렌더. 기본 '처리 중…'. */
  submittingLabel?: string;
};

export const PlaceSearchView = ({
  query,
  onChangeQuery,
  status,
  results,
  onSelectResult,
  resolveCategory = resolveByKakaoCategory,
  errorMessage = null,
  onBack,
  backLabel = '뒤로 가기',
  onUseManualInput,
  placeholder = '장소, 음식점 검색',
  submitting = false,
  submittingLabel = DEFAULT_SUBMITTING_LABEL,
}: PlaceSearchViewProps) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // §4.2 "직접 입력" — 검색어가 있고 (ready+0건 || error)일 때 노출(developer 폴백 계약과 정합).
  const manualName = query.trim();
  const showManual =
    !!onUseManualInput &&
    manualName.length > 0 &&
    ((status === 'ready' && results.length === 0) || status === 'error');

  return (
    // 'bottom' 제외: 비-GNB 엣지투엣지 하단 빈 띠 방지 — 결과 리스트 paddingBottom+insets.bottom으로 인디케이터 클리어.
    <Screen edges={['left', 'right']} style={styles.screen}>
      {/* 헤더 — 킷 mk-log:388: 뒤로(chevron-left 24) + 검색 pill(flex 1). paddingTop SP→inset. */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.color.bg,
            paddingTop: insets.top + theme.spacing[8],
            paddingLeft: theme.spacing[8],
            paddingRight: theme.spacing[16],
            paddingBottom: theme.spacing[10],
            gap: theme.spacing[8],
          },
        ]}
      >
        <IconButton name={IconName.ChevronLeft} size={24} color="fg" accessibilityLabel={backLabel} onPress={onBack} />
        {/* 검색 pill — 킷 mk-log:390(radius full + hairline + surface, pad 10/16). */}
        <View
          style={[
            styles.pill,
            {
              backgroundColor: theme.color.surface,
              borderColor: theme.color.hairline,
              borderRadius: theme.radius.full,
              paddingVertical: theme.spacing[10],
              paddingHorizontal: theme.spacing[16],
              gap: theme.spacing[8],
            },
          ]}
        >
          <Icon name={IconName.Search} size={SEARCH_ICON_SIZE} color="fgMuted" />
          <TextInput
            accessibilityLabel="장소 검색"
            value={query}
            onChangeText={onChangeQuery}
            placeholder={placeholder}
            placeholderTextColor={theme.color.fgMuted}
            returnKeyType="search"
            autoFocus
            style={[styles.input, { color: theme.color.fg, fontFamily: theme.typography.body.fontFamily }]}
          />
        </View>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll}>
        {/* 섹션 라벨 — 킷 mk-log:397: q면 "'{q}' 검색 결과", 아니면 안내(목업 "연남동 주변 추천" 대체). */}
        <Text
          variant="meta"
          color="fgMuted"
          style={{ paddingTop: theme.spacing[4], paddingHorizontal: theme.spacing[20], paddingBottom: theme.spacing[8] }}
        >
          {query ? `'${query}' 검색 결과` : IDLE_LABEL}
        </Text>

        {status === 'loading' ? (
          <View style={[styles.stateRow, { paddingHorizontal: theme.spacing[20], gap: theme.spacing[8] }]}>
            <ActivityIndicator testID="place-search-spinner" color={theme.color.primary} />
            <Text variant="bodySm" color="fgMuted">
              검색 중…
            </Text>
          </View>
        ) : null}

        {/* 제출 진행 행(U6-b, 원칙 3 즉각 피드백) — 위 'loading' 행과 같은 마크업·간격을 그대로 승계한다(신규 실값 0).
            D1: 행별 스피너가 아니라 상단 상태 행 하나 — 어느 행을 담는 중인지는 탭한 사용자가 이미 알고,
            결과행 내부에 스피너를 넣으면 킷 레이아웃(mk-log:402-409)을 건드리게 된다. */}
        {submitting ? (
          <View style={[styles.stateRow, { paddingHorizontal: theme.spacing[20], gap: theme.spacing[8] }]}>
            <ActivityIndicator testID="place-search-submitting-spinner" color={theme.color.primary} />
            <Text variant="bodySm" color="fgMuted">
              {submittingLabel}
            </Text>
          </View>
        ) : null}

        {status === 'error' && errorMessage ? (
          <Text
            variant="bodySm"
            color="fgMuted"
            testID="place-search-error"
            style={{ paddingHorizontal: theme.spacing[20] }}
          >
            {errorMessage}
          </Text>
        ) : null}

        {status === 'ready' && results.length === 0 ? (
          <Text
            variant="bodySm"
            color="fgMuted"
            testID="place-search-empty"
            style={{ paddingHorizontal: theme.spacing[20] }}
          >
            {EMPTY_MESSAGE}
          </Text>
        ) : null}

        {showManual ? (
          // §4.2 "직접 입력" 폴백 행 — 킷 결과행 톤(accent). 검색어를 장소명으로 채택.
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel="직접 입력"
            accessibilityState={{ disabled: submitting }}
            disabled={submitting}
            onPress={onUseManualInput}
            pressSize="lg"
            pressedOpacity={MANUAL_ROW_PRESSED_OPACITY}
            style={[
              styles.manualRow,
              {
                borderColor: theme.color.hairline,
                borderRadius: theme.radius.control,
                marginHorizontal: theme.spacing[20],
                marginTop: theme.spacing[12],
                paddingVertical: theme.spacing[14],
                paddingHorizontal: theme.spacing[16],
                opacity: submitting ? MANUAL_ROW_DISABLED_OPACITY : 1,
              },
            ]}
          >
            <Text variant="body" color="accentStrong">
              ‘{manualName}’(으)로 직접 입력
            </Text>
          </MotionPressable>
        ) : null}

        {status === 'ready' && results.length > 0 ? (
          // 킷 mk-log:400 결과 리스트 padding 0/12/24(+insets.bottom 인디케이터 클리어).
          <View style={{ paddingHorizontal: theme.spacing[12], paddingBottom: theme.spacing[24] + insets.bottom }}>
            {results.map((resultItem, index) => (
              <PlaceResultRow
                key={resultItem.kakaoPlaceId || `${resultItem.placeName}-${index}`}
                testID={`place-result-${index}`}
                placeName={resultItem.placeName}
                category={resolveCategory({ item: resultItem })}
                roadAddress={resultItem.roadAddressName}
                address={resultItem.addressName}
                disabled={submitting}
                onPress={() => onSelectResult({ item: resultItem })}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: { padding: 0 },
  header: { flexDirection: 'row', alignItems: 'center' },
  pill: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, padding: 0, fontSize: 15 }, // 킷 mk-log:393 500/15
  scroll: { flex: 1 },
  stateRow: { flexDirection: 'row', alignItems: 'center' },
  manualRow: { borderWidth: StyleSheet.hairlineWidth },
});
