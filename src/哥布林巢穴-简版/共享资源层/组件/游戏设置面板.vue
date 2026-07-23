<template>
  <div v-if="show" class="settings-overlay">
    <div class="settings-panel" @click.stop>
      <div class="panel-header">
        <h3>⚙️ 游戏设置</h3>
        <button class="close-btn" @click="close">×</button>
      </div>

      <div class="panel-content">
        <!-- 选项卡导航 -->
        <div class="tabs-nav">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            class="tab-button"
            :class="{ active: activeTab === tab.id }"
            @click="activeTab = tab.id"
          >
            <span class="tab-icon">{{ tab.icon }}</span>
            <span class="tab-label">{{ tab.label }}</span>
          </button>
        </div>

        <!-- AI 输出设置 -->
        <div v-show="activeTab === 'ai'" class="settings-section">
          <h4 class="section-title">AI 输出设置</h4>

          <div class="setting-item">
            <label class="setting-label">
              <span class="label-text">启用流式传输</span>
              <span class="label-desc">AI回复实时显示，体验更流畅（如果总是截断，请关闭）</span>
            </label>
            <label class="switch-container">
              <input v-model="enableStream" type="checkbox" class="switch-input" @change="updateStreamingSetting" />
              <span class="switch-slider"></span>
            </label>
          </div>
        </div>

        <!-- 自定义API设置 -->
        <div v-show="activeTab === 'api'" class="settings-section">
          <CustomApiSettings ref="customApiSettingsRef" />
        </div>

        <!-- 游戏机制设置 -->
        <div v-show="activeTab === 'game'" class="settings-section">
          <h4 class="section-title">游戏机制设置</h4>

          <div class="setting-item">
            <label class="setting-label">
              <span class="label-text">据点人物生成概率修正</span>
              <span class="label-desc"
                >据点生成人物的真实概率（0-100%，设置为0则关闭生成，不设置则使用默认概率机制）</span
              >
            </label>
            <div class="checkbox-container" style="margin-bottom: 12px">
              <label class="checkbox-label">
                <input
                  v-model="enableCustomHeroProbability"
                  type="checkbox"
                  class="checkbox-input"
                  @change="onCustomHeroProbabilityToggle"
                />
                <span class="checkbox-text">启用自定义人物生成概率</span>
              </label>
            </div>
            <div class="slider-container">
              <input
                v-model="heroGenerationModifier"
                type="range"
                min="0"
                max="100"
                class="slider-input"
                :disabled="!enableCustomHeroProbability"
                @input="updateHeroModifier"
              />
              <span class="slider-value">{{ heroGenerationModifier }}%</span>
            </div>
          </div>

          <div class="setting-item">
            <label class="setting-label">
              <span class="label-text">侦察奖励倍数: {{ scoutRewardMultiplier }}x</span>
              <span class="label-desc">侦察队返回的资源奖励乘以该倍数（1.0=原始，2.0=双倍）</span>
            </label>
            <input
              v-model.number="scoutRewardMultiplier"
              type="range"
              min="1"
              max="10"
              step="0.1"
              class="slider-input"
              @input="updateScoutRewardMultiplier"
            />
          </div>

          <div class="setting-item">
            <label class="setting-label">
              <span class="label-text">人物生成格式</span>
              <span class="label-desc">如果频繁截断，可以尝试换一种格式</span>
            </label>
            <select v-model="characterFormat" class="format-select" @change="updateCharacterFormat">
              <option value="json">JSON</option>
              <option value="yaml">YAML</option>
            </select>
          </div>

          <div class="setting-item">
            <label class="setting-label">
              <span class="label-text">侦察时输入额外提示词</span>
              <span class="label-desc">侦察据点发现人物时，允许提前输入额外提示词来影响人物生成</span>
            </label>
            <label class="switch-container">
              <input
                v-model="enableScoutPromptInput"
                type="checkbox"
                class="switch-input"
                @change="updateScoutPromptInputSetting"
              />
              <span class="switch-slider"></span>
            </label>
          </div>

          <div class="setting-item">
            <label class="setting-label">
              <span class="label-text">完全自定义模式</span>
              <span class="label-desc"
                >开启后，人物生成时只使用格式要求和您的自定义提示词，避免据点信息干扰（适合生成其他世界观或动漫人物）<br /><span
                  class="label-hint"
                  >💡 开启此选项将自动开启"侦察时输入额外提示词"</span
                ></span
              >
            </label>
            <label class="switch-container">
              <input
                v-model="enableFullCustomMode"
                type="checkbox"
                class="switch-input"
                @change="updateFullCustomModeSetting"
              />
              <span class="switch-slider"></span>
            </label>
          </div>
        </div>

        <!-- 思维链格式自定义 -->
        <div v-show="activeTab === 'chain'" class="settings-section">
          <h4 class="section-title">思维链格式自定义</h4>
          <div class="setting-item">
            <label class="setting-label">
              <span class="label-text">自定义思维链格式</span>
              <span class="label-desc">可以自定义所有思维链模式的提示词格式，留空则使用默认格式</span>
            </label>
            <select v-model="selectedChainMode" class="format-select" @change="loadChainFormat">
              <option :value="ChainOfThoughtMode.LOCATION_GENERATION">据点生成思维链</option>
              <option :value="ChainOfThoughtMode.CHARACTER_GENERATION">人物生成思维链</option>
              <option :value="ChainOfThoughtMode.PRE_BATTLE_DIALOGUE">战前对话思维链</option>
              <option :value="ChainOfThoughtMode.BATTLE_SUMMARY">战斗总结思维链</option>
              <option :value="ChainOfThoughtMode.CHARACTER_TRAINING">人物调教思维链</option>
              <option :value="ChainOfThoughtMode.RANDOM_EVENT">随机事件思维链</option>
              <option :value="ChainOfThoughtMode.STORY_SUMMARY">剧情总结思维链</option>
            </select>
          </div>

          <div class="setting-item">
            <label class="setting-label">
              <span class="label-text">{{ getCurrentChainModeName() }}</span>
              <span class="label-desc">支持多行文本，留空则使用默认格式</span>
            </label>
            <textarea
              v-model="currentChainFormat"
              class="chain-textarea"
              rows="12"
              placeholder="输入自定义思维链格式..."
            ></textarea>
          </div>

          <div class="setting-item">
            <div class="button-group">
              <button class="chain-action-button" @click="saveChainFormat">💾 保存当前格式</button>
              <button class="chain-action-button secondary" @click="loadDefaultChainFormat">👁️ 查看默认格式</button>
            </div>
            <div class="button-group" style="margin-top: 12px">
              <button class="chain-action-button secondary" @click="exportChainFormats">📤 导出为文件</button>
              <button class="chain-action-button secondary" @click="triggerChainFileImport">📥 从文件导入</button>
              <input
                ref="chainFileInput"
                type="file"
                accept=".json"
                style="display: none"
                @change="handleChainFileImport"
              />
            </div>
          </div>
        </div>

        <!-- 人物指导风格自定义 -->
        <div v-show="activeTab === 'guideline'" class="settings-section">
          <h4 class="section-title">人物指导风格自定义</h4>

          <!-- 指导风格主题管理 -->
          <div class="setting-item">
            <label class="setting-label">
              <span class="label-text">指导风格主题</span>
              <span class="label-desc">管理可复用的指导风格主题模板。主题可以在人物信息中关联使用。</span>
            </label>

            <!-- 显示当前默认主题 -->
            <div v-if="defaultThemeId && guidelineThemes[defaultThemeId]" class="default-theme-indicator">
              <div style="display: flex; align-items: center; justify-content: space-between">
                <span class="label-desc" style="color: #fbbf24; font-weight: 600; line-height: 1.4; font-size: 13px">
                  ⭐ 当前全局默认主题：{{ guidelineThemes[defaultThemeId].name }}
                </span>
                <button class="preview-toggle-button" @click="showDefaultThemePreview = !showDefaultThemePreview">
                  {{ showDefaultThemePreview ? '🔽' : '▶️' }}
                </button>
              </div>
              <!-- 显示默认主题的指导词内容 -->
              <div v-if="showDefaultThemePreview" class="default-theme-preview">
                <div
                  v-for="(item, index) in getDefaultThemeGuidelines().filter(
                    (i): i is LoyaltyGuidelineItem & { loyalty: number } => i.loyalty !== undefined,
                  )"
                  :key="index"
                  class="preview-guideline-item"
                >
                  <div class="preview-label">
                    <strong>忠诚度 ≥ {{ item.loyalty }}</strong>
                    <span style="margin-left: 8px; font-size: 12px; color: #9ca3af">
                      {{ getLoyaltyThresholdName(item.loyalty) }}
                    </span>
                  </div>
                  <div class="preview-content">{{ item.content }}</div>
                </div>
              </div>
            </div>
            <div v-else class="default-theme-indicator">
              <div style="display: flex; align-items: center; justify-content: space-between">
                <span class="label-desc" style="color: #9ca3af; line-height: 1.4; font-size: 13px">
                  💡 未设置全局默认主题，将使用系统默认配置
                </span>
                <button class="preview-toggle-button" @click="showDefaultThemePreview = !showDefaultThemePreview">
                  {{ showDefaultThemePreview ? '🔽' : '▶️' }}
                </button>
              </div>
              <!-- 显示系统默认配置的指导词内容 -->
              <div v-if="showDefaultThemePreview" class="default-theme-preview">
                <div
                  v-for="(item, index) in CharacterGuidelineGenerator.getDefaultGuidelines().filter(
                    (i): i is LoyaltyGuidelineItem & { loyalty: number } => i.loyalty !== undefined,
                  )"
                  :key="index"
                  class="preview-guideline-item"
                >
                  <div class="preview-label">
                    <strong>忠诚度 ≥ {{ item.loyalty }}</strong>
                    <span style="margin-left: 8px; font-size: 12px; color: #9ca3af">
                      {{ getLoyaltyThresholdName(item.loyalty) }}
                    </span>
                  </div>
                  <div class="preview-content">{{ item.content }}</div>
                </div>
              </div>
            </div>

            <div style="margin-bottom: 12px; margin-top: 8px">
              <select
                v-model="selectedThemeId"
                class="format-select"
                style="width: 100%; margin-bottom: 8px"
                @change="loadTheme"
              >
                <option value="">请选择主题（或创建新主题）</option>
                <option v-for="(theme, themeId) in guidelineThemes" :key="themeId" :value="themeId">
                  {{ theme.name }}{{ themeId === defaultThemeId ? ' ⭐（全局默认）' : '' }}
                </option>
              </select>
              <div class="button-group">
                <button class="chain-action-button secondary" @click="openCreateThemeDialog">➕ 新建主题</button>
                <button v-if="selectedThemeId" class="chain-action-button secondary" @click="setAsDefaultTheme">
                  ⭐ 设为全局默认
                </button>
                <button
                  v-if="selectedThemeId"
                  class="chain-action-button secondary"
                  style="color: #ef4444; border-color: #ef4444"
                  @click="deleteTheme"
                >
                  🗑️ 删除主题
                </button>
              </div>
              <div class="button-group" style="margin-top: 8px">
                <button class="chain-action-button secondary" @click="exportGuidelineSettings">📤 导出主题库</button>
                <button class="chain-action-button secondary" @click="triggerGuidelineFileImport">📥 导入主题库</button>
                <input
                  ref="guidelineFileInput"
                  type="file"
                  accept=".json"
                  style="display: none"
                  @change="handleGuidelineFileImport"
                />
              </div>
            </div>
            <!-- 创建主题对话框 -->
            <div v-if="showCreateThemeDialog" class="dialog-overlay" @click.self="showCreateThemeDialog = false">
              <div class="dialog-content" @click.stop>
                <h5>创建新主题</h5>
                <input v-model="newThemeName" type="text" class="text-input" placeholder="输入主题名称" />
                <div style="display: flex; gap: 8px; margin-top: 12px">
                  <button class="chain-action-button" @click="createNewTheme">创建</button>
                  <button class="chain-action-button secondary" @click="showCreateThemeDialog = false">取消</button>
                </div>
              </div>
            </div>
          </div>

          <!-- 主题编辑 -->
          <div v-if="selectedThemeId" class="setting-item">
            <label class="setting-label">
              <span class="label-text">主题名称</span>
              <span class="label-desc">主题的描述性名称</span>
            </label>
            <input v-model="currentTheme.name" type="text" class="text-input" placeholder="输入主题名称" />
          </div>
          <div v-if="selectedThemeId" class="setting-item">
            <button class="chain-action-button" @click="saveTheme">💾 保存当前主题</button>
          </div>

          <!-- 未捕获/敌人状态（-100） -->
          <div v-if="selectedThemeId" class="divider" style="margin: 16px 0"></div>
          <h5 v-if="selectedThemeId" class="subsection-title">未捕获/敌人状态（忠诚度：-100）</h5>
          <div v-if="selectedThemeId" class="setting-item">
            <label class="setting-label">
              <span class="label-text">提示词内容</span>
              <span class="label-desc">第一行作为状态描述，空行后每行一个指导原则</span>
            </label>
            <textarea
              v-model="getUncapturedConfig().contentText"
              class="chain-textarea"
              rows="8"
              placeholder="输入指导原则..."
            ></textarea>
          </div>

          <!-- 忠诚度区间配置 -->
          <div v-if="selectedThemeId" class="divider" style="margin: 16px 0"></div>
          <h5 v-if="selectedThemeId" class="subsection-title">忠诚度区间配置</h5>
          <div v-if="selectedThemeId" class="setting-item">
            <label class="setting-label">
              <span class="label-text">忠诚度区间提示词</span>
              <span class="label-desc"
                >配置不同忠诚度区间的提示词。-100:未捕获, 0:正常状态起始,
                100:完全堕落。当忠诚度≥阈值时应用对应配置。</span
              >
            </label>
            <div class="button-group" style="margin-top: 8px">
              <button class="chain-action-button secondary" @click="addLoyaltyGuideline">➕ 添加忠诚度区间</button>
              <button class="chain-action-button secondary" @click="ensureBasicLoyaltyIntervals">
                📋 添加基础区间（0和100）
              </button>
            </div>
          </div>
          <template v-if="selectedThemeId">
            <div v-for="(item, index) in getLoyaltyIntervals()" :key="index" class="loyalty-guideline-item">
              <div style="margin-bottom: 8px">
                <label class="setting-label" style="margin: 0">
                  <span class="label-text">忠诚度阈值 ≥</span>
                  <span class="label-desc" style="margin-left: 8px; font-size: 12px; color: #9ca3af">
                    {{ getLoyaltyThresholdName(item.loyalty) }}
                  </span>
                </label>
                <div style="margin-top: 4px; margin-bottom: 8px">
                  <input
                    v-model.number="item.loyalty"
                    type="number"
                    min="-100"
                    max="100"
                    class="text-input"
                    placeholder="-100, 0-99, 或 100"
                    style="width: 100%; margin-bottom: 8px"
                  />
                  <button
                    v-if="item.loyalty !== -100"
                    class="chain-action-button secondary"
                    style="width: 100%; padding: 8px 12px; font-size: 12px"
                    @click="removeLoyaltyGuideline(getLoyaltyIndex(item.loyalty))"
                  >
                    ❌ 删除此条目
                  </button>
                </div>
              </div>
              <textarea
                v-model="item.contentText"
                class="chain-textarea"
                rows="4"
                placeholder="输入指导原则..."
              ></textarea>
            </div>
          </template>
          <div v-if="selectedThemeId" class="setting-item">
            <div class="button-group">
              <button class="chain-action-button" @click="saveAllGuidelineSettings">💾 保存当前主题</button>
              <button class="chain-action-button secondary" @click="restoreDefaultGuidelineSettings">
                🔄 恢复到默认配置
              </button>
            </div>
          </div>

          <div v-if="!selectedThemeId" class="setting-item">
            <div class="label-desc" style="color: #9ca3af; font-size: 13px; line-height: 1.6">
              💡 提示：请先选择一个主题进行编辑，或创建一个新主题。
            </div>
          </div>
        </div>

        <!-- 玩家角色设置 -->
        <div v-show="activeTab === 'player'" class="settings-section">
          <h4 class="section-title">玩家角色设置</h4>

          <div class="setting-item">
            <label class="setting-label">
              <span class="label-text">角色名称</span>
              <span class="label-desc">您的角色在游戏中的显示名称</span>
            </label>
            <input v-model="playerName" type="text" class="text-input" placeholder="输入角色名称" />
          </div>

          <div class="setting-item">
            <label class="setting-label">
              <span class="label-text">角色头衔</span>
              <span class="label-desc">您的角色称号或职位</span>
            </label>
            <input v-model="playerTitle" type="text" class="text-input" placeholder="输入角色头衔" />
          </div>

          <div class="setting-item">
            <label class="setting-label">
              <span class="label-text">肖像图</span>
              <span class="label-desc">图片来自 images/默认/哥布林之王/ 目录</span>
            </label>
            <div v-if="playerAvatar" class="avatar-preview">
              <img :src="playerAvatar" alt="哥布林之王" @error="playerAvatar = ''" />
            </div>
            <p v-else class="avatar-hint">请在 images/默认/哥布林之王/ 放入图片文件</p>
          </div>

          <div class="setting-item">
            <button class="save-button" :disabled="isSaving" @click="savePlayerInfo">
              {{ isSaving ? '⏳ 保存中...' : '💾 保存角色信息' }}
            </button>
          </div>
        </div>

        <!-- 其他设置 -->
        <div v-show="activeTab === 'other'" class="settings-section">
          <h4 class="section-title">界面设置</h4>

          <div class="setting-item">
            <button class="style-button" @click="openTextStyleSettings">🎨 对话文字颜色和字体设置</button>
          </div>

          <div class="divider" style="margin: 24px 0"></div>

          <h4 class="section-title">帮助</h4>

          <div class="setting-item">
            <button class="tutorial-button" @click="openTutorial">📖 查看教程（强烈建议先看教程）</button>
          </div>
        </div>

        <!-- 关于游戏 -->
        <div v-show="activeTab === 'about'" class="settings-section">
          <div class="about-content" v-html="aboutHtml"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue';
import {
  CharacterGuidelineGenerator,
  type GuidelineTheme,
  type GuidelineThemeLibrary,
  type LoyaltyGuidelineItem,
} from '../../核心层/服务/世界书管理/工具/人物指导风格生成器';
import { ChainOfThoughtManager, ChainOfThoughtMode } from '../../核心层/服务/世界书管理/工具/思维链管理器';
import { modularSaveManager } from '../../核心层/服务/存档系统/模块化存档服务';
import { toast } from '../../核心层/服务/通用服务/弹窗提示服务';
import { ConfirmService } from '../../核心层/服务/通用服务/确认框服务';
import CustomApiSettings from './设置界面子页面/自定义API设置.vue';

interface Props {
  show: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'open-text-style'): void;
  (e: 'open-tutorial'): void;
}>();

// 流式传输设置
const enableStream = ref(true);

// 据点人物生成概率修正（0-100）
const heroGenerationModifier = ref(0);
// 是否启用自定义人物生成概率
const enableCustomHeroProbability = ref(false);

// 人物生成格式
const characterFormat = ref('json');

// 侦察时输入额外提示词
const enableScoutPromptInput = ref(false);

// 侦察奖励倍数
const scoutRewardMultiplier = ref(1.5);

// 完全自定义模式
const enableFullCustomMode = ref(false);

// 思维链格式自定义
const selectedChainMode = ref<ChainOfThoughtMode>(ChainOfThoughtMode.LOCATION_GENERATION);
const currentChainFormat = ref('');

// 文件导入相关
const chainFileInput = ref<HTMLInputElement | null>(null);

// 人物指导风格自定义 - 主题库管理
const selectedThemeId = ref<string>('');
const guidelineThemes = ref<GuidelineThemeLibrary>({});
const currentTheme = ref<
  GuidelineTheme & { loyaltyGuidelinesWithText: Array<LoyaltyGuidelineItem & { contentText: string }> }
>({
  name: '',
  loyaltyGuidelines: [],
  loyaltyGuidelinesWithText: [],
});
const showCreateThemeDialog = ref(false);
const newThemeName = ref('');

// 全局默认主题ID
const defaultThemeId = ref<string>('');

// 显示默认主题预览
const showDefaultThemePreview = ref(false);

// 当前编辑的主题的忠诚度指导风格
const loyaltyGuidelines = ref<Array<LoyaltyGuidelineItem & { contentText: string }>>([]);

// 文件导入相关
const guidelineFileInput = ref<HTMLInputElement | null>(null);

// 玩家角色信息
const playerName = ref('哥布林之王');
const playerTitle = ref('哥布林巢穴之主');
const playerAvatar = ref('/api/images/goblin-king');

// 关于游戏 HTML 内容
const aboutHtml = `<style>
.about-inner { background:linear-gradient(180deg,rgba(40,26,20,0.98),rgba(25,17,14,0.99)); color:#f0e6d2; font-family:'Microsoft YaHei','微软雅黑','PingFang SC',sans-serif; border:2px solid rgba(205,133,63,0.5); border-radius:16px; padding:24px 28px; max-width:580px; margin:0 auto; box-shadow:0 16px 48px rgba(0,0,0,0.7); }
.about-inner h2 { text-align:center; font-size:26px; color:#f7efd9; text-shadow:0 0 16px rgba(205,133,63,0.3); margin:0 0 14px; padding-bottom:12px; border-bottom:1px solid rgba(205,133,63,0.2); display:flex; align-items:center; justify-content:center; gap:8px; }
.about-inner h2::before { content:"⚔️"; }
.about-inner h2::after { content:"🏰"; }
.about-msg { background:rgba(212,184,150,0.05); border-left:3px solid rgba(212,184,150,0.6); border-radius:10px; padding:14px 18px; margin:0 0 14px; font-size:14px; line-height:1.7; color:#f7efd9; }
.about-links { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin-bottom:14px; }
.about-link { display:flex; align-items:center; gap:6px; background:rgba(25,17,14,0.6); border-radius:30px; padding:8px 14px; border:1px solid rgba(205,133,63,0.2); font-size:13px; color:#f7efd9; text-decoration:none; transition:all .2s; }
.about-link:hover { background:rgba(40,26,20,0.8); border-color:rgba(205,133,63,0.5); }
.about-link-btn { margin-left:auto; background:rgba(205,133,63,0.25); border:1px solid rgba(205,133,63,0.3); border-radius:30px; padding:4px 14px; font-size:12px; font-weight:600; color:#f7efd9; cursor:pointer; }
.about-link-btn:hover { background:rgba(205,133,63,0.4); }
.about-notice { background:rgba(25,17,14,0.6); border-left:3px solid rgba(212,184,150,0.6); border-radius:10px; padding:14px 18px; }
.about-notice h3 { color:#ffd7a1; font-size:15px; margin:0 0 6px; }
.about-notice p { color:#f7efd9; font-size:13px; line-height:1.7; margin:0; }
@media(max-width:540px){ .about-inner{padding:16px 14px;} .about-inner h2{font-size:20px;} }
</style>
<div class="about-inner">
<h2>欢迎游玩哥布林巢穴</h2>
<div class="about-msg">
感谢您游玩本前端界面卡！本前端界面是免费开源项目，严禁任何形式的商业化或盗用行为。<br>
修改为本地游戏二创，二创作者：dragonuniverse8248<br>
如发现侵权行为，请通过Discord联系，原作者：北上<br>
版本号：1.6.0<br>
更新时间：2025-11-29
</div>
<div class="about-links">
<a class="about-link" href="https://docs.google.com/document/d/1UV8hG4hgYfg6nyRHquQ36pz4-Fb8QCB3cxakLXXbRss/edit" target="_blank" rel="noopener">
<span>📖</span> 教程文档 <span class="about-link-btn">查看教程</span>
</a>
<a class="about-link" href="https://discordapp.com/channels/1134557553011998840/1433109877873442876" target="_blank" rel="noopener">
<span>💬</span> Discord帖子 <span class="about-link-btn">查看帖子</span>
</a>
</div>
<div class="about-notice">
<h3>⚠️ 重要提示</h3>
<p>强烈推荐全屏进行游玩，尤其是手机端~手机端个人推荐Via浏览器。<br>
游玩前请务必确保：<br>
1. 酒馆助手设置关闭渲染器-启用BlobURL渲染<br>
2. 预设正则请保证打开仅格式显示和仅格式提示词</p>
</div>
</div>`;

// 文件上传相关
const fileInput = ref<HTMLInputElement | null>(null);

// 自定义API设置组件引用
const customApiSettingsRef = ref<InstanceType<typeof CustomApiSettings> | null>(null);

// 保存状态，防止重复点击
const isSaving = ref(false);

// 加载保存的设置
const loadSettings = () => {
  try {
    const globalVars = getVariables({ type: 'global' });

    // 加载流式传输设置，默认为 true
    if (typeof globalVars['enable_stream_output'] === 'boolean') {
      enableStream.value = globalVars['enable_stream_output'];
    } else {
      enableStream.value = true; // 默认开启
    }

    // 加载据点人物生成概率修正
    if (typeof globalVars['hero_generation_modifier'] === 'number') {
      enableCustomHeroProbability.value = true;
      heroGenerationModifier.value = Math.round(globalVars['hero_generation_modifier'] * 100); // 转换为百分比显示
    } else {
      enableCustomHeroProbability.value = false;
      heroGenerationModifier.value = 0; // 默认为 0
    }

    // 加载侦察奖励倍数
    if (typeof globalVars['scout_reward_multiplier'] === 'number' && globalVars['scout_reward_multiplier'] >= 1) {
      scoutRewardMultiplier.value = globalVars['scout_reward_multiplier'];
    }

    // 加载人物生成格式
    if (typeof globalVars['character_generation_format'] === 'string') {
      characterFormat.value = globalVars['character_generation_format'];
    } else {
      characterFormat.value = 'json'; // 默认为 JSON
    }

    // 加载侦察时输入额外提示词设置，默认为 false
    if (typeof globalVars['enable_scout_prompt_input'] === 'boolean') {
      enableScoutPromptInput.value = globalVars['enable_scout_prompt_input'];
    } else {
      enableScoutPromptInput.value = false; // 默认关闭
    }

    // 加载完全自定义模式设置，默认为 false
    if (typeof globalVars['enable_full_custom_mode'] === 'boolean') {
      enableFullCustomMode.value = globalVars['enable_full_custom_mode'];
    } else {
      enableFullCustomMode.value = false; // 默认关闭
    }

    // 加载玩家角色信息
    loadPlayerInfo();

    // 加载思维链格式
    loadChainFormat();

    // 加载人物指导风格
    loadGuidelineSettings();

    console.log('📋 已加载游戏设置:', {
      enableStream: enableStream.value,
      heroModifier: heroGenerationModifier.value,
      characterFormat: characterFormat.value,
      enableScoutPromptInput: enableScoutPromptInput.value,
      enableFullCustomMode: enableFullCustomMode.value,
    });
  } catch (error) {
    console.error('加载游戏设置失败:', error);
  }
};

// 加载玩家角色信息
const loadPlayerInfo = () => {
  try {
    const trainingData = modularSaveManager.getModuleData({ moduleName: 'training' }) as any;
    if (trainingData && trainingData.characters) {
      const playerCharacter = trainingData.characters.find((char: any) => char.id === 'player-1');
      if (playerCharacter) {
        playerName.value = playerCharacter.name || '哥布林之王';
        playerTitle.value = playerCharacter.title || '哥布林巢穴之主';
        // 哥布林之王始终使用本地图片目录，不再使用旧远程URL
        playerAvatar.value = '/api/images/goblin-king';

        console.log('📋 已加载玩家角色信息:', {
          name: playerName.value,
          title: playerTitle.value,
          avatar: playerAvatar.value,
        });
      }
    }
  } catch (error) {
    console.error('加载玩家角色信息失败:', error);
  }
};

// 保存流式传输设置
const updateStreamingSetting = () => {
  try {
    const globalVars = getVariables({ type: 'global' });
    globalVars['enable_stream_output'] = enableStream.value;
    replaceVariables(globalVars, { type: 'global' });
    console.log('💾 流式传输设置已保存:', enableStream.value);
  } catch (error) {
    console.error('保存流式传输设置失败:', error);
  }
};

// 切换自定义人物生成概率开关
const onCustomHeroProbabilityToggle = () => {
  try {
    const globalVars = getVariables({ type: 'global' });
    if (enableCustomHeroProbability.value) {
      // 启用时，保存当前滑块值
      globalVars['hero_generation_modifier'] = heroGenerationModifier.value / 100; // 转换为 0-1 范围保存
      replaceVariables(globalVars, { type: 'global' });
      console.log('💾 已启用自定义人物生成概率:', `${heroGenerationModifier.value}%`);
    } else {
      // 禁用时，删除该变量（使用默认机制）
      // 使用 lodash 的 unset 方法确保删除成功
      _.unset(globalVars, 'hero_generation_modifier');
      replaceVariables(globalVars, { type: 'global' });

      // 验证变量是否已成功删除
      const verifyVars = getVariables({ type: 'global' });
      if (verifyVars['hero_generation_modifier'] === undefined) {
        console.log('✅ 已禁用自定义人物生成概率，变量已删除，将使用默认概率机制');
      } else {
        console.warn('⚠️ 警告：变量删除可能未生效，变量值:', verifyVars['hero_generation_modifier']);
      }
    }
  } catch (error) {
    console.error('切换自定义人物生成概率设置失败:', error);
  }
};

// 保存据点人物生成概率修正
const updateHeroModifier = () => {
  if (!enableCustomHeroProbability.value) {
    return; // 如果未启用，不保存
  }
  try {
    const globalVars = getVariables({ type: 'global' });
    globalVars['hero_generation_modifier'] = heroGenerationModifier.value / 100; // 转换为 0-1 范围保存
    replaceVariables(globalVars, { type: 'global' });
    console.log('💾 据点人物生成概率修正已保存:', `${heroGenerationModifier.value}%`);
  } catch (error) {
    console.error('保存据点人物生成概率修正失败:', error);
  }
};

// 保存侦察奖励倍数
const updateScoutRewardMultiplier = () => {
  try {
    const globalVars = getVariables({ type: 'global' });
    globalVars['scout_reward_multiplier'] = scoutRewardMultiplier.value;
    replaceVariables(globalVars, { type: 'global' });
  } catch (error) {
    console.error('保存侦察奖励倍数失败:', error);
  }
};

// 保存人物生成格式
const updateCharacterFormat = () => {
  try {
    const globalVars = getVariables({ type: 'global' });
    globalVars['character_generation_format'] = characterFormat.value;
    replaceVariables(globalVars, { type: 'global' });
    console.log('💾 人物生成格式已保存:', characterFormat.value);
  } catch (error) {
    console.error('保存人物生成格式失败:', error);
  }
};

// 保存侦察时输入额外提示词设置
const updateScoutPromptInputSetting = () => {
  try {
    const globalVars = getVariables({ type: 'global' });
    globalVars['enable_scout_prompt_input'] = enableScoutPromptInput.value;

    // 如果关闭了"侦察时输入额外提示词"，且"完全自定义模式"是开启的，则自动关闭"完全自定义模式"
    if (!enableScoutPromptInput.value && enableFullCustomMode.value) {
      enableFullCustomMode.value = false;
      globalVars['enable_full_custom_mode'] = false;
      console.log('💡 已自动关闭"完全自定义模式"（需要先开启"侦察时输入额外提示词"）');
    }

    replaceVariables(globalVars, { type: 'global' });
    console.log('💾 侦察时输入额外提示词设置已保存:', enableScoutPromptInput.value);
  } catch (error) {
    console.error('保存侦察时输入额外提示词设置失败:', error);
  }
};

// 保存完全自定义模式设置
const updateFullCustomModeSetting = () => {
  try {
    const globalVars = getVariables({ type: 'global' });
    globalVars['enable_full_custom_mode'] = enableFullCustomMode.value;

    // 如果开启"完全自定义模式"，则自动开启"侦察时输入额外提示词"
    if (enableFullCustomMode.value && !enableScoutPromptInput.value) {
      enableScoutPromptInput.value = true;
      globalVars['enable_scout_prompt_input'] = true;
      console.log('💡 已自动开启"侦察时输入额外提示词"（完全自定义模式需要此功能）');
    }

    replaceVariables(globalVars, { type: 'global' });
    console.log('💾 完全自定义模式设置已保存:', enableFullCustomMode.value);
  } catch (error) {
    console.error('保存完全自定义模式设置失败:', error);
  }
};

// 获取当前思维链模式名称
const getCurrentChainModeName = (): string => {
  const modeNames: Record<ChainOfThoughtMode, string> = {
    [ChainOfThoughtMode.LOCATION_GENERATION]: '据点生成思维链',
    [ChainOfThoughtMode.CHARACTER_GENERATION]: '人物生成思维链',
    [ChainOfThoughtMode.PRE_BATTLE_DIALOGUE]: '战前对话思维链',
    [ChainOfThoughtMode.BATTLE_SUMMARY]: '战斗总结思维链',
    [ChainOfThoughtMode.CHARACTER_TRAINING]: '人物调教思维链',
    [ChainOfThoughtMode.RANDOM_EVENT]: '随机事件思维链',
    [ChainOfThoughtMode.STORY_SUMMARY]: '剧情总结思维链',
  };
  return modeNames[selectedChainMode.value] || '未知模式';
};

// 加载思维链格式
const loadChainFormat = () => {
  try {
    const globalVars = getVariables({ type: 'global' });
    const customChainKey = `chain_of_thought_${selectedChainMode.value}`;
    // 检查是否有自定义格式（包括空字符串，表示用户明确清空了）
    if (customChainKey in globalVars && typeof globalVars[customChainKey] === 'string') {
      currentChainFormat.value = globalVars[customChainKey];
    } else {
      // 如果没有自定义格式，加载默认格式用于显示
      currentChainFormat.value = ChainOfThoughtManager.getDefaultChain(selectedChainMode.value);
    }
  } catch (error) {
    console.error('加载思维链格式失败:', error);
    currentChainFormat.value = ChainOfThoughtManager.getDefaultChain(selectedChainMode.value);
  }
};

// 保存思维链格式
const saveChainFormat = () => {
  try {
    const globalVars = getVariables({ type: 'global' });
    const customChainKey = `chain_of_thought_${selectedChainMode.value}`;

    if (currentChainFormat.value.trim()) {
      globalVars[customChainKey] = currentChainFormat.value.trim();
      console.log(`💾 已保存自定义思维链格式: ${getCurrentChainModeName()}`);
    } else {
      // 如果为空，删除自定义格式，使用默认格式
      delete globalVars[customChainKey];
      console.log(`💾 已清空自定义思维链格式，将使用默认格式: ${getCurrentChainModeName()}`);
    }

    replaceVariables(globalVars, { type: 'global' });
  } catch (error) {
    console.error('保存思维链格式失败:', error);
  }
};

// 查看默认思维链格式（临时显示，不保存）
const loadDefaultChainFormat = () => {
  currentChainFormat.value = ChainOfThoughtManager.getDefaultChain(selectedChainMode.value);
  console.log(
    `👁️ 已加载默认思维链格式用于查看: ${getCurrentChainModeName()}（只是临时显示，需要点击"保存当前格式"才会应用）`,
  );
};

// 加载人物指导风格设置（主题库）
const loadGuidelineSettings = () => {
  try {
    const globalVars = getVariables({ type: 'global' });
    const themeLibraryKey = 'guideline_theme_library';
    const defaultThemeKey = 'guideline_default_theme_id';

    // 加载主题库
    if (globalVars[themeLibraryKey] && typeof globalVars[themeLibraryKey] === 'object') {
      guidelineThemes.value = globalVars[themeLibraryKey] as GuidelineThemeLibrary;
    } else {
      guidelineThemes.value = {};
    }

    // 加载全局默认主题ID
    if (typeof globalVars[defaultThemeKey] === 'string') {
      defaultThemeId.value = globalVars[defaultThemeKey];
    } else {
      defaultThemeId.value = '';
    }

    // 如果有默认主题，自动选中
    if (defaultThemeId.value && guidelineThemes.value[defaultThemeId.value]) {
      selectedThemeId.value = defaultThemeId.value;
      loadTheme();
    } else if (Object.keys(guidelineThemes.value).length > 0) {
      // 如果没有默认主题但有主题，选中第一个
      const firstThemeId = Object.keys(guidelineThemes.value)[0];
      selectedThemeId.value = firstThemeId;
      loadTheme();
    } else {
      // 如果没有主题，加载默认配置作为临时编辑
      loadDefaultGuidelineSettings();
    }
  } catch (error) {
    console.error('加载人物指导风格设置失败:', error);
    loadDefaultGuidelineSettings();
  }
};

// 加载默认设置（用于编辑新主题时的临时显示）
const loadDefaultGuidelineSettings = () => {
  // 使用 CharacterGuidelineGenerator.getDefaultGuidelines() 获取完整的默认配置
  // 包含所有忠诚度区间：-100, 0, 20, 40, 60, 80, 100
  const defaultGuidelines = CharacterGuidelineGenerator.getDefaultGuidelines();

  if (defaultGuidelines && defaultGuidelines.length > 0) {
    // 过滤掉没有 loyalty 的项并添加 contentText 字段
    loyaltyGuidelines.value = defaultGuidelines
      .filter((item): item is LoyaltyGuidelineItem & { loyalty: number } => item.loyalty !== undefined)
      .map((item: LoyaltyGuidelineItem) => ({
        ...item,
        contentText: item.content || '',
      }));
  } else {
    // 如果获取失败，至少初始化基础配置
    loyaltyGuidelines.value = [
      {
        loyalty: -100,
        content: CharacterGuidelineGenerator.getDefaultContentByLoyaltyValue(-100),
        contentText: CharacterGuidelineGenerator.getDefaultContentByLoyaltyValue(-100),
      },
      {
        loyalty: 0,
        content: CharacterGuidelineGenerator.getDefaultContentByLoyaltyValue(0),
        contentText: CharacterGuidelineGenerator.getDefaultContentByLoyaltyValue(0),
      },
      {
        loyalty: 100,
        content: CharacterGuidelineGenerator.getDefaultContentByLoyaltyValue(100),
        contentText: CharacterGuidelineGenerator.getDefaultContentByLoyaltyValue(100),
      },
    ];
  }
};

// 获取未捕获配置（-100）
const getUncapturedConfig = () => {
  let config = loyaltyGuidelines.value.find(item => item.loyalty !== undefined && item.loyalty === -100);
  if (!config) {
    // 如果没有找到，创建一个默认的
    config = {
      loyalty: -100,
      content: CharacterGuidelineGenerator.getDefaultContentByLoyaltyValue(-100),
      contentText: CharacterGuidelineGenerator.getDefaultContentByLoyaltyValue(-100),
    };
    loyaltyGuidelines.value.push(config);
  }
  return config;
};

// 获取忠诚度区间（排除-100，只返回有 loyalty 字段的项）
const getLoyaltyIntervals = () => {
  return loyaltyGuidelines.value.filter(
    (item): item is LoyaltyGuidelineItem & { loyalty: number; contentText: string } =>
      item.loyalty !== undefined && item.loyalty !== -100,
  );
};

// 获取忠诚度项的索引（在排除-100后的数组中）
const getLoyaltyIndex = (loyalty: number | undefined) => {
  if (loyalty === undefined) return -1;
  const intervals = getLoyaltyIntervals();
  return intervals.findIndex(item => item.loyalty === loyalty);
};

// 获取忠诚度阈值名称
const getLoyaltyThresholdName = (loyalty: number) => {
  if (loyalty === -100) return '（未捕获/敌人）';
  if (loyalty === 0) return '（正常状态起始）';
  if (loyalty === 100) return '（完全堕落）';
  return `（忠诚度 ${loyalty}）`;
};

// 获取默认主题的指导词内容
const getDefaultThemeGuidelines = (): LoyaltyGuidelineItem[] => {
  if (defaultThemeId.value && guidelineThemes.value[defaultThemeId.value]) {
    return guidelineThemes.value[defaultThemeId.value].loyaltyGuidelines;
  }
  return [];
};

// 确保基础区间存在（0和100）
const ensureBasicLoyaltyIntervals = () => {
  // 检查并添加0（正常状态起始）
  if (!loyaltyGuidelines.value.find(item => item.loyalty !== undefined && item.loyalty === 0)) {
    loyaltyGuidelines.value.push({
      loyalty: 0,
      content: CharacterGuidelineGenerator.getDefaultContentByLoyaltyValue(0),
      contentText: CharacterGuidelineGenerator.getDefaultContentByLoyaltyValue(0),
    });
  }

  // 检查并添加100（完全堕落）
  if (!loyaltyGuidelines.value.find(item => item.loyalty !== undefined && item.loyalty === 100)) {
    loyaltyGuidelines.value.push({
      loyalty: 100,
      content: CharacterGuidelineGenerator.getDefaultContentByLoyaltyValue(100),
      contentText: CharacterGuidelineGenerator.getDefaultContentByLoyaltyValue(100),
    });
  }

  // 按忠诚度降序排序（只排序有 loyalty 字段的项）
  loyaltyGuidelines.value.sort((a, b) => {
    const aLoyalty = a.loyalty ?? -Infinity;
    const bLoyalty = b.loyalty ?? -Infinity;
    return bLoyalty - aLoyalty;
  });

  toast.success('已添加基础区间', { title: '操作成功' });
};

// 加载主题
const loadTheme = () => {
  if (!selectedThemeId.value || !guidelineThemes.value[selectedThemeId.value]) {
    currentTheme.value = {
      name: '',
      loyaltyGuidelines: [],
      loyaltyGuidelinesWithText: [],
    };
    loyaltyGuidelines.value = [];
    return;
  }

  const theme = guidelineThemes.value[selectedThemeId.value];
  currentTheme.value = {
    ...theme,
    loyaltyGuidelinesWithText: theme.loyaltyGuidelines.map(item => ({
      ...item,
      contentText: item.content || '',
    })),
  };
  loyaltyGuidelines.value = [...currentTheme.value.loyaltyGuidelinesWithText];
};

// 保存当前主题
const saveTheme = () => {
  if (!selectedThemeId.value) return;

  try {
    const globalVars = getVariables({ type: 'global' });
    const themeLibraryKey = 'guideline_theme_library';

    // 确保所有内容已更新
    loyaltyGuidelines.value.forEach(item => {
      item.content = item.contentText.trim();
    });

    // 转换为保存格式（过滤掉没有 loyalty 的项）
    const loyaltyItems: LoyaltyGuidelineItem[] = loyaltyGuidelines.value
      .filter(
        (item): item is LoyaltyGuidelineItem & { loyalty: number; contentText: string } => item.loyalty !== undefined,
      )
      .map(item => ({
        loyalty: item.loyalty,
        content: item.contentText.trim(),
      }));

    // 按忠诚度降序排序
    loyaltyItems.sort((a, b) => {
      const aLoyalty = a.loyalty ?? -Infinity;
      const bLoyalty = b.loyalty ?? -Infinity;
      return bLoyalty - aLoyalty;
    });

    const theme: GuidelineTheme = {
      name: currentTheme.value.name,
      loyaltyGuidelines: loyaltyItems,
    };

    // 更新主题库
    if (!guidelineThemes.value) {
      guidelineThemes.value = {};
    }
    guidelineThemes.value[selectedThemeId.value] = theme;
    currentTheme.value = {
      ...theme,
      loyaltyGuidelinesWithText: theme.loyaltyGuidelines.map(item => ({
        ...item,
        contentText: item.content || '',
      })),
    };

    // 保存到全局变量
    globalVars[themeLibraryKey] = guidelineThemes.value;
    replaceVariables(globalVars, { type: 'global' });

    toast.success(`已保存主题: ${theme.name}`, { title: '保存成功' });
    console.log(`💾 已保存主题: ${theme.name}`);
  } catch (error) {
    console.error('保存主题失败:', error);
    toast.error('保存主题失败', { title: '错误' });
  }
};

// 添加忠诚度区间
const addLoyaltyGuideline = () => {
  loyaltyGuidelines.value.push({
    loyalty: 50,
    content: '',
    contentText: '',
  });
  // 按忠诚度降序排序（只排序有 loyalty 字段的项）
  loyaltyGuidelines.value.sort((a, b) => {
    const aLoyalty = a.loyalty ?? -Infinity;
    const bLoyalty = b.loyalty ?? -Infinity;
    return bLoyalty - aLoyalty;
  });
};

// 删除忠诚度区间
const removeLoyaltyGuideline = (index: number) => {
  const intervals = getLoyaltyIntervals();
  const item = intervals[index];
  if (item && item.loyalty !== undefined) {
    const actualIndex = loyaltyGuidelines.value.findIndex(i => i.loyalty === item.loyalty);
    if (actualIndex !== -1) {
      loyaltyGuidelines.value.splice(actualIndex, 1);
    }
  }
};

// 保存所有配置（保存当前主题）
const saveAllGuidelineSettings = () => {
  // 如果有选中的主题，保存主题；否则创建新主题
  if (selectedThemeId.value) {
    saveTheme();
  } else {
    toast.warning('请先选择或创建一个主题', { title: '提示' });
  }
};

// 恢复到默认配置（恢复当前主题到默认值）
const restoreDefaultGuidelineSettings = () => {
  try {
    const defaultGuidelines = CharacterGuidelineGenerator.getDefaultGuidelines();

    if (defaultGuidelines && defaultGuidelines.length > 0) {
      // 更新界面上的配置（过滤掉没有 loyalty 的项）
      loyaltyGuidelines.value = defaultGuidelines
        .filter((item): item is LoyaltyGuidelineItem & { loyalty: number } => item.loyalty !== undefined)
        .map(item => ({
          ...item,
          contentText: item.content || '',
        }));

      // 如果当前主题存在，也更新主题中的配置
      if (selectedThemeId.value && currentTheme.value) {
        currentTheme.value.loyaltyGuidelinesWithText = [...loyaltyGuidelines.value];
      }

      toast.success('已恢复到默认配置', { title: '操作成功' });
      console.log('🔄 已恢复到默认配置');
    }
  } catch (error) {
    console.error('恢复默认配置失败:', error);
    toast.error('恢复默认配置失败', { title: '错误' });
  }
};

// 导出指导风格配置（主题库）
const exportGuidelineSettings = async () => {
  try {
    const globalVars = getVariables({ type: 'global' });
    const themeLibraryKey = 'guideline_theme_library';
    const defaultThemeKey = 'guideline_default_theme_id';

    const themeLibrary = (globalVars[themeLibraryKey] || {}) as GuidelineThemeLibrary;
    const defaultThemeId = globalVars[defaultThemeKey] as string | undefined;

    const exportData = {
      version: '2.0',
      description: '哥布林巢穴人物指导风格主题库',
      themeLibrary,
      defaultThemeId,
      exportedAt: new Date().toISOString(),
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `人物指导风格主题库_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    await ConfirmService.showSuccess('已导出人物指导风格主题库', '导出成功', '文件已保存到您的下载文件夹。');
    console.log('✅ 人物指导风格主题库已导出:', exportData);
  } catch (error) {
    console.error('导出人物指导风格主题库失败:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    await ConfirmService.showDanger(`导出失败：${errorMessage}`, '导出失败', '请重试或检查文件权限。');
  }
};

// 触发文件选择
const triggerGuidelineFileImport = () => {
  guidelineFileInput.value?.click();
};

// 处理文件导入
const handleGuidelineFileImport = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (!file) return;

  try {
    const text = await file.text();
    let importData: any;

    try {
      importData = JSON.parse(text);
    } catch (parseError) {
      await ConfirmService.showWarning('JSON格式错误', '导入失败', '文件不是有效的JSON格式，请检查文件是否正确。');
      target.value = '';
      return;
    }

    // 检查导入数据格式
    if (!importData.themeLibrary || typeof importData.themeLibrary !== 'object') {
      await ConfirmService.showWarning('数据格式错误', '导入失败', '文件中没有找到有效的主题库数据。');
      target.value = '';
      return;
    }

    const themeLibrary = importData.themeLibrary as GuidelineThemeLibrary;
    const defaultThemeId = importData.defaultThemeId as string | undefined;

    if (Object.keys(themeLibrary).length === 0) {
      await ConfirmService.showWarning('数据格式错误', '导入失败', '主题库为空。');
      target.value = '';
      return;
    }

    const globalVars = getVariables({ type: 'global' });
    const themeLibraryKey = 'guideline_theme_library';
    const defaultThemeKey = 'guideline_default_theme_id';

    // 合并主题库（保留现有主题，添加新主题）
    const existingLibrary = (globalVars[themeLibraryKey] || {}) as GuidelineThemeLibrary;
    globalVars[themeLibraryKey] = { ...existingLibrary, ...themeLibrary };

    if (defaultThemeId) {
      globalVars[defaultThemeKey] = defaultThemeId;
    }

    replaceVariables(globalVars, { type: 'global' });

    // 重新加载设置
    loadGuidelineSettings();

    const themeCount = Object.keys(themeLibrary).length;
    await ConfirmService.showSuccess(
      `已成功导入 ${themeCount} 个主题`,
      '导入成功',
      '主题库已更新，您可以在主题列表中选择使用。',
    );
    console.log('✅ 人物指导风格主题库已导入:', { themeCount, defaultThemeId });
  } catch (error) {
    console.error('导入人物指导风格主题库失败:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    await ConfirmService.showDanger(`导入失败：${errorMessage}`, '导入失败', '请检查文件是否正确或重试。');
  } finally {
    target.value = '';
  }
};

// 打开创建主题对话框
const openCreateThemeDialog = () => {
  newThemeName.value = '';
  showCreateThemeDialog.value = true;
};

// 设置全局默认主题
const setAsDefaultTheme = () => {
  if (!selectedThemeId.value) {
    toast.warning('请先选择一个主题', { title: '提示' });
    return;
  }

  try {
    const globalVars = getVariables({ type: 'global' });
    const defaultThemeKey = 'guideline_default_theme_id';
    globalVars[defaultThemeKey] = selectedThemeId.value;
    replaceVariables(globalVars, { type: 'global' });
    defaultThemeId.value = selectedThemeId.value;
    toast.success(`已将"${currentTheme.value.name}"设为全局默认主题`, { title: '设置成功' });
    console.log(`💾 已设置全局默认主题: ${selectedThemeId.value}`);
  } catch (error) {
    console.error('设置全局默认主题失败:', error);
    toast.error('设置全局默认主题失败', { title: '错误' });
  }
};

// 删除主题
const deleteTheme = async () => {
  if (!selectedThemeId.value) {
    toast.warning('请先选择一个主题', { title: '提示' });
    return;
  }

  const theme = guidelineThemes.value[selectedThemeId.value];
  if (!theme) {
    toast.warning('主题不存在', { title: '提示' });
    return;
  }

  // 确认删除
  const isDefaultTheme = selectedThemeId.value === defaultThemeId.value;
  const confirmMessage = isDefaultTheme
    ? `确定要删除主题"${theme.name}"吗？\n\n⚠️ 这是当前全局默认主题，删除后需要重新设置默认主题。\n\n此操作不可恢复。`
    : `确定要删除主题"${theme.name}"吗？\n\n此操作不可恢复。`;

  const result = await ConfirmService.showConfirm({
    message: confirmMessage,
    title: '删除主题',
    type: 'danger',
    confirmText: '删除',
    cancelText: '取消',
  });

  if (result !== true) {
    return;
  }

  try {
    const globalVars = getVariables({ type: 'global' });
    const themeLibraryKey = 'guideline_theme_library';
    const defaultThemeKey = 'guideline_default_theme_id';

    // 从主题库中删除主题
    if (guidelineThemes.value[selectedThemeId.value]) {
      delete guidelineThemes.value[selectedThemeId.value];
    }

    // 如果删除的是默认主题，清除默认主题ID
    if (isDefaultTheme) {
      delete globalVars[defaultThemeKey];
      defaultThemeId.value = '';
    }

    // 保存到全局变量
    globalVars[themeLibraryKey] = guidelineThemes.value;
    replaceVariables(globalVars, { type: 'global' });

    // 清空当前选中和主题内容
    selectedThemeId.value = '';
    currentTheme.value = {
      name: '',
      loyaltyGuidelines: [],
      loyaltyGuidelinesWithText: [],
    };
    loyaltyGuidelines.value = [];

    // 重新加载设置
    loadGuidelineSettings();

    toast.success(`已删除主题: ${theme.name}`, { title: '删除成功' });
    console.log(`🗑️ 已删除主题: ${theme.name} (${selectedThemeId.value})`);
  } catch (error) {
    console.error('删除主题失败:', error);
    toast.error('删除主题失败', { title: '错误' });
  }
};

// 创建新主题
const createNewTheme = () => {
  if (!newThemeName.value.trim()) {
    toast.warning('主题名称不能为空', { title: '提示' });
    return;
  }

  const themeId = `theme_${Date.now()}`;
  const defaultGuidelines = CharacterGuidelineGenerator.getDefaultGuidelines();

  const newTheme: GuidelineTheme = {
    name: newThemeName.value.trim(),
    loyaltyGuidelines: defaultGuidelines,
  };

  guidelineThemes.value[themeId] = newTheme;
  selectedThemeId.value = themeId;
  currentTheme.value = {
    ...newTheme,
    loyaltyGuidelinesWithText: newTheme.loyaltyGuidelines.map(item => ({
      ...item,
      contentText: item.content || '',
    })),
  };
  loyaltyGuidelines.value = [...currentTheme.value.loyaltyGuidelinesWithText];

  // 保存到全局变量
  const globalVars = getVariables({ type: 'global' });
  const themeLibraryKey = 'guideline_theme_library';
  globalVars[themeLibraryKey] = guidelineThemes.value;
  replaceVariables(globalVars, { type: 'global' });

  showCreateThemeDialog.value = false;
  newThemeName.value = '';

  toast.success(`已创建新主题: ${newTheme.name}`, { title: '创建成功' });
  console.log(`✅ 已创建新主题: ${newTheme.name}`);
};

// 导出思维链格式为文件（导出所有格式，包括默认格式）
const exportChainFormats = async () => {
  try {
    const globalVars = getVariables({ type: 'global' });
    const chains: Record<string, string> = {};
    const allModes = Object.values(ChainOfThoughtMode);

    // 收集所有格式（包括默认格式）
    for (const mode of allModes) {
      const customChainKey = `chain_of_thought_${mode}`;
      // 如果有自定义格式，使用自定义格式；否则使用默认格式
      if (customChainKey in globalVars && typeof globalVars[customChainKey] === 'string') {
        chains[mode] = globalVars[customChainKey];
      } else {
        // 使用默认格式
        chains[mode] = ChainOfThoughtManager.getDefaultChain(mode);
      }
    }

    // 构建导出数据
    const exportData = {
      version: '1.0',
      description: '哥布林巢穴思维链格式（包含所有模式）',
      chains,
      exportedAt: new Date().toISOString(),
    };

    // 转换为JSON字符串
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // 创建下载链接
    const link = document.createElement('a');
    link.href = url;
    link.download = `思维链格式_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // 释放URL对象
    URL.revokeObjectURL(url);

    const customCount = Object.values(ChainOfThoughtMode).filter(
      mode => `chain_of_thought_${mode}` in globalVars && typeof globalVars[`chain_of_thought_${mode}`] === 'string',
    ).length;

    await ConfirmService.showSuccess(
      `已导出所有 ${Object.keys(chains).length} 个思维链格式`,
      '导出成功',
      `包含 ${customCount} 个自定义格式和 ${Object.keys(chains).length - customCount} 个默认格式。文件已保存到您的下载文件夹。`,
    );

    console.log('✅ 思维链格式已导出:', exportData);
  } catch (error) {
    console.error('导出思维链格式失败:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    await ConfirmService.showDanger(`导出失败：${errorMessage}`, '导出失败', '请重试或检查文件权限。');
  }
};

// 触发文件选择
const triggerChainFileImport = () => {
  chainFileInput.value?.click();
};

// 处理文件导入
const handleChainFileImport = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (!file) return;

  try {
    // 读取文件内容
    const text = await file.text();
    let importData: any;

    try {
      importData = JSON.parse(text);
    } catch (parseError) {
      await ConfirmService.showWarning('JSON格式错误', '导入失败', '文件不是有效的JSON格式，请检查文件是否正确。');
      target.value = '';
      return;
    }

    // 验证数据格式
    if (!importData.chains || typeof importData.chains !== 'object') {
      await ConfirmService.showWarning('数据格式错误', '导入失败', '文件中没有找到思维链格式数据。');
      target.value = '';
      return;
    }

    // 检查有哪些可用的思维链格式（包括默认格式）
    const availableChains = Object.keys(importData.chains).filter((mode: string) => {
      return Object.values(ChainOfThoughtMode).includes(mode as ChainOfThoughtMode);
    });

    if (availableChains.length === 0) {
      await ConfirmService.showWarning('没有有效格式', '导入失败', '文件中没有找到有效的思维链格式模式。');
      target.value = '';
      return;
    }

    // 获取模式名称映射
    const modeNames: Record<ChainOfThoughtMode, string> = {
      [ChainOfThoughtMode.LOCATION_GENERATION]: '据点生成思维链',
      [ChainOfThoughtMode.CHARACTER_GENERATION]: '人物生成思维链',
      [ChainOfThoughtMode.PRE_BATTLE_DIALOGUE]: '战前对话思维链',
      [ChainOfThoughtMode.BATTLE_SUMMARY]: '战斗总结思维链',
      [ChainOfThoughtMode.CHARACTER_TRAINING]: '人物调教思维链',
      [ChainOfThoughtMode.RANDOM_EVENT]: '随机事件思维链',
      [ChainOfThoughtMode.STORY_SUMMARY]: '剧情总结思维链',
    };

    // 检查是否有缺失的格式
    const allModes = Object.values(ChainOfThoughtMode);
    const missingModes = allModes.filter(mode => !availableChains.includes(mode));
    if (missingModes.length > 0) {
      const missingNames = missingModes.map(mode => modeNames[mode]).join('、');
      console.log(`⚠️ 文件中缺少以下格式，将使用默认格式：${missingNames}`);
    }

    // 让用户确认导入哪些格式
    const chainNames = availableChains
      .map((mode: string) => `• ${modeNames[mode as ChainOfThoughtMode] || mode}`)
      .join('\n');

    const confirmed = await ConfirmService.showConfirm({
      title: '确认导入',
      message: `文件包含 ${availableChains.length} 个思维链格式${missingModes.length > 0 ? `，缺少 ${missingModes.length} 个格式将使用默认值` : ''}`,
      details: `将要导入以下格式：\n${chainNames}${missingModes.length > 0 ? `\n\n缺少的格式（将使用默认值）：\n${missingModes.map(mode => `• ${modeNames[mode]}`).join('\n')}` : ''}\n\n⚠️ 注意：这将覆盖您现有的对应格式。\n\n是否继续导入？`,
      type: 'info',
    });

    if (!confirmed) {
      target.value = '';
      return;
    }

    // 导入数据（导入所有格式：文件中的格式 + 文件中缺少的格式使用默认格式）
    const globalVars = getVariables({ type: 'global' });
    let importedCount = 0;

    // 导入文件中包含的格式
    for (const mode of availableChains) {
      const chainContent = importData.chains[mode];
      if (typeof chainContent === 'string' && chainContent.trim()) {
        const customChainKey = `chain_of_thought_${mode}`;
        globalVars[customChainKey] = chainContent.trim();
        importedCount++;
      }
    }

    // 如果文件缺少某些格式，使用默认格式填充（导入所有格式）
    let defaultCount = 0;
    if (missingModes.length > 0) {
      for (const mode of missingModes) {
        // 使用默认格式（删除自定义格式，让系统使用默认格式）
        const customChainKey = `chain_of_thought_${mode}`;
        // 删除自定义格式，这样系统就会使用默认格式
        if (customChainKey in globalVars) {
          delete globalVars[customChainKey];
        }
        // 注意：我们不保存默认格式，因为默认格式不需要保存到全局变量中
        // 系统会自动使用默认格式
        defaultCount++;
      }
    }

    if (importedCount > 0) {
      replaceVariables(globalVars, { type: 'global' });
      // 重新加载当前显示的格式
      loadChainFormat();

      const successMessage =
        defaultCount > 0
          ? `已成功导入 ${importedCount} 个自定义格式，${defaultCount} 个格式使用默认值`
          : `已成功导入 ${importedCount} 个思维链格式`;

      await ConfirmService.showSuccess(
        successMessage,
        '导入成功',
        '格式已应用到您的设置中，您可以继续编辑或使用它们。',
      );

      console.log('✅ 思维链格式已导入:', {
        importedCount,
        defaultCount,
        chains: availableChains,
        missingModes: missingModes.length > 0 ? missingModes : [],
      });
    } else {
      await ConfirmService.showWarning('导入失败', '没有有效内容', '文件中没有找到有效的思维链格式内容。');
    }
  } catch (error) {
    console.error('导入思维链格式失败:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    await ConfirmService.showDanger(`导入失败：${errorMessage}`, '导入失败', '请检查文件是否正确或重试。');
  } finally {
    // 清空input，允许重复选择同一文件
    target.value = '';
  }
};

// 保存玩家角色信息
const savePlayerInfo = async () => {
  // 防止重复点击
  if (isSaving.value) {
    console.log('⏸️ 正在保存中，跳过重复请求');
    return;
  }

  try {
    isSaving.value = true;

    const trainingData = modularSaveManager.getModuleData({ moduleName: 'training' }) as any;

    // 检查存档数据是否存在
    if (!trainingData || !trainingData.characters || !Array.isArray(trainingData.characters)) {
      await ConfirmService.showWarning('存档数据异常', '保存失败', '存档中没有找到人物数据，请先开始游戏');
      return;
    }

    const playerIndex = trainingData.characters.findIndex((char: any) => char.id === 'player-1');

    // 检查是否找到玩家角色
    if (playerIndex === -1) {
      await ConfirmService.showWarning('未找到玩家角色', '保存失败', '存档中没有找到玩家角色，无法更新');
      return;
    }

    // 更新玩家角色信息（保持ID和status不变）
    trainingData.characters[playerIndex].name = playerName.value.trim() || '哥布林之王';
    trainingData.characters[playerIndex].title = playerTitle.value.trim() || '哥布林巢穴之主';
    trainingData.characters[playerIndex].avatar = '/api/images/goblin-king';

    // 确保玩家角色的关键属性不被修改
    trainingData.characters[playerIndex].id = 'player-1';
    trainingData.characters[playerIndex].status = 'player';

    // 保存到模块化存档
    modularSaveManager.updateModuleData({
      moduleName: 'training',
      data: trainingData,
    });

    console.log('💾 玩家角色信息已保存:', {
      name: trainingData.characters[playerIndex].name,
      title: trainingData.characters[playerIndex].title,
      avatar: trainingData.characters[playerIndex].avatar,
    });

    // 显示成功提示
    await ConfirmService.showSuccess('角色信息已保存', '保存成功', '您的角色名称、头衔和肖像已更新');
  } catch (error) {
    console.error('保存玩家角色信息失败:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    await ConfirmService.showDanger(`保存失败：${errorMessage}`, '保存失败', '请重试或检查存档是否正常');
  } finally {
    isSaving.value = false;
  }
};

// 触发文件选择
const triggerFileUpload = () => {
  fileInput.value?.click();
};

// 压缩图片
const compressImage = (
  file: File,
  maxWidth: number = 512,
  maxHeight: number = 512,
  quality: number = 0.85,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        try {
          // 计算新尺寸，保持宽高比
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = width * ratio;
            height = height * ratio;
          }

          // 创建canvas并绘制压缩后的图片
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            reject(new Error('无法创建Canvas上下文'));
            return;
          }

          // 使用高质量渲染
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // 转换为base64，使用JPEG格式以获得更好的压缩率
          const base64String = canvas.toDataURL('image/jpeg', quality);
          resolve(base64String);
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error('图片加载失败'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('文件读取失败'));
    };

    reader.readAsDataURL(file);
  });
};

// 处理文件上传
const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (!file) return;

  // 检查文件类型
  if (!file.type.startsWith('image/')) {
    await ConfirmService.showWarning('请选择图片文件', '文件类型错误', '支持的格式：JPG, PNG, GIF, WEBP等');
    return;
  }

  // 检查文件大小（限制为10MB，压缩后会变小）
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    await ConfirmService.showWarning(
      '图片文件过大，请选择小于10MB的图片',
      '文件过大',
      `当前文件大小：${(file.size / 1024 / 1024).toFixed(2)}MB`,
    );
    return;
  }

  try {
    console.log('🖼️ 开始压缩图片...');

    // 压缩图片（头像使用512x512，质量0.85）
    const compressedBase64 = await compressImage(file, 512, 512, 0.85);

    // 检查压缩后的大小（限制为200KB）
    const maxCompressedSize = 200 * 1024; // 200KB
    if (compressedBase64.length > maxCompressedSize) {
      // 如果还是太大，进一步降低质量
      console.log('⚠️ 图片压缩后仍然较大，进一步降低质量...');
      const furtherCompressed = await compressImage(file, 512, 512, 0.7);
      playerAvatar.value = furtherCompressed;
      console.log('✅ 本地图片已加载（二次压缩），大小:', (furtherCompressed.length / 1024).toFixed(2), 'KB');
    } else {
      playerAvatar.value = compressedBase64;
      console.log('✅ 本地图片已加载（压缩），大小:', (compressedBase64.length / 1024).toFixed(2), 'KB');
    }

    // 显示成功提示
    await ConfirmService.showSuccess('图片已成功加载并压缩', '上传成功');
  } catch (error) {
    console.error('处理图片失败:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    await ConfirmService.showDanger(`处理失败：${errorMessage}`, '上传失败', '请重试或选择其他图片');
  } finally {
    // 清空input，允许重复选择同一文件
    if (target) {
      target.value = '';
    }
  }
};

// 处理图片加载错误
const handleImageError = (event: Event) => {
  const target = event.target as HTMLImageElement;
  target.src = 'https://via.placeholder.com/150?text=Invalid+Image';
  console.warn('图片加载失败，请检查URL是否正确');
};

// 处理图片加载成功
const handleImageLoad = (event: Event) => {
  const target = event.target as HTMLImageElement;
  // 确保图片正确显示
  target.style.display = 'block';
  console.log('✅ 头像预览加载成功');
};

// 打开文字样式设置
const openTextStyleSettings = () => {
  emit('open-text-style');
};

// 打开教程
const openTutorial = () => {
  emit('open-tutorial');
};

// 关闭面板
const close = () => {
  emit('close');
};

// 选项卡类型定义
type TabId = 'ai' | 'api' | 'game' | 'chain' | 'guideline' | 'player' | 'other' | 'about';

// 选项卡定义
const tabs: Array<{ id: TabId; icon: string; label: string }> = [
  { id: 'ai', icon: '🤖', label: 'AI 输出' },
  { id: 'api', icon: '🔌', label: '自定义API' },
  { id: 'game', icon: '⚙️', label: '游戏机制' },
  { id: 'chain', icon: '🔗', label: '思维链' },
  { id: 'guideline', icon: '📝', label: '人物指导风格' },
  { id: 'player', icon: '👤', label: '玩家角色' },
  { id: 'other', icon: '⚙️', label: '其他设置' },
  { id: 'about', icon: 'ℹ️', label: '关于游戏' },
];

// 当前激活的选项卡
const activeTab = ref<TabId>('ai');

// 监听显示状态
watch(
  () => props.show,
  newVal => {
    if (newVal) {
      loadSettings();
    }
  },
);

// 监听选项卡切换
watch(
  () => activeTab.value,
  newTab => {
    if (newTab === 'api') {
      // 切换到自定义API设置时，确保加载设置
      nextTick(() => {
        setTimeout(() => {
          if (customApiSettingsRef.value && typeof customApiSettingsRef.value.loadSettings === 'function') {
            customApiSettingsRef.value.loadSettings();
            console.log('📥 切换到自定义API设置选项卡，已加载设置');
          }
        }, 300);
      });
    }
  },
  { immediate: false }, // 不立即执行，等待组件挂载完成
);

// 监听选择的思维链模式变化
watch(selectedChainMode, () => {
  loadChainFormat();
});

// 初始化
onMounted(() => {
  loadSettings();
});
</script>

<style scoped lang="scss">
.settings-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  animation: fadeIn 0.2s ease;
}

.settings-panel {
  background: linear-gradient(135deg, rgba(40, 26, 20, 0.98), rgba(26, 19, 19, 0.98));
  border: 2px solid rgba(205, 133, 63, 0.6);
  border-radius: 16px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7);
  animation: slideIn 0.3s ease;

  @media (max-width: 768px) {
    width: 95%;
    max-height: 90vh;
  }

  /* 自定义滚动条样式 - Webkit浏览器 (Chrome, Edge, Safari) */
  &::-webkit-scrollbar {
    width: 10px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 10px;
    margin: 8px 0;
  }

  &::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, rgba(205, 133, 63, 0.6), rgba(205, 133, 63, 0.4));
    border-radius: 10px;
    border: 2px solid rgba(0, 0, 0, 0.1);
    transition: all 0.3s ease;

    &:hover {
      background: linear-gradient(180deg, rgba(205, 133, 63, 0.8), rgba(205, 133, 63, 0.6));
      border-color: rgba(205, 133, 63, 0.3);
    }

    &:active {
      background: linear-gradient(180deg, rgba(205, 133, 63, 0.9), rgba(205, 133, 63, 0.7));
    }
  }

  /* Firefox滚动条样式 */
  scrollbar-width: thin;
  scrollbar-color: rgba(205, 133, 63, 0.6) rgba(0, 0, 0, 0.2);
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideIn {
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 2px solid rgba(205, 133, 63, 0.4);

  h3 {
    margin: 0;
    color: #ffd7a1;
    font-size: 20px;
    font-weight: 700;
  }

  .close-btn {
    background: none;
    border: none;
    color: #9ca3af;
    font-size: 28px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    transition: all 0.2s ease;
    line-height: 1;

    &:hover {
      background: rgba(239, 68, 68, 0.1);
      color: #ef4444;
    }
  }
}

.panel-content {
  padding: 24px;

  @media (max-width: 768px) {
    padding: 16px;
  }
}

/* 选项卡导航 */
.tabs-nav {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 8px;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 2px solid rgba(205, 133, 63, 0.3);

  @media (max-width: 480px) {
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
    margin-bottom: 16px;
    padding-bottom: 12px;
  }

  @media (min-width: 481px) and (max-width: 768px) {
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    margin-bottom: 16px;
    padding-bottom: 12px;
  }

  @media (min-width: 769px) and (max-width: 1024px) {
    grid-template-columns: repeat(4, 1fr);
  }

  @media (min-width: 1025px) {
    grid-template-columns: repeat(6, 1fr);
  }
}

.tab-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 10px 8px;
  background: rgba(0, 0, 0, 0.3);
  border: 2px solid rgba(205, 133, 63, 0.2);
  border-radius: 8px;
  color: #9ca3af;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
  width: 100%;
  min-height: 60px;

  .tab-icon {
    font-size: 20px;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
    line-height: 1;
  }

  .tab-label {
    font-size: 11px;
    line-height: 1.2;
    word-break: keep-all;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;

    @media (max-width: 480px) {
      font-size: 10px;
    }
  }

  &:hover {
    background: rgba(0, 0, 0, 0.4);
    border-color: rgba(205, 133, 63, 0.4);
    color: #d1d5db;
    transform: translateY(-1px);
  }

  &.active {
    background: linear-gradient(135deg, rgba(205, 133, 63, 0.3), rgba(205, 133, 63, 0.2));
    border-color: rgba(205, 133, 63, 0.6);
    color: #ffd7a1;
    box-shadow: 0 2px 8px rgba(205, 133, 63, 0.3);

    .tab-icon {
      filter: drop-shadow(0 2px 4px rgba(205, 133, 63, 0.5));
      transform: scale(1.1);
    }

    &:hover {
      background: linear-gradient(135deg, rgba(205, 133, 63, 0.4), rgba(205, 133, 63, 0.3));
      border-color: rgba(205, 133, 63, 0.7);
    }
  }

  @media (max-width: 480px) {
    padding: 8px 4px;
    min-height: 56px;
    gap: 3px;

    .tab-icon {
      font-size: 18px;
    }
  }
}

.divider {
  height: 1px;
  background: rgba(205, 133, 63, 0.3);
  margin: 24px 0;
}

.settings-section {
  margin-bottom: 24px;

  &:last-child {
    margin-bottom: 0;
  }
}

.section-title {
  color: #ffd7a1;
  font-size: 16px;
  font-weight: 700;
  margin: 0 0 16px 0;
}

.setting-item {
  margin-bottom: 20px;

  &:last-child {
    margin-bottom: 0;
  }
}

.setting-desc {
  color: #9ca3af;
  font-size: 12px;
  line-height: 1.5;
  margin-top: 8px;
}

.setting-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;

  .label-text {
    color: #f0e6d2;
    font-weight: 600;
    font-size: 14px;
  }

  .label-desc {
    color: #9ca3af;
    font-size: 12px;
    line-height: 1.5;

    .label-hint {
      color: #fbbf24;
      font-size: 11px;
      font-style: italic;
      margin-top: 4px;
      display: inline-block;
    }
  }
}

.switch-container {
  position: relative;
  display: inline-block;
  width: 52px;
  height: 28px;
  cursor: pointer;
}

.switch-input {
  opacity: 0;
  width: 0;
  height: 0;

  &:checked + .switch-slider {
    background-color: #3b82f6;

    &::before {
      transform: translateX(24px);
    }
  }
}

.switch-slider {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #4b5563;
  transition: 0.3s;
  border-radius: 28px;

  &::before {
    position: absolute;
    content: '';
    height: 20px;
    width: 20px;
    left: 4px;
    bottom: 4px;
    background-color: white;
    transition: 0.3s;
    border-radius: 50%;
  }
}

.checkbox-container {
  margin-bottom: 12px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
}

.checkbox-input {
  width: 18px;
  height: 18px;
  margin-right: 8px;
  cursor: pointer;
  accent-color: #3b82f6;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.checkbox-text {
  color: #f0e6d2;
  font-size: 14px;
  font-weight: 500;
}

.slider-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.slider-input {
  flex: 1;
  height: 6px;
  background: #4b5563;
  border-radius: 3px;
  outline: none;
  -webkit-appearance: none;
  appearance: none;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    background: #3b82f6;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  &::-webkit-slider-thumb:hover {
    background: #4b8ef6;
    transform: scale(1.1);
  }

  &::-moz-range-thumb {
    width: 20px;
    height: 20px;
    background: #3b82f6;
    border-radius: 50%;
    cursor: pointer;
    border: none;
    transition: all 0.2s ease;
  }

  &::-moz-range-thumb:hover {
    background: #4b8ef6;
    transform: scale(1.1);
  }
}

.slider-value {
  min-width: 50px;
  color: #ffd7a1;
  font-weight: 700;
  font-size: 16px;
  text-align: right;
}

.format-select {
  width: 100%;
  padding: 10px 14px;
  background: rgba(40, 40, 40, 0.8);
  border: 2px solid rgba(205, 133, 63, 0.4);
  border-radius: 8px;
  color: #ffd7a1;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  outline: none;
  transition: all 0.2s ease;

  &:hover {
    border-color: rgba(205, 133, 63, 0.6);
    background: rgba(40, 40, 40, 0.95);
  }

  &:focus {
    border-color: rgba(255, 120, 60, 0.6);
  }

  option {
    background: rgba(40, 40, 40, 0.95);
    color: #ffd7a1;
  }
}

.style-button,
.tutorial-button,
.version-button {
  width: 100%;
  padding: 12px 20px;
  background: linear-gradient(135deg, #8a3c2c, #65261c);
  border: 2px solid rgba(255, 120, 60, 0.5);
  border-radius: 8px;
  color: #ffd7a1;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: linear-gradient(135deg, #9a4c3c, #75362c);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }
}

.tutorial-button {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border-color: rgba(96, 165, 250, 0.5);

  &:hover {
    background: linear-gradient(135deg, #4b8ef6, #3575eb);
  }
}

.version-button {
  background: linear-gradient(135deg, #8b5cf6, #7c3aed);
  border-color: rgba(167, 139, 250, 0.5);

  &:hover {
    background: linear-gradient(135deg, #9b6cf6, #8c4aed);
  }
}

.update-button {
  width: 100%;
  padding: 12px 20px;
  background: linear-gradient(135deg, #f59e0b, #d97706);
  border: 2px solid rgba(245, 158, 11, 0.5);
  border-radius: 8px;
  color: #ffffff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: linear-gradient(135deg, #fbbf24, #f59e06);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
  }

  &:active {
    transform: translateY(0);
  }
}

.text-input {
  width: 100%;
  padding: 10px 14px;
  background: rgba(40, 40, 40, 0.8);
  border: 2px solid rgba(205, 133, 63, 0.4);
  border-radius: 8px;
  color: #f0e6d2;
  font-size: 14px;
  font-weight: 500;
  outline: none;
  transition: all 0.2s ease;

  &::placeholder {
    color: #6b7280;
  }

  &:hover {
    border-color: rgba(205, 133, 63, 0.6);
    background: rgba(40, 40, 40, 0.95);
  }

  &:focus {
    border-color: rgba(255, 120, 60, 0.6);
    box-shadow: 0 0 0 3px rgba(255, 120, 60, 0.1);
  }
}

.avatar-input-container {
  display: flex;
  gap: 8px;
  align-items: stretch;

  .text-input {
    flex: 1;
  }

  .upload-button {
    padding: 10px 16px;
    background: linear-gradient(135deg, #6366f1, #4f46e5);
    border: 2px solid rgba(99, 102, 241, 0.5);
    border-radius: 8px;
    color: #ffffff;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;

    &:hover {
      background: linear-gradient(135deg, #7578f6, #5f56e5);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
    }

    &:active {
      transform: translateY(0);
    }
  }

  @media (max-width: 768px) {
    flex-direction: column;

    .upload-button {
      width: 100%;
    }
  }
}

.avatar-preview {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 16px;
  background: rgba(40, 40, 40, 0.5);
  border: 2px solid rgba(205, 133, 63, 0.3);
  border-radius: 12px;

  img {
    max-width: 200px;
    max-height: 200px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    object-fit: cover;
    border: 2px solid rgba(205, 133, 63, 0.4);
  }
}

.save-button {
  width: 100%;
  padding: 12px 20px;
  background: linear-gradient(135deg, #10b981, #059669);
  border: 2px solid rgba(16, 185, 129, 0.5);
  border-radius: 8px;
  color: #ffffff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #20c991, #169679);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: linear-gradient(135deg, #6b7280, #4b5563);
    border-color: rgba(107, 114, 128, 0.5);
  }
}

.chain-textarea {
  width: 100%;
  padding: 12px 14px;
  background: rgba(40, 40, 40, 0.8);
  border: 2px solid rgba(205, 133, 63, 0.4);
  border-radius: 8px;
  color: #f0e6d2;
  font-size: 13px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  line-height: 1.6;
  resize: vertical;
  outline: none;
  transition: all 0.2s ease;
  min-height: 200px;

  &::placeholder {
    color: #6b7280;
  }

  &:hover {
    border-color: rgba(205, 133, 63, 0.6);
    background: rgba(40, 40, 40, 0.95);
  }

  &:focus {
    border-color: rgba(255, 120, 60, 0.6);
    box-shadow: 0 0 0 3px rgba(255, 120, 60, 0.1);
  }

  /* 自定义滚动条样式 - Webkit浏览器 */
  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
  }

  &::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, rgba(205, 133, 63, 0.5), rgba(205, 133, 63, 0.3));
    border-radius: 8px;
    border: 1px solid rgba(0, 0, 0, 0.1);
    transition: all 0.2s ease;

    &:hover {
      background: linear-gradient(180deg, rgba(205, 133, 63, 0.7), rgba(205, 133, 63, 0.5));
    }

    &:active {
      background: linear-gradient(180deg, rgba(205, 133, 63, 0.8), rgba(205, 133, 63, 0.6));
    }
  }

  /* Firefox滚动条样式 */
  scrollbar-width: thin;
  scrollbar-color: rgba(205, 133, 63, 0.5) rgba(0, 0, 0, 0.2);
}

.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001;
}

.dialog-content {
  background: linear-gradient(135deg, rgba(40, 26, 20, 0.98), rgba(26, 19, 19, 0.98));
  border: 2px solid rgba(205, 133, 63, 0.6);
  border-radius: 12px;
  padding: 24px;
  min-width: 300px;
  max-width: 500px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7);

  h5 {
    margin: 0 0 16px 0;
    color: #ffd7a1;
    font-size: 18px;
    font-weight: 700;
  }
}

.subsection-title {
  color: #ffd7a1;
  font-size: 16px;
  font-weight: 600;
  margin: 24px 0 16px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(205, 133, 63, 0.3);
}

.loyalty-guideline-item {
  border: 1px solid rgba(205, 133, 63, 0.3);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  background: rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;

  &:hover {
    border-color: rgba(205, 133, 63, 0.5);
    background: rgba(0, 0, 0, 0.3);
  }

  &:last-child {
    margin-bottom: 0;
  }
}

.button-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;

  @media (min-width: 481px) {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .chain-action-button {
    flex: 1;
    min-width: 120px;
  }
}

.default-theme-indicator {
  padding: 6px 12px;
  background: rgba(251, 191, 36, 0.1);
  border: 1px solid rgba(251, 191, 36, 0.3);
  border-radius: 6px;
  margin-bottom: 12px;
}

.preview-toggle-button {
  background: transparent;
  border: none;
  border-radius: 4px;
  color: #9ca3af;
  font-size: 14px;
  padding: 4px 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;

  &:hover {
    background: rgba(156, 163, 175, 0.1);
    color: #d1d5db;
  }

  &:active {
    background: rgba(156, 163, 175, 0.2);
  }
}

.default-theme-preview {
  margin-top: 12px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 6px;
  border: 1px solid rgba(251, 191, 36, 0.2);
  max-height: 400px;
  overflow-y: auto;

  /* 自定义滚动条样式 */
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(251, 191, 36, 0.4);
    border-radius: 6px;

    &:hover {
      background: rgba(251, 191, 36, 0.6);
    }
  }

  scrollbar-width: thin;
  scrollbar-color: rgba(251, 191, 36, 0.4) rgba(0, 0, 0, 0.2);
}

.preview-guideline-item {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(251, 191, 36, 0.2);

  &:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }
}

.preview-label {
  color: #fbbf24;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}

.preview-content {
  color: #f0e6d2;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  border-left: 3px solid rgba(251, 191, 36, 0.4);
}

.chain-action-button {
  padding: 10px 16px;
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  border: 2px solid rgba(99, 102, 241, 0.5);
  border-radius: 8px;
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  width: 100%;

  @media (min-width: 481px) {
    width: auto;
    flex: 1;
    min-width: 100px;
  }

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #7578f6, #5f56e5);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
    border-color: rgba(99, 102, 241, 0.7);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: linear-gradient(135deg, #6b7280, #4b5563);
    border-color: rgba(107, 114, 128, 0.5);
  }

  &.secondary {
    background: linear-gradient(135deg, #6b7280, #4b5563);
    border-color: rgba(107, 114, 128, 0.5);

    &:hover:not(:disabled) {
      background: linear-gradient(135deg, #7578f6, #5f56e5);
      border-color: rgba(107, 114, 128, 0.7);
    }
  }
}
</style>
