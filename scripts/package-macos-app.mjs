import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const packageJsonPath = path.join(repoRoot, 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

const macosDir = path.join(repoRoot, 'macos');
const buildDir = path.join(macosDir, '.build', 'debug');
const executablePath = path.join(buildDir, 'ThinkMenuBarApp');
const bundleDir = path.join(macosDir, '.dist', 'ThinkMenuBarApp.app');
const contentsDir = path.join(bundleDir, 'Contents');
const macOSDir = path.join(contentsDir, 'MacOS');
const infoPlistTemplatePath = path.join(macosDir, 'ThinkMenuBarApp-Info.plist');
const infoPlistOutputPath = path.join(contentsDir, 'Info.plist');
const bundledExecutablePath = path.join(macOSDir, 'ThinkMenuBarApp');

const shouldOpen = process.argv.includes('--open');

execFileSync('swift', ['build', '--package-path', macosDir], {
  cwd: repoRoot,
  stdio: 'inherit',
});

rmSync(bundleDir, { recursive: true, force: true });
mkdirSync(macOSDir, { recursive: true });

copyFileSync(executablePath, bundledExecutablePath);
chmodSync(bundledExecutablePath, 0o755);

const infoPlist = readFileSync(infoPlistTemplatePath, 'utf8').replaceAll('__VERSION__', version);
writeFileSync(infoPlistOutputPath, infoPlist);

console.log(bundleDir);

if (shouldOpen) {
  execFileSync('open', [bundleDir], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
}
