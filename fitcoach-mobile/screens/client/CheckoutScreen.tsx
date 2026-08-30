// Checkout — sandbox Stripe flow. Activation happens ONLY via the simulated
// signed webhook (idempotent); the client polls payment status and never
// grants itself access.
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request, handleWriteError } from '../../lib/api/api';
import { ApiError } from '../../lib/api/errors';
import type { CheckoutStatus, Package } from '../../lib/api/types';
import { useUIStore } from '../../state/uiStore';
import { AlertBox, Button, ErrorState, LoadingView, TopBar } from '../../components/ui';
import { CheckoutSuccess, PackageReviewCard, SandboxModePicker, type SandboxMode } from '../../components/subscription';
import { C, S, TYPE } from '../../theme/tokens';
import { money } from '../../lib/format';
import type { ClientStackParamList } from '../../navigation/types';

type Stage = 'review' | 'processing' | 'success' | 'declined';

export default function CheckoutScreen({ route, navigation }: NativeStackScreenProps<ClientStackParamList, 'Checkout'>) {
  const { packageId } = route.params;
  const qc = useQueryClient();
  const showToast = useUIStore((s) => s.showToast);
  const [stage, setStage] = useState<Stage>('review');
  const [mode, setMode] = useState<SandboxMode>('success');
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
    return <CheckoutSuccess coachName={coachName} onDone={() => navigation.popToTop()} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: S.xl, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <TopBar title="Checkout" subtitle="Secure sandbox payment" />

        <PackageReviewCard pkg={pkg} coachName={coachName} />

        {stage === 'declined' && (
          <AlertBox
            icon="card-outline"
            text="Payment declined — you were not charged and no access was granted. Check your details and retry."
          />
        )}

        <SandboxModePicker mode={mode} onChange={setMode} />

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

