// src/features/muklog/PlaceSearchField.tsx
// 장소검색 입력 + 결과/상태 영역 — 킷 mk-log.jsx PlaceSearch(383-414) 인라인 번역 (plan §4.1·§4.2).
//   킷은 전체화면 PlaceSearch(검색 인풋 pill + 결과 리스트)이나, RN은 MuklogEntrySheet(하단 시트) 컨텍스트라
//   같은 시각 어휘(돋보기 pill + 결과행)를 시트 내부 인라인으로 옮긴다(ui-spec §변환근거).
//   인풋 pill: 킷 mk-log:390 radius 999(full) + 1px --line + --mk-card → hairline·surface, 돋보기 18(fgMuted).
//   상태(plan §4.2): idle(미표시) / loading(스피너) / ready≥1(결과행) / ready 0건(안내) / error(인라인 안내).
//   토큰만(raw hex 0). 표시 전용 — 검색/디바운스/캐싱은 usePlaceSearch(developer), 선택→자동채움은 소비처.
import React from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';

import { Icon, IconName, Text } from '@/components';
import { useTheme } from '@/theme';

import { PlaceResultRow } from './PlaceResultRow';
import { type MuklogCategoryKey } from './categories';
import { type PlaceSearchItem } from './types';

/** 검색 UI 상태(plan §4.2). usePlaceSearch(developer).status와 1:1 — 거기서 import해도 됨. */
export type PlaceSearchStatus = 'idle' | 'loading' | 'ready' | 'error';

export type PlaceSearchFieldProps = {
  /** 검색어(controlled). usePlaceSearch.query. */
  query: string;
  /** 입력 변경 → developer 디바운스 트리거(usePlaceSearch.setQuery). */
  onChangeQuery: (text: string) => void;
  /** 검색 상태(plan §4.2). */
  status: PlaceSearchStatus;
  /** 최신 결과(빈 배열 = 0건/미검색). */
  results: PlaceSearchItem[];
  /** 결과 행 탭 → 선택. 소비처가 자동채움을 연결. */
  onSelectResult: ({ item }: { item: PlaceSearchItem }) => void;
  /** 결과 항목 → 매핑 카테고리(커버/라벨). 미지정 시 null(cafe 커버). developer가 mapKakaoCategory 주입. */
  resolveCategory?: ({ item }: { item: PlaceSearchItem }) => MuklogCategoryKey | string | null;
  /** error 상태 인라인 안내(§3.6 한국어 폴백 메시지). */
  errorMessage?: string | null;
  /** 입력 placeholder. 킷 mk-log:392 "장소, 음식점 검색". */
  placeholder?: string;
  /** 테스트/식별자. */
  testID?: string;
};

const SEARCH_ICON_SIZE = 18; // 킷 mk-log:391
const EMPTY_MESSAGE = '검색 결과가 없어요. 직접 입력해도 돼요.'; // plan §4.2

export const PlaceSearchField = ({
  query,
  onChangeQuery,
  status,
  results,
  onSelectResult,
  resolveCategory,
  errorMessage = null,
  placeholder = '장소, 음식점 검색',
  testID = 'place-search-field',
}: PlaceSearchFieldProps) => {
  const theme = useTheme();

  const inputStyle = {
    color: theme.color.fg,
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 15, // 킷 mk-log:393 500/15
  };

  return (
    <View testID={testID}>
      {/* 검색 인풋 pill — 킷 mk-log:390(radius 999 + 1px --line + --mk-card). */}
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
          style={[styles.input, inputStyle]}
        />
      </View>

      {/* 상태 영역 — idle은 미표시(기존 수동 입력 그대로). */}
      {status === 'loading' ? (
        <View style={[styles.stateRow, { marginTop: theme.spacing[12], gap: theme.spacing[8] }]}>
          <ActivityIndicator testID="place-search-spinner" color={theme.color.primary} />
          <Text variant="bodySm" color="fgMuted">
            검색 중…
          </Text>
        </View>
      ) : null}

      {status === 'error' && errorMessage ? (
        <Text
          variant="bodySm"
          color="fgMuted"
          style={{ marginTop: theme.spacing[12] }}
          testID="place-search-error"
        >
          {errorMessage}
        </Text>
      ) : null}

      {status === 'ready' && results.length === 0 ? (
        <Text
          variant="bodySm"
          color="fgMuted"
          style={{ marginTop: theme.spacing[12] }}
          testID="place-search-empty"
        >
          {EMPTY_MESSAGE}
        </Text>
      ) : null}

      {status === 'ready' && results.length > 0 ? (
        <View style={[styles.results, { marginTop: theme.spacing[8] }]} testID="place-search-results">
          {results.map((item, index) => (
            <PlaceResultRow
              key={item.kakaoPlaceId || `${item.placeName}-${index}`}
              testID={`place-result-${index}`}
              placeName={item.placeName}
              category={resolveCategory ? resolveCategory({ item }) : null}
              roadAddress={item.roadAddressName}
              address={item.addressName}
              onPress={() => onSelectResult({ item })}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, padding: 0 },
  stateRow: { flexDirection: 'row', alignItems: 'center' },
  results: {},
});
