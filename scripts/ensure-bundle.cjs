const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const bundle = path.join(root, 'public', 'bundle.js');

if (fs.existsSync(bundle)) {
  process.exit(0);
}

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const res = spawnSync(npmCmd, ['run', 'build:client'], {
  stdio: 'inherit',
  cwd: root,
  shell: true,
});
process.exit(res.status === null ? 1 : res.status);
