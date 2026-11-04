// 生成剩余 7 位角色定妆图（MiniMax 文生图），复用 .env.local 的 key 与 base
import { readFileSync } from 'node:fs';

const env = readFileSync('.env.local', 'utf8');
const key = (env.match(/^MINIMAX_API_KEY=(.+)$/m) || [])[1]?.trim();
const base = (env.match(/^MINIMAX_API_BASE=(.+)$/m) || [])[1]?.trim() || 'https://api.minimax.io';
if (!key) { console.error('NO KEY'); process.exit(1); }

const cast = {
  唐糖: '24岁女性，圆脸元気，浅色卫衣，活泼话多',
  祁越: '29岁男性，深蓝西装，金丝眼镜，稳重可靠',
  云舒窈: '26岁女性，冷紫灰套装，长发，表面知性实则心机',
  秦蔓: '50岁女性，暗红套装，妆容精致，气场凌厉',
  秦朗: '25岁男性，深褐西装，神情倨傲',
  霍正邦: '55岁男性，深灰中山装，威严',
  韩川: '27岁男性，清秀微驼，桃花眼，浅棕休闲西装，油滑',
};

const promptFor = (name) =>
  `电影感真人写实角色定妆图，${name}，${cast[name]}。正面半身，面部清晰，柔和均匀影棚光，中性浅灰纯色背景，超高清，真实皮肤纹理与发丝细节，无文字，无水印`;

async function gen(name) {
  const resp = await fetch(`${base}/v1/image_generation`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'image-01',
      prompt: promptFor(name),
      aspect_ratio: '9:16',
      response_format: 'url',
      n: 1,
      prompt_optimizer: true,
    }),
    cache: 'no-store',
  });
  const data = await resp.json().catch(() => ({}));
  const code = data.base_resp?.status_code ?? 0;
  if (!resp.ok || code !== 0) {
    const msg = data.base_resp?.status_msg || `HTTP ${resp.status}`;
    throw new Error(`${name}: ${msg}`);
  }
  const url = data.data?.image_urls?.[0];
  if (!url) throw new Error(`${name}: 未返回图片地址`);
  return { name, url };
}

const results = [];
for (const name of Object.keys(cast)) {
  try {
    const r = await gen(name);
    results.push(r);
    console.log(`${name}\t${r.url}`);
  } catch (e) {
    console.error(`FAIL ${e.message}`);
  }
}
console.log('\n=== JSON ===');
console.log(JSON.stringify(Object.fromEntries(results.map((r) => [r.name, r.url])), null, 2));
