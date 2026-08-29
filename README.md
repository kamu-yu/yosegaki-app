# 寄せ書きアプリ v1

## ファイル
- index.html : 参加者の入力画面
- style.css  : デザイン
- app.js     : 文字数管理・送信処理

## 最初にすること
app.js の先頭付近にある

const GAS_URL = 'PASTE_YOUR_GAS_WEB_APP_URL_HERE';

の文字列を、Google Apps Script の「ウェブアプリ URL」に置き換えてください。

## 140字制限
1. HTML の maxlength="140" で141字目を入力不可
2. JavaScriptで送信直前にも140字以内か再確認
3. Google Apps Script側でも140字以内か再確認

## 送信ボタン
次の条件をすべて満たしたときだけ有効になります。
- 名前が入力されている
- メッセージが入力されている
- 140字以内
- GAS URLが設定済み
