// Turns a thread into the row list an *inverted* FlatList renders.
//
// Data is ordered NEWEST-FIRST because index 0 renders at the BOTTOM. That puts
// the newest message at the bottom (like WhatsApp) and day separators visually
// above their day's messages. Pure and side-effect free so the ordering rule can
// be reasoned about (and tested) without React.

import type { ChatMessage } from './api/types';
import { dayLabel } from './format';

export interface PendingMsg {
  tempId: string;
  body: string;
  status: 'sending' | 'failed';
}

export type ChatRow =
  | { kind: 'msg'; msg: ChatMessage }
  | { kind: 'pending'; p: PendingMsg }
  | { kind: 'day'; label: string; key: string };

export function buildChatRows(messages: ChatMessage[], pending: PendingMsg[]): ChatRow[] {
  const items: ChatRow[] = [];
  const newestFirst = [...messages].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  let lastDay = '';
  for (const m of newestFirst) {
    const day = m.createdAt.slice(0, 10);
    if (day !== lastDay) {
      if (lastDay) items.push({ kind: 'day', label: dayLabel(lastDay), key: `day_${lastDay}` });
      lastDay = day;
    }
    items.push({ kind: 'msg', msg: m });
  }
  if (lastDay) items.push({ kind: 'day', label: dayLabel(lastDay), key: `day_${lastDay}` });

  // Pending (optimistic) messages sit at the very bottom, newest last.
  for (const p of [...pending].reverse()) items.unshift({ kind: 'pending', p });
  return items;
}

export function chatRowKey(row: ChatRow, index: number): string {
  if (row.kind === 'msg') return row.msg.id;
  if (row.kind === 'pending') return row.p.tempId;
  return row.key + index;
}
