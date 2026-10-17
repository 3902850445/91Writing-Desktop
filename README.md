# 91写作 - 跨平台桌面应用

基于 Tauri 2 + Vue 3 的跨平台写作应用，支持 Windows、macOS、Linux、Android。

## 项目结构

```
91Writing-Desktop/
├── src/                    # Vue 3 前端源码
│   ├── views/mobile/       # 12 个移动端视图组件
│   ├── composables/        # Vue 组合式函数
│   ├── services/           # 服务层（API、存储等）
│   ├── layouts/            # 布局组件（MobileShell）
│   ├── utils/              # 工具函数
│   └── styles/             # 样式文件
├── src-tauri/              # Tauri 2 后端
│   ├── src/               # Rust 源码
│   ├── Cargo.toml         # Rust 依赖配置
│   └── tauri.conf.json    # Tauri 配置
├── dist/                   # 前端构建产物
├── package.json            # Node.js 依赖
└── vite.config.js          # Vite 配置
```

## 技术栈

| 技术 | 用途 |
|------|------|
| **Tauri 2** | 跨平台桌面框架（Rust 后端 + WebView） |
| **Vue 3** | 前端框架（响应式、组件化） |
| **Vite 4** | 前端构建工具 |
| **Rust** | 后端原生能力（文件、对话框等） |

## 开发环境要求

### Windows

1. **Node.js 20+**
2. **Rust 1.70+**（通过 [mise](https://mise.jdx.dev/) 或 [rustup](https://rustup.rs/) 安装）
3. **Visual Studio 2022 Build Tools**（包含 MSVC 编译器）
4. **WebView2 Runtime**（Windows 10/11 通常已内置）

### macOS

1. **Node.js 20+**
2. **Rust 1.70+**
3. **Xcode Command Line Tools**

### Linux

1. **Node.js 20+**
2. **Rust 1.70+**
3. **WebKitGTK 2.40+**
4. **GLIBC 2.35+**

## 安装依赖

```bash
# 安装 Node.js 依赖
npm install

# 安装 Rust 依赖（通过 mise）
mise exec rust@1.98.1 -- cargo build
```

## 开发模式

```bash
# 启动开发模式（前端 + Tauri）
npm run tauri dev
```

## 构建发布

### Windows

```bash
# 构建前端
npm run build

# 构建 Tauri 应用（包含打包）
npm run tauri build
```

构建产物：
- `src-tauri/target/release/writing91-desktop.exe`（安装包）
- `src-tauri/target/release/bundle/nsis/*.exe`（NSIS 安装程序）

### macOS

```bash
npm run tauri build
```

构建产物：
- `src-tauri/target/release/bundle/macos/91写作.app`
- `src-tauri/target/release/bundle/macos/91写作_*.dmg`

### Linux

```bash
npm run tauri build
```

构建产物：
- `src-tauri/target/release/bundle/deb/*.deb`
- `src-tauri/target/release/bundle/appimage/*.AppImage`

### Android

```bash
# 需要 Android SDK
npm run tauri build -- --target aarch64-linux-android
npm run tauri build -- --target x86_64-linux-android
```

构建产物：
- `src-tauri/target/aarch64-linux-android/release/app-aarch64-release.apk`

## GitHub Actions 云构建

项目已配置 GitHub Actions 自动构建，推送 `v*` 标签时自动触发四平台构建：

```bash
# 推送版本标签触发构建
git tag v2.7.2
git push origin v2.7.2
```

构建完成后，GitHub Release 会自动上传所有平台的安装包。

## 响应式适配

### 桌面端

桌面端保持移动端界面风格，居中显示在窗口中：

- 最大宽度 480px（模拟手机屏幕）
- 居中对齐
- 底部导航栏固定

### 移动端

移动端全屏适配：

- 使用 Visual Viewport API 处理键盘遮挡
- 触摸优化的交互体验
- 移动端原生导航栏

## Rust 后端能力

### 已实现命令

| 命令 | 说明 |
|------|------|
| `get_app_info` | 获取应用信息（版本、平台、数据目录） |
| `save_file` | 保存文本文件到指定路径 |
| `read_file` | 读取文本文件内容 |
| `get_data_dir` | 获取应用数据目录 |

### 插件

- `tauri-plugin-log`：日志记录
- `tauri-plugin-dialog`：文件对话框
- `tauri-plugin-fs`：文件系统访问

## 前端 API 封装

前端通过 `src/utils/tauri.js` 封装了 Rust 后端命令：

```javascript
import { getAppInfo, saveFile, readFile } from './utils/tauri.js'

// 获取应用信息
const info = await getAppInfo()

// 保存文件
await saveFile('/path/to/file.txt', '内容')

// 读取文件
const content = await readFile('/path/to/file.txt')
```

## 移动端视图

应用包含 12 个移动端视图：

| 视图 | 路由 | 说明 |
|------|------|------|
| Library | `/` | 书架 |
| Writer | `/tools` | 写作编辑器 |
| More | `/more` | 更多功能入口 |
| Settings | `/settings` | 设置 |
| Backup | `/backup` | 备份与恢复 |
| Billing | `/billing` | 订阅与付费 |
| Extras | `/extras` | 附加内容 |
| Genres | `/genres` | 类型管理 |
| Goals | `/goals` | 写作目标 |
| Prompts | `/prompts` | AI 提示词 |
| Stats | `/stats` | 统计信息 |
| Tools | `/tools` | 创作工具 |

## 主题与样式

应用支持多主题切换：

- 日间模式（浅色）
- 夜间模式（深色）
- 跟随系统主题

主题配置存储在 `localStorage`，通过 `usePrefs` 组合式函数管理。

## 数据存储

应用使用本地存储（IndexedDB）管理数据：

- 小说章节
- 写作进度
- AI 配置
- 用户偏好

数据目录：
- Windows: `%APPDATA%/com.writing91.desktop/`
- macOS: `~/Library/Application Support/com.writing91.desktop/`
- Linux: `~/.local/share/com.writing91.desktop/`

## 许可证

MIT License

## 相关项目

- [91Writing Android](https://github.com/example/91writing-android) - Android WebView 版本
- [91Writing Web](https://github.com/example/91writing-web) - Web 版本
