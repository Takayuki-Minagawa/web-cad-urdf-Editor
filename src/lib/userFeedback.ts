/** Thin boundary for browser-native user feedback. */

export function notify(message: string): void {
  window.alert(message);
}

export function confirmAction(message: string): boolean {
  return window.confirm(message);
}
