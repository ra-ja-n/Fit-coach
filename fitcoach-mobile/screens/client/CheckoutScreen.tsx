// Checkout — sandbox Stripe flow. Activation happens ONLY via the simulated
// signed webhook (idempotent); the client polls payment status and never
// grants itself access.
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { request, handleWriteError } from '../../lib/api/api';
import { ApiError, errorMessage } from '../../lib/api/errors';
import type { CheckoutStatus, Package } from '../../lib/api/types';
import { useUIStore } from '../../state/uiStore';
import { Button, Card, ErrorState, LoadingView, TopBar } from '../../components/ui';
import { C, R, S, TYPE } from '../../theme/tokens';
import { money } from '../../lib/format';
import type { ClientStackParamList } from '../../navigation/types';

type Stage = 'review' | 'processing' | 'success' | 'declined';

export default function CheckoutScreen({ route, navigation }: NativeStackScreenProps<ClientStackParamList, 'Checkout'>) {
  const { packageId } = route.params;
  const qc = useQueryClient();
  const showToast = useUIStore((s) => s.showToast);
  const [stage, setStage] = useState<Stage>('review');
  const [mode, setMode] = useState<'success' | 'decline'>('success');
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pkgQ = useQuery({
    queryKey: ['package', packageId],
    queryFn: () => request<{ pkg: Package; coachName: string }>('package.get', { packageId }),
  });

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const payMutation = useMutation({
    mutationFn: async () => {
      const created = await request<{ paymentId: string }>('checkout.create', { packageId });
      setPaymentId(created.paymentId);
      await request('checkout.pay', { paymentId: created.paymentId, mode });
      return created.paymentId;
    },
    onMutate: () => setStage('processing'),
    onSuccess: (pid) => {
      if (mode === 'decline') {
        setStage('declined');
        return;
      }
      // Poll until the webhook activates the subscription (never trust the
      // client-side redirect alone).
      let tries = 0;
      pollRef.current = setInterval(async () => {
        tries += 1;
        try {
          const status = await request<CheckoutStatus>('checkout.status', { paymentId: pid });
          if (status.status === 'captured') {
            if (pollRef.current) clearInterval(pollRef.current);
            setStage('success');
            qc.invalidateQueries();
          } else if (status.status === 'failed' || tries > 12) {
            if (pollRef.current) clearInterval(pollRef.current);
            setStage('declined');
          }
        } catch {
          if (tries > 12 && pollRef.current) {
            clearInterval(pollRef.current);
            setStage('declined');
          }
        }
      }, 800);
    },
    onError: (e) => {
      setStage('review');
      if (e instanceof ApiError && (e.code === 'ONE_COACH' || e.code === 'ALREADY_ACTIVE')) {
        showToast(e.message, 'error');
      } else {
        handleWriteError(e);
      }
    },
  });

  if (pkgQ.isLoading) return <View style={{ flex: 1, backgroundColor: C.bg }}><LoadingView /></View>;
  if (pkgQ.isError || !pkgQ.data) return <View style={{ flex: 1, backgroundColor: C.bg }}><ErrorState message="Could not load this package." onRetry={() => pkgQ.refetch()} /></View>;

  const { pkg, coachName } = pkgQ.data;

  if (stage === 'success') {
    return (
      <View style={styles.center}>
        <View style={styles.successIcon}><Ionicons name="checkmark" size={34} color="#fff" /></View>
        <Text style={[TYPE.h1, { textAlign: 'center', marginTop: S.xl }]}>You're in! 🎉</Text>
        <Text style={[TYPE.sub, { textAlign: 'center', marginTop: S.sm, lineHeight: 21, maxWidth: 300 }]}>
          Payment confirmed and your subscription with {coachName} is active. Your plans and private chat are ready.
        </Text>
        <Button label="Go to my dashboard" style={{ marginTop: S.xxl, alignSelf: 'center' }} onPress={() => navigation.popToTop()} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: S.xl, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <TopBar title="Checkout" subtitle="Secure sandbox payment" />

        <Card>
          <Text style={TYPE.caption}>PACKAGE</Text>
          <Text style={[TYPE.h2, { marginTop: 4 }]}>{pkg.title}</Text>
          <Text style={[TYPE.sub, { marginTop: 2 }]}>by {coachName} · {pkg.durationDays} days</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{money(pkg.priceCents)}</Text>
            <Text style={TYPE.caption}>ONE-TIME · FULL ACCESS</Text>
          </View>
          <View style={{ marginTop: S.md }}>
            {pkg.features.map((f) => (
              <View key={f} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 3 }}>
                <Ionicons name="checkmark-circle" size={16} color={C.primary} style={{ marginRight: 8 }} />
                <Text style={{ fontSize: 13.5, color: C.sub, fontWeight: '500' }}>{f}</Text>
              </View>
            ))}
          </View>
        </Card>

        {stage === 'declined' && (
          <View style={styles.declinedBox}>
            <Ionicons name="card-outline" size={18} color={C.danger} style={{ marginRight: 10 }} />
            <Text style={{ fontSize: 13.5, fontWeight: '600', color: C.danger, flex: 1, lineHeight: 19 }}>
              Payment declined — you were not charged and no access was granted. Check your details and retry.
            </Text>
          </View>
        )}

        {/* Sandbox test-mode selector */}
        <View style={styles.testBox}>
          <Text style={styles.testTitle}>SANDBOX · SIMULATE CARD RESULT</Text>
          <View style={{ flexDirection: 'row' }}>
            {(['success', 'decline'] as const).map((m) => (
              <Button
                key={m}
                label={m === 'success' ? 'Card approved' : 'Card declined'}
                compact
                variant={mode === m ? 'primary' : 'outline'}
                style={{ flex: 1, marginRight: m === 'success' ? S.sm : 0 }}
                onPress={() => setMode(m)}
              />
            ))}
          </View>
        </View>

        <Button
          label={stage === 'processing' ? 'Confirming with provider…' : `Pay ${money(pkg.priceCents)}`}
          icon={stage === 'processing' ? undefined : 'lock-closed-outline'}
          loading={stage === 'processing'}
          onPress={() => payMutation.mutate()}
          style={{ marginTop: S.lg }}
        />
        <Text style={[TYPE.caption, { textAlign: 'center', marginTop: S.md, lineHeight: 17 }]}>
          Access activates only after the payment provider confirms via webhook. Duplicate notifications are handled safely.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: S.xxl },
  successIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: S.lg, paddingTop: S.lg, borderTopWidth: 1, borderTopColor: C.lineSoft },
  price: { fontSize: 26, fontWeight: '800', color: C.ink },
  declinedBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.dangerSoft, borderRadius: R.md, padding: S.lg, marginTop: S.lg },
  testBox: { backgroundColor: C.surfaceAlt, borderRadius: R.lg, padding: S.lg, marginTop: S.lg },
  testTitle: { fontSize: 10.5, fontWeight: '800', color: C.sub, letterSpacing: 0.6, marginBottom: S.md },
});
