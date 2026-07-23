/**
 * 模块化存档服务
 * 基于 IndexedDB 的模块化存档管理系统
 * 集成资源管理和Vue响应式功能
 */

import { computed, ref } from 'vue';
import type { Location } from '../../../功能模块层/探索/类型/探索类型';
import { WorldbookService } from '../世界书管理/服务/世界书服务';
import { GameEventLorebookManager } from '../世界书管理/管理器/历史记录/冒头事件管理器';
import { ConquestRecordManager } from '../世界书管理/管理器/历史记录/据点征服管理器';
import { databaseService } from './数据库服务';
import type {
  BaseResources,
  ModularDeleteOptions,
  ModularGameData,
  ModularLoadOptions,
  ModularSaveManagerEvents,
  ModularSaveOptions,
  ModularSaveSlot,
  ModuleDataOptions,
  ModuleUpdateOptions,
  NestModuleData,
} from './模块化存档类型';
import { createFullGameData, INITIAL_NEST_DATA, INITIAL_RESOURCES } from './模块化存档类型';

// 使用 BaseResources 接口替代重复的 GameResources

// 资源变化接口
export interface ResourceChange {
  type: keyof BaseResources;
  amount: number;
  reason?: string;
}

export class ModularSaveManager {
  private static readonly MAX_SLOTS = 5;
  private static readonly CURRENT_VERSION = '1.0.0';

  private events: ModularSaveManagerEvents = {};
  private currentGameData: ModularGameData | null = null;

  // Vue响应式资源状态
  public resources = ref<BaseResources>({ ...INITIAL_RESOURCES });
  public resourceDisplay = computed(() => ({
    gold: `💰 ${this.resources.value.gold}`,
    food: `🍖 ${this.resources.value.food}`,
    threat: `⚠️ ${this.resources.value.threat}`,
    slaves: `🔒 ${this.resources.value.slaves}`,
    trainingSlaves: `💋 ${this.resources.value.trainingSlaves}`,
    rounds: `🔄 ${this.resources.value.rounds}`,
    actionPoints: `❤️ ${this.resources.value.actionPoints}/${this.resources.value.maxActionPoints}`,
    conqueredRegions: `🏰 ${this.resources.value.conqueredRegions}`,
  }));

  constructor(events?: ModularSaveManagerEvents) {
    if (events) {
      this.events = events;
    }
  }

  /**
   * 根据存档ID推导槽位号
   * 兼容新格式: slot_{n} 与旧格式: save_{ts}_{n}
   */
  private deriveSlotFromId(id: string): number {
    if (id.startsWith('slot_')) {
      const n = parseInt(id.substring('slot_'.length));
      return Number.isFinite(n) ? n : 0;
    }

    const parts = id.split('_');
    const last = parts[parts.length - 1];
    const n = parseInt(last);
    return Number.isFinite(n) ? n : 0;
  }

  /**
   * 设置事件监听器
   */
  setEvents(events: ModularSaveManagerEvents): void {
    this.events = { ...this.events, ...events };
  }

  /**
   * 初始化存档管理器
   */
  async init(): Promise<void> {
    try {
      await databaseService.init();

      // 确保默认世界书存在
      await this.ensureDefaultWorldbook();

      // 初始化默认slot（从隐藏的初始化槽位slot_init读取，如果不存在则创建）
      await this.initializeDefaultSlot();

      console.log('模块化存档管理器初始化成功');
    } catch (error) {
      console.error('模块化存档管理器初始化失败，尝试强制重新初始化:', error);

      try {
        await databaseService.forceReinit();

        // 确保默认世界书存在
        await this.ensureDefaultWorldbook();

        // 初始化默认slot
        await this.initializeDefaultSlot();

        console.log('模块化存档管理器强制重新初始化成功');
      } catch (reinitError) {
        console.error('模块化存档管理器强制重新初始化失败:', reinitError);
        throw reinitError;
      }
    }
  }

  /**
   * 初始化默认slot（从隐藏的初始化槽位slot_init读取）
   */
  private async initializeDefaultSlot(): Promise<void> {
    try {
      const INIT_SLOT_ID = 'slot_init';

      console.log('🔄 [初始化默认slot] 开始处理初始化槽位...');

      if (this.currentGameData) {
        console.log('✅ [初始化默认slot] currentGameData 已存在，跳过');
        return;
      }

      let initGameData: ModularGameData | null = null;
      try {
        initGameData = await databaseService.loadSave(INIT_SLOT_ID);
        if (initGameData) {
          console.log('✅ [初始化默认slot] 找到初始化槽位');
        }
      } catch (_e) {
        initGameData = createFullGameData();
        await databaseService.saveGameData(INIT_SLOT_ID, initGameData);
        const { FRONTEND_VERSION } = await import('../../../version');
        await databaseService.upsertSaveMeta(INIT_SLOT_ID, '初始化存档', FRONTEND_VERSION);
        console.log('✅ [初始化默认slot] 已创建初始化槽位');
      }

      if (initGameData) {
        try {
          const resp = await fetch('/api/saves/slot_0');
          if (resp.ok) {
            const backendData = await resp.json();
            if (backendData?.game_data) {
              initGameData = backendData.game_data as ModularGameData;
              console.log('✅ [初始化] 从后端自动存档恢复游戏数据');
            }
          }
        } catch (_e) {}

        this.migrateUnitTypeFromAttributes(initGameData);
        databaseService.clearCurrentSaveId();
        this.currentGameData = initGameData;
        this.syncResourcesToReactive();
        console.log('✅ [初始化默认slot] 已从初始化槽位加载数据到内存');
      }
    } catch (error) {
      console.error('初始化默认slot失败:', error);
      if (!this.currentGameData) {
        await this.createNewGame();
        this.syncResourcesToReactive();
      }
    }
  }

  /**
   * 获取所有存档槽位
   */
  async getAllSlots(): Promise<ModularSaveSlot[]> {
    try {
      const saves = await databaseService.getAllSaves();
      const slots: ModularSaveSlot[] = [];

      // 为每个存档创建槽位信息（排除隐藏的初始化槽位slot_init）
      for (const save of saves) {
        // 跳过隐藏的初始化槽位，不显示给玩家
        if (save.id === 'slot_init') {
          continue;
        }

        const slotIdx = this.deriveSlotFromId(save.id);
        const gameData = await databaseService.loadSave(save.id);
        // 【旧存档兼容性处理】迁移 attributes.Unittype 到 unitType
        if (gameData) {
          this.migrateUnitTypeFromAttributes(gameData as ModularGameData);
        }
        slots.push({
          slot: slotIdx,
          data: gameData as ModularGameData | null,
          timestamp: save.lastPlayed.getTime(),
          version: save.version,
          saveName: save.name,
        });
      }

      // 确保返回所有槽位（0-5），包括空的
      const allSlots: ModularSaveSlot[] = [];
      for (let i = 0; i <= ModularSaveManager.MAX_SLOTS; i++) {
        const existingSlot = slots.find(slot => slot.slot === i);
        if (existingSlot) {
          allSlots.push(existingSlot);
        } else {
          // 创建空槽位
          allSlots.push({
            slot: i,
            data: null,
            timestamp: 0,
            version: ModularSaveManager.CURRENT_VERSION,
            saveName: i === 0 ? '自动存档' : `槽位 ${i}`,
          });
        }
      }

      return allSlots;
    } catch (error) {
      console.error('获取存档槽位失败:', error);
      this.handleError(error as Error);
      // 即使出错，也返回空槽位列表，确保界面能看到所有槽位
      const fallbackSlots: ModularSaveSlot[] = [];
      for (let i = 0; i <= ModularSaveManager.MAX_SLOTS; i++) {
        fallbackSlots.push({
          slot: i,
          data: null,
          timestamp: 0,
          version: ModularSaveManager.CURRENT_VERSION,
          saveName: i === 0 ? '自动存档' : `槽位 ${i}`,
        });
      }
      return fallbackSlots;
    }
  }

  /**
   * 获取指定槽位
   */
  async getSlot(slotNumber: number): Promise<ModularSaveSlot> {
    try {
      if (slotNumber < 0 || slotNumber > ModularSaveManager.MAX_SLOTS) {
        throw new Error(`无效的槽位编号: ${slotNumber}`);
      }

      const saves = await databaseService.getAllSaves();
      // 优先新格式
      let save = saves.find(s => s.id === `slot_${slotNumber}`);
      // 兼容旧格式: 末尾 _{n}
      if (!save) save = saves.find(s => s.id.endsWith(`_${slotNumber}`));

      if (save) {
        const gameData = await databaseService.loadSave(save.id);
        // 【旧存档兼容性处理】迁移 attributes.Unittype 到 unitType
        if (gameData) {
          this.migrateUnitTypeFromAttributes(gameData as ModularGameData);
        }
        return {
          slot: slotNumber,
          data: gameData as ModularGameData | null,
          timestamp: save.lastPlayed.getTime(),
          version: save.version,
          saveName: save.name,
        };
      }

      return {
        slot: slotNumber,
        data: null,
        timestamp: 0,
        version: ModularSaveManager.CURRENT_VERSION,
        saveName: `槽位 ${slotNumber}`,
      };
    } catch (error) {
      console.error(`获取槽位 ${slotNumber} 失败:`, error);
      this.handleError(error as Error);
      return {
        slot: slotNumber,
        data: null,
        timestamp: 0,
        version: ModularSaveManager.CURRENT_VERSION,
        saveName: `槽位 ${slotNumber}`,
      };
    }
  }

  /**
   * 保存到指定槽位
   */
  async saveToSlot(options: ModularSaveOptions): Promise<boolean> {
    try {
      const { slot, gameData } = options;

      if (slot < 0 || slot > ModularSaveManager.MAX_SLOTS) {
        throw new Error(`无效的槽位编号: ${slot}`);
      }

      // 更新元数据
      gameData.metadata.lastSaved = Date.now();
      gameData.metadata.gameVersion = ModularSaveManager.CURRENT_VERSION;

      // 创建或更新存档（稳定的主键：使用槽位号作为 ID，保证覆盖写入而非创建多个）
      const saveId = `slot_${slot}`;

      // 保存到 IndexedDB
      await databaseService.saveGameData(saveId, gameData as any);

      // 保存前端版本信息到存档元数据
      const { FRONTEND_VERSION } = await import('../../../version');
      await databaseService.upsertSaveMeta(
        saveId,
        options.saveName ?? (slot === 0 ? '自动存档' : `槽位 ${slot}`),
        FRONTEND_VERSION,
      );

      // 在切换存档ID之前，先保存原来的存档ID（用于复制调教记录数据）
      const previousSaveId = databaseService.getCurrentSaveId();

      // 设置当前存档ID
      databaseService.setCurrentSaveId(saveId);

      // 更新当前游戏数据
      this.currentGameData = gameData;

      // 保存当前世界书数据到数据库
      await this.saveWorldbookToDatabase(slot);

      // 复制调教记录数据到新槽位（如果从其他槽位保存）
      // 使用原来的存档ID作为源，而不是当前已切换的存档ID
      if (previousSaveId && previousSaveId !== saveId) {
        await this.copyTrainingHistoryFromSlot(previousSaveId, slot);
      } else if (!previousSaveId || previousSaveId === 'slot_init') {
        // 如果是首次保存到slot0（从初始化槽位或没有previousSaveId），清空slot0的调教记录数据
        // 避免旧存档的调教记录数据与新存档数据融合
        try {
          await databaseService.deleteTrainingHistoryData(saveId);
          console.log(`✅ 已清空槽位 ${slot} 的旧调教记录数据（首次保存或从初始化槽位保存）`);
        } catch (error) {
          // 如果删除失败（可能是因为不存在），不影响后续流程
          console.log(`ℹ️ 槽位 ${slot} 没有调教记录数据或清除失败（可忽略）`);
        }
      }

      // 触发保存事件
      if (this.events.onSave) {
        this.events.onSave(slot, gameData);
      }

      // 同步保存到后端文件系统（异步，不阻塞）
      this.syncToBackend(slot, gameData);

      console.log(`游戏已保存到槽位 ${slot}`);
      return true;
    } catch (error) {
      console.error('保存游戏失败:', error);
      this.handleError(error as Error);
      return false;
    }
  }

  /**
   * 从指定槽位读取
   */
  async loadFromSlot(options: ModularLoadOptions): Promise<ModularGameData | null> {
    try {
      const { slot } = options;

      if (slot < 0 || slot > ModularSaveManager.MAX_SLOTS) {
        throw new Error(`无效的槽位编号: ${slot}`);
      }

      const slotData = await this.getSlot(slot);

      if (!slotData.data) {
        throw new Error(`槽位 ${slot} 没有存档`);
      }

      // 【旧存档兼容性处理】迁移 attributes.Unittype 到 unitType
      this.migrateUnitTypeFromAttributes(slotData.data);

      // 更新当前游戏数据
      this.currentGameData = slotData.data;

      // 调试日志：记录存档中的行动力
      console.log(
        `[loadFromSlot] 存档中的行动力: ${slotData.data.baseResources.actionPoints}, 最大行动力: ${slotData.data.baseResources.maxActionPoints}`,
      );

      // 同步资源状态到Vue响应式状态（必须在设置currentGameData后立即调用）
      this.syncResourcesToReactive();

      // 调试日志：同步后的行动力
      console.log(`[loadFromSlot] 同步后响应式状态中的行动力: ${this.resources.value.actionPoints}`);

      // 设置当前存档ID（直接使用稳定键）
      databaseService.setCurrentSaveId(`slot_${slot}`);

      // 从数据库恢复世界书数据到当前世界书
      await this.restoreWorldbookFromDatabase(slot);

      // 触发读取事件
      if (this.events.onLoad) {
        this.events.onLoad(slot, slotData.data);
      }

      console.log(`游戏已从槽位 ${slot} 读取`);
      return slotData.data;
    } catch (error) {
      console.error('读取游戏失败:', error);
      this.handleError(error as Error);
      return null;
    }
  }

  /**
   * 删除指定槽位
   */
  async deleteSlot(options: ModularDeleteOptions): Promise<boolean> {
    try {
      const { slot } = options;

      if (slot < 0 || slot > ModularSaveManager.MAX_SLOTS) {
        throw new Error(`无效的槽位编号: ${slot}`);
      }

      const saves = await databaseService.getAllSaves();
      const save = saves.find(s => s.id.includes(`_${slot}_`));

      if (save) {
        await databaseService.deleteSave(save.id);
      }

      // 删除存档对应的世界书数据
      await this.deleteWorldbookDataFromDatabase(slot);

      // 触发删除事件
      if (this.events.onDelete) {
        this.events.onDelete(slot);
      }

      console.log(`槽位 ${slot} 的存档已删除`);
      return true;
    } catch (error) {
      console.error('删除存档失败:', error);
      this.handleError(error as Error);
      return false;
    }
  }

  /**
   * 检查槽位是否有存档
   */
  async hasSave(slot: number): Promise<boolean> {
    const slotData = await this.getSlot(slot);
    return slotData.timestamp > 0;
  }

  /**
   * 获取当前游戏数据
   */
  getCurrentGameData(): ModularGameData | null {
    return this.currentGameData;
  }

  /**
   * 同步资源状态到Vue响应式状态
   */
  syncResourcesToReactive(): void {
    if (this.currentGameData) {
      const oldActionPoints = this.resources.value.actionPoints;
      const newActionPoints = this.currentGameData.baseResources.actionPoints;
      this.resources.value = { ...this.currentGameData.baseResources };

      // 调试日志：检测行动力变化
      if (oldActionPoints !== newActionPoints) {
        console.log(`[syncResourcesToReactive] 行动力变化: ${oldActionPoints} -> ${newActionPoints}`, {
          stackTrace: new Error().stack,
        });
      }
    }
  }

  /**
   * 从Vue响应式状态同步资源到游戏数据
   */
  syncReactiveToResources(): void {
    if (this.currentGameData) {
      this.currentGameData.baseResources = { ...this.resources.value };
    }
  }

  /**
   * 更新模块数据（直接覆盖）
   */
  updateModuleData(options: ModuleUpdateOptions): void {
    if (!this.currentGameData) {
      console.warn('没有加载的游戏数据，无法更新模块数据');
      return;
    }

    const { moduleName, data } = options;

    // 直接覆盖数据
    this.currentGameData[moduleName] = data;

    // 触发模块更新事件
    if (this.events.onModuleUpdate) {
      this.events.onModuleUpdate(moduleName, this.currentGameData[moduleName]);
    }

    console.log(`模块 ${moduleName} 数据已更新`);
  }

  /**
   * 获取模块数据
   */
  getModuleData<T>(options: ModuleDataOptions): T | null {
    if (!this.currentGameData) {
      return null;
    }

    return this.currentGameData[options.moduleName] as T;
  }

  /**
   * 更新基础资源
   */
  updateBaseResources(resources: Partial<BaseResources>): void {
    if (!this.currentGameData) {
      console.warn('没有加载的游戏数据，无法更新基础资源');
      return;
    }

    this.currentGameData.baseResources = {
      ...this.currentGameData.baseResources,
      ...resources,
    };

    console.log('基础资源已更新');
  }

  /**
   * 创建新游戏（优先从后端模板加载，失败则使用内置默认数据）
   */
  async createNewGame(): Promise<ModularGameData> {
    try {
      const resp = await fetch('/api/saves/slot_init/from-template', { method: 'POST' });
      if (resp.ok) {
        const result = await resp.json();
        if (result.data) {
          this.currentGameData = result.data as ModularGameData;
          console.log('✅ 从后端模板创建新游戏');
          await this.saveToSlot({ slot: 0, saveName: '自动存档', gameData: this.currentGameData });
          return this.currentGameData;
        }
      }
    } catch (e) {
      console.warn('⚠️ 从后端模板创建失败，使用内置默认数据:', e);
    }
    this.currentGameData = createFullGameData();
    return this.currentGameData;
  }

  async initFromTemplate(): Promise<ModularGameData> {
    try {
      const resp = await fetch('/api/saves/slot_0/reset', { method: 'POST' });
      if (resp.ok) {
        const result = await resp.json();
        if (result.data) {
          this.currentGameData = result.data as ModularGameData;
          this.syncResourcesToReactive();
          return this.currentGameData;
        }
      }
    } catch (e) {}
    this.currentGameData = createFullGameData();
    this.syncResourcesToReactive();
    return this.currentGameData;
  }

  /**
   * 保存当前游戏数据
   */
  async saveCurrentGameData(slot: number, saveName?: string): Promise<boolean> {
    if (!this.currentGameData) {
      console.warn('没有当前游戏数据，创建新游戏');
      await this.createNewGame();
    }

    return await this.saveToSlot({
      slot,
      saveName,
      gameData: this.currentGameData!,
    });
  }

  /**
   * 格式化时间
   */
  formatTime(timestamp: number): string {
    if (!timestamp) return '无存档';

    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * 获取存档统计信息
   */
  async getSaveStats(): Promise<{ totalSlots: number; usedSlots: number; emptySlots: number }> {
    const slots = await this.getAllSlots();
    const usedSlots = slots.filter(slot => slot.timestamp > 0).length;

    return {
      totalSlots: ModularSaveManager.MAX_SLOTS,
      usedSlots,
      emptySlots: ModularSaveManager.MAX_SLOTS - usedSlots,
    };
  }

  /**
   * 清理所有存档
   */
  async clearAllSaves(): Promise<boolean> {
    try {
      const saves = await databaseService.getAllSaves();
      for (const save of saves) {
        await databaseService.deleteSave(save.id);
      }

      console.log('所有存档已清除');
      return true;
    } catch (error) {
      console.error('清除存档失败:', error);
      this.handleError(error as Error);
      return false;
    }
  }

  /**
   * 导出存档数据（包含世界书数据）
   */
  async exportSave(slot: number): Promise<string | null> {
    try {
      const slotData = await this.getSlot(slot);
      if (!slotData.data) {
        throw new Error(`槽位 ${slot} 没有存档`);
      }

      // 获取对应的世界书数据
      const saveId = `slot_${slot}`;
      const worldbookData = await databaseService.loadWorldbookData(saveId);

      // 创建包含世界书数据的导出对象
      const exportData = {
        gameData: slotData.data,
        worldbookData: worldbookData || [],
        metadata: {
          slot: slotData.slot,
          timestamp: slotData.timestamp,
          version: slotData.version,
          exportTime: new Date().toISOString(),
        },
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('导出存档失败:', error);
      this.handleError(error as Error);
      return null;
    }
  }

  /**
   * 导入存档数据（包含世界书数据）
   */
  async importSave(slot: number, saveData: string, saveName?: string): Promise<boolean> {
    try {
      // 禁止导入到自动存档（槽位0）
      if (slot === 0) {
        console.error('不允许导入到自动存档（槽位0）');
        throw new Error('不允许导入到自动存档（槽位0），自动存档由游戏系统自动管理');
      }

      if (slot < 1 || slot > ModularSaveManager.MAX_SLOTS) {
        throw new Error(`无效的槽位编号: ${slot}，有效范围为 1-${ModularSaveManager.MAX_SLOTS}`);
      }

      const parsed = JSON.parse(saveData);

      // 判断是否是新的导出格式（包含 worldbookData）
      let gameData: ModularGameData;
      let worldbookData: any[] = [];

      if (parsed.gameData && parsed.worldbookData !== undefined) {
        // 新格式：包含世界书数据
        gameData = parsed.gameData;
        worldbookData = parsed.worldbookData;
      } else {
        // 旧格式：只有游戏数据（向后兼容）
        gameData = parsed;
      }

      // 保存游戏数据
      const saveId = `slot_${slot}`;
      await databaseService.saveGameData(saveId, gameData as any);
      const { FRONTEND_VERSION: SAVE_FRONTEND_VERSION } = await import('../../../version');
      await databaseService.upsertSaveMeta(
        saveId,
        saveName ?? (slot === 0 ? '自动存档' : `槽位 ${slot}`),
        SAVE_FRONTEND_VERSION,
      );

      // 如果有世界书数据，也保存
      if (worldbookData && worldbookData.length > 0) {
        await databaseService.saveWorldbookData(saveId, worldbookData);
      } else {
        // 如果没有世界书数据，清空世界书数据
        await databaseService.saveWorldbookData(saveId, []);
      }

      // 设置当前存档ID
      databaseService.setCurrentSaveId(saveId);

      // 【旧存档兼容性处理】迁移 attributes.Unittype 到 unitType
      this.migrateUnitTypeFromAttributes(gameData);

      // 更新当前游戏数据
      this.currentGameData = gameData;

      // 触发保存事件
      if (this.events.onSave) {
        this.events.onSave(slot, gameData);
      }

      console.log(`存档已导入到槽位 ${slot}`);
      return true;
    } catch (error) {
      console.error('导入存档失败:', error);
      this.handleError(error as Error);
      return false;
    }
  }

  // ==================== 资源管理功能 ====================

  /**
   * 获取当前资源
   */
  getCurrentResources(): BaseResources {
    if (!this.currentGameData) {
      this.currentGameData = createFullGameData(); // 同步回退，初始化时已通过createNewGame加载
    }
    return this.currentGameData!.baseResources;
  }

  /**
   * 设置资源值
   */
  setResource(type: keyof BaseResources, value: number): void {
    if (!this.currentGameData) {
      this.currentGameData = createFullGameData();
    }

    // 调试日志：检测行动力设置
    if (type === 'actionPoints') {
      const oldValue = this.currentGameData!.baseResources[type];
      console.log(`[setResource] 设置行动力: ${oldValue} -> ${value}`, {
        stackTrace: new Error().stack,
      });
    }

    this.currentGameData!.baseResources[type] = value;
    this.currentGameData!.metadata.lastSaved = Date.now();

    // 同步到Vue响应式状态
    this.syncResourcesToReactive();
  }

  /**
   * 获取资源值
   */
  getResource(type: keyof BaseResources): number {
    if (!this.currentGameData) {
      this.currentGameData = createFullGameData();
    }
    return this.currentGameData!.baseResources[type];
  }

  /**
   * 增加资源
   */
  addResource(type: keyof BaseResources, amount: number, reason?: string): boolean {
    console.log(`addResource 被调用: ${type}, 数量: ${amount}, 原因: ${reason}`);

    if (!this.currentGameData) {
      console.log('没有当前游戏数据，创建新游戏');
      this.currentGameData = createFullGameData();
    }

    const currentValue = this.currentGameData!.baseResources[type];
    const newValue = currentValue + amount;
    console.log(`资源 ${type}: 当前值 ${currentValue} -> 新值 ${newValue}`);

    // 调试日志：检测行动力增加
    if (type === 'actionPoints') {
      console.log(`[addResource] 行动力增加: ${currentValue} + ${amount} = ${newValue}`, {
        reason,
        stackTrace: new Error().stack,
      });
    }

    // 检查是否会导致负数（对于某些资源类型）
    if (
      type === 'gold' ||
      type === 'food' ||
      type === 'normalGoblins' ||
      type === 'warriorGoblins' ||
      type === 'shamanGoblins' ||
      type === 'paladinGoblins' ||
      type === 'actionPoints'
    ) {
      if (newValue < 0) {
        console.warn(`资源 ${type} 不足，无法减少 ${amount}`);
        return false;
      }
    }

    this.currentGameData!.baseResources[type] = newValue;
    this.currentGameData!.metadata.lastSaved = Date.now();

    // 同步到Vue响应式状态
    console.log('同步到Vue响应式状态...');
    this.syncResourcesToReactive();
    console.log('Vue响应式状态已更新:', this.resources.value[type]);

    if (reason) {
      console.log(`${reason}: ${type} ${amount > 0 ? '+' : ''}${amount} (当前: ${newValue})`);
    }

    return true;
  }

  /**
   * 消耗资源
   */
  consumeResource(type: keyof BaseResources, amount: number, reason?: string): boolean {
    if (!this.currentGameData) {
      this.currentGameData = createFullGameData();
    }

    const currentValue = this.currentGameData!.baseResources[type];
    if (currentValue < amount) {
      console.warn(`资源 ${type} 不足: 需要 ${amount}，当前 ${currentValue}`);
      return false;
    }

    this.currentGameData!.baseResources[type] = currentValue - amount;
    this.currentGameData!.metadata.lastSaved = Date.now();

    // 同步到Vue响应式状态
    this.syncResourcesToReactive();

    if (reason) {
      console.log(`${reason}: ${type} -${amount} (剩余: ${currentValue - amount})`);
    }

    return true;
  }

  /**
   * 批量消耗资源
   */
  consumeResources(changes: ResourceChange[]): boolean {
    if (!this.currentGameData) {
      this.currentGameData = createFullGameData();
    }

    // 先检查所有资源是否足够
    for (const change of changes) {
      const currentValue = this.currentGameData!.baseResources[change.type];
      if (currentValue < change.amount) {
        console.warn(`资源 ${change.type} 不足: 需要 ${change.amount}，当前 ${currentValue}`);
        return false;
      }
    }

    // 执行消耗
    for (const change of changes) {
      this.currentGameData!.baseResources[change.type] -= change.amount;
      if (change.reason) {
        console.log(`${change.reason}: ${change.type} -${change.amount}`);
      }
    }

    this.currentGameData!.metadata.lastSaved = Date.now();

    // 同步到Vue响应式状态
    this.syncResourcesToReactive();

    return true;
  }

  /**
   * 检查资源是否足够
   */
  hasEnoughResources(changes: ResourceChange[]): boolean {
    if (!this.currentGameData) {
      this.currentGameData = createFullGameData();
    }

    for (const change of changes) {
      const currentValue = this.currentGameData!.baseResources[change.type];
      if (currentValue < change.amount) {
        return false;
      }
    }
    return true;
  }

  /**
   * 获取资源不足的提示
   */
  getInsufficientResourcesMessage(changes: ResourceChange[]): string {
    if (!this.currentGameData) {
      this.currentGameData = createFullGameData();
    }

    const insufficient: string[] = [];
    for (const change of changes) {
      const currentValue = this.currentGameData!.baseResources[change.type];
      if (currentValue < change.amount) {
        insufficient.push(`${change.type}: 需要 ${change.amount}，当前 ${currentValue}`);
      }
    }
    return insufficient.join('; ');
  }

  /**
   * 重置资源到初始值
   */
  resetResources(): void {
    if (!this.currentGameData) {
      this.currentGameData = createFullGameData();
    }

    const initialResources = { ...INITIAL_RESOURCES };
    this.currentGameData!.baseResources = { ...initialResources };
    this.currentGameData!.metadata.lastSaved = Date.now();

    // 同步到Vue响应式状态
    this.syncResourcesToReactive();
  }

  /**
   * 获取初始巢穴数据
   */
  getInitialNestData(): NestModuleData | null {
    try {
      return INITIAL_NEST_DATA;
    } catch (error) {
      console.error('获取初始巢穴数据失败:', error);
      return null;
    }
  }

  /**
   * 获取巢穴收入（供回合结束处理使用）
   */
  getNestIncome(): { gold: number; food: number } {
    if (!this.currentGameData || !this.currentGameData.nest) {
      return { gold: 0, food: 0 };
    }

    const nestData = this.currentGameData.nest;
    return nestData.totalIncome || { gold: 0, food: 0 };
  }

  /**
   * 处理巢穴收入（供回合结束处理使用）
   */
  processNestIncome(): { messages: string[]; changes: any[] } {
    const messages: string[] = [];
    const changes: any[] = [];

    const income = this.getNestIncome();

    if (income.gold > 0) {
      const success = this.addResource('gold', income.gold, '巢穴建筑收入');
      if (success) {
        changes.push({
          type: 'gold',
          amount: income.gold,
          reason: '巢穴建筑收入',
        });
        messages.push(`巢穴建筑产生了 ${income.gold} 金钱`);
      }
    }

    if (income.food > 0) {
      const success = this.addResource('food', income.food, '巢穴建筑收入');
      if (success) {
        changes.push({
          type: 'food',
          amount: income.food,
          reason: '巢穴建筑收入',
        });
        messages.push(`巢穴建筑产生了 ${income.food} 食物`);
      }
    }

    return { messages, changes };
  }

  // ==================== 世界书管理功能 ====================

  /**
   * 获取当前存档的世界书名称（始终使用默认世界书）
   */
  getCurrentWorldbookName(): string {
    // 始终使用默认世界书，通过数据库管理不同存档的世界书内容
    return '哥布林巢穴-人物档案';
  }

  /**
   * 保存当前世界书数据到数据库
   */
  async saveWorldbookToDatabase(slot: number): Promise<void> {
    try {
      // 始终从默认世界书获取内容
      let currentWorldbook: any[] = [];

      try {
        currentWorldbook = await window.TavernHelper.getWorldbook('哥布林巢穴-人物档案');
        console.log(`从默认世界书获取到 ${currentWorldbook.length} 个条目`);
      } catch (error) {
        console.log('默认世界书不存在或为空，保存空的世界书数据');
      }

      // 保存到数据库
      const saveId = `slot_${slot}`;
      await databaseService.saveWorldbookData(saveId, currentWorldbook);
      console.log(`世界书数据已保存到数据库，存档: ${saveId}`);
    } catch (error) {
      console.error('保存世界书数据到数据库失败:', error);
    }
  }

  /**
   * 从数据库恢复世界书数据到当前世界书
   */
  async restoreWorldbookFromDatabase(slot: number): Promise<void> {
    try {
      const saveId = `slot_${slot}`;
      const defaultWorldbookName = '哥布林巢穴-人物档案';

      // 从数据库读取世界书数据
      const worldbookData = await databaseService.loadWorldbookData(saveId);

      if (worldbookData && worldbookData.length > 0) {
        // 直接尝试恢复世界书内容到默认世界书
        try {
          await window.TavernHelper.replaceWorldbook(defaultWorldbookName, worldbookData);
          console.log(`已从数据库恢复 ${worldbookData.length} 个世界书条目到默认世界书`);
        } catch (error) {
          // 如果世界书不存在，先创建再恢复
          console.log(`默认世界书不存在，正在创建...`);
          await window.TavernHelper.createWorldbook(defaultWorldbookName, []);
          await window.TavernHelper.replaceWorldbook(defaultWorldbookName, worldbookData);
          console.log(`已从数据库恢复 ${worldbookData.length} 个世界书条目到默认世界书`);
        }

        // 【旧存档兼容性处理】检查并合并重复的"游戏事件记录"条目
        try {
          const merged = await GameEventLorebookManager.mergeDuplicateEventStoryEntries(defaultWorldbookName);
          if (merged) {
            console.log('✅ [旧存档兼容] 已合并重复的游戏事件记录条目');
          }
        } catch (mergeError) {
          console.warn('⚠️ [旧存档兼容] 合并重复的游戏事件记录条目时出错（不影响存档加载）:', mergeError);
        }

        // 【旧存档兼容性处理】修复据点征服记录中的无效英雄信息
        try {
          // 获取存档中的据点列表，用于修复英雄信息
          const explorationData = this.getModuleData<{
            locations: Location[];
          }>({ moduleName: 'exploration' });
          const savedLocations = explorationData?.locations || [];

          const fixed = await ConquestRecordManager.fixInvalidHeroesInConquestRecords(
            defaultWorldbookName,
            savedLocations,
          );
          if (fixed) {
            console.log('✅ [旧存档兼容] 已修复据点征服记录中的无效英雄信息');
          }
        } catch (fixError) {
          console.warn('⚠️ [旧存档兼容] 修复据点征服记录中的英雄信息时出错（不影响存档加载）:', fixError);
        }
      } else {
        console.log(`存档 ${saveId} 没有世界书数据，清空默认世界书`);
        // 清空默认世界书内容
        try {
          await window.TavernHelper.replaceWorldbook(defaultWorldbookName, []);
        } catch (error) {
          // 如果世界书不存在，创建空的世界书
          console.log(`默认世界书不存在，正在创建空的世界书...`);
          await window.TavernHelper.createWorldbook(defaultWorldbookName, []);
        }
      }
    } catch (error) {
      console.error('从数据库恢复世界书数据失败:', error);
    }
  }

  /**
   * 从源槽位复制调教记录数据到目标槽位
   * 当从其他槽位保存到新槽位时，需要将调教记录数据也复制过去
   */
  async copyTrainingHistoryFromSlot(sourceSaveId: string, targetSlot: number): Promise<void> {
    try {
      const targetSaveId = `slot_${targetSlot}`;

      // 如果源槽位就是目标槽位，不需要复制
      if (sourceSaveId === targetSaveId) {
        console.log(`源槽位和目标槽位相同，跳过复制调教记录数据`);
        return;
      }

      console.log(`📋 复制调教记录数据: ${sourceSaveId} -> ${targetSaveId}`);

      // 从源存档读取调教记录数据
      const sourceData = await databaseService.loadTrainingHistoryData(sourceSaveId);

      if (sourceData) {
        // 提取调教记录数据（不包括暂存数据，暂存数据应该保持为空）
        const trainingHistoryData: Record<string, any[]> = {};
        const pendingDialoguePairs: Record<string, { userInput: string; aiResponse: string } | null> = {};
        const pendingAttributeChanges: Record<string, { loyalty: number; stamina: number; character: any } | null> = {};
        const originalCharacters: Record<string, any | null> = {};

        // 复制调教记录（排除 pendingDialoguePairs、pendingAttributeChanges、originalCharacters）
        for (const [key, value] of Object.entries(sourceData)) {
          if (key !== 'pendingDialoguePairs' && key !== 'pendingAttributeChanges' && key !== 'originalCharacters') {
            if (Array.isArray(value)) {
              trainingHistoryData[key] = value;
            }
          }
        }

        // 复制暂存数据（如果存在）
        if (sourceData.pendingDialoguePairs) {
          Object.assign(pendingDialoguePairs, sourceData.pendingDialoguePairs);
        }
        if (sourceData.pendingAttributeChanges) {
          Object.assign(pendingAttributeChanges, sourceData.pendingAttributeChanges);
        }
        if (sourceData.originalCharacters) {
          Object.assign(originalCharacters, sourceData.originalCharacters);
        }

        // 保存到目标槽位
        await databaseService.saveTrainingHistoryData(
          targetSaveId,
          trainingHistoryData,
          pendingDialoguePairs,
          pendingAttributeChanges,
          originalCharacters,
        );

        const recordCount = Object.keys(trainingHistoryData).length;
        const pendingPairCount = Object.values(pendingDialoguePairs).filter(v => v !== null).length;
        const pendingAttrCount = Object.values(pendingAttributeChanges).filter(v => v !== null).length;
        const originalCharCount = Object.values(originalCharacters).filter(v => v !== null).length;

        console.log(
          `✅ 已复制调教记录数据到 ${targetSaveId}: ${recordCount} 个角色, ${pendingPairCount} 个暂存对话对, ${pendingAttrCount} 个暂存属性变化, ${originalCharCount} 个原始人物属性`,
        );
      } else {
        console.log(`ℹ️ 源存档 ${sourceSaveId} 没有调教记录数据，跳过复制`);
      }
    } catch (error) {
      console.error('复制调教记录数据失败:', error);
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 获取当前绑定的世界书内容
   */
  async getCurrentBoundWorldbook(): Promise<any[]> {
    try {
      // 获取当前绑定的世界书名称
      const currentWorldbookName = await this.getCurrentBoundWorldbookName();
      if (currentWorldbookName) {
        // 检查世界书是否存在
        const exists = await this.checkWorldbookExists(currentWorldbookName);
        if (exists) {
          return await window.TavernHelper.getWorldbook(currentWorldbookName);
        } else {
          console.log(`当前世界书 ${currentWorldbookName} 不存在，返回空内容`);
          return [];
        }
      }
      return [];
    } catch (error) {
      console.error('获取当前世界书内容失败:', error);
      return [];
    }
  }

  /**
   * 确保默认世界书存在
   */
  async ensureDefaultWorldbook(): Promise<void> {
    try {
      const defaultWorldbookName = '哥布林巢穴-人物档案';
      const exists = await this.checkWorldbookExists(defaultWorldbookName);
      if (!exists) {
        console.log('📥 从后端模板加载默认世界书...');
        try {
          // 从后端世界书模板获取内容
          const resp = await fetch('/api/worldbook/' + encodeURIComponent('哥布林巢穴-游戏设定'));
          if (resp.ok) {
            const templateData = await resp.json();
            await window.TavernHelper.createOrReplaceWorldbook(defaultWorldbookName, templateData);
            console.log('✅ 默认世界书已从模板创建');
            return;
          }
        } catch (e) {
          console.warn('⚠️ 从后端模板加载世界书失败，创建空白世界书:', e);
        }
        // 回退：创建空白世界书
        await window.TavernHelper.createWorldbook(defaultWorldbookName, []);
        console.log('默认世界书创建成功（空白）');
      }
    } catch (error) {
      console.error('创建默认世界书失败:', error);
    }
  }

  /**
   * 获取当前绑定的世界书名称
   */
  async getCurrentBoundWorldbookName(): Promise<string | null> {
    // 始终使用默认世界书，通过数据库管理不同存档的世界书内容
    return '哥布林巢穴-人物档案';
  }

  /**
   * 切换世界书关联到当前存档
   */
  async switchWorldbookToCurrentSave(): Promise<void> {
    try {
      const worldbookName = this.getCurrentWorldbookName();

      // 设置世界书服务的世界书名称
      WorldbookService.setWorldbookName(worldbookName);

      // 确保世界书存在
      const exists = await this.checkWorldbookExists(worldbookName);
      if (!exists) {
        console.log(`世界书 ${worldbookName} 不存在，正在创建...`);
        await window.TavernHelper.createWorldbook(worldbookName, []);
        console.log(`已创建世界书: ${worldbookName}`);
      }

      await window.TavernHelper.rebindChatWorldbook('current', worldbookName);
      console.log(`世界书已切换到: ${worldbookName}`);
    } catch (error) {
      console.error('切换世界书关联失败:', error);
    }
  }

  /**
   * 检查世界书是否存在
   */
  async checkWorldbookExists(worldbookName: string): Promise<boolean> {
    try {
      const worldbook = await window.TavernHelper.getWorldbook(worldbookName);
      return worldbook !== null && worldbook !== undefined;
    } catch (error) {
      console.error('检查世界书存在性失败:', error);
      return false;
    }
  }

  /**
   * 从数据库删除存档的世界书数据
   */
  async deleteWorldbookDataFromDatabase(slot: number): Promise<void> {
    try {
      const saveId = `slot_${slot}`;
      await databaseService.deleteWorldbookData(saveId);
      console.log(`已删除存档 ${saveId} 的世界书数据`);
    } catch (error) {
      console.error('删除存档世界书数据失败:', error);
    }
  }

  /**
   * 确保关键模块有默认数据
   * 后端模板的 training.characters / exploration.locations 可能为空，
   * 用前端 createFullGameData() 的默认值补全。
   */
  private ensureDefaultModules(gameData: ModularGameData): void {
    const defaults = createFullGameData();

    // 1. 补全调教人物：如果为空或只有玩家角色，合并前端默认人物（雫等）
    if (!gameData.training) {
      gameData.training = defaults.training;
    } else if (!gameData.training.characters || gameData.training.characters.length === 0) {
      gameData.training.characters = defaults.training.characters;
    } else {
      // 有部分人物 → 确保玩家角色和雫至少存在
      const existingIds = new Set(gameData.training.characters.map(c => c.id));
      for (const defChar of defaults.training.characters) {
        if (!existingIds.has(defChar.id)) {
          gameData.training.characters.push(defChar);
          existingIds.add(defChar.id);
        }
      }
    }

    // 2. 补全探索据点
    if (!gameData.exploration) {
      gameData.exploration = defaults.exploration;
    } else {
      if (!gameData.exploration.locations || gameData.exploration.locations.length === 0) {
        gameData.exploration.locations = defaults.exploration.locations;
      }
      if (!gameData.exploration.continents || gameData.exploration.continents.length === 0) {
        gameData.exploration.continents = defaults.exploration.continents;
      }
      if (!gameData.exploration.continentExploreState || Object.keys(gameData.exploration.continentExploreState?.continentProgress || {}).length === 0) {
        gameData.exploration.continentExploreState = defaults.exploration.continentExploreState;
      }
      if (!gameData.exploration.state) {
        gameData.exploration.state = defaults.exploration.state;
      }
    }

    // 3. 补全巢穴数据
    if (!gameData.nest || Object.keys(gameData.nest).length === 0) {
      gameData.nest = defaults.nest;
    }

    // 4. 补全历史记录
    if (!gameData.history) {
      gameData.history = defaults.history;
    }

    // 5. 补全部队配置
    if (!gameData.formation) {
      gameData.formation = defaults.formation;
    }

    console.log('✅ [初始化] 已补全默认模块数据（人物/据点/大陆/巢穴）');
  }

  /**
   * 【旧存档兼容性处理】迁移 attributes.Unittype 到 unitType
   * 将旧存档中人物 attributes.Unittype 字段迁移到新的 unitType 字段
   */
  private migrateUnitTypeFromAttributes(gameData: ModularGameData): void {
    try {
      if (!gameData.training || !gameData.training.characters) {
        return;
      }

      let migratedCount = 0;
      const characters = gameData.training.characters;

      for (const character of characters) {
        // 如果存在旧的 attributes.Unittype 且没有 unitType，进行迁移
        const attributes = character.attributes as any;
        if (
          attributes?.Unittype &&
          !character.unitType &&
          (attributes.Unittype === 'physical' || attributes.Unittype === 'magical')
        ) {
          character.unitType = attributes.Unittype as 'physical' | 'magical';
          // 删除旧的 Unittype 字段
          delete attributes.Unittype;
          migratedCount++;
        }
      }

      if (migratedCount > 0) {
        console.log(`✅ [旧存档兼容] 已迁移 ${migratedCount} 个人物的 Unittype 字段到 unitType`);
      }
    } catch (error) {
      console.warn('⚠️ [旧存档兼容] 迁移 Unittype 字段时出错（不影响存档加载）:', error);
    }
  }

  /**
   * 同步保存到后端文件系统（异步，不阻塞主流程）
   */
  private async syncToBackend(slot: number, gameData: ModularGameData): Promise<void> {
    try {
      const saveId = `slot_${slot}`;
      // 从后端获取最新世界书（管理器可能已通过 _saveWb 更新了后端，内存中是旧数据）
      let worldbookData = gameData.worldbook_data || { name: '哥布林巢穴-人物档案', entries: [] };
      try {
        const wbResp = await fetch('/api/saves/slot_0/worldbook');
        if (wbResp.ok) {
          const freshWb = await wbResp.json();
          if (freshWb.entries && freshWb.entries.length > 0) {
            worldbookData = freshWb;
            console.log(`📁 [后端同步] 使用最新世界书: ${freshWb.entries.length}条`);
          }
        }
      } catch (_e) { /* 获取失败使用内存数据 */ }

      await fetch('/api/saves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          save_id: saveId,
          data: gameData,
          worldbook_data: worldbookData,
        }),
      });
      console.log(`📁 已同步存档到后端: ${saveId}`);
    } catch (error) {
      // 后端同步失败不影响前端存档（静默处理）
      console.warn('⚠️ 后端存档同步失败（前端存档不受影响）:', error);
    }
  }

  /**
   * 处理错误
   */
  private handleError(error: Error): void {
    if (this.events.onError) {
      this.events.onError(error);
    }
  }
}

// 创建全局模块化存档管理器实例
export const modularSaveManager = new ModularSaveManager();
