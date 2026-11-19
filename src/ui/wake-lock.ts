/** Garde l'écran allumé (Wake Lock API) quand le micro ou le métronome tourne. */
export class WakeLockManager {
  private sentinel: { release(): Promise<void>; released?: boolean } | null = null;
  private wanted = false;

  want(on: boolean): void {
    this.wanted = on;
    void this.sync();
  }

  private async sync(): Promise<void> {
    const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void>; released?: boolean }> } };
    if (!nav.wakeLock) return;
    try {
      if (this.wanted && (!this.sentinel || this.sentinel.released) && document.visibilityState === 'visible') {
        this.sentinel = await nav.wakeLock.request('screen');
      } else if (!this.wanted && this.sentinel) {
        await this.sentinel.release();
        this.sentinel = null;
      }
    } catch {
      /* refusé (batterie faible…) : sans conséquence */
    }
  }
}
