import * as Y from 'yjs';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder, drawSelection } from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { yCollab, yUndoManagerKeymap, ySyncAnnotation } from 'y-codemirror.next';
import {
  createDocument,
  ROOM_ID,
  CAPABILITY,
  LIMITS,
  digest,
} from '../../../services/note-board/shared.js';
import { NoteConnection } from './connection.js';
import { openCache } from './cache.js';

const root = document.getElementById('shared-notes');
if (root) void initialise(root);
async function initialise(root) {
  const $ = (selector) => root.querySelector(selector),
    write = (selector, text) => {
      $(selector).textContent = text;
    },
    notice = (text) => write('[data-notice]', text);
  let doc,
    connection,
    cache,
    titleView,
    bodyView,
    localSaved = false,
    cacheError = '',
    saving = 0,
    changes = 0,
    savePromise = Promise.resolve(),
    cacheKey,
    credentials,
    network;
  let offlineReady = false;
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  const endpoint = local
    ? `ws://${location.host}/__notes`
    : __NOTES_API__.replace(/^http/, 'ws') + '/rooms';
  const params = new URLSearchParams(location.hash.slice(1)),
    match = params.get('board')?.split('.');
  const color = ['#648977', '#8775a5', '#b18258', '#6387a3'][Math.floor(Math.random() * 4)];
  let nickname = '';
  try {
    nickname = localStorage.getItem('shared-notes-nickname') || '';
  } catch {}
  if (!nickname) nickname = `访客 ${Math.random().toString(16).slice(2, 6)}`;
  $('#notes-name').value = nickname;
  if (document.body.classList.contains('notes-offline-shell'))
    $('[data-shell-warning]').hidden = false;

  async function installOfflineShell() {
    if (!('serviceWorker' in navigator)) {
      write('[data-offline-cache]', '浏览器不支持离线页面缓存；仍可导出。');
      return;
    }
    try {
      await navigator.serviceWorker.register(`/lab/notes/sw.js?v=${root.dataset.build}`, {
        scope: '/lab/notes/',
        updateViaCache: 'none',
      });
      await navigator.serviceWorker.ready;
      offlineReady = true;
      write('[data-offline-cache]', '离线页面已缓存');
    } catch {
      write('[data-offline-cache]', '离线页面缓存未就绪；暂不能保证断网后重新打开。');
    }
  }
  void installOfflineShell();
  function shareLink() {
    return `${location.origin}/lab/notes/#board=${credentials.id}.${credentials.key}`;
  }
  function render() {
    if (!doc) return;
    const pending = !network || network.pending || !['connected'].includes(network.state);
    const labels = {
      connected: network?.pending ? '正在同步' : '服务器已确认',
      connecting: '正在连接',
      paused: '模拟断网',
      disconnected: '连接中断 · 自动重连',
      blocked: '同步已暂停',
    };
    root.dataset.connection = network?.state || 'connecting';
    write('[data-connection]', labels[network?.state] || '正在连接');
    write(
      '[data-local-save]',
      cacheError || (localSaved && saving === 0 ? '已存到本机' : '本机保存中…')
    );
    write('[data-sync-save]', pending ? '等待连接／确认' : '服务器已保存');
    write('[data-count]', `${doc.getText('content').length.toLocaleString()} 字符`);
    write('[data-service]', local ? '本机协作服务' : '云端协作服务');
    write('[data-revision]', network?.revision ? `r${network.revision}` : '等待首次确认');
    write('[data-replica]', doc.clientID.toString(16));
    write('[data-messages]', `发送 ${network?.sent || 0} / 接收 ${network?.received || 0}`);
    write('[data-pending]', pending ? '还有尚未被服务器确认的副本' : '本窗口的修改已获确认');
    write(
      '[data-network-description]',
      network?.state === 'paused'
        ? '只断开这个窗口的协作连接；仍能编辑。本实验不借助窗口间广播偷偷同步。'
        : network?.state === 'blocked'
          ? network.error
          : pending
            ? '继续写不会被锁住。先保存在本机，连接成功后交换缺少的编辑记录。'
            : '连接并不等于覆盖：双方交换编辑记录，服务器保存后才给确认。'
    );
    $('[data-toggle]').textContent =
      network?.state === 'paused' || network?.state === 'blocked' ? '重新连接' : '模拟断网';
    $('[data-peers]').replaceChildren(
      ...(network?.peers || []).map((user) => {
        const span = document.createElement('span');
        span.className = 'notes-peer';
        span.style.setProperty('--peer-color', user.color);
        span.textContent = user.name;
        return span;
      })
    );
    write(
      '[data-peer-count]',
      network?.peers.length
        ? `${network.peers.length + 1} 个在线窗口`
        : network?.state === 'connected'
          ? '只有你在线'
          : '本窗口离线'
    );
  }
  function persist() {
    changes++;
    const target = changes;
    localSaved = false;
    saving++;
    render();
    const snapshot = Y.encodeStateAsUpdate(doc);
    savePromise = savePromise
      .catch(() => {})
      .then(() => cache.save(cacheKey, snapshot))
      .then(() => {
        cacheError = '';
        if (changes === target) localSaved = true;
      })
      .catch((error) => {
        cacheError = error.message;
        notice(error.message);
      })
      .finally(() => {
        saving--;
        render();
      });
  }
  function newBoard() {
    if (cacheError || saving) {
      notice('请先等待本机保存完成，或导出当前笔记，再新建。');
      return;
    }
    const raw = crypto.getRandomValues(new Uint8Array(32)),
      key = btoa(String.fromCharCode(...raw))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    location.assign(`${location.origin}/lab/notes/#board=${crypto.randomUUID()}.${key}`);
    location.reload();
  }
  $('[data-new]').addEventListener('click', newBoard);
  $('[data-start]').addEventListener('click', newBoard);
  if (!match || !ROOM_ID.test(match[0]) || !CAPABILITY.test(match[1] || '')) {
    $('[data-welcome]').hidden = false;
    $('[data-workspace]').hidden = true;
    notice(
      match
        ? '链接格式无效。新建的笔记使用随机协作钥匙。'
        : '新建一块笔记板，或用朋友发来的协作链接进入。'
    );
    return;
  }
  credentials = { id: match[0], key: match[1] };
  $('[data-welcome]').hidden = true;
  $('[data-workspace]').hidden = false;
  $('#notes-link').value = shareLink();
  try {
    cache = await openCache();
    const replica = new URL(location.href).searchParams.get('replica');
    cacheKey = `${credentials.id}:${await digest(credentials.key)}:${ROOM_ID.test(replica || '') ? replica : 'device'}`;
    const saved = await cache.read(cacheKey);
    doc = createDocument(saved?.state ? new Uint8Array(saved.state) : null);
    localSaved = true;
    connection = new NoteConnection(doc, {
      endpoint,
      room: credentials.id,
      key: credentials.key,
      onStatus: (state) => {
        network = state;
        render();
      },
    });
    connection.awareness.setLocalStateField('user', {
      name: nickname.slice(0, 24),
      color,
      colorLight: color + '33',
    });
    const bodyUndo = new Y.UndoManager(doc.getText('content'));
    const common = (text, label, maximum, singleLine = false) => [
      yCollab(text, connection.awareness, singleLine ? undefined : { undoManager: bodyUndo }),
      keymap.of([...yUndoManagerKeymap, ...defaultKeymap]),
      drawSelection(),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({
        role: 'textbox',
        'aria-label': label,
        'aria-multiline': singleLine ? 'false' : 'true',
        spellcheck: 'true',
      }),
      EditorState.transactionFilter.of((tr) =>
        tr.annotation(ySyncAnnotation) ||
        !tr.docChanged ||
        tr.newDoc.length <= maximum ||
        tr.newDoc.length < tr.startState.doc.length
          ? singleLine && tr.newDoc.lines > 1 && !tr.annotation(ySyncAnnotation)
            ? []
            : tr
          : []
      ),
      EditorView.theme({
        '&': { fontSize: singleLine ? '24px' : '15px' },
        '.cm-content': {
          fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif',
          lineHeight: '1.95',
          padding: singleLine ? '4px 0' : '20px 0',
          minHeight: singleLine ? '40px' : '360px',
        },
        '.cm-scroller': { fontFamily: 'inherit', overflow: 'auto' },
        '&.cm-focused': { outline: 'none' },
        '.cm-line': { padding: '0' },
      }),
    ];
    titleView = new EditorView({
      state: EditorState.create({
        doc: doc.getText('title').toString(),
        extensions: [
          ...common(doc.getText('title'), '笔记标题', LIMITS.title, true),
          placeholder('给这页一个名字'),
        ],
      }),
      parent: $('[data-title-editor]'),
    });
    bodyView = new EditorView({
      state: EditorState.create({
        doc: doc.getText('content').toString(),
        extensions: [
          ...common(doc.getText('content'), '笔记正文', LIMITS.content),
          markdown(),
          placeholder('写下想法，邀请另一位一起写。\n断网时也可以继续，重新连接后再合并。'),
        ],
      }),
      parent: $('[data-editor]'),
    });
    doc.on('update', persist);
    persist();
    connection.connect();
    render();
    $('[data-toggle]').addEventListener('click', () => {
      if (['paused', 'blocked'].includes(connection.state)) {
        connection.connect();
        notice('正在重新连接并合并各自缺少的记录。');
      } else {
        connection.disconnect();
        notice('已断开本窗口的协作连接。修改先留本机，其他窗口不会立即收到。');
      }
    });
    $('[data-second-window]').addEventListener('click', () => {
      const url = new URL(shareLink());
      url.searchParams.set('replica', crypto.randomUUID());
      window.open(url.href, '_blank', 'noopener,noreferrer');
      notice('第二窗口使用独立的本机副本，可以真正观察断开连接后的分叉与重连合并。');
    });
    $('[data-copy]').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(shareLink());
        notice('协作链接已复制。持有链接的人可以读写这块笔记，请只发给你信任的人。');
      } catch {
        $('#notes-link').focus();
        $('#notes-link').select();
        notice('请手动复制选中的链接。');
      }
    });
    $('[data-export]').addEventListener('click', () => {
      const title = doc.getText('title').toString(),
        content = doc.getText('content').toString(),
        url = URL.createObjectURL(
          new Blob([`${title ? `# ${title}\n\n` : ''}${content}`], {
            type: 'text/markdown;charset=utf-8',
          })
        ),
        anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${(title || '共享笔记').replace(/[\\/:*?"<>|]/g, '-').slice(0, 60)}.md`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notice('已导出文字备份，文件不含协作钥匙。');
    });
    $('#notes-name').addEventListener('input', (event) => {
      nickname = event.target.value.trim().slice(0, 24) || '访客';
      try {
        localStorage.setItem('shared-notes-nickname', nickname);
      } catch {}
      connection.awareness.setLocalStateField('user', {
        name: nickname,
        color,
        colorLight: color + '33',
      });
    });
    $('[data-undo]').addEventListener('click', () => {
      bodyUndo.undo();
      bodyView.focus();
    });
    $('[data-redo]').addEventListener('click', () => {
      bodyUndo.redo();
      bodyView.focus();
    });
    window.addEventListener('online', () => {
      if (!connection.paused && !connection.failed) connection.connect();
    });
    window.addEventListener('beforeunload', (event) => {
      if (saving || cacheError) {
        event.preventDefault();
        event.returnValue = '';
      }
    });
    window.addEventListener(
      'pagehide',
      () => {
        connection.destroy();
        titleView.destroy();
        bodyView.destroy();
        bodyUndo.destroy();
        cache.close();
      },
      { once: true }
    );
    notice('已经可以写了。开第二窗口，模拟断网，分别追加文字，再重新连接。');
  } catch (error) {
    notice(error.message || '笔记启动失败，原数据没有清除。');
  }
}
