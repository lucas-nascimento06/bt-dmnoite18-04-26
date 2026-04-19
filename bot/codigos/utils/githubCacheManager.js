// githubCacheManager.js - Sistema Centralizado de Cache para GitHub
// Evita rate limit (429) com fila de requisições e cache compartilhado

import fetch from 'node-fetch';

class GitHubCacheManager {
    constructor() {
        this.cache = new Map();
        this.requestQueue = [];
        this.isProcessing = false;
        this.config = {
            CACHE_TTL: 30 * 60 * 1000, // 30 minutos
            REQUEST_DELAY: 2000, // 2 segundos entre requisições
            MAX_RETRIES: 5,
            INITIAL_BACKOFF: 1000,
            MAX_BACKOFF: 32000
        };
        
        console.log('✅ GitHubCacheManager inicializado');
        
        // Verifica se o token do GitHub está configurado
        if (process.env.GITHUB_TOKEN) {
            console.log('🔑 Token do GitHub detectado - Limite: 5000 req/h');
        } else {
            console.log('⚠️ Token do GitHub não configurado - Limite: 60 req/h');
        }
    }

    /**
     * Busca dados com cache e fila de requisições
     * @param {string} url - URL do GitHub
     * @param {string} key - Chave única para o cache
     * @param {function} filter - Função opcional para filtrar dados
     * @param {boolean} forceRefresh - Forçar atualização
     */
    async fetch(url, key, filter = null, forceRefresh = false) {
        // Verifica cache válido
        const cached = this.cache.get(key);
        if (!forceRefresh && cached && !this._isExpired(cached.timestamp)) {
            console.log(`✅ Cache hit: ${key} (${cached.data.length} itens)`);
            return { success: true, data: cached.data, fromCache: true };
        }

        // Adiciona à fila
        return new Promise((resolve, reject) => {
            this.requestQueue.push({
                url,
                key,
                filter,
                resolve,
                reject
            });

            console.log(`📋 Adicionado à fila: ${key} (posição ${this.requestQueue.length})`);
            
            // Inicia processamento se não estiver rodando
            if (!this.isProcessing) {
                this._processQueue();
            }
        });
    }

    /**
     * Processa fila de requisições sequencialmente
     */
    async _processQueue() {
        if (this.isProcessing || this.requestQueue.length === 0) return;

        this.isProcessing = true;
        console.log(`\n🔄 Processando fila (${this.requestQueue.length} requisições pendentes)...\n`);

        while (this.requestQueue.length > 0) {
            const request = this.requestQueue.shift();
            
            try {
                console.log(`⏳ Processando: ${request.key}...`);
                
                const result = await this._fetchWithRetry(request.url, request.key, request.filter);
                request.resolve(result);

                // Aguarda antes da próxima requisição (evita rate limit)
                if (this.requestQueue.length > 0) {
                    console.log(`⏰ Aguardando ${this.config.REQUEST_DELAY}ms antes da próxima requisição...\n`);
                    await this._sleep(this.config.REQUEST_DELAY);
                }

            } catch (error) {
                console.error(`❌ Erro ao processar ${request.key}:`, error.message);
                request.reject(error);
            }
        }

        this.isProcessing = false;
        console.log('✅ Fila processada com sucesso!\n');
    }

    /**
     * Faz requisição com retry e backoff exponencial
     */
    async _fetchWithRetry(url, key, filter) {
        let lastError = null;

        for (let attempt = 0; attempt < this.config.MAX_RETRIES; attempt++) {
            try {
                if (attempt > 0) {
                    const backoff = Math.min(
                        this.config.INITIAL_BACKOFF * Math.pow(2, attempt - 1),
                        this.config.MAX_BACKOFF
                    );
                    console.log(`   ⏳ Retry ${attempt + 1}/${this.config.MAX_RETRIES} após ${backoff}ms...`);
                    await this._sleep(backoff);
                }

                // Prepara headers com autenticação
                const headers = {
                    'Cache-Control': 'no-cache',
                    'User-Agent': 'WhatsAppBot/1.0'
                };

                // Adiciona autenticação do GitHub se disponível (5000 req/h vs 60 req/h)
                if (process.env.GITHUB_TOKEN) {
                    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
                    console.log('   🔑 Usando token do GitHub (5000 req/h)');
                } else {
                    console.log('   ⚠️ Sem token - limite de 60 req/h');
                }

                const response = await fetch(url, {
                    headers,
                    timeout: 15000
                });

                // Tratamento de rate limit
                if (response.status === 429) {
                    const retryAfter = response.headers.get('Retry-After');
                    const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : this.config.MAX_BACKOFF;
                    console.log(`   ⏸️ Rate limit (429) - aguardando ${waitTime}ms...`);
                    await this._sleep(waitTime);
                    continue;
                }

                // Exibe informações de rate limit (útil para debug)
                const remaining = response.headers.get('X-RateLimit-Remaining');
                const limit = response.headers.get('X-RateLimit-Limit');
                if (remaining && limit) {
                    console.log(`   📊 Rate Limit: ${remaining}/${limit} requisições restantes`);
                }

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                let processedData = data;

                // Aplica filtro se fornecido
                if (filter && typeof filter === 'function') {
                    processedData = filter(data);
                }

                // Salva no cache
                this.cache.set(key, {
                    data: processedData,
                    timestamp: Date.now()
                });

                const count = Array.isArray(processedData) ? processedData.length : 'N/A';
                console.log(`   ✅ Carregado: ${key} (${count} itens) - salvo no cache`);

                return { success: true, data: processedData, fromCache: false };

            } catch (error) {
                lastError = error;
                console.error(`   ❌ Tentativa ${attempt + 1} falhou:`, error.message);
            }
        }

        console.error(`   ❌ Todas as tentativas falharam para ${key}`);
        return { success: false, data: null, error: lastError };
    }

    /**
     * Verifica se o cache expirou
     */
    _isExpired(timestamp) {
        return (Date.now() - timestamp) > this.config.CACHE_TTL;
    }

    /**
     * Sleep helper
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Limpa cache expirado
     */
    cleanExpiredCache() {
        let cleaned = 0;
        for (const [key, value] of this.cache.entries()) {
            if (this._isExpired(value.timestamp)) {
                this.cache.delete(key);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            console.log(`🧹 Cache limpo: ${cleaned} entradas expiradas removidas`);
        }
        return cleaned;
    }

    /**
     * Obtém status do cache
     */
    getStatus() {
        const entries = Array.from(this.cache.entries()).map(([key, value]) => ({
            key,
            items: Array.isArray(value.data) ? value.data.length : 'N/A',
            age: Math.round((Date.now() - value.timestamp) / 1000 / 60), // minutos
            expired: this._isExpired(value.timestamp)
        }));

        return {
            totalEntries: this.cache.size,
            queueLength: this.requestQueue.length,
            isProcessing: this.isProcessing,
            tokenConfigured: !!process.env.GITHUB_TOKEN,
            rateLimit: process.env.GITHUB_TOKEN ? '5000/h' : '60/h',
            entries
        };
    }

    /**
     * Força atualização de uma chave específica
     */
    async refresh(url, key, filter = null) {
        console.log(`🔄 Forçando refresh: ${key}`);
        return this.fetch(url, key, filter, true);
    }

    /**
     * Limpa todo o cache
     */
    clearAll() {
        const size = this.cache.size;
        this.cache.clear();
        console.log(`🗑️ Cache limpo: ${size} entradas removidas`);
        return size;
    }

    /**
     * Verifica o rate limit atual do GitHub
     */
    async checkRateLimit() {
        try {
            const headers = {
                'User-Agent': 'WhatsAppBot/1.0'
            };

            if (process.env.GITHUB_TOKEN) {
                headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
            }

            const response = await fetch('https://api.github.com/rate_limit', { headers });
            const data = await response.json();

            return {
                core: data.resources.core,
                search: data.resources.search,
                authenticated: !!process.env.GITHUB_TOKEN
            };
        } catch (error) {
            console.error('❌ Erro ao verificar rate limit:', error.message);
            return null;
        }
    }
}

// Instância singleton
const githubCache = new GitHubCacheManager();

// Limpeza automática de cache expirado a cada 10 minutos
setInterval(() => {
    githubCache.cleanExpiredCache();
}, 10 * 60 * 1000);

export default githubCache;
export { githubCache, GitHubCacheManager };