// Lite mode: turns off animations, blur and shadows in the launcher window (CSS class "lite" on <html>).
// Default: on for PCs with 4 or fewer CPU threads (weak laptops), off otherwise. The player's own choice always wins.
const KEY = 'phoenix.lite';

export function isLite(): boolean {
  try {
    const saved = window.localStorage.getItem(KEY);
    if (saved === '1') return true;
    if (saved === '0') return false;
  } catch {
    /* storage unavailable */
  }
  return (navigator.hardwareConcurrency || 8) <= 4;
}

export function setLite(on: boolean): void {
  try {
    window.localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* optional */
  }
  document.documentElement.classList.toggle('lite', on);
}

export function initLite(): void {
  document.documentElement.classList.toggle('lite', isLite());
}
