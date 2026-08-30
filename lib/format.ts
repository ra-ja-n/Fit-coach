import { format, formatDistanceToNowStrict, differenceInCalendarDays, parseISO, isToday, isYesterday } from 'date-fns';

export function money(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function fmtDate(iso: string): string {
  try {
    return format(parseISO(iso), 'MMM d, yyyy');
  } catch {
    return iso;
  }
}

export function fmtDay(iso: string): string {
  try {
    return format(parseISO(iso), 'EEE, MMM d');
  } catch {
    return iso;
  }
}

export function fmtTime(iso: string): string {
  try {
    return format(parseISO(iso), 'h:mm a');
  } catch {
    return '';
  }
}

export function timeAgo(iso: string | null): string {
  if (!iso) return '';
  try {
    return formatDistanceToNowStrict(parseISO(iso), { addSuffix: true });
  } catch {
    return '';
  }
}

export function dayLabel(iso: string): string {
  try {
    const d = parseISO(iso);
    if (isToday(d)) return 'Today';
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'EEEE, MMM d');
  } catch {
    return iso;
  }
}

export function daysLeft(endIso: string): number {
  return differenceInCalendarDays(parseISO(endIso), new Date());
}

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

export function firstName(name: string): string {
  return name.split(' ')[0] || name;
}
