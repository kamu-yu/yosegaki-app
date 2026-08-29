// ここに、先ほどコピーした Google Apps Script の「ウェブアプリ URL」を貼り付けます。
// 例: const GAS_URL = 'https://script.google.com/macros/s/xxxxxxxxxxxxxxxx/exec';
const GAS_URL = 'https://script.google.com/macros/s/AKfycbzTaArsIRWc3bMUesJDkOkRbJD2v4aMPJfKc4Sv65zZ4e3F4px160zUPkuWF1z6q_TKGQ/exec';

const form = document.getElementById('messageForm');
const nameInput = document.getElementById('name');
const messageInput = document.getElementById('message');
const counter = document.getElementById('counter');
const submitButton = document.getElementById('submitButton');
const formMessage = document.getElementById('formMessage');
const successPanel = document.getElementById('successPanel');

function updateState() {
  const name = nameInput.value.trim();
  const message = messageInput.value.trim();
  const length = messageInput.value.length;

  counter.textContent = `${length} / 140文字`;

  const isValid =
    name.length > 0 &&
    message.length > 0 &&
    length <= 140 &&
    GAS_URL !== 'PASTE_YOUR_GAS_WEB_APP_URL_HERE';

  submitButton.disabled = !isValid;
}

messageInput.addEventListener('input', updateState);
nameInput.addEventListener('input', updateState);

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const name = nameInput.value.trim();
  const message = messageInput.value.trim();

  // 二重チェック：万一 maxlength が回避されても送信しません。
  if (!name) {
    formMessage.textContent = 'お名前を入力してください。';
    return;
  }

  if (!message) {
    formMessage.textContent = 'メッセージを入力してください。';
    return;
  }

  if (message.length > 140) {
    formMessage.textContent = 'メッセージは140文字以内で入力してください。';
    return;
  }

  if (GAS_URL === 'PASTE_YOUR_GAS_WEB_APP_URL_HERE') {
    formMessage.textContent = '送信先URLがまだ設定されていません。';
    return;
  }

  formMessage.textContent = '';
  submitButton.disabled = true;
  submitButton.textContent = '送信中…';

  try {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({ name, message })
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '送信できませんでした。');
    }

    form.hidden = true;
    successPanel.hidden = false;

  } catch (error) {
    formMessage.textContent =
      '送信に失敗しました。通信状況を確認して、もう一度お試しください。';
    submitButton.disabled = false;
    submitButton.textContent = 'メッセージを送る';
  }
});

updateState();
