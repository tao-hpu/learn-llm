// compare-text 与 compare-behavior 共用：解析参数，准备对照的那一侧，结束时清理。
// --ref=main（默认）：对照 origin/main 的构建；--ref=<git ref> 对照任意提交。
// --ref=legacy：对照 llm-from-scratch 在 8ce76a2 的单文件旧页。
// --allow-diff：有差异时也以 0 退出。
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const LEGACY_REPO = join(process.env.HOME, 'Workspace/fim-ai/llm-from-scratch')
export const LEGACY_COMMIT = '8ce76a2'

export function parseArgs(argv = process.argv.slice(2)) {
  let ref = 'main'
  let allowDiff = false
  for (const arg of argv) {
    if (arg.startsWith('--ref=')) ref = arg.slice('--ref='.length)
    else if (arg === '--allow-diff') allowDiff = true
    else throw new Error(`未知参数：${arg}（可用 --ref=main|legacy|<git ref>，--allow-diff）`)
  }
  if (!ref) throw new Error('--ref 不能为空')
  const legacy = ref === 'legacy'
  const gitRef = legacy ? null : ref === 'main' ? 'origin/main' : ref
  return { legacy, gitRef, allowDiff }
}

function run(cmd, args, cwd) {
  execFileSync(cmd, args, { cwd, stdio: 'inherit' })
}

export function requireDist(root) {
  if (!existsSync(join(root, 'dist/index.html'))) {
    throw new Error('当前工作区没有 dist/index.html。先运行 pnpm build。')
  }
}

// 返回 { dir, label, cleanup }。legacy：dir 是旧页目录；否则 dir 是 ref 的仓库根，构建产物在 dir/dist。
export function prepareRef(root, opts) {
  const tmp = mkdtempSync(join(tmpdir(), 'learn-llm-ref-'))
  let worktree = null
  const cleanup = () => {
    if (worktree) {
      try { execFileSync('git', ['-C', root, 'worktree', 'remove', '--force', worktree], { stdio: 'ignore' }) } catch {}
      try { execFileSync('git', ['-C', root, 'worktree', 'prune'], { stdio: 'ignore' }) } catch {}
      worktree = null
    }
    rmSync(tmp, { recursive: true, force: true })
  }
  const onSignal = (sig) => {
    cleanup()
    process.kill(process.pid, sig)
  }
  process.once('SIGINT', onSignal)
  process.once('SIGTERM', onSignal)
  process.once('exit', cleanup)

  try {
    if (opts.legacy) {
      execFileSync('sh', ['-c', `git -C "$1" archive "$2" web | tar -x -C "$3"`, 'sh', LEGACY_REPO, LEGACY_COMMIT, tmp], { stdio: 'inherit' })
      return { dir: join(tmp, 'web'), label: `llm-from-scratch ${LEGACY_COMMIT}:web`, cleanup }
    }
    const sha = execFileSync('git', ['-C', root, 'rev-parse', '--verify', `${opts.gitRef}^{commit}`], { encoding: 'utf8' }).trim()
    worktree = join(tmp, 'ref')
    run('git', ['-C', root, 'worktree', 'add', '--detach', worktree, sha], root)
    try {
      run('pnpm', ['install', '--frozen-lockfile', '--offline'], worktree)
    } catch {
      console.log('离线安装失败，改用联网安装')
      run('pnpm', ['install'], worktree)
    }
    run('pnpm', ['build'], worktree)
    return { dir: worktree, label: `${opts.gitRef} (${sha.slice(0, 7)})`, cleanup }
  } catch (err) {
    cleanup()
    throw err
  }
}
