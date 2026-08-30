// Role-based root navigator. The single gate deciding which navigator a user
// ever sees: unauthenticated -> auth stack; otherwise strictly by role.
import React, { useEffect } from 'react';
import { ActivityIndicator, Modal, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../state/authStore';
import { useUIStore } from '../state/uiStore';
import { subscribeRealtime } from '../lib/api/realtime';
import { navigationRef } from './ref';
import { C, R, S, SHADOW, TYPE } from '../theme/tokens';
import { Button } from '../components/ui';
import AuthNavigator from './AuthNavigator';
import ClientNavigator from './ClientNavigator';
import CoachNavigator from './CoachNavigator';
import AdminNavigator from './AdminNavigator';

function BootSplash() {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#fff" />
      </View>
      <Text style={[TYPE.h3, { marginTop: S.lg }]}>FitCoach</Text>
    </View>
  );
}

// Global overlay: renewal prompt when a gated action hits a lapsed sub.
function RenewPromptHost() {
  const prompt = useUIStore((s) => s.renewPrompt);
  const clear = useUIStore((s) => s.clearRenewPrompt);
  const role = useAuthStore((s) => s.user?.role);

  return (
    <Modal visible={!!prompt} transparent animationType="fade" onRequestClose={clear}>
      <View style={{ flex: 1, backgroundColor: 'rgba(24,36,32,0.45)', alignItems: 'center', justifyContent: 'center', padding: S.xl }}>
        <View style={{ backgroundColor: C.surface, borderRadius: R.xl, padding: S.xxl, width: '100%', maxWidth: 380, ...SHADOW.float }}>
          <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: S.lg }}>
            <Text style={{ fontSize: 24 }}>⏳</Text>
          </View>
          <Text style={TYPE.h2}>{prompt?.message ?? 'Your coaching plan has ended'}</Text>
          <Text style={[TYPE.sub, { marginTop: S.sm, lineHeight: 20 }]}>
            Your existing plans and history stay available read-only. Renew to restore messaging and updates.
          </Text>
          {role === 'client' && prompt?.coachId ? (
            <Button
              label={`Renew with ${prompt.coachName}`}
              style={{ marginTop: S.xl }}
              onPress={() => {
                clear();
                if (navigationRef.isReady()) {
                  navigationRef.navigate('CoachDetail', { coachId: prompt.coachId! });
                }
              }}
            />
          ) : null}
          <Button label="Not now" variant="ghost" style={{ marginTop: S.sm }} onPress={clear} />
        </View>
      </View>
    </Modal>
  );
}

export default function RootNavigator() {
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const qc = useQueryClient();

  // Realtime fan-out: every push from the backend's STOMP broker invalidates
  // the matching queries, so coach <-> client changes appear on both sides
  // without either of them polling.
  useEffect(() => {
    return subscribeRealtime((e) => {
      if (e.type === 'chat') {
        qc.invalidateQueries({ queryKey: ['chat', e.coachId, e.clientId] });
        qc.invalidateQueries({ queryKey: ['chat'] });
      } else if (e.type === 'progress') {
        qc.invalidateQueries({ queryKey: ['progress'] });
      } else if (e.type === 'plan') {
        qc.invalidateQueries({ queryKey: ['plans'] });
        qc.invalidateQueries({ queryKey: ['coach'] });
      } else if (e.type === 'subscription') {
        qc.invalidateQueries();
      }
    });
  }, [qc]);

  if (!hydrated) return <BootSplash />;

  return (
    <>
      {!user ? (
        <AuthNavigator />
      ) : user.role === 'client' ? (
        <ClientNavigator />
      ) : user.role === 'coach' ? (
        <CoachNavigator />
      ) : (
        <AdminNavigator />
      )}
      {user?.role === 'client' ? <RenewPromptHost /> : null}
    </>
  );
}
