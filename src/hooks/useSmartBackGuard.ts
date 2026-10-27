"use client";

import { useEffect, useId, useRef } from "react";
import {
  useSmartNavStore,
  pushBrowserHistoryGuard,
} from "@/store/useSmartNavStore";

/**
 * Registers a LIFO back-button interceptor for any open modal, drawer, lightbox, or popover.
 * When the user presses the phone's Back button (in mobile browsers via `popstate` or in
 * Capacitor Android/iOS via `CapApp.addListener("backButton")`), the top-most active
 * `onClose` callback is invoked instead of closing the browser tab or app.
 */
export function useSmartBackGuard(isOpen: boolean, onClose: () => void): void {
  const id = useId();
  const registerBackHandler = useSmartNavStore((s) => s.registerBackHandler);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    pushBrowserHistoryGuard();
    const unregister = registerBackHandler(id, () => {
      onCloseRef.current();
    });
    return () => {
      unregister();
    };
  }, [isOpen, id, registerBackHandler]);
}
