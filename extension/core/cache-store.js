const STORAGE_KEY = 'amaweb-cache-v1';

export class CacheStore {
  constructor() {
    this.entries = new Map();
    this.ready = false;
  }

  async hydrate() {
    try {
      const stored = await chrome.storage.session.get(STORAGE_KEY);
      const entries = stored[STORAGE_KEY] || {};
      Object.entries(entries).forEach(([tabId, value]) => {
        if (value && value.url && Array.isArray(value.dados)) {
          this.entries.set(Number(tabId), value);
        }
      });
    } catch (error) {
      console.warn('[Cache] Não foi possível restaurar o cache da sessão.', error);
    } finally {
      this.ready = true;
    }
  }

  get(tabId) {
    return this.entries.get(tabId);
  }

  set(tabId, value) {
    this.entries.set(tabId, value);
    return this.persist();
  }

  delete(tabId) {
    const deleted = this.entries.delete(tabId);
    if (deleted) this.persist();
    return deleted;
  }

  async persist() {
    try {
      const serialized = Object.fromEntries(this.entries);
      await chrome.storage.session.set({ [STORAGE_KEY]: serialized });
    } catch (error) {
      // O cache em memória continua válido mesmo se o limite de storage for atingido.
      console.warn('[Cache] Não foi possível persistir a avaliação.', error);
    }
  }
}

export const cacheAvaliacoes = new CacheStore();
