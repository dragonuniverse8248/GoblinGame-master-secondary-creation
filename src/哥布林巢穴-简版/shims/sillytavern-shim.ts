/**
 * SillyTavern 兼容层 - 内置于 Vue 源码中
 * 
 * 替代所有 SillyTavern 环境依赖，通过后端 API 运行。
 * 此文件在 index.ts 中最先导入，确保全局变量在所有其他代码之前就绪。
 */

// ======================== 后端 API 基础 ========================
const API_BASE = (window.location && window.location.origin) || 'http://localhost:8000';

// 同步请求辅助（仅在初始化时使用）
function syncRequest(method: string, path: string, body?: any): any {
    const xhr = new XMLHttpRequest();
    xhr.open(method, API_BASE + path, false); // 同步
    xhr.setRequestHeader('Content-Type', 'application/json');
    try {
        xhr.send(body ? JSON.stringify(body) : undefined);
        if (xhr.status >= 200 && xhr.status < 300) {
            return JSON.parse(xhr.responseText);
        }
    } catch (_e) { /* ignore */ }
    return null;
}

// 异步请求辅助
async function asyncRequest(method: string, path: string, body?: any): Promise<any> {
    const resp = await fetch(API_BASE + path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!resp.ok) {
        let detail = '';
        try { const j = await resp.json(); detail = j.detail || ''; } catch (_e) {}
        throw new Error(detail || `API ${method} ${path}: ${resp.status}`);
    }
    return resp.json();
}

// ======================== 变量存储（同步访问） ========================
const _globalStore: Record<string, any> = {};
let _variablesLoaded = false;
const _dirtyKeys = new Set<string>();
let _syncTimer: ReturnType<typeof setInterval> | null = null;

// 页面加载时同步拉取初始变量
(function initVars() {
    const data = syncRequest('POST', '/api/variables/get', { type: 'global' });
    if (data && typeof data === 'object') {
        Object.assign(_globalStore, data);
    }
    _variablesLoaded = true;

    // 定期后台同步脏变量
    _syncTimer = setInterval(() => {
        if (_dirtyKeys.size === 0) return;
        const dirty: Record<string, any> = {};
        for (const k of _dirtyKeys) {
            if (k in _globalStore) dirty[k] = _globalStore[k];
        }
        _dirtyKeys.clear();
        fetch(API_BASE + '/api/variables/replace', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ variables: dirty, type: 'global' }),
        }).catch(() => {});
    }, 3000);

    // 页面关闭前同步写入
    window.addEventListener('beforeunload', () => {
        if (_syncTimer) clearInterval(_syncTimer);
        if (_dirtyKeys.size === 0) return;
        const dirty: Record<string, any> = {};
        for (const k of _dirtyKeys) {
            if (k in _globalStore) dirty[k] = _globalStore[k];
        }
        syncRequest('POST', '/api/variables/replace', { variables: dirty, type: 'global' });
    });
})();

function markDirty(key: string) {
    _dirtyKeys.add(key);
}

// ======================== 全局变量 API（同步） ========================
(window as any).getVariables = function (options?: { type?: string }): Record<string, any> {
    const type = options?.type || 'global';
    if (type === 'global') return _globalStore;
    return {};
};

(window as any).replaceVariables = function (variables: Record<string, any>, options?: { type?: string }): void {
    const type = options?.type || 'global';
    if (type === 'global') {
        // replace 语义：清空不在新变量中的旧键
        for (const key in _globalStore) {
            if (!(key in variables)) delete _globalStore[key];
        }
        for (const key in variables) {
            _globalStore[key] = variables[key];
            markDirty(key);
        }
    }
};

// ======================== 事件系统 ========================
const _listeners: Record<string, Function[]> = {};

(window as any).eventOn = function (event: string, cb: Function) {
    if (!_listeners[event]) _listeners[event] = [];
    _listeners[event].push(cb);
};

(window as any).eventRemoveListener = function (event: string, cb: Function) {
    if (!_listeners[event]) return;
    _listeners[event] = _listeners[event].filter((c) => c !== cb);
};

function triggerEvent(event: string, ...args: any[]) {
    if (!_listeners[event]) return;
    _listeners[event].forEach((cb) => {
        try { cb(...args); } catch (e) { console.error('[Shim] event error:', e); }
    });
}

(window as any).iframe_events = {
    STREAM_TOKEN_RECEIVED_FULLY: 'STREAM_TOKEN_RECEIVED_FULLY',
    GENERATION_ENDED: 'GENERATION_ENDED',
    MESSAGE_RECEIVED: 'MESSAGE_RECEIVED',
    MESSAGE_SENT: 'MESSAGE_SENT',
};

// ======================== 正则格式化（透传） ========================
(window as any).formatAsTavernRegexedString = function (text: string, _scope?: string, _mode?: string): string {
    return text || '';
};

// ======================== SillyTavern 模拟 ========================
(window as any).SillyTavern = {
    getPresetManager: () => ({
        getModels: async () => {
            try {
                const r = await asyncRequest('GET', '/api/config/api/models');
                return (r.models || []).map((m: any) => m.id || m);
            } catch (_e) { return []; }
        },
    }),
    ChatCompletionService: {
        getModels: async () => {
            try {
                const r = await asyncRequest('GET', '/api/config/api/models');
                return (r.models || []).map((m: any) => m.id || m);
            } catch (_e) { return []; }
        },
    },
};

// ======================== TavernHelper 兼容层 ========================
(window as any).TavernHelper = {
    // === AI 生成 ===
    // 缓存的 API 配置（定期刷新）
    _cachedApiConfig: null as any,
    _apiConfigLastFetch: 0,

    _getApiConfig: async function () {
        const now = Date.now();
        if (this._cachedApiConfig && (now - this._apiConfigLastFetch) < 30000) {
            return this._cachedApiConfig;
        }
        try {
            const resp = await fetch(API_BASE + '/api/config/api/current');
            if (resp.ok) {
                this._cachedApiConfig = await resp.json();
                this._apiConfigLastFetch = now;
                return this._cachedApiConfig;
            }
        } catch (_e) {}
        return this._cachedApiConfig || null;
    },

    generate: async function (options: any): Promise<string> {
        // ★ SillyTavern 兼容：前端传的是 {user_input, system_prompt, ...} 而非 {messages: [...]}
        // 需要将 SillyTavern 格式转为 OpenAI messages 格式
        let messages = options.messages;
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            messages = [];
            // 构造系统提示
            if (options.system_prompt) {
                messages.push({ role: 'system', content: options.system_prompt });
            }
            // 构造用户输入（主要来源）
            if (options.user_input) {
                messages.push({ role: 'user', content: options.user_input });
            }
            // 备选：直接使用 instruction 字段
            if (messages.length === 0 && options.instruction) {
                messages.push({ role: 'user', content: options.instruction });
            }
            // 兜底
            if (messages.length === 0) {
                messages.push({ role: 'user', content: 'Hello' });
            }
        }

        // ★ 世界书全量注入（剔除思维链/压缩空白/标记条目名）
        try {
            let entries: any[] = [];
            try {
                const data = await asyncRequest('GET', '/api/saves/slot_0/worldbook');
                entries = data?.entries || [];
                if (entries && !Array.isArray(entries)) entries = Object.values(entries);
            } catch (_e) { /* slot_0 不存在 */ }

            if (entries.length > 0) {
                const cleaned = entries
                    .filter((e: any) => {
                        if (!e.content) return false;
                        const n = (e.name || '').toLowerCase();
                        if (n.includes('思维链') || n.includes('chain of thought')) return false;
                        return true;
                    })
                    .map((e: any) => ({
                        name: e.name || '',
                        content: (e.content || '').replace(/\n{3,}/g, '\n\n').trim(),
                    }));

                if (cleaned.length > 0) {
                    const text = cleaned.map(e => `[${e.name}]\n${e.content}`).join('\n\n---\n\n');
                    messages.unshift({ role: 'system', content: text });
                    console.log(`📖 [世界书] 全量注入 ${cleaned.length}条 | ${text.length}字符`);
                }
            }
        } catch (_e) { /* 静默 */ }

        const shouldStream = options.should_stream || false;

        // 始终从后端获取 API 配置，确保使用最新设置
        const apiConfig = await this._getApiConfig();
        // 后端配置优先，如果后端有配置则覆盖前端传入的 custom_api
        let customApi = options.custom_api;
        if (apiConfig && apiConfig.base_url && apiConfig.model) {
            customApi = {
                apiurl: apiConfig.base_url,
                key: apiConfig.api_key,
                model: apiConfig.model,
            };
        }

        // ★ 调试日志：输出完整请求内容
        console.log('══════════ 📤 AI完整请求 ══════════');
        console.log('消息数:', messages.length, '| 角色链:', messages.map((m: any) => m.role).join(' → '));
        messages.forEach((m: any, i: number) => {
            console.log(`─── [${i}] ${m.role} ───`);
            console.log(m.content);
        });
        console.log('══════════ 📤 请求结束 ══════════');

        if (shouldStream) {
            return new Promise((resolve, reject) => {
                fetch(API_BASE + '/api/generate/stream', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        messages,
                        options: customApi ? { custom_api: customApi } : {},
                    }),
                }).then(async (resp) => {
                    if (!resp.ok) {
                        const errText = await resp.text().catch(() => '');
                        if (resp.status === 502) {
                            reject(new Error('AI 生成失败：请先在设置中配置有效的 API 地址和密钥'));
                        } else {
                            reject(new Error(`AI 生成失败 (HTTP ${resp.status}): ${errText.slice(0, 100)}`));
                        }
                        return;
                    }
                    const reader = resp.body!.getReader();
                    const decoder = new TextDecoder();
                    let full = '';
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        const chunk = decoder.decode(value, { stream: true });
                        for (const line of chunk.split('\n')) {
                            if (line.startsWith('data: ')) {
                                const d = line.slice(6);
                                if (d === '[DONE]') { triggerEvent('STREAM_TOKEN_RECEIVED_FULLY', full); resolve(full); return; }
                                try {
                                    const p = JSON.parse(d);
                                    if (p.token) { full += p.token; triggerEvent('STREAM_TOKEN_RECEIVED_FULLY', full); }
                                    if (p.error) { reject(new Error(p.error)); return; }
                                } catch (_e) {}
                            }
                        }
                    }
                    triggerEvent('STREAM_TOKEN_RECEIVED_FULLY', full);
                    resolve(full);
                }).catch(reject);
            });
        }

        // 非流式
        try {
            const r = await asyncRequest('POST', '/api/generate', {
                messages,
                options: customApi ? { custom_api: customApi } : {},
            });
            return r.text || '';
        } catch (e: any) {
            const msg = e.message || String(e);
            if (msg.includes('502') || msg.includes('ConnectError') || msg.includes('连接')) {
                throw new Error('AI 生成失败：请先在设置中配置有效的 API 地址和密钥');
            }
            if (msg.includes('400') && msg.includes('配置')) {
                throw new Error(msg);
            }
            throw new Error('AI 生成失败：' + msg.split(': ').pop());
        }
    },

    generateRaw: async function (options: any) { return this.generate(options); },
    getModelList: async function () {
        try { return ((await asyncRequest('GET', '/api/config/api/models')).models || []) as any[]; } catch (_e) { return []; }
    },
    stopGenerationById: function (_id: any) {},
    stopAllGeneration: function () {},

    // === 变量（委托到全局函数） ===
    getVariables: function (o: any) { return (window as any).getVariables(o); },
    replaceVariables: function (v: any, o: any) { return (window as any).replaceVariables(v, o); },
    updateVariablesWith: function (u: any, o: any) {
        const c = (window as any).getVariables(o);
        Object.assign(c, u);
        return (window as any).replaceVariables(c, o);
    },
    insertOrAssignVariables: function (v: any, o: any) { return (window as any).replaceVariables(v, o); },
    insertVariables: function (v: any, o: any) {
        const c = (window as any).getVariables(o);
        Object.assign(c, v);
        return (window as any).replaceVariables(c, o);
    },
    deleteVariable: function (k: string, o: any) {
        const c = (window as any).getVariables(o);
        delete c[k];
        return (window as any).replaceVariables(c, o);
    },

    // === 世界书 ===
    _saveWb: async function (name: string, entries: any[]) {
        try {
            await asyncRequest('PUT', '/api/saves/slot_0/worldbook', {
                save_id: 'slot_0',
                worldbook_data: { name, entries },
            });
            console.log(`💾 [世界书保存] "${name}" ${entries.length}条 → 后端`);
        } catch (e) {
            console.error('❌ [世界书保存] 失败:', e);
        }
    },

    getWorldbookNames: async function () {
        try {
            const r = await asyncRequest('GET', '/api/worldbook');
            return ((r.worldbooks || []) as any[]).map((w: any) => w.name);
        } catch (_e) { return []; }
    },
    getGlobalWorldbookNames: async function () { return this.getWorldbookNames(); },
    getCharWorldbookNames: async function () { return []; },
    getChatWorldbookName: async function () { return '哥布林巢穴-人物档案'; },
    getOrCreateChatWorldbook: async function () { return '哥布林巢穴-人物档案'; },

    /**
     * 将 SillyTavern 原始格式条目转换为前端 WorldbookEntry 格式。
     * 如果条目已经是前端格式（有 strategy 字段），则直接返回。
     */
    _normalizeEntry: function (entry: any): any {
        if (!entry || typeof entry !== 'object') return entry;
        // 已有 strategy 字段 → 已经是前端格式，直接返回
        if (entry.strategy) return entry;

        // SillyTavern 格式 → 前端 WorldbookEntry 格式
        const selectiveLogicMap: Record<number, string> = { 0: 'and_any', 1: 'and_all', 2: 'not_all', 3: 'not_any' };
        const positionTypeMap: Record<number, string> = {
            0: 'at_depth',
            1: 'before_character_definition',
            2: 'after_character_definition',
            3: 'before_author_note',
            4: 'after_author_note',
        };

        // 确定 strategy.type
        let strategyType: string = 'selective';
        if (entry.constant) strategyType = 'constant';
        else if (entry.vectorized) strategyType = 'vectorized';

        return {
            uid: entry.uid ?? 0,
            name: entry.comment || entry.name || `条目_${entry.uid ?? 0}`,
            content: entry.content || '',
            enabled: !entry.disable,
            strategy: {
                type: strategyType,
                keys: Array.isArray(entry.key) ? [...entry.key] : [],
                keys_secondary: {
                    logic: selectiveLogicMap[entry.selectiveLogic ?? 0] || 'and_any',
                    keys: Array.isArray(entry.keysecondary) ? [...entry.keysecondary] : [],
                },
                scan_depth: entry.scanDepth != null ? entry.scanDepth : 'same_as_global',
            },
            position: {
                type: positionTypeMap[entry.position ?? 0] || 'at_depth',
                role: entry.role === 1 ? 'user' : entry.role === 2 ? 'assistant' : 'system',
                depth: entry.depth ?? 4,
                order: entry.order ?? 100,
            },
            probability: entry.probability ?? 100,
            recursion: {
                prevent_incoming: entry.excludeRecursion ?? entry.preventRecursion ?? true,
                prevent_outgoing: entry.preventRecursion ?? true,
                delay_until: entry.delayUntilRecursion ? (entry.delay_until ?? null) : null,
            },
            effect: {
                sticky: entry.sticky || null,
                cooldown: entry.cooldown || null,
                delay: entry.delay || null,
            },
            extra: entry.extra || {},
        };
    },

    getWorldbook: async function (name: string): Promise<any[]> {
        try {
            // 先尝试从存档世界书读取
            let data: any;
            let source = '';
            try { data = await asyncRequest('GET', '/api/saves/slot_0/worldbook'); source = '存档'; } catch (_e) {
                data = await asyncRequest('GET', '/api/worldbook/' + encodeURIComponent(name)); source = '模板';
            }
            let entries = data.entries || data;
            if (entries && !Array.isArray(entries)) entries = Object.values(entries);
            const raw = Array.isArray(entries) ? entries : [];
            // ★ 格式兼容：将 SillyTavern 原始格式转为前端 WorldbookEntry 格式
            const result = raw.map((e: any) => this._normalizeEntry(e));
            console.log(`📖 [Shim世界书] 来源:${source} 条目数:${result.length}`);
            return result;
        } catch (_e) { console.warn('📖 [Shim世界书] 读取失败:', _e); return []; }
    },

    createWorldbook: async function (name: string, entries: any[]) {
        try { await this._saveWb(name, entries || []); return { success: true, name }; } catch (_e) { return { success: false }; }
    },
    createOrReplaceWorldbook: async function (name: string, data: any) {
        try {
            const wb = Array.isArray(data) ? { name, entries: data } : data;
            await this._saveWb(name, wb.entries || []);
            return { success: true };
        } catch (_e) { return { success: false }; }
    },
    replaceWorldbook: async function (name: string, data: any) {
        try {
            const entries = Array.isArray(data) ? data : data.entries || [];
            await this._saveWb(name, entries);
            return { success: true, name };
        } catch (_e) { console.error('❌ [replaceWorldbook] 失败:', _e); return { success: false }; }
    },
    updateWorldbookWith: async function (name: string, updates: any) {
        try {
            const cur = await asyncRequest('GET', '/api/saves/slot_0/worldbook');
            Object.assign(cur, updates);
            await this._saveWb(name, cur.entries || []);
            return { success: true };
        } catch (_e) { return { success: false }; }
    },
    deleteWorldbook: async function (name: string) {
        try { await this._saveWb(name, []); return { success: true }; } catch (_e) { return { success: false }; }
    },
    rebindChatWorldbook: async function (_id: any, _name: string) { return { success: true }; },
    rebindGlobalWorldbooks: async function () { return { success: true }; },
    rebindCharWorldbooks: async function () { return { success: true }; },

    createWorldbookEntries: async function (name: string, entries: any[]) {
        try {
            const cur = await this.getWorldbook(name);
            entries.forEach((e) => cur.push(e));
            await this._saveWb(name, cur);
            return { success: true };
        } catch (_e) { return { success: false }; }
    },
    deleteWorldbookEntries: async function (name: string, uids: number[]) {
        try {
            const cur = await this.getWorldbook(name);
            const filtered = cur.filter((e: any) => !uids.includes(e.uid));
            await this._saveWb(name, filtered);
            return { success: true };
        } catch (_e) { return { success: false }; }
    },

    getLorebookEntries: async function (name: string) {
        const arr = await this.getWorldbook(name);
        const result: Record<string, any> = {};
        if (Array.isArray(arr)) arr.forEach((e: any) => { if (e?.uid !== undefined) result[e.uid] = e; });
        return result;
    },
    replaceLorebookEntries: async function (name: string, entries: any) {
        const arr = Array.isArray(entries) ? entries : Object.values(entries);
        return this.replaceWorldbook(name, arr);
    },
    updateLorebookEntriesWith: async function (name: string, updates: any) { return this.updateWorldbookWith(name, updates); },
    setLorebookEntries: async function (name: string, entries: any) { return this.replaceLorebookEntries(name, entries); },
    createLorebookEntries: async function (name: string, entries: any[]) { return this.createWorldbookEntries(name, entries); },
    deleteLorebookEntries: async function (name: string, uids: number[]) { return this.deleteWorldbookEntries(name, uids); },
    getLorebookSettings: async function (_name: string) { return {}; },
    setLorebookSettings: async function (_name: string, _s: any) { return { success: true }; },
    getLorebooks: async function () { return []; },
    deleteLorebook: async function (name: string) { return this.deleteWorldbook(name); },
    createLorebook: async function (name: string, entries: any[]) { return this.createWorldbook(name, entries); },
    getCharLorebooks: async function () { return []; },
    setCurrentCharLorebooks: async function () { return { success: true }; },
    getCurrentCharPrimaryLorebook: async function () { return null; },
    getOrCreateChatLorebook: async function () { return '哥布林巢穴-人物档案'; },

    // === 聊天消息 (内存存储) ===
    _msgs: [] as any[],
    getChatMessages: async function (range?: any) {
        if (range?.start !== undefined) return this._msgs.slice(range.start, range.end);
        return [...this._msgs];
    },
    setChatMessages: async function (msgs: any[]) { this._msgs = msgs || []; return { success: true }; },
    createChatMessages: async function (msgs: any[]) { if (Array.isArray(msgs)) this._msgs.push(...msgs); return { success: true }; },
    deleteChatMessages: async function (range?: any) { if (range) this._msgs.splice(range.start, range.end - range.start); return { success: true }; },
    rotateChatMessages: async function () { return { success: true }; },

    // === 消息格式化 ===
    formatAsDisplayedMessage: async function (m: any) { return m; },
    retrieveDisplayedMessage: async function (_id: any) { return ''; },
    refreshOneMessage: async function (_id: any) { return { success: true }; },
    formatAsTavernRegexedString: function (t: string) { return t || ''; },
    isCharacterTavernRegexesEnabled: function () { return false; },
    getTavernRegexes: async function () { return []; },
    replaceTavernRegexes: async function () { return { success: true }; },
    updateTavernRegexesWith: async function () { return { success: true }; },

    // === 其他辅助方法 ===
    builtin_prompt_default_order: [] as any[],
    isAdmin: function () { return true; },
    getExtensionType: function () { return 'iframe'; },
    getExtensionStatus: async function () { return { installed: true }; },
    isInstalledExtension: function () { return true; },
    substitudeMacros: function (t: string) { return t; },
    getLastMessageId: async function () { return 0; },
    errorCatched: function (e: any) { console.error('[Shim]', e); },
    getMessageId: async function () { return Date.now(); },
    getTavernHelperVersion: function () { return 'standalone-2.0'; },
    getTavernHelperExtensionId: function () { return 'standalone'; },
    getTavernVersion: function () { return 'standalone'; },
    builtin: {},

    // === 音频/角色/预设/扩展/导入/提示词/宏/初始化 (no-op) ===
    playAudio: function () {},
    pauseAudio: function () {},
    getAudioList: async function () { return []; },
    replaceAudioList: async function () { return { success: true }; },
    insertAudioList: async function () { return { success: true }; },
    getAudioSettings: async function () { return {}; },
    setAudioSettings: async function () { return { success: true }; },
    getCharacterNames: async function () { return []; },
    createCharacter: async function () { return { success: true }; },
    createOrReplaceCharacter: async function () { return { success: true }; },
    deleteCharacter: async function () { return { success: true }; },
    getCharacter: async function () { return null; },
    replaceCharacter: async function () { return { success: true }; },
    updateCharacterWith: async function () { return { success: true }; },
    isPresetNormalPrompt: function () { return true; },
    isPresetSystemPrompt: function () { return false; },
    isPresetPlaceholderPrompt: function () { return false; },
    default_preset: {},
    getPresetNames: async function () { return []; },
    getLoadedPresetName: function () { return 'standalone'; },
    loadPreset: async function () { return { success: true }; },
    createPreset: async function () { return { success: true }; },
    createOrReplacePreset: async function () { return { success: true }; },
    deletePreset: async function () { return { success: true }; },
    renamePreset: async function () { return { success: true }; },
    getPreset: async function () { return {}; },
    replacePreset: async function () { return { success: true }; },
    updatePresetWith: async function () { return { success: true }; },
    setPreset: async function () { return { success: true }; },
    installExtension: async function () { return { success: true }; },
    uninstallExtension: async function () { return { success: true }; },
    reinstallExtension: async function () { return { success: true }; },
    updateExtension: async function () { return { success: true }; },
    importRawCharacter: async function () { return { success: true }; },
    importRawChat: async function () { return { success: true }; },
    importRawPreset: async function () { return { success: true }; },
    importRawWorldbook: async function () { return { success: true }; },
    importRawTavernRegex: async function () { return { success: true }; },
    injectPrompts: async function () { return { success: true }; },
    uninjectPrompts: async function () { return { success: true }; },
    registerMacroLike: function () {},
    initializeGlobal: async function () { return { success: true }; },
    waitGlobalInitialized: async function () {},
    RawCharacter: class {},
    getCharData: async function () { return null; },
    getCharAvatarPath: function () { return ''; },
    getChatHistoryBrief: async function () { return []; },
    getChatHistoryDetail: async function () { return []; },
    getAllEnabledScriptButtons: function () { return []; },
    triggerSlash: async function () { return { success: true }; },
};

// ======================== 图片 URL 重写和容错 ========================
// 将旧远程 URL 替换为本地路径，加载失败时使用通用兜底图
(function () {
    const OLD_HOST = 'kitakamis.online';
    const REWRITE_MAP: Record<string, string> = {
        'hero_portaits': '/images/heroes/',
        'comunit_portaits': '/images/common/',
        'uiit_portaits': '/images/soldiers/',
        'portraits': '/images/portraits/',
    };

    function rewriteUrl(url: string): string {
        if (!url || !url.includes(OLD_HOST)) return url;
        for (const [oldPath, newPath] of Object.entries(REWRITE_MAP)) {
            if (url.includes('/' + oldPath + '/')) {
                const filename = url.split('/').pop() || '';
                return newPath + filename;
            }
        }
        return url;
    }

    // 拦截 HTML 属性中的图片 URL（MutationObserver）
    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            m.addedNodes.forEach((node) => {
                if (node instanceof HTMLImageElement) {
                    const src = node.getAttribute('src');
                    if (src && src.includes(OLD_HOST)) {
                        node.setAttribute('src', rewriteUrl(src));
                    }
                }
                if (node instanceof Element) {
                    node.querySelectorAll('img').forEach((img) => {
                        const src = img.getAttribute('src');
                        if (src && src.includes(OLD_HOST)) {
                            img.setAttribute('src', rewriteUrl(src));
                        }
                    });
                }
            });
        }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    // 简单字符串哈希（确定性）
    function simpleHash(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 32位整数
        }
        return Math.abs(hash);
    }

    // 全局图片加载错误处理 — 确定性兜底（相同URL始终得到相同兜底图）
    document.addEventListener('error', (e) => {
        const img = e.target as HTMLImageElement;
        if (img && img.tagName === 'IMG' && !img.dataset.fb) {
            img.dataset.fb = '1';

            // 哥布林之王图片：若无则空白，不做兜底
            if (img.src.includes('goblin-king')) {
                img.style.display = 'none';
                return;
            }

            const hash = simpleHash(img.src || img.getAttribute('src') || 'fallback');
            fetch('/api/images/assign/' + hash)
                .then((r) => r.json())
                .then((d) => { if (d.url) img.src = d.url; })
                .catch(() => {});
        }
    }, true);
})();

console.log('[Shim] SillyTavern 兼容层已内置于 Vue 源码中');
