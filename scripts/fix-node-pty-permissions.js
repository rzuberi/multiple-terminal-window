const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "node_modules", "node-pty", "prebuilds");
const candidates = [
  path.join(root, "darwin-arm64", "spawn-helper"),
  path.join(root, "darwin-x64", "spawn-helper"),
];

for (const file of candidates) {
  if (!fs.existsSync(file)) {
    continue;
  }

  const currentMode = fs.statSync(file).mode;
  const executableMode = currentMode | 0o111;
  fs.chmodSync(file, executableMode);
}
