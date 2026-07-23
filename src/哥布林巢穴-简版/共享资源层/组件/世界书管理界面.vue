<template>
  <div v-if="show" class="worldbook-overlay">
    <div class="worldbook-panel" @click.stop>
      <div class="panel-header">
        <h3>📖 世界书管理（测试功能请谨慎）</h3>
        <button class="close-btn" @click="close">×</button>
      </div>

      <div class="panel-content">
        <!-- 世界书选择 -->
        <div class="section">
          <label class="section-label">选择世界书：</label>
          <div class="worldbook-selector">
            <!-- 世界书列表选择 -->
            <div v-if="availableWorldbooks.length > 0" class="worldbook-list-container">
              <select v-model="currentWorldbookName" class="worldbook-select" @change="loadWorldbook">
                <option value="" disabled>请选择世界书</option>
                <option v-for="name in availableWorldbooks" :key="name" :value="name">
                  {{ name }}
                </option>
              </select>
            </div>
            <!-- 手动输入（当没有读取到列表时显示） -->
            <div v-else class="worldbook-input-row">
              <input
                v-model="currentWorldbookName"
                type="text"
                class="worldbook-input"
                placeholder="输入世界书名称"
                @blur="loadWorldbook"
              />
            </div>
            <div class="worldbook-buttons">
              <button v-if="currentWorldbookName" class="action-btn" @click="loadWorldbook">🔍 加载</button>
              <button v-if="currentWorldbookName" class="action-btn secondary" @click="refreshWorldbook">
                🔄 刷新
              </button>
              <button class="action-btn secondary" @click="loadAllWorldbooks">📚 读取所有世界书</button>
            </div>
          </div>
        </div>

        <!-- 加载状态 -->
        <div v-if="loading" class="loading-indicator">加载中...</div>

        <!-- 错误信息 -->
        <div v-if="error" class="error-message">{{ error }}</div>

        <!-- 条目列表 -->
        <div v-if="!loading && !error && entries.length > 0" class="entries-container">
          <div class="entries-header">
            <span class="entries-count">共 {{ entries.length }} 个条目</span>
            <div class="entries-header-buttons">
              <button class="action-btn" @click="saveAllChanges">💾 保存所有更改</button>
            </div>
          </div>

          <div class="entries-list">
            <div
              v-for="(entry, index) in entries"
              :key="entry.uid || index"
              class="entry-card"
              :class="{ 'entry-disabled': !entry.enabled, 'entry-expanded': entryExpanded[index] }"
            >
              <!-- 折叠的头部信息 -->
              <div class="entry-header-collapsed" @click="toggleEntryExpanded(index)">
                <div class="entry-header-left">
                  <div class="entry-icon">
                    <span v-if="entryExpanded[index]">▼</span>
                    <span v-else>▶</span>
                  </div>
                  <div class="entry-info">
                    <div class="entry-name-row">
                      <span class="entry-name-display">{{ entry.name || '未命名条目' }}</span>
                      <span v-if="dirtyEntries.has(index)" class="dirty-badge">未保存</span>
                      <span class="type-badge" :class="{ 'type-highlight': entry.extra?.entry_type }">
                        {{ entry.extra?.entry_type || '未分类' }}
                      </span>
                    </div>
                    <div class="entry-meta-collapsed">
                      <span class="meta-text">UID: {{ entry.uid }}</span>
                      <span class="meta-divider">|</span>
                      <span class="meta-text">深度: {{ entry.position.depth }}</span>
                      <span class="meta-divider">|</span>
                      <span class="meta-text">
                        扫描深度:
                        {{
                          entry.strategy.scan_depth === 'same_as_global' ? 'same_as_global' : entry.strategy.scan_depth
                        }}
                      </span>
                      <span class="meta-divider">|</span>
                      <span class="meta-text">字符数: {{ entry.content?.length || 0 }}</span>
                    </div>
                  </div>
                </div>
                <div class="entry-header-right">
                  <label class="toggle-switch" @click.stop>
                    <input v-model="entry.enabled" type="checkbox" @change="markDirty(index)" />
                    <span class="toggle-slider"></span>
                  </label>
                </div>
              </div>

              <!-- 展开的详细内容 -->
              <div v-if="entryExpanded[index]" class="entry-body-expanded">
                <!-- 基本信息区域 -->
                <div class="entry-section">
                  <h4 class="section-title">基本信息</h4>
                  <div class="section-content">
                    <div class="entry-field">
                      <label class="field-label">
                        <span class="label-title">条目名称</span>
                        <span class="label-desc">显示在世界书中的名称</span>
                      </label>
                      <input
                        v-model="entry.name"
                        type="text"
                        class="text-input"
                        placeholder="条目名称"
                        @input="markDirty(index)"
                      />
                    </div>

                    <div class="entry-field-row">
                      <div class="entry-field half">
                        <label class="field-label">
                          <span class="label-title">深度 (position.depth)</span>
                          <span class="label-desc">控制条目在提示词中的位置</span>
                        </label>
                        <div class="field-control-group">
                          <input
                            v-model.number="entry.position.depth"
                            type="number"
                            class="number-input"
                            min="0"
                            @input="markDirty(index)"
                          />
                          <span class="field-hint-inline">值越大位置越靠前</span>
                        </div>
                      </div>

                      <div class="entry-field half">
                        <label class="field-label">
                          <span class="label-title">扫描深度 (strategy.scan_depth)</span>
                          <span class="label-desc">控制匹配时的扫描范围</span>
                        </label>
                        <div class="field-control-group">
                          <label class="radio-option">
                            <input
                              :checked="entry.strategy.scan_depth === 'same_as_global'"
                              type="radio"
                              :name="`scan_depth_${index}`"
                              @change="
                                entry.strategy.scan_depth = 'same_as_global';
                                markDirty(index);
                              "
                            />
                            <span>same_as_global</span>
                          </label>
                          <label class="radio-option">
                            <input
                              :checked="typeof entry.strategy.scan_depth === 'number'"
                              type="radio"
                              :name="`scan_depth_${index}`"
                              @change="
                                entry.strategy.scan_depth = 5;
                                markDirty(index);
                              "
                            />
                            <span>自定义:</span>
                            <input
                              v-if="typeof entry.strategy.scan_depth === 'number'"
                              v-model.number="entry.strategy.scan_depth"
                              type="number"
                              class="number-input inline"
                              min="0"
                              @input="markDirty(index)"
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 策略设置区域 -->
                <div class="entry-section">
                  <h4 class="section-title">策略设置</h4>
                  <div class="section-content">
                    <div class="entry-field">
                      <label class="field-label">
                        <span class="label-title">策略键 (strategy.keys)</span>
                        <span class="label-desc">每行一个关键词，用于匹配条目</span>
                      </label>
                      <textarea
                        v-model="strategyKeysText[index]"
                        class="textarea-input"
                        rows="4"
                        placeholder="每行输入一个关键词&#10;例如：&#10;人物名称&#10;角色名称"
                        @input="updateStrategyKeys(index, $event)"
                      ></textarea>
                      <div class="field-hint">当前关键词数量: {{ entry.strategy.keys?.length || 0 }}</div>
                    </div>
                  </div>
                </div>

                <!-- 内容编辑区域 -->
                <div class="entry-section">
                  <div class="section-header">
                    <h4 class="section-title">内容 (content)</h4>
                    <button class="expand-content-btn" @click="toggleContentExpanded(index)">
                      {{ contentExpanded[index] ? '📄 收起' : '📄 展开完整编辑' }}
                    </button>
                  </div>
                  <div class="section-content">
                    <div class="entry-field">
                      <textarea
                        v-model="entry.content"
                        class="textarea-input content-textarea"
                        :class="{ expanded: contentExpanded[index] }"
                        :rows="contentExpanded[index] ? 25 : 8"
                        placeholder="输入条目内容..."
                        @input="markDirty(index)"
                      ></textarea>
                      <div class="content-stats-bar">
                        <span class="stat-item">字符数: {{ entry.content?.length || 0 }}</span>
                        <span class="stat-divider">|</span>
                        <span class="stat-item">行数: {{ (entry.content?.match(/\n/g) || []).length + 1 }}</span>
                        <span class="stat-divider">|</span>
                        <span class="stat-item">
                          约
                          {{ Math.ceil(((entry.content?.length || 0) / 4) * 1.3) }}
                          tokens
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 操作按钮区域 -->
                <div class="entry-actions-expanded">
                  <div class="entry-actions-buttons">
                    <button class="action-btn primary" @click="saveSingleEntry(index)">💾 保存此项</button>
                    <button class="action-btn danger" @click="deleteEntry(index)">🗑️ 删除条目</button>
                  </div>
                  <span v-if="dirtyEntries.has(index)" class="dirty-indicator-large">⚠️ 有未保存的更改</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-if="!loading && !error && entries.length === 0" class="empty-state">
          <p>当前世界书为空</p>
          <button class="action-btn" @click="loadWorldbook">加载世界书</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { WorldbookHelper } from '../../核心层/服务/世界书管理/工具/世界书助手';
import type { WorldbookEntry } from '../../核心层/服务/世界书管理/类型/世界书类型定义';
import { toast } from '../../核心层/服务/通用服务/弹窗提示服务';
import { ConfirmService } from '../../核心层/服务/通用服务/确认框服务';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const currentWorldbookName = ref('哥布林巢穴-人物档案');
const entries = ref<WorldbookEntry[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const dirtyEntries = ref(new Set<number>());
const contentExpanded = ref<Record<number, boolean>>({});
const strategyKeysText = ref<Record<number, string>>({});
const entryExpanded = ref<Record<number, boolean>>({});
const availableWorldbooks = ref<string[]>([]);

// 监听显示状态，自动加载世界书
watch(
  () => props.show,
  newVal => {
    if (newVal) {
      loadAllWorldbooks();
      loadWorldbook();
    }
  },
);

// 加载世界书
const loadWorldbook = async () => {
  const worldbookName = currentWorldbookName.value?.trim();
  if (!worldbookName) {
    error.value = '请输入世界书名称';
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    // 确保世界书存在
    await WorldbookHelper.ensureExists(worldbookName);

    // 获取世界书内容
    const worldbook = await WorldbookHelper.get(worldbookName);
    entries.value = worldbook || [];
    dirtyEntries.value.clear();

    console.log(`📖 [世界书管理] 已加载 "${worldbookName}"，条目数: ${entries.value.length}`);
    if (entries.value.length > 0) {
      const types = [...new Set(entries.value.map(e => e.extra?.entry_type || 'unknown'))];
      console.log(`📖 [世界书管理] 条目类型: ${types.join(', ')}`);
    }

    // ★ 防御性处理：为缺少 strategy 的条目填充默认结构（兼容旧格式/异常数据）
    entries.value.forEach((entry: any) => {
      if (!entry.strategy) {
        entry.strategy = {
          type: 'selective',
          keys: [],
          keys_secondary: { logic: 'and_any', keys: [] },
          scan_depth: 'same_as_global',
        };
      }
      if (!entry.position) {
        entry.position = { type: 'at_depth', role: 'system', depth: 4, order: 100 };
      }
      if (!entry.recursion) {
        entry.recursion = { prevent_incoming: true, prevent_outgoing: true, delay_until: null };
      }
      if (!entry.effect) {
        entry.effect = { sticky: null, cooldown: null, delay: null };
      }
      if (entry.enabled === undefined) {
        entry.enabled = true;
      }
      if (entry.probability === undefined) {
        entry.probability = 100;
      }
      if (entry.name === undefined) {
        entry.name = entry.comment || `条目_${entry.uid || 0}`;
      }
    });

    // 初始化策略键文本
    entries.value.forEach((entry, index) => {
      strategyKeysText.value[index] = Array.isArray(entry.strategy.keys)
        ? entry.strategy.keys.map(k => (typeof k === 'string' ? k : k.toString())).join('\n')
        : '';
    });

    toast.success(`已加载 ${entries.value.length} 个条目`, { title: '加载成功' });
  } catch (err: any) {
    const errorMessage = err.message || '加载世界书失败';
    error.value = errorMessage;
    toast.error(errorMessage, { title: '加载失败' });
  } finally {
    loading.value = false;
  }
};

// 刷新世界书
const refreshWorldbook = () => {
  loadWorldbook();
};

// 读取所有世界书列表
const loadAllWorldbooks = async () => {
  try {
    const worldbookNames = getWorldbookNames();
    availableWorldbooks.value = worldbookNames || [];
    if (availableWorldbooks.value.length > 0) {
      console.log(`已读取 ${availableWorldbooks.value.length} 个世界书:`, availableWorldbooks.value);
    }
  } catch (err: any) {
    console.error('读取世界书列表失败:', err);
    availableWorldbooks.value = [];
  }
};

// 标记条目为已修改
const markDirty = (index: number) => {
  dirtyEntries.value.add(index);
};

// 更新策略键
const updateStrategyKeys = (index: number, event: Event) => {
  const textarea = event.target as HTMLTextAreaElement;
  const text = textarea.value;
  strategyKeysText.value[index] = text;

  const keys = text
    .split('\n')
    .map(k => k.trim())
    .filter(k => k.length > 0);

  entries.value[index].strategy.keys = keys;
  markDirty(index);
};

// 切换条目展开状态
const toggleEntryExpanded = (index: number) => {
  entryExpanded.value[index] = !entryExpanded.value[index];
};

// 切换内容展开状态
const toggleContentExpanded = (index: number) => {
  contentExpanded.value[index] = !contentExpanded.value[index];
};

// 保存单个条目
const saveSingleEntry = async (index: number) => {
  const worldbookName = currentWorldbookName.value?.trim() || '哥布林巢穴-人物档案';
  try {
    loading.value = true;

    // 确保世界书存在
    await WorldbookHelper.ensureExists(worldbookName);

    // 获取当前世界书内容
    const worldbook = await WorldbookHelper.get(worldbookName);

    // 找到并更新对应条目
    const entryIndex = worldbook.findIndex(e => e.uid === entries.value[index].uid);
    if (entryIndex !== -1) {
      worldbook[entryIndex] = entries.value[index];
    } else {
      // 如果找不到（可能是新条目），添加到最后
      worldbook.push(entries.value[index]);
    }

    // 保存世界书
    await WorldbookHelper.replace(worldbookName, worldbook);

    // 清除已修改标记
    dirtyEntries.value.delete(index);

    toast.success('条目已保存', { title: '保存成功' });
  } catch (err: any) {
    toast.error(err.message || '保存失败', { title: '保存失败' });
  } finally {
    loading.value = false;
  }
};

// 保存所有更改
const saveAllChanges = async () => {
  if (dirtyEntries.value.size === 0) {
    toast.info('没有需要保存的更改');
    return;
  }

  const worldbookName = currentWorldbookName.value?.trim() || '哥布林巢穴-人物档案';
  try {
    loading.value = true;

    const savedCount = dirtyEntries.value.size;

    // 确保世界书存在
    await WorldbookHelper.ensureExists(worldbookName);

    // 获取当前世界书内容
    const worldbook = await WorldbookHelper.get(worldbookName);

    // 更新所有已修改的条目
    dirtyEntries.value.forEach(index => {
      const entry = entries.value[index];
      const entryIndex = worldbook.findIndex(e => e.uid === entry.uid);
      if (entryIndex !== -1) {
        worldbook[entryIndex] = entry;
      } else {
        worldbook.push(entry);
      }
    });

    // 保存世界书
    await WorldbookHelper.replace(worldbookName, worldbook);

    // 清除所有已修改标记
    dirtyEntries.value.clear();

    toast.success(`已保存 ${savedCount} 个条目的更改`, { title: '保存成功' });
  } catch (err: any) {
    toast.error(err.message || '保存失败', { title: '保存失败' });
  } finally {
    loading.value = false;
  }
};

// 删除条目
const deleteEntry = async (index: number) => {
  const result = await ConfirmService.showDanger(
    `确定要删除条目 "${entries.value[index].name}" 吗？`,
    '删除确认',
    '此操作不可恢复，请谨慎操作。',
  );
  if (!result) {
    return;
  }

  const worldbookName = currentWorldbookName.value?.trim() || '哥布林巢穴-人物档案';
  try {
    loading.value = true;

    // 确保世界书存在
    await WorldbookHelper.ensureExists(worldbookName);

    // 获取当前世界书内容
    const worldbook = await WorldbookHelper.get(worldbookName);

    // 删除对应条目
    const uid = entries.value[index].uid;
    const filtered = worldbook.filter(e => e.uid !== uid);

    // 保存世界书
    await WorldbookHelper.replace(worldbookName, filtered);

    // 从本地列表移除
    entries.value.splice(index, 1);
    dirtyEntries.value.delete(index);
    delete contentExpanded.value[index];
    delete strategyKeysText.value[index];
    delete entryExpanded.value[index];

    toast.success('条目已删除', { title: '删除成功' });
  } catch (err: any) {
    toast.error(err.message || '删除失败', { title: '删除失败' });
  } finally {
    loading.value = false;
  }
};

// 关闭面板
const close = async () => {
  if (dirtyEntries.value.size > 0) {
    const result = await ConfirmService.showWarning(
      `有 ${dirtyEntries.value.size} 个条目未保存，确定要关闭吗？`,
      '关闭确认',
      '关闭后未保存的更改将丢失。',
    );
    if (!result) {
      return;
    }
  }
  emit('close');
};
</script>

<style scoped lang="scss">
.worldbook-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
}

.worldbook-panel {
  width: 90vw;
  max-width: 1200px;
  height: 85vh;
  background: linear-gradient(180deg, rgba(40, 26, 20, 0.95), rgba(25, 17, 14, 0.98));
  border: 2px solid rgba(205, 133, 63, 0.3);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(205, 133, 63, 0.3);
  background: linear-gradient(180deg, rgba(50, 35, 28, 0.9), rgba(40, 26, 20, 0.9));

  h3 {
    margin: 0;
    color: #ffd7a1;
    font-size: 20px;
    font-weight: 700;
  }

  .close-btn {
    width: 32px;
    height: 32px;
    border: none;
    background: rgba(205, 133, 63, 0.2);
    color: #f0e6d2;
    border-radius: 6px;
    cursor: pointer;
    font-size: 24px;
    line-height: 1;
    transition: all 0.2s ease;

    &:hover {
      background: rgba(205, 133, 63, 0.4);
      transform: scale(1.1);
    }
  }
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}

.section {
  margin-bottom: 24px;
}

.section-label {
  display: block;
  color: #ffe9d2;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
}

.worldbook-selector {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.worldbook-list-container {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .worldbook-list-label {
    color: #ffe9d2;
    font-size: 13px;
    font-weight: 600;
  }

  .worldbook-select {
    width: 100%;
    padding: 10px 12px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(205, 133, 63, 0.3);
    border-radius: 8px;
    color: #f0e6d2;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;

    &:focus {
      outline: none;
      border-color: rgba(205, 133, 63, 0.6);
      box-shadow: 0 0 0 2px rgba(205, 133, 63, 0.2);
    }

    &:hover {
      border-color: rgba(205, 133, 63, 0.5);
    }

    option {
      background: rgba(25, 17, 14, 0.98);
      color: #f0e6d2;
    }
  }
}

.worldbook-input-row {
  display: flex;
  width: 100%;

  .worldbook-input {
    flex: 1;
    padding: 10px 12px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(205, 133, 63, 0.3);
    border-radius: 8px;
    color: #f0e6d2;
    font-size: 14px;

    &:focus {
      outline: none;
      border-color: rgba(205, 133, 63, 0.6);
    }
  }
}

.worldbook-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;

  .action-btn {
    width: 100%;
  }
}

.loading-indicator,
.error-message {
  text-align: center;
  padding: 20px;
  color: #f0e6d2;
}

.error-message {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
}

.entries-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.entries-header {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid rgba(205, 133, 63, 0.2);

  .entries-count {
    color: #ffe9d2;
    font-size: 14px;
    font-weight: 600;
  }

  .entries-header-buttons {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .action-btn {
      width: 100%;
    }
  }
}

.entries-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.entry-card {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(205, 133, 63, 0.3);
  border-radius: 12px;
  transition: all 0.2s ease;
  overflow: hidden;

  &:hover {
    border-color: rgba(205, 133, 63, 0.5);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  &.entry-disabled {
    opacity: 0.7;
    background: rgba(0, 0, 0, 0.1);
  }

  &.entry-expanded {
    border-color: rgba(205, 133, 63, 0.5);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
  }
}

/* 折叠的头部 */
.entry-header-collapsed {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: rgba(0, 0, 0, 0.1);

  &:hover {
    background: rgba(0, 0, 0, 0.2);
  }
}

.entry-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.entry-icon {
  color: rgba(205, 133, 63, 0.6);
  font-size: 12px;
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.entry-info {
  flex: 1;
  min-width: 0;
}

.entry-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}

.entry-name-display {
  color: #ffe9d2;
  font-size: 15px;
  font-weight: 600;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dirty-badge {
  padding: 2px 6px;
  background: rgba(245, 158, 11, 0.3);
  border: 1px solid rgba(245, 158, 11, 0.5);
  border-radius: 4px;
  color: #fbbf24;
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
}

.type-badge {
  padding: 3px 8px;
  background: rgba(107, 114, 128, 0.2);
  border: 1px solid rgba(107, 114, 128, 0.3);
  border-radius: 4px;
  color: #9ca3af;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;

  &.type-highlight {
    color: #a855f7;
    background: rgba(168, 85, 247, 0.2);
    border-color: rgba(168, 85, 247, 0.3);
  }
}

.entry-meta-collapsed {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #9ca3af;
  flex-wrap: wrap;
}

.meta-text {
  white-space: nowrap;
}

.meta-divider {
  color: rgba(107, 114, 128, 0.4);
}

.entry-header-right {
  flex-shrink: 0;
  margin-left: 12px;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 24px;

  input {
    opacity: 0;
    width: 0;
    height: 0;

    &:checked + .toggle-slider {
      background-color: #22c55e;

      &::before {
        transform: translateX(24px);
      }
    }
  }

  .toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #6b7280;
    transition: 0.3s;
    border-radius: 24px;

    &::before {
      position: absolute;
      content: '';
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: 0.3s;
      border-radius: 50%;
    }
  }
}

/* 展开的详细内容 */
.entry-body-expanded {
  border-top: 1px solid rgba(205, 133, 63, 0.2);
  background: rgba(0, 0, 0, 0.15);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.entry-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-title {
  color: #ffd7a1;
  font-size: 16px;
  font-weight: 700;
  margin: 0;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(205, 133, 63, 0.2);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(205, 133, 63, 0.2);
}

.section-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 8px;
}

.entry-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.entry-field-row {
  display: flex;
  gap: 16px;

  .entry-field.half {
    flex: 1;
    min-width: 0;
  }
}

.field-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: #ffe9d2;
  font-size: 13px;
  font-weight: 600;

  .label-title {
    color: #ffe9d2;
    font-weight: 600;
  }

  .label-desc {
    font-size: 11px;
    font-weight: 400;
    color: #9ca3af;
  }
}

.field-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #ffe9d2;
  font-size: 13px;
  font-weight: 600;

  .field-hint {
    font-size: 11px;
    font-weight: 400;
    color: #9ca3af;
    margin-left: 8px;
  }
}

.field-control-group {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.field-hint-inline {
  color: #9ca3af;
  font-size: 11px;
}

.text-input {
  width: 100%;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(205, 133, 63, 0.3);
  border-radius: 8px;
  color: #f0e6d2;
  font-size: 14px;

  &:focus {
    outline: none;
    border-color: rgba(205, 133, 63, 0.6);
  }
}

.radio-option {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #f0e6d2;
  font-size: 12px;
  cursor: pointer;
  padding: 6px 10px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(205, 133, 63, 0.2);
  border-radius: 6px;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(0, 0, 0, 0.3);
    border-color: rgba(205, 133, 63, 0.4);
  }

  input[type='radio'] {
    margin: 0;
    cursor: pointer;
  }
}

.number-input {
  width: 100px;
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(205, 133, 63, 0.3);
  border-radius: 6px;
  color: #f0e6d2;
  font-size: 13px;

  &.small {
    width: 70px;
  }

  &.inline {
    width: 80px;
  }

  &:focus {
    outline: none;
    border-color: rgba(205, 133, 63, 0.6);
  }
}

.textarea-input {
  width: 100%;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(205, 133, 63, 0.3);
  border-radius: 8px;
  color: #f0e6d2;
  font-size: 13px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  line-height: 1.5;
  resize: vertical;

  &:focus {
    outline: none;
    border-color: rgba(205, 133, 63, 0.6);
  }

  &.content-textarea {
    min-height: 120px;

    &.expanded {
      min-height: 400px;
    }
  }
}

.expand-content-btn {
  padding: 6px 12px;
  background: rgba(205, 133, 63, 0.2);
  border: 1px solid rgba(205, 133, 63, 0.3);
  border-radius: 6px;
  color: #f0e6d2;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(205, 133, 63, 0.3);
    border-color: rgba(205, 133, 63, 0.5);
  }
}

.content-stats-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #9ca3af;
  padding-top: 6px;
}

.stat-item {
  white-space: nowrap;
}

.stat-divider {
  color: rgba(107, 114, 128, 0.4);
}

.field-hint {
  color: #9ca3af;
  font-size: 11px;
  font-style: italic;
}

.entry-actions-expanded {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid rgba(205, 133, 63, 0.2);
  margin-top: 8px;

  .entry-actions-buttons {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .action-btn {
      width: 100%;
    }
  }
}

.action-btn {
  padding: 10px 18px;
  background: linear-gradient(180deg, rgba(205, 133, 63, 0.3), rgba(205, 133, 63, 0.2));
  border: 1px solid rgba(205, 133, 63, 0.4);
  border-radius: 8px;
  color: #f0e6d2;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;

  &:hover {
    background: linear-gradient(180deg, rgba(205, 133, 63, 0.4), rgba(205, 133, 63, 0.3));
    border-color: rgba(205, 133, 63, 0.6);
    transform: translateY(-1px);
  }

  &.small {
    padding: 6px 12px;
    font-size: 12px;
  }

  &.primary {
    background: linear-gradient(180deg, rgba(34, 197, 94, 0.3), rgba(34, 197, 94, 0.2));
    border-color: rgba(34, 197, 94, 0.4);

    &:hover {
      background: linear-gradient(180deg, rgba(34, 197, 94, 0.4), rgba(34, 197, 94, 0.3));
      border-color: rgba(34, 197, 94, 0.6);
    }
  }

  &.secondary {
    background: linear-gradient(180deg, rgba(107, 114, 128, 0.3), rgba(107, 114, 128, 0.2));
    border-color: rgba(107, 114, 128, 0.4);

    &:hover {
      background: linear-gradient(180deg, rgba(107, 114, 128, 0.4), rgba(107, 114, 128, 0.3));
      border-color: rgba(107, 114, 128, 0.6);
    }
  }

  &.danger {
    background: linear-gradient(180deg, rgba(239, 68, 68, 0.3), rgba(239, 68, 68, 0.2));
    border-color: rgba(239, 68, 68, 0.4);

    &:hover {
      background: linear-gradient(180deg, rgba(239, 68, 68, 0.4), rgba(239, 68, 68, 0.3));
      border-color: rgba(239, 68, 68, 0.6);
    }
  }
}

.dirty-indicator {
  color: #f59e0b;
  font-size: 11px;
  font-weight: 600;
  margin-left: auto;
}

.dirty-indicator-large {
  color: #f59e0b;
  font-size: 13px;
  font-weight: 600;
  margin-left: auto;
  padding: 8px 12px;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 6px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #9ca3af;

  p {
    margin-bottom: 16px;
    font-size: 16px;
  }
}

/* 滚动条样式 */
.panel-content::-webkit-scrollbar {
  width: 8px;
}

.panel-content::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

.panel-content::-webkit-scrollbar-thumb {
  background: rgba(205, 133, 63, 0.3);
  border-radius: 4px;

  &:hover {
    background: rgba(205, 133, 63, 0.5);
  }
}
</style>
