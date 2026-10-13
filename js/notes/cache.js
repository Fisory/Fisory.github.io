import * as Y from 'yjs';

// A committed IndexedDB transaction, not just a queued write, is "saved".
// Merge snapshots inside the same read/write transaction so two local tabs
// cannot replace each other's offline updates either.
export async function openCache(indexedDBImpl = indexedDB) {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDBImpl.open('shared-notes-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('boards', { keyPath: 'key' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('浏览器没有允许本机笔记存储。'));
  });
  return {
    async read(key) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction('boards'),
          request = tx.objectStore('boards').get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(new Error('无法读取本机笔记。'));
      });
    },
    async save(key, state) {
      return new Promise((resolve, reject) => {
        let tx;
        try {
          tx = db.transaction('boards', 'readwrite', { durability: 'strict' });
        } catch {
          tx = db.transaction('boards', 'readwrite');
        }
        const store = tx.objectStore('boards'),
          request = store.get(key);
        let savedAt = Date.now();
        request.onsuccess = () => {
          try {
            const previous = request.result?.state;
            const merged = previous ? Y.mergeUpdates([new Uint8Array(previous), state]) : state;
            store.put({ key, state: merged, savedAt });
          } catch {
            tx.abort();
          }
        };
        tx.oncomplete = () => resolve(savedAt);
        tx.onabort = tx.onerror = () =>
          reject(new Error('本机保存失败，可能是存储额度不足；请先导出，不要刷新。'));
      });
    },
    close() {
      db.close();
    },
  };
}
