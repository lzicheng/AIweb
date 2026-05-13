# 数字人 Tab 设计文档

## 1. 背景与目标

当前前端是基于 Vite、React、Tailwind CSS 的单页应用，采用左侧导航加主内容区的 tab 切换方式。项目已在保持原有布局的基础上新增“数字人”tab，并完成了 `App.jsx` 的瘦身：`App.jsx` 负责应用外壳、导航和 tab 装配，具体页面逻辑下沉到独立 tab 组件。

数字人 tab 的目标是：

- 在现有布局中渲染 Live2D 数字人形象。
- 支持浏览器音频采集，将用户语音送往后端 ASR 服务识别。
- 将识别文本发送给运营助手 AI 后端。
- 将 AI 返回文本送往后端 TTS 服务，并由数字人同步播报。
- 后续接入任务时序轴，到点自动播报当前任务信息。

当前实现已经覆盖“用户对话数字人”的主链路：浏览器采集音频后调用真实 ASR 接口，识别文本再进入运营助手和 TTS 播放流程。ASR/TTS 服务异常时前端会展示错误并停止对应流程，不再生成占位识别文本。

## 2. 当前实现概览

### 2.1 应用结构

核心入口和页面结构如下：

```text
src/
  App.jsx
  appTabs.js
  TimelineTab.jsx
  ChatTab.jsx
  DigitalHumanTab.jsx
  dailyTasks.js
  taskTimeline.js        # 新增：时序计算纯函数
  taskAnnouncer.js       # 新增：播报文案生成
  useTaskSchedule.js     # 新增：任务调度 Hook
  opsAssistantApi.js
  digitalHumanSpeech.js
  contentPlaybackService.js
  useAudioRecorder.js
  live2dRenderer.js
  live2dShaderSources.js
  DigitalHumanTab.test.jsx
```

当前 `App.jsx` 已经从原先的大文件拆分为应用外壳，只负责：

- 保存当前激活 tab。
- 渲染左侧导航。
- 根据 `APP_TABS` 渲染当前 tab 组件。
- 保持现有主布局、背景和切换动画。

`appTabs.js` 统一声明 tab：

- `timeline`：操作时序轴。
- `chat`：运营助手。
- `digital-human`：数字人。

### 2.2 数字人 tab

`DigitalHumanTab.jsx` 是数字人页面的编排层，当前负责：

- 初始化 Live2D 渲染器。
- 初始化内容播放服务。
- 管理语音/文字输入模式。
- 管理会话 ID 和对话日志。
- 调用 ASR、运营助手、TTS 播放链路。
- 处理停止播报、重置会话、录音静音自动提交。

当前页面布局分为两栏：

- 左侧：Live2D 舞台和能力卡片。
- 右侧：对话记录、状态展示、语音/文字输入面板。

### 2.3 Live2D 渲染层

`live2dRenderer.js` 使用 Live2D Cubism SDK for Web 相关资源，当前默认加载 SDK 示例模型：

```text
sdk/Samples/Resources/Haru/Haru.model3.json
```

当前渲染层已实现：

- 动态加载 Cubism Core 脚本。
- 动态导入 Framework dist 模块。
- 初始化 WebGL 上下文。
- 加载模型、纹理、动作、表情、物理、姿势、用户数据。
- 处理窗口 resize。
- 处理鼠标指针追踪。
- 使用 requestAnimationFrame 驱动渲染循环。
- 暴露 `setAudioElement()` 用于绑定 TTS 音频元素。
- 暴露 `setSpeakingLevel()` 用于占位口型驱动。
- 在销毁时释放事件监听、动画帧和模型资源。

`live2dShaderSources.js` 保存内嵌 shader 源，用于适配当前工程里的 Cubism WebGL shader 加载。

### 2.4 音频采集

`useAudioRecorder.js` 封装浏览器音频采集能力，当前实现：

- 使用 `navigator.mediaDevices.getUserMedia()` 获取麦克风。
- 使用 `MediaRecorder` 录制音频。
- 按浏览器能力选择 `audio/webm;codecs=opus`、`audio/webm`、`audio/mp4` 或 `audio/ogg;codecs=opus`。
- 使用 `AudioContext + AnalyserNode` 监测音量。
- 支持静音自动停止，默认静音 1400ms 后触发提交。
- 启用 echo cancellation、noise suppression、auto gain control。
- 在卸载或重置时释放媒体流和音频上下文。

### 2.5 ASR/TTS 服务

`digitalHumanSpeech.js` 已接入后端 ASR/TTS REST 接口，接口地址由 `.env` 管理：

```text
POST /api/v1/asr
POST /api/v1/tts
```

ASR 当前请求格式：

- `multipart/form-data`
- 字段名：`audio`
- 文件名：`digital-human-input.webm`
- 附加字段：`language`，默认来自 `VITE_DIGITAL_HUMAN_LANGUAGE`

ASR 响应兼容字段：

- `text`
- `language`
- `confidence`

TTS 当前请求格式：

```json
{
  "text": "需要播报的文本",
  "language": "zh",
  "speed": 1.0
}
```

TTS 优先按后端约定接收 `audio/wav` 二进制内容，同时保留 JSON 音频地址兼容：

- 直接返回 `audio/*` 音频流。
- 返回 JSON：`audioUrl` 或 `url`，可选 `mimeType` 或 `contentType`。

当 ASR/TTS 服务不可用时：

- ASR 直接抛出服务错误，页面显示失败原因，不再继续调用运营助手。
- TTS 直接抛出服务错误，页面显示失败原因，避免误判为真实播报成功。

### 2.6 内容播放服务

`contentPlaybackService.js` 是当前“内容播放 API”的前端实现，核心入口为：

```js
playContent({ text, signal })
```

当前流程：

1. 停止上一段播放。
2. 调用 `synthesizeSpeech()` 请求 TTS。
3. 如果 TTS 返回音频地址，则交给隐藏的 `<audio>` 播放。
4. 播放期间通过音频分析驱动 Live2D 口型。

该服务是后续“到点任务播报”和“用户问答回复播报”的统一收口点。

### 2.7 运营助手接口

`opsAssistantApi.js` 负责调用现有运营助手后端：

```text
POST /teams/ops_team/runs
```

请求使用 `FormData`，主要字段：

- `message`
- `stream=false`
- `session_id`
- `monitor`
- `user_id`
- `version`
- `background`

响应解析兼容：

- 字符串响应。
- `content`、`reply`、`text`。
- `data.content`、`result.content`、`output.content`。
- OpenAI 风格的 `choices[0].message.content`。
- 错误详情字段。

### 2.8 操作时序轴

`TimelineTab.jsx` 目前仍持有大部分时序轴计算逻辑，包括：

- 每秒更新时间。
- 根据 `DAILY_TASKS` 构建任务 occurrence。
- 计算中心任务、前后窗口、到达状态、完成状态、进度条位置。
- 每 3 秒拉取外部步骤状态。

任务数据已独立到 `dailyTasks.js`，这是后续将任务调度逻辑抽成共享模块的基础。

当前事件服务在 `event-server.mjs` 中提供：

```text
GET  /ops-events/health
GET  /ops-events/step-states
POST /ops-events/step-events
```

Vite 开发代理当前配置：

```text
/teams      -> VITE_OPS_ASSISTANT_PROXY_TARGET，默认 http://localhost:7777
/ops-events -> VITE_OPS_EVENTS_PROXY_TARGET，默认 http://localhost:8787
/api/v1     -> VITE_DIGITAL_HUMAN_PROXY_TARGET，默认 http://localhost:8000
/health     -> VITE_DIGITAL_HUMAN_PROXY_TARGET，默认 http://localhost:8000
```

前端运行时配置集中在根目录 `.env`，业务代码通过 `src/appConfig.js` 读取。

当前 `.env` 主要配置项：

```text
VITE_OPS_ASSISTANT_API_URL=/teams/ops_team/runs
VITE_OPS_ASSISTANT_PROXY_TARGET=http://localhost:7777
VITE_OPS_EVENTS_STEP_STATES_URL=/ops-events/step-states
VITE_OPS_EVENTS_PROXY_TARGET=http://localhost:8787
VITE_DIGITAL_HUMAN_ASR_API_URL=/api/v1/asr
VITE_DIGITAL_HUMAN_HEALTH_URL=/health
VITE_DIGITAL_HUMAN_TTS_API_URL=/api/v1/tts
VITE_DIGITAL_HUMAN_PROXY_TARGET=http://localhost:8000
VITE_DIGITAL_HUMAN_LANGUAGE=zh
VITE_DIGITAL_HUMAN_TTS_SPEED=1.0
```

## 3. 当前对话链路

### 3.1 语音输入链路

```text
用户点击语音按钮
  -> useAudioRecorder.startRecording()
  -> 浏览器采集麦克风
  -> 静音检测触发 onSilence
  -> stopRecording() 生成 audioBlob
  -> recognizeSpeech(audioBlob)
  -> runOpsAssistant(text, sessionId)
  -> playContent(assistantReply)
  -> synthesizeSpeech(text)
  -> audio 播放并同步 Live2D 口型
  -> Live2D 口型同步
```

### 3.2 文字输入链路

```text
用户输入文字
  -> runOpsAssistant(text, sessionId)
  -> playContent(assistantReply)
  -> synthesizeSpeech(text)
  -> audio 播放并同步 Live2D 口型
  -> Live2D 口型同步
```

### 3.3 中断与重置

当前通过 `AbortController` 管理流程中断：

- 新播放开始前会 abort 上一次流程。
- 停止播报会停止 audio、清理 blob URL、清空口型。
- 重置会话会停止录音、停止播放、生成新 session ID、清空日志。

## 4. 待补齐的到点播报设计

用户目标之一是“到点播放任务信息”。当前数字人 tab 尚未接入时序轴自动播报，需要新增共享任务调度层，避免数字人 tab 和时序轴 tab 各自复制时间计算。

建议新增：

```text
src/taskTimeline.js
src/useTaskSchedule.js
src/taskAnnouncer.js
```

推荐职责：

- `taskTimeline.js`：从 `TimelineTab.jsx` 抽出纯函数，例如时间解析、occurrence 构建、当前任务计算。
- `useTaskSchedule.js`：封装 `now` 定时更新，返回当前任务、下一任务、是否到点。
- `taskAnnouncer.js`：根据任务生成数字人播报文案。

到点播报链路建议：

```text
useTaskSchedule()
  -> 检测进入新的任务 occurrence
  -> 判断该 occurrence 是否已播报
  -> buildTaskAnnouncement(currentTask)
  -> playContent({ source: "schedule", text })
```

必须保留幂等控制，建议使用 occurrence key：

```text
YYYY-MM-DDTHH:mm:ss + taskIndex
```

避免以下场景重复播报：

- React 重渲染。
- 切换 tab。
- 页面恢复焦点。
- 时间状态重新计算。

## 5. 推荐模块边界

当前文件已经可运行，但后续继续演进时建议逐步收敛为以下边界：

```text
src/
  App.jsx
  appTabs.js

  tabs/
    TimelineTab.jsx
    ChatTab.jsx
    DigitalHumanTab.jsx

  digital-human/
    contentPlaybackService.js
    digitalHumanSpeech.js
    live2dRenderer.js
    live2dShaderSources.js
    useAudioRecorder.js

  services/
    opsAssistantApi.js

  tasks/
    dailyTasks.js
    taskTimeline.js
    taskAnnouncer.js
    useTaskSchedule.js
```

当前不必一次性移动文件，避免引入无意义 churn。建议等到接入“到点播报”时再顺手抽出任务调度模块。

## 6. 后端接口契约

### 6.1 ASR

```http
POST /api/v1/asr
Content-Type: multipart/form-data
```

请求字段：

```text
audio: Blob/File
language: string，可选，默认 zh
```

响应：

```json
{
  "text": "帮我查看当前告警状态",
  "language": "zh",
  "confidence": -0.16
}
```

### 6.2 AI 问答

当前已使用：

```http
POST /teams/ops_team/runs
```

建议保持现状。数字人 tab 和运营助手 tab 已共用 `runOpsAssistant()`，避免重复实现。

### 6.3 TTS

```http
POST /api/v1/tts
Content-Type: application/json
Accept: audio/wav,audio/*,application/json
```

请求：

```json
{
  "text": "当前没有新的告警。",
  "language": "zh",
  "speed": 1.0
}
```

响应：直接音频流。

```text
Content-Type: audio/wav
```

## 7. Live2D 模型资源建议

当前默认使用 SDK 示例模型 `Haru`。生产化时建议：

- 将正式模型资源放入明确目录，例如 `src/live2d-models/assistant/` 或 `public/live2d/assistant/`。
- 使用自有模型的 `model3.json` 替换默认路径。
- 明确模型授权、贴图授权和动作授权。
- 将模型路径参数化，避免硬编码示例模型。
- 将“待机、说话、提醒、异常”动作分组约定写进模型资源说明。

建议动作状态：

```text
idle       待机
listening 监听用户
thinking  等待 AI 回复
speaking  播报中
alert     到点提醒或异常提示
error     服务异常
```

## 8. 风险与注意事项

- 浏览器自动播放限制：TTS 播放通常需要用户先点击页面触发音频上下文解锁。
- 麦克风权限：用户拒绝权限时必须回退到文字输入，当前已具备回退逻辑。
- 回声问题：数字人播报时不应同时采集麦克风，否则 ASR 可能识别到 TTS 声音。
- ASR/TTS 代理：当前 Vite 已将 `/api/v1` 代理到 `VITE_DIGITAL_HUMAN_PROXY_TARGET`，调整后端地址时只需修改 `.env`。
- 到点播报幂等：必须记录已播报 occurrence，避免重复播报。
- 资源体积：Cubism SDK 和模型资源较大，正式上线前需关注打包体积和缓存策略。
- WebGL 兼容性：不支持 WebGL 的浏览器应显示明确降级提示。

## 9. 测试现状与建议

当前已有 `DigitalHumanTab.test.jsx`，覆盖：

- 默认展示语音输入主态。
- 切换文字输入。
- 浏览器不支持录音时回退到文字输入。
- 录音中重置会话会先停止录音。
- 静音触发后自动提交语音问答链路。

建议后续补充：

- TTS 返回音频流时的播放成功路径。
- TTS 不可用时的错误展示和流程中断路径。
- 停止播报时是否中断 audio 和口型。
- 到点播报只触发一次。
- 切换 tab 后资源是否正确释放或保持预期状态。

## 10. 后续实施顺序

建议按以下顺序继续推进：

1. 启动 ASR/TTS 后端，并确认 `.env` 中 `VITE_DIGITAL_HUMAN_PROXY_TARGET` 指向实际服务。
2. 验证真实 TTS 音频流播放和口型同步。
3. 验证真实 ASR 音频格式与后端兼容性。
4. 从 `TimelineTab.jsx` 抽出共享任务调度逻辑。
5. 在 `DigitalHumanTab.jsx` 中接入到点播报。
6. 替换正式 Live2D 模型资源。
7. 将数字人相关文件按领域目录整理。

当前实现路线是合理的：保留现有 tab 结构，不引入 react-router；数字人页面通过一个统一的内容播放入口收敛 TTS 播报和 Live2D 口型；ASR、AI、TTS 分层封装，后续可以按服务能力继续扩展 WebSocket 或流式能力。
