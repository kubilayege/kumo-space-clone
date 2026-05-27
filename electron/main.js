const {
  app,
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  screen,
  session,
  shell,
} = require("electron");
const path = require("path");
const { execFile } = require("child_process");

const isDev = !app.isPackaged || process.env.ELECTRON_DEV === "1";
const DEV_URL = process.env.KUMO_DEV_URL || "http://localhost:3000";
const PROD_URL =
  process.env.KUMO_APP_URL || "https://kumo-space-clone.vercel.app";

let mainWindow = null;
let overlayWindow = null;
let overlayTracker = null;

function clearOverlayTracker() {
  if (overlayTracker) {
    clearInterval(overlayTracker);
    overlayTracker = null;
  }
}

// Query a window's on-screen bounds (CG coordinate space — origin top-left, in
// logical points) by exact title match. Returns null when no match is found.
// Requires Accessibility permission for our Electron app the first time.
function findMacWindowByTitle(title) {
  return new Promise((resolve) => {
    if (!title) return resolve(null);
    const escaped = title.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const script = `set needle to "${escaped}"
tell application "System Events"
  set hit to ""
  repeat with proc in (every process whose background only is false)
    try
      repeat with w in (every window of proc)
        try
          if name of w is equal to needle then
            set p to position of w
            set s to size of w
            set hit to ((item 1 of p) as text) & "," & ((item 2 of p) as text) & "," & ((item 1 of s) as text) & "," & ((item 2 of s) as text)
            exit repeat
          end if
        end try
      end repeat
      if hit is not "" then exit repeat
    end try
  end repeat
  return hit
end tell`;
    execFile(
      "osascript",
      ["-e", script],
      { timeout: 1500 },
      (err, stdout) => {
        if (err) {
          console.warn("[kumo] osascript window lookup failed:", err.message);
          return resolve(null);
        }
        const out = String(stdout || "").trim();
        if (!out) return resolve(null);
        const parts = out.split(",").map((v) => Number(v));
        if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
          return resolve(null);
        }
        resolve({
          x: parts[0],
          y: parts[1],
          width: parts[2],
          height: parts[3],
        });
      }
    );
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#0b1020",
    autoHideMenuBar: true,
    title: "Kumo Space",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
  });

  const targetUrl = isDev ? DEV_URL : PROD_URL;
  mainWindow.loadURL(targetUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function wireMediaPermissions() {
  const ses = session.defaultSession;

  ses.setPermissionRequestHandler((_webContents, permission, callback) => {
    const granted = new Set([
      "media",
      "display-capture",
      "fullscreen",
      "clipboard-read",
      "clipboard-sanitized-write",
      "notifications",
    ]);
    callback(granted.has(permission));
  });

  ses.setPermissionCheckHandler((_webContents, permission) => {
    return ["media", "display-capture", "fullscreen", "notifications"].includes(
      permission
    );
  });

  // Required as of Electron 20+: getDisplayMedia() silently fails unless a
  // handler is registered. On macOS 15+ the OS picker fires (useSystemPicker);
  // elsewhere we fall back to auto-picking the primary screen until Phase 2
  // adds a real in-app picker.
  ses.setDisplayMediaRequestHandler(
    async (request, callback) => {
      try {
        const sources = await desktopCapturer.getSources({
          types: ["screen", "window"],
          thumbnailSize: { width: 1, height: 1 },
          fetchWindowIcons: false,
        });
        const primary =
          sources.find((s) => s.id.startsWith("screen:")) ?? sources[0];
        if (!primary) {
          callback({});
          return;
        }
        callback({
          video: primary,
          audio: request.audioRequested ? "loopback" : undefined,
        });
      } catch (err) {
        console.error("[kumo] display-media handler error:", err);
        callback({});
      }
    },
    { useSystemPicker: true }
  );
}

function closeOverlay() {
  clearOverlayTracker();
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close();
  }
  overlayWindow = null;
}

async function openOverlay({ spaceId, userId, socketUrl, source }) {
  closeOverlay();
  if (!spaceId || !userId) return false;

  console.log("[kumo] openOverlay source:", source);

  const display = screen.getPrimaryDisplay();
  let { x, y, width, height } = display.bounds;
  let trackTitle = null;

  // If the user picked a single window, try to match the overlay to that
  // window's on-screen bounds and then keep it pinned as the window moves.
  if (source?.displaySurface === "window" && process.platform === "darwin") {
    const title = source.label?.trim();
    const found = title ? await findMacWindowByTitle(title) : null;
    if (found && found.width > 50 && found.height > 50) {
      x = found.x;
      y = found.y;
      width = found.width;
      height = found.height;
      trackTitle = title;
      console.log(
        `[kumo] tracking window "${title}" at ${JSON.stringify(found)}`
      );
    } else {
      console.warn(
        `[kumo] could not find window with title "${title}" — falling back to full display`
      );
    }
  }

  console.log(
    `[kumo] overlay target display id=${display.id} bounds=${JSON.stringify(
      display.bounds
    )} workArea=${JSON.stringify(display.workArea)} scaleFactor=${
      display.scaleFactor
    } rotation=${display.rotation}`
  );

  const windowOpts = {
    x,
    y,
    width,
    height,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    show: false,
    enableLargerThanScreen: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  };
  // On macOS, create as a panel (NSPanel) so the OS doesn't snap us out of
  // the menu bar / dock area. `type: 'panel'` was added in Electron 24.
  if (process.platform === "darwin") {
    windowOpts.type = "panel";
  }

  overlayWindow = new BrowserWindow(windowOpts);

  // Stay above almost everything, including the menu bar.
  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });

  // Force the bounds AFTER alwaysOnTop level is set, so the panel-level
  // window can claim the full display without being clamped to the workArea.
  overlayWindow.setBounds({ x, y, width, height });

  // Hide the overlay from screen capture so viewers don't see annotations
  // doubled (in their own canvas overlay AND inside the streamed video).
  if (typeof overlayWindow.setContentProtection === "function") {
    overlayWindow.setContentProtection(true);
  }

  const base = isDev ? DEV_URL : PROD_URL;
  const params = new URLSearchParams({
    space: spaceId,
    user: userId,
  });
  if (socketUrl) params.set("socket", socketUrl);
  overlayWindow.loadURL(`${base.replace(/\/$/, "")}/overlay?${params.toString()}`);

  overlayWindow.once("ready-to-show", () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.setBounds({ x, y, width, height });
      overlayWindow.showInactive();
      console.log(
        `[kumo] overlay actual bounds=${JSON.stringify(overlayWindow.getBounds())}`
      );
    }
  });

  overlayWindow.on("closed", () => {
    overlayWindow = null;
    clearOverlayTracker();
  });

  // Follow the shared window as it moves or resizes.
  if (trackTitle) {
    overlayTracker = setInterval(async () => {
      if (!overlayWindow || overlayWindow.isDestroyed()) {
        clearOverlayTracker();
        return;
      }
      const next = await findMacWindowByTitle(trackTitle);
      if (!next || next.width < 50 || next.height < 50) return;
      const current = overlayWindow.getBounds();
      if (
        current.x === next.x &&
        current.y === next.y &&
        current.width === next.width &&
        current.height === next.height
      ) {
        return;
      }
      overlayWindow.setBounds(next);
    }, 200);
  }

  return true;
}

function wireIpc() {
  ipcMain.handle("overlay:start", async (_event, payload) => {
    try {
      return await openOverlay(payload ?? {});
    } catch (err) {
      console.error("[kumo] overlay:start failed:", err);
      return false;
    }
  });

  ipcMain.handle("overlay:stop", () => {
    closeOverlay();
    return true;
  });
}

app.whenReady().then(() => {
  wireMediaPermissions();
  wireIpc();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  closeOverlay();
  if (process.platform !== "darwin") {
    app.quit();
  }
});
