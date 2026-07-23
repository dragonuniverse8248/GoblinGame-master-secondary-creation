<template>
  <div class="training-panel">
    <div class="panel-header">
      <h3 class="panel-title">💋 调教界面</h3>
      <div class="batch-buttons">
        <button class="batch-train-btn" :disabled="!canBatchTrain" title="批量调教" @click="batchTraining">
          <span class="btn-icon">⚡</span>
          <span class="btn-text">全部调教</span>
        </button>
        <button class="batch-breed-btn" :disabled="!canBatchBreed" title="批量生育" @click="batchBreeding">
          <span class="btn-icon">🤱</span>
          <span class="btn-text">全部生育</span>
        </button>
      </div>
    </div>

    <!-- 人物卡片网格 - 竖条卡片布局 -->
    <div class="characters-grid">
      <div
        v-for="character in filteredCharacters"
        :key="character.id"
        class="character-card"
        :class="[getRatingClass(character.rating || 'D'), { selected: selectedCharacter?.id === character.id }]"
        :data-character-id="character.id"
        @click="handleCharacterCardClick(character)"
      >
        <!-- 人物肖像图片区域 -->
        <div class="character-portrait" @dblclick.stop="showEnlargedAvatar(character)">
          <img v-if="character.avatar" :src="character.avatar" :alt="character.name" @error="handleImageError" />
          <div v-else class="default-portrait">
            <span class="portrait-icon">👤</span>
          </div>

          <!-- 状态标识 -->
          <div class="character-status-badge" :class="character.status">
            {{ getStatusText(character.status) }}
          </div>

          <!-- 等级标签 -->
          <div class="character-level-badge">
            <span class="level-icon">LV.</span>
            <span class="level-value">{{ character.level ?? Math.floor((character.offspring ?? 0) / 10) ?? 1 }}</span>
          </div>
        </div>

        <!-- 人物名称 -->
        <div class="character-name">
          {{ character.name }}
        </div>

        <!-- 收藏按钮 -->
        <div class="favorite-btn-card" @click.stop="toggleFavorite(character)">
          <span class="favorite-icon" :class="{ favorited: character.favorite }">
            {{ character.favorite ? '⭐' : '☆' }}
          </span>
        </div>
      </div>
    </div>

    <!-- 人物操作轮盘 -->
    <div v-if="showCharacterMenu" class="character-wheel-overlay" @click="closeCharacterMenu">
      <div class="character-wheel" @click.stop>
        <!-- 轮盘中心 -->
        <div class="wheel-center">
          <div class="character-avatar">
            <img v-if="selectedCharacter?.avatar" :src="selectedCharacter.avatar" :alt="selectedCharacter.name" />
            <div v-else class="default-avatar">
              <span class="avatar-icon">👤</span>
            </div>
          </div>
          <button class="close-wheel-btn" @click="closeCharacterMenu">×</button>
          <!-- 调教开关按钮 - 位于关闭按钮下方 -->
          <button
            v-if="selectedCharacter"
            class="auto-train-toggle-btn"
            :class="{ enabled: selectedCharacter.autoTrainEnabled !== false }"
            :title="
              selectedCharacter.autoTrainEnabled !== false ? '已开启：支持一键调教' : '已关闭：跳过一键调教，需手动操作'
            "
            @click.stop="toggleAutoTrain(selectedCharacter)"
          >
            <span class="toggle-icon">⚡</span>
          </button>
          <!-- 生育开关按钮 - 位于调教开关下方 -->
          <button
            v-if="selectedCharacter"
            class="auto-breed-toggle-btn"
            :class="{ enabled: selectedCharacter.autoBreedEnabled !== false }"
            :title="
              selectedCharacter.autoBreedEnabled !== false ? '已开启：支持一键生育' : '已关闭：跳过一键生育，需手动操作'
            "
            @click.stop="toggleAutoBreed(selectedCharacter)"
          >
            <span class="toggle-icon">🤱</span>
          </button>
        </div>

        <!-- 轮盘按钮 -->
        <div class="wheel-buttons">
          <button
            class="wheel-btn primary"
            :class="{ 'btn-0': true }"
            title="查看详情"
            @click="selectedCharacter && openCharacterDetails(selectedCharacter)"
          >
            <span class="btn-icon">👁️</span>
          </button>
          <button
            class="wheel-btn outfit"
            :class="{
              'btn-1': true,
              disabled: false,
            }"
            :disabled="false"
            title="换装"
            @click="selectedCharacter && openOutfitMenu(selectedCharacter)"
          >
            <span class="btn-icon">👗</span>
          </button>
          <button
            class="wheel-btn fertility"
            :class="{
              'btn-3': true,
            }"
            title="交配"
            @click="selectedCharacter && handleFertilityClick(selectedCharacter)"
          >
            <span class="btn-icon">🤱</span>
          </button>
          <button
            class="wheel-btn manual"
            :class="{
              'btn-4': true,
            }"
            title="融合调教（手动+自动）"
            @click="selectedCharacter && handleManualTrainingClick(selectedCharacter)"
          >
            <span class="btn-icon">⚡</span>
          </button>
          <button
            class="wheel-btn danger"
            :class="{ 'btn-2': true }"
            title="处决"
            @click="selectedCharacter && executeCharacter(selectedCharacter)"
          >
            <span class="btn-icon">⚔️</span>
          </button>
          <!-- 堕落按钮 - 只在忠诚度达到100%且未堕落且未编制且未在调教/交配中时显示 -->
          <button
            v-if="
              selectedCharacter &&
              selectedCharacter.loyalty >= 100 &&
              selectedCharacter.status !== 'surrendered' &&
              selectedCharacter.status !== 'deployed' &&
              selectedCharacter.status !== 'training' &&
              selectedCharacter.status !== 'breeding'
            "
            class="wheel-btn corruption"
            :class="{ 'btn-5': true }"
            title="完成堕落"
            @click="selectedCharacter && triggerCorruption(selectedCharacter)"
          >
            <span class="btn-icon">🔥</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 人物详情弹窗 -->
    <CharacterCardInterface
      :show="showCharacterModal"
      :character="selectedCharacter"
      @close="closeCharacterModal"
      @start-training="startTraining"
      @edit-avatar="editAvatar"
      @execute="executeCharacter"
      @character-updated="handleCharacterUpdated"
    />

    <!-- 头像编辑弹窗 -->
    <AvatarEditInterface
      :show="showAvatarModal"
      :character="editingCharacter"
      @close="closeAvatarModal"
      @character-updated="handleAvatarUpdated"
    />

    <!-- 换装界面 -->
    <OutfitInterface
      :show="showOutfitModal"
      :character="selectedCharacter"
      @close="closeOutfitModal"
      @save-outfit="saveOutfit"
    />

    <!-- 手动调教界面（暂时接入选项式界面） -->
    <OptionTrainingInterface
      v-if="showManualTraining && selectedCharacter"
      :character="selectedCharacter"
      @close="closeManualTraining"
      @update-character="updateCharacter"
    />

    <!-- 弹窗提示组件 -->
    <ToastNotification ref="toastRef" />

    <!-- 自定义确认框组件 -->
    <CustomConfirmDialog
      :show="showCustomConfirm"
      :title="confirmConfig.title"
      :message="confirmConfig.message"
      :details="confirmConfig.details"
      :type="confirmConfig.type"
      @confirm="handleConfirmDialogConfirm"
      @cancel="handleConfirmDialogCancel"
    />

    <!-- 放大头像查看弹窗 -->
    <div v-if="showEnlargedAvatarModal" class="enlarged-avatar-overlay" @click="closeEnlargedAvatar">
      <div class="enlarged-avatar-container" @click.stop>
        <button class="close-enlarged-avatar-btn" @click="closeEnlargedAvatar">×</button>
        <div class="enlarged-avatar-info">
          <h3 class="enlarged-character-name">{{ enlargedAvatarCharacter?.name }}</h3>
          <div v-if="enlargedAvatarCharacter?.title" class="enlarged-character-title">
            {{ enlargedAvatarCharacter.title }}
          </div>
        </div>
        <div class="enlarged-avatar-image-wrapper">
          <img
            v-if="enlargedAvatarCharacter?.avatar"
            :src="enlargedAvatarCharacter.avatar"
            :alt="enlargedAvatarCharacter.name"
            class="enlarged-avatar-image"
            @error="handleImageError"
          />
          <div v-else class="enlarged-avatar-placeholder">
            <span class="enlarged-portrait-icon">👤</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onActivated, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import ToastNotification from '../共享资源层/组件/弹窗提示.vue';
import CustomConfirmDialog from '../共享资源层/组件/自定义确认框.vue';
import { AvatarSwitchService } from '../功能模块层/人物管理/服务/头像切换服务';
import { ClothingSwitchService } from '../功能模块层/人物管理/服务/衣着切换服务';
import type { Character } from '../功能模块层/人物管理/类型/人物类型';
import { WorldbookService } from '../核心层/服务/世界书管理/服务/世界书服务';
import { modularSaveManager } from '../核心层/服务/存档系统/模块化存档服务';
import { ConfirmService } from '../核心层/服务/通用服务/确认框服务';
import { actionPointsService } from '../核心层/服务/通用服务/行动力服务';
import CharacterCardInterface from '../界面显示层/调教界面子页面/人物卡界面.vue';
import AvatarEditInterface from '../界面显示层/调教界面子页面/头像编辑界面.vue';
import OutfitInterface from '../界面显示层/调教界面子页面/换装界面.vue';
import OptionTrainingInterface from '../界面显示层/调教界面子页面/选项式调教界面.vue';

// 资源管理 - 直接使用 modularSaveManager

// 防止重复加载的标志
const isDataLoaded = ref(false);

// 弹窗提示组件引用
const toastRef = ref<InstanceType<typeof ToastNotification>>();

// 根据 id 去重的工具函数
const uniqueById = <T extends { id: string }>(items: T[] = []): T[] => {
  const map = new Map<string, T>();
  for (const item of items) {
    if (item && item.id && !map.has(item.id)) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
};

// 检测数据是否已完全加载
const isDataFullyLoaded = (): boolean => {
  if (!isDataLoaded.value) return false;

  // 获取存档中的人物数据
  const trainingData = modularSaveManager.getModuleData({ moduleName: 'training' }) as any;
  if (!trainingData) return false;

  const savedCharacters = trainingData.characters || [];

  // 基于唯一 id 计算存档中的人物数量，避免因为存档重复导致误判
  const savedUniqueIds = new Set<string>(savedCharacters.map((c: any) => c.id));
  const savedUniqueCount = savedUniqueIds.size;
  const currentUniqueCount = new Set<string>(characters.value.map(c => c.id)).size;

  // 当前加载的人物数量小于存档中的唯一数量，说明未完全加载
  if (currentUniqueCount < savedUniqueCount) {
    return false;
  }

  // 检查是否有真正需要重新加载的状态变化
  // 只有当存档中的状态比界面中的状态"更新"时才需要重新加载
  const needsReload = characters.value.some(char => {
    const savedChar = savedCharacters.find((s: any) => s.id === char.id);
    if (!savedChar) return false;

    // 检查存档中是否有更新的数据（存档比界面新）
    // 这通常发生在其他界面修改了数据，或者回合结束后数据被更新
    // 注意：现在capturedAt可能是字符串格式，我们主要通过属性差异来判断

    // 检查状态变化（重要：状态变化需要重新加载）
    if (char.status !== savedChar.status) {
      console.log(`检测到状态变化: ${char.name} ${char.status} -> ${savedChar.status}`);
      return true;
    }

    // 如果关键属性有明显差异，则需要重新加载
    return (
      Math.abs(char.stamina - savedChar.stamina) > 1 ||
      Math.abs(char.fertility - savedChar.fertility) > 1 ||
      Math.abs(char.loyalty - savedChar.loyalty) > 1
    );
  });

  if (needsReload) {
    console.log('检测到存档数据更新，需要重新加载数据');
    return false;
  }

  return true;
};

// 响应式数据
const characters = ref<Character[]>([]);
const selectedCharacter = ref<Character | null>(null);
const showAvatarModal = ref(false);
const showCharacterModal = ref(false);
const showCharacterMenu = ref(false);
const showManualTraining = ref(false);
const showOutfitModal = ref(false);
const editingCharacter = ref<Character | null>(null);
// 放大头像相关
const showEnlargedAvatarModal = ref(false);
const enlargedAvatarCharacter = ref<Character | null>(null);

// 自定义确认框状态
const showCustomConfirm = ref(false);
const confirmConfig = ref({
  title: '',
  message: '',
  details: '',
  type: 'warning' as 'info' | 'warning' | 'danger' | 'success',
  onConfirm: () => {},
  onCancel: () => {},
});

// 人物列表
const filteredCharacters = ref<Character[]>([]);

// 移除预设头像数组，改为随机选择功能

// 计算属性
const canBatchTrain = computed(() => characters.value.some(c => c.status === 'imprisoned'));

const canBatchBreed = computed(() => {
  return characters.value.some(c => (c.status === 'imprisoned' || c.status === 'surrendered') && c.stamina >= 20);
});

// 记录最近一次加载的签名，避免重复加载
let lastLoadedSignature: string | null = null;
let isLoadingTrainingData = false;

// 修复旧格式头像URL
// 传说级(/images/heroes/)：只修正目录前缀，保留三阶段结构
// 英雄级(/images/portraits/或空)：通过后端API分配确定性通用图片
const fixLegacyAvatarUrls = async (charactersToFix: Character[]) => {
  // 传说级角色：修正 /images/heroes/ → /images/默认/传奇/（保留三阶段）
  const legendaryFix = charactersToFix.filter(
    c => c.avatar?.startsWith('/images/heroes/')
  );
  for (const char of legendaryFix) {
    const fixPath = (url: string) => {
      const filename = url.split('/').pop() || '';
      return `/images/默认/传奇/${filename}`;
    };
    char.avatar = fixPath(char.avatar!);
    if (char.corruptedAvatar?.startsWith('/images/heroes/')) {
      char.corruptedAvatar = fixPath(char.corruptedAvatar);
    }
    if (char.fullyCorruptedAvatar?.startsWith('/images/heroes/')) {
      char.fullyCorruptedAvatar = fixPath(char.fullyCorruptedAvatar);
    }
    console.log(`🔧 [传说修复] ${char.name}: ${char.avatar} / ${char.corruptedAvatar} / ${char.fullyCorruptedAvatar}`);
  }

  // 英雄级角色：空头像或 /images/portraits/ → API分配
  const heroFix = charactersToFix.filter(
    c => (!c.avatar || c.avatar.startsWith('/images/portraits/')) && !c.avatar?.startsWith('/images/heroes/')
  );
  if (heroFix.length === 0 && legendaryFix.length === 0) return;

  let fixedCount = 0;
  for (const char of heroFix) {
    try {
      const resp = await fetch(`/api/images/assign/${encodeURIComponent(char.id)}`);
      const data = await resp.json();
      if (data.url) {
        char.avatar = data.url;
        fixedCount++;
        console.log(`✅ [英雄修复] ${char.name}: ${char.avatar}`);
      }
    } catch (e) {
      console.warn(`⚠️ [英雄修复] ${char.name} 失败:`, e);
    }
  }

  const totalFixed = legendaryFix.length + fixedCount;
  if (totalFixed > 0) {
    console.log(`🔧 [头像修复] 传说级:${legendaryFix.length} 英雄级:${fixedCount}，保存到存档`);
    saveTrainingData();
  }
};

// 加载调教数据
const loadTrainingData = async (forceReload = true) => {
  if (isLoadingTrainingData) {
    console.log('加载进行中，跳过本次调用');
    return;
  }
  isLoadingTrainingData = true;
  // 如果数据已完全加载且不强制重新加载，跳过重复加载
  if (!forceReload && isDataFullyLoaded()) {
    console.log('数据已完全加载，跳过重复加载');
    isLoadingTrainingData = false;
    return;
  }

  try {
    // 从模块化存档系统获取调教数据
    const trainingData = modularSaveManager.getModuleData({ moduleName: 'training' }) as any;
    console.log('读取到调教数据:', trainingData);

    // 合并所有人物数据（包括普通人物和英雄）
    let allCharacters: any[] = [];

    // 添加非未捕获状态的人物数据（包括英雄和普通人物，但排除玩家角色）
    if (trainingData && trainingData.characters && trainingData.characters.length > 0) {
      const availableCharacters = trainingData.characters
        .filter(
          (char: any) =>
            char.status !== 'uncaptured' &&
            char.status !== 'enemy' &&
            char.id !== 'player-1' &&
            char.status !== 'player',
        ) // 只显示非未捕获状态、非敌方状态且非玩家角色的人物（通过ID和status双重检查，避免改名后误判）
        .map((char: any) => {
          // 保持capturedAt的原始格式（字符串或Date对象）
          return {
            ...char, // 使用完整的人物数据
          };
        });

      allCharacters.push(...availableCharacters);
      console.log('可用人物数据已加载:', availableCharacters);
      console.log(
        `📊 存档中人物总数: ${trainingData.characters.length}, 过滤后可用人物数: ${availableCharacters.length}`,
      );
    }

    // 在进入视图层之前先对合并后的数据去重
    allCharacters = uniqueById(allCharacters);

    // 生成此次加载的签名（基于 id 和状态，确保状态变化时能重新加载）
    // 注意：签名的生成应该包含人物数量，确保新人物添加时能触发重新加载
    const signature = `${allCharacters.length}|${allCharacters
      .map(c => `${c.id}:${c.status}:${c.formationPosition || 'none'}`)
      .filter(Boolean)
      .sort()
      .join('|')}`;
    if (lastLoadedSignature && lastLoadedSignature === signature && !forceReload) {
      console.log('检测到相同签名的加载，跳过');
      isLoadingTrainingData = false;
      return;
    }

    // 如果人物数量发生变化，强制重新加载
    const currentCount = characters.value.length;
    const newCount = allCharacters.length;
    if (currentCount !== newCount) {
      console.log(`人物数量变化: ${currentCount} -> ${newCount}，强制重新加载`);
    }

    // 同步清理存档中的重复人物，避免重复传播
    try {
      const dedupedCharacters = uniqueById(trainingData.characters || []);
      if (trainingData.characters && dedupedCharacters.length !== trainingData.characters.length) {
        modularSaveManager.updateModuleData({
          moduleName: 'training',
          data: {
            ...trainingData,
            characters: dedupedCharacters,
          },
        });
        console.log('存档人物数据已去重并回写');
      }
    } catch (e) {
      console.warn('存档人物去重失败(忽略):', e);
    }

    // 始终采用全量替换，避免任何增量叠加
    // 在加载数据时应用头像切换逻辑，确保头像与当前堕落值匹配
    const processedCharacters = allCharacters.map(character => {
      const avatarResult = AvatarSwitchService.handleCorruptionChange(character, character.loyalty);
      return avatarResult.character;
    });

    // 头像恢复：确保没有角色因编队/卸载操作丢失头像
    for (const char of processedCharacters) {
      if (!char.avatar) {
        // 直接使用确定性分配，不再使用可能过时的 originalAvatar
        console.warn(`⚠️ [头像恢复] ${char.name} 头像为空，使用确定性兜底`);
        char.avatar = `/api/images/assign/${encodeURIComponent(char.id)}`;
      }
    }

    characters.value = processedCharacters;
    lastLoadedSignature = signature;
    console.log('全量重载人物数据（已应用头像切换）:', processedCharacters);
    console.log(
      `✅ 加载完成: 存档中人物总数 ${trainingData?.characters?.length || 0}, 显示的人物总数 ${processedCharacters.length}`,
    );

    isDataLoaded.value = true; // 标记数据已加载
    console.log('当前总人物数量:', characters.value.length);

    // 修复旧格式头像URL（/images/portraits/ → 大陆通用图片），异步执行
    fixLegacyAvatarUrls(processedCharacters);

    // 更新调教人物数量到资源系统
    updateTrainingCharactersCount();

    // 如果有已生成的人物数据，添加到世界书（先去重）
    // 注意：这里只负责首次创建世界书条目，后续更新由选项式调教界面负责
    if (trainingData && trainingData.characters && trainingData.characters.length > 0) {
      // 筛选出已生成的人物（通过 status 判断，更直接准确）
      // 包含所有可能的人物状态：关押中、调教中、交配中、已堕落、已部署
      const generatedCharacters = trainingData.characters
        .filter(
          (char: any) =>
            (char.status === 'imprisoned' ||
              char.status === 'training' ||
              char.status === 'breeding' ||
              char.status === 'surrendered' ||
              char.status === 'deployed') &&
            char.status !== 'enemy', // 排除敌方状态的人物
        )
        .map((character: any) => {
          // 保持capturedAt的原始格式（字符串或Date对象）
          return {
            ...character,
          };
        });

      // 使用统一的世界书管理方法（仅创建，不更新）
      await manageWorldbookEntries(generatedCharacters);
    }

    isLoadingTrainingData = false;
  } catch (error) {
    console.error('加载调教数据失败:', error);
    isLoadingTrainingData = false;
  }
};

// 同步人物状态到模块化存档系统
const syncCharacterStatuses = () => {
  try {
    // 获取当前调教数据
    const currentTrainingData = modularSaveManager.getModuleData({ moduleName: 'training' }) as any;
    const existingCharacters = currentTrainingData?.characters || [];

    // 获取调教界面中的人物（不包含玩家角色）
    const trainingCharacters = uniqueById(characters.value);

    // 保留玩家角色和其他不在调教界面中的人物
    const nonTrainingCharacters = existingCharacters.filter(
      (char: any) => char.status === 'player' || char.id === 'player-1',
    );

    // 合并调教界面人物和其他重要人物
    const allCharacters = [...trainingCharacters, ...nonTrainingCharacters];
    const dedupedCharacters = uniqueById(allCharacters);

    // 保护头像字段：从已有存档中恢复可能丢失的头像URL
    const existingMap = new Map(existingCharacters.map((c: any) => [c.id, c]));
    for (const char of dedupedCharacters) {
      const existing = existingMap.get(char.id);
      if (existing && !char.avatar && existing.avatar) {
        char.avatar = existing.avatar;
        char.corruptedAvatar = existing.corruptedAvatar;
        char.fullyCorruptedAvatar = existing.fullyCorruptedAvatar;
        char.originalAvatar = existing.originalAvatar;
      }
    }

    modularSaveManager.updateModuleData({
      moduleName: 'training',
      data: {
        ...currentTrainingData,
        characters: dedupedCharacters,
      },
    });

    // 更新调教人物数量到资源系统
    updateTrainingCharactersCount();

    console.log('人物状态已同步到模块化存档系统，保留玩家角色');
  } catch (error) {
    console.error('同步人物状态失败:', error);
  }
};

// 更新调教人物数量到资源系统
const updateTrainingCharactersCount = () => {
  try {
    // 计算所有已捕获的人物数量（排除未捕获状态）
    const allCharacters = characters.value.filter((char: any) => char.status !== 'uncaptured');
    // 更新到资源管理系统（自动同步到响应式状态）
    modularSaveManager.setResource('trainingSlaves', allCharacters.length);
    console.log(
      '调教人物数量已更新:',
      allCharacters.length,
      '当前资源值:',
      modularSaveManager.resources.value.trainingSlaves,
    );
  } catch (error) {
    console.error('更新调教人物数量失败:', error);
    modularSaveManager.setResource('trainingSlaves', 0);
  }
};

// 同步繁殖间占用信息到巢穴模块
const syncBreedingRoomInfo = () => {
  try {
    const breedingRoomInfo: any[] = [];

    // 遍历所有人物，找出占用繁殖间的人物
    characters.value.forEach(char => {
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

    // 获取当前巢穴数据
    const currentNestData = modularSaveManager.getModuleData({ moduleName: 'nest' }) as any;

    // 更新巢穴数据
    modularSaveManager.updateModuleData({
      moduleName: 'nest',
      data: {
        ...currentNestData,
        breedingRoomInfo: breedingRoomInfo,
      },
    });

    console.log('繁殖间占用信息已同步到巢穴模块');
  } catch (error) {
    console.error('同步繁殖间信息失败:', error);
  }
};

// 保存调教数据
const saveTrainingData = () => {
  try {
    // 同步人物状态和繁殖间信息
    syncCharacterStatuses();
    syncBreedingRoomInfo();

    console.log('调教数据已保存');
  } catch (error) {
    console.error('保存调教数据失败:', error);
  }
};

// 统一的世界书管理方法 - 仅在首次进入时创建人物世界书
const manageWorldbookEntries = async (characters: Character[]) => {
  try {
    let addedCount = 0;
    let skippedCount = 0;
    let playerSkippedCount = 0;

    for (const character of characters) {
      // 跳过player角色
      if (character.status === 'player' || character.id === 'player-1') {
        playerSkippedCount++;
        console.log(`跳过player角色 ${character.name} (ID: ${character.id}, 状态: ${character.status})`);
        continue;
      }

      // 检查是否已存在于世界书中
      const existingEntry = await WorldbookService.getCharacterEntry(character.id);

      if (!existingEntry) {
        // 如果不存在，则添加到世界书（仅创建，不更新）
        await WorldbookService.createCharacterWorldbook(character);
        addedCount++;
        console.log(`已将人物 ${character.name} 添加到世界书`);
      } else {
        skippedCount++;
        console.log(`人物 ${character.name} 已存在于世界书中，跳过添加`);
      }
    }

    // 世界书管理结果（内部处理，不需要前台提示）
    if (addedCount > 0) {
      console.log(`已将 ${addedCount} 个人物添加到世界书`);
    }
    if (skippedCount > 0) {
      console.log(`跳过 ${skippedCount} 个已存在的人物`);
    }
    if (playerSkippedCount > 0) {
      console.log(`跳过 ${playerSkippedCount} 个player角色`);
    }
  } catch (error) {
    console.error('管理世界书条目失败:', error);
    // 世界书管理失败（内部处理，不需要前台提示）
  }
};

// 处理人物卡片点击（区分单击和双击）
let clickTimer: ReturnType<typeof setTimeout> | null = null;
let isDoubleClick = false;

const handleCharacterCardClick = (character: Character) => {
  // 清除之前的定时器
  if (clickTimer) {
    clearTimeout(clickTimer);
    clickTimer = null;
  }

  // 检查是否是双击
  isDoubleClick = false;
  clickTimer = setTimeout(() => {
    // 延迟执行，如果不是双击，则执行单击操作
    if (!isDoubleClick) {
      openCharacterMenu(character);
    }
    clickTimer = null;
  }, 150); // 300ms内如果再次点击，则认为是双击
};

// 显示人物操作菜单
const openCharacterMenu = (character: Character) => {
  selectedCharacter.value = character;
  showCharacterMenu.value = true;
};

// 关闭人物操作菜单
const closeCharacterMenu = () => {
  showCharacterMenu.value = false;
  selectedCharacter.value = null;
};

// 打开人物详情
const openCharacterDetails = (character: Character) => {
  selectedCharacter.value = character;
  showCharacterModal.value = true;
  showCharacterMenu.value = false;
};

// 关闭人物详情弹窗
const closeCharacterModal = () => {
  showCharacterModal.value = false;
  selectedCharacter.value = null;
};

// 开始调教
const startTraining = async (character: Character, skipActionPointCheck = false) => {
  if (character.status === 'training') return;

  // 如果不跳过行动力检查，则检查并消耗行动力
  if (!skipActionPointCheck) {
    // 检查行动力
    if (!actionPointsService.hasEnoughActionPoints('singleTraining')) {
      await ConfirmService.showWarning(
        actionPointsService.getInsufficientActionPointsMessage('singleTraining'),
        '行动力不足',
        '请等待下回合恢复行动力或征服更多区域增加上限',
      );
      return;
    }

    // 消耗行动力
    if (!actionPointsService.consumeActionPoints('singleTraining')) {
      await ConfirmService.showDanger('行动力消耗失败', '操作失败');
      return;
    }
  }

  // 检查是否已编制
  if (character.status === 'deployed') {
    // 如果不跳过行动力检查，则返还行动力（已编制无法调教）
    if (!skipActionPointCheck) {
      actionPointsService.refundActionPoints('singleTraining');
    }
    toastRef.value?.warning(`${character.name} 已编制，无法进行调教！`, { title: '无法调教', duration: 3000 });
    showCharacterMenu.value = false;
    return;
  }

  // 检查体力是否过低（基于实际数值，20是体力下限）
  if (character.stamina < 20) {
    // 如果不跳过行动力检查，则返还行动力（体力不足）
    if (!skipActionPointCheck) {
      actionPointsService.refundActionPoints('singleTraining');
    }
    toastRef.value?.warning(`${character.name} 体力过低，无法开始调教！`, { title: '体力不足', duration: 3000 });
    showCharacterMenu.value = false;
    return;
  }

  character.status = 'training';
  character.lastTraining = new Date();
  showCharacterMenu.value = false;

  // 调教立即消耗体力
  character.stamina = Math.max(0, character.stamina - 20);

  // 检查是否死亡 - 已注释掉
  // if (character.stamina <= 0) {
  //   executeCharacter(character);
  //   return;
  // }

  // 调教效果将在回合结束时处理
  // 这里只设置状态，不自动结束
  toastRef.value?.success(`${character.name} 开始调教，将在下回合完成`, { title: '调教开始', duration: 3000 });

  // 保存调教数据
  saveTrainingData();
};

// 开始交配
const startFertility = async (character: Character) => {
  if (character.status === 'breeding') return;

  // 检查行动力
  if (!actionPointsService.hasEnoughActionPoints('singleBreeding')) {
    await ConfirmService.showWarning(
      actionPointsService.getInsufficientActionPointsMessage('singleBreeding'),
      '行动力不足',
      '请等待下回合恢复行动力或征服更多区域增加上限',
    );
    return;
  }

  // 消耗行动力
  if (!actionPointsService.consumeActionPoints('singleBreeding')) {
    await ConfirmService.showDanger('行动力消耗失败', '操作失败');
    return;
  }

  // 检查是否已编制
  if (character.status === 'deployed') {
    // 返还行动力（已编制无法交配）
    actionPointsService.refundActionPoints('singleBreeding');
    toastRef.value?.warning(`${character.name} 已编制，无法进行交配！`, { title: '无法交配', duration: 3000 });
    showCharacterMenu.value = false;
    return;
  }

  // 检查体力是否过低（基于实际数值，20是体力下限）
  if (character.stamina < 20) {
    // 返还行动力（体力不足）
    actionPointsService.refundActionPoints('singleBreeding');
    toastRef.value?.warning(`${character.name} 体力过低，无法开始交配！`, { title: '体力不足', duration: 3000 });
    showCharacterMenu.value = false;
    return;
  }

  // 检查是否有可用的交配间
  const availableBreedingRooms = await checkAvailableBreedingRooms();
  if (availableBreedingRooms.length === 0) {
    // 返还行动力（没有可用设施）
    actionPointsService.refundActionPoints('singleBreeding');
    toastRef.value?.warning('没有可用的交配间，请先在巢穴界面建设繁殖间！', { title: '缺少设施', duration: 4000 });
    showCharacterMenu.value = false;
    return;
  }

  // 分配交配间
  const assignedRoom = availableBreedingRooms[0];
  character.locationId = assignedRoom.id;

  // 保存原始状态，用于生育完成后恢复
  character.originalStatus = character.status;
  character.status = 'breeding';
  showCharacterMenu.value = false;

  // 交配立即消耗体力
  character.stamina = Math.max(0, character.stamina - 20);

  // 检查是否死亡 - 已注释掉
  // if (character.stamina <= 0) {
  //   executeCharacter(character);
  //   return;
  // }

  // 交配效果将在回合结束时处理
  // 这里只设置状态，不自动结束
  toastRef.value?.success(`${character.name} 开始交配，将在下回合完成`, { title: '交配开始', duration: 3000 });

  // 保存调教数据
  saveTrainingData();
};

// 检查可用的交配间
const checkAvailableBreedingRooms = async () => {
  try {
    const nestData = modularSaveManager.getModuleData({ moduleName: 'nest' }) as any;
    if (!nestData || !nestData.breedingSlots) return [];

    const availableRooms = [];
    for (let i = 0; i < nestData.breedingSlots.length; i++) {
      const slot = nestData.breedingSlots[i];
      if (slot.building && slot.building.id === 'breeding' && slot.unlocked) {
        // 检查是否已被占用
        const isOccupied = characters.value.some(
          char => char.locationId === `breeding-${i}` && char.status === 'breeding',
        );
        if (!isOccupied) {
          availableRooms.push({ id: `breeding-${i}`, index: i });
        }
      }
    }
    return availableRooms;
  } catch (error) {
    console.error('检查交配间失败:', error);
    return [];
  }
};

// 开始手动调教（融合系统：手动调教后自动进行自动调教）
const startManualTraining = async (character: Character) => {
  // 检查行动力
  if (!actionPointsService.hasEnoughActionPoints('singleTraining')) {
    await ConfirmService.showWarning(
      actionPointsService.getInsufficientActionPointsMessage('singleTraining'),
      '行动力不足',
      '请等待下回合恢复行动力或征服更多区域增加上限',
    );
    return;
  }

  // 消耗行动力
  if (!actionPointsService.consumeActionPoints('singleTraining')) {
    await ConfirmService.showDanger('行动力消耗失败', '操作失败');
    return;
  }

  // 检查是否已在调教中状态
  if (character.status === 'training') {
    // 返还行动力（已在调教中）
    actionPointsService.refundActionPoints('singleTraining');
    toastRef.value?.warning(`${character.name} 正在调教中，本回合无法再次开启调教对话！`, {
      title: '调教中',
      duration: 3000,
    });
    showCharacterMenu.value = false;
    return;
  }

  // 检查是否已编制
  if (character.status === 'deployed') {
    // 返还行动力（已编制无法调教）
    actionPointsService.refundActionPoints('singleTraining');
    toastRef.value?.warning(`${character.name} 已编制，无法进行调教！`, { title: '无法调教', duration: 3000 });
    showCharacterMenu.value = false;
    return;
  }

  // 检查体力是否过低（基于实际数值，20是体力下限）
  if (character.stamina < 20) {
    // 返还行动力（体力不足）
    actionPointsService.refundActionPoints('singleTraining');
    toastRef.value?.warning(`${character.name} 体力过低，无法开始调教！`, { title: '体力不足', duration: 3000 });
    showCharacterMenu.value = false;
    return;
  }

  selectedCharacter.value = character;
  showCharacterMenu.value = false;
  showManualTraining.value = true;
};

// 关闭手动调教界面
const closeManualTraining = () => {
  showManualTraining.value = false;
  // 不要直接清空 selectedCharacter，让 updateCharacter 方法来处理
  // selectedCharacter.value = null;
};

// 打开换装菜单
const openOutfitMenu = (character: Character) => {
  selectedCharacter.value = character;
  showOutfitModal.value = true;
  showCharacterMenu.value = false;
};

// 关闭换装界面
const closeOutfitModal = () => {
  showOutfitModal.value = false;
  selectedCharacter.value = null;
};

// 保存服装
const saveOutfit = (character: Character) => {
  // 更新本地人物数据
  const index = characters.value.findIndex(c => c.id === character.id);
  if (index > -1) {
    characters.value[index] = character;
  }

  // 保存调教数据
  saveTrainingData();

  // 显示保存成功提示
  toastRef.value?.success(`${character.name} 的服装已保存`, {
    title: '保存成功',
    duration: 2000,
  });
};

// 处理人物卡界面的人物更新事件
const handleCharacterUpdated = (updatedCharacter: Character) => {
  console.log('🔄 [调教界面] 接收到人物更新事件:', updatedCharacter.name);

  // 更新本地人物数据
  const index = characters.value.findIndex(c => c.id === updatedCharacter.id);
  if (index > -1) {
    characters.value[index] = updatedCharacter;
    console.log('✅ [调教界面] 已更新人物列表中的数据');
  }

  // 更新选中的人物
  if (selectedCharacter.value?.id === updatedCharacter.id) {
    selectedCharacter.value = updatedCharacter;
    console.log('✅ [调教界面] 更新选中的人物数据');
  }

  // 保存调教数据
  saveTrainingData();

  // 强制更新界面显示
  applyFilters();

  // 显示成功提示
  toastRef.value?.success(`${updatedCharacter.name} 的数据已更新`, {
    title: '更新成功',
    duration: 3000,
  });
};

// 更新人物数据（融合系统：手动调教结束后自动进行自动调教）
const updateCharacter = (updatedCharacter: Character, shouldTriggerAutoTraining: boolean = true) => {
  console.log('🔄 开始更新人物数据...');
  console.log('📊 接收到的更新数据:', {
    id: updatedCharacter.id,
    name: updatedCharacter.name,
    loyalty: updatedCharacter.loyalty,
    stamina: updatedCharacter.stamina,
    status: updatedCharacter.status,
  });

  // 处理头像切换（基于堕落值变化）
  const index = characters.value.findIndex(c => c.id === updatedCharacter.id);
  const previousCharacter = index > -1 ? characters.value[index] : null;
  const previousLoyalty = previousCharacter?.loyalty || 0;

  const avatarResult = AvatarSwitchService.handleCorruptionChange(updatedCharacter, previousLoyalty);

  if (avatarResult.switched) {
    console.log(
      `🖼️ 头像已切换: ${updatedCharacter.name} 堕落值从 ${previousLoyalty}% 变为 ${updatedCharacter.loyalty}%`,
    );
    console.log(`📊 堕落等级: ${AvatarSwitchService.getCorruptionLevelDescription(updatedCharacter.loyalty)}`);

    // 显示头像切换提示
    toastRef.value?.info(`${updatedCharacter.name} 的堕落值达到 ${updatedCharacter.loyalty}%，头像已切换！`, {
      title: '头像切换',
      duration: 3000,
    });
  }

  // 使用头像切换后的人物对象
  const finalCharacter = avatarResult.character;

  // 保护头像：处理后的角色头像为空时从原角色恢复
  if (!finalCharacter.avatar && updatedCharacter.avatar) {
    finalCharacter.avatar = updatedCharacter.avatar;
  }
  if (!finalCharacter.avatar && previousCharacter?.avatar) {
    finalCharacter.avatar = previousCharacter.avatar;
  }

  // 检查堕落值是否达到100%，提示玩家可以手动触发堕落（已堕落人物不参与判定）
  if (
    finalCharacter.loyalty >= 100 &&
    finalCharacter.status !== 'surrendered' &&
    finalCharacter.status !== 'player' &&
    finalCharacter.status !== 'deployed'
  ) {
    console.log(`${finalCharacter.name} 堕落值达到100%，可以手动触发堕落`);

    // 显示堕落提示，但不自动转换状态
    toastRef.value?.info(`${finalCharacter.name} 堕落值已满，可以点击堕落按钮完成堕落！`, {
      title: '堕落就绪',
      duration: 6000,
    });
  }

  // 更新本地人物数据
  if (index > -1) {
    characters.value[index] = finalCharacter;
    console.log('✅ 已更新人物列表中的数据');

    // 强制触发响应式更新，确保头像变化能及时显示
    forceRefreshCharacterAvatar(finalCharacter.id, finalCharacter.avatar || '');
  } else {
    console.warn('⚠️ 未找到人物在列表中的索引');
  }

  // 更新选中的人物
  if (selectedCharacter.value?.id === finalCharacter.id) {
    selectedCharacter.value = finalCharacter;
    console.log('✅ 更新选中的人物数据');
  }

  // 融合系统：手动调教结束后自动进行自动调教（已堕落人物不参与）
  console.log('🔍 检查自动调教条件:', {
    shouldTriggerAutoTraining,
    characterStatus: finalCharacter.status,
    isImprisonedOrTraining: finalCharacter.status === 'imprisoned' || finalCharacter.status === 'training',
    selectedCharacterId: selectedCharacter.value?.id,
    finalCharacterId: finalCharacter.id,
    isSameCharacter: selectedCharacter.value?.id === finalCharacter.id,
  });

  if (
    shouldTriggerAutoTraining &&
    finalCharacter.status !== 'surrendered' && // 已堕落人物不参与自动调教
    (finalCharacter.status === 'imprisoned' || finalCharacter.status === 'training') &&
    selectedCharacter.value?.id === finalCharacter.id
  ) {
    console.log('🎯 手动调教结束，开始自动调教流程...');

    // 设置调教状态
    finalCharacter.status = 'training';
    finalCharacter.lastTraining = new Date();

    // 调教立即消耗体力
    const oldStamina = finalCharacter.stamina;
    finalCharacter.stamina = Math.max(0, finalCharacter.stamina - 20);
    console.log(`💪 体力扣除: ${oldStamina} -> ${finalCharacter.stamina} (扣除20点)`);

    // 检查是否死亡 - 已注释掉
    // if (finalCharacter.stamina <= 0) {
    //   executeCharacter(finalCharacter);
    //   return;
    // }

    // 更新本地数据
    if (index > -1) {
      characters.value[index] = finalCharacter;
    }
    if (selectedCharacter.value?.id === finalCharacter.id) {
      selectedCharacter.value = finalCharacter;
    }

    // 显示融合调教提示
    toastRef.value?.success(`${finalCharacter.name} 手动调教完成，已自动开始调教流程，将在下回合完成`, {
      title: '融合调教',
      duration: 4000,
    });
  }

  // 保存数据到存档系统
  saveTrainingData();

  // 强制保存到酒馆存档
  modularSaveManager.saveCurrentGameData(0);

  // 强制更新界面显示
  applyFilters();

  console.log('✅ 人物数据更新完成');
};

// 触发堕落
const triggerCorruption = async (character: Character) => {
  // 检查人物状态，已编制的人物无法堕落
  if (character.status === 'deployed') {
    toastRef.value?.warning(`${character.name} 已编制，无法进行堕落！`, {
      title: '无法堕落',
      duration: 3000,
    });
    return;
  }

  // 检查人物状态，已堕落的人物无法再次堕落
  if (character.status === 'surrendered') {
    toastRef.value?.warning(`${character.name} 已经堕落，无需再次堕落！`, {
      title: '已堕落',
      duration: 3000,
    });
    return;
  }

  const confirmed = await ConfirmService.showWarning(
    `确定要让 ${character.name} 完成堕落吗？`,
    '确认堕落',
    `堕落完成后，${character.name} 将对主人绝对忠诚！\n\n堕落值：${character.loyalty}%\n\n此操作不可逆转！`,
  );
  if (confirmed) {
    // 播放堕落动画
    await playCorruptionAnimation(character);

    // 计算堕落威胁度增加（根据人物稀有度）
    const threatMultiplier = {
      S: 3,
      A: 2.5,
      B: 2,
      C: 1.5,
      D: 1,
    };

    const baseThreat = 25;

    const characterRating = character.rating || 'D';
    const multiplier = threatMultiplier[characterRating] || 1;
    const threatReward = Math.floor(baseThreat * multiplier);

    // 只增加威胁度
    modularSaveManager.addResource('threat', threatReward, `堕落${character.name}获得`);

    // 更新人物状态为已堕落
    character.status = 'surrendered';
    console.log(`${character.name} 已完成堕落，状态已更新为已堕落`);

    // 切换到完全堕落头像
    let corruptedCharacter = AvatarSwitchService.switchToFullyCorruptedAvatar(character);
    console.log(`🖼️ ${character.name} 头像已切换到完全堕落状态`);

    // 切换到堕落衣着
    corruptedCharacter = ClothingSwitchService.switchToCorruptedClothing(corruptedCharacter);
    console.log(`👗 ${character.name} 衣着已切换到堕落状态`);

    // 更新世界书描述
    await WorldbookService.updateCharacterEntry(corruptedCharacter);

    // 更新本地人物数据
    const index = characters.value.findIndex(c => c.id === character.id);
    if (index > -1) {
      characters.value[index] = corruptedCharacter;
    }

    // 更新选中的人物
    if (selectedCharacter.value?.id === character.id) {
      selectedCharacter.value = corruptedCharacter;
    }

    // 强制刷新头像显示
    forceRefreshCharacterAvatar(corruptedCharacter.id, corruptedCharacter.avatar || '');

    // 保存调教数据（参考换装界面的保存方式）
    saveTrainingData();

    // 保存到存档系统
    modularSaveManager.saveCurrentGameData(0);

    // 显示堕落完成提示（包含衣着切换信息）
    const hasCorruptedClothing = !!corruptedCharacter.appearance?.corruptedClothing;
    const clothingChange = hasCorruptedClothing ? '，衣着已切换为堕落装扮！' : '';

    // 显示堕落完成提示
    toastRef.value?.success(
      `堕落成功！${corruptedCharacter.name} 已完全堕落，对主人绝对忠诚！${clothingChange} 威胁度增加：⚠️ +${threatReward}。`,
      { title: '堕落完成', duration: 5000 },
    );
  }
};

// 播放堕落动画
const playCorruptionAnimation = async (character: Character): Promise<void> => {
  return new Promise(resolve => {
    // 创建堕落动画效果
    const animationElement = document.createElement('div');
    animationElement.className = 'corruption-animation';
    animationElement.innerHTML = `
      <div class="corruption-backdrop">
        <div class="corruption-particles">
          <div class="particle"></div>
          <div class="particle"></div>
          <div class="particle"></div>
          <div class="particle"></div>
          <div class="particle"></div>
          <div class="particle"></div>
          <div class="particle"></div>
          <div class="particle"></div>
        </div>
        <div class="corruption-rings">
          <div class="ring ring-1"></div>
          <div class="ring ring-2"></div>
          <div class="ring ring-3"></div>
        </div>
        <div class="corruption-symbols">
          <div class="symbol symbol-1">⚠</div>
          <div class="symbol symbol-2">⚡</div>
          <div class="symbol symbol-3">🔥</div>
          <div class="symbol symbol-4">💀</div>
        </div>
        <div class="corruption-content">
          <div class="corruption-title">堕落仪式</div>
          <div class="corruption-name">${character.name}</div>
          <div class="corruption-progress">
            <div class="progress-bar">
              <div class="progress-fill"></div>
            </div>
          </div>
          <div class="corruption-status">正在完成堕落转化...</div>
        </div>
      </div>
    `;

    // 添加动画样式
    const style = document.createElement('style');
    style.textContent = `
      .corruption-animation {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 999999;
        pointer-events: none;
        animation: fadeInBackdrop 0.3s ease-out;
      }

      @keyframes fadeInBackdrop {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      .corruption-backdrop {
        width: 100%;
        height: 100%;
        background: radial-gradient(circle at center, rgba(139, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.95) 70%);
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        overflow: hidden;
      }

      .corruption-particles {
        position: absolute;
        width: 100%;
        height: 100%;
      }

      .corruption-particles .particle {
        position: absolute;
        width: 4px;
        height: 4px;
        background: radial-gradient(circle, rgba(255, 69, 0, 0.9), transparent);
        border-radius: 50%;
        animation: floatParticle 3s ease-in-out infinite;
      }

      .corruption-particles .particle:nth-child(1) {
        left: 10%;
        top: 20%;
        animation-delay: 0s;
      }

      .corruption-particles .particle:nth-child(2) {
        left: 30%;
        top: 10%;
        animation-delay: 0.5s;
      }

      .corruption-particles .particle:nth-child(3) {
        left: 60%;
        top: 15%;
        animation-delay: 1s;
      }

      .corruption-particles .particle:nth-child(4) {
        left: 80%;
        top: 25%;
        animation-delay: 1.5s;
      }

      .corruption-particles .particle:nth-child(5) {
        left: 15%;
        bottom: 20%;
        animation-delay: 0.3s;
      }

      .corruption-particles .particle:nth-child(6) {
        left: 50%;
        bottom: 15%;
        animation-delay: 0.8s;
      }

      .corruption-particles .particle:nth-child(7) {
        right: 15%;
        bottom: 25%;
        animation-delay: 1.2s;
      }

      .corruption-particles .particle:nth-child(8) {
        right: 10%;
        top: 30%;
        animation-delay: 1.7s;
      }

      @keyframes floatParticle {
        0%, 100% {
          transform: translateY(0) translateX(0);
          opacity: 0.3;
        }
        50% {
          transform: translateY(-30px) translateX(20px);
          opacity: 1;
        }
      }

      .corruption-rings {
        position: absolute;
        width: 100%;
        height: 100%;
      }

      .corruption-rings .ring {
        position: absolute;
        border: 3px solid rgba(255, 69, 0, 0.3);
        border-radius: 50%;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        animation: ringPulse 2s ease-out infinite;
      }

      .ring-1 {
        width: 200px;
        height: 200px;
        animation-delay: 0s;
      }

      .ring-2 {
        width: 350px;
        height: 350px;
        border-color: rgba(255, 140, 0, 0.4);
        animation-delay: 0.3s;
      }

      .ring-3 {
        width: 500px;
        height: 500px;
        border-color: rgba(255, 99, 71, 0.3);
        animation-delay: 0.6s;
      }

      @keyframes ringPulse {
        0% {
          transform: translate(-50%, -50%) scale(0.8);
          opacity: 1;
        }
        100% {
          transform: translate(-50%, -50%) scale(1.3);
          opacity: 0;
        }
      }

      .corruption-symbols {
        position: absolute;
        width: 100%;
        height: 100%;
      }

      .corruption-symbols .symbol {
        position: absolute;
        font-size: 48px;
        animation: symbolFloat 2.5s ease-in-out infinite;
        filter: drop-shadow(0 0 10px rgba(255, 69, 0, 0.8));
      }

      .symbol-1 {
        top: 20%;
        left: 15%;
        animation-delay: 0s;
      }

      .symbol-2 {
        top: 15%;
        right: 20%;
        animation-delay: 0.6s;
      }

      .symbol-3 {
        bottom: 25%;
        left: 20%;
        animation-delay: 1.2s;
      }

      .symbol-4 {
        bottom: 20%;
        right: 15%;
        animation-delay: 1.8s;
      }

      @keyframes symbolFloat {
        0%, 100% {
          transform: translateY(0) rotate(0deg);
          opacity: 0.6;
        }
        50% {
          transform: translateY(-15px) rotate(10deg);
          opacity: 1;
        }
      }

      .corruption-content {
        position: relative;
        z-index: 10;
        text-align: center;
        color: #ffd7a1;
        animation: contentSlideIn 0.5s ease-out;
      }

      @keyframes contentSlideIn {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .corruption-title {
        font-size: 48px;
        font-weight: bold;
        color: #ff6b6b;
        text-shadow: 
          0 0 10px rgba(255, 69, 0, 0.8),
          0 0 20px rgba(255, 69, 0, 0.6),
          0 0 30px rgba(255, 69, 0, 0.4);
        margin-bottom: 20px;
        animation: titleGlow 2s ease-in-out infinite;
        letter-spacing: 4px;
      }

      @keyframes titleGlow {
        0%, 100% {
          text-shadow: 
            0 0 10px rgba(255, 69, 0, 0.8),
            0 0 20px rgba(255, 69, 0, 0.6),
            0 0 30px rgba(255, 69, 0, 0.4);
        }
        50% {
          text-shadow: 
            0 0 20px rgba(255, 69, 0, 1),
            0 0 40px rgba(255, 69, 0, 0.8),
            0 0 60px rgba(255, 69, 0, 0.6);
        }
      }

      .corruption-name {
        font-size: 32px;
        font-weight: 600;
        color: #ffd7a1;
        margin-bottom: 40px;
        text-shadow: 
          0 2px 10px rgba(0, 0, 0, 0.8),
          0 0 20px rgba(255, 140, 0, 0.5);
        animation: namePulse 1.5s ease-in-out infinite;
      }

      @keyframes namePulse {
        0%, 100% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.05);
        }
      }

      .corruption-progress {
        width: 400px;
        margin: 0 auto 20px;
      }

      .progress-bar {
        width: 100%;
        height: 12px;
        background: rgba(40, 26, 20, 0.8);
        border: 2px solid rgba(255, 69, 0, 0.5);
        border-radius: 10px;
        overflow: hidden;
        position: relative;
      }

      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, 
          rgba(255, 69, 0, 0.8) 0%, 
          rgba(255, 140, 0, 0.9) 50%,
          rgba(255, 69, 0, 0.8) 100%);
        animation: progressFill 2s ease-out forwards;
        box-shadow: 0 0 20px rgba(255, 69, 0, 0.6);
      }

      @keyframes progressFill {
        from {
          width: 0%;
        }
        to {
          width: 100%;
        }
      }

      .corruption-status {
        font-size: 20px;
        color: #ffbd7a;
        text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
        animation: statusBlink 1s ease-in-out infinite;
      }

      @keyframes statusBlink {
        0%, 100% {
          opacity: 0.7;
        }
        50% {
          opacity: 1;
        }
      }
    `;

    document.head.appendChild(style);

    // 根据是否在全屏模式，将动画添加到正确的位置
    const targetParent = document.fullscreenElement || document.body;
    targetParent.appendChild(animationElement);

    // 2秒后移除动画
    setTimeout(() => {
      targetParent.removeChild(animationElement);
      document.head.removeChild(style);
      resolve();
    }, 2000);
  });
};

// 处决人物
const executeCharacter = async (character: Character) => {
  const confirmed = await ConfirmService.showDanger(
    `确定要处决 ${character.name} 吗？`,
    '确认处决',
    `处决后将获得资源奖励，但人物将永久消失！\n\n人物评级：${character.rating || '未评级'}`,
  );
  if (confirmed) {
    // 计算处决奖励（根据人物稀有度）
    const rewardMultiplier = {
      S: 3,
      A: 2.5,
      B: 2,
      C: 1.5,
      D: 1,
    };

    const baseGold = 1000;
    const baseFood = 500;

    const characterRating = character.rating || 'D';
    const multiplier = rewardMultiplier[characterRating] || 1;
    const goldReward = Math.floor(baseGold * multiplier);
    const foodReward = Math.floor(baseFood * multiplier);

    // 添加资源奖励（处决不再增加威胁度）
    modularSaveManager.addResource('gold', goldReward, `处决${character.name}获得`);
    modularSaveManager.addResource('food', foodReward, `处决${character.name}获得`);

    // 从人物列表中移除
    const index = characters.value.findIndex(c => c.id === character.id);
    if (index > -1) {
      characters.value.splice(index, 1);
    }

    // 从世界书中删除人物条目和剧情记录
    try {
      await WorldbookService.deleteCharacterEntry(character.id);
      await WorldbookService.deleteCharacterStoryHistoryEntry(character.name);
      console.log(`已从世界书中删除人物 ${character.name} 及其剧情记录`);
    } catch (error) {
      console.error('删除世界书条目失败:', error);
    }

    // 保存调教数据
    saveTrainingData();

    // 关闭悬浮盘和详情弹窗
    showCharacterMenu.value = false;
    closeCharacterModal();

    // 显示处决成功消息
    toastRef.value?.success(
      `处决成功！获得奖励：💰 金币 +${goldReward}，🍖 食物 +${foodReward}。${character.name} 已被永久处决。`,
      { title: '处决完成', duration: 5000 },
    );

    // 直接更新界面，不需要重新加载数据
    applyFilters();
  }
};

// 编辑头像
const editAvatar = (character: Character) => {
  editingCharacter.value = character;
  showAvatarModal.value = true;
};

// 关闭头像弹窗
const closeAvatarModal = () => {
  showAvatarModal.value = false;
  editingCharacter.value = null;
};

// 处理头像更新（来自头像编辑组件）
const handleAvatarUpdated = (updatedCharacter: Character) => {
  // 同步更新到人物列表和选中人物
  const index = characters.value.findIndex(c => c.id === updatedCharacter.id);
  if (index > -1) {
    characters.value[index] = { ...updatedCharacter };
    console.log('✅ [头像编辑] 已更新人物列表中的数据');
  }

  // 更新选中的人物（如果当前编辑的人物是选中的人物）
  if (selectedCharacter.value?.id === updatedCharacter.id) {
    selectedCharacter.value = { ...updatedCharacter };
    console.log('✅ [头像编辑] 已更新选中的人物数据');
  }

  // 如果是正常头像，也要强制刷新显示
  if (updatedCharacter.avatar) {
    forceRefreshCharacterAvatar(updatedCharacter.id, updatedCharacter.avatar);
  }

  // 保存数据
  saveTrainingData();
};

// 处理图片加载错误
const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement;
  if (!img || img.dataset.fb) return;
  img.dataset.fb = '1';

  // 确定性兜底：使用原src的hash
  let hash = 0;
  const src = img.src || img.getAttribute('src') || '';
  for (let i = 0; i < src.length; i++) {
    hash = ((hash << 5) - hash) + src.charCodeAt(i);
    hash = hash & hash;
  }
  const seed = Math.abs(hash);

  fetch('/api/images/assign/' + seed)
    .then((r) => r.json())
    .then((d) => {
      if (d.url) {
        img.src = d.url;
        img.style.display = '';
      }
    })
    .catch(() => {});
};

// 强制刷新人物头像显示
const forceRefreshCharacterAvatar = (characterId: string, newAvatarUrl: string) => {
  nextTick(() => {
    const characterElement = document.querySelector(`[data-character-id="${characterId}"]`);
    if (characterElement) {
      const imgElement = characterElement.querySelector('.character-portrait img') as HTMLImageElement;
      if (imgElement) {
        // 检查是否是base64 data URL，如果是就不添加时间戳（data URL不支持查询参数）
        if (newAvatarUrl?.startsWith('data:')) {
          // base64 data URL直接使用，不添加时间戳
          imgElement.src = newAvatarUrl;
          console.log(`🔄 强制刷新人物 ${characterId} 的头像显示（base64格式）`);
        } else {
          // 普通URL添加时间戳防止缓存
          const timestamp = new Date().getTime();
          const separator = newAvatarUrl?.includes('?') ? '&' : '?';
          imgElement.src = `${newAvatarUrl}${separator}t=${timestamp}`;
          console.log(`🔄 强制刷新人物 ${characterId} 的头像显示`);
        }
      }
    }
  });
};

// 获取状态文本
const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    imprisoned: '关押中',
    training: '调教中',
    breeding: '交配中',
    surrendered: '已堕落',
    deployed: '已编制',
  };
  return statusMap[status] || '未知';
};

// 获取评级样式类
const getRatingClass = (rating: string) => {
  return `rating-${rating.toLowerCase()}`;
};

// 批量调教
const batchTraining = async () => {
  // 检查行动力
  if (!actionPointsService.hasEnoughActionPoints('batchTraining')) {
    await ConfirmService.showWarning(
      actionPointsService.getInsufficientActionPointsMessage('batchTraining'),
      '行动力不足',
      '请等待下回合恢复行动力或征服更多区域增加上限',
    );
    return;
  }

  // 消耗行动力
  if (!actionPointsService.consumeActionPoints('batchTraining')) {
    await ConfirmService.showDanger('行动力消耗失败', '操作失败');
    return;
  }

  // 只对关押中且未堕落的人物进行批量调教，且需要开启一键调教开关
  const imprisonedCharacters = characters.value.filter(
    c => c.status === 'imprisoned' && c.stamina >= 20 && c.autoTrainEnabled !== false,
  );

  if (imprisonedCharacters.length === 0) {
    // 返还行动力（没有符合条件的人物）
    actionPointsService.refundActionPoints('batchTraining');
    toastRef.value?.warning('没有符合调教条件的人物！', { title: '无法调教', duration: 3000 });
    return;
  }

  // 批量调教时，跳过单次调教的行动力检查（因为已经统一消耗了批量调教的行动力）
  imprisonedCharacters.forEach(character => {
    startTraining(character, true);
  });
};

// 批量生育
const batchBreeding = async () => {
  // 检查行动力
  if (!actionPointsService.hasEnoughActionPoints('batchBreeding')) {
    await ConfirmService.showWarning(
      actionPointsService.getInsufficientActionPointsMessage('batchBreeding'),
      '行动力不足',
      '请等待下回合恢复行动力或征服更多区域增加上限',
    );
    return;
  }

  // 消耗行动力
  if (!actionPointsService.consumeActionPoints('batchBreeding')) {
    await ConfirmService.showDanger('行动力消耗失败', '操作失败');
    return;
  }

  // 筛选符合生育条件的人物，且需要开启一键生育开关
  const eligibleCharacters = characters.value.filter(
    c => (c.status === 'imprisoned' || c.status === 'surrendered') && c.stamina >= 20 && c.autoBreedEnabled !== false,
  );

  if (eligibleCharacters.length === 0) {
    // 返还行动力（没有符合条件的人物）
    actionPointsService.refundActionPoints('batchBreeding');
    toastRef.value?.warning('没有符合生育条件的人物！', { title: '无法生育', duration: 3000 });
    return;
  }

  // 检查可用的交配间
  const availableBreedingRooms = await checkAvailableBreedingRooms();
  if (availableBreedingRooms.length === 0) {
    // 返还行动力（没有可用设施）
    actionPointsService.refundActionPoints('batchBreeding');
    toastRef.value?.warning('没有可用的交配间，请先在巢穴界面建设繁殖间！', { title: '缺少设施', duration: 4000 });
    return;
  }

  // 如果繁殖间数量不足，显示确认框
  if (availableBreedingRooms.length < eligibleCharacters.length) {
    const confirmed = await ConfirmService.showWarning(
      `检测到繁殖间数量不足！`,
      '确认批量生育',
      `当前有 ${eligibleCharacters.length} 个人物符合生育条件，但只有 ${availableBreedingRooms.length} 个繁殖间可用。\n\n继续操作将按优先级为前 ${availableBreedingRooms.length} 个人物分配繁殖间，剩余 ${eligibleCharacters.length - availableBreedingRooms.length} 个人物将无法进行生育。\n\n是否继续？`,
    );

    if (!confirmed) {
      // 返还行动力（用户取消）
      actionPointsService.refundActionPoints('batchBreeding');
      return;
    }
  }

  let successCount = 0;
  let roomIndex = 0;

  // 为每个符合条件的人物分配交配间
  for (const character of eligibleCharacters) {
    if (roomIndex >= availableBreedingRooms.length) {
      toastRef.value?.warning(
        `只有 ${availableBreedingRooms.length} 个交配间可用，剩余 ${eligibleCharacters.length - successCount} 个人物无法进行生育！`,
        {
          title: '交配间不足',
          duration: 4000,
        },
      );
      break;
    }

    // 分配交配间
    const assignedRoom = availableBreedingRooms[roomIndex];
    character.locationId = assignedRoom.id;

    // 保存原始状态，用于生育完成后恢复
    character.originalStatus = character.status;
    character.status = 'breeding';

    // 交配立即消耗体力
    character.stamina = Math.max(0, character.stamina - 20);

    // 检查是否死亡 - 已注释掉
    // if (character.stamina <= 0) {
    //   executeCharacter(character);
    //   continue;
    // }

    successCount++;
    roomIndex++;
  }

  // 保存调教数据
  saveTrainingData();

  // 显示结果提示
  if (successCount > 0) {
    toastRef.value?.success(`成功为 ${successCount} 个人物开始生育，将在下回合完成`, {
      title: '批量生育',
      duration: 4000,
    });
  }
};

// 切换收藏状态
const toggleFavorite = (character: Character) => {
  character.favorite = !character.favorite;
  applyFilters();

  // 保存调教数据
  saveTrainingData();
};

// 切换一键调教开关
const toggleAutoTrain = (character: Character) => {
  // 如果未定义或为 true，则设置为 false；否则设置为 true
  character.autoTrainEnabled = character.autoTrainEnabled !== false ? false : true;

  // 更新本地人物数据
  const index = characters.value.findIndex(c => c.id === character.id);
  if (index > -1) {
    characters.value[index].autoTrainEnabled = character.autoTrainEnabled;
  }

  // 更新选中的字符
  if (selectedCharacter.value?.id === character.id) {
    selectedCharacter.value.autoTrainEnabled = character.autoTrainEnabled;
  }

  // 显示提示
  const statusText = character.autoTrainEnabled ? '已开启' : '已关闭';
  const actionText = character.autoTrainEnabled ? '支持一键调教' : '跳过一键调教，需手动操作';
  if (character.autoTrainEnabled) {
    toastRef.value?.success(`${character.name} 调教设置 ${statusText}：${actionText}`, {
      title: '一键调教设置',
      duration: 1000,
    });
  } else {
    toastRef.value?.warning(`${character.name} 调教设置 ${statusText}：${actionText}`, {
      title: '一键调教设置',
      duration: 1000,
    });
  }

  // 保存调教数据
  saveTrainingData();
};

// 切换一键生育开关
const toggleAutoBreed = (character: Character) => {
  // 如果未定义或为 true，则设置为 false；否则设置为 true
  character.autoBreedEnabled = character.autoBreedEnabled !== false ? false : true;

  // 更新本地人物数据
  const index = characters.value.findIndex(c => c.id === character.id);
  if (index > -1) {
    characters.value[index].autoBreedEnabled = character.autoBreedEnabled;
  }

  // 更新选中的字符
  if (selectedCharacter.value?.id === character.id) {
    selectedCharacter.value.autoBreedEnabled = character.autoBreedEnabled;
  }

  // 显示提示
  const statusText = character.autoBreedEnabled ? '已开启' : '已关闭';
  const actionText = character.autoBreedEnabled ? '支持一键生育' : '跳过一键生育，需手动操作';
  if (character.autoBreedEnabled) {
    toastRef.value?.success(`${character.name} 生育设置 ${statusText}：${actionText}`, {
      title: '一键生育设置',
      duration: 1000,
    });
  } else {
    toastRef.value?.warning(`${character.name} 生育设置 ${statusText}：${actionText}`, {
      title: '一键生育设置',
      duration: 1000,
    });
  }

  // 保存调教数据
  saveTrainingData();
};

// 显示自定义确认框
const showCustomConfirmDialog = (config: {
  title: string;
  message: string;
  details?: string;
  type?: 'info' | 'warning' | 'danger' | 'success';
  onConfirm?: () => void;
  onCancel?: () => void;
}) => {
  confirmConfig.value = {
    title: config.title,
    message: config.message,
    details: config.details || '',
    type: config.type || 'warning',
    onConfirm: config.onConfirm || (() => {}),
    onCancel: config.onCancel || (() => {}),
  };
  showCustomConfirm.value = true;
};

// 处理确认框确认
const handleConfirmDialogConfirm = () => {
  confirmConfig.value.onConfirm();
  showCustomConfirm.value = false;
};

// 处理确认框取消
const handleConfirmDialogCancel = () => {
  confirmConfig.value.onCancel();
  showCustomConfirm.value = false;
};

// 处理交配按钮点击
const handleFertilityClick = (character: Character) => {
  // 检查是否已编制
  if (character.status === 'deployed') {
    showCustomConfirmDialog({
      title: '无法交配',
      message: `${character.name} 已编制，无法进行交配！`,
      details: '已编制的人物需要先解除编制才能进行交配。',
      type: 'warning',
    });
    return;
  }

  // 检查是否已在交配中
  if (character.status === 'breeding') {
    showCustomConfirmDialog({
      title: '正在交配中',
      message: `${character.name} 正在交配中，无法重复交配！`,
      details: '请等待当前交配完成后再进行下一次交配。',
      type: 'info',
    });
    return;
  }

  // 检查是否正在调教中
  if (character.status === 'training') {
    showCustomConfirmDialog({
      title: '正在调教中',
      message: `${character.name} 正在调教中，无法进行交配！`,
      details: '请等待调教完成后再进行交配。',
      type: 'info',
    });
    return;
  }

  // 检查体力是否过低
  if (character.stamina < 20) {
    showCustomConfirmDialog({
      title: '体力不足',
      message: `${character.name} 体力过低，无法进行交配！`,
      details: `当前体力：${character.stamina}/${character.maxStamina}\n需要至少20点体力才能进行交配。\n\n未交配和调教状态的人物，每回合会自然回复。`,
      type: 'warning',
    });
    return;
  }

  // 如果所有条件都满足，开始交配
  startFertility(character);
};

// 显示放大头像
const showEnlargedAvatar = (character: Character) => {
  // 标记为双击，防止触发单击事件
  isDoubleClick = true;
  if (clickTimer) {
    clearTimeout(clickTimer);
    clickTimer = null;
  }

  if (!character.avatar) {
    toastRef.value?.info('该人物还没有头像', { title: '提示', duration: 2000 });
    return;
  }
  enlargedAvatarCharacter.value = character;
  showEnlargedAvatarModal.value = true;
};

// 关闭放大头像弹窗
const closeEnlargedAvatar = () => {
  showEnlargedAvatarModal.value = false;
  enlargedAvatarCharacter.value = null;
};

// 处理手动调教按钮点击
const handleManualTrainingClick = (character: Character) => {
  // 检查是否已编制
  if (character.status === 'deployed') {
    showCustomConfirmDialog({
      title: '无法调教',
      message: `${character.name} 已编制，无法进行调教！`,
      details: '已编制的人物需要先解除编制才能进行调教。',
      type: 'warning',
    });
    return;
  }

  // 检查是否正在调教中
  if (character.status === 'training') {
    showCustomConfirmDialog({
      title: '正在调教中',
      message: `${character.name} 正在调教中，本回合无法再次开启调教对话！`,
      details: '请等待当前调教完成后再进行下一次调教。',
      type: 'info',
    });
    return;
  }

  // 检查是否正在交配中
  if (character.status === 'breeding') {
    showCustomConfirmDialog({
      title: '正在交配中',
      message: `${character.name} 正在交配中，无法进行调教！`,
      details: '请等待交配完成后再进行调教。',
      type: 'info',
    });
    return;
  }

  // 检查体力是否过低
  if (character.stamina < 20) {
    showCustomConfirmDialog({
      title: '体力不足',
      message: `${character.name} 体力过低，无法开始调教！`,
      details: `当前体力：${character.stamina}/${character.maxStamina}\n需要至少20点体力才能进行调教。\n\n未调教和生育状态的人物，每回合会自然回复。`,
      type: 'warning',
    });
    return;
  }

  // 如果所有条件都满足，开始手动调教
  startManualTraining(character);
};

// 应用排序
const applyFilters = () => {
  const filtered = [...characters.value];

  // 按稀有度排序（收藏在前，然后按评级排序）
  filtered.sort((a, b) => {
    // 收藏的优先
    if (a.favorite && !b.favorite) return -1;
    if (!a.favorite && b.favorite) return 1;

    // 按评级排序（S > A > B > C > D）
    const ratingOrder = { S: 5, A: 4, B: 3, C: 2, D: 1 };
    const aRating = ratingOrder[a.rating || 'D'];
    const bRating = ratingOrder[b.rating || 'D'];
    if (aRating === undefined || bRating === undefined) return 0;

    return bRating - aRating;
  });

  filteredCharacters.value = filtered;
};

// 组件挂载时初始化
onMounted(async () => {
  await loadTrainingData(true);
  applyFilters();
  // 打开调教界面时更新调教人物数量
  updateTrainingCharactersCount();
});

// 获取当前路由
const route = useRoute();

// 组件激活时刷新数据（防止重复加载）
onActivated(async () => {
  console.log('🔄 调教界面 onActivated 被触发');
  // 为避免切换首页返回导致的重复，统一强制全量重载并替换
  await loadTrainingData(true);
  applyFilters();
  // 每次激活调教界面时更新调教人物数量
  updateTrainingCharactersCount();
  console.log('✅ 调教界面数据刷新完成');
});

// 监听人物等级更新事件，实时刷新数据
eventOn('人物等级更新', () => {
  console.log('🔄 收到人物等级更新事件，刷新调教界面数据');
  loadTrainingData(true).then(() => {
    applyFilters();
    updateTrainingCharactersCount();
    console.log('✅ 人物等级更新触发的数据刷新完成');
  });
});

// 监听路由变化，作为 onActivated 的备用方案
watch(
  () => route.path,
  async (newPath, oldPath) => {
    if (newPath === '/调教' && oldPath === '/部队编制') {
      console.log('🔄 检测到从编制界面切换到调教界面，强制刷新数据');
      await loadTrainingData(true);
      applyFilters();
      updateTrainingCharactersCount();
      console.log('✅ 路由切换触发的数据刷新完成');
    }
  },
  { immediate: false },
);
</script>

<style scoped lang="scss">
.training-panel {
  height: calc(100vh - 90px);
  width: 100%;
  max-width: 100%;
  padding: 16px;
  background: linear-gradient(180deg, rgba(40, 26, 20, 0.6), rgba(25, 17, 14, 0.85));
  border: 1px solid rgba(205, 133, 63, 0.25);
  border-radius: 12px;
  box-shadow:
    inset 0 1px 0 rgba(255, 200, 150, 0.08),
    0 8px 18px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  position: relative;
  box-sizing: border-box;
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(205, 133, 63, 0.2);
  flex-shrink: 0;

  .panel-title {
    margin: 0;
    color: #ffd7a1;
    text-shadow:
      0 2px 6px rgba(0, 0, 0, 0.6),
      0 0 10px rgba(255, 120, 40, 0.2);
    font-size: 18px;
  }

  .batch-buttons {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .batch-train-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: linear-gradient(180deg, rgba(34, 197, 94, 0.2), rgba(28, 20, 17, 0.9));
    border: 1px solid rgba(34, 197, 94, 0.3);
    border-radius: 8px;
    padding: 8px 12px;
    color: #22c55e;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover:not(:disabled) {
      background: linear-gradient(180deg, rgba(34, 197, 94, 0.3), rgba(28, 20, 17, 0.95));
      border-color: rgba(34, 197, 94, 0.5);
      transform: translateY(-1px);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-icon {
      font-size: 14px;
    }

    .btn-text {
      font-size: 12px;
    }
  }

  .batch-breed-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: linear-gradient(180deg, rgba(168, 85, 247, 0.2), rgba(28, 20, 17, 0.9));
    border: 1px solid rgba(168, 85, 247, 0.3);
    border-radius: 8px;
    padding: 8px 12px;
    color: #a855f7;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover:not(:disabled) {
      background: linear-gradient(180deg, rgba(168, 85, 247, 0.3), rgba(28, 20, 17, 0.95));
      border-color: rgba(168, 85, 247, 0.5);
      transform: translateY(-1px);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-icon {
      font-size: 14px;
    }

    .btn-text {
      font-size: 12px;
    }
  }
}

.characters-grid {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 8px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
  align-content: start;

  // 自定义滚动条样式
  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(44, 30, 24, 0.3);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, rgba(205, 133, 63, 0.6), rgba(139, 69, 19, 0.8));
    border-radius: 4px;
    transition: all 0.2s ease;

    &:hover {
      background: linear-gradient(180deg, rgba(205, 133, 63, 0.8), rgba(139, 69, 19, 1));
    }
  }

  // Firefox 滚动条样式
  scrollbar-width: thin;
  scrollbar-color: rgba(205, 133, 63, 0.6) rgba(44, 30, 24, 0.3);
}

.character-card {
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
  width: 120px;
  height: 240px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;

  // S级 - 暗红色闪光
  &.rating-s {
    border: 3px solid rgba(220, 20, 60, 0.9);
    box-shadow:
      inset 0 1px 0 rgba(255, 100, 100, 0.2),
      0 0 25px rgba(220, 20, 60, 0.6),
      0 0 50px rgba(220, 20, 60, 0.3),
      0 4px 12px rgba(0, 0, 0, 0.4);
    animation: sRatingGlow 2s ease-in-out infinite alternate;
  }

  // A级 - 金色
  &.rating-a {
    border: 3px solid rgba(255, 215, 0, 0.8);
    box-shadow:
      inset 0 1px 0 rgba(255, 200, 150, 0.08),
      0 0 20px rgba(255, 215, 0, 0.4),
      0 4px 12px rgba(0, 0, 0, 0.4);
  }

  // B级 - 银色
  &.rating-b {
    border: 3px solid rgba(192, 192, 192, 0.8);
    box-shadow:
      inset 0 1px 0 rgba(255, 200, 150, 0.08),
      0 0 15px rgba(192, 192, 192, 0.4),
      0 4px 12px rgba(0, 0, 0, 0.4);
  }

  // C级 - 黑色
  &.rating-c {
    border: 3px solid rgba(32, 32, 32, 0.8);
    box-shadow:
      inset 0 1px 0 rgba(255, 200, 150, 0.08),
      0 0 10px rgba(64, 64, 64, 0.3),
      0 4px 12px rgba(0, 0, 0, 0.4);
  }

  // D级 - 无特效
  &.rating-d {
    border: 2px solid rgba(205, 133, 63, 0.3);
    box-shadow:
      inset 0 1px 0 rgba(255, 200, 150, 0.08),
      0 4px 12px rgba(0, 0, 0, 0.4);
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow:
      inset 0 1px 0 rgba(255, 200, 150, 0.12),
      0 6px 16px rgba(0, 0, 0, 0.5);
    border-color: rgba(205, 133, 63, 0.5);
  }

  &.selected {
    border-color: rgba(244, 184, 184, 0.8);
    box-shadow:
      inset 0 1px 0 rgba(255, 200, 150, 0.12),
      0 0 20px rgba(255, 120, 60, 0.4);
  }
}

// S级闪光动画
@keyframes sRatingGlow {
  0% {
    box-shadow:
      inset 0 1px 0 rgba(255, 100, 100, 0.2),
      0 0 10px rgba(220, 20, 60, 0.6),
      0 0 10px rgba(220, 20, 60, 0.3),
      0 4px 12px rgba(0, 0, 0, 0.4);
  }
  10% {
    box-shadow:
      inset 0 1px 0 rgba(255, 100, 100, 0.3),
      0 0 10px rgba(220, 20, 60, 0.8),
      0 0 10px rgba(220, 20, 60, 0.5),
      0 4px 12px rgba(0, 0, 0, 0.4);
  }
}

// 人物肖像图片区域
.character-portrait {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  z-index: 2;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .default-portrait {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, rgba(205, 133, 63, 0.3), rgba(255, 120, 60, 0.2));
    display: flex;
    align-items: center;
    justify-content: center;

    .portrait-icon {
      font-size: 64px;
      opacity: 0.8;
    }
  }
}

// 状态标识
.character-status-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 8px;
  font-weight: 600;
  text-align: center;
  z-index: 3;
  @media (min-width: 769px) {
    top: 8px;
    right: 8px;
    padding: 4px 6px;
    font-size: 10px;
    border-radius: 4px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &.imprisoned {
    background: rgba(34, 197, 94, 0.8);
    color: #fff;
  }

  &.training {
    background: rgba(245, 158, 11, 0.8);
    color: #fff;
  }

  &.breeding {
    background: rgba(168, 85, 247, 0.8);
    color: #fff;
  }

  &.surrendered {
    background: rgba(236, 72, 153, 0.8);
    color: #fff;
  }

  &.deployed {
    background: rgba(59, 130, 246, 0.8);
    color: #fff;
  }

  .status-icon {
    font-size: 10px;
    color: white;
  }
}

// 等级标签
.character-level-badge {
  position: absolute;
  top: 24px;
  right: 6px;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 8px;
  font-weight: 600;
  text-align: center;
  z-index: 3;
  background: rgba(255, 215, 0, 0.9);
  color: #000;
  display: flex;
  align-items: center;
  gap: 2px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  @media (min-width: 769px) {
    top: 28px; // 避免与状态标识重叠
    right: 8px;
    padding: 4px 6px;
    font-size: 10px;
    border-radius: 4px;
    gap: 3px;
    height: 18px;
  }

  .level-icon {
    font-size: 7px;
    @media (min-width: 769px) {
      font-size: 8px;
    }
  }

  .level-value {
    font-size: 8px;
    font-weight: 700;
    @media (min-width: 769px) {
      font-size: 10px;
    }
  }
}

// 人物名称
.character-name {
  position: absolute;
  bottom: 8px;
  left: 0;
  right: 0;
  z-index: 3;
  color: #ffd7a1;
  font-size: 12px;
  font-weight: 700;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
  text-align: center;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.6);
  padding: 6px 4px;
  max-width: 100%;
  min-width: 0;
  line-height: 1.3;
  @media (min-width: 769px) {
    font-size: 16px;
    padding: 8px 6px;
  }
}

// 卡片收藏按钮
.favorite-btn-card {
  position: absolute;
  top: 6px;
  left: 6px;
  z-index: 4;
  cursor: pointer;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 50%;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(0, 0, 0, 0.8);
    transform: scale(1.1);
  }

  .favorite-icon {
    font-size: 14px;
    color: #ccc;
    transition: all 0.2s ease;

    &.favorited {
      color: #ffd700;
      text-shadow: 0 0 8px rgba(255, 215, 0, 0.5);
    }
  }
}

// 状态栏
.character-status-bar {
  padding: 2px 4px;
  background: rgb(0, 0, 0);
  z-index: 2;
  position: relative;
  flex: 0 0 auto;

  .stat-item {
    display: flex;
    align-items: center;
    gap: 2px;
    margin-bottom: 1px;

    &:last-child {
      margin-bottom: 0;
    }

    .stat-icon {
      font-size: 6px;
      color: #f0e6d2;
      width: 6px;
      text-align: center;
    }

    .stat-bar {
      flex: 1;
      height: 1px;
      background: rgba(0, 0, 0, 0.4);
      border-radius: 1px;
      overflow: hidden;

      .stat-fill {
        height: 100%;
        transition: width 0.3s ease;

        &.high {
          background: linear-gradient(90deg, #22c55e, #16a34a);
        }

        &.medium {
          background: linear-gradient(90deg, #f59e0b, #d97706);
        }

        &.low {
          background: linear-gradient(90deg, #dc2626, #b91c1c);
        }
      }
    }
  }
}

// 竖条属性显示
.character-stats-vertical {
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 2;
  position: relative;

  .stat-item-vertical {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;

    .stat-icon {
      font-size: 8px;
      color: #f0e6d2;
    }

    .stat-bar-vertical {
      width: 8px;
      height: 40px;
      background: rgba(255, 24, 24, 0.4);
      border-radius: 4px;
      overflow: hidden;
      position: relative;

      .stat-fill-vertical {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        transition: height 0.3s ease;

        &.high {
          background: linear-gradient(180deg, #22c55e, #16a34a);
        }

        &.medium {
          background: linear-gradient(180deg, #f59e0b, #d97706);
        }

        &.low {
          background: linear-gradient(180deg, #dc2626, #b91c1c);
        }
      }
    }

    .stat-value {
      color: #ffe9d2;
      font-weight: 600;
      font-size: 8px;
      text-align: center;
    }
  }
}

.character-actions {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  z-index: 2;
  position: relative;
  margin-top: auto;

  .action-btn {
    flex: 1;
    min-width: 50px;
    font-size: 10px;
    padding: 4px 6px;
  }
}

.action-btn {
  background: linear-gradient(180deg, #3a2a22, #2a201c);
  color: #ffe9d2;
  border: 1px solid rgba(205, 133, 63, 0.35);
  border-radius: 8px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 12px;
  box-shadow:
    0 4px 8px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 220, 180, 0.08);
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease,
    filter 0.15s ease;

  &:hover:not(:disabled) {
    filter: brightness(1.08);
    transform: translateY(-1px);
    box-shadow:
      0 6px 12px rgba(0, 0, 0, 0.45),
      inset 0 1px 0 rgba(255, 220, 180, 0.12);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &.primary {
    background: linear-gradient(180deg, #8a3c2c, #65261c);
    border-color: rgba(255, 120, 60, 0.5);
    box-shadow:
      0 6px 12px rgba(110, 30, 15, 0.35),
      inset 0 1px 0 rgba(255, 200, 150, 0.12);
  }

  &.danger {
    background: linear-gradient(180deg, #6d2c2c, #4a1f1f);
    border-color: rgba(255, 80, 80, 0.4);
    box-shadow:
      0 6px 12px rgba(80, 20, 20, 0.35),
      inset 0 1px 0 rgba(255, 150, 150, 0.08);
  }
}

.summary-panel {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.summary-item {
  background: linear-gradient(180deg, rgba(44, 30, 24, 0.7), rgba(28, 20, 17, 0.9));
  border: 1px solid rgba(205, 133, 63, 0.25);
  border-radius: 10px;
  padding: 12px;
  text-align: center;
  box-shadow:
    inset 0 1px 0 rgba(255, 200, 150, 0.08),
    0 6px 14px rgba(0, 0, 0, 0.4);

  .summary-label {
    color: #f0e6d2;
    opacity: 0.8;
    font-size: 12px;
    margin-bottom: 4px;
  }

  .summary-value {
    color: #ffe9d2;
    font-weight: 700;
    font-size: 18px;
  }
}

// 统计信息和批量操作面板
.info-actions-panel {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 12px;
  background: linear-gradient(180deg, rgba(44, 30, 24, 0.5), rgba(28, 20, 17, 0.7));
  border: 1px solid rgba(205, 133, 63, 0.2);
  border-radius: 8px;
}

.stats-info {
  display: flex;
  gap: 20px;
  align-items: center;
}

.stats-item {
  display: flex;
  align-items: center;
  gap: 4px;

  .stats-label {
    color: #f0e6d2;
    font-size: 14px;
    font-weight: 600;
  }

  .stats-value {
    color: #ffe9d2;
    font-weight: 700;
    font-size: 16px;
  }
}

.batch-action {
  display: flex;
  align-items: center;
}

// 图标按钮样式
.icon-btn {
  background: linear-gradient(180deg, #3a2a22, #2a201c);
  color: #ffe9d2;
  border: 1px solid rgba(205, 133, 63, 0.35);
  border-radius: 8px;
  padding: 8px;
  cursor: pointer;
  font-size: 16px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 4px 8px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 220, 180, 0.08);
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease,
    filter 0.15s ease;

  &:hover:not(:disabled) {
    filter: brightness(1.08);
    transform: translateY(-1px);
    box-shadow:
      0 6px 12px rgba(0, 0, 0, 0.45),
      inset 0 1px 0 rgba(255, 220, 180, 0.12);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .icon {
    font-size: 18px;
  }
}

// 人物操作轮盘样式
.character-wheel-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.character-wheel {
  position: relative;
  width: 280px;
  height: 280px;
  animation: wheelSpinIn 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  @media (min-width: 1024px) {
    width: 420px;
    height: 420px;
  }
  @media (min-width: 1440px) {
    width: 520px;
    height: 520px;
  }

  .wheel-center {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 160px;
    height: 160px;
    background: linear-gradient(135deg, rgba(40, 26, 20, 0.95), rgba(25, 17, 14, 0.98));
    border: 3px solid rgba(205, 133, 63, 0.6);
    border-radius: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    box-shadow:
      0 0 20px rgba(205, 133, 63, 0.3),
      inset 0 2px 4px rgba(255, 200, 150, 0.1);
    z-index: 10;

    .character-avatar {
      width: 110px;
      height: 110px;
      border-radius: 50%;
      overflow: hidden;
      border: 3px solid rgba(205, 133, 63, 0.6);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: 50% 23%; /* 可以调整这个值来微调截取位置 */
      }

      .default-avatar {
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, rgba(205, 133, 63, 0.3), rgba(255, 120, 60, 0.2));
        display: flex;
        align-items: center;
        justify-content: center;

        .avatar-icon {
          font-size: 42px;
          opacity: 0.8;
        }
      }
    }

    .close-wheel-btn {
      position: absolute;
      bottom: 200px;
      left: 150%; // 水平位置：调整此值来改变三个按钮的水平位置（向右增大数值，向左减小数值）
      transform: translateX(-50%);
      width: 28px;
      height: 28px;
      background: rgba(220, 38, 38, 0.9);
      border: none;
      border-radius: 50%;
      color: #fff;
      font-size: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);

      &:hover {
        background: rgba(220, 38, 38, 1);
        transform: translateX(-50%) scale(1.1);
      }
    }

    // 调教开关按钮 - 位于关闭按钮左侧（横向排列）
    .auto-train-toggle-btn {
      position: absolute;
      bottom: 200px; // 与关闭按钮同一水平线
      left: calc(150% - 36px); // 关闭按钮左侧，间距36px（按钮宽度28px + 间距8px）
      transform: translateX(-50%);
      width: 28px;
      height: 28px;
      border: 2px solid rgba(205, 133, 63, 0.6);
      border-radius: 50%;
      background: linear-gradient(135deg, rgba(40, 26, 20, 0.95), rgba(25, 17, 14, 0.98));
      color: #ffe9d2;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      z-index: 15;

      &.enabled {
        background: linear-gradient(135deg, rgba(76, 175, 80, 0.9), rgba(56, 142, 60, 0.95));
        border-color: rgba(76, 175, 80, 0.8);

        .toggle-icon {
          color: #fff;
        }
      }

      &:not(.enabled) {
        background: linear-gradient(135deg, rgba(158, 158, 158, 0.7), rgba(97, 97, 97, 0.8));
        border-color: rgba(158, 158, 158, 0.6);
        opacity: 0.6;

        .toggle-icon {
          color: #fff;
        }
      }

      &:hover {
        transform: translateX(-50%) scale(1.15);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      }

      &:active {
        transform: translateX(-50%) scale(1.05);
      }

      .toggle-icon {
        font-size: 14px;
        line-height: 1;
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
      }
    }

    // 生育开关按钮 - 位于调教开关左侧（横向排列）
    .auto-breed-toggle-btn {
      position: absolute;
      bottom: 200px; // 与关闭按钮同一水平线
      left: calc(150% - 72px); // 调教开关左侧，间距36px（按钮宽度28px + 间距8px）
      transform: translateX(-50%);
      width: 28px;
      height: 28px;
      border: 2px solid rgba(205, 133, 63, 0.6);
      border-radius: 50%;
      background: linear-gradient(135deg, rgba(40, 26, 20, 0.95), rgba(25, 17, 14, 0.98));
      color: #ffe9d2;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      z-index: 15;

      &.enabled {
        background: linear-gradient(135deg, rgba(76, 175, 80, 0.9), rgba(56, 142, 60, 0.95));
        border-color: rgba(76, 175, 80, 0.8);

        .toggle-icon {
          color: #fff;
        }
      }

      &:not(.enabled) {
        background: linear-gradient(135deg, rgba(158, 158, 158, 0.7), rgba(97, 97, 97, 0.8));
        border-color: rgba(158, 158, 158, 0.6);
        opacity: 0.6;

        .toggle-icon {
          color: #fff;
        }
      }

      &:hover {
        transform: translateX(-50%) scale(1.15);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      }

      &:active {
        transform: translateX(-50%) scale(1.05);
      }

      .toggle-icon {
        font-size: 14px;
        line-height: 1;
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
      }
    }
  }

  .wheel-buttons {
    position: relative;
    width: 100%;
    height: 100%;

    .wheel-btn {
      position: absolute;
      width: 80px;
      height: 80px;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 5;

      &:hover:not(:disabled) {
        transform: scale(1.15);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
      }

      &:active:not(:disabled) {
        transform: scale(1.05);
      }

      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
        transform: none;
      }

      .btn-icon {
        font-size: 20px;
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
      }

      // 按钮位置 - 均匀圆形分布（5个按钮围绕中心，半径100px，避免被中心头像遮挡）
      &.btn-0 {
        // 0度 - 正上方
        top: calc(50% - 155px);
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #4a90e2, #357abd);
        border: 2px solid rgba(74, 144, 226, 0.6);

        &:hover:not(:disabled) {
          background: linear-gradient(135deg, #5ba0f2, #4a90e2);
          border-color: rgba(74, 144, 226, 0.8);
          transform: translateX(-50%) scale(1.15);
        }

        &:active:not(:disabled) {
          transform: translateX(-50%) scale(1.05);
        }
      }

      &.btn-1 {
        // 72度 - 右上（换装按钮）
        top: calc(50% - 90px);
        right: calc(50% - 145px);
        background: linear-gradient(135deg, #e91e63, #c2185b);
        border: 2px solid rgba(233, 30, 99, 0.6);

        &:hover:not(:disabled) {
          background: linear-gradient(135deg, #f06292, #e91e63);
          border-color: rgba(233, 30, 99, 0.8);
        }
      }

      &.btn-2 {
        // 144度 - 右下
        bottom: calc(50% - 120px);
        right: calc(50% - 120px);
        background: linear-gradient(135deg, #6d2c2c, #4a1f1f);
        border: 2px solid rgba(255, 80, 80, 0.6);

        &:hover:not(:disabled) {
          background: linear-gradient(135deg, #7d3c3c, #6d2c2c);
          border-color: rgba(255, 80, 80, 0.8);
        }
      }

      &.btn-3 {
        // 216度 - 左下
        bottom: calc(50% - 120px);
        left: calc(50% - 120px);
        background: linear-gradient(135deg, #e91e63, #c2185b);
        border: 2px solid rgba(233, 30, 99, 0.6);

        &:hover:not(:disabled) {
          background: linear-gradient(135deg, #f06292, #e91e63);
          border-color: rgba(233, 30, 99, 0.8);
        }
      }

      &.btn-4 {
        // 288度 - 左上（手动调教按钮）
        top: calc(50% - 90px);
        left: calc(50% - 145px);
        background: linear-gradient(135deg, #8a3c2c, #65261c);
        border: 2px solid rgba(255, 120, 60, 0.6);

        &:hover:not(:disabled) {
          background: linear-gradient(135deg, #9a4c3c, #8a3c2c);
          border-color: rgba(255, 120, 60, 0.8);
        }
      }

      &.btn-5 {
        // 360度 - 正下方（堕落按钮）
        bottom: calc(50% - 155px);
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #ff6b35, #e55a2b);
        border: 2px solid rgba(255, 107, 53, 0.6);
        animation: corruptionPulse 2s ease-in-out infinite;

        &:hover:not(:disabled) {
          background: linear-gradient(135deg, #ff7b45, #ff6b35);
          border-color: rgba(255, 107, 53, 0.8);
          transform: translateX(-50%) scale(1.15);
          animation: none;
        }

        &:active:not(:disabled) {
          transform: translateX(-50%) scale(1.05);
        }
      }
    }

    // 调教开关按钮 - 位于调教按钮（btn-4）下方
    .auto-train-toggle-btn {
      position: absolute;
      top: calc(50% - 90px + 95px); // btn-4 的 top + 按钮高度 + 间距
      left: calc(50% - 145px + 40px); // btn-4 的 left + 按钮宽度的一半 - 开关按钮宽度的一半
      transform: translateX(-50%);
      width: 36px;
      height: 36px;
      border: 2px solid rgba(205, 133, 63, 0.6);
      border-radius: 50%;
      background: linear-gradient(135deg, rgba(40, 26, 20, 0.95), rgba(25, 17, 14, 0.98));
      color: #ffe9d2;
      font-size: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      z-index: 15;

      &.enabled {
        background: linear-gradient(135deg, rgba(76, 175, 80, 0.9), rgba(56, 142, 60, 0.95));
        border-color: rgba(76, 175, 80, 0.8);

        .toggle-icon {
          color: #fff;
          font-weight: bold;
        }
      }

      &:not(.enabled) {
        background: linear-gradient(135deg, rgba(158, 158, 158, 0.7), rgba(97, 97, 97, 0.8));
        border-color: rgba(158, 158, 158, 0.6);

        .toggle-icon {
          color: #fff;
          font-weight: bold;
        }
      }

      &:hover {
        transform: translateX(-50%) scale(1.15);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      }

      &:active {
        transform: translateX(-50%) scale(1.05);
      }

      .toggle-icon {
        font-size: 18px;
        line-height: 1;
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
      }
    }

    // 生育开关按钮 - 位于交配按钮（btn-3）下方
    .auto-breed-toggle-btn {
      position: absolute;
      bottom: calc(50% - 120px - 95px); // btn-3 的 bottom - 按钮高度 - 间距
      left: calc(50% - 120px + 40px); // btn-3 的 left + 按钮宽度的一半 - 开关按钮宽度的一半
      transform: translateX(-50%);
      width: 36px;
      height: 36px;
      border: 2px solid rgba(205, 133, 63, 0.6);
      border-radius: 50%;
      background: linear-gradient(135deg, rgba(40, 26, 20, 0.95), rgba(25, 17, 14, 0.98));
      color: #ffe9d2;
      font-size: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      z-index: 15;

      &.enabled {
        background: linear-gradient(135deg, rgba(76, 175, 80, 0.9), rgba(56, 142, 60, 0.95));
        border-color: rgba(76, 175, 80, 0.8);

        .toggle-icon {
          color: #fff;
          font-weight: bold;
        }
      }

      &:not(.enabled) {
        background: linear-gradient(135deg, rgba(158, 158, 158, 0.7), rgba(97, 97, 97, 0.8));
        border-color: rgba(158, 158, 158, 0.6);

        .toggle-icon {
          color: #fff;
          font-weight: bold;
        }
      }

      &:hover {
        transform: translateX(-50%) scale(1.15);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      }

      &:active {
        transform: translateX(-50%) scale(1.05);
      }

      .toggle-icon {
        font-size: 18px;
        line-height: 1;
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
      }
    }
  }

  .wheel-buttons {
    position: relative;
    width: 100%;
    height: 100%;

    .wheel-btn {
      position: absolute;
      width: 80px;
      height: 80px;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 5;

      &:hover:not(:disabled) {
        transform: scale(1.15);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
      }

      &:active:not(:disabled) {
        transform: scale(1.05);
      }

      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
        transform: none;
      }

      .btn-icon {
        font-size: 20px;
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
      }

      // 按钮位置 - 均匀圆形分布（5个按钮围绕中心，半径100px，避免被中心头像遮挡）
      &.btn-0 {
        // 0度 - 正上方
        top: calc(50% - 155px);
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #4a90e2, #357abd);
        border: 2px solid rgba(74, 144, 226, 0.6);

        &:hover:not(:disabled) {
          background: linear-gradient(135deg, #5ba0f2, #4a90e2);
          border-color: rgba(74, 144, 226, 0.8);
          transform: translateX(-50%) scale(1.15);
        }

        &:active:not(:disabled) {
          transform: translateX(-50%) scale(1.05);
        }
      }

      &.btn-1 {
        // 72度 - 右上（换装按钮）
        top: calc(50% - 90px);
        right: calc(50% - 145px);
        background: linear-gradient(135deg, #e91e63, #c2185b);
        border: 2px solid rgba(233, 30, 99, 0.6);

        &:hover:not(:disabled) {
          background: linear-gradient(135deg, #f06292, #e91e63);
          border-color: rgba(233, 30, 99, 0.8);
        }
      }

      &.btn-2 {
        // 144度 - 右下
        bottom: calc(50% - 120px);
        right: calc(50% - 120px);
        background: linear-gradient(135deg, #6d2c2c, #4a1f1f);
        border: 2px solid rgba(255, 80, 80, 0.6);

        &:hover:not(:disabled) {
          background: linear-gradient(135deg, #7d3c3c, #6d2c2c);
          border-color: rgba(255, 80, 80, 0.8);
        }
      }

      &.btn-3 {
        // 216度 - 左下
        bottom: calc(50% - 120px);
        left: calc(50% - 120px);
        background: linear-gradient(135deg, #e91e63, #c2185b);
        border: 2px solid rgba(233, 30, 99, 0.6);

        &:hover:not(:disabled) {
          background: linear-gradient(135deg, #f06292, #e91e63);
          border-color: rgba(233, 30, 99, 0.8);
        }
      }

      &.btn-4 {
        // 288度 - 左上（手动调教按钮）
        top: calc(50% - 90px);
        left: calc(50% - 145px);
        background: linear-gradient(135deg, #8a3c2c, #65261c);
        border: 2px solid rgba(255, 120, 60, 0.6);

        &:hover:not(:disabled) {
          background: linear-gradient(135deg, #9a4c3c, #8a3c2c);
          border-color: rgba(255, 120, 60, 0.8);
        }
      }

      &.btn-5 {
        // 360度 - 正下方（堕落按钮）
        bottom: calc(50% - 155px);
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #ff6b35, #e55a2b);
        border: 2px solid rgba(255, 107, 53, 0.6);
        animation: corruptionPulse 2s ease-in-out infinite;

        &:hover:not(:disabled) {
          background: linear-gradient(135deg, #ff7b45, #ff6b35);
          border-color: rgba(255, 107, 53, 0.8);
          transform: translateX(-50%) scale(1.15);
          animation: none;
        }

        &:active:not(:disabled) {
          transform: translateX(-50%) scale(1.05);
        }
      }
    }
  }
}

@keyframes wheelSpinIn {
  0% {
    opacity: 0;
    transform: scale(0.3) rotate(-180deg);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.1) rotate(-90deg);
  }
  100% {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
}

@keyframes corruptionPulse {
  0% {
    box-shadow:
      0 4px 12px rgba(0, 0, 0, 0.3),
      0 0 0 0 rgba(255, 107, 53, 0.7);
  }
  50% {
    box-shadow:
      0 4px 12px rgba(0, 0, 0, 0.3),
      0 0 0 10px rgba(255, 107, 53, 0.3);
  }
  100% {
    box-shadow:
      0 4px 12px rgba(0, 0, 0, 0.3),
      0 0 0 0 rgba(255, 107, 53, 0.7);
  }
}

// 弹窗样式
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: linear-gradient(180deg, rgba(40, 26, 20, 0.95), rgba(25, 17, 14, 0.98));
  border: 1px solid rgba(205, 133, 63, 0.3);
  border-radius: 12px;
  padding: 20px;
  max-width: 500px;
  max-height: 90vh;
  width: 90%;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(205, 133, 63, 0.2);

    h4 {
      margin: 0;
      color: #ffd7a1;
      font-size: 16px;
    }

    .close-btn {
      background: none;
      border: none;
      color: #f0e6d2;
      font-size: 20px;
      cursor: pointer;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;

      &:hover {
        color: #ffd7a1;
      }
    }
  }

  .modal-body {
    overflow-y: auto;
    overflow-x: hidden;
    flex: 1;
    min-height: 0;

    /* 自定义滚动条样式 */
    &::-webkit-scrollbar {
      width: 10px;
    }

    &::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.3);
      border-radius: 5px;
    }

    &::-webkit-scrollbar-thumb {
      background: linear-gradient(135deg, rgba(205, 133, 63, 0.6), rgba(139, 90, 43, 0.5));
      border-radius: 5px;
      border: 2px solid rgba(0, 0, 0, 0.2);

      &:hover {
        background: linear-gradient(135deg, rgba(205, 133, 63, 0.8), rgba(139, 90, 43, 0.7));
      }

      &:active {
        background: linear-gradient(135deg, rgba(255, 180, 100, 0.9), rgba(205, 133, 63, 0.8));
      }
    }

    /* Firefox 滚动条样式 */
    scrollbar-width: thin;
    scrollbar-color: rgba(205, 133, 63, 0.6) rgba(0, 0, 0, 0.3);
  }
}

// 宽屏优化 - 增大人物卡片尺寸
@media (min-width: 1440px) {
  .characters-grid {
    grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
    gap: 20px;
  }

  .character-card {
    width: 200px;
    height: 400px;
  }

  .character-name {
    font-size: 14px;
    padding: 8px 6px;
  }

  .favorite-btn-card {
    width: 28px;
    height: 28px;

    .favorite-icon {
      font-size: 16px;
    }
  }
}

// 超大屏优化
@media (min-width: 1920px) {
  .characters-grid {
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 20px;
  }

  .character-card {
    width: 180px;
    height: 360px;
  }

  .character-name {
    font-size: 16px;
    padding: 10px 8px;
  }

  .favorite-btn-card {
    width: 32px;
    height: 32px;

    .favorite-icon {
      font-size: 18px;
    }
  }
}

// 放大头像弹窗样式
.enlarged-avatar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  backdrop-filter: blur(8px);
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.enlarged-avatar-container {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  background: linear-gradient(180deg, rgba(40, 26, 20, 0.95), rgba(25, 17, 14, 0.98));
  border: 2px solid rgba(205, 133, 63, 0.4);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  animation: scaleIn 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.close-enlarged-avatar-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  background: rgba(220, 38, 38, 0.9);
  border: none;
  border-radius: 50%;
  color: #fff;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  z-index: 10;

  &:hover {
    background: rgba(220, 38, 38, 1);
    transform: scale(1.1);
  }
}

.enlarged-avatar-info {
  text-align: center;
  margin-bottom: 8px;

  .enlarged-character-name {
    margin: 0 0 4px 0;
    color: #ffd7a1;
    font-size: 24px;
    font-weight: 700;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
  }

  .enlarged-character-title {
    color: rgba(255, 215, 161, 0.8);
    font-size: 16px;
    font-style: italic;
  }
}

.enlarged-avatar-image-wrapper {
  position: relative;
  width: 100%;
  max-width: 800px;
  max-height: calc(90vh - 120px);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);

  .enlarged-avatar-image {
    width: 100%;
    height: auto;
    max-height: calc(90vh - 120px);
    object-fit: contain;
    display: block;
  }

  .enlarged-avatar-placeholder {
    width: 400px;
    height: 400px;
    background: linear-gradient(135deg, rgba(205, 133, 63, 0.3), rgba(255, 120, 60, 0.2));
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;

    .enlarged-portrait-icon {
      font-size: 120px;
      opacity: 0.8;
    }
  }
}

// 响应式设计
@media (max-width: 1024px) {
  .characters-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 16px;
  }

  .character-card {
    width: 110px;
    height: 220px;
  }

  .character-portrait {
    height: 100%;
  }

  .character-name {
    font-size: 11px;
  }

  .enlarged-avatar-container {
    padding: 20px;
    max-width: 95vw;
  }

  .enlarged-avatar-info {
    .enlarged-character-name {
      font-size: 20px;
    }

    .enlarged-character-title {
      font-size: 14px;
    }
  }

  .enlarged-avatar-image-wrapper {
    max-height: calc(90vh - 100px);

    .enlarged-avatar-placeholder {
      width: 300px;
      height: 300px;

      .enlarged-portrait-icon {
        font-size: 80px;
      }
    }
  }
}

@media (max-width: 768px) {
  .characters-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 8px;
  }

  .character-card {
    width: 100px;
    height: 200px;
  }

  .character-portrait {
    height: 100%;
  }

  .character-name {
    font-size: 9px;
  }

  .character-status-bar {
    padding: 1px 3px;

    .stat-item {
      .stat-icon {
        font-size: 5px;
      }

      .stat-bar {
        height: 1px;
      }
    }
  }

  .character-detail-modal {
    .character-detail-content {
      flex-direction: column;
      gap: 16px;
    }
  }

  .summary-panel {
    grid-template-columns: repeat(2, 1fr);
  }

  .info-actions-panel {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;

    .stats-info {
      justify-content: center;
      gap: 16px;
    }

    .batch-action {
      justify-content: center;
    }
  }

  .enlarged-avatar-container {
    padding: 16px;
    max-width: 95vw;
  }

  .enlarged-avatar-info {
    .enlarged-character-name {
      font-size: 18px;
    }

    .enlarged-character-title {
      font-size: 12px;
    }
  }

  .enlarged-avatar-image-wrapper {
    max-height: calc(90vh - 80px);

    .enlarged-avatar-placeholder {
      width: 250px;
      height: 250px;

      .enlarged-portrait-icon {
        font-size: 60px;
      }
    }
  }
}
</style>
