/* global ePub */
"use strict";

// ── DOM references ──────────────────────────────────────────────────────────
const body = document.body;
const landing = document.getElementById("landing");
const readerScreen = document.getElementById("reader-screen");
const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
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
const txtViewer = document.getElementById("txt-viewer");
const txtContent = document.getElementById("txt-content");
const epubNav = document.getElementById("epub-nav");
const btnPrev = document.getElementById("btn-prev");
const btnNext = document.getElementById("btn-next");
const pageInfo = document.getElementById("page-info");
const progressSlider = document.getElementById("progress-slider");

// ── State ────────────────────────────────────────────────────────────────────
let currentBook = null; // epub.js Book
let currentRendition = null; // epub.js Rendition
let currentEpubLocation = null; // To restore loc when switching flow
let fontSize = 18; // px, applies to both epub & txt
let isDark = false;
let currentFontFamily = "'LXGW WenKai Lite', 'KaiTi', serif";
let currentLineHeight = 1.85;
let currentMaxWidth = 720;
let isScrollMode = false; // By default Paginated
let isGeneratingLocations = false; // Prevents jumping during calc

const FONT_SIZE_MIN = 12;
const FONT_SIZE_MAX = 36;
const FONT_SIZE_STEP = 2;

// ── Theme ────────────────────────────────────────────────────────────────────
function applyTheme() {
  body.classList.toggle("dark", isDark);
  btnTheme.textContent = isDark ? "☀️" : "🌙";
  if (currentRendition) {
    currentRendition.themes.override("color", isDark ? "#e8e4de" : "#2c2b28");
    currentRendition.themes.override(
      "background",
      isDark ? "#252320" : "#ffffff",
    );
  }
}

btnTheme.addEventListener("click", () => {
  isDark = !isDark;
  applyTheme();
});

// ── Font size ────────────────────────────────────────────────────────────────
function applyFontSize() {
  const cfi = currentRendition?.currentLocation()?.start?.cfi;

  if (currentRendition) {
    currentRendition.themes.fontSize(`${fontSize}px`);
    setTimeout(() => {
      if (currentRendition && cfi) {
        currentRendition.resize();
        currentRendition.display(cfi);
      }
    }, 150);
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
  // Capture current location before applying settings
  const cfi = currentRendition?.currentLocation()?.start?.cfi;

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
    currentRendition.themes.override("font-family", currentFontFamily);
    currentRendition.themes.override("line-height", `${currentLineHeight}`);

    // Give DOM time to reflow, then restore the exact location
    setTimeout(() => {
      if (currentRendition && cfi) {
        currentRendition.resize();
        currentRendition.display(cfi);
      }
    }, 150);
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
}

function showReader() {
  landing.classList.remove("active");
  readerScreen.classList.add("active");
}

// ── Drop zone / file picker ──────────────────────────────────────────────────
dropZone.addEventListener("click", () => fileInput.click());
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
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

fileInput.addEventListener("change", () => {
  if (fileInput.files.length) handleFile(fileInput.files[0]);
  fileInput.value = ""; // reset so the same file can be re-selected
});

// ── File handling ────────────────────────────────────────────────────────────
function handleFile(file) {
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
    // Save current location before re-rendering
    currentEpubLocation = currentRendition.currentLocation()?.start?.cfi;
    currentRendition.destroy();
    epubViewer.innerHTML = "";
  }

  const opts = {
    width: "100%",
    height: "100%",
    spread: "none",
    manager: "continuous",
    flow: isScrollMode ? "scrolled-doc" : "paginated",
  };

  const rendition = book.renderTo(epubViewer, opts);
  currentRendition = rendition;

  rendition.display(currentEpubLocation || undefined);

  // Apply current font size & theme once ready
  rendition.hooks.content.register(() => {
    rendition.themes.fontSize(`${fontSize}px`);
    rendition.themes.override("color", isDark ? "#e8e4de" : "#2c2b28");
    rendition.themes.override("background", isDark ? "#252320" : "#ffffff");
    rendition.themes.override("font-family", currentFontFamily);
    rendition.themes.override("line-height", `${currentLineHeight}`);
    // Let the container's CSS max-width control the width, rather than injecting styles into epub body
    // which breaks the pagination columns in epub.js.
  });

  // Page info updates & TOC
  book.ready.then(() => {
    // Skip regeneration if locations are already built (e.g. view-mode switch)
    if (book.locations && book.locations.total > 0) {
      progressSlider.disabled = false;
      progressSlider.title = "Drag to seek chapter";
      updatePageInfo();
    } else {
      progressSlider.disabled = true;
      pageInfo.textContent = "Calculating...";
      isGeneratingLocations = true;

      // Use full locations generation for 100% accurate percentage reporting
      // Without this epub.js won't give accurate percentages.
      book.locations
        .generate(1600)
        .then(() => {
          isGeneratingLocations = false;
          progressSlider.disabled = false;
          progressSlider.title = "Drag to seek chapter";
          updatePageInfo();
        })
        .catch((e) => {
          console.warn("Failed to generate locations", e);
          isGeneratingLocations = false;
          progressSlider.disabled = false;
          updatePageInfo();
        });
    }

    // Load TOC
    book.loaded.navigation.then((nav) => {
      buildToc(nav.toc);
    });
  });

  rendition.on("relocated", (location) => updatePageInfo(location));

  // Keyboard navigation
  document.removeEventListener("keydown", epubKeyHandler);
  document.addEventListener("keydown", epubKeyHandler);

  // Need to bind directly to rendition for when iframe is focused
  rendition.on("keyup", (event) => epubKeyHandler(event));

  if (isScrollMode) {
    btnPrev.classList.add("hidden");
    btnNext.classList.add("hidden");
  } else {
    btnPrev.classList.remove("hidden");
    btnNext.classList.remove("hidden");
  }

  epubNav.classList.remove("hidden");
  btnTocToggle.classList.remove("hidden");

  showReader();
}

function updatePageInfo(location) {
  if (!currentBook || !currentRendition || isGeneratingLocations) return;
  const loc = location || currentRendition.currentLocation();
  if (!loc || !loc.start) return;

  try {
    if (currentBook.locations && currentBook.locations.total > 0) {
      const percentage = currentBook.locations.percentageFromCfi(loc.start.cfi);
      const val = Math.round(percentage * 1000) / 10;
      pageInfo.textContent = `${val}%`;
      // Update slider without triggering the 'change' event
      progressSlider.value = val;
    } else {
      // Fallback if locations are not generated yet or failed
      const spineItem = currentBook.spine.get(loc.start.cfi);
      if (spineItem) {
        const index = spineItem.index;
        const max = Math.max(1, currentBook.spine.length - 1);
        const val = Math.round((index / max) * 1000) / 10;
        pageInfo.textContent = `${val}%`;
        progressSlider.value = val;
      }
    }
  } catch (e) {
    // Failsafe
  }
}

function epubKeyHandler(e) {
  if (!currentRendition) return;
  if (e.key === "ArrowRight" || e.key === "ArrowDown") currentRendition.next();
  if (e.key === "ArrowLeft" || e.key === "ArrowUp") currentRendition.prev();
}

btnNext.addEventListener("click", () => {
  if (currentRendition) currentRendition.next();
});
btnPrev.addEventListener("click", () => {
  if (currentRendition) currentRendition.prev();
});

progressSlider.addEventListener("change", (e) => {
  if (!currentBook || isGeneratingLocations) return;
  const val = parseFloat(e.target.value);
  const percentage = val / 100;

  if (currentBook.locations && currentBook.locations.total > 0) {
    const cfi = currentBook.locations.cfiFromPercentage(percentage);
    if (cfi) currentRendition.display(cfi);
  } else if (currentBook.spine) {
    // Fallback if locations are unavailable
    const max = Math.max(1, currentBook.spine.length - 1);
    const targetIndex = Math.round(percentage * max);
    try {
      const targetSpine = currentBook.spine.get(targetIndex);
      if (targetSpine && targetSpine.href) {
        currentRendition.display(targetSpine.href);
      }
    } catch (err) {
      console.error("Error seeking spine index", err);
    }
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
tocOverlay.addEventListener("click", closeToc);

// ── TXT loader ───────────────────────────────────────────────────────────────
function loadTxt(file) {
  destroyCurrentBook();

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
  };
  reader.onerror = () => showError("Failed to read the file.");
  reader.readAsArrayBuffer(file);
}
