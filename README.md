# Ops Console Web

SRCB 智能运营系统前端控制台，基于 Vite、React 和 Tailwind CSS 构建。页面以左侧导航组织多个运营工作台，用于展示操作时序、运营助手、告警态势和数字人交互能力。

## 功能模块

- 操作时序轴：展示运营流程步骤和事件状态。
- 运营助手：通过后端运营助手接口发起任务运行。
- 告警态势：读取告警收敛系统的仪表盘和告警列表接口。
- 数字人：集成 Live2D 模型，并对接 ASR、TTS 和健康检查接口。

## 环境要求

- Node.js 20.19+ 或 22.12+
- npm
- PowerShell（仅静态演示服务器需要）

## 本地开发

安装依赖：

```bash
npm install
```

启动前端开发服务器：

```bash
npm run dev
```

开发服务器会通过 `vite.config.js` 将下列路径代理到本地后端服务：

- `/teams`：运营助手接口，默认代理到 `http://localhost:7777`
- `/api/step-status`：时序轴 Step Status API，默认代理到 `http://localhost:8000`
- `/api/public`：告警态势接口，默认代理到 `http://localhost:9541`
- `/api/v1` 和 `/health`：数字人 ASR/TTS 服务，默认代理到 `http://localhost:8000`

## 环境变量

可在 `.env` 中覆盖默认接口和数字人配置。不要提交包含真实地址、密钥或个人环境信息的 `.env` 文件。

| 变量 | 用途 |
| --- | --- |
| `VITE_OPS_ASSISTANT_API_URL` | 运营助手运行接口地址 |
| `VITE_STEP_STATUS_API_URL` | 操作步骤状态读取地址 |
| `VITE_DAILY_TASKS_URL` | 运行期任务配置 JSON 地址 |
| `VITE_ALERT_DASHBOARD_API_URL` | 告警态势仪表盘接口 |
| `VITE_ALERT_ALERTS_API_URL` | 告警列表接口 |
| `VITE_DIGITAL_HUMAN_ASR_API_URL` | 数字人语音识别接口 |
| `VITE_DIGITAL_HUMAN_TTS_API_URL` | 数字人语音合成接口 |
| `VITE_DIGITAL_HUMAN_HEALTH_URL` | 数字人服务健康检查接口 |
| `VITE_DIGITAL_HUMAN_LANGUAGE` | ASR/TTS 默认语言 |
| `VITE_DIGITAL_HUMAN_MODEL_URL` | Live2D 模型入口文件地址 |
| `VITE_DIGITAL_HUMAN_TTS_SPEED` | TTS 语速 |
| `VITE_OPS_ASSISTANT_PROXY_TARGET` | 开发环境 `/teams` 代理目标 |
| `VITE_STEP_STATUS_PROXY_TARGET` | 开发环境 `/api/step-status` 代理目标 |
| `VITE_ALERT_CONVERGER_HOST` | 开发环境告警态势接口 IP/主机名，优先用于生成 `/api/public` 代理目标 |
| `VITE_ALERT_CONVERGER_PORT` | 开发环境告警态势接口端口，优先用于生成 `/api/public` 代理目标 |
| `VITE_ALERT_CONVERGER_PROXY_TARGET` | 开发环境 `/api/public` 代理目标 |
| `VITE_DIGITAL_HUMAN_PROXY_TARGET` | 开发环境 `/api/v1` 和 `/health` 代理目标 |

## 构建与预览

生成生产构建：

```bash
npm run build
```

使用 Vite 预览构建产物：

```bash
npm run preview
```

## Docker 部署

项目支持通过 Docker Compose 构建并运行生产镜像。镜像采用多阶段构建：先用 Node.js 执行 `npm run build`，再用 Nginx 托管 `dist` 静态文件。

启动：

```bash
docker compose up --build -d
```

默认访问地址为 `http://127.0.0.1:8080/`，可以通过 `WEB_PORT` 覆盖宿主机端口：

```bash
WEB_PORT=4173 docker compose up --build -d
```

### 运行时配置

容器启动时会根据 `docker-compose.yml` 中的环境变量生成 `/config.js`，前端优先读取 `window.__APP_CONFIG__`。因此接口地址、数字人模型地址、语言和语速等配置可以通过 Compose 调整，重启容器后生效，不需要重新构建前端代码。

操作时序轴任务也支持运行期配置。默认会读取 `VITE_DAILY_TASKS_URL` 指向的 JSON，例如 `/config/daily-tasks.json`；读取失败或内容不合法时会回退到 `src/dailyTasks.js` 中的内置默认任务。JSON 支持两种格式：

```json
{
  "tasks": [
    {
      "time": "08:00",
      "title": "日常巡检",
      "steps": [
        { "id": "", "text": "巡检任务说明" },
        { "id": "db_check", "text": "数据库巡检" }
      ]
    }
  ]
}
```

也可以直接使用任务数组作为根节点。生产环境可把 JSON 文件挂载到 Nginx 静态目录，例如挂载到 `/usr/share/nginx/html/config/daily-tasks.json`，再通过 `VITE_DAILY_TASKS_URL=/config/daily-tasks.json` 指向它。前端会定时重新读取该文件，修改 JSON 后无需重新构建前端。

`VITE_*_API_URL` 建议保持为同源相对路径，例如 `/api/v1/tts`。Nginx 会根据下列代理目标把请求转发到实际后端：

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `VITE_OPS_ASSISTANT_PROXY_TARGET` | `http://host.docker.internal:7777` | `/teams` 代理目标 |
| `VITE_STEP_STATUS_PROXY_TARGET` | `http://host.docker.internal:8000` | `/api/step-status` 代理目标 |
| `VITE_ALERT_CONVERGER_HOST` | `host.docker.internal` | 告警态势接口 IP/主机名，优先用于生成 `/api/public` 代理目标 |
| `VITE_ALERT_CONVERGER_PORT` | `9541` | 告警态势接口端口，优先用于生成 `/api/public` 代理目标 |
| `VITE_ALERT_CONVERGER_PROXY_TARGET` | `http://host.docker.internal:9541` | `/api/public` 代理目标；未配置 host/port 时使用 |
| `VITE_DIGITAL_HUMAN_PROXY_TARGET` | `http://host.docker.internal:8002` | `/api/v1` 和 `/health` 代理目标 |

如果后端服务也放入同一个 Compose 网络，把代理目标改为服务名即可，例如 `http://digital-human:8002`。不要把密钥、Token 或数据库密码写入 `VITE_*` 变量；这些值会暴露给浏览器。

## 静态演示服务器

项目提供了一个 PowerShell 静态服务器脚本，用于在没有 Vite dev server 的情况下服务 `dist`、`public` 和 Live2D SDK 资源，并代理 `/api/public` 到告警收敛系统。

先构建前端：

```bash
npm run build
```

从项目根目录启动：

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\static-server.ps1 -Port 4173 -AlertConvergerHost 127.0.0.1 -AlertConvergerPort 9541
```

如果 Live2D SDK 位于当前项目的上级目录，可以显式指定 SDK 路径：

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\static-server.ps1 -Port 4173 -SdkRoot ..\sdk -AlertConvergerHost 127.0.0.1 -AlertConvergerPort 9541
```

启动后访问 `http://127.0.0.1:4173/`。

## 测试

运行单次测试：

```bash
npm run test
```

启动监听模式：

```bash
npm run test:watch
```

## 目录说明

- `src/`：React 应用源码。
- `src/appConfig.js`：前端运行时配置和环境变量读取。
- `src/appTabs.js`：控制台页签注册。
- `public/`：静态资源和 Live2D 模型资源。
- `tools/static-server.ps1`：静态演示服务器。
