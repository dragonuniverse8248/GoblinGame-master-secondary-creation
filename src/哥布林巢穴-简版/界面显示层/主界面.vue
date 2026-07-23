<template>
  <div class="main-interface">
    <div class="decorative-border">
      <div class="content-wrapper">
        <header class="header">
          <div class="header-center">
            <h1 class="main-title">哥布林巢穴</h1>
          </div>
        </header>

        <!-- 统计信息 -->
        <section class="stats-container">
          <!-- 时间和季节信息 -->
          <div class="stats-row">
            <div class="stats-card time-info">
              <div class="time-content">
                <div class="date">{{ currentTime }}</div>
                <div class="season">🍂 {{ currentSeason }}</div>
              </div>
            </div>
          </div>

          <!-- 回合数和威胁度并列一行 -->
          <div class="stats-row">
            <div class="stats-card">
              <div class="stat-item">
                <span class="icon">🔄</span>
                <div class="value">第{{ roundCount }}回合</div>
              </div>
            </div>
            <div class="stats-card">
              <div class="stat-item">
                <span class="icon">⚠️</span>
                <div class="value">威胁度 {{ ResourceFormatService.formatNumber(threat) }}</div>
              </div>
            </div>
          </div>

          <!-- 行动力显示 -->
          <div class="action-points-row">
            <div class="action-points-card">
              <div class="action-points-display">
                <span
                  v-for="i in maxActionPoints"
                  :key="i"
                  class="action-point"
                  :class="{ filled: i <= currentActionPoints }"
                >
                  {{ i <= currentActionPoints ? '❤️' : '🤍' }}
                </span>
              </div>
            </div>
          </div>

          <!-- 所有资源 - 八个并列 -->
          <div class="resources-grid eight-columns">
            <div class="resource-item">
              <div class="resource-icon">💰</div>
              <div class="resource-value">{{ ResourceFormatService.formatNumber(gold) }}</div>
            </div>
            <div class="resource-item">
              <div class="resource-icon">🍖</div>
              <div class="resource-value">{{ ResourceFormatService.formatNumber(food) }}</div>
            </div>
            <div class="resource-item">
              <div class="resource-icon">🔒</div>
              <div class="resource-value">{{ ResourceFormatService.formatNumber(slaves) }}</div>
            </div>
            <div class="resource-item">
              <div class="resource-icon">💋</div>
              <div class="resource-value">{{ ResourceFormatService.formatNumber(trainingCharactersCount) }}</div>
            </div>
            <div class="resource-item">
              <div class="resource-icon">👺</div>
              <div class="resource-value">{{ ResourceFormatService.formatNumber(normalGoblins) }}</div>
            </div>
            <div class="resource-item">
              <div class="resource-icon">⚔️</div>
              <div class="resource-value">{{ ResourceFormatService.formatNumber(warriorGoblins) }}</div>
            </div>
            <div class="resource-item">
              <div class="resource-icon">🔮</div>
              <div class="resource-value">{{ ResourceFormatService.formatNumber(shamanGoblins) }}</div>
            </div>
            <div class="resource-item">
              <div class="resource-icon">✨</div>
              <div class="resource-value">{{ ResourceFormatService.formatNumber(paladinGoblins) }}</div>
            </div>
          </div>
        </section>

        <!-- 操作按钮区域 -->
        <div class="action-buttons">
          <button class="action-btn save-load-btn" title="存档管理" @click="openSaveLoadModal">
            <span class="icon">💾</span>
            <span class="text">存档管理</span>
          </button>
          <button
            class="action-btn story-summary-btn"
            :class="{ 'needs-summary': needsSummary }"
            :title="needsSummary ? '⚠️ 建议总结剧情（部分条目超过5万tokens）' : '剧情总结'"
            @click="openStorySummaryModal"
          >
            <span class="icon">📚</span>
            <span class="text">剧情总结</span>
          </button>
          <button class="action-btn round-btn" title="结束回合" @click="() => endRound()">
            <span class="icon">⏭️</span>
            <span class="text">结束回合</span>
          </button>
        </div>

        <!-- 信息显示区域 -->
        <div class="info-display">
          <div class="info-header">
            <span class="info-title">回合信息</span>
            <button class="history-btn" title="查看历史日志" @click="openHistoryModal">
              <span class="icon">📜</span>
            </button>
          </div>
          <div class="info-content">
            <div v-if="latestRoundInfo" class="round-summary">
              <div class="round-title">{{ latestRoundInfo.title }}</div>
              <div class="resource-changes">
                <div
                  v-for="change in latestRoundInfo.changes"
                  :key="change.type"
                  class="resource-change"
                  :class="change.amount > 0 ? 'positive' : 'negative'"
                >
                  <span class="resource-icon">{{ ResourceFormatService.getResourceIcon(change.type) }}</span>
                  <span class="resource-name">{{ ResourceFormatService.getResourceName(change.type) }}</span>
                  <span class="change-amount" :class="change.amount > 0 ? 'positive' : 'negative'"
                    >{{ change.amount > 0 ? '+' : change.amount < 0 ? '-' : ''
                    }}{{ ResourceFormatService.formatNumber(Math.abs(change.amount)) }}</span
                  >
                </div>
              </div>
            </div>
            <div v-else class="no-round-info">
              <div class="no-info-text">暂无回合信息</div>
              <div class="no-info-hint">点击"结束回合"开始游戏</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 存档管理界面 -->
    <SaveLoadModal
      :show="showSaveLoadModal"
      :current-resources="{
        gold: modularSaveManager.resources.value.gold,
        food: modularSaveManager.resources.value.food,
        threat: modularSaveManager.resources.value.threat,
        slaves: modularSaveManager.resources.value.slaves,
        normalGoblins: modularSaveManager.resources.value.normalGoblins,
        warriorGoblins: modularSaveManager.resources.value.warriorGoblins,
        shamanGoblins: modularSaveManager.resources.value.shamanGoblins,
        paladinGoblins: modularSaveManager.resources.value.paladinGoblins,
        trainingSlaves: modularSaveManager.resources.value.trainingSlaves,
        rounds: modularSaveManager.resources.value.rounds,
        actionPoints: modularSaveManager.resources.value.actionPoints,
        maxActionPoints: modularSaveManager.resources.value.maxActionPoints,
        conqueredRegions: modularSaveManager.resources.value.conqueredRegions,
      }"
      :current-game-state="gameState"
      :latest-round-info="latestRoundInfo"
      @close="handleCloseSaveModal"
      @save="handleSave"
      @load="handleLoad"
      @error="handleSaveError"
    />

    <!-- 历史记录弹窗 -->
    <HistoryModal ref="historyModalRef" :show="showHistoryModal" @close="closeHistoryModal" />

    <!-- 剧情总结界面 -->
    <StorySummaryModal :show="showStorySummaryModal" @close="closeStorySummaryModal" />

    <!-- 事件提示弹窗 -->
    <EventNotificationDialog
      :show="showEventNotification"
      :event="pendingEvent"
      @close="closeEventNotification"
      @listen-report="handleListenReport"
      @write-report="handleWriteReport"
      @ignore="handleIgnore"
    />

    <!-- 事件对话界面（直接在主界面显示，跳过谒见厅） -->
    <EventDialogueInterface
      v-if="showEventDialog && currentViewingEvent"
      :event="currentViewingEvent"
      :show="showEventDialog"
      @close="closeEventDialog"
      @event-completed="handleEventCompleted"
    />
  </div>
</template>

<script setup lang="ts">
// ============================================================================
// 导入部分
// ============================================================================

// Vue 核心
import { computed, ref } from 'vue';

// 功能模块层服务
import { AudienceHallService } from '../功能模块层/巢穴/服务/谒见厅服务';
import { continentExploreService } from '../功能模块层/探索/服务/大陆探索服务';
import type { RandomEvent } from '../功能模块层/随机事件/类型/事件类型';

// 核心层服务
import { WorldbookService } from '../核心层/服务/世界书管理/服务/世界书服务';
import { modularSaveManager } from '../核心层/服务/存档系统/模块化存档服务';
import { SummaryCheckService } from '../核心层/服务/通用服务/总结检查服务';
import { TimeParseService } from '../核心层/服务/通用服务/时间解析服务';
import { PlayerLevelService } from '../核心层/服务/通用服务/玩家等级服务';
import { BreedingService } from '../核心层/服务/通用服务/生育服务';
import { ConfirmService } from '../核心层/服务/通用服务/确认框服务';
import { ResourceFormatService } from '../核心层/服务/通用服务/资源格式化服务';

// 主界面子页面组件
import EventNotificationDialog from '../共享资源层/组件/事件提示弹窗.vue';
import EventDialogueInterface from '../功能模块层/随机事件/视图/事件对话界面.vue';
import StorySummaryModal from './主界面子页面/剧情总结界面.vue';
import HistoryModal from './主界面子页面/历史记录界面.vue';
import SaveLoadModal from './主界面子页面/存档界面.vue';

// ============================================================================
// 响应式数据
// ============================================================================

// 基础资源数据（计算属性）
const resources = computed(() => modularSaveManager.resources.value);

// UI 状态管理
const gameState = ref<any>(null);
const showSaveLoadModal = ref(false);
const showHistoryModal = ref(false);
const showStorySummaryModal = ref(false);
const needsSummary = ref(false);
const latestRoundInfo = ref<any>(null);

// 事件相关状态
const showEventNotification = ref(false);
const pendingEvent = ref<RandomEvent | null>(null);
const audienceHallService = AudienceHallService.getInstance();

// 事件对话界面相关（主界面直接显示，跳过谒见厅）
const showEventDialog = ref(false);
const currentViewingEvent = ref<RandomEvent | null>(null);

// 组件引用
const historyModalRef = ref<any>(null);

// ============================================================================
// 计算属性 - 资源显示
// ============================================================================

// 基础资源
const gold = computed(() => resources.value.gold);
const food = computed(() => resources.value.food);
const threat = computed(() => resources.value.threat);
const slaves = computed(() => resources.value.slaves);

// 哥布林数量
const normalGoblins = computed(() => resources.value.normalGoblins);
const warriorGoblins = computed(() => resources.value.warriorGoblins);
const shamanGoblins = computed(() => resources.value.shamanGoblins);
const paladinGoblins = computed(() => resources.value.paladinGoblins);

// 调教人物总数量
const trainingCharactersCount = computed(() => resources.value.trainingSlaves);

// 行动力系统
const maxActionPoints = computed(() => resources.value.maxActionPoints);
const currentActionPoints = computed(() => resources.value.actionPoints);

// ============================================================================
// 计算属性 - 时间信息
// ============================================================================

const roundCount = computed(() => modularSaveManager.resources.value.rounds);

const currentTime = computed(() => {
  const rounds = modularSaveManager.resources.value.rounds || 0;
  const timeInfo = TimeParseService.getTimeInfo(rounds, false);
  return timeInfo.formattedDate;
});

const currentSeason = computed(() => {
  const rounds = modularSaveManager.resources.value.rounds || 0;
  const timeInfo = TimeParseService.getTimeInfo(rounds, true);
  return timeInfo.season || '春季';
});

// ============================================================================
// 计算属性 - 游戏状态
// ============================================================================

// 随机事件已转移到谒见厅处理

// ============================================================================
// UI 工具函数
// ============================================================================

/**
 * 触发日期更新动画
 */
const triggerDateUpdateAnimation = () => {
  const timeElement = document.querySelector('.time-content');
  if (timeElement) {
    timeElement.classList.add('date-updated');
    setTimeout(() => {
      timeElement.classList.remove('date-updated');
    }, 1000);
  }
};

// ============================================================================
// 存档管理相关函数
// ============================================================================

/**
 * 保存游戏状态到模块化系统
 */
const saveCurrentGameState = () => {
  try {
    let currentGameData = modularSaveManager.getCurrentGameData();
    if (!currentGameData) {
      modularSaveManager.createNewGame();
      currentGameData = modularSaveManager.getCurrentGameData();
    }

    modularSaveManager.updateBaseResources({
      gold: modularSaveManager.resources.value.gold,
      food: modularSaveManager.resources.value.food,
      threat: modularSaveManager.resources.value.threat,
      slaves: modularSaveManager.resources.value.slaves,
      normalGoblins: modularSaveManager.resources.value.normalGoblins,
      warriorGoblins: modularSaveManager.resources.value.warriorGoblins,
      shamanGoblins: modularSaveManager.resources.value.shamanGoblins,
      paladinGoblins: modularSaveManager.resources.value.paladinGoblins,
      trainingSlaves: modularSaveManager.resources.value.trainingSlaves,
      rounds: modularSaveManager.resources.value.rounds,
      actionPoints: modularSaveManager.resources.value.actionPoints,
      maxActionPoints: modularSaveManager.resources.value.maxActionPoints,
      conqueredRegions: modularSaveManager.resources.value.conqueredRegions,
    });

    console.log('游戏状态已保存到模块化系统');
  } catch (error) {
    console.error('保存游戏状态失败:', error);
  }
};

/**
 * 恢复基础资源
 */
const restoreBaseResources = (baseResources: any) => {
  if (baseResources) {
    modularSaveManager.setResource('gold', baseResources.gold);
    modularSaveManager.setResource('food', baseResources.food);
    modularSaveManager.setResource('threat', baseResources.threat);
    modularSaveManager.setResource('slaves', baseResources.slaves);
    modularSaveManager.setResource('normalGoblins', baseResources.normalGoblins);
    modularSaveManager.setResource('warriorGoblins', baseResources.warriorGoblins);
    modularSaveManager.setResource('shamanGoblins', baseResources.shamanGoblins);
    modularSaveManager.setResource('paladinGoblins', baseResources.paladinGoblins);
    modularSaveManager.setResource('trainingSlaves', baseResources.trainingSlaves);
    modularSaveManager.setResource('rounds', baseResources.rounds);
    const targetActionPoints = baseResources.actionPoints ?? 3;
    const targetMaxActionPoints = baseResources.maxActionPoints ?? 3;
    modularSaveManager.setResource('actionPoints', targetActionPoints);
    modularSaveManager.setResource('maxActionPoints', targetMaxActionPoints);
    modularSaveManager.setResource('conqueredRegions', baseResources.conqueredRegions ?? 0);

    console.log('基础资源已恢复');
  }
};

/**
 * 打开存档管理界面
 */
const openSaveLoadModal = () => {
  showSaveLoadModal.value = true;
};

/**
 * 处理存档保存
 */
const handleSave = async (slot: number) => {
  try {
    console.log(`保存到槽位 ${slot}`);

    let currentGameData = modularSaveManager.getCurrentGameData();
    if (!currentGameData) {
      modularSaveManager.createNewGame();
      modularSaveManager.syncReactiveToResources();
      currentGameData = modularSaveManager.getCurrentGameData();
    } else {
      modularSaveManager.syncReactiveToResources();
    }

    saveCurrentGameState();

    const success = await modularSaveManager.saveCurrentGameData(slot, `存档 ${slot}`);
    if (success) {
      console.log(`游戏已保存到槽位 ${slot}`);
    } else {
      console.error(`保存到槽位 ${slot} 失败`);
    }
  } catch (error) {
    console.error('保存游戏失败:', error);
  }
};

/**
 * 处理存档读取
 */
const handleLoad = async (slot: number, data: any) => {
  try {
    console.log(`从槽位 ${slot} 读取:`, data);

    const gameData = await modularSaveManager.loadFromSlot({ slot });
    if (gameData) {
      restoreBaseResources(gameData.baseResources);

      // 恢复探索数据
      const explorationData = gameData.exploration;
      if (explorationData) {
        const { exploreService } = await import('../功能模块层/探索/服务/探索服务');
        await exploreService.restoreFromSaveData(explorationData);
        console.log('探索数据已恢复');
      }

      // 恢复历史记录
      const historyData = modularSaveManager.getModuleData({ moduleName: 'history' }) as any;
      if (historyData && historyData.roundHistory && historyData.roundHistory.length > 0) {
        const lastRoundInfo = historyData.roundHistory[0];
        latestRoundInfo.value = lastRoundInfo;
        console.log('最后一个回合信息已恢复:', lastRoundInfo);
      } else {
        latestRoundInfo.value = null;
        console.log('没有历史记录，清空回合信息显示');
      }

      // 初始化大陆探索服务
      const { continentExploreService } = await import('../功能模块层/探索/服务/大陆探索服务');
      await continentExploreService.initializeFromSave();

      setTimeout(() => {
        continentExploreService.recalculateAllRegionProgress();
      }, 300);

      console.log(`游戏已从槽位 ${slot} 加载`);
    }

    showSaveLoadModal.value = false;
  } catch (error) {
    console.error('加载游戏失败:', error);
  }
};

/**
 * 处理存档错误
 */
const handleSaveError = async (error: string) => {
  console.error('存档错误:', error);
  await ConfirmService.showDanger(error, '存档错误', '请检查存档文件是否损坏或权限是否足够');
};

/**
 * 关闭存档界面
 */
const handleCloseSaveModal = () => {
  showSaveLoadModal.value = false;
};

// ============================================================================
// 弹窗控制函数
// ============================================================================

/**
 * 打开历史记录弹窗
 */
const openHistoryModal = () => {
  showHistoryModal.value = true;
};

/**
 * 关闭历史记录弹窗
 */
const closeHistoryModal = () => {
  showHistoryModal.value = false;
};

/**
 * 打开剧情总结界面
 */
const openStorySummaryModal = () => {
  showStorySummaryModal.value = true;
};

/**
 * 关闭剧情总结界面
 */
const closeStorySummaryModal = () => {
  showStorySummaryModal.value = false;
};

// ============================================================================
// 随机事件处理函数
// ============================================================================

/**
 * 关闭事件提示弹窗
 */
const closeEventNotification = () => {
  showEventNotification.value = false;
  pendingEvent.value = null;
};

/**
 * 处理"听取汇报"按钮（直接在主界面打开事件对话框，跳过谒见厅）
 */
const handleListenReport = (event: RandomEvent) => {
  // 直接在主界面打开事件对话框
  currentViewingEvent.value = event;
  showEventDialog.value = true;
  // 关闭事件提示弹窗
  closeEventNotification();
};

/**
 * 处理"撰写报告"按钮（改为保存待处理事件）
 */
const handleWriteReport = (event: RandomEvent) => {
  try {
    // 添加待处理事件，不跳转，后续在谒见厅中查看
    audienceHallService.addPendingEvent(event);
    console.log('待处理事件已添加:', event.name);
  } catch (error) {
    console.error('添加待处理事件失败:', error);
  }
};

/**
 * 处理"忽略事件"按钮
 */
const handleIgnore = (event: RandomEvent) => {
  // 忽略事件，不做任何处理，只是关闭弹窗
  console.log('事件已忽略:', event.name);
};

/**
 * 关闭事件对话框
 */
const closeEventDialog = () => {
  showEventDialog.value = false;
  currentViewingEvent.value = null;
};

/**
 * 处理事件完成
 */
const handleEventCompleted = (event: RandomEvent, _result: any) => {
  // 从待处理列表中移除该事件（如果存在）
  try {
    audienceHallService.removePendingEvent(event.id);
    console.log('事件已处理完成并从待处理列表中移除');
  } catch (error) {
    console.error('移除待处理事件失败:', error);
  }
  closeEventDialog();
};

// ============================================================================
// 同步相关函数
// ============================================================================

/**
 * 同步繁殖间占用信息到巢穴模块
 */
const syncBreedingRoomInfo = () => {
  try {
    const breedingRoomInfo: any[] = [];

    const trainingData = modularSaveManager.getModuleData({ moduleName: 'training' }) as any;
    if (trainingData && trainingData.characters) {
      trainingData.characters.forEach((char: any) => {
        if (char.locationId && char.locationId.startsWith('breeding-')) {
          breedingRoomInfo.push({
            roomId: char.locationId,
            characterId: char.id,
            characterName: char.name,
            status: char.status === 'breeding' ? 'breeding' : 'imprisoned',
            occupiedAt: new Date(),
          });
        }
      });
    }

    const currentNestData = modularSaveManager.getModuleData({ moduleName: 'nest' }) as any;

    modularSaveManager.updateModuleData({
      moduleName: 'nest',
      data: {
        ...currentNestData,
        breedingRoomInfo: breedingRoomInfo,
      },
    });

    console.log('繁殖间占用信息已同步到巢穴模块:', breedingRoomInfo);
  } catch (error) {
    console.error('同步繁殖间信息失败:', error);
  }
};

// ============================================================================
// 回合逻辑相关函数
// ============================================================================

/**
 * 处理人物回合逻辑
 */
const processCharacterTurn = () => {
  try {
    // 获取调教数据
    const trainingData = modularSaveManager.getModuleData({ moduleName: 'training' }) as any;
    if (!trainingData || !trainingData.characters) return [];

    const characters = trainingData.characters;
    let hasChanges = false;
    const breedingResults: any[] = [];

    // 处理每个角色的回合逻辑
    characters.forEach((character: any) => {
      if (character.status === 'imprisoned' || character.status === 'surrendered' || character.status === 'deployed') {
        const rarityMultiplier = ResourceFormatService.getRarityMultiplier(character.rating || 'D');
        const loyaltyBonus = Math.floor(character.loyalty / 20);
        const staminaGain = 10 * rarityMultiplier + loyaltyBonus;
        const fertilityGain = 10 * rarityMultiplier + loyaltyBonus;

        const maxStamina = character.maxStamina || 200;
        const maxFertility = character.maxFertility || 200;
        character.stamina = Math.min(maxStamina, character.stamina + staminaGain);
        character.fertility = Math.min(maxFertility, character.fertility + fertilityGain);
        hasChanges = true;
      } else if (character.status === 'training') {
        character.loyalty = Math.min(100, character.loyalty + Math.floor(Math.random() * 10) + 5);

        if (character.loyalty >= 100) {
          console.log(`${character.name} 调教完成，堕落值已满，可以手动触发堕落！`);
          character.status = 'imprisoned';
        } else {
          character.status = 'imprisoned';
          console.log(`${character.name} 调教完成，忠诚度提升`);
        }

        hasChanges = true;
      } else if (character.status === 'breeding') {
        const currentRound = modularSaveManager.resources.value.rounds || 1;
        const breedingResult = BreedingService.calculateBreeding(character, currentRound);

        const originalStatus = character.originalStatus || 'imprisoned';

        character.offspring += breedingResult.totalOffspring;

        const baseLevelFromOffspring = Math.floor((character.offspring - breedingResult.totalOffspring) / 10);
        const currentLevel = character.level ?? baseLevelFromOffspring ?? 1;
        const levelGainFromBreeding = Math.floor(breedingResult.totalOffspring / 10);
        character.level = currentLevel + levelGainFromBreeding;

        const getRatingFertilityMultiplier = (rating: string) => {
          switch (rating) {
            case 'S':
              return 0.5;
            case 'A':
              return 0.7;
            case 'B':
              return 0.8;
            case 'C':
              return 0.9;
            case 'D':
              return 1.0;
            default:
              return 1.0;
          }
        };

        const ratingMultiplier = getRatingFertilityMultiplier(character.rating || 'D');
        const surrenderedMultiplier = originalStatus === 'surrendered' ? 0.5 : 1.0;

        const baseFertilityLoss = breedingResult.totalOffspring * 3 * ratingMultiplier;
        const fertilityLoss = Math.ceil(baseFertilityLoss * surrenderedMultiplier);
        character.fertility = Math.max(0, character.fertility - fertilityLoss);

        const corruptionGain = Math.floor(Math.random() * 3) + 1;
        character.loyalty = Math.min(100, character.loyalty + corruptionGain);

        character.status = originalStatus;
        character.locationId = undefined;

        if (!character.breedingRecords) {
          character.breedingRecords = [];
        }
        character.breedingRecords.push(...breedingResult.records);

        PlayerLevelService.checkAndUpdatePlayerLevel();
        eventEmit('人物等级更新');

        breedingResult.records.forEach((record: { type: string; count: number }) => {
          const resourceType = ResourceFormatService.mapGoblinTypeToResource(
            record.type,
          ) as keyof typeof modularSaveManager.resources.value;
          const resourceName = ResourceFormatService.getResourceName(resourceType);
          modularSaveManager.addResource(
            resourceType,
            record.count,
            `${character.name} 生育了 ${record.count} 个${resourceName}`,
          );
        });

        breedingResults.push({
          characterName: character.name,
          totalOffspring: breedingResult.totalOffspring,
          records: breedingResult.records,
          rating: character.rating || 'D',
        });

        hasChanges = true;
      }
    });

    // 如果有变化，更新数据
    if (hasChanges) {
      modularSaveManager.updateModuleData({
        moduleName: 'training',
        data: trainingData,
      });
      console.log('人物回合逻辑处理完成');
    }

    return breedingResults;
  } catch (error) {
    console.error('处理人物回合逻辑失败:', error);
    return [];
  }
};

/**
 * 结束回合
 */
const endRound = async () => {
  try {
    console.log('开始处理回合结束...');

    // 处理巢穴收入
    const nestResult = modularSaveManager.processNestIncome();
    console.log('巢穴收入处理结果:', nestResult);

    // 处理人物回合逻辑，获取生育结果
    const breedingResults = processCharacterTurn();

    // 处理奴隶生育逻辑
    const currentSlaves = modularSaveManager.resources.value.slaves || 0;
    const currentRound = modularSaveManager.resources.value.rounds || 0;
    const slaveBreedingResult = BreedingService.processSlaveBreeding(currentSlaves, currentRound);

    console.log('奴隶生育结果:', slaveBreedingResult);

    // 更新奴隶数量（减去死亡数量）
    if (slaveBreedingResult.deadSlaves > 0) {
      modularSaveManager.consumeResource('slaves', slaveBreedingResult.deadSlaves, '奴隶死亡');
    }

    // 添加新生育的普通哥布林
    if (slaveBreedingResult.newGoblins > 0) {
      modularSaveManager.addResource('normalGoblins', slaveBreedingResult.newGoblins, '奴隶生育');
    }

    // 增加回合数
    modularSaveManager.addResource('rounds', 1, '回合结束');

    // 恢复行动力到上限
    const currentMaxActionPoints = modularSaveManager.resources.value.maxActionPoints;
    modularSaveManager.setResource('actionPoints', currentMaxActionPoints);
    console.log(`行动力已恢复到上限: ${currentMaxActionPoints}`);

    // 触发日期更新动画
    triggerDateUpdateAnimation();

    // 聚合资源变化
    const aggregatedChanges = aggregateResourceChanges(nestResult.changes);

    // 添加奴隶死亡到资源变化中
    if (slaveBreedingResult.deadSlaves > 0) {
      aggregatedChanges.push({
        type: 'slaves',
        amount: -slaveBreedingResult.deadSlaves,
        reason: '奴隶死亡',
      });
    }

    // 添加生育信息到资源变化中
    if (breedingResults && breedingResults.length > 0) {
      const ratingOrder: Record<string, number> = { S: 5, A: 4, B: 3, C: 2, D: 1 };
      breedingResults.sort((a, b) => (ratingOrder[b.rating] || 0) - (ratingOrder[a.rating] || 0));

      const topBreedingResults = breedingResults.slice(0, 2);

      const breedingSummary: Record<string, number> = {};
      topBreedingResults.forEach(result => {
        result.records.forEach((record: any) => {
          const resourceType = ResourceFormatService.mapGoblinTypeToResource(record.type);
          breedingSummary[resourceType] = (breedingSummary[resourceType] || 0) + record.count;
        });
      });

      if (slaveBreedingResult.newGoblins > 0) {
        breedingSummary['normalGoblins'] = (breedingSummary['normalGoblins'] || 0) + slaveBreedingResult.newGoblins;
      }

      Object.entries(breedingSummary).forEach(([type, amount]) => {
        aggregatedChanges.push({
          type: type,
          amount: amount,
        });
      });
    } else if (slaveBreedingResult.newGoblins > 0) {
      aggregatedChanges.push({
        type: 'normalGoblins',
        amount: slaveBreedingResult.newGoblins,
        reason: '奴隶生育',
      });
    }

    // 创建回合标题
    let roundTitle = `第${modularSaveManager.resources.value.rounds - 1}回合结束`;
    const titleParts: string[] = [];

    if (breedingResults && breedingResults.length > 0) {
      const topBreedingResults = breedingResults.slice(0, 2);
      const breedingNames = topBreedingResults.map(result => result.characterName).join('、');
      titleParts.push(`${breedingNames} 生育了哥布林`);
    } else if (slaveBreedingResult.newGoblins > 0) {
      titleParts.push(`奴隶生育了 ${slaveBreedingResult.newGoblins} 个哥布林`);
    }

    if (titleParts.length > 0) {
      roundTitle += ` (${titleParts.join('；')})`;
    }

    // 创建回合信息
    const roundInfo = {
      title: roundTitle,
      changes: aggregatedChanges,
      timestamp: Date.now(),
    };

    // 更新最新回合信息
    latestRoundInfo.value = roundInfo;

    // 添加到历史记录
    if (historyModalRef.value) {
      historyModalRef.value.addHistoryEntry(roundInfo);
    }

    // 保存游戏状态
    saveCurrentGameState();

    // 同步繁殖间占用信息到巢穴模块
    console.log('开始同步繁殖间占用信息...');
    try {
      syncBreedingRoomInfo();
      console.log('繁殖间占用信息同步完成');
    } catch (error) {
      console.error('同步繁殖间占用信息失败:', error);
    }

    // 更新资源世界书条目
    console.log('开始更新资源世界书...');
    try {
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

      const continents3 = continentExploreService.continents.value || [];

      await WorldbookService.updateResourcesWorldbook(currentResources, continents3);
      console.log('资源世界书更新完成');
    } catch (error) {
      console.error('更新资源世界书失败:', error);
    }

    // 更新人物世界书状态
    console.log('开始更新人物世界书状态...');
    try {
      const trainingData = modularSaveManager.getModuleData({ moduleName: 'training' }) as any;
      if (trainingData && trainingData.characters) {
        const characters = trainingData.characters;
        let updatedCount = 0;

        for (const character of characters) {
          if (character.status === 'player') {
            continue;
          }

          try {
            await WorldbookService.updateCharacterEntry(character);
            updatedCount++;
          } catch (error) {
            console.error(`更新人物 ${character.name} 的世界书失败:`, error);
          }
        }

        console.log(`人物世界书更新完成，共更新 ${updatedCount} 个人物`);
      } else {
        console.log('没有人物数据需要更新到世界书');
      }
    } catch (error) {
      console.error('更新人物世界书状态失败:', error);
    }

    // 检查随机事件（在主界面显示提示弹窗）
    console.log('检查回合开始随机事件...');
    const event = audienceHallService.checkRandomEvents();
    if (event) {
      pendingEvent.value = event;
      showEventNotification.value = true;
      console.log('触发随机事件提示:', event.name);
    }

    // 检查是否需要总结
    console.log('检查是否需要总结...');
    try {
      const checkResult = await SummaryCheckService.checkIfSummaryNeeded();
      needsSummary.value = checkResult.needsSummary;

      if (checkResult.needsSummary) {
        const message = SummaryCheckService.getSummaryMessage(checkResult);
        console.log('⚠️ 检测到需要总结:', message);
      }
    } catch (error) {
      console.error('检查总结需要性失败:', error);
    }

    console.log('回合结束处理完成');
  } catch (error) {
    console.error('结束回合失败:', error);
    latestRoundInfo.value = {
      title: '回合结束失败',
      changes: [],
      timestamp: Date.now(),
    };
  }
};

/**
 * 聚合资源变化
 */
const aggregateResourceChanges = (changes: any[]): any[] => {
  const aggregated: Record<string, number> = {};

  changes.forEach(change => {
    if (aggregated[change.type]) {
      aggregated[change.type] += change.amount;
    } else {
      aggregated[change.type] = change.amount;
    }
  });

  return Object.entries(aggregated).map(([type, amount]) => ({
    type,
    amount,
  }));
};
</script>

<style scoped lang="scss">
.main-interface {
  width: 100%;
  height: 100%;
  min-height: 730px;
  box-sizing: border-box;
}

/* 花纹边框 */
.decorative-border {
  max-width: 100%;
  margin: 0 auto;
  position: relative;
  padding: 20px;
  background-image:
    repeating-linear-gradient(0deg, transparent, transparent 19px, rgba(205, 133, 63, 0.1) 20px),
    repeating-linear-gradient(90deg, transparent, transparent 19px, rgba(205, 133, 63, 0.1) 20px);
  border: 2px solid rgba(205, 133, 63, 0.3);
  border-radius: 16px;
  box-shadow:
    0 0 30px rgba(205, 133, 63, 0.2),
    inset 0 0 30px rgba(0, 0, 0, 0.5);
  height: calc(100% - 70px);
  margin-bottom: 70px;
}

/* 内容容器 */
.content-wrapper {
  background: rgba(26, 19, 19, 0.8);
  border-radius: 12px;
  padding: 20px;
  box-shadow:
    inset 0 0 20px rgba(0, 0, 0, 0.5),
    0 0 20px rgba(205, 133, 63, 0.1);
  height: calc(100% - 1px);
  overflow-y: auto;
}

/* 标题样式 */
.header {
  position: relative;
  margin-bottom: 24px;
  display: flex;
  justify-content: center;
  align-items: center;

  .header-center {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
  }

  .main-title {
    margin: 0;
    font-size: 28px;
    letter-spacing: 2px;
    color: #ffd7a1;
    text-shadow:
      0 2px 6px rgba(0, 0, 0, 0.6),
      0 0 12px rgba(255, 120, 40, 0.3);
    position: relative;
    display: inline-block;

    &::after {
      content: '';
      position: absolute;
      left: 50%;
      bottom: -8px;
      transform: translateX(-50%);
      width: 80%;
      height: 2px;
      background: linear-gradient(90deg, transparent, rgba(255, 180, 120, 0.6), transparent);
    }
  }
}

/* 统计卡片样式 */
.stats-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;

  .stats-row {
    display: flex;
    gap: 12px;
    justify-content: space-between;

    .stats-card {
      background: linear-gradient(180deg, rgba(40, 26, 20, 0.7), rgba(25, 17, 14, 0.9));
      border: 1px solid rgba(205, 133, 63, 0.25);
      border-radius: 12px;
      padding: 12px;
      box-shadow:
        inset 0 1px 0 rgba(255, 200, 150, 0.08),
        0 4px 12px rgba(0, 0, 0, 0.3);
      flex: 1;

      &.time-info {
        .time-content {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 12px;
          transition: all 0.3s ease;

          .date {
            color: #ffe9d2;
            font-size: 16px;
            font-weight: 700;
            transition: all 0.3s ease;
          }

          .season {
            color: #ffe9d2;
            font-size: 16px;
            font-weight: 700;
            opacity: 0.9;
            transition: all 0.3s ease;
          }

          &.date-updated {
            .date {
              color: #22c55e;
            }

            .season {
              color: #22c55e;
            }
          }
        }
      }

      .stat-item {
        display: flex;
        align-items: center;
        gap: 8px;

        .icon {
          font-size: 20px;
          filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.3));
        }

        .value {
          color: #ffe9d2;
          font-size: 16px;
          font-weight: 700;
        }
      }
    }
  }

  /* 资源网格样式 */
  .resources-grid {
    display: grid;
    gap: 12px;
    margin-top: 6px;

    /* 默认四个并列 */
    grid-template-columns: repeat(4, 1fr);

    /* 电脑端可以八个并列一行 */
    @media (min-width: 769px) {
      &.eight-columns {
        grid-template-columns: repeat(8, 1fr);
      }
    }

    .resource-item {
      background: linear-gradient(180deg, rgba(40, 26, 20, 0.7), rgba(25, 17, 14, 0.9));
      border: 1px solid rgba(205, 133, 63, 0.25);
      border-radius: 12px;
      padding: 12px;
      box-shadow:
        inset 0 1px 0 rgba(255, 200, 150, 0.08),
        0 4px 12px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      transition: all 0.2s ease;

      &:hover {
        transform: translateY(-2px);
        box-shadow:
          inset 0 1px 0 rgba(255, 200, 150, 0.12),
          0 6px 16px rgba(0, 0, 0, 0.4);
        border-color: rgba(205, 133, 63, 0.4);
      }

      .resource-icon {
        font-size: 28px;
        filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
        margin-bottom: 8px;
      }

      .resource-value {
        color: #ffe9d2;
        font-size: 18px;
        font-weight: 700;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
      }
    }
  }

  /* 行动力显示样式 */
  .action-points-row {
    margin-top: 6px;

    .action-points-card {
      background: linear-gradient(180deg, rgba(40, 26, 20, 0.7), rgba(25, 17, 14, 0.9));
      border: 1px solid rgba(205, 133, 63, 0.25);
      border-radius: 8px;
      padding: 6px 12px;
      box-shadow:
        inset 0 1px 0 rgba(255, 200, 150, 0.08),
        0 4px 12px rgba(0, 0, 0, 0.3);

      .action-points-display {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 4px;
        padding: 2px 0;

        .action-point {
          font-size: 16px;
          transition: all 0.4s ease;
          cursor: default;
          position: relative;

          &.filled {
            filter: drop-shadow(0 0 6px rgba(255, 100, 120, 0.8));
            animation: heartPulse 1.8s ease-in-out infinite;
          }

          &:not(.filled) {
            opacity: 0.3;
            filter: drop-shadow(0 0 2px rgba(150, 150, 150, 0.2));
          }

          &:hover {
            transform: scale(1.15);
          }
        }
      }
    }
  }
}

/* 操作按钮区域 */
.action-buttons {
  margin: 20px 0;
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: nowrap;

  .action-btn {
    background: linear-gradient(180deg, rgba(40, 26, 20, 0.8), rgba(25, 17, 14, 0.9));
    border: 1px solid rgba(205, 133, 63, 0.3);
    border-radius: 12px;
    padding: 12px 20px;
    cursor: pointer;
    box-shadow:
      inset 0 1px 0 rgba(255, 200, 150, 0.08),
      0 4px 12px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
    color: #f0e6d2;

    &:hover {
      transform: translateY(-2px);
      box-shadow:
        inset 0 1px 0 rgba(255, 200, 150, 0.12),
        0 6px 16px rgba(0, 0, 0, 0.4);
      border-color: rgba(205, 133, 63, 0.5);
    }

    .icon {
      font-size: 16px;
      filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.3));
    }

    .text {
      font-weight: 600;
      font-size: 14px;
    }

    &.save-load-btn {
      &:hover {
        background: linear-gradient(180deg, rgba(168, 85, 247, 0.2), rgba(147, 51, 234, 0.3));
        border-color: rgba(168, 85, 247, 0.5);
        color: #a855f7;
      }
    }

    &.round-btn {
      &:hover {
        background: linear-gradient(180deg, rgba(220, 38, 38, 0.2), rgba(185, 28, 28, 0.3));
        border-color: rgba(220, 38, 38, 0.5);
        color: #dc2626;
      }
    }

    &.story-summary-btn.needs-summary {
      background: linear-gradient(180deg, rgba(245, 158, 11, 0.3), rgba(217, 119, 6, 0.4));
      border: 2px solid rgba(245, 158, 11, 0.6);
      box-shadow:
        0 0 20px rgba(245, 158, 11, 0.4),
        inset 0 1px 0 rgba(255, 237, 213, 0.3);
      animation: summaryPulse 2s ease-in-out infinite;

      .icon,
      .text {
        color: #fbbf24;
        font-weight: 700;
      }

      &:hover {
        background: linear-gradient(180deg, rgba(245, 158, 11, 0.4), rgba(217, 119, 6, 0.5));
        border-color: rgba(245, 158, 11, 0.8);
        box-shadow:
          0 0 30px rgba(245, 158, 11, 0.6),
          inset 0 1px 0 rgba(255, 237, 213, 0.4);
        transform: translateY(-2px) scale(1.02);
      }
    }
  }
}

// 总结按钮脉冲动画
@keyframes summaryPulse {
  0%,
  100% {
    box-shadow:
      0 0 20px rgba(245, 158, 11, 0.4),
      inset 0 1px 0 rgba(255, 237, 213, 0.3);
  }
  50% {
    box-shadow:
      0 0 30px rgba(245, 158, 11, 0.7),
      inset 0 1px 0 rgba(255, 237, 213, 0.5);
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .decorative-border {
    padding: 10px;
  }

  .content-wrapper {
    padding: 15px;
  }

  .header {
    gap: 8px;
  }

  .main-title {
    font-size: 24px;
  }

  .stats-container {
    .resources-grid {
      /* 移动端强制四个并列 */
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;

      .resource-item {
        padding: 8px;

        .resource-icon {
          font-size: 24px;
        }

        .resource-value {
          font-size: 16px;
        }
      }
    }
  }

  .action-buttons {
    gap: 8px;
    margin: 10px 0 !important;

    .action-btn {
      padding: 10px 16px;
      min-width: 0;

      .text {
        font-size: 12px;
      }

      .icon {
        font-size: 14px;
      }
    }
  }

  .info-display {
    margin-top: 10px !important;
  }
}

/* 信息显示区域样式 */
.info-display {
  margin-top: 20px;
  background: linear-gradient(180deg, rgba(40, 26, 20, 0.8), rgba(25, 17, 14, 0.9));
  border: 1px solid rgba(205, 133, 63, 0.3);
  border-radius: 12px;
  padding: 16px;
  position: relative;

  .info-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(205, 133, 63, 0.2);

    .info-title {
      color: #ffd7a1;
      font-size: 16px;
      font-weight: 700;
    }

    .history-btn {
      background: rgba(205, 133, 63, 0.2);
      border: 1px solid rgba(205, 133, 63, 0.3);
      border-radius: 6px;
      padding: 4px 8px;
      color: #f0e6d2;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 4px;

      &:hover {
        background: rgba(205, 133, 63, 0.3);
        transform: scale(1.05);
      }

      .icon {
        font-size: 14px;
      }
    }
  }

  .info-content {
    .round-summary {
      .round-title {
        color: #ffe9d2;
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 8px;
      }

      .resource-changes {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;

        .resource-change {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 6px;
          font-size: 12px;

          &.positive {
            border-left: 3px solid #22c55e;
            background: rgba(34, 197, 94, 0.1);
          }

          &.negative {
            border-left: 3px solid #dc2626;
            background: rgba(220, 38, 38, 0.1);
          }

          .resource-icon {
            font-size: 12px;
          }

          .resource-name {
            color: #f0e6d2;
            font-weight: 500;
          }

          .change-amount {
            font-weight: 700;

            &.positive {
              color: #22c55e;
            }

            &.negative {
              color: #dc2626;
            }
          }
        }
      }
    }
  }

  .no-round-info {
    text-align: center;
    padding: 20px;
    color: #9ca3af;

    .no-info-text {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 8px;
      color: #f0e6d2;
    }

    .no-info-hint {
      font-size: 14px;
      opacity: 0.8;
    }
  }
}

/* 心跳脉冲动画 */
@keyframes heartPulse {
  0% {
    filter: drop-shadow(0 0 6px rgba(255, 100, 120, 0.8));
    transform: scale(1);
  }
  25% {
    filter: drop-shadow(0 0 10px rgba(255, 150, 170, 1));
    transform: scale(1.08);
  }
  50% {
    filter: drop-shadow(0 0 6px rgba(255, 100, 120, 0.8));
    transform: scale(1);
  }
  75% {
    filter: drop-shadow(0 0 8px rgba(255, 120, 140, 0.9));
    transform: scale(1.04);
  }
  100% {
    filter: drop-shadow(0 0 6px rgba(255, 100, 120, 0.8));
    transform: scale(1);
  }
}
</style>
