const DATABASE = 'counterfolk-commerce';
const WORLD_ID = 'living-world';

export class WorldConflictError extends Error {}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('world', { keyPath: 'id' });
      request.result.createObjectStore('media', { keyPath: 'id' });
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('请关闭其他旧版 Counterfolk 标签页，再载入工作区。'));
  });
}

function runTransaction(database, stores, mode, actions) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(stores, mode);
    let result;
    let failure;
    const complete = (value) => { result = value; };
    const fail = (error) => {
      failure = error;
      transaction.abort();
    };
    transaction.oncomplete = () => resolve(result);
    transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('工作区保存失败。'));
    function safely(action) {
      try { action(); } catch (error) { fail(error); }
    }
    safely(() => actions((name) => transaction.objectStore(name), complete, safely));
  });
}

export async function openCommerceStore() {
  const database = await openDatabase();
  return {
    async loadWorld(factory) {
      return runTransaction(database, ['world'], 'readwrite', (table, complete, safely) => {
        const store = table('world');
        const request = store.get(WORLD_ID);
        request.onsuccess = () => safely(() => {
          const record = request.result ?? { id: WORLD_ID, revision: 0, world: factory() };
          if (!request.result) store.add(record);
          complete(record);
        });
      });
    },
    async commitWorld(current, world, media) {
      const stores = media ? ['world', 'media'] : ['world'];
      return runTransaction(database, stores, 'readwrite', (table, complete, safely) => {
        const store = table('world');
        const request = store.get(WORLD_ID);
        request.onsuccess = () => safely(() => {
          if (request.result?.revision !== current) throw new WorldConflictError('另一个标签页已更新工作区，请重试。');
          const record = { id: WORLD_ID, revision: current + 1, world };
          if (media) table('media').add(media);
          store.put(record);
          complete(record);
        });
      });
    },
    async getMedia(id) {
      return runTransaction(database, ['media'], 'readonly', (table, complete) => {
        const request = table('media').get(id);
        request.onsuccess = () => complete(request.result);
      });
    },
    async saveVideo(id, video, videoError = null) {
      return runTransaction(database, ['media'], 'readwrite', (table, complete, safely) => {
        const store = table('media');
        const request = store.get(id);
        request.onsuccess = () => safely(() => {
          const record = request.result;
          if (!record || record.video) {
            complete(false);
            return;
          }
          store.put({ ...record, video, videoError });
          complete(true);
        });
      });
    },
  };
}
