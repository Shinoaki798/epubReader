/* global ePub */
"use strict";

// ── DOM references ──────────────────────────────────────────────────────────
const body = document.body;
const landing = document.getElementById("landing");
const readerScreen = document.getElementById("reader-screen");
const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const folderInput = document.getElementById("folder-input");
const btnBrowseFiles = document.getElementById("btn-browse-files");
const btnBrowseFolder = document.getElementById("btn-browse-folder");
const errorMsg = document.getElementById("error-msg");

const bookTitle = document.getElementById("book-title");
const btnBack = document.getElementById("btn-back");
const btnFontDec = document.getElementById("btn-font-dec");
const btnFontInc = document.getElementById("btn-font-inc");
const btnTheme = document.getElementById("btn-theme");

const fontFamilySelect = document.getElementById("font-family-select");
const lineSpacingSlider = document.getElementById("line-spacing-slider");
const widthSlider = document.getElementById("width-slider");
const btnViewMode = document.getElementById("btn-view-mode");

const epubViewer = document.getElementById("epub-viewer");
const overscrollTop = document.getElementById("overscroll-top");
const overscrollBottom = document.getElementById("overscroll-bottom");
const txtViewer = document.getElementById("txt-viewer");
const txtContent = document.getElementById("txt-content");
const epubNav = document.getElementById("epub-nav");
const btnPrev = document.getElementById("btn-prev");
const btnNext = document.getElementById("btn-next");
const pageInfo = document.getElementById("page-info");
const progressSlider = document.getElementById("progress-slider");

const btnFileTreeToggle = document.getElementById("btn-file-tree-toggle");
const fileTreeSidebar = document.getElementById("file-tree-sidebar");
const btnFileTreeClose = document.getElementById("btn-file-tree-close");
const fileTreeList = document.getElementById("file-tree-list");

// ── State ────────────────────────────────────────────────────────────────────
let currentBook = null; // epub.js Book
let currentRendition = null; // epub.js Rendition
let currentEpubLocation = null; // To restore loc when switching flow
let currentFile = null; // File object — key for localStorage position save
let fontSize = 24; // px, applies to both epub & txt
let isDark = false;
let currentFontFamily = "'LXGW WenKai Lite', 'KaiTi', serif";
let currentLineHeight = 1.85;
let currentMaxWidth = 720;
let isScrollMode = true; // By default scrolled
let scrollProgressUnlisten = null; // Cleanup fn for scroll-mode progress listener

let isHoveringUI = false;
let uiHideTimeout = null;
const toolbar = document.querySelector(".toolbar");
const navBar = document.querySelector(".nav-bar");

toolbar.addEventListener("mouseenter", () => {
  isHoveringUI = true;
});
toolbar.addEventListener("mouseleave", () => {
  isHoveringUI = false;
  resetUIHideTimer();
});
navBar.addEventListener("mouseenter", () => {
  isHoveringUI = true;
});
navBar.addEventListener("mouseleave", () => {
  isHoveringUI = false;
  resetUIHideTimer();
});

function resetUIHideTimer() {
  if (uiHideTimeout) clearTimeout(uiHideTimeout);
  uiHideTimeout = setTimeout(() => {
    if (readerScreen.classList.contains("active") && !isHoveringUI) {
      if (toolbar) toolbar.classList.add("hidden-bar");
      if (navBar) navBar.classList.add("hidden-bar");
    }
  }, 2500);
}

function handleUIMouseMove(e) {
  if (!readerScreen.classList.contains("active")) return;
  const isNearTop = e.clientY < 80;
  const isNearBottom = e.clientY > window.innerHeight - 80;

  if (isNearTop || isNearBottom || isHoveringUI) {
    if (toolbar) toolbar.classList.remove("hidden-bar");
    if (navBar) navBar.classList.remove("hidden-bar");
    resetUIHideTimer();
  }
}

document.addEventListener("mousemove", handleUIMouseMove);

const FONT_SIZE_MIN = 12;
const FONT_SIZE_MAX = 36;
const FONT_SIZE_STEP = 2;

// ── Style injection helpers ──────────────────────────────────────────────────
// Directly inject a <style> element into each epub iframe so that !important
// rules reliably override book-level CSS (themes.override only sets body inline
// styles, which don't cascade into child elements that have their own rules).
function buildCustomCss() {
  const textColor = isDark ? "#e8e4de" : "#2c2b28";
  const bgColor = isDark ? "#252320" : "#ffffff";

  let css = `
html { font-size: ${fontSize}px !important; }
html, body {
  color: ${textColor} !important;
  background: ${bgColor} !important;
}
html, body, p, div, span, li, blockquote, td, th, h1, h2, h3, h4, h5, h6, rt, ruby {
  line-height: ${currentLineHeight} !important;
  font-family: ${currentFontFamily} !important;
  word-wrap: break-word !important;
  word-break: break-word !important;
  overflow-wrap: break-word !important;
}`;

  if (isScrollMode) {
    css += `
* {
  max-width: 100% !important;
  box-sizing: border-box !important;
}
html, body, div, p {
  width: auto !important;
}
html, body {
  margin: 0 auto !important;
  padding: 0 !important;
}
body {
  padding: 0 16px !important;
}`;
  }
  return css;
}

function injectCustomStyles() {
  if (!currentRendition) return;
  const css = buildCustomCss();
  currentRendition.getContents().forEach((contents) => {
    if (!contents || !contents.document) return;
    let el = contents.document.getElementById("reader-custom-style");
    if (!el) {
      el = contents.document.createElement("style");
      el.id = "reader-custom-style";
      contents.document.head.appendChild(el);
    }
    el.textContent = css;
  });
}

// ── Scroll-mode chapter progress listener ───────────────────────────────────
let overscrollTimer = null;
let topOverscroll = 0;
let bottomOverscroll = 0;
const OVERSCROLL_THRESHOLD = 200; // pixel distance equivalent to 100% "charge"

function resetOverscroll() {
  topOverscroll = 0;
  bottomOverscroll = 0;
  if (overscrollTop) {
    overscrollTop.style.height = "0px";
    overscrollTop.classList.remove("active");
  }
  if (overscrollBottom) {
    overscrollBottom.style.height = "0px";
    overscrollBottom.classList.remove("active");
  }
}

function handleOverscroll(deltaY, container) {
  if (Math.abs(deltaY) < 1) return;
  const isAtTop = container.scrollTop <= 0;
  const isAtBottom =
    Math.ceil(container.scrollTop + container.clientHeight) >=
    Math.floor(container.scrollHeight) - 5;

  if (isAtTop && deltaY < 0) {
    topOverscroll += Math.abs(deltaY);
    let charge = Math.min(topOverscroll / OVERSCROLL_THRESHOLD, 1);
    if (overscrollTop) {
      overscrollTop.style.height = `${charge * 60}px`;
      overscrollTop.classList.add("active");
      overscrollTop.textContent =
        charge >= 1 ? "Release to go to Previous Chapter" : "Previous Chapter";
    }

    if (charge >= 1) {
      resetOverscroll();
      currentRendition.prev();
      return;
    }
  } else if (isAtBottom && deltaY > 0) {
    bottomOverscroll += deltaY;
    let charge = Math.min(bottomOverscroll / OVERSCROLL_THRESHOLD, 1);
    if (overscrollBottom) {
      overscrollBottom.style.height = `${charge * 60}px`;
      overscrollBottom.classList.add("active");
      overscrollBottom.textContent =
        charge >= 1 ? "Release to go to Next Chapter" : "Next Chapter";
    }

    if (charge >= 1) {
      resetOverscroll();
      currentRendition.next();
      return;
    }
  } else {
    resetOverscroll();
  }

  clearTimeout(overscrollTimer);
  overscrollTimer = setTimeout(resetOverscroll, 300);
}

function setupScrollProgressListener() {
  if (scrollProgressUnlisten) {
    scrollProgressUnlisten();
    scrollProgressUnlisten = null;
  }
  if (!currentRendition || !isScrollMode) return;
  const container =
    currentRendition.manager && currentRendition.manager.container;
  if (!container) return;

  function onScroll() {
    const max = container.scrollHeight - container.clientHeight;
    if (max <= 0) {
      progressSlider.value = 0;
      pageInfo.textContent = "0%";
      return;
    }
    const val = Math.round((container.scrollTop / max) * 1000) / 10;
    progressSlider.value = val;
    pageInfo.textContent = `${val}%`;
  }

  function onWheel(e) {
    handleOverscroll(e.deltaY, container);
  }

  let touchStartY = 0;
  function onTouchStart(e) {
    touchStartY = e.touches[0].clientY;
  }
  function onTouchMove(e) {
    const currentY = e.touches[0].clientY;
    const deltaY = touchStartY - currentY;
    handleOverscroll(deltaY, container);
    touchStartY = currentY;
  }

  container.addEventListener("scroll", onScroll, { passive: true });
  container.addEventListener("wheel", onWheel, { passive: false });
  container.addEventListener("touchstart", onTouchStart, { passive: true });
  container.addEventListener("touchmove", onTouchMove, { passive: false });

  scrollProgressUnlisten = () => {
    container.removeEventListener("scroll", onScroll);
    container.removeEventListener("wheel", onWheel);
    container.removeEventListener("touchstart", onTouchStart);
    container.removeEventListener("touchmove", onTouchMove);
  };
}

// ── localStorage helpers ─────────────────────────────────────────────────────
function storageKey(file) {
  return "epubReader_pos_" + file.name + "_" + file.size;
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// ── Theme ────────────────────────────────────────────────────────────────────
function applyTheme() {
  body.classList.toggle("dark", isDark);
  btnTheme.textContent = isDark ? "☀️" : "🌙";
  if (currentRendition) {
    injectCustomStyles();
  }
}

btnTheme.addEventListener("click", () => {
  isDark = !isDark;
  applyTheme();
});

// ── Font size ────────────────────────────────────────────────────────────────
function applyFontSize() {
  if (currentRendition) {
    const cfi = currentRendition.currentLocation()?.start?.cfi;
    injectCustomStyles();
    // Paginated: re-paginate after font size change. Scroll: resize only (no display snap-back).
    if (!isScrollMode) {
      setTimeout(() => {
        if (currentRendition && cfi) {
          currentRendition.resize();
          currentRendition.display(cfi);
        }
      }, 150);
    } else {
      setTimeout(() => {
        if (currentRendition) currentRendition.resize();
      }, 150);
    }
  }
  txtContent.style.fontSize = `${fontSize}px`;
}

btnFontDec.addEventListener("click", () => {
  if (fontSize > FONT_SIZE_MIN) {
    fontSize -= FONT_SIZE_STEP;
    applyFontSize();
  }
});

btnFontInc.addEventListener("click", () => {
  if (fontSize < FONT_SIZE_MAX) {
    fontSize += FONT_SIZE_STEP;
    applyFontSize();
  }
});

// ── Font & Line Spacing ──────────────────────────────────────────────────────
function applyFontSettings() {
  document.documentElement.style.setProperty(
    "--font-family",
    currentFontFamily,
  );
  document.documentElement.style.setProperty(
    "--line-height",
    currentLineHeight,
  );
  document.documentElement.style.setProperty(
    "--max-width",
    `${currentMaxWidth}px`,
  );

  if (currentRendition) {
    const cfi = currentRendition.currentLocation()?.start?.cfi;
    injectCustomStyles();
    // Paginated: re-paginate after layout change. Scroll: resize only (no display snap-back).
    if (!isScrollMode) {
      setTimeout(() => {
        if (currentRendition && cfi) {
          currentRendition.resize();
          currentRendition.display(cfi);
        }
      }, 150);
    } else {
      setTimeout(() => {
        if (currentRendition) currentRendition.resize();
      }, 150);
    }
  }

  txtContent.style.fontFamily = currentFontFamily;
  txtContent.style.lineHeight = currentLineHeight;
  txtContent.style.maxWidth = `${currentMaxWidth}px`;
}

fontFamilySelect.addEventListener("change", (e) => {
  currentFontFamily = e.target.value;
  applyFontSettings();
});

lineSpacingSlider.addEventListener("input", (e) => {
  currentLineHeight = parseFloat(e.target.value);
  applyFontSettings();
});

widthSlider.addEventListener("input", (e) => {
  currentMaxWidth = parseInt(e.target.value, 10);
  applyFontSettings();
});

btnViewMode.addEventListener("click", () => {
  isScrollMode = !isScrollMode;
  btnViewMode.textContent = isScrollMode ? "⏬" : "📄";
  if (currentBook) {
    // Re-render book with new flow
    currentEpubLocation = currentRendition.currentLocation()?.start?.cfi;
    renderEpubBook(currentBook);
  }
});

// ── Back button ──────────────────────────────────────────────────────────────
btnBack.addEventListener("click", () => {
  document.removeEventListener("keydown", epubKeyHandler);
  destroyCurrentBook();
  showLanding();
});

function showLanding() {
  readerScreen.classList.remove("active");
  landing.classList.add("active");
  errorMsg.textContent = "";
  errorMsg.classList.add("hidden");
  if (toolbar) toolbar.classList.remove("hidden-bar");
  if (navBar) navBar.classList.remove("hidden-bar");
  if (uiHideTimeout) clearTimeout(uiHideTimeout);
}

function showReader() {
  landing.classList.remove("active");
  readerScreen.classList.add("active");
  if (toolbar) toolbar.classList.remove("hidden-bar");
  if (navBar) navBar.classList.remove("hidden-bar");
  resetUIHideTimer();
}

document.addEventListener("dragover", (e) => e.preventDefault());
document.addEventListener("drop", (e) => e.preventDefault());

btnBrowseFiles.addEventListener("click", () => fileInput.click());
btnBrowseFolder.addEventListener("click", () => folderInput.click());

dropZone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileInput.click();
  }
});

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("drag-over");
});
dropZone.addEventListener("dragleave", () =>
  dropZone.classList.remove("drag-over"),
);
dropZone.addEventListener("drop", async (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");

  if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
    const items = e.dataTransfer.items;
    const entries = [];
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry && items[i].webkitGetAsEntry();
      if (entry) entries.push(entry);
    }

    const nodes = [];
    if (entries.length > 0) {
      errorMsg.textContent = "Scanning files, please wait...";
      errorMsg.classList.remove("hidden");
    }

    const results = await Promise.all(entries.map((entry) => scanEntry(entry)));
    for (const result of results) {
      if (result) nodes.push(result);
    }

    if (nodes.length > 0) {
      errorMsg.classList.add("hidden");
      btnFileTreeToggle.classList.remove("hidden");
      renderFileTree(nodes, fileTreeList);
      const firstFile = findFirstFile(nodes);
      if (firstFile) handleFile(firstFile);
    } else {
      showError("No EPUB or TXT files found in the dropped content.");
    }
  } else {
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }
});

// Recursively scan dropped items
async function scanEntry(entry) {
  if (entry.isFile) {
    return new Promise((resolve) => {
      entry.file(
        (file) => {
          const n = file.name.toLowerCase();
          if (n.endsWith(".epub") || n.endsWith(".txt")) {
            resolve({ name: file.name, isDir: false, file: file });
          } else resolve(null);
        },
        (err) => resolve(null),
      );
    });
  } else if (entry.isDirectory) {
    const reader = entry.createReader();
    const entries = await new Promise((resolve) => {
      let all = [];
      function read() {
        reader.readEntries(
          (res) => {
            if (res.length === 0) resolve(all);
            else {
              all.push(...res);
              read();
            }
          },
          (err) => resolve(all),
        );
      }
      read();
    });
    const children = [];
    const childResults = await Promise.all(
      entries.map((childEntry) => scanEntry(childEntry)),
    );
    for (const child of childResults) {
      if (child) children.push(child);
    }
    if (children.length > 0) return { name: entry.name, isDir: true, children };
    return null;
  }
  return null;
}

function renderFileTree(nodes, container) {
  container.innerHTML = "";
  nodes.forEach((node) => {
    const li = document.createElement("li");
    if (node.isDir) {
      const span = document.createElement("span");
      span.textContent = "📁 " + node.name;
      span.className = "folder-label";
      span.title = node.name;
      span.onclick = () => {
        const ul = li.querySelector("ul");
        if (ul) ul.classList.toggle("hidden");
      };
      li.appendChild(span);
      const ul = document.createElement("ul");
      renderFileTree(node.children, ul);
      li.appendChild(ul);
    } else {
      const a = document.createElement("a");
      a.title = node.name;
      a.textContent =
        (node.name.toLowerCase().endsWith(".epub") ? "📘 " : "📄 ") + node.name;
      a.onclick = () => {
        fileTreeSidebar.classList.remove("active");
        if (tocOverlay) tocOverlay.classList.remove("active");
        handleFile(node.file);
      };
      li.appendChild(a);
    }
    container.appendChild(li);
  });
}

function findFirstFile(nodes) {
  for (let n of nodes) {
    if (!n.isDir) return n.file;
    const childFile = findFirstFile(n.children);
    if (childFile) return childFile;
  }
  return null;
}

fileInput.addEventListener("change", () => {
  if (fileInput.files.length) handleFile(fileInput.files[0]);
  fileInput.value = ""; // reset so the same file can be re-selected
});

folderInput.addEventListener("change", () => {
  const files = Array.from(folderInput.files).filter(
    (f) =>
      f.name.toLowerCase().endsWith(".epub") ||
      f.name.toLowerCase().endsWith(".txt"),
  );

  if (files.length === 0) {
    showError("No EPUB or TXT files found in the selected folder.");
  } else {
    // Basic root-level "folder" node for consistency in tree view
    if (files[0].webkitRelativePath) {
      const folderName = files[0].webkitRelativePath.split("/")[0];
      const folderNode = { name: folderName, isDir: true, children: [] };
      files.forEach((f) => {
        folderNode.children.push({ name: f.name, isDir: false, file: f });
      });
      btnFileTreeToggle.classList.remove("hidden");
      renderFileTree([folderNode], fileTreeList);

      const lastFileRelPath = localStorage.getItem(
        "epubReader_last_file_" + folderName,
      );
      let targetFile = null;
      if (lastFileRelPath) {
        targetFile = files.find(
          (f) => f.webkitRelativePath === lastFileRelPath,
        );
      }

      if (targetFile) {
        handleFile(targetFile);
      } else {
        destroyCurrentBook();
        showReader();
        fileTreeSidebar.classList.add("active");
      }
    }
  }
  folderInput.value = "";
});

// ── File handling ────────────────────────────────────────────────────────────
function handleFile(file) {
  if (file.webkitRelativePath) {
    const folderName = file.webkitRelativePath.split("/")[0];
    localStorage.setItem(
      "epubReader_last_file_" + folderName,
      file.webkitRelativePath,
    );
  }
  const name = file.name.toLowerCase();
  if (name.endsWith(".epub")) {
    loadEpub(file);
  } else if (name.endsWith(".txt")) {
    loadTxt(file);
  } else {
    showError("Unsupported file type. Please use .epub or .txt files.");
  }
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.remove("hidden");
}

// ── Clean up previous book ───────────────────────────────────────────────────
function destroyCurrentBook() {
  if (scrollProgressUnlisten) {
    scrollProgressUnlisten();
    scrollProgressUnlisten = null;
  }
  currentFile = null;
  if (currentRendition) {
    currentRendition.destroy();
    currentRendition = null;
  }
  if (currentBook) {
    currentBook.destroy();
    currentBook = null;
  }
  currentEpubLocation = null;
  epubViewer.innerHTML = "";
  txtContent.textContent = "";
  epubViewer.classList.add("hidden");
  txtViewer.classList.add("hidden");
  epubNav.classList.add("hidden");
  pageInfo.textContent = "0%";
  progressSlider.value = 0;
  progressSlider.disabled = true;
  bookTitle.textContent = "";
}

// ── EPUB loader ──────────────────────────────────────────────────────────────
function loadEpub(file) {
  destroyCurrentBook();
  currentFile = file; // set after destroy so destroy's null-clear doesn't erase it

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      if (typeof ePub === "undefined") {
        showError(
          "epub.js library failed to load. Please check your internet connection and try again.",
        );
        return;
      }
      const book = ePub(e.target.result);
      currentBook = book;

      // Title from metadata
      book.loaded.metadata.then((meta) => {
        bookTitle.textContent = meta.title || file.name;
        document.title = `${meta.title || file.name} – epubReader`;
      });

      // Restore saved reading position (if any)
      const savedCfi = localStorage.getItem(storageKey(file));
      currentEpubLocation = savedCfi || null;

      renderEpubBook(book);

      epubViewer.classList.remove("hidden");
    } catch (err) {
      showError(
        "Failed to open EPUB file. The file may be corrupted or invalid.",
      );
      console.error(err);
    }
  };
  reader.onerror = () => showError("Failed to read the file.");
  reader.readAsArrayBuffer(file);
}

function renderEpubBook(book) {
  if (currentRendition) {
    // Save current location and clean up before re-rendering
    currentEpubLocation = currentRendition.currentLocation()?.start?.cfi;
    if (scrollProgressUnlisten) {
      scrollProgressUnlisten();
      scrollProgressUnlisten = null;
    }
    currentRendition.destroy();
    epubViewer.innerHTML = "";
  }

  const opts = {
    width: "100%",
    height: "100%",
    spread: "none",
    // No manager = epub.js default (single chapter at a time).
    // "continuous" was removed — it chained all chapters and caused scroll-back bugs.
    flow: isScrollMode ? "scrolled" : "paginated",
  };

  epubViewer.dataset.mode = isScrollMode ? "scrolled" : "paginated";
  const rendition = book.renderTo(epubViewer, opts);
  currentRendition = rendition;

  rendition.display(currentEpubLocation || undefined);

  // Apply current font size & theme once ready.
  // Use direct <style> injection with !important so book-level CSS is overridden.
  rendition.hooks.content.register((contents) => {
    if (!contents || !contents.document) return;
    let styleEl = contents.document.getElementById("reader-custom-style");
    if (!styleEl) {
      styleEl = contents.document.createElement("style");
      styleEl.id = "reader-custom-style";
      contents.document.head.appendChild(styleEl);
    }
    styleEl.textContent = buildCustomCss();
  });

  // Enable slider and update progress immediately; generate locations in background
  // for paginated seeking (not needed for progress display which uses displayed.page/total).
  book.ready.then(() => {
    progressSlider.disabled = false;
    progressSlider.title = "Drag to seek within chapter";
    updatePageInfo();
    if (!book.locations || book.locations.total === 0) {
      book.locations
        .generate(1600)
        .catch((e) => console.warn("Location generation failed", e));
    }
    book.loaded.navigation.then((nav) => buildToc(nav.toc));
  });

  // Debounced save of current CFI to localStorage on every page turn
  const debouncedSave = debounce((location) => {
    if (currentFile && location?.start?.cfi) {
      localStorage.setItem(storageKey(currentFile), location.start.cfi);
    }
  }, 1000);

  rendition.on("relocated", (location) => {
    updatePageInfo(location);
    debouncedSave(location);
  });

  // In scroll mode, wire up the chapter scroll progress listener after each render
  rendition.on("rendered", () => {
    if (isScrollMode) setupScrollProgressListener();
  });

  // Keyboard navigation
  document.removeEventListener("keydown", epubKeyHandler);
  document.addEventListener("keydown", epubKeyHandler);

  // Need to bind directly to rendition for when iframe is focused
  rendition.on("keyup", (event) => epubKeyHandler(event));

  // Always show prev/next — in scroll mode they navigate between chapters
  btnPrev.classList.remove("hidden");
  btnNext.classList.remove("hidden");

  epubNav.classList.remove("hidden");
  btnTocToggle.classList.remove("hidden");

  showReader();
}

function updatePageInfo(location) {
  if (!currentRendition) return;
  // Scroll mode progress is driven by the iframe scroll listener, not by relocated event
  if (isScrollMode) return;
  const loc = location || currentRendition.currentLocation();
  if (!loc || !loc.start) return;
  try {
    const page = loc.start.displayed?.page;
    const total = loc.start.displayed?.total;
    if (page > 0 && total > 0) {
      pageInfo.textContent = `${page} / ${total}`;
      progressSlider.value = Math.round((page / total) * 1000) / 10;
    }
  } catch (e) {
    // Failsafe
  }
}

function epubKeyHandler(e) {
  if (!currentRendition) return;

  const container =
    currentRendition.manager && currentRendition.manager.container;

  // Left/Right navigate chapters
  if (e.key === "ArrowRight") currentRendition.next();
  if (e.key === "ArrowLeft") currentRendition.prev();

  // Up/Down purely scroll
  if (isScrollMode && container) {
    const amount = 50;
    if (e.key === "ArrowDown") {
      container.scrollBy({ top: amount });
      e.preventDefault();
    }
    if (e.key === "ArrowUp") {
      container.scrollBy({ top: -amount });
      e.preventDefault();
    }
  } else if (!isScrollMode) {
    if (e.key === "ArrowDown") currentRendition.next();
    if (e.key === "ArrowUp") currentRendition.prev();
  }
}

btnNext.addEventListener("click", () => {
  if (currentRendition) currentRendition.next();
});
btnPrev.addEventListener("click", () => {
  if (currentRendition) currentRendition.prev();
});

progressSlider.addEventListener("change", (e) => {
  if (!currentRendition) return;
  const val = parseFloat(e.target.value);

  if (isScrollMode) {
    // Seek within the current chapter by setting the container scroll position directly
    const container =
      currentRendition.manager && currentRendition.manager.container;
    if (container) {
      container.scrollTop =
        (val / 100) * (container.scrollHeight - container.clientHeight);
    }
    return;
  }

  // Paginated: seek within the current chapter using spine-index-scoped CFI
  const loc = currentRendition.currentLocation();
  const spineItem = currentBook?.spine?.get(loc?.start?.cfi);
  if (spineItem && currentBook.locations?.total > 0) {
    // Approximate chapter CFI range from spine index position
    const spineLen = Math.max(1, currentBook.spine.length);
    const chapterStart = spineItem.index / spineLen;
    const chapterEnd = (spineItem.index + 1) / spineLen;
    const targetBookPct =
      chapterStart + (val / 100) * (chapterEnd - chapterStart);
    const clamped = Math.max(
      chapterStart,
      Math.min(chapterEnd - 0.0001, targetBookPct),
    );
    const cfi = currentBook.locations.cfiFromPercentage(clamped);
    if (cfi) {
      currentRendition.display(cfi);
      return;
    }
  }
  // Fallback: navigate by page offset (capped at 20 to avoid UI freeze)
  const total = loc?.start?.displayed?.total || 1;
  const curPage = loc?.start?.displayed?.page || 1;
  const targetPage = Math.max(1, Math.round((val / 100) * total));
  const diff = Math.max(-20, Math.min(20, targetPage - curPage));
  for (let i = 0; i < Math.abs(diff); i++) {
    if (diff > 0) currentRendition.next();
    else currentRendition.prev();
  }
});

// ── TOC Sidebar ─────────────────────────────────────────────────────────────
const tocSidebar = document.getElementById("toc-sidebar");
const tocOverlay = document.getElementById("toc-overlay");
const btnTocToggle = document.getElementById("btn-toc-toggle");
const btnTocClose = document.getElementById("btn-toc-close");
const tocList = document.getElementById("toc-list");

function buildToc(tocArray) {
  tocList.innerHTML = "";
  if (!tocArray || tocArray.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No Table of Contents available";
    tocList.appendChild(li);
    return;
  }

  function appendItems(items, parentElement, depth = 0) {
    items.forEach((item) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.textContent = item.label;
      a.href = "#";
      a.style.paddingLeft = `${depth * 1.5}rem`;
      a.addEventListener("click", (e) => {
        e.preventDefault();
        if (currentRendition) {
          currentRendition.display(item.href);
          closeToc();
        }
      });
      li.appendChild(a);
      parentElement.appendChild(li);
      if (item.subitems && item.subitems.length > 0) {
        appendItems(item.subitems, parentElement, depth + 1);
      }
    });
  }

  appendItems(tocArray, tocList);
}

function openToc() {
  tocSidebar.classList.add("active");
  tocOverlay.classList.add("active");
  fileTreeSidebar.classList.remove("active");
}

function closeToc() {
  tocSidebar.classList.remove("active");
  tocOverlay.classList.remove("active");
}

btnTocToggle.addEventListener("click", () => {
  if (tocSidebar.classList.contains("active")) {
    closeToc();
  } else {
    openToc();
  }
});

btnTocClose.addEventListener("click", closeToc);
tocOverlay.addEventListener("click", () => {
  closeToc();
  fileTreeSidebar.classList.remove("active");
});

btnFileTreeToggle.addEventListener("click", () => {
  closeToc(); // close TOC if open
  const isActive = fileTreeSidebar.classList.toggle("active");
  tocOverlay.classList.toggle("active", isActive);
});

btnFileTreeClose.addEventListener("click", () => {
  fileTreeSidebar.classList.remove("active");
  tocOverlay.classList.remove("active");
});

// ── TXT loader ───────────────────────────────────────────────────────────────
function loadTxt(file) {
  destroyCurrentBook();
  currentFile = file; // set after destroy so destroy's null-clear doesn't erase it

  const reader = new FileReader();
  reader.onload = (e) => {
    const buffer = e.target.result;
    let text = "";
    try {
      const decoder = new TextDecoder("utf-8", { fatal: true });
      text = decoder.decode(buffer);
    } catch (err) {
      // Fallback to GBK/GB18030 for Chinese characters if UTF-8 fails
      const decoder = new TextDecoder("gb18030");
      text = decoder.decode(buffer);
    }

    bookTitle.textContent = file.name.replace(/\.txt$/i, "");
    document.title = `${bookTitle.textContent} – epubReader`;
    txtContent.textContent = text;
    txtContent.style.fontSize = `${fontSize}px`;
    txtContent.style.fontFamily = currentFontFamily;
    txtContent.style.lineHeight = currentLineHeight;
    txtViewer.classList.remove("hidden");
    btnTocToggle.classList.add("hidden");
    showReader();

    // Restore saved scroll position after layout settles
    requestAnimationFrame(() => {
      const saved = localStorage.getItem(storageKey(file));
      if (saved) txtViewer.scrollTop = parseInt(saved, 10) || 0;
    });
  };
  reader.onerror = () => showError("Failed to read the file.");
  reader.readAsArrayBuffer(file);
}

// Save TXT scroll position to localStorage (debounced, top-level listener)
const debouncedTxtSave = debounce(() => {
  if (currentFile)
    localStorage.setItem(storageKey(currentFile), txtViewer.scrollTop);
}, 1000);
txtViewer.addEventListener("scroll", debouncedTxtSave, { passive: true });
