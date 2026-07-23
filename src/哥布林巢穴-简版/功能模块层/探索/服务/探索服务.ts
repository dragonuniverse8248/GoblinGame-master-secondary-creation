import { ref, watch } from 'vue';
import { generateWithChainOfThought } from '../../../核心层/服务/世界书管理/工具/AI生成助手';
import { ChainOfThoughtMode } from '../../../核心层/服务/世界书管理/工具/思维链管理器';
import { modularSaveManager } from '../../../核心层/服务/存档系统/模块化存档服务';
import { INITIAL_LOCATIONS } from '../../../核心层/服务/存档系统/模块化存档类型';
import type { EnemyUnit, ExploreState, Location, ScoutResult } from '../类型/探索类型';
import { continentExploreService } from './大陆探索服务';
import { MixedTroopGenerationService } from './混合部队生成服务';
import { HeroDeterminationService } from '../../人物管理/服务/人物生成服务';

/**
 * 探索服务类
 * 管理探索相关的所有数据和功能
 */
export class ExploreService {
  // ==================== 响应式数据 ====================

  // 探索状态
  public state = ref<ExploreState>({
    scoutedLocations: [],
    conqueredLocations: [],
  });

  // 据点数据
  public locations = ref<Location[]>([...INITIAL_LOCATIONS]);

  // 侦察状态
  private scoutingLocations = new Set<string>();
  private scoutingAnimation = new Set<string>();

  // ==================== 构造函数和初始化 ====================

  constructor() {
    this.setupDataWatchers();
    // 延迟初始化，等待存档系统加载完成
    setTimeout(() => {
      this.initializeExploreData();
    }, 100);
  }

  // 初始化探索数据
  private async initializeExploreData(): Promise<void> {
    await this.loadExploreData();
  }

  // 手动初始化探索数据（供存档系统调用）
  public async initializeFromSave(): Promise<void> {
    await this.loadExploreData();
  }

  // ==================== 据点管理功能 ====================

  // 获取所有据点
  public getAllLocations(): Location[] {
    return this.locations.value;
  }

  // 添加新发现的据点
  public addLocation(location: Location): boolean {
    try {
      // 检查是否已存在同名据点
      const existingLocation = this.locations.value.find(loc => loc.name === location.name);
      if (existingLocation) {
        console.warn(`据点 ${location.name} 已存在，跳过添加`);
        return false;
      }

      // 如果据点已经是"已侦察"状态但没有敌方单位数据，立即生成
      if (location.status === 'scouted' && (!location.enemyUnits || location.enemyUnits.length === 0)) {
        console.log(`据点 ${location.name} 已侦察但无敌方单位数据，立即生成...`);
        try {
          const enemyUnits = this.getLocationEnemyUnits(location.id, 1);
          console.log(`据点 ${location.name} 敌方单位生成完成:`, enemyUnits.length, '个单位');
        } catch (error) {
          console.warn(`据点 ${location.name} 敌方单位生成失败:`, error);
        }
      }

      // 添加到据点列表
      console.log(`🔍 [探索服务] 添加据点前的完整数据:`, location);
      console.log(`🔍 [探索服务] 据点baseGuards字段:`, location.baseGuards);
      console.log(`🔍 [探索服务] 据点specialUnit字段:`, location.specialUnit);
      this.locations.value.push(location);
      console.log(`已添加新据点: ${location.name}`);

      // 据点解析后进行英雄概率判定
      this.checkAndMarkHeroGeneration(location);

      // 保存到数据库
      this.saveExploreData();

      return true;
    } catch (error) {
      console.error('添加据点失败:', error);
      return false;
    }
  }

  // 批量添加新发现的据点
  public addMultipleLocations(locations: Location[]): number {
    let addedCount = 0;
    for (const location of locations) {
      if (this.addLocation(location)) {
        addedCount++;
      }
    }
    return addedCount;
  }

  // 获取据点的敌方单位
  public getLocationEnemyUnits(locationId: string, currentTurn: number = 1): EnemyUnit[] {
    const location = this.locations.value.find(loc => loc.id === locationId);
    if (!location) {
      console.warn(`据点 ${locationId} 不存在`);
      return [];
    }

    // 如果据点已有敌方单位，直接返回（确保单位固定）
    if (location.enemyUnits && location.enemyUnits.length > 0) {
      console.log(`据点 ${locationId} 已有敌方单位，直接返回:`, location.enemyUnits.length, '个单位');
      return location.enemyUnits;
    }

    console.log(`为据点 ${locationId} 生成敌方单位...`);

    // 获取基础守军和特殊单位信息
    console.log(`🔍 [探索服务] 据点 ${locationId} 的baseGuards字段:`, location.baseGuards);
    console.log(`🔍 [探索服务] 据点 ${locationId} 的specialUnit字段:`, location.specialUnit);
    const baseGuards = location.baseGuards || 1000;
    const specialUnit = location.specialUnit;
    console.log(`🔍 [探索服务] 最终使用的baseGuards:`, baseGuards);
    console.log(`🔍 [探索服务] 最终使用的specialUnit:`, specialUnit);

    // 使用混合部队生成服务生成敌方单位
    console.log(`🔍 [探索服务] 调用混合部队生成服务，参数:`, {
      据点: location.name,
      基础守军: baseGuards,
      特殊单位: specialUnit,
      当前回合: currentTurn,
      英雄数量: location.rewards?.heroes?.length || 0,
    });

    const enemyUnits = MixedTroopGenerationService.generateMixedTroops(
      location,
      baseGuards,
      specialUnit
        ? {
            name: specialUnit.name,
            race: specialUnit.race,
            unitType: specialUnit.unitType, // 使用 unitType 而不是 class
            troopCount: 0, // 特殊单位的部队数量将由生成服务自动计算
            attributes: specialUnit.attributes,
          }
        : undefined,
      currentTurn,
    );

    console.log(`🔍 [探索服务] 混合部队生成服务返回:`, enemyUnits.length, '个单位');

    // 固定保存敌方单位，避免重复生成时单位变化
    location.enemyUnits = enemyUnits;
    location.enemyUnitsGeneratedAt = Date.now();

    console.log(`据点 ${locationId} 敌方单位生成完成:`, enemyUnits.length, '个单位');

    // 保存到数据库，确保持久化
    this.saveLocationsToDatabase();

    return enemyUnits;
  }

  // ==================== 英雄生成功能 ====================

  // 检查并标记据点是否需要生成英雄
  private checkAndMarkHeroGeneration(location: Location): void {
    try {
      const hasExistingHeroes = location.rewards?.heroes && location.rewards.heroes.length > 0;
      if (hasExistingHeroes) {
        console.log(`据点 ${location.name} 已有英雄数据，跳过AI生成标记`);
        return;
      }
      const shouldHaveHero = HeroDeterminationService.shouldHaveHero(location.type, location.difficulty);
      console.log(`🎲 [英雄判定] 据点=${location.name}, 类型=${location.type}, 难度=${location.difficulty}星, 判定结果=${shouldHaveHero}`);

      if (shouldHaveHero) {
        console.log(`据点 ${location.name} 判定需要生成英雄，添加生成标记...`);

        // 添加AI生成标记（使用布尔属性）
        (location as any).needsAIHero = true;

        console.log(`据点 ${location.name} 已添加英雄生成标记`);
      } else {
        console.log(`据点 ${location.name} 判定不需要生成英雄`);
      }
    } catch (error) {
      console.error('英雄概率判定失败:', error);
    }
  }

  // ==================== 侦察功能 ====================

  // 侦察据点
  public async scoutLocation(
    locationId: string,
    extraPrompt: string = '',
    isFullCustom: boolean = false,
  ): Promise<ScoutResult> {
    const location = this.getAllLocations().find(loc => loc.id === locationId);
    if (!location) {
      throw new Error('据点不存在');
    }

    // 根据难度和距离计算侦察成本
    const cost = this.calculateScoutCost(location.difficulty, location.distance);

    // 检查资源是否足够
    if (modularSaveManager.resources.value.gold < cost.gold || modularSaveManager.resources.value.food < cost.food) {
      throw new Error(`资源不足，侦察需要 ${cost.gold} 金币和 ${cost.food} 食物`);
    }

    // 消耗资源
    modularSaveManager.consumeResource('gold', cost.gold);
    modularSaveManager.consumeResource('food', cost.food);

    // 模拟侦察过程
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 更新侦察状态
    if (!this.state.value.scoutedLocations.includes(locationId)) {
      this.state.value.scoutedLocations.push(locationId);
    }

    // 更新据点状态
    const locationIndex = this.locations.value.findIndex(loc => loc.id === locationId);

    if (locationIndex !== -1) {
      this.locations.value[locationIndex].status = 'scouted';
      this.locations.value[locationIndex].lastScouted = Date.now();

      // 检查据点是否需要AI生成英雄（支持预定义标记和概率判定标记）
      const location = this.locations.value[locationIndex];
      const needsAIHero = (location as any).needsAIHero || location.description.includes('[AI_HERO_GENERATE]');

      console.log(`🔍 [英雄生成] 据点=${location.name}, needsAIHero标记=${!!((location as any).needsAIHero)}, desc标记=${location.description.includes('[AI_HERO_GENERATE]')}, 最终判定=${needsAIHero}`);

      if (needsAIHero) {
        console.log('检测到据点有英雄生成标记，开始AI生成英雄...');

        let aiGenerationSuccess = false;

        try {
          // 导入英雄生成服务
          const { HeroDeterminationService } = await import('../../人物管理/服务/人物生成服务');

          // 获取人物生成格式设置
          const globalVars = getVariables({ type: 'global' });
          const format = globalVars['character_generation_format'] || 'json';

          console.log('📋 使用人物生成格式:', format);

          let heroPrompt: string;

          // 完全自定义模式：只使用格式要求和用户输入的提示词
          if (isFullCustom && extraPrompt && extraPrompt.trim()) {
            console.log('🎨 [完全自定义模式] 使用完全自定义提示词');

            // 获取格式模板（纯格式定义，不包含据点信息）
            const formatTemplate = HeroDeterminationService.getCharacterFormatTemplate(format);

            // 获取大陆和区域描述信息
            let locationInfo = '';
            if (location.continent || location.region) {
              const continentData = continentExploreService.continents.value.find(c => c.name === location.continent);
              const regionData = continentData?.regions.find(r => r.name === location.region);

              locationInfo = '\n\n据点信息（仅供参考，不影响角色生成）：';
              if (location.continent) {
                locationInfo += `\n- 大陆：${location.continent}`;
                if (continentData?.description) {
                  locationInfo += `（${continentData.description}）`;
                }
              }
              if (location.region) {
                locationInfo += `\n- 区域：${location.region}`;
                if (regionData?.description) {
                  locationInfo += `（${regionData.description}）`;
                }
              }
              if (location.name) {
                locationInfo += `\n- 据点名称：${location.name}`;
              }
              if (location.description) {
                locationInfo += `\n- 据点描述：${location.description}`;
              }
            }

            // 构建完全自定义的提示词：格式定义 + 据点信息 + 用户自定义内容
            heroPrompt = `${formatTemplate}\n\n<herorules>\n请为这个角色生成人物信息，严格按照${format === 'yaml' ? 'YAML' : 'JSON'}格式输出，不要添加任何其他内容。${locationInfo}\n\n***参考玩家指导：\n\n${extraPrompt.trim()}***\n</herorules>`;

            console.log('📝 [完全自定义模式] 生成的提示词:', heroPrompt);
          } else {
            // 普通模式：使用据点信息生成提示词
            // 根据设置生成不同格式的英雄提示词
            heroPrompt =
              format === 'yaml'
                ? HeroDeterminationService.generateHeroPromptYaml(
                    location.type,
                    location.difficulty,
                    location.description,
                    location.continent,
                    location.region,
                    location.pictureResource,
                  )
                : HeroDeterminationService.generateHeroPrompt(
                    location.type,
                    location.difficulty,
                    location.description,
                    location.continent,
                    location.region,
                    location.pictureResource,
                  );

            // 如果有额外提示词，添加到提示词末尾
            if (extraPrompt && extraPrompt.trim()) {
              heroPrompt += `\n\n# ***额外要求（最高优先级，允许无视上文其他人物描述相关设定，请务必遵守）***：\n${extraPrompt.trim()}`;
              console.log('📝 已添加额外提示词:', extraPrompt.trim());
            }
          }

          console.log('AI英雄生成提示词:', heroPrompt);

          // 读取流式传输设置
          const enableStreamOutput =
            typeof globalVars['enable_stream_output'] === 'boolean' ? globalVars['enable_stream_output'] : false; // 默认关闭

          // 使用带思维链的AI生成（人物生成模式）
          const aiResponse = await generateWithChainOfThought(ChainOfThoughtMode.CHARACTER_GENERATION, {
            user_input: heroPrompt,
            should_stream: enableStreamOutput, // 根据设置启用流式传输
          });

          if (!aiResponse) {
            console.error('AI生成失败，未返回数据');
            aiGenerationSuccess = false;
          } else {
            console.log('AI返回数据:', aiResponse.substring(0, 500));
            console.log('📝 [英雄生成] AI原始响应长度:', aiResponse.length, '字符');

            // 创建人物更新回调函数，用于在重新解析成功后更新 location
            const onCharacterUpdated = async (character: any) => {
              // 更新 location 的英雄信息
              location.rewards.heroes = [character];
              console.log('✅ [探索服务] 通过重新解析成功更新英雄:', character.name);

              // 标记图片资源为已使用
              if (location.pictureResource?.id) {
                const { pictureResourceMappingService } = await import('./图片资源映射服务');
                pictureResourceMappingService.markPictureAsUsed(location.pictureResource.id);
                console.log(`✅ [探索服务] 图片资源 ${location.pictureResource.id} 已标记为已使用`);
              }

              // 清除已生成的敌方单位，以便重新生成包含英雄的单位
              location.enemyUnits = undefined;
              location.enemyUnitsGeneratedAt = undefined;

              // 标记生成成功
              aiGenerationSuccess = true;
            };

            // 使用人物生成服务解析AI返回的数据
            const character = await HeroDeterminationService.parseHeroCharacter(
              aiResponse,
              locationId,
              location.type,
              location.pictureResource,
              onCharacterUpdated,
              isFullCustom,
            );

            if (character) {
              // 第一次解析成功，用真实英雄替换标记
              location.rewards.heroes = [character];
              console.log('AI英雄生成完成:', character.name);

              // 标记图片资源为已使用（延迟标记机制）
              if (location.pictureResource?.id) {
                const { pictureResourceMappingService } = await import('./图片资源映射服务');
                pictureResourceMappingService.markPictureAsUsed(location.pictureResource.id);
                console.log(`✅ [人物生成] 图片资源 ${location.pictureResource.id} 已标记为已使用`);
              }

              // 清除已生成的敌方单位，以便重新生成包含英雄的单位
              location.enemyUnits = undefined;
              location.enemyUnitsGeneratedAt = undefined;
              aiGenerationSuccess = true;
            } else {
              console.error('AI英雄解析失败');
              // parseHeroCharacter 返回 null 有两种情况：
              // 1. 解析错误：会调用 showParseErrorDialog，显示错误弹窗（包含可编辑文本和重新解析功能）
              //    - 如果用户重新解析成功，会通过 onCharacterUpdated 回调更新 location 和 aiGenerationSuccess
              //    - 如果用户关闭弹窗没有重新解析成功，aiGenerationSuccess 仍为 false
              // 2. 其他错误：可能是在 catch 块中被捕获的
              // 由于 showParseErrorDialog 是 await 的，它会等待用户关闭错误弹窗
              // 等待结束后，检查 aiGenerationSuccess 的状态来判断是否成功

              // 这里不立即设置 aiGenerationSuccess = false
              // 而是在等待 showParseErrorDialog 结束后再检查
              // 如果用户通过重新解析成功，onCharacterUpdated 已经设置了 aiGenerationSuccess = true
            }
          }
        } catch (error) {
          console.error('AI英雄生成失败:', error);
          aiGenerationSuccess = false;
        }

        // 检查AI生成是否成功
        // 注意：如果用户通过重新解析成功，onCharacterUpdated 回调会设置 aiGenerationSuccess = true
        if (!aiGenerationSuccess) {
          console.warn(`据点 ${location.name} AI英雄生成失败，需要用户决策`);

          // 暂时回滚据点状态，等待用户决策
          location.status = 'unknown';
          location.lastScouted = undefined;

          // 从已侦察列表中移除
          const scoutedIndex = this.state.value.scoutedLocations.indexOf(locationId);
          if (scoutedIndex !== -1) {
            this.state.value.scoutedLocations.splice(scoutedIndex, 1);
          }

          // 返回需要用户决策的结果
          return {
            locationId,
            information: {
              rewards: location.rewards,
              status: location.status,
            },
            cost: { gold: 0, food: 0 }, // 暂时显示为0，实际成本在用户决策后处理
            error: 'AI英雄生成失败',
            needsUserDecision: true,
            aiFailureData: {
              location: { ...location }, // 保存据点的完整信息
              originalCost: cost, // 保存原始侦察成本
            },
          };
        } else {
          // AI生成成功（可能是第一次成功，也可能是通过重新解析成功）
          console.log(`✅ [探索服务] 据点 ${location.name} 英雄生成成功`);
        }
      }

      // 在AI英雄生成完成后，生成敌方单位数据，确保侦察结果显示正确的部队数量
      if (!location.enemyUnits || location.enemyUnits.length === 0) {
        console.log('侦察时生成敌方单位数据...');
        const enemyUnits = this.getLocationEnemyUnits(locationId, 1);
        console.log('侦察时敌方单位生成完成:', enemyUnits.length, '个单位');
      }

      // 如果据点有英雄信息，将英雄添加到调教模块
      if (location.rewards?.heroes && location.rewards.heroes.length > 0) {
        console.log('据点已有英雄信息，添加到调教模块...');

        const trainingData = (modularSaveManager.getModuleData({ moduleName: 'training' }) as any) || {
          characters: [],
          trainingMessages: [],
        };

        for (const hero of location.rewards.heroes) {
          // 检查是否已存在相同ID的英雄，避免重复添加
          const existingHeroIndex = trainingData.characters.findIndex((char: any) => char.id === hero.id);
          if (existingHeroIndex === -1) {
            trainingData.characters.push(hero);
            console.log('英雄已添加到调教模块:', hero.name);
          } else {
            console.log('英雄已存在于调教模块中:', hero.name);
          }
        }

        modularSaveManager.updateModuleData({
          moduleName: 'training',
          data: trainingData,
        });
      }
    }

    // 侦察完成，返回结果（包含英雄信息）
    const result: ScoutResult = {
      locationId,
      information: {
        rewards: location.rewards,
        status: location.status,
      },
      cost,
    };

    return result;
  }

  // 根据难度和距离计算侦察成本（固定费用）
  public calculateScoutCost(difficulty: number, distance?: number): { gold: number; food: number } {
    // 获取当前大陆的探索成本作为基础值（大幅增大基础消耗）
    const currentContinent = continentExploreService.getCurrentContinent();
    const baseCost = currentContinent?.explorationCost || { gold: 200, food: 120 };

    // 根据星级计算倍数：低难度（1-2星）使用固定低倍数，高难度使用平方根曲线
    let multiplier: number;
    if (difficulty === 1) {
      // 1星：固定1.2倍（10km时约240金币）
      multiplier = 1.2;
    } else if (difficulty === 2) {
      // 2星：固定1.4倍（10km时约280金币）
      multiplier = 1.4;
    } else {
      // 3星及以上：使用平方根曲线，调整系数让3星约1.7倍，与2星平滑过渡
      // 3星≈1.7倍，5星≈2.68倍，7星≈3.18倍，10星≈4.79倍
      multiplier = Math.max(1, 1 + Math.sqrt(difficulty) * 1.2);
    }

    // 距离成本：每公里增加 0.4% 的成本（大幅降低距离影响）
    // 500km时：1 + 500 * 0.004 = 3倍（相比之前16倍大幅降低）
    const distanceMultiplier = distance ? 1 + distance * 0.004 : 1;

    // 移除随机因子，使用固定费用计算
    // 1星10km：200 * 1.2 * 1.04 = 250金币
    // 10星500km：200 * 4.79 * 3 = 2874金币（接近但不超过3000上限）
    return {
      gold: Math.round(baseCost.gold * multiplier * distanceMultiplier),
      food: Math.round(baseCost.food * multiplier * distanceMultiplier),
    };
  }

  // ==================== AI失败处理功能 ====================

  /**
   * 处理用户选择放弃英雄，直接进攻
   * @param locationId 据点ID
   * @param _originalCost 原始侦察成本（暂未使用，保留用于未来扩展）
   * @returns 是否成功
   */
  public async handleAbandonHeroAndAttack(
    locationId: string,
    _originalCost: { gold: number; food: number },
  ): Promise<boolean> {
    try {
      const location = this.locations.value.find(loc => loc.id === locationId);
      if (!location) {
        console.error(`据点 ${locationId} 不存在`);
        return false;
      }

      console.log(`用户选择放弃英雄，直接进攻据点: ${location.name}`);

      // 更新据点状态为已侦察
      location.status = 'scouted';
      location.lastScouted = Date.now();

      // 添加到已侦察列表
      if (!this.state.value.scoutedLocations.includes(locationId)) {
        this.state.value.scoutedLocations.push(locationId);
      }

      // 清除AI英雄生成标记
      (location as any).needsAIHero = false;

      // 确保据点有基础奖励结构
      if (!location.rewards) {
        location.rewards = {};
      }

      // 移除英雄奖励（如果有的话）
      if (location.rewards.heroes) {
        location.rewards.heroes = [];
      }

      // 生成敌方单位数据（不包含英雄）
      if (!location.enemyUnits || location.enemyUnits.length === 0) {
        console.log('生成无英雄的敌方单位数据...');
        const enemyUnits = this.getLocationEnemyUnits(locationId, 1);
        console.log('无英雄敌方单位生成完成:', enemyUnits.length, '个单位');
      }

      // 保存数据
      await this.saveExploreData();

      console.log(`据点 ${location.name} 已设置为可直接进攻状态`);
      return true;
    } catch (error) {
      console.error('处理放弃英雄失败:', error);
      return false;
    }
  }

  /**
   * 处理用户选择重新侦察
   * @param locationId 据点ID
   * @param originalCost 原始侦察成本
   * @returns 是否成功退还资源
   */
  public async handleRetryScout(locationId: string, originalCost: { gold: number; food: number }): Promise<boolean> {
    try {
      console.log(`用户选择重新侦察据点: ${locationId}`);

      // 退还侦察成本
      modularSaveManager.addResource('gold', originalCost.gold, `重新侦察退还金币`);
      modularSaveManager.addResource('food', originalCost.food, `重新侦察退还食物`);
      console.log(`已退还侦察成本: ${originalCost.gold} 金币, ${originalCost.food} 食物`);

      return true;
    } catch (error) {
      console.error('处理重新侦察失败:', error);
      return false;
    }
  }

  // ==================== AI据点生成功能 ====================

  // ==================== 据点CRUD操作 ====================

  /**
   * 移除据点
   * @param locationId 据点ID
   * @returns 是否成功移除
   */
  public removeLocation(locationId: string): boolean {
    try {
      const locationIndex = this.locations.value.findIndex(loc => loc.id === locationId);
      if (locationIndex !== -1) {
        this.locations.value.splice(locationIndex, 1);
        return true;
      }
      return false;
    } catch (error) {
      console.error('移除据点失败:', error);
      return false;
    }
  }

  /**
   * 更新据点信息
   * @param locationId 据点ID
   * @param updates 更新的字段
   * @returns 是否成功更新
   */
  public updateLocation(locationId: string, updates: Partial<Location>): boolean {
    try {
      const location = this.locations.value.find(loc => loc.id === locationId);
      if (location) {
        Object.assign(location, updates);
        return true;
      }
      return false;
    } catch (error) {
      console.error('更新据点失败:', error);
      return false;
    }
  }

  // ==================== 数据持久化功能 ====================

  // 加载探索数据
  private async loadExploreData(): Promise<void> {
    try {
      // 从数据库加载探索数据
      const explorationData = modularSaveManager.getModuleData({ moduleName: 'exploration' });

      if (explorationData) {
        if ((explorationData as any).locations) {
          this.locations.value = (explorationData as any).locations;
        }
        if ((explorationData as any).state) {
          this.state.value = (explorationData as any).state;
        }
        console.log('从数据库加载探索数据成功');

        // 检查已侦察但无敌方单位数据的据点，立即生成
        this.generateEnemyUnitsForScoutedLocations();
      } else {
        console.log('未找到探索数据，使用默认数据');
      }
    } catch (error) {
      console.error('加载探索数据失败:', error);
    }
  }

  // 设置数据监听器
  private setupDataWatchers(): void {
    // 监听据点数据变化 - 自动保存到数据库
    watch(
      this.locations,
      () => {
        this.saveExploreData();
      },
      { deep: true },
    );

    // 监听状态数据变化 - 自动保存到数据库
    watch(
      this.state,
      () => {
        this.saveExploreData();
      },
      { deep: true },
    );
  }

  // 更新侦察状态
  public updateScoutingState(scoutingLocations: string[], scoutingAnimation: string[]): void {
    this.scoutingLocations = new Set(scoutingLocations);
    this.scoutingAnimation = new Set(scoutingAnimation);
  }

  // 保存探索数据
  public async saveExploreData(): Promise<void> {
    try {
      // 获取当前 exploration 模块的完整数据，保留其他字段（如 customContinents）
      const currentData = (modularSaveManager.getModuleData({ moduleName: 'exploration' }) || {}) as any;

      // 使用模块化存档管理器保存探索数据（保留其他字段）
      modularSaveManager.updateModuleData({
        moduleName: 'exploration',
        data: {
          ...currentData, // 保留现有数据（包括 customContinents 等）
          locations: this.locations.value,
          state: this.state.value,
          scoutingLocations: [...this.scoutingLocations],
          scoutingAnimation: [...this.scoutingAnimation],
        },
      });

      console.log('探索数据已保存到数据库:', {
        locations: this.locations.value.length,
        state: this.state.value,
        scoutingLocations: this.scoutingLocations.size,
        scoutingAnimation: this.scoutingAnimation.size,
      });
    } catch (error) {
      console.error('保存探索数据失败:', error);
    }
  }

  // ==================== 据点状态管理 ====================

  // 根据据点等级增加威胁度
  private addThreatFromConquest(location: Location): void {
    try {
      console.log('开始计算威胁度增加...', location);

      // 根据据点难度计算威胁度增加量
      const threatMultiplier = this.getThreatMultiplierByDifficulty(location.difficulty);
      console.log('难度倍数:', threatMultiplier);

      // 根据据点类型调整威胁度
      const typeMultiplier = this.getThreatMultiplierByType(location.type);
      console.log('类型倍数:', typeMultiplier);

      // 基础威胁度
      const baseThreat = 10;

      // 计算最终威胁度
      const threatIncrease = Math.floor(baseThreat * threatMultiplier * typeMultiplier);
      console.log('计算出的威胁度增加:', threatIncrease);

      // 增加威胁度资源
      const success = modularSaveManager.addResource('threat', threatIncrease, `征服据点${location.name}获得`);
      console.log('威胁度增加是否成功:', success);

      console.log(
        `征服据点 ${location.name} 增加威胁度: +${threatIncrease} (难度:${location.difficulty}, 类型:${location.type})`,
      );
    } catch (error) {
      console.error('增加威胁度失败:', error);
    }
  }

  // 检查并更新首都征服状态
  private async checkAndUpdateCapitalConquest(location: Location): Promise<void> {
    try {
      const { continentExploreService } = await import('./大陆探索服务');

      if (!location.region) {
        console.log(`据点 ${location.name} 没有区域信息，跳过首都检查`);
        return;
      }

      // 获取区域信息，检查是否有首都设置
      const region = continentExploreService.continents.value
        .flatMap(c => c.regions)
        .find(r => r.name === location.region);

      if (!region) {
        console.warn(`区域 ${location.region} 不存在，无法检查首都`);
        return;
      }

      if (!region.capital || region.capital.trim() === '') {
        console.log(`区域 ${location.region} 没有设置首都，跳过首都检查`);
        return;
      }

      // 检查据点是否为区域首都
      const isCapital = continentExploreService.isLocationCapital(location.name, location.region);

      console.log(
        `🔍 [首都检查] 据点: ${location.name}, 区域: ${location.region}, 区域首都: ${region.capital}, 是否匹配: ${isCapital}`,
      );

      if (isCapital) {
        console.log(`✅ 据点 ${location.name} 是区域 ${location.region} 的首都，更新首都征服状态`);
        continentExploreService.updateCapitalConquestStatus(location.region, true);
      } else {
        console.log(`⚠️ 据点 ${location.name} 不是区域 ${location.region} 的首都 (区域首都应为: ${region.capital})`);
      }
    } catch (error) {
      console.error('检查首都征服状态失败:', error);
    }
  }

  // 根据据点征服更新区域征服进度
  private async updateRegionProgressFromLocation(location: Location): Promise<void> {
    try {
      // 通知大陆探索服务重新计算区域征服进度
      const { continentExploreService } = await import('./大陆探索服务');
      continentExploreService.calculateRegionProgressFromLocations(location.region || '');
      console.log(`据点 ${location.name} 征服已触发区域进度重新计算`);
    } catch (error) {
      console.error('更新区域征服进度失败:', error);
    }
  }

  // 根据难度获取威胁度倍数
  private getThreatMultiplierByDifficulty(difficulty: number): number {
    // 根据星级计算威胁度倍数：1星=1倍，10星=10倍
    return Math.max(1.0, difficulty);
  }

  // 根据据点类型获取威胁度倍数
  private getThreatMultiplierByType(type: string): number {
    switch (type) {
      // 通用类型
      case 'village':
        return 1.0; // 村庄：最低
      case 'town':
        return 1.5; // 城镇：中等
      case 'city':
        return 2.5; // 城市：很高
      case 'ruins':
        return 1.2; // 遗迹：较低
      case 'trade_caravan':
        return 1.3; // 贸易商队：较低
      case 'adventurer_party':
        return 1.6; // 冒险者小队：中等偏高
      // 古拉尔大陆
      case 'exile_outpost':
        return 1.5; // 流放者据点：中等
      case 'bandit_camp':
        return 1.4; // 盗匪营地：中等
      case 'elven_forest':
        return 1.8; // 精灵森林：较高
      case 'fox_colony':
        return 1.6; // 狐族殖民地：中等偏高
      // 瓦尔基里大陆
      case 'dark_spire':
        return 3.0; // 巢都尖塔：最高
      case 'slave_camp':
        return 1.2; // 奴隶营地：较低
      case 'dark_fortress':
        return 2.3; // 黑暗要塞：高
      case 'obsidian_mine':
        return 1.5; // 黑曜石矿场：中等
      case 'raid_dock':
        return 2.0; // 劫掠舰码头：较高
      // 香草群岛
      case 'fox_water_town':
        return 1.7; // 狐族水乡：中等偏高
      case 'shrine':
        return 2.0; // 神社：较高
      case 'trading_port':
        return 1.6; // 贸易港口：中等偏高
      case 'warship_dock':
        return 2.2; // 军舰泊地：高
      case 'spice_plantation':
        return 1.3; // 香料种植园：较低
      // 赛菲亚大陆
      case 'imperial_city':
        return 2.8; // 帝国城市：很高
      case 'noble_estate':
        return 2.1; // 贵族庄园：较高
      case 'mining_district':
        return 1.6; // 矿业区域：中等偏高
      case 'border_fortress':
        return 2.4; // 边境要塞：高
      case 'cathedral':
        return 2.2; // 教堂：高
      case 'academy':
        return 1.9; // 学院：较高
      // 世界树圣域
      case 'tree_city':
        return 2.6; // 树城：很高
      case 'elven_temple':
        return 2.5; // 精灵圣殿：很高
      case 'guardian_outpost':
        return 2.0; // 守卫哨所：较高
      case 'canopy_palace':
        return 3.0; // 树冠宫殿：最高
      default:
        return 1.0;
    }
  }

  // 更新据点状态（专门用于战斗结果）
  public async updateLocationStatus(
    locationId: string,
    status: 'unknown' | 'scouted' | 'attacked' | 'conquered',
  ): Promise<boolean> {
    try {
      console.log(`探索服务更新据点状态: ${locationId} -> ${status}`);

      // 查找并更新据点状态
      const location = this.locations.value.find(loc => loc.id === locationId);
      if (location) {
        location.status = status;
        location.lastAttacked = Date.now();
        console.log(`据点 ${location.name} 状态已更新为: ${status}`);
      } else {
        console.warn(`未找到据点 ${locationId}，无法更新状态`);
        return false;
      }

      // 更新征服列表
      if (status === 'conquered') {
        if (!this.state.value.conqueredLocations) {
          this.state.value.conqueredLocations = [];
        }
        if (!this.state.value.conqueredLocations.includes(locationId)) {
          this.state.value.conqueredLocations.push(locationId);

          // 根据据点等级增加威胁度
          this.addThreatFromConquest(location);

          // 检查是否为区域首都
          await this.checkAndUpdateCapitalConquest(location);

          // 触发区域征服进度的重新计算
          await this.updateRegionProgressFromLocation(location);
        }
      }

      // 保存数据到数据库
      await this.saveExploreData();

      return true;
    } catch (error) {
      console.error('更新据点状态失败:', error);
      return false;
    }
  }

  // ==================== 存档恢复功能 ====================

  // 从存档数据恢复探索状态
  public async restoreFromSaveData(exploreData: any): Promise<void> {
    try {
      if (exploreData.locations) {
        this.locations.value = exploreData.locations;
      }
      if (exploreData.state) {
        this.state.value = exploreData.state;
      }
      // 保存到数据库
      await this.saveExploreData();
    } catch (error) {
      console.error('从存档恢复探索数据失败:', error);
    }
  }

  // ==================== 数据持久化功能 ====================

  // 保存据点数据到数据库
  private saveLocationsToDatabase(): void {
    try {
      // 保存据点数据到模块化存档
      modularSaveManager.updateModuleData({
        moduleName: 'exploration',
        data: {
          locations: this.locations.value,
          state: this.state.value,
        },
      });
    } catch (error) {
      console.error('保存据点数据失败:', error);
    }
  }

  // ==================== 敌方单位生成辅助功能 ====================

  // 为已侦察但无敌方单位数据的据点生成敌方单位
  private generateEnemyUnitsForScoutedLocations(): void {
    try {
      const scoutedLocations = this.locations.value.filter(
        location => location.status === 'scouted' && (!location.enemyUnits || location.enemyUnits.length === 0),
      );

      if (scoutedLocations.length > 0) {
        console.log(`发现 ${scoutedLocations.length} 个已侦察但无敌方单位数据的据点，开始生成...`);

        for (const location of scoutedLocations) {
          try {
            const enemyUnits = this.getLocationEnemyUnits(location.id, 1);
            console.log(`据点 ${location.name} 敌方单位生成完成:`, enemyUnits.length, '个单位');
          } catch (error) {
            console.warn(`据点 ${location.name} 敌方单位生成失败:`, error);
          }
        }
      }
    } catch (error) {
      console.error('为已侦察据点生成敌方单位失败:', error);
    }
  }

  // ==================== 数据重置功能 ====================

  // 重置探索数据
  public resetExploreData(): void {
    try {
      // 重置状态
      this.state.value = {
        scoutedLocations: [],
        conqueredLocations: [],
      };

      // 重置据点数据到初始状态
      this.locations.value = [...INITIAL_LOCATIONS];

      console.log('探索数据已初始化');
    } catch (error) {
      console.error('初始化探索数据失败:', error);
    }
  }
}

// 创建全局探索服务实例
export const exploreService = new ExploreService();
