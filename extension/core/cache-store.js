/**
 * @fileoverview Cache manager para avaliações de acessibilidade
 * 
 * Fornece persistência de resultados em session storage com fallback para memória.
 * Invalidação automática em mudança de URL ou recarregamento de página.
 * Limpa automaticamente ao fechar abas.
 * 
 * Exports: CacheStore class com métodos hydrate, get, set, delete, persist
 */

const STORAGE_KEY = 'amaweb-cache-v1';

/**
 * Cache em memória + session storage para avaliações de acessibilidade
 * 
 * @class CacheStore
 */
export class CacheStore {
  constructor() {
    this.entries = new Map();
    this.ready = false;
  }

  /**
   * Restaura o cache do chrome.storage.session ao inicializar.
   * Valida a integridade dos dados antes de restaurar.
   * @async
   * @returns {Promise<void>}
   */
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

  /**
   * Recupera avaliação em cache para uma aba específica
   * @param {number} tabId - ID da aba
   * @returns {Object|undefined} Cache entry { url, dados, scoreGeral, contagem } ou undefined
   */
  get(tabId) {
    return this.entries.get(tabId);
  }

  /**
   * Armazena avaliação em memória e persiste em session storage
   * @param {number} tabId - ID da aba
   * @param {Object} value - Objeto cache { url, dados, scoreGeral, contagem }
   * @returns {Promise<void>}
   */
  set(tabId, value) {
    this.entries.set(tabId, value);
    return this.persist();
  }

  /**
   * Remove avaliação do cache e persiste a mudança
   * @param {number} tabId - ID da aba
   * @returns {boolean} true se removido, false se não existia
   */
  delete(tabId) {
    const deleted = this.entries.delete(tabId);
    if (deleted) this.persist();
    return deleted;
  }

  /**
   * Persiste o cache em memória para chrome.storage.session
   * Se o limite de storage for atingido, o cache em memória permanece válido.
   * @async
   * @returns {Promise<void>}
   */
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
