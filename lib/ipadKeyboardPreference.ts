"use client";
import { useSyncExternalStore } from 'react';
import { isIPad } from './ipadHardwareInput';

const KEY = 'voca-ipad-keyboard';
const EVENT = 'voca-ipad-keyboard-change';
let fallback = 'hardware';
function subscribe(callback: () => void) {
  window.addEventListener(EVENT,callback);
  window.addEventListener('storage',callback);
  return () => { window.removeEventListener(EVENT,callback); window.removeEventListener('storage',callback); };
}
function getMode() {
  if(!isIPad(navigator)) return 'native';
  try { return localStorage.getItem(KEY) === 'screen' ? 'screen' : 'hardware'; }
  catch { return fallback; }
}
export function useIPadKeyboardMode() {
  return useSyncExternalStore(subscribe,getMode,() => 'native');
}
export function setIPadKeyboardMode(mode: 'hardware' | 'screen') {
  fallback = mode;
  try { localStorage.setItem(KEY,mode); } catch { /* Keep this session usable. */ }
  window.dispatchEvent(new Event(EVENT));
}
