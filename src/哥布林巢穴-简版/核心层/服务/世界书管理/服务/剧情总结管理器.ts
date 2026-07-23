import type { Character } from '../../../../功能模块层/人物管理/类型/人物类型';
import { databaseService } from '../../存档系统/数据库服务';
import { modularSaveManager } from '../../存档系统/模块化存档服务';
import { WorldbookHelper } from '../工具/世界书助手';
import { ChainOfThoughtManager, ChainOfThoughtMode } from '../工具/思维链管理器';
import { TrainingRecordManager } from '../管理器/人物剧情/调教记录管理器';
import type { HistoryRecord, WorldbookEntry } from '../类型/世界书类型定义';

/**
 * 计算文本的粗略token数量（英文约1:1，中文约1:2）
 * 注：为了更接近实际情况，最终结果除以2.5进行调整
 */
function estimateTokens(text: string): number {
  // 简单估算：英文单词每个约1token，中文每个字符约2tokens
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const nonChineseChars = text.length - chineseChars;
  const rawEstimate = chineseChars * 2 + nonChineseChars * 0.5;
  // 除以2.1调整，更接近实际token消耗
  return Math.ceil(rawEstimate / 2.1);
}

/**
 * 获取保留的对话轮数（默认5轮，允许设置为0）
 */
function getRetainedDialogueRounds(): number {
  try {
    const globalVars = getVariables({ type: 'global' });
    const rounds = globalVars['summary_retained_dialogue_rounds'];
    // 允许设置为0（表示不保留任何对话）
    if (typeof rounds === 'number' && rounds >= 0) {
      return rounds;
    }
  } catch (error) {
    console.warn('读取保留对话轮数设置失败:', error);
  }
  return 5; // 默认5轮
}

/**
 * 从人物剧情记录中提取最近N轮对话（作为保留对话）
 * @param content 人物剧情记录内容
 * @param rounds 保留的对话轮数（每轮 = 用户输入 + AI回复 = 2条）
 * @returns 保留的对话内容（带training_history标签），如果没有对话则返回空字符串
 */
function extractRecentDialogues(content: string, rounds: number): string {
  // 如果保留轮数为0，直接返回空
  if (rounds === 0) {
    return '';
  }

  // 先移除所有summary标签，只解析原始数据
  const contentWithoutSummaries = WorldbookHelper.removeAllSummaries(content);

  // 从剩余内容中提取training_history标签（只从summary标签外的内容中提取）
  const trainingMatch = contentWithoutSummaries.match(/<training_history>([\s\S]*?)<\/training_history>/);
  if (!trainingMatch) {
    return '';
  }

  const trainingContent = trainingMatch[1];
  const lines = trainingContent.split('\n');

  // 解析所有对话记录（完整保留多行内容）
  const dialogueRecords: Array<{ fullContent: string; sender: string; index: number }> = [];
  let currentRecord: { fullContent: string; sender: string; index: number } | null = null;
  let recordIndex = 0;

  lines.forEach(line => {
    // 匹配格式：[任意时间格式] 发送者: 内容
    const recordMatch = line.match(/^\[(.+?)\] (.+?): (.*)$/);
    if (recordMatch) {
      // 如果有当前记录，先保存它
      if (currentRecord) {
        dialogueRecords.push(currentRecord);
      }

      // 创建新记录
      const [, , sender] = recordMatch;
      recordIndex++;
      currentRecord = {
        fullContent: line.trim(),
        sender: sender === '{{user}}' ? 'user' : sender,
        index: recordIndex,
      };
    } else if (currentRecord && line.trim()) {
      // 追加内容到当前记录（AI回复的多行内容）
      currentRecord.fullContent += '\n' + line.trim();
    }
  });

  // 保存最后一条记录
  if (currentRecord) {
    dialogueRecords.push(currentRecord);
  }

  if (dialogueRecords.length === 0) {
    return '';
  }

  // 计算需要保留的对话数量（每轮 = 用户输入 + AI回复 = 2条）
  const retainedCount = Math.min(rounds * 2, dialogueRecords.length);

  // 如果保留轮数为0，不保留任何对话
  if (retainedCount === 0 || rounds === 0) {
    return '';
  }

  // 保留最近N轮对话（从后往前取）
  const retainedRecords = dialogueRecords.slice(-retainedCount);

  // 构建保留的对话内容
  if (retainedRecords.length > 0) {
    return `<training_history>\n${retainedRecords.map(r => r.fullContent).join('\n')}\n</training_history>`;
  }

  return '';
}

/**
 * 从人物剧情记录中移除最近N轮对话（总结时使用）
 * @param content 人物剧情记录内容
 * @param rounds 要移除的对话轮数
 * @returns 移除保留对话后的内容
 */
function removeRecentDialogues(content: string, rounds: number): string {
  // 先移除所有summary标签，只处理原始数据
  const existingSummaries = WorldbookHelper.extractAndDeduplicateSummaries(content);
  const summaryContent = WorldbookHelper.combineSummaries(existingSummaries);
  const contentWithoutSummaries = WorldbookHelper.removeAllSummaries(content);

  // 从剩余内容中提取training_history标签
  const trainingMatch = contentWithoutSummaries.match(/<training_history>([\s\S]*?)<\/training_history>/);
  if (!trainingMatch) {
    // 如果没有training_history标签，直接返回原内容（包含summary）
    return summaryContent ? `${summaryContent}\n\n${contentWithoutSummaries}`.trim() : contentWithoutSummaries;
  }

  const trainingContent = trainingMatch[1];
  const lines = trainingContent.split('\n');

  // 解析所有对话记录（完整保留多行内容，类似 parseTrainingHistory 的逻辑）
  const dialogueRecords: Array<{ fullContent: string; sender: string; index: number }> = [];
  let currentRecord: { fullContent: string; sender: string; index: number } | null = null;
  let recordIndex = 0;

  lines.forEach(line => {
    // 匹配格式：[任意时间格式] 发送者: 内容
    const recordMatch = line.match(/^\[(.+?)\] (.+?): (.*)$/);
    if (recordMatch) {
      // 如果有当前记录，先保存它
      if (currentRecord) {
        dialogueRecords.push(currentRecord);
      }

      // 创建新记录
      const [, , sender] = recordMatch;
      recordIndex++;
      currentRecord = {
        fullContent: line.trim(),
        sender: sender === '{{user}}' ? 'user' : sender,
        index: recordIndex,
      };
    } else if (currentRecord && line.trim()) {
      // 追加内容到当前记录（AI回复的多行内容）
      currentRecord.fullContent += '\n' + line.trim();
    }
  });

  // 保存最后一条记录
  if (currentRecord) {
    dialogueRecords.push(currentRecord);
  }

  if (dialogueRecords.length === 0) {
    // 没有对话记录，返回原内容（包含summary）
    return summaryContent ? `${summaryContent}\n\n${contentWithoutSummaries}`.trim() : contentWithoutSummaries;
  }

  // 计算需要移除的对话数量（每轮 = 用户输入 + AI回复 = 2条）
  const retainedCount = Math.min(rounds * 2, dialogueRecords.length);
  // 如果 retainedCount = 0，则保留所有对话用于总结；否则排除最后 retainedCount 条
  const recordsToSummarize = retainedCount === 0 ? dialogueRecords : dialogueRecords.slice(0, -retainedCount);

  // 构建需要总结的内容（移除保留的对话）
  let contentToSummarize = contentWithoutSummaries;
  // 无论 retainedCount 是多少，都需要替换 training_history 标签
  // 如果 retainedCount = 0，说明不保留任何对话，所有对话都要用来总结
  // 如果 retainedCount > 0，则保留最近N轮对话，其余用来总结
  const originalTrainingSection = `<training_history>${trainingMatch[1]}</training_history>`;
  const trainingToSummarize =
    recordsToSummarize.length > 0
      ? `<training_history>\n${recordsToSummarize.map(r => r.fullContent).join('\n')}\n</training_history>`
      : '';
  contentToSummarize = contentWithoutSummaries.replace(originalTrainingSection, trainingToSummarize);

  // 如果有summary标签，重新添加到内容前面
  if (summaryContent) {
    contentToSummarize = `${summaryContent}\n\n${contentToSummarize}`.trim();
  }

  console.log(
    `💬 对话分离: 总对话 ${dialogueRecords.length} 条，保留最近 ${retainedCount} 条（${rounds}轮），总结 ${recordsToSummarize.length} 条${existingSummaries.length > 0 ? `，保留${existingSummaries.length}个已有summary` : ''}`,
  );

  return contentToSummarize.trim();
}

/**
 * 剧情总结管理器 - 负责总结和压缩世界书内容
 */
export class StorySummaryManager {
  /**
   * 获取所有世界书列表
   */
  static async getAllWorldbooks(): Promise<string[]> {
    try {
      // 获取世界书助手提供的所有世界书
      // 这里需要通过TavernHelper接口获取世界书列表
      const defaultWorldbooks = ['哥布林巢穴-人物档案', '哥布林巢穴-资源状态'];
      return defaultWorldbooks;
    } catch (error) {
      console.error('获取世界书列表失败:', error);
      return [];
    }
  }

  /**
   * 获取指定世界书的所有条目
   */
  static async getWorldbookEntries(worldbookName: string): Promise<WorldbookEntry[]> {
    try {
      await WorldbookHelper.ensureExists(worldbookName);
      const worldbook = await WorldbookHelper.get(worldbookName);
      return worldbook;
    } catch (error) {
      console.error(`获取世界书 ${worldbookName} 的条目失败:`, error);
      return [];
    }
  }

  /**
   * 计算条目的token数量
   */
  static calculateEntryTokens(entry: WorldbookEntry): number {
    const content = entry.content || '';
    return estimateTokens(content);
  }

  /**
   * 根据类型过滤世界书条目
   */
  static filterEntriesByType(entries: WorldbookEntry[], types: string[]): WorldbookEntry[] {
    return entries.filter(entry => types.includes(entry.extra?.entry_type || ''));
  }

  /**
   * 使用AI总结世界书条目内容
   * @param entry 要总结的条目
   * @param incremental 是否为增量总结（已有summary）
   * @returns 总结内容和保留的对话（仅人物剧情记录）
   */
  static async summarizeEntry(
    entry: WorldbookEntry,
    incremental: boolean = false,
  ): Promise<{ summary: string; retainedDialogues?: string }> {
    try {
      let content = entry.content || '';
      const entryType = entry.extra?.entry_type || '未知类型';
      const entryName = entry.name || '未知条目';
      let retainedDialogues = ''; // 保留的最近N轮对话

      // 如果是人物剧情记录，提取最近N轮对话作为保留
      if (entryType === 'character_story_history') {
        const rounds = getRetainedDialogueRounds();
        console.log(`🔍 获取保留对话轮数: ${rounds} 轮`);

        // 如果保留轮数为0，不提取也不移除
        if (rounds === 0) {
          console.log(`ℹ️ 保留轮数设置为0，不保留任何对话，所有对话用于总结`);
          retainedDialogues = ''; // 明确设置为空
        } else {
          retainedDialogues = extractRecentDialogues(content, rounds);
          if (retainedDialogues) {
            // 从发送给AI的内容中移除保留的对话
            content = removeRecentDialogues(content, rounds);
            console.log(
              `💬 保留最近 ${rounds} 轮对话，共 ${retainedDialogues.split('\n').filter(l => l.trim()).length - 2} 条记录`,
            );
            console.log(`📄 移除保留对话后的内容长度: ${content.length}, 预览: ${content.substring(0, 200)}...`);
          } else {
            // 即使没有提取到保留对话，也需要移除（可能所有对话都被总结了）
            console.log(`ℹ️ 未提取到保留对话，但保留轮数设置为 ${rounds}，尝试移除对话`);
            content = removeRecentDialogues(content, rounds);
          }
        }
      }

      // 如果是增量总结，提取旧summary作为上下文，但标注只总结新数据
      let contextualSummary = '';
      if (incremental && /<summary_\d+>/.test(content)) {
        // 提取所有旧的summary作为上下文，用空行分隔（仅支持新格式<summary_N>，自动去重）
        const existingSummaries = WorldbookHelper.extractAndDeduplicateSummaries(content);
        for (const summary of existingSummaries) {
          contextualSummary += summary.innerContent + '\n\n';
        }

        // 提取新数据部分（移除所有summary_N标签）
        content = WorldbookHelper.removeAllSummaries(content);
        console.log(`📝 增量总结: ${entryName} (提取新数据部分，已保留${existingSummaries.length}个旧总结作为上下文)`);
        console.log(`📄 移除summary后的内容长度: ${content.length}, 内容预览: ${content.substring(0, 300)}...`);

        // 检查内容是否为空或只包含空白字符
        const trimmedContent = content.trim();
        if (!trimmedContent || trimmedContent.length === 0) {
          console.error(`❌ 提取新数据后内容为空，原始内容长度: ${entry.content?.length || 0}`);
          throw new Error('没有可总结的新数据（移除summary和保留对话后内容为空）');
        }
      }

      // 构建AI提示词
      let basePrompt = '';
      switch (entryType) {
        case 'conquest_records':
          basePrompt = this.buildConquestSummaryPrompt(content);
          break;
        case 'game_event_story':
          basePrompt = this.buildEventSummaryPrompt(content);
          break;
        case 'character_story_history':
          basePrompt = this.buildCharacterStorySummaryPrompt(content);
          break;
        default:
          basePrompt = this.buildGenericSummaryPrompt(content);
      }

      // 如果是增量总结，在提示词前添加上下文说明
      let prompt = basePrompt;
      if (incremental && contextualSummary) {
        prompt = `以下是对这位角色/这条目的历史总结，仅供你了解背景，不需要总结：

${contextualSummary}

---

现在请只总结以下新增的内容（不要重复总结历史，但要保持剧情连贯性）：

${basePrompt}`;
      }

      console.log(`🤖 发送AI请求: 总结${entryName}...`);

      // 读取流式传输设置
      const globalVars = getVariables({ type: 'global' });
      const enableStreamOutput =
        typeof globalVars['enable_stream_output'] === 'boolean' ? globalVars['enable_stream_output'] : false; // 默认关闭

      // 直接调用AI生成总结（包含所有历史记录作为上下文）
      const aiResponse = await window.TavernHelper.generate({
        user_input: prompt,
        should_stream: enableStreamOutput,
       
      });

      // 检查AI回复是否为空或无效
      if (!aiResponse || aiResponse.trim().length === 0) {
        console.warn(`⚠️ AI回复为空: ${entryName}`);
        throw new Error('AI回复为空');
      }

      // 先检查是否有实际的 <summaryhistory> 标签（在应用酒馆正则之前）
      // 从最后一个结尾标签往前匹配，匹配到最初的开始标签，这样可以避免匹配到思维链中提到的标签字符串
      let formattedResponse: string;

      // 找到最后一个 </summaryhistory> 标签的位置
      const lastEndTagIndex = aiResponse.lastIndexOf('</summaryhistory>');
      const hasEndTag = lastEndTagIndex !== -1;

      if (hasEndTag) {
        // 从最后一个结束标签往前搜索第一个 <summaryhistory> 开始标签
        const beforeEndTag = aiResponse.substring(0, lastEndTagIndex);
        const lastStartTagIndex = beforeEndTag.lastIndexOf('<summaryhistory>');

        if (lastStartTagIndex !== -1) {
          // 找到完整的标签对，提取标签内的内容
          const startContentIndex = lastStartTagIndex + '<summaryhistory>'.length;
          const endContentIndex = lastEndTagIndex;
          formattedResponse = aiResponse.substring(startContentIndex, endContentIndex).trim();

          console.log('📦 从最后一个结束标签往前匹配到开始标签，已提取标签内的内容，已移除标签前的所有思维链内容');

          // 清理可能残留的开始和结束标签（如果有嵌套的情况）
          formattedResponse = formattedResponse.replace(/<summaryhistory>/gi, '').trim();
          formattedResponse = formattedResponse.replace(/<\/summaryhistory>/gi, '').trim();
        } else {
          // 有结束标签但没有开始标签，这种情况不应该发生，回退到正常处理
          console.log('⚠️ 检测到结束标签但没有开始标签，应用酒馆正则处理');
          formattedResponse = formatAsTavernRegexedString(aiResponse, 'ai_output', 'display');
        }
      } else {
        // 没有结束标签，检查是否有开始标签且后面有总结格式的内容
        const startTagMatch = aiResponse.match(/<summaryhistory>/i);
        if (startTagMatch) {
          const startIndex = startTagMatch.index! + '<summaryhistory>'.length;
          const contentAfterTag = aiResponse.substring(startIndex, startIndex + 200); // 检查标签后200字符
          // 检查是否有总结格式：数字开头或序号格式（1:、2: 等）
          const hasSummaryFormat = /^\s*\d+[:：]|^\s*\d+\.|^\s*[-*]\s*\d+/m.test(contentAfterTag);
          if (hasSummaryFormat) {
            // 确认是真正的标签（后面有总结内容），提取之后的所有内容
            formattedResponse = aiResponse.substring(startIndex).trim();
            console.log(
              '📦 检测到开始标签（无结束标签，但确认是标签），已提取标签后的内容，已移除标签前的所有思维链内容',
            );
            // 清理可能残留的开始标签
            formattedResponse = formattedResponse.replace(/<summaryhistory>/gi, '').trim();
            formattedResponse = formattedResponse.replace(/<\/summaryhistory>/gi, '').trim();
          } else {
            // 开始标签后面没有总结格式，可能是思维链中的提及，正常处理
            console.log('ℹ️ 检测到开始标签但后面无总结格式内容，可能是思维链提及，应用酒馆正则处理');
            formattedResponse = formatAsTavernRegexedString(aiResponse, 'ai_output', 'display');
          }
        } else {
          // 完全没有标签，正常应用酒馆正则处理
          console.log('ℹ️ 未检测到 <summaryhistory> 标签，应用酒馆正则处理');
          formattedResponse = formatAsTavernRegexedString(aiResponse, 'ai_output', 'display');
        }
      }

      console.log(`✅ AI总结完成: ${formattedResponse.substring(0, 100)}...`);

      // 返回总结内容和保留的对话
      return {
        summary: formattedResponse,
        retainedDialogues: retainedDialogues || undefined,
      };
    } catch (error) {
      console.error('AI总结失败:', error);
      // 总结失败时抛出错误，让上层处理
      throw error;
    }
  }

  /**
   * 构建据点征服总结提示词
   */
  private static buildConquestSummaryPrompt(content: string): string {
    return `以下是哥布林巢穴的外扩张据点征服记录。请将这些零散的征服记录整合成连贯的征服历史总结。

## 原文内容：
${content}

## 输出要求：

### 1. **总结目标**
- 按时间顺序和地理区域，将零散的据点征服记录整合成总结性的描述
- **突出重要据点**（规模大、难度高的据点）
- **重点提及俘获的人物**（如俘获的公主、女骑士、冒险者等）
- 展现征服的趋势和规模扩张

### 2. **内容要求**
- **客观、中立的叙述风格**，类似历史记录
- 保留关键的**据点名称、位置、类型**
- 强调**俘获的重要人物及其背景**
- 体现征服的**地理分布和战略意义**
- 简洁但要包含核心信息

### 3. **输出格式**
使用'summaryhistory'xml标签包裹总结内容，以时间为主干的编年体，直接输出总结性的段落描述

### 4. **关键要求**
- **用连贯的段落形式**描述征服历史
- **突出俘获的重要人物及其据点信息**
- **按时间顺序梳理征服活动**
- **体现地理分布和征服规模**
- **仅输出总结内容，禁止输出任何分析过程或额外评论**

现在开始处理，直接输出总结：`;
  }

  /**
   * 构建冒头事件总结提示词
   */
  private static buildEventSummaryPrompt(content: string): string {
    return `以下是哥布林巢穴遭遇的各种随机事件记录。请将这些零散的事件段落整合成连贯的叙事性总结。

## 原文内容：
${content}

## 输出要求：

### 1. **叙述风格**
采用**第三人称叙述者视角**，语言要：
- **中立客观**，类似新闻报道或历史记录
- **生动真实**，符合奇幻冒险色情游戏的风格

### 2. **总结目标**
- 将零散的事件整合成**连贯的叙事段落**
- 展现事件之间的**时间脉络和因果关联**
- 突出事件的**重要性和世界影响**
- 保留关键的细节

### 3. **内容要求**
- 从**全局视角**描述事件对世界的影响
- 体现事件对各**势力、种族、地区**的影响
- 展现事件引发的**连锁反应和后果**
- 语言要**庄重史诗**，符合重要历史事件的感觉

### 4. **输出格式**
使用'summaryhistory'xml标签包裹总结内容，章节体，直接输出叙事性的段落描述

### 5. **关键要求**
- 风格类似编年史
- **保持叙述的连贯性和流畅性**
- **体现事件的世界性影响和重要性**
- **展现多方势力的反应和互动**
- **字数控制在400-800字，根据事件多少调整**
- **仅输出叙事性描述，禁止输出任何分析过程或额外评论**
- 每次总结只总结为一章最新章节，不加入序号，只列标题

现在开始处理，直接输出总结：`;
  }

  /**
   * 构建人物剧情总结提示词（调教记录）
   */
  private static buildCharacterStorySummaryPrompt(content: string): string {
    return `以下是哥布林巢穴中一位角色的详细互动记录，包含调教、对话、战斗等所有历史信息。
请仔细分析并**结构化提取核心事件**，生成包含**至少10个事件**的详细剧情总结。

## 原文内容：
${content}

## 输出要求：

### 1. **事件解析**
- 按时间顺序，将原文精细分解成**10个及以上**独立事件单元
- 追求**最小事件粒度**，每个事件明确一个核心动作或变化
- 事件范围包括：调教过程、对话交流、战斗、关系变化、重要决策等

### 2. **上下文提取（基于原文证据）**
为每个事件提取以下信息（仅当原文有明确证据时）：
- **时间 (Time)：** 绝对时间点或相对时间点
- **地点 (Location)：** 明确的物理地点
- **核心人物 (Characters)：** 直接参与的关键人物
- **人物关系 (Relationships)：** 对理解该事件至关重要的关系

### 3. **事件描述要求**
- **客观、中立、完整、详细**地概括事件核心
- 保留关键对话内容的具体表述
- 清晰传达事件的实质，避免过度简化
- 必须体现**剧情细节和互动过程**

### 4. **输出格式**
使用'summaryhistory'xml标签包裹总结所有总结内容，每行格式：序号: [上下文标签] 事件详尽描述

**上下文标签格式：**
- 完整版：\`(时间: X | 地点: Y | 人物: A,B | 关系: C(D))\`
- 简化版：\`(X | Y | A,B)\`
- 若无信息则省略对应项

**示例：**
1: (地点: 调教室 | 人物: 艾莉丝) 艾莉丝最初反抗激烈，拒绝服从，体力消耗殆尽但仍坚持立场
2: (地点: 调教室 | 人物: 艾莉丝) 经过反复调教，艾莉丝开始出现屈服迹象，但内心仍抗拒
3: (地点: 调教室 | 人物: 艾莉丝 | 关系: 调教者与被调教者) 调教过程中提到她的过去，她曾是某个王国的公主，对哥布林有仇恨
...

### 5. **关键要求**
- **输出至少10个事件，尽量详尽**
- **保留核心剧情细节和关键对话**
- **体现角色关系、性格、立场的变化轨迹**
- **包含重要背景信息和世界观设定**
- **仅输出格式化的行，禁止输出任何分析过程或额外评论**

现在开始处理，直接输出格式化的结果：`;
  }

  /**
   * 构建通用总结提示词
   */
  private static buildGenericSummaryPrompt(content: string): string {
    return `请帮我总结以下内容，提取关键信息，生成简洁但保留重要细节的总结：

${content}

请用中文回复，保留重要的关键信息。使用'summaryhistory'xml标签包裹总结内容，直接输出总结`;
  }

  /**
   * 生成总结内容（不更新世界书）
   * @param worldbookName 世界书名称
   * @param entryType 要总结的条目类型（单选，不支持多选）
   * @param characterIds 人物ID列表（仅对character_story_history生效，单选）
   * @param toastRef 弹窗引用
   * @returns 总结结果：单个条目的总结内容和元数据
   */
  static async generateSummaries(
    worldbookName: string,
    entryType: string,
    characterIds?: string[],
    toastRef?: any,
  ): Promise<
    Map<
      number,
      { summary: string; incremental: boolean; entryName: string; entryType: string; retainedDialogues?: string }
    >
  > {
    const result = new Map<
      number,
      { summary: string; incremental: boolean; entryName: string; entryType: string; retainedDialogues?: string }
    >();
    try {
      console.log('📚 开始压缩世界书:', { worldbookName, entryType, characterIds });

      const entries = await this.getWorldbookEntries(worldbookName);
      console.log(`📊 世界书包含 ${entries.length} 个条目`);

      // 打印所有条目的类型信息用于调试
      const entryTypeStats: Record<string, number> = {};
      entries.forEach(entry => {
        const type = entry.extra?.entry_type || 'unknown';
        entryTypeStats[type] = (entryTypeStats[type] || 0) + 1;
      });
      console.log('📋 条目类型统计:', entryTypeStats);

      // 过滤条目（只过滤单个类型）
      let filteredEntries: WorldbookEntry[] = entryType ? this.filterEntriesByType(entries, [entryType]) : entries;

      // 分析哪些条目需要总结
      const beforeSummaryFilter = filteredEntries.length;
      const entriesWithNewData: WorldbookEntry[] = []; // 已有summary但有新数据的条目
      const entriesNeedingSummary: WorldbookEntry[] = []; // 完全没有summary的条目

      filteredEntries.forEach(entry => {
        // 检查是否有summary（仅支持新格式<summary_N>）
        const summaries = WorldbookHelper.extractAndDeduplicateSummaries(entry.content || '');
        const hasSummary = summaries.length > 0;

        if (hasSummary) {
          // 检查是否有原始数据（所有summary之外的内容）
          const contentAfterSummaries = WorldbookHelper.removeAllSummaries(entry.content || '');

          if (contentAfterSummaries.length > 0) {
            // 已有summary但有新数据，需要增量总结
            entriesWithNewData.push(entry);
          }
          // 如果只有summary没有新数据，跳过
        } else {
          // 完全没有summary，需要首次总结
          entriesNeedingSummary.push(entry);
        }
      });

      console.log(
        `📊 条目分析: ${entriesNeedingSummary.length} 个需要首次总结, ${entriesWithNewData.length} 个需要增量总结`,
      );

      // 合并需要总结的条目
      filteredEntries = [...entriesNeedingSummary, ...entriesWithNewData];

      if (beforeSummaryFilter > filteredEntries.length) {
        console.log(`⚠️ 跳过 ${beforeSummaryFilter - filteredEntries.length} 个已有完整总结的条目`);
      }

      console.log(`🔍 过滤后剩余 ${filteredEntries.length} 个条目`);

      // 如果指定了角色ID，进一步过滤（仅对character_story_history类型的条目）
      if (characterIds && characterIds.length > 0) {
        const beforeFilter = filteredEntries.length;
        filteredEntries = filteredEntries.filter(entry => {
          // 如果是人物剧情记录，需要匹配character_id
          if (entry.extra?.entry_type === 'character_story_history') {
            return characterIds.includes(entry.extra?.character_id || '');
          }
          // 其他类型的条目不进行人物过滤，直接保留
          return true;
        });
        console.log(
          `👤 按人物过滤后剩余 ${filteredEntries.length} 个条目 (${beforeFilter} -> ${filteredEntries.length})`,
        );
      }

      if (filteredEntries.length === 0) {
        console.warn('⚠️ 没有找到符合条件的条目');
        if (toastRef) {
          // 检查是否有已总结的条目被跳过
          const totalEntries = entryType ? this.filterEntriesByType(entries, [entryType]) : entries;
          const summarizedCount = totalEntries.filter(
            e => WorldbookHelper.extractAndDeduplicateSummaries(e.content || '').length > 0,
          ).length;

          if (summarizedCount > 0) {
            toastRef.warning(`所有符合条件的条目都已被总结过了（共${summarizedCount}个）`);
          } else {
            toastRef.warning('没有找到符合条件的条目');
          }
        }
        return result;
      }

      console.log('📝 开始生成摘要...');

      // 生成总结前，先禁用相关条目避免重复信息（不包括思维链，思维链会切换到总结模式）
      console.log(`🔒 生成总结前，禁用 ${filteredEntries.length} 个相关条目以避免重复信息...`);
      const worldbook = await this.getWorldbookEntries(worldbookName);
      const entryUidsToDisable = new Set(filteredEntries.map(e => e.uid));
      let disabledCount = 0;

      for (let i = 0; i < worldbook.length; i++) {
        const entry = worldbook[i];
        // 禁用需要总结的条目（不包括思维链）
        if (entryUidsToDisable.has(entry.uid)) {
          // 保存原始启用状态，以便取消时恢复
          if (!entry.extra) {
            entry.extra = {};
          }
          entry.extra._original_enabled = entry.enabled ?? true;
          entry.enabled = false;
          disabledCount++;
        }
      }

      if (disabledCount > 0) {
        await WorldbookHelper.replace(worldbookName, worldbook);
        console.log(`✅ 已禁用 ${disabledCount} 个条目`);
      }

      // 只处理第一个符合条件的条目（放弃批量总结方式）
      if (filteredEntries.length > 1) {
        console.warn(`⚠️ 发现 ${filteredEntries.length} 个符合条件的条目，但只处理第一个`);
        if (toastRef) {
          toastRef.warning(`发现 ${filteredEntries.length} 个符合条件的条目，但只处理第一个`);
        }
      }

      const entry = filteredEntries[0];
      const currentEntryType = entry.extra?.entry_type || '未知类型';
      const entryName = entry.name || '未知条目';

      // 判断是否为增量总结（检查是否有新格式的summary_N，自动去重）
      const existingSummaries = WorldbookHelper.extractAndDeduplicateSummaries(entry.content || '');
      const hasSummary = existingSummaries.length > 0;

      console.log(`📄 处理条目: ${entryName}, 类型: ${currentEntryType}, UID: ${entry.uid}, 增量: ${hasSummary}`);

      // 切换到总结模式的思维链
      await ChainOfThoughtManager.addChainToWorldbook(worldbookName, ChainOfThoughtMode.STORY_SUMMARY);
      console.log('🔄 已切换到剧情总结思维链模式');

      // 为单个条目生成总结（使用AI）
      // 注意：不在这里保存调教记录，而是在确认总结时再保存（确保使用正确的存档ID）
      try {
        const { summary, retainedDialogues } = await this.summarizeEntry(entry, hasSummary);
        console.log(`✅ 生成摘要: ${summary.substring(0, 100)}...`);

        result.set(entry.uid, {
          summary,
          incremental: hasSummary,
          entryName,
          entryType: currentEntryType,
          retainedDialogues,
        });

        console.log(`总结生成完成，共生成 ${result.size} 个条目的总结`);
      } catch (error) {
        console.error(`❌ 总结失败: ${entryName}`, error);
        // 总结失败时不添加到result，这样就不会覆盖原内容
        console.warn(`⚠️ ${entryName} 总结失败，保持原内容不变`);
        if (toastRef) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          toastRef.error(`总结失败：${errorMessage}`);
        }
      }

      return result;
    } catch (error) {
      console.error('总结生成失败:', error);
      // 不在这里显示 toast，让调用方处理用户提示
      throw error;
    }
  }

  /**
   * 合并调教记录并去重
   * @param existingRecords 数据库中已有的记录
   * @param newRecords 世界书中解析的新记录
   * @returns 合并去重后的记录数组，按时间戳排序
   */
  private static mergeTrainingRecords(existingRecords: HistoryRecord[], newRecords: HistoryRecord[]): HistoryRecord[] {
    // 使用Map去重，key为：gameTime + sender + content的前100个字符（避免完全重复）
    const recordMap = new Map<string, HistoryRecord>();

    // 先添加已有记录
    existingRecords.forEach(record => {
      const key = `${record.gameTime}|${record.sender || ''}|${record.content.substring(0, 100)}`;
      if (!recordMap.has(key)) {
        recordMap.set(key, record);
      }
    });

    // 再添加新记录（如果不存在）
    let addedCount = 0;
    newRecords.forEach(record => {
      const key = `${record.gameTime}|${record.sender || ''}|${record.content.substring(0, 100)}`;
      if (!recordMap.has(key)) {
        recordMap.set(key, record);
        addedCount++;
      }
    });

    // 转换为数组并按时间戳排序
    const merged = Array.from(recordMap.values());
    merged.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    return merged;
  }

  /**
   * 总结前，先保存所有需要总结的调教记录到数据库
   */
  private static async saveTrainingHistoryBeforeSummary(entries: WorldbookEntry[]): Promise<void> {
    try {
      const currentSaveId = databaseService.getCurrentSaveId();
      if (!currentSaveId) {
        console.log('ℹ️ 没有当前存档ID，跳过保存调教记录到数据库');
        return;
      }

      console.log(`💾 [确认总结] 保存调教记录到数据库，当前存档ID: ${currentSaveId}`);

      // 筛选出character_story_history类型的条目
      const characterHistoryEntries = entries.filter(entry => entry.extra?.entry_type === 'character_story_history');

      if (characterHistoryEntries.length === 0) {
        console.log('ℹ️ 没有需要保存的调教记录');
        return;
      }

      console.log(`💾 总结前保存 ${characterHistoryEntries.length} 个角色的调教记录到数据库...`);

      // 获取数据库中已有的所有数据（包括所有暂存数据）
      const existingDbData = await databaseService.loadTrainingHistoryData(currentSaveId);
      const allTrainingHistory: Record<string, HistoryRecord[]> = existingDbData || {};
      const existingPendingPairs: Record<string, { userInput: string; aiResponse: string } | null> = {};
      const existingPendingAttrs: Record<string, { loyalty: number; stamina: number; character: any } | null> = {};
      const existingOriginalChars: Record<string, any | null> = {};

      if (existingDbData?.pendingDialoguePairs) {
        Object.assign(existingPendingPairs, existingDbData.pendingDialoguePairs);
      }
      if (existingDbData?.pendingAttributeChanges) {
        Object.assign(existingPendingAttrs, existingDbData.pendingAttributeChanges);
      }
      if (existingDbData?.originalCharacters) {
        Object.assign(existingOriginalChars, existingDbData.originalCharacters);
      }

      // 为每个角色保存调教记录（合并去重，避免重复保存）
      for (const entry of characterHistoryEntries) {
        const characterId = entry.extra?.character_id || '';
        const characterName = entry.extra?.character_name || entry.name || '未知人物';

        if (!characterId) {
          console.warn(`⚠️ 跳过没有character_id的条目: ${entry.name}`);
          continue;
        }

        // 从世界书中解析调教记录（包括保留的对话）
        const worldbookRecords = TrainingRecordManager.parseTrainingHistory(entry.content || '');

        // 获取数据库中已有的记录
        const existingRecords = allTrainingHistory[characterName] || [];

        if (worldbookRecords.length > 0 || existingRecords.length > 0) {
          // 合并去重：数据库已有记录 + 世界书记录
          const mergedRecords = this.mergeTrainingRecords(existingRecords, worldbookRecords);
          allTrainingHistory[characterName] = mergedRecords;

          const addedCount = mergedRecords.length - existingRecords.length;
          const duplicatedCount = worldbookRecords.length - addedCount;
          console.log(
            `✅ 已合并保存 ${characterName} 的调教记录：数据库原有 ${existingRecords.length} 条，世界书新增 ${worldbookRecords.length} 条，去重后新增 ${addedCount} 条，重复 ${duplicatedCount} 条，总计 ${mergedRecords.length} 条`,
          );

          // 如果有暂存的对话对，也包含在内（但不清除，保持暂存状态）
          if (existingPendingPairs[characterName]) {
            console.log(`ℹ️ ${characterName} 有暂存的对话对，将一并保存`);
          }
        } else {
          console.log(`ℹ️ ${characterName} 没有调教记录或已被总结压缩`);
        }
      }

      // 保存回数据库（包括所有暂存数据）
      if (
        Object.keys(allTrainingHistory).length > 0 ||
        Object.keys(existingPendingPairs).length > 0 ||
        Object.keys(existingPendingAttrs).length > 0 ||
        Object.keys(existingOriginalChars).length > 0
      ) {
        await databaseService.saveTrainingHistoryData(
          currentSaveId,
          allTrainingHistory,
          existingPendingPairs,
          existingPendingAttrs,
          existingOriginalChars,
        );
        const pendingPairCount = Object.values(existingPendingPairs).filter(v => v !== null).length;
        const pendingAttrCount = Object.values(existingPendingAttrs).filter(v => v !== null).length;
        const originalCharCount = Object.values(existingOriginalChars).filter(v => v !== null).length;

        const extraInfo: string[] = [];
        if (pendingPairCount > 0) extraInfo.push(`${pendingPairCount} 个暂存对话对`);
        if (pendingAttrCount > 0) extraInfo.push(`${pendingAttrCount} 个暂存属性变化`);
        if (originalCharCount > 0) extraInfo.push(`${originalCharCount} 个原始人物属性`);

        if (extraInfo.length > 0) {
          console.log(`✅ 总结前已将所有调教记录保存到数据库，包含 ${extraInfo.join('、')}`);
        } else {
          console.log(`✅ 总结前已将所有调教记录保存到数据库`);
        }
      }
    } catch (error) {
      console.error('保存调教记录到数据库失败:', error);
      // 不抛出错误，避免影响总结流程
    }
  }

  /**
   * 应用总结到世界书
   * @param worldbookName 世界书名称
   * @param summaries 总结内容Map，key为entry UID，value为总结内容和保留的对话
   */
  static async applySummaries(
    worldbookName: string,
    summaries: Map<
      number,
      { summary: string; incremental: boolean; entryName?: string; entryType?: string; retainedDialogues?: string }
    >,
  ): Promise<void> {
    try {
      // 确认总结时，先保存所有需要总结的调教记录到数据库（此时存档ID是正确的）
      const worldbook = await WorldbookHelper.get(worldbookName);
      const entriesToSummarize = worldbook.filter(entry => summaries.has(entry.uid));
      await this.saveTrainingHistoryBeforeSummary(entriesToSummarize);

      let updatedCount = 0;

      for (let i = 0; i < worldbook.length; i++) {
        const entry = worldbook[i];
        if (summaries.has(entry.uid)) {
          const { summary: summaryContentRaw, incremental, retainedDialogues } = summaries.get(entry.uid)!;

          // 清理AI返回内容中可能包含的summary标签，避免嵌套或连续的summary
          let summaryContent = summaryContentRaw;
          if (/<summary_\d+>/.test(summaryContent)) {
            // 移除所有summary_N标签，只保留标签内的内容
            // 需要递归处理，因为可能有嵌套的summary标签
            let previousContent = '';
            while (previousContent !== summaryContent) {
              previousContent = summaryContent;
              // 处理新格式 <summary_N>...</summary_N>（需要匹配数字）
              summaryContent = summaryContent.replace(/<summary_(\d+)>([\s\S]*?)<\/summary_\1>/g, '$2');
            }
            summaryContent = summaryContent.trim();
            console.log('🧹 清理了AI返回内容中的summary标签');
          }

          // 检查清理后的内容是否为空
          if (!summaryContent || summaryContent.trim().length === 0) {
            console.warn('⚠️ AI生成的总结内容为空，跳过保存');
            continue; // 跳过这个条目，不保存空内容
          }

          let newContent = '';

          // 检查条目中是否已经存在summary（无论incremental参数如何，都要检查实际情况）
          // 使用通用函数提取并去重summary（仅支持新格式<summary_N>）
          const existingSummaries = WorldbookHelper.extractAndDeduplicateSummaries(entry.content || '');

          if (existingSummaries.length > 0) {
            // 如果条目中已有summary，总是进行增量总结（无论incremental参数如何）
            // 找到最大的序号
            const maxIndex = Math.max(...existingSummaries.map(s => s.index));
            const nextIndex = maxIndex + 1;

            // 组合所有非空的summary
            const allSummaries = WorldbookHelper.combineSummaries(existingSummaries);
            const newSummary = `<summary_${nextIndex}>\n${summaryContent}\n</summary_${nextIndex}>`;

            // 如果有保留的对话，追加到summary后面
            if (retainedDialogues && retainedDialogues.trim()) {
              newContent = `${allSummaries}\n\n${newSummary}\n${retainedDialogues}`;
              console.log(
                `📝 增量总结: 添加到summary_${nextIndex}（保留${existingSummaries.length}个已有summary，检测到条目中已存在summary，参数incremental=${incremental}），并追加保留的对话`,
              );
            } else {
              newContent = `${allSummaries}\n\n${newSummary}`;
              console.log(
                `📝 增量总结: 添加到summary_${nextIndex}（保留${existingSummaries.length}个已有summary，检测到条目中已存在summary，参数incremental=${incremental}）`,
              );
            }
          } else {
            // 首次总结：使用summary_1（确认条目中没有任何summary）
            const newSummary = `<summary_1>\n${summaryContent}\n</summary_1>`;

            // 如果有保留的对话，追加到summary后面
            if (retainedDialogues && retainedDialogues.trim()) {
              newContent = `${newSummary}\n${retainedDialogues}`;
              console.log(
                `📝 首次总结: 创建summary_1（确认条目中没有已有summary，参数incremental=${incremental}），并追加保留的对话`,
              );
            } else {
              newContent = newSummary;
              console.log(`📝 首次总结: 创建summary_1（确认条目中没有已有summary，参数incremental=${incremental}）`);
            }
          }

          // 更新条目内容
          worldbook[i] = {
            ...entry,
            content: newContent,
            enabled: true,
            extra: {
              ...entry.extra,
              has_summary: true,
              summary_updated_at: new Date().toISOString(),
              summary_updated_at_readable: new Date().toLocaleString('zh-CN'),
              original_data_removed: true,
              original_data_removed_at: new Date().toISOString(),
            },
          };

          updatedCount++;
        }
      }

      await WorldbookHelper.replace(worldbookName, worldbook);
      console.log(`成功应用 ${updatedCount} 个条目的总结`);
    } catch (error) {
      console.error('应用总结失败:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`应用总结失败: ${errorMessage}`);
    }
  }

  /**
   * 恢复被禁用的世界书条目（用于取消总结时）
   * @param worldbookName 世界书名称
   * @param entryUids 要恢复的条目UID列表
   */
  static async restoreDisabledEntries(worldbookName: string, entryUids: number[]): Promise<void> {
    try {
      const worldbook = await WorldbookHelper.get(worldbookName);
      let restoredCount = 0;

      for (let i = 0; i < worldbook.length; i++) {
        const entry = worldbook[i];
        // 恢复指定的总结条目
        if (entryUids.includes(entry.uid)) {
          // 恢复原始启用状态
          const originalEnabled = entry.extra?._original_enabled ?? true;
          entry.enabled = originalEnabled;

          // 清除临时存储的原始状态
          if (entry.extra && '_original_enabled' in entry.extra) {
            delete entry.extra._original_enabled;
          }

          restoredCount++;
        }
        // 同时恢复思维链条目（检查是否有保存的原始状态）
        else if (
          (entry.extra?.entry_type === 'chain_of_thought' || entry.uid === 999999999) &&
          entry.extra &&
          '_original_enabled' in entry.extra
        ) {
          // 恢复原始启用状态
          const originalEnabled = entry.extra._original_enabled ?? true;
          entry.enabled = originalEnabled;

          // 清除临时存储的原始状态
          delete entry.extra._original_enabled;

          restoredCount++;
        }
      }

      if (restoredCount > 0) {
        await WorldbookHelper.replace(worldbookName, worldbook);
        // 检查是否恢复了思维链
        const chainRestored = worldbook.some(
          e =>
            (e.extra?.entry_type === 'chain_of_thought' || e.uid === 999999999) &&
            !('_original_enabled' in (e.extra || {})) &&
            e.enabled === true,
        );
        const messages = [`✅ 已恢复 ${restoredCount} 个条目的启用状态`];
        if (chainRestored) {
          messages.push('（包含思维链）');
        }
        console.log(messages.join(' '));
      }
    } catch (error) {
      console.error('恢复禁用条目失败:', error);
      throw error;
    }
  }

  /**
   * 获取世界书中的人物列表（用于剧情总结）
   * 返回所有有剧情记录的角色的ID、名称和title
   * 通过剧情条目的人物名称，从数据库中查找人物的title
   */
  static async getCharactersInWorldbook(
    worldbookName: string,
  ): Promise<Array<{ id: string; name: string; title?: string }>> {
    try {
      const entries = await this.getWorldbookEntries(worldbookName);

      // 从character_story_history类型的条目中提取人物信息
      const characterStoryEntries = entries.filter(entry => entry.extra?.entry_type === 'character_story_history');

      // 从数据库获取所有人物数据，用于通过名称查找title
      let databaseCharacters: Character[] = [];
      try {
        const trainingData = modularSaveManager.getModuleData({ moduleName: 'training' }) as any;
        if (trainingData && trainingData.characters && Array.isArray(trainingData.characters)) {
          databaseCharacters = trainingData.characters as Character[];
        }
      } catch (e) {
        console.warn('从数据库获取人物数据失败:', e);
      }

      // 使用Map去重，因为同一人物可能有多条剧情记录
      const characterMap = new Map<string, { id: string; name: string; title?: string }>();

      characterStoryEntries.forEach(entry => {
        const characterId = entry.extra?.character_id || '';
        const characterName = entry.extra?.character_name || entry.name || '未知人物';

        if (characterId && !characterMap.has(characterId)) {
          // 尝试从数据库中通过人物名称查找title
          let title: string | undefined;
          if (characterName && databaseCharacters.length > 0) {
            // 方法1：先通过ID查找
            const characterById = databaseCharacters.find(c => c.id === characterId);
            if (characterById && characterById.title) {
              title = characterById.title;
            } else {
              // 方法2：通过名称查找（精确匹配）
              const characterByName = databaseCharacters.find(c => c.name === characterName);
              if (characterByName && characterByName.title) {
                title = characterByName.title;
              } else {
                // 方法3：通过名称模糊匹配（处理可能的格式差异）
                const characterByNameFuzzy = databaseCharacters.find(
                  c => c.name.includes(characterName) || characterName.includes(c.name),
                );
                if (characterByNameFuzzy && characterByNameFuzzy.title) {
                  title = characterByNameFuzzy.title;
                }
              }
            }
          }

          // 如果数据库中没有找到，尝试从世界书条目中获取title
          if (!title) {
            // 获取所有人物条目（entry_type为character_entry或没有entry_type但extra.character_id存在的条目）
            const characterEntries = entries.filter(
              entry =>
                (entry.extra?.character_type === 'manual_training' || entry.extra?.character_id) &&
                entry.extra?.entry_type !== 'character_story_history',
            );

            const characterEntry = characterEntries.find(e => e.extra?.character_id === characterId);
            if (characterEntry) {
              // 方法1：从条目名称解析 "title-name" 格式
              const nameMatch = characterEntry.name.match(/^(.+?)-(.+)$/);
              if (nameMatch) {
                title = nameMatch[1];
              } else {
                // 方法2：尝试从content中解析JSON获取title
                try {
                  const contentMatch = characterEntry.content.match(/```json\s*([\s\S]*?)\s*```/);
                  if (contentMatch) {
                    const parsed = JSON.parse(contentMatch[1]);
                    title = parsed.basicInfo?.title;
                  }
                } catch (e) {
                  // 解析失败，忽略
                }
              }
            }
          }

          characterMap.set(characterId, { id: characterId, name: characterName, title });
        }
      });

      return Array.from(characterMap.values());
    } catch (error) {
      console.error('获取人物列表失败:', error);
      return [];
    }
  }
}
