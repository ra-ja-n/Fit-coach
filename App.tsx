// FitCoach — two-sided coach/client marketplace MVP.
// Providers: TanStack Query (server state) + Zustand (UI state) +
// React Navigation (role-based) + SecureStore-backed auth session.
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import Ionicons from '@expo/vector-icons/Ionicons';
import RootNavigator from './navigation/RootNavigator';
import { navigationRef } from './navigation/ref';
import { ToastHost } from './components/ui';
import { useAuthStore } from './state/authStore';
import { ApiError } from './lib/api/errors';
import { C } from './theme/tokens';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: (failureCount, error) => {
        // Never retry client errors (4xx) — they are deterministic.
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 2;
      },
      retryDelay: 1200,
    },
  },
});

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: C.primary,
    background: C.bg,
    card: C.surface,
    text: C.ink,
    border: C.line,
    notification: C.danger,
  },
};

function BootstrappedApp() {
  const hydrate = useAuthStore((s) => s.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <RootNavigator />
      <ToastHost />
    </NavigationContainer>
  );
}

export default function App() {
  // Preload icon fonts for web — required or icons render as boxes.
  const [fontsLoaded] = useFonts({ ...Ionicons.font });
  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <BootstrappedApp />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
});
