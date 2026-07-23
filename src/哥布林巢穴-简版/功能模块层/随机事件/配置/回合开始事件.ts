import { generateWithChainOfThought } from '../../../核心层/服务/世界书管理/工具/AI生成助手';
import { ChainOfThoughtMode } from '../../../核心层/服务/世界书管理/工具/思维链管理器';
import { modularSaveManager } from '../../../核心层/服务/存档系统/模块化存档服务';
import { EventRarity, EventType, RandomEvent } from '../类型/事件类型';

/**
 * 通用的秘书官提示词模板
 */
const DEFAULT_SECRETARY_PROMPT = `你是 {{secretaryName}}，{{secretaryTitle}}，作为哥布林巢穴的秘书官。请以秘书官 {{secretaryName}} 的身份，向玩家汇报上述事件信息。汇报要求：1. 符合 {{secretaryName}} 的性格和身份（{{secretaryTitle}}）2. 以第一人称（"我"）或第三人称（"{{secretaryName}}"）的方式汇报3. 可以结合事件内容，用秘书官的口吻进行转述和说明4. 回复要专业、有条理，符合秘书官的身份5. 使用自然的中文对话6. 字数控制在400-600字左右`;

/**
 * 附加秘书官提示词到主提示词
 * @param basePrompt 基础提示词
 * @param secretaryPrompt 秘书官提示词（可选），如果不提供则使用默认模板
 * @returns 附加了秘书官提示词的完整提示词
 */
function appendSecretaryPrompt(basePrompt: string, secretaryPrompt?: string): string {
  const promptToUse = secretaryPrompt || DEFAULT_SECRETARY_PROMPT;

  try {
    const nestData = modularSaveManager.getModuleData({ moduleName: 'nest' }) as any;
    const trainingData = modularSaveManager.getModuleData({ moduleName: 'training' }) as any;

    if (nestData?.secretaryId && trainingData?.characters) {
      const secretary = trainingData.characters.find((char: any) => char.id === nestData.secretaryId);
      if (secretary) {
        // 替换占位符
        let secretaryPromptText = promptToUse;
        secretaryPromptText = secretaryPromptText.replace(/\{\{secretaryName\}\}/g, secretary.name);
        secretaryPromptText = secretaryPromptText.replace(/\{\{secretaryTitle\}\}/g, secretary.title);
        return `${basePrompt}\n\n${secretaryPromptText}`;
      }
    }
  } catch (error) {
    console.error('获取秘书官信息失败:', error);
  }

  // 如果没有秘书官，返回原始提示词
  return basePrompt;
}

// 回合开始随机事件配置
export const roundStartEvents: RandomEvent[] = [
  // ==================== 世界传闻事件 ====================
  (() => {
    // 通过闭包定义 secretaryPrompt，让 onAIGenerate 可以访问
    const secretaryPrompt = DEFAULT_SECRETARY_PROMPT; // 使用默认模板，也可以自定义

    return {
      id: 'round_start_rumors',
      name: '世界传闻',
      description: '关于哥布林巢穴的传闻在大陆上传播...',
      type: EventType.RANDOM,
      rarity: EventRarity.COMMON,
      trigger: {
        minRound: 3,
        probability: 0.22, // 再次降低生成概率
        cooldownRounds: 5, // 触发后5回合内不会再次触发
      },
      dialogueConfig: {
        title: '📰 世界传闻',
        subtitle: '关于哥布林巢穴的消息在世界上传播',
        welcomeText: '📰 世界传闻记录',
        welcomeHint: '最近，出现了一些关于哥布林巢穴的传闻，这些消息可能会影响你的发展...',
        showCustomInput: false, // 关闭自定义输入功能
        initialOptions: [
          { text: '仔细了解传闻', label: '了解', value: 'understand' },
          { text: '忽略这些消息', label: '忽略', value: 'ignore' },
        ],
        secretaryPrompt, // 使用闭包中的 secretaryPrompt
        onAIGenerate: async () => {
          // 仔细了解传闻的提示词
          const basePrompt = `请作为一个中立的叙述者，讲述世界目前对于哥布林巢穴的传闻。

指导原则：
1. 参考世界书中的相关设定，如世界设定/大陆设定/势力种族设定/哥布林设定等
2. 参考巢穴当前的资源状态/征服记录等信息，作为传闻的背景
3. 用第三人称叙述，类似故事中的旁白，语言要生动真实，符合奇幻冒险色情游戏的风格
4. 保持神秘和紧张的氛围
5. 字数控制在400字左右
6. 以**特拉希尔世界传闻录**为开头

重要人物参考（如相关）：
- 海岚·奥古斯塔·赛菲亚 - 赛菲亚女帝
- 维多利亚·冯·铁盾 - 卡斯提亚堡领主
- 奥罗拉·德·星辉 - 维拉诺瓦城城主
- 维奥莱塔·德·翡翠 - 翡翠王国女王
- 塞拉菲娜·冯·劳伦丝 - 白玫瑰骑士团长
- 塞勒涅·月光 - 月光女王
- 露娜瑞尔·星歌 - 卡拉森林守护者
- 萨拉德拉·暗影 - 暗影贤者
- 莫尔德拉·血影 - 血港总督
- 樱·红叶 - 九尾神巫女
- 枫·香草 - 红叶商盟会长
`;

          // 使用通用函数附加秘书官提示词（通过闭包访问 secretaryPrompt）
          const prompt = appendSecretaryPrompt(basePrompt, secretaryPrompt);

          try {
            // 读取流式传输设置
            const globalVars = getVariables({ type: 'global' });
            const enableStreamOutput =
              typeof globalVars['enable_stream_output'] === 'boolean' ? globalVars['enable_stream_output'] : true; // 默认开启流式

            const response = await generateWithChainOfThought(ChainOfThoughtMode.RANDOM_EVENT, {
              user_input: prompt,
              should_stream: enableStreamOutput, // 根据设置启用流式传输
            });
            return response;
          } catch (error) {
            console.error('AI生成失败:', error);
            return '传闻在大陆上传播，但具体内容模糊不清...';
          }
        },
        onOptionSelect: (option: any) => {
          // 如果选择忽略，直接结束对话
          if (option.value === 'ignore') {
            console.log('玩家选择忽略传闻，直接结束对话');
            // 返回 false 阻止AI生成，直接结束对话
            return false;
          } else if (option.value === 'understand') {
            console.log('玩家选择了解传闻');
          }
          // 其他情况继续正常流程
          return true;
        },
        onDialogueClose: () => {
          console.log('传闻事件关闭');
        },
      },
    };
  })(),
  // ==================== 初见事件 ====================
  {
    id: 'first_contact_empire',
    name: '初次接触帝国',
    description: '哥布林巢穴首次抵达赛菲亚大陆...',
    type: EventType.ENCOUNTER,
    rarity: EventRarity.EPIC,
    trigger: {
      minRound: 1,
      requiredContinentConquest: {
        continentName: '赛菲亚大陆',
        minConquestProgress: 1, // 只要开始入侵赛菲亚大陆就触发
      },
      triggerOnce: true, // 只触发一次
      triggerOnFirstContact: true, // 初次接触时触发
      probability: 1.0, // 100%触发
    },
    dialogueConfig: {
      title: '🏛️ 初次接触帝国',
      subtitle: '哥布林巢穴抵达赛菲亚大陆',
      welcomeText: '🏛️ 历史性时刻',
      welcomeHint: '哥布林巢穴首次踏上了赛菲亚帝国的土地，这是一个历史性的时刻...',
      showCustomInput: false,
      initialOptions: [
        { text: '见证历史时刻', label: '见证', value: 'witness' },
        { text: '了解帝国反应', label: '了解', value: 'understand' },
      ],
      onAIGenerate: async () => {
        const prompt = `
        请作为中立的叙述者，描述哥布林巢穴首次抵达赛菲亚大陆的历史性时刻。

指导原则：
1. 参考世界书中的赛菲亚帝国设定
2. 描述这是哥布林巢穴首次踏足帝国土地的历史性时刻
3. 体现帝国的强大和威严，以及他们对这个新威胁的初步反应
4. 语言要庄重史诗，符合历史性时刻的氛围
5. 字数控制在600字左右

重要人物：
- 海岚·奥古斯塔·赛菲亚 - 赛菲亚女帝
- 维多利亚·冯·铁盾 - 卡斯提亚堡领主
- 奥罗拉·德·星辉 - 维拉诺瓦城城主

可能的内容方向：
- 哥布林巢穴抵达的具体场景
- 帝国边境的发现和报告
- 女帝和宫廷的初步反应
- 边境守军的应对措施
- 这个历史性时刻的意义
`;

        try {
          // 读取流式传输设置
          const globalVars = getVariables({ type: 'global' });
          const enableStreamOutput =
            typeof globalVars['enable_stream_output'] === 'boolean' ? globalVars['enable_stream_output'] : false; // 默认关闭

          const response = await generateWithChainOfThought(ChainOfThoughtMode.RANDOM_EVENT, {
            user_input: prompt,
            should_stream: enableStreamOutput, // 根据设置启用流式传输
          });
          return response;
        } catch (error) {
          console.error('AI生成失败:', error);
          return '哥布林巢穴首次踏上了赛菲亚帝国的土地，这是一个历史性的时刻，帝国的边境守军正在紧急报告这一发现...';
        }
      },
      onOptionSelect: (option: any) => {
        console.log(`玩家选择: ${option.value}`);
        return true;
      },
      onDialogueClose: () => {
        console.log('初次接触帝国事件关闭');
      },
    },
  },
  {
    id: 'first_contact_elves',
    name: '初次接触精灵',
    description: '哥布林巢穴首次抵达中央大陆...',
    type: EventType.ENCOUNTER,
    rarity: EventRarity.EPIC,
    trigger: {
      minRound: 1,
      requiredContinentConquest: {
        continentName: '世界树圣域',
        minConquestProgress: 1, // 只要开始入侵世界树圣域就触发
      },
      triggerOnce: true, // 只触发一次
      triggerOnFirstContact: true, // 初次接触时触发
      probability: 1.0, // 100%触发
    },
    dialogueConfig: {
      title: '🌳 初次接触精灵',
      subtitle: '哥布林巢穴抵达世界树圣域',
      welcomeText: '🌳 历史性时刻',
      welcomeHint: '哥布林巢穴首次踏上了世界树圣域的土地，永恒精灵的古老结界感受到了新的威胁...',
      showCustomInput: false,
      initialOptions: [
        { text: '见证历史时刻', label: '见证', value: 'witness' },
        { text: '了解精灵反应', label: '了解', value: 'understand' },
      ],
      onAIGenerate: async () => {
        const prompt = `
        请作为中立的叙述者，描述哥布林巢穴首次抵达世界树圣域的历史性时刻。

指导原则：
1. 参考世界书中的永恒精灵设定
2. 描述这是哥布林巢穴首次踏足精灵圣域的历史性时刻
3. 体现精灵的古老智慧和神秘感，以及他们对这个新威胁的初步反应
4. 语言要神秘庄重，符合精灵圣域的氛围
5. 字数控制在600字左右

重要人物：
- 塞勒涅·月光 - 月光女王
- 露娜瑞尔·星歌 - 卡拉森林守护者

可能的内容方向：
- 哥布林巢穴抵达的具体场景
- 世界树结界的反应
- 树灵议会和月光女王的初步感知
- 精灵守卫者的发现和报告
- 这个历史性时刻的意义
`;

        try {
          // 读取流式传输设置
          const globalVars = getVariables({ type: 'global' });
          const enableStreamOutput =
            typeof globalVars['enable_stream_output'] === 'boolean' ? globalVars['enable_stream_output'] : false; // 默认关闭

          const response = await generateWithChainOfThought(ChainOfThoughtMode.RANDOM_EVENT, {
            user_input: prompt,
            should_stream: enableStreamOutput, // 根据设置启用流式传输
          });
          return response;
        } catch (error) {
          console.error('AI生成失败:', error);
          return '哥布林巢穴首次踏上了世界树圣域的土地，古老的结界感受到了新的威胁，永恒精灵的守卫者正在紧急报告这一发现...';
        }
      },
      onOptionSelect: (option: any) => {
        console.log(`玩家选择: ${option.value}`);
        return true;
      },
      onDialogueClose: () => {
        console.log('初次接触精灵事件关闭');
      },
    },
  },
  {
    id: 'first_contact_dark_elves',
    name: '初次接触暗影',
    description: '哥布林巢穴首次抵达瓦尔基里大陆...',
    type: EventType.ENCOUNTER,
    rarity: EventRarity.EPIC,
    trigger: {
      minRound: 1,
      requiredContinentConquest: {
        continentName: '瓦尔基里大陆',
        minConquestProgress: 1, // 只要开始入侵瓦尔基里大陆就触发
      },
      triggerOnce: true, // 只触发一次
      triggerOnFirstContact: true, // 初次接触时触发
      probability: 1.0, // 100%触发
    },
    dialogueConfig: {
      title: '🌑 初次接触暗影',
      subtitle: '哥布林巢穴抵达瓦尔基里大陆',
      welcomeText: '🌑 历史性时刻',
      welcomeHint: '哥布林巢穴首次踏上了瓦尔基里大陆的冰原，黑暗精灵的暗影密会感受到了新的威胁...',
      showCustomInput: false,
      initialOptions: [
        { text: '见证历史时刻', label: '见证', value: 'witness' },
        { text: '了解暗影反应', label: '了解', value: 'understand' },
      ],
      onAIGenerate: async () => {
        const prompt = `
        请作为中立的叙述者，描述哥布林巢穴首次抵达瓦尔基里大陆的历史性时刻。

指导原则：
1. 参考世界书中的暗影密会设定
2. 描述这是哥布林巢穴首次踏足黑暗精灵领土的历史性时刻
3. 体现黑暗精灵的冷酷和邪恶，以及他们对这个新威胁的初步反应
4. 语言要冷酷神秘，符合黑暗精灵的邪恶气质
5. 字数控制在600字左右

重要人物：
- 萨拉德拉·暗影 - 暗影贤者
- 莫尔德拉·血影 - 血港总督

可能的内容方向：
- 哥布林巢穴抵达的具体场景
- 黑暗巢都的感知和反应
- 暗影贤者的初步评估
- 黑暗精灵守卫者的发现和报告
- 这个历史性时刻的意义
`;

        try {
          // 读取流式传输设置
          const globalVars = getVariables({ type: 'global' });
          const enableStreamOutput =
            typeof globalVars['enable_stream_output'] === 'boolean' ? globalVars['enable_stream_output'] : false; // 默认关闭

          const response = await generateWithChainOfThought(ChainOfThoughtMode.RANDOM_EVENT, {
            user_input: prompt,
            should_stream: enableStreamOutput, // 根据设置启用流式传输
          });
          return response;
        } catch (error) {
          console.error('AI生成失败:', error);
          return '哥布林巢穴首次踏上了瓦尔基里大陆的冰原，黑暗精灵的暗影密会感受到了新的威胁，邪恶的智慧正在评估这个新出现的对手...';
        }
      },
      onOptionSelect: (option: any) => {
        console.log(`玩家选择: ${option.value}`);
        return true;
      },
      onDialogueClose: () => {
        console.log('初次接触暗影事件关闭');
      },
    },
  },
  {
    id: 'first_contact_foxes',
    name: '初次接触狐族',
    description: '哥布林巢穴首次抵达香草群岛...',
    type: EventType.ENCOUNTER,
    rarity: EventRarity.EPIC,
    trigger: {
      minRound: 1,
      requiredContinentConquest: {
        continentName: '香草群岛',
        minConquestProgress: 1, // 只要开始入侵香草群岛就触发
      },
      triggerOnce: true, // 只触发一次
      triggerOnFirstContact: true, // 初次接触时触发
      probability: 1.0, // 100%触发
    },
    dialogueConfig: {
      title: '🦊 初次接触狐族',
      subtitle: '哥布林巢穴抵达香草群岛',
      welcomeText: '🦊 历史性时刻',
      welcomeHint: '哥布林巢穴首次踏上了香草群岛的土地，九尾神社和红叶商盟都感受到了新的威胁...',
      showCustomInput: false,
      initialOptions: [
        { text: '见证历史时刻', label: '见证', value: 'witness' },
        { text: '了解狐族反应', label: '了解', value: 'understand' },
      ],
      onAIGenerate: async () => {
        const prompt = `
        请作为中立的叙述者，描述哥布林巢穴首次抵达香草群岛的历史性时刻。

指导原则：
1. 参考世界书中的狐族设定
2. 描述这是哥布林巢穴首次踏足狐族领土的历史性时刻
3. 体现狐族的和平理念和商业智慧，以及他们对这个新威胁的初步反应
4. 语言要优雅神秘，符合狐族的高贵气质
5. 字数控制在600字左右

重要人物：
- 樱·红叶 - 九尾神巫女
- 枫·香草 - 红叶商盟会长

可能的内容方向：
- 哥布林巢穴抵达的具体场景
- 九尾神社和红叶商盟的感知
- 神巫女和商盟代表的初步反应
- 狐族守卫者的发现和报告
- 这个历史性时刻的意义
`;

        try {
          // 读取流式传输设置
          const globalVars = getVariables({ type: 'global' });
          const enableStreamOutput =
            typeof globalVars['enable_stream_output'] === 'boolean' ? globalVars['enable_stream_output'] : false; // 默认关闭

          const response = await generateWithChainOfThought(ChainOfThoughtMode.RANDOM_EVENT, {
            user_input: prompt,
            should_stream: enableStreamOutput, // 根据设置启用流式传输
          });
          return response;
        } catch (error) {
          console.error('AI生成失败:', error);
          return '哥布林巢穴首次踏上了香草群岛的土地，九尾神社的神巫女和红叶商盟的代表都感受到了新的威胁，古老的智慧正在为世界的未来而担忧...';
        }
      },
      onOptionSelect: (option: any) => {
        console.log(`玩家选择: ${option.value}`);
        return true;
      },
      onDialogueClose: () => {
        console.log('初次接触狐族事件关闭');
      },
    },
  },
  // ==================== 势力反应事件 ====================
  {
    id: 'round_start_empire_response',
    name: '帝国应对进展',
    description: '赛菲亚帝国对哥布林威胁的应对措施...',
    type: EventType.RANDOM,
    rarity: EventRarity.UNCOMMON,
    trigger: {
      minRound: 5,
      requiredContinentConquest: {
        continentName: '赛菲亚大陆',
        minConquestProgress: 1, // 只要开始入侵赛菲亚大陆就可能触发
      },
      probability: 0.15, // 降低概率
      cooldownRounds: 3, // 触发后3回合内不会再次触发
    },
    dialogueConfig: {
      title: '🏛️ 帝国反应',
      subtitle: '赛菲亚帝国的官方回应',
      welcomeText: '🏛️ 帝国应对进展',
      welcomeHint: '赛菲亚帝国正在采取各种措施应对哥布林威胁...',
      showCustomInput: false,
      initialOptions: [
        { text: '查看此事件', label: '查看', value: 'view' },
        { text: '忽略此事件(不建议)', label: '忽略', value: 'ignore' },
      ],
      onAIGenerate: async () => {
        const prompt = `
        请作为中立的叙述者，描述赛菲亚帝国对哥布林巢穴威胁的官方反应。

指导原则：
1. 参考世界书中的赛菲亚帝国设定
2. 结合巢穴当前的征服记录和威胁度，描述帝国的具体应对措施
3. 体现帝国的强大实力和复杂政治体系
4. 语言要符合中世纪奇幻风格，体现帝国的威严和效率
5. 字数控制在500字左右

重要人物：
- 海岚·奥古斯塔·赛菲亚 - 赛菲亚女帝
- 维多利亚·冯·铁盾 - 卡斯提亚堡领主
- 奥罗拉·德·星辉 - 维拉诺瓦城城主

可能的内容方向：
- 女帝的官方声明或宫廷会议
- 诸侯贵族的反应和分歧
- 军事部署和侦察行动
- 与其他势力的外交协调
`;

        try {
          // 读取流式传输设置
          const globalVars = getVariables({ type: 'global' });
          const enableStreamOutput =
            typeof globalVars['enable_stream_output'] === 'boolean' ? globalVars['enable_stream_output'] : false; // 默认关闭

          const response = await generateWithChainOfThought(ChainOfThoughtMode.RANDOM_EVENT, {
            user_input: prompt,
            should_stream: enableStreamOutput, // 根据设置启用流式传输
          });
          return response;
        } catch (error) {
          console.error('AI生成失败:', error);
          return '帝国宫廷中传出了关于哥布林威胁的讨论，但具体措施尚不明确...';
        }
      },
      onOptionSelect: (option: any) => {
        if (option.value === 'ignore') {
          console.log('玩家选择忽略事件，直接结束对话');
          return false; // 返回 false 阻止AI生成，直接结束对话
        } else if (option.value === 'view') {
          console.log('玩家选择查看事件');
        }
        return true; // 其他情况继续正常流程
      },
      onDialogueClose: () => {
        console.log('帝国反应事件关闭');
      },
    },
  },
  {
    id: 'round_start_elf_council',
    name: '精灵应对进展',
    description: '永恒精灵对哥布林威胁的应对措施...',
    type: EventType.RANDOM,
    rarity: EventRarity.RARE,
    trigger: {
      minRound: 8,
      requiredContinentConquest: {
        continentName: '世界树圣域',
        minConquestProgress: 1, // 只要开始入侵世界树圣域就可能触发
      },
      probability: 0.12, // 降低概率
      cooldownRounds: 5, // 触发后5回合内不会再次触发
    },
    dialogueConfig: {
      title: '🌳 精灵议会',
      subtitle: '世界树圣域的古老议会',
      welcomeText: '🌳 精灵应对进展',
      welcomeHint: '永恒精灵正在采取各种措施应对哥布林威胁...',
      showCustomInput: false,
      initialOptions: [
        { text: '查看此事件', label: '查看', value: 'view' },
        { text: '忽略此事件(不建议)', label: '忽略', value: 'ignore' },
      ],
      onAIGenerate: async () => {
        const prompt = `
        请作为中立的叙述者，描述永恒精灵树灵议会对哥布林巢穴威胁的讨论。

指导原则：
1. 参考世界书中的永恒精灵设定，包括树灵议会、月光女王塞勒涅·月光、卡拉森林守护者露娜瑞尔·星歌、世界树结界等
2. 体现精灵的古老智慧和神秘感，以及他们对世界树圣域的保护责任
3. 结合巢穴威胁度，描述精灵们的不同观点和应对策略
4. 语言要优雅神秘，符合精灵的高贵气质
5. 字数控制在500字左右

重要人物：
- 塞勒涅·月光 - 月光女王
- 露娜瑞尔·星歌 - 卡拉森林守护者

可能的内容方向：
- 树灵长老的不同观点
- 月光女王的最终决定
- 对卡拉森林哨站（如果未被征服）的支援
- 世界树结界的加强措施
- 与其他种族的古老盟约
`;

        try {
          // 读取流式传输设置
          const globalVars = getVariables({ type: 'global' });
          const enableStreamOutput =
            typeof globalVars['enable_stream_output'] === 'boolean' ? globalVars['enable_stream_output'] : false; // 默认关闭

          const response = await generateWithChainOfThought(ChainOfThoughtMode.RANDOM_EVENT, {
            user_input: prompt,
            should_stream: enableStreamOutput, // 根据设置启用流式传输
          });
          return response;
        } catch (error) {
          console.error('AI生成失败:', error);
          return '在世界树的深处，古老的智慧正在苏醒，但议会的决定仍然神秘...';
        }
      },
      onOptionSelect: (option: any) => {
        if (option.value === 'ignore') {
          console.log('玩家选择忽略事件，直接结束对话');
          return false; // 返回 false 阻止AI生成，直接结束对话
        } else if (option.value === 'view') {
          console.log('玩家选择查看事件');
        }
        return true; // 其他情况继续正常流程
      },
      onDialogueClose: () => {
        console.log('精灵议会事件关闭');
      },
    },
  },
  {
    id: 'round_start_dark_elf_response',
    name: '暗影应对进展',
    description: '黑暗精灵对哥布林威胁的应对措施...',
    type: EventType.RANDOM,
    rarity: EventRarity.UNCOMMON,
    trigger: {
      minRound: 6,
      requiredContinentConquest: {
        continentName: '瓦尔基里大陆',
        minConquestProgress: 1, // 只要开始入侵瓦尔基里大陆就可能触发
      },
      probability: 0.14, // 降低概率
      cooldownRounds: 4, // 触发后4回合内不会再次触发
    },
    dialogueConfig: {
      title: '🌑 暗影密会',
      subtitle: '瓦尔基里大陆的黑暗议会',
      welcomeText: '🌑 暗影应对进展',
      welcomeHint: '黑暗精灵正在采取各种措施应对哥布林威胁...',
      showCustomInput: false,
      initialOptions: [
        { text: '查看此事件', label: '查看', value: 'view' },
        { text: '忽略此事件(不建议)', label: '忽略', value: 'ignore' },
      ],
      onAIGenerate: async () => {
        const prompt = `
        请作为中立的叙述者，描述暗影密会对哥布林巢穴威胁的评估和讨论。

指导原则：
1. 参考世界书中的暗影密会设定，包括暗影贤者萨拉德拉·暗影、血港总督莫尔德拉·血影、黑暗巢都、奴隶制经济等
2. 体现黑暗精灵的冷酷和实用主义，以及他们对奴隶制的依赖
3. 结合巢穴威胁度，描述暗影密会的不同观点和应对策略
4. 语言要冷酷神秘，符合黑暗精灵的邪恶气质
5. 字数控制在500字左右

重要人物：
- 萨拉德拉·暗影 - 暗影贤者
- 莫尔德拉·血影 - 血港总督

可能的内容方向：
- 暗影贤者的个人观点
- 黑暗议会的分歧讨论
- 对奴隶贸易的影响评估
- 血魔法和诅咒武器的研究
- 与其他势力的潜在合作或对抗
`;

        try {
          // 读取流式传输设置
          const globalVars = getVariables({ type: 'global' });
          const enableStreamOutput =
            typeof globalVars['enable_stream_output'] === 'boolean' ? globalVars['enable_stream_output'] : false; // 默认关闭

          const response = await generateWithChainOfThought(ChainOfThoughtMode.RANDOM_EVENT, {
            user_input: prompt,
            should_stream: enableStreamOutput, // 根据设置启用流式传输
          });
          return response;
        } catch (error) {
          console.error('AI生成失败:', error);
          return '在黑暗巢都的深处，邪恶的智慧正在权衡利弊，但暗影密会的决定仍然未知...';
        }
      },
      onOptionSelect: (option: any) => {
        if (option.value === 'ignore') {
          console.log('玩家选择忽略事件，直接结束对话');
          return false; // 返回 false 阻止AI生成，直接结束对话
        } else if (option.value === 'view') {
          console.log('玩家选择查看事件');
        }
        return true; // 其他情况继续正常流程
      },
      onDialogueClose: () => {
        console.log('暗影密会事件关闭');
      },
    },
  },
  {
    id: 'round_start_fox_shrine_response',
    name: '九尾应对进展',
    description: '九尾神社对哥布林威胁的应对措施...',
    type: EventType.RANDOM,
    rarity: EventRarity.RARE,
    trigger: {
      minRound: 7,
      requiredContinentConquest: {
        continentName: '香草群岛',
        minConquestProgress: 1, // 只要开始入侵香草群岛就可能触发
      },
      probability: 0.1, // 降低概率
      cooldownRounds: 6, // 触发后6回合内不会再次触发
    },
    dialogueConfig: {
      title: '🦊 九尾神社',
      subtitle: '幻月城的九尾神教',
      welcomeText: '🦊 九尾应对进展',
      welcomeHint: '九尾神社正在采取各种措施应对哥布林威胁...',
      showCustomInput: false,
      initialOptions: [
        { text: '查看此事件', label: '查看', value: 'view' },
        { text: '忽略此事件(不建议)', label: '忽略', value: 'ignore' },
      ],
      onAIGenerate: async () => {
        const prompt = `
        请作为中立的叙述者，描述九尾神社对哥布林巢穴威胁的和平回应。

指导原则：
1. 参考世界书中的九尾神社设定，包括九尾神巫女樱·红叶、幻月城、九尾神教等
2. 体现狐族的和平理念和神秘感，以及他们对世界和平的责任感
3. 结合巢穴威胁度，描述神巫女的担忧和应对策略
4. 语言要优雅神秘，符合狐族的高贵气质
5. 字数控制在500字左右

重要人物：
- 樱·红叶 - 九尾神巫女

可能的内容方向：
- 九尾神巫女的和平呼吁
- 对世界局势的担忧
- 幻术结界的保护措施
- 与其他势力的调解尝试
- 九尾神教的古老预言
`;

        try {
          // 读取流式传输设置
          const globalVars = getVariables({ type: 'global' });
          const enableStreamOutput =
            typeof globalVars['enable_stream_output'] === 'boolean' ? globalVars['enable_stream_output'] : false; // 默认关闭

          const response = await generateWithChainOfThought(ChainOfThoughtMode.RANDOM_EVENT, {
            user_input: prompt,
            should_stream: enableStreamOutput, // 根据设置启用流式传输
          });
          return response;
        } catch (error) {
          console.error('AI生成失败:', error);
          return '在幻月城的宝塔中，古老的智慧正在为世界的未来而担忧...';
        }
      },
      onOptionSelect: (option: any) => {
        if (option.value === 'ignore') {
          console.log('玩家选择忽略事件，直接结束对话');
          return false; // 返回 false 阻止AI生成，直接结束对话
        } else if (option.value === 'view') {
          console.log('玩家选择查看事件');
        }
        return true; // 其他情况继续正常流程
      },
      onDialogueClose: () => {
        console.log('九尾神社事件关闭');
      },
    },
  },
  {
    id: 'round_start_merchant_guild_response',
    name: '商盟应对进展',
    description: '红叶商盟对哥布林威胁的应对措施...',
    type: EventType.RANDOM,
    rarity: EventRarity.COMMON,
    trigger: {
      minRound: 4,
      requiredContinentConquest: {
        continentName: '香草群岛',
        minConquestProgress: 1, // 只要开始入侵香草群岛就可能触发
      },
      probability: 0.18, // 降低概率
      cooldownRounds: 2, // 触发后2回合内不会再次触发
    },
    dialogueConfig: {
      title: '🍁 红叶商盟',
      subtitle: '红枫港的商业联合会',
      welcomeText: '🍁 商盟应对进展',
      welcomeHint: '红叶商盟正在采取各种措施应对哥布林威胁...',
      showCustomInput: false,
      initialOptions: [
        { text: '查看此事件', label: '查看', value: 'view' },
        { text: '忽略此事件(不建议)', label: '忽略', value: 'ignore' },
      ],
      onAIGenerate: async () => {
        const prompt = `
        请作为中立的叙述者，描述红叶商盟对哥布林巢穴威胁的商业评估。

指导原则：
1. 参考世界书中的红叶商盟设定，包括红叶商盟会长枫·香草、商业联合会、红枫港、航运网络等
2. 体现商人的实用主义和利益导向，以及他们对贸易网络的保护
3. 结合巢穴威胁度，描述商盟的应对措施和商业策略
4. 语言要现实具体，符合商人的精明气质
5. 字数控制在500字左右

重要人物：
- 枫·香草 - 红叶商盟会长

可能的内容方向：
- 商路中断的具体影响
- 航运安全的保护措施
- 新商机的发现和评估
- 与其他势力的贸易协调
- 商盟的军事保护需求
`;

        try {
          // 读取流式传输设置
          const globalVars = getVariables({ type: 'global' });
          const enableStreamOutput =
            typeof globalVars['enable_stream_output'] === 'boolean' ? globalVars['enable_stream_output'] : false; // 默认关闭

          const response = await generateWithChainOfThought(ChainOfThoughtMode.RANDOM_EVENT, {
            user_input: prompt,
            should_stream: enableStreamOutput, // 根据设置启用流式传输
          });
          return response;
        } catch (error) {
          console.error('AI生成失败:', error);
          return '在红枫港的商会中，精明的商人们正在权衡风险与机遇...';
        }
      },
      onOptionSelect: (option: any) => {
        if (option.value === 'ignore') {
          console.log('玩家选择忽略事件，直接结束对话');
          return false; // 返回 false 阻止AI生成，直接结束对话
        } else if (option.value === 'view') {
          console.log('玩家选择查看事件');
        }
        return true; // 其他情况继续正常流程
      },
      onDialogueClose: () => {
        console.log('红叶商盟事件关闭');
      },
    },
  },
  // ==================== 地区恐慌事件 ====================
  {
    id: 'round_start_trade_disruption',
    name: '商路中断',
    description: '哥布林威胁导致重要商路中断...',
    type: EventType.DISASTER,
    rarity: EventRarity.COMMON,
    trigger: {
      minRound: 10,
      requiredThreat: 200,
      probability: 0.25,
      triggerOnce: true, // 只触发一次
    },
    dialogueConfig: {
      title: '🚫 商路中断',
      subtitle: '贸易网络受到冲击',
      welcomeText: '🚫 商路中断报告',
      welcomeHint: '哥布林巢穴的扩张已经开始影响大陆间的贸易往来...',
      showCustomInput: false,
      initialOptions: [
        { text: '查看此事件', label: '查看', value: 'view' },
        { text: '忽略此事件(不建议)', label: '忽略', value: 'ignore' },
      ],
      onAIGenerate: async () => {
        const prompt = `
        请作为中立的叙述者，描述哥布林巢穴扩张对大陆贸易的影响。

指导原则：
1. 参考世界书中的红叶商盟、各大陆地理设定和贸易网络
2. 结合巢穴征服记录，描述具体受影响的商路和地区
3. 体现贸易中断对各方势力的经济冲击
4. 语言要现实具体，符合商业和经济的逻辑
5. 字数控制在400字左右

可能的内容方向：
- 具体商路的中断情况
- 商队遭遇袭击的细节
- 物价上涨和物资短缺
- 红叶商盟的应对措施
- 各势力对贸易保护的需求
`;

        try {
          // 读取流式传输设置
          const globalVars = getVariables({ type: 'global' });
          const enableStreamOutput =
            typeof globalVars['enable_stream_output'] === 'boolean' ? globalVars['enable_stream_output'] : false; // 默认关闭

          const response = await generateWithChainOfThought(ChainOfThoughtMode.RANDOM_EVENT, {
            user_input: prompt,
            should_stream: enableStreamOutput, // 根据设置启用流式传输
          });
          return response;
        } catch (error) {
          console.error('AI生成失败:', error);
          return '商路中断的消息不断传来，贸易网络正面临前所未有的挑战...';
        }
      },
      onOptionSelect: (option: any) => {
        if (option.value === 'ignore') {
          console.log('玩家选择忽略事件，直接结束对话');
          return false; // 返回 false 阻止AI生成，直接结束对话
        } else if (option.value === 'view') {
          console.log('玩家选择查看事件');
        }
        return true; // 其他情况继续正常流程
      },
      onDialogueClose: () => {
        console.log('商路中断事件关闭');
      },
    },
  },
  {
    id: 'round_start_refugee_crisis',
    name: '难民潮',
    description: '受哥布林威胁的难民开始大规模迁移...',
    type: EventType.DISASTER,
    rarity: EventRarity.UNCOMMON,
    trigger: {
      minRound: 20,
      requiredThreat: 600,
      probability: 0.2,
      triggerOnce: true, // 只触发一次
    },
    dialogueConfig: {
      title: '🏃 难民潮',
      subtitle: '大规模人口迁移',
      welcomeText: '🏃 难民潮报告',
      welcomeHint: '随着哥布林威胁的扩大，大量难民开始逃离家园，寻求安全...',
      showCustomInput: false,
      initialOptions: [
        { text: '查看此事件', label: '查看', value: 'view' },
        { text: '忽略此事件(不建议)', label: '忽略', value: 'ignore' },
      ],
      onAIGenerate: async () => {
        const prompt = `
        请作为中立的叙述者，描述哥布林威胁导致的大规模难民潮。

指导原则：
1. 参考世界书中的各大陆地理设定和势力分布
2. 结合巢穴征服记录，描述难民来源和迁移路线
3. 体现难民潮对各接收地区的压力和社会影响
4. 语言要真实感人，体现战争的人道主义灾难
5. 字数控制在450字左右

可能的内容方向：
- 难民的具体来源和数量
- 迁移路线和目的地
- 接收地区的应对措施
- 难民的生活状况和需求
- 对当地社会秩序的影响
- 各势力的难民政策分歧
`;

        try {
          // 读取流式传输设置
          const globalVars = getVariables({ type: 'global' });
          const enableStreamOutput =
            typeof globalVars['enable_stream_output'] === 'boolean' ? globalVars['enable_stream_output'] : false; // 默认关闭

          const response = await generateWithChainOfThought(ChainOfThoughtMode.RANDOM_EVENT, {
            user_input: prompt,
            should_stream: enableStreamOutput, // 根据设置启用流式传输
          });
          return response;
        } catch (error) {
          console.error('AI生成失败:', error);
          return '难民潮席卷大陆，无数家庭被迫离开家园，寻求安全的庇护所...';
        }
      },
      onOptionSelect: (option: any) => {
        if (option.value === 'ignore') {
          console.log('玩家选择忽略事件，直接结束对话');
          return false; // 返回 false 阻止AI生成，直接结束对话
        } else if (option.value === 'view') {
          console.log('玩家选择查看事件');
        }
        return true; // 其他情况继续正常流程
      },
      onDialogueClose: () => {
        console.log('难民潮事件关闭');
      },
    },
  },
];
