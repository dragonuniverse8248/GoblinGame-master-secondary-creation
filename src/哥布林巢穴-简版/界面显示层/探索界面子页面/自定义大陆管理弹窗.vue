<template>
  <div v-if="show" class="custom-continent-modal-overlay">
    <div class="custom-continent-modal" @click.stop>
      <div class="modal-header">
        <h3>🌍 自定义大陆管理</h3>
        <button class="close-button" @click="handleClose">×</button>
      </div>

      <div class="modal-content">
        <!-- 操作按钮栏 -->
        <div class="action-bar">
          <div class="add-mode-group">
            <button class="btn-add" @click="handleAddContinent">
              <span class="icon">➕</span>
              <span>手动添加</span>
            </button>
            <button class="btn-add-ai" @click="handleAIGenerateContinent">
              <span class="icon">🤖</span>
              <span>AI生成</span>
            </button>
          </div>
          <button class="btn-import" @click="handleImport">
            <span class="icon">📥</span>
            <span>导入配置</span>
          </button>
          <button class="btn-export" @click="showExportModal = true">
            <span class="icon">📤</span>
            <span>导出配置</span>
          </button>
          <input ref="fileInputRef" type="file" accept=".zip,.json" style="display: none" @change="handleFileSelect" />
        </div>

        <!-- 自定义大陆列表 -->
        <div class="continent-list">
          <div v-if="customContinents.length === 0" class="empty-state">
            <div class="empty-icon">🗺️</div>
            <div class="empty-text">暂无自定义大陆</div>
            <div class="empty-hint">点击"添加新大陆"按钮开始创建</div>
          </div>

          <div v-for="continent in customContinents" :key="continent.name" class="continent-item">
            <div class="continent-header">
              <div class="continent-info">
                <span class="continent-icon">{{ continent.icon }}</span>
                <div class="continent-details">
                  <div class="continent-name">{{ continent.name }}</div>
                  <div class="continent-meta">
                    <span class="meta-item">难度: {{ continent.difficulty }}⭐</span>
                    <span class="meta-item">区域数: {{ continent.regions.length }}</span>
                    <span v-if="continent.metadata?.createdAt" class="meta-item">
                      创建于: {{ formatDate(continent.metadata.createdAt) }}
                    </span>
                  </div>
                </div>
              </div>
              <div class="continent-actions">
                <button class="btn-edit" @click="handleEditContinent(continent)">
                  <span class="icon">✏️</span>
                  <span>编辑</span>
                </button>
                <button class="btn-delete" @click="handleDeleteContinent(continent.name)">
                  <span class="icon">🗑️</span>
                  <span>删除</span>
                </button>
              </div>
            </div>
            <div v-if="continent.description" class="continent-description">{{ continent.description }}</div>
          </div>
        </div>
      </div>

      <!-- 编辑/添加表单弹窗 -->
      <div v-if="showEditModal" class="edit-modal-overlay">
        <div class="edit-modal" @click.stop>
          <div class="edit-modal-header">
            <h4>{{ editingContinent ? '编辑大陆' : '添加新大陆' }}</h4>
            <button class="close-button" @click="closeEditModal">×</button>
          </div>

          <div class="edit-modal-content">
            <form @submit.prevent="handleSaveContinent">
              <!-- 基本信息 -->
              <div class="form-group">
                <label>大陆名称 <span class="required">*</span></label>
                <input v-model="formData.name" type="text" required placeholder="请输入大陆名称" />
              </div>

              <div class="form-group">
                <label>大陆图标 <span class="required">*</span></label>
                <input v-model="formData.icon" type="text" required placeholder="如: 🌍" maxlength="2" />
              </div>

              <div class="form-group">
                <label>大陆描述</label>
                <textarea v-model="formData.description" rows="3" placeholder="请输入大陆描述"></textarea>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>难度等级 <span class="required">*</span></label>
                  <input
                    v-model.number="formData.difficulty"
                    type="number"
                    min="1"
                    max="10"
                    required
                    placeholder="1-10"
                  />
                </div>

                <div class="form-group">
                  <label>威胁倍数</label>
                  <input
                    v-model.number="formData.threatMultiplier"
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="1.0"
                  />
                </div>
              </div>

              <!-- 探索成本 -->
              <div class="form-section">
                <h5>探索成本</h5>
                <div class="form-row">
                  <div class="form-group">
                    <label>金币 <span class="required">*</span></label>
                    <input v-model.number="formData.explorationCost!.gold" type="number" min="0" required />
                  </div>
                  <div class="form-group">
                    <label>食物 <span class="required">*</span></label>
                    <input v-model.number="formData.explorationCost!.food" type="number" min="0" required />
                  </div>
                </div>
              </div>

              <!-- 解锁条件（暂时禁用：自定义大陆默认解锁） -->
              <!-- <div class="form-section">
                <h5>解锁条件</h5>
                <div class="form-group">
                  <label>前置大陆（可选）</label>
                  <select v-model="formData.unlockCondition!.previousContinentName">
                    <option value="">无前置</option>
                    <option v-for="c in allContinents" :key="c.name" :value="c.name">
                      {{ c.name }}
                    </option>
                  </select>
                </div>
                <div class="form-group">
                  <label>需要征服百分比</label>
                  <input
                    v-model.number="formData.unlockCondition!.conquestPercentage"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="50"
                  />
                </div>
              </div> -->

              <!-- 区域列表 -->
              <div class="form-section">
                <div class="section-header">
                  <h5>区域列表</h5>
                  <button type="button" class="btn-add-region" @click="handleAddRegion">
                    <span class="icon">➕</span>
                    <span>添加区域</span>
                  </button>
                </div>

                <div v-if="!formData.regions || formData.regions.length === 0" class="empty-regions">
                  <div class="empty-text">暂无区域，点击"添加区域"按钮添加</div>
                </div>

                <template v-if="formData.regions">
                  <div v-for="(region, index) in formData.regions" :key="index" class="region-item">
                    <div class="region-header">
                      <span class="region-icon">{{ region.icon }}</span>
                      <input
                        v-model="region.name"
                        type="text"
                        placeholder="区域名称"
                        class="region-name-input"
                        required
                      />
                      <button type="button" class="btn-remove-region" @click="handleRemoveRegion(index)">删除</button>
                    </div>
                    <div class="region-details">
                      <div class="form-row">
                        <div class="form-group">
                          <label>图标</label>
                          <input v-model="region.icon" type="text" placeholder="如: 🏘️" maxlength="2" />
                        </div>
                        <div class="form-group">
                          <label>难度</label>
                          <input v-model.number="region.difficulty" type="number" min="1" max="10" placeholder="1" />
                        </div>
                        <!-- 解锁星级和征服星级（暂时禁用：自定义区域默认解锁） -->
                        <!-- <div class="form-group">
                          <label>解锁星级</label>
                          <input v-model.number="region.unlockStars" type="number" min="0" placeholder="0" />
                        </div> -->
                        <div class="form-group">
                          <label>征服星级</label>
                          <input v-model.number="region.requiredStars" type="number" min="0" placeholder="0" />
                        </div>
                      </div>
                      <div class="form-group">
                        <label>描述</label>
                        <textarea v-model="region.description" rows="2" placeholder="区域描述"></textarea>
                      </div>
                      <div class="form-group">
                        <label>🏰 首都名称</label>
                        <input v-model="region.capital" type="text" placeholder="输入首都名称后，传说人物可绑定至此" />
                        <div v-if="region.capital" class="form-hint" style="color:#8b5cf6">
                          此首都将自动生成据点，传说级人物可挂载为守护英雄
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
              </div>

              <!-- 传说级人物管理 -->
              <div class="form-section legendary-section">
                <div class="section-header">
                  <h5>👑 传说级人物（从 images 索引加载）</h5>
                  <button type="button" class="btn-match-index" @click="handleMatchFromIndex" :disabled="!formData.name">
                    <span>🔍 搜索索引</span>
                  </button>
                </div>

                <!-- 索引匹配提示 -->
                <div v-if="legendaryMatchResult" class="legendary-match-info">
                  <span class="match-icon">{{ legendaryMatchResult.existing ? '✅' : '⚠️' }}</span>
                  <span>{{ legendaryMatchResult.message }}</span>
                  <button v-if="legendaryMatchResult.existing" type="button" class="btn-import-all" @click="handleImportAllLegendary">
                    📋 全部导入 ({{ legendaryMatchResult.count }}人)
                  </button>
                </div>

                <div v-if="legendaryCharacters.length === 0" class="empty-regions">
                  <div class="empty-text">
                    {{ formData.name ? '点击"搜索索引"查找 images 中的传说人物' : '请先输入大陆名称' }}
                  </div>
                </div>

                <!-- 首都绑定提示 -->
                <div v-if="legendaryCharacters.length > 0 && capitalRegions.length === 0" class="legendary-match-info" style="border-color: rgba(251,191,36,0.4); background: rgba(251,191,36,0.08)">
                  <span class="match-icon">💡</span>
                  <span>先在"区域列表"中为区域填写🏰首都名称，即可在此绑定传说英雄</span>
                </div>

                <!-- 人物列表 -->
                <div v-for="(char, index) in legendaryCharacters" :key="index" class="legendary-item">
                  <div class="legendary-header">
                    <span class="legendary-name">{{ char.name }}</span>
                    <span v-if="char.title" class="legendary-title">{{ char.title }}</span>
                    <span class="legendary-race">{{ char.race || '未知种族' }}</span>
                    <span v-if="char.images && char.images.length > 0" class="legendary-images-badge">
                      🖼️ {{ char.images.length }}张
                    </span>
                    <div class="legendary-actions">
                      <select v-model="char.boundRegionName" class="legendary-capital-select" @click.stop>
                        <option value="">不绑定</option>
                        <option v-for="r in capitalRegions" :key="r.name" :value="r.name">
                          🏰 {{ r.name }}·{{ r.capital }}
                        </option>
                      </select>
                      <button type="button" class="btn-delete-small" @click="handleRemoveLegendary(index)">✕</button>
                    </div>
                  </div>
                  <div v-if="char.background" class="legendary-bg">{{ char.background }}</div>
                </div>
              </div>
            </form>
          </div>

          <div class="edit-modal-actions">
            <button class="btn-cancel" @click="closeEditModal">取消</button>
            <button class="btn-save" :disabled="isSaving" @click="handleSaveContinent">
              {{ isSaving ? '保存中...' : '保存' }}
            </button>
          </div>
        </div>
      </div>

      <!-- AI生成弹窗 -->
      <div v-if="showAIGenerateModal" class="ai-generate-modal-overlay">
        <div class="ai-generate-modal" @click.stop>
          <div class="ai-generate-modal-header">
            <h4>🤖 AI生成大陆</h4>
            <button class="close-button" @click="closeAIGenerateModal">×</button>
          </div>

          <div class="ai-generate-modal-content">
            <div class="form-group">
              <label>生成提示词（可选）</label>
              <textarea
                v-model="aiGeneratePrompt"
                rows="4"
                placeholder="描述你想要生成的大陆特色，例如：一个充满魔法气息的浮空大陆，有着古老的精灵文明..."
              ></textarea>
              <div class="form-hint">留空则让AI自由发挥</div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>区域数量</label>
                <input v-model.number="aiGenerateRegionCount" type="number" min="1" max="10" value="3" />
              </div>
              <div class="form-group">
                <label>难度等级（1-10）</label>
                <input v-model.number="aiGenerateDifficulty" type="number" min="1" max="10" value="5" />
              </div>
            </div>

            <div v-if="isAIGenerating" class="ai-generating-status">
              <div class="generating-icon">🤖</div>
              <div class="generating-text">AI正在生成中，请稍候...</div>
              <div class="generating-hint">这可能需要一些时间</div>
            </div>

            <div v-if="aiGenerateError" class="ai-generate-error">
              <div class="error-icon">❌</div>
              <div class="error-text">{{ aiGenerateError }}</div>
            </div>
          </div>

          <div class="ai-generate-modal-actions">
            <button class="btn-cancel" :disabled="isAIGenerating" @click="closeAIGenerateModal">取消</button>
            <button class="btn-generate" :disabled="isAIGenerating" @click="handleAIGenerate">
              {{ isAIGenerating ? '生成中...' : '开始生成' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 导出选择弹窗 -->
  <div v-if="showExportModal" class="ai-generate-modal-overlay" @click.self="showExportModal = false">
    <div class="ai-generate-modal" style="max-width: 420px" @click.stop>
      <div class="ai-generate-modal-header">
        <h4>📤 导出大陆完整包</h4>
        <button class="close-button" @click="showExportModal = false">×</button>
      </div>
      <div class="ai-generate-modal-content">
        <div class="form-group">
          <label>选择要导出的大陆</label>
          <select v-model="selectedExportContinent" class="form-select">
            <option value="">-- 请选择 --</option>
            <option v-for="c in customContinents" :key="c.name" :value="c.name">{{ c.name }}</option>
          </select>
        </div>
        <div v-if="!customContinents.length" style="color:#6b7280;text-align:center;padding:12px">
          暂无自定义大陆可导出
        </div>
      </div>
      <div class="ai-generate-modal-actions">
        <button class="btn-cancel" @click="showExportModal = false">取消</button>
        <button class="btn-generate" :disabled="!selectedExportContinent" @click="handleExport">
          📦 导出
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { continentExploreService } from '../../功能模块层/探索/服务/大陆探索服务';
import { exploreService } from '../../功能模块层/探索/服务/探索服务';
import { ContinentDataMerger } from '../../功能模块层/探索/服务/大陆数据合并服务';
import type { Continent } from '../../功能模块层/探索/类型/大陆探索类型';
import type { Location } from '../../功能模块层/探索/类型/探索类型';
import { generateWithChainOfThought } from '../../核心层/服务/世界书管理/工具/AI生成助手';
import { ChainOfThoughtMode } from '../../核心层/服务/世界书管理/工具/思维链管理器';
import { toastService } from '../../核心层/服务/通用服务/弹窗提示服务';
import { ConfirmService } from '../../核心层/服务/通用服务/确认框服务';

// Props
const props = defineProps<{
  show: boolean;
}>();

// Emits
const emit = defineEmits<{
  close: [];
}>();

// 响应式数据
const customContinents = ref<Continent[]>([]);
const showEditModal = ref(false);
const editingContinent = ref<Continent | null>(null);
const isSaving = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);
const selectedExportContinent = ref('');
const showExportModal = ref(false);

// AI生成相关数据
const showAIGenerateModal = ref(false);
const isAIGenerating = ref(false);
const aiGeneratePrompt = ref('');
const aiGenerateRegionCount = ref(3);
const aiGenerateDifficulty = ref(5);
const aiGenerateError = ref('');

// 表单数据
const formData = ref<Partial<Continent>>({
  name: '',
  icon: '🌍',
  description: '',
  difficulty: 1,
  explorationCost: {
    gold: 200,
    food: 120,
  },
  threatMultiplier: 1.0,
  unlockCondition: {
    previousContinentName: undefined,
    conquestPercentage: 50,
  },
  isUnlocked: false,
  isConquered: false,
  conquestProgress: 0,
  regions: [],
});

// 传说级人物管理相关
interface LegendaryCharacter {
  name: string;
  title: string;
  race: string;
  identity: string;
  background: string;
  personality: string[];
  images: string[];
  worldbook_uid: number | null;
  /** 绑定到的区域名称（首都所在区域） */
  boundRegionName: string;
}
const legendaryCharacters = ref<LegendaryCharacter[]>([]);
// 索引匹配结果
const legendaryMatchResult = ref<{
  existing: boolean;
  message: string;
  count: number;
} | null>(null);
// 缓存的索引原始数据（用于匹配）
const cachedIndexLegendary = ref<any[]>([]);

// 计算有首都名的区域列表（供传说人物绑定用）
const capitalRegions = computed(() => {
  return (formData.value.regions || []).filter(r => r.name && r.capital);
});

// 计算属性
// 暂时禁用：解锁条件功能已禁用，此属性不再使用
// const allContinents = computed(() => continentExploreService.getAllContinents());

// 监听显示状态，加载自定义大陆列表
watch(
  () => props.show,
  newVal => {
    if (newVal) {
      loadCustomContinents();
    }
  },
);

// 加载自定义大陆列表
const loadCustomContinents = () => {
  customContinents.value = continentExploreService.getCustomContinents();
};

// 关闭弹窗
const handleClose = () => {
  emit('close');
};

// 添加新大陆（手动模式）
const handleAddContinent = () => {
  editingContinent.value = null;
  resetFormData();
  showEditModal.value = true;
};

// 打开AI生成弹窗
const handleAIGenerateContinent = () => {
  showAIGenerateModal.value = true;
  aiGeneratePrompt.value = '';
  aiGenerateRegionCount.value = 3;
  aiGenerateDifficulty.value = 5;
  aiGenerateError.value = '';
};

// 关闭AI生成弹窗
const closeAIGenerateModal = () => {
  if (isAIGenerating.value) return; // 生成中不允许关闭
  showAIGenerateModal.value = false;
  aiGenerateError.value = '';
};

// AI生成提示词模板
const generateContinentPrompt = (customPrompt: string, regionCount: number, difficulty: number): string => {
  return `# 大陆生成模式规则：
1. 生成一个新的大陆/世界
2. 大陆应该包含 ${regionCount} 个区域
3. 大陆难度等级为 ${difficulty}（1-10）
4. ***此模式只输出JSON数据，无需输出剧情正文***
5. ***必须严格遵守JSON格式***
6. ***必须遵守要求***

${customPrompt ? `# ***自定义要求（最高优先级）***：\n${customPrompt}\n` : ''}

# 输出格式：
\`\`\`json
{
  "name": "{世界/大陆名称}",
  "icon": "{emoji图标，必须，如🌍，禁止文字}",
  "description": "{100字左右，详细描述此世界背景，尤其是文学动漫作品中的世界}",
  "difficulty": ${difficulty},
  "explorationCost": {
    "gold": {金币数量，根据难度合理设定，建议200-2000},
    "food": {食物数量，根据难度合理设定，建议120-1200}
  },
  "threatMultiplier": {威胁倍数，建议0.8-1.5},
  "unlockCondition": {
    "previousContinentName": null,
    "conquestPercentage": 50
  },
  "regions": [
    {
      "name": "{区域名称，必须符合世界设定}",
      "icon": "{必须emoji图标，禁止文字}",
      "description": "{60-100字，详细区域描述，尤其是文学动漫作品中的世界}",
      "difficulty": {区域难度，1-10},
      "unlockStars": {解锁所需星级，建议0-5},
      "requiredStars": {征服所需星级，建议1-10},
      "capital": "{首都名称，可选，留空字符串}"
    }
  ]
}
\`\`\`

请生成符合要求的世界或大陆的数据JSON。`;
};

// 解析AI生成的JSON
const parseAIGeneratedContinent = (aiResponse: string): Continent | null => {
  try {
    console.log('📋 [AI生成] 开始解析AI响应...');
    console.log('📋 [AI生成] 原始响应长度:', aiResponse.length);
    console.log('📋 [AI生成] 原始响应预览:', aiResponse.substring(0, 200));

    // 尝试提取JSON代码块
    const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/);
    let jsonStr = jsonMatch ? jsonMatch[1] : aiResponse;

    // 如果仍然包含 ```json 标记，尝试其他匹配方式
    if (!jsonMatch && jsonStr.includes('```')) {
      jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    }

    // 清理字符串，移除可能的转义字符
    jsonStr = jsonStr.trim();
    console.log('📋 [AI生成] 提取的JSON字符串长度:', jsonStr.length);
    console.log('📋 [AI生成] 提取的JSON字符串预览:', jsonStr.substring(0, 200));

    // 解析JSON
    let data: any;
    try {
      data = JSON.parse(jsonStr);
      console.log('📋 [AI生成] JSON解析成功');
    } catch (parseError) {
      console.error('📋 [AI生成] JSON解析失败:', parseError);
      console.error('📋 [AI生成] 问题JSON字符串:', jsonStr);
      throw new Error(`JSON解析失败: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }

    // 验证必要字段
    console.log('📋 [AI生成] 验证必要字段...');
    console.log('📋 [AI生成] name:', data.name);
    console.log('📋 [AI生成] icon:', data.icon);
    console.log('📋 [AI生成] description:', data.description?.substring(0, 50) || '(空)');
    console.log('📋 [AI生成] difficulty:', data.difficulty);
    console.log('📋 [AI生成] regions数量:', data.regions?.length || 0);

    if (!data.name || !data.icon) {
      console.error('📋 [AI生成] ❌ 缺少必要字段');
      console.error('📋 [AI生成] name存在:', !!data.name, '值:', data.name);
      console.error('📋 [AI生成] icon存在:', !!data.icon, '值:', data.icon);
      throw new Error('缺少必要字段：name 或 icon');
    }

    // 构建完整的Continent对象
    console.log('📋 [AI生成] 构建Continent对象...');
    const continent: Continent = {
      name: data.name,
      icon: data.icon,
      description: data.description || '',
      difficulty: data.difficulty || 5,
      explorationCost: {
        gold: data.explorationCost?.gold || 200,
        food: data.explorationCost?.food || 120,
      },
      threatMultiplier: data.threatMultiplier || 1.0,
      unlockCondition: {
        previousContinentName:
          data.unlockCondition?.previousContinentName && data.unlockCondition.previousContinentName !== null
            ? data.unlockCondition.previousContinentName
            : undefined,
        conquestPercentage: data.unlockCondition?.conquestPercentage || 50,
      },
      isUnlocked: true, // 自定义大陆默认解锁
      isConquered: false,
      conquestProgress: 0,
      regions: (data.regions || []).map((r: any, index: number) => {
        console.log(`📋 [AI生成] 处理区域 ${index + 1}/${data.regions.length}:`, r.name || '未命名');
        console.log(`  - name: ${r.name || '(空)'}`);
        console.log(`  - description: ${r.description?.substring(0, 30) || '(空)'}`);
        console.log(`  - difficulty: ${r.difficulty || '(空)'}`);
        console.log(`  - icon: ${r.icon || '(空)'}`);
        console.log(`  - unlockStars: ${r.unlockStars}`);
        console.log(`  - requiredStars: ${r.requiredStars}`);
        console.log(`  - capital: ${r.capital || '(空)'}`);

        return {
          name: r.name || '未命名区域',
          continentName: data.name, // 确保设置正确的大陆名称
          description: r.description || '',
          difficulty: r.difficulty || 1,
          icon: r.icon || '🏘️',
          isUnlocked: true, // 自定义区域默认解锁
          isConquered: false,
          conquestProgress: 0,
          requiredStars: r.requiredStars || 0,
          unlockStars: r.unlockStars || 0,
          capital: r.capital || '',
          isCapitalConquered: false,
          threatLevel: 0,
          locations: [], // 确保 locations 是数组
        };
      }),
      source: 'custom',
      metadata: {
        createdAt: Date.now(),
      },
    };

    console.log('📋 [AI生成] ✅ Continent对象构建完成');
    console.log('📋 [AI生成] 大陆名称:', continent.name);
    console.log('📋 [AI生成] 区域数量:', continent.regions.length);
    console.log('📋 [AI生成] 完整Continent对象:', JSON.stringify(continent, null, 2));

    return continent;
  } catch (error) {
    console.error('📋 [AI生成] ❌ 解析AI生成的大陆数据失败:', error);
    console.error('📋 [AI生成] 原始响应:', aiResponse);
    throw new Error(`解析失败: ${error instanceof Error ? error.message : String(error)}`);
  }
};

// 执行AI生成
const handleAIGenerate = async () => {
  if (isAIGenerating.value) return;

  if (aiGenerateRegionCount.value < 1 || aiGenerateRegionCount.value > 10) {
    await ConfirmService.showWarning('区域数量无效', '参数错误', '区域数量必须在1-10之间。');
    return;
  }

  if (aiGenerateDifficulty.value < 1 || aiGenerateDifficulty.value > 10) {
    await ConfirmService.showWarning('难度等级无效', '参数错误', '难度等级必须在1-10之间。');
    return;
  }

  isAIGenerating.value = true;
  aiGenerateError.value = '';

  try {
    // 构建提示词
    const prompt = generateContinentPrompt(
      aiGeneratePrompt.value,
      aiGenerateRegionCount.value,
      aiGenerateDifficulty.value,
    );

    // 读取流式传输设置
    const globalVars = getVariables({ type: 'global' });
    const enableStreamOutput =
      typeof globalVars['enable_stream_output'] === 'boolean' ? globalVars['enable_stream_output'] : false; // 默认关闭

    // 调用AI生成
    const aiResponse = await generateWithChainOfThought(ChainOfThoughtMode.LOCATION_GENERATION, {
      user_input: prompt,
      should_stream: enableStreamOutput, // 根据设置启用流式传输
    });

    if (!aiResponse) {
      throw new Error('AI未返回有效响应');
    }

    // 解析生成的数据
    console.log('🔍 [AI生成] 开始解析AI响应数据...');
    const continent = parseAIGeneratedContinent(aiResponse);

    if (!continent) {
      console.error('🔍 [AI生成] ❌ 解析生成数据失败，返回null');
      throw new Error('解析生成数据失败');
    }

    console.log('🔍 [AI生成] ✅ 解析完成，开始验证数据...');

    // 手动验证数据，获取详细的验证错误信息
    console.log('🔍 [AI生成] 开始手动验证大陆数据...');
    console.log('🔍 [AI生成] 验证前数据:', JSON.stringify(continent, null, 2));

    // 先验证大陆基本信息
    if (!continent.name) {
      console.error('🔍 [AI生成] ❌ 验证失败：大陆名称为空');
      throw new Error('验证失败：大陆名称为空');
    }
    if (!continent.description) {
      console.error('🔍 [AI生成] ❌ 验证失败：大陆描述为空');
      throw new Error('验证失败：大陆描述为空');
    }
    if (continent.difficulty < 1 || continent.difficulty > 10) {
      console.error('🔍 [AI生成] ❌ 验证失败：大陆难度超出范围', continent.difficulty);
      throw new Error(`验证失败：大陆难度 ${continent.difficulty} 必须在 1-10 之间`);
    }
    if (!continent.explorationCost || typeof continent.explorationCost.gold !== 'number') {
      console.error('🔍 [AI生成] ❌ 验证失败：探索成本格式错误', continent.explorationCost);
      throw new Error('验证失败：探索成本格式错误');
    }
    if (continent.explorationCost.gold < 0 || continent.explorationCost.food < 0) {
      console.error('🔍 [AI生成] ❌ 验证失败：探索成本为负数', continent.explorationCost);
      throw new Error('验证失败：探索成本不能为负数');
    }
    if (!Array.isArray(continent.regions)) {
      console.error('🔍 [AI生成] ❌ 验证失败：regions 不是数组', continent.regions);
      throw new Error('验证失败：regions 必须是数组');
    }

    console.log('🔍 [AI生成] ✅ 大陆基本信息验证通过');
    console.log('🔍 [AI生成] 区域数量:', continent.regions.length);

    // 验证每个区域
    for (let i = 0; i < continent.regions.length; i++) {
      const region = continent.regions[i];
      console.log(`🔍 [AI生成] 验证区域 ${i + 1}/${continent.regions.length}: "${region.name}"`);

      if (!region.name) {
        console.error(`🔍 [AI生成] ❌ 区域 ${i + 1} 验证失败：名称为空`, region);
        throw new Error(`验证失败：区域 ${i + 1} 名称为空`);
      }
      if (!region.description) {
        console.error(`🔍 [AI生成] ❌ 区域 ${i + 1} "${region.name}" 验证失败：描述为空`, region);
        throw new Error(`验证失败：区域 "${region.name}" 描述为空`);
      }
      if (region.continentName !== continent.name) {
        console.error(
          `🔍 [AI生成] ❌ 区域 ${i + 1} "${region.name}" 验证失败：大陆名称不匹配`,
          `期望: "${continent.name}", 实际: "${region.continentName}"`,
        );
        throw new Error(
          `验证失败：区域 "${region.name}" 的大陆名称不匹配（期望: "${continent.name}", 实际: "${region.continentName}"）`,
        );
      }
      if (region.difficulty < 1 || region.difficulty > 10) {
        console.error(`🔍 [AI生成] ❌ 区域 ${i + 1} "${region.name}" 验证失败：难度超出范围`, region.difficulty);
        throw new Error(`验证失败：区域 "${region.name}" 难度 ${region.difficulty} 必须在 1-10 之间`);
      }
      if (region.requiredStars < 0 || region.unlockStars < 0) {
        console.error(`🔍 [AI生成] ❌ 区域 ${i + 1} "${region.name}" 验证失败：星级为负数`, region);
        throw new Error(`验证失败：区域 "${region.name}" 星级不能为负数`);
      }
      if (!Array.isArray(region.locations)) {
        console.error(`🔍 [AI生成] ❌ 区域 ${i + 1} "${region.name}" 验证失败：locations 不是数组`, region);
        throw new Error(`验证失败：区域 "${region.name}" locations 必须是数组`);
      }

      console.log(`🔍 [AI生成] ✅ 区域 ${i + 1} "${region.name}" 验证通过`);
    }

    console.log('🔍 [AI生成] ✅ 所有区域验证通过');

    // 使用验证服务进行最终验证
    console.log('🔍 [AI生成] 调用 ContinentDataMerger.validateContinent 进行最终验证...');
    const isValid = ContinentDataMerger.validateContinent(continent);
    if (!isValid) {
      console.error('🔍 [AI生成] ❌ ContinentDataMerger 验证失败');
      throw new Error('数据验证失败：请查看控制台获取详细信息');
    }
    console.log('🔍 [AI生成] ✅ ContinentDataMerger 验证通过');

    // 使用验证并修复服务
    console.log('🔍 [AI生成] 调用 ContinentDataMerger.validateAndFixContinent 进行修复和验证...');
    const validatedContinent = ContinentDataMerger.validateAndFixContinent(continent);
    if (!validatedContinent) {
      console.error('🔍 [AI生成] ❌ validateAndFixContinent 返回 null，验证失败');
      throw new Error('数据验证和修复失败：请查看控制台获取详细信息');
    }
    console.log('🔍 [AI生成] ✅ validateAndFixContinent 验证通过');
    console.log('🔍 [AI生成] 修复后的数据:', JSON.stringify(validatedContinent, null, 2));

    // 检查是否已存在同名大陆
    const existingContinent = continentExploreService.getAllContinents().find(c => c.name === validatedContinent.name);
    if (existingContinent) {
      console.log('🔍 [AI生成] ⚠️ 检测到同名大陆:', existingContinent.name);
      const confirmed = await ConfirmService.showWarning(
        `已存在名为"${validatedContinent.name}"的大陆`,
        '重复名称',
        '是否覆盖现有大陆？',
      );
      if (!confirmed) {
        console.log('🔍 [AI生成] 用户取消覆盖');
        closeAIGenerateModal(); // 用户取消时也关闭窗口
        return;
      }
      // 如果是自定义大陆，先删除
      if (existingContinent.source === 'custom') {
        console.log('🔍 [AI生成] 删除已存在的自定义大陆:', existingContinent.name);
        await continentExploreService.removeCustomContinent(validatedContinent.name);
      }
    }

    // 添加生成的大陆
    console.log('🔍 [AI生成] 调用 addCustomContinent 添加大陆...');
    const success = await continentExploreService.addCustomContinent(validatedContinent);

    if (success) {
      console.log('🔍 [AI生成] ✅ 大陆添加成功:', validatedContinent.name);
      toastService.success(`AI已生成大陆 "${validatedContinent.name}"`, { title: '生成成功', duration: 3000 });
      loadCustomContinents();
      // 先重置生成状态，再关闭窗口
      isAIGenerating.value = false;
      closeAIGenerateModal();
    } else {
      console.error('🔍 [AI生成] ❌ addCustomContinent 返回 false，添加失败');
      throw new Error('添加大陆失败：请查看控制台获取详细信息');
    }
  } catch (error) {
    console.error('AI生成大陆失败:', error);
    aiGenerateError.value = error instanceof Error ? error.message : String(error);
    await ConfirmService.showDanger('AI生成失败', '生成错误', aiGenerateError.value);
  } finally {
    isAIGenerating.value = false;
  }
};

// 编辑大陆
const handleEditContinent = async (continent: Continent) => {
  editingContinent.value = continent;
  formData.value = {
    ...continent,
    explorationCost: continent.explorationCost || {
      gold: 200,
      food: 120,
    },
    unlockCondition: continent.unlockCondition || {
      previousContinentName: undefined,
      conquestPercentage: 50,
    },
    regions: continent.regions.map(r => ({ ...r })),
  };
  showEditModal.value = true;
  // 加载该大陆在 images 索引中的传说级人物
  await loadLegendaryCharacters();
  // 编辑模式下，自动填充已有传说人物到编辑列表
  if (cachedIndexLegendary.value.length > 0 && legendaryCharacters.value.length === 0) {
    legendaryCharacters.value = cachedIndexLegendary.value.map(c => ({ ...c }));
  }
};

// 删除大陆
const handleDeleteContinent = async (continentName: string) => {
  const continent = customContinents.value.find(c => c.name === continentName);
  if (!continent) return;

  // 检查是否有游戏进度
  if (continent.isConquered || continent.conquestProgress > 0) {
    await ConfirmService.showWarning(`无法删除大陆 "${continentName}"`, '删除失败', '该大陆已有游戏进度，无法删除。');
    return;
  }

  const confirmed = await ConfirmService.showDanger(
    `确定要删除大陆 "${continentName}" 吗？`,
    '确认删除',
    '此操作无法撤销，该大陆的所有数据将被永久删除。',
  );

  if (confirmed) {
    const success = await continentExploreService.removeCustomContinent(continentName);
    if (success) {
      toastService.success(`大陆 "${continentName}" 已删除`, { title: '删除成功', duration: 2000 });
      loadCustomContinents();
    } else {
      await ConfirmService.showDanger('删除失败', '操作失败', '请检查控制台日志获取详细信息。');
    }
  }
};

// 保存大陆
const handleSaveContinent = async () => {
  if (!formData.value.name || !formData.value.icon) {
    await ConfirmService.showWarning('请填写必要字段', '保存失败', '大陆名称和图标为必填项。');
    return;
  }

  isSaving.value = true;

  try {
    const continent: Continent = {
      name: formData.value.name!,
      icon: formData.value.icon!,
      description: formData.value.description || '',
      difficulty: formData.value.difficulty || 1,
      explorationCost: {
        gold: formData.value.explorationCost?.gold || 200,
        food: formData.value.explorationCost?.food || 120,
      },
      threatMultiplier: formData.value.threatMultiplier || 1.0,
      unlockCondition: {
        previousContinentName: formData.value.unlockCondition?.previousContinentName,
        conquestPercentage: formData.value.unlockCondition?.conquestPercentage || 50,
      },
      isUnlocked: true, // 自定义大陆默认解锁
      isConquered: false,
      conquestProgress: 0,
      regions: (formData.value.regions || []).map(r => {
        const regionName = r.name || '未命名区域';
        // 为该区域绑定的传说人物
        const boundHeroes = legendaryCharacters.value
          .filter(c => c.boundRegionName === regionName)
          .map(c => ({
            id: `legendary_${formData.value.name}_${c.name}`,
            name: c.name,
            title: c.title,
            race: c.race,
            background: c.background,
            personality: c.personality || [],
            status: 'uncaptured',
          }));
        // 生成首都据点ID
        const capitalLocationId = r.capital
          ? `capital_${formData.value.name}_${regionName}_${r.capital}`
          : '';
        return {
          name: regionName,
          continentName: formData.value.name!,
          description: r.description || '',
          difficulty: r.difficulty || 1,
          icon: r.icon || '🏘️',
          isUnlocked: true,
          isConquered: false,
          conquestProgress: 0,
          requiredStars: r.requiredStars || 0,
          unlockStars: r.unlockStars || 0,
          capital: r.capital || '',
          isCapitalConquered: false,
          threatLevel: 0,
          // 首都据点 + 绑定的传说英雄
          locations: r.capital ? [capitalLocationId] : [],
        };
      }),
    };

    const success = editingContinent.value
      ? await continentExploreService.updateCustomContinent(editingContinent.value.name, continent)
      : await continentExploreService.addCustomContinent(continent);

    if (success) {
      // 保存传说级人物到 images 索引
      if (legendaryCharacters.value.length > 0) {
        await saveLegendaryCharactersToIndex(continent.name);
      }

      // 为有首都的区域创建首都据点，并挂载绑定的传说英雄
      await createCapitalLocations(continent.name, continent.regions);

      toastService.success(
        editingContinent.value ? `大陆 "${continent.name}" 已更新` : `大陆 "${continent.name}" 已添加`,
        { title: '保存成功', duration: 2000 },
      );
      closeEditModal();
      loadCustomContinents();
    } else {
      await ConfirmService.showDanger('保存失败', '操作失败', '请检查数据格式是否正确。');
    }
  } catch (error) {
    console.error('保存大陆失败:', error);
    await ConfirmService.showDanger('保存失败', '操作失败', `错误信息: ${error}`);
  } finally {
    isSaving.value = false;
  }
};

// 关闭编辑弹窗
const closeEditModal = () => {
  showEditModal.value = false;
  editingContinent.value = null;
  resetFormData();
};

// 重置表单数据
const resetFormData = () => {
  formData.value = {
    name: '',
    icon: '🌍',
    description: '',
    difficulty: 1,
    explorationCost: {
      gold: 200,
      food: 120,
    },
    threatMultiplier: 1.0,
    unlockCondition: {
      previousContinentName: undefined,
      conquestPercentage: 50,
    },
    isUnlocked: true, // 自定义大陆默认解锁
    isConquered: false,
    conquestProgress: 0,
    regions: [],
  };
  // 重置传说级人物状态
  legendaryCharacters.value = [];
  cachedIndexLegendary.value = [];
  legendaryMatchResult.value = null;
};

// 添加区域
const handleAddRegion = () => {
  if (!formData.value.regions) {
    formData.value.regions = [];
  }
  formData.value.regions.push({
    name: '',
    continentName: formData.value.name || '',
    description: '',
    difficulty: 1,
    icon: '🏘️',
    isUnlocked: true, // 自定义区域默认解锁
    isConquered: false,
    conquestProgress: 0,
    requiredStars: 0,
    unlockStars: 0,
    capital: '',
    isCapitalConquered: false,
    threatLevel: 0,
    locations: [],
  });
};

// 删除区域
const handleRemoveRegion = (index: number) => {
  if (formData.value.regions) {
    formData.value.regions.splice(index, 1);
  }
};

// ==================== 传说级人物管理 ====================

// 加载大陆的传说级人物（从 images 索引）
const loadLegendaryCharacters = async () => {
  const continentName = formData.value.name;
  if (!continentName) {
    legendaryCharacters.value = [];
    cachedIndexLegendary.value = [];
    legendaryMatchResult.value = null;
    return;
  }
  try {
    const resp = await fetch(`/api/images/${encodeURIComponent(continentName)}/index`);
    if (resp.ok) {
      const index = await resp.json();
      cachedIndexLegendary.value = (index['传奇'] || []).map((c: any) => ({
        ...c,  // 保留索引中的所有扩展字段
        // 兼容嵌套格式：提取 name/title/race/identity 供 LegendaryCharacter 使用
        name: c.basicInfo?.name || c.name || '',
        title: c.basicInfo?.title || c.title || '',
        race: c.basicInfo?.race || c.race || '',
        identity: c.basicInfo?.title || c.identity || c.title || '',
        background: c.basicInfo?.background || c.background || '',
        personality: Array.isArray(c.background?.personality)
          ? c.background.personality
          : Array.isArray(c.personality) ? c.personality : [],
        images: c.images || [],
        worldbook_uid: c.worldbook_uid || null,
      }));
    } else {
      cachedIndexLegendary.value = [];
    }
  } catch {
    cachedIndexLegendary.value = [];
  }
};

// 从 images 索引匹配大陆传说人物
const handleMatchFromIndex = async () => {
  const continentName = formData.value.name;
  if (!continentName) return;

  legendaryMatchResult.value = null;
  await loadLegendaryCharacters();

  if (cachedIndexLegendary.value.length > 0) {
    legendaryMatchResult.value = {
      existing: true,
      message: `在 images 索引中找到 ${cachedIndexLegendary.value.length} 个传说级人物`,
      count: cachedIndexLegendary.value.length,
    };
  } else {
    legendaryMatchResult.value = {
      existing: false,
      message: `images 中暂无"${continentName}"的传说人物索引，请手动添加`,
      count: 0,
    };
  }
};

// 从索引批量导入所有传说级人物
const handleImportAllLegendary = () => {
  if (cachedIndexLegendary.value.length === 0) return;

  for (const char of cachedIndexLegendary.value) {
    const exists = legendaryCharacters.value.find(c => c.name === char.name);
    if (!exists) {
      legendaryCharacters.value.push({ ...char, boundRegionName: '' });
    }
  }
  toastService.success(`已导入 ${cachedIndexLegendary.value.length} 个传说人物`, {
    title: '导入成功',
    duration: 1500,
  });
  legendaryMatchResult.value = null;
};

// 从列表中移除传说人物（仅从表单移除，不删索引）
const handleRemoveLegendary = (index: number) => {
  legendaryCharacters.value.splice(index, 1);
};

// 监听大陆名称变化，自动加载索引
watch(
  () => formData.value.name,
  (newName) => {
    if (newName && showEditModal.value) {
      legendaryMatchResult.value = null;
      loadLegendaryCharacters();
    } else {
      cachedIndexLegendary.value = [];
      legendaryMatchResult.value = null;
    }
  },
);

// 批量保存传说级人物到 images 索引
const saveLegendaryCharactersToIndex = async (continentName: string) => {
  for (const char of legendaryCharacters.value) {
    await saveCharacterToIndex(continentName, char);
  }
};

// 保存单个传说人物到后端索引
const saveCharacterToIndex = async (continentName: string, char: LegendaryCharacter) => {
  // 合并缓存中的完整数据（保留 attributes/lifeStory 等扩展字段）
  const fullData = cachedIndexLegendary.value.find((c: any) => c.name === char.name) || {};
  const merged = { ...fullData, ...char };
  try {
    await fetch(`/api/images/${encodeURIComponent(continentName)}/character`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(merged),
    });
  } catch (e) {
    console.warn(`保存传说人物"${char.name}"失败:`, e);
  }
};

// 从索引数据构建完整的传说级 Character 对象
const buildCompleteHero = (continentName: string, char: LegendaryCharacter): any => {
  // 从缓存索引中查找完整数据
  const rawData = cachedIndexLegendary.value.find((c: any) => c.name === char.name) || {};

  // 兼容两种格式：新嵌套格式（basicInfo/background/appearance/lifeStory）和旧扁平格式
  const bi = rawData.basicInfo || rawData;
  const bg = rawData.background || rawData;
  const app = rawData.appearance || rawData;
  const ls = rawData.lifeStory || rawData;

  // 直接使用大陆名构建路径（浏览器会自动编码中文）
  const images = char.images || rawData.images || [];
  const avatarBase = images.length > 0
    ? `/images/${continentName}/传奇/${images[0]}`
    : '';

  return {
    // 基础信息
    id: `legendary_${continentName}_${char.name}`,
    name: char.name || bi.name,
    title: char.title || bi.title || char.identity || '',
    avatar: avatarBase || undefined,
    corruptedAvatar: images.length > 1 ? `/images/${continentName}/传奇/${images[1]}` : (avatarBase || undefined),
    fullyCorruptedAvatar: images.length > 2 ? `/images/${continentName}/传奇/${images[2]}` : (avatarBase || undefined),
    originalAvatar: avatarBase || undefined,
    originalCorruptedAvatar: images.length > 1 ? `/images/${continentName}/传奇/${images[1]}` : (avatarBase || undefined),
    originalFullyCorruptedAvatar: images.length > 2 ? `/images/${continentName}/传奇/${images[2]}` : (avatarBase || undefined),

    // 状态
    status: 'uncaptured',
    canCombat: rawData.canCombat ?? true,
    unitType: (rawData.unitType as any) || 'magical',

    // 属性（优先索引数据，否则用 1.5倍×随机波动 的强化值）
    loyalty: rawData.loyalty ?? 0,
    stamina: rawData.stamina ?? Math.floor(120 * 1.5 * (1.0 + Math.random() * 0.8)),
    maxStamina: rawData.maxStamina ?? Math.floor(120 * 1.5 * (1.0 + Math.random() * 0.8)),
    fertility: rawData.fertility ?? Math.floor(100 * 1.5 * (1.0 + Math.random() * 0.8)),
    maxFertility: rawData.maxFertility ?? Math.floor(100 * 1.5 * (1.0 + Math.random() * 0.8)),
    offspring: 0,
    rating: (bi.rating as any) || 'S',
    favorite: false,
    level: rawData.level ?? 1,
    attributes: rawData.attributes || (() => {
      // 传说级人物属性强化：基础值 × 1.5 × 随机(1.0~1.8)
      const boost = 1.5 * (1.0 + Math.random() * 0.8);
      return {
        attack: Math.floor(60 * boost),
        defense: Math.floor(50 * boost),
        intelligence: Math.floor(70 * boost),
        speed: Math.floor(55 * boost),
        health: Math.floor(200 * boost),
      };
    })(),

    // 详细信息（优先索引 - 支持嵌套和扁平两种格式）
    race: char.race || bi.race || '人类',
    age: bi.age ?? (24 + Math.floor(Math.random() * 16)),
    country: bi.country || continentName,
    background: bi.background || '传说级人物',
    sexExperience: bg.sexExperience || '',
    sensitivePoints: bg.sensitivePoints || rawData.sensitivePoints || [],
    sensitivePointsDetail: rawData.sensitivePointsDetail || bg.sensitivePointsDetail || [],
    personality: bg.personality || rawData.personality || [],
    fears: bg.fears || rawData.fears || '',
    secrets: bg.secrets || rawData.secrets || '',

    // 外观（支持嵌套和扁平格式）
    appearance: {
      height: app.height ?? (160 + Math.floor(Math.random() * 15)),
      weight: app.weight ?? (48 + Math.floor(Math.random() * 15)),
      measurements: app.measurements || '85-60-88',
      cupSize: app.cupSize || 'D',
      description: app.description || `${char.name}，${char.title || ''}。${bi.background || ''}`,
      clothing: app.clothing || { head: '无', top: '战袍', bottom: '长裙', socks: '长袜', shoes: '靴', underwear: '内衣', accessories: '', toys: '无' },
      originalClothing: app.clothing || { head: '无', top: '战袍', bottom: '长裙', socks: '长袜', shoes: '靴', underwear: '内衣', accessories: '', toys: '无' },
    },

    // 人生经历（支持嵌套和扁平格式）
    lifeStory: {
      childhood: ls.childhood || [`${char.name}出生于${continentName}。`],
      adolescence: ls.adolescence || ['经历了严酷的训练和考验。'],
      adulthood: ls.adulthood || [`获得了"${char.title || ''}"的称号。`],
      currentState: ls.currentState || [bi.background || `作为${continentName}的传说级人物，守护着这片土地。`],
    },

    breedingRecords: [],
  };
};

// 为有首都的区域创建据点并挂载传说英雄
const createCapitalLocations = async (continentName: string, regions: any[]) => {
  for (const region of regions) {
    if (!region.capital || !region.name) continue;

    // 查找绑定到此区域的传说人物
    const boundHeroes = legendaryCharacters.value.filter(c => c.boundRegionName === region.name);

    const capitalLoc: Location = {
      id: `capital_${continentName}_${region.name}_${region.capital}`,
      name: region.capital,
      type: 'capital' as any,
      icon: '🏰',
      description: `${region.name}的首都，${boundHeroes.length > 0 ? `由${boundHeroes.map(h => h.name).join('、')}守护` : '等待勇者征服'}`,
      difficulty: region.difficulty || 1,
      distance: 0,
      rewards: {
        gold: (region.difficulty || 1) * 100,
        food: (region.difficulty || 1) * 60,
        heroes: boundHeroes.map(h => buildCompleteHero(continentName, h)),
      },
      status: 'unknown',
      continent: continentName,
      region: region.name,
      baseGuards: (region.difficulty || 1) * 50,
    };

    exploreService.addLocation(capitalLoc);
    console.log(`🏰 [首都据点] 创建首都"${region.capital}"在区域"${region.name}"，挂载${boundHeroes.length}个传说英雄`);
  }
};

// 导出配置（选择大陆 → ZIP 下载）
const handleExport = async () => {
  const selectedName = selectedExportContinent.value;
  if (!selectedName) return;

  const continent = continentExploreService.getCustomContinents().find(c => c.name === selectedName);
  if (!continent) return;

  try {
    console.log(`📦 [导出] 导出大陆: ${selectedName}`);
    const resp = await fetch(
      `/api/export/continent?continent=${encodeURIComponent(selectedName)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(continent),
      },
    );

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`服务器错误 (${resp.status}): ${errText}`);
    }

    const blob = await resp.blob();
    console.log(`📦 [导出] 收到 ${(blob.size / 1024).toFixed(1)} KB, type=${blob.type}`);

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedName}_完整包.zip`;
    document.body.appendChild(a);
    a.click();
    // 延迟清理，确保下载先触发
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showExportModal.value = false;
      selectedExportContinent.value = '';
    }, 500);

    toastService.success(`"${selectedName}" 已导出到下载文件夹`, { title: '导出成功', duration: 2000 });
  } catch (error) {
    console.error('导出失败:', error);
    ConfirmService.showDanger('导出失败', '操作失败', `错误信息: ${error}`);
  }
};

// 导入配置
const handleImport = () => {
  fileInputRef.value?.click();
};

// 处理文件选择（导入ZIP压缩包）
const handleFileSelect = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  // 支持两种格式：ZIP压缩包 和 JSON配置文件
  if (file.name.endsWith('.zip')) {
    await handleImportZip(file, target);
  } else if (file.name.endsWith('.json')) {
    await handleImportJson(file, target);
  } else {
    await ConfirmService.showWarning('不支持的文件格式', '导入失败', '请选择 .zip 或 .json 文件。');
    if (target) target.value = '';
  }
};

// 导入ZIP压缩包（新格式）
const handleImportZip = async (file: File, target: HTMLInputElement) => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const confirmed = await ConfirmService.showWarning(
      `确定要导入 "${file.name}" 吗？`,
      '确认导入',
      '将自动部署图片、索引和大陆配置。',
    );
    if (!confirmed) { target.value = ''; return; }

    const resp = await fetch('/api/import/continent', {
      method: 'POST',
      body: formData,
    });

    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.detail || '导入失败');
    }

    const result = await resp.json();
    const continentConfig = result.continent_config;

    if (continentConfig && continentConfig.name) {
      // 清理 _legendaries 字段（如果有）
      delete continentConfig._legendaries;
      const success = await continentExploreService.addCustomContinent(continentConfig);
      if (success) {
        toastService.success(`大陆"${result.continent_name}"导入成功`, {
          title: '导入完成',
          duration: 2000,
        });
        loadCustomContinents();
      } else {
        toastService.warning(`大陆"${result.continent_name}"部署成功但创建失败`, {
          title: '部分成功',
          duration: 3000,
        });
      }
    } else {
      toastService.warning('ZIP中未找到大陆配置，仅部署了图片和索引', {
        title: '部分导入',
        duration: 3000,
      });
    }
  } catch (error: any) {
    console.error('导入ZIP失败:', error);
    await ConfirmService.showDanger('导入失败', '操作失败', error.message || String(error));
  } finally {
    if (target) target.value = '';
  }
};

// 导入JSON配置文件（旧格式兼容）
const handleImportJson = async (file: File, target: HTMLInputElement) => {
  try {
    const text = await file.text();
    const config = JSON.parse(text);

    if (!config.continents || !Array.isArray(config.continents)) {
      await ConfirmService.showWarning('无效的配置文件', '导入失败', '配置文件格式不正确。');
      if (target) target.value = '';
      return;
    }

    const confirmed = await ConfirmService.showWarning(
      `确定要导入 ${config.continents.length} 个自定义大陆吗？`,
      '确认导入',
      '如果存在同名大陆，将被覆盖。',
    );
    if (!confirmed) { target.value = ''; return; }

    let successCount = 0;
    let failCount = 0;

    for (const continent of config.continents) {
      const legendaries = (continent as any)._legendaries || [];
      delete (continent as any)._legendaries;
      const success = await continentExploreService.addCustomContinent(continent);
      if (success) {
        const continentName = continent.name || (continent as any).continentName || '';
        if (continentName && legendaries.length > 0) {
          for (const char of legendaries) {
            try {
              await fetch(`/api/images/${encodeURIComponent(continentName)}/character`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(char),
              });
            } catch {}
          }
        }
        successCount++;
      } else {
        failCount++;
      }
    }
    loadCustomContinents();

    if (failCount > 0) {
      await ConfirmService.showWarning(
        `导入完成：成功 ${successCount} 个，失败 ${failCount} 个`,
        '导入结果',
      );
    } else {
      toastService.success(`成功导入 ${successCount} 个大陆`, { title: '导入成功', duration: 2000 });
    }
  } catch (error) {
    console.error('导入JSON失败:', error);
    await ConfirmService.showDanger('导入失败', '操作失败', `错误信息: ${error}`);
  } finally {
    if (target) target.value = '';
  }
};

// 格式化日期
const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};
</script>

<style scoped lang="scss">
.custom-continent-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.custom-continent-modal {
  background: linear-gradient(180deg, rgba(40, 26, 20, 0.95), rgba(25, 17, 14, 0.98));
  border: 2px solid rgba(205, 133, 63, 0.4);
  border-radius: 16px;
  width: 90vw;
  max-width: 1200px;
  height: 90vh;
  max-height: 800px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
  animation: modalSlideIn 0.3s ease-out;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(205, 133, 63, 0.2);
  background: rgba(0, 0, 0, 0.2);
  flex-shrink: 0;

  h3 {
    margin: 0;
    color: #ffd7a1;
    font-size: 20px;
    font-weight: 700;
  }

  .close-button {
    background: none;
    border: none;
    color: #9ca3af;
    font-size: 28px;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s ease;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      background: rgba(239, 68, 68, 0.1);
      color: #ef4444;
    }
  }
}

.modal-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.action-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
  align-items: center;

  .add-mode-group {
    display: flex;
    gap: 8px;
  }

  button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border: 1px solid rgba(205, 133, 63, 0.3);
    border-radius: 6px;
    background: rgba(205, 133, 63, 0.1);
    color: #f0e6d2;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background: rgba(205, 133, 63, 0.2);
      border-color: rgba(205, 133, 63, 0.5);
      transform: translateY(-1px);
    }

    .icon {
      font-size: 16px;
    }
  }

  .btn-add {
    background: linear-gradient(180deg, #3b82f6, #2563eb);
    border-color: rgba(59, 130, 246, 0.6);
    color: #ffffff;
  }

  .btn-add-ai {
    background: linear-gradient(180deg, #8b5cf6, #7c3aed);
    border-color: rgba(139, 92, 246, 0.6);
    color: #ffffff;

    &:hover {
      background: linear-gradient(180deg, #7c3aed, #6d28d9);
      border-color: rgba(139, 92, 246, 0.8);
    }
  }

  .btn-import,
  .btn-export {
    background: rgba(59, 130, 246, 0.1);
    border-color: rgba(59, 130, 246, 0.3);
  }
}

.continent-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #9ca3af;

  .empty-icon {
    font-size: 64px;
    margin-bottom: 16px;
  }

  .empty-text {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 8px;
    color: #f0e6d2;
  }

  .empty-hint {
    font-size: 14px;
    opacity: 0.7;
  }
}

.continent-item {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(205, 133, 63, 0.2);
  border-radius: 8px;
  padding: 16px;
  transition: all 0.2s ease;

  &:hover {
    border-color: rgba(205, 133, 63, 0.4);
    background: rgba(0, 0, 0, 0.4);
  }

  .continent-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
  }

  .continent-info {
    display: flex;
    gap: 12px;
    flex: 1;
  }

  .continent-icon {
    font-size: 32px;
    flex-shrink: 0;
  }

  .continent-details {
    flex: 1;
  }

  .continent-name {
    font-size: 18px;
    font-weight: 700;
    color: #ffd7a1;
    margin-bottom: 4px;
  }

  .continent-meta {
    display: flex;
    gap: 16px;
    font-size: 12px;
    color: #9ca3af;
    flex-wrap: wrap;

    .meta-item {
      white-space: nowrap;
    }
  }

  .continent-actions {
    display: flex;
    gap: 8px;
  }

  .btn-edit,
  .btn-delete {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    border: 1px solid rgba(205, 133, 63, 0.3);
    border-radius: 4px;
    background: rgba(205, 133, 63, 0.1);
    color: #f0e6d2;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background: rgba(205, 133, 63, 0.2);
      border-color: rgba(205, 133, 63, 0.5);
    }

    .icon {
      font-size: 14px;
    }
  }

  .btn-delete {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);

    &:hover {
      background: rgba(239, 68, 68, 0.2);
      border-color: rgba(239, 68, 68, 0.5);
    }
  }

  .continent-description {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(205, 133, 63, 0.1);
    color: #d1d5db;
    font-size: 14px;
    line-height: 1.5;
  }
}

// 编辑弹窗样式
.edit-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}

.edit-modal {
  background: linear-gradient(180deg, rgba(40, 26, 20, 0.98), rgba(25, 17, 14, 0.99));
  border: 2px solid rgba(205, 133, 63, 0.5);
  border-radius: 16px;
  width: 90vw;
  max-width: 900px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.8);
}

.edit-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(205, 133, 63, 0.2);
  background: rgba(0, 0, 0, 0.2);
  flex-shrink: 0;

  h4 {
    margin: 0;
    color: #ffd7a1;
    font-size: 18px;
    font-weight: 700;
  }
}

.edit-modal-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.form-group {
  margin-bottom: 16px;

  label {
    display: block;
    margin-bottom: 6px;
    color: #f0e6d2;
    font-size: 14px;
    font-weight: 500;

    .required {
      color: #ef4444;
    }
  }

  input,
  textarea,
  select {
    width: 100%;
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(205, 133, 63, 0.3);
    border-radius: 6px;
    color: #f0e6d2;
    font-size: 14px;
    transition: all 0.2s ease;

    &:focus {
      outline: none;
      border-color: rgba(205, 133, 63, 0.6);
      background: rgba(0, 0, 0, 0.5);
    }

    &::placeholder {
      color: #6b7280;
    }
  }

  textarea {
    resize: vertical;
    min-height: 60px;
  }
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.form-section {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid rgba(205, 133, 63, 0.2);

  h5 {
    margin: 0 0 16px 0;
    color: #ffd7a1;
    font-size: 16px;
    font-weight: 600;
  }
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  .btn-add-region {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    background: rgba(59, 130, 246, 0.2);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 4px;
    color: #93c5fd;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background: rgba(59, 130, 246, 0.3);
      border-color: rgba(59, 130, 246, 0.5);
    }
  }
}

.empty-regions {
  padding: 20px;
  text-align: center;
  color: #6b7280;
  font-size: 14px;
}

.region-item {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(205, 133, 63, 0.2);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;

  .region-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;

    .region-icon {
      font-size: 24px;
      flex-shrink: 0;
    }

    .region-name-input {
      flex: 1;
      padding: 6px 10px;
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(205, 133, 63, 0.3);
      border-radius: 4px;
      color: #f0e6d2;
      font-size: 14px;
      font-weight: 600;
    }

    .btn-remove-region {
      padding: 6px 12px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 4px;
      color: #fca5a5;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        background: rgba(239, 68, 68, 0.2);
        border-color: rgba(239, 68, 68, 0.5);
      }
    }
  }

  .region-details {
    padding-left: 36px;
  }
}

.edit-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid rgba(205, 133, 63, 0.2);
  background: rgba(0, 0, 0, 0.2);
  flex-shrink: 0;

  button {
    padding: 10px 20px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .btn-cancel {
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(205, 133, 63, 0.3);
    color: #f0e6d2;

    &:hover:not(:disabled) {
      background: rgba(0, 0, 0, 0.5);
      border-color: rgba(205, 133, 63, 0.5);
    }
  }

  .btn-save {
    background: linear-gradient(180deg, #3b82f6, #2563eb);
    border: 1px solid rgba(59, 130, 246, 0.6);
    color: #ffffff;

    &:hover:not(:disabled) {
      background: linear-gradient(180deg, #2563eb, #1d4ed8);
      transform: translateY(-1px);
    }
  }
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (max-width: 768px) {
  .custom-continent-modal,
  .edit-modal {
    width: 95vw;
    height: 95vh;
  }

  .action-bar {
    flex-direction: column;

    button {
      width: 100%;
      justify-content: center;
    }
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .continent-header {
    flex-direction: column;
    gap: 12px;
  }

  .continent-actions {
    width: 100%;
    justify-content: flex-end;
  }
}

// AI生成弹窗样式
.ai-generate-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}

.ai-generate-modal {
  background: linear-gradient(180deg, rgba(40, 26, 20, 0.98), rgba(25, 17, 14, 0.99));
  border: 2px solid rgba(139, 92, 246, 0.5);
  border-radius: 16px;
  width: 90vw;
  max-width: 600px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.8);
}

.ai-generate-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(139, 92, 246, 0.2);
  background: rgba(0, 0, 0, 0.2);
  flex-shrink: 0;

  h4 {
    margin: 0;
    color: #c084fc;
    font-size: 18px;
    font-weight: 700;
  }

  .close-button {
    background: none;
    border: none;
    color: #9ca3af;
    font-size: 28px;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s ease;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      background: rgba(239, 68, 68, 0.1);
      color: #ef4444;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}

.ai-generate-modal-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;

  .form-hint {
    margin-top: 4px;
    font-size: 12px;
    color: #9ca3af;
    font-style: italic;
  }

  .ai-generating-status {
    text-align: center;
    padding: 40px 20px;
    color: #c084fc;

    .generating-icon {
      font-size: 48px;
      margin-bottom: 16px;
      animation: pulse 2s ease-in-out infinite;
    }

    .generating-text {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 8px;
      color: #f0e6d2;
    }

    .generating-hint {
      font-size: 14px;
      opacity: 0.7;
    }
  }

  .ai-generate-error {
    padding: 16px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    display: flex;
    gap: 12px;
    align-items: flex-start;

    .error-icon {
      font-size: 20px;
      flex-shrink: 0;
    }

    .error-text {
      color: #fca5a5;
      font-size: 14px;
      line-height: 1.5;
    }
  }
}

.ai-generate-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid rgba(139, 92, 246, 0.2);
  background: rgba(0, 0, 0, 0.2);
  flex-shrink: 0;

  button {
    padding: 10px 20px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .btn-cancel {
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(205, 133, 63, 0.3);
    color: #f0e6d2;

    &:hover:not(:disabled) {
      background: rgba(0, 0, 0, 0.5);
      border-color: rgba(205, 133, 63, 0.5);
    }
  }

  .btn-generate {
    background: linear-gradient(180deg, #8b5cf6, #7c3aed);
    border: 1px solid rgba(139, 92, 246, 0.6);
    color: #ffffff;

    &:hover:not(:disabled) {
      background: linear-gradient(180deg, #7c3aed, #6d28d9);
      transform: translateY(-1px);
    }
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.1);
  }
}

// ==================== 传说级人物管理样式 ====================

.legendary-section {
  margin-top: 8px;

  .legendary-action-group {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .btn-match-index {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 6px;
    color: #c4b5fd;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover:not(:disabled) {
      background: rgba(139, 92, 246, 0.25);
      border-color: rgba(139, 92, 246, 0.5);
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }
}

.legendary-match-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(139, 92, 246, 0.1);
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: 6px;
  margin-bottom: 8px;
  font-size: 13px;
  color: #c4b5fd;
  flex-wrap: wrap;

  .match-icon {
    font-size: 16px;
  }

  .btn-import-all {
    padding: 4px 10px;
    background: rgba(139, 92, 246, 0.2);
    border: 1px solid rgba(139, 92, 246, 0.4);
    border-radius: 4px;
    color: #c4b5fd;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-left: auto;

    &:hover {
      background: rgba(139, 92, 246, 0.3);
    }
  }
}

.legendary-images-badge {
  color: #6b7280;
  font-size: 11px;
  background: rgba(0, 0, 0, 0.3);
  padding: 1px 6px;
  border-radius: 3px;
}

.legendary-bg {
  color: #6b7280;
  font-size: 12px;
  margin-top: 4px;
  padding-left: 2px;
  line-height: 1.4;
}

.name-match-row {
  display: flex;
  gap: 4px;
  align-items: center;

  input {
    flex: 1;
  }

  .btn-match-name {
    width: 32px;
    height: 32px;
    padding: 0;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 4px;
    color: #c4b5fd;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    flex-shrink: 0;

    &:hover:not(:disabled) {
      background: rgba(139, 92, 246, 0.25);
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }
}

.legendary-item {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 8px;

  .legendary-header {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;

    .legendary-name {
      color: #ffd7a1;
      font-weight: 700;
      font-size: 14px;
    }

    .legendary-title {
      color: #8b5cf6;
      font-size: 12px;
      background: rgba(139, 92, 246, 0.15);
      padding: 2px 8px;
      border-radius: 4px;
    }

    .legendary-race {
      color: #9ca3af;
      font-size: 12px;
      flex: 1;
    }

    .legendary-actions {
      display: flex;
      gap: 6px;
      align-items: center;

      .legendary-capital-select {
        padding: 2px 6px;
        font-size: 11px;
        background: rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(139, 92, 246, 0.3);
        border-radius: 4px;
        color: #c4b5fd;
        cursor: pointer;
        max-width: 150px;

        &:focus {
          border-color: rgba(139, 92, 246, 0.6);
          outline: none;
        }
      }

      .btn-edit-small,
      .btn-delete-small {
        width: 28px;
        height: 28px;
        border: 1px solid rgba(205, 133, 63, 0.3);
        border-radius: 4px;
        background: rgba(205, 133, 63, 0.1);
        color: #f0e6d2;
        font-size: 14px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        padding: 0;

        &:hover {
          background: rgba(205, 133, 63, 0.2);
        }
      }

      .btn-delete-small:hover {
        background: rgba(239, 68, 68, 0.2);
        border-color: rgba(239, 68, 68, 0.4);
        color: #fca5a5;
      }
    }
  }
}

.legendary-form {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 8px;
  padding: 14px;
  margin-top: 12px;

  .legendary-form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 12px;

    .btn-save-small {
      padding: 6px 16px;
      background: rgba(139, 92, 246, 0.2);
      border: 1px solid rgba(139, 92, 246, 0.4);
      border-radius: 4px;
      color: #c4b5fd;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        background: rgba(139, 92, 246, 0.3);
      }
    }
  }
}
</style>
