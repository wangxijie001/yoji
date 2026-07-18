# Live2D 虚拟形象系统

让 AI 伴侣拥有可视化的身体——Live2D 模型渲染、16 情绪联动、戳一戳互动、TTS 口型同步。

## 技术栈与版本约束（⚠️ 踩坑记录）

| 依赖 | 版本 | 说明 |
|---|---|---|
| pixi.js | 6.5.10 | 渲染引擎，**不能升 7.x**（插件不兼容） |
| pixi-live2d-display | 0.4.0 | Live2D 插件，只用 `/cubism4` 子入口 |
| @pixi/unsafe-eval | 6.5.10 | **必须与 pixi.js 同版本**。CSP 禁 unsafe-eval，pixi 默认用 `new Function()` 生成 shader，此包为无 eval 实现 |
| Cubism Core | 5.0（SDK 5-r.1） | `src/renderer/public/live2d/live2dcubismcore.min.js`，见下 |

### Cubism Core 版本必须是 5.0/5.1

- **4.x core**：无法加载 moc3 v5 格式模型。鉴别：`xxd -l 8 xxx.moc3` 第 5 字节（`03`=Cubism4，`05`=Cubism5）
- **5.2+ core**（官网当前版本）：`renderOrders` 从 `model.drawables` 挪到 `model` 上（支持 offscreen 渲染），pixi-live2d-display 0.4 内置旧 Framework 读到 undefined，首帧渲染崩溃
- **鉴别**：`grep -c getOffscreenCount live2dcubismcore.min.js` 为 0 即兼容
- 兼容 core：`CubismSdkForWeb-5-r.1.zip` 内 `Core/live2dcubismcore.min.js`

### 其他工程约束

- **模型资源必须放 `src/renderer/public/live2d/`**：插件运行时按 URL 拉取 model3.json 及其引用文件
- **Core 必须 `<script>` 加载**：非 ESM 全局脚本，classic script 先于 module script
- 生产环境依赖主进程 `webSecurity: false`（本项目已配置）

## 代码结构

```
src/renderer/src/components/live2d/
├── index.tsx           # Live2D 组件（React 渲染 + 生命周期 + 戳一戳）
├── params.ts           # Alexia 参数常量 + 16 情绪定义（静态 params + 动态 behavior）
├── animation.ts        # 动画管线：呼吸/眨眼/口型/情绪/装扮/打哈欠/戳反馈/事件总线
└── index.module.css    # 戳一戳区域定位

src/renderer/public/live2d/
├── live2dcubismcore.min.js  # Cubism Core 5.0
└── Alexia/                  # 模型本体（moc3 + 贴图 + 物理 + model3.json）

src/main/agent/tools/
└── get-character-appearance.ts  # Agent 工具：查询当前形象外观

src/renderer/src/shared/
└── eventBus.ts           # 跨组件事件总线（Image → AIChat 等）

src/renderer/src/pages/home/components/image/
└── Image.tsx             # 首页浮动窗口：Live2D 替代原视频，emotion + talking 联动
```

## 组件 API

```tsx
<Live2D
  modelUrl={...}     // model3.json URL，默认 Alexia
  emotion="开心"    // 情绪名（16 个），传 null 重置
  talking={bool}     // 说话口型（TTS 联动）
  onReady={(model) => ...}
/>
```

## 架构：三层动画管线

每帧 `beforeModelUpdate` 注册顺序（后注册覆盖前）：

```
breath → accessory → emotion(静态params + 动态behavior) → blink → yawn → talking
```

- **底图层**：呼吸（4s 正弦 ParamBreath + 身体微摆）、眨眼（200ms 快速闭睁，间隔 2~5s，期待时加速）
- **情绪层**：静态表情参数平滑过渡（SPEED=0.12）+ 动态身体行为每帧执行
- **装扮层**：时间段自动切换（墨镜/眼镜/睡衣/帽子），与情绪解耦
- **覆盖层**：说话口型（随机目标开度 + 插值追踪）、打哈欠（疲惫专属）、戳一戳临时反馈（600ms 衰减）

### 参数注入原理

```
动作 update → saveParameters 快照 → 表情/眨眼/视线/呼吸/物理/姿势
→ emit('beforeModelUpdate') ← 【所有自定义管线在此写参数，不被覆盖】
→ coreModel.update() 烘焙 → loadParameters 还原快照（不污染下一帧）
```

## 情绪系统（params.ts）

16 个情绪，每个 = 静态表情参数 + 动态身体行为：

| 情绪 | 表情 | 行为 |
|---|---|---|
| 开心 | 星星眼 + 嘴变形 + 眼睛微笑 | 身体缓慢左右轻摇 |
| 兴奋 | 星星眼 + 嘴变形 + 眼睛微笑 + 身体Z | 快速身体摇晃→物理带动尾巴/耳朵猛甩 |
| 期待 | 星星眼 + 眼睛微笑 + 头Z | 头张望 + 眨眼加速（0.3~0.5s） |
| 好奇 | 问号 + 头Z歪 | 缓慢歪头 |
| 害羞 | 脸红 + 抱胸 + 低头 | 身体内收微侧 |
| 烦躁 | 生气 + 汗 + 叼棍 + 抱胸 + 歪嘴 + 眉变形 | 坐立不安抖动 |
| 愤怒 | 生气 + 汗 + 抱胸 + 嘴变形↓ + 歪嘴 + 眼微闭 | 身体颤抖 + 急促呼吸 |
| 疲惫 | 闭眼 | 打哈欠（嘴微张）+ 瞌睡点头 |
| 悲伤 | 哭 + 低头 + 眉上下 + 眼微睁 | 抽泣抖动 |
| 失落 | 哭(半) + 低头 + 眉上下 + 眼微闭 | 叹气式起伏 |
| 委屈 | 鼓脸 + 嘟嘴 + 眉变形 + 低头 + 眼微睁 | 微低头侧眼 |
| 忧虑 | 汗 + 眉变形 + 头Z歪 | 不安晃动 |
| 孤独 | 低头 + 眉上下 + 眼微闭 | 缓慢低头抬头 |
| 心疼 | 哭(半) + 低头 + 眉上下 + 眉变形 | 歪头 |
| 安心 | 眼微笑(半) + 眼微闭 | — |
| 平静 | 眼微笑(弱) | — |

参数值量级：自定义开关（星星眼/脸红/哭等）0=关 30=开；标准参数 0~1；角度 -30~30°。

## 装扮（时间驱动）

| 时段 | 状态 |
|---|---|
| 6-9 | 无眼镜 |
| 9-11 | 墨镜上头 |
| 11-13 | 墨镜戴脸（中午太阳刺眼） |
| 13-16 | 墨镜上头 |
| 16-21 | 无眼镜 |
| 21-6 | 睡衣+猫耳帽 |

与情绪系统完全解耦，互不干扰。

## 戳一戳（Poke）

10 个可点击区域：`ear / head / face / chest / belly / arm / hand / leg / foot / tail`。

组件内部在模型上层覆盖 `position: absolute` 的透明 `<div>` 定位到对应比例位置。点击 → `handlePoke(area)` → 在 `beforeModelUpdate` 注册临时监听器 → 600ms 衰减写入反馈参数 → 自动停止。

反馈参数见 `animation.ts` 的 `POKE_FEEDBACKS`，每个区域独立配置。

## TTS 口型联动

```
主进程 tts.ts → afplay 起停 broadcast('tts:speakingChanged')
→ preload onSpeakingChanged → Image.talking → Live2D.talking → 嘴张开合
```

## Agent 工具：查询形象

工具名 `get_character_appearance`，定义在 `src/main/agent/tools/get-character-appearance.ts`。

AI 调用后返回完整外观描述（发型/猫耳/尾巴/服饰 + 实时情绪表情 + 分时段着装差异）。外观描述需手动维护以保持与 params.ts 同步。

## 跨组件事件总线（EventBus）

`src/renderer/src/shared/eventBus.ts`：轻量发布/订阅。

```ts
bus.emit('model-interaction', '用户戳了头部')   // Image 触发
bus.on('model-interaction', (msg) => { ... })    // AIChat 监听
```

`on()` 返回取消函数，适合 useEffect cleanup。后续其他跨组件通信可复用。

## 换模型指南

组件完全模型无关——`modelUrl` 是参数，所有配置运行时读取。

**步骤**：
1. 模型文件夹放到 `public/live2d/<name>/`
2. 传 `modelUrl={new URL('live2d/<name>/xxx.model3.json', document.baseURI).href}`
3. 表情/动作/参数自动适配

**硬约束**：moc3 版本 ≤ 5（字节 `05`）、格式为 Cubism 3/4（`.model3.json` 后缀）、所有文件在 public/ 下。

具体参数名如与 Alexia 不同，需在 `params.ts` 的 `ALEXIA` 映射和 `animation.ts` 的参数引用中同步修改。

## 二次开发边界

- ✅ 程序层：参数组合、编程动画（无限制）
- ✅ 资产层：手写 exp3/motion3（明文 JSON）、调 physics3、改贴图 PNG
- ❌ 改网格/绑骨/加部位：需要 `.cmo3` 编辑器源文件（未持有）
- ⚠️ **版权**：免费模型规约未确认。公开发布时不应提交模型进仓库/打包，计划改为用户自备 + gitignore
