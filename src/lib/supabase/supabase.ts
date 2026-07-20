// src/lib/supabase.ts
// Supabase 클라이언트(단일 인스턴스). 세션은 SecureStore(Keychain/Keystore)에 영속 → 재실행 시 동일 사용자 유지.
// anon 키는 공개되어도 안전 — 실제 접근 통제는 RLS가 담당한다.
//
// 세션 저장은 AsyncStorage(평문) 대신 expo-secure-store(하드웨어 보호)로 둔다(보안 하드닝). 어댑터가 SecureStore
// 2KB 청킹과 레거시 AsyncStorage 마이그레이션(업데이트 후 로그인 유지)을 흡수한다 — createSecureStorage 참조.
// ⚠️ 네이티브 SecureStore 실동작(Keystore 가용성·용량)은 디바이스 스모크에서 검증한다.
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';

import { createSecureStorage } from '../secureStorage';
import { env } from '../env';

// SecureStore(하드웨어 보호) 기반 세션 저장소 — 레거시 AsyncStorage 는 최초 1회 마이그레이션 소스로만 주입.
const secureStorage = createSecureStorage({
  secureStore: {
    getItemAsync: (key) => SecureStore.getItemAsync(key),
    setItemAsync: (key, value) => SecureStore.setItemAsync(key, value),
    deleteItemAsync: (key) => SecureStore.deleteItemAsync(key),
  },
  legacyStore: {
    getItem: (key) => AsyncStorage.getItem(key),
    removeItem: (key) => AsyncStorage.removeItem(key),
  },
});

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: {
    storage: secureStorage,
    persistSession: true,
    autoRefreshToken: true,
    // RN에는 URL 세션 콜백이 없으므로 비활성(웹 전용 기능).
    detectSessionInUrl: false,
    // OAuth 웹 플로우(Google)는 PKCE — signInWithOAuth가 code verifier를 storage에 저장하고,
    // 리다이렉트의 ?code= 를 exchangeCodeForSession이 교환한다(native idToken nonce 한계 회피).
    flowType: 'pkce',
  },
});
