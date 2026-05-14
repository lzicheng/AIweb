import vertShaderSrc from "../sdk/Framework/Shaders/WebGL/vertshadersrc.vert?raw";
import vertShaderSrcMasked from "../sdk/Framework/Shaders/WebGL/vertshadersrcmasked.vert?raw";
import vertShaderSrcSetupMask from "../sdk/Framework/Shaders/WebGL/vertshadersrcsetupmask.vert?raw";
import fragShaderSrcSetupMask from "../sdk/Framework/Shaders/WebGL/fragshadersrcsetupmask.frag?raw";
import fragShaderSrcPremultipliedAlpha from "../sdk/Framework/Shaders/WebGL/fragshadersrcpremultipliedalpha.frag?raw";
import fragShaderSrcMaskPremultipliedAlpha from "../sdk/Framework/Shaders/WebGL/fragshadersrcmaskpremultipliedalpha.frag?raw";
import fragShaderSrcMaskInvertedPremultipliedAlpha from "../sdk/Framework/Shaders/WebGL/fragshadersrcmaskinvertedpremultipliedalpha.frag?raw";
import vertShaderSrcCopy from "../sdk/Framework/Shaders/WebGL/vertshadersrccopy.vert?raw";
import fragShaderSrcCopy from "../sdk/Framework/Shaders/WebGL/fragshadersrccopy.frag?raw";
import fragShaderSrcColorBlend from "../sdk/Framework/Shaders/WebGL/fragshadersrccolorblend.frag?raw";
import fragShaderSrcAlphaBlend from "../sdk/Framework/Shaders/WebGL/fragshadersrcalphablend.frag?raw";
import vertShaderSrcBlend from "../sdk/Framework/Shaders/WebGL/vertshadersrcblend.vert?raw";
import fragShaderSrcBlend from "../sdk/Framework/Shaders/WebGL/fragshadersrcpremultipliedalphablend.frag?raw";

export const LIVE2D_SHADER_SOURCES = {
  _vertShaderSrc: vertShaderSrc,
  _vertShaderSrcMasked: vertShaderSrcMasked,
  _vertShaderSrcSetupMask: vertShaderSrcSetupMask,
  _fragShaderSrcSetupMask: fragShaderSrcSetupMask,
  _fragShaderSrcPremultipliedAlpha: fragShaderSrcPremultipliedAlpha,
  _fragShaderSrcMaskPremultipliedAlpha: fragShaderSrcMaskPremultipliedAlpha,
  _fragShaderSrcMaskInvertedPremultipliedAlpha: fragShaderSrcMaskInvertedPremultipliedAlpha,
  _vertShaderSrcCopy: vertShaderSrcCopy,
  _fragShaderSrcCopy: fragShaderSrcCopy,
  _fragShaderSrcColorBlend: fragShaderSrcColorBlend,
  _fragShaderSrcAlphaBlend: fragShaderSrcAlphaBlend,
  _vertShaderSrcBlend: vertShaderSrcBlend,
  _fragShaderSrcBlend: fragShaderSrcBlend,
};
