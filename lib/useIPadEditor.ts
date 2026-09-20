"use client";
import { useEffect, useRef, type RefObject } from 'react';
import { attachIPadHardwareInput, isIPad } from './ipadHardwareInput';
import { useIPadKeyboardMode } from './ipadKeyboardPreference';

/** Shared by single-line fields and multiline study-point editors. */
export function useIPadEditor(ref: RefObject<HTMLDivElement | null>, emit: () => void, multiline = false) {
  const keyboardMode = useIPadKeyboardMode();
  const controller = useRef<ReturnType<typeof attachIPadHardwareInput> | null>(null);
  const emitRef = useRef(emit);
  useEffect(() => { emitRef.current = emit; });
  useEffect(() => {
    if(!ref.current || !isIPad(navigator)) return;
    const attached = attachIPadHardwareInput(ref.current,() => emitRef.current(),keyboardMode === 'hardware',multiline);
    controller.current = attached;
    return () => { attached.destroy(); controller.current = null; };
  },[ref,keyboardMode,multiline]);
  return controller;
}
