<div align="center">

# MEME STUDIO

### 本地优先的 Meme 素材工厂

在浏览器里完成 **抠图、描边、排版、批处理与导出**。

图片默认只在本机处理，不需要账号、不需要 API Key，也不会上传到服务器。

<p>
  <a href="https://iiiiiiiiiiiiiKK.github.io/meme-studio/">在线体验</a>
  ·
  <a href="https://github.com/iiiiiiiiiiiiiKK/meme-studio">GitHub 仓库</a>
  ·
  <a href="https://x.com/0xkillcoin">作者 @0xkillcoin</a>
</p>

<p>
  <img src="https://img.shields.io/badge/React-18-20232A?logo=react" alt="React 18" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white" alt="TypeScript 5.7" />
  <img src="https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white" alt="Vite 5" />
  <img src="https://img.shields.io/badge/License-MIT-8B7355" alt="MIT license" />
</p>

</div>

> **语言 / Language**：中文为主 · [English summary](#english-summary)

---

## 目录

- [项目简介](#项目简介)
- [核心能力](#核心能力)
- [抠图流程](#抠图流程)
- [隐私与数据](#隐私与数据)
- [快速开始](#快速开始)
- [常用命令](#常用命令)
- [项目结构](#项目结构)
- [测试与质量](#测试与质量)
- [部署](#部署)
- [已知限制](#已知限制)
- [English summary](#english-summary)
- [许可证](#许可证)

## 项目简介

Meme Studio 是一个**纯前端、浏览器内运行、本地优先**的 Meme 制作工具，适合把照片快速做成贴纸、反应图和 Meme 素材。

你可以：

1. 导入图片、粘贴剪贴板内容，或从 URL 读取图片；
2. 使用本地 AI 生成人物蒙版；
3. 选择脸部、头部、头肩、上半身或全身等抠图模式；
4. 调整羽化、扩张、边缘平滑、描边、阴影与发光；
5. 在画布上叠加图片、文字和形状；
6. 将单张图片保存到本地素材库，或批量处理并打包成 ZIP。

**在线地址：** <https://iiiiiiiiiiiiiKK.github.io/meme-studio/>

## 核心能力

### 本地 AI 抠图

- MediaPipe Selfie Segmentation 生成人物 Alpha 蒙版；
- BlazeFace + FaceMesh 检测人脸并提供 468 点网格；
- 36 点脸部轮廓结合头发穹顶、颈部和肩部区域；
- 多人照片通过连通区域筛选，尽量只保留选中脸部对应的人物；
- 没有可用神经蒙版时使用明确标注的色彩蒙版 fallback。

### 真实 Alpha 描边

- 单层或双层描边；
- 白色、黑色和自定义颜色；
- 阴影、发光、内描边；
- 描边来自 Alpha 蒙版的膨胀与距离变换；
- 输出保留真实透明通道，不把棋盘格预览绘制进 PNG。

### 画布编辑器

- 图片、文字、矩形和椭圆图层；
- 移动、缩放、旋转、透明度、显隐和锁定；
- 图层排序、复制、删除、撤销与重做；
- 自动保存到浏览器 IndexedDB；
- PNG、JPEG、WebP 导出，支持 1×、2×、3×；
- JPEG 会自动使用不透明背景，避免透明设置产生歧义。

### Batch Studio

- 多文件或文件夹导入；
- 统一应用抠图模式和描边设置；
- 并行处理数 1–4；
- 暂停、继续、取消、失败重试；
- 单个文件失败不会中断其他任务；
- 一键生成 ZIP。

### My Space

- IndexedDB 本地素材库；
- 素材分类、搜索、标签、收藏；
- 回收站、恢复和永久删除；
- 项目缩略图与图片图层可以在刷新后从本地 Blob 重新恢复。

### Templates

- 抠图、描边、画布、导出和批处理预设；
- 内置预设与自定义预设；
- 自定义预设保存真实参数并可重新应用；
- 预设可以导出为 JSON，也可以再次导入。

### 中英双语

设置页可在 **English / 简体中文**之间切换。首次访问会参考浏览器语言，之后将选择保存在当前浏览器中。

## 抠图流程

```text
原图 Canvas
   │
   ├── Selfie Segmentation ── 人物 Alpha
   ├── BlazeFace + FaceMesh ── 人脸框与 468 点网格
   │
   └── head region
          ├── 脸部轮廓
          ├── 头发穹顶
          └── 颈部 / 肩部区域
                   │
                   ▼
          人物 Alpha ∩ 选定区域
                   │
                   ▼
       连通组件、羽化、膨胀、腐蚀、平滑
                   │
                   ▼
       透明主体 + 描边 / 阴影 / 发光
```

关键实现位于：

- `src/lib/ai.ts`：模型加载、人脸检测、人物蒙版；
- `src/lib/mask.ts`：Alpha、模糊、膨胀、腐蚀、距离变换与连通组件；
- `src/lib/cutout.ts`：抠图流程编排；
- `src/lib/outline.ts`：描边、内描边、阴影、发光与输出边界；
- `src/lib/render.ts`：画布场景与导出渲染。

## 隐私与数据

- 图片默认只在当前浏览器中处理；
- 没有后端、账号系统、上传接口、统计脚本或第三方字体；
- 模型文件由部署站点提供，模型推理在浏览器中执行；
- 图片、项目和预设保存在当前浏览器 profile 的 IndexedDB；
- 当前版本没有云同步和云端备份；
- “从 URL 导入”由浏览器直接请求目标地址，目标站点仍可能看到浏览器请求信息。

## 快速开始

### 环境要求

- Node.js 18 或更高版本；
- 支持 WebGL 的现代浏览器；
- 没有 WebGL 时会尝试 WASM backend；两者都不可用时使用带标识的色彩蒙版。

### 安装与开发

```bash
git clone https://github.com/iiiiiiiiiiiiiKK/meme-studio.git
cd meme-studio
npm install
npm run dev
```

开发服务器默认地址：<http://127.0.0.1:5199>

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run typecheck` | 运行 TypeScript 检查 |
| `npm run build` | 类型检查并生成 `dist/` |
| `npm run preview` | 本地预览生产构建 |
| `npm test` | 运行 Vitest 单元测试 |
| `npm run test:coverage` | 生成测试覆盖率报告 |
| `npm run e2e` | 运行全部 Playwright 测试 |
| `npm run e2e:desktop` | 运行桌面 Chromium 测试 |
| `npm run e2e:mobile` | 运行移动 WebKit 测试 |
| `npm run e2e:install` | 安装 Playwright Chromium 与 WebKit |
| `npm run screenshots` | 生成项目截图 |

Playwright 预览端口默认是 `4388`，如端口被系统占用，可指定：

```bash
PLAYWRIGHT_PORT=4389 npm run e2e:desktop
```

Windows PowerShell：

```powershell
$env:PLAYWRIGHT_PORT = "4389"
npm run e2e:desktop
```

## 项目结构

```text
src/
├── App.tsx                 # hash 路由与应用骨架
├── main.tsx                # React 入口、主题与语言初始化
├── pages/                  # Home / Create / Editor / Batch / Library 等页面
├── components/             # 导航、控件、品牌与素材 URL hook
├── state/                  # Zustand UI、素材库、编辑器状态
├── i18n/                   # 英文源文案与简体中文词典
└── lib/
    ├── ai.ts               # 本地 AI 引擎
    ├── cutout.ts           # 抠图编排
    ├── mask.ts             # Alpha / 蒙版算法
    ├── outline.ts          # 描边与视觉效果
    ├── render.ts           # Canvas 场景渲染
    ├── image.ts            # 图像解码、缩略图和导出
    ├── db.ts               # IndexedDB 存储
    ├── hydrate.ts          # 项目图片图层恢复
    └── assetUrls.ts        # Blob URL 统一生命周期管理

public/models/              # 本地模型文件
tests/                      # Vitest 单测与 Canvas 测试环境
e2e/                        # Playwright 桌面 / 移动端测试
docs/                       # 架构、部署、测试和排障文档
.github/workflows/           # CI 与 GitHub Pages 部署
```

## 测试与质量

当前仓库中的验证基线：

```text
TypeScript          通过
Vitest              57 tests passed
Desktop Chromium    19 passed
Mobile WebKit       5 passed
E2E total           24 passed
Production build    通过
```

测试覆盖包括：

- 蒙版、膨胀、腐蚀、距离变换与连通组件；
- 描边、内描边、发光、阴影和贴边输出边界；
- 单图层透明度与 JPEG alpha 语义；
- IndexedDB 资产、项目和预设；
- Blob URL 统一管理与项目图层恢复；
- 大图输入限制；
- 编辑器、批处理、语言切换、移动端布局；
- 真实跨文档 reload 后的图片图层恢复。

更完整的测试记录见 [docs/TEST-REPORT.md](docs/TEST-REPORT.md)。

## 部署

Meme Studio 是纯静态应用，构建后只需要发布 `dist/`：

```bash
npm run build
```

当前 GitHub Pages 工作流位于 `.github/workflows/deploy.yml`，线上地址：

<https://iiiiiiiiiiiiiKK.github.io/meme-studio/>

详细说明见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。

## 已知限制

- Discover 是随包发布的本地 starter pack，不是联网社区；
- 强逆光、帽子、运动模糊或很小的人脸会降低抠图质量；
- WebGL 通常比 WASM 更快，大图和批处理仍会占用较多内存；
- 当前版本没有账号、云同步、云端备份或 PWA service worker；
- 自动化测试使用合成图片，真实人像的最终效果仍取决于照片质量和浏览器 GPU backend。

## English summary

Meme Studio is a **local-first browser meme asset factory**.

It provides:

- Local AI person cutouts with Selfie Segmentation, BlazeFace and FaceMesh;
- Alpha-based sticker outlines, inner strokes, glow and shadow;
- A layered canvas editor with text, shapes, undo/redo and export;
- Batch processing with retry, cancellation and ZIP output;
- An IndexedDB-backed local library and project persistence;
- Reusable extraction, outline, canvas, export and batch presets;
- English / Simplified Chinese UI;
- Static deployment through GitHub Pages.

The application has no backend and does not upload imported images. See the Chinese documentation above for installation, architecture, testing and deployment details.

## 许可证

本项目采用 [MIT License](LICENSE)。

作者：[@0xkillcoin](https://x.com/0xkillcoin)
