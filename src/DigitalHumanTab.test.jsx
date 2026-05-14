import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import DigitalHumanTab from "./DigitalHumanTab";

const mocks = vi.hoisted(() => ({
  recorderState: {
    durationMs: 0,
    error: "",
    isRecording: false,
    isSupported: true,
    recorderStatus: "待命",
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
  },
  latestRecorderOptions: null,
  createLive2DRenderer: vi.fn(async () => ({
    dispose: vi.fn(),
  })),
  playContent: vi.fn(),
  stopPlayback: vi.fn(),
  runOpsAssistant: vi.fn(),
  recognizeSpeech: vi.fn(),
}));

vi.mock("./useAudioRecorder", () => ({
  useAudioRecorder: (options) => {
    mocks.latestRecorderOptions = options;
    return mocks.recorderState;
  },
}));

vi.mock("./live2dRenderer", () => ({
  createLive2DRenderer: mocks.createLive2DRenderer,
}));

vi.mock("./contentPlaybackService", () => ({
  createContentPlaybackService: () => ({
    playContent: mocks.playContent,
    stop: mocks.stopPlayback,
    dispose: vi.fn(),
  }),
}));

vi.mock("./opsAssistantApi", () => ({
  createSessionId: () => "test-session",
  runOpsAssistant: mocks.runOpsAssistant,
}));

vi.mock("./digitalHumanSpeech", () => ({
  recognizeSpeech: mocks.recognizeSpeech,
}));

describe("DigitalHumanTab", () => {
  beforeEach(() => {
    mocks.recorderState.durationMs = 0;
    mocks.recorderState.error = "";
    mocks.recorderState.isRecording = false;
    mocks.recorderState.isSupported = true;
    mocks.recorderState.recorderStatus = "待命";
    mocks.recorderState.startRecording.mockReset();
    mocks.recorderState.stopRecording.mockReset();
    mocks.latestRecorderOptions = null;
    mocks.createLive2DRenderer.mockClear();
    mocks.playContent.mockClear();
    mocks.stopPlayback.mockClear();
    mocks.runOpsAssistant.mockReset();
    mocks.recognizeSpeech.mockReset();
  });

  test("默认展示语音输入主态", () => {
    render(<DigitalHumanTab />);

    expect(screen.getByText("点击开始说话")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("输入你想对数字人说的话")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "结束并发送" })).not.toBeInTheDocument();
    expect(screen.queryByText("统一展示数字人听到的话、运营助手返回的消息以及当前会话状态。")).not.toBeInTheDocument();
    expect(screen.queryByText("输入方式")).not.toBeInTheDocument();
    expect(screen.queryByText("数字人回复")).not.toBeInTheDocument();
  });

  test("切换到文字输入后展示文本输入框", async () => {
    const user = userEvent.setup();
    render(<DigitalHumanTab />);

    await user.click(screen.getByRole("tab", { name: "文字输入" }));

    expect(screen.getByPlaceholderText("输入你想对数字人说的话")).toBeInTheDocument();
    expect(screen.queryByText("点击开始说话")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "切回语音输入" })).not.toBeInTheDocument();
    expect(screen.queryByText("文字聊天将直接调用运营助手接口，回复内容会继续通过 TTS 播放。")).not.toBeInTheDocument();
  });

  test("浏览器不支持录音时默认回退到文字输入", () => {
    mocks.recorderState.isSupported = false;

    render(<DigitalHumanTab />);

    expect(screen.getByPlaceholderText("输入你想对数字人说的话")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "语音输入" })).toBeDisabled();
  });

  test("展示麦克风采集诊断状态", () => {
    mocks.recorderState.recorderStatus = "正在请求麦克风权限";

    render(<DigitalHumanTab />);

    expect(screen.getByText("麦克风状态：正在请求麦克风权限")).toBeInTheDocument();
  });

  test("录音中重置会话会先停止录音", async () => {
    const user = userEvent.setup();
    mocks.recorderState.isRecording = true;
    mocks.recorderState.durationMs = 3200;
    mocks.recorderState.stopRecording.mockResolvedValue(new Blob(["voice"], { type: "audio/webm" }));

    render(<DigitalHumanTab />);

    await user.click(screen.getByRole("button", { name: "重置会话" }));

    expect(mocks.recorderState.stopRecording).toHaveBeenCalledTimes(1);
  });

  test("开始录音后静音会自动发送语音内容", async () => {
    const user = userEvent.setup();
    mocks.recorderState.startRecording.mockImplementation(async () => {
      mocks.recorderState.isRecording = true;
    });
    mocks.recorderState.stopRecording.mockResolvedValue(new Blob(["voice"], { type: "audio/webm" }));
    mocks.recognizeSpeech.mockResolvedValue({ text: "帮我查看告警状态" });
    mocks.runOpsAssistant.mockResolvedValue("当前没有新的告警。");

    render(<DigitalHumanTab />);

    await user.click(screen.getByRole("button", { name: "点击开始说话" }));

    expect(mocks.latestRecorderOptions?.onSilence).toBeTypeOf("function");

    await mocks.latestRecorderOptions.onSilence();

    await waitFor(() => {
      expect(mocks.recorderState.stopRecording).toHaveBeenCalledTimes(1);
      expect(mocks.recognizeSpeech).toHaveBeenCalledTimes(1);
      expect(mocks.runOpsAssistant).toHaveBeenCalledWith(
        expect.objectContaining({ message: "帮我查看告警状态", sessionId: "test-session" }),
      );
      expect(mocks.playContent).toHaveBeenCalledWith(
        expect.objectContaining({ text: "当前没有新的告警。" }),
      );
    });
  });

  test("录音中可以手动结束并发送语音内容", async () => {
    const user = userEvent.setup();
    mocks.recorderState.isRecording = true;
    mocks.recorderState.durationMs = 2600;
    mocks.recorderState.stopRecording.mockResolvedValue(new Blob(["voice"], { type: "audio/webm" }));
    mocks.recognizeSpeech.mockResolvedValue({ text: "查询当前任务" });
    mocks.runOpsAssistant.mockResolvedValue("当前任务是日常巡检。");

    render(<DigitalHumanTab />);

    await user.click(screen.getByRole("button", { name: "结束并发送" }));

    await waitFor(() => {
      expect(mocks.recorderState.stopRecording).toHaveBeenCalledTimes(1);
      expect(mocks.recognizeSpeech).toHaveBeenCalledTimes(1);
      expect(mocks.runOpsAssistant).toHaveBeenCalledWith(
        expect.objectContaining({ message: "查询当前任务", sessionId: "test-session" }),
      );
      expect(mocks.playContent).toHaveBeenCalledWith(
        expect.objectContaining({ text: "当前任务是日常巡检。" }),
      );
    });
  });

  test("ASR 失败时不再发送占位内容给运营助手", async () => {
    const user = userEvent.setup();
    mocks.recorderState.isRecording = true;
    mocks.recorderState.durationMs = 1800;
    mocks.recorderState.stopRecording.mockResolvedValue(new Blob(["voice"], { type: "audio/webm" }));
    mocks.recognizeSpeech.mockRejectedValue(new Error("ASR 服务异常：500"));

    render(<DigitalHumanTab />);

    await user.click(screen.getByRole("button", { name: "结束并发送" }));

    await waitFor(() => {
      expect(mocks.recorderState.stopRecording).toHaveBeenCalledTimes(1);
      expect(mocks.recognizeSpeech).toHaveBeenCalledTimes(1);
      expect(mocks.runOpsAssistant).not.toHaveBeenCalled();
      expect(screen.getByText("处理失败：ASR 服务异常：500")).toBeInTheDocument();
    });
  });

  test("录音文件为空时不调用 ASR", async () => {
    const user = userEvent.setup();
    mocks.recorderState.isRecording = true;
    mocks.recorderState.durationMs = 1200;
    mocks.recorderState.stopRecording.mockRejectedValue(new Error("未采集到有效音频，请确认麦克风权限和输入设备后重试。"));

    render(<DigitalHumanTab />);

    await user.click(screen.getByRole("button", { name: "结束并发送" }));

    await waitFor(() => {
      expect(mocks.recorderState.stopRecording).toHaveBeenCalledTimes(1);
      expect(mocks.recognizeSpeech).not.toHaveBeenCalled();
      expect(mocks.runOpsAssistant).not.toHaveBeenCalled();
      expect(screen.getByText("处理失败：未采集到有效音频，请确认麦克风权限和输入设备后重试。")).toBeInTheDocument();
    });
  });
});
