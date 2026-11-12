# Melody Studio

浏览器里的轻量旋律工作站。用鼠标在钢琴卷帘上写旋律，实时听到真实的三角钢琴，导出 MIDI / WAV。不需要会弹琴，也不需要乐理基础。

- Canvas 钢琴卷帘：横纵缩放、自由平移、框选、复制粘贴、力度编辑、撤销重做
- Tone.js + Salamander Grand Piano 采样，本地自托管，离线可用
- 调性高亮、音阶吸附、和弦轨、五套四小节旋律草稿
- 项目自动保存在 IndexedDB，刷新即恢复
- 导出标准 MIDI、44.1 kHz 16-bit WAV（OfflineAudioContext 离线渲染）、项目 JSON

---

## 快速开始

```bash
npm install
npm run dev
```

打开 http://localhost:5179

生产构建：

```bash
npm run build
npm run preview
```

> 依赖 Node 20+。Windows 上如果 `npm` 被执行策略拦截，使用 `npm.cmd`。

---

## 一、技术选型报告

按要求先检查了候选仓库的真实代码（package.json、src 结构、音频与交互实现、License、最近提交），而不是只看 README。

| 仓库 | 功能完整度 | 代码质量 | UI/UX | 音频 | 可扩展性 | License | 维护状态 |
|---|---|---|---|---|---|---|---|
| **AppsYogi-com/ComposeYogi** (160★) | 很高：多轨、音频片段、录音、MIDI、混音 | 好，Next.js 15 + Zustand + zundo，模块划分清晰 | 成熟但偏「完整 DAW」，信息密度高 | Tone.js + 采样 + 离线导出 + MP3 | 高，但体量大 | MIT | 活跃（2026-10） |
| **XanthanL/neon-daw** (4★) | 中高：Pattern、步进鼓机、Piano Roll、WAV 导出 | 好，Vite + React + TS + Zustand，单文件组件偏大 | 强烈的霓虹风格，不适合本产品 | Tone.js，合成器为主 | 中高 | MIT | 活跃（2026-08） |
| **tuomashatakka/tween-midi-editor** (10★) | 高（编辑器维度）：Canvas 分层、视口、框选、工具、SMF 编解码 | 很好：domain / view / store 分层，纯函数坐标与命中测试，测试齐全 | 桌面 Electron 工具风 | 仅振荡器合成，无采样钢琴 | 高 | MIT | 活跃（2026-07） |
| **steady41/voidstation** (2★) | 低-中：自由布局 / 模块拖拽 | 一般 | 实验性 | 弱 | 中 | MIT | 低频 |
| **SerpentariusStudio/songbird** (0★) | 低：早期原型 | 一般 | 一般 | 弱 | 中 | MIT | 低频 |
| **toneflix/studio** (0★) | 低-中：时间线 / 播放 | 一般 | 一般 | 中 | 中 | MIT | 新 |

### 结论：不直接 Fork，采用「成熟库 + 借鉴架构」的组合

理由：

1. **ComposeYogi 覆盖了约 75% 的功能，但产品形态不对。** 它是一个多轨 DAW（音频片段、录音、混音台、Next.js 多语言 PWA）。要把它裁成「单轨旋律工作站」，删除的工作量大于重写，而且会背上一整套不需要的架构。它的 Piano Roll 也是 DOM 实现、功能偏基础（点击开关音符、拖动、拉伸），没有框选/画布性能优势。
2. **tween-midi-editor 的钢琴卷帘架构正是本项目需要的**：音乐时间用 ticks、视口与像素坐标完全分离、Canvas 分层绘制、纯函数命中测试、视口/选区切分。本项目按同样思路实现（Zustand + React 版），没有搬运它的 Redux 状态层。
3. **Neon DAW 的工程组织和 Tone.js 离线导出思路可参考**，但它的卷帘是固定 16 分格的 DOM 网格，不支持自由缩放/纵向缩放，无法满足要求。

最终栈：

| 层 | 选择 |
|---|---|
| 构建 | Vite 8 + React 19 + TypeScript |
| 状态 | Zustand 5（项目 / UI 分离，自研快照式 undo-redo） |
| 音频 | Tone.js 15 + Salamander Grand Piano 采样（自托管 30 个 mp3） |
| 卷帘渲染 | 原生 Canvas 2D，双层（base / overlay）+ requestAnimationFrame |
| 持久化 | IndexedDB（idb），localStorage 兜底 |
| MIDI | @tonejs/midi |
| WAV | Web Audio `OfflineAudioContext` + 自写 16-bit PCM 编码 |
| 图标 | lucide-react |

没有引入 UI 组件库：布局和控件是手写 CSS，避免模板站观感。

---

## 二、目录结构

```
src/
  audio/
    engine.ts      # Tone.js 播放引擎：采样、调度、循环、节拍器、预览
    render.ts      # 离线渲染 WAV（与播放同一套采样）
    samples.ts     # 采样清单 / 音高映射 / 加载
    wav.ts         # PCM → WAV 编码
  components/
    roll/
      PianoRoll.tsx  # 交互状态机（工具、拖拽、框选、缩放、右键菜单）
      draw.ts        # 画布绘制：网格、音符、键盘、标尺、播放头
      geometry.ts    # ticks ↔ 像素、命中测试
    TopBar.tsx / ToolRail.tsx / Inspector.tsx / BottomPanel.tsx
    ProjectsDialog.tsx / ExportDialog.tsx / HelpDialog.tsx
  lib/
    ticks.ts snap.ts pitch.ts theory.ts sketch.ts
  store/
    project.ts     # 数据模型 + undo/redo + 所有编辑动作
    ui.ts          # 工具、吸附、视口、面板、主题
  io/
    db.ts          # IndexedDB
    midi.ts        # MIDI 导出
    projectFile.ts # JSON 导入 / 导出与校验
```

音乐数据只存 ticks（PPQ 480），像素坐标只存在于视口层——拖动、缩放、窗口改变都不会污染音符数据。

---

## 三、已实现功能

**Piano Roll**

- 单击落笔 / 按住拖动决定时值；Shift 临时关闭吸附
- 拖动音符改变音高与时间；拖动左右边缘改变时值（8px 热区，不会误移动）
- 框选、Shift 加选、全选、反选、多音符整组拖动
- 复制 / 剪切 / 粘贴（粘贴到播放头）、Ctrl+D 复制、Alt+拖动即时复制
- 右键菜单：复制、选中同音高、量化、删除
- 双击音符跳到属性面板
- 删除 / 撤销 / 重做（150 步快照）；一次手势恰好一条历史
- 力度：底部力度条拖动，或右侧属性滑杆；多选时整组修改
- 吸附：1/1 – 1/32、三连音、附点、关闭；绘制时显示吸附参考线
- 缩放：Ctrl+滚轮横向（以光标为锚点）、Alt+滚轮纵向、Fit 一键适配
- 平移：空格+拖动、中键拖动、Hand 工具、滚轮 / Shift+滚轮
- 播放时平滑播放头、自动翻页滚动、正在发声的音符与琴键同步高亮

**音乐**

- 大调 / 小调 12 个调；调内行高亮、调内/调外音符配色区分
- 音阶吸附开关
- 和弦轨：每小节一个和弦，内置 7 条常见进行，可逐项改根音/性质/删除，点击试听
- 和弦内音在音符上以细标记显示
- 五套四小节旋律草稿（Pop Ballad / Light Pop / Romantic / Emotional / Upbeat），按当前调生成，且完全可编辑
- BPM 30–260、拍号 4/4·3/4·2/4·5/4·6/8·7/8、循环区间（Shift 拖标尺）
- 节拍器、延音（sustain）、音量、混响

**音频**

- Salamander Grand Piano，每三个半音一个采样，本地 `public/samples`（1.9 MB）
- 采样加载失败自动回落到合成器，并提示状态
- 电脑键盘弹奏：A W S E D F T G Y H U J K，Z / X 切换八度
- 点击琴键发声，按住滑动可连奏

**项目与导出**

- 新建 / 重命名 / 复制 / 删除 / 打开项目列表
- 自动保存（650 ms 防抖）到 IndexedDB，刷新恢复上次项目
- 项目 JSON 导入 / 导出（带格式校验与字段兜底）
- MIDI：标准 SMF，含 tempo / 拍号 / 力度，可被 FL Studio、Live、Logic 打开
- WAV：离线渲染，与试听同一套采样，带混响与峰值归一化，显示渲染进度
- 深色 / 浅色主题；快捷键帮助面板

---

## 四、未实现 / 已知限制

- 单轨旋律，不含多轨、音频片段、录音（`Note` 模型已预留 id/pitch/start/duration/velocity，加轨道需扩展数据结构）
- 没有 MIDI 文件导入（导出已实现）
- 没有 AI 旋律生成 / 和弦建议（草稿生成器是规则式的）
- 没有 count-in 预备拍（规格中为可选）
- 移动端只保证可用，未做触屏专属手势优化
- 超长项目（> 5 分钟）导出 WAV 会有明显内存占用
- 项目只存在当前浏览器，不跨设备同步

---

## 五、测试记录（实际执行）

在 Chromium / Vite dev 服务器中逐项验证：

| 项目 | 结果 |
|---|---|
| 新建空白项目、项目列表、切换项目 | 通过（列表与内容刷新正确） |
| 单击 / 拖动创建音符 | 通过（落点吸附，时值为网格倍数） |
| 拖动移动（多选） | 通过（start +240、pitch +1，一条历史） |
| 边缘拉伸 | 通过（960 → 1440 ticks） |
| 框选 | 通过（框内 9 个音符全部选中） |
| 复制粘贴 | 通过（15 → 24，撤销回到 15） |
| 撤销 / 重做（按钮、Ctrl+Z、Ctrl+Shift+Z） | 通过 |
| 横向缩放锚点 | 通过（光标下 tick 缩放前后一致） |
| 平移 | 通过（scrollTicks / scrollPitch 更新正确） |
| 播放 / 暂停 / 停止 / 空格 | 通过 |
| 循环播放 | 通过（1920 → 5713 后回到 2206，循环边界 1920–5760） |
| 节拍误差 | 400 ms 采样间隔推进 332–341 ticks，无累积漂移 |
| 刷新后恢复 | 通过（14 notes / 4 chords / BPM 76 原样恢复） |
| MIDI 导出再解析 | 通过（14 音符，tempo 76，首音 ticks 0 / 时长 480，与原数据一致） |
| WAV 导出 | 通过（14.63 s、44.1 kHz、2ch、16-bit，离线渲染 0.9 s） |
| 和弦进行应用 | 通过（Am–F–C–G 写入 8 小节） |
| 右键菜单 | 通过（4 项操作） |
| 采样加载 | 通过（30 个 mp3，全部 200 OK） |
| 控制台错误 | 无 |

---

## 六、部署

本机没有安装 `git` / `gh`，也没有 CI 凭据，所以**没有执行线上部署**。构建产物在 `dist/`，可直接托管。

Vercel：

```bash
npx vercel --prod
```

GitHub Pages（`vite.config.ts` 已设置 `base: './'`，可放在子路径）：

```bash
npm run build
npx gh-pages -d dist
```

任何静态服务器都可以：`dist/` 是纯静态文件，无后端、无环境变量。

---

## 七、许可与素材

- 代码：MIT（见 `LICENSE`）
- 钢琴采样：**Salamander Grand Piano** by Alexander Holm，CC-BY 3.0，来源于 Tone.js 公开采样集，已随项目自托管于 `public/samples/`
- 依赖：Tone.js (MIT)、@tonejs/midi (MIT)、zustand (MIT)、idb (ISC)、lucide-react (ISC)
- 研究/借鉴：tween-midi-editor、neon-daw、ComposeYogi 均为 MIT；本项目按其架构思路重写，未直接复制其源码
