// Zustand — ephemeral UI state: toasts + the renewal prompt shown when a
// gated action hits a lapsed subscription.
import { create } from 'zustand';

export type ToastKind = 'success' | 'error' | 'info';

interface Toast { id: number; text: string; kind: ToastKind }

interface UIState {
  toast: Toast | null;
  showToast: (text: string, kind?: ToastKind) => void;
  dismissToast: () => void;
  renewPrompt: { coachId: string | null; coachName: string; message: string } | null;
  showRenewPrompt: (coachId: string | null, coachName: string, message: string) => void;
  clearRenewPrompt: () => void;
}

let toastId = 0;

export const useUIStore = create<UIState>((set) => ({
  toast: null,
  showToast: (text, kind = 'info') => set({ toast: { id: ++toastId, text, kind } }),
  dismissToast: () => set({ toast: null }),
  renewPrompt: null,
  showRenewPrompt: (coachId, coachName, message) => set({ renewPrompt: { coachId, coachName, message } }),
  clearRenewPrompt: () => set({ renewPrompt: null }),
}));
