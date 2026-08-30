// FitCoach design tokens — light theme, one primary + two accents + neutral grays.
// Defined once; every screen consumes these. No gradients, no glassmorphism.

export const C = {
  bg: '#F6F7F4',
  /** Full-screen photo viewer backdrop — a shade darker than bg. */
  photoBackdrop: '#F1F3EF',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF1EC',
  ink: '#182420',
  sub: '#5A6A63',
  faint: '#96A49D',
  line: '#E3E8E1',
  lineSoft: '#EDF0EA',

  primary: '#0E7C5A',
  primaryDark: '#0A5C43',
  primarySoft: '#E1F0E9',

  accent: '#D9962B',
  accentSoft: '#FBF0DB',
  /** Border for cards that sit on accentSoft. */
  accentLine: '#F0DFBC',
  /** Dark text/icon colour that stays legible on accentSoft. */
  accentInk: '#9A6712',
  /** Body copy on accentSoft — softer than accentInk, for longer paragraphs. */
  accentDeep: '#6B4A0E',

  danger: '#D6455D',
  dangerSoft: '#FBE7EA',
  /** Error icon/tint that reads on top of the primary (dark) bubble. */
  dangerOnPrimary: '#FFD7DD',

  blue: '#3E7CB1',
  blueSoft: '#E7F0F8',

  white: '#FFFFFF',
} as const;

export const R = { sm: 10, md: 14, lg: 18, xl: 24, full: 999 } as const;

export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 36 } as const;

export const SHADOW = {
  card: {
    shadowColor: '#182420',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  float: {
    shadowColor: '#182420',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
} as const;

export const TYPE = {
  h1: { fontSize: 27, fontWeight: '800' as const, color: C.ink, letterSpacing: -0.5 },
  h2: { fontSize: 21, fontWeight: '700' as const, color: C.ink, letterSpacing: -0.3 },
  h3: { fontSize: 17, fontWeight: '700' as const, color: C.ink },
  body: { fontSize: 15, fontWeight: '500' as const, color: C.ink, lineHeight: 21 },
  sub: { fontSize: 14, fontWeight: '500' as const, color: C.sub, lineHeight: 19 },
  caption: { fontSize: 12, fontWeight: '600' as const, color: C.faint },
};

export const AVATAR_HUES = [158, 28, 205, 340, 262, 96, 12, 186];
export function avatarColor(seed: string): { bg: string; fg: string } {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const hue = AVATAR_HUES[Math.abs(h) % AVATAR_HUES.length];
  return { bg: `hsl(${hue}, 42%, 90%)`, fg: `hsl(${hue}, 48%, 30%)` };
}
