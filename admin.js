const SETTINGS_KEY = 'yosegaki_admin_settings_v2';
const SIZE_OVERRIDES_KEY = 'yosegaki_size_overrides_v1';

const COLORS = [
  '#4A90E2',
  '#66BB6A',
  '#F39C12',
  '#EC6FA9',
  '#9B6BCE'
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
const individualPanel = document.getElementById('individualPanel');
const individualList = document.getElementById('individualList');

let loadedMessages = [];
let sizeOverrides = restoreSizeOverrides();

restoreSettings();

loadButton.addEventListener('click', loadMessages);
rerenderButton.addEventListener('click', () => {
  if (!loadedMessages.length) {
    setStatus('まだメッセージを読み込んでいません。先に「メッセージを読み込む」を押してください。');
    return;
  }
  persistSettings();
  renderAll();
});
printButton.addEventListener('click', () => window.print());
clearButton.addEventListener('click', clearSavedSettings);

sizePresetSelect.addEventListener('change', () => {
  persistSettings();
  // 初期サイズは「個別指定されていないカード」に適用
  if (loadedMessages.length) renderAll();
});
pageMarginSelect.addEventListener('change', () => {
  persistSettings();
  if (loadedMessages.length) renderPreview(loadedMessages);
});
gridGapSelect.addEventListener('change', () => {
  persistSettings();
  if (loadedMessages.length) renderPreview(loadedMessages);
});

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
  individualList.innerHTML = '';
  individualPanel.hidden = true;
  persistSettings();

  try {
    const url = new URL(gasUrl);
    url.searchParams.set('action', 'list');
    url.searchParams.set('key', adminKey);
    url.searchParams.set('_', Date.now());

    const response = await fetch(url.toString(), { method: 'GET' });
    const result = await response.json();

    if (Array.isArray(result)) {
      loadedMessages = result;
    } else if (result && result.success === false) {
      throw new Error(result.message || '読み込みに失敗しました。');
    } else {
      throw new Error('読み込み結果が想定と異なります。');
    }

    setStatus('');
    renderAll();

  } catch (error) {
    loadedMessages = [];
    previewWrap.innerHTML = '';
    individualList.innerHTML = '';
    individualPanel.hidden = true;
    summaryEl.textContent = '';
    setStatus('読み込みに失敗しました。\n管理用キーやURLを確認してください。');
  }
}

function renderAll() {
  renderIndividualControls();
  renderPreview(loadedMessages);
}

function renderIndividualControls() {
  individualList.innerHTML = '';

  if (!loadedMessages.length) {
    individualPanel.hidden = true;
    return;
  }

  individualPanel.hidden = false;

  loadedMessages.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'individual-row';

    const number = document.createElement('div');
    number.className = 'individual-number';
    number.textContent = `No.${index + 1}`;

    const name = document.createElement('div');
    name.className = 'individual-name';
    name.textContent = item.name || '（名前なし）';

    const message = document.createElement('div');
    message.className = 'individual-message';
    message.textContent = item.message || '';

    const select = document.createElement('select');
    select.setAttribute('aria-label', `${item.name || 'メッセージ'} のサイズ`);

    const defaultKey = sizePresetSelect.value || 'medium';
    const overrideKey = getOverrideKey(item);
    const selectedKey = sizeOverrides[overrideKey] || defaultKey;

    [
      ['default', `初期設定に従う（${PRESETS[defaultKey].label}）`],
      ['small', '小 70×45mm'],
      ['medium', '中 80×50mm'],
      ['large', '大 85×55mm']
    ].forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      if (
        (value === 'default' && !sizeOverrides[overrideKey]) ||
        value === selectedKey
      ) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    select.addEventListener('change', () => {
      if (select.value === 'default') {
        delete sizeOverrides[overrideKey];
      } else {
        sizeOverrides[overrideKey] = select.value;
      }
      persistSizeOverrides();
      renderPreview(loadedMessages);
    });

    row.appendChild(number);
    row.appendChild(name);
    row.appendChild(message);
    row.appendChild(select);
    individualList.appendChild(row);
  });
}

function renderPreview(messages) {
  const pageMargin = Number(pageMarginSelect.value) || 10;
  const gap = Number(gridGapSelect.value) || 6;

  const packedPages = packMessages(messages, pageMargin, gap);

  previewWrap.innerHTML = '';

  packedPages.forEach((pageData, pageIndex) => {
    const block = document.createElement('section');
    block.className = 'page-block';

    const title = document.createElement('p');
    title.className = 'page-title';
    title.textContent = `プレビュー ${pageIndex + 1} / ${packedPages.length || 1} ページ`;
    block.appendChild(title);

    const page = document.createElement('div');
    page.className = 'print-page';

    pageData.forEach((entry) => {
      const item = entry.item;
      const card = document.createElement('article');
      card.className = 'oval-card';
      card.style.position = 'absolute';
      card.style.left = `${entry.x}mm`;
      card.style.top = `${entry.y}mm`;
      card.style.width = `${entry.width}mm`;
      card.style.height = `${entry.height}mm`;
      card.style.setProperty('--oval-color', COLORS[entry.globalIndex % COLORS.length]);

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
      page.appendChild(card);
    });

    block.appendChild(page);
    previewWrap.appendChild(block);
  });

  if (!messages.length) {
    const empty = document.createElement('div');
    empty.className = 'top-card';
    empty.innerHTML = '<strong>メッセージがまだありません。</strong><br>投稿が保存されると、ここに印刷プレビューが表示されます。';
    previewWrap.appendChild(empty);
  }

  const counts = { small: 0, medium: 0, large: 0 };
  messages.forEach(item => {
    const key = getCardPresetKey(item);
    counts[key] = (counts[key] || 0) + 1;
  });

  summaryEl.textContent =
    `読み込み件数：${messages.length}件　/　小：${counts.small}件　中：${counts.medium}件　大：${counts.large}件　/　総ページ数：${Math.max(1, packedPages.length)}`;

  requestAnimationFrame(fitAllText);
}

function packMessages(messages, margin, gap) {
  const pages = [];
  let currentPage = [];
  let x = margin;
  let y = margin;
  let rowHeight = 0;

  messages.forEach((item, globalIndex) => {
    const presetKey = getCardPresetKey(item);
    const preset = PRESETS[presetKey];

    // 横に入らなければ次の段へ
    if (x + preset.width > PAGE.width - margin + 0.001) {
      x = margin;
      y += rowHeight + gap;
      rowHeight = 0;
    }

    // 縦に入らなければ次ページへ
    if (y + preset.height > PAGE.height - margin + 0.001) {
      if (currentPage.length) pages.push(currentPage);
      currentPage = [];
      x = margin;
      y = margin;
      rowHeight = 0;
    }

    currentPage.push({
      item,
      globalIndex,
      x,
      y,
      width: preset.width,
      height: preset.height,
      presetKey
    });

    x += preset.width + gap;
    rowHeight = Math.max(rowHeight, preset.height);
  });

  if (currentPage.length) pages.push(currentPage);
  return pages;
}

function getCardPresetKey(item) {
  const defaultKey = sizePresetSelect.value || 'medium';
  const override = sizeOverrides[getOverrideKey(item)];
  return PRESETS[override] ? override : defaultKey;
}

function getOverrideKey(item) {
  return String(item.id ?? `${item.name || ''}::${item.message || ''}`);
}

function fitAllText() {
  document.querySelectorAll('.oval-card').forEach(card => fitCardText(card));
}

function fitCardText(card) {
  const textEl = card.querySelector('.message-text');
  const messageArea = card.querySelector('.message-area');
  if (!textEl || !messageArea) return;

  let size = 11;
  textEl.style.fontSize = `${size}pt`;

  while (size > 9) {
    const fits =
      textEl.scrollHeight <= messageArea.clientHeight + 1 &&
      textEl.scrollWidth <= messageArea.clientWidth + 1;

    if (fits) break;

    size -= 0.5;
    textEl.style.fontSize = `${size}pt`;
  }

  if (size < 9) {
    textEl.style.fontSize = '9pt';
  }
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

function persistSizeOverrides() {
  localStorage.setItem(SIZE_OVERRIDES_KEY, JSON.stringify(sizeOverrides));
}

function restoreSizeOverrides() {
  try {
    return JSON.parse(localStorage.getItem(SIZE_OVERRIDES_KEY) || '{}');
  } catch (error) {
    return {};
  }
}

function clearSavedSettings() {
  localStorage.removeItem(SETTINGS_KEY);
  localStorage.removeItem(SIZE_OVERRIDES_KEY);
  sizeOverrides = {};
  gasUrlInput.value = '';
  adminKeyInput.value = '';
  sizePresetSelect.value = 'medium';
  pageMarginSelect.value = '10';
  gridGapSelect.value = '6';
  loadedMessages = [];
  previewWrap.innerHTML = '';
  individualList.innerHTML = '';
  individualPanel.hidden = true;
  summaryEl.textContent = '';
  setStatus('保存済み設定を消去しました。');
}
