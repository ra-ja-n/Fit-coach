// FitCoach UI kit — light, clean, generous whitespace. No gradients, no blur.
import { Text, View } from 'react-native';
import { C, R } from '../../theme/tokens';

export function Badge({ label, tone = 'green' }: { label: string; tone?: 'green' | 'amber' | 'red' | 'gray' | 'blue' }) {
  const tones: Record<string, { bg: string; fg: string }> = {
    green: { bg: C.primarySoft, fg: C.primaryDark },
    amber: { bg: C.accentSoft, fg: C.accentInk },
    red: { bg: C.dangerSoft, fg: C.danger },
    gray: { bg: C.surfaceAlt, fg: C.sub },
    blue: { bg: C.blueSoft, fg: C.blue },
  };
  const t = tones[tone];
  return (
    <View style={{ backgroundColor: t.bg, borderRadius: R.full, paddingHorizontal: 9, paddingVertical: 4, alignSelf: 'flex-start' }}>
      <Text style={{ color: t.fg, fontSize: 11.5, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}
