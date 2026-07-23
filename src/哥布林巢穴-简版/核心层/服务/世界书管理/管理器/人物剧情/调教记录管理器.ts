import type { Character } from '../../../../../功能模块层/人物管理/类型/人物类型';
import { databaseService } from '../../../存档系统/数据库服务';
import { WorldbookHelper } from '../../工具/世界书助手';
import { RecordBuilder } from '../../工具/记录构建器';
import type { HistoryRecord } from '../../类型/世界书类型定义';

/**
 * 调教记录管理器 - 专门负责调教记录的管理
 */
export class TrainingRecordManager {
  /**
   * 获取现有的调教记录
   * 优先从数据库读取，如果数据库没有则从世界书读取（兼容旧数据）
   */
  static async getExistingTrainingHistory(characterName: string, worldbookName: string): Promise<HistoryRecord[]> {
    console.log('🔍 [调教记录管理器] 开始获取调教记录', {
      characterName,
      worldbookName,
    });

    try {
      // 首先尝试从数据库读取
      const currentSaveId = databaseService.getCurrentSaveId();
      if (currentSaveId) {
        console.log('💾 正在从数据库读取调教记录...', { saveId: currentSaveId, characterName });
        const dbData = await databaseService.loadTrainingHistoryData(currentSaveId);
        if (dbData && dbData[characterName]) {
          const records = dbData[characterName];
          // 验证格式并转换
          const validatedRecords = this.validateAndConvertHistoryRecords(records);

          // 如果有暂存的对话对，也添加到记录中（但标记为未保存）
          // 注意：暂存的对话对不会永久保存，只在总结时使用
          // 如果需要显示暂存的对话对，可以在UI层处理

          if (validatedRecords.length > 0) {
            console.log(`✅ 从数据库获取到 ${validatedRecords.length} 条调教记录`);
            // 如果有暂存的对话对，在日志中提示
            if (dbData.pendingDialoguePairs?.[characterName]) {
              console.log(`ℹ️ 该角色有暂存的对话对（未选择下一个选项）`);
            }
            return validatedRecords;
          }
        }
        console.log('ℹ️ 数据库中未找到该角色的调教记录，尝试从世界书读取');
      }

      // 如果数据库没有，则从世界书读取（兼容旧数据）
      console.log('📚 正在从世界书获取调教记录...');
      const worldbook = await WorldbookHelper.get(worldbookName);
      console.log(`📊 世界书包含 ${worldbook.length} 个条目`);

      console.log('🔎 正在查找剧情记录条目...');
      const historyEntry = WorldbookHelper.findEntry(
        worldbook,
        entry => entry.extra?.entry_type === 'character_story_history' && entry.extra?.character_id === characterName,
      );

      if (historyEntry) {
        console.log('✅ 找到剧情记录条目:', {
          name: historyEntry.name,
          contentLength: historyEntry.content?.length || 0,
          contentPreview: historyEntry.content?.substring(0, 200) || '',
        });

        console.log('🔄 正在解析调教记录...');
        const records = this.parseTrainingHistory(historyEntry.content);
        console.log(`✅ 解析完成，共 ${records.length} 条记录`);

        // 如果从世界书读取到数据，同步到数据库（兼容旧数据迁移）
        if (records.length > 0 && currentSaveId) {
          console.log('💾 将世界书中的调教记录同步到数据库...');
          await this.saveTrainingHistoryToDatabase(characterName, records, currentSaveId);
        }

        return records;
      } else {
        console.log('ℹ️ 未找到该角色的剧情记录条目');
        console.log('📋 世界书中的所有条目类型:');
        worldbook.slice(0, 10).forEach((entry, index) => {
          console.log(`  [${index}]`, {
            name: entry.name,
            entryType: entry.extra?.entry_type,
            characterId: entry.extra?.character_id,
          });
        });
        if (worldbook.length > 10) {
          console.log(`  ... 还有 ${worldbook.length - 10} 个条目`);
        }
      }

      return [];
    } catch (error) {
      console.error('❌ 获取现有调教记录失败:', error);
      console.error('错误详情:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return [];
    }
  }

  /**
   * 批量添加调教记录（增量追加模式）
   * 同时保存到世界书和数据库
   */
  static async addMultipleTrainingRecords(
    characterId: string,
    characterName: string,
    worldbookName: string,
    trainingRecords: HistoryRecord[],
    characterStatus?: string,
  ): Promise<void> {
    try {
      // 检查是否为player角色
      if (WorldbookHelper.isPlayerCharacter(characterId, characterName, characterStatus)) {
        console.log(`跳过player角色 ${characterName} 的调教记录`);
        return;
      }

      // 直接获取旧的世界书条目
      const worldbook = await WorldbookHelper.get(worldbookName);
      const existingEntry = WorldbookHelper.findEntry(
        worldbook,
        entry => entry.extra?.entry_type === 'character_story_history' && entry.extra?.character_id === characterId,
      );

      let newContent: string;

      if (existingEntry && existingEntry.content) {
        // 如果存在旧条目，直接在旧内容基础上追加新记录
        newContent = this.appendTrainingRecords(existingEntry.content, trainingRecords);
      } else {
        // 如果不存在旧条目，直接构建新内容（带XML标签）
        newContent = RecordBuilder.buildTrainingSection(trainingRecords);
      }

      // 更新世界书
      await this.updateTrainingEntry(characterId, characterName, worldbookName, newContent);

      // 同时保存到数据库
      const currentSaveId = databaseService.getCurrentSaveId();
      if (currentSaveId) {
        console.log('💾 同时保存调教记录到数据库...');
        // 从数据库获取已有记录（不递归调用getExistingTrainingHistory）
        const existingData = await databaseService.loadTrainingHistoryData(currentSaveId);
        const existingRecords = (existingData && existingData[characterName]) || [];
        // 合并新记录（追加模式）
        const allRecords = [...existingRecords, ...trainingRecords];
        await this.saveTrainingHistoryToDatabase(characterName, allRecords, currentSaveId);
      }

      console.log(`✅ 已增量添加 ${trainingRecords.length} 条调教记录到 ${characterName}`);
    } catch (error) {
      console.error('批量添加调教记录失败:', error);
      throw error;
    }
  }

  /**
   * 保存调教记录到数据库
   */
  private static async saveTrainingHistoryToDatabase(
    characterName: string,
    records: HistoryRecord[],
    saveId: string,
    pendingDialoguePair?: { userInput: string; aiResponse: string } | null,
  ): Promise<void> {
    try {
      // 获取数据库中已有的所有调教记录
      const existingData = await databaseService.loadTrainingHistoryData(saveId);
      const allTrainingHistory = existingData || {};
      const existingPendingPairs = existingData?.pendingDialoguePairs || {};

      // 更新该角色的调教记录
      allTrainingHistory[characterName] = records;

      // 如果有暂存的对话对，更新它（null表示清除）
      if (pendingDialoguePair !== undefined) {
        existingPendingPairs[characterName] = pendingDialoguePair;
      }

      // 保存回数据库（包括所有暂存数据）
      await databaseService.saveTrainingHistoryData(
        saveId,
        allTrainingHistory,
        existingPendingPairs,
        undefined, // pendingAttributeChanges 由单独的方法管理
        undefined, // originalCharacters 由单独的方法管理
      );
      console.log(`✅ 已保存 ${records.length} 条调教记录到数据库 (${characterName})`);
    } catch (error) {
      console.error('保存调教记录到数据库失败:', error);
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 保存暂存的对话对到数据库
   * @param characterName 角色名称
   * @param userInput 用户输入
   * @param aiResponse AI回复
   * @param saveId 存档ID
   */
  static async savePendingDialoguePair(
    characterName: string,
    userInput: string,
    aiResponse: string,
    saveId?: string,
  ): Promise<void> {
    try {
      const currentSaveId = saveId || databaseService.getCurrentSaveId();
      if (!currentSaveId) {
        console.log('ℹ️ 没有当前存档ID，跳过保存暂存对话对');
        return;
      }

      // 获取数据库中已有的所有数据
      const existingData = await databaseService.loadTrainingHistoryData(currentSaveId);
      const allTrainingHistory = existingData || {};
      const existingPendingPairs = existingData?.pendingDialoguePairs || {};
      const existingPendingAttrs = existingData?.pendingAttributeChanges || {};
      const existingOriginalChars = existingData?.originalCharacters || {};

      // 更新暂存的对话对
      existingPendingPairs[characterName] = {
        userInput,
        aiResponse,
      };

      // 保存回数据库（包括所有暂存数据）
      await databaseService.saveTrainingHistoryData(
        currentSaveId,
        allTrainingHistory,
        existingPendingPairs,
        existingPendingAttrs,
        existingOriginalChars,
      );
      console.log(`✅ 已保存暂存对话对到数据库 (${characterName})`);
    } catch (error) {
      console.error('保存暂存对话对到数据库失败:', error);
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 清除暂存的对话对（当用户选择下一个选项时）
   * @param characterName 角色名称
   * @param saveId 存档ID
   */
  static async clearPendingDialoguePair(characterName: string, saveId?: string): Promise<void> {
    try {
      const currentSaveId = saveId || databaseService.getCurrentSaveId();
      if (!currentSaveId) {
        return;
      }

      // 获取数据库中已有的所有数据
      const existingData = await databaseService.loadTrainingHistoryData(currentSaveId);
      const allTrainingHistory = existingData || {};
      const existingPendingPairs = existingData?.pendingDialoguePairs || {};
      const existingPendingAttrs = existingData?.pendingAttributeChanges || {};
      const existingOriginalChars = existingData?.originalCharacters || {};

      // 清除暂存的对话对
      existingPendingPairs[characterName] = null;

      // 保存回数据库（包括所有暂存数据）
      await databaseService.saveTrainingHistoryData(
        currentSaveId,
        allTrainingHistory,
        existingPendingPairs,
        existingPendingAttrs,
        existingOriginalChars,
      );
      console.log(`✅ 已清除暂存对话对 (${characterName})`);
    } catch (error) {
      console.error('清除暂存对话对失败:', error);
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 获取暂存的对话对
   * @param characterName 角色名称
   * @param saveId 存档ID
   * @returns 暂存的对话对，如果没有则返回null
   */
  static async getPendingDialoguePair(
    characterName: string,
    saveId?: string,
  ): Promise<{ userInput: string; aiResponse: string } | null> {
    try {
      const currentSaveId = saveId || databaseService.getCurrentSaveId();
      if (!currentSaveId) {
        return null;
      }

      const existingData = await databaseService.loadTrainingHistoryData(currentSaveId);
      if (existingData?.pendingDialoguePairs?.[characterName]) {
        return existingData.pendingDialoguePairs[characterName];
      }
      return null;
    } catch (error) {
      console.error('获取暂存对话对失败:', error);
      return null;
    }
  }

  /**
   * 保存暂存的属性变化到数据库
   * @param characterName 角色名称
   * @param loyalty 忠诚度
   * @param stamina 体力
   * @param character 完整的人物对象
   * @param saveId 存档ID
   */
  static async savePendingAttributeChanges(
    characterName: string,
    loyalty: number,
    stamina: number,
    character: any,
    saveId?: string,
  ): Promise<void> {
    try {
      const currentSaveId = saveId || databaseService.getCurrentSaveId();
      if (!currentSaveId) {
        console.log('ℹ️ 没有当前存档ID，跳过保存暂存属性变化');
        return;
      }

      // 获取数据库中已有的所有数据
      const existingData = await databaseService.loadTrainingHistoryData(currentSaveId);
      const allTrainingHistory = existingData || {};
      const existingPendingPairs = existingData?.pendingDialoguePairs || {};
      const existingPendingAttrs = existingData?.pendingAttributeChanges || {};
      const existingOriginalChars = existingData?.originalCharacters || {};

      // 更新暂存的属性变化
      existingPendingAttrs[characterName] = {
        loyalty,
        stamina,
        character,
      };

      // 保存回数据库（包括所有暂存数据）
      await databaseService.saveTrainingHistoryData(
        currentSaveId,
        allTrainingHistory,
        existingPendingPairs,
        existingPendingAttrs,
        existingOriginalChars,
      );
      console.log(`✅ 已保存暂存属性变化到数据库 (${characterName})`);
    } catch (error) {
      console.error('保存暂存属性变化失败:', error);
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 清除暂存的属性变化（当属性变化被应用时）
   * @param characterName 角色名称
   * @param saveId 存档ID
   */
  static async clearPendingAttributeChanges(characterName: string, saveId?: string): Promise<void> {
    try {
      const currentSaveId = saveId || databaseService.getCurrentSaveId();
      if (!currentSaveId) {
        return;
      }

      // 获取数据库中已有的所有数据
      const existingData = await databaseService.loadTrainingHistoryData(currentSaveId);
      const allTrainingHistory = existingData || {};
      const existingPendingPairs = existingData?.pendingDialoguePairs || {};
      const existingPendingAttrs = existingData?.pendingAttributeChanges || {};
      const existingOriginalChars = existingData?.originalCharacters || {};

      // 清除暂存的属性变化
      existingPendingAttrs[characterName] = null;

      // 保存回数据库（包括所有暂存数据）
      await databaseService.saveTrainingHistoryData(
        currentSaveId,
        allTrainingHistory,
        existingPendingPairs,
        existingPendingAttrs,
        existingOriginalChars,
      );
      console.log(`✅ 已清除暂存属性变化 (${characterName})`);
    } catch (error) {
      console.error('清除暂存属性变化失败:', error);
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 获取暂存的属性变化
   * @param characterName 角色名称
   * @param saveId 存档ID
   * @returns 暂存的属性变化，如果没有则返回null
   */
  static async getPendingAttributeChanges(
    characterName: string,
    saveId?: string,
  ): Promise<{ loyalty: number; stamina: number; character: any } | null> {
    try {
      const currentSaveId = saveId || databaseService.getCurrentSaveId();
      if (!currentSaveId) {
        return null;
      }

      const existingData = await databaseService.loadTrainingHistoryData(currentSaveId);
      if (existingData?.pendingAttributeChanges?.[characterName]) {
        return existingData.pendingAttributeChanges[characterName];
      }
      return null;
    } catch (error) {
      console.error('获取暂存属性变化失败:', error);
      return null;
    }
  }

  /**
   * 保存原始人物属性到数据库（用于重新生成时恢复）
   * @param characterName 角色名称
   * @param character 原始人物对象
   * @param saveId 存档ID
   */
  static async saveOriginalCharacter(characterName: string, character: any, saveId?: string): Promise<void> {
    try {
      const currentSaveId = saveId || databaseService.getCurrentSaveId();
      if (!currentSaveId) {
        console.log('ℹ️ 没有当前存档ID，跳过保存原始人物属性');
        return;
      }

      // 获取数据库中已有的所有数据
      const existingData = await databaseService.loadTrainingHistoryData(currentSaveId);
      const allTrainingHistory = existingData || {};
      const existingPendingPairs = existingData?.pendingDialoguePairs || {};
      const existingPendingAttrs = existingData?.pendingAttributeChanges || {};
      const existingOriginalChars = existingData?.originalCharacters || {};

      // 更新原始人物属性
      existingOriginalChars[characterName] = character;

      // 保存回数据库（包括所有暂存数据）
      await databaseService.saveTrainingHistoryData(
        currentSaveId,
        allTrainingHistory,
        existingPendingPairs,
        existingPendingAttrs,
        existingOriginalChars,
      );
      console.log(`✅ 已保存原始人物属性到数据库 (${characterName})`);
    } catch (error) {
      console.error('保存原始人物属性失败:', error);
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 获取原始人物属性
   * @param characterName 角色名称
   * @param saveId 存档ID
   * @returns 原始人物属性，如果没有则返回null
   */
  static async getOriginalCharacter(characterName: string, saveId?: string): Promise<any | null> {
    try {
      const currentSaveId = saveId || databaseService.getCurrentSaveId();
      if (!currentSaveId) {
        return null;
      }

      const existingData = await databaseService.loadTrainingHistoryData(currentSaveId);
      if (existingData?.originalCharacters?.[characterName]) {
        return existingData.originalCharacters[characterName];
      }
      return null;
    } catch (error) {
      console.error('获取原始人物属性失败:', error);
      return null;
    }
  }

  /**
   * 在现有内容基础上追加新的调教记录
   * 直接操作字符串，避免解析和重建
   * 保留其他类型的记录（战前对话、战斗总结）
   */
  private static appendTrainingRecords(existingContent: string, newRecords: HistoryRecord[]): string {
    // 查找 </training_history> 标签的位置
    const closingTagMatch = existingContent.match(/<\/training_history>/);

    if (!closingTagMatch) {
      // 如果没有找到结束标签，检查是否有其他记录
      console.warn('未找到调教记录标签，尝试构建新的调教记录');
      const newTrainingSection = RecordBuilder.buildTrainingSection(newRecords);

      // 调教记录通常在最后，直接追加到末尾
      if (existingContent.trim()) {
        return existingContent + newTrainingSection;
      }
      return newTrainingSection;
    }

    // 构建新记录的文本
    const newRecordsText = newRecords
      .map(record => {
        const time = record.gameTime || '未知时间';
        const sender = record.sender === 'user' ? '{{user}}' : record.sender;
        return `[${time}] ${sender}: ${record.content}`;
      })
      .join('\n');

    // 在 </training_history> 之前插入新记录
    const insertPosition = closingTagMatch.index!;
    const beforeClosing = existingContent.substring(0, insertPosition);
    const afterClosing = existingContent.substring(insertPosition);

    // 确保在插入前有换行符
    const needsNewline = !beforeClosing.endsWith('\n');
    return beforeClosing + (needsNewline ? '\n' : '') + newRecordsText + '\n' + afterClosing;
  }

  /**
   * 获取角色数据（使用动态导入避免循环依赖）
   * @param characterId 角色ID或名称
   * @param characterName 角色名称
   * @returns 角色数据，如果未找到则返回null
   */
  private static async getCharacterData(characterId: string, characterName: string): Promise<Character | null> {
    try {
      // 动态导入 modularSaveManager 避免循环依赖
      // eslint-disable-next-line import-x/no-cycle
      const { modularSaveManager } = await import('../../../存档系统/模块化存档服务');
      const trainingData = modularSaveManager.getModuleData({ moduleName: 'training' }) as any;
      if (trainingData?.characters && Array.isArray(trainingData.characters)) {
        const character = trainingData.characters.find(
          (char: Character) => char.id === characterId || char.name === characterName,
        );
        return character || null;
      }
    } catch (error) {
      console.warn('获取角色数据失败:', error);
    }
    return null;
  }

  /**
   * 更新调教记录世界书条目
   */
  private static async updateTrainingEntry(
    characterId: string,
    characterName: string,
    worldbookName: string,
    content: string,
  ): Promise<void> {
    await WorldbookHelper.ensureExists(worldbookName);
    const worldbook = await WorldbookHelper.get(worldbookName);
    const historyEntryIndex = WorldbookHelper.findEntryIndex(
      worldbook,
      entry => entry.extra?.entry_type === 'character_story_history' && entry.extra?.character_id === characterId,
    );

    // 获取角色数据，用于应用额外关键词和全局常量设置
    const character = await this.getCharacterData(characterId, characterName);
    const secondaryKeys = character?.worldbookSecondaryKeys || [];
    const isGlobalStoryHistory = character?.isGlobalStoryHistory || false;
    const characterTitle = character?.title;

    // content 已包含完整记录（调用方已 appendTrainingRecords），只需保留 summary
    let finalContent = content;
    if (historyEntryIndex !== -1) {
      const existingEntry = worldbook[historyEntryIndex];
      const summaries = WorldbookHelper.extractAndDeduplicateSummaries(existingEntry.content || '');
      if (summaries.length > 0) {
        finalContent = WorldbookHelper.combineSummaries(summaries) + '\n\n' + content;
      }
    }

    const historyEntry = WorldbookHelper.createCharacterStoryHistoryEntry(
      characterId,
      characterName,
      finalContent,
      secondaryKeys,
      isGlobalStoryHistory,
      characterTitle,
    );

    if (historyEntryIndex !== -1) {
      // 更新现有条目（UID 已经是固定的，直接替换，保留其他字段）
      const existingEntry = worldbook[historyEntryIndex];
      worldbook[historyEntryIndex] = {
        ...existingEntry,
        ...historyEntry,
        // 保留现有的 extra 数据，只更新 updated_at
        extra: {
          ...existingEntry.extra,
          ...historyEntry.extra,
          updated_at: new Date().toISOString(),
        },
      };
    } else {
      // 创建新条目
      worldbook.push(historyEntry);
    }

    await WorldbookHelper.replace(worldbookName, worldbook);
  }

  /**
   * 解析调教记录
   */
  static parseTrainingHistory(content: string): HistoryRecord[] {
    console.log('🔍 [解析调教记录] 开始解析');
    console.log('📄 内容长度:', content?.length || 0);

    const trainingHistory: HistoryRecord[] = [];

    // 移除所有 summary 标签及其内容（支持<summary>和<summary_N>格式）
    let parsedContent = content;
    if (content.includes('<summary>') || /<summary_\d+>/.test(content)) {
      parsedContent = content.replace(/<summary(?:_\d+)?>[\s\S]*?<\/summary(?:_\d+)?>\n*/g, '');
    }

    // 如果移除summary后内容为空，说明已经被总结压缩了
    if (!parsedContent.trim()) {
      console.log('⚠️ 条目已被总结压缩，返回空记录（后续追加会重建基础结构）');
      return trainingHistory;
    }

    const trainingMatch = parsedContent.match(/<training_history>([\s\S]*?)<\/training_history>/);

    if (!trainingMatch) {
      console.log('⚠️ 未找到 <training_history> 标签');
      console.log('📄 内容预览:', content?.substring(0, 300) || '(空内容)');
      return trainingHistory;
    }

    console.log('✅ 找到 <training_history> 标签');
    const trainingContent = trainingMatch[1];
    console.log('📊 标签内容长度:', trainingContent.length);
    console.log('📄 完整标签内容:');
    console.log('---开始---');
    console.log(trainingContent);
    console.log('---结束---');

    const lines = trainingContent.split('\n');
    console.log(`📋 分割成 ${lines.length} 行`);

    let currentRecord: Partial<HistoryRecord> | null = null;
    let recordCount = 0;

    lines.forEach((line, lineIndex) => {
      // 匹配格式：[任意时间格式] 发送者: 内容
      const recordMatch = line.match(/^\[(.+?)\] (.+?): (.*)$/);
      if (recordMatch) {
        // 如果有当前记录，先保存它
        if (currentRecord) {
          const record = currentRecord as HistoryRecord;
          // 对于AI回复，清理空行和格式
          if (record.sender && record.sender !== 'user' && record.content) {
            record.content = this.cleanAIContent(record.content);
            console.log(`  🧹 已清理AI回复的空行和格式`);
          }
          trainingHistory.push(record);
          console.log(`  ✅ 完成第 ${recordCount} 条记录`);
        }

        recordCount++;
        const [, timeStr, sender, content] = recordMatch;
        currentRecord = {
          gameTime: timeStr, // 直接使用存储的时间字符串（如：帝国历1074年1月8日）
          sender: sender === '{{user}}' ? 'user' : sender,
          content: content.trim(),
          timestamp: Date.now(),
        };

        console.log(`  📝 [行${lineIndex}] 开始新记录 #${recordCount}:`, {
          gameTime: timeStr,
          sender: currentRecord.sender,
          contentPreview: content.substring(0, 30) + (content.length > 30 ? '...' : ''),
          hasContent: content.trim().length > 0,
        });
      } else if (currentRecord && line.trim()) {
        // 追加内容到当前记录
        if (!currentRecord.content || currentRecord.content.trim() === '') {
          currentRecord.content = line.trim();
        } else {
          currentRecord.content += '\n' + line.trim();
        }
        console.log(
          `    ➕ [行${lineIndex}] 追加内容到记录 #${recordCount}: "${line.trim().substring(0, 30)}${line.trim().length > 30 ? '...' : ''}"`,
        );
      } else if (line.trim() === '') {
        console.log(`    ⚪ [行${lineIndex}] 空行`);
      } else {
        console.log(`    ⚠️ [行${lineIndex}] 未匹配的行: "${line.substring(0, 50)}${line.length > 50 ? '...' : ''}"`);
      }
    });

    if (currentRecord) {
      const record = currentRecord as HistoryRecord;
      // 对于AI回复，清理空行和格式
      if (record.sender && record.sender !== 'user' && record.content) {
        record.content = this.cleanAIContent(record.content);
        console.log(`  🧹 已清理AI回复的空行和格式`);
      }
      trainingHistory.push(record);
      console.log(`  ✅ 完成第 ${recordCount} 条记录（最后一条）`);
    }

    console.log(`✅ [解析完成] 共解析出 ${trainingHistory.length} 条记录`);
    return trainingHistory;
  }

  /**
   * 清理AI回复内容，删除多余空行并整理格式
   */
  private static cleanAIContent(content: string): string {
    return content
      .split('\n')
      .map(line => line.trim()) // 去除每行首尾空白
      .filter(line => line.length > 0) // 删除空行
      .join('\n\n'); // 用双换行连接，形成段落分隔
  }

  /**
   * 验证并转换历史记录格式（兼容旧格式）
   * @param records 可能是 HistoryRecord[] 或其他格式的数据
   * @returns 验证后的 HistoryRecord[]
   */
  private static validateAndConvertHistoryRecords(records: any[]): HistoryRecord[] {
    if (!Array.isArray(records)) {
      console.warn('⚠️ 调教记录数据格式错误：不是数组', records);
      return [];
    }

    const validatedRecords: HistoryRecord[] = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];

      // 验证必需字段
      if (!record || typeof record !== 'object') {
        console.warn(`⚠️ 跳过无效的记录 #${i}:`, record);
        continue;
      }

      // 构建标准格式的 HistoryRecord
      const validatedRecord: HistoryRecord = {
        gameTime: record.gameTime || '未知时间',
        sender: record.sender === '{{user}}' ? 'user' : record.sender || undefined,
        content: record.content || '',
        timestamp: typeof record.timestamp === 'number' ? record.timestamp : Date.now() + i,
      };

      // 确保 content 不为空
      if (!validatedRecord.content || validatedRecord.content.trim().length === 0) {
        console.warn(`⚠️ 跳过内容为空的记录 #${i}`);
        continue;
      }

      validatedRecords.push(validatedRecord);
    }

    // 按时间戳排序
    validatedRecords.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    return validatedRecords;
  }

  /**
   * 删除人物剧情记录条目（包含所有调教、对话等历史记录）
   */
  static async deleteTrainingHistory(characterId: string, worldbookName: string): Promise<void> {
    try {
      const worldbook = await WorldbookHelper.get(worldbookName);
      const historyEntryIndex = WorldbookHelper.findEntryIndex(
        worldbook,
        entry => entry.extra?.entry_type === 'character_story_history' && entry.extra?.character_id === characterId,
      );

      if (historyEntryIndex !== -1) {
        worldbook.splice(historyEntryIndex, 1);
        await WorldbookHelper.replace(worldbookName, worldbook);
        console.log(`✅ 已删除角色 ${characterId} 的剧情记录条目`);
      }
    } catch (error) {
      console.error('删除剧情记录条目失败:', error);
      throw error;
    }
  }
}
