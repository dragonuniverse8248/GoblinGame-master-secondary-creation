<template>
  <div class="advanced-battle-interface" :class="{ 'modal-mode': isModal }">
    <!-- 左侧：我方单位信息 -->
    <div class="units-panel allies-panel">
      <div class="units-grid">
        <div
          v-for="unit in allies"
          :key="unit.id"
          class="unit-card"
          :class="{
            'unit-dead': !unit.isAlive,
            'unit-physical': unit.type === 'physical',
            'unit-magical': unit.type === 'magical',
          }"
          :style="unitCardSize"
        >
          <!-- 单位名称 - 竖直显示在左侧 -->
          <div class="unit-name-vertical-left">
            {{ unit.name }}
          </div>

          <!-- 单位肖像图片区域 -->
          <div class="unit-portrait" :title="unit.troops ? '点击查看下辖部队' : ''" @click="showTroopsInfo(unit)">
            <img
              v-if="unit.avatar && (unit.avatar.startsWith('http') || unit.avatar.startsWith('data:image') || unit.avatar.startsWith('/'))"
              class="unit-avatar-image"
              :src="unit.avatar"
              :alt="unit.name"
              @error="handleImageError"
            />
            <div
              class="default-portrait"
              :class="{
                hidden: unit.avatar && (unit.avatar.startsWith('http') || unit.avatar.startsWith('data:image') || unit.avatar.startsWith('/')),
              }"
            >
              <span class="portrait-icon">{{ getUnitAvatar(unit) }}</span>
            </div>

            <!-- 血量条 - 水平显示在顶部中心 -->
            <div class="unit-health-bar-horizontal" :style="{ width: healthBarWidth }">
              <div class="health-fill-horizontal" :style="{ width: getHealthPercentage(unit) + '%' }"></div>
            </div>
            <div class="health-text-horizontal">{{ unit.currentHealth }}/{{ unit.maxHealth }}</div>
          </div>

          <!-- 四维属性显示 -->
          <div class="unit-attributes-vertical">
            <div class="attr-item">
              <span class="attr-icon">⚔️</span>
              <span class="attr-value">{{ unit.attributes.attack }}</span>
            </div>
            <div class="attr-item">
              <span class="attr-icon">🛡️</span>
              <span class="attr-value">{{ unit.attributes.defense }}</span>
            </div>
            <div class="attr-item">
              <span class="attr-icon">🔮</span>
              <span class="attr-value">{{ unit.attributes.intelligence }}</span>
            </div>
            <div class="attr-item">
              <span class="attr-icon">💨</span>
              <span class="attr-value">{{ unit.attributes.speed }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 中间：历史记录 -->
    <div class="battle-log-panel">
      <div class="log-container">
        <!-- 战斗状态显示 -->
        <div v-if="battleStatus === 'idle'" class="battle-status-section">
          <div class="battle-controls">
            <button
              v-if="hasEnemyCharacters"
              class="dialogue-btn"
              :class="{ disabled: !canStartDialogue }"
              :title="canStartDialogue ? '战前讲话 - 降低敌方士气' : '战前对话已完成，无法再次进行'"
              :disabled="!canStartDialogue"
              @click="startPreBattleDialogue"
            >
              💬 战前讲话
            </button>
            <button class="manual-battle-btn" @click="startManualBattle">
              ⚔️ 手动战斗
              <span v-if="selectedTarget" class="focus-target-hint">(集火: {{ selectedTarget.name }})</span>
            </button>
            <button class="auto-battle-btn" @click="startAutoBattle">🤖 自动战斗</button>
            <button class="retreat-btn" @click="retreat">🏃 撤退</button>
          </div>
        </div>

        <!-- 战斗结束 -->
        <div v-if="battleStatus === 'finished'" class="battle-end-section">
          <!-- 历史记录按钮 -->
          <div class="history-button-container">
            <button class="history-btn" title="查看战斗历史" @click="showBattleHistory">📜 查看战斗记录</button>
            <!-- 只有胜利且有人物单位时才显示战斗总结按钮 -->
            <button
              v-if="battleResult?.victory && hasEnemyCharacters"
              class="summary-btn"
              title="生成战斗总结"
              @click="showBattleSummary"
            >
              📝 生成战斗总结
            </button>
            <!-- 胜利时显示收获按钮 -->
            <button v-if="battleResult?.victory" class="harvest-btn" @click="showRewards">🎁 开始收获</button>
            <!-- 失败时显示撤退和重来按钮 -->
            <button v-if="!battleResult?.victory" class="retreat-btn" @click="retreat">🏃 撤退</button>
            <button v-if="!battleResult?.victory" class="retry-btn" @click="retryBattle">🔄 再来一次</button>
          </div>
        </div>

        <!-- 当前行动显示 -->
        <div v-if="currentTurnData && battleStatus === 'fighting'" class="action-list">
          <div class="action-messages">
            <div
              v-for="(action, actionIndex) in currentTurnData.actions"
              :key="actionIndex"
              class="action-item"
              :class="getActionClass(action)"
            >
              <div class="action-description">
                {{ action.description }}
                <span v-if="action.damage" class="action-damage">
                  (伤害: {{ action.damage }} <span v-if="action.critical" class="critical-mark">💥</span>)
                </span>
              </div>
            </div>
          </div>
          <!-- 翻页按钮 - 左右样式 -->
          <div v-if="battleHistory.length > 0" class="pagination-controls-horizontal">
            <button
              class="pagination-btn left-pagination"
              :disabled="currentDisplayTurn <= 1"
              title="上一回合"
              @click="previousTurn"
            >
              ←
            </button>
            <button
              class="pagination-btn right-pagination"
              :disabled="false"
              :title="isManualMode && battleStatus === 'fighting' ? '执行下一回合战斗' : '下一回合'"
              @click="handleRightArrow"
            >
              →
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧：敌方单位信息 -->
    <div class="units-panel enemies-panel">
      <div class="units-grid">
        <div
          v-for="unit in enemies"
          :key="unit.id"
          class="unit-card"
          :class="{
            'unit-dead': !unit.isAlive,
            'unit-selected': selectedTarget?.id === unit.id,
            'unit-selectable': unit.isAlive,
            'unit-physical': unit.type === 'physical',
            'unit-magical': unit.type === 'magical',
          }"
          :style="unitCardSize"
          @click="selectTarget(unit)"
        >
          <!-- 单位名称 - 竖直显示在左侧 -->
          <div class="unit-name-vertical-left">
            {{ unit.name }}
          </div>

          <!-- 单位肖像图片区域 -->
          <div class="unit-portrait" :title="unit.troops ? '点击查看下辖部队' : ''" @click="showTroopsInfo(unit)">
            <img
              v-if="unit.avatar && (unit.avatar.startsWith('http') || unit.avatar.startsWith('data:image') || unit.avatar.startsWith('/'))"
              class="unit-avatar-image"
              :src="unit.avatar"
              :alt="unit.name"
              @error="handleImageError"
            />
            <div
              class="default-portrait"
              :class="{
                hidden: unit.avatar && (unit.avatar.startsWith('http') || unit.avatar.startsWith('data:image') || unit.avatar.startsWith('/')),
              }"
            >
              <span class="portrait-icon">{{ getUnitAvatar(unit) }}</span>
            </div>

            <!-- 血量条 - 水平显示在顶部中心 -->
            <div class="unit-health-bar-horizontal" :style="{ width: healthBarWidth }">
              <div class="health-fill-horizontal" :style="{ width: getHealthPercentage(unit) + '%' }"></div>
            </div>
            <div class="health-text-horizontal">{{ unit.currentHealth }}/{{ unit.maxHealth }}</div>
          </div>

          <!-- 四维属性显示 -->
          <div class="unit-attributes-vertical">
            <div class="attr-item">
              <span class="attr-icon">⚔️</span>
              <span class="attr-value">{{ unit.attributes.attack }}</span>
            </div>
            <div class="attr-item">
              <span class="attr-icon">🛡️</span>
              <span class="attr-value">{{ unit.attributes.defense }}</span>
            </div>
            <div class="attr-item">
              <span class="attr-icon">🔮</span>
              <span class="attr-value">{{ unit.attributes.intelligence }}</span>
            </div>
            <div class="attr-item">
              <span class="attr-icon">💨</span>
              <span class="attr-value">{{ unit.attributes.speed }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 部队信息弹窗 -->
    <div v-if="showTroopsModal" class="troops-modal-overlay" @click="closeTroopsModal">
      <div class="troops-modal" @click.stop>
        <div class="modal-header">
          <h3>👥 {{ selectedUnit?.name }} 的下辖部队</h3>
          <button class="close-button" @click="closeTroopsModal">×</button>
        </div>
        <div class="modal-content">
          <div v-if="selectedUnit?.troops" class="troops-list">
            <!-- 哥布林部队（我方单位） -->
            <div v-if="(selectedUnit.troops.normalGoblins || 0) > 0" class="troop-item">
              <span class="troop-name">🟢 普通哥布林:</span>
              <span class="troop-count">{{ selectedUnit.troops.normalGoblins || 0 }}</span>
            </div>
            <div v-if="(selectedUnit.troops.warriorGoblins || 0) > 0" class="troop-item">
              <span class="troop-name">⚔️ 哥布林战士:</span>
              <span class="troop-count">{{ selectedUnit.troops.warriorGoblins || 0 }}</span>
            </div>
            <div v-if="(selectedUnit.troops.shamanGoblins || 0) > 0" class="troop-item">
              <span class="troop-name">🔮 哥布林萨满:</span>
              <span class="troop-count">{{ selectedUnit.troops.shamanGoblins || 0 }}</span>
            </div>
            <div v-if="(selectedUnit.troops.paladinGoblins || 0) > 0" class="troop-item">
              <span class="troop-name">✨ 哥布林圣骑士:</span>
              <span class="troop-count">{{ selectedUnit.troops.paladinGoblins || 0 }}</span>
            </div>

            <!-- 敌方部队（敌方单位） -->
            <div v-if="(selectedUnit.troops.count || 0) > 0" class="troop-item">
              <span class="troop-name">👥 {{ getTroopDisplayName(selectedUnit.troops.type) }}:</span>
              <span class="troop-count">{{ selectedUnit.troops.count || 0 }}</span>
            </div>

            <div v-if="getTotalTroops(selectedUnit) === 0" class="troop-item no-troops">
              <span class="troop-name">无下辖部队</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 奖励弹窗 -->
    <div v-if="showRewardsModal" class="rewards-modal-overlay" @click="closeRewardsModal">
      <div class="rewards-modal" @click.stop>
        <div class="modal-header">
          <h3>🎁 据点奖励</h3>
          <button class="close-button" @click="closeRewardsModal">×</button>
        </div>
        <div class="modal-content">
          <div class="rewards-list">
            <div v-if="rewardsData?.gold > 0" class="reward-item">
              <span class="reward-icon">💰</span>
              <span class="reward-name">金币:</span>
              <span class="reward-value">+{{ rewardsData.gold }}</span>
            </div>
            <div v-if="rewardsData?.food > 0" class="reward-item">
              <span class="reward-icon">🍖</span>
              <span class="reward-name">食物:</span>
              <span class="reward-value">+{{ rewardsData.food }}</span>
            </div>
            <div v-if="rewardsData?.slaves > 0" class="reward-item">
              <span class="reward-icon">🔒</span>
              <span class="reward-name">普通奴隶:</span>
              <span class="reward-value">+{{ rewardsData.slaves }}</span>
            </div>
            <!-- 英雄奖励 -->
            <div v-if="rewardsData?.heroes && rewardsData.heroes.length > 0" class="reward-item hero-reward">
              <div class="heroes-list">
                <div v-for="hero in rewardsData.heroes" :key="hero.id" class="hero-item">
                  <span class="reward-icon">👑</span>
                  <span class="reward-name">{{ hero.name }}</span>
                  <span class="reward-value">{{ hero.title || '英雄' }}</span>
                </div>
              </div>
            </div>
            <!-- 兼容单个英雄格式 -->
            <div v-else-if="rewardsData?.hero" class="reward-item hero-reward">
              <span class="reward-icon">👑</span>
              <span class="reward-name">{{ rewardsData.hero.name }}</span>
              <span class="reward-value">{{ rewardsData.hero.title || '英雄' }}</span>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="confirm-button success-button" @click="confirmRewards">确定</button>
        </div>
      </div>
    </div>
  </div>

  <!-- 战斗历史记录弹窗 -->
  <div v-if="showHistoryModal" class="history-modal">
    <div class="modal-overlay" @click="closeHistoryModal"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title">战斗历史记录</h3>
        <button class="close-btn" @click="closeHistoryModal">×</button>
      </div>

      <div class="history-content">
        <div v-if="battleHistory.length === 0" class="no-history">
          <div class="no-history-icon">⚔️</div>
          <div class="no-history-text">暂无战斗记录</div>
          <div class="no-history-hint">开始战斗后记录将显示在这里</div>
        </div>

        <div v-else class="history-list">
          <div v-for="(turn, index) in battleHistory" :key="index" class="history-item">
            <div class="history-header">
              <div class="history-turn">回合 {{ index + 1 }}</div>
              <div class="history-status" :class="index < battleHistory.length - 1 ? 'finished' : 'ongoing'">
                {{ index < battleHistory.length - 1 ? '已结束' : '进行中' }}
              </div>
            </div>
            <div class="history-actions">
              <div
                v-for="(action, actionIndex) in turn.actions"
                :key="actionIndex"
                class="history-action"
                :class="getActionClass(action)"
              >
                <div class="action-description">
                  {{ action.description }}
                  <span v-if="action.damage" class="action-damage">
                    (伤害: {{ action.damage }} <span v-if="action.critical" class="critical-mark">💥</span>)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 自定义确认框 -->
  <CustomConfirmBox
    :show="showFormationWarning"
    title="无法开始战斗"
    message="请先进行部队编制！"
    details="没有编制部队无法参与战斗，请前往部队编制界面进行编制。"
    confirm-text="前往编制"
    cancel-text="取消"
    type="warning"
    @confirm="goToFormation"
    @cancel="closeFormationWarning"
    @close="closeFormationWarning"
  />

  <!-- 战前对话结束确认框 -->
  <CustomConfirmBox
    :show="showDialogueConfirm"
    title="结束战前对话"
    message="确定要结束战前对话吗？"
    :details="`当前敌方士气：${enemyMorale.toFixed(1)}%。结束对话后，敌方单位属性将按士气百分比进行调整，且无法再次进行战前对话。`"
    confirm-text="结束对话"
    cancel-text="继续对话"
    type="warning"
    @confirm="confirmEndDialogue"
    @cancel="cancelEndDialogue"
    @close="cancelEndDialogue"
  />

  <!-- 撤退确认框 -->
  <CustomConfirmBox
    :show="showRetreatConfirm"
    title="撤退确认"
    message="确定要撤退吗？"
    :details="`你已经进行了战前对话，当前敌方士气已降至 ${enemyMorale.toFixed(1)}%。撤退时可以选择保存对话记录到世界书，或者清除这些信息（请注意：下次进入战斗敌方将恢复到初始状态，只记录剧情）。`"
    confirm-text="保存并撤退"
    cancel-text="清除并撤退"
    type="warning"
    @confirm="confirmRetreatWithSave"
    @cancel="confirmRetreatWithoutSave"
    @close="cancelRetreat"
  />

  <!-- 弹窗提示组件 -->
  <ToastNotification ref="toastRef" />

  <!-- 战前对话界面 -->
  <GenericDialogueInterface
    v-if="showDialogueInterface"
    :dialogue-config="dialogueConfig"
    @close="closeDialogueInterface"
  />

  <!-- 战斗总结界面 -->
  <BattleSummaryInterface
    v-if="showBattleSummaryInterface"
    :summary-config="battleSummaryConfig"
    @close="closeBattleSummaryInterface"
    @summary-generated="summary => console.log('总结生成:', summary)"
    @summary-saved="summary => console.log('总结保存:', summary)"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import ToastNotification from '../../../共享资源层/组件/弹窗提示.vue';
import CustomConfirmBox from '../../../共享资源层/组件/自定义确认框.vue';
import GenericDialogueInterface from '../../../共享资源层/通用对话界面/通用对话界面.vue';
import { WorldbookService } from '../../../核心层/服务/世界书管理/服务/世界书服务';
import { modularSaveManager } from '../../../核心层/服务/存档系统/模块化存档服务';
import { toast } from '../../../核心层/服务/通用服务/弹窗提示服务';
import { TimeParseService } from '../../../核心层/服务/通用服务/时间解析服务';
import type { Character } from '../../人物管理/类型/人物类型';
import { continentExploreService } from '../../探索/服务/大陆探索服务';
import { MoraleDialogueService } from '../服务/士气对话服务';
import { BattleFactory } from '../服务/战斗工厂';
import { NewBattleSystem } from '../服务/新战斗系统';
import { calculateTroopBonusWithDecay } from '../服务/部队加成计算服务';
import { FormationService } from '../服务/部队编制服务';
import { ALL_UNIT_CHARACTERS, getUnitsByRace } from '../类型/单位数据表';
import type { BattleResult, BattleTurn, BattleUnit } from '../类型/战斗属性';
import BattleSummaryInterface from './战斗总结界面.vue';

// Props
const props = defineProps<{
  battleData?: any;
  isModal?: boolean;
}>();

// Emits
const emit = defineEmits<{
  'battle-complete': [result: any];
  'close-battle': [];
}>();
// 响应式数据
const battleStatus = ref<'idle' | 'fighting' | 'paused' | 'finished'>('idle');
const currentTurn = ref(1);
const allies = ref<BattleUnit[]>([]);
const enemies = ref<BattleUnit[]>([]);
const battleHistory = ref<BattleTurn[]>([]);
const battleResult = ref<BattleResult | null>(null);
const battleSystem = ref<NewBattleSystem | null>(null);
const isInitialized = ref(false);

// 部队信息弹窗相关
const showTroopsModal = ref(false);
const selectedUnit = ref<BattleUnit | null>(null);

// 奖励弹窗相关
const showRewardsModal = ref(false);
const rewardsData = ref<any>(null);

// 历史记录弹窗相关
const showHistoryModal = ref(false);

// 手动战斗集火相关
const selectedTarget = ref<BattleUnit | null>(null);
const isManualMode = ref(false);

// 翻页相关
const currentDisplayTurn = ref(1);

// 初始部队状态（用于计算损失）
const initialTroopState = ref<Record<string, any>>({});

// 部队编制警告弹窗
const showFormationWarning = ref(false);

// 弹窗提示组件引用
const toastRef = ref<InstanceType<typeof ToastNotification>>();

// 战前对话相关
const showDialogueInterface = ref(false);
const enemyMorale = ref(100); // 敌方士气，初始100%
const dialogueConfig = ref<any>(null);
const dialogueCompleted = ref(false); // 对话是否已完成
const showDialogueConfirm = ref(false); // 显示对话确认框
const showRetreatConfirm = ref(false); // 显示撤退确认框

// 战斗总结相关
const showBattleSummaryInterface = ref(false);
const battleSummaryConfig = ref<any>(null);
const cachedBattleSummary = ref<string>(''); // 缓存已生成的总结

// 计算属性
const currentTurnData = computed(() => {
  if (battleHistory.value.length === 0) return null;
  return battleHistory.value[currentDisplayTurn.value - 1] || null;
});

// 面板高度响应式数据
const panelHeight = ref(400);

// 计算部队卡尺寸 - 按照新逻辑
const unitCardSize = computed(() => {
  // 1080P以上必须一行6个单位
  if (window.innerWidth >= 1920) {
    // 先计算高度（占满面板）
    const cardHeight = panelHeight.value; // 单位卡的高度

    // 根据单位卡的高度计算宽度：宽度 = 高度 * 0.5
    const cardWidth = cardHeight * 0.5; // 宽度为高度的0.5

    return {
      width: `${cardWidth}px`,
      height: '90%',
      maxWidth: `${cardWidth}px`,
    };
  }

  // 1080P以下保持原有逻辑
  return {
    width: '110px',
    height: '180px',
    maxWidth: 'none',
  };
});

// 计算血量条宽度 - 基于卡片宽度
const healthBarWidth = computed(() => {
  if (window.innerWidth >= 1920) {
    const cardHeight = panelHeight.value;
    const cardWidth = cardHeight * 0.5;
    // 血量条宽度为卡片宽度的80%
    return `${cardWidth * 0.8}px`;
  }
  return '80px'; // 1080P以下默认宽度
});

// 检查当前战斗据点中是否有敌方人物（enemy状态且可战斗）
const hasEnemyCharacters = computed(() => {
  try {
    // 只检查当前战斗据点的英雄人物，不检查调教模块
    const target = props.battleData?.target;
    if (target?.rewards?.heroes && Array.isArray(target.rewards.heroes)) {
      const hasEnemies = target.rewards.heroes.some(
        (hero: Character) => hero.status === 'enemy' && hero.canCombat === true,
      );
      console.log('据点敌方人物检查:', {
        targetName: target.name,
        heroes: target.rewards.heroes,
        hasEnemies,
      });
      return hasEnemies;
    }

    console.log('据点没有英雄数据，不显示战前对话');
    return false;
  } catch (error) {
    console.error('检查敌方人物失败:', error);
    return false;
  }
});

// 检查是否可以开始战前对话
const canStartDialogue = computed(() => {
  return hasEnemyCharacters.value && !dialogueCompleted.value;
});

// 方法
const getUnitAvatar = (unit: BattleUnit) => {
  // 优先使用单位数据中的avatar字段（emoji）
  if (unit.avatar && !unit.avatar.startsWith('http') && !unit.avatar.startsWith('data:image') && !unit.avatar.startsWith('/')) {
    return unit.avatar;
  }

  // 如果avatar是图片链接，使用fallbackAvatar（原始emoji）
  if (unit.fallbackAvatar) {
    return unit.fallbackAvatar;
  }

  // 如果没有avatar和fallbackAvatar，则根据单位类型返回不同的头像
  switch (unit.type) {
    case 'physical':
      return '⚔️';
    case 'magical':
      return '🔮';
    default:
      return '👤';
  }
};

const getHealthPercentage = (unit: BattleUnit) => {
  return Math.max(0, (unit.currentHealth / unit.maxHealth) * 100);
};

const getActionClass = (action: any) => {
  const classes = [];

  // 根据攻击者类型添加阵营类
  if (action.actor) {
    // 检查是否为我方单位
    const isAlly = allies.value.some(unit => unit.id === action.actor.id);
    const isEnemy = enemies.value.some(unit => unit.id === action.actor.id);

    if (isAlly) {
      classes.push('ally-action');
    } else if (isEnemy) {
      classes.push('enemy-action');
    }
  }

  // 根据攻击结果添加状态类
  if (action.critical) {
    classes.push('action-critical');
  } else if (!action.hit) {
    classes.push('action-miss');
  } else {
    classes.push('action-normal');
  }

  return classes.join(' ');
};

const getTotalTroops = (unit: BattleUnit) => {
  if (!unit.troops) return 0;

  // 哥布林部队（我方单位）
  if (unit.troops.normalGoblins !== undefined) {
    return (
      (unit.troops.normalGoblins || 0) +
      (unit.troops.warriorGoblins || 0) +
      (unit.troops.shamanGoblins || 0) +
      (unit.troops.paladinGoblins || 0)
    );
  }

  // 敌方部队（敌方单位）
  if (unit.troops.count !== undefined) {
    return unit.troops.count;
  }

  return 0;
};

// 获取部队显示名称
const getTroopDisplayName = (troopType: string | undefined) => {
  if (!troopType) return '未知部队';

  // 从所有单位数据中查找匹配的单位
  // 尝试通过name匹配，如果失败则通过id匹配
  let unit = ALL_UNIT_CHARACTERS.find(u => u.name === troopType);
  if (!unit) {
    unit = ALL_UNIT_CHARACTERS.find(u => u.id === troopType);
  }
  return unit ? unit.name : troopType;
};

// 部队信息弹窗相关方法
const showTroopsInfo = (unit: BattleUnit) => {
  selectedUnit.value = unit;
  showTroopsModal.value = true;
};

const closeTroopsModal = () => {
  showTroopsModal.value = false;
  selectedUnit.value = null;
};

// 关闭奖励弹窗
const closeRewardsModal = () => {
  showRewardsModal.value = false;
  rewardsData.value = null;
};

// 显示战斗历史记录
const showBattleHistory = () => {
  showHistoryModal.value = true;
};

// 关闭历史记录弹窗
const closeHistoryModal = () => {
  showHistoryModal.value = false;
};

// 显示战斗总结界面
const showBattleSummary = () => {
  if (!battleResult.value) {
    toastRef.value?.error('战斗数据不完整，无法生成总结', {
      title: '错误',
      duration: 3000,
    });
    return;
  }

  // 配置战斗总结界面
  battleSummaryConfig.value = {
    title: '人物战斗总结',
    subtitle: `胜利 - 第${battleResult.value.totalTurns}回合`,
    welcomeText: '生成人物战斗被俘过程',
    welcomeHint: 'AI将根据战斗数据生成详细的人物战斗被俘过程描述',
    battleData: battleResult.value,
    saveKey: `battle_summary_${Date.now()}`,
    initialSummary: cachedBattleSummary.value, // 传入缓存的总结
    onSummaryGenerated: (summary: string) => {
      console.log('人物战斗总结已生成:', summary);
      // 缓存生成的总结
      cachedBattleSummary.value = summary;
    },
    onSummarySaved: (summary: string) => {
      console.log('人物战斗总结已保存:', summary);
    },
    onClose: () => {
      showBattleSummaryInterface.value = false;
    },
  };

  showBattleSummaryInterface.value = true;
};

// 关闭战斗总结界面
const closeBattleSummaryInterface = () => {
  showBattleSummaryInterface.value = false;
  battleSummaryConfig.value = null;
};

// 选择集火目标
const selectTarget = (target: BattleUnit) => {
  // 允许在战斗开始前和战斗中选择集火目标
  // 移除 isManualMode 限制，让玩家随时可以选择集火目标

  // 检查目标是否存活
  if (!target.isAlive) {
    console.log('目标已死亡，无法选择');
    return;
  }

  // 检查目标是否为敌方
  const isEnemy = enemies.value.some(unit => unit.id === target.id);
  if (!isEnemy) {
    console.log('只能选择敌方单位作为目标');
    return;
  }

  selectedTarget.value = target;
  console.log('选择集火目标:', target.name, 'ID:', target.id);

  // 如果还没有进入手动模式，自动设置为手动模式
  if (!isManualMode.value) {
    isManualMode.value = true;
    console.log('自动设置为手动模式');
  }
};

// 确认奖励
const confirmRewards = async () => {
  console.log('确认奖励:', rewardsData.value);

  // 处理资源奖励（金币、食物、奴隶）
  if (rewardsData.value?.gold > 0) {
    modularSaveManager.addResource('gold', rewardsData.value.gold, '据点征服奖励');
  }
  if (rewardsData.value?.food > 0) {
    modularSaveManager.addResource('food', rewardsData.value.food, '据点征服奖励');
  }
  if (rewardsData.value?.slaves > 0) {
    modularSaveManager.addResource('slaves', rewardsData.value.slaves, '据点征服奖励');
  }

  // 处理英雄奖励
  if (rewardsData.value?.heroes && rewardsData.value.heroes.length > 0) {
    for (const hero of rewardsData.value.heroes) {
      await updateHeroStatus(hero);
    }
  } else if (rewardsData.value?.hero) {
    // 兼容旧的单个英雄格式
    await updateHeroStatus(rewardsData.value.hero);
  }

  // 更新资源世界书（包含哥布林损失和大陆征服进度）
  try {
    console.log('🔍 [战斗界面] 开始更新资源世界书...');
    const currentResources = {
      gold: modularSaveManager.resources.value.gold || 0,
      food: modularSaveManager.resources.value.food || 0,
      slaves: modularSaveManager.resources.value.slaves || 0,
      normalGoblins: modularSaveManager.resources.value.normalGoblins || 0,
      warriorGoblins: modularSaveManager.resources.value.warriorGoblins || 0,
      shamanGoblins: modularSaveManager.resources.value.shamanGoblins || 0,
      paladinGoblins: modularSaveManager.resources.value.paladinGoblins || 0,
      trainingSlaves: modularSaveManager.resources.value.trainingSlaves || 0,
      rounds: modularSaveManager.resources.value.rounds || 0,
      threat: modularSaveManager.resources.value.threat || 0,
      actionPoints: modularSaveManager.resources.value.actionPoints || 3,
      maxActionPoints: modularSaveManager.resources.value.maxActionPoints || 3,
      conqueredRegions: modularSaveManager.resources.value.conqueredRegions || 0,
    };

    // 获取大陆数据
    const continents = continentExploreService.continents.value || [];
    console.log('🔍 [战斗界面] 获取到的大陆数据:', continents);

    await WorldbookService.updateResourcesWorldbook(currentResources, continents);
    console.log('🔍 [战斗界面] 资源世界书更新完成');
  } catch (error) {
    console.error('更新资源世界书失败:', error);
  }

  closeRewardsModal();
  // 关闭战斗界面
  closeInterface();
};

// 更新英雄状态
const updateHeroStatus = async (hero: any) => {
  try {
    // 获取现有的调教数据
    const trainingData = (modularSaveManager.getModuleData({ moduleName: 'training' }) as any) || {
      characters: [],
    };

    // 优先通过ID查找英雄，如果找不到则通过名字和状态查找
    let heroIndex = trainingData.characters.findIndex((char: any) => char.id === hero.id);

    // 如果通过ID找不到，再尝试通过名字和状态查找（支持 uncaptured 和 enemy 状态）
    if (heroIndex === -1) {
      heroIndex = trainingData.characters.findIndex(
        (char: any) => char.name === hero.name && (char.status === 'uncaptured' || char.status === 'enemy'),
      );
    }

    let updatedCharacter: any;

    if (heroIndex !== -1) {
      // 获取当前游戏时间作为捕获时间
      const currentRounds = modularSaveManager.resources.value.rounds || 0;
      const captureTime = TimeParseService.getTimeInfo(currentRounds).formattedDate;

      // 更新英雄状态为已捕获，保留AI生成的属性
      updatedCharacter = {
        ...trainingData.characters[heroIndex],
        status: 'imprisoned',
        capturedAt: captureTime, // 使用游戏内时间而不是真实时间
        // 只更新状态相关字段，保留AI生成的属性（stamina、fertility等）
        loyalty: trainingData.characters[heroIndex].loyalty || 0,
        offspring: trainingData.characters[heroIndex].offspring || 0,
        lastTraining: undefined,
        favorite: trainingData.characters[heroIndex].favorite || false,
      };

      trainingData.characters[heroIndex] = updatedCharacter;
      console.log('英雄状态已更新为已捕获:', updatedCharacter.name);
    } else {
      // 如果英雄不存在，添加新英雄（确保传奇人物也能被添加）
      console.log('英雄不存在于调教数据中，添加新英雄:', hero.name);

      // 获取当前游戏时间作为捕获时间
      const currentRounds = modularSaveManager.resources.value.rounds || 0;
      const captureTime = TimeParseService.getTimeInfo(currentRounds).formattedDate;

      // 创建新英雄，使用传入的英雄数据，并设置状态为已捕获
      updatedCharacter = {
        ...hero,
        status: 'imprisoned',
        capturedAt: captureTime, // 使用游戏内时间而不是真实时间
        loyalty: hero.loyalty || 0,
        offspring: hero.offspring || 0,
        lastTraining: undefined,
        favorite: hero.favorite || false,
      };

      trainingData.characters.push(updatedCharacter);
      console.log('新英雄已添加到调教数据:', updatedCharacter.name);
    }

    // 更新世界书
    try {
      console.log('📚 [战斗界面] 开始更新英雄世界书...');
      const { WorldbookService } = await import('../../../核心层/服务/世界书管理/服务/世界书服务');
      await WorldbookService.updateCharacterEntry(updatedCharacter);
      console.log('✅ [战斗界面] 英雄世界书已更新');
    } catch (worldbookError) {
      console.error('❌ [战斗界面] 更新英雄世界书失败:', worldbookError);
      // 不影响主要流程，继续执行
    }

    // 更新模块化存档系统
    modularSaveManager.updateModuleData({
      moduleName: 'training',
      data: trainingData,
    });

    console.log('英雄状态已更新为已捕获');
  } catch (error) {
    console.error('更新英雄状态失败:', error);
  }
};

// 为敌方单位分配大陆通用肖像
const assignContinentAvatarsToEnemies = () => {
  const continent = props.battleData?.target?.continent;
  if (!continent) return;

  enemies.value.forEach((unit, index) => {
    // 只处理没有URL头像的单位（emoji或不存在的）
    if (unit.avatar && (unit.avatar.startsWith('/') || unit.avatar.startsWith('http'))) return;

    // 用单位ID+index作为确定性种子，从大陆通用图片分配
    const seed = `${unit.id || unit.name}_${index}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash = hash & hash;
    }

    fetch(`/api/images/assign/${Math.abs(hash)}?continent=${encodeURIComponent(continent)}`)
      .then(r => r.json())
      .then(d => {
        if (d.url) {
          unit.avatar = d.url;
        }
      })
      .catch(() => {});
  });
};

// 处理图片加载错误 — 使用确定性兜底（与全局shim一致）
const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement;
  if (!img || img.dataset.fb) return; // 已处理过，跳过
  img.dataset.fb = '1';

  // 哥布林之王图片：若无则空白，不做兜底
  if (img.src.includes('goblin-king')) {
    img.style.display = 'none';
    return;
  }

  // 获取当前战斗据点的大陆名称
  const continent = props.battleData?.target?.continent || '';

  // 尝试确定性兜底：使用原src的hash作为分配种子
  let hash = 0;
  const src = img.src || img.getAttribute('src') || '';
  for (let i = 0; i < src.length; i++) {
    hash = ((hash << 5) - hash) + src.charCodeAt(i);
    hash = hash & hash;
  }
  const seed = Math.abs(hash);

  const assignUrl = continent
    ? `/api/images/assign/${seed}?continent=${encodeURIComponent(continent)}`
    : `/api/images/assign/${seed}`;

  fetch(assignUrl)
    .then((r) => r.json())
    .then((d) => {
      if (d.url) {
        img.src = d.url;
        img.style.display = ''; // 恢复显示
      } else {
        // 兜底也失败，隐藏图片显示emoji
        img.style.display = 'none';
        const unitPortrait = img.parentElement;
        if (unitPortrait) {
          const defaultPortrait = unitPortrait.querySelector('.default-portrait') as HTMLElement;
          if (defaultPortrait) defaultPortrait.classList.remove('hidden');
        }
      }
    })
    .catch(() => {
      // 网络错误，隐藏图片显示emoji
      img.style.display = 'none';
      const unitPortrait = img.parentElement;
      if (unitPortrait) {
        const defaultPortrait = unitPortrait.querySelector('.default-portrait') as HTMLElement;
        if (defaultPortrait) defaultPortrait.classList.remove('hidden');
      }
    });
};

const handleRightArrow = () => {
  if (battleStatus.value === 'idle') {
    // 开始战斗
    startBattle();
  } else if (battleStatus.value === 'fighting') {
    // 继续战斗
    if (isManualMode.value) {
      console.log('手动模式：执行下一回合战斗');
      console.log('当前集火目标:', selectedTarget.value?.name || '无');
      if (selectedTarget.value) {
        console.log('我方单位将优先攻击集火目标:', selectedTarget.value.name);
      }
    }
    nextAction();
  } else if (battleStatus.value === 'finished') {
    // 战斗结束后，右箭头不执行任何操作
    // 用户需要通过撤退按钮或开始收获按钮来关闭界面
    console.log('战斗已结束，请使用相应的操作按钮');
  }
};

// 手动战斗
const startManualBattle = () => {
  console.log('=== 开始手动战斗检查 ===');
  console.log('当前我方单位数量:', allies.value.length);
  console.log('当前敌方单位数量:', enemies.value.length);

  // 优先检查是否有部队编制数据
  const hasFormation = FormationService.hasFormationData();
  console.log('部队编制检查结果:', hasFormation);

  if (!hasFormation) {
    console.log('没有部队编制数据，显示警告弹窗');
    showFormationWarning.value = true;
    return;
  }

  if (allies.value.length === 0 || enemies.value.length === 0) {
    console.log('单位数量不足，显示警告');
    toast.warning('请先设置战斗单位！');
    return;
  }

  console.log('所有检查通过，开始战斗');
  battleStatus.value = 'fighting';
  battleSystem.value = new NewBattleSystem(allies.value, enemies.value);
  isManualMode.value = true;
  // 保留集火目标，不清空

  // 开始第一个行动
  nextAction();
};

// 自动战斗
const startAutoBattle = () => {
  // 优先检查是否有部队编制数据
  if (!FormationService.hasFormationData()) {
    showFormationWarning.value = true;
    return;
  }

  if (allies.value.length === 0 || enemies.value.length === 0) {
    toast.warning('请先设置战斗单位！');
    return;
  }

  battleStatus.value = 'fighting';
  battleSystem.value = new NewBattleSystem(allies.value, enemies.value);
  isManualMode.value = false;
  selectedTarget.value = null;

  // 自动执行所有行动直到战斗结束
  autoExecuteBattle();
};

// 自动执行战斗
const autoExecuteBattle = () => {
  const executeNext = () => {
    if (battleStatus.value !== 'fighting') return;

    const actionResult = battleSystem.value?.executeSingleAction();
    if (actionResult) {
      console.log('执行行动:', actionResult);

      // 直接添加到历史记录
      battleHistory.value.push({
        turnNumber: battleHistory.value.length + 1,
        actions: [actionResult],
        startState: battleSystem.value?.getCurrentState() || {
          allies: allies.value,
          enemies: enemies.value,
          currentTurn: currentTurn.value,
          isFinished: false,
          winner: undefined,
        },
        endState: actionResult.endState,
      });

      currentDisplayTurn.value = battleHistory.value.length;

      // 更新单位状态
      allies.value = actionResult.endState?.allies || allies.value;
      enemies.value = actionResult.endState?.enemies || enemies.value;

      // 检查战斗是否结束
      const aliveAllies = allies.value.filter(unit => unit.isAlive);
      const aliveEnemies = enemies.value.filter(unit => unit.isAlive);

      if (aliveAllies.length === 0 || aliveEnemies.length === 0) {
        battleStatus.value = 'finished';
        console.log('战斗结束');

        // 设置战斗结果
        battleResult.value = {
          victory: aliveAllies.length > 0,
          totalTurns: battleHistory.value.length,
          finalState: {
            allies: allies.value,
            enemies: enemies.value,
            currentTurn: currentTurn.value,
            isFinished: true,
            winner: aliveAllies.length > 0 ? 'allies' : 'enemies',
          },
          turns: battleHistory.value,
          statistics: {
            totalDamageDealt: 0,
            totalDamageReceived: 0,
            criticalHits: 0,
            misses: 0,
          },
          // 添加初始部队状态信息
          initialTroopState: initialTroopState.value,
        };

        console.log('战斗结果:', battleResult.value);

        // 同步哥布林损失到资源系统
        syncGoblinLossesToResources();

        // 发送战斗完成事件
        if (props.isModal) {
          emit('battle-complete', battleResult.value);
        }
      } else {
        // 继续下一回合
        setTimeout(executeNext, 100); // 延迟200ms执行下一回合
      }
    }
  };

  executeNext();
};

const startBattle = () => {
  // 注意：行动力已在探索界面消耗，这里不再消耗
  console.log('高级战斗界面：直接开始手动战斗（行动力已在探索界面消耗）');

  startManualBattle();
};

const nextAction = () => {
  if (!battleSystem.value) return;

  // 执行单个行动（传递集火目标）
  console.log('传递集火目标到战斗系统:', selectedTarget.value?.name, 'ID:', selectedTarget.value?.id);
  console.log(
    '当前战斗状态 - 我方单位:',
    allies.value.map(u => u.name),
    '敌方单位:',
    enemies.value.map(u => u.name),
  );
  const actionResult = battleSystem.value.executeSingleAction(selectedTarget.value || undefined);
  if (actionResult) {
    console.log('执行行动:', actionResult);

    // 直接添加到历史记录
    battleHistory.value.push({
      turnNumber: battleHistory.value.length + 1,
      actions: [actionResult],
      startState: battleSystem.value.getCurrentState(),
      endState: actionResult.endState,
    });

    currentDisplayTurn.value = battleHistory.value.length;

    // 更新单位状态
    allies.value = actionResult.endState?.allies || allies.value;
    enemies.value = actionResult.endState?.enemies || enemies.value;

    // 检查集火目标是否被消灭
    if (selectedTarget.value && !selectedTarget.value.isAlive) {
      selectedTarget.value = null;
      console.log('集火目标已被消灭，清除集火状态');
    }

    // 检查战斗是否结束
    const aliveAllies = allies.value.filter(unit => unit.isAlive);
    const aliveEnemies = enemies.value.filter(unit => unit.isAlive);

    if (aliveAllies.length === 0 || aliveEnemies.length === 0) {
      battleStatus.value = 'finished';
      console.log('战斗结束');

      // 设置战斗结果
      battleResult.value = {
        victory: aliveAllies.length > 0,
        totalTurns: battleHistory.value.length,
        finalState: {
          allies: allies.value,
          enemies: enemies.value,
          currentTurn: currentTurn.value,
          isFinished: true,
          winner: aliveAllies.length > 0 ? 'allies' : 'enemies',
        },
        turns: battleHistory.value,
        statistics: {
          totalDamageDealt: 0,
          totalDamageReceived: 0,
          criticalHits: 0,
          misses: 0,
        },
        // 添加初始部队状态信息
        initialTroopState: initialTroopState.value,
      };

      console.log('战斗结果:', battleResult.value);

      // 显示战斗结果弹窗提示
      if (battleResult.value?.victory) {
        // 胜利提示
        toastRef.value?.success('🎉 战斗胜利！据点已被征服！', {
          title: '胜利',
          duration: 4000,
        });
      } else {
        // 失败提示
        toastRef.value?.error('💀 战斗失败！部队损失惨重！', {
          title: '失败',
          duration: 4000,
        });
      }

      // 发送战斗完成事件
      if (props.isModal) {
        emit('battle-complete', battleResult.value);
      }
    } else if (!isManualMode.value) {
      // 只有在自动模式下才自动继续下一回合
      setTimeout(() => {
        if (battleStatus.value === 'fighting') {
          nextAction();
        }
      }, 200);
    }
  }
};

const previousTurn = () => {
  if (currentDisplayTurn.value > 1) {
    currentDisplayTurn.value--;
  }
};

const resetBattle = () => {
  battleStatus.value = 'idle';
  currentTurn.value = 1;
  battleHistory.value = [];
  battleResult.value = null;
  battleSystem.value = null;
  currentDisplayTurn.value = 1;

  // 重置单位状态
  allies.value.forEach(unit => {
    unit.currentHealth = unit.maxHealth;
    unit.isAlive = true;
  });
  enemies.value.forEach(unit => {
    unit.currentHealth = unit.maxHealth;
    unit.isAlive = true;
  });
};

// 显示奖励弹窗
const showRewards = () => {
  console.log('显示据点奖励');

  // 获取据点奖励数据
  const rewards = getLocationRewards();

  // 使用自定义确认框显示奖励
  showRewardsModal.value = true;
  rewardsData.value = rewards;
};

// 获取据点奖励数据
const getLocationRewards = () => {
  // 从battleData中获取据点奖励，如果没有则使用默认奖励
  const locationRewards = props.battleData?.target?.rewards || {
    gold: 100,
    food: 50,
    slaves: 1,
  };

  // 添加英雄信息
  const target = props.battleData?.target;
  if (target?.rewards?.heroes && target.rewards.heroes.length > 0) {
    locationRewards.heroes = target.rewards.heroes;
  }

  console.log('据点奖励数据:', {
    locationRewards,
    heroes: target?.rewards?.heroes,
  });

  return locationRewards;
};

// 保存初始部队状态
const saveInitialTroopState = () => {
  console.log('保存初始部队状态');
  initialTroopState.value = {};

  // 保存我方部队信息
  allies.value.forEach(unit => {
    if (unit.troops) {
      initialTroopState.value[unit.id] = {
        normalGoblins: unit.troops.normalGoblins || 0,
        warriorGoblins: unit.troops.warriorGoblins || 0,
        shamanGoblins: unit.troops.shamanGoblins || 0,
        paladinGoblins: unit.troops.paladinGoblins || 0,
      };
    }
  });

  // 保存据点奖励信息（包括英雄人物）
  if (props.battleData?.target?.rewards) {
    initialTroopState.value.rewards = props.battleData.target.rewards;
    console.log('已保存据点奖励信息:', {
      gold: props.battleData.target.rewards.gold,
      food: props.battleData.target.rewards.food,
      heroes: props.battleData.target.rewards.heroes?.length || 0,
    });
  }

  console.log('初始部队状态已保存:', initialTroopState.value);
};

// 同步哥布林损失到资源系统
const syncGoblinLossesToResources = () => {
  console.log('开始同步哥布林损失到资源系统');

  // 计算总损失
  let totalNormalLoss = 0;
  let totalWarriorLoss = 0;
  let totalShamanLoss = 0;
  let totalPaladinLoss = 0;

  // 遍历所有我方单位，计算损失
  allies.value.forEach(unit => {
    if (unit.troops && initialTroopState.value[unit.id]) {
      const initial = initialTroopState.value[unit.id];
      const current = {
        normalGoblins: unit.troops.normalGoblins || 0,
        warriorGoblins: unit.troops.warriorGoblins || 0,
        shamanGoblins: unit.troops.shamanGoblins || 0,
        paladinGoblins: unit.troops.paladinGoblins || 0,
      };

      // 计算损失
      const normalLoss = Math.max(0, initial.normalGoblins - current.normalGoblins);
      const warriorLoss = Math.max(0, initial.warriorGoblins - current.warriorGoblins);
      const shamanLoss = Math.max(0, initial.shamanGoblins - current.shamanGoblins);
      const paladinLoss = Math.max(0, initial.paladinGoblins - current.paladinGoblins);

      totalNormalLoss += normalLoss;
      totalWarriorLoss += warriorLoss;
      totalShamanLoss += shamanLoss;
      totalPaladinLoss += paladinLoss;

      console.log(`单位 ${unit.name} 损失:`, {
        normal: normalLoss,
        warrior: warriorLoss,
        shaman: shamanLoss,
        paladin: paladinLoss,
      });
    }
  });

  // 使用模块化存档服务同步资源
  try {
    // 消耗损失的哥布林
    if (totalNormalLoss > 0) {
      modularSaveManager.consumeResource('normalGoblins', totalNormalLoss, '战斗损失');
    }
    if (totalWarriorLoss > 0) {
      modularSaveManager.consumeResource('warriorGoblins', totalWarriorLoss, '战斗损失');
    }
    if (totalShamanLoss > 0) {
      modularSaveManager.consumeResource('shamanGoblins', totalShamanLoss, '战斗损失');
    }
    if (totalPaladinLoss > 0) {
      modularSaveManager.consumeResource('paladinGoblins', totalPaladinLoss, '战斗损失');
    }

    console.log('哥布林损失已同步到存档系统:', {
      normalLoss: totalNormalLoss,
      warriorLoss: totalWarriorLoss,
      shamanLoss: totalShamanLoss,
      paladinLoss: totalPaladinLoss,
    });

    // 显示损失提示
    const totalLoss = totalNormalLoss + totalWarriorLoss + totalShamanLoss + totalPaladinLoss;
    if (totalLoss > 0) {
      toastRef.value?.warning(`💀 战斗中损失了 ${totalLoss} 个哥布林！`, {
        title: '部队损失',
        duration: 5000,
      });
    }
  } catch (error) {
    console.error('同步哥布林损失失败:', error);
  }
};

// 撤退
const retreat = () => {
  console.log('撤退');

  // 检查是否进行了战前对话，且敌方士气已降低
  if (dialogueCompleted.value && enemyMorale.value < 100) {
    console.log('检测到战前对话已完成，显示撤退确认框');
    showRetreatConfirm.value = true;
    return;
  }

  // 没有进行战前对话或士气未降低，直接撤退
  performRetreat();
};

// 执行撤退操作
const performRetreat = async () => {
  console.log('执行撤退');

  // 注意：撤退不返还行动力，因为行动力已经消耗了

  // 更新资源世界书（包含哥布林损失）
  try {
    console.log('🔍 [战斗界面] 撤退时更新资源世界书...');
    const currentResources = {
      gold: modularSaveManager.resources.value.gold || 0,
      food: modularSaveManager.resources.value.food || 0,
      slaves: modularSaveManager.resources.value.slaves || 0,
      normalGoblins: modularSaveManager.resources.value.normalGoblins || 0,
      warriorGoblins: modularSaveManager.resources.value.warriorGoblins || 0,
      shamanGoblins: modularSaveManager.resources.value.shamanGoblins || 0,
      paladinGoblins: modularSaveManager.resources.value.paladinGoblins || 0,
      trainingSlaves: modularSaveManager.resources.value.trainingSlaves || 0,
      rounds: modularSaveManager.resources.value.rounds || 0,
      threat: modularSaveManager.resources.value.threat || 0,
      actionPoints: modularSaveManager.resources.value.actionPoints || 3,
      maxActionPoints: modularSaveManager.resources.value.maxActionPoints || 3,
      conqueredRegions: modularSaveManager.resources.value.conqueredRegions || 0,
    };

    // 获取大陆数据
    const continents = continentExploreService.continents.value || [];
    console.log('🔍 [战斗界面] 撤退时获取到的大陆数据:', continents);

    WorldbookService.updateResourcesWorldbook(currentResources, continents)
      .then(() => {
        console.log('🔍 [战斗界面] 撤退时资源世界书更新完成');
      })
      .catch(error => {
        console.error('撤退时更新资源世界书失败:', error);
      });
  } catch (error) {
    console.error('撤退时更新资源世界书失败:', error);
  }

  // 关闭战斗界面
  closeInterface();
};

// 确认撤退（保存对话记录）
const confirmRetreatWithSave = async () => {
  console.log('保存对话记录并撤退');
  showRetreatConfirm.value = false;

  try {
    // 获取当前据点的敌方人物信息
    const getCurrentEnemyCharacters = () => {
      const target = props.battleData?.target;
      if (target?.rewards?.heroes && Array.isArray(target.rewards.heroes)) {
        return target.rewards.heroes.filter((hero: Character) => hero.status === 'enemy' && hero.canCombat === true);
      }
      return [];
    };

    const enemyCharacters = getCurrentEnemyCharacters();

    // 获取游戏时间
    const rounds = modularSaveManager.resources.value.rounds || 0;
    const gameTime = TimeParseService.getTimeInfo(rounds).formattedDate;
    const baseTimestamp = Date.now();

    // 为每个敌方人物添加撤退记录
    for (const character of enemyCharacters) {
      const retreatMessage = {
        gameTime: gameTime,
        sender: 'user',
        content: '已撤退，本次战前对话结束',
        timestamp: baseTimestamp,
      };

      // 直接调用世界书服务保存撤退记录
      // 注意：使用 character.name 作为 characterId，与对话时的逻辑保持一致
      await WorldbookService.addMultipleDialogueRecords(character.name, character.name, [retreatMessage], 'enemy');

      console.log(`✅ 已为 ${character.name} 添加撤退记录`);
    }

    toastRef.value?.success('撤退记录已保存到世界书', {
      title: '撤退',
      duration: 2000,
    });
  } catch (error) {
    console.error('保存撤退记录失败:', error);
    toastRef.value?.warning('保存撤退记录时出现错误', {
      title: '警告',
      duration: 3000,
    });
  }

  // 对话记录已经在对话过程中保存到世界书，现在添加了撤退记录，执行撤退
  await performRetreat();
};

// 确认撤退（清除对话记录）
const confirmRetreatWithoutSave = async () => {
  console.log('清除对话记录并撤退');
  showRetreatConfirm.value = false;

  try {
    // 获取当前据点的敌方人物信息
    const getCurrentEnemyCharacters = () => {
      const target = props.battleData?.target;
      if (target?.rewards?.heroes && Array.isArray(target.rewards.heroes)) {
        return target.rewards.heroes.filter((hero: Character) => hero.status === 'enemy' && hero.canCombat === true);
      }
      return [];
    };

    const enemyCharacters = getCurrentEnemyCharacters();

    // 删除所有敌方人物的剧情记录
    for (const character of enemyCharacters) {
      try {
        await WorldbookService.deleteCharacterStoryHistoryEntry(character.id);
        console.log(`✅ 已删除 ${character.name} 的剧情记录`);
      } catch (error) {
        console.error(`删除 ${character.name} 的剧情记录失败:`, error);
      }
    }

    toastRef.value?.success('已清除所有战前对话记录', {
      title: '撤退',
      duration: 2000,
    });
  } catch (error) {
    console.error('清除对话记录失败:', error);
    toastRef.value?.warning('清除对话记录时出现错误', {
      title: '警告',
      duration: 3000,
    });
  }

  // 执行撤退
  await performRetreat();
};

// 取消撤退
const cancelRetreat = () => {
  showRetreatConfirm.value = false;
};

// 再来一次
const retryBattle = () => {
  console.log('再来一次');
  // 重置战斗状态，重新开始
  resetBattle();
};

// 关闭战斗界面
const closeInterface = () => {
  if (props.isModal) {
    emit('close-battle');
  } else {
    // 如果不是模态框，发送消息给父窗口
    window.parent.postMessage({ type: 'close-battle' }, '*');
  }
};

// 处理部队编制警告弹窗
const closeFormationWarning = () => {
  showFormationWarning.value = false;
};

const goToFormation = () => {
  showFormationWarning.value = false;
  // 发送消息给父窗口，切换到部队编制界面
  window.parent.postMessage({ type: 'navigate-to-formation' }, '*');
};

// 加载enemy状态的可战斗人物
const loadEnemyCharacters = () => {
  try {
    // 从模块化存档系统获取调教数据中的人物
    const trainingData = modularSaveManager.getModuleData({ moduleName: 'training' }) as any;
    if (trainingData && trainingData.characters) {
      // 筛选出enemy状态且可战斗的人物
      const enemyCharacters = trainingData.characters.filter(
        (char: Character) => char.status === 'enemy' && char.canCombat === true,
      );

      if (enemyCharacters.length > 0) {
        console.log('找到enemy状态的可战斗人物:', enemyCharacters.length, '个');

        // 将人物转换为战斗单位
        return enemyCharacters
          .map((character: Character) => {
            const battleUnit = BattleFactory.createBattleUnitFromEnemyCharacter(character);
            if (battleUnit) {
              console.log(`成功创建敌方战斗单位: ${character.name}`, battleUnit);
              return battleUnit;
            }
            return null;
          })
          .filter((unit: BattleUnit | null): unit is BattleUnit => unit !== null);
      }
    }
  } catch (error) {
    console.error('加载enemy状态人物失败:', error);
  }

  return [];
};

// 初始化战斗数据
const initializeBattleData = () => {
  console.log('开始初始化战斗数据...');

  // 重置战前对话状态 - 每次进入新据点都应该重置
  dialogueCompleted.value = false;
  enemyMorale.value = 100;
  showDialogueInterface.value = false;
  dialogueConfig.value = null;
  showDialogueConfirm.value = false;

  // 如果已经初始化过，直接返回
  if (isInitialized.value && allies.value.length > 0) {
    console.log('战斗数据已初始化，跳过重复初始化');
    return;
  }

  // 清空现有数据，避免重复
  allies.value = [];

  // 尝试从部队编制获取我方单位
  const hasFormation = FormationService.hasFormationData();
  console.log('=== 初始化战斗数据 ===');
  console.log('检查是否有部队编制数据:', hasFormation);

  if (hasFormation) {
    console.log('发现部队编制数据，加载已编制的部队');
    const formationData = FormationService.getFormationData();
    console.log('获取到的部队编制数据:', formationData);
    allies.value = [...formationData]; // 使用展开运算符创建新数组
    console.log('设置我方单位数量:', allies.value.length);

    // 显示部队编制统计信息
    const stats = FormationService.getFormationStats();
    console.log('部队编制统计:', stats);
  } else {
    console.log('没有部队编制数据，不设置任何我方单位');
    allies.value = [];
    console.log('我方单位数量:', allies.value.length);
  }

  // 保存初始部队状态（用于计算损失）
  saveInitialTroopState();

  // 标记为已初始化
  isInitialized.value = true;

  // 初始化敌方单位
  initializeEnemyUnits();
  // 为敌方单位分配大陆通用肖像（非URL头像的敌人）
  assignContinentAvatarsToEnemies();
};

// 初始化敌方单位
const initializeEnemyUnits = () => {
  // 优先使用据点的敌方单位数据（包含完整的部队构成）
  if (props.battleData?.enemyForces?.units && props.battleData.enemyForces.units.length > 0) {
    console.log('使用据点敌方单位数据:', props.battleData.enemyForces.units);

    // 将据点单位数据转换为战斗单位格式，并计算部队属性叠加
    enemies.value = props.battleData.enemyForces.units.map((unit: any, index: number) => {
      console.log(`处理敌方单位 ${index}:`, {
        name: unit.name,
        race: unit.race,
        troops: unit.troops,
        attributes: unit.attributes,
      });

      // 计算部队属性加成
      let troopAttackBonus = 0;
      let troopDefenseBonus = 0;
      let troopIntelligenceBonus = 0;
      let troopSpeedBonus = 0;
      let troopHealthBonus = 0;

      // 检查是否有部队数据（支持两种格式：troops对象和troopCount字段）
      const hasTroops = (unit.troops && unit.troops.count > 0) || (unit.troopCount && unit.troopCount > 0);

      if (hasTroops) {
        // 根据种族和职业找到对应的单位数据
        const unitCharacters = getUnitsByRace(unit.race || '人类');

        // 确定部队类型和数量
        let troopType: string;
        let troopCount: number;

        if (unit.troops && unit.troops.count > 0) {
          // 新格式：troops对象
          troopType = unit.troops.type;
          troopCount = unit.troops.count;
        } else {
          // 旧格式：troopCount字段，使用单位名称作为部队类型
          troopType = unit.name || unit.class || '战士';
          troopCount = unit.troopCount || 0;
        }

        console.log(`单位 ${unit.name} 部队信息:`, {
          troopType,
          troopCount,
          race: unit.race,
          availableUnits: unitCharacters.map(u => ({ id: u.id, name: u.name })),
        });

        // 尝试通过name匹配，如果失败则通过id匹配
        let matchingUnit = unitCharacters.find(u => u.name === troopType);
        if (!matchingUnit) {
          matchingUnit = unitCharacters.find(u => u.id === troopType);
        }

        if (matchingUnit) {
          // 使用带递减机制的部队加成计算（敌方单位）
          const troopLevel = Math.min(matchingUnit.level, 10);
          troopAttackBonus = calculateTroopBonusWithDecay(troopCount, matchingUnit.attributes.attack, troopLevel);
          troopDefenseBonus = calculateTroopBonusWithDecay(troopCount, matchingUnit.attributes.defense, troopLevel);
          troopIntelligenceBonus = calculateTroopBonusWithDecay(
            troopCount,
            matchingUnit.attributes.intelligence,
            troopLevel,
          );
          troopSpeedBonus = calculateTroopBonusWithDecay(troopCount, matchingUnit.attributes.speed, troopLevel);
          troopHealthBonus = calculateTroopBonusWithDecay(troopCount, matchingUnit.attributes.health, troopLevel);

          console.log(`单位 ${unit.name} 的部队属性加成:`, {
            troopType,
            matchingUnit: matchingUnit.name,
            troopCount,
            troopLevel,
            bonuses: {
              attack: troopAttackBonus,
              defense: troopDefenseBonus,
              intelligence: troopIntelligenceBonus,
              speed: troopSpeedBonus,
              health: troopHealthBonus,
            },
          });
        } else {
          console.warn(`未找到匹配的单位数据:`, {
            race: unit.race,
            troopType,
            availableUnits: unitCharacters.map(u => ({ id: u.id, name: u.name })),
          });
        }
      }

      // 计算最终属性（基础属性 + 部队加成）
      const baseAttributes = {
        attack: unit.attributes?.attack || 0,
        defense: unit.attributes?.defense || 0,
        intelligence: unit.attributes?.intelligence || 0,
        speed: unit.attributes?.speed || 0,
        health: unit.attributes?.health || 10,
      };

      const finalAttributes = {
        attack: baseAttributes.attack + troopAttackBonus,
        defense: baseAttributes.defense + troopDefenseBonus,
        intelligence: baseAttributes.intelligence + troopIntelligenceBonus,
        speed: baseAttributes.speed + troopSpeedBonus,
      };

      const finalHealth = baseAttributes.health + troopHealthBonus;

      console.log(`单位 ${unit.name} 属性计算:`, {
        基础属性: baseAttributes,
        部队加成: {
          attack: troopAttackBonus,
          defense: troopDefenseBonus,
          intelligence: troopIntelligenceBonus,
          speed: troopSpeedBonus,
          health: troopHealthBonus,
        },
        最终属性: {
          ...finalAttributes,
          health: finalHealth,
        },
      });

      // 将敌方单位的 troopCount 转换为 troops 对象
      const troops =
        unit.troops ||
        (unit.troopCount > 0
          ? {
              type: unit.name || unit.class || '战士', // 优先使用单位名称
              count: unit.troopCount,
            }
          : null);

      const battleUnit = {
        id: unit.id || `enemy_${index}`,
        name: unit.name,
        type: unit.unitType || 'physical',
        level: unit.level || 1,
        attributes: finalAttributes,
        maxHealth: finalHealth,
        currentHealth: finalHealth,
        isAlive: true,
        avatar: unit.avatar,
        troops: troops,
      };

      return battleUnit;
    });
  } else {
    // 回退：尝试从调教模块中获取enemy状态的可战斗人物
    const enemyCharacters = loadEnemyCharacters();
    if (enemyCharacters.length > 0) {
      console.log('没有据点敌方单位数据，使用调教模块中的enemy状态人物:', enemyCharacters);
      enemies.value = enemyCharacters;
      return;
    }

    console.log('没有据点敌方单位数据和enemy状态人物，使用示例数据');
    // 使用示例敌方单位数据作为后备
    enemies.value = [
      {
        id: 'human_guard_1',
        name: '人类守卫',
        type: 'physical',
        level: 2,
        attributes: {
          attack: 6,
          defense: 8,
          intelligence: 2,
          speed: 3,
        },
        maxHealth: 25,
        currentHealth: 25,
        isAlive: true,
      },
      {
        id: 'human_mage_1',
        name: '人类法师',
        type: 'magical',
        level: 4,
        attributes: {
          attack: 2,
          defense: 1,
          intelligence: 12,
          speed: 3,
        },
        maxHealth: 18,
        currentHealth: 18,
        isAlive: true,
      },
      {
        id: 'human_archer_1',
        name: '人类弓箭手',
        type: 'ranged',
        level: 3,
        attributes: {
          attack: 7,
          defense: 3,
          intelligence: 4,
          speed: 6,
        },
        maxHealth: 20,
        currentHealth: 20,
        isAlive: true,
      },
      {
        id: 'human_knight_1',
        name: '人类骑士',
        type: 'physical',
        level: 5,
        attributes: {
          attack: 10,
          defense: 9,
          intelligence: 3,
          speed: 4,
        },
        maxHealth: 35,
        currentHealth: 35,
        isAlive: true,
      },
      {
        id: 'human_priest_1',
        name: '人类牧师',
        type: 'magical',
        level: 3,
        attributes: {
          attack: 3,
          defense: 2,
          intelligence: 10,
          speed: 4,
        },
        maxHealth: 22,
        currentHealth: 22,
        isAlive: true,
      },
      {
        id: 'human_assassin_1',
        name: '人类刺客',
        type: 'physical',
        level: 4,
        attributes: {
          attack: 9,
          defense: 2,
          intelligence: 5,
          speed: 8,
        },
        maxHealth: 16,
        currentHealth: 16,
        isAlive: true,
      },
    ];
  }
};

// 战前对话相关方法
const startPreBattleDialogue = () => {
  if (!canStartDialogue.value) {
    console.log('无法进行战前对话：', {
      hasEnemyCharacters: hasEnemyCharacters.value,
      dialogueCompleted: dialogueCompleted.value,
    });
    return;
  }

  // 重置士气
  enemyMorale.value = 100;

  // 获取当前据点的敌方人物信息
  const getCurrentEnemyCharacters = () => {
    const target = props.battleData?.target;
    if (target?.rewards?.heroes && Array.isArray(target.rewards.heroes)) {
      return target.rewards.heroes.filter((hero: Character) => hero.status === 'enemy' && hero.canCombat === true);
    }
    return [];
  };

  const enemyCharacters = getCurrentEnemyCharacters();
  const enemyNames = enemyCharacters.map((char: Character) => char.name).join('、');
  const enemyInfo = `当前据点中的敌方人物：${enemyNames}`;

  // 获取游戏时间（格式化日期）
  const rounds = modularSaveManager.resources.value.rounds || 0;
  const gameTime = TimeParseService.getTimeInfo(rounds).formattedDate;

  // 添加时间戳来追踪时间变化
  console.log('战前对话 - 时间戳:', Date.now());

  // 创建对话上下文
  const dialogueContext = {
    enemyCharacters: enemyCharacters.map((char: Character) => ({ name: char.name })),
    currentMorale: enemyMorale.value,
    enemyInfo: enemyInfo,
    gameTime: gameTime, // 添加固定的游戏时间
    // 添加据点信息
    locationInfo: props.battleData?.target
      ? {
          continent: props.battleData.target.continent || '未知大陆',
          region: props.battleData.target.region || '未知区域',
          difficulty: props.battleData.target.difficulty || '普通',
          name: props.battleData.target.name || '未知据点',
          description: props.battleData.target.description || '这是一个神秘的据点',
        }
      : undefined,
    // 添加我方部队信息
    allyForces: allies.value.map(unit => ({
      name: unit.name,
      troops: unit.troops
        ? {
            normalGoblins: unit.troops.normalGoblins || 0,
            warriorGoblins: unit.troops.warriorGoblins || 0,
            shamanGoblins: unit.troops.shamanGoblins || 0,
            paladinGoblins: unit.troops.paladinGoblins || 0,
          }
        : undefined,
    })),
    // 添加敌方部队信息
    enemyForces: enemies.value.map(unit => ({
      name: unit.name,
      type: unit.type,
      troops: unit.troops
        ? {
            type: unit.troops.type || unit.name,
            count: unit.troops.count || 0,
          }
        : undefined,
    })),
  };

  // 保存原始士气值，用于重试时恢复
  const originalMorale = ref<number>(enemyMorale.value);

  // 使用士气对话服务创建配置
  dialogueConfig.value = MoraleDialogueService.createDialogueConfig(dialogueContext, {
    onMoraleChange: (_oldMorale: number, newMorale: number, _reason: string) => {
      enemyMorale.value = newMorale;
      // 更新对话配置中的副标题
      if (dialogueConfig.value) {
        MoraleDialogueService.updateDialogueSubtitle(dialogueConfig.value, newMorale);
      }
    },
    onDialogueClose: () => {
      // 对话关闭，显示确认框
      closeDialogueInterface();
    },
    getCurrentMorale: () => {
      // 返回当前的士气值
      return enemyMorale.value;
    },
  });

  // 重写 onAIGenerate 回调，在每次生成前保存当前的士气值
  const originalOnAIGenerate = dialogueConfig.value.onAIGenerate;
  if (dialogueConfig.value.onAIGenerate) {
    dialogueConfig.value.onAIGenerate = async (userInput: string) => {
      // 在生成前保存当前的士气值，用于重试时恢复
      originalMorale.value = enemyMorale.value;
      console.log('💾 保存当前士气值作为重试基准:', originalMorale.value);
      return await originalOnAIGenerate(userInput);
    };
  }

  // 添加重试回调，用于恢复到上一次生成前的士气值
  dialogueConfig.value.onRetry = async () => {
    // 恢复士气值到上一次生成前的状态
    enemyMorale.value = originalMorale.value;
    console.log('🔄 恢复到上一次生成前的士气值:', enemyMorale.value);

    // 更新对话配置中的副标题
    if (dialogueConfig.value) {
      MoraleDialogueService.updateDialogueSubtitle(dialogueConfig.value, enemyMorale.value);
    }
  };

  showDialogueInterface.value = true;
};

const closeDialogueInterface = () => {
  // 显示确认框，询问是否结束对话
  showDialogueConfirm.value = true;
};

// 确认结束对话
const confirmEndDialogue = async () => {
  console.log('确认结束战前对话，应用士气效果');

  // 应用士气效果
  applyMoraleEffect();

  // 标记对话已完成
  dialogueCompleted.value = true;

  // 关闭对话界面
  showDialogueInterface.value = false;
  dialogueConfig.value = null;
  showDialogueConfirm.value = false;

  // 显示提示
  toastRef.value?.success(`战前对话已结束！敌方士气降至 ${enemyMorale.value.toFixed(1)}%，属性已调整`, {
    title: '对话结束',
    duration: 4000,
  });
};

// 取消结束对话
const cancelEndDialogue = () => {
  showDialogueConfirm.value = false;
  // 继续对话，不关闭界面
};

// 应用士气效果到敌方单位
const applyMoraleEffect = () => {
  if (enemyMorale.value >= 100) return; // 士气没有降低，不需要调整

  const moraleMultiplier = enemyMorale.value / 100;
  console.log(`应用士气效果：士气${enemyMorale.value.toFixed(1)}%，属性调整为${(moraleMultiplier * 100).toFixed(1)}%`);

  // 调整所有敌方单位的属性
  enemies.value.forEach(unit => {
    if (unit.attributes) {
      unit.attributes.attack = Math.round(unit.attributes.attack * moraleMultiplier);
      unit.attributes.defense = Math.round(unit.attributes.defense * moraleMultiplier);
      unit.attributes.intelligence = Math.round(unit.attributes.intelligence * moraleMultiplier);
      unit.attributes.speed = Math.round(unit.attributes.speed * moraleMultiplier);
    }

    // 调整血量
    if (unit.maxHealth) {
      unit.maxHealth = Math.round(unit.maxHealth * moraleMultiplier);
      unit.currentHealth = Math.min(unit.currentHealth, unit.maxHealth);
    }
  });

  console.log('敌方单位属性已根据士气调整');
};

// 监听战斗数据变化，重置对话状态
watch(
  () => props.battleData?.target,
  (newTarget, oldTarget) => {
    if (newTarget && newTarget !== oldTarget) {
      console.log('检测到据点变化，重置战前对话状态');
      // 重置战前对话状态
      dialogueCompleted.value = false;
      enemyMorale.value = 100;
      showDialogueInterface.value = false;
      dialogueConfig.value = null;
      showDialogueConfirm.value = false;
    }
  },
  { deep: true },
);

// 更新面板高度
const updatePanelHeight = () => {
  const panel = document.querySelector('.units-panel');
  if (panel) {
    panelHeight.value = panel.clientHeight;
  }
};

onMounted(() => {
  initializeBattleData();
  updatePanelHeight();

  // 监听窗口大小变化
  window.addEventListener('resize', updatePanelHeight);
});

// 组件卸载时清理监听器
onUnmounted(() => {
  window.removeEventListener('resize', updatePanelHeight);
});
</script>

<style scoped>
.advanced-battle-interface {
  --panel-width: 275px;
  --gap: 1rem;
  --padding: 1rem;
  /* 动态高度变量 */
  --unit-card-min-height: 120px;
  --unit-card-max-height: 200px;
  --unit-card-height-ratio: 15vh;
  /* 字体大小变量 */
  --unit-name-font-size: 14px; /* 1080P人物名称增大 */
  --health-text-font-size: 12px; /* 1080P血量文字增大 */
  --attr-font-size: 8px;
  --attr-icon-font-size: 8px;

  width: 100%;
  height: 100%;
  background: linear-gradient(180deg, rgba(40, 26, 20, 0.95), rgba(25, 17, 14, 0.98));
  color: #f0e6d2;
  font-family: 'Arial', sans-serif;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: var(--gap);
  padding: var(--padding);
}

.advanced-battle-interface.modal-mode {
  background: transparent;
  flex: 1;
}

/* 所有情况下都使用垂直布局 */

.battle-header-modal {
  background: rgba(0, 0, 0, 0.4);
  padding: 1rem;
  border-bottom: 2px solid rgba(205, 133, 63, 0.4);
  display: flex;
  justify-content: center;
  align-items: center;
}

.battle-info-modal {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: center;
}

.battle-info-modal .turn-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.battle-info-modal .battle-controls {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
}

@media (max-width: 768px) {
  .battle-info-modal {
    flex-direction: column;
    gap: 0.5rem;
  }

  .battle-info-modal .battle-controls {
    width: 100%;
    justify-content: center;
  }

  .battle-info-modal .control-btn {
    padding: 0.4rem 0.8rem;
    font-size: 0.8rem;
  }
}

.battle-header {
  background: rgba(0, 0, 0, 0.4);
  padding: 1rem;
  border-bottom: 2px solid rgba(205, 133, 63, 0.4);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.battle-title h2 {
  margin: 0;
  color: #ffd7a1;
  font-size: 1.5rem;
  font-weight: 700;
}

.battle-status {
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-weight: bold;
  margin-top: 0.5rem;
  color: #f0e6d2;
}

.battle-status.idle {
  background: rgba(107, 114, 128, 0.3);
  border: 1px solid rgba(107, 114, 128, 0.5);
}

.battle-status.fighting {
  background: rgba(220, 38, 38, 0.3);
  border: 1px solid rgba(220, 38, 38, 0.5);
  animation: pulse 1s infinite;
}

.battle-status.paused {
  background: rgba(245, 158, 11, 0.3);
  border: 1px solid rgba(245, 158, 11, 0.5);
}

.battle-status.finished {
  background: rgba(5, 150, 105, 0.3);
  border: 1px solid rgba(5, 150, 105, 0.5);
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.battle-info {
  display: flex;
  align-items: center;
  gap: 2rem;
}

.turn-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.turn-label {
  color: #9ca3af;
}

.turn-number {
  background: rgba(205, 133, 63, 0.3);
  border: 1px solid rgba(205, 133, 63, 0.5);
  color: #ffd7a1;
  padding: 0.25rem 0.75rem;
  border-radius: 15px;
  font-weight: bold;
}

.battle-controls {
  display: flex;
  gap: 0.5rem;
}

.control-btn {
  padding: 0.5rem 1rem;
  border: 1px solid rgba(205, 133, 63, 0.3);
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.3s ease;
  color: #f0e6d2;
}

.start-btn {
  background: linear-gradient(135deg, rgba(5, 150, 105, 0.8), rgba(16, 185, 129, 0.9));
  border-color: rgba(5, 150, 105, 0.8);
  box-shadow: 0 4px 15px rgba(5, 150, 105, 0.3);
  font-weight: 700;
  font-size: 1.1rem;
  padding: 0.8rem 1.5rem;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.start-btn:hover {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.9), rgba(5, 150, 105, 1));
  box-shadow: 0 6px 20px rgba(5, 150, 105, 0.5);
  transform: translateY(-2px);
}

.pause-btn {
  background: rgba(245, 158, 11, 0.3);
  border-color: rgba(245, 158, 11, 0.5);
}

.resume-btn {
  background: rgba(59, 130, 246, 0.3);
  border-color: rgba(59, 130, 246, 0.5);
}

.reset-btn {
  background: rgba(147, 51, 234, 0.3);
  border-color: rgba(147, 51, 234, 0.5);
}

.next-turn-btn {
  background: linear-gradient(135deg, rgba(5, 150, 105, 0.8), rgba(16, 185, 129, 0.9));
  border-color: rgba(5, 150, 105, 0.8);
  box-shadow: 0 4px 15px rgba(5, 150, 105, 0.3);
  font-weight: 700;
  font-size: 1.1rem;
  padding: 0.8rem 1.5rem;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.next-turn-btn:hover {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.9), rgba(5, 150, 105, 1));
  box-shadow: 0 6px 20px rgba(5, 150, 105, 0.5);
  transform: translateY(-2px);
}

.pagination-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding: 0.5rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  border: 1px solid rgba(205, 133, 63, 0.2);
}

.pagination-btn {
  background: rgba(205, 133, 63, 0.3);
  border: 1px solid rgba(205, 133, 63, 0.5);
  color: #f0e6d2;
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.8rem;
}

.pagination-btn:hover:not(:disabled) {
  background: rgba(205, 133, 63, 0.5);
  transform: translateY(-1px);
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.turn-indicator {
  color: #ffd7a1;
  font-weight: 600;
  font-size: 0.9rem;
}

.left-pagination,
.right-pagination {
  width: 40px;
  height: 40px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  font-weight: bold;
}

.battle-start-section,
.battle-info-section,
.battle-end-section {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 1rem;
  margin-bottom: 1rem;
}

.battle-controls {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  align-items: center;
  flex-wrap: nowrap; /* 桌面端禁止换行 */
  overflow-x: auto; /* 如果按钮太多，允许水平滚动 */
  padding: 0.5rem 0;
}

@media (min-width: 769px) {
  .battle-controls {
    flex-wrap: nowrap;
    gap: 0.8rem;
    overflow-x: visible; /* 桌面端不需要滚动 */
  }

  .dialogue-btn,
  .manual-battle-btn,
  .auto-battle-btn,
  .retreat-btn {
    min-width: 120px;
    height: 48px;
    padding: 0.8rem 1.5rem;
    font-size: 1rem;
  }
}

/* 通用按钮样式 */
.dialogue-btn,
.manual-battle-btn,
.auto-battle-btn,
.retreat-btn,
.history-btn,
.summary-btn,
.harvest-btn,
.retry-btn {
  padding: 0.8rem 1.5rem;
  border-radius: 12px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 700;
  transition: all 0.3s ease;
  border: 2px solid transparent;
  white-space: nowrap;
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  min-width: 120px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.5s ease;
  }

  &:hover::before {
    left: 100%;
  }
}

.dialogue-btn {
  background: linear-gradient(135deg, #8b5cf6, #7c3aed, #6d28d9);
  border: 2px solid rgba(139, 92, 246, 0.8);
  color: #ffffff;
  box-shadow: 0 6px 20px rgba(139, 92, 246, 0.4);

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #7c3aed, #6d28d9, #5b21b6);
    transform: translateY(-3px) scale(1.02);
    box-shadow: 0 8px 25px rgba(139, 92, 246, 0.6);
    border-color: rgba(139, 92, 246, 1);
  }

  &.disabled,
  &:disabled {
    background: linear-gradient(135deg, rgba(107, 114, 128, 0.3), rgba(75, 85, 99, 0.3));
    border: 2px solid rgba(107, 114, 128, 0.4);
    color: #9ca3af;
    cursor: not-allowed;
    opacity: 0.6;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);

    &:hover {
      transform: none;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }
  }
}

.manual-battle-btn {
  background: linear-gradient(135deg, #3b82f6, #2563eb, #1d4ed8);
  border: 2px solid rgba(59, 130, 246, 0.8);
  color: #ffffff;
  flex-direction: column;
  gap: 0.2rem;
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);

  &:hover {
    background: linear-gradient(135deg, #2563eb, #1d4ed8, #1e40af);
    transform: translateY(-3px) scale(1.02);
    box-shadow: 0 8px 25px rgba(59, 130, 246, 0.6);
    border-color: rgba(59, 130, 246, 1);
  }

  .focus-target-hint {
    font-size: 0.7rem;
    color: #ffd700;
    font-weight: 600;
    text-shadow: 0 0 6px rgba(255, 215, 0, 0.8);
    background: rgba(255, 215, 0, 0.1);
    padding: 1px 4px;
    border-radius: 3px;
    border: 1px solid rgba(255, 215, 0, 0.3);
  }
}

.auto-battle-btn {
  background: linear-gradient(135deg, #059669, #047857, #065f46);
  border: 2px solid rgba(5, 150, 105, 0.8);
  color: #ffffff;
  box-shadow: 0 6px 20px rgba(5, 150, 105, 0.4);

  &:hover {
    background: linear-gradient(135deg, #047857, #065f46, #064e3b);
    transform: translateY(-3px) scale(1.02);
    box-shadow: 0 8px 25px rgba(5, 150, 105, 0.6);
    border-color: rgba(5, 150, 105, 1);
  }
}

.battle-status,
.battle-result-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.status-text,
.result-text {
  color: #ffd7a1;
  font-size: 1.1rem;
  font-weight: 600;
}

.turn-indicator-section {
  display: flex;
  justify-content: center;
  margin-bottom: 1rem;
  padding: 0.5rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  border: 1px solid rgba(205, 133, 63, 0.2);
}

.close-btn {
  background: rgba(220, 38, 38, 0.3);
  border-color: rgba(220, 38, 38, 0.5);
}

.refresh-btn {
  background: rgba(147, 51, 234, 0.3);
  border-color: rgba(147, 51, 234, 0.5);
}

.control-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

@media (max-width: 768px) {
  .advanced-battle-interface {
    --gap: 0.5rem;
    --padding: 0.5rem;
  }

  .battle-log-panel {
    height: 150px; /* 移动端固定高度 */
  }

  /* 移动端按钮容器样式 */
  .battle-controls,
  .history-button-container {
    gap: 0.3rem;
    padding: 0.3rem 0;
    flex-wrap: wrap; /* 移动端允许换行 */
    overflow-x: visible; /* 不需要滚动 */
  }

  /* 移动端按钮样式 */
  .dialogue-btn,
  .manual-battle-btn,
  .auto-battle-btn,
  .retreat-btn,
  .history-btn,
  .summary-btn,
  .harvest-btn,
  .retry-btn {
    min-width: 100px; /* 基础最小宽度 */
    height: 36px;
    padding: 0.4rem 0.8rem;
    font-size: 0.8rem;
    white-space: nowrap; /* 确保文字不换行 */
  }

  /* 移动端长文字按钮特殊处理 */
  .history-btn,
  .summary-btn {
    min-width: 120px; /* 长文字按钮需要更宽 */
  }

  .manual-battle-btn {
    min-width: 110px; /* 手动战斗按钮稍宽 */
  }

  .units-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    justify-content: center;
    align-content: center;
    justify-items: center;
    /* 移动端使用固定行高 */
    grid-auto-rows: 120px;
  }

  .unit-card {
    width: 100%;
    height: 100%; /* 填满网格单元格 */
    margin-left: 20px; /* 移动端为左侧名称留出空间 */
  }

  .unit-name-vertical-left {
    left: -10px; /* 移动端偏移，根据8px字体计算 */
    width: 16px; /* 根据8px字体调整宽度 */
    font-size: 8px;
    padding: 4px 2px;
  }

  .unit-health-bar-horizontal {
    width: clamp(50px, 12vw, 70px);
    height: 4px;
    top: 4px;
  }

  .health-text-horizontal {
    top: 4px;
    font-size: clamp(5px, 1.5vw, 7px);
    line-height: 4px;
    z-index: 4;
  }

  .unit-attributes-vertical {
    bottom: 8px;
    left: 6px;
    gap: 2px;
  }

  .attr-item {
    font-size: 8px;
    padding: 2px 4px;
    gap: 4px;
  }

  .attr-item .attr-icon {
    font-size: 8px;
    width: 8px;
  }
}

.units-panel {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(205, 133, 63, 0.2);
  border-radius: 10px;
  padding: 1rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  flex: 1; /* 平均分配剩余空间 */
  min-height: 0; /* 允许收缩 */
}

/* 当显示6个或更多部队卡时，调整高度比例 */
@media (min-width: 1200px) {
  .advanced-battle-interface {
    --unit-card-height-ratio: 12vh; /* 降低高度比例，让更多卡片能显示 */
  }
}

/* 高分辨率屏幕优化 - 保持历史记录面板高度为100px */
@media (min-width: 1920px) {
  .advanced-battle-interface {
    --gap: 1.5rem;
    --padding: 1.5rem;
    --unit-card-height-ratio: 10vh; /* 进一步降低高度比例 */
  }
}

@media (min-width: 2560px) {
  .advanced-battle-interface {
    --gap: 2rem;
    --padding: 2rem;
  }
}

@media (min-width: 3840px) {
  .advanced-battle-interface {
    --gap: 2.5rem;
    --padding: 2.5rem;
  }
}

.panel-title {
  margin: 0;
  color: #ffd7a1;
  font-size: 1rem;
  font-weight: 700;
  text-align: center;
  padding: 0.2rem 0;
}

.units-grid {
  display: grid;
  gap: 12px;
  align-content: start;
  flex: 1;
  min-height: 0;
  /* 1080P以上强制6列 */
  grid-template-columns: repeat(6, 1fr);
  grid-auto-rows: 1fr;
  height: 95%;
}

.unit-card {
  position: relative;
  background: linear-gradient(180deg, rgba(44, 24, 24, 0.8), rgba(28, 20, 17, 0.95));
  border: 3px solid rgba(205, 133, 63, 0.4);
  border-radius: 12px;
  padding: 0;
  box-shadow:
    inset 0 1px 0 rgba(255, 200, 150, 0.08),
    0 4px 12px rgba(0, 0, 0, 0.4);
  transition: all 0.3s ease;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  overflow: visible; /* 允许左侧名称显示 */
  margin-left: 30px; /* 为左侧名称留出空间 */
  /* 尺寸由JavaScript动态计算 */
}

/* 2K屏幕字体调整 */
@media (min-width: 2560px) and (max-width: 3839px) {
  .advanced-battle-interface {
    --unit-name-font-size: 20px; /* 人物名称额外增大 */
    --health-text-font-size: 16px; /* 血量文字增大 */
    --attr-font-size: 12px;
    --attr-icon-font-size: 12px;
  }

  .unit-name-vertical-left {
    width: 40px; /* 根据20px字体调整宽度 */
    left: -50px; /* 2K偏移，根据20px字体计算 */
  }
}

/* 4K屏幕字体调整 */
@media (min-width: 3840px) {
  .advanced-battle-interface {
    --unit-name-font-size: 28px; /* 人物名称额外增大 */
    --health-text-font-size: 22px; /* 血量文字增大 */
    --attr-font-size: 16px;
    --attr-icon-font-size: 16px;
  }

  .unit-name-vertical-left {
    width: 56px; /* 根据28px字体调整宽度 */
    left: -70px; /* 4K偏移，根据28px字体计算 */
  }
}

/* 1080P以下使用原有布局 */
@media (max-width: 1919px) {
  .units-grid {
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    grid-auto-rows: 180px;
  }
}

.unit-card:hover {
  transform: translateY(-2px);
  box-shadow:
    inset 0 1px 0 rgba(255, 200, 150, 0.12),
    0 6px 16px rgba(0, 0, 0, 0.4);
  border-color: rgba(205, 133, 63, 0.6);
}

.unit-card.unit-dead {
  opacity: 0.5;
  filter: grayscale(100%);
}

/* 物理单位边框 - 红色 */
.unit-card.unit-physical:not(.unit-selected) {
  border-color: rgba(220, 38, 38, 0.6) !important;
  box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.3);
}

.unit-card.unit-physical:not(.unit-selected):hover {
  border-color: rgba(220, 38, 38, 0.8) !important;
  box-shadow: 0 0 10px rgba(220, 38, 38, 0.4);
}

/* 魔法单位边框 - 蓝色 */
.unit-card.unit-magical:not(.unit-selected) {
  border-color: rgba(59, 130, 246, 0.6) !important;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
}

.unit-card.unit-magical:not(.unit-selected):hover {
  border-color: rgba(59, 130, 246, 0.8) !important;
  box-shadow: 0 0 10px rgba(59, 130, 246, 0.4);
}

/* 集火目标选中状态 - 金色边框（最高优先级） */
.unit-card.unit-selected {
  border: 3px solid #ffd700 !important;
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.8) !important;
  transform: scale(1.05) !important;
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(255, 215, 0, 0.08)) !important;
}

/* 选中状态的物理单位 - 确保金色覆盖 */
.unit-card.unit-selected.unit-physical {
  border-color: #ffd700 !important;
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.8) !important;
}

/* 选中状态的魔法单位 - 确保金色覆盖 */
.unit-card.unit-selected.unit-magical {
  border-color: #ffd700 !important;
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.8) !important;
}

/* 可选择状态 */
.unit-card.unit-selectable {
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid rgba(255, 107, 107, 0.3);

  &:hover {
    border-color: rgba(255, 107, 107, 0.6);
    box-shadow: 0 0 15px rgba(255, 107, 107, 0.4);
    transform: translateY(-2px);
    background: linear-gradient(135deg, rgba(255, 107, 107, 0.05), rgba(255, 107, 107, 0.02));
  }
}

/* 单位肖像图片区域 */
.unit-portrait {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  z-index: 2;
  border-radius: 9px; /* 比外框圆角稍小，形成内嵌效果 */
}

.unit-portrait img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top;
}

.unit-portrait .default-portrait {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(205, 133, 63, 0.3), rgba(255, 120, 60, 0.2));
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;

  &.hidden {
    display: none;
  }
}

.unit-portrait .unit-avatar-image {
  position: relative;
  z-index: 2;
}

.unit-portrait .default-portrait .portrait-icon {
  font-size: 64px;
  opacity: 0.8;
}

/* 单位名称 - 竖直显示在左侧 */
.unit-name-vertical-left {
  position: absolute;
  left: -35px; /* 1080P基础偏移，根据14px字体 */
  top: 0;
  bottom: 0;
  width: 28px; /* 根据14px字体调整宽度 */
  z-index: 3;
  color: #ffd7a1;
  font-size: var(--unit-name-font-size);
  font-weight: 700;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
  background: rgba(0, 0, 0, 0.6);
  padding: 6px 4px;
  border-radius: 4px;
  text-align: center;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 平板/小屏幕调整 */
@media (min-width: 769px) and (max-width: 1919px) {
  .unit-name-vertical-left {
    left: -10px; /* 平板偏移，根据8px字体计算 */
    width: 16px; /* 根据8px字体调整宽度 */
    font-size: var(--unit-name-font-size); /* 使用CSS变量而不是硬编码 */
    padding: 4px 2px;
  }
}

/* 强制移动端调整 - 更高优先级 */
@media (max-width: 768px) {
  .unit-name-vertical-left {
    left: -20px !important; /* 强制移动端偏移 */
    width: 18px !important; /* 强制移动端宽度 */
  }
}

/* 血量条 - 水平显示在顶部中心 */
.unit-health-bar-horizontal {
  position: absolute;
  top: 6px;
  left: 50%;
  transform: translateX(-50%);
  /* 宽度由JavaScript动态计算 */
  height: 6px;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 3px;
  overflow: hidden;
  z-index: 3;
}

@media (min-width: 769px) {
  .unit-health-bar-horizontal {
    /* 宽度由JavaScript动态计算 */
    height: 4px;
    top: 4px;
  }
}

.unit-health-bar-horizontal .health-fill-horizontal {
  height: 100%;
  background: linear-gradient(90deg, #dc2626, #b91c1c);
  border-radius: 3px;
  transition: width 0.3s ease;
  box-shadow: 0 0 4px rgba(220, 38, 38, 0.6);
}

.health-text-horizontal {
  position: absolute;
  top: 6px;
  left: 50%;
  transform: translateX(-50%);
  color: #fff;
  font-size: var(--health-text-font-size);
  text-align: center;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  z-index: 4;
  white-space: nowrap;
  line-height: 6px;
}

@media (min-width: 769px) {
  .health-text-horizontal {
    top: 4px;
    font-size: var(--health-text-font-size); /* 使用CSS变量而不是硬编码 */
    line-height: 4px;
  }
}

/* 四维属性显示 */
.unit-attributes-vertical {
  position: absolute;
  bottom: 12px;
  left: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  z-index: 3;
  align-items: flex-start;
}

@media (min-width: 769px) {
  .unit-attributes-vertical {
    bottom: 8px;
    left: 6px;
    gap: 2px;
  }
}

.attr-item {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(0, 0, 0, 0.6);
  padding: 3px 6px;
  border-radius: 3px;
  font-size: var(--attr-font-size);
}

@media (min-width: 769px) {
  .attr-item {
    font-size: var(--attr-font-size); /* 使用CSS变量而不是硬编码 */
    padding: 2px 5px;
    gap: 4px;
  }
}

.attr-item .attr-icon {
  font-size: var(--attr-icon-font-size);
  color: #f0e6d2;
  width: var(--attr-icon-font-size);
  text-align: center;
}

@media (min-width: 769px) {
  .attr-item .attr-icon {
    font-size: var(--attr-icon-font-size); /* 使用CSS变量而不是硬编码 */
    width: var(--attr-icon-font-size);
  }
}

.attr-item .attr-value {
  font-size: var(--attr-font-size);
  color: #ffd7a1;
  font-weight: 600;
}

@media (min-width: 769px) {
  .attr-item .attr-value {
    font-size: var(--attr-font-size); /* 使用CSS变量而不是硬编码 */
  }
}

.troops-modal-overlay {
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

.troops-modal {
  background: linear-gradient(180deg, rgba(40, 26, 20, 0.95), rgba(25, 17, 14, 0.98));
  border: 2px solid rgba(205, 133, 63, 0.4);
  border-radius: 16px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
  animation: modalSlideIn 0.3s ease-out;
}

.troops-modal .modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(205, 133, 63, 0.2);
}

.troops-modal .modal-header h3 {
  margin: 0;
  color: #ffd7a1;
  font-size: 20px;
  font-weight: 700;
}

.troops-modal .close-button {
  background: none;
  border: none;
  color: #9ca3af;
  font-size: 24px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.troops-modal .close-button:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.troops-modal .modal-content {
  padding: 24px;
}

.troops-modal .troops-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.troops-modal .troop-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  border-left: 3px solid rgba(205, 133, 63, 0.5);
  font-size: 16px;
}

.troops-modal .troop-name {
  color: #f0e6d2;
  font-weight: 500;
}

.troops-modal .troop-count {
  font-weight: bold;
  color: #ffd7a1;
  font-size: 18px;
}

.troops-modal .troop-item.no-troops {
  opacity: 0.6;
  font-style: italic;
  border-left-color: #9ca3af;
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

/* 奖励弹窗样式 */
.rewards-modal-overlay {
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

.rewards-modal {
  background: linear-gradient(180deg, rgba(40, 26, 20, 0.95), rgba(25, 17, 14, 0.98));
  border: 2px solid rgba(205, 133, 63, 0.4);
  border-radius: 16px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
  animation: modalSlideIn 0.3s ease-out;
}

.rewards-modal .modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(205, 133, 63, 0.2);
}

.rewards-modal .modal-header h3 {
  margin: 0;
  color: #ffd7a1;
  font-size: 20px;
  font-weight: 700;
}

.rewards-modal .close-button {
  background: none;
  border: none;
  color: #9ca3af;
  font-size: 24px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.rewards-modal .close-button:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.rewards-modal .modal-content {
  padding: 24px;
}

.rewards-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.reward-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  border-left: 3px solid rgba(205, 133, 63, 0.5);
  font-size: 16px;
}

.reward-icon {
  font-size: 20px;
  width: 24px;
  text-align: center;
}

.reward-name {
  color: #f0e6d2;
  font-weight: 500;
  flex: 1;
}

.reward-value {
  font-weight: bold;
  color: #10b981;
  font-size: 18px;
}

.hero-reward {
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.1), rgba(255, 140, 0, 0.1));
  border-left: 3px solid #ffd700;
  border-radius: 8px;
  padding: 12px;
  margin-top: 8px;
  text-align: center;
  display: flex;
  justify-content: center;
  align-items: center;
}

.hero-reward .reward-value {
  color: #ffd700;
  font-weight: bold;
  font-size: 16px;
}

/* 英雄列表样式 */
.heroes-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.hero-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: rgba(255, 215, 0, 0.1);
  border-radius: 6px;
  border: 1px solid rgba(255, 215, 0, 0.3);
  transition: all 0.2s ease;
}

.hero-item:hover {
  background: rgba(255, 215, 0, 0.15);
  border-color: rgba(255, 215, 0, 0.5);
  transform: translateY(-1px);
}

.hero-item .reward-icon {
  font-size: 18px;
  width: 20px;
  text-align: center;
}

.hero-item .reward-name {
  color: #f0e6d2;
  font-weight: 600;
  flex: 1;
  font-size: 14px;
}

.hero-item .reward-value {
  color: #ffd700;
  font-weight: bold;
  font-size: 12px;
  background: rgba(255, 215, 0, 0.2);
  padding: 2px 8px;
  border-radius: 4px;
}

/* 历史记录按钮容器 */
.history-button-container {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  width: 100%;
  order: -1; /* 确保在顶部 */
  flex-wrap: nowrap; /* 桌面端禁止换行 */
  overflow-x: auto; /* 如果按钮太多，允许水平滚动 */
  padding: 0.5rem 0;
}

@media (min-width: 769px) {
  .history-button-container {
    flex-wrap: nowrap;
    gap: 0.8rem;
    overflow-x: visible; /* 桌面端不需要滚动 */
  }
}

/* 历史记录按钮样式 */
.history-btn {
  background: linear-gradient(135deg, #6b7280, #4b5563, #374151);
  color: #ffffff;
  border: 2px solid rgba(107, 114, 128, 0.8);
  box-shadow: 0 6px 20px rgba(107, 114, 128, 0.4);

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.5s ease;
  }

  &:hover {
    background: linear-gradient(135deg, #4b5563, #374151, #1f2937);
    transform: translateY(-3px) scale(1.02);
    box-shadow: 0 8px 25px rgba(107, 114, 128, 0.6);
    border-color: rgba(107, 114, 128, 1);
  }

  &:hover::before {
    left: 100%;
  }
}

/* 战斗总结按钮样式 */
.summary-btn {
  background: linear-gradient(135deg, #7c3aed, #5b21b6, #4c1d95);
  color: #ffffff;
  border: 2px solid rgba(124, 58, 237, 0.8);
  box-shadow: 0 6px 20px rgba(124, 58, 237, 0.4);

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.5s ease;
  }

  &:hover {
    background: linear-gradient(135deg, #5b21b6, #4c1d95, #3b0764);
    transform: translateY(-3px) scale(1.02);
    box-shadow: 0 8px 25px rgba(124, 58, 237, 0.6);
    border-color: rgba(124, 58, 237, 1);
  }

  &:hover::before {
    left: 100%;
  }
}

.rewards-modal .modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
  padding: 16px 24px;
  border-top: 1px solid rgba(205, 133, 63, 0.2);
}

.rewards-modal .confirm-button {
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 600;
  font-size: 14px;
  border: none;
}

.rewards-modal .success-button {
  background: linear-gradient(180deg, #059669, #047857);
  border: 1px solid rgba(5, 150, 105, 0.6);
  color: #ffffff;
}

.rewards-modal .success-button:hover {
  background: linear-gradient(180deg, #047857, #065f46);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);
}

.battle-log-panel {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(205, 133, 63, 0.2);
  border-radius: 10px;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  height: 150px; /* 固定高度 */
  flex-shrink: 0; /* 不允许收缩 */
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
  gap: 0.5rem;
  position: relative;
  padding: 0.2rem 0;
}

.log-controls {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.log-container {
  flex: 1;
  overflow: hidden;
  padding: 0.25rem;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  min-height: 100%;
}

.action-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  justify-content: flex-start;
  padding: 0.25rem 0;
}

.action-messages {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 0.25rem;
}

.pagination-controls-horizontal {
  display: flex;
  flex-direction: row;
  gap: 0.25rem;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.left-pagination,
.right-pagination {
  width: 32px;
  height: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  font-weight: bold;
  background: linear-gradient(135deg, rgba(205, 133, 63, 0.6), rgba(180, 100, 50, 0.6));
  border: 2px solid rgba(205, 133, 63, 0.8);
  color: #f0e6d2;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(205, 133, 63, 0.3);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.5s ease;
  }

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, rgba(205, 133, 63, 0.8), rgba(180, 100, 50, 0.8));
    transform: translateY(-2px) scale(1.05);
    box-shadow: 0 6px 16px rgba(205, 133, 63, 0.5);
    border-color: rgba(205, 133, 63, 1);
  }

  &:hover:not(:disabled)::before {
    left: 100%;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    background: linear-gradient(135deg, rgba(107, 114, 128, 0.3), rgba(75, 85, 99, 0.3));
    border-color: rgba(107, 114, 128, 0.4);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }
}

.turn-header {
  margin-bottom: 0.5rem;
}

.turn-number {
  font-weight: bold;
  color: #ffd7a1;
  font-size: 1.1rem;
}

.turn-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.action-item {
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  border-left: 3px solid rgba(205, 133, 63, 0.3);
  transition: all 0.2s ease;

  &:hover {
    background: rgba(0, 0, 0, 0.3);
    border-left-color: rgba(205, 133, 63, 0.5);
  }

  &.ally-action {
    border-left-color: #22c55e;
    background: rgba(34, 197, 94, 0.1);
  }

  &.enemy-action {
    border-left-color: #dc2626;
    background: rgba(220, 38, 38, 0.1);
  }
}

.action-normal {
  border-left: 3px solid rgba(205, 133, 63, 0.5);
}

.action-critical {
  border-left: 3px solid rgba(220, 38, 38, 0.5);
  background: rgba(220, 38, 38, 0.1);
}

.action-miss {
  border-left: 3px solid rgba(107, 114, 128, 0.5);
  opacity: 0.7;
}

.action-description {
  font-size: 0.9rem;
  margin-bottom: 0.25rem;
}

.action-damage {
  font-size: 0.8rem;
  color: #ef4444;
  font-weight: bold;
}

.critical-mark {
  color: #f59e0b;
  margin-left: 0.25rem;
}

.empty-log {
  text-align: center;
  color: #9ca3af;
  font-style: italic;
  padding: 2rem;
}

.battle-result {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.result-content {
  background: linear-gradient(180deg, rgba(40, 26, 20, 0.95), rgba(25, 17, 14, 0.98));
  padding: 2rem;
  border-radius: 15px;
  text-align: center;
  border: 2px solid rgba(205, 133, 63, 0.4);
  max-width: 500px;
  width: 90%;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
}

.result-title {
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 1rem;
}

.result-title.victory {
  color: #10b981;
}

.result-title.defeat {
  color: #ef4444;
}

/* 收获按钮样式 */
.harvest-btn {
  background: linear-gradient(135deg, #059669, #047857, #065f46);
  border: 2px solid rgba(5, 150, 105, 0.8);
  color: #ffffff;
  box-shadow: 0 6px 20px rgba(5, 150, 105, 0.4);

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.5s ease;
  }

  &:hover {
    background: linear-gradient(135deg, #047857, #065f46, #064e3b);
    transform: translateY(-3px) scale(1.02);
    box-shadow: 0 8px 25px rgba(5, 150, 105, 0.6);
    border-color: rgba(5, 150, 105, 1);
  }

  &:hover::before {
    left: 100%;
  }
}

.retreat-btn {
  background: linear-gradient(135deg, rgba(107, 114, 128, 0.4), rgba(75, 85, 99, 0.4));
  border: 2px solid rgba(107, 114, 128, 0.6);
  color: #d1d5db;
  box-shadow: 0 4px 15px rgba(107, 114, 128, 0.3);

  &:hover {
    background: linear-gradient(135deg, rgba(107, 114, 128, 0.6), rgba(75, 85, 99, 0.6));
    transform: translateY(-2px) scale(1.01);
    box-shadow: 0 6px 20px rgba(107, 114, 128, 0.4);
    border-color: rgba(107, 114, 128, 0.8);
    color: #f3f4f6;
  }
}

.retry-btn {
  background: linear-gradient(135deg, #3b82f6, #2563eb, #1d4ed8);
  border: 2px solid rgba(59, 130, 246, 0.8);
  color: #ffffff;
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);

  &:hover {
    background: linear-gradient(135deg, #2563eb, #1d4ed8, #1e40af);
    transform: translateY(-3px) scale(1.02);
    box-shadow: 0 8px 25px rgba(59, 130, 246, 0.6);
    border-color: rgba(59, 130, 246, 1);
  }
}

.result-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-top: 1rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
}

.stat-label {
  font-size: 0.9rem;
  color: #ccc;
  margin-bottom: 0.25rem;
}

.stat-value {
  font-size: 1.2rem;
  font-weight: bold;
  color: #4a90e2;
}

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: #4a90e2;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #357abd;
}

/* 历史记录弹窗样式 */
.history-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;

  .modal-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
  }

  .modal-content {
    position: relative;
    background: linear-gradient(180deg, rgba(40, 26, 20, 0.95), rgba(25, 17, 14, 0.98));
    border: 2px solid rgba(205, 133, 63, 0.5);
    border-radius: 16px;
    padding: 24px;
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);

    @media (max-width: 768px) {
      width: 95%;
      padding: 16px;
      max-height: 90vh;
      border-radius: 12px;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(205, 133, 63, 0.3);

      .modal-title {
        color: #ffd7a1;
        margin: 0;
        font-size: 20px;
        font-weight: 700;
      }

      .close-btn {
        background: none;
        border: none;
        color: #f0e6d2;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: all 0.2s ease;

        &:hover {
          background: rgba(255, 255, 255, 0.1);
          transform: scale(1.1);
        }
      }
    }

    .history-content {
      .no-history {
        text-align: center;
        padding: 40px 20px;
        color: #9ca3af;

        .no-history-icon {
          font-size: 48px;
          margin-bottom: 16px;
          opacity: 0.6;
        }

        .no-history-text {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 8px;
          color: #f0e6d2;
        }

        .no-history-hint {
          font-size: 14px;
          opacity: 0.8;
        }
      }

      .history-list {
        .history-item {
          background: linear-gradient(180deg, rgba(44, 30, 24, 0.8), rgba(28, 20, 17, 0.9));
          border: 1px solid rgba(205, 133, 63, 0.2);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 12px;
          transition: all 0.3s ease;

          &:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
            border-color: rgba(205, 133, 63, 0.4);
          }

          &:last-child {
            margin-bottom: 0;
          }

          .history-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;

            .history-turn {
              color: #ffd7a1;
              font-size: 16px;
              font-weight: 700;
            }

            .history-status {
              font-size: 12px;
              padding: 4px 8px;
              border-radius: 4px;
              font-weight: 600;

              &.finished {
                background: rgba(34, 197, 94, 0.2);
                color: #22c55e;
                border: 1px solid rgba(34, 197, 94, 0.3);
              }

              &.ongoing {
                background: rgba(59, 130, 246, 0.2);
                color: #3b82f6;
                border: 1px solid rgba(59, 130, 246, 0.3);
              }
            }
          }

          .history-actions {
            display: flex;
            flex-direction: column;
            gap: 8px;

            .history-action {
              padding: 8px 12px;
              background: rgba(0, 0, 0, 0.3);
              border-radius: 6px;
              border-left: 3px solid transparent;
              transition: all 0.2s ease;

              &.ally-action {
                border-left-color: #22c55e;
                background: rgba(34, 197, 94, 0.25);
                border: 1px solid rgba(34, 197, 94, 0.3);
              }

              &.enemy-action {
                border-left-color: #dc2626;
                background: rgba(220, 38, 38, 0.25);
                border: 1px solid rgba(220, 38, 38, 0.3);
              }

              .action-description {
                color: #f0e6d2;
                font-size: 14px;
                line-height: 1.4;

                .action-damage {
                  color: #ffd700;
                  font-weight: 600;
                  margin-left: 8px;

                  .critical-mark {
                    color: #ff6b6b;
                    font-weight: bold;
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
</style>
