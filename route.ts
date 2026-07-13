import { NextRequest, NextResponse } from 'next/server';
import type { BirthdayData, AIGeneratedContent } from '@/types';

// ============================================================================
// 工具函数：基于字符串生成伪随机种子
// ============================================================================
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash);
}

/** 简易伪随机数生成器（确保同一种子可复现，不同种子结果不同） */
function createRng(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** 从数组中按随机种子选取元素 */
function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** 洗牌数组 */
function shuffle<T>(rng: () => number, arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ============================================================================
// 主题相关意象词库
// ============================================================================
const THEME_IMAGERY: Record<string, {
  worlds: string[];
  elements: string[];
  sceneries: string[];
}> = {
  starry:  { worlds: ['星空', '银河', '星海'], elements: ['星辰', '星光', '星尘'], sceneries: ['繁星点点的夜空', '闪烁的银河', '宁静的星空'] },
  sakura:  { worlds: ['樱花林', '花海', '樱花大道'], elements: ['花瓣', '春风', '花雨'], sceneries: ['粉色的花雨', '飘落的樱花', '花瓣铺成的路'] },
  candy:   { worlds: ['糖果王国', '甜蜜乐园', '彩虹糖森林'], elements: ['糖果', '巧克力', '棉花糖'], sceneries: ['色彩斑斓的糖果世界', '流淌着蜂蜜的河流', '巧克力做的山峰'] },
  ocean:   { worlds: ['海底王国', '珊瑚乐园', '深海秘境'], elements: ['海浪', '珊瑚', '水母'], sceneries: ['蔚蓝的深海', '闪烁的珊瑚礁', '温柔的海浪'] },
  forest:  { worlds: ['魔法森林', '精灵之森', '翡翠密林'], elements: ['萤火虫', '蘑菇', '落叶'], sceneries: ['被阳光穿透的森林', '萤火虫飞舞的夜晚', '铺满落叶的小径'] },
  castle:  { worlds: ['梦幻城堡', '水晶宫殿', '云端之城'], elements: ['水晶', '玫瑰', '金色铠甲'], sceneries: ['高耸的水晶塔', '盛开的玫瑰园', '金色的城堡大厅'] },
  aurora:  { worlds: ['极光世界', '北极仙境', '光之大地'], elements: ['极光', '冰晶', '北极光'], sceneries: ['舞动的绿色极光', '冰晶折射的彩虹', '永恒的白昼'] },
  chinese: { worlds: ['仙山琼阁', '桃花源', '天宫'], elements: ['祥云', '仙鹤', '莲花'], sceneries: ['云雾缭绕的山巅', '桃花盛开的仙境', '金色大殿'] },
  tech:    { worlds: ['赛博城市', '数字世界', '未来都市'], elements: ['光粒子', '全息投影', '量子光束'], sceneries: ['霓虹闪烁的未来都市', '全息投影的星空', '数据流织成的世界'] },
};

// ============================================================================
// 信件素材池
// ============================================================================
const LETTER_OPENINGS = [
  '亲爱的{name}：',
  '嗨，最特别的{name}：',
  '致我们最亲爱的{name}：',
  '{name}，在这个特别的日子里：',
  '亲爱的{name}，展信佳：',
];

const LETTER_PRAISES = [
  '喜欢{animal}的你，总是带着一颗温柔而纯真的心。',
  '热爱{interests}的你，让身边的世界变得更加丰富多彩。',
  '对{dream}的执着，正是你身上最闪耀的光芒。',
  '喜欢{color}色的你，总能发现生活中最美好的色彩。',
  '你就像一只灵动的{animal}，总能在平凡中创造奇迹。',
  '你那颗追梦的心，比最亮的星星还要耀眼。',
  '你在{interests}方面的才华，总是让人赞叹不已。',
  '对生活充满热情的你，就像一道温暖的光。',
];

const LETTER_BLESSINGS = [
  '愿你的每一天都充满阳光和欢笑，愿你的每一个梦想都能开花结果。',
  '愿岁月温柔以待，愿所有美好都如约而至。',
  '希望你永远保持那颗好奇又勇敢的心，一路向前。',
  '愿你在{age}岁的新旅程中，遇见更多美好，收获更多幸福。',
  '愿你的笑容永远灿烂，愿你的梦想永远闪耀。',
  '希望你永远被爱包围，被幸运眷顾。',
];

const LETTER_CLOSINGS = [
  '生日快乐，永远快乐的{name}！',
  '祝你{age}岁生日快乐，未来的每一天都精彩万分！',
  '愿{name}的{age}岁，是最好的开始，也是最美的旅途。',
  '永远爱你的朋友们，祝{age}岁生日快乐！',
];

// ============================================================================
// 诗歌素材池
// ============================================================================
const POEM_LINES = [
  '{name}的{age}岁，像一首未完的诗篇',
  '每一行都写满了希望与期待',
  '每一节都唱着勇敢和热爱',
  '喜欢{animal}的你，总能在梦中找到方向',
  '{color}色的天空下，星星在为你跳舞',
  '你热爱的{interests}，是你最闪亮的翅膀',
  '关于{dream}的梦，已在心底悄悄发芽',
  '愿你的每一步，都踏着星光前行',
  '愿你的每一个心愿，都能在星空中回响',
  '年龄不过是数字，真正的你永远年轻',
  '你眼中的光芒，比银河还要璀璨',
  '让{world}为你歌唱，让{elements}为你祝福',
  '愿你永远保持好奇，永远热爱这个世界',
  '在这个特别的日子里，整个{scenery}为你绽放',
];

// ============================================================================
// 童话故事模板池（动态填充）
// ============================================================================
const STORY_TEMPLATES = [
  (d: BirthdayData, world: string, element: string, scenery: string) =>
    `从前，在一个充满魔法的${world}里，住着一个叫${d.name}的小探险家。\n\n${d.name}今年${d.age}岁了。在这个特殊的日子里，整个魔法世界都在为${d.name}准备一场盛大的冒险。天空中有无数${element}在闪烁，仿佛在低声说着什么秘密。\n\n${d.name}带着心爱的${d.favoriteAnimal}伙伴出发了。他们穿过${scenery}，翻越由${d.interests}化成的梦想山峰。一路上，他们遇到了许多奇妙的朋友——有的教${d.name}唱星辰的歌，有的送${d.name}一束永不凋谢的花。\n\n最终，${d.name}在${world}的最深处发现了一颗闪闪发光的星星。星星对他说："你每一步的勇敢和善良，都化作了光芒。这就是你${d.age}年来收集的全部宝藏。"\n\n${d.name}笑了，因为他终于明白：真正的宝藏不在远方，而是一路走来那个勇敢的自己。`,

  (d: BirthdayData, world: string, element: string, scenery: string) =>
    `在遥远的${world}深处，流传着一个古老的传说：每当有孩子过生日，${element}就会聚在一起，编织一场最奇妙的冒险。\n\n这天，正是${d.name}的${d.age}岁生日。清晨，一只${d.favoriteAnimal}轻轻敲响了${d.name}的窗户："快跟我来，${world}为你准备了一份特别的礼物！"\n\n${d.name}兴奋地跟着${d.favoriteAnimal}踏上了旅程。他们走过${scenery}，${d.favoriteColor}色的光芒洒满了整条道路。在旅途中，${d.name}遇到了三个守护者：\n\n第一位守护者说："热爱${d.interests}的心，是你最珍贵的勇气。"\n第二位守护者说："追逐${d.dream}的脚步，永远不要停歇。"\n第三位守护者说："保持善良，${world}会永远守护你。"\n\n当${d.name}到达旅程的终点，整片${world}绽放出前所未有的光芒。${d.name}闭上眼许了一个愿望，当他睁开眼时，发现自己变得更加勇敢、更加强大了。\n\n"生日快乐！"${d.favoriteAnimal}轻轻地说。${d.name}知道，这场冒险虽然结束了，但属于他的故事才刚刚开始。`,

  (d: BirthdayData, world: string, element: string, scenery: string) =>
    `很久很久以前，在${world}里住着一颗特别的小星星，它的名字叫${d.name}。\n\n${d.name}和别的小星星不太一样——它有着${d.favoriteColor}色的光芒，总是幻想着有朝一日能实现${d.dream}。其他星星笑它："我们只需要在天上闪烁就好了呀。"\n\n但${d.name}不甘心。在${d.age}岁生日这天，它决定踏上寻找${d.dream}的旅程。一只年迈的${d.favoriteAnimal}成了它的向导，带着它穿过${scenery}。\n\n它们首先来到了"勇气之湖"。湖水问${d.name}："你愿意放弃安稳的生活吗？"${d.name}坚定地点了点头，湖水便化成了${d.favoriteColor}色的桥。\n\n接着是"智慧之谷"。山谷让${d.name}分享自己的${d.interests}心得，${d.name}认真地讲述了每一个细节，山谷满意地让出了道路。\n\n最后是"梦想之门"。门上写着："只有最勇敢的心才能打开。"${d.name}毫不犹豫地推开了门——门的另一边，正是${d.name}一直追寻的${d.dream}。\n\n${d.favoriteAnimal}微笑着说："你看，${d.dream}从来不在远方，它一直在你心里。你只需要足够勇敢去打开那扇门。"\n\n从那以后，${d.name}成了${world}里最闪亮的那颗星，因为它教会了所有星星一个道理：梦想，只有勇敢追寻才能实现。`,

  (d: BirthdayData, world: string, element: string, scenery: string) =>
    `${d.name}今年${d.age}岁了。在${world}历中，${d.age}是一个极其特别的数字——据说在${d.age}岁生日这天，魔法世界会为每个孩子打开一扇通往奇迹的大门。\n\n生日这天清晨，${d.name}睁开眼，发现自己的房间变成了${scenery}。一只${d.favoriteColor}色的蝴蝶飞了进来，翅膀上闪着${element}般的光芒。\n\n"跟我来，"${d.favoriteAnimal}从角落探出头来说，"今天是你的魔法日！"\n\n${d.name}跟着${d.favoriteAnimal}穿过一扇光之门，来到了一个奇异的世界。在这里，${d.interests}化成了流动的河流，${d.dream}长成了一棵参天大树，树上挂满了闪闪发光的愿望果实。\n\n"每颗果实都代表你过去一年里的一次勇敢。"一位白胡子精灵解释道。${d.name}小心翼翼地摘下一颗，果实里浮现出一段美好的回忆——那是${d.name}最骄傲的时刻。\n\n精灵说："${d.name}，你比你自己知道的更强大。记住这份力量，用它去追逐${d.dream}，用它去创造更多奇迹。"\n\n${d.name}握紧了愿望果实，感到一股温暖的力量充盈全身。当魔法渐渐退去，${d.name}回到了自己的房间，手里仍握着那颗发光的果实。\n\n${d.age}岁的冒险结束了，但${d.name}知道——真正的冒险，才刚刚开始。`,
];

// ============================================================================
// 寄语模板池
// ============================================================================
const PREDICTION_TEMPLATES = [
  (d: BirthdayData) =>
    `${d.name}，在你${d.age}岁之际，宇宙为你描绘了一幅美好的未来画卷：\n\n· 你的${d.interests}天赋将在未来大放异彩，带给你意想不到的惊喜。\n· 一段美好的旅程正在等你，${d.favoriteAnimal}般忠诚的朋友将陪伴左右。\n· ${d.favoriteColor}色的幸运之光将照亮你前行的每一步。\n· ${d.dream}的种子已经种下，只待时光浇灌，终会繁花似锦。\n\n未来可期，愿你勇敢前行！`,

  (d: BirthdayData) =>
    `${d.name}，${d.age}岁是新的起点，星辰为你铺好了未来的路：\n\n· 接下来的一年，你在${d.interests}方面将迎来重要突破。\n· 命运之轮正在转动，一个与${d.dream}相关的机遇即将出现。\n· 像你喜欢的${d.favoriteAnimal}一样，保持敏锐和灵活，好运自然来。\n· ${d.favoriteColor}将是你这一年的幸运色，记得多穿戴哦。\n\n相信自己的力量，前方是星辰大海！`,

  (d: BirthdayData) =>
    `致${d.age}岁的${d.name}——宇宙的祝福已经送达：\n\n· 你对${d.interests}的热情，将点燃未来的每一盏灯。\n· 在不久的将来，${d.favoriteAnimal}会以某种方式出现在你的生命里，带来好运。\n· 你追求的${d.dream}并不遥远，每一步都算数。\n· ${d.favoriteColor}色的天空下，一切皆有可能。\n\n记住，你是被宇宙选中的孩子，注定不凡。`,
];

// ============================================================================
// 运势签主题池
// ============================================================================
const FORTUNE_CATEGORIES = [
  { theme: '事业学业', pool: ['你在{interests}领域将获得意想不到的突破', '一个重要的学习机会即将到来，请做好准备', '你的努力即将开花结果，坚持下去', '新的创意火花即将迸发，灵感源源不断'] },
  { theme: '爱情友情', pool: ['一位老朋友将给你带来温暖的消息', '真诚待人，美好的人际关系正在酝酿', '你散发出的善意会吸引到志同道合的伙伴', '一段意想不到的缘分即将出现'] },
  { theme: '健康活力', pool: ['多接触大自然，${color}色的环境对你特别有益', '保持乐观的心态，身体会感谢你', '今年适合尝试一项新的运动，焕发活力', '注意休息，你比想象中更需要放松'] },
  { theme: '财运好运', pool: ['一个小小的投资可能会带来意外收获', '贵人运旺盛，多留意身边的机遇', '把握住下个月的重要节点，好运连连', '你积累的实力正在转化为切实的回报'] },
  { theme: '个人成长', pool: ['${dream}的梦想比你想象中更接近实现', '今年将遇到一位改变你思维方式的人', '勇敢走出舒适区，成长就在那一步之后', '你正在成为自己一直想成为的人'] },
];

// ============================================================================
// 幸运卡片祝福池
// ============================================================================
const LUCKY_CARD_TEMPLATES = [
  (d: BirthdayData) => `🌟 ${d.name}的${d.age}岁专属幸运卡 🌟\n\n愿${d.favoriteColor}色的彩虹永远挂在你头顶\n愿${d.favoriteAnimal}的温柔永远伴你左右\n愿${d.dream}的星星永远为你闪耀\n\n你是这个宇宙中最独一无二的存在\n生日快乐，${d.name}！`,
  (d: BirthdayData) => `✨ 幸运降临 ✨\n\n致${d.name}的${d.age}岁：\n这张幸运卡承载了整个星空的祝福\n愿你对${d.interests}的热爱永不减退\n愿你追逐${d.dream}的脚步永不停歇\n\n你的幸运数字是 ${d.age}\n你的幸运色是 ${d.favoriteColor}\n愿一切美好如约而至`,
  (d: BirthdayData) => `💫 星空认证 · 幸运卡 💫\n\n持卡人：${d.name}\n年龄：永远的${d.age}岁\n守护动物：${d.favoriteAnimal}\n幸运色：${d.favoriteColor}\n\n此卡保证：\n• ${d.dream}的梦想成真\n• ${d.interests}天赋觉醒\n• 每一天都充满惊喜\n\n有效期：永远`,
];

// ============================================================================
// 主生成函数
// ============================================================================
function generateContent(data: BirthdayData): AIGeneratedContent {
  // 使用当前时间戳 + 数据哈希作为随机种子，确保每次生成不同
  const dataHash = hashString(
    `${data.name}-${data.age}-${data.interests}-${data.dream}-${data.favoriteColor}-${data.favoriteAnimal}-${data.theme}-${Date.now()}`
  );
  const rng = createRng(dataHash);

  // 获取主题意象
  const themeData = THEME_IMAGERY[data.theme] || THEME_IMAGERY['starry'];
  const world = pick(rng, themeData.worlds);
  const elements = pick(rng, themeData.elements);
  const scenery = pick(rng, themeData.sceneries);

  // ------------------------------------------------------------------
  // 1. 生成生日信（约200字）
  // ------------------------------------------------------------------
  const opening = pick(rng, LETTER_OPENINGS).replace(/{name}/g, data.name);
  const praises = shuffle(rng, [...LETTER_PRAISES])
    .slice(0, 3)
    .map((p) =>
      p
        .replace(/{name}/g, data.name)
        .replace(/{age}/g, String(data.age))
        .replace(/{animal}/g, data.favoriteAnimal)
        .replace(/{color}/g, data.favoriteColor)
        .replace(/{interests}/g, data.interests)
        .replace(/{dream}/g, data.dream)
    )
    .join('\n');
  const blessing = pick(rng, LETTER_BLESSINGS)
    .replace(/{name}/g, data.name)
    .replace(/{age}/g, String(data.age))
    .replace(/{animal}/g, data.favoriteAnimal)
    .replace(/{color}/g, data.favoriteColor)
    .replace(/{interests}/g, data.interests)
    .replace(/{dream}/g, data.dream);
  const closing = pick(rng, LETTER_CLOSINGS)
    .replace(/{name}/g, data.name)
    .replace(/{age}/g, String(data.age));

  const letter = `${opening}\n\n今天是属于你的特别日子，你${data.age}岁啦！\n\n在这个宇宙中，你就像一颗独一无二的星星。\n\n${praises}\n\n${blessing}\n\n${closing}`;

  // ------------------------------------------------------------------
  // 2. 生成诗歌（8-12行）
  // ------------------------------------------------------------------
  const poemLineCount = 8 + Math.floor(rng() * 5); // 8-12行
  const selectedPoemLines = shuffle(rng, [...POEM_LINES]).slice(0, poemLineCount);
  const poem = selectedPoemLines
    .map((line) =>
      line
        .replace(/{name}/g, data.name)
        .replace(/{age}/g, String(data.age))
        .replace(/{animal}/g, data.favoriteAnimal)
        .replace(/{color}/g, data.favoriteColor)
        .replace(/{interests}/g, data.interests)
        .replace(/{dream}/g, data.dream)
        .replace(/{world}/g, world)
        .replace(/{elements}/g, elements)
        .replace(/{scenery}/g, scenery)
    )
    .join('\n');

  // ------------------------------------------------------------------
  // 3. 生成童话故事（约300字）
  // ------------------------------------------------------------------
  const storyTemplate = pick(rng, STORY_TEMPLATES);
  const story = storyTemplate(data, world, elements, scenery);

  // ------------------------------------------------------------------
  // 4. 生成未来寄语（约100字）
  // ------------------------------------------------------------------
  const predictionTemplate = pick(rng, PREDICTION_TEMPLATES);
  const prediction = predictionTemplate(data);

  // ------------------------------------------------------------------
  // 5. 生成运势签内容（5条不同主题）
  // ------------------------------------------------------------------
  const fortune = FORTUNE_CATEGORIES.map((cat) => {
    const item = pick(rng, cat.pool)
      .replace(/{interests}/g, data.interests)
      .replace(/{color}/g, data.favoriteColor)
      .replace(/{animal}/g, data.favoriteAnimal)
      .replace(/{dream}/g, data.dream);
    return `【${cat.theme}】${item}`;
  }).join('\n');

  // ------------------------------------------------------------------
  // 6. 生成幸运卡片祝福
  // ------------------------------------------------------------------
  const luckyCardTemplate = pick(rng, LUCKY_CARD_TEMPLATES);
  const luckyCard = luckyCardTemplate(data);

  // ------------------------------------------------------------------
  // 7. imageUrl 返回空字符串（实际项目接入 AI 图片生成 API）
  // ------------------------------------------------------------------
  const imageUrl = '';

  return {
    letter,
    poem,
    story,
    prediction,
    imageUrl,
    fortune,
    luckyCard,
  };
}

// ============================================================================
// POST Route Handler
// ============================================================================
export async function POST(request: NextRequest) {
  try {
    const body: BirthdayData = await request.json();

    // 基本校验
    if (!body.name || !body.age || !body.theme) {
      return NextResponse.json(
        { error: '缺少必要的生日数据字段（name, age, theme）' },
        { status: 400 }
      );
    }

    // 使用本地算法动态生成内容
    const content = generateContent(body);

    return NextResponse.json(content, { status: 200 });
  } catch (error) {
    console.error('[AI Generate API] 生成失败:', error);
    return NextResponse.json(
      { error: 'AI 内容生成失败，请稍后重试' },
      { status: 500 }
    );
  }
}
