type StartOverlayOpts = {
  spaceId: string;
  userId: string;
  socketUrl?: string;
  source?: {
    displaySurface?: string;
    label?: string;
    width?: number;
    height?: number;
  };
};

type KumoDesktop = {
  isDesktop: boolean;
  platform: NodeJS.Platform;
  startOverlay: (opts: StartOverlayOpts) => Promise<boolean>;
  stopOverlay: () => Promise<boolean>;
};

declare global {
  interface Window {
    kumoDesktop?: KumoDesktop;
  }
}

export function getDesktop(): KumoDesktop | null {
  if (typeof window === "undefined") return null;
  return window.kumoDesktop ?? null;
}

export function isDesktopApp(): boolean {
  return getDesktop()?.isDesktop === true;
}

export function desktopPlatform(): NodeJS.Platform | null {
  return getDesktop()?.platform ?? null;
}

export async function startDesktopOverlay(opts: StartOverlayOpts): Promise<boolean> {
  const desktop = getDesktop();
  if (!desktop) return false;
  try {
    return await desktop.startOverlay(opts);
  } catch (err) {
    console.warn("[kumo] startOverlay failed:", err);
    return false;
  }
}

export async function stopDesktopOverlay(): Promise<boolean> {
  const desktop = getDesktop();
  if (!desktop) return false;
  try {
    return await desktop.stopOverlay();
  } catch (err) {
    console.warn("[kumo] stopOverlay failed:", err);
    return false;
  }
}

export {};
