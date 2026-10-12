import { cp, rm, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const [target, command = 'sync', platform] = process.argv.slice(2);
if (!['patient', 'doctor'].includes(target)) throw new Error('Target must be patient or doctor');
if (!['add', 'sync', 'copy', 'open', 'run', 'build'].includes(command)) throw new Error('Unsupported Capacitor command');
const projectPath = join(process.cwd(), `android-${target}`);
const activePath = join(process.cwd(), 'android');
const projectAppPath = join(projectPath, 'app');
const activeAppPath = join(activePath, 'app');
await access(projectPath);
try { await access(activePath); throw new Error('Temporary android directory already exists; remove it before syncing.'); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
await cp(projectPath, activePath, { recursive: true, filter: (source) => {
	const normalizedSource = source.replaceAll('\\', '/');
	return !normalizedSource.includes('/build/') && !normalizedSource.includes('/.gradle/');
} });
try {
	const args = ['cap', command];
	if (platform) args.push(platform);
	const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx';
	const result = spawnSync(executable, args, { cwd: process.cwd(), env: { ...process.env, CAPACITOR_TARGET: target }, shell: process.platform === 'win32', stdio: 'inherit' });
	if (result.status === 0 && ['sync', 'copy'].includes(command)) {
		await rm(join(projectAppPath, 'src', 'main', 'assets'), { recursive: true, force: true });
		await cp(join(activeAppPath, 'src', 'main', 'assets'), join(projectAppPath, 'src', 'main', 'assets'), { recursive: true });
		await cp(join(activeAppPath, 'capacitor.build.gradle'), join(projectAppPath, 'capacitor.build.gradle'), { force: true });
		await cp(join(activePath, 'capacitor.settings.gradle'), join(projectPath, 'capacitor.settings.gradle'), { force: true });
	}
	process.exitCode = result.status ?? 1;
} finally {
	await rm(activePath, { recursive: true, force: true });
}
