// LibTV（LiblibAI 视频创作工具）OpenAPI 客户端。
// 鉴权：Authorization: Bearer <LIBTV_ACCESS_KEY>，基础地址默认 https://im.liblib.tv。
// 与 MiniMax 的任务式接口不同，LibTV 是「会话式」：发一条自然语言消息，后端 Agent
// 按指令路由到具体模型（图像/视频），结果通过轮询会话消息列表取回。

const LIBTV_BASE = process.env.LIBTV_API_BASE || 'https://im.liblib.tv';

export interface LibTvMessage {
  role: 'user' | 'assistant' | 'tool' | string;
  content: string;
  seq?: number;
}

export interface LibTvSession {
  projectUuid: string;
  sessionId: string;
}

export class LibTvError extends Error {
  constructor(message: string, readonly httpCode?: number) {
    super(message);
    this.name = 'LibTvError';
  }
}

function requireAccessKey(): string {
  const key = process.env.LIBTV_ACCESS_KEY;
  if (!key) throw new LibTvError('服务端尚未配置 LIBTV_ACCESS_KEY。');
  return key;
}

async function libtvRequest(
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown } = {}
): Promise<Record<string, unknown>> {
  const key = requireAccessKey();
  const init: RequestInit = {
    method: options.method ?? 'GET',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  };
  if (options.body !== undefined) init.body = JSON.stringify(options.body);

  const response = await fetch(`${LIBTV_BASE}${path}`, init);
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const message = typeof data.message === 'string' ? data.message : `LibTV 接口返回 HTTP ${response.status}`;
    throw new LibTvError(message, response.status);
  }
  return data;
}

/** 创建会话或向已有会话发送消息。返回 { projectUuid, sessionId }。 */
export async function libtvCreateSession(message: string, sessionId = ''): Promise<LibTvSession> {
  const body: Record<string, string> = {};
  if (sessionId) body.sessionId = sessionId;
  if (message) body.message = message;
  const data = await libtvRequest('/openapi/session', { method: 'POST', body });
  const session = (data.data ?? data) as LibTvSession;
  if (!session?.sessionId) throw new LibTvError('LibTV 未返回 sessionId。');
  return session;
}

/** 查询会话消息列表（支持 afterSeq 增量拉取）。 */
export async function libtvQuerySession(sessionId: string, afterSeq = 0): Promise<LibTvMessage[]> {
  const path =
    afterSeq > 0
      ? `/openapi/session/${encodeURIComponent(sessionId)}?afterSeq=${afterSeq}`
      : `/openapi/session/${encodeURIComponent(sessionId)}`;
  const data = await libtvRequest(path);
  const messages = (data.data as { messages?: LibTvMessage[] } | undefined)?.messages;
  return Array.isArray(messages) ? messages : [];
}

// 结果 URL 常见于 LibTV 资源域 libtv-res.liblib.art，也可能落在其他公开 CDN。
const MEDIA_URL_PATTERN = /https:\/\/[^\s"'<>]+\.(?:png|jpg|jpeg|webp|gif|mp4|mov|webm)(?:\?[^\s"'<>]*)?/g;

interface LibTvTaskResult {
  images?: Array<{ previewPath?: string; url?: string }>;
  videos?: Array<{ previewPath?: string; url?: string }>;
}

function parseToolResult(content: string): LibTvTaskResult | null {
  try {
    const data = JSON.parse(content) as { task_result?: LibTvTaskResult };
    return data.task_result ?? null;
  } catch {
    return null;
  }
}

function dedupe(urls: string[]): string[] {
  return Array.from(new Set(urls.filter(Boolean)));
}

const IMAGE_EXT = /\.(?:png|jpg|jpeg|webp|gif)(?:\?|$)/i;
const VIDEO_EXT = /\.(?:mp4|mov|webm)(?:\?|$)/i;

/** 从会话消息中提取生成的视频 URL。 */
export function extractVideoUrls(messages: LibTvMessage[]): string[] {
  const urls: string[] = [];
  for (const msg of messages) {
    if (msg.role === 'tool') {
      const taskResult = parseToolResult(msg.content);
      for (const video of taskResult?.videos ?? []) {
        const url = video.previewPath || video.url;
        if (url) urls.push(url);
      }
    } else if (msg.role === 'assistant') {
      for (const match of msg.content.match(MEDIA_URL_PATTERN) ?? []) {
        if (VIDEO_EXT.test(match)) urls.push(match);
      }
    }
  }
  return dedupe(urls);
}

/** 从会话消息中提取生成的图片 URL。 */
export function extractImageUrls(messages: LibTvMessage[]): string[] {
  const urls: string[] = [];
  for (const msg of messages) {
    if (msg.role === 'tool') {
      const taskResult = parseToolResult(msg.content);
      for (const image of taskResult?.images ?? []) {
        const url = image.previewPath || image.url;
        if (url) urls.push(url);
      }
    } else if (msg.role === 'assistant') {
      for (const match of msg.content.match(MEDIA_URL_PATTERN) ?? []) {
        if (IMAGE_EXT.test(match)) urls.push(match);
      }
    }
  }
  return dedupe(urls);
}

/** 从会话消息中推断是否失败，返回错误文案（无则 null）。 */
export function detectLibTvError(messages: LibTvMessage[]): string | null {
  const hit = messages.find((msg) => {
    if (msg.role !== 'assistant' && msg.role !== 'tool') return false;
    return /失败|错误|不足|余额|无权|拒绝|超时/i.test(msg.content);
  });
  return hit ? hit.content.trim().slice(0, 300) : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 轮询会话直到取到图片 URL。 */
export async function pollForImages(
  sessionId: string,
  options: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<string[]> {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const intervalMs = options.intervalMs ?? 5_000;
  const deadline = Date.now() + timeoutMs;
  let afterSeq = 0;
  while (Date.now() < deadline) {
    const messages = await libtvQuerySession(sessionId, afterSeq);
    if (messages.length) afterSeq = Math.max(afterSeq, ...messages.map((m) => m.seq ?? 0));
    const images = extractImageUrls(messages);
    if (images.length) return images;
    const error = detectLibTvError(messages);
    if (error) throw new LibTvError(error);
    await sleep(intervalMs);
  }
  return [];
}
