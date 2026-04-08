/* global ePub */
'use strict';

// ── DOM references ──────────────────────────────────────────────────────────
const body         = document.body;
const landing      = document.getElementById('landing');
const readerScreen = document.getElementById('reader-screen');
const dropZone     = document.getElementById('drop-zone');
const fileInput    = document.getElementById('file-input');
const errorMsg     = document.getElementById('error-msg');

const bookTitle    = document.getElementById('book-title');
const btnBack      = document.getElementById('btn-back');
const btnFontDec   = document.getElementById('btn-font-dec');
const btnFontInc   = document.getElementById('btn-font-inc');
const btnTheme     = document.getElementById('btn-theme');

const epubViewer   = document.getElementById('epub-viewer');
const txtViewer    = document.getElementById('txt-viewer');
const txtContent   = document.getElementById('txt-content');
const epubNav      = document.getElementById('epub-nav');
const btnPrev      = document.getElementById('btn-prev');
const btnNext      = document.getElementById('btn-next');
const pageInfo     = document.getElementById('page-info');

// ── State ────────────────────────────────────────────────────────────────────
let currentBook       = null;   // epub.js Book
let currentRendition  = null;   // epub.js Rendition
let fontSize          = 18;     // px, applies to both epub & txt
let isDark            = false;

const FONT_SIZE_MIN  = 12;
const FONT_SIZE_MAX  = 36;
const FONT_SIZE_STEP = 2;

// ── Theme ────────────────────────────────────────────────────────────────────
function applyTheme() {
  body.classList.toggle('dark', isDark);
  btnTheme.textContent = isDark ? '☀️' : '🌙';
  if (currentRendition) {
    currentRendition.themes.override('color',      isDark ? '#e8e4de' : '#2c2b28');
    currentRendition.themes.override('background', isDark ? '#252320' : '#ffffff');
  }
}

btnTheme.addEventListener('click', () => {
  isDark = !isDark;
  applyTheme();
});

// ── Font size ────────────────────────────────────────────────────────────────
function applyFontSize() {
  if (currentRendition) {
    currentRendition.themes.fontSize(`${fontSize}px`);
  }
  txtContent.style.fontSize = `${fontSize}px`;
}

btnFontDec.addEventListener('click', () => {
  if (fontSize > FONT_SIZE_MIN) { fontSize -= FONT_SIZE_STEP; applyFontSize(); }
});

btnFontInc.addEventListener('click', () => {
  if (fontSize < FONT_SIZE_MAX) { fontSize += FONT_SIZE_STEP; applyFontSize(); }
});

// ── Back button ──────────────────────────────────────────────────────────────
btnBack.addEventListener('click', () => {
  document.removeEventListener('keydown', epubKeyHandler);
  destroyCurrentBook();
  showLanding();
});

function showLanding() {
  readerScreen.classList.remove('active');
  landing.classList.add('active');
  errorMsg.textContent = '';
  errorMsg.classList.add('hidden');
}

function showReader() {
  landing.classList.remove('active');
  readerScreen.classList.add('active');
}

// ── Drop zone / file picker ──────────────────────────────────────────────────
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files.length) handleFile(fileInput.files[0]);
  fileInput.value = ''; // reset so the same file can be re-selected
});

// ── File handling ────────────────────────────────────────────────────────────
function handleFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.epub')) {
    loadEpub(file);
  } else if (name.endsWith('.txt')) {
    loadTxt(file);
  } else {
    showError('Unsupported file type. Please use .epub or .txt files.');
  }
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.remove('hidden');
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
  epubViewer.innerHTML = '';
  txtContent.textContent = '';
  epubViewer.classList.add('hidden');
  txtViewer.classList.add('hidden');
  epubNav.classList.add('hidden');
  pageInfo.textContent = '';
  bookTitle.textContent = '';
}

// ── EPUB loader ──────────────────────────────────────────────────────────────
function loadEpub(file) {
  destroyCurrentBook();

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      if (typeof ePub === 'undefined') {
        showError('epub.js library failed to load. Please check your internet connection and try again.');
        return;
      }
      const book = ePub(e.target.result);
      currentBook = book;

      const rendition = book.renderTo(epubViewer, {
        width:  '100%',
        height: '100%',
        spread: 'none',
      });
      currentRendition = rendition;

      rendition.display();

      // Apply current font size & theme once ready
      rendition.hooks.content.register(() => {
        rendition.themes.fontSize(`${fontSize}px`);
        rendition.themes.override('color',            isDark ? '#e8e4de' : '#2c2b28');
        rendition.themes.override('background',       isDark ? '#252320' : '#ffffff');
        rendition.themes.override('font-family',      'Georgia, "Times New Roman", serif');
        rendition.themes.override('line-height',      '1.85');
        rendition.themes.override('max-width',        '720px');
        rendition.themes.override('margin',           '0 auto');
        rendition.themes.override('padding',          '40px 24px');
      });

      // Title from metadata
      book.loaded.metadata.then((meta) => {
        bookTitle.textContent = meta.title || file.name;
        document.title = `${meta.title || file.name} – epubReader`;
      });

      // Page info
      book.ready.then(() => {
        book.locations.generate(1024).then(() => {
          updatePageInfo();
        });
      });

      rendition.on('relocated', () => updatePageInfo());

      // Keyboard navigation
      document.addEventListener('keydown', epubKeyHandler);

      epubViewer.classList.remove('hidden');
      epubNav.classList.remove('hidden');
      showReader();
    } catch (err) {
      showError('Failed to open EPUB file. The file may be corrupted or invalid.');
      console.error(err);
    }
  };
  reader.onerror = () => showError('Failed to read the file.');
  reader.readAsArrayBuffer(file);
}

function updatePageInfo() {
  if (!currentBook || !currentRendition) return;
  const loc = currentRendition.currentLocation();
  if (!loc || !loc.start) return;
  const total = currentBook.locations.total;
  if (total > 0) {
    const current = currentBook.locations.percentageFromCfi(loc.start.cfi);
    pageInfo.textContent = `${Math.round(current * 100)}%`;
  }
}

function epubKeyHandler(e) {
  if (!currentRendition) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') currentRendition.next();
  if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   currentRendition.prev();
}

btnNext.addEventListener('click', () => { if (currentRendition) currentRendition.next(); });
btnPrev.addEventListener('click', () => { if (currentRendition) currentRendition.prev(); });

// ── TXT loader ───────────────────────────────────────────────────────────────
function loadTxt(file) {
  destroyCurrentBook();

  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    bookTitle.textContent = file.name.replace(/\.txt$/i, '');
    document.title = `${bookTitle.textContent} – epubReader`;
    txtContent.textContent = text;
    txtContent.style.fontSize = `${fontSize}px`;
    txtViewer.classList.remove('hidden');
    showReader();
  };
  reader.onerror = () => showError('Failed to read the file.');
  reader.readAsText(file, 'UTF-8');
}
