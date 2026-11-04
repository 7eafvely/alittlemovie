# Alittlemovie

面向个人创作者的剧本到 AI 短剧工作台。支持剧本拆镜、人物/风格提示词、预算规划、多服务商视频生成、成片预览与导出。

## 功能模块

| 模块 | 说明 |
|------|------|
| 剧本工作台 `/` | 粘贴剧本 → 拆解分镜 → 编辑镜头 → 本地保存/导出 |
| 角色与风格设定 | 统一角色形象与画面风格描述，复制提示词到外部工具生成参考图 |
| 预算计划 | 100 元月预算模拟，预估视频生成成本 |
| 视频生成 `/generate` | 逐镜提交 AI 视频生成任务，支持 MiniMax Hailuo / LibTV 角色模型 / Mock 测试 |
| 成片预览 `/edit` | 时间线预览、字幕编辑、JSON 配置导出、FFmpeg 合成脚本导出 |

## 本地运行

要求 Node.js 18.17 或更高版本：

```bash
git clone https://github.com/7eafvely/alittlemovie.git
cd alittlemovie
npm install
```

### 开发测试（Mock 模式）

无需任何 API Key，使用 mock 服务商测试完整工作流：

```dotenv
# .env.local
VIDEO_PROVIDER=mock
ALITTLEMOVIE_ACCESS_CODE=dev-test-123
```

### 接入真实视频生成（MiniMax）

创建项目根目录的 `.env.local`：

```dotenv
MINIMAX_API_KEY=你的MiniMax_API_Key
ALITTLEMOVIE_ACCESS_CODE=自己设置的长随机访问码
# 可选：Supabase 数据库持久化
NEXT_PUBLIC_SUPABASE_URL=你的Supabase项目URL
SUPABASE_SERVICE_ROLE_KEY=你的Supabase服务角色密钥
```

重启开发服务并访问 http://localhost:3000：

```bash
npm run dev
```

## 服务商抽象层

视频生成服务商可通过环境变量 `VIDEO_PROVIDER` 切换：

- `minimax`（默认）— MiniMax Hailuo 2.3
- `libtv` — LibTV（LiblibAI）角色模型，用角色定妆图作首帧的图生视频，保持人物一致性
- `mock` — 本地开发测试，不调用 API

添加新服务商：在 `lib/providers/` 下实现 `VideoProvider` 接口，并在 `registry.ts` 注册。

### 接入 LibTV 角色模型

LibTV 是 LiblibAI 的视频创作工具，提供「角色三视图 + 首帧图生视频」的角色一致性工作流。
在 [liblib.tv](https://www.liblib.tv)「用户中心 > API」获取 access key 后配置：

```dotenv
VIDEO_PROVIDER=libtv
LIBTV_ACCESS_KEY=你的LibTV_access_key
IMAGE_PROVIDER=libtv          # 定妆图也用 LibTV 角色模型生成（可选）
```

可选项：

| 变量 | 说明 | 默认 |
|------|------|------|
| `LIBTV_VIDEO_MODEL` | 视频模型（seedance-2.0-vip / kling-3.0 / wan-2.6 等） | `seedance-2.0-vip` |
| `LIBTV_IMAGE_MODEL` | 定妆图模型 | `seedream-5.0` |
| `LIBTV_API_BASE` | LibTV OpenAPI 域名 | `https://im.liblib.tv` |

LibTV 与 MiniMax 的接口形态不同：MiniMax 是「提交任务 → 轮询 task_id」，
LibTV 是「发自然语言消息到会话 → 轮询会话取回图片/视频 URL」。两者都通过统一的
`VideoProvider` / `ImageProvider` 接口暴露给前端，切换 `VIDEO_PROVIDER` / `IMAGE_PROVIDER`
即可，无需改前端代码。

## 数据库持久化（可选）

项目支持 Supabase 数据库存储。数据库 schema 见 `supabase/schema.sql`。

启用步骤：
1. 在 [Supabase](https://supabase.com) 创建项目
2. 在 SQL Editor 中执行 `supabase/schema.sql`
3. 配置 `NEXT_PUBLIC_SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY`

未配置 Supabase 时，项目数据仍保存在浏览器 `localStorage`。
