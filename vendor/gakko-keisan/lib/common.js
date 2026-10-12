// ===========================
// 3 つの計算機で共通の部品: ブラウザへの保存・共有リンク・バックアップファイル
// DOM に触らない。ブラウザでは window.GakkoCommon、Node（テスト）では module.exports
// ===========================
(function (root) {
  'use strict';

  var TOOL = 'gakko-keisan';

  // --- ブラウザへの保存（README「ツールを追加するとき」12） ---
  // キーは必ず "gakko-keisan_" で始める。全ツールが同じオリジンで localStorage を共有しているため
  var KEY_PREFIX = TOOL + '_';
  var store = {
    get: function (name, fallback) {
      try {
        var v = root.localStorage.getItem(KEY_PREFIX + name);
        return v === null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }   // 保存できない環境（プライベートモードなど）でも動くように
    },
    set: function (name, value) {
      try { root.localStorage.setItem(KEY_PREFIX + name, JSON.stringify(value)); } catch (e) { /* 保存できなくても続ける */ }
    },
    remove: function (name) {
      try { root.localStorage.removeItem(KEY_PREFIX + name); } catch (e) { /* 続ける */ }
    },
  };

  // --- 共有 URL（README「ツールを追加するとき」11）: 入力は "#" 以降に入れる ---
  function toShareHash(state) { return '#s=' + encodeURIComponent(JSON.stringify(state)); }
  function fromShareHash(hash) {
    var m = /^#s=(.+)$/.exec(hash || '');
    if (!m) return null;
    try { return JSON.parse(decodeURIComponent(m[1])); } catch (e) { return null; }
  }

  // --- バックアップファイル（README「ツールを追加するとき」20。決定 D31） ---
  // 形式: { tool, version, exportedAt, data }。data はブラウザに保存しているものと同じ形
  var BACKUP_VERSION = 1;

  /** 書き出すファイル名: <ツール名>-backup-YYYYMMDD.json（日付は端末の時計） */
  function backupFileName(tool, date) {
    var d = date || new Date();
    return tool + '-backup-' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '.json';
  }

  /** 書き出す中身 */
  function buildBackup(tool, data, date) {
    return { tool: tool, version: BACKUP_VERSION, exportedAt: (date || new Date()).toISOString(), data: data };
  }

  /**
   * 読み込んだファイルの文字列を確かめる。中身の正規化は画面側の関数で行う
   * @returns {{ok: true, data: object} | {ok: false, error: string}} error は画面にそのまま出す文
   */
  function parseBackup(text, tool, requiredKeys) {
    var o;
    try { o = JSON.parse(text); } catch (e) { o = null; }
    if (!o || typeof o !== 'object' || Array.isArray(o) || typeof o.tool !== 'string') {
      return { ok: false, error: 'ファイルを読み取れませんでした。このツールの「ファイルに書き出す」で作った .json ファイルを選んでください。' };
    }
    if (o.tool !== tool) {
      return { ok: false, error: 'ほかのツール（' + o.tool.slice(0, 40) + '）のファイルです。このツールで書き出したファイルを選んでください。' };
    }
    if (o.version !== BACKUP_VERSION) {
      return { ok: false, error: typeof o.version === 'number' && o.version > BACKUP_VERSION
        ? '新しい版のツールで書き出したファイルのため読み込めません。ページを再読み込みしてから、もう一度お試しください。'
        : 'ファイルの形式が正しくないため読み込めません。' };
    }
    var data = o.data;
    var missing = !data || typeof data !== 'object' || Array.isArray(data) ||
      (requiredKeys || []).some(function (k) { return data[k] === undefined || data[k] === null; });
    if (missing) return { ok: false, error: 'ファイルの中身が足りないため読み込めません。' };
    return { ok: true, data: data };
  }

  /**
   * 画面の「保存・書き出し」の 2 ボタンをつなぐ（ブラウザだけ）
   * o: { key: 'naishin', current: fn, apply: fn(draft), update: fn, msg: 要素 }
   * ボタンの id は export・import・import-file。消すボタンは全ツール共通の ../reset-storage.js（data-reset-storage）
   */
  function wireFile(o) {
    var doc = root.document;
    var msg = o.msg;
    doc.getElementById('export').addEventListener('click', function () {
      var data = {}; data[o.key] = o.current();
      var blob = new Blob([JSON.stringify(buildBackup(TOOL, data), null, 2)], { type: 'application/json' });
      var a = doc.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = backupFileName(TOOL);
      doc.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      msg.textContent = 'ファイルに書き出しました。機種変更のときは、このファイルを新しい端末に移して「ファイルから読み込む」を押してください。';
    });
    doc.getElementById('import').addEventListener('click', function () { doc.getElementById('import-file').click(); });
    doc.getElementById('import-file').addEventListener('change', function () {
      var file = this.files && this.files[0];
      this.value = '';
      if (!file) return;
      if (file.size > 1024 * 1024) { msg.textContent = 'ファイルが大きすぎます。このツールで書き出したファイルを選んでください。'; return; }
      file.text().then(function (text) {
        var r = parseBackup(text, TOOL, [o.key]);
        if (!r.ok) { msg.textContent = r.error; return; }
        if (!root.confirm('ファイルの内容で、今の入力を置き換えます。よろしいですか？')) return;
        o.apply(r.data[o.key]);
        o.update();
        msg.textContent = 'ファイルから読み込みました。';
      }, function () { msg.textContent = 'ファイルを読み取れませんでした。'; });
    });
  }

  var api = {
    TOOL: TOOL, store: store, toShareHash: toShareHash, fromShareHash: fromShareHash,
    backupFileName: backupFileName, buildBackup: buildBackup, parseBackup: parseBackup, wireFile: wireFile,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GakkoCommon = api;
})(this);
