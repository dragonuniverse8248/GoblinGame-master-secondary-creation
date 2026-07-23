import { ref, watch } from 'vue';
import regionData from '../../../数据文件/探索数据/区域信息表.csv?raw';
import continentData from '../../../数据文件/探索数据/大陆信息表.csv?raw';
import { modularSaveManager } from '../../../核心层/服务/存档系统/模块化存档服务';
import { WorldbookService } from '../../../核心层/服务/世界书管理/服务/世界书服务';
import type { Continent, ContinentExploreState, Region } from '../类型/大陆探索类型';
import type { Location } from '../类型/探索类型';
import { ContinentDataMerger } from './大陆数据合并服务';

/**
 * 大陆探索服务类
 * 管理基于大陆的探索系统
 */
export class ContinentExploreService {
  // ==================== 响应式数据 ====================

  // 大陆数据
  public continents = ref<Continent[]>([]);

  // 探索状态
  public exploreState = ref<ContinentExploreState>({
    unlockedContinents: [],
    conqueredContinents: [],
    currentContinent: '',
    continentProgress: {},
    selectedContinent: '',
    selectedRegion: '',
  });

  // ==================== 构造函数和初始化 ====================

  constructor() {
    // 先初始化CSV数据
    this.initializeContinents();
    this.setupDataWatchers();
    // 延迟初始化，等待存档系统加载完成
    setTimeout(() => {
      this.initializeExploreData();
    }, 100);
  }

  // 初始化大陆数据
  private initializeContinents(): void {
    console.log('🔍 [大陆探索服务] 开始初始化大陆数据...');
    // 从CSV表格读取大陆数据
    const continents = this.loadContinentDataFromCSV();

    // 只有在没有数据时才设置，避免覆盖存档数据
    if (this.continents.value.length === 0) {
      this.continents.value = continents;
      console.log('🔍 [大陆探索服务] 大陆数据初始化完成，共', continents.length, '个大陆');
      console.log('🔍 [大陆探索服务] 大陆数据详情:', continents);
    } else {
      console.log('🔍 [大陆探索服务] 大陆数据已存在，跳过CSV初始化');
    }
  }

  // 从CSV表格加载大陆数据
  private loadContinentDataFromCSV(): Continent[] {
    console.log('🔍 [大陆探索服务] 开始解析CSV数据...');
    console.log('🔍 [大陆探索服务] 大陆CSV数据:', continentData);

    // 解析大陆CSV数据
    const continentLines = continentData.trim().split('\n');
    console.log('🔍 [大陆探索服务] 大陆CSV行数:', continentLines.length);
    const continentHeaders = continentLines[0].split(',');
    console.log('🔍 [大陆探索服务] 大陆CSV表头:', continentHeaders);
    const continentRows = continentLines.slice(1).map(line => {
      const values = line.split(',');
      const row: any = {};
      continentHeaders.forEach((header, index) => {
        row[header.trim()] = values[index]?.trim() || '';
      });
      return row;
    });
    console.log('🔍 [大陆探索服务] 大陆CSV解析结果:', continentRows);

    // 解析区域CSV数据
    const regionLines = regionData.trim().split('\n');
    const regionHeaders = regionLines[0].split(',');
    const regionRows = regionLines.slice(1).map(line => {
      const values = line.split(',');
      const row: any = {};
      regionHeaders.forEach((header, index) => {
        row[header.trim()] = values[index]?.trim() || '';
      });
      return row;
    });

    // 构建大陆数据
    const continents: Continent[] = continentRows.map(row => ({
      name: row['大陆名称'],
      icon: row['大陆图标'],
      description: row['大陆描述'],
      difficulty: parseInt(row['大陆难度']),
      explorationCost: {
        gold: parseInt(row['探索成本(金币)']),
        food: parseInt(row['探索成本(食物)']),
      },
      threatMultiplier: parseFloat(row['威胁倍数']),
      conquestProgress: 0,
      isUnlocked: row['是否解锁'] === 'true',
      isConquered: row['是否征服'] === 'true',
      unlockCondition: {
        conquestPercentage: 0,
        previousContinentName: undefined,
      },
      regions: [],
    }));

    // 构建区域数据
    const regions: Region[] = regionRows.map(row => ({
      name: row['区域名称'],
      icon: row['区域图标'],
      continentName: row['所属大陆'],
      description: row['区域描述'],
      difficulty: parseInt(row['区域难度']),
      isUnlocked: row['是否解锁'] === 'true',
      isConquered: row['是否征服'] === 'true',
      conquestProgress: 0,
      requiredStars: parseInt(row['征服需要总星级']) || 0,
      unlockStars: parseInt(row['解锁星级']) || 0,
      capital: row['首都'] || '',
      isCapitalConquered: false, // 默认首都未征服
      threatLevel: 0,
      locations: [],
    }));

    // 将区域分配给对应的大陆
    console.log('🔍 [大陆探索服务] 开始分配区域到大陆...');
    console.log(
      '🔍 [大陆探索服务] 大陆列表:',
      continents.map(c => ({ name: c.name })),
    );
    console.log(
      '🔍 [大陆探索服务] 区域列表:',
      regions.map(r => ({ name: r.name, continentName: r.continentName })),
    );

    // 根据难度设置前置关系：难度N的大陆需要征服难度N-1的大陆
    const result = continents.map(continent => {
      const continentRegions = regions.filter(region => region.continentName === continent.name);
      console.log(
        `🔍 [大陆探索服务] 大陆 ${continent.name} 匹配到 ${continentRegions.length} 个区域:`,
        continentRegions.map(r => r.name),
      );

      // 根据难度设置前置大陆关系
      let unlockCondition = continent.unlockCondition;
      if (continent.difficulty > 1) {
        // 查找前一个难度的大陆作为前置
        const previousContinent = continents.find(c => c.difficulty === continent.difficulty - 1);
        if (previousContinent) {
          unlockCondition = {
            previousContinentName: previousContinent.name,
            conquestPercentage: 50, // 需要征服前一个大陆的50%才能解锁
          };
        }
      }

      return {
        ...continent,
        unlockCondition,
        regions: continentRegions,
      };
    });

    console.log(
      '🔍 [大陆探索服务] 最终大陆数据:',
      result.map(c => ({ name: c.name, regionsCount: c.regions.length })),
    );
    return result;
  }

  // 初始化探索数据
  private async initializeExploreData(): Promise<void> {
    await this.loadExploreData();
  }

  // 手动初始化探索数据（供存档系统调用）
  public async initializeFromSave(): Promise<void> {
    await this.loadExploreData();
  }

  // 修复已加载大陆数据的前置关系（兼容旧存档）
  private fixContinentUnlockConditions(): void {
    this.continents.value.forEach(continent => {
      // 如果前置关系未设置或为空，根据难度重新设置
      if (!continent.unlockCondition.previousContinentName && continent.difficulty > 1) {
        const previousContinent = this.continents.value.find(c => c.difficulty === continent.difficulty - 1);
        if (previousContinent) {
          continent.unlockCondition = {
            previousContinentName: previousContinent.name,
            conquestPercentage: continent.unlockCondition.conquestPercentage || 50,
          };
          console.log(
            `🔧 [数据修复] 已修复大陆 ${continent.name} 的前置关系: 前置大陆=${previousContinent.name}, 需要进度=${continent.unlockCondition.conquestPercentage}%`,
          );
        }
      }
    });
  }

  // 同步征服进度从探索状态到大陆数据
  private syncProgressFromExploreState(): void {
    console.log('🔄 [同步进度] 开始从探索状态同步征服进度到大陆数据...');
    let syncedCount = 0;

    this.continents.value.forEach(continent => {
      // 从 exploreState.continentProgress 同步到 continent.conquestProgress
      const progressFromState = this.exploreState.value.continentProgress[continent.name];
      if (progressFromState !== undefined && progressFromState !== null) {
        // 只有当存档状态中有值时才同步（避免覆盖已计算的正确值）
        if (continent.conquestProgress === 0 || Math.abs(continent.conquestProgress - progressFromState) > 0.1) {
          console.log(
            `🔄 [同步进度] 同步大陆 ${continent.name}: ${continent.conquestProgress}% -> ${progressFromState}%`,
          );
          continent.conquestProgress = progressFromState;
          syncedCount++;
        }
      }
    });

    console.log(`✅ [同步进度] 同步完成: 共同步 ${syncedCount} 个大陆的征服进度`);
  }

  // 验证并修复解锁状态（兼容旧存档）
  private validateAndFixUnlockStatus(): void {
    console.log('🔍 [解锁验证] 开始验证大陆解锁状态...');
    let fixedCount = 0;
    let unlockedCount = 0;

    this.continents.value.forEach(continent => {
      const wasUnlocked = continent.isUnlocked;
      const shouldBeUnlocked = this.checkUnlockConditions(continent);

      // 对于自定义大陆，如果已经解锁，优先保留解锁状态（避免因进度同步问题导致锁定）
      if (continent.source === 'custom' && wasUnlocked) {
        // 自定义大陆已经解锁，检查是否满足解锁条件
        if (shouldBeUnlocked) {
          // 满足条件，保持解锁状态
          unlockedCount++;
          // 确保探索状态中的解锁列表与大陆状态同步
          if (!this.exploreState.value.unlockedContinents.includes(continent.name)) {
            this.exploreState.value.unlockedContinents.push(continent.name);
          }
          return; // 跳过后续验证，保持解锁状态
        } else {
          // 不满足条件，但自定义大陆已经解锁，可能是进度同步问题
          // 记录警告但不强制锁定，保持解锁状态
          const previousProgress =
            this.exploreState.value.continentProgress[continent.unlockCondition.previousContinentName || ''] || 0;
          console.warn(
            `⚠️ [解锁验证] 自定义大陆 ${continent.name} 已解锁但前置大陆进度不足 (需要 >= ${continent.unlockCondition.conquestPercentage}%, 当前: ${previousProgress.toFixed(1)}%)，保持解锁状态`,
          );
          unlockedCount++;
          // 确保探索状态中的解锁列表与大陆状态同步
          if (!this.exploreState.value.unlockedContinents.includes(continent.name)) {
            this.exploreState.value.unlockedContinents.push(continent.name);
          }
          return; // 跳过后续验证，保持解锁状态
        }
      }

      // 对于自定义大陆，如果未解锁，默认解锁
      if (continent.source === 'custom' && !wasUnlocked) {
        continent.isUnlocked = true;
        if (!this.exploreState.value.unlockedContinents.includes(continent.name)) {
          this.exploreState.value.unlockedContinents.push(continent.name);
        }
        // 确保所有区域也解锁
        continent.regions.forEach(region => {
          region.isUnlocked = true;
        });
        unlockedCount++;
        fixedCount++;
        console.log(`✅ [解锁验证] 自定义大陆 ${continent.name} 默认解锁`);
        // 大陆解锁后，检查并解锁符合条件的区域
        this.checkAndUnlockRegionsForContinent(continent.name);
        // 从 images 索引注入传说人物和世界书模板
        WorldbookService.populateContinentLegendary(continent.name).then(count => {
          console.log(`📖 [解锁验证] 自定义大陆"${continent.name}"世界书注入完成: ${count}人`);
        }).catch(err => {
          console.warn(`📖 [解锁验证] 自定义大陆"${continent.name}"世界书注入失败:`, err);
        });
        return; // 跳过后续验证
      }

      // 对于默认大陆，正常验证解锁条件
      // 如果状态不一致，修复它
      if (wasUnlocked !== shouldBeUnlocked) {
        if (shouldBeUnlocked && !wasUnlocked) {
          // 应该解锁但未解锁 - 自动解锁
          continent.isUnlocked = true;
          if (!this.exploreState.value.unlockedContinents.includes(continent.name)) {
            this.exploreState.value.unlockedContinents.push(continent.name);
          }
          console.log(
            `✅ [解锁验证] 大陆 ${continent.name} 已满足解锁条件，自动解锁 (前置大陆进度: ${this.exploreState.value.continentProgress[continent.unlockCondition.previousContinentName || ''] || 0}%)`,
          );
          fixedCount++;
          unlockedCount++;

          // 大陆解锁后，检查并解锁符合条件的区域
          this.checkAndUnlockRegionsForContinent(continent.name);
          // 从 images 索引注入传说人物和世界书模板
          WorldbookService.populateContinentLegendary(continent.name).then(count => {
            console.log(`📖 [解锁验证] 大陆"${continent.name}"世界书注入完成: ${count}人`);
          }).catch(err => {
            console.warn(`📖 [解锁验证] 大陆"${continent.name}"世界书注入失败:`, err);
          });
        } else if (!shouldBeUnlocked && wasUnlocked) {
          // 不应该解锁但已解锁 - 锁定（仅对默认大陆）
          continent.isUnlocked = false;
          const index = this.exploreState.value.unlockedContinents.indexOf(continent.name);
          if (index !== -1) {
            this.exploreState.value.unlockedContinents.splice(index, 1);
          }
          const previousProgress =
            this.exploreState.value.continentProgress[continent.unlockCondition.previousContinentName || ''] || 0;
          console.log(
            `⚠️ [解锁验证] 大陆 ${continent.name} 不满足解锁条件，已锁定 (需要前置大陆进度 >= ${continent.unlockCondition.conquestPercentage}%, 当前: ${previousProgress.toFixed(1)}%)`,
          );
          fixedCount++;
        }
      } else if (shouldBeUnlocked) {
        unlockedCount++;
      }

      // 确保探索状态中的解锁列表与大陆状态同步
      if (continent.isUnlocked && !this.exploreState.value.unlockedContinents.includes(continent.name)) {
        this.exploreState.value.unlockedContinents.push(continent.name);
      }
    });

    console.log(`✅ [解锁验证] 验证完成: 共修复 ${fixedCount} 个大陆状态, 当前解锁 ${unlockedCount} 个大陆`);

    // 验证完成后，对所有已解锁的大陆检查区域解锁（确保区域也正确解锁）
    console.log('🔍 [解锁验证] 开始检查已解锁大陆的区域解锁状态...');
    this.continents.value.forEach(continent => {
      if (continent.isUnlocked) {
        this.checkAndUnlockRegionsForContinent(continent.name);
      }
    });

    // 如果有修复，保存数据
    if (fixedCount > 0) {
      this.saveExploreData();
    }
  }

  // 重新加载CSV数据（开发时使用）
  public reloadCSVData(): void {
    console.log('🔄 重新加载CSV数据...');
    this.initializeContinents();
    console.log('✅ CSV数据重新加载完成');
  }

  // 初始化新游戏数据（供存档系统调用）
  public initializeNewGame(): void {
    this.resetExploreData();
  }

  // ==================== 大陆管理功能 ====================

  // 获取所有大陆
  public getAllContinents(): Continent[] {
    return this.continents.value;
  }

  // 获取已解锁的大陆
  public getUnlockedContinents(): Continent[] {
    return this.continents.value.filter(continent => continent.isUnlocked);
  }

  // 获取当前可探索的大陆
  public getCurrentContinent(): Continent | null {
    const currentName = this.exploreState.value.currentContinent;
    return this.continents.value.find(c => c.name === currentName) || null;
  }

  // 解锁大陆
  public unlockContinent(continentName: string): boolean {
    try {
      const continent = this.continents.value.find(c => c.name === continentName);
      if (!continent) {
        console.warn(`大陆 ${continentName} 不存在`);
        return false;
      }

      // 检查解锁条件
      if (!this.checkUnlockConditions(continent)) {
        console.warn(`大陆 ${continent.name} 解锁条件未满足`);
        return false;
      }

      // 解锁大陆
      continent.isUnlocked = true;

      // 更新探索状态
      if (!this.exploreState.value.unlockedContinents.includes(continentName)) {
        this.exploreState.value.unlockedContinents.push(continentName);
      }

      // 设置当前大陆
      if (!this.exploreState.value.currentContinent) {
        this.exploreState.value.currentContinent = continentName;
      }

      console.log(`大陆 ${continent.name} 已解锁`);

      // 解锁大陆后，将该大陆的传说人物写入世界书
      WorldbookService.populateContinentLegendary(continentName);

      // 解锁大陆后，检查并解锁符合条件的区域
      this.checkAndUnlockRegionsForContinent(continentName);

      this.saveExploreData();

      return true;
    } catch (error) {
      console.error('解锁大陆失败:', error);
      return false;
    }
  }

  // 检查解锁条件
  private checkUnlockConditions(continent: Continent): boolean {
    const { previousContinentName, conquestPercentage } = continent.unlockCondition;

    // 如果没有前置大陆要求，直接解锁
    if (!previousContinentName) {
      return true;
    }

    // 检查前置大陆的征服进度是否达到要求
    const previousProgress = this.exploreState.value.continentProgress[previousContinentName] || 0;
    const requiredProgress = conquestPercentage || 50; // 默认50%
    return previousProgress >= requiredProgress;
  }

  // 更新大陆征服进度
  public updateContinentProgress(continentName: string, progress: number): void {
    try {
      const continent = this.continents.value.find(c => c.name === continentName);
      if (!continent) {
        console.warn(`大陆 ${continentName} 不存在`);
        return;
      }

      // 更新征服进度
      continent.conquestProgress = Math.min(100, Math.max(0, progress));
      this.exploreState.value.continentProgress[continentName] = continent.conquestProgress;

      // 检查是否完全征服
      if (continent.conquestProgress >= 100 && !continent.isConquered) {
        continent.isConquered = true;
        if (!this.exploreState.value.conqueredContinents.includes(continentName)) {
          this.exploreState.value.conqueredContinents.push(continentName);
        }
        console.log(`大陆 ${continent.name} 已完全征服`);
      }

      // 检查是否可以解锁下一个大陆
      this.checkNextContinentUnlock(continentName);

      this.saveExploreData();
    } catch (error) {
      console.error('更新大陆征服进度失败:', error);
    }
  }

  // 基于区域征服自动计算大陆征服进度
  public calculateContinentProgressFromRegions(continentName: string, skipSave: boolean = false): void {
    try {
      const continent = this.continents.value.find(c => c.name === continentName);
      if (!continent) {
        console.warn(`大陆 ${continentName} 不存在`);
        return;
      }

      // 计算所有区域的平均征服进度（包括未解锁的区域）
      let totalProgress = 0;
      let regionCount = 0;

      continent.regions.forEach(region => {
        // 计算所有区域的征服进度，不管是否解锁
        totalProgress += region.conquestProgress;
        regionCount++;
      });

      // 计算平均征服进度
      const averageProgress = regionCount > 0 ? totalProgress / regionCount : 0;
      continent.conquestProgress = Math.min(100, Math.max(0, averageProgress));
      // 同步更新探索状态中的征服进度，确保解锁检查能读取到最新值
      this.exploreState.value.continentProgress[continentName] = continent.conquestProgress;

      // 检查大陆是否完全征服
      if (continent.conquestProgress >= 100 && !continent.isConquered) {
        continent.isConquered = true;
        if (!this.exploreState.value.conqueredContinents.includes(continentName)) {
          this.exploreState.value.conqueredContinents.push(continentName);
        }
        console.log(`大陆 ${continent.name} 已完全征服`);
      }

      // 检查是否可以解锁下一个大陆
      this.checkNextContinentUnlock(continentName);

      // 只有在不跳过保存时才保存
      if (!skipSave) {
        this.saveExploreData();
      }
    } catch (error) {
      console.error('计算大陆征服进度失败:', error);
    }
  }

  // 检查是否可以解锁下一个大陆
  private checkNextContinentUnlock(conqueredContinentName: string): void {
    const nextContinent = this.continents.value.find(
      c => c.unlockCondition.previousContinentName === conqueredContinentName,
    );

    if (nextContinent && !nextContinent.isUnlocked) {
      if (this.checkUnlockConditions(nextContinent)) {
        this.unlockContinent(nextContinent.name);
      }
    }
  }

  // ==================== 区域管理功能 ====================

  // 解锁区域
  public unlockRegion(regionName: string): boolean {
    try {
      const region = this.findRegionByName(regionName);
      if (!region) {
        console.warn(`区域 ${regionName} 不存在`);
        return false;
      }

      // 检查是否已经解锁
      if (region.isUnlocked) {
        console.log(`区域 ${region.name} 已经解锁`);
        return true;
      }

      // 检查大陆是否已解锁
      const continent = this.continents.value.find(c => c.name === region.continentName);
      if (!continent || !continent.isUnlocked) {
        console.warn(`区域 ${region.name} 所属大陆未解锁`);
        return false;
      }

      // 检查解锁条件（需要征服大陆上所有区域的据点总星级达到解锁星级）
      if (!this.checkRegionUnlockConditions(region)) {
        console.warn(`区域 ${region.name} 解锁条件未满足`);
        return false;
      }

      // 解锁区域
      region.isUnlocked = true;
      console.log(`区域 ${region.name} 已解锁`);
      this.saveExploreData();

      return true;
    } catch (error) {
      console.error('解锁区域失败:', error);
      return false;
    }
  }

  // 检查区域解锁条件
  private checkRegionUnlockConditions(region: Region): boolean {
    // 如果解锁星级为0，表示默认解锁
    if (region.unlockStars === 0) {
      return true;
    }

    // 计算大陆上所有区域的据点征服总星级
    const continent = this.continents.value.find(c => c.name === region.continentName);
    if (!continent) {
      return false;
    }

    const totalConqueredStars = this.calculateContinentConqueredStars(continent.name);
    return totalConqueredStars >= region.unlockStars;
  }

  // 计算大陆上所有区域的据点征服总星级
  private calculateContinentConqueredStars(continentName: string): number {
    try {
      // 从探索服务获取所有据点数据
      const exploreData = modularSaveManager.getModuleData({ moduleName: 'exploration' });
      if (!exploreData || !(exploreData as any).locations) {
        return 0;
      }

      const locations: Location[] = (exploreData as any).locations;
      const continent = this.continents.value.find(c => c.name === continentName);
      if (!continent) return 0;

      // 计算该大陆所有区域的已征服据点总星级
      let totalStars = 0;
      continent.regions.forEach(region => {
        const regionLocations = locations.filter(
          loc => loc.continent === continent.name && loc.region === region.name && loc.status === 'conquered',
        );

        regionLocations.forEach(location => {
          totalStars += location.difficulty || 0;
        });
      });

      return totalStars;
    } catch (error) {
      console.error('计算大陆征服星级失败:', error);
      return 0;
    }
  }

  // 根据名称查找区域
  private findRegionByName(regionName: string): Region | null {
    for (const continent of this.continents.value) {
      const region = continent.regions.find(r => r.name === regionName);
      if (region) {
        return region;
      }
    }
    return null;
  }

  // 更新区域征服进度
  public updateRegionProgress(regionName: string, progress: number): void {
    try {
      const region = this.findRegionByName(regionName);
      if (!region) {
        console.warn(`区域 ${regionName} 不存在`);
        return;
      }

      // 更新征服进度
      region.conquestProgress = Math.min(100, Math.max(0, progress));

      // 检查是否完全征服
      if (region.conquestProgress >= 100 && !region.isConquered) {
        region.isConquered = true;
        console.log(`区域 ${region.name} 已完全征服`);

        // 检查是否可以解锁下一个区域
        this.checkNextRegionUnlock(regionName);
      }

      this.saveExploreData();
    } catch (error) {
      console.error('更新区域征服进度失败:', error);
    }
  }

  // 基于据点征服自动计算区域征服进度
  public calculateRegionProgressFromLocations(regionName: string, skipSave: boolean = false): void {
    try {
      const region = this.findRegionByName(regionName);
      if (!region) {
        console.warn(`区域 ${regionName} 不存在`);
        return;
      }

      // 在计算进度前，先检查该区域已征服的据点中是否有首都
      this.checkCapitalConquestFromConqueredLocations(regionName);

      // 计算该区域已征服的据点总星级
      const conqueredStars = this.calculateRegionConqueredStars(regionName);

      // 计算征服进度
      const progress = region.requiredStars > 0 ? Math.min(100, (conqueredStars / region.requiredStars) * 100) : 0;
      region.conquestProgress = progress;

      console.log(
        `区域 ${region.name} 征服进度: ${progress.toFixed(1)}% (${conqueredStars}/${region.requiredStars}星)`,
      );

      // 检查区域是否完全征服（需要满足星级要求和首都征服条件）
      const isStarsConquered = progress >= 100;
      const isCapitalConquered = !region.capital || region.isCapitalConquered;

      if (isStarsConquered && isCapitalConquered && !region.isConquered) {
        region.isConquered = true;
        console.log(
          `区域 ${region.name} 已完全征服（星级: ${conqueredStars}/${region.requiredStars}, 首都: ${region.capital ? (region.isCapitalConquered ? '已征服' : '未征服') : '无'})`,
        );

        // 区域完全征服时增加行动力上限
        this.addActionPointsFromRegionConquest();

        // 检查是否可以解锁下一个区域
        this.checkNextRegionUnlock(regionName);
      } else if (isStarsConquered && !isCapitalConquered) {
        console.log(`区域 ${region.name} 星级已达标但首都 ${region.capital} 未征服，无法完全征服区域`);
      }

      // 更新对应的大陆征服进度（也跳过保存）
      this.calculateContinentProgressFromRegions(region.continentName, skipSave);

      // 只有在不跳过保存时才保存
      if (!skipSave) {
        this.saveExploreData();
      }
    } catch (error) {
      console.error('计算区域征服进度失败:', error);
    }
  }

  // 计算区域已征服的据点总星级
  private calculateRegionConqueredStars(regionName: string): number {
    try {
      const region = this.findRegionByName(regionName);
      if (!region) return 0;

      // 从探索服务获取所有据点数据
      const exploreData = modularSaveManager.getModuleData({ moduleName: 'exploration' });
      if (!exploreData || !(exploreData as any).locations) {
        return 0;
      }

      const locations: Location[] = (exploreData as any).locations;
      const continent = this.continents.value.find(c => c.name === region.continentName);
      if (!continent) return 0;

      // 计算该区域已征服的据点总星级
      const regionLocations = locations.filter(
        loc => loc.continent === continent.name && loc.region === region.name && loc.status === 'conquered',
      );

      let totalStars = 0;
      regionLocations.forEach(location => {
        totalStars += location.difficulty || 0;
      });

      return totalStars;
    } catch (error) {
      console.error('计算区域征服星级失败:', error);
      return 0;
    }
  }

  // 根据区域征服增加行动力上限
  private addActionPointsFromRegionConquest(): void {
    try {
      // 计算当前实际已征服的区域数量
      let actualConqueredRegions = 0;
      const conqueredRegionNames: string[] = [];
      this.continents.value.forEach(continent => {
        continent.regions.forEach(region => {
          if (region.isConquered) {
            actualConqueredRegions++;
            conqueredRegionNames.push(`${continent.name} - ${region.name}`);
          }
        });
      });

      // 调试日志：显示所有已征服的区域
      if (conqueredRegionNames.length > 0) {
        console.log(
          `[addActionPointsFromRegionConquest] 已征服的区域 (${actualConqueredRegions}个):`,
          conqueredRegionNames,
        );
      }

      // 获取存档中记录的征服区域数
      const savedConqueredRegions = modularSaveManager.resources.value.conqueredRegions;

      // 只有在实际征服区域数大于存档记录的征服区域数时，才增加行动力上限
      // 这确保在重新计算时不会重复增加
      if (actualConqueredRegions <= savedConqueredRegions) {
        console.log(
          `[addActionPointsFromRegionConquest] 跳过增加行动力上限: 实际征服区域数 ${actualConqueredRegions} <= 存档记录 ${savedConqueredRegions}`,
        );
        return;
      }

      // 每征服一个区域，增加1点行动力上限，但上限最高为10
      const currentMax = modularSaveManager.resources.value.maxActionPoints;
      const MAX_ACTION_POINTS_LIMIT = 10;

      // 如果已经达到上限，不再增加
      if (currentMax >= MAX_ACTION_POINTS_LIMIT) {
        console.log(`行动力上限已达到最大值 ${MAX_ACTION_POINTS_LIMIT}，无法继续增加`);
        // 即使不增加上限，也要更新征服区域计数以保持同步
        modularSaveManager.setResource('conqueredRegions', actualConqueredRegions);
        return;
      }

      // 计算需要增加的行动力上限数量（基于新征服的区域数）
      const newConqueredRegions = actualConqueredRegions - savedConqueredRegions;
      if (newConqueredRegions <= 0) {
        console.log(`[addActionPointsFromRegionConquest] 没有新征服的区域，跳过增加行动力上限`);
        return;
      }

      // 根据新征服的区域数增加行动力上限（最多增加newConqueredRegions个）
      const newMax = Math.min(currentMax + newConqueredRegions, MAX_ACTION_POINTS_LIMIT);

      // 更新最大行动力
      modularSaveManager.setResource('maxActionPoints', newMax);

      // 更新征服区域计数为实际征服的区域数
      modularSaveManager.setResource('conqueredRegions', actualConqueredRegions);

      console.log(
        `[addActionPointsFromRegionConquest] 征服区域增加行动力上限: ${currentMax} -> ${newMax} (新征服区域: ${newConqueredRegions}, 总征服区域: ${actualConqueredRegions})`,
      );
    } catch (error) {
      console.error('增加行动力上限失败:', error);
    }
  }

  // 检查是否可以解锁下一个区域
  private checkNextRegionUnlock(conqueredRegionName: string): void {
    const conqueredRegion = this.findRegionByName(conqueredRegionName);
    if (!conqueredRegion) return;

    const continent = this.continents.value.find(c => c.name === conqueredRegion.continentName);
    if (!continent) return;

    // 检查该大陆的其他区域是否可以解锁
    this.checkAndUnlockRegionsForContinent(continent.name);
  }

  // 检查并解锁大陆下符合条件的区域
  private checkAndUnlockRegionsForContinent(continentName: string): void {
    try {
      const continent = this.continents.value.find(c => c.name === continentName);
      if (!continent || !continent.isUnlocked) {
        return;
      }

      let unlockedCount = 0;

      // 检查该大陆的所有区域是否可以解锁
      continent.regions.forEach(region => {
        if (region.isUnlocked) {
          return;
        }

        // 检查区域解锁条件
        if (this.checkRegionUnlockConditions(region)) {
          if (this.unlockRegion(region.name)) {
            unlockedCount++;
          }
        }
      });

      if (unlockedCount > 0) {
        console.log(`✅ [区域解锁检查] 大陆 ${continent.name} 解锁了 ${unlockedCount} 个区域`);
      }
    } catch (error) {
      console.error('检查并解锁区域失败:', error);
    }
  }

  // 检查据点是否为区域首都
  public isLocationCapital(locationName: string, regionName: string): boolean {
    const region = this.findRegionByName(regionName);
    if (!region) {
      return false;
    }
    return region.capital === locationName;
  }

  // 检查该区域已征服的据点中是否有首都被征服
  private checkCapitalConquestFromConqueredLocations(regionName: string): void {
    try {
      const region = this.findRegionByName(regionName);
      if (!region) {
        return;
      }

      // 如果区域没有设置首都，跳过检查
      if (!region.capital || region.capital.trim() === '') {
        return;
      }

      // 从探索服务获取所有据点数据
      const exploreData = modularSaveManager.getModuleData({ moduleName: 'exploration' });
      if (!exploreData || !(exploreData as any).locations) {
        return;
      }

      const locations: Location[] = (exploreData as any).locations;
      const continent = this.continents.value.find(c => c.name === region.continentName);
      if (!continent) {
        return;
      }

      // 查找该区域已征服的据点中是否有首都被征服
      const conqueredLocations = locations.filter(
        loc => loc.continent === continent.name && loc.region === region.name && loc.status === 'conquered',
      );

      // 检查是否有据点的名称与区域的首都名称匹配
      const capitalLocation = conqueredLocations.find(loc => loc.name === region.capital);

      if (capitalLocation && !region.isCapitalConquered) {
        // 如果首都被征服了但状态还是未征服，更新状态
        region.isCapitalConquered = true;
        console.log(`✅ [首都状态更新] 区域 ${region.name} 的首都 ${region.capital} 已被征服，更新首都征服状态`);
      } else if (!capitalLocation && region.isCapitalConquered) {
        // 如果首都未被征服但状态是已征服，重置状态
        region.isCapitalConquered = false;
        console.log(`⚠️ [首都状态更新] 区域 ${region.name} 的首都 ${region.capital} 未被征服，重置首都征服状态`);
      }
    } catch (error) {
      console.error('检查首都征服状态失败:', error);
    }
  }

  // 更新首都征服状态
  public updateCapitalConquestStatus(regionName: string, isConquered: boolean): void {
    try {
      const region = this.findRegionByName(regionName);
      if (!region) {
        console.warn(`区域 ${regionName} 不存在`);
        return;
      }

      region.isCapitalConquered = isConquered;
      console.log(`区域 ${region.name} 首都 ${region.capital} 征服状态更新为: ${isConquered ? '已征服' : '未征服'}`);

      // 重新计算区域征服进度
      this.calculateRegionProgressFromLocations(regionName);

      this.saveExploreData();
    } catch (error) {
      console.error('更新首都征服状态失败:', error);
    }
  }

  // 重新计算所有区域的征服进度（供外部调用）
  public recalculateAllRegionProgress(): void {
    try {
      // 批量计算所有区域的征服进度（跳过每次保存）
      this.continents.value.forEach(continent => {
        continent.regions.forEach(region => {
          this.calculateRegionProgressFromLocations(region.name, true); // skipSave = true
        });
        // 重新计算大陆征服进度（跳过每次保存）
        this.calculateContinentProgressFromRegions(continent.name, true); // skipSave = true
      });

      // 所有计算完成后，统一保存一次
      this.saveExploreData();
      console.log('✅ 所有区域征服进度重新计算完成');
    } catch (error) {
      console.error('重新计算区域征服进度失败:', error);
    }
  }

  // ==================== 数据持久化功能 ====================

  // 设置数据监听器
  private setupDataWatchers(): void {
    // 监听大陆数据变化
    watch(
      this.continents,
      () => {
        this.saveExploreData();
      },
      { deep: true },
    );

    // 监听探索状态变化
    watch(
      this.exploreState,
      () => {
        this.saveExploreData();
      },
      { deep: true },
    );
  }

  // 加载探索数据
  private async loadExploreData(): Promise<void> {
    try {
      const exploreData = modularSaveManager.getModuleData({ moduleName: 'exploration' });

      if (exploreData) {
        const data = exploreData as any;

        // 数据迁移和兼容性处理
        this.migrateExploreData(data);

        // 加载默认数据（从CSV）
        const defaultData = this.loadContinentDataFromCSV();

        // 加载自定义数据
        const customData = this.loadCustomContinents();

        // 加载存档数据（包含游戏进度）
        // 注意：savedData 应该只包含默认大陆的游戏进度，自定义大陆的数据从 customData 加载
        const allSavedContinents =
          data.continents && Array.isArray(data.continents) && data.continents.length > 0 ? data.continents : [];

        // 从存档数据中过滤掉自定义大陆，只保留默认大陆的游戏进度
        const savedData = allSavedContinents.filter((c: Continent) => c.source !== 'custom' && c.source !== 'merged');

        console.log(
          `📋 [加载存档] 存档数据统计: 总大陆=${allSavedContinents.length}, 默认大陆=${savedData.length}, 自定义大陆=${customData.length}`,
        );

        // 合并数据：默认数据 + 自定义数据 + 存档游戏进度
        const mergedData = ContinentDataMerger.mergeContinents(defaultData, customData, savedData, {
          strategy: 'merge',
          allowOverride: true,
          preserveDefault: true,
        });

        // 设置合并后的数据
        this.continents.value = mergedData;

        // 恢复自定义大陆的游戏进度（从存档中）
        if (customData.length > 0 && allSavedContinents.length > 0) {
          const savedCustomContinents = allSavedContinents.filter((c: Continent) => c.source === 'custom');
          if (savedCustomContinents.length > 0) {
            console.log(`📋 [加载存档] 恢复 ${savedCustomContinents.length} 个自定义大陆的游戏进度`);
            const savedCustomMap = new Map<string, Continent>();
            savedCustomContinents.forEach((c: Continent) => savedCustomMap.set(c.name, c));

            // 更新自定义大陆的游戏进度
            this.continents.value = this.continents.value.map(continent => {
              if (continent.source === 'custom') {
                const saved = savedCustomMap.get(continent.name);
                if (saved) {
                  return {
                    ...continent,
                    // 恢复游戏状态，但自定义大陆默认解锁
                    isUnlocked: saved.isUnlocked !== undefined ? saved.isUnlocked : true,
                    isConquered: saved.isConquered,
                    conquestProgress: saved.conquestProgress,
                    // 恢复区域状态，但自定义区域默认解锁
                    regions: continent.regions.map(region => {
                      const savedRegion = saved.regions.find(r => r.name === region.name);
                      if (savedRegion) {
                        return {
                          ...region,
                          isUnlocked: savedRegion.isUnlocked !== undefined ? savedRegion.isUnlocked : true,
                          isConquered: savedRegion.isConquered,
                          conquestProgress: savedRegion.conquestProgress,
                          isCapitalConquered: savedRegion.isCapitalConquered,
                          threatLevel: savedRegion.threatLevel,
                          locations: savedRegion.locations,
                        };
                      }
                      // 如果没有存档数据，默认解锁
                      return {
                        ...region,
                        isUnlocked: true,
                      };
                    }),
                  };
                } else {
                  // 如果没有存档数据，默认解锁
                  return {
                    ...continent,
                    isUnlocked: true,
                    regions: continent.regions.map(region => ({
                      ...region,
                      isUnlocked: true,
                    })),
                  };
                }
              }
              return continent;
            });
          }
        }

        // 修复已加载数据的前置关系（兼容旧存档）
        this.fixContinentUnlockConditions();

        console.log(
          `从数据库加载大陆数据成功，共 ${mergedData.length} 个大陆（默认: ${defaultData.length}, 自定义: ${customData.length}）`,
        );

        // 加载大陆探索状态
        if (data.continentExploreState) {
          this.exploreState.value = data.continentExploreState;
          console.log('从数据库加载大陆探索状态成功');
        }

        // 同步征服进度从探索状态到大陆数据
        this.syncProgressFromExploreState();

        // 验证并修复解锁状态（兼容旧存档）
        this.validateAndFixUnlockStatus();

        // 注意：不在这里重新计算，而是在app.vue加载存档完成后统一触发
        // 这样可以确保探索服务的据点数据已经加载完成
        console.log('✅ [加载存档] 大陆数据加载完成，等待统一重新计算征服进度');

        console.log('从数据库加载大陆探索数据成功');
      } else {
        console.log('未找到大陆探索数据，使用默认数据');
        // 如果没有存档数据，从CSV加载并合并自定义数据
        const defaultData = this.loadContinentDataFromCSV();
        const customData = this.loadCustomContinents();
        const mergedData = ContinentDataMerger.mergeContinents(defaultData, customData, [], {
          strategy: 'merge',
          allowOverride: true,
          preserveDefault: true,
        });
        this.continents.value = mergedData;
      }
    } catch (error) {
      console.error('加载大陆探索数据失败:', error);
      // 出错时也从CSV加载
      const defaultData = this.loadContinentDataFromCSV();
      const customData = this.loadCustomContinents();
      const mergedData = ContinentDataMerger.mergeContinents(defaultData, customData, [], {
        strategy: 'merge',
        allowOverride: true,
        preserveDefault: true,
      });
      this.continents.value = mergedData;
    }
  }

  // 数据迁移和兼容性处理
  private migrateExploreData(data: any): void {
    try {
      // 处理旧版本数据迁移
      if (data.continents && !Array.isArray(data.continents)) {
        console.warn('检测到旧版本大陆数据格式，正在迁移...');
        data.continents = [];
      }

      if (data.continentExploreState && typeof data.continentExploreState !== 'object') {
        console.warn('检测到旧版本大陆探索状态格式，正在迁移...');
        data.continentExploreState = {
          unlockedContinents: [],
          conqueredContinents: [],
          currentContinent: '',
          continentProgress: {},
          selectedContinent: '',
          selectedRegion: '',
        };
      }

      // 确保新字段存在（兼容旧存档）
      if (data.continentExploreState && typeof data.continentExploreState === 'object') {
        if (data.continentExploreState.selectedContinent === undefined) {
          data.continentExploreState.selectedContinent = '';
        }
        if (data.continentExploreState.selectedRegion === undefined) {
          data.continentExploreState.selectedRegion = '';
        }
      }

      // 确保大陆数据完整性
      if (data.continents && data.continents.length > 0) {
        data.continents.forEach((continent: any) => {
          // 确保必要字段存在
          if (!continent.regions) continent.regions = [];
          if (!continent.conquestProgress) continent.conquestProgress = 0;
          if (!continent.isUnlocked) continent.isUnlocked = false;
          if (!continent.isConquered) continent.isConquered = false;

          // 确保区域数据完整性
          continent.regions.forEach((region: any) => {
            if (!region.conquestProgress) region.conquestProgress = 0;
            if (!region.isUnlocked) region.isUnlocked = false;
            if (!region.isConquered) region.isConquered = false;
            if (!region.requiredStars) region.requiredStars = 0;
            if (!region.unlockStars) region.unlockStars = 0;
            if (!region.capital) region.capital = '';
            if (region.isCapitalConquered === undefined) region.isCapitalConquered = false;
            if (!region.threatLevel) region.threatLevel = 0;
            if (!region.locations) region.locations = [];
          });
        });
      }

      console.log('数据迁移和兼容性处理完成');
    } catch (error) {
      console.error('数据迁移失败:', error);
    }
  }

  // 保存探索数据
  public async saveExploreData(): Promise<void> {
    try {
      const currentData = (modularSaveManager.getModuleData({ moduleName: 'exploration' }) || {}) as any;

      // 数据验证
      const validatedContinents = this.validateContinentsData(this.continents.value);
      const validatedExploreState = this.validateExploreStateData(this.exploreState.value);

      // 获取并保存自定义大陆数据
      const customContinents = this.getCustomContinents();
      const customConfigVersion =
        customContinents.length > 0 ? currentData.customConfigVersion || '1.0.0' : currentData.customConfigVersion;

      modularSaveManager.updateModuleData({
        moduleName: 'exploration',
        data: {
          ...currentData,
          continents: validatedContinents,
          continentExploreState: validatedExploreState,
          // 保存自定义大陆数据（即使为空数组也要保存，以支持删除操作）
          customContinents,
          customConfigVersion,
        },
      });

      console.log('✅ 大陆探索数据已保存到数据库', {
        continents: validatedContinents.length,
        customContinents: customContinents.length,
        customConfigVersion,
      });
    } catch (error) {
      console.error('保存大陆探索数据失败:', error);
    }
  }

  // 验证大陆数据完整性
  private validateContinentsData(continents: any[]): any[] {
    return continents.map(continent => {
      // 确保必要字段存在
      return {
        ...continent,
        name: continent.name || '',
        description: continent.description || '',
        difficulty: continent.difficulty || 1,
        icon: continent.icon || '🌍',
        isUnlocked: Boolean(continent.isUnlocked),
        isConquered: Boolean(continent.isConquered),
        conquestProgress: Number(continent.conquestProgress) || 0,
        regions: continent.regions
          ? continent.regions.map((region: any) => ({
              ...region,
              name: region.name || '',
              continentName: region.continentName || continent.name,
              description: region.description || '',
              difficulty: region.difficulty || 1,
              icon: region.icon || '🏘️',
              isUnlocked: Boolean(region.isUnlocked),
              isConquered: Boolean(region.isConquered),
              conquestProgress: Number(region.conquestProgress) || 0,
              requiredStars: Number(region.requiredStars) || 0,
              unlockStars: Number(region.unlockStars) || 0,
              capital: region.capital || '',
              isCapitalConquered: Boolean(region.isCapitalConquered),
              threatLevel: Number(region.threatLevel) || 0,
              locations: region.locations || [],
            }))
          : [],
      };
    });
  }

  // 验证探索状态数据完整性
  private validateExploreStateData(exploreState: any): any {
    return {
      unlockedContinents: Array.isArray(exploreState.unlockedContinents) ? exploreState.unlockedContinents : [],
      conqueredContinents: Array.isArray(exploreState.conqueredContinents) ? exploreState.conqueredContinents : [],
      currentContinent: exploreState.currentContinent || '',
      continentProgress: exploreState.continentProgress || {},
      selectedContinent: exploreState.selectedContinent || '',
      selectedRegion: exploreState.selectedRegion || '',
    };
  }

  // ==================== 数据重置功能 ====================

  // 重置探索数据
  public resetExploreData(): void {
    try {
      // 重置大陆状态
      this.continents.value.forEach(continent => {
        continent.isUnlocked = continent.name === 'gular'; // 只有古拉尔大陆默认解锁
        continent.isConquered = false;
        continent.conquestProgress = 0;
        continent.regions.forEach(region => {
          region.isUnlocked = false;
          region.isConquered = false;
          region.conquestProgress = 0;
          region.isCapitalConquered = false;
          region.threatLevel = 0;
        });
      });

      // 重置探索状态
      this.exploreState.value = {
        unlockedContinents: ['gular'],
        conqueredContinents: [],
        currentContinent: 'gular',
        continentProgress: {},
        selectedContinent: '',
        selectedRegion: '',
      };

      console.log('大陆探索数据已重置');
      this.saveExploreData();
    } catch (error) {
      console.error('重置大陆探索数据失败:', error);
    }
  }

  // ==================== 自定义数据管理 API ====================

  /**
   * 获取自定义大陆列表
   * @returns 自定义大陆数组
   */
  public getCustomContinents(): Continent[] {
    const custom = this.continents.value.filter(c => c.source === 'custom');
    console.log(
      `🔍 [getCustomContinents] 当前大陆总数: ${this.continents.value.length}, 自定义大陆数: ${custom.length}`,
    );
    if (custom.length > 0) {
      console.log(`   📋 自定义大陆列表:`, custom.map(c => `${c.name}(${c.source})`).join(', '));
    }
    // 如果 merged 数据中没有找到 custom，尝试从原始数据中获取
    const allSources = this.continents.value.map(c => ({ name: c.name, source: c.source }));
    console.log(`   📋 所有大陆的 source:`, allSources);
    return custom;
  }

  /**
   * 获取默认大陆列表
   * @returns 默认大陆数组
   */
  public getDefaultContinents(): Continent[] {
    return this.continents.value.filter(c => c.source === 'default' || !c.source);
  }

  /**
   * 添加自定义大陆
   * @param continent 要添加的大陆数据
   * @returns 是否成功添加
   */
  public async addCustomContinent(continent: Continent): Promise<boolean> {
    try {
      // 验证并修复数据
      const validatedContinent = ContinentDataMerger.validateAndFixContinent(continent);
      if (!validatedContinent) {
        console.error('添加自定义大陆失败：数据验证失败', continent);
        return false;
      }

      // 检查是否已存在同名大陆
      const existingIndex = this.continents.value.findIndex(c => c.name === validatedContinent.name);
      if (existingIndex >= 0) {
        const existing = this.continents.value[existingIndex];
        // 如果已存在且是自定义数据，更新它
        if (existing.source === 'custom') {
          console.log(`更新已存在的自定义大陆: ${validatedContinent.name}`);
          this.continents.value[existingIndex] = {
            ...validatedContinent,
            source: 'custom',
            version: '1.0.0',
            // 自定义大陆默认解锁
            isUnlocked: true,
            metadata: {
              ...validatedContinent.metadata,
              createdAt: existing.metadata?.createdAt || Date.now(),
              modifiedAt: Date.now(),
            },
            regions: validatedContinent.regions.map(region => ({
              ...region,
              source: 'custom' as const,
              continentName: validatedContinent.name,
              // 自定义区域默认解锁
              isUnlocked: true,
              metadata: {
                ...region.metadata,
                createdAt: region.metadata?.createdAt || Date.now(),
                modifiedAt: Date.now(),
              },
            })),
          };
        } else {
          console.warn(`无法添加自定义大陆 "${validatedContinent.name}"：已存在同名默认大陆`);
          return false;
        }
      } else {
        // 添加新的大陆
        const customContinent: Continent = {
          ...validatedContinent,
          source: 'custom',
          version: '1.0.0',
          // 自定义大陆默认解锁
          isUnlocked: true,
          metadata: {
            createdAt: Date.now(),
            modifiedAt: Date.now(),
            ...validatedContinent.metadata,
          },
          regions: validatedContinent.regions.map(region => ({
            ...region,
            source: 'custom' as const,
            continentName: validatedContinent.name,
            // 自定义区域默认解锁
            isUnlocked: true,
            metadata: {
              createdAt: Date.now(),
              modifiedAt: Date.now(),
              ...region.metadata,
            },
          })),
        };

        this.continents.value.push(customContinent);
        console.log(`成功添加自定义大陆: ${validatedContinent.name}`);
        console.log(
          `🔍 [添加自定义大陆] 添加后验证: continents.value.length=${this.continents.value.length}, 最后一个大陆的 source=${this.continents.value[this.continents.value.length - 1].source}`,
        );
      }

      // 保存数据到内存
      // 注意：先保存自定义大陆，再保存探索数据，确保自定义大陆不会被覆盖
      // 但是 watch 监听器会在 continents.value 变化时自动触发 saveExploreData()
      // 所以我们需要先禁用 watch，手动保存，然后再启用 watch
      console.log(
        `🔍 [添加自定义大陆] 保存前验证: getCustomContinents() 返回`,
        this.getCustomContinents().length,
        '个大陆',
      );
      this.saveCustomContinents();
      this.saveExploreData();

      // 自定义大陆解锁后，从 images 索引注入传说人物和世界书模板
      const continentName = validatedContinent.name;
      try {
        const addedCount = await WorldbookService.populateContinentLegendary(continentName);
        console.log(`📖 [自定义大陆] "${continentName}"世界书注入完成: ${addedCount}人`);
      } catch (wbErr) {
        console.warn(`📖 [自定义大陆] "${continentName}"世界书注入失败:`, wbErr);
      }

      // 立即保存到数据库
      try {
        await modularSaveManager.saveCurrentGameData(0, '自动存档');
        console.log('✅ 自定义大陆数据已保存到数据库');
        console.log(
          '🔍 [添加自定义大陆] 保存后验证: getCustomContinents() 返回',
          this.getCustomContinents().length,
          '个大陆',
        );
      } catch (error) {
        console.error('保存自定义大陆到数据库失败:', error);
        // 不返回 false，因为内存数据已更新成功
      }

      // 验证并修复解锁状态（确保新添加的自定义大陆如果满足条件会立即解锁）
      this.validateAndFixUnlockStatus();

      return true;
    } catch (error) {
      console.error('添加自定义大陆失败:', error);
      return false;
    }
  }

  /**
   * 移除自定义大陆
   * @param continentName 要移除的大陆名称
   * @returns 是否成功移除
   */
  public async removeCustomContinent(continentName: string): Promise<boolean> {
    try {
      const index = this.continents.value.findIndex(c => c.name === continentName && c.source === 'custom');

      if (index < 0) {
        console.warn(`未找到自定义大陆: ${continentName}`);
        return false;
      }

      // 检查是否在使用中
      const continent = this.continents.value[index];
      if (continent.isConquered || continent.conquestProgress > 0) {
        console.warn(`无法移除自定义大陆 "${continentName}"：该大陆已有游戏进度`);
        return false;
      }

      // 从列表中移除
      this.continents.value.splice(index, 1);

      // 更新探索状态（如果该大陆在状态中）
      if (this.exploreState.value.currentContinent === continentName) {
        this.exploreState.value.currentContinent = '';
      }
      if (this.exploreState.value.unlockedContinents.includes(continentName)) {
        this.exploreState.value.unlockedContinents = this.exploreState.value.unlockedContinents.filter(
          c => c !== continentName,
        );
      }
      if (this.exploreState.value.conqueredContinents.includes(continentName)) {
        this.exploreState.value.conqueredContinents = this.exploreState.value.conqueredContinents.filter(
          c => c !== continentName,
        );
      }
      if (this.exploreState.value.continentProgress[continentName]) {
        delete this.exploreState.value.continentProgress[continentName];
      }

      console.log(`成功移除自定义大陆: ${continentName}`);

      // 保存数据到内存
      // 注意：先保存自定义大陆，再保存探索数据，确保自定义大陆不会被覆盖
      this.saveCustomContinents();
      this.saveExploreData();

      // 立即保存到数据库
      try {
        await modularSaveManager.saveCurrentGameData(0, '自动存档');
        console.log('✅ 自定义大陆删除已保存到数据库');
      } catch (error) {
        console.error('保存删除操作到数据库失败:', error);
        // 不返回 false，因为内存数据已更新成功
      }

      return true;
    } catch (error) {
      console.error('移除自定义大陆失败:', error);
      return false;
    }
  }

  /**
   * 更新自定义大陆
   * @param continentName 要更新的大陆名称
   * @param updates 要更新的字段
   * @returns 是否成功更新
   */
  public async updateCustomContinent(continentName: string, updates: Partial<Continent>): Promise<boolean> {
    try {
      const index = this.continents.value.findIndex(c => c.name === continentName && c.source === 'custom');

      if (index < 0) {
        console.warn(`未找到自定义大陆: ${continentName}`);
        return false;
      }

      // 更新大陆数据
      const continent = this.continents.value[index];
      const updatedContinent = {
        ...continent,
        ...updates,
        metadata: {
          ...continent.metadata,
          modifiedAt: Date.now(),
        },
      };

      // 验证并修复更新后的数据
      const validatedContinent = ContinentDataMerger.validateAndFixContinent(updatedContinent);
      if (!validatedContinent) {
        console.error('更新自定义大陆失败：数据验证失败');
        return false;
      }

      // 应用更新
      this.continents.value[index] = {
        ...validatedContinent,
        source: 'custom',
        version: continent.version || '1.0.0',
        // 自定义大陆默认解锁
        isUnlocked: true,
        metadata: {
          ...validatedContinent.metadata,
          createdAt: continent.metadata?.createdAt || Date.now(),
          modifiedAt: Date.now(),
        },
        // 确保所有区域也解锁
        regions: validatedContinent.regions.map(region => ({
          ...region,
          source: 'custom' as const,
          continentName: validatedContinent.name,
          // 自定义区域默认解锁
          isUnlocked: true,
          metadata: {
            ...region.metadata,
            createdAt: region.metadata?.createdAt || Date.now(),
            modifiedAt: Date.now(),
          },
        })),
      };

      console.log(`成功更新自定义大陆: ${continentName}`);

      // 保存数据到内存
      // 注意：先保存自定义大陆，再保存探索数据，确保自定义大陆不会被覆盖
      this.saveCustomContinents();
      this.saveExploreData();

      // 立即保存到数据库
      try {
        await modularSaveManager.saveCurrentGameData(0, '自动存档');
        console.log('✅ 自定义大陆更新已保存到数据库');
      } catch (error) {
        console.error('保存更新操作到数据库失败:', error);
        // 不返回 false，因为内存数据已更新成功
      }

      // 验证并修复解锁状态（确保更新后的自定义大陆如果满足条件会立即解锁）
      this.validateAndFixUnlockStatus();

      return true;
    } catch (error) {
      console.error('更新自定义大陆失败:', error);
      return false;
    }
  }

  /**
   * 加载自定义大陆数据
   */
  private loadCustomContinents(): Continent[] {
    try {
      const exploreData = modularSaveManager.getModuleData({ moduleName: 'exploration' });
      console.log('🔍 [加载自定义大陆] exploreData:', exploreData ? '存在' : '不存在');
      if (exploreData) {
        console.log('🔍 [加载自定义大陆] exploreData.keys:', Object.keys(exploreData));
        if ((exploreData as any).customContinents) {
          const customContinents = (exploreData as any).customContinents as Continent[];
          console.log(`✅ [加载自定义大陆] 加载了 ${customContinents.length} 个自定义大陆`);
          if (customContinents.length > 0) {
            console.log(`   📋 自定义大陆列表:`, customContinents.map(c => c.name).join(', '));
          }
          return customContinents;
        } else {
          console.log('⚠️ [加载自定义大陆] exploreData.customContinents 不存在');
        }
      }
      console.log('⚠️ [加载自定义大陆] 未找到自定义大陆数据，返回空数组');
      return [];
    } catch (error) {
      console.error('❌ [加载自定义大陆] 加载自定义大陆数据失败:', error);
      return [];
    }
  }

  /**
   * 保存自定义大陆数据
   */
  private saveCustomContinents(): void {
    try {
      const customContinents = this.getCustomContinents();
      const currentData = (modularSaveManager.getModuleData({ moduleName: 'exploration' }) || {}) as any;

      modularSaveManager.updateModuleData({
        moduleName: 'exploration',
        data: {
          ...currentData,
          customContinents,
          customConfigVersion: customContinents.length > 0 ? '1.0.0' : currentData.customConfigVersion,
        },
      });

      console.log(`✅ [保存自定义大陆] 保存了 ${customContinents.length} 个自定义大陆到存档`);
      if (customContinents.length > 0) {
        console.log(`   📋 自定义大陆列表:`, customContinents.map(c => c.name).join(', '));
        console.log(`   💾 保存后的数据:`, JSON.stringify(customContinents, null, 2).substring(0, 500));
      }
    } catch (error) {
      console.error('保存自定义大陆数据失败:', error);
    }
  }

  /**
   * 重新合并数据（在添加/移除自定义数据后调用）
   */
  public remergeContinents(): void {
    try {
      // 加载默认数据
      const defaultData = this.loadContinentDataFromCSV();

      // 加载自定义数据
      const customData = this.loadCustomContinents();

      // 加载存档数据（包含游戏进度）
      const savedData = this.continents.value;

      // 合并数据
      const mergedData = ContinentDataMerger.mergeContinents(defaultData, customData, savedData, {
        strategy: 'merge',
        allowOverride: true,
        preserveDefault: true,
      });

      // 更新大陆数据
      this.continents.value = mergedData;

      console.log('数据重新合并完成');
    } catch (error) {
      console.error('重新合并数据失败:', error);
    }
  }
}

// 创建全局大陆探索服务实例
export const continentExploreService = new ContinentExploreService();
