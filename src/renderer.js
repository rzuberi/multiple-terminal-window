const grid = document.getElementById("terminal-grid");
const cwdInput = document.getElementById("cwd-input");
const spawnButton = document.getElementById("spawn-terminal");
const statusBanner = document.getElementById("status-banner");
const TerminalCtor = window.Terminal;
const FitAddonCtor = window.FitAddon.FitAddon;

const terminals = new Map();

function nextLabel() {
  return terminals.size + 1;
}

function fitTerminal(id) {
  const entry = terminals.get(id);
  if (!entry) {
    return;
  }

  entry.fit.fit();
  window.terminalApi.resizeTerminal({
    id,
    cols: entry.terminal.cols,
    rows: entry.terminal.rows,
  });
}

function fitAllTerminals() {
  terminals.forEach((_entry, id) => {
    fitTerminal(id);
  });
}

function setStatus(message, tone = "info") {
  if (!message) {
    statusBanner.hidden = true;
    statusBanner.textContent = "";
    statusBanner.dataset.tone = "info";
    return;
  }

  statusBanner.hidden = false;
  statusBanner.dataset.tone = tone;
  statusBanner.textContent = message;
}

function updateEmptyState() {
  if (terminals.size > 0) {
    grid.dataset.empty = "false";
    return;
  }

  grid.dataset.empty = "true";
  grid.innerHTML = `
    <div class="empty-state">
      <p>No live terminals yet.</p>
      <p>Spawn one to open a new interactive terminal.</p>
    </div>
  `;
}

function removeTerminal(id) {
  const entry = terminals.get(id);
  if (!entry) {
    return;
  }

  entry.fit.dispose();
  entry.terminal.dispose();
  entry.container.remove();
  terminals.delete(id);
  updateEmptyState();
}

function wireTerminal(id, shell, cwd) {
  const label = nextLabel();
  const card = document.createElement("article");
  card.className = "terminal-card";
  card.dataset.id = id;
  card.innerHTML = `
    <header class="terminal-header">
      <div class="terminal-meta">
        <span class="terminal-badge">${label}</span>
        <div>
          <strong>Terminal ${label}</strong>
          <p>${shell}</p>
        </div>
      </div>
      <div class="terminal-actions">
        <span class="terminal-cwd">${cwd}</span>
        <button type="button" class="close-button">Close</button>
      </div>
    </header>
    <div class="terminal-body"></div>
  `;

  if (grid.dataset.empty === "true") {
    grid.innerHTML = "";
    grid.dataset.empty = "false";
  }

  grid.prepend(card);

  const body = card.querySelector(".terminal-body");
  const closeButton = card.querySelector(".close-button");

  const terminal = new TerminalCtor({
    convertEol: true,
    cursorBlink: true,
    fontFamily: "Menlo, Monaco, 'Courier New', monospace",
    fontSize: 13,
    scrollback: 2000,
    theme: {
      background: "#09111f",
      foreground: "#dbe6ff",
      cursor: "#f7fbff",
      selectionBackground: "#1f355f",
    },
  });

  const fit = new FitAddonCtor();
  terminal.loadAddon(fit);
  terminal.open(body);

  terminal.onData((data) => {
    window.terminalApi.sendInput({ id, data });
  });

  closeButton.addEventListener("click", () => {
    window.terminalApi.closeTerminal({ id });
    removeTerminal(id);
  });

  terminals.set(id, { card, container: card, terminal, fit });
  requestAnimationFrame(() => {
    fitAllTerminals();
  });
}

async function spawnTerminal() {
  const cwd = cwdInput.value.trim();
  const descriptor = await window.terminalApi.createTerminal({
    cwd: cwd || undefined,
  });

  setStatus("");
  wireTerminal(descriptor.id, descriptor.shell, descriptor.cwd);
}

spawnButton.addEventListener("click", () => {
  spawnTerminal().catch((error) => {
    console.error(error);
    setStatus(`Could not spawn terminal: ${error.message}`, "error");
  });
});

window.terminalApi.onData(({ id, data }) => {
  const entry = terminals.get(id);
  if (entry) {
    entry.terminal.write(data);
  }
});

window.terminalApi.onExit(({ id, exitCode, signal }) => {
  const entry = terminals.get(id);
  if (!entry) {
    return;
  }

  entry.terminal.writeln("");
  entry.terminal.writeln(
    `\u001b[33mProcess exited with code ${exitCode ?? "unknown"}${
      signal ? ` (signal ${signal})` : ""
    }\u001b[0m`,
  );
});

updateEmptyState();
window.addEventListener("resize", fitAllTerminals);
spawnTerminal().catch((error) => {
  console.error(error);
  setStatus(`Could not spawn terminal: ${error.message}`, "error");
});
