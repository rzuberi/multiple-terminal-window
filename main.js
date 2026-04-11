const path = require("path");
const os = require("os");
const { app, BrowserWindow, ipcMain } = require("electron");
const pty = require("node-pty");

const terminals = new Map();

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#0a0f1a",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.loadFile(path.join(__dirname, "src/index.html"));
}

function makeTerminalId() {
  return `term-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function spawnTerminal(options = {}) {
  const shell = process.env.SHELL || "/bin/zsh";
  const cwd = options.cwd || process.cwd() || os.homedir();
  const id = makeTerminalId();
  const cols = Number.isInteger(options.cols) ? options.cols : 80;
  const rows = Number.isInteger(options.rows) ? options.rows : 24;

  const term = pty.spawn(shell, [], {
    name: "xterm-256color",
    cols,
    rows,
    cwd,
    env: {
      ...process.env,
      TERM_PROGRAM: "multiple-terminal-window",
    },
  });

  terminals.set(id, term);

  term.onData((data) => {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send("terminal:data", { id, data });
    });
  });

  term.onExit(({ exitCode, signal }) => {
    terminals.delete(id);
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send("terminal:exit", {
        id,
        exitCode,
        signal,
      });
    });
  });

  return { id, cwd, shell };
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle("terminals:create", (_event, options) => {
    return spawnTerminal(options);
  });

  ipcMain.on("terminals:input", (_event, { id, data }) => {
    const term = terminals.get(id);
    if (term) {
      term.write(data);
    }
  });

  ipcMain.on("terminals:resize", (_event, { id, cols, rows }) => {
    const term = terminals.get(id);
    if (!term) {
      return;
    }

    const safeCols = Math.max(20, Math.floor(cols || 80));
    const safeRows = Math.max(8, Math.floor(rows || 24));
    term.resize(safeCols, safeRows);
  });

  ipcMain.on("terminals:close", (_event, { id }) => {
    const term = terminals.get(id);
    if (term) {
      term.kill();
      terminals.delete(id);
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  terminals.forEach((term) => term.kill());
  terminals.clear();

  if (process.platform !== "darwin") {
    app.quit();
  }
});
