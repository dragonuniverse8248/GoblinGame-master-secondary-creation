<template>
  <div class="custom-api-settings">
    <h4 class="section-title">API 设置</h4>
    <p class="section-desc">配置 AI 生成接口，支持 OpenAI 兼容 API</p>

    <div class="divider"></div>

    <!-- API地址 -->
    <div class="setting-item">
      <label class="setting-label">
        <span class="label-text">API 地址 *</span>
        <span class="label-desc">OpenAI 兼容的 API 端点，例如 https://api.openai.com/v1</span>
      </label>
      <input
        v-model="cfg.base_url"
        type="text"
        class="text-input"
        placeholder="https://api.openai.com/v1"
        @input="save"
      />
    </div>

    <!-- API密钥 -->
    <div class="setting-item">
      <label class="setting-label">
        <span class="label-text">API 密钥</span>
        <span class="label-desc">Bearer Token，留空则不发送认证头</span>
      </label>
      <div class="password-input-container">
        <input
          v-model="cfg.api_key"
          :type="showKey ? 'text' : 'password'"
          class="text-input"
          placeholder="sk-..."
          @input="save"
        />
        <button class="toggle-password-btn" @click="showKey = !showKey">{{ showKey ? '🙈' : '👁' }}</button>
      </div>
    </div>

    <!-- 模型名称 -->
    <div class="setting-item">
      <label class="setting-label">
        <span class="label-text">模型名称 *</span>
        <span class="label-desc">选择或手动输入模型名称</span>
      </label>
      <div class="model-select-container">
        <select v-model="cfg.model" class="format-select" :disabled="loadingModels" @change="save">
          <option value="">{{ loadingModels ? '加载中...' : '手动输入或选择模型' }}</option>
          <option v-for="m in availableModels" :key="m" :value="m">{{ m }}</option>
        </select>
        <button class="refresh-models-btn" :disabled="loadingModels" @click="fetchModels" title="获取模型列表">🔄</button>
      </div>
      <input
        v-model="cfg.model"
        type="text"
        class="text-input model-input-fallback"
        placeholder="输入模型名称，如 gpt-4o"
        @input="save"
      />
    </div>

    <div class="divider"></div>

    <!-- 温度 Temperature -->
    <div class="setting-item">
      <label class="setting-label">
        <span class="label-text">温度 (Temperature): {{ cfg.temperature }}</span>
        <span class="label-desc">控制输出随机性，0=确定，2=非常随机</span>
      </label>
      <input type="range" min="0" max="2" step="0.05" v-model.number="cfg.temperature" class="slider" @input="save" />
    </div>

    <!-- Top-P -->
    <div class="setting-item">
      <label class="setting-label">
        <span class="label-text">Top-P: {{ cfg.top_p }}</span>
        <span class="label-desc">核采样阈值，0=仅最高概率，1=全部候选</span>
      </label>
      <input type="range" min="0" max="1" step="0.05" v-model.number="cfg.top_p" class="slider" @input="save" />
    </div>

    <!-- Presence Penalty -->
    <div class="setting-item">
      <label class="setting-label">
        <span class="label-text">存在惩罚 (Presence Penalty): {{ cfg.presence_penalty }}</span>
        <span class="label-desc">惩罚重复话题，正值鼓励新话题</span>
      </label>
      <input type="range" min="-2" max="2" step="0.1" v-model.number="cfg.presence_penalty" class="slider" @input="save" />
    </div>

    <!-- Frequency Penalty -->
    <div class="setting-item">
      <label class="setting-label">
        <span class="label-text">频率惩罚 (Frequency Penalty): {{ cfg.frequency_penalty }}</span>
        <span class="label-desc">惩罚词频重复，正值减少重复用词</span>
      </label>
      <input type="range" min="-2" max="2" step="0.1" v-model.number="cfg.frequency_penalty" class="slider" @input="save" />
    </div>

    <!-- Max Tokens -->
    <div class="setting-item">
      <label class="setting-label">
        <span class="label-text">最大 Token 数: {{ cfg.max_tokens }}</span>
        <span class="label-desc">单次生成的最大输出长度</span>
      </label>
      <input type="range" min="256" max="32768" step="256" v-model.number="cfg.max_tokens" class="slider" @input="save" />
    </div>

    <div class="divider"></div>

    <!-- 测试连接 -->
    <div class="setting-item">
      <button class="test-btn" @click="testConnection" :disabled="testing">
        {{ testing ? '测试中...' : '🔌 测试连接' }}
      </button>
      <span v-if="testResult" :class="['test-result', testResult.success ? 'success' : 'fail']">
        {{ testResult.message }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue';

const showKey = ref(false);
const loadingModels = ref(false);
const testing = ref(false);
const testResult = ref<{ success: boolean; message: string } | null>(null);
const availableModels = ref<string[]>([]);

const cfg = reactive({
  base_url: 'https://api.openai.com/v1',
  api_key: '',
  model: 'gpt-4o',
  temperature: 0.7,
  top_p: 1.0,
  presence_penalty: 0.0,
  frequency_penalty: 0.0,
  max_tokens: 4096,
  enable_stream: true,
});

// 从后端加载当前配置
onMounted(async () => {
  try {
    const resp = await fetch('/api/config/api/current');
    if (resp.ok) {
      const data = await resp.json();
      if (data && data.base_url) Object.assign(cfg, data);
    }
  } catch (_e) { /* 使用默认值 */ }
});

// 保存到后端
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function save() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await fetch('/api/config/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_config_id: 'default',
          configs: { default: { id: 'default', name: '默认', ...cfg } },
        }),
      });
      testResult.value = null;
    } catch (e) {
      console.warn('保存 API 配置失败:', e);
    }
  }, 300);
}

// 获取模型列表
async function fetchModels() {
  loadingModels.value = true;
  testResult.value = null;
  try {
    const resp = await fetch('/api/config/api/models/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_url: cfg.base_url, api_key: cfg.api_key, model: cfg.model }),
    });
    const data = await resp.json();
    if (data.models && data.models.length > 0) {
      availableModels.value = data.models.map((m: any) => m.id || m);
      testResult.value = { success: true, message: `已加载 ${availableModels.value.length} 个模型` };
    } else {
      testResult.value = { success: false, message: '未获取到模型列表，请检查 API 地址和密钥' };
    }
  } catch (e: any) {
    testResult.value = { success: false, message: `获取失败: ${e.message}` };
  } finally {
    loadingModels.value = false;
  }
}

// 测试连接
async function testConnection() {
  testing.value = true;
  testResult.value = null;
  try {
    const resp = await fetch('/api/config/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_url: cfg.base_url, api_key: cfg.api_key, model: cfg.model }),
    });
    const data = await resp.json();
    testResult.value = data;
  } catch (e: any) {
    testResult.value = { success: false, message: `测试失败: ${e.message}` };
  } finally {
    testing.value = false;
  }
}
</script>

<style scoped>
.custom-api-settings {
  padding: 8px 0;
}
.section-title {
  margin: 0 0 4px 0;
  font-size: 16px;
  color: #ffd7a1;
}
.section-desc {
  margin: 0 0 12px 0;
  font-size: 12px;
  color: #9ca3af;
}
.divider {
  height: 1px;
  background: rgba(205, 133, 63, 0.2);
  margin: 14px 0;
}
.setting-item {
  margin-bottom: 14px;
}
.setting-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 6px;
}
.label-text {
  font-size: 13px;
  color: #f0e6d2;
  font-weight: 600;
}
.label-desc {
  font-size: 11px;
  color: #8b7355;
}
.text-input {
  width: 100%;
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(205, 133, 63, 0.3);
  border-radius: 6px;
  color: #f0e6d2;
  font-size: 13px;
  box-sizing: border-box;
}
.text-input:focus {
  outline: none;
  border-color: rgba(255, 120, 60, 0.6);
}
.password-input-container {
  display: flex;
  gap: 4px;
}
.password-input-container .text-input {
  flex: 1;
}
.toggle-password-btn {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(205, 133, 63, 0.3);
  border-radius: 6px;
  color: #f0e6d2;
  cursor: pointer;
  padding: 6px 10px;
  font-size: 14px;
}
.format-select {
  flex: 1;
  padding: 8px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(205, 133, 63, 0.3);
  border-radius: 6px;
  color: #f0e6d2;
  font-size: 13px;
}
.model-select-container {
  display: flex;
  gap: 4px;
  margin-bottom: 6px;
}
.refresh-models-btn {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(205, 133, 63, 0.3);
  border-radius: 6px;
  color: #f0e6d2;
  cursor: pointer;
  padding: 6px 10px;
}
.model-input-fallback {
  margin-top: 4px;
}
.slider {
  width: 100%;
  accent-color: #cd853f;
  cursor: pointer;
}
.test-btn {
  padding: 8px 20px;
  background: linear-gradient(180deg, rgba(205, 133, 63, 0.3), rgba(160, 100, 40, 0.3));
  border: 1px solid rgba(205, 133, 63, 0.5);
  border-radius: 6px;
  color: #ffd7a1;
  cursor: pointer;
  font-size: 13px;
}
.test-btn:hover { background: linear-gradient(180deg, rgba(255, 120, 60, 0.3), rgba(205, 133, 63, 0.3)); }
.test-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.test-result {
  display: inline-block;
  margin-left: 12px;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
}
.test-result.success { color: #22c55e; background: rgba(34, 197, 94, 0.1); }
.test-result.fail { color: #ef4444; background: rgba(239, 68, 68, 0.1); }
</style>
