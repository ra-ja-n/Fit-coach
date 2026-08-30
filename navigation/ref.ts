// Global navigation ref — lets root-level overlays (e.g. the renewal prompt)
// navigate without living inside a navigator screen.
import { createNavigationContainerRef } from '@react-navigation/native';
import type { ClientStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<ClientStackParamList>();
