(function () {
"use strict";
// ============================================================
// Core_Util : 文字列・日付・タグ・写真の Exif・小さな図
// ============================================================
function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function(m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); }
function pad2(n) { return String(n).padStart(2, '0'); }
function ymd(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function ym(d) { return ymd(d).slice(0, 7); }
function nowStamp() { var d = new Date(); return ymd(d) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
function normDate(s) { return String(s || '').trim().replace(/\//g, '-').replace('T', ' '); }
function toDate(s) { var m = normDate(s).match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}))?/); return m ? new Date(+m[1], m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) : null; }
// 並べ替え用にゼロ埋めをそろえる
function dateKey(s) { var d = toDate(s); return d ? ymd(d) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) : ''; }
function dateLabel(s) { var d = toDate(s); return d ? d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate() + '（' + '日月火水木金土'[d.getDay()] + '）' : String(s || ''); }
function normKey(t) { return String(t || '').normalize('NFKC').replace(/[\s・\-_()（）【】\[\]「」『』]+/g, '').toLowerCase(); }
function isLiked(v) { return /^(true|1|yes|❤️|♥|○|済)$/i.test(String(v || '').trim()); }
function splitList(s) { return String(s || '').split(',').map(function(x) { return x.trim(); }).filter(Boolean); }

function safeUrl(u) {
  var s = String(u || '').trim();
  if (/^https?:\/\//i.test(s)) return s;
  return /^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(s) ? 'https://' + s : '';
}
function domainOf(u) { try { return new URL(safeUrl(u)).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
function mapUrl(q) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q); }

// 旧アプリの写真（Google の画像 URL）。それ以外の場所の画像は表示しない
function legacyImg(u, size) {
  var s = String(u || '').trim(), m = s.match(/lh3\.googleusercontent\.com\/d\/([\w-]+)/) || s.match(/\/file\/d\/([\w-]+)/) || s.match(/drive\.google\.com\/.*[?&]id=([\w-]+)/);
  if (m) return 'https://lh3.googleusercontent.com/d/' + m[1] + '=' + size;
  return /^\/photos\//.test(s) ? s : '';
}

var TAG_CHARS = 'a-zA-Z0-9_\\u3040-\\u30ff\\u3400-\\u9fff\\uff10-\\uff19\\uff21-\\uff3a\\uff41-\\uff5a々ー';
function extractTags(text) {
  var re = new RegExp('(?:^|[\\s\\u3000、。,.!?！？()（）「」『』【】\\[\\]])#([' + TAG_CHARS + ']{1,30})', 'g'), out = [], seen = {}, m;
  var src = String(text || '').replace(/https?:\/\/\S+/g, ' ');
  while ((m = re.exec(src)) !== null) {
    re.lastIndex--; // 区切りを共有する隣のタグも拾う
    if (/^\d+$/.test(m[1]) || seen[m[1].toLowerCase()]) continue;
    seen[m[1].toLowerCase()] = true;
    out.push('#' + m[1]);
  }
  return out;
}

// エスケープしてから、リンク・タグ・[写真1] だけを部品に置き換える
function richText(text, photos) {
  var html = '', last = 0, m;
  var re = new RegExp('(https?:\\/\\/[^\\s<>"\'）)」』】]+)|\\[(?:photo|写真)\\s*:?\\s*(\\d+)\\]|(^|[\\s\\u3000、。,.!?！？()（）「」『』【】])(#[' + TAG_CHARS + ']{1,30})', 'gi');
  var s = String(text || '');
  while ((m = re.exec(s)) !== null) {
    html += esc(s.slice(last, m.index));
    if (m[1]) html += '<a href="' + esc(m[1]) + '" target="_blank" rel="noopener noreferrer">' + esc(m[1]) + '</a>';
    else if (m[2]) {
      var p = (photos || [])[m[2] - 1];
      html += p ? '<span class="inline-photo" data-act="lightbox" data-i="' + (m[2] - 1) + '">' + photoTag(p, 'full') + '</span>' : esc(m[0]);
    } else html += esc(m[3]) + '<button type="button" class="tag" data-act="tag" data-tag="' + esc(m[4]) + '">' + esc(m[4]) + '</button>';
    last = m.index + m[0].length;
  }
  return html + esc(s.slice(last));
}

function stars(r) {
  var n = Math.round(Number(r) || 0);
  return n > 0 ? '<span class="stars" aria-label="評価 ' + n + '">' + '★'.repeat(Math.min(5, n)) + '<i>' + '★'.repeat(Math.max(0, 5 - n)) + '</i></span>' : '<span class="muted">未評価</span>';
}

// 5 項目の軽いレーダー図（0 は未評価）
function radar(labels, values, size) {
  if (!labels.length || !values.some(function(v) { return Number(v) > 0; })) return '';
  var c = 60, R = 36, pt = function(i, r) { var a = -Math.PI / 2 + i * 2 * Math.PI / labels.length; return [(c + Math.cos(a) * r).toFixed(1), (c + Math.sin(a) * r).toFixed(1)]; };
  var poly = function(f) { return labels.map(function(_, i) { return pt(i, f(i)).join(','); }).join(' '); };
  var svg = '<svg class="radar" viewBox="0 0 120 120" width="' + size + '" height="' + size + '" role="img" aria-label="' + esc(labels.map(function(l, i) { return l + ' ' + (Number(values[i]) || '-'); }).join('、')) + '">';
  [1, 0.6, 0.2].forEach(function(k) { svg += '<polygon class="grid" points="' + poly(function() { return R * k; }) + '"/>'; });
  svg += '<polygon class="val" points="' + poly(function(i) { return R * (Number(values[i]) || 0) / 5; }) + '"/>';
  labels.forEach(function(l, i) { var p = pt(i, R + 11); svg += '<text x="' + p[0] + '" y="' + p[1] + '">' + esc(l.slice(0, 5)) + '</text>'; });
  return svg + '</svg>';
}

// Exif から撮影位置だけを読む（JPEG のみ。写真そのものからは縮小時に落ちる）
function readGps(file) {
  return file.slice(0, 262144).arrayBuffer().then(function(buf) {
    var v = new DataView(buf), o = 2;
    if (v.byteLength < 12 || v.getUint16(0) !== 0xFFD8) return null;
    while (o + 10 < v.byteLength) {
      var marker = v.getUint16(o), len = v.getUint16(o + 2);
      if (marker === 0xFFE1 && v.getUint32(o + 4) === 0x45786966) return gpsFromTiff(v, o + 10);
      if ((marker & 0xFF00) !== 0xFF00 || len < 2) return null;
      o += 2 + len;
    }
    return null;
  }).catch(function() { return null; });
}
function gpsFromTiff(v, t) {
  var le = v.getUint16(t) === 0x4949;
  var entries = function(dir) { var n = v.getUint16(dir, le), out = {}; for (var i = 0; i < n; i++) { var e = dir + 2 + i * 12; out[v.getUint16(e, le)] = e; } return out; };
  var root = entries(t + v.getUint32(t + 4, le));
  if (!root[0x8825]) return null;
  var g = entries(t + v.getUint32(root[0x8825] + 8, le));
  if (!g[2] || !g[4]) return null;
  var deg = function(e) {
    var p = t + v.getUint32(e + 8, le), r = [0, 1, 2].map(function(i) { var d = v.getUint32(p + i * 8 + 4, le); return d ? v.getUint32(p + i * 8, le) / d : 0; });
    return r[0] + r[1] / 60 + r[2] / 3600;
  };
  var ref = function(e) { return e ? String.fromCharCode(v.getUint8(e + 8)) : ''; };
  var lat = deg(g[2]) * (ref(g[1]) === 'S' ? -1 : 1), lng = deg(g[4]) * (ref(g[3]) === 'W' ? -1 : 1);
  return isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0) ? null : { lat: +lat.toFixed(6), lng: +lng.toFixed(6) };
}

var ICONS = {
  log: 'M5 4h14v16H5zM8 8h8M8 12h8M8 16h5', plan: 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.700 19.4l1.200-6L3.400 9.300l6-.7z', memo: 'M6 3h9l4 4v14H6zM14 3v5h5', out: 'M12 21s7-6.500 7-12a7 7 0 10-14 0c0 5.500 7 12 7 12zM12 11.500a2.500 2.500 0 100-5 2.500 2.500 0 000 5z',
  plus: 'M12 5v14M5 12h14', search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM16 16l5 5', gear: 'M4 7h9M19 7h1M4 17h1M11 17h9M16 9.500a2.500 2.500 0 100-5 2.500 2.500 0 000 5zM8 19.500a2.500 2.500 0 100-5 2.500 2.500 0 000 5z',
  close: 'M6 6l12 12M18 6L6 18', heart: 'M12 20s-7.500-4.600-9-9.500C2 7 4.500 4.500 7.500 4.500c2 0 3.500 1.200 4.500 2.700 1-1.500 2.500-2.700 4.500-2.700 3 0 5.500 2.500 4.500 6C19.500 15.400 12 20 12 20z', check: 'M5 12.500l4.500 4.500L19 7.500', pin: 'M9 3h6l-1 6 4 4H6l4-4zM12 13v8', clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3.500 2', left: 'M15 5l-7 7 7 7', right: 'M9 5l7 7-7 7', camera: 'M4 8h4l1.500-3h5L16 8h4v11H4zM12 16.500a3.500 3.500 0 100-7 3.500 3.500 0 000 7z'
};
function icon(n) { return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="' + ICONS[n] + '"/></svg>'; }

// ============================================================
// Core_State : 端末の控え・送信待ち・取得内容の重ね合わせ（画面に依存しない。テストから直接動かす）
// ============================================================
var TYPES = ['log', 'goal', 'holiday', 'wish', 'bucket', 'memo'];
var SAVE_FN = { log: 'saveLog', memo: 'saveMemo', goal: 'savePlan', holiday: 'savePlan', wish: 'savePlan', bucket: 'savePlan' };
var MAX_TRIES = 6;

function emptyServer() {
  var s = { me: null, names: ['1人目', '2人目'], settings: {}, tables: {}, col: {}, syncedAt: '' };
  TYPES.forEach(function(t) { s.tables[t] = {}; });
  return s;
}

// persist: {server(obj), queue(list), failed(list)}  call: (fn, arg) => Promise  now: () => ms
function createStore(deps) {
  var st = { server: emptyServer(), queue: [], failed: [], flushing: false, doneCount: 0, views: {}, colView: null, n: 0 };

  function changed() { st.views = {}; st.colView = null; if (deps.onChange) deps.onChange(); }
  function saveQueue() { return deps.persist.queue(st.queue); }
  function saveFailed() { return deps.persist.failed(st.failed); }
  function newId(type) {
    st.n++;
    return (type === 'photo' ? 'ph_' : type + '_') + deps.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8) + st.n.toString(36);
  }
  function opKey(op) { return op.type === 'col' ? 'col:' + op.arg.kind + ':' + op.arg.key : (op.type || op.fn) + ':' + (op.id || op.qid); }

  // 控え + 未送信の変更 = 画面に出す内容。届いた内容で入力中の変更が消えることはない
  function overlay(map, type) {
    st.queue.forEach(function(op) {
      if (op.type !== type) return;
      var cur = map[op.id];
      if (op.fn === 'trash' || op.fn === 'restore') {
        if (cur) map[op.id] = Object.assign({}, cur, { deletedAt: op.fn === 'trash' ? op.at : '' });
        return;
      }
      if (!cur && !op.create) return;
      map[op.id] = Object.assign({}, cur || { id: op.id, deletedAt: '' }, op.set, { _pending: true });
    });
    return map;
  }

  function all(type) {
    if (!st.views[type]) {
      var map = overlay(Object.assign({}, st.server.tables[type]), type);
      st.views[type] = { map: map, list: Object.keys(map).map(function(k) { return map[k]; }) };
    }
    return st.views[type];
  }
  function list(type) { return all(type).list.filter(function(x) { return !x.deletedAt; }); }
  function trashed(type) { return all(type).list.filter(function(x) { return x.deletedAt; }); }
  function get(type, id) { return all(type).map[id] || null; }

  // 共有コレクション: {kind: {key: {value, by, updatedAt}}}（取り消し済みは含めない）
  function col(kind) {
    if (!st.colView) {
      var v = {};
      var put = function(k, key, o) { (v[k] = v[k] || {})[key] = o; };
      Object.keys(st.server.col).forEach(function(k) { var o = st.server.col[k]; put(o.kind, o.key, o); });
      st.queue.forEach(function(op) { if (op.type === 'col') put(op.arg.kind, op.arg.key, { kind: op.arg.kind, key: op.arg.key, value: op.arg.value, by: st.server.me ? st.server.me.name : '', updatedAt: op.at, _pending: true }); });
      Object.keys(v).forEach(function(k) { Object.keys(v[k]).forEach(function(key) { if (v[k][key].value === null || v[k][key].value === undefined) delete v[k][key]; }); });
      st.colView = v;
    }
    return st.colView[kind] || {};
  }

  function push(op) {
    op.qid = deps.now() + '_' + (++st.n);
    op.tries = 0;
    op.at = op.at || deps.stamp();
    st.queue.push(op);
    return op;
  }
  function kick() { changed(); var p = saveQueue(); flush(); return p; }

  // 変えた項目だけを積む。まだ送っていない同じ記録の変更にはまとめる（追加直後の編集も 1 件の追加になる）
  function save(type, id, set, base, create) {
    if (!create && !Object.keys(set).length) return Promise.resolve();
    var last = null;
    st.queue.forEach(function(op) { if (op.type === type && op.id === id) last = op; });
    if (last && last.fn === SAVE_FN[type] && !last.sending) {
      Object.keys(set).forEach(function(f) {
        if (!(f in last.base)) last.base[f] = (base || {})[f];
        last.set[f] = set[f];
      });
      last.create = last.create || !!create;
    } else push({ fn: SAVE_FN[type], type: type, id: id, set: Object.assign({}, set), base: Object.assign({}, base || {}), create: !!create });
    return kick();
  }
  // 今の値との差だけを保存する
  function patch(type, id, next) {
    var cur = get(type, id);
    if (!cur) return Promise.resolve();
    var set = {}, base = {};
    Object.keys(next).forEach(function(f) {
      var a = cur[f] === undefined || cur[f] === null ? '' : cur[f], b = next[f] === undefined || next[f] === null ? '' : next[f];
      if (a !== b) { set[f] = next[f]; base[f] = cur[f] === undefined ? '' : cur[f]; }
    });
    return save(type, id, set, base, false);
  }
  function add(type, values, id) { id = id || newId(type); save(type, id, values, {}, true); return id; }
  function trash(type, id) { push({ fn: 'trash', type: type, id: id }); return kick(); }
  function restore(type, id) { push({ fn: 'restore', type: type, id: id }); return kick(); }
  function setCol(kind, key, value) {
    st.queue = st.queue.filter(function(op) { return op.sending || op.type !== 'col' || op.arg.kind !== kind || op.arg.key !== key; });
    push({ fn: 'saveCollection', type: 'col', arg: { kind: kind, key: key, value: value === undefined ? null : value } });
    return kick();
  }
  function raw(fn, arg) { push({ fn: fn, arg: arg }); return kick(); }

  function argOf(op) {
    if (op.arg) return op.arg;
    if (op.fn === 'trash' || op.fn === 'restore') return { type: op.type, id: op.id };
    return { type: op.type, id: op.id, set: op.set, base: op.base, create: op.create };
  }

  // 再送で直らないもの
  function isPermanent(code) { return code === 'BAD_REQUEST' || code === 'NOT_FOUND' || code === 'UNKNOWN_ACTION'; }
  // 通信・認証の問題。1 件の問題ではないので、ここで止めて次の機会に送る
  function isOffline(code) { return code === 'NETWORK' || code === 'NO_TOKEN' || code === 'UNAUTHORIZED' || code === 'SCHEMA'; }

  function nextOp() {
    var blocked = {}, t = deps.now();
    for (var i = 0; i < st.queue.length; i++) {
      var op = st.queue[i], k = opKey(op);
      if (!blocked[k] && (op.nextAt || 0) <= t) return op;
      blocked[k] = true; // 同じ記録への操作は順番を守る。別の記録は先に進める
    }
    return null;
  }

  function remove(op) { st.queue = st.queue.filter(function(x) { return x !== op; }); }

  function accept(op, res) {
    if (op.type === 'col') { if (res && res.item) st.server.col[res.item.kind + ':' + res.item.key] = res.item; }
    else if (op.type && res && res.item) st.server.tables[op.type][res.item.id] = res.item;
  }

  function flush() {
    if (st.flushing) return Promise.resolve();
    st.flushing = true;
    var step = function() {
      var op = deps.canCall() ? nextOp() : null;
      if (!op) return Promise.resolve();
      op.sending = true;
      return deps.call(op.fn, argOf(op)).then(function(res) {
        remove(op);
        st.doneCount++;
        accept(op, res);
        changed();
        return Promise.all([saveQueue(), deps.persist.server(st.server)]).then(step);
      }, function(err) {
        op.sending = false;
        var code = err && err.code;
        op.error = (err && err.message) || '';
        if (isOffline(code)) return saveQueue();
        op.tries++;
        if (isPermanent(code) || op.tries >= MAX_TRIES) {
          remove(op);
          st.failed.push(op);
          changed();
          // 失敗の控えを先に残してから、待ち行列から外す
          return saveFailed().then(saveQueue).then(step);
        }
        op.nextAt = deps.now() + Math.min(300000, 3000 * Math.pow(2, op.tries));
        return saveQueue().then(step);
      });
    };
    return step().then(function() { st.flushing = false; }, function(e) { st.flushing = false; throw e; })
      .then(function() { if (deps.onIdle) deps.onIdle(); });
  }

  function applyBundle(b) {
    var s = emptyServer();
    s.me = b.me; s.names = b.names || s.names; s.settings = b.settings || {}; s.syncedAt = b.serverTime || '';
    TYPES.forEach(function(t) { ((b.tables || {})[t] || []).forEach(function(o) { s.tables[t][o.id] = o; }); });
    (b.collection || []).forEach(function(o) { s.col[o.kind + ':' + o.key] = o; });
    st.server = s;
    changed();
    return deps.persist.server(s);
  }

  // 先に送ってから取得する。取得中に送信が済んだ場合、その応答は古いので取り直す
  function pull(retry) {
    return flush().then(function() {
      if (!deps.canCall()) return;
      var mark = st.doneCount;
      return deps.call('getBundle', {}).then(function(b) {
        if (st.doneCount !== mark && (retry || 0) < 3) return pull((retry || 0) + 1);
        return applyBundle(b);
      });
    });
  }

  function load(saved) {
    if (saved.server) { var e = emptyServer(); st.server = Object.assign(e, saved.server); TYPES.forEach(function(t) { if (!st.server.tables[t]) st.server.tables[t] = {}; }); }
    st.queue = (saved.queue || []).map(function(op) { op.sending = false; op.nextAt = 0; return op; });
    st.failed = saved.failed || [];
    changed();
  }

  function retryFailed(qid) {
    var op = st.failed.filter(function(x) { return x.qid === qid; })[0];
    if (!op) return Promise.resolve();
    op.tries = 0; op.nextAt = 0; op.error = '';
    st.queue.push(op);
    st.failed = st.failed.filter(function(x) { return x !== op; });
    changed();
    return saveQueue().then(saveFailed).then(flush);
  }
  function dropFailed(qid) { st.failed = st.failed.filter(function(x) { return x.qid !== qid; }); changed(); return saveFailed(); }

  return {
    st: st, all: all, list: list, trashed: trashed, get: get, col: col, save: save, patch: patch, add: add, trash: trash, restore: restore, setCol: setCol, raw: raw,
    flush: flush, pull: pull, applyBundle: applyBundle, load: load, retryFailed: retryFailed, dropFailed: dropFailed, newId: newId
  };
}

// ============================================================
// Core_Io : 端末内の保存（IndexedDB）・通信・写真
// 保存名はすべて couplelog- で始める（同じ端末の別アプリと混ざらないように）
// ============================================================
var DB_NAME = 'couplelog-db', KEY_TOKEN = 'couplelog-token', KEY_PREFS = 'couplelog-prefs', KEY_DRAFT = 'couplelog-draft';
var dbPromise = null;

function openDb() {
  if (!dbPromise) dbPromise = new Promise(function(res, rej) {
    var r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = function() { r.result.createObjectStore('kv'); r.result.createObjectStore('photos', { keyPath: 'id' }); };
    r.onsuccess = function() { res(r.result); };
    r.onerror = function() { dbPromise = null; rej(r.error); };
  });
  return dbPromise;
}
function dbRun(store, mode, fn) {
  return openDb().then(function(db) {
    return new Promise(function(res, rej) {
      var tx = db.transaction(store, mode), rq = fn(tx.objectStore(store));
      tx.oncomplete = function() { res(rq && rq.result); };
      tx.onerror = tx.onabort = function() { rej(tx.error); };
    });
  });
}
function kvGet(k) { return dbRun('kv', 'readonly', function(s) { return s.get(k); }); }
function kvSet(k, v) { return dbRun('kv', 'readwrite', function(s) { return s.put(v, k); }); }
function photoGet(id) { return dbRun('photos', 'readonly', function(s) { return s.get(id); }); }
function photoPut(p) { return dbRun('photos', 'readwrite', function(s) { return s.put(p); }); }
function photoDel(id) { return dbRun('photos', 'readwrite', function(s) { return s.delete(id); }); }
function photoAll() { return dbRun('photos', 'readonly', function(s) { return s.getAll(); }); }

function lsGet(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
function lsSet(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) {} }
function prefs() { try { return JSON.parse(lsGet(KEY_PREFS)) || {}; } catch (e) { return {}; } }
function setPref(k, v) { var p = prefs(); p[k] = v; lsSet(KEY_PREFS, JSON.stringify(p)); }

// ---- 通信（POST の本文にトークンを入れ、URL には載せない） ----
var authRejected = false;
function apiError(message, code) { var e = new Error(message); e.code = code; return e; }
function canCall() { return !!lsGet(KEY_TOKEN) && !authRejected && navigator.onLine !== false && !!window.APP_ENDPOINT; }

function postApi(token, fn, arg, timeoutMs) {
  var ctrl = new AbortController(), timer = setTimeout(function() { ctrl.abort(); }, timeoutMs || 45000);
  return fetch(window.APP_ENDPOINT, { method: 'POST', redirect: 'follow', credentials: 'omit', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ token: token, fn: fn, arg: arg || {} }), signal: ctrl.signal })
    .then(function(r) { return r.text(); })
    .catch(function(e) { throw apiError(e && e.name === 'AbortError' ? '通信がタイムアウトしました' : '通信できませんでした', 'NETWORK'); })
    .then(function(txt) {
      var res;
      try { res = JSON.parse(txt); } catch (e) { throw apiError('サーバーの応答を読み取れません', 'BAD_RESPONSE'); }
      if (!res || !res.ok) throw apiError((res && res.error) || 'サーバーエラー', (res && res.code) || 'ERROR');
      return res.result;
    })
    .finally(function() { clearTimeout(timer); });
}
function callApi(fn, arg, timeoutMs) {
  var token = lsGet(KEY_TOKEN);
  if (!window.APP_ENDPOINT) return Promise.reject(apiError('接続先が設定されていません', 'NETWORK'));
  if (!token) return Promise.reject(apiError('接続トークンが未設定です', 'NO_TOKEN'));
  return postApi(token, fn, arg, timeoutMs).catch(function(e) {
    if (e.code === 'UNAUTHORIZED') { authRejected = true; renderBadge(); }
    throw e;
  });
}

// ---- 写真 ----
function loadImage(file) {
  if (window.createImageBitmap) return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(function() { return loadImageTag(file); });
  return loadImageTag(file);
}
function loadImageTag(file) {
  return new Promise(function(res, rej) {
    var url = URL.createObjectURL(file), im = new Image();
    im.onload = function() { res(im); setTimeout(function() { URL.revokeObjectURL(url); }, 1000); };
    im.onerror = function() { URL.revokeObjectURL(url); rej(new Error('画像を読み込めません')); };
    im.src = url;
  });
}
function shrink(img, side) {
  var w = img.width, h = img.height, k = Math.min(1, side / Math.max(w, h)), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  var blob = function(type) { return new Promise(function(r) { c.toBlob(r, type, 0.82); }); };
  return blob('image/webp').then(function(b) { return b && b.type === 'image/webp' ? b : blob('image/jpeg'); }).then(function(b) {
    if (!b) throw new Error('画像を縮小できません');
    return b;
  });
}
// 縮小して端末内に置く（描き直すので Exif の位置情報は残らない）。送るのは記録を保存してから
function preparePhoto(file) {
  return Promise.all([readGps(file), loadImage(file)]).then(function(r) {
    return Promise.all([shrink(r[1], 1600), shrink(r[1], 640)]).then(function(b) {
      var p = { id: store.newId('photo'), logId: '', state: 'draft', mime: b[0].type, full: b[0], thumb: b[1].type === b[0].type ? b[1] : b[0] };
      return photoPut(p).then(function() { photoUrls[p.id + ':full'] = URL.createObjectURL(p.full); photoUrls[p.id + ':thumb'] = URL.createObjectURL(p.thumb); return { id: p.id, gps: r[0] }; });
    });
  });
}
function toBase64(blob) {
  return new Promise(function(res, rej) { var r = new FileReader(); r.onload = function() { res(String(r.result).split(',')[1]); }; r.onerror = rej; r.readAsDataURL(blob); });
}
function fromBase64(mime, data) { var s = atob(data), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return new Blob([a], { type: mime }); }

// 未送信の写真: {記録の ID: [写真 ID]}。再起動後も IndexedDB から組み直す
var pendingPhotos = {}, failedPhotos = [], photoUrls = {}, uploading = false;
function refreshPending() {
  return photoAll().then(function(list) {
    pendingPhotos = {}; failedPhotos = [];
    list.forEach(function(p) {
      if ((p.state === 'pending' || p.state === 'failed') && p.logId) (pendingPhotos[p.logId] = pendingPhotos[p.logId] || []).push(p.id);
      if (p.state === 'failed') failedPhotos.push({ id: p.id, logId: p.logId, error: p.error });
    });
  });
}
function attachPhotos(ids, logId) {
  return Promise.all(ids.map(function(id) { return photoGet(id).then(function(p) { if (p) { p.logId = logId; p.state = 'pending'; return photoPut(p); } }); })).then(refreshPending);
}
// 1 枚ずつ送る。保存できたと分かってから記録に結び付け、最後に「送信済み」にする。
// 1 枚の失敗が、ほかの写真を止めない
function uploadPhotos() {
  if (uploading || !canCall()) return Promise.resolve();
  uploading = true;
  var tried = {};
  var fail = function(p, msg) { p.state = 'failed'; p.error = msg; return photoPut(p).then(refreshPending); };
  var step = function() {
    return photoAll().then(function(list) {
      var p = list.filter(function(x) { return x.state === 'pending' && !tried[x.id]; })[0];
      if (!p || !canCall()) return;
      tried[p.id] = true;
      return Promise.all([toBase64(p.full), toBase64(p.thumb)])
        .then(function(d) { return callApi('uploadPhoto', { id: p.id, mime: p.mime, full: d[0], thumb: d[1] }, 120000); })
        .then(function() {
          var log = store.get('log', p.logId);
          if (!log) return fail(p, '写真の元の記録が見つかりません');
          var cur = log.photoIds || '', ids = splitList(cur);
          if (ids.indexOf(p.id) < 0) ids.push(p.id);
          return store.save('log', p.logId, { photoIds: ids.join(',') }, { photoIds: cur }, false).then(function() { p.state = 'done'; return photoPut(p); }).then(refreshPending);
        }, function(e) {
          if (e.code === 'NETWORK' || e.code === 'UNAUTHORIZED') throw e;
          p.tries = (p.tries || 0) + 1;
          return e.code === 'BAD_REQUEST' || p.tries >= MAX_TRIES ? fail(p, e.message) : photoPut(p);
        }).then(step);
    });
  };
  return step().catch(function(e) { console.warn('写真の送信を後で再開します', e && e.message); }).then(function() { uploading = false; renderSoon(); });
}

// 記録の写真: 旧写真（N 列）→ 非公開の写真（V 列）→ 未送信、の順
function photosOf(log) {
  var ids = splitList(log.photoIds), out = splitList(log.photoUrls).map(function(u) { return { url: u }; });
  ids.forEach(function(id) { out.push({ id: id }); });
  (pendingPhotos[log.id] || []).forEach(function(id) { if (ids.indexOf(id) < 0) out.push({ id: id, pending: true }); });
  return out;
}
function photoTag(p, size) {
  if (p.url) { var u = legacyImg(p.url, size === 'full' ? 's1600' : 's640'); return u ? '<img src="' + esc(u) + '" loading="lazy" referrerpolicy="no-referrer" alt="">' : '<span class="ph-none">写真</span>'; }
  var ready = photoUrls[p.id + ':' + size];
  return ready ? '<img src="' + ready + '" alt="">' : '<img data-ph="' + esc(p.id) + '" data-size="' + size + '" alt="">';
}

// 見えている分だけ取り寄せる。一度見た写真は端末に残る
var photoWait = { thumb: {}, full: {} }, photoTimer = null, photoObserver = null;
function watchPhotos(root) {
  if (!photoObserver) photoObserver = new IntersectionObserver(function(es) {
    es.forEach(function(e) { if (e.isIntersecting) { photoObserver.unobserve(e.target); requestPhoto(e.target); } });
  }, { rootMargin: '300px' });
  root.querySelectorAll('img[data-ph]').forEach(function(el) { if (!el.dataset.seen) { el.dataset.seen = '1'; photoObserver.observe(el); } });
}
function requestPhoto(el) {
  var id = el.dataset.ph, size = el.dataset.size;
  if (photoUrls[id + ':' + size]) { el.src = photoUrls[id + ':' + size]; return; }
  photoGet(id).catch(function() { return null; }).then(function(p) {
    if (p && p[size]) return showPhoto(id, size, p[size]);
    if (size === 'full' && p && p.thumb) el.src = photoUrls[id + ':thumb'] || (photoUrls[id + ':thumb'] = URL.createObjectURL(p.thumb));
    photoWait[size][id] = true;
    clearTimeout(photoTimer);
    photoTimer = setTimeout(fetchPhotos, 60);
  });
}
function showPhoto(id, size, blob) {
  var k = id + ':' + size;
  if (!photoUrls[k]) photoUrls[k] = URL.createObjectURL(blob);
  document.querySelectorAll('img[data-ph="' + id + '"][data-size="' + size + '"]').forEach(function(el) { el.src = photoUrls[k]; });
}
function fetchPhotos() {
  ['thumb', 'full'].forEach(function(size) {
    var ids = Object.keys(photoWait[size]), n = size === 'full' ? 1 : 8;
    photoWait[size] = {};
    for (var i = 0; i < ids.length; i += n) (function(part) {
      callApi('getPhotos', { ids: part, size: size }).then(function(res) {
        Object.keys(res).forEach(function(id) {
          var blob = fromBase64(res[id].mime, res[id].data);
          showPhoto(id, size, blob);
          photoGet(id).then(function(p) { p = p || { id: id, logId: '', state: 'done', mime: blob.type }; p[size] = blob; return photoPut(p); }).catch(function() {});
        });
      }).catch(function() {});
    })(ids.slice(i, i + n));
  });
}

// カテゴリの定義（旧アプリと同じ値。シートに入っている文字列と一致させる）
var CATS = {
  '日記・日常': { sub: ['日常メモ', '家事・暮らし', 'お出かけ', '購入品', '記念日・イベント', '健康・美容', '仕事・学び', 'その他'], scores: [], prices: [] },
  'グルメ': { sub: ['和食', '洋食', '中華', 'イタリアン', 'フレンチ', 'ラーメン', '焼肉・ホルモン', '居酒屋', 'カフェ・喫茶', 'カレー', 'アジア・エスニック', 'ファストフード', 'その他'], scores: ['味', 'コスパ', '雰囲気', '接客', 'リピ度'], prices: ['〜1,000円', '1,000〜2,000円', '2,000〜3,000円', '3,000〜5,000円', '5,000〜10,000円', '10,000円〜'] },
  'スイーツ': { sub: ['ケーキ・洋菓子', '和菓子', 'カフェスイーツ', 'パフェ', 'アイス・ジェラート', 'パン・ベーカリー', 'チョコレート', 'コンビニスイーツ', 'その他'], scores: ['味', '甘さ・バランス', '見た目', 'コスパ', 'リピ度'], prices: ['〜500円', '500〜1,000円', '1,000〜2,000円', '2,000〜3,000円', '3,000円〜'] },
  'お酒': { sub: ['日本酒', 'ワイン', 'ビール・クラフトビール', 'ウイスキー', '焼酎', 'カクテル・サワー', '果実酒・梅酒', 'バー・居酒屋', 'その他'], scores: ['味・香り', '飲みやすさ', 'コスパ', '余韻', 'リピ度'], prices: ['〜1,000円', '1,000〜2,000円', '2,000〜3,000円', '3,000〜5,000円', '5,000〜10,000円', '10,000円〜'] },
  '旅行': { sub: ['国内旅行', '海外旅行', '日帰りお出かけ', '温泉・旅館', 'ホテル・宿泊', '観光スポット', 'ドライブ', 'キャンプ・アウトドア', 'その他'], scores: ['景色・体験', '快適さ', 'コスパ', 'アクセス', 'リピ度'], prices: ['〜5,000円', '5,000〜10,000円', '1〜3万円', '3〜5万円', '5〜10万円', '10万円〜'] },
  'レシピ': { sub: ['主菜（肉）', '主菜（魚）', '副菜', 'ご飯もの', '麺類', '汁物・スープ', 'おつまみ', 'お菓子・デザート', 'パン', 'ドリンク', 'その他'], scores: ['味', '手軽さ', 'コスパ', '見た目', 'リピ度'], prices: ['10分以内', '15分', '30分', '45分', '1時間以上'] },
  'エンタメ': { sub: ['映画', 'ドラマ', 'アニメ', '本・小説', '漫画', '音楽・ライブ', 'ゲーム', '美術館・展示', '舞台・演劇', 'スポーツ観戦', 'YouTube・動画', 'その他'], scores: ['面白さ・没入感', 'ストーリー・構成', '映像・演出', '余韻', 'おすすめ度'], prices: ['無料', '〜1,000円', '1,000〜2,000円', '2,000〜5,000円', '5,000〜10,000円', '10,000円〜'] }
};
// 設定シートの categories で中分類などを足せる
function cats() {
  var ex = store.st.server.settings.categories;
  if (!ex || typeof ex !== 'object') return CATS;
  var out = {};
  Object.keys(CATS).concat(Object.keys(ex)).forEach(function(k) { var a = CATS[k] || { sub: [], scores: [], prices: [] }, b = ex[k] || {}; out[k] = { sub: a.sub.concat((b.sub || []).filter(function(s) { return a.sub.indexOf(s) < 0; })), scores: b.scores || a.scores, prices: b.prices || a.prices }; });
  return out;
}
function catOf(c) { return cats()[c] || { sub: [], scores: [], prices: [] }; }

var GOAL_CATS = ['暮らし・習慣', '旅行・お出かけ', 'グルメ・料理', '健康・運動', '家計・貯蓄', 'その他'];
var HOL_STATUS = ['白紙・募集中', '計画中', '手配済', '完了'];
var BUCKET_CATS = ['旅行・絶景', 'グルメ・食', '体験・挑戦', '暮らし・家', '記念・イベント'];
var MEMO_CATS = ['ナレッジ・メモ', 'Webクリップ', '買い物・手続き', '料理・レシピメモ', 'アイデア', 'その他'];
var RECIPE = '【材料（2人分）】\n・\n・\n\n【作り方】\n1. \n2. \n\n【ポイント・感想】\n';
function whenOptions() { var y = new Date().getFullYear(); return ['', y + '年内', (y + 1) + '年', (y + 2) + '年', '3年以内', '5年以内', 'いつか必ず']; }
function isDone(s) { return s === '達成' || s === '達成済' || s === '完了'; }
function isVisited(s) { return /訪問済|完了|達成/.test(String(s || '')); }

// extract_data.mjs が生成。名所
var STAMP_CATS = {"castle":{"name":"お城","ranks":["足軽","侍大将","城主","天下人"],"steps":[1,5,12,30]},"lighthouse":{"name":"灯台","ranks":["浜辺の旅人","灯台守見習い","岬の航海士","灯台マスター"],"steps":[1,4,10,16]},"shrine":{"name":"神社","ranks":["参拝者","一之宮巡礼者","神域の旅人","鎮守の守護者"],"steps":[1,5,15,30]},"temple":{"name":"お寺","ranks":["巡礼ビギナー","古刹めぐり達人","霊場巡礼者","大先達"],"steps":[1,5,15,33]},"museum":{"name":"美術館","ranks":["アート散歩人","美の探究者","キュレーター","巨匠の眼"],"steps":[1,5,12,25]},"science":{"name":"博物館","ranks":["好奇心の旅人","フィールド研究者","博覧強記の博士","総合学術の巨頭"],"steps":[1,5,12,25]},"michinoeki":{"name":"道の駅","ranks":["道の駅ビギナー","街道の常連","スタンプラリー王者","全国道の駅マイスター"],"steps":[1,10,30,80]},"sapa":{"name":"SA/PA","ranks":["ハイウェイ初心者","週末ドライバー","サービスエリア通","高速道路の覇者"],"steps":[1,5,15,35]}};
var STAMP_SPOTS = [
  {"id":"c_himeji","cat":"castle","name":"姫路城（白鷺城）","pref":"兵庫県","lat":34.839,"lng":134.693,"desc":"世界文化遺産。現存12天守の一つで、優美な白漆喰の群閣が世界に誇る日本の象徴。"},
  {"id":"c_matsumoto","cat":"castle","name":"松本城","pref":"長野県","lat":36.238,"lng":137.968,"desc":"国宝。現存最古の五重六階の天守を持ち、黒漆の壁がアルプスの山々に映える。"},
  {"id":"c_kumamoto","cat":"castle","name":"熊本城","pref":"熊本県","lat":32.806,"lng":130.704,"desc":"日本三名城の一つ。加藤清正が築いた武者返しと強固な石垣がそびえる名城。"},
  {"id":"c_hirosaki","cat":"castle","name":"弘前城","pref":"青森県","lat":40.607,"lng":140.463,"desc":"東北地方唯一の現存天守。日本屈指の桜の名所としても全国的に有名。"},
  {"id":"c_inuyama","cat":"castle","name":"犬山城","pref":"愛知県","lat":35.385,"lng":136.941,"desc":"木曽川の畔の小高い山に建つ、現存最古とされる国宝天守。"},
  {"id":"c_hikone","cat":"castle","name":"彦根城","pref":"滋賀県","lat":35.276,"lng":136.251,"desc":"琵琶湖畔に優美な姿を残す国宝天守。ひこにゃんのホームグラウンド。"},
  {"id":"c_matsue","cat":"castle","name":"松江城","pref":"島根県","lat":35.475,"lng":133.05,"desc":"千鳥破風の屋根が美しい「千鳥城」。国宝に指定された山陰唯一の現存天守。"},
  {"id":"c_kochi","cat":"castle","name":"高知城","pref":"高知県","lat":33.559,"lng":133.531,"desc":"本丸御殿と天守がともに現存する全国でも数少ない貴重なお城。"},
  {"id":"c_marugame","cat":"castle","name":"丸亀城","pref":"香川県","lat":34.288,"lng":133.799,"desc":"日本一の高さを誇る美しい石垣（扇の傾斜）と、日本現存12天守の一つ。"},
  {"id":"c_uwajima","cat":"castle","name":"宇和島城","pref":"愛媛県","lat":33.223,"lng":132.564,"desc":"藤堂高虎が築いたとされる、美しい独立式層塔型天守。"},
  {"id":"c_matsuyama","cat":"castle","name":"松山城","pref":"愛媛県","lat":33.843,"lng":132.765,"desc":"勝山山頂から松山市街を見下ろす、連立式天守の見事な名城。"},
  {"id":"c_edo","cat":"castle","name":"江戸城（皇居東御苑）","pref":"東京都","lat":35.685,"lng":139.752,"desc":"かつての徳川将軍家の居城。広大な石垣や富士見櫓の歴史を感じる。"},
  {"id":"l_shiriya","cat":"lighthouse","name":"尻屋崎灯台","pref":"青森県","lat":41.428,"lng":141.462,"desc":"本州最北東端。日本初の煉瓦造灯台で、周囲には寒立馬が駆け回る。"},
  {"id":"l_todo","cat":"lighthouse","name":"魹ヶ埼灯台","pref":"岩手県","lat":39.539,"lng":142.067,"desc":"本州最東端の岬に立つ、美しい白亜の灯台。"},
  {"id":"l_todohokke","cat":"lighthouse","name":"恵山岬灯台","pref":"北海道","lat":41.815,"lng":141.515,"desc":"津軽海峡を望む北海道最南東端の断崖に建つ灯台。"},
  {"id":"l_inubo","cat":"lighthouse","name":"犬吠埼灯台","pref":"千葉県","lat":35.705,"lng":140.863,"desc":"関東最東端。世界灯台100選にも選ばれた、イギリス人設計の煉瓦造灯台。"},
  {"id":"l_jogashima","cat":"lighthouse","name":"城ヶ島灯台","pref":"神奈川県","lat":35.132,"lng":139.612,"desc":"三浦半島南端、関東最古の洋式灯台。"},
  {"id":"l_nojima","cat":"lighthouse","name":"野島埼灯台","pref":"千葉県","lat":34.904,"lng":139.897,"desc":"房総半島最南端。「日本の灯台50選」に選ばれた昇れる灯台。"},
  {"id":"l_oshima","cat":"lighthouse","name":"御前埼灯台","pref":"静岡県","lat":34.601,"lng":138.135,"desc":"遠州灘の駿河湾を分かつ岬に立つ、静岡県を代表する白亜の塔。"},
  {"id":"l_iroto","cat":"lighthouse","name":"石廊崎灯台","pref":"静岡県","lat":34.603,"lng":138.878,"desc":"伊豆半島最南端の断崖絶壁に建ち、荒波を見下ろす灯台。"},
  {"id":"l_omama","cat":"lighthouse","name":"大間スイカ岬（大間埼灯台）","pref":"青森県","lat":41.534,"lng":140.908,"desc":"本州最北端の地・大間から津軽海峡を見つめる灯台。"},
  {"id":"l_tsunoshima","cat":"lighthouse","name":"角島灯台","pref":"山口県","lat":34.362,"lng":130.858,"desc":"日本海に浮かぶ角島西端、総御影石造りの美しい無塗装灯台。"},
  {"id":"l_shionomisaki","cat":"lighthouse","name":"潮岬灯台","pref":"和歌山県","lat":33.431,"lng":135.758,"desc":"本州最南端・紀伊半島の先端で太平洋の荒波を受け止める歴史的灯台。"},
  {"id":"l_ashizuri","cat":"lighthouse","name":"足摺岬灯台","pref":"高知県","lat":32.727,"lng":133.018,"desc":"四国最南端。黒潮が押し寄せる太平洋の水平線を一望する展望灯台。"},
  {"id":"s_ise","cat":"shrine","name":"伊勢神宮（内宮・外宮）","pref":"三重県","lat":34.455,"lng":136.725,"desc":"日本人の総氏神。2000年の歴史を持つ最高峰の聖地。"},
  {"id":"s_izumo","cat":"shrine","name":"出雲大社","pref":"島根県","lat":35.402,"lng":132.685,"desc":"日本屈指の縁結びの神様。大注連縄と壮大な大社造りの本殿。"},
  {"id":"s_fushimi","cat":"shrine","name":"伏見稲荷大社","pref":"京都府","lat":34.967,"lng":135.772,"desc":"全国に3万社ある稲荷神社の総本宮。圧巻の「千本鳥居」。"},
  {"id":"s_atsuta","cat":"shrine","name":"熱田神宮","pref":"愛知県","lat":35.125,"lng":136.906,"desc":"三種の神器の一つ「草薙神剣」を祀る東海地方最大の古社。"},
  {"id":"s_tsurugaoka","cat":"shrine","name":"鶴岡八幡宮","pref":"神奈川県","lat":35.326,"lng":139.556,"desc":"鎌倉の象徴。源頼朝ゆかりの歴史ある武門の守護神。"},
  {"id":"s_kamigamo","cat":"shrine","name":"上賀茂神社（賀茂別雷神社）","pref":"京都府","lat":35.055,"lng":135.753,"desc":"山城国一之宮。世界遺産に登録される京都最古級の神社。"},
  {"id":"s_suwa","cat":"shrine","name":"諏訪大社（上社・下社）","pref":"長野県","lat":36.042,"lng":138.115,"desc":"全国に約2,500社ある諏訪神社の総本社。信濃国一之宮。"},
  {"id":"s_kumano","cat":"shrine","name":"熊野本宮大社","pref":"和歌山県","lat":33.842,"lng":135.775,"desc":"熊野三山の中心。全国の熊野神社の総本宮。"},
  {"id":"s_dazaifu","cat":"shrine","name":"太宰府天満宮","pref":"福岡県","lat":33.515,"lng":130.535,"desc":"学問の神様・菅原道真公を祀る全国天満宮の総本宮。"},
  {"id":"s_kitsuki","cat":"shrine","name":"厳島神社","pref":"広島県","lat":34.295,"lng":132.319,"desc":"海上に浮かぶ大鳥居と社殿が世界的に有名な安芸の厳島。"},
  {"id":"t_kiyomizu","cat":"temple","name":"清水寺","pref":"京都府","lat":34.994,"lng":135.785,"desc":"「清水の舞台」で知られる音羽山の古刹。世界文化遺産。"},
  {"id":"t_todai","cat":"temple","name":"東大寺","pref":"奈良県","lat":34.689,"lng":135.839,"desc":"奈良の大仏（盧舎那仏）を安置する世界最大級の木造建築。"},
  {"id":"t_kinkaku","cat":"temple","name":"金閣寺（鹿苑寺）","pref":"京都府","lat":35.039,"lng":135.729,"desc":"鏡湖池に黄金の舎利殿が映える室町文化の象徴。"},
  {"id":"t_zenko","cat":"temple","name":"善光寺","pref":"長野県","lat":36.591,"lng":138.188,"desc":"「一生に一度は善光寺参り」で知られる無宗派の古刹。"},
  {"id":"t_chuson","cat":"temple","name":"中尊寺（金色堂）","pref":"岩手県","lat":38.988,"lng":141.103,"desc":"平泉の文化遺産。黄金に輝く阿弥陀堂が世界を魅了する。"},
  {"id":"t_naritasan","cat":"temple","name":"成田山新勝寺","pref":"千葉県","lat":35.783,"lng":140.318,"desc":"全国から多くの参詣者が訪れる真言宗智山派の大本山。"},
  {"id":"t_jiu","cat":"temple","name":"高野山 金剛峯寺","pref":"和歌山県","lat":34.212,"lng":135.588,"desc":"弘法大師空海が開いた真言密教の聖地。奥の院への参道。"},
  {"id":"t_byodoin","cat":"temple","name":"平等院（鳳凰堂）","pref":"京都府","lat":34.889,"lng":135.807,"desc":"10円硬貨にもデザインされる、平安時代の阿弥陀如来像を祀る名刹。"},
  {"id":"t_miyajima","cat":"temple","name":"大聖院（宮島）","pref":"広島県","lat":34.293,"lng":132.312,"desc":"弘法大師開基の厳島最古の歴史を持つ真言宗御室派の本山。"},
  {"id":"m_21st","cat":"museum","name":"金沢21世紀美術館","pref":"石川県","lat":36.561,"lng":136.658,"desc":"円形の現代的建築とレア・アンドリオールの「スイミング・プール」で有名。"},
  {"id":"m_ohara","cat":"museum","name":"大原美術館","pref":"岡山県","lat":34.595,"lng":133.771,"desc":"倉敷美観地区にある日本初の私立西洋美術館。エル・グレコの名作を所蔵。"},
  {"id":"m_noma","cat":"museum","name":"直島（地中美術館・ベネッセハウス）","pref":"香川県","lat":34.455,"lng":133.985,"desc":"安藤忠雄設計の建物にモネやジェームズ・タレルが融合したアートの島。"},
  {"id":"m_adachi","cat":"museum","name":"足立美術館","pref":"島根県","lat":35.312,"lng":133.185,"desc":"日本一と称される日本庭園と横山大観のコレクションで世界的に高名。"},
  {"id":"m_towada","cat":"museum","name":"十和田市現代美術館","pref":"青森県","lat":40.612,"lng":141.215,"desc":"街全体が美術館のような、草間彌生やロン・ミュエクの常設展示。"},
  {"id":"m_hakone","cat":"museum","name":"箱根彫刻の森美術館","pref":"神奈川県","lat":35.242,"lng":139.049,"desc":"日本初の野外美術館。大自然の中でピカソやロダンの彫刻を鑑賞。"},
  {"id":"m_saku","cat":"museum","name":"佐川美術館","pref":"滋賀県","lat":35.092,"lng":135.945,"desc":"琵琶湖畔の水面に浮かぶように佇む、平山郁夫や佐藤忠良の美術館。"},
  {"id":"sci_kahaku","cat":"science","name":"国立科学博物館（科博）","pref":"東京都","lat":35.715,"lng":139.776,"desc":"上野恩賜公園にある日本最大級の総合科学博物館。恐竜全身骨格が圧巻。"},
  {"id":"sci_railway","cat":"science","name":"鉄道博物館（鉄博）","pref":"埼玉県","lat":35.923,"lng":139.619,"desc":"日本の鉄道史を実物の車両やシミュレータで体感できる鉄道の殿堂。"},
  {"id":"sci_tamba","cat":"science","name":"福井県立恐竜博物館","pref":"福井県","lat":36.035,"lng":136.825,"desc":"世界三大恐竜博物館の一つ。ドーム型展示室に多数の恐竜骨格。"},
  {"id":"sci_yamato","cat":"science","name":"大和ミュージアム（呉市海事歴史科学館）","pref":"広島県","lat":34.242,"lng":132.552,"desc":"戦艦「大和」の1/10模型や日本の近代造船技術の歴史を伝える。"},
  {"id":"sci_nagoya","cat":"science","name":"リニア・鉄道館","pref":"愛知県","lat":35.105,"lng":136.852,"desc":"新幹線や在来線の歴代実物車両と超電導リニアの展示。"},
  {"id":"sci_toyota","cat":"science","name":"トヨタ産業技術記念館","pref":"愛知県","lat":35.185,"lng":136.882,"desc":"繊維機械から自動車製造への変遷を伝える近代化産業遺産。"},
  {"id":"rn_nanbu","cat":"michinoeki","name":"道の駅 富士吉田","pref":"山梨県","lat":35.482,"lng":138.795,"desc":"富士山の麓、日本一の湧水群公園に隣接する人気の道の駅。"},
  {"id":"rn_itaru","cat":"michinoeki","name":"道の駅 伊豆・村の駅","pref":"静岡県","lat":35.075,"lng":138.925,"desc":"伊豆の特産品やたまご専門店「TAMAGOYA」で大人気の道の駅。"},
  {"id":"rn_ootaki","cat":"michinoeki","name":"道の駅 奥久慈だいご","pref":"茨城県","lat":36.762,"lng":140.355,"desc":"温泉施設併設、袋田の滝近くの自然豊かな道の駅。"},
  {"id":"rn_kawaba","cat":"michinoeki","name":"道の駅 川場田園プラザ","pref":"群馬県","lat":36.675,"lng":139.085,"desc":"「日本一の道の駅」とも称される、グルメと自然が充実した一大スポット。"},
  {"id":"rn_michinoku","cat":"michinoeki","name":"道の駅 うまいもん処（代表）","pref":"新潟県","lat":37.125,"lng":138.855,"desc":"新潟・魚沼の美味しいお米や郷土の味が揃う拠点。"},
  {"id":"sa_hotaru","cat":"sapa","name":"海ほたるPA（東京湾アクアライン）","pref":"千葉県","lat":35.462,"lng":139.871,"desc":"東京湾の真ん中に浮かぶ豪華客船を模した世界でも珍しい海上PA。"},
  {"id":"sa_kariya","cat":"sapa","name":"刈谷PA（伊勢湾岸自動車道）","pref":"愛知県","lat":35.015,"lng":137.012,"desc":"天然温泉やデラックス・トイレ（デラックストイレ）で有名な全国屈指の人気SA。"},
  {"id":"sa_ebina","cat":"sapa","name":"海老名SA（東名高速道路）","pref":"神奈川県","lat":35.452,"lng":139.385,"desc":"メロンパンをはじめとする名物グルメが揃う東名高速の巨大旗艦SA。"},
  {"id":"sa_dangan","cat":"sapa","name":"談合坂SA（中央自動車道）","pref":"山梨県","lat":35.608,"lng":138.985,"desc":"山梨・信州のお土産やグルメが充実した中央道の人気SA。"},
  {"id":"sa_awaji","cat":"sapa","name":"淡路SA（神戸淡路鳴門自動車道）","pref":"兵庫県","lat":34.615,"lng":135.012,"desc":"明石海峡大橋の絶景と大観覧車がシンボルの淡路島玄関口SA。"}
];

// ============================================================
// Core_App : 画面の枠・操作の受付・起動
// ============================================================
var APP = { tab: 'log', sheets: [] };
var ACT = {}, INPUT = {}, SUBMIT = {}, RENDER = {};

// 操作は data-act / data-input / data-submit で受ける（HTML に処理を書かない。CSP で inline script を禁止するため）
document.addEventListener('click', function(e) {
  var el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  if (el.tagName === 'BUTTON' || el.tagName === 'A') e.preventDefault();
  if (ACT[el.dataset.act]) ACT[el.dataset.act](el, e);
});
['input', 'change'].forEach(function(ev) {
  document.addEventListener(ev, function(e) {
    var el = e.target.closest('[data-' + ev + ']');
    if (el && INPUT[el.dataset[ev]]) INPUT[el.dataset[ev]](el, e);
  });
});
document.addEventListener('submit', function(e) {
  e.preventDefault();
  var f = e.target;
  if (SUBMIT[f.dataset.submit]) SUBMIT[f.dataset.submit](f);
});
document.addEventListener('keydown', function(e) { if (e.key === 'Escape') { if (document.getElementById('lightbox')) closeLightbox(); else closeSheet(); } });

function $(id) { return document.getElementById(id); }
function options(list, cur) {
  var l = list.slice();
  if (cur && l.every(function(o) { return (Array.isArray(o) ? o[0] : o) !== cur; })) l.push(cur); // 一覧にない旧い値も失わない
  return l.map(function(o) { var v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o; return '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('');
}

// ---- 下から出る小窓 ----
function openSheet(title, body, opt) {
  opt = opt || {};
  var el = document.createElement('div');
  el.className = 'sheet-bg';
  el.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><header><h2>' + esc(title) + '</h2><button type="button" class="icon-btn" data-act="closeSheet" aria-label="閉じる">' + icon('close') + '</button></header><div class="sheet-body">' + body + '</div></div>';
  el.addEventListener('mousedown', function(e) { if (e.target === el) closeSheet(); });
  el._onClose = opt.onClose;
  document.body.appendChild(el);
  APP.sheets.push(el);
  document.body.classList.add('locked');
  watchPhotos(el);
  if (opt.focus) { var f = el.querySelector(opt.focus); if (f) f.focus(); }
  return el;
}
function closeSheet() {
  var el = APP.sheets.pop();
  if (!el) return;
  if (el._onClose) el._onClose();
  el.remove();
  if (!APP.sheets.length) document.body.classList.remove('locked');
}
function closeAllSheets() { while (APP.sheets.length) closeSheet(); }
function topSheet() { return APP.sheets[APP.sheets.length - 1]; }
ACT.closeSheet = closeSheet;

var toastTimer = null;
function toast(msg, undo) {
  var t = $('toast');
  t.innerHTML = '<span>' + esc(msg) + '</span>' + (undo ? '<button type="button" data-act="undo">取り消す</button>' : '');
  APP.undo = undo || null;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { t.classList.remove('on'); }, undo ? 7000 : 2600);
}
ACT.undo = function() { if (APP.undo) APP.undo(); APP.undo = null; $('toast').classList.remove('on'); };

// ---- 入力フォームの共通部品 ----
// fields: [{k, label, type: text|textarea|select|date|url|month, options, ph, required}]
function openForm(cfg) {
  var v = cfg.values || {};
  var html = '<form data-submit="form" class="form">' + cfg.fields.map(function(f) {
    var val = v[f.k] === undefined || v[f.k] === null ? '' : String(v[f.k]), at = ' name="' + f.k + '"' + (f.required ? ' required' : '');
    var input = f.type === 'textarea' ? '<textarea rows="4"' + at + ' placeholder="' + esc(f.ph || '') + '">' + esc(val) + '</textarea>'
      : f.type === 'select' ? '<select' + at + (f.change ? ' data-change="' + f.change + '"' : '') + '>' + options(f.options, val) + '</select>'
      : '<input type="' + (f.type || 'text') + '"' + at + ' value="' + esc(val) + '" placeholder="' + esc(f.ph || '') + '">';
    return '<label class="' + (f.half ? 'half' : '') + '"><span>' + esc(f.label) + '</span>' + input + '</label>';
  }).join('') + (cfg.extra || '') + '<div class="form-foot">' + (cfg.onDelete ? '<button type="button" class="btn danger" data-act="formDelete">ゴミ箱へ</button>' : '') + '<button class="btn primary" type="submit">' + esc(cfg.saveLabel || '保存') + '</button></div></form>';
  var el = openSheet(cfg.title, html);
  el._form = cfg;
  return el;
}
function formValues(form) { var o = {}; new FormData(form).forEach(function(val, k) { o[k] = String(val).trim(); }); return o; }
SUBMIT.form = function(form) {
  var cfg = topSheet()._form, val = formValues(form);
  if (cfg.onSave(val) === false) return;
  closeSheet();
};
ACT.formDelete = function() { var cfg = topSheet()._form; closeSheet(); cfg.onDelete(); };

function trashItem(type, id, label) {
  store.trash(type, id);
  toast((label || '記録') + 'をゴミ箱に移しました', function() { store.restore(type, id); });
}
// 編集の開始時の値を base にして、変えた項目だけを送る
function saveEdited(type, original, val) {
  var set = {}, base = {};
  Object.keys(val).forEach(function(k) {
    var a = original[k] === undefined || original[k] === null ? '' : original[k];
    if (String(a) !== String(val[k] === null || val[k] === undefined ? '' : val[k])) { set[k] = val[k]; base[k] = original[k] === undefined ? '' : original[k]; }
  });
  store.save(type, original.id, set, base, false);
}

// ---- 同期の印 ----
function renderBadge() {
  var b = $('syncBadge'); if (!b) return;
  var wait = store.st.queue.length + Object.keys(pendingPhotos).reduce(function(n, k) { return n + pendingPhotos[k].length; }, 0) - failedPhotos.length, bad = store.st.failed.length + failedPhotos.length;
  var t = bad ? '失敗 ' + bad : authRejected ? '要接続' : !lsGet(KEY_TOKEN) ? '未接続' : wait > 0 ? '未送信 ' + wait : APP.syncing ? '同期中' : '';
  b.textContent = t;
  b.className = 'badge' + (bad || authRejected ? ' bad' : '');
  b.hidden = !t;
}
function sync(manual) {
  if (APP.syncing) return APP.syncing;
  if (!canCall()) { renderBadge(); if (manual) toast(lsGet(KEY_TOKEN) ? '今は通信できません' : '接続トークンが未設定です'); return Promise.resolve(); }
  APP.syncing = store.pull().then(uploadPhotos).then(function() { return store.flush(); }).then(function() { if (manual) toast('最新の状態です'); }, function(e) { if (manual) toast(e.message); console.warn(e.message); })
    .then(function() { APP.syncing = null; renderBadge(); });
  renderBadge();
  return APP.syncing;
}
ACT.sync = function() { sync(true); };

// ---- 描画 ----
var renderTimer = null;
function renderSoon() { if (!renderTimer) renderTimer = setTimeout(function() { renderTimer = null; render(); }, 0); }
// 入力中の欄があるときは作り直さない（日本語変換が切れるため）
function render() {
  renderBadge();
  var a = document.activeElement, main = $('main');
  if (a && main.contains(a) && /^(INPUT|TEXTAREA)$/.test(a.tagName)) { if (RENDER[APP.tab + 'List']) RENDER[APP.tab + 'List'](); return; }
  RENDER[APP.tab]();
  watchPhotos(main);
}
function go(tab) {
  APP.tab = tab;
  document.querySelectorAll('nav [data-tab]').forEach(function(b) { b.classList.toggle('on', b.dataset.tab === tab); if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  RENDER[tab]();
  watchPhotos($('main'));
  window.scrollTo(0, 0);
}
ACT.go = function(el) { closeAllSheets(); go(el.dataset.tab); };

// ---- 写真の全画面 ----
function openLightbox(photos, i) {
  closeLightbox();
  var el = document.createElement('div');
  el.id = 'lightbox';
  document.body.appendChild(el);
  var x0 = null, show = function(d) {
    i = (i + d + photos.length) % photos.length;
    el.innerHTML = photoTag(photos[i], 'full') + '<button type="button" class="icon-btn lb-close" aria-label="閉じる">' + icon('close') + '</button>' + (photos.length > 1 ? '<div class="lb-count">' + (i + 1) + ' / ' + photos.length + '</div><button type="button" class="icon-btn lb-prev" aria-label="前">' + icon('left') + '</button><button type="button" class="icon-btn lb-next" aria-label="次">' + icon('right') + '</button>' : '');
    watchPhotos(el);
  };
  el.addEventListener('click', function(e) { if (e.target.closest('.lb-prev')) show(-1); else if (e.target.closest('.lb-next')) show(1); else if (e.target.closest('.lb-close') || e.target === el) closeLightbox(); });
  el.addEventListener('touchstart', function(e) { x0 = e.touches[0].clientX; }, { passive: true });
  el.addEventListener('touchend', function(e) { var dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 55 && photos.length > 1) show(dx > 0 ? -1 : 1); }, { passive: true });
  show(0);
}
function closeLightbox() { var el = $('lightbox'); if (el) el.remove(); }

// ---- 地図（開いたときだけ読む） ----
var leafletPromise = null;
function needLeaflet() {
  if (!leafletPromise) leafletPromise = new Promise(function(res, rej) {
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = './vendor/leaflet.css'; document.head.appendChild(l);
    var s = document.createElement('script'); s.src = './vendor/leaflet.js'; s.onload = res; s.onerror = function() { leafletPromise = null; rej(new Error('地図の部品を読み込めません')); }; document.head.appendChild(s);
  });
  return leafletPromise;
}
function makeMap(el, center, zoom) {
  var m = L.map(el, { zoomControl: true }).setView(center, zoom);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' }).addTo(m);
  return m;
}

var store = createStore({
  persist: { server: function(v) { return kvSet('server', v); }, queue: function(v) { return kvSet('queue', v); }, failed: function(v) { return kvSet('failed', v); } },
  call: callApi, canCall: canCall, now: function() { return Date.now(); }, stamp: nowStamp,
  onChange: function() { if (APP.ready) renderSoon(); }
});
function names() { return store.st.server.names; }
function myName() { return store.st.server.me ? store.st.server.me.name : ''; }

// 端末の控えだけで画面を出す。通信はその後
function boot() {
  Promise.all([kvGet('server'), kvGet('queue'), kvGet('failed'), refreshPending()]).then(function(r) { store.load({ server: r[0], queue: r[1], failed: r[2] }); }, function(e) {
    console.warn(e);
    toast('端末内の保存領域を開けません。プライベートブラウズを解除してください');
  }).then(function() {
    APP.ready = true;
    go(RENDER[prefs().start] ? prefs().start : 'log');
    renderBadge();
    document.body.classList.add('ready');
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function() {});
    if (!lsGet(KEY_TOKEN)) openConnect();
    takeShared();
    sync(false);
  });
  window.addEventListener('online', function() { sync(false); });
  document.addEventListener('visibilitychange', function() { if (!document.hidden) sync(false); });
  setInterval(function() { if (!document.hidden && (store.st.queue.length || Object.keys(pendingPhotos).length) && canCall()) store.flush().then(uploadPhotos); }, 20000);
  if ('serviceWorker' in navigator && !window.APP_NO_SW) navigator.serviceWorker.register('./sw.js').catch(function(e) { console.warn(e); });
}

// ============================================================
// Mod_Log : ログの一覧（写真 / ブログ / カード / 表 / 地図）・詳細・再訪・タイムカプセル
// ============================================================
var LV = { view: prefs().logView || 'photo', q: '', cat: '', sub: '', rating: '', author: '', sort: 'new', shown: 30, open: false, capsule: 0, capsuleOff: false, map: null };

function sortedLogs() { return store.list('log').slice().sort(function(a, b) { return dateKey(b.timestamp).localeCompare(dateKey(a.timestamp)) || String(b.id).localeCompare(String(a.id)); }); }
function scoresOf(l) { return [l.s1, l.s2, l.s3, l.s4, l.s5]; }
function matches(text, q) { var t = text.normalize('NFKC').toLowerCase(); return q.normalize('NFKC').toLowerCase().split(/\s+/).every(function(w) { return t.indexOf(w) >= 0; }); }

function filteredLogs() {
  var l = sortedLogs().filter(function(x) {
    if (LV.cat && x.category !== LV.cat) return false;
    if (LV.sub && x.subCategory !== LV.sub) return false;
    if (LV.rating && Math.round(x.rating || 0) !== Number(LV.rating)) return false;
    if (LV.author && x.author !== LV.author) return false;
    if (LV.q[0] === '#') return extractTags(x.title + '\n' + x.memo).some(function(t) { return t.toLowerCase() === LV.q.toLowerCase(); }) || matches(x.memo + '', LV.q);
    return !LV.q || matches([x.title, x.memo, x.category, x.subCategory, x.address, x.author].join(' '), LV.q);
  });
  if (LV.sort === 'old') l.reverse();
  if (LV.sort === 'rate') l.sort(function(a, b) { return (b.rating || 0) - (a.rating || 0); });
  return l;
}

// 同じタイトルの記録: {鍵: [古い順の ID]}（一覧を作るときに 1 度だけ数える）
function visitIndex() {
  var ix = {};
  sortedLogs().reverse().forEach(function(l) { var k = normKey(l.title); if (k) (ix[k] = ix[k] || []).push(l.id); });
  return ix;
}
function visitBadge(l, ix) {
  var v = ix[normKey(l.title)];
  if (!v || v.length < 2) return '';
  return '<button type="button" class="pill ' + (v.length >= 3 ? 'gold' : '') + '" data-act="visits" data-id="' + esc(l.id) + '">' + (v.indexOf(l.id) + 1) + '回目' + (v.length >= 3 ? '・殿堂入り' : '') + '</button>';
}

function allTags() {
  var n = {}, label = {};
  var add = function(text) { extractTags(text).forEach(function(t) { var k = t.toLowerCase(); n[k] = (n[k] || 0) + 1; label[k] = label[k] || t; }); };
  store.list('log').forEach(function(l) { add(l.title + '\n' + l.memo); });
  store.list('memo').forEach(function(m) { add(m.title + '\n' + m.content); });
  return Object.keys(n).sort(function(a, b) { return n[b] - n[a]; }).map(function(k) { return { tag: label[k], n: n[k] }; });
}

RENDER.log = function() {
  var views = [['photo', '写真'], ['blog', 'ブログ'], ['card', 'カード'], ['table', '表'], ['map', '地図']];
  var active = [LV.cat, LV.sub, LV.rating, LV.author].filter(Boolean).length;
  $('main').innerHTML = '<div class="seg">' + views.map(function(v) { return '<button type="button" class="' + (LV.view === v[0] ? 'on' : '') + '" data-act="logView" data-v="' + v[0] + '">' + v[1] + '</button>'; }).join('') + '</div>' +
    '<div class="row"><input type="search" class="grow" placeholder="検索・#タグ" value="' + esc(LV.q) + '" data-input="logQ" aria-label="ログを検索"><button type="button" class="btn" data-act="logFilter" aria-expanded="' + LV.open + '">絞り込み' + (active ? ' ' + active : '') + '</button></div>' +
    '<div class="filters"' + (LV.open ? '' : ' hidden') + '>' +
      '<select data-change="logF" data-k="cat" aria-label="大分類">' + options([['', '大分類']].concat(Object.keys(cats())), LV.cat) + '</select>' +
      '<select data-change="logF" data-k="sub" aria-label="中分類">' + options([['', '中分類']].concat(catOf(LV.cat).sub), LV.sub) + '</select>' +
      '<select data-change="logF" data-k="rating" aria-label="評価">' + options([['', '評価'], ['5', '★5'], ['4', '★4'], ['3', '★3'], ['2', '★2'], ['1', '★1']], LV.rating) + '</select>' +
      '<select data-change="logF" data-k="author" aria-label="投稿者">' + options([['', '投稿者']].concat(names()), LV.author) + '</select>' +
      '<select data-change="logF" data-k="sort" aria-label="並べ替え">' + options([['new', '新しい順'], ['old', '古い順'], ['rate', '評価の高い順']], LV.sort) + '</select>' +
      '<button type="button" class="btn small" data-act="logClear">条件を消す</button></div>' +
    '<div class="chips" style="margin:6px 0 10px">' + allTags().slice(0, 12).map(function(t) { return '<button type="button" class="chip ' + (LV.q.toLowerCase() === t.tag.toLowerCase() ? 'on' : '') + '" data-act="tag" data-tag="' + esc(t.tag) + '">' + esc(t.tag) + '</button>'; }).join('') + '</div>' +
    '<div id="capsule"></div><div id="logList"></div>';
  RENDER.logList();
};
RENDER.logList = function() {
  renderCapsule();
  var box = $('logList'), l = filteredLogs(), ix = visitIndex();
  if (LV.map) { LV.map.remove(); LV.map = null; }
  if (LV.view === 'map') return renderLogMap(box, l);
  if (!l.length) { box.innerHTML = '<div class="empty">' + (store.list('log').length ? '条件に合う記録がありません' : '下の ＋ から最初の記録を追加できます') + '</div>'; return; }
  var page = l.slice(0, LV.shown), html = '';
  if (LV.view === 'photo') html = '<div class="pgrid">' + page.map(function(x) {
    var p = photosOf(x);
    return '<button type="button" class="pcell" data-act="logOpen" data-id="' + esc(x.id) + '">' + (p.length ? photoTag(p[0], 'thumb') : '<span class="nophoto">' + esc(String(x.memo || '').slice(0, 40)) + '</span>') + (p.length > 1 ? '<span class="cnt">' + p.length + '</span>' : '') + '<span class="cap">' + esc(x.title || '無題') + (x.rating ? '<br>★' + esc(x.rating) : '') + '</span></button>';
  }).join('') + '</div>';
  else if (LV.view === 'table') html = '<div class="tbl"><table><thead><tr><th>日付</th><th>タイトル</th><th>評価</th><th>分類</th><th>中分類</th><th>価格</th><th>投稿者</th></tr></thead><tbody>' + page.map(function(x) {
    return '<tr data-act="logOpen" data-id="' + esc(x.id) + '" tabindex="0"><td>' + esc(dateKey(x.timestamp).slice(0, 10)) + '</td><td>' + esc(x.title) + '</td><td>' + (x.rating ? '★' + esc(x.rating) : '-') + '</td><td>' + esc(x.category) + '</td><td>' + esc(x.subCategory || '-') + '</td><td>' + esc(x.price || '-') + '</td><td>' + esc(x.author) + '</td></tr>';
  }).join('') + '</tbody></table></div>';
  else html = page.map(function(x) { return LV.view === 'blog' ? blogCard(x, ix) : dataCard(x, ix); }).join('');
  box.innerHTML = html + (l.length > LV.shown ? '<button type="button" class="btn more" data-act="logMore">もっと見る（残り ' + (l.length - LV.shown) + '）</button>' : '');
  watchPhotos($('main'));
};
function headRow(x, ix) {
  return '<div class="row between"><span class="muted ell">' + esc(dateLabel(x.timestamp)) + '・' + esc(x.category) + (x.subCategory ? ' / ' + esc(x.subCategory) : '') + '</span><span class="muted">' + esc(x.author) + '</span></div><h2 class="tap" data-act="logOpen" data-id="' + esc(x.id) + '">' + esc(x.title || '無題') + '</h2><div class="row">' + stars(x.rating) + visitBadge(x, ix) + (x._pending ? '<span class="pill">未送信</span>' : '') + '</div>';
}
function blogCard(x, ix) {
  var p = photosOf(x);
  return '<article class="card" data-id="' + esc(x.id) + '">' + headRow(x, ix) + (p.length ? '<div class="blog-photos ' + (p.length === 1 ? 'one' : '') + '">' + p.map(function(f, i) { return '<div data-act="lightbox" data-i="' + i + '">' + photoTag(f, 'thumb') + '</div>'; }).join('') + '</div>' : '') + (x.memo ? '<div class="text clamp">' + richText(x.memo, p) + '</div>' : '') + (x.address ? '<div class="muted ell">' + esc(x.address) + '</div>' : '') + '</article>';
}
function dataCard(x, ix) {
  var p = photosOf(x);
  return '<article class="card" data-id="' + esc(x.id) + '"><div class="row"><div class="grow">' + headRow(x, ix) + (x.price ? '<div class="muted">' + esc(x.price) + '</div>' : '') + '</div>' + (radar(catOf(x.category).scores, scoresOf(x), 104) || (p.length ? '<div class="thumb">' + photoTag(p[0], 'thumb') + '</div>' : '')) + '</div></article>';
}

function renderLogMap(box, l) {
  var has = l.filter(function(x) { return x.lat && x.lng; }), lack = l.filter(function(x) { return !(x.lat && x.lng) && x.address; });
  box.innerHTML = '<div class="map" id="logMap"></div><p class="muted" style="margin-top:6px">場所のある記録 ' + has.length + ' 件。地図の画像は OpenStreetMap から取得します（表示した範囲が伝わります）。</p>' + (lack.length ? '<button type="button" class="btn small" data-act="fillGeo">住所だけの ' + lack.length + ' 件の位置を調べる</button>' : '');
  needLeaflet().then(function() {
    if (!$('logMap') || APP.tab !== 'log' || LV.view !== 'map') return;
    if (LV.map) LV.map.remove();
    LV.map = makeMap($('logMap'), [36.2, 137.8], 5);
    var b = [];
    has.forEach(function(x) {
      b.push([x.lat, x.lng]);
      L.marker([x.lat, x.lng], { icon: L.divIcon({ className: '', html: '<div class="mk"></div>', iconSize: [24, 24], iconAnchor: [12, 28] }) }).addTo(LV.map)
        .bindPopup('<b>' + esc(x.title) + '</b><br>' + esc(dateKey(x.timestamp).slice(0, 10)) + '<br><button type="button" data-act="logOpen" data-id="' + esc(x.id) + '">記録を見る</button>');
    });
    if (b.length) LV.map.fitBounds(b, { padding: [36, 36], maxZoom: 13 });
  }).catch(function(e) { box.insertAdjacentHTML('afterbegin', '<p class="empty">' + esc(e.message) + '</p>'); });
}
// 座標はサーバーで求めてシートに保存する（次からは求めない）
ACT.fillGeo = function(el) {
  var lack = filteredLogs().filter(function(x) { return !(x.lat && x.lng) && x.address; }).slice(0, 20), ok = 0;
  el.disabled = true;
  lack.reduce(function(p, x) {
    return p.then(function() { return callApi('geocode', { query: x.address }); }).then(function(g) { if (g.found) { ok++; store.patch('log', x.id, { lat: g.lat, lng: g.lng }); } });
  }, Promise.resolve()).then(function() { toast(ok + ' 件の位置が分かりました'); }, function(e) { toast(e.message); });
};

ACT.logView = function(el) { LV.view = el.dataset.v; LV.shown = 30; setPref('logView', LV.view); RENDER.log(); };
ACT.logFilter = function() { LV.open = !LV.open; RENDER.log(); };
ACT.logClear = function() { LV.cat = LV.sub = LV.rating = LV.author = LV.q = ''; LV.sort = 'new'; RENDER.log(); };
ACT.logMore = function() { LV.shown += 30; RENDER.logList(); };
INPUT.logQ = function(el) { LV.q = el.value.trim(); LV.shown = 30; RENDER.logList(); };
INPUT.logF = function(el) { LV[el.dataset.k] = el.value; if (el.dataset.k === 'cat') LV.sub = ''; LV.shown = 30; RENDER.log(); };
ACT.tag = function(el) { closeAllSheets(); if (APP.tab === 'memo') { MV.q = MV.q === el.dataset.tag ? '' : el.dataset.tag; RENDER.memo(); return; } LV.q = LV.q === el.dataset.tag ? '' : el.dataset.tag; LV.shown = 30; go('log'); };
ACT.lightbox = function(el) { var host = el.closest('[data-id]'), x = host && store.get('log', host.dataset.id); if (x) openLightbox(photosOf(x), Number(el.dataset.i)); };

// ---- 詳細 ----
ACT.logOpen = function(el) { openLog(el.dataset.id); };
function openLog(id) {
  var x = store.get('log', id);
  if (!x) return;
  var p = photosOf(x), labels = catOf(x.category).scores, r = radar(labels, scoresOf(x), 150);
  var q = [x.title, x.address].filter(Boolean).join(' ');
  openSheet(x.title || '無題', '<div data-id="' + esc(id) + '">' + headRow(x, visitIndex()) +
    (p.length ? '<div class="blog-photos ' + (p.length === 1 ? 'one' : '') + '">' + p.map(function(f, i) { return '<div data-act="lightbox" data-i="' + i + '">' + photoTag(f, 'thumb') + '</div>'; }).join('') + '</div>' : '') +
    (r ? '<div class="row">' + r + '<div class="muted">' + labels.map(function(t, i) { return esc(t) + ' ' + (scoresOf(x)[i] || '-'); }).join('<br>') + '</div></div>' : '') +
    (x.price ? '<p class="muted">' + esc(x.price) + '</p>' : '') + (x.memo ? '<div class="text" style="margin:8px 0">' + richText(x.memo, p) + '</div>' : '') +
    (x.address || x.lat ? '<p><a href="' + esc(mapUrl(x.address ? q : x.lat + ',' + x.lng)) + '" target="_blank" rel="noopener noreferrer">' + esc(x.address || '地図で見る') + '</a></p>' : '') +
    '<div class="form-foot"><button type="button" class="btn danger" data-act="logTrash">ゴミ箱へ</button><button type="button" class="btn primary" data-act="logEdit">編集</button></div></div>');
}
ACT.logTrash = function(el) { var id = el.closest('[data-id]').dataset.id; closeSheet(); trashItem('log', id); };
ACT.logEdit = function(el) { var id = el.closest('[data-id]').dataset.id; closeSheet(); openLogForm({ id: id }); };

ACT.visits = function(el) {
  var l = store.get('log', el.dataset.id), k = normKey(l.title), v = sortedLogs().filter(function(x) { return normKey(x.title) === k; }).reverse();
  var rated = v.filter(function(x) { return x.rating > 0; }), avg = rated.length ? (rated.reduce(function(s, x) { return s + x.rating; }, 0) / rated.length).toFixed(1) : '-';
  openSheet(l.title + ' の記録', '<p class="muted">' + v.length + ' 回・平均 ★' + avg + '（未評価を除く）</p><div class="trend">' + v.map(function(x, i) { return '<div>' + (x.rating ? '★' + esc(x.rating) : '-') + '<i class="' + (x.rating >= 4 ? 'hi' : '') + '" style="height:' + (x.rating ? Math.round(x.rating * 10) : 3) + 'px"></i>' + (i + 1) + '回目<br>' + esc(dateKey(x.timestamp).slice(2, 10).replace(/-/g, '/')) + '</div>'; }).join('') + '</div><div class="card list">' + v.slice().reverse().map(function(x) { return '<div class="item tap" data-act="logOpen" data-id="' + esc(x.id) + '"><div class="grow"><div>' + esc(dateLabel(x.timestamp)) + ' ' + stars(x.rating) + '</div><div class="muted ell">' + esc(x.memo) + '</div></div></div>'; }).join('') + '</div>');
};

// ---- タイムカプセル: 過去年の同じ頃 → 同じ季節の高評価 → 高評価 ----
function capsuleCandidates(logs, now) {
  var dated = logs.map(function(l) { return { l: l, d: toDate(l.timestamp) }; }).filter(function(x) { return x.d; }), y = now.getFullYear();
  var past = dated.filter(function(x) { return x.d.getFullYear() < y; });
  var near = past.filter(function(x) { return [y - 1, y, y + 1].some(function(yy) { return Math.abs(new Date(yy, x.d.getMonth(), x.d.getDate()) - now) / 864e5 <= 14; }) && (now - x.d) / 864e5 > 180; });
  if (near.length) return near.map(function(x) { return { label: Math.max(1, Math.round((now - x.d) / 864e5 / 365.25)) + '年前のこの頃', l: x.l }; });
  var season = past.filter(function(x) { var m = Math.abs(x.d.getMonth() - now.getMonth()); return (m <= 1 || m >= 11) && x.l.rating >= 4; });
  if (season.length) return season.map(function(x) { return { label: '同じ季節の高評価', l: x.l }; });
  return dated.filter(function(x) { return x.l.rating >= 4; }).map(function(x) { return { label: 'お気に入りの振り返り', l: x.l }; });
}
function renderCapsule() {
  var box = $('capsule'), c = LV.capsuleOff || LV.q ? [] : capsuleCandidates(sortedLogs(), new Date());
  if (!c.length) { box.innerHTML = ''; return; }
  var e = c[LV.capsule % c.length], p = photosOf(e.l);
  box.innerHTML = '<div class="card capsule row">' + (p.length ? '<div class="thumb">' + photoTag(p[0], 'thumb') + '</div>' : icon('clock')) + '<div class="grow tap" data-act="logOpen" data-id="' + esc(e.l.id) + '"><div class="muted">' + esc(e.label) + '・' + esc(dateKey(e.l.timestamp).slice(0, 10)) + '</div><div class="ell"><b>' + esc(e.l.title) + '</b></div></div>' + (c.length > 1 ? '<button type="button" class="btn small" data-act="capNext">次</button>' : '') + '<button type="button" class="icon-btn" data-act="capClose" aria-label="閉じる">' + icon('close') + '</button></div>';
  watchPhotos(box);
}
ACT.capNext = function() { LV.capsule++; renderCapsule(); };
ACT.capClose = function() { LV.capsuleOff = true; renderCapsule(); };

// ============================================================
// Mod_LogForm : ログの追加・編集（書きかけを端末に残す）
// ============================================================
var LF = null; // {id, isNew, original, v(値), urls, ids(送信済み), pend(未送信), drafts(今回足した写真)}

function readDraft() { try { return JSON.parse(lsGet(KEY_DRAFT)) || null; } catch (e) { return null; } }
// 別の書きかけがあるときに（気になるの「訪問した」などから）開いた場合は、元の書きかけに触らない
function saveDraft() {
  if (!LF || !LF.isNew || !LF.ownsDraft) return;
  var any = String(LF.v.title || LF.v.memo || '').trim() || LF.drafts.length;
  lsSet(KEY_DRAFT, any ? JSON.stringify({ v: LF.v, drafts: LF.drafts, wishId: LF.wishId || '' }) : '');
}
function clearDraft() { if (LF && LF.ownsDraft) lsSet(KEY_DRAFT, ''); }

// opt: {id} 編集 / {preset, wishId, photos} 追加
function openLogForm(opt) {
  opt = opt || {};
  if (opt.id) {
    var x = store.get('log', opt.id);
    if (!x) return;
    LF = { id: x.id, isNew: false, original: Object.assign({}, x), v: Object.assign({}, x, { timestamp: dateKey(x.timestamp) }), urls: splitList(x.photoUrls), ids: splitList(x.photoIds), pend: (pendingPhotos[x.id] || []).slice(), drafts: [], removed: [] };
  } else {
    var d = opt.preset ? null : readDraft();
    LF = { id: store.newId('log'), isNew: true, v: Object.assign({ title: '', timestamp: nowStamp(), category: prefs().lastCat || 'グルメ', subCategory: '', rating: 0, s1: null, s2: null, s3: null, s4: null, s5: null, price: '', memo: '', author: myName(), address: '', lat: null, lng: null }, (d && d.v) || opt.preset || {}), urls: [], ids: [], pend: [], drafts: (d && d.drafts) || opt.photos || [], removed: [], wishId: (d && d.wishId) || opt.wishId || '', ownsDraft: !opt.preset || !readDraft() };
    if (d) toast('書きかけの続きです');
  }
  openSheet(LF.isNew ? '記録を追加' : '記録を編集', '<form data-submit="log" class="form" id="logForm"></form>', { onClose: function() { saveDraft(); LF = null; } });
  drawLogForm();
}

function formPhotos() { return LF.urls.map(function(u) { return { kind: 'urls', key: u, p: { url: u } }; }).concat(LF.ids.map(function(i) { return { kind: 'ids', key: i, p: { id: i } }; }), LF.pend.map(function(i) { return { kind: 'pend', key: i, p: { id: i } }; }), LF.drafts.map(function(i) { return { kind: 'drafts', key: i, p: { id: i } }; })); }

function drawLogForm() {
  var v = LF.v, c = catOf(v.category), ph = formPhotos();
  $('logForm').innerHTML =
    '<label><span>タイトル・店名・作品名</span><input name="title" value="' + esc(v.title) + '" data-input="lf" required autocomplete="off"></label>' +
    '<div><span class="lbl">大分類</span><div class="chips wrap">' + Object.keys(cats()).concat(v.category && !cats()[v.category] ? [v.category] : []).map(function(k) { return '<button type="button" class="chip ' + (k === v.category ? 'on' : '') + '" data-act="lfCat" data-v="' + esc(k) + '">' + esc(k) + '</button>'; }).join('') + '</div></div>' +
    '<label class="half"><span>中分類</span><select name="subCategory" data-change="lf">' + options([['', '選択なし']].concat(c.sub), v.subCategory) + '</select></label>' +
    '<label class="half"><span>日時</span><input type="datetime-local" name="timestamp" value="' + esc(normDate(v.timestamp).replace(' ', 'T').slice(0, 16)) + '" data-input="lf"></label>' +
    '<div><span class="lbl">総合評価（もう一度押すと未評価）</span><div class="rate">' + [1, 2, 3, 4, 5].map(function(n) { return '<button type="button" class="' + (n <= (v.rating || 0) ? 'on' : '') + '" data-act="lfRate" data-v="' + n + '" aria-label="評価 ' + n + '">★</button>'; }).join('') + '</div></div>' +
    (c.scores.length ? '<div><span class="lbl">項目別（0 は未評価）</span>' + c.scores.map(function(t, i) { var s = v['s' + (i + 1)] || 0; return '<label class="score">' + esc(t) + '<input type="range" min="0" max="5" step="1" name="s' + (i + 1) + '" value="' + s + '" data-input="lf"><b>' + (s || '-') + '</b></label>'; }).join('') + '</div>' : '') +
    (c.prices.length ? '<label class="half"><span>' + (v.category === 'レシピ' ? '時間' : '価格帯') + '</span><select name="price" data-change="lf">' + options([['', '選択なし']].concat(c.prices), v.price) + '</select></label>' : '') +
    '<label class="half"><span>投稿者</span><select name="author" data-change="lf">' + options(names(), v.author) + '</select></label>' +
    '<div><span class="lbl">写真（位置情報は取り除いて保存します）</span><div class="fphotos">' + ph.map(function(f, i) { return '<div>' + photoTag(f.p, 'thumb') + '<button type="button" class="n" data-act="lfMark" data-n="' + (i + 1) + '" aria-label="本文に写真' + (i + 1) + 'を入れる">写真' + (i + 1) + '</button><button type="button" class="x" data-act="lfDel" data-kind="' + f.kind + '" data-key="' + esc(f.key) + '" aria-label="写真を外す">' + icon('close') + '</button></div>'; }).join('') + '<label>' + icon('camera') + '<input type="file" accept="image/*" multiple data-change="lfFile" aria-label="写真を選ぶ"></label></div></div>' +
    '<div><span class="lbl">場所</span><div class="row"><input name="address" value="' + esc(v.address) + '" data-input="lf" placeholder="住所・場所"><button type="button" class="btn small" data-act="lfGeo">調べる</button></div><div id="lfGps">' + gpsHint() + '</div></div>' +
    '<label><span>感想・メモ</span><textarea name="memo" rows="6" data-input="lf">' + esc(v.memo) + '</textarea></label>' +
    '<div class="chips wrap" id="lfTags">' + (v.category === 'レシピ' ? '<button type="button" class="chip" data-act="lfRecipe">レシピのひな形</button>' : '') + tagChips() + '</div>' +
    '<div class="form-foot">' + (LF.isNew ? '<button type="button" class="btn danger" data-act="lfDiscard">書きかけを消す</button>' : '') + '<button type="submit" class="btn primary">' + (LF.isNew ? '記録する' : '保存') + '</button></div>';
  watchPhotos($('logForm'));
}
function tagChips() {
  var m = String(LF.v.memo || ''), typing = (m.match(/#([^\s#]*)$/) || [])[1], has = extractTags(m).map(function(t) { return t.toLowerCase(); });
  return allTags().filter(function(t) { return typing ? t.tag.slice(1).toLowerCase().indexOf(typing.toLowerCase()) >= 0 : has.indexOf(t.tag.toLowerCase()) < 0; }).slice(0, 8).map(function(t) { return '<button type="button" class="chip" data-act="lfTag" data-tag="' + esc(t.tag) + '">' + esc(t.tag) + '</button>'; }).join('');
}
function gpsHint() {
  return LF.gps ? '<button type="button" class="chip" data-act="lfGps" style="margin-top:6px">写真の撮影場所を使う' + (LF.gps.address ? '：' + esc(LF.gps.address) : '') + '</button>' : LF.v.lat ? '<span class="muted">位置あり</span>' : '';
}

INPUT.lf = function(el) {
  var k = el.name, val = el.value;
  if (/^s\d$/.test(k)) { LF.v[k] = Number(val) || null; el.nextElementSibling.textContent = Number(val) || '-'; }
  else if (k === 'timestamp') LF.v[k] = normDate(val).slice(0, 16);
  else LF.v[k] = val;
  if (k === 'address') { LF.v.lat = LF.v.lng = null; $('lfGps').innerHTML = gpsHint(); } // 住所を書き換えたら、古い位置は使わない
  if (k === 'memo') { var t = $('lfTags'); t.innerHTML = (LF.v.category === 'レシピ' ? '<button type="button" class="chip" data-act="lfRecipe">レシピのひな形</button>' : '') + tagChips(); }
  saveDraft();
};
ACT.lfCat = function(el) { LF.v.category = el.dataset.v; if (catOf(el.dataset.v).sub.indexOf(LF.v.subCategory) < 0) LF.v.subCategory = ''; if (catOf(el.dataset.v).prices.indexOf(LF.v.price) < 0) LF.v.price = ''; saveDraft(); drawLogForm(); };
ACT.lfRate = function(el) { var n = Number(el.dataset.v); LF.v.rating = LF.v.rating === n ? 0 : n; document.querySelectorAll('#logForm .rate button').forEach(function(b, i) { b.classList.toggle('on', i < LF.v.rating); }); saveDraft(); };
function insertMemo(text, replace) {
  var ta = $('logForm').elements.memo, s = ta.selectionStart === undefined ? ta.value.length : ta.selectionStart, before = ta.value.slice(0, s), after = ta.value.slice(s);
  if (replace) before = before.replace(replace, '');
  ta.value = before + text + after;
  ta.focus(); ta.setSelectionRange((before + text).length, (before + text).length);
  INPUT.lf(ta);
}
ACT.lfTag = function(el) { var v = LF.v.memo || ''; insertMemo((v && !/[\s#]$/.test(v) && !/#[^\s#]*$/.test(v) ? ' ' : '') + el.dataset.tag + ' ', /#[^\s#]*$/); };
ACT.lfRecipe = function() { insertMemo((LF.v.memo ? '\n\n' : '') + RECIPE); };
ACT.lfMark = function(el) { insertMemo('[写真' + el.dataset.n + ']\n'); };
// 写真を外す。保存するまでは端末からも消さない（未保存の新しい写真だけは消す）
ACT.lfDel = function(el) {
  var kind = el.dataset.kind, key = el.dataset.key;
  LF[kind] = LF[kind].filter(function(x) { return x !== key; });
  if (kind === 'drafts') photoDel(key); else LF.removed.push({ kind: kind, key: key });
  saveDraft(); drawLogForm();
};
INPUT.lfFile = function(el) {
  var files = Array.from(el.files || []), me = LF, bad = 0;
  el.value = '';
  files.reduce(function(p, f) {
    return p.then(function() { return preparePhoto(f); }).then(function(r) {
      if (LF !== me) { photoDel(r.id); return; }
      me.drafts.push(r.id);
      if (r.gps && !me.gps) { me.gps = r.gps; if (canCall()) callApi('reverseGeocode', r.gps).then(function(g) { if (g.found && LF === me) { me.gps.address = g.address; $('lfGps').innerHTML = gpsHint(); } }).catch(function() {}); }
      saveDraft(); drawLogForm();
    }).catch(function() { bad++; });
  }, Promise.resolve()).then(function() { if (bad) toast(bad + ' 枚の写真を読み込めませんでした'); });
};
ACT.lfGps = function() { LF.v.lat = LF.gps.lat; LF.v.lng = LF.gps.lng; if (LF.gps.address) LF.v.address = LF.gps.address; LF.gps = null; saveDraft(); drawLogForm(); };
ACT.lfGeo = function(el) {
  var q = LF.v.address || LF.v.title, me = LF;
  if (!q) { toast('場所かタイトルを入力してください'); return; }
  el.disabled = true;
  callApi('geocode', { query: q }).then(function(g) {
    if (LF !== me) return;
    if (!g.found) { toast('場所が見つかりません'); return; }
    LF.v.address = g.address; LF.v.lat = g.lat; LF.v.lng = g.lng; saveDraft(); drawLogForm();
  }).catch(function(e) { toast(e.message); }).then(function() { el.disabled = false; });
};
ACT.lfDiscard = function() {
  var ids = LF.drafts.slice();
  LF.isNew = false; // 閉じるときに書き戻さない
  clearDraft(); closeSheet();
  ids.forEach(photoDel);
  toast('書きかけを消しました');
};

SUBMIT.log = function() {
  var f = LF, v = f.v, val = {};
  if (!String(v.title || '').trim()) { toast('タイトルを入力してください'); return; }
  ['title', 'timestamp', 'category', 'subCategory', 'rating', 's1', 's2', 's3', 's4', 's5', 'price', 'memo', 'author', 'address', 'lat', 'lng'].forEach(function(k) { val[k] = v[k]; });
  val.title = val.title.trim();
  if (!catOf(val.category).scores.length) val.s1 = val.s2 = val.s3 = val.s4 = val.s5 = null;
  if (!f.isNew && dateKey(f.original.timestamp) === val.timestamp) val.timestamp = f.original.timestamp;
  if (!f.isNew) {
    if ((f.original.rating || 0) === (val.rating || 0)) val.rating = f.original.rating;
    [1, 2, 3, 4, 5].forEach(function(n) { if ((f.original['s' + n] || 0) === (val['s' + n] || 0)) val['s' + n] = f.original['s' + n]; });
  }
  if (!f.isNew && f.removed.length) { val.photoUrls = f.urls.join(','); val.photoIds = f.ids.join(','); }
  setPref('lastCat', val.category);
  // 記録を先に端末へ置き、写真はその記録に結び付けて裏で送る
  if (f.isNew) store.add('log', val, f.id); else saveEdited('log', f.original, val);
  var drop = f.removed.filter(function(x) { return x.kind === 'pend'; }).map(function(x) { return photoDel(x.key); });
  attachPhotos(f.drafts, f.id).then(function() { return Promise.all(drop); }).then(refreshPending).then(function() { renderSoon(); return store.flush(); }).then(uploadPhotos);
  var gone = f.removed.filter(function(x) { return x.kind === 'ids'; }).map(function(x) { return x.key; });
  if (gone.length) store.raw('trashPhotos', { ids: gone });
  // 編集中に送信が済んでいた写真を外した場合
  var sent = f.removed.filter(function(x) { return x.kind === 'pend'; }).map(function(x) { return x.key; }), now = splitList((store.get('log', f.id) || {}).photoIds);
  if (now.some(function(i) { return sent.indexOf(i) >= 0; })) store.patch('log', f.id, { photoIds: now.filter(function(i) { return sent.indexOf(i) < 0; }).join(',') });
  if (f.wishId) store.patch('wish', f.wishId, { status: '訪問済' });
  f.isNew = false;
  clearDraft(); closeSheet();
  toast('保存しました');
};

// ============================================================
// Mod_Plan : 目標・連休・月のまとめ / 気になる / やりたいこと100
// ============================================================
var PV = { sub: 'dash', date: new Date(), wStatus: 'active', wCat: '', wAuthor: '', bSort: 'num', bCat: '', bStatus: 'all' };

function pairLikes(type, x) {
  var me = store.st.server.me;
  return [1, 2].map(function(n) {
    var on = isLiked(x['like' + n]);
    return '<button type="button" class="like ' + (on ? 'on' : '') + '" data-act="like" data-type="' + type + '" data-id="' + esc(x.id) + '" data-n="' + n + '" aria-pressed="' + on + '"' + (me && me.n !== n ? ' disabled' : '') + '>' + icon('heart') + esc(names()[n - 1]) + '</button>';
  }).join('');
}
// 自分の分の 1 項目だけを送る
ACT.like = function(el) {
  var me = store.st.server.me, n = Number(el.dataset.n), x = store.get(el.dataset.type, el.dataset.id), k = 'like' + n, set = {};
  if (!me) { toast('一度接続すると押せるようになります'); return; }
  if (me.n !== n) return;
  set[k] = isLiked(x[k]) ? '' : 'true';
  store.patch(el.dataset.type, x.id, set);
};

RENDER.plan = function() {
  $('main').innerHTML = '<div class="seg">' + [['dash', '目標・連休'], ['wish', '気になる'], ['bucket', 'やりたいこと']].map(function(t) { return '<button type="button" class="' + (PV.sub === t[0] ? 'on' : '') + '" data-act="planSub" data-v="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div><div id="planBox"></div>';
  $('planBox').innerHTML = PV.sub === 'dash' ? planDash() : PV.sub === 'wish' ? planWish() : planBucket();
};
ACT.planSub = function(el) { PV.sub = el.dataset.v; RENDER.plan(); };
INPUT.planF = function(el) { PV[el.dataset.k] = el.value; RENDER.plan(); };

function goalYm(s) { var m = normDate(s).match(/^(\d{4})(?:-(\d{1,2}))?/); return m ? m[1] + (m[2] ? '-' + pad2(m[2]) : '') : ''; }
function goalRows(l, empty) {
  return '<div class="card list">' + (l.map(function(g) {
    var d = isDone(g.status);
    return '<div class="item"><button type="button" class="ck ' + (d ? 'on' : '') + '" data-act="goalDone" data-id="' + esc(g.id) + '" aria-label="達成" aria-pressed="' + d + '">' + icon('check') + '</button><div class="grow tap" data-act="goalEdit" data-id="' + esc(g.id) + '"><div class="' + (d ? 'done-t' : '') + '">' + esc(g.title) + '</div>' + (g.memo ? '<div class="muted ell">' + esc(g.memo) + '</div>' : '') + '</div><span class="pill">' + esc(g.owner) + '</span></div>';
  }).join('') || '<p class="muted" style="padding:10px 0">' + empty + '</p>') + '</div>';
}
function planDash() {
  var d = PV.date, cur = ym(d), y = cur.slice(0, 4), goals = store.list('goal');
  var logs = store.list('log').filter(function(l) { return dateKey(l.timestamp).slice(0, 7) === cur; }), rated = logs.filter(function(l) { return l.rating > 0; }), n = {};
  logs.forEach(function(l) { n[l.category] = (n[l.category] || 0) + 1; });
  var top = Object.keys(n).sort(function(a, b) { return n[b] - n[a]; })[0] || '-';
  var today = ymd(new Date()), hols = store.list('holiday').slice().sort(function(a, b) { return (a.startDate || '9') < (b.startDate || '9') ? -1 : 1; });
  var up = hols.filter(function(h) { return !h.endDate && !h.startDate || dateKey(h.endDate || h.startDate).slice(0, 10) >= today; }), past = hols.filter(function(h) { return up.indexOf(h) < 0; }).reverse();
  var hol = function(h) {
    var s = toDate(h.startDate), days = s ? Math.ceil((s - new Date()) / 864e5) : null;
    return '<div class="card tap" data-act="holEdit" data-id="' + esc(h.id) + '"><div class="row between"><h3>' + esc(h.name) + '</h3><span class="pill">' + esc(h.status) + '</span></div><div class="muted">' + esc(h.startDate) + (h.endDate ? ' 〜 ' + esc(h.endDate) : '') + (days > 0 ? '（あと ' + days + ' 日）' : '') + '</div>' + [h.destination, h.mainPlan, h.budget].filter(Boolean).map(function(t) { return '<div class="text">' + esc(t) + '</div>'; }).join('') + '</div>';
  };
  return '<div class="section"><button type="button" class="icon-btn" data-act="planMonth" data-v="-1" aria-label="前の月">' + icon('left') + '</button><h2>' + d.getFullYear() + '年' + (d.getMonth() + 1) + '月</h2><button type="button" class="icon-btn" data-act="planMonth" data-v="1" aria-label="次の月">' + icon('right') + '</button></div>' +
    '<div class="card kpi"><div><b>' + logs.length + '</b><span class="muted">記録</span></div><div><b>' + (rated.length ? (rated.reduce(function(s, l) { return s + l.rating; }, 0) / rated.length).toFixed(1) : '-') + '</b><span class="muted">平均評価</span></div><div><b class="ell">' + esc(top) + '</b><span class="muted">いちばん多い</span></div></div>' +
    '<div class="section"><h3>今月の目標</h3><button type="button" class="btn small" data-act="goalAdd" data-v="月間">追加</button></div>' + goalRows(goals.filter(function(g) { return g.periodType !== '年間' && goalYm(g.targetYm) === cur; }), 'この月の目標はまだありません') +
    '<div class="section"><h3>' + y + '年の目標</h3><button type="button" class="btn small" data-act="goalAdd" data-v="年間">追加</button></div>' + goalRows(goals.filter(function(g) { return g.periodType === '年間' && goalYm(g.targetYm).slice(0, 4) === y; }), '年間の目標はまだありません') +
    '<div class="section"><h3>連休・長期休み</h3><button type="button" class="btn small" data-act="holEdit">追加</button></div>' + (up.map(hol).join('') || '<p class="muted">これからの予定はありません</p>') + (past.length ? '<details><summary class="muted">過去の連休 ' + past.length + ' 件</summary>' + past.map(hol).join('') + '</details>' : '');
}
ACT.planMonth = function(el) { PV.date = new Date(PV.date.getFullYear(), PV.date.getMonth() + Number(el.dataset.v), 1); RENDER.plan(); };
ACT.goalDone = function(el) { var g = store.get('goal', el.dataset.id), d = !isDone(g.status); store.patch('goal', g.id, { status: d ? '達成' : '未達成', progress: d ? 100 : 0 }); };
function goalForm(g, period) {
  var fields = [
    { k: 'title', label: '目標', required: true }, { k: 'periodType', label: '期間', type: 'select', options: ['月間', '年間'], half: true }, { k: 'targetYm', label: '対象（2026-11 / 2026）', half: true, required: true },
    { k: 'owner', label: '担当', type: 'select', options: ['ふたり共通'].concat(names()), half: true }, { k: 'category', label: 'カテゴリ', type: 'select', options: GOAL_CATS, half: true },
    { k: 'status', label: '状態', type: 'select', options: ['未達成', '達成'], half: true }, { k: 'memo', label: 'メモ', type: 'textarea' }];
  var v = g || { periodType: period, targetYm: period === '年間' ? ym(PV.date).slice(0, 4) : ym(PV.date), owner: 'ふたり共通', category: GOAL_CATS[0], status: '未達成' };
  openForm({ title: g ? '目標を編集' : period + '目標を追加', fields: fields, values: v, onDelete: g ? function() { trashItem('goal', g.id, '目標'); } : null, onSave: function(val) {
    val.targetYm = goalYm(val.targetYm);
    if (val.periodType === '年間') val.targetYm = val.targetYm.slice(0, 4);
    else if (val.targetYm.length < 7) { toast('対象は 2026-11 の形で入力してください'); return false; }
    if (!g || isDone(val.status) !== isDone(g.status)) val.progress = isDone(val.status) ? 100 : 0;
    if (g) saveEdited('goal', g, val); else store.add('goal', val);
  } });
}
ACT.goalAdd = function(el) { goalForm(null, el.dataset.v); };
ACT.goalEdit = function(el) { goalForm(store.get('goal', el.dataset.id)); };
ACT.holEdit = function(el) {
  var h = el.dataset.id ? store.get('holiday', el.dataset.id) : null;
  openForm({ title: h ? '連休を編集' : '連休を追加', values: h || { status: HOL_STATUS[0] }, fields: [{ k: 'name', label: '連休名', required: true }, { k: 'startDate', label: '開始', type: 'date', half: true }, { k: 'endDate', label: '終了', type: 'date', half: true }, { k: 'status', label: '状態', type: 'select', options: HOL_STATUS, half: true }, { k: 'budget', label: '予算目安', half: true }, { k: 'destination', label: '行き先' }, { k: 'mainPlan', label: 'メインの予定', type: 'textarea' }, { k: 'memo', label: 'メモ', type: 'textarea' }],
    onDelete: h ? function() { trashItem('holiday', h.id, '連休'); } : null, onSave: function(val) {
      if (val.startDate && val.endDate && val.endDate < val.startDate) { toast('終了日が開始日より前です'); return false; }
      if (h) saveEdited('holiday', h, val); else store.add('holiday', val);
    } });
};

// ---- 気になる ----
function planWish() {
  var l = store.list('wish').filter(function(w) {
    if (PV.wStatus === 'active' && isVisited(w.status)) return false;
    if (PV.wStatus === 'both' && (isVisited(w.status) || !isLiked(w.like1) || !isLiked(w.like2))) return false;
    return (!PV.wCat || w.category === PV.wCat) && (!PV.wAuthor || w.author === PV.wAuthor);
  }).sort(function(a, b) { return String(b.regDate).localeCompare(String(a.regDate)); });
  return '<div class="filters"><select data-change="planF" data-k="wStatus" aria-label="状態">' + options([['active', '未訪問'], ['both', '両方いいね'], ['all', '訪問済も含む']], PV.wStatus) + '</select><select data-change="planF" data-k="wCat" aria-label="大分類">' + options([['', '大分類']].concat(Object.keys(cats())), PV.wCat) + '</select><select data-change="planF" data-k="wAuthor" aria-label="登録者">' + options([['', '登録者']].concat(names()), PV.wAuthor) + '</select><button type="button" class="btn small" data-act="wishEdit">追加</button></div>' +
    (l.map(function(w) {
      return '<div class="card"><div class="row between"><span class="muted ell">' + esc(w.category) + (w.subCategory ? ' / ' + esc(w.subCategory) : '') + '・' + esc(w.author) + '</span>' + (isLiked(w.like1) && isLiked(w.like2) ? '<span class="pill red">両方いいね</span>' : '') + (isVisited(w.status) ? '<span class="pill green">訪問済</span>' : '') + '</div><h3 class="tap" data-act="wishEdit" data-id="' + esc(w.id) + '">' + esc(w.title) + '</h3>' + (w.memo ? '<div class="text clamp">' + richText(w.memo) + '</div>' : '') + (safeUrl(w.url) ? '<a class="muted" href="' + esc(safeUrl(w.url)) + '" target="_blank" rel="noopener noreferrer">' + esc(domainOf(w.url)) + '</a>' : '') + '<div class="row" style="margin-top:6px;flex-wrap:wrap">' + pairLikes('wish', w) + (isVisited(w.status) ? '' : '<button type="button" class="btn small" data-act="wishLog" data-id="' + esc(w.id) + '">訪問した</button>') + '</div></div>';
    }).join('') || '<div class="empty">当てはまるものがありません</div>');
}
function wishForm(w, preset) {
  var v = w || Object.assign({ type: 'お店・スポット', category: 'グルメ', author: myName(), status: '気になる' }, preset || {});
  var el = openForm({ title: w ? '気になるを編集' : '気になるを追加', values: v, fields: [{ k: 'title', label: 'タイトル', required: true }, { k: 'category', label: '大分類', type: 'select', options: Object.keys(cats()), half: true, change: 'wishCat' }, { k: 'subCategory', label: '中分類', type: 'select', options: [['', '選択なし']].concat(catOf(v.category).sub), half: true }, { k: 'url', label: '参考URL', type: 'text' }, { k: 'author', label: '登録者', type: 'select', options: names(), half: true }, { k: 'status', label: '状態', type: 'select', options: ['気になる', '訪問済'], half: true }, { k: 'memo', label: 'メモ', type: 'textarea' }],
    onDelete: w ? function() { trashItem('wish', w.id, '気になる'); } : null, onSave: function(val) {
      if (w) saveEdited('wish', w, val); else {
        var me = store.st.server.me; val.type = v.type; val.regDate = ymd(new Date());
        if (me) val['like' + me.n] = 'true';
        store.add('wish', val);
      }
      toast('保存しました');
    } });
  return el;
}
INPUT.wishCat = function(el) { el.form.elements.subCategory.innerHTML = options([['', '選択なし']].concat(catOf(el.value).sub), ''); };
ACT.wishEdit = function(el) { wishForm(el.dataset.id ? store.get('wish', el.dataset.id) : null); };
// 「訪問済」にするのは、ログを保存できたとき（途中でやめても状態が変わらない）
ACT.wishLog = function(el) {
  var w = store.get('wish', el.dataset.id);
  go('log');
  openLogForm({ preset: { title: w.title, category: cats()[w.category] ? w.category : 'グルメ', subCategory: w.subCategory || '', memo: [w.memo, w.url].filter(Boolean).join('\n') }, wishId: w.id });
};

// ---- やりたいこと100 ----
function planBucket() {
  var all = store.list('bucket'), done = all.filter(function(b) { return isDone(b.status); }).length, when = whenOptions();
  var l = all.filter(function(b) { return (!PV.bCat || b.category === PV.bCat) && (PV.bStatus === 'all' || isDone(b.status) === (PV.bStatus === 'done')); });
  l.sort(function(a, b) {
    var r = 0;
    if (PV.bSort === 'category') r = String(a.category).localeCompare(String(b.category), 'ja');
    if (PV.bSort === 'when') r = (when.indexOf(a.when || '') + 1 || 99) % 99 - (when.indexOf(b.when || '') + 1 || 99) % 99 || String(a.when).localeCompare(String(b.when), 'ja');
    return r || (a.num || 999) - (b.num || 999);
  });
  return '<div class="card"><div class="row between"><b>' + done + ' / ' + all.length + ' 達成</b><button type="button" class="btn small" data-act="bucketEdit">追加</button></div><div class="bar" style="margin-top:8px"><i style="width:' + (all.length ? Math.round(done / all.length * 100) : 0) + '%"></i></div></div><div class="filters"><select data-change="planF" data-k="bSort" aria-label="並べ替え">' + options([['num', '番号順'], ['category', 'カテゴリ別'], ['when', '時期順']], PV.bSort) + '</select><select data-change="planF" data-k="bCat" aria-label="カテゴリ">' + options([['', '全カテゴリ']].concat(BUCKET_CATS), PV.bCat) + '</select><select data-change="planF" data-k="bStatus" aria-label="状態">' + options([['all', 'すべて'], ['active', '未達成'], ['done', '達成済']], PV.bStatus) + '</select></div>' +
    (l.length ? '<div class="card list">' + l.map(function(b) {
      var d = isDone(b.status);
      return '<div class="item" style="flex-wrap:wrap"><button type="button" class="ck ' + (d ? 'on' : '') + '" data-act="bucketDone" data-id="' + esc(b.id) + '" aria-label="達成" aria-pressed="' + d + '">' + icon('check') + '</button><div class="grow tap" data-act="bucketEdit" data-id="' + esc(b.id) + '"><div class="' + (d ? 'done-t' : '') + '"><span class="muted">' + esc(b.num || '') + '</span> ' + esc(b.title) + '</div><div class="muted">' + [b.category, b.when, d && b.doneDate ? '達成 ' + b.doneDate : ''].filter(Boolean).map(esc).join('・') + '</div></div><div class="row">' + pairLikes('bucket', b) + '</div></div>';
    }).join('') + '</div>' : '<div class="empty">当てはまるものがありません</div>');
}
ACT.bucketDone = function(el) { var b = store.get('bucket', el.dataset.id), d = !isDone(b.status); store.patch('bucket', b.id, { status: d ? '達成済' : '未達成', doneDate: d ? ymd(new Date()) : '' }); };
ACT.bucketEdit = function(el) {
  var b = el.dataset.id ? store.get('bucket', el.dataset.id) : null, used = {}, n = 1;
  store.list('bucket').forEach(function(x) { used[x.num] = true; });
  while (used[n]) n++;
  openForm({ title: b ? 'やりたいことを編集' : 'やりたいことを追加', values: b || { num: n, category: BUCKET_CATS[0], proposer: 'ふたり', status: '未達成' }, fields: [{ k: 'title', label: 'やりたいこと', required: true }, { k: 'num', label: '番号', type: 'number', half: true }, { k: 'category', label: 'カテゴリ', type: 'select', options: BUCKET_CATS, half: true }, { k: 'proposer', label: '提案者', type: 'select', options: ['ふたり'].concat(names()), half: true }, { k: 'when', label: '時期目安', type: 'select', options: whenOptions().map(function(w) { return [w, w || '未定']; }), half: true }, { k: 'status', label: '状態', type: 'select', options: ['未達成', '達成済'], half: true }, { k: 'doneDate', label: '達成日', type: 'date', half: true }, { k: 'memo', label: 'メモ', type: 'textarea' }],
    onDelete: b ? function() { trashItem('bucket', b.id, 'やりたいこと'); } : null, onSave: function(val) {
      val.num = Number(val.num) || null;
      if (b) saveEdited('bucket', b, val); else store.add('bucket', val);
    } });
};

// ============================================================
// Mod_Memo : ナレッジ・Web クリップ
// ============================================================
var MV = { q: '', cat: '', author: '', pin: false, shown: 40 };

RENDER.memo = function() {
  var n = {};
  store.list('memo').forEach(function(m) { extractTags(m.title + '\n' + m.content).forEach(function(t) { n[t] = (n[t] || 0) + 1; }); });
  $('main').innerHTML = '<div class="row"><input type="search" class="grow" placeholder="メモを検索・#タグ" value="' + esc(MV.q) + '" data-input="memoQ" aria-label="メモを検索"><button type="button" class="btn" data-act="memoEdit">追加</button></div><div class="filters"><select data-change="memoF" data-k="cat" aria-label="カテゴリ">' + options([['', '全カテゴリ']].concat(MEMO_CATS), MV.cat) + '</select><select data-change="memoF" data-k="author" aria-label="投稿者">' + options([['', '全投稿者']].concat(names()), MV.author) + '</select></div><div class="chips" style="margin-bottom:8px"><button type="button" class="chip ' + (MV.pin ? 'on' : '') + '" data-act="memoPinF">ピン留め</button>' + Object.keys(n).sort(function(a, b) { return n[b] - n[a]; }).slice(0, 12).map(function(t) { return '<button type="button" class="chip ' + (MV.q === t ? 'on' : '') + '" data-act="tag" data-tag="' + esc(t) + '">' + esc(t) + '</button>'; }).join('') + '</div><div id="memoList"></div>';
  RENDER.memoList();
};
RENDER.memoList = function() {
  var l = store.list('memo').filter(function(m) {
    return (!MV.cat || m.category === MV.cat) && (!MV.author || m.author === MV.author) && (!MV.pin || m.pinned) && (!MV.q || matches([m.title, m.content, m.url, m.category, m.author].join(' '), MV.q));
  }).sort(function(a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || dateKey(b.editedAt || b.createdAt).localeCompare(dateKey(a.editedAt || a.createdAt)); });
  $('memoList').innerHTML = l.slice(0, MV.shown).map(function(m) {
    var id = esc(m.id);
    return '<article class="card"><div class="row between"><span class="muted ell">' + esc(m.category) + '・' + esc(m.author) + '・' + esc(String(m.editedAt || m.createdAt || '').slice(0, 10)) + '</span><button type="button" class="icon-btn" data-act="memoPin" data-id="' + id + '" aria-label="ピン留め" aria-pressed="' + !!m.pinned + '" style="color:' + (m.pinned ? 'var(--gold-d)' : 'var(--line2)') + '">' + icon('pin') + '</button></div><h3 class="tap" data-act="memoEdit" data-id="' + id + '">' + esc(m.title || domainOf(m.url) || '無題') + '</h3>' + (m.content ? '<div class="text clamp">' + richText(m.content) + '</div>' : '') + (safeUrl(m.url) ? '<a class="muted" href="' + esc(safeUrl(m.url)) + '" target="_blank" rel="noopener noreferrer">' + esc(domainOf(m.url)) + '</a>' : '') + '<div class="row" style="margin-top:8px"><button type="button" class="btn small" data-act="memoWish" data-id="' + id + '">気になるへ</button><button type="button" class="btn small" data-act="memoLog" data-id="' + id + '">ログへ</button></div></article>';
  }).join('') + (l.length > MV.shown ? '<button type="button" class="btn more" data-act="memoMore">もっと見る</button>' : '') || '<div class="empty">メモがありません</div>';
};
INPUT.memoQ = function(el) { MV.q = el.value.trim(); RENDER.memoList(); };
INPUT.memoF = function(el) { MV[el.dataset.k] = el.value; RENDER.memo(); };
ACT.memoPinF = function() { MV.pin = !MV.pin; RENDER.memo(); };
ACT.memoMore = function() { MV.shown += 40; RENDER.memoList(); };
ACT.memoPin = function(el) { var m = store.get('memo', el.dataset.id); store.patch('memo', m.id, { pinned: m.pinned ? '' : 'true' }); };
ACT.memoWish = function(el) { var m = store.get('memo', el.dataset.id); wishForm(null, { title: m.title || domainOf(m.url), url: m.url, memo: m.content }); };
ACT.memoLog = function(el) { var m = store.get('memo', el.dataset.id); openLogForm({ preset: { title: m.title || domainOf(m.url), memo: [m.content, m.url].filter(Boolean).join('\n') } }); };
ACT.memoEdit = function(el) { memoForm(el.dataset.id ? store.get('memo', el.dataset.id) : null); };

function memoForm(m, preset) {
  openForm({ title: m ? 'メモを編集' : 'メモを追加', values: m || Object.assign({ category: MEMO_CATS[0], author: myName() }, preset || {}), fields: [{ k: 'title', label: 'タイトル' }, { k: 'content', label: '本文（#タグ が使えます）', type: 'textarea' }, { k: 'url', label: 'URL' }, { k: 'category', label: 'カテゴリ', type: 'select', options: MEMO_CATS, half: true }, { k: 'author', label: '投稿者', type: 'select', options: names(), half: true }],
    extra: '<button type="button" class="btn small" data-act="fetchMeta">URL から題名を取得</button>', onDelete: m ? function() { trashItem('memo', m.id, 'メモ'); } : null, onSave: function(val) {
      if (!val.title && !val.content && !val.url) { toast('内容を入力してください'); return false; }
      if (m) saveEdited('memo', m, val); else { val.createdAt = nowStamp(); store.add('memo', val); }
      toast('保存しました');
    } });
}
// サーバー経由で題名を取る。待っている間に書き換えた欄は上書きしない
ACT.fetchMeta = function(el) {
  var f = el.form, url = safeUrl(f.elements.url.value);
  if (!/^https:/i.test(url)) { toast('https の URL を入力してください'); return; }
  el.disabled = true;
  callApi('fetchWebMetadata', { url: url }).then(function(r) {
    var body = f.elements.content || f.elements.memo;
    if (r.title && !f.elements.title.value) f.elements.title.value = r.title;
    if (r.description && body && !body.value) body.value = r.description;
    if (!r.title) toast('題名が見つかりません');
  }).catch(function(e) { toast(e.message); }).then(function() { el.disabled = false; });
};

// ============================================================
// Mod_Out : おでかけ（スタンプ帳・道路・記念カード・お気に入り）。ふたりで共有する
// ============================================================
var OV = { sub: 'stamp', cat: 'castle', region: '', status: '', q: '', shown: 40, map: null, mapOn: false };
var HYAKU = null, hyakuLoading = false;

function byLine(o) { return o && o.by ? esc(o.by) + (o.updatedAt ? '・' + esc(o.updatedAt.slice(0, 10)) : '') : ''; }

RENDER.out = function() {
  if (OV.map) { OV.map.remove(); OV.map = null; }
  $('main').innerHTML = '<div class="seg">' + [['stamp', 'スタンプ'], ['road', '道路'], ['card', 'カード'], ['fav', 'お気に入り']].map(function(t) { return '<button type="button" class="' + (OV.sub === t[0] ? 'on' : '') + '" data-act="outSub" data-v="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div><div id="outBox"></div>';
  ({ stamp: outStamp, road: outRoad, card: outCard, fav: outFav })[OV.sub]();
};
RENDER.outList = function() { if (OV.sub === 'road') drawRoads(); };
ACT.outSub = function(el) { OV.sub = el.dataset.v; OV.shown = 40; RENDER.out(); };

// ---- スタンプ帳 ----
// 手で押した記録を優先し、無ければログの文章から見つける（見つけた結果は保存せず、毎回ログから数える）
function stampStates() {
  var saved = store.col('stamp'), out = {};
  var logs = sortedLogs().reverse().map(function(l) { return { t: [l.title, l.memo, l.address].join(' ').normalize('NFKC').toLowerCase(), d: dateKey(l.timestamp).slice(0, 10), a: l.author }; });
  STAMP_SPOTS.forEach(function(s) {
    var o = saved[s.id];
    if (o) { if (!o.value.off) out[s.id] = { date: o.value.date, by: o.by, auto: !!o.value.auto }; return; }
    var name = s.name.split('（')[0].normalize('NFKC').toLowerCase(), hit = name.length >= 3 && logs.filter(function(l) { return l.t.indexOf(name) >= 0; })[0];
    if (hit) out[s.id] = { date: hit.d, by: hit.a, auto: true };
  });
  return out;
}
function stampTitle(cat, n) { var t = ''; cat.steps.forEach(function(s, i) { if (n >= s) t = cat.ranks[Math.min(i, cat.ranks.length - 1)]; }); return t; }
function outStamp() {
  var st = stampStates(), cat = STAMP_CATS[OV.cat], spots = STAMP_SPOTS.filter(function(s) { return s.cat === OV.cat; }), n = spots.filter(function(s) { return st[s.id]; }).length, total = Object.keys(st).length;
  $('outBox').innerHTML = '<div class="chips" style="margin-bottom:10px">' + Object.keys(STAMP_CATS).map(function(k) { return '<button type="button" class="chip ' + (k === OV.cat ? 'on' : '') + '" data-act="stampCat" data-v="' + k + '">' + esc(STAMP_CATS[k].name) + '</button>'; }).join('') + '</div><div class="card"><div class="row between"><b>' + esc(stampTitle(cat, n) || '称号はこれから') + '</b><span class="muted">' + n + ' / ' + spots.length + '（全体 ' + total + ' / ' + STAMP_SPOTS.length + '）</span></div></div>' +
    spots.map(function(s) {
      var v = st[s.id];
      return '<div class="card stamp ' + (v ? 'on' : '') + '"><button type="button" class="seal" data-act="stamp" data-id="' + s.id + '" aria-pressed="' + !!v + '" aria-label="' + esc(s.name) + ' を訪問済みにする">' + icon('check') + '</button><div class="grow"><div class="muted">' + esc(s.pref) + (v ? '・' + (v.auto ? 'ログから ' : '') + esc([v.date, v.by].filter(Boolean).join(' ')) : '') + '</div><b>' + esc(s.name) + '</b><div class="muted">' + esc(s.desc) + '</div><a class="muted" href="' + esc(mapUrl(s.name + ' ' + s.pref)) + '" target="_blank" rel="noopener noreferrer">地図</a></div></div>';
    }).join('');
}
ACT.stampCat = function(el) { OV.cat = el.dataset.v; RENDER.out(); };
ACT.stamp = function(el) {
  var id = el.dataset.id, on = stampStates()[id], prev = store.col('stamp')[id], back = prev ? prev.value : null;
  store.setCol('stamp', id, on ? { off: true } : { date: ymd(new Date()) });
  toast(on ? '取り消しました' : 'スタンプを押しました', function() { store.setCol('stamp', id, back); });
};

// ---- 道路（百名道） ----
function roads() {
  return (HYAKU || []).map(function(h) { return { id: 'hyaku_' + h[0], no: h[0], name: h[1], region: h[2], prefs: h[3].split('・'), rank: h[4], feature: h[5], from: h[6], to: h[7], desc: h[8], section: h[3] + '（' + h[5] + '）' }; });
}
function roadStatus(id) { var o = store.col('road')[id]; return o ? o.value.status : ''; }
function loadHyaku() {
  if (HYAKU || hyakuLoading) return;
  hyakuLoading = true;
  kvGet('hyaku').catch(function() { return null; }).then(function(v) { return v || callApi('getRoadData', {}).then(function(r) { kvSet('hyaku', r.hyaku).catch(function() {}); return r.hyaku; }); })
    .then(function(h) { HYAKU = h; }).catch(function() {}).then(function() { hyakuLoading = false; if (APP.tab !== 'out' || OV.sub !== 'road') return; if (HYAKU) RENDER.out(); else drawRoads(); });
}
function outRoad() {
  loadHyaku();
  var regs = ['北海道', '東北', '関東', '中部', '関西', '中国', '四国', '九州'], c = store.col('road'), done = Object.keys(c).filter(function(k) { return k.indexOf('hyaku_') === 0 && c[k].value.status === 'done'; }).length;
  $('outBox').innerHTML = '<div class="card"><div class="row between"><b>百名道 ' + done + ' / 100 走破</b></div><div class="bar" style="margin-top:8px"><i style="width:' + done + '%"></i></div></div><div class="filters"><select data-change="roadF" data-k="status" aria-label="状態">' + options([['', 'すべて'], ['done', '走破済み'], ['want', '走りたい'], ['none', '未走破']], OV.status) + '</select><select data-change="roadF" data-k="region" aria-label="地方">' + options([['', '全国']].concat(regs), OV.region) + '</select><input type="search" style="grid-column:1/-1" placeholder="番号・名前・県" value="' + esc(OV.q) + '" data-input="roadQ" aria-label="道路を検索"></div>' + '<button type="button" class="btn small" data-act="roadMap" style="margin-bottom:8px">' + (OV.mapOn ? '地図を閉じる' : '地図で見る') + '</button>' + (OV.mapOn ? '<div class="map" id="roadMap" style="margin-bottom:10px"></div><p class="muted">点は起点、点線は起点と終点を結んだ目安です（実際の道の形ではありません）。</p>' : '') + '<div id="roadList"></div>';
  drawRoads();
  if (OV.mapOn) drawRoadMap();
}
function filteredRoads() {
  return roads().filter(function(r) {
    var s = roadStatus(r.id);
    if (OV.region && r.region !== OV.region) return false;
    if (OV.status && (OV.status === 'none' ? s : s !== OV.status)) return false;
    if (/^\d+$/.test(OV.q)) return String(r.no) === OV.q || String(r.no).indexOf(OV.q) === 0;
    return !OV.q || matches([r.name, r.section, r.prefs.join(' ')].join(' '), OV.q);
  });
}
function sign(r, s) {
  var f = s === 'done' ? 'var(--gold-d)' : s === 'want' ? 'var(--red)' : 'var(--green)';
  return '<svg class="sign" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15" fill="' + f + '"/><text x="18" y="22" text-anchor="middle" fill="#fff" font-size="12" font-weight="800">' + r.no + '</text></svg>';
}
function drawRoads() {
  var box = $('roadList'); if (!box) return;
  if (!HYAKU) { box.innerHTML = '<div class="empty">' + (hyakuLoading ? '読み込み中です' : '百名道の一覧は、一度接続すると表示できます') + '</div>'; return; }
  var l = filteredRoads();
  box.innerHTML = (l.length ? '<div class="card list">' + l.slice(0, OV.shown).map(function(r) { var s = roadStatus(r.id); return '<div class="item tap" data-act="roadOpen" data-id="' + r.id + '">' + sign(r, s) + '<div class="grow"><div><b>' + esc(r.name) + '</b> ' + (r.rank ? '<span class="pill">' + esc(r.rank) + '</span>' : '') + '</div><div class="muted ell">' + esc(r.section) + '</div></div>' + (s ? '<span class="pill ' + (s === 'done' ? 'gold' : 'red') + '">' + (s === 'done' ? '走破済み' : '走りたい') + '</span>' : '') + '</div>'; }).join('') + '</div>' : '<div class="empty">当てはまる道路がありません</div>') + (l.length > OV.shown ? '<button type="button" class="btn more" data-act="roadMore">もっと見る（残り ' + (l.length - OV.shown) + '）</button>' : '');
}
function drawRoadMap() {
  needLeaflet().then(function() {
    if (!$('roadMap')) return;
    OV.map = makeMap($('roadMap'), [37, 137.5], 5);
    filteredRoads().forEach(function(r) {
      var s = roadStatus(r.id) || 'none';
      L.polyline([r.from, r.to], { color: s === 'done' ? '#937434' : s === 'want' ? '#9c3a43' : '#5d6778', weight: 2, dashArray: '4 5' }).addTo(OV.map);
      L.marker(r.from, { icon: L.divIcon({ className: '', html: '<div class="mk ' + s + '"></div>', iconSize: [24, 24], iconAnchor: [12, 28] }) }).addTo(OV.map).on('click', function() { openRoad(r.id); });
    });
  }).catch(function(e) { toast(e.message); });
}
INPUT.roadF = function(el) { OV[el.dataset.k] = el.value; OV.shown = 40; RENDER.out(); };
INPUT.roadQ = function(el) { OV.q = el.value.trim(); OV.shown = 40; drawRoads(); };
ACT.roadMore = function() { OV.shown += 60; drawRoads(); };
ACT.roadMap = function() { OV.mapOn = !OV.mapOn; RENDER.out(); };
ACT.roadOpen = function(el) { openRoad(el.dataset.id); };
function openRoad(id) {
  var r = roads().filter(function(x) { return x.id === id; })[0], o = store.col('road')[id], s = roadStatus(id), m = store.col('roadMemo')[id];
  openSheet(r.name, '<form data-submit="roadMemo" data-id="' + id + '"><div class="row">' + sign(r, s) + '<div class="grow"><div>' + esc(r.section) + '</div><div class="muted">' + esc(r.prefs.join('・')) + (o ? '・記録 ' + byLine(o) : '') + '</div></div></div>' + (r.desc ? '<p class="text" style="margin:8px 0">' + esc(r.desc) + '</p>' : '') + '<div class="seg" style="margin-top:10px">' + [['', '未走破'], ['want', '走りたい'], ['done', '走破済み']].map(function(t) { return '<button type="button" class="' + (s === t[0] ? 'on' : '') + '" data-act="roadSet" data-id="' + id + '" data-v="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div><label><span class="lbl">メモ</span><textarea name="text" rows="3">' + esc(m ? m.value.text : '') + '</textarea></label><div class="form-foot"><a class="btn" target="_blank" rel="noopener noreferrer" href="' + esc(mapUrl(r.name + ' ' + r.prefs[0])) + '">地図</a><button type="button" class="btn" data-act="roadLog" data-id="' + id + '">ログに書く</button><button type="submit" class="btn primary">メモを保存</button></div></form>');
}
ACT.roadSet = function(el) {
  store.setCol('road', el.dataset.id, el.dataset.v ? { status: el.dataset.v, date: ymd(new Date()) } : null);
  el.parentNode.querySelectorAll('button').forEach(function(b) { b.classList.toggle('on', b === el); });
};
SUBMIT.roadMemo = function(f) { var t = f.elements.text.value.trim(); store.setCol('roadMemo', f.dataset.id, t ? { text: t } : null); closeSheet(); toast('保存しました'); };
ACT.roadLog = function(el) { var r = roads().filter(function(x) { return x.id === el.dataset.id; })[0]; closeSheet(); openLogForm({ preset: { title: r.name, category: '旅行', subCategory: 'ドライブ', memo: r.section } }); };

// ---- 記念カード ----
var CARD_TYPES = [['1', '訪問カード'], ['2', '登城・参拝印'], ['3', 'チケット'], ['4', '認定証']];
function cardHtml(c, key) {
  var head = { 1: 'TRAVEL CARD', 2: '登城記念・参拝之証', 3: 'MUSEUM & SPOT PASS', 4: '訪問認定証' }[c.type] || 'TRAVEL CARD';
  return '<div class="kcard t' + (Number(c.type) || 1) + '"' + (key ? ' data-act="cardEdit" data-key="' + esc(key) + '"' : '') + '><small>' + esc(head) + '</small><h3>' + esc(c.spotName) + '</h3><div class="text">' + esc(c.memo) + '</div><div class="row between"><span>' + esc(c.pref) + '</span><span>' + esc(c.date) + '</span></div></div>';
}
function outCard() {
  var c = store.col('card'), keys = Object.keys(c).sort(function(a, b) { return String(c[b].value.date).localeCompare(String(c[a].value.date)); });
  $('outBox').innerHTML = '<div class="section"><h3>アルバム ' + keys.length + ' 枚</h3><button type="button" class="btn small" data-act="cardEdit">カードを作る</button></div>' + (keys.map(function(k) { return cardHtml(c[k].value, k); }).join('') || '<div class="empty">まだカードがありません</div>');
}
ACT.cardEdit = function(el) {
  var key = el.dataset.key, v = key ? store.col('card')[key].value : { type: 1, date: ymd(new Date()) };
  openForm({ title: key ? 'カードを編集' : 'カードを作る', values: v, fields: [{ k: 'spotName', label: '場所', required: true }, { k: 'pref', label: '都道府県', half: true }, { k: 'date', label: '日付', type: 'date', half: true }, { k: 'type', label: 'デザイン', type: 'select', options: CARD_TYPES }, { k: 'memo', label: '思い出', type: 'textarea' }],
    onDelete: key ? function() { store.setCol('card', key, null); toast('カードを外しました', function() { store.setCol('card', key, v); }); } : null,
    onSave: function(val) { val.type = Number(val.type) || 1; store.setCol('card', key || store.newId('card'), val); toast('保存しました'); } });
};

// ---- お気に入り ----
function outFav() {
  var c = store.col('favorite'), keys = Object.keys(c).sort(function(a, b) { return String(c[a].value.title).localeCompare(String(c[b].value.title), 'ja'); });
  $('outBox').innerHTML = '<div class="section"><h3>お気に入りサイト</h3><button type="button" class="btn small" data-act="favEdit">追加</button></div>' + (keys.length ? '<div class="card list">' + keys.map(function(k) { var f = c[k].value; return '<div class="item"><div class="grow"><a href="' + esc(safeUrl(f.url)) + '" target="_blank" rel="noopener noreferrer"><b>' + esc([f.icon, f.title || domainOf(f.url)].filter(Boolean).join(' ')) + '</b></a><div class="muted ell">' + esc(f.note || domainOf(f.url)) + '</div></div><button type="button" class="btn small" data-act="favEdit" data-key="' + esc(k) + '">編集</button></div>'; }).join('') + '</div>' : '<div class="empty">まだありません</div>');
}
ACT.favEdit = function(el) {
  var key = el.dataset.key, v = key ? store.col('favorite')[key].value : {};
  openForm({ title: key ? 'お気に入りを編集' : 'お気に入りを追加', values: v, fields: [{ k: 'url', label: 'URL', required: true }, { k: 'title', label: '名前' }, { k: 'note', label: 'メモ' }], extra: '<button type="button" class="btn small" data-act="fetchMeta">URL から題名を取得</button>',
    onDelete: key ? function() { store.setCol('favorite', key, null); toast('外しました', function() { store.setCol('favorite', key, v); }); } : null,
    onSave: function(val) {
      val.url = safeUrl(val.url);
      if (!val.url || val.url.length > 190) { toast('URL を確認してください（190 文字まで）'); return false; }
      val.icon = v.icon || '';
      var next = val.url.replace(/\/+$/, '');
      if (key && key !== next) store.setCol('favorite', key, null);
      store.setCol('favorite', next, val);
    } });
};

// ============================================================
// Mod_Misc : 記録＋・横断検索・設定・接続・共有メニュー
// ============================================================
var QV = { type: 'log', rating: 0, photos: [] };

// ---- 記録＋（写真なしなら 3 操作: ＋ → タイトル → 記録する） ----
ACT.quick = function() {
  if (readDraft()) { openLogForm(); return; } // 書きかけがあれば続きから
  openQuick({});
};
function openQuick(pre) {
  QV = { type: pre.type || (APP.tab === 'memo' ? 'memo' : APP.tab === 'plan' ? 'wish' : 'log'), rating: 0, photos: pre.photos || [], cat: prefs().lastCat || 'グルメ', pre: pre };
  openSheet('記録＋', '<form data-submit="quick" class="form" id="quickForm"></form>');
  drawQuick({ title: pre.title || '', body: pre.text || '', url: pre.url || '' });
}
function drawQuick(v) {
  var t = QV.type, url = v.url ? true : t !== 'log';
  $('quickForm').innerHTML = '<div class="seg" style="margin:0">' + [['log', 'ログ'], ['wish', '気になる'], ['memo', 'メモ']].map(function(x) { return '<button type="button" class="' + (t === x[0] ? 'on' : '') + '" data-act="qType" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div><label><span>タイトル</span><input name="title" value="' + esc(v.title) + '" autocomplete="off"></label>' +
    (t === 'memo' ? '' : '<div class="chips wrap">' + Object.keys(cats()).map(function(k) { return '<button type="button" class="chip ' + (k === QV.cat ? 'on' : '') + '" data-act="qCat" data-v="' + esc(k) + '">' + esc(k) + '</button>'; }).join('') + '</div>') +
    (t === 'log' ? '<div class="rate">' + [1, 2, 3, 4, 5].map(function(n) { return '<button type="button" class="' + (n <= QV.rating ? 'on' : '') + '" data-act="qRate" data-v="' + n + '" aria-label="評価 ' + n + '">★</button>'; }).join('') + '</div>' : '') +
    (url ? '<label><span>URL</span><input name="url" value="' + esc(v.url) + '"></label>' : '') + '<label><span>メモ</span><textarea name="memo" rows="3">' + esc(v.body) + '</textarea></label>' +
    (QV.photos.length ? '<p class="muted">写真 ' + QV.photos.length + ' 枚' + (t === 'log' ? '' : '（ログのときだけ保存されます）') + '</p>' : '') +
    '<div class="row" style="flex-wrap:wrap"><button type="button" class="btn small" data-act="qPaste">貼り付けて追加</button>' + (url ? '<button type="button" class="btn small" data-act="fetchMeta">題名を取得</button>' : '') + (t === 'log' ? '<button type="button" class="btn small" data-act="qDetail">写真・詳しく書く</button>' : '') + '</div><div class="form-foot"><button type="submit" class="btn primary">記録する</button></div>';
  var f = $('quickForm').elements.title;
  if (!v.title) f.focus();
}
function quickValues() { var e = $('quickForm').elements; return { title: e.title.value, body: e.memo.value, url: e.url ? e.url.value : '' }; }
ACT.qType = function(el) { var v = quickValues(); QV.type = el.dataset.v; drawQuick(v); };
ACT.qCat = function(el) { QV.cat = el.dataset.v; $('quickForm').querySelectorAll('.chip').forEach(function(b) { b.classList.toggle('on', b.dataset.v === QV.cat); }); };
ACT.qRate = function(el) { var n = Number(el.dataset.v); QV.rating = QV.rating === n ? 0 : n; $('quickForm').querySelectorAll('.rate button').forEach(function(b, i) { b.classList.toggle('on', i < QV.rating); }); };
ACT.qDetail = function() { var v = quickValues(), p = QV.photos; closeSheet(); openLogForm({ preset: { title: v.title, category: QV.cat, rating: QV.rating, memo: [v.body, v.url].filter(Boolean).join('\n') }, photos: p }); };
// iPhone は共有先になれないため、コピーした内容を貼り付ける
ACT.qPaste = function() {
  var v = quickValues();
  var put = function(t) {
    var m = String(t || '').match(/https?:\/\/\S+/), rest = String(t || '').replace(m ? m[0] : '', '').trim();
    if (m) v.url = m[0];
    if (rest) { if (!v.title && rest.length <= 60 && rest.indexOf('\n') < 0) v.title = rest; else v.body = [v.body, rest].filter(Boolean).join('\n'); }
    if (QV.type === 'log' && m) QV.type = 'memo';
    drawQuick(v);
  };
  if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(put).catch(function() { toast('入力欄を長押しして貼り付けてください'); });
  else toast('入力欄を長押しして貼り付けてください');
};
SUBMIT.quick = function() {
  var v = quickValues(), title = v.title.trim(), body = v.body.trim(), url = safeUrl(v.url), me = store.st.server.me;
  if (!title && !(QV.type === 'memo' && (body || url))) { toast('タイトルを入力してください'); return; }
  if (QV.type === 'log') {
    var id = store.add('log', { title: title, timestamp: nowStamp(), category: QV.cat, subCategory: '', rating: QV.rating, memo: [body, url].filter(Boolean).join('\n'), author: myName() });
    setPref('lastCat', QV.cat);
    if (QV.photos.length) attachPhotos(QV.photos, id).then(function() { renderSoon(); return store.flush(); }).then(uploadPhotos);
  } else if (QV.type === 'wish') {
    var w = { title: title, type: 'お店・スポット', category: QV.cat, author: myName(), regDate: ymd(new Date()), url: url, status: '気になる', memo: body };
    if (me) w['like' + me.n] = 'true';
    store.add('wish', w);
  } else store.add('memo', { title: title, content: body, url: url, category: url ? 'Webクリップ' : MEMO_CATS[0], author: myName(), createdAt: nowStamp() });
  if (QV.type !== 'log') QV.photos.forEach(photoDel);
  closeSheet();
  toast('記録しました');
};

// ---- 横断検索 ----
ACT.search = function() {
  openSheet('横断検索', '<input type="search" data-input="gq" placeholder="ログ・プラン・メモ・タグ" aria-label="横断検索"><div id="gres" style="margin-top:10px"></div>', { focus: 'input' });
  INPUT.gq({ value: '' });
};
INPUT.gq = function(el) {
  var q = el.value.trim(), box = $('gres');
  if (!q) { box.innerHTML = '<div class="chips wrap">' + allTags().slice(0, 24).map(function(t) { return '<button type="button" class="chip" data-act="tag" data-tag="' + esc(t.tag) + '">' + esc(t.tag) + ' ' + t.n + '</button>'; }).join('') + '</div>'; return; }
  var defs = [['log', 'ログ', ['title', 'memo', 'category', 'subCategory', 'address', 'author'], 'logOpen', 'timestamp'], ['memo', 'メモ', ['title', 'content', 'url', 'category', 'author'], 'memoEdit', 'editedAt'], ['wish', '気になる', ['title', 'memo', 'category', 'subCategory', 'author'], 'wishEdit', 'status'], ['bucket', 'やりたいこと', ['title', 'memo', 'category', 'when'], 'bucketEdit', 'status'], ['goal', '目標', ['title', 'memo', 'category', 'targetYm'], 'goalEdit', 'targetYm'], ['holiday', '連休', ['name', 'destination', 'mainPlan', 'memo'], 'holEdit', 'startDate']];
  box.innerHTML = defs.map(function(d) {
    var l = (d[0] === 'log' ? sortedLogs() : store.list(d[0])).filter(function(x) { return matches(d[2].map(function(k) { return x[k] || ''; }).join(' '), q); });
    return l.length ? '<h3>' + d[1] + ' ' + l.length + '</h3><div class="card list">' + l.slice(0, 10).map(function(x) { return '<div class="item tap" data-act="' + d[3] + '" data-id="' + esc(x.id) + '"><div class="grow ell">' + esc(x.title || x.name || x.content || x.url) + '</div><span class="muted">' + esc(String(x[d[4]] || '').slice(0, 10)) + '</span></div>'; }).join('') + '</div>' : '';
  }).join('') || '<div class="empty">一致するものがありません</div>';
};

// ---- 設定 ----
var TYPE_LABEL = { log: 'ログ', goal: '目標', holiday: '連休', wish: '気になる', bucket: 'やりたいこと', memo: 'メモ', col: 'おでかけ' };
function opLabel(op) { var s = op.set || {}, cur = op.id && store.get(op.type, op.id); return (TYPE_LABEL[op.type] || '写真の整理') + '：' + (s.title || s.name || (cur && (cur.title || cur.name)) || (op.arg && op.arg.key) || op.id || ''); }
ACT.settings = function() {
  var st = store.st, pend = Object.keys(pendingPhotos).reduce(function(n, k) { return n + pendingPhotos[k].length; }, 0) - failedPhotos.length, tr = TYPES.reduce(function(n, t) { return n + store.trashed(t).length; }, 0);
  openSheet('設定', '<div class="card"><div class="row between"><b>' + (lsGet(KEY_TOKEN) ? (authRejected ? 'トークンが一致しません' : '接続済み' + (myName() ? '（' + esc(myName()) + '）' : '')) : '未接続') + '</b><button type="button" class="btn small" data-act="connect">接続トークン</button></div><p class="muted">最終同期 ' + esc(st.server.syncedAt || '-') + '・未送信 ' + st.queue.length + ' 件・未送信の写真 ' + pend + ' 枚</p><button type="button" class="btn small" data-act="sync">今すぐ同期</button></div>' +
    (st.failed.length || failedPhotos.length ? '<div class="card"><b>送信できなかったもの</b><p class="muted">内容はこの端末に残っています。</p>' + st.failed.map(function(op) { return '<div class="item" style="flex-wrap:wrap"><div class="grow"><div class="ell">' + esc(opLabel(op)) + '</div><div class="muted">' + esc(op.error) + '</div><details><summary class="muted">内容</summary><div class="text">' + esc(Object.keys(op.set || {}).map(function(k) { return op.set[k] ? k + ': ' + op.set[k] : ''; }).filter(Boolean).join('\n')) + '</div></details></div><button type="button" class="btn small" data-act="failRetry" data-id="' + esc(op.qid) + '">再送</button><button type="button" class="btn small danger" data-act="failDrop" data-id="' + esc(op.qid) + '">破棄</button></div>'; }).join('') + failedPhotos.map(function(p) { return '<div class="item"><div class="thumb">' + photoTag({ id: p.id }, 'thumb') + '</div><div class="grow muted">写真：' + esc(p.error) + '</div><button type="button" class="btn small" data-act="phRetry" data-id="' + esc(p.id) + '">再送</button><button type="button" class="btn small danger" data-act="phDrop" data-id="' + esc(p.id) + '">破棄</button></div>'; }).join('') + '</div>' : '') +
    '<div class="card"><label><span class="lbl">起動したときの画面</span><select data-change="startTab">' + options([['log', 'ログ'], ['plan', 'プラン'], ['memo', 'メモ'], ['out', 'おでかけ']], prefs().start || 'log') + '</select></label></div>' +
    '<button type="button" class="btn more" data-act="trashBox">ゴミ箱（' + tr + '）</button><button type="button" class="btn more" data-act="handover">旧アプリのデータを取り込む</button><p class="muted">版 ' + esc(window.APP_VERSION || 'preview') + '</p>');
};
function reopenSettings() { closeSheet(); ACT.settings(); }
INPUT.startTab = function(el) { setPref('start', el.value); };
ACT.failRetry = function(el) { store.retryFailed(el.dataset.id); reopenSettings(); };
// 取り返しがつかないので 2 回押させる
function twice(el, fn) { if (el.dataset.sure) return fn(); el.dataset.sure = '1'; el.textContent = '本当に破棄'; }
ACT.failDrop = function(el) { twice(el, function() { store.dropFailed(el.dataset.id).then(reopenSettings); }); };
ACT.phRetry = function(el) { photoGet(el.dataset.id).then(function(p) { p.state = 'pending'; p.tries = 0; p.error = ''; return photoPut(p); }).then(refreshPending).then(function() { reopenSettings(); uploadPhotos(); }); };
ACT.phDrop = function(el) { twice(el, function() { photoDel(el.dataset.id).then(refreshPending).then(reopenSettings); }); };

ACT.trashBox = function() {
  var l = [];
  TYPES.forEach(function(t) { store.trashed(t).forEach(function(x) { l.push([t, x]); }); });
  l.sort(function(a, b) { return String(b[1].deletedAt).localeCompare(String(a[1].deletedAt)); });
  openSheet('ゴミ箱', '<p class="muted">30 日を過ぎたものは、切替が済んだあと自動で消えます。</p>' + (l.length ? '<div class="card list">' + l.map(function(r) { return '<div class="item"><div class="grow"><div class="ell">' + esc(r[1].title || r[1].name || r[1].content || '無題') + '</div><div class="muted">' + TYPE_LABEL[r[0]] + '・' + esc(String(r[1].deletedAt).slice(0, 16)) + '</div></div><button type="button" class="btn small" data-act="untrash" data-type="' + r[0] + '" data-id="' + esc(r[1].id) + '">戻す</button></div>'; }).join('') + '</div>' : '<div class="empty">空です</div>'));
};
ACT.untrash = function(el) { store.restore(el.dataset.type, el.dataset.id); el.closest('.item').remove(); toast('戻しました'); };

// ---- 接続 ----
ACT.connect = function() { openConnect(); };
function openConnect() {
  openSheet('接続', '<form data-submit="connect" class="form"><p>この端末で最初に 1 回だけ、自分の接続トークンを入力してください。未接続でも記録でき、接続後にまとめて送信されます。</p><input type="password" name="token" autocomplete="off" aria-label="接続トークン" required><p class="muted" id="connMsg"></p><div class="form-foot"><button type="button" class="btn" data-act="closeSheet">あとで</button><button type="submit" class="btn primary">接続する</button></div></form>');
}
SUBMIT.connect = function(f) {
  var token = f.elements.token.value.trim(), btn = f.querySelector('[type=submit]');
  if (!window.APP_ENDPOINT) { $('connMsg').textContent = '接続先がまだ設定されていません（公開前のビルドです）。'; return; }
  btn.disabled = true;
  postApi(token, 'ping', {}, 30000).then(function(r) {
    lsSet(KEY_TOKEN, token);
    authRejected = false;
    closeSheet();
    toast(r.name + ' として接続しました');
    sync(false);
  }).catch(function(e) { $('connMsg').textContent = e.code === 'UNAUTHORIZED' ? 'トークンが違います。' : e.message; }).then(function() { btn.disabled = false; });
};

// ---- 旧アプリの端末内データの引き継ぎ ----
ACT.handover = function() {
  openSheet('旧アプリのデータを取り込む', '<form data-submit="handover" class="form"><p>旧アプリの「引き継ぎ」でコピーした内容を貼り付けてください。何度取り込んでも増えません。</p><textarea name="json" rows="6" aria-label="引き継ぎの内容" required></textarea><p class="muted" id="hoMsg"></p><div class="form-foot"><button type="submit" class="btn primary">取り込む</button></div></form>');
};
SUBMIT.handover = function(f) {
  var d, btn = f.querySelector('[type=submit]');
  try { d = JSON.parse(f.elements.json.value); } catch (e) { $('hoMsg').textContent = '内容を読み取れません。もう一度コピーしてください。'; return; }
  var n = function(v) { return Array.isArray(v) ? v.length : Object.keys(v || {}).length; };
  var src = { road: n(d.lifelog_road_status_v2), roadMemo: n(d.lifelog_road_memo_v2), stamp: n(d.lifelog_stamp_status_v1), card: n(d.lifelog_card_album_v1), favorite: n(d.lifelog_web_favorites_v1) };
  btn.disabled = true;
  callApi('importLocalData', { data: d }, 120000).then(function(r) {
    $('hoMsg').innerHTML = [['road', '道路'], ['roadMemo', '道路メモ'], ['stamp', 'スタンプ'], ['card', 'カード'], ['favorite', 'お気に入り']].map(function(t) { return t[1] + '：端末 ' + src[t[0]] + ' 件 → 取り込み ' + r.count[t[0]] + ' 件' + (src[t[0]] === r.count[t[0]] ? '' : '（不一致）'); }).join('<br>');
    return store.pull();
  }).catch(function(e) { $('hoMsg').textContent = e.message; }).then(function() { btn.disabled = false; });
};

// ---- 共有メニュー（Android）。Service Worker が端末内に置いたものを受け取る ----
function takeShared() {
  if (!/[?&]share=1/.test(location.search) || !window.caches) return;
  history.replaceState(null, '', './');
  caches.open('couplelog-inbox').then(function(c) {
    return c.match('./inbox.json').then(function(r) { return r ? r.json() : null; }).then(function(info) {
      if (!info) return;
      return Promise.all((info.files || []).map(function(k) { return c.match(k).then(function(r) { return r && r.blob(); }); })).then(function(blobs) {
        return Promise.all(blobs.filter(Boolean).map(function(b) { return preparePhoto(b).then(function(p) { return p.id; }, function() { return null; }); }));
      }).then(function(ids) {
        ids = ids.filter(Boolean);
        var text = [info.text, info.url].filter(Boolean).join('\n'), m = text.match(/https?:\/\/\S+/), rest = text.replace(m ? m[0] : '', '').trim();
        openQuick({ type: ids.length ? 'log' : m ? 'memo' : 'log', title: info.title || '', url: m ? m[0] : '', text: rest, photos: ids });
        return caches.delete('couplelog-inbox');
      });
    });
  }).catch(function(e) { console.warn(e); });
}

document.querySelectorAll('[data-icon]').forEach(function(b) { b.insertAdjacentHTML('afterbegin', icon(b.dataset.icon)); });
boot();

})();
