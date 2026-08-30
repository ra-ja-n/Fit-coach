// FitCoach UI kit — light, clean, generous whitespace. No gradients, no blur.
import { Text, View } from 'react-native';
import { avatarColor } from '../../theme/tokens';
import { initials } from '../../lib/format';

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const c = avatarColor(name);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: c.fg, fontSize: size * 0.36, fontWeight: '800' }}>{initials(name)}</Text>
    </View>
  );
}
