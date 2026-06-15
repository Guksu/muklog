// src/features/map/toMuklogPin.ts
// RPC snake row → MuklogPin(camel) 매핑 (plan §3.4·§7 경계면).
//   생산자: list_my_muklog_pins RPC / 직접 select(snake). 소비자: useMuklogPins.
//   lat/lng는 RPC가 NOT NULL 보장하나, 문자열로 와도(드라이버 차이) Number로 안전 캐스팅한다.
import { type MuklogPin, type MuklogPinRow } from './types';

/**
 * list_my_muklog_pins RPC 행(snake_case)을 MuklogPin(camelCase)으로 매핑한다.
 * lat/lng는 Number로 캐스팅(문자열 응답 안전), nullable 필드는 null을 유지한다.
 * @param row RPC가 반환한 단일 행(좌표 NOT NULL 보장)
 * @returns 지도/카드가 소비하는 MuklogPin
 */
export const toMuklogPin = ({ row }: { row: MuklogPinRow }): MuklogPin => ({
  muklogId: row.muklog_id,
  roomId: row.room_id,
  placeName: row.place_name,
  category: row.category,
  area: row.area,
  rating: row.rating,
  lat: Number(row.lat),
  lng: Number(row.lng),
});
