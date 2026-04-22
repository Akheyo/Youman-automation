import { create } from "zustand";
import { v4 as uuid } from "uuid";

interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: "success" | "error" | "warning" | "info";
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  toast: (t: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  toast: (t) => {
    const id = uuid();
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    setTimeout(
      () => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
      t.duration ?? 4000
    );
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function useToast() {
  return useToastStore();
}

export const toast = useToastStore.getState().toast;
