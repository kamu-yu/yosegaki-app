const SETTINGS_KEY = 'yosegaki_admin_settings_v1';

const COLORS = [
  '#4A90E2', // blue
  '#66BB6A', // green
  '#F39C12', // orange
  '#EC6FA9', // pink
  '#9B6BCE'  // purple
];

const PRESETS = {
  small:  { label: '小', width: 70, height: 45 },
  medium: { label: '中', width: 80, height: 50 },
  large:  { label: '大', width: 85, height: 55 }
};

const PAGE = {
  width: 210,
  height: 297
};

const gasUrlInput = document.getElementById('gasUrl');
const adminKeyInput = document.getElementById('adminKey');
const sizePresetSelect = document.getElementById('sizePreset');
const pageMarginSelect = document.getElementById('pageMargin');
const gridGapSelect = document.getElementById('gridGap');
const loadButton = document.getElementById('loadButton');
const rerenderButton = document.getElementById('rerenderButton');
const printButton = document.getElementById('printButton');
const clearButton = document.getElementById('clearButton');
const statusEl = document.getElementById('status');
const summaryEl = document.getElementById('summary');
const previewWrap = document.getElementById('previewWrap');

let loadedMessages = [];

restoreSettings();

loadButton.addEventListener('click', loadMessages);
rerenderButton.addEventListener('click', () => {
  if (!loadedMessages.length) {
    setStatus('まだメッセージを読み込んでいません。先に「メッセージを読み込む」を押してください。');
    return;
  }
  persistSettings();
  renderPreview(loadedMessages);
});
printButton.addEventListener('click', () => window.print());
clearButton.addEventListener('click', clearSavedSettings);

async function loadMessages() {
  const gasUrl = gasUrlInput.value.trim();
  const adminKey = adminKeyInput.value.trim();

  if (!gasUrl) {
    setStatus('Google Apps Script のURLを入力してください。');
    return;
  }

  if (!adminKey) {
    setStatus('管理用キーを入力してください。');
    return;
  }

  setStatus('読み込み中です…');
  summaryEl.textContent = '';
  previewWrap.innerHTML = '';
  persistSettings();

  try {
    const url = new URL(gasUrl);
    url.searchParams.set('action', 'list');
    url.searchParams.set('key', adminKey);
    url.searchParams.set('_', Date.now());

    const response = await fetch(url.toString(), {
      method: 'GET'
    });

    const result = await response.json();

    if (Array.isArray(result)) {
      loadedMessages = result;
    } else if (result && result.success === false) {
      throw new Error(result.message || '読み込みに失敗しました。');
    } else {
      throw new Error('読み込み結果が想定と異なります。');
    }

    setStatus('');
    renderPreview(loadedMessages);

  } catch (error) {
    loadedMessages = [];
    previewWrap.innerHTML = '';
    summaryEl.textContent = '';
    setStatus('読み込みに失敗しました。\n管理用キーやURLを確認してください。');
  }
}

function renderPreview(messages) {
  const presetKey = sizePresetSelect.value;
  const preset = PRESETS[presetKey] || PRESETS.medium;
  const pageMargin = Number(pageMarginSelect.value) || 10;
  const gridGap = Number(gridGapSelect.value) || 6;

  const cols = calcFitCount(PAGE.width, pageMargin, preset.width, gridGap);
  const rows = calcFitCount(PAGE.height, pageMargin, preset.height, gridGap);
  const perPage = Math.max(1, cols * rows);

  const pages = chunk(messages, perPage);
  previewWrap.innerHTML = '';

  pages.forEach((pageMessages, pageIndex) => {
    const block = document.createElement('section');
    block.className = 'page-block';

    const title = document.createElement('p');
    title.className = 'page-title';
    title.textContent = `プレビュー ${pageIndex + 1} / ${pages.length || 1} ページ`;
    block.appendChild(title);

    const page = document.createElement('div');
    page.className = 'print-page';
    page.style.setProperty('--page-margin-mm', `${pageMargin}mm`);
    page.style.setProperty('--grid-gap-mm', `${gridGap}mm`);
    page.style.setProperty('--grid-cols', String(cols));
    page.style.setProperty('--card-width-mm', `${preset.width}mm`);
    page.style.setProperty('--card-height-mm', `${preset.height}mm`);

    const grid = document.createElement('div');
    grid.className = 'print-grid';

    pageMessages.forEach((item, indexOnPage) => {
      const globalIndex = pageIndex * perPage + indexOnPage;
      const color = COLORS[globalIndex % COLORS.length];

      const card = document.createElement('article');
      card.className = 'oval-card';
      card.style.setProperty('--oval-color', color);

      const messageArea = document.createElement('div');
      messageArea.className = 'message-area';

      const messageP = document.createElement('p');
      messageP.className = 'message-text';
      messageP.textContent = item.message || '';

      messageArea.appendChild(messageP);

      const nameLine = document.createElement('div');
      nameLine.className = 'name-line';
      nameLine.textContent = item.name || '';

      card.appendChild(messageArea);
      card.appendChild(nameLine);
      grid.appendChild(card);
    });

    page.appendChild(grid);
    block.appendChild(page);
    previewWrap.appendChild(block);
  });

  if (!messages.length) {
    const empty = document.createElement('div');
    empty.className = 'top-card';
    empty.innerHTML = '<strong>メッセージがまだありません。</strong><br>投稿が保存されると、ここに印刷プレビューが表示されます。';
    previewWrap.appendChild(empty);
  }

  const totalPages = Math.max(1, Math.ceil(messages.length / perPage));
  summaryEl.textContent =
    `読み込み件数：${messages.length}件　/　サイズ：${preset.label}（${preset.width}×${preset.height}mm）　/　1ページあたり：${perPage}件（${cols}列 × ${rows}段）　/　総ページ数：${totalPages}`;

  requestAnimationFrame(fitAllText);
}

function fitAllText() {
  const cards = document.querySelectorAll('.oval-card');
  cards.forEach(card => fitCardText(card));
}

function fitCardText(card) {
  const textEl = card.querySelector('.message-text');
  const messageArea = card.querySelector('.message-area');
  if (!textEl || !messageArea) return;

  let size = 11;
  textEl.style.fontSize = `${size}pt`;

  while (size > 9) {
    if (textEl.scrollHeight <= messageArea.clientHeight + 1 &&
        textEl.scrollWidth <= messageArea.clientWidth + 1) {
      break;
    }
    size -= 0.5;
    textEl.style.fontSize = `${size}pt`;
  }

  if (size < 9) {
    size = 9;
    textEl.style.fontSize = '9pt';
  }
}

function calcFitCount(pageSize, margin, cardSize, gap) {
  const usable = pageSize - margin * 2;
  return Math.max(1, Math.floor((usable + gap) / (cardSize + gap)));
}

function chunk(items, size) {
  const result = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

function setStatus(message) {
  statusEl.textContent = message || '';
}

function persistSettings() {
  const data = {
    gasUrl: gasUrlInput.value.trim(),
    sizePreset: sizePresetSelect.value,
    pageMargin: pageMarginSelect.value,
    gridGap: gridGapSelect.value
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
}

function restoreSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    gasUrlInput.value = data.gasUrl || '';
    sizePresetSelect.value = data.sizePreset || 'medium';
    pageMarginSelect.value = data.pageMargin || '10';
    gridGapSelect.value = data.gridGap || '6';
  } catch (error) {
    // ignore
  }
}

function clearSavedSettings() {
  localStorage.removeItem(SETTINGS_KEY);
  gasUrlInput.value = '';
  adminKeyInput.value = '';
  sizePresetSelect.value = 'medium';
  pageMarginSelect.value = '10';
  gridGapSelect.value = '6';
  loadedMessages = [];
  previewWrap.innerHTML = '';
  summaryEl.textContent = '';
  setStatus('保存済み設定を消去しました。');
}
