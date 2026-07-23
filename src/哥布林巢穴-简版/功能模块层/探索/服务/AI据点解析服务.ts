import { GenerationErrorService } from '../../../核心层/服务/通用服务/生成错误服务';
import type { Location } from '../类型/探索类型';
import { pictureResourceMappingService } from './图片资源映射服务';

/**
 * 解析错误信息接口
 */
interface ParseError {
  field: string;
  message: string;
  category: string;
}

/**
 * 解析错误收集器
 */
class ParseErrorCollector {
  private errors: ParseError[] = [];
  private errorsByCategory: Map<string, ParseError[]> = new Map();

  addError(error: ParseError): void {
    this.errors.push(error);

    if (!this.errorsByCategory.has(error.category)) {
      this.errorsByCategory.set(error.category, []);
    }
    this.errorsByCategory.get(error.category)!.push(error);
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  getSummary(): string {
    if (this.errors.length === 0) return '';

    const categoryCount = new Map<string, number>();
    this.errors.forEach(error => {
      categoryCount.set(error.category, (categoryCount.get(error.category) || 0) + 1);
    });

    const parts: string[] = [];
    categoryCount.forEach((count, category) => {
      parts.push(`${category}: ${count}个错误`);
    });

    return `共发现 ${this.errors.length} 个错误（${parts.join('、')}）`;
  }

  formatDetails(): string {
    if (this.errors.length === 0) return '';

    const lines: string[] = [];
    this.errorsByCategory.forEach((errors, category) => {
      lines.push(`【${category}】`);
      errors.forEach(error => {
        lines.push(`  • ${error.field}: ${error.message}`);
      });
      lines.push('');
    });

    return lines.join('\n').trim();
  }

  clear(): void {
    this.errors = [];
    this.errorsByCategory.clear();
  }
}

/**
 * 据点信息解析器
 * 用于解析AI输出的据点信息文本，转换为Location对象
 */
export class LocationParser {
  private static errorCollector = new ParseErrorCollector();

  /**
   * 根据种族获取默认emoji头像
   * 当图片资源匹配失败时使用此默认头像
   */
  private static getDefaultAvatarByRace(race: string): string {
    const raceAvatars: Record<string, string> = {
      人类: '👤',
      狐族: '🦊',
      永恒精灵: '🧝‍♀️',
      黑暗精灵: '🧝‍♂️',
      哥布林: '👺',
      亡灵: '💀',
      天使: '👼',
      魔族: '😈',
    };
    return raceAvatars[race] || '👤';
  }

  /**
   * 创建默认的pictureResource（当匹配失败时使用）
   */
  private static createDefaultPictureResource(race: string): any {
    return {
      id: 'default',
      race: race,
      class: '默认',
      prompt: '',
      imageUrl: this.getDefaultAvatarByRace(race),
      generatedName: undefined,
    };
  }

  /**
   * 中文类型到英文类型的映射
   */
  private static readonly TYPE_MAPPING: Record<string, Location['type']> = {
    // 通用类型
    村庄: 'village',
    城镇: 'town',
    城市: 'city',
    遗迹: 'ruins',
    贸易商队: 'trade_caravan',
    冒险者小队: 'adventurer_party',
    // 古拉尔大陆
    流放者据点: 'exile_outpost',
    盗匪营地: 'bandit_camp',
    精灵森林: 'elven_forest',
    狐族殖民地: 'fox_colony',
    // 瓦尔基里大陆
    巢都尖塔: 'dark_spire',
    奴隶营地: 'slave_camp',
    黑暗要塞: 'dark_fortress',
    黑曜石矿场: 'obsidian_mine',
    劫掠舰码头: 'raid_dock',
    // 香草群岛
    狐族水乡: 'fox_water_town',
    神社: 'shrine',
    贸易港口: 'trading_port',
    军舰泊地: 'warship_dock',
    香料种植园: 'spice_plantation',
    // 赛菲亚大陆
    帝国城市: 'imperial_city',
    贵族庄园: 'noble_estate',
    矿业区域: 'mining_district',
    边境要塞: 'border_fortress',
    教堂: 'cathedral',
    学院: 'academy',
    // 世界树圣域
    树城: 'tree_city',
    精灵圣殿: 'elven_temple',
    守卫哨所: 'guardian_outpost',
    树冠宫殿: 'canopy_palace',
  };

  /**
   * 中文难度到星级难度的映射
   */
  private static readonly DIFFICULTY_MAPPING: Record<string, number> = {
    '1': 1,
    '2': 2,
    '3': 3,
    '4': 4,
    '5': 5,
    '6': 6,
    '7': 7,
    '8': 8,
    '9': 9,
    '10': 10,
  };

  /**
   * 统一据点解析方法（支持单个和多个据点）
   * @param text AI输出的据点信息文本
   * @param rawText 原始AI输出（用于错误提示）
   * @param onRetry 重新解析回调（用于错误提示）
   * @returns 解析后的Location对象或数组
   */
  static async parseLocations(
    text: string,
    rawText?: string,
    onRetry?: (editedText: string) => Promise<void>,
  ): Promise<Location | Location[] | null> {
    this.errorCollector.clear();
    console.log('🔍 [据点解析器] 开始解析据点信息');
    console.log('📝 [据点解析器] 原始文本长度:', text.length);
    console.log('📝 [据点解析器] 原始文本开头:', text.substring(0, 100) + '...');

    try {
      let cleanText = text.trim();
      console.log('🧹 [据点解析器] 清理后文本长度:', cleanText.length);

      // 应用酒馆正则，去除多余信息
      console.log('🔧 [据点解析器] 应用酒馆正则清理文本...');
      const regexedText = formatAsTavernRegexedString(cleanText, 'ai_output', 'display');
      console.log('🔧 [据点解析器] 酒馆正则处理前长度:', cleanText.length);
      console.log('🔧 [据点解析器] 酒馆正则处理前开头:', cleanText.substring(0, 100) + '...');
      console.log('🔧 [据点解析器] 酒馆正则处理后长度:', regexedText.length);
      console.log('🔧 [据点解析器] 酒馆正则处理后开头:', regexedText.substring(0, 100) + '...');
      console.log('🔧 [据点解析器] 酒馆正则处理是否有效:', cleanText !== regexedText);

      if (cleanText !== regexedText) {
        cleanText = regexedText;
        console.log('✅ [据点解析器] 酒馆正则处理完成，使用清理后的文本');
        console.log('✅ [据点解析器] 清理后文本长度:', cleanText.length);
        console.log('✅ [据点解析器] 清理后文本开头:', cleanText.substring(0, 100) + '...');
      } else {
        console.log('ℹ️ [据点解析器] 酒馆正则未改变文本，继续使用原始文本');
      }

      // 处理Markdown代码块格式
      console.log('🔧 [据点解析器] 开始提取JSON数据...');
      cleanText = this.extractJsonFromText(cleanText);
      console.log('🔧 [据点解析器] 提取JSON后长度:', cleanText.length);
      console.log('🔧 [据点解析器] 提取的JSON开头:', cleanText.substring(0, 100) + '...');

      // 检查是否为JSON格式
      console.log('✅ [据点解析器] 检查JSON格式...');
      console.log('✅ [据点解析器] 文本开头字符:', cleanText.charAt(0));
      console.log('✅ [据点解析器] 是否以{开头:', cleanText.startsWith('{'));
      console.log('✅ [据点解析器] 是否以[开头:', cleanText.startsWith('['));

      if (!cleanText.startsWith('{') && !cleanText.startsWith('[')) {
        console.error('❌ [据点解析器] 无法找到有效的JSON数据');
        console.error('❌ [据点解析器] 清理后的文本:', cleanText.substring(0, 200) + '...');
        this.errorCollector.addError({
          field: 'JSON格式',
          message: '未找到有效的JSON格式',
          category: '格式错误',
        });
        this.showParseErrorDialog(null, rawText || text, onRetry);
        return null;
      }

      console.log('✅ [据点解析器] JSON格式验证通过，开始解析JSON...');

      // 判断是单个对象还是数组
      if (cleanText.startsWith('[')) {
        // 数组格式，解析多个据点
        return await this.parseMultipleJsonLocations(cleanText, rawText || text, onRetry);
      } else {
        // 对象格式，解析单个据点
        return await this.parseJsonLocation(cleanText, rawText || text, onRetry);
      }
    } catch (error) {
      console.error('❌ [据点解析器] 解析据点信息失败:', error);
      console.error('❌ [据点解析器] 错误堆栈:', (error as Error).stack);
      this.showParseErrorDialog(error instanceof Error ? error : new Error(String(error)), rawText || text, onRetry);
      return null;
    }
  }

  /**
   * 解析JSON格式的据点信息
   * @param jsonText JSON格式的据点信息
   * @param rawText 原始AI输出
   * @param onRetry 重新解析回调
   * @returns 解析后的Location对象
   */
  private static async parseJsonLocation(
    jsonText: string,
    rawText: string,
    onRetry?: (editedText: string) => Promise<void>,
  ): Promise<Location | null> {
    console.log('🔍 [JSON解析器] 开始解析JSON数据');
    console.log('📝 [JSON解析器] JSON文本长度:', jsonText.length);
    console.log('📝 [JSON解析器] JSON文本开头:', jsonText.substring(0, 100) + '...');

    try {
      // 解析JSON
      console.log('🔧 [JSON解析器] 开始JSON.parse()...');
      const data = JSON.parse(jsonText);
      console.log('✅ [JSON解析器] JSON解析成功');
      console.log('📊 [JSON解析器] 数据类型:', typeof data, Array.isArray(data) ? '(数组)' : '(对象)');

      // 如果是数组，取第一个元素
      const locationData = Array.isArray(data) ? data[0] : data;
      console.log('📊 [JSON解析器] 据点数据:', locationData);

      if (!locationData) {
        console.error('❌ [JSON解析器] JSON数据为空');
        this.errorCollector.addError({
          field: 'JSON数据',
          message: 'JSON数据为空',
          category: '数据错误',
        });
        throw new Error('JSON数据为空');
      }

      // 转换中文类型为英文，难度为星级数字
      console.log('🔄 [JSON解析器] 开始类型转换...');
      console.log('🔄 [JSON解析器] 原始类型:', locationData.type);
      console.log('🔄 [JSON解析器] 原始难度:', locationData.difficulty);

      const englishType = this.TYPE_MAPPING[locationData.type] || locationData.type;
      const starDifficulty =
        this.DIFFICULTY_MAPPING[locationData.difficulty] ||
        (typeof locationData.difficulty === 'number' ? locationData.difficulty : 1);

      console.log('🔄 [JSON解析器] 转换后类型:', englishType);
      console.log('🔄 [JSON解析器] 转换后难度:', starDifficulty);

      // 验证必要字段
      console.log('✅ [JSON解析器] 验证必要字段...');
      console.log('✅ [JSON解析器] name:', locationData.name);
      console.log('✅ [JSON解析器] type:', locationData.type);
      console.log('✅ [JSON解析器] description:', locationData.description ? '存在' : '缺失');
      console.log('✅ [JSON解析器] difficulty:', locationData.difficulty);

      if (!locationData.name || !locationData.type || !locationData.description || !locationData.difficulty) {
        console.error('❌ [JSON解析器] 缺少必要字段');
        if (!locationData.name) {
          this.errorCollector.addError({
            field: 'name',
            message: '据点名称缺失，AI必须提供有效的据点名称',
            category: '必要字段',
          });
        }
        if (!locationData.type) {
          this.errorCollector.addError({
            field: 'type',
            message: '据点类型缺失，AI必须提供有效的据点类型',
            category: '必要字段',
          });
        }
        if (!locationData.description) {
          this.errorCollector.addError({
            field: 'description',
            message: '据点描述缺失，AI必须提供有效的据点描述',
            category: '必要字段',
          });
        }
        if (!locationData.difficulty) {
          this.errorCollector.addError({
            field: 'difficulty',
            message: '据点难度缺失，AI必须提供有效的据点难度',
            category: '必要字段',
          });
        }
        throw new Error('缺少必要字段');
      }

      console.log('✅ [JSON解析器] 所有必要字段验证通过');

      // 生成唯一ID
      console.log('🆔 [JSON解析器] 生成唯一ID...');
      const id = this.generateLocationId(locationData.name);
      console.log('🆔 [JSON解析器] 生成的ID:', id);

      // 构建Location对象
      console.log('🏗️ [JSON解析器] 构建Location对象...');
      const location: Location = {
        id,
        name: locationData.name,
        type: englishType as Location['type'],
        icon: locationData.icon || this.getDefaultIcon(englishType as Location['type']),
        description: locationData.description,
        difficulty: starDifficulty,
        distance: locationData.distance || 0,
        rewards: (() => {
          const globalVars = getVariables({ type: 'global' });
          const mult = (typeof globalVars['scout_reward_multiplier'] === 'number' && globalVars['scout_reward_multiplier'] >= 1)
            ? globalVars['scout_reward_multiplier'] : 1.0;
          // 最低奖励保底（基于难度星级）
          const starDiff = locationData.difficulty || 1;
          const minGold = Math.round(50 * starDiff * mult);
          const minFood = Math.round(30 * starDiff * mult);
          const gold = locationData.rewards?.gold > 0 ? Math.max(minGold, Math.round(locationData.rewards.gold * mult)) : minGold;
          const food = locationData.rewards?.food > 0 ? Math.max(minFood, Math.round(locationData.rewards.food * mult)) : minFood;
          const slaves = locationData.rewards?.slaves > 0 ? Math.round(locationData.rewards.slaves * mult) : undefined;
          return {
            gold,
            food,
            ...(slaves && { slaves }),
          };
        })(),
        status: 'unknown',
      };

      console.log('🏗️ [JSON解析器] 基础Location对象构建完成:', location);

      // 如果有基础守军数据，添加到据点中
      if (locationData.baseGuards) {
        console.log('⚔️ [JSON解析器] 添加基础守军:', locationData.baseGuards);
        (location as any).baseGuards = locationData.baseGuards;
      }

      // 如果有特殊单位数据，添加到据点中
      if (locationData.specialUnit) {
        console.log('👤 [JSON解析器] 添加特殊单位:', locationData.specialUnit);
        (location as any).specialUnit = locationData.specialUnit;
      }

      // 如果有大陆和区域信息，添加到据点中
      if (locationData.continent) {
        console.log('🌍 [JSON解析器] 添加大陆信息:', locationData.continent);
        (location as any).continent = locationData.continent;
      }
      if (locationData.region) {
        console.log('🗺️ [JSON解析器] 添加区域信息:', locationData.region);
        (location as any).region = locationData.region;
      }
      if (locationData.race) {
        console.log('🧬 [JSON解析器] 添加种族信息:', locationData.race);
        (location as any).race = locationData.race;
      }

      // 如果有图片资源信息，添加到据点中
      if (locationData.pictureResource) {
        console.log('🖼️ [JSON解析器] 添加图片资源信息:', locationData.pictureResource);
        (location as any).pictureResource = locationData.pictureResource;
      }

      // 根据据点的种族和类型匹配图片资源
      if (locationData.race && locationData.type) {
        const englishType = this.TYPE_MAPPING[locationData.type] || locationData.type;
        const pictureResource = pictureResourceMappingService.getRandomMatchingPictureResource(
          englishType,
          locationData.race,
        );

        if (pictureResource) {
          console.log(
            `🖼️ [JSON解析器] 据点 ${locationData.name} 匹配到图片资源: ID=${pictureResource.id}, 职业=${pictureResource.class}`,
          );
          (location as any).pictureResource = {
            id: pictureResource.id,
            race: pictureResource.race,
            class: pictureResource.class,
            prompt: pictureResource.prompt,
            imageUrl: pictureResource.imageUrl,
            generatedName: pictureResource.generatedName,
          };
        } else {
          console.warn(
            `🖼️ [JSON解析器] 据点 ${locationData.name} 未能匹配到合适的图片资源 (类型: ${englishType}, 种族: ${locationData.race})，使用默认头像`,
          );
          // 即使匹配失败，也要设置默认头像，确保人物至少有一个基于种族的头像
          const defaultPictureResource = this.createDefaultPictureResource(locationData.race);
          (location as any).pictureResource = defaultPictureResource;
          console.log(`✅ [JSON解析器] 已为据点 ${locationData.name} 设置默认头像: ${defaultPictureResource.imageUrl}`);
        }
      }

      console.log('🎉 [JSON解析器] 解析完成，最终Location对象:', location);
      console.log('🔍 [JSON解析器] 最终Location的baseGuards:', location.baseGuards);
      console.log('🔍 [JSON解析器] 最终Location的specialUnit:', location.specialUnit);
      return location;
    } catch (error) {
      console.error('❌ [JSON解析器] 解析JSON据点信息失败:', error);
      console.error('❌ [JSON解析器] 错误类型:', (error as Error).constructor.name);
      console.error('❌ [JSON解析器] 错误消息:', (error as Error).message);
      console.error('❌ [JSON解析器] 错误堆栈:', (error as Error).stack);
      this.showParseErrorDialog(error instanceof Error ? error : new Error(String(error)), rawText, onRetry);
      return null;
    }
  }

  /**
   * 生成据点唯一ID
   * @param name 据点名称
   * @returns 唯一ID
   */
  private static generateLocationId(name: string): string {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substr(2, 5);
    return `${name.replace(/\s+/g, '_').toLowerCase()}_${timestamp}_${randomSuffix}`;
  }

  /**
   * 根据据点类型获取默认图标
   * @param type 据点类型
   * @returns 默认图标
   */
  private static getDefaultIcon(type: Location['type']): string {
    const iconMap: Record<Location['type'], string> = {
      // 通用类型
      village: '🏘️',
      town: '🏙️',
      city: '🏛️',
      ruins: '🏚️',
      trade_caravan: '🚛',
      adventurer_party: '⚔️',
      // 古拉尔大陆
      exile_outpost: '🏚️',
      bandit_camp: '⛺',
      elven_forest: '🌲',
      fox_colony: '🦊',
      // 瓦尔基里大陆
      dark_spire: '🗼',
      slave_camp: '⛓️',
      dark_fortress: '🏰',
      obsidian_mine: '⚒️',
      raid_dock: '⚓',
      // 香草群岛
      fox_water_town: '🏘️',
      shrine: '⛩️',
      trading_port: '🚢',
      warship_dock: '⚓',
      spice_plantation: '🌿',
      // 赛菲亚大陆
      imperial_city: '👑',
      noble_estate: '🏰',
      mining_district: '⛏️',
      border_fortress: '🛡️',
      cathedral: '⛪',
      academy: '📚',
      // 世界树圣域
      tree_city: '🌳',
      elven_temple: '🏛️',
      guardian_outpost: '🗡️',
      canopy_palace: '🏰',
    };
    return iconMap[type] || '📍';
  }

  /**
   * 验证据点数据完整性
   * @param location 据点对象
   * @returns 验证结果
   */
  static validateLocation(location: Location): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!location.id) errors.push('缺少ID');
    if (!location.name) errors.push('缺少名称');
    if (!location.type) errors.push('缺少类型');
    if (!location.description) errors.push('缺少描述');
    if (!location.difficulty) errors.push('缺少难度');
    if (isNaN(location.distance)) errors.push('距离必须是数字');
    if (location.distance < 0) errors.push('距离不能为负数');

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 解析JSON格式的多个据点（内部方法）
   * @param jsonText JSON格式的据点数组
   * @param rawText 原始AI输出
   * @param onRetry 重新解析回调
   * @returns 解析后的Location对象数组
   */
  private static async parseMultipleJsonLocations(
    jsonText: string,
    rawText: string,
    onRetry?: (editedText: string) => Promise<void>,
  ): Promise<Location[]> {
    try {
      const cleanText = jsonText.trim();
      console.log('🔍 [批量解析器] 开始解析多个据点');
      console.log('📝 [批量解析器] 输入文本长度:', cleanText.length);
      console.log('📝 [批量解析器] 输入文本开头:', cleanText.substring(0, 50) + '...');

      // 检查是否为JSON数组格式
      console.log('🔍 [批量解析器] 检查JSON数组格式...');
      console.log('🔍 [批量解析器] 清理后文本长度:', cleanText.length);
      console.log('🔍 [批量解析器] 清理后文本开头:', cleanText.substring(0, 50) + '...');
      console.log('🔍 [批量解析器] 是否以[开头:', cleanText.startsWith('['));

      if (!cleanText.startsWith('[')) {
        console.error('❌ [批量解析器] 无法找到有效的JSON数组数据');
        console.error('❌ [批量解析器] 原始文本:', jsonText.substring(0, 200) + '...');
        console.error('❌ [批量解析器] 清理后文本:', cleanText.substring(0, 200) + '...');
        this.errorCollector.addError({
          field: 'JSON数组格式',
          message: '未找到有效的JSON数组格式（应以"["开头）',
          category: '格式错误',
        });
        this.showParseErrorDialog(null, rawText, onRetry);
        return [];
      }

      const locationsData = JSON.parse(cleanText);
      console.log('🔍 [批量解析器] JSON解析成功，数据类型:', Array.isArray(locationsData) ? '数组' : '对象');
      console.log('🔍 [批量解析器] 据点数量:', locationsData.length);

      if (!Array.isArray(locationsData)) {
        console.error('❌ [批量解析器] JSON数据不是数组格式');
        this.errorCollector.addError({
          field: 'JSON数据类型',
          message: 'JSON数据不是数组格式',
          category: '格式错误',
        });
        this.showParseErrorDialog(null, rawText, onRetry);
        return [];
      }

      const locations: Location[] = [];
      console.log('🔍 [批量解析器] 开始解析', locationsData.length, '个据点...');

      for (let i = 0; i < locationsData.length; i++) {
        const locationData = locationsData[i];
        console.log(`🔍 [批量解析器] 解析第${i + 1}个据点:`, locationData?.name || '未知');
        try {
          // 转换中文类型为英文，难度为星级数字
          const englishType = this.TYPE_MAPPING[locationData?.type] || locationData?.type;
          const starDifficulty =
            this.DIFFICULTY_MAPPING[locationData?.difficulty] ||
            (typeof locationData?.difficulty === 'number' ? locationData.difficulty : 1);

          // 验证必要字段，收集所有缺失的字段错误
          const missingFields: string[] = [];
          if (!locationData?.name) missingFields.push('name（据点名称）');
          if (!locationData?.type) missingFields.push('type（据点类型）');
          if (!locationData?.description) missingFields.push('description（据点描述）');
          if (!locationData?.difficulty) missingFields.push('difficulty（据点难度）');

          if (missingFields.length > 0) {
            const locationName = locationData?.name || `第${i + 1}个据点`;
            this.errorCollector.addError({
              field: locationName,
              message: `缺少必要字段: ${missingFields.join('、')}`,
              category: '必要字段',
            });
            console.warn(`据点 ${locationName} 缺少必要字段:`, missingFields);
            continue;
          }

          // 生成唯一ID
          const id = this.generateLocationId(locationData.name);

          // 构建Location对象
          const location: Location = {
            id,
            name: locationData.name,
            type: englishType as Location['type'],
            icon: locationData.icon || this.getDefaultIcon(englishType as Location['type']),
            description: locationData.description,
            difficulty: starDifficulty,
            distance: locationData.distance || 0,
            rewards: (() => {
              const globalVars = getVariables({ type: 'global' });
              const mult = (typeof globalVars['scout_reward_multiplier'] === 'number' && globalVars['scout_reward_multiplier'] >= 1)
                ? globalVars['scout_reward_multiplier'] : 1.0;
              const starDiff = locationData.difficulty || 1;
              const minGold = Math.round(50 * starDiff * mult);
              const minFood = Math.round(30 * starDiff * mult);
              const gold = locationData.rewards?.gold > 0 ? Math.max(minGold, Math.round(locationData.rewards.gold * mult)) : minGold;
              const food = locationData.rewards?.food > 0 ? Math.max(minFood, Math.round(locationData.rewards.food * mult)) : minFood;
              const slaves = locationData.rewards?.slaves > 0 ? Math.round(locationData.rewards.slaves * mult) : undefined;
              return { gold, food, ...(slaves && { slaves }) };
            })(),
            status: 'unknown',
          };

          // 如果有敌方单位数据，添加到据点中
          if (locationData.enemyUnits && Array.isArray(locationData.enemyUnits)) {
            (location as any).enemyUnits = locationData.enemyUnits;
          }

          // 如果有基础守军数据，添加到据点中
          if (locationData.baseGuards) {
            console.log('⚔️ [批量解析器] 添加基础守军:', locationData.baseGuards);
            (location as any).baseGuards = locationData.baseGuards;
          }

          // 如果有特殊单位数据，添加到据点中
          if (locationData.specialUnit) {
            console.log('👤 [批量解析器] 添加特殊单位:', locationData.specialUnit);
            (location as any).specialUnit = locationData.specialUnit;
          }

          // 如果有大陆和区域信息，添加到据点中
          if (locationData.continent) {
            console.log('🌍 [批量解析器] 添加大陆信息:', locationData.continent);
            (location as any).continent = locationData.continent;
          }
          if (locationData.region) {
            console.log('🗺️ [批量解析器] 添加区域信息:', locationData.region);
            (location as any).region = locationData.region;
          }
          if (locationData.race) {
            console.log('🧬 [批量解析器] 添加种族信息:', locationData.race);
            (location as any).race = locationData.race;
          }

          // 如果有图片资源信息，添加到据点中
          if (locationData.pictureResource) {
            console.log('🖼️ [批量解析器] 添加图片资源信息:', locationData.pictureResource);
            (location as any).pictureResource = locationData.pictureResource;
          }

          // 根据据点的种族和类型匹配图片资源
          if (locationData.race && locationData.type) {
            const pictureResource = pictureResourceMappingService.getRandomMatchingPictureResource(
              englishType,
              locationData.race,
            );

            if (pictureResource) {
              console.log(
                `🖼️ [批量解析器] 据点 ${locationData.name} 匹配到图片资源: ID=${pictureResource.id}, 职业=${pictureResource.class}`,
              );
              (location as any).pictureResource = {
                id: pictureResource.id,
                race: pictureResource.race,
                class: pictureResource.class,
                prompt: pictureResource.prompt,
                imageUrl: pictureResource.imageUrl,
                generatedName: pictureResource.generatedName,
              };
            } else {
              console.warn(
                `🖼️ [批量解析器] 据点 ${locationData.name} 未能匹配到合适的图片资源 (类型: ${englishType}, 种族: ${locationData.race})，使用默认头像`,
              );
              // 即使匹配失败，也要设置默认头像，确保人物至少有一个基于种族的头像
              const defaultPictureResource = this.createDefaultPictureResource(locationData.race);
              (location as any).pictureResource = defaultPictureResource;
              console.log(
                `✅ [批量解析器] 已为据点 ${locationData.name} 设置默认头像: ${defaultPictureResource.imageUrl}`,
              );
            }
          }

          locations.push(location);
          console.log(`✅ [批量解析器] 第${i + 1}个据点解析成功:`, location.name);
        } catch (error) {
          const locationName = locationData?.name || `第${i + 1}个据点`;
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`❌ [批量解析器] 据点 ${locationName} 解析失败:`, error, locationData);
          this.errorCollector.addError({
            field: locationName,
            message: errorMessage || '解析过程中发生未知错误',
            category: '解析错误',
          });
        }
      }

      console.log('🎉 [批量解析器] 批量解析完成，成功解析', locations.length, '/', locationsData.length, '个据点');

      // 如果有错误，统一显示错误弹窗（包含所有据点的所有错误）
      if (this.errorCollector.hasErrors()) {
        this.showParseErrorDialog(null, rawText, onRetry);
        // 如果有错误，返回空数组，等待用户重新解析
        return [];
      }

      return locations;
    } catch (error) {
      console.error('解析JSON多个据点失败:', error);
      this.showParseErrorDialog(error instanceof Error ? error : new Error(String(error)), rawText, onRetry);
      return [];
    }
  }

  /**
   * 显示解析错误弹窗
   * @param error 错误对象
   * @param rawText 原始AI输出
   * @param onRetry 重新解析回调
   */
  private static async showParseErrorDialog(
    error: Error | null,
    rawText?: string,
    onRetry?: (editedText: string) => Promise<void>,
  ): Promise<void> {
    const hasErrors = this.errorCollector.hasErrors();

    let title = '据点信息解析失败';
    let message = '';
    let details = '';

    if (hasErrors) {
      title = `据点信息解析失败 - ${this.errorCollector.getSummary()}`;
      message = 'AI生成的据点信息存在以下错误，请检查并重新生成：';
      details = this.errorCollector.formatDetails();
    } else if (error) {
      title = '据点信息解析失败';
      message = error.message || '解析过程中发生未知错误';
      details = error.stack || '';
    } else {
      title = '据点信息解析失败';
      message = '解析过程中发生未知错误';
      details = '请检查AI输出格式是否正确';
    }

    // 显示错误弹窗（不等待用户关闭，立即返回，避免阻塞解析流程）
    // 错误弹窗会立即显示，但不会阻塞当前函数返回
    GenerationErrorService.showError({
      title,
      message,
      summary: hasErrors ? this.errorCollector.getSummary() : undefined,
      details,
      rawText,
      onRetry,
    }).catch(err => {
      // 静默处理错误，避免影响解析流程
      console.error('显示错误弹窗失败:', err);
    });
    // 不 await，立即返回，让解析函数能够继续执行
  }

  /**
   * 从文本中提取JSON数据
   * @param text 原始文本
   * @returns 提取的JSON文本
   */
  private static extractJsonFromText(text: string): string {
    console.log('🔍 [JSON提取器] 开始提取JSON数据');
    console.log('📝 [JSON提取器] 输入文本长度:', text.length);
    console.log('📝 [JSON提取器] 输入文本开头:', text.substring(0, 100) + '...');
    console.log('📝 [JSON提取器] 输入文本结尾:', '...' + text.substring(Math.max(0, text.length - 100)));

    // 1. 处理Markdown代码块格式 (```json)
    console.log('🔧 [JSON提取器] 检查是否包含```json标记...');
    if (text.includes('```json')) {
      console.log('✅ [JSON提取器] 找到```json标记');
      const jsonStart = text.indexOf('```json') + 7; // '```json'.length = 7
      const jsonEnd = text.indexOf('```', jsonStart);
      console.log('🔧 [JSON提取器] JSON开始位置:', jsonStart);
      console.log('🔧 [JSON提取器] JSON结束位置:', jsonEnd);

      if (jsonEnd !== -1) {
        const extracted = text.substring(jsonStart, jsonEnd).trim();
        console.log('✅ [JSON提取器] 成功提取JSON，长度:', extracted.length);
        console.log('✅ [JSON提取器] 提取的JSON开头:', extracted.substring(0, 100) + '...');
        return extracted;
      } else {
        console.log('❌ [JSON提取器] 未找到结束的```标记');
      }
    } else {
      console.log('❌ [JSON提取器] 未找到```json标记');
    }

    // 2. 处理普通代码块格式 (```)
    console.log('🔧 [JSON提取器] 检查是否包含普通```标记...');
    if (text.includes('```')) {
      console.log('✅ [JSON提取器] 找到普通```标记');
      const codeBlockStart = text.indexOf('```');
      const jsonStart = text.indexOf('{', codeBlockStart);
      const jsonEnd = text.indexOf('```', jsonStart);
      console.log('🔧 [JSON提取器] 代码块开始位置:', codeBlockStart);
      console.log('🔧 [JSON提取器] JSON开始位置:', jsonStart);
      console.log('🔧 [JSON提取器] JSON结束位置:', jsonEnd);

      if (jsonStart !== -1 && jsonEnd !== -1) {
        const extracted = text.substring(jsonStart, jsonEnd).trim();
        console.log('✅ [JSON提取器] 从普通代码块提取JSON，长度:', extracted.length);
        console.log('✅ [JSON提取器] 提取的JSON开头:', extracted.substring(0, 100) + '...');
        return extracted;
      } else {
        console.log('❌ [JSON提取器] 普通代码块中未找到有效的JSON');
      }
    } else {
      console.log('❌ [JSON提取器] 未找到普通```标记');
    }

    // 3. 查找JSON对象或数组 (无包裹格式) - 改进的大括号计数方法（考虑字符串中的大括号）
    {
      console.log('🔧 [JSON提取器] 使用改进的大括号计数方法查找JSON对象...');

      // 尝试匹配完整的JSON对象，考虑嵌套的大括号和字符串中的大括号
      let braceCount = 0;
      let jsonStart = -1;
      let jsonEnd = -1;
      let inString = false;
      let escapeNext = false;

      for (let i = 0; i < text.length; i++) {
        const char = text[i];

        // 处理转义字符
        if (escapeNext) {
          escapeNext = false;
          continue;
        }

        if (char === '\\') {
          escapeNext = true;
          continue;
        }

        // 处理字符串边界
        if (char === '"') {
          inString = !inString;
          continue;
        }

        // 只在非字符串状态下计数大括号
        if (!inString) {
          if (char === '{') {
            if (braceCount === 0) {
              jsonStart = i;
            }
            braceCount++;
          } else if (char === '}') {
            braceCount--;
            if (braceCount === 0 && jsonStart !== -1) {
              jsonEnd = i;
              break;
            }
          }
        }
      }

      if (jsonStart !== -1 && jsonEnd !== -1) {
        const extracted = text.substring(jsonStart, jsonEnd + 1).trim();
        console.log('✅ [JSON提取器] 通过大括号计数匹配到JSON对象，长度:', extracted.length);
        console.log('✅ [JSON提取器] 匹配的JSON开头:', extracted.substring(0, 100) + '...');

        // 验证提取的文本是否为有效JSON
        try {
          JSON.parse(extracted);
          return extracted;
        } catch (e) {
          console.warn('⚠️ [JSON提取器] 大括号计数提取的文本不是有效JSON，继续尝试其他方法');
        }
      } else {
        console.log('❌ [JSON提取器] 大括号计数未匹配到JSON对象');
      }
    }

    // 4. 尝试匹配JSON数组（考虑字符串中的方括号）
    {
      console.log('🔧 [JSON提取器] 使用改进的方括号计数方法查找JSON数组...');
      let bracketCount = 0;
      let arrayStart = -1;
      let arrayEnd = -1;
      let inString = false;
      let escapeNext = false;

      for (let i = 0; i < text.length; i++) {
        const char = text[i];

        // 处理转义字符
        if (escapeNext) {
          escapeNext = false;
          continue;
        }

        if (char === '\\') {
          escapeNext = true;
          continue;
        }

        // 处理字符串边界
        if (char === '"') {
          inString = !inString;
          continue;
        }

        // 只在非字符串状态下计数方括号
        if (!inString) {
          if (char === '[') {
            if (bracketCount === 0) {
              arrayStart = i;
            }
            bracketCount++;
          } else if (char === ']') {
            bracketCount--;
            if (bracketCount === 0 && arrayStart !== -1) {
              arrayEnd = i;
              break;
            }
          }
        }
      }

      if (arrayStart !== -1 && arrayEnd !== -1) {
        const extracted = text.substring(arrayStart, arrayEnd + 1).trim();
        console.log('✅ [JSON提取器] 通过方括号计数匹配到JSON数组，长度:', extracted.length);
        console.log('✅ [JSON提取器] 匹配的JSON开头:', extracted.substring(0, 100) + '...');

        // 验证提取的文本是否为有效JSON
        try {
          JSON.parse(extracted);
          return extracted;
        } catch (e) {
          console.warn('⚠️ [JSON提取器] 方括号计数提取的文本不是有效JSON，继续尝试其他方法');
        }
      } else {
        console.log('❌ [JSON提取器] 方括号计数未匹配到JSON数组');
      }
    }

    // 5. 最后的正则表达式尝试（作为后备方案）
    console.log('🔧 [JSON提取器] 使用正则表达式查找JSON对象...');
    const jsonObjectMatch = text.match(/\{[\s\S]*\}/);
    if (jsonObjectMatch) {
      const extracted = jsonObjectMatch[0].trim();
      console.log('✅ [JSON提取器] 通过正则匹配到JSON对象，长度:', extracted.length);
      console.log('✅ [JSON提取器] 匹配的JSON开头:', extracted.substring(0, 100) + '...');

      // 验证提取的文本是否为有效JSON
      try {
        JSON.parse(extracted);
        return extracted;
      } catch (e) {
        console.warn('⚠️ [JSON提取器] 正则匹配的文本不是有效JSON，继续尝试数组匹配');
      }
    } else {
      console.log('❌ [JSON提取器] 正则未匹配到JSON对象');
    }

    console.log('🔧 [JSON提取器] 使用正则表达式查找JSON数组...');
    const jsonArrayMatch = text.match(/\[[\s\S]*\]/);
    if (jsonArrayMatch) {
      const extracted = jsonArrayMatch[0].trim();
      console.log('✅ [JSON提取器] 通过正则匹配到JSON数组，长度:', extracted.length);
      console.log('✅ [JSON提取器] 匹配的JSON开头:', extracted.substring(0, 100) + '...');

      // 验证提取的文本是否为有效JSON
      try {
        JSON.parse(extracted);
        return extracted;
      } catch (e) {
        console.warn('⚠️ [JSON提取器] 正则匹配的数组文本不是有效JSON');
      }
    } else {
      console.log('❌ [JSON提取器] 正则未匹配到JSON数组');
    }

    console.log('⚠️ [JSON提取器] 所有方法都失败，返回原始文本');
    const fallback = text.trim();
    console.log('⚠️ [JSON提取器] 返回文本长度:', fallback.length);
    console.log('⚠️ [JSON提取器] 返回文本开头:', fallback.substring(0, 100) + '...');
    console.log('⚠️ [JSON提取器] 返回文本结尾:', '...' + fallback.substring(Math.max(0, fallback.length - 100)));
    return fallback;
  }

  /**
   * 获取星级难度的显示文本
   * @param difficulty 星级难度
   * @returns 显示文本
   */
  static getStarDifficultyText(difficulty: number): string {
    // 只显示实心星星表示难度
    return '★'.repeat(difficulty);
  }

  /**
   * 格式化据点信息为显示文本
   * @param location 据点对象
   * @returns 格式化的显示文本
   */
  static formatLocationForDisplay(location: Location): string {
    const rewards = Object.entries(location.rewards)
      .filter(([_, value]) => {
        if (Array.isArray(value)) {
          return value.length > 0;
        }
        return value && value > 0;
      })
      .map(([key, value]) => {
        const icons = { gold: '💰', food: '🍖', slaves: '🔒' };
        if (Array.isArray(value)) {
          return `${icons[key as keyof typeof icons] || '📦'}${value.join(', ')}`;
        }
        return `${icons[key as keyof typeof icons] || '📦'}${value}`;
      })
      .join(' ');

    return `${location.icon} ${location.name} (${this.getStarDifficultyText(location.difficulty)}, ${location.distance}km) - ${rewards}`;
  }
}
