/** 寿星信息 */
export interface BirthdayData {
  name: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  interests: string;
  favoriteColor: string;
  favoriteAnimal: string;
  dream: string;
  blessing: string;
  theme: ThemeType;
}

/** 可选主题 */
export type ThemeType =
  | 'starry'    // 星空
  | 'sakura'    // 樱花
  | 'candy'     // 糖果
  | 'ocean'     // 海洋
  | 'forest'    // 森林
  | 'castle'    // 城堡
  | 'aurora'    // 极光
  | 'chinese'   // 中国风
  | 'tech';     // 科技风

/** 章节流程 */
export type ChapterId =
  | 'welcome'
  | 'opening'
  | 'stargazing'
  | 'games'
  | 'ai-gift'
  | 'birthday-tree'
  | 'climax'
  | 'universe'
  | 'share';

/** AI 生成内容 */
export interface AIGeneratedContent {
  letter: string;
  poem: string;
  story: string;
  prediction: string;
  imageUrl: string;
  fortune: string;
  luckyCard: string;
}

/** 小游戏完成状态 */
export interface GameState {
  giftOpened: boolean;
  candlesLit: number;
  wishesCollected: string[];
  luckyCardDrawn: boolean;
}

/** 粒子 */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  color: string;
  life: number;
  maxLife: number;
}
