import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { SignUpSchema, type SignUpForm } from '../../lib/validation';
import { useAuthStore } from '../../state/authStore';
import { errorMessage } from '../../lib/api/errors';
import { Button, Field, TopBar } from '../../components/ui';
import { C, R, S, TYPE } from '../../theme/tokens';
import type { AuthStackParamList } from '../../navigation/types';

export default function SignUpScreen({ navigation }: NativeStackScreenProps<AuthStackParamList, 'SignUp'>) {
  const signUp = useAuthStore((s) => s.signUp);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { control, handleSubmit, watch, setValue } = useForm<SignUpForm>({
    resolver: zodResolver(SignUpSchema),
    defaultValues: { role: 'client', name: '', email: '', password: '' },
  });
  const role = watch('role');

  const onSubmit = async (data: SignUpForm) => {
    setSubmitting(true);
    setServerError(null);
    try {
      await signUp(data);
    } catch (e) {
      setServerError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: S.xl }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <TopBar title="" back />
        <Text style={TYPE.h1}>Create your account</Text>
        <Text style={[TYPE.sub, { marginTop: S.xs }]}>Join as a client or start coaching on FitCoach.</Text>

        <View style={styles.roleRow}>
          {(['client', 'coach'] as const).map((r) => (
            <Pressable key={r} onPress={() => setValue('role', r)} style={[styles.roleCard, role === r && styles.roleCardActive]}>
              <Ionicons name={r === 'client' ? 'fitness-outline' : 'barbell-outline'} size={22} color={role === r ? C.primary : C.faint} />
              <Text style={[styles.roleLabel, role === r && { color: C.primaryDark }]}>{r === 'client' ? 'I want a coach' : 'I am a coach'}</Text>
            </Pressable>
          ))}
        </View>

        {serverError ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color={C.danger} style={{ marginRight: 8 }} />
            <Text style={{ color: C.danger, fontSize: 13, fontWeight: '600', flex: 1 }}>{serverError}</Text>
          </View>
        ) : null}

        <View style={{ marginTop: S.lg }}>
          <Controller control={control} name="name" render={({ field: { value, onChange: onChangeText }, fieldState }) => (
            <Field label="Full name" value={value} onChangeText={onChangeText} error={fieldState.error?.message} placeholder="Jamie Rivera" prefixIcon="person-outline" returnKeyType="next" />
          )} />
          <Controller control={control} name="email" render={({ field: { value, onChange: onChangeText }, fieldState }) => (
            <Field label="Email" value={value} onChangeText={onChangeText} error={fieldState.error?.message} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" prefixIcon="mail-outline" returnKeyType="next" />
          )} />
          <Controller control={control} name="password" render={({ field: { value, onChange: onChangeText }, fieldState }) => (
            <Field label="Password" value={value} onChangeText={onChangeText} error={fieldState.error?.message} placeholder="At least 8 characters" secureTextEntry prefixIcon="lock-closed-outline" returnKeyType="done" onSubmitEditing={handleSubmit(onSubmit)} />
          )} />
        </View>

        {role === 'coach' ? (
          <View style={styles.note}>
            <Ionicons name="information-circle-outline" size={16} color={C.blue} style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 12.5, color: C.sub, flex: 1, lineHeight: 18 }}>Coach accounts are reviewed before going live. You can set up your profile while waiting for approval.</Text>
          </View>
        ) : null}

        <Button label="Create account" onPress={handleSubmit(onSubmit)} loading={submitting} style={{ marginTop: S.lg }} />
        <Pressable hitSlop={8} onPress={() => navigation.goBack()} style={{ alignSelf: 'center', marginTop: S.xl }}>
          <Text style={{ color: C.sub, fontSize: 14, fontWeight: '600' }}>Already have an account? <Text style={{ color: C.primary, fontWeight: '700' }}>Sign in</Text></Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  roleRow: { flexDirection: 'row', marginTop: S.xl },
  roleCard: { flex: 1, backgroundColor: C.surface, borderRadius: R.lg, borderWidth: 1.5, borderColor: C.line, padding: S.lg, alignItems: 'center', marginRight: S.md },
  roleCardActive: { borderColor: C.primary, backgroundColor: C.primarySoft },
  roleLabel: { fontSize: 13.5, fontWeight: '700', color: C.sub, marginTop: S.sm },
  errorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.dangerSoft, borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.md, marginTop: S.lg },
  note: { flexDirection: 'row', backgroundColor: C.blueSoft, borderRadius: R.md, padding: S.md, marginTop: S.sm },
});
