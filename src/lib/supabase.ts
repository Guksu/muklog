// src/lib/supabase.ts
// Supabase 클라이언트(단일 인스턴스). 세션은 AsyncStorage에 영속 → 재실행 시 동일 사용자 유지.
// anon 키는 공개되어도 안전 — 실제 접근 통제는 RLS가 담당한다.
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import { env } from './env';

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    // RN에는 URL 세션 콜백이 없으므로 비활성(웹 전용 기능).
    detectSessionInUrl: false,
    // OAuth 웹 플로우(Google)는 PKCE — signInWithOAuth가 code verifier를 storage에 저장하고,
    // 리다이렉트의 ?code= 를 exchangeCodeForSession이 교환한다(native idToken nonce 한계 회피).
    flowType: 'pkce',
  },
});
