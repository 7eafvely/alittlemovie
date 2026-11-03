# Alittlemovie

面向个人创作者的剧本到 AI 短剧工作台。支持剧本拆镜、人物/风格提示词、预算规划，并可通过 MiniMax Hailuo 视频 API 逐镜提交真实视频生成任务。

## 本地运行

要求 Node.js 18.17 或更高版本：

```bash
git clone https://github.com/7eafvely/alittlemovie.git
cd alittlemovie
npm install
```

创建项目根目录的 `.env.local`（不要提交到 Git）：

```dotenv
MINIMAX_API_KEY=你的MiniMax_API_Key
ALITTLEMOVIE_ACCESS_CODE=自己设置的长随机访问码
```

重启开发服务并访问 http://localhost:3000：

```bash
npm run dev
```

在工作台粘贴剧本并拆解分镜，勾选“重点动态镜头”，调整镜头为服务商支持的 6 秒或 10 秒，保存草稿；点击右下角“生成视频”。输入 `ALITTLEMOVIE_ACCESS_CODE`，选择 768P/1080P，确认当前官方价格和账号余额并勾选费用确认后，逐镜提交任务。可选填写服务商可访问的 HTTPS 参考图链接；没有参考图时使用文本生成，人物一致性会更弱。任务完成后预览并立即下载视频，再用剪辑软件合成完整短剧。

## 真实视频生成的安全与费用

- 使用 MiniMax 官方 API：服务端调用 `POST https://api.minimax.io/v1/video_generation`，查询 `GET https://api.minimax.io/v2/query/video_generation/{task_id}`。访问令牌只由服务端读取。
- 参考文档：[创建视频生成任务](https://platform.minimax.io/docs/api-reference/video-generation-t2v)、[查询任务](https://platform.minimax.io/docs/api-reference/video-generation-v2-query)、[视频生成指南](https://platform.minimax.io/docs/guides/video-generation)。模型和 API 权限依账号、地区及官方变更而异；如果出现模型不可用/参数错误，以控制台当前文档为准。
- 视频生成会实际扣费。网页显示的成本只是按本地项目里填写的估算单价计算，并非 MiniMax 实时报价，也不能读取或强制限制账号账单。失败任务也可能计费；每次提交前请核对官方控制台，不要让所选镜头估算超出自己的月预算。
- 视频结果链接可能过期；生成完成后尽快下载并安全备份。当前版本不会把视频持久化到云存储，也不会自动剪辑/合成整集 MP4。
- `ALITTLEMOVIE_ACCESS_CODE` 是个人本地使用的轻量访问保护，不是完整用户认证。不要公开部署此服务、公开访问码或分享有密钥的实例；多人/公网使用前必须添加可靠登录、持久化限流和服务端真实额度控制。不要把 `.env.local`、API Key 或访问码提交到仓库。
- 本地项目草稿依旧存储在浏览器 `localStorage`；清理浏览器数据前先导出备份。

## API 密钥

在 [MiniMax 开放平台](https://platform.minimax.io/) 创建账号并按平台要求启用视频模型/开通余额或额度，获取 API Key。不要将密钥贴进聊天、前端表单或代码。`.env.local` 已被 Git 忽略。
