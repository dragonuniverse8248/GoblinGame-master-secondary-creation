import type { Character } from '../../../../功能模块层/人物管理/类型/人物类型';
import type { Continent } from '../../../../功能模块层/探索/类型/大陆探索类型';
import { ChainOfThoughtManager, ChainOfThoughtMode } from '../工具/思维链管理器';
import { CharacterWorldbookManager } from '../管理器/人物信息管理器';
import { PreBattleDialogueManager } from '../管理器/人物剧情/战前对话管理器';
import { BattleSummaryManager } from '../管理器/人物剧情/战斗总结管理器';
import { TrainingRecordManager } from '../管理器/人物剧情/调教记录管理器';
import { GameEventLorebookManager } from '../管理器/历史记录/冒头事件管理器';
import { ConquestRecordManager } from '../管理器/历史记录/据点征服管理器';
import { ResourcesWorldbookManager } from '../管理器/历史记录/资源同步管理器';
import type { HistoryRecord } from '../类型/世界书类型定义';

// 导出思维链模式枚举供外部使用
export { ChainOfThoughtMode } from '../工具/思维链管理器';

/**
 * 世界书服务类 - 门面模式统一入口
 *
 * 这是一个门面类,提供简化的API来协调各个专门的管理器:
 * - CharacterWorldbookManager: 人物世界书管理
 * - PreBattleDialogueManager: 战前对话记录管理
 * - BattleSummaryManager: 战斗总结记录管理
 * - TrainingRecordManager: 调教记录管理
 * - ResourcesWorldbookManager: 资源世界书管理
 * - ConquestRecordManager: 据点征服记录管理
 * - GameEventLorebookManager: 游戏冒头事件记录管理
 * - ChainOfThoughtManager: 思维链管理
 */
export class WorldbookService {
  private static currentWorldbookName: string = '哥布林巢穴-人物档案';

  /** 会话级去重：记录已经完成世界书注入的大陆名称，防止重复写入 */
  private static _populatedContinents: Set<string> = new Set();

  /**
   * 设置世界书名称（由外部调用）
   */
  static setWorldbookName(worldbookName: string): void {
    this.currentWorldbookName = worldbookName;
  }

  /**
   * 重置会话级去重标记（新游戏时调用）
   */
  static resetPopulatedContinents(): void {
    this._populatedContinents.clear();
  }

  /**
   * 获取当前世界书名称
   */
  private static getCurrentWorldbookName(): string {
    return this.currentWorldbookName;
  }

  // ==================== 人物世界书管理 ====================

  /**
   * 为人物创建世界书并绑定到当前聊天
   */
  static async createCharacterWorldbook(character: Character): Promise<string> {
    const worldbookName = this.getCurrentWorldbookName();
    return CharacterWorldbookManager.createCharacterWorldbook(character, worldbookName);
  }

  /**
   * 获取人物世界书条目
   */
  static async getCharacterEntry(characterId: string): Promise<any> {
    const worldbookName = this.getCurrentWorldbookName();
    return CharacterWorldbookManager.getCharacterEntry(worldbookName, characterId);
  }

  /**
   * 更新人物世界书条目
   */
  static async updateCharacterEntry(character: Character): Promise<void> {
    const worldbookName = this.getCurrentWorldbookName();
    return CharacterWorldbookManager.updateCharacterEntry(worldbookName, character);
  }

  /**
   * 删除人物世界书条目
   */
  static async deleteCharacterEntry(characterId: string): Promise<void> {
    const worldbookName = this.getCurrentWorldbookName();
    return CharacterWorldbookManager.deleteCharacterEntry(worldbookName, characterId);
  }

  /**
   * 删除指定人物的剧情记录条目（包含所有调教、对话等历史记录）
   */
  static async deleteCharacterStoryHistoryEntry(characterId: string): Promise<void> {
    const worldbookName = this.getCurrentWorldbookName();

    // 删除整个剧情记录条目
    await TrainingRecordManager.deleteTrainingHistory(characterId, worldbookName);
  }

  /**
   * 清空所有人物档案、剧情记录、据点征服记录和游戏事件记录世界书条目
   */
  static async clearCharacterAndStoryEntries(): Promise<void> {
    const worldbookName = this.getCurrentWorldbookName();
    return CharacterWorldbookManager.clearCharacterAndStoryEntries(worldbookName);
  }

  // ==================== 资源世界书管理 ====================

  /**
   * 初始化资源世界书条目（游戏开始时创建）
   */
  static async initializeResourcesWorldbook(resources: any, continents: Continent[] = []): Promise<void> {
    const worldbookName = this.getCurrentWorldbookName();
    return ResourcesWorldbookManager.initialize(worldbookName, resources, continents);
  }

  /**
   * 更新资源世界书条目
   */
  static async updateResourcesWorldbook(resources: any, continents: Continent[] = []): Promise<void> {
    const worldbookName = this.getCurrentWorldbookName();
    return ResourcesWorldbookManager.update(worldbookName, resources, continents);
  }

  // ==================== 战前对话记录管理 ====================

  /**
   * 批量添加战前对话记录
   */
  static async addMultipleDialogueRecords(
    characterId: string,
    characterName: string,
    dialogueRecords: HistoryRecord[],
    characterStatus?: string,
  ): Promise<void> {
    const worldbookName = this.getCurrentWorldbookName();
    return PreBattleDialogueManager.addMultipleDialogueRecords(
      characterId,
      characterName,
      worldbookName,
      dialogueRecords,
      characterStatus,
    );
  }

  // ==================== 战斗总结记录管理 ====================

  /**
   * 批量添加战斗总结记录
   */
  static async addMultipleBattleSummaryRecords(
    characterId: string,
    characterName: string,
    battleSummaryRecords: HistoryRecord[],
    characterStatus?: string,
  ): Promise<void> {
    const worldbookName = this.getCurrentWorldbookName();
    return BattleSummaryManager.addMultipleBattleSummaryRecords(
      characterId,
      characterName,
      worldbookName,
      battleSummaryRecords,
      characterStatus,
    );
  }

  // ==================== 调教记录管理 ====================

  /**
   * 获取现有的调教记录
   */
  static async getExistingTrainingHistory(characterName: string): Promise<HistoryRecord[]> {
    const worldbookName = this.getCurrentWorldbookName();
    return TrainingRecordManager.getExistingTrainingHistory(characterName, worldbookName);
  }

  /**
   * 批量添加调教记录
   */
  static async addMultipleTrainingRecords(
    characterId: string,
    characterName: string,
    trainingRecords: HistoryRecord[],
    characterStatus?: string,
  ): Promise<void> {
    const worldbookName = this.getCurrentWorldbookName();
    return TrainingRecordManager.addMultipleTrainingRecords(
      characterId,
      characterName,
      worldbookName,
      trainingRecords,
      characterStatus,
    );
  }

  // ==================== 据点征服记录管理 ====================

  /**
   * 添加据点征服记录到世界书
   */
  static async addConquestRecord(
    location: any,
    battleResult: any,
    gameTime: string,
    regionDescription?: string,
  ): Promise<void> {
    const worldbookName = this.getCurrentWorldbookName();
    return ConquestRecordManager.addConquestRecord(worldbookName, location, battleResult, gameTime, regionDescription);
  }

  // ==================== 游戏冒头事件记录管理 ====================

  /**
   * 创建游戏事件故事记录到世界书
   */
  static async createEventStoryRecord(
    eventId: string,
    eventName: string,
    eventContent: string,
    gameTime: string,
  ): Promise<void> {
    const worldbookName = this.getCurrentWorldbookName();
    return GameEventLorebookManager.createEventStoryRecord(worldbookName, eventId, eventName, eventContent, gameTime);
  }

  // ==================== 思维链管理 ====================

  /**
   * 设置思维链模式（共用同一个世界书条目，调用时更新内容）
   * @param mode 思维链模式
   */
  static async setChainOfThoughtMode(mode: ChainOfThoughtMode): Promise<void> {
    const worldbookName = this.getCurrentWorldbookName();
    return ChainOfThoughtManager.addChainToWorldbook(worldbookName, mode);
  }

  /**
   * 初始化思维链条目（首次使用时创建）
   */
  static async initializeChainOfThought(): Promise<void> {
    const worldbookName = this.getCurrentWorldbookName();
    return ChainOfThoughtManager.initializeChainToWorldbook(worldbookName);
  }

  /**
   * 移除思维链条目
   */
  static async removeChainOfThought(): Promise<void> {
    const worldbookName = this.getCurrentWorldbookName();
    return ChainOfThoughtManager.removeChainFromWorldbook(worldbookName);
  }

  /**
   * 检查思维链条目是否存在
   */
  static async chainOfThoughtExists(): Promise<boolean> {
    const worldbookName = this.getCurrentWorldbookName();
    return ChainOfThoughtManager.chainExistsInWorldbook(worldbookName);
  }

  // ==================== 大陆传说人物预写入 ====================

  /**
   * 从 images/{continent}/索引.json 读取传说人物并写入世界书，
   * 同时从模板世界书搜索该大陆的设定条目并写入存档。
   * 用于大陆解锁时预写入，节省 token（不需要等侦查才发现）
   */
  static async populateContinentLegendary(continentName: string): Promise<number> {
    // 会话级去重：如果该大陆已经完成注入（或正在进行中），直接跳过
    if (this._populatedContinents.has(continentName)) {
      console.log(`📖 [世界书] 大陆"${continentName}"已在本次会话中完成注入，跳过重复调用`);
      return 0;
    }
    // 立即标记，防止并发重复调用
    this._populatedContinents.add(continentName);

    let addedCount = 0;
    const worldbookName = this.getCurrentWorldbookName();

    try {
      // 1. 从 images 索引加载传奇人物数据
      const indexResp = await fetch(`/api/images/${encodeURIComponent(continentName)}/index`);
      let legendary: any[] = [];
      if (indexResp.ok) {
        const index = await indexResp.json();
        legendary = index?.['传奇'] || [];
      }

      // 2. 写入传奇人物世界书条目，并回写 worldbook_uid 到索引
      if (Array.isArray(legendary) && legendary.length > 0) {
        for (const char of legendary) {
          try {
            const charId = `legendary_${continentName}_${char.name}`;
            const character = {
              id: charId,
              name: char.name || '未知',
              title: char.title || '',
              race: char.race || '未知',
              background: char.background || '',
              personality: Array.isArray(char.personality) ? char.personality : [],
              status: 'uncaptured',
            } as any;

            // 如果索引中已有 worldbook_uid，跳过已写入的人物
            if (char.worldbook_uid) {
              console.log(`📖 [世界书] 人物"${char.name}"已有世界书条目(uid=${char.worldbook_uid})，跳过`);
              continue;
            }

            await CharacterWorldbookManager.createCharacterWorldbook(character, worldbookName);

            // 回写 worldbook_uid 到索引.json
            try {
              const wb = await WorldbookHelper.get(worldbookName);
              const entry = WorldbookHelper.findEntry(wb, (e: any) => e.extra?.character_id === charId);
              if (entry) {
                const uid = entry.uid;
                await fetch(
                  `/api/images/${encodeURIComponent(continentName)}/character/${encodeURIComponent(char.name)}/worldbook-uid`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ worldbook_uid: uid }),
                  },
                );
                console.log(`📖 [世界书] 人物"${char.name}"世界书UID已回写: ${uid}`);
              }
            } catch (wbErr) {
              console.warn(`📖 [世界书] 回写人物"${char.name}"的worldbook_uid失败:`, wbErr);
            }

            addedCount++;
          } catch (_e) { /* 单个人物失败不影响其他 */ }
        }
        console.log(`📖 [世界书] 大陆"${continentName}"传说人物已写入: ${addedCount}人`);
      }

      // 3. 从模板世界书搜索大陆设定并写入存档世界书
      try {
        const templateResp = await fetch(
          `/api/worldbook/template/continent/${encodeURIComponent(continentName)}`,
        );
        if (templateResp.ok) {
          const templateData = await templateResp.json();
          const continentSetting = templateData?.continent_setting;
          if (continentSetting) {
            // 将大陆设定转换为世界书条目内容
            const content = this.buildContinentSettingContent(continentName, continentSetting);
            const entryUID = this.generateContinentUID(continentName);

            await WorldbookHelper.ensureExists(worldbookName);
            const worldbook = await WorldbookHelper.get(worldbookName);

            // 检查是否已存在该大陆设定条目
            const existingIndex = WorldbookHelper.findEntryIndex(
              worldbook,
              (e: any) => e.extra?.entry_type === 'continent_setting' && e.extra?.continent_name === continentName,
            );

            if (existingIndex === -1) {
              const entry: any = {
                name: `${continentName}设定`,
                content,
                uid: entryUID,
                enabled: true,
                strategy: {
                  type: 'selective',
                  keys: [continentName],
                  keys_secondary: { logic: 'and_any', keys: [] },
                  scan_depth: 'same_as_global' as any,
                },
                position: {
                  type: 'at_depth',
                  role: 'system',
                  depth: 1,
                  order: 200,
                },
                probability: 100,
                recursion: { prevent_incoming: false, prevent_outgoing: false, delay_until: null },
                effect: { sticky: null, cooldown: null, delay: null },
                extra: {
                  entry_type: 'continent_setting',
                  continent_name: continentName,
                  created_at: new Date().toISOString(),
                },
              };
              worldbook.push(entry);
              await WorldbookHelper.replace(worldbookName, worldbook);
              console.log(`📖 [世界书] 大陆"${continentName}"设定已写入世界书`);
            } else {
              console.log(`📖 [世界书] 大陆"${continentName}"设定已存在，跳过`);
            }

            // 4. 同时将模板中匹配的其他条目写入（如势力设定等）
            const matchedEntries = templateData?.matched_entries || [];
            if (matchedEntries.length > 0) {
              for (const matchedEntry of matchedEntries) {
                // 跳过 uid=1(大陆设定本身) 和已经处理过的
                const matchedUID = parseInt(matchedEntry.uid || '0', 10);
                if (matchedUID === 1) continue;

                const matchedIndex = WorldbookHelper.findEntryIndex(
                  worldbook,
                  (e: any) => e.uid === matchedUID + 1000, // 使用偏移避免与模板冲突
                );
                if (matchedIndex === -1) {
                  const entry: any = {
                    name: matchedEntry.comment || `${continentName}相关设定`,
                    content: matchedEntry.content || '',
                    uid: matchedUID + 1000, // 偏移避免与模板 uid 冲突
                    enabled: true,
                    strategy: {
                      type: matchedEntry.constant ? 'constant' : 'selective',
                      keys: matchedEntry.key || [continentName],
                      keys_secondary: {
                        logic: 'and_any',
                        keys: matchedEntry.keysecondary || [],
                      },
                      scan_depth: 'same_as_global' as any,
                    },
                    position: {
                      type: 'at_depth',
                      role: 'system',
                      depth: 1,
                      order: matchedEntry.order || 201,
                    },
                    probability: matchedEntry.probability || 100,
                    recursion: {
                      prevent_incoming: matchedEntry.preventRecursion || false,
                      prevent_outgoing: matchedEntry.excludeRecursion || false,
                      delay_until: matchedEntry.delayUntilRecursion ? 0 : null,
                    },
                    effect: { sticky: matchedEntry.sticky || null, cooldown: matchedEntry.cooldown || null, delay: matchedEntry.delay || null },
                    extra: {
                      entry_type: 'template_match',
                      continent_name: continentName,
                      template_uid: matchedUID,
                      created_at: new Date().toISOString(),
                    },
                  };
                  worldbook.push(entry);
                }
              }
              await WorldbookHelper.replace(worldbookName, worldbook);
              console.log(`📖 [世界书] 大陆"${continentName}"相关模板条目已写入`);
            }
          }
        }
      } catch (templateErr) {
        console.warn(`📖 [世界书] 大陆"${continentName}"模板设定写入失败:`, templateErr);
      }
    } catch (_e) {
      console.warn(`📖 [世界书] 大陆"${continentName}"索引加载失败:`, _e);
    }
    return addedCount;
  }

  /**
   * 将大陆设定 YAML 数据转换为世界书条目内容（Markdown 格式）
   */
  private static buildContinentSettingContent(continentName: string, setting: Record<string, any>): string {
    const lines: string[] = [`# ${continentName}`, ''];

    for (const [key, value] of Object.entries(setting)) {
      if (key === '描述' && typeof value === 'string') {
        lines.push(`**概述**: ${value}`);
        lines.push('');
      } else if (key === '子区域' && typeof value === 'object' && value !== null) {
        lines.push('## 子区域');
        lines.push('');
        for (const [regionName, regionData] of Object.entries(value as Record<string, any>)) {
          const desc = typeof regionData === 'object' && regionData !== null
            ? (regionData as any).描述 || (regionData as any).description || ''
            : String(regionData || '');
          lines.push(`### ${regionName}`);
          if (desc) lines.push(desc);
          lines.push('');
        }
      } else if (typeof value === 'string') {
        lines.push(`**${key}**: ${value}`);
        lines.push('');
      } else if (Array.isArray(value)) {
        lines.push(`**${key}**:`);
        for (const item of value) {
          if (typeof item === 'string') lines.push(`  - ${item}`);
        }
        lines.push('');
      } else if (typeof value === 'object' && value !== null) {
        lines.push(`**${key}**:`);
        for (const [subKey, subValue] of Object.entries(value as Record<string, any>)) {
          if (typeof subValue === 'string') {
            lines.push(`  - **${subKey}**: ${subValue}`);
          }
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * 为大陆生成确定性 UID（基于大陆名称哈希）
   */
  private static generateContinentUID(continentName: string): number {
    let hash = 0;
    const str = `continent_setting_${continentName}`;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash) % 900000 + 100000; // 确保在 100000-999999 范围
  }

  /**
   * 新游戏初始化：预写入古拉尔大陆 + 默认的传说人物
   */
  static async populateInitialLegendary(): Promise<void> {
    this.resetPopulatedContinents();
    await this.populateContinentLegendary('默认');
    await this.populateContinentLegendary('古拉尔大陆');
  }
}
