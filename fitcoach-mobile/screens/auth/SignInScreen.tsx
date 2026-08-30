import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { SignInSchema, type SignInForm } from '../../lib/validation';
import { useAuthStore } from '../../state/authStore';
import { errorMessage } from '../../lib/api/errors';
import { Button, Field } from '../../components/ui';
import { C, R, S, TYPE } from '../../theme/tokens';
import type { AuthStackParamList } from '../../navigation/types';

// No demo accounts and no shared password here: credentials come from the
// backend, and the dev seed reads DEV_SEED_PASSWORD (see fitcoach-backend).
export default function SignInScreen({ navigation }: NativeStackScreenProps<AuthStackParamList, 'SignIn'>) {
  const signIn = useAuthStore((s) => s.signIn);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { control, handleSubmit } = useForm<SignInForm>({
    resolver: zodResolver(SignInSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: SignInForm) => {
    setSubmitting(true);
    setServerError(null);
    try {
      await signIn(data.email, data.password);
    } catch (e) {
      setServerError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.logo}>
          <Ionicons name="barbell" size={26} color="#fff" />
        </View>
        <Text style={[TYPE.h1, { marginTop: S.lg }]}>Welcome back</Text>
        <Text style={[TYPE.sub, { marginTop: S.xs }]}>Sign in to your coaching space.</Text>

        {serverError ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color={C.danger} style={{ marginRight: 8 }} />
            <Text style={{ color: C.danger, fontSize: 13, fontWeight: '600', flex: 1 }}>{serverError}</Text>
          </View>
        ) : null}

        <View style={{ marginTop: S.xxl }}>
          <Controller
            control={control}
            name="email"
            render={({ field: { value, onChange: onChangeText }, fieldState }) => (
              <Field label="Email" value={value} onChangeText={onChangeText} error={fieldState.error?.message}
                placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" prefixIcon="mail-outline"
                returnKeyType="next" />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field: { value, onChange: onChangeText }, fieldState }) => (
              <Field label="Password" value={value} onChangeText={onChangeText} error={fieldState.error?.message}
                placeholder="Your password" secureTextEntry prefixIcon="lock-closed-outline"
                returnKeyType="done" onSubmitEditing={handleSubmit(onSubmit)} />
            )}
          />
        </View>

        <Button label="Sign in" onPress={handleSubmit(onSubmit)} loading={submitting} style={{ marginTop: S.sm }} />

        <View style={styles.signupRow}>
          <Text style={TYPE.sub}>New to FitCoach?</Text>
          <Pressable hitSlop={8} onPress={() => navigation.navigate('SignUp')}>
            <Text style={{ color: C.primary, fontWeight: '700', fontSize: 14, marginLeft: 6 }}>Create an account</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, padding: S.xl, paddingTop: 72 },
  logo: { width: 56, height: 56, borderRadius: 16, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  errorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.dangerSoft, borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.md, marginTop: S.xl },
  signupRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: S.xxl },
});
