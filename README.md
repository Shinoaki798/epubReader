# epubReader / 网页小说阅读器

🇺🇸 [English](#english) | 🇨🇳 [简体中文](#简体中文)

---

<a id="english"></a>
# 🇺🇸 English

A simple, aesthetically pleasing EPUB and TXT file reader for reading novels, built with plain HTML, CSS, JavaScript, and an optional lightweight Node.js local server for cross-device access.

## ✨ Features

- 📁 **File Input**: Drag-and-drop a `.epub` or `.txt` file directly into the browser, or select local folders containing your books.
- 📱 **Cross-Device Reading (Mobile Friendly)**: A built-in lightweight Node.js server (`server.js`) allows you to access your `Stored` books perfectly on your phone across the local network! (Adapted specifically for iOS/iPhone safe areas and notches).
- 📖 **EPUB Rendering**: Powered by [epub.js](https://github.com/futurepress/epub.js), preserving chapters, fonts, and images.
- 📝 **TXT Rendering**: Plain-text files are parsed and displayed with comfortable typography and layout.
- 🎨 **Customizable Reading Experience**:
  - **Dark / Light mode** toggle for day and night reading.
  - **Font size control** (`A+` / `A-`).
  - **Font family selection** (multiple built-in Chinese and English serif/sans-serif fonts).
  - **Line spacing & Width sliders** to adjust the layout to your preference.
- 📜 **Dual Reading Modes**: Seamlessly switch between **Paginated** (page turning) and **Scrolled** (continuous scroll) modes.
- 📚 **Navigation**: File tree sidebar for navigating books in a folder, and Table of Contents (TOC) sidebar for chapter navigation.
- 💾 **Auto-Save Progress**: Your reading position for both EPUB and TXT files is automatically saved in your browser's `localStorage`.

## 🚀 Usage

### Option 1: Browser Only (Offline, No Server)
1. Open `index.html` in any modern browser (Chrome, Edge, Safari, Firefox) on your PC.
2. Simply drop an EPUB/TXT file or use the **browse folder** button to load a local directory.

### Option 2: Local Network Server (Best for Mobile Reading)
Want to read books stored on your PC directly on your phone while lying in bed?
1. Open your terminal in the `epubReader` folder.
2. Run `node server.js`.
3. The terminal will show your local IP address (e.g., `http://192.168.x.x:3000`).
4. Keep the terminal open, connect your phone to the same Wi-Fi, and open that URL in your phone's browser.
5. Click **Open 'Stored' Folder** on the webpage to browse and read all the books placed inside the `epubReader/Stored` directory on your PC!

> **Note**: To use the server feature, ensure your books are placed within the `Stored` folder in the project's root directory.

---

<a id="简体中文"></a>
# 🇨🇳 简体中文 (Chinese)

一个简单、美观的网页版 EPUB 和 TXT 小说阅读器。采用纯粹的 HTML/CSS/JS 构建，并配备了一个轻量级的 Node.js 本地服务器组件，用于在局域网内跨设备无缝阅读。

## ✨ 核心特性

- 📁 **灵活的文件导入**: 支持直接拖拽 `.epub` 或 `.txt` 文件到浏览器中，也支持一键导入整个本地小说文件夹。
- 📱 **跨设备阅读 (完美适配移动端)**: 内置 `server.js` 微薄后端，让你可以在手机上通过局域网直接远程访问电脑上的书库！（专门为 iPhone 等全面屏手机的刘海及底部安全区做过自适应优化）。
- 📖 **EPUB 完美解析**: 基于 [epub.js](https://github.com/futurepress/epub.js)，完整保留原书的章节、内置字体及排版图片等。
- 📝 **TXT 纯文本阅读**: 解析纯文本小说，并提供排版优良、阅读舒适的展示效果（支持 GBK / UTF-8 编码防乱码）。
- 🎨 **高度自定义阅读体验**:
  - **深色 / 浅色模式** 自由切换。
  - **无级字号调节** (`A+` / `A-`)。
  - **多字体自由切换**（内置如霞鹜文楷、思源宋体、各种黑体等优雅中文字体）。
  - **自适应排版控件**: 可拖动滑块自由调整行距与版面宽度。
- 📜 **双阅读模式**: 支持在**翻页模式**（左右滑动）和**滚动模式**（上下连向滚动）之间一键切换。
- 📚 **便捷导航**: 文件树侧边栏帮助你快速在多个小说本间切换，目录侧边栏 (TOC) 助你轻松跳转章节。
- 💾 **进度历史保存**: 无论读到了哪里，系统会自动将阅读进度记录在浏览器的 `localStorage` 中，下次打开无缝继续。

## 🚀 使用指南

### 方式一：仅本地前端使用 (完全离线)
1. 在你的电脑上直接使用任意现代浏览器（Chrome/Edge/Safari等）双击打开 `index.html` 文件。
2. 将 EPUB/TXT 文件拖入页面，或者点击 **浏览文件夹**（browse folder）载入你的整个小说目录即可开始阅读。

### 方式二：局域网服务器模式 (强烈推荐：手机躺床看书必备)
如果你希望手机能够直接访问电脑里下载好的小说目录：
1. 请先把你想看的小说全部放进项目根目录下的 `Stored` 文件夹中。
2. 在电脑终端（Terminal/CMD）中进入 `epubReader` 文件夹。
3. 运行命令：`node server.js`。
4. 终端会打印出你的局域网地址（例如 `http://192.168.x.x:3000`）。
5. 此时保持电脑开机和终端不关闭，使用连着同一个 Wi-Fi 的手机浏览器访问该地址。
6. 点击页面上的 **Open 'Stored' Folder** 按钮，就能在手机上秒开并在舒适的排版中阅读储存在电脑里的小说了！
