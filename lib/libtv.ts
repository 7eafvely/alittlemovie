import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const execFileAsync = promisify(execFile);

/**
 * 解析 stdout 里最后一个 JSON 对象。
 * libtv 的 --run 会先输出创建结果 JSON，再输出终态结果 JSON（中间夹进度日志）。
 * 我们只需要最后一个（含 url / 最终 status）。
 */
function parseLastJson(stdout: string): any {
  if (!stdout) return null;
  const trimmed = stdout.trim();
  if (!trimmed) return null;

  // 尝试整体解析
  try {
    return JSON.parse(trimmed);
  } catch {}

  // 找所有顶层 JSON 对象（花括号配对）
  const candidates: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let esc = false;

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (inString) {
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === '"') { inString = false; }
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        candidates.push(trimmed.substring(start, i + 1));
        start = -1;
      }
    }
  }

  // 从后往前尝试解析
  for (let i = candidates.length - 1; i >= 0; i--) {
    try {
      const parsed = JSON.parse(candidates[i]);
      // 取含 url 或 status 的那个（终态）
      return parsed;
    } catch {}
  }

  return null;
}

// LibTV CLI 可执行文件路径
const LIBTV_BIN = process.env.LIBTV_BIN || 'C:\\Users\\12600\\.libtv\\libtv.exe';

// 状态文件目录（存放画布绑定，保证多请求之间上下文一致）
const STATE_DIR = join(process.cwd(), '.libtv');
const STATE_FILE = join(STATE_DIR, 'project.json');

// 默认工作区/画布（首次运行自动创建并绑定）
let cachedWorkspaceId: string | null = null;
let cachedProjectUuid: string | null = null;

interface LibTVResult {
  ok: boolean;
  data?: any;
  error?: string;
  stdout?: string;
  stderr?: string;
}

/**
 * 执行 libtv 命令（统一封装）
 */
export async function runLibtv(args: string[], opts: { timeout?: number; cwd?: string } = {}): Promise<LibTVResult> {
  const timeout = opts.timeout ?? 180000; // 默认 3 分钟（视频生成可能很久）
  try {
    const { stdout, stderr } = await execFileAsync(LIBTV_BIN, args, {
      timeout,
      maxBuffer: 10 * 1024 * 1024,
      cwd: opts.cwd,
      env: { ...process.env, PATH: `${process.env.PATH};C:\\Users\\12600\\.libtv` },
      windowsHide: true,
    });

    let data: any = null;
    // stdout 可能是多段 JSON（--run 会先输出创建结果再输出终态结果）
    // 取最后一个有效 JSON 对象（含 url / 最终状态）
    data = parseLastJson(stdout);

    return { ok: true, data, stdout, stderr };
  } catch (error: any) {
    // 非 0 退出码
    const stderr = error.stderr || error.message || '';
    let parsedData: any = null;
    try {
      parsedData = JSON.parse(error.stdout || '');
    } catch {}
    return { ok: false, error: stderr, data: parsedData, stderr, stdout: error.stdout };
  }
}

/**
 * 确保状态目录存在
 */
function ensureStateDir() {
  if (!existsSync(STATE_DIR)) {
    mkdirSync(STATE_DIR, { recursive: true });
  }
}

/**
 * 读取本地绑定状态
 */
function readState(): { projectUuid?: string; workspaceId?: string; groupNodeKey?: string } {
  try {
    if (existsSync(STATE_FILE)) {
      return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch {}
  return {};
}

/**
 * 写入本地绑定状态
 */
function writeState(state: any) {
  ensureStateDir();
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * 获取或创建默认工作区（项目）
 */
export async function ensureWorkspace(name = 'alittlemovie'): Promise<string> {
  if (cachedWorkspaceId) return cachedWorkspaceId;

  // 先尝试从状态读
  const state = readState();
  if (state.workspaceId) {
    cachedWorkspaceId = String(state.workspaceId);
    return cachedWorkspaceId!;
  }

  // 查找是否已有同名工作区
  const list = await runLibtv(['workspace', 'list', '--name', name]);
  if (list.ok && list.data?.folders?.length > 0) {
    const id = String(list.data.folders[0].id);
    cachedWorkspaceId = id;
    writeState({ ...state, workspaceId: id });
    return id;
  }

  // 新建工作区
  const created = await runLibtv(['workspace', 'create', name]);
  if (!created.ok) {
    throw new Error('创建工作区失败: ' + created.error);
  }
  const id = String(created.data.workspaceId);
  cachedWorkspaceId = id;
  writeState({ ...state, workspaceId: id });
  return id;
}

/**
 * 获取或创建默认画布（project）
 */
export async function ensureProject(workspaceId?: string): Promise<string> {
  if (cachedProjectUuid) return cachedProjectUuid;

  const state = readState();
  if (state.projectUuid) {
    cachedProjectUuid = state.projectUuid;
    return cachedProjectUuid!;
  }

  const ws = workspaceId || (await ensureWorkspace());
  const created = await runLibtv(['project', 'create', '画布', '-w', ws]);
  if (!created.ok) {
    throw new Error('创建画布失败: ' + created.error);
  }
  const uuid = created.data?.uuid || created.data?.projectMeta?.uuid;
  if (!uuid) {
    throw new Error('创建画布未返回 UUID');
  }
  cachedProjectUuid = uuid;
  writeState({ ...state, projectUuid: uuid, workspaceId: ws });
  return uuid;
}

/**
 * 生成图片（文生图，同步等待结果）
 * @returns 图片 URL
 */
export async function generateImage(prompt: string, opts: {
  model?: string;        // 默认 AutoPic
  ratio?: string;        // 默认 9:16
  name?: string;         // 节点名
  workspaceId?: string;
  projectUuid?: string;
} = {}): Promise<string> {
  const projectUuid = opts.projectUuid || (await ensureProject(opts.workspaceId));
  const name = opts.name || `image-${Date.now()}`;
  const model = opts.model || 'AutoPic';
  const ratio = opts.ratio || '9:16';

  const args = [
    'node', 'create', name,
    '-t', 'image',
    '-p', projectUuid,
    '-s', `model=${model}`,
    '-s', `ratio=${ratio}`,
    '--prompt', prompt,
    '--run',
  ];

  const result = await runLibtv(args, { timeout: 120000 });
  if (!result.ok) {
    throw new Error('图片生成失败: ' + (result.error || '未知错误'));
  }

  // 结果在 data.url[0]（--run 返回的终态 JSON）
  const url = result.data?.data?.url?.[0] || result.data?.url?.[0];
  if (!url) {
    throw new Error('图片生成未返回 URL');
  }
  return url;
}

/**
 * 生成视频（文生视频，同步等待结果）
 * @returns 视频 URL
 */
export async function generateVideo(prompt: string, opts: {
  model?: string;        // 默认 Seedance 2.5
  ratio?: string;        // 默认 9:16
  duration?: number;     // 默认 5 秒
  name?: string;
  workspaceId?: string;
  projectUuid?: string;
} = {}): Promise<string> {
  const projectUuid = opts.projectUuid || (await ensureProject(opts.workspaceId));
  const name = opts.name || `video-${Date.now()}`;
  const model = opts.model || 'Seedance 2.5';
  const ratio = opts.ratio || '9:16';
  const duration = opts.duration || 5;

  const args = [
    'node', 'create', name,
    '-t', 'video',
    '-p', projectUuid,
    '-s', `model=${model}`,
    '-s', `ratio=${ratio}`,
    '-s', `duration=${duration}`,
    '-s', 'modeType=text2video',
    '--prompt', prompt,
    '--run',
  ];

  const result = await runLibtv(args, { timeout: 600000 }); // 视频最多 10 分钟
  if (!result.ok) {
    throw new Error('视频生成失败: ' + (result.error || '未知错误'));
  }

  const url = result.data?.data?.url?.[0] || result.data?.url?.[0];
  if (!url) {
    throw new Error('视频生成未返回 URL');
  }
  return url;
}
