import { LIVE2D_SHADER_SOURCES } from "./live2dShaderSources";

const LIVE2D_CORE_SCRIPT_URL = new URL("../sdk/Core/live2dcubismcore.min.js", import.meta.url).href;
const LIVE2D_FRAMEWORK_DIST_URL = new URL("../sdk/Framework/dist/live2dcubismframework.js", import.meta.url).href;
const DEFAULT_MODEL_SETTINGS_URL = new URL("../sdk/Samples/Resources/Haru/Haru.model3.json", import.meta.url).href;

const MOTION_GROUP_IDLE = "Idle";
const MOTION_GROUP_TAP_BODY = "TapBody";
const PRIORITY_IDLE = 1;
const PRIORITY_NORMAL = 2;
const PRIORITY_FORCE = 3;
const SPEAKING_THRESHOLD = 0.08;

let cubismModulesPromise = null;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(from, to, t) {
  return from + (to - from) * t;
}

function waitFor(predicate, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const check = () => {
      if (predicate()) {
        resolve();
        return;
      }

      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error("等待 Live2D 资源初始化超时。"));
        return;
      }

      window.setTimeout(check, 16);
    };

    check();
  });
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-live2d-script="${src}"]`)) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.live2dScript = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`加载脚本失败：${src}`));
    document.body.appendChild(script);
  });
}

async function ensureCoreInjectedToGlobal(src) {
  let cubismCore = globalThis.Live2DCubismCore || window.Live2DCubismCore;
  if (cubismCore) return cubismCore;

  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`加载 Core 兜底脚本失败：${response.status}`);
  }

  const inlineScript = document.createElement("script");
  inlineScript.dataset.live2dScriptInline = src;
  inlineScript.text = await response.text();
  document.body.appendChild(inlineScript);

  cubismCore = globalThis.Live2DCubismCore || window.Live2DCubismCore;
  return cubismCore;
}

async function ensureCubismCore() {
  await loadScript(LIVE2D_CORE_SCRIPT_URL);

  const cubismCore = await ensureCoreInjectedToGlobal(LIVE2D_CORE_SCRIPT_URL);
  if (!cubismCore) {
    throw new Error("Live2D Cubism Core 未正确加载到全局上下文。");
  }

  const modules = await loadCubismModules();
  const { CubismFramework } = modules;
  CubismFramework.startUp();
  CubismFramework.initialize();
  return modules;
}

async function fetchArrayBuffer(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`加载资源失败：${response.status} ${url}`);
  }
  return response.arrayBuffer();
}

function createTexture(gl, url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const texture = gl.createTexture();
      if (!texture) {
        reject(new Error(`无法创建纹理对象：${url}`));
        return;
      }

      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.bindTexture(gl.TEXTURE_2D, null);

      resolve(texture);
    };

    image.onerror = () => reject(new Error(`加载纹理失败：${url}`));
    image.src = url;
  });
}

function patchShaderLoader(gl, modules) {
  const { CubismShaderManager_WebGL } = modules;
  const shaderManager = CubismShaderManager_WebGL.getInstance();
  const shader = shaderManager.getShader(gl);
  if (!shader || shader.__cursorEmbeddedShaderPatched) {
    return;
  }

  shader.loadShaders = async () => {
    Object.assign(shader, LIVE2D_SHADER_SOURCES);
  };
  shader.__cursorEmbeddedShaderPatched = true;
  shader.setShaderPath("embedded://cursor-live2d/");
}

async function ensureShaderPrograms(renderer, gl) {
  const modules = await loadCubismModules();
  patchShaderLoader(gl, modules);
  renderer.loadShaders();

  const shader = modules.CubismShaderManager_WebGL.getInstance().getShader(gl);
  await waitFor(() => !!shader?._isShaderLoaded, 4000);
}

function createProjectionMatrix(canvas, CubismMatrix44) {
  const matrix = new CubismMatrix44();
  const width = Math.max(1, canvas.width);
  const height = Math.max(1, canvas.height);
  const aspect = width / height;

  if (aspect > 1) {
    matrix.scale(1 / aspect, 1);
  } else {
    matrix.scale(1, aspect);
  }

  return matrix;
}

class SpeakingParameterProvider {
  constructor() {
    this.level = 0;
  }

  setLevel(level) {
    this.level = clamp(level, 0, 1);
  }

  update() {
    return true;
  }

  getParameter() {
    return this.level;
  }
}

class AudioLevelTracker {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.audioElement = null;
    this.dataArray = null;
    this.sourceNode = null;
  }

  async setAudioElement(audioElement) {
    if (!audioElement || this.audioElement === audioElement) return;

    this.audioElement = audioElement;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return;

    this.audioContext = this.audioContext || new AudioContextCtor();
    this.analyser = this.analyser || this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.dataArray = new Uint8Array(this.analyser.fftSize);

    if (!this.sourceNode) {
      this.sourceNode = this.audioContext.createMediaElementSource(audioElement);
      this.sourceNode.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
    }

    audioElement.addEventListener("play", () => {
      if (this.audioContext?.state === "suspended") {
        this.audioContext.resume().catch(() => {
          // 用户手势限制时忽略，仍可退回占位口型
        });
      }
    });
  }

  getLevel() {
    if (!this.audioElement || !this.analyser || !this.dataArray) {
      return 0;
    }

    if (this.audioElement.paused || this.audioElement.ended) {
      return 0;
    }

    this.analyser.getByteTimeDomainData(this.dataArray);
    let sum = 0;
    for (let index = 0; index < this.dataArray.length; index += 1) {
      const normalized = (this.dataArray[index] - 128) / 128;
      sum += normalized * normalized;
    }

    const rms = Math.sqrt(sum / this.dataArray.length);
    return clamp(rms * 6.8, 0, 1);
  }
}

async function loadCubismModules() {
  if (!cubismModulesPromise) {
    cubismModulesPromise = (async () => {
      const [
        frameworkModule,
        defaultParameterModule,
        modelSettingModule,
        matrixModule,
        userModelModule,
        schedulerModule,
        expressionUpdaterModule,
        eyeBlinkUpdaterModule,
        breathUpdaterModule,
        physicsUpdaterModule,
        poseUpdaterModule,
        lookUpdaterModule,
        lipSyncUpdaterModule,
        eyeBlinkModule,
        breathModule,
        lookModule,
        shaderModule,
      ] = await Promise.all([
        import("../sdk/Framework/dist/live2dcubismframework.js"),
        import("../sdk/Framework/dist/cubismdefaultparameterid.js"),
        import("../sdk/Framework/dist/cubismmodelsettingjson.js"),
        import("../sdk/Framework/dist/math/cubismmatrix44.js"),
        import("../sdk/Framework/dist/model/cubismusermodel.js"),
        import("../sdk/Framework/dist/motion/cubismupdatescheduler.js"),
        import("../sdk/Framework/dist/motion/cubismexpressionupdater.js"),
        import("../sdk/Framework/dist/motion/cubismeyeblinkupdater.js"),
        import("../sdk/Framework/dist/motion/cubismbreathupdater.js"),
        import("../sdk/Framework/dist/motion/cubismphysicsupdater.js"),
        import("../sdk/Framework/dist/motion/cubismposeupdater.js"),
        import("../sdk/Framework/dist/motion/cubismlookupdater.js"),
        import("../sdk/Framework/dist/motion/cubismlipsyncupdater.js"),
        import("../sdk/Framework/dist/effect/cubismeyeblink.js"),
        import("../sdk/Framework/dist/effect/cubismbreath.js"),
        import("../sdk/Framework/dist/effect/cubismlook.js"),
        import("../sdk/Framework/dist/rendering/cubismshader_webgl.js"),
      ]);

      return {
        CubismFramework: frameworkModule.CubismFramework,
        CubismDefaultParameterId: defaultParameterModule.CubismDefaultParameterId,
        CubismModelSettingJson: modelSettingModule.CubismModelSettingJson,
        CubismMatrix44: matrixModule.CubismMatrix44,
        CubismUserModel: userModelModule.CubismUserModel,
        CubismUpdateScheduler: schedulerModule.CubismUpdateScheduler,
        CubismExpressionUpdater: expressionUpdaterModule.CubismExpressionUpdater,
        CubismEyeBlinkUpdater: eyeBlinkUpdaterModule.CubismEyeBlinkUpdater,
        CubismBreathUpdater: breathUpdaterModule.CubismBreathUpdater,
        CubismPhysicsUpdater: physicsUpdaterModule.CubismPhysicsUpdater,
        CubismPoseUpdater: poseUpdaterModule.CubismPoseUpdater,
        CubismLookUpdater: lookUpdaterModule.CubismLookUpdater,
        CubismLipSyncUpdater: lipSyncUpdaterModule.CubismLipSyncUpdater,
        CubismEyeBlink: eyeBlinkModule.CubismEyeBlink,
        CubismBreath: breathModule.CubismBreath,
        BreathParameterData: breathModule.BreathParameterData,
        CubismLook: lookModule.CubismLook,
        LookParameterData: lookModule.LookParameterData,
        CubismShaderManager_WebGL: shaderModule.CubismShaderManager_WebGL,
      };
    })();
  }

  return cubismModulesPromise;
}

function createCubismSingleModelRuntimeClass(modules) {
  const {
    CubismFramework,
    CubismDefaultParameterId,
    CubismModelSettingJson,
    CubismMatrix44,
    CubismUserModel,
    CubismUpdateScheduler,
    CubismExpressionUpdater,
    CubismEyeBlinkUpdater,
    CubismBreathUpdater,
    CubismPhysicsUpdater,
    CubismPoseUpdater,
    CubismLookUpdater,
    CubismLipSyncUpdater,
    CubismEyeBlink,
    CubismBreath,
    BreathParameterData,
    CubismLook,
    LookParameterData,
  } = modules;

  return class CubismSingleModelRuntime extends CubismUserModel {
    constructor({ gl, canvas, modelSettingsUrl }) {
      super();
      this.gl = gl;
      this.canvas = canvas;
      // 处理相对路径：如果是绝对路径（以 / 开头），需要转换为完整 URL
      const absoluteUrl = modelSettingsUrl.startsWith("/") || modelSettingsUrl.startsWith("http")
        ? new URL(modelSettingsUrl, window.location.origin).href
        : modelSettingsUrl;
      this.modelSettingsUrl = absoluteUrl;
      this.modelHomeDir = new URL(".", absoluteUrl).href;

      this.updateScheduler = new CubismUpdateScheduler();
      this.speakingProvider = new SpeakingParameterProvider();
      this.audioLevelTracker = new AudioLevelTracker();
      this.motionLoaders = new Map();
      this.expressionNames = [];
      this.boundTextures = [];
      this._motions = new Map();
      this._expressions = new Map();
      this._eyeBlinkIds = [];
      this._lipSyncIds = [];

      this.manualSpeakingLevel = 0;
      this.smoothedSpeakingLevel = 0;
      this.lookTargetX = 0;
      this.lookTargetY = 0;
      this.lookCurrentX = 0;
      this.lookCurrentY = 0;
      this.isSpeaking = false;
      this.lastTalkAnimationAt = 0;
      this.lastIdleExpressionAt = 0;
      this.IDLE_EXPRESSION_INTERVAL = 10 * 60 * 1000; // 10分钟 = 600000毫秒
      this.motionUpdated = false;

      const idManager = CubismFramework.getIdManager();
      this.paramAngleX = idManager.getId(CubismDefaultParameterId.ParamAngleX);
      this.paramAngleY = idManager.getId(CubismDefaultParameterId.ParamAngleY);
      this.paramAngleZ = idManager.getId(CubismDefaultParameterId.ParamAngleZ);
      this.paramBodyAngleX = idManager.getId(CubismDefaultParameterId.ParamBodyAngleX);
      this.paramEyeBallX = idManager.getId(CubismDefaultParameterId.ParamEyeBallX);
      this.paramEyeBallY = idManager.getId(CubismDefaultParameterId.ParamEyeBallY);
      this.paramMouthOpenY = idManager.getId(CubismDefaultParameterId.ParamMouthOpenY);
      this.paramMouthForm = idManager.getId(CubismDefaultParameterId.ParamMouthForm);
      this.paramCheek = idManager.getId(CubismDefaultParameterId.ParamCheek);
      this.paramBreath = idManager.getId(CubismDefaultParameterId.ParamBreath);
      this.CubismMatrix44 = CubismMatrix44;
      this.CubismModelSettingJson = CubismModelSettingJson;
    }

    async initialize() {
      const modelSettingBuffer = await fetchArrayBuffer(this.modelSettingsUrl);
      this._modelSetting = new this.CubismModelSettingJson(modelSettingBuffer, modelSettingBuffer.byteLength);

      await this.loadModelFile();
      await this.loadExpressions();
      await this.loadPhysicsFile();
      await this.loadPoseFile();
      await this.loadUserDataFile();

      this.setupUpdaters({
        CubismEyeBlink,
        CubismBreath,
        BreathParameterData,
        CubismExpressionUpdater,
        CubismEyeBlinkUpdater,
        CubismBreathUpdater,
        CubismPhysicsUpdater,
        CubismPoseUpdater,
        CubismLipSyncUpdater,
        CubismLook,
        LookParameterData,
        CubismLookUpdater,
      });
      this.setupLayout();

      this.createRenderer(this.canvas.width, this.canvas.height);
      this.getRenderer().startUp(this.gl);
      this.getRenderer().setIsPremultipliedAlpha(true);

      await this.bindTextures();
      await ensureShaderPrograms(this.getRenderer(), this.gl);

      await this.startRandomMotion(MOTION_GROUP_IDLE, PRIORITY_IDLE);
    }

    async loadModelFile() {
      const modelFileName = this._modelSetting.getModelFileName();
      if (!modelFileName) {
        throw new Error("model3.json 未声明 moc3 文件。");
      }

      const modelBuffer = await fetchArrayBuffer(new URL(modelFileName, this.modelHomeDir).href);
      this.loadModel(modelBuffer, true);
    }

    async loadExpressions() {
      const expressionCount = this._modelSetting.getExpressionCount();
      for (let index = 0; index < expressionCount; index += 1) {
        const expressionName = this._modelSetting.getExpressionName(index);
        const expressionFileName = this._modelSetting.getExpressionFileName(index);
        if (!expressionFileName) continue;

        const expressionBuffer = await fetchArrayBuffer(new URL(expressionFileName, this.modelHomeDir).href);
        const expressionMotion = this.loadExpression(
          expressionBuffer,
          expressionBuffer.byteLength,
          expressionName,
        );

        if (expressionMotion) {
          this._expressions.set(expressionName, expressionMotion);
          this.expressionNames.push(expressionName);
        }
      }
    }

    async loadPhysicsFile() {
      const physicsFileName = this._modelSetting.getPhysicsFileName();
      if (!physicsFileName) return;

      const physicsBuffer = await fetchArrayBuffer(new URL(physicsFileName, this.modelHomeDir).href);
      this.loadPhysics(physicsBuffer, physicsBuffer.byteLength);
    }

    async loadPoseFile() {
      const poseFileName = this._modelSetting.getPoseFileName();
      if (!poseFileName) return;

      const poseBuffer = await fetchArrayBuffer(new URL(poseFileName, this.modelHomeDir).href);
      this.loadPose(poseBuffer, poseBuffer.byteLength);
    }

    async loadUserDataFile() {
      const userDataFile = this._modelSetting.getUserDataFile();
      if (!userDataFile) return;

      const userDataBuffer = await fetchArrayBuffer(new URL(userDataFile, this.modelHomeDir).href);
      this.loadUserData(userDataBuffer, userDataBuffer.byteLength);
    }

    setupUpdaters({
      CubismEyeBlink,
      CubismBreath,
      BreathParameterData,
      CubismExpressionUpdater,
      CubismEyeBlinkUpdater,
      CubismBreathUpdater,
      CubismPhysicsUpdater,
      CubismPoseUpdater,
      CubismLipSyncUpdater,
      CubismLook,
      LookParameterData,
      CubismLookUpdater,
    }) {
      if (this._modelSetting.getEyeBlinkParameterCount() > 0) {
        this._eyeBlink = CubismEyeBlink.create(this._modelSetting);
        for (let index = 0; index < this._modelSetting.getEyeBlinkParameterCount(); index += 1) {
          this._eyeBlinkIds.push(this._modelSetting.getEyeBlinkParameterId(index));
        }
        this.updateScheduler.addUpdatableList(
          new CubismEyeBlinkUpdater(() => this.motionUpdated, this._eyeBlink),
        );
      }

      this._breath = CubismBreath.create();
      this._breath.setParameters([
        new BreathParameterData(this.paramAngleX, 0, 10, 6.4, 0.35),
        new BreathParameterData(this.paramAngleY, 0, 4, 3.8, 0.3),
        new BreathParameterData(this.paramAngleZ, 0, 6, 5.4, 0.28),
        new BreathParameterData(this.paramBodyAngleX, 0, 3, 6.8, 0.4),
        new BreathParameterData(this.paramBreath, 0.4, 0.3, 3.2, 1),
      ]);
      this.updateScheduler.addUpdatableList(new CubismBreathUpdater(this._breath));

      if (this._physics) {
        this.updateScheduler.addUpdatableList(new CubismPhysicsUpdater(this._physics));
      }

      if (this._pose) {
        this.updateScheduler.addUpdatableList(new CubismPoseUpdater(this._pose));
      }

      if (this._expressionManager) {
        this.updateScheduler.addUpdatableList(new CubismExpressionUpdater(this._expressionManager));
      }

      const lipSyncCount = this._modelSetting.getLipSyncParameterCount();
      for (let index = 0; index < lipSyncCount; index += 1) {
        this._lipSyncIds.push(this._modelSetting.getLipSyncParameterId(index));
      }

      if (this._lipSyncIds.length > 0) {
        this.updateScheduler.addUpdatableList(
          new CubismLipSyncUpdater(this._lipSyncIds, this.speakingProvider),
        );
      }

      this._look = CubismLook.create();
      this._look.setParameters([
        new LookParameterData(this.paramAngleX, 22, 0, 0),
        new LookParameterData(this.paramAngleY, 0, 14, 0),
        new LookParameterData(this.paramAngleZ, 0, 0, -18),
        new LookParameterData(this.paramBodyAngleX, 8, 0, 0),
        new LookParameterData(this.paramEyeBallX, 1, 0, 0),
        new LookParameterData(this.paramEyeBallY, 0, 1, 0),
      ]);
      this.updateScheduler.addUpdatableList(new CubismLookUpdater(this._look, this._dragManager));

      this.updateScheduler.sortUpdatableList();
    }

    setupLayout() {
      const layout = new Map();
      this._modelSetting.getLayoutMap(layout);
      if (layout.size > 0) {
        this._modelMatrix.setupFromLayout(layout);
        return;
      }

      // 默认资源未提供布局信息时，主动放大模型并稍微下压，让人物更接近参考设计中的居中站位。
      this._modelMatrix.setHeight(7.25);
      this._modelMatrix.setCenterPosition(2.0, 1.25);
    }

    async bindTextures() {
      const textureCount = this._modelSetting.getTextureCount();
      for (let index = 0; index < textureCount; index += 1) {
        const textureFileName = this._modelSetting.getTextureFileName(index);
        const textureUrl = new URL(textureFileName, this.modelHomeDir).href;
        const texture = await createTexture(this.gl, textureUrl);
        this.boundTextures.push(texture);
        this.getRenderer().bindTexture(index, texture);
      }
    }

    async loadMotionResource(group, index) {
      const key = `${group}_${index}`;
      if (this._motions.get(key)) {
        return this._motions.get(key);
      }
      if (this.motionLoaders.has(key)) {
        return this.motionLoaders.get(key);
      }

      const motionPromise = (async () => {
        const motionFileName = this._modelSetting.getMotionFileName(group, index);
        if (!motionFileName) return null;

        const motionBuffer = await fetchArrayBuffer(new URL(motionFileName, this.modelHomeDir).href);
        const motion = super.loadMotion(
          motionBuffer,
          motionBuffer.byteLength,
          key,
          undefined,
          undefined,
          this._modelSetting,
          group,
          index,
          true,
        );

        if (motion) {
          motion.setEffectIds(this._eyeBlinkIds, this._lipSyncIds);
          this._motions.set(key, motion);
        }

        return motion;
      })().finally(() => {
        this.motionLoaders.delete(key);
      });

      this.motionLoaders.set(key, motionPromise);
      return motionPromise;
    }

    async startRandomMotion(group, priority = PRIORITY_NORMAL) {
      const motionCount = this._modelSetting.getMotionCount(group);
      if (motionCount <= 0) return false;

      const index = Math.floor(Math.random() * motionCount);
      const motion = await this.loadMotionResource(group, index);
      if (!motion) return false;

      if (priority !== PRIORITY_FORCE && !this._motionManager.reserveMotion(priority)) {
        return false;
      }

      this._motionManager.startMotionPriority(motion, false, priority);
      return true;
    }

    setRandomExpression(speakingMode = false) {
      if (!this.expressionNames.length || !this._expressionManager) return;

      let randomIndex;
      if (speakingMode) {
        // 说话时只在表情 0 和 1 之间随机选择
        randomIndex = Math.floor(Math.random() * Math.min(1, this.expressionNames.length));
      } else {
        // 不说话时从所有表情中随机选择
        randomIndex = Math.floor(Math.random() * this.expressionNames.length);
      }

      const expressionName = this.expressionNames[randomIndex];
      const expression = this._expressions.get(expressionName);

      if (expression) {
        this._expressionManager.startMotion(expression, false);
      }
    }

    setSpeakingLevel(level) {
      this.manualSpeakingLevel = clamp(level, 0, 1);
    }

    async setAudioElement(audioElement) {
      await this.audioLevelTracker.setAudioElement(audioElement);
    }

    update(deltaTimeSeconds, nowMs) {
      if (!this._model || !this.getRenderer()) return;

      const audioLevel = this.audioLevelTracker.getLevel();
      const effectiveSpeakingLevel = Math.max(this.manualSpeakingLevel, audioLevel);
      this.smoothedSpeakingLevel = lerp(
        this.smoothedSpeakingLevel,
        effectiveSpeakingLevel,
        effectiveSpeakingLevel > this.smoothedSpeakingLevel ? 0.32 : 0.18,
      );
      this.speakingProvider.setLevel(this.smoothedSpeakingLevel);

      if (this._motionManager.isFinished()) {
        this.startRandomMotion(MOTION_GROUP_IDLE, PRIORITY_IDLE).catch(() => {
          // 空闲动作缺失时保持静默
        });
      }

      this._model.loadParameters();
      this.motionUpdated = false;

      if (!this._motionManager.isFinished()) {
        this.motionUpdated = this._motionManager.updateMotion(this._model, deltaTimeSeconds);
      }

      this._model.saveParameters();

      const timeSeconds = nowMs / 1000;
      const idleLookX = Math.sin(timeSeconds * 0.7) * 0.08;
      const idleLookY = Math.cos(timeSeconds * 0.45) * 0.04;
      this.lookCurrentX = lerp(this.lookCurrentX, this.lookTargetX + idleLookX, 0.08);
      this.lookCurrentY = lerp(this.lookCurrentY, this.lookTargetY + idleLookY, 0.08);
      this.setDragging(clamp(this.lookCurrentX, -1, 1), clamp(this.lookCurrentY, -1, 1));

      this.updateScheduler.onLateUpdate(this._model, deltaTimeSeconds);
      this.applyManualParameters(this.smoothedSpeakingLevel, timeSeconds);
      this._model.update();

      this.syncActionState(this.smoothedSpeakingLevel, nowMs);
    }

    applyManualParameters(speakingLevel, timeSeconds) {
      const nod = Math.sin(timeSeconds * 7.2) * speakingLevel;
      const cheek = speakingLevel * 0.18;

      if (this._lipSyncIds.length === 0) {
        this._model.addParameterValueById(this.paramMouthOpenY, speakingLevel);
      }

      this._model.addParameterValueById(this.paramMouthForm, 0.25 + speakingLevel * 0.35);
      this._model.addParameterValueById(this.paramCheek, cheek);
      this._model.addParameterValueById(this.paramAngleX, nod * 3.2);
      this._model.addParameterValueById(this.paramAngleY, speakingLevel * 1.8);
      this._model.addParameterValueById(this.paramAngleZ, Math.sin(timeSeconds * 5.6) * speakingLevel * 2.8);
      this._model.addParameterValueById(this.paramBodyAngleX, speakingLevel * 4.2);
    }

    syncActionState(speakingLevel, nowMs) {
      const speakingNow = speakingLevel >= SPEAKING_THRESHOLD;
      if (speakingNow && (!this.isSpeaking || nowMs - this.lastTalkAnimationAt > 10000)) {
        this.isSpeaking = true;
        this.lastTalkAnimationAt = nowMs;

        this.startRandomMotion(MOTION_GROUP_TAP_BODY, PRIORITY_NORMAL).catch(() => {
          // 某些模型没有讲话动作，忽略即可
        });
        this.setRandomExpression(true); // 说话模式：只在表情 0 和 1 之间切换
        return;
      }

      if (!speakingNow) {
        this.isSpeaking = false;

        // 不说话时每10分钟切换一次表情
        if (nowMs - this.lastIdleExpressionAt > this.IDLE_EXPRESSION_INTERVAL) {
          this.lastIdleExpressionAt = nowMs;
          this.setRandomExpression(false); // 空闲模式：从所有表情中随机选择
        }
      }
    }

    draw() {
      if (!this._model || !this.getRenderer()) return;

      const projection = createProjectionMatrix(this.canvas, this.CubismMatrix44);
      projection.multiplyByMatrix(this._modelMatrix);

      this.getRenderer().setRenderTargetSize(this.canvas.width, this.canvas.height);
      this.getRenderer().setMvpMatrix(projection);
      this.getRenderer().drawModel();
    }

    release() {
      this.boundTextures.forEach((texture) => {
        this.gl.deleteTexture(texture);
      });
      this.boundTextures = [];

      this.deleteRenderer();
      this.updateScheduler.release();
      if (this._modelSetting?.release) {
        this._modelSetting.release();
      }
      super.release();
    }
  };
}

export async function createLive2DRenderer({ canvas, modelSettingsUrl = DEFAULT_MODEL_SETTINGS_URL }) {
  if (!canvas) {
    throw new Error("缺少 Live2D 画布容器。");
  }

  const gl = canvas.getContext("webgl2", { alpha: true, antialias: true })
    || canvas.getContext("webgl", { alpha: true, antialias: true });

  if (!gl) {
    throw new Error("当前浏览器不支持 WebGL，无法渲染 Live2D 模型。");
  }

  const cubismModules = await ensureCubismCore();

  let destroyed = false;
  let animationFrameId = 0;
  let previousTimestamp = performance.now();

  const CubismSingleModelRuntime = createCubismSingleModelRuntimeClass(cubismModules);
  const runtime = new CubismSingleModelRuntime({
    gl,
    canvas,
    modelSettingsUrl,
  });

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * pixelRatio));
    canvas.height = Math.max(1, Math.round(rect.height * pixelRatio));
    gl.viewport(0, 0, canvas.width, canvas.height);
  };

  const syncLookTargetFromPointer = (event) => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const normalizedX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const normalizedY = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    runtime.lookTargetX = clamp(normalizedX, -1, 1) * 0.55;
    runtime.lookTargetY = clamp(normalizedY, -1, 1) * 0.35;
  };

  const resetLookTarget = () => {
    runtime.lookTargetX = 0;
    runtime.lookTargetY = 0;
  };

  resize();
  await runtime.initialize();

  canvas.addEventListener("pointermove", syncLookTargetFromPointer);
  canvas.addEventListener("pointerleave", resetLookTarget);
  window.addEventListener("resize", resize);

  const render = (timestamp) => {
    if (destroyed) return;

    const deltaTimeSeconds = Math.min(0.05, (timestamp - previousTimestamp) / 1000);
    previousTimestamp = timestamp;

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    runtime.update(deltaTimeSeconds, timestamp);
    runtime.draw();

    animationFrameId = window.requestAnimationFrame(render);
  };

  animationFrameId = window.requestAnimationFrame(render);

  return {
    modelSettingsUrl,
    runtime: "sdk-live",
    setAudioElement(audioElement) {
      return runtime.setAudioElement(audioElement);
    },
    setSpeakingLevel(nextLevel) {
      runtime.setSpeakingLevel(nextLevel);
    },
    dispose() {
      destroyed = true;
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointermove", syncLookTargetFromPointer);
      canvas.removeEventListener("pointerleave", resetLookTarget);
      runtime.release();
    },
  };
}

export const LIVE2D_RUNTIME_HINTS = {
  coreScript: LIVE2D_CORE_SCRIPT_URL,
  frameworkEntry: LIVE2D_FRAMEWORK_DIST_URL,
  modelSettings: DEFAULT_MODEL_SETTINGS_URL,
};
