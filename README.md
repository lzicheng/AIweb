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

如需同步操作时序轴的事件状态，可以另开终端启动轻量事件服务：

```bash
npm run events
```

开发服务器会通过 `vite.config.js` 将下列路径代理到本地后端服务：

- `/teams`：运营助手接口，默认代理到 `http://localhost:7777`
- `/ops-events`：事件状态服务，默认代理到 `http://localhost:8787`
- `/api/public`：告警态势接口，默认代理到 `http://localhost:9541`
- `/api/v1` 和 `/health`：数字人 ASR/TTS 服务，默认代理到 `http://localhost:8000`

## 环境变量

可在 `.env` 中覆盖默认接口和数字人配置。不要提交包含真实地址、密钥或个人环境信息的 `.env` 文件。

| 变量 | 用途 |
| --- | --- |
| `VITE_OPS_ASSISTANT_API_URL` | 运营助手运行接口地址 |
| `VITE_OPS_EVENTS_STEP_STATES_URL` | 操作步骤状态读取地址 |
| `VITE_ALERT_DASHBOARD_API_URL` | 告警态势仪表盘接口 |
| `VITE_ALERT_ALERTS_API_URL` | 告警列表接口 |
| `VITE_DIGITAL_HUMAN_ASR_API_URL` | 数字人语音识别接口 |
| `VITE_DIGITAL_HUMAN_TTS_API_URL` | 数字人语音合成接口 |
| `VITE_DIGITAL_HUMAN_HEALTH_URL` | 数字人服务健康检查接口 |
| `VITE_DIGITAL_HUMAN_LANGUAGE` | ASR/TTS 默认语言 |
| `VITE_DIGITAL_HUMAN_MODEL_URL` | Live2D 模型入口文件地址 |
| `VITE_DIGITAL_HUMAN_TTS_SPEED` | TTS 语速 |
| `VITE_OPS_ASSISTANT_PROXY_TARGET` | 开发环境 `/teams` 代理目标 |
| `VITE_OPS_EVENTS_PROXY_TARGET` | 开发环境 `/ops-events` 代理目标 |
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

## 静态演示服务器

项目提供了一个 PowerShell 静态服务器脚本，用于在没有 Vite dev server 的情况下服务 `dist`、`public` 和 Live2D SDK 资源，并代理 `/api/public` 到告警收敛系统。

先构建前端：

```bash
npm run build
```

从项目根目录启动：

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\static-server.ps1 -Port 4173 -ApiProxyTarget http://127.0.0.1:9541
```

如果 Live2D SDK 位于当前项目的上级目录，可以显式指定 SDK 路径：

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\static-server.ps1 -Port 4173 -SdkRoot ..\sdk -ApiProxyTarget http://127.0.0.1:9541
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
- `event-server.mjs`：操作时序轴事件状态服务。
