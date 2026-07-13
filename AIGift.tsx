'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import type { BirthdayData, AIGeneratedContent } from '../types';

// ============================================================================
// Props 接口定义
// ============================================================================
interface AIGiftProps {
  /** 寿星完整数据 */
  data: BirthdayData;
  /** AI 生成的专属内容 */
  aiContent: AIGeneratedContent | null;
  /** 完成回调 */
  onComplete: () => void;
}

// ============================================================================
// 主题颜色映射
// ============================================================================
const THEME_COLORS: Record<string, { primary: string; secondary: string }> = {
  starry:  { primary: '#4facfe', secondary: '#a855f7' },
  sakura:  { primary: '#f472b6', secondary: '#fb7185' },
  candy:   { primary: '#fb923c', secondary: '#f472b6' },
  ocean:   { primary: '#22d3ee', secondary: '#3b82f6' },
  forest:  { primary: '#34d399', secondary: '#22c55e' },
  castle:  { primary: '#c084fc', secondary: '#e879f9' },
  aurora:  { primary: '#a78bfa', secondary: '#34d399' },
  chinese: { primary: '#ef4444', secondary: '#fbbf24' },
  tech:    { primary: '#06b6d4', secondary: '#8b5cf6' },
};

// ============================================================================
// Tab 定义
// ============================================================================
const TABS = [
  { key: 'letter',     label: '生日信',   icon: '✉' },
  { key: 'poem',       label: '生日诗',   icon: '🎋' },
  { key: 'story',      label: '童话故事', icon: '📖' },
  { key: 'prediction', label: '未来寄语', icon: '🔮' },
] as const;

// ============================================================================
// 工具函数：十六进制颜色 → rgba 字符串
// ============================================================================
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ============================================================================
// 生成占位内容（当没有 AI 内容时）
// ============================================================================
function generatePlaceholderContent(data: BirthdayData): AIGeneratedContent {
  const { name, age, interests, favoriteColor, favoriteAnimal, dream, theme } = data;

  return {
    letter: `亲爱的${name}：\n\n今天是属于你的特别日子，你${age}岁啦！\n\n在这个宇宙中，你就像一颗独一无二的星星。你热爱${interests}，喜欢${favoriteAnimal}，钟爱${favoriteColor}色的世界，这些都让你闪闪发光。\n\n你的梦想是${dream}，相信在你的坚持下，这个梦想一定能够实现。\n\n愿你的每一天都充满阳光和欢笑，愿你的每一个梦想都能开花结果。\n\n生日快乐，永远快乐的${name}！`,
    poem: [
      `${name}的${age}岁`,
      '像一首未完的诗篇',
      '每一行都写满希望',
      '每一节都唱着勇敢',
      '',
      '你喜欢的小${favoriteAnimal}',
      '在梦中为你引路',
      `${favoriteColor}色的天空下`,
      '星星在为你跳舞',
      '',
      '愿你永远保持好奇',
      '永远热爱这个世界',
      '生日快乐',
      `属于你的${theme === 'starry' ? '星空' : '美好'}时刻`,
    ].join('\n'),
    story: `从前，在一个充满魔法的${theme === 'forest' ? '森林' : theme === 'ocean' ? '海底王国' : theme === 'castle' ? '城堡王国' : '星空'}里，住着一个叫${name}的小探险家。\n\n${name}今年${age}岁了，在这个特殊的日子里，魔法世界为他准备了一场盛大的冒险。\n\n他带着心爱的${favoriteAnimal}伙伴出发了。他们穿过${favoriteColor}色的花海，翻越梦想的山峰。一路上，他们遇到了许多朋友——每一步经历，都是成长的养分。\n\n最终，${name}在山顶发现了一颗闪闪发光的星星。星星对他说："你每一步的勇敢和善良，都化作了光芒。这就是你${age}年来收集的宝藏。"\n\n${name}笑了，因为他明白了：真正的宝藏，就是一路走来那个勇敢的自己。`,
    prediction: `${name}，在你${age}岁之际，宇宙为你描绘了一幅美好的未来画卷：\n\n· 你的${interests}天赋将在未来大放异彩，带给你意想不到的惊喜。\n· 一段美好的旅程正在等你，${favoriteAnimal}般的朋友将陪伴左右。\n· ${favoriteColor}色的幸运之光将照亮你前行的每一步。\n· ${dream}的种子已经种下，只待时光浇灌，终会繁花似锦。\n\n未来可期，愿你勇敢前行！`,
    imageUrl: '',
    fortune: `今日运势：大吉`,
    luckyCard: `专属幸运卡`,
  };
}

// ============================================================================
// AIGift 组件
// ============================================================================
const AIGift: React.FC<AIGiftProps> = ({ data, aiContent, onComplete }) => {
  // ======================== 状态 ========================
  const [activeTab, setActiveTab] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [direction, setDirection] = useState(0); // 滑动方向: 1=向左, -1=向右

  // ======================== 主题颜色 ========================
  const colors = THEME_COLORS[data.theme] || THEME_COLORS['starry'];

  // ======================== 内容 ========================
  const content = useMemo(() => {
    if (aiContent) return aiContent;
    return generatePlaceholderContent(data);
  }, [aiContent, data]);

  // ======================== 加载模拟 ========================
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  // ======================== Tab 切换（手势拖拽） ========================
  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 80; // 滑动阈值（像素）
    if (info.offset.x < -threshold && activeTab < TABS.length - 1) {
      setDirection(1);
      setActiveTab((prev) => prev + 1);
    } else if (info.offset.x > threshold && activeTab > 0) {
      setDirection(-1);
      setActiveTab((prev) => prev - 1);
    }
  };

  // ======================== Tab 内容渲染 ========================
  const renderTabContent = () => {
    const tabKey = TABS[activeTab].key;
    const textContent = content[tabKey];
    const lines = textContent.split('\n');

    // --- 生日信 ---
    if (tabKey === 'letter') {
      return (
        <div className="relative p-6 md:p-8 min-h-[300px]">
          {/* 左侧装饰线 */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1 rounded-full"
            style={{
              background: `linear-gradient(to bottom, ${colors.primary}, ${colors.secondary})`,
            }}
          />
          {/* 信纸内容，逐行淡入 */}
          <div className="pl-4 space-y-2" style={{ fontFamily: "'Georgia', 'Noto Serif SC', serif" }}>
            {lines.map((line, i) => (
              <motion.p
                key={i}
                className="text-base md:text-lg leading-relaxed"
                style={{ color: line.trim() ? 'rgba(255,255,255,0.9)' : 'transparent' }}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.12, duration: 0.5, ease: 'easeOut' }}
              >
                {line || '\u00A0'}
              </motion.p>
            ))}
          </div>
        </div>
      );
    }

    // --- 生日诗 ---
    if (tabKey === 'poem') {
      return (
        <div className="flex flex-col items-center p-6 md:p-8 min-h-[300px]">
          {lines.map((line, i) => (
            <motion.p
              key={i}
              className="text-lg md:text-xl text-center leading-loose"
              style={{
                color: line.trim() ? 'rgba(255,255,255,0.85)' : 'transparent',
                textShadow: line.trim()
                  ? `0 0 20px ${hexToRgba(colors.primary, 0.3)}`
                  : 'none',
              }}
              initial={{ opacity: 0, y: 15, filter: 'blur(5px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ delay: i * 0.18, duration: 0.6, ease: 'easeOut' }}
            >
              {line || '\u00A0'}
            </motion.p>
          ))}
        </div>
      );
    }

    // --- 童话故事 ---
    if (tabKey === 'story') {
      const paragraphs = lines.filter((l) => l.trim()).map((l) => l.trim());
      return (
        <div className="p-6 md:p-8 min-h-[300px]">
          {/* 书本样式装饰 */}
          <div
            className="absolute inset-0 rounded-3xl opacity-5 pointer-events-none"
            style={{
              background: `repeating-linear-gradient(0deg, transparent, transparent 28px, rgba(255,255,255,0.3) 28px, rgba(255,255,255,0.3) 29px)`,
            }}
          />
          <div className="space-y-4 relative z-10">
            {paragraphs.map((paragraph, i) => (
              <motion.p
                key={i}
                className="text-base md:text-lg leading-relaxed indent-8"
                style={{ color: 'rgba(255,255,255,0.85)' }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.25, duration: 0.6, ease: 'easeOut' }}
              >
                {paragraph}
              </motion.p>
            ))}
          </div>
        </div>
      );
    }

    // --- 未来寄语 ---
    if (tabKey === 'prediction') {
      const predictionLines = lines.filter((l) => l.trim());
      return (
        <div className="relative p-6 md:p-8 min-h-[300px] overflow-hidden">
          {/* 星空背景效果 */}
          <div
            className="absolute inset-0 rounded-3xl pointer-events-none"
            style={{
              background: `radial-gradient(ellipse at 30% 20%, ${hexToRgba(colors.primary, 0.12)} 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, ${hexToRgba(colors.secondary, 0.1)} 0%, transparent 50%)`,
            }}
          />
          {/* 发光边框 */}
          <div
            className="absolute inset-0 rounded-3xl pointer-events-none"
            style={{
              boxShadow: `inset 0 0 40px ${hexToRgba(colors.primary, 0.08)}, 0 0 30px ${hexToRgba(colors.secondary, 0.05)}`,
            }}
          />
          <div className="space-y-3 relative z-10">
            {predictionLines.map((line, i) => (
              <motion.p
                key={i}
                className="text-base md:text-lg leading-relaxed"
                style={{
                  color: 'rgba(255,255,255,0.9)',
                  textShadow: line.startsWith('·')
                    ? `0 0 15px ${hexToRgba(colors.primary, 0.4)}`
                    : 'none',
                }}
                initial={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                transition={{ delay: i * 0.2, duration: 0.5, ease: 'easeOut' }}
              >
                {line}
              </motion.p>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  // ======================== 滑动动画变量 ========================
  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 300 : -300,
      opacity: 0,
      filter: 'blur(5px)',
    }),
    center: {
      x: 0,
      opacity: 1,
      filter: 'blur(0px)',
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -300 : 300,
      opacity: 0,
      filter: 'blur(5px)',
    }),
  };

  // ======================== 渲染 ========================
  return (
    <motion.div
      className="fixed inset-0 w-screen h-screen overflow-hidden flex flex-col items-center"
      style={{ background: '#0a0a1a' }}
      initial={{ opacity: 0, y: 80, filter: 'blur(15px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -40, filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* 背景径向渐变 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 20%, ${hexToRgba(colors.secondary, 0.08)} 0%, transparent 60%)`,
        }}
      />

      {/* ===== 标题 ===== */}
      <motion.div
        className="relative z-10 pt-10 pb-4 px-4 text-center"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6 }}
      >
        <h2
          className="text-2xl md:text-3xl font-bold"
          style={{
            background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary}, ${colors.primary})`,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          AI 为你准备的专属礼物
        </h2>
      </motion.div>

      {/* ===== 主内容区 ===== */}
      <div className="relative z-10 flex-1 w-full max-w-2xl mx-auto px-4 pb-4 flex flex-col min-h-0">
        <AnimatePresence mode="wait">
          {/* ----- 加载状态 ----- */}
          {isLoading && (
            <motion.div
              key="loading"
              className="flex-1 flex flex-col items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.5 }}
            >
              {/* 旋转圆环 */}
              <div className="relative w-20 h-20 mb-6">
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{
                    border: `3px solid transparent`,
                    borderTopColor: colors.primary,
                    borderRightColor: colors.secondary,
                    filter: `drop-shadow(0 0 8px ${hexToRgba(colors.primary, 0.6)})`,
                  }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                />
                {/* 内圈 */}
                <motion.div
                  className="absolute inset-3 rounded-full"
                  style={{
                    border: `2px solid transparent`,
                    borderBottomColor: colors.secondary,
                    filter: `drop-shadow(0 0 6px ${hexToRgba(colors.secondary, 0.5)})`,
                  }}
                  animate={{ rotate: -360 }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
                />
                {/* 中心发光点 */}
                <div
                  className="absolute inset-0 m-auto w-3 h-3 rounded-full"
                  style={{
                    background: colors.primary,
                    boxShadow: `0 0 12px ${hexToRgba(colors.primary, 0.8)}, 0 0 24px ${hexToRgba(colors.secondary, 0.4)}`,
                  }}
                />
              </div>
              {/* 脉冲加载文字 */}
              <motion.p
                className="text-lg md:text-xl"
                style={{ color: hexToRgba(colors.primary, 0.8) }}
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                正在为{data.name}准备专属礼物...
              </motion.p>
            </motion.div>
          )}

          {/* ----- 内容区域 ----- */}
          {!isLoading && (
            <motion.div
              key="content"
              className="flex-1 flex flex-col min-h-0"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            >
              {/* Tab 栏 */}
              <div className="flex gap-2 mb-4 px-2 flex-shrink-0">
                {TABS.map((tab, index) => (
                  <motion.button
                    key={tab.key}
                    className="relative px-3 py-2 rounded-xl text-sm font-medium transition-colors"
                    style={{
                      color: activeTab === index
                        ? '#ffffff'
                        : hexToRgba(colors.primary, 0.5),
                      background: activeTab === index
                        ? hexToRgba(colors.primary, 0.15)
                        : 'transparent',
                      border: activeTab === index
                        ? `1px solid ${hexToRgba(colors.primary, 0.3)}`
                        : '1px solid transparent',
                    }}
                    onClick={() => {
                      setDirection(index > activeTab ? 1 : -1);
                      setActiveTab(index);
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <span className="mr-1">{tab.icon}</span>
                    {tab.label}
                  </motion.button>
                ))}
              </div>

              {/* 滑动内容卡片 */}
              <div className="flex-1 min-h-0 overflow-hidden">
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={activeTab}
                    className="glass-strong relative w-full h-full overflow-y-auto"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.15}
                    onDragEnd={handleDragEnd}
                    style={{ touchAction: 'pan-y' }}
                  >
                    {renderTabContent()}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* AI 图片区域 */}
              <AnimatePresence>
                {content.imageUrl && (
                  <motion.div
                    className="flex-shrink-0 mt-4 flex justify-center"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  >
                    <div
                      className="relative rounded-2xl overflow-hidden"
                      style={{
                        border: `2px solid ${hexToRgba(colors.primary, 0.3)}`,
                        boxShadow: `0 0 20px ${hexToRgba(colors.primary, 0.2)}, 0 0 40px ${hexToRgba(colors.secondary, 0.1)}`,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={content.imageUrl}
                        alt={`AI 为 ${data.name} 生成的生日图片`}
                        className="max-h-48 md:max-h-64 w-auto object-contain"
                        onLoad={() => setImageLoaded(true)}
                        style={{
                          opacity: imageLoaded ? 1 : 0,
                          transition: 'opacity 0.5s ease',
                        }}
                      />
                      {/* 图片加载发光动画 */}
                      {imageLoaded && (
                        <motion.div
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            background: `radial-gradient(circle at center, ${hexToRgba(colors.primary, 0.15)} 0%, transparent 70%)`,
                          }}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: [0, 1, 0] }}
                          transition={{ duration: 1.5, ease: 'easeInOut' }}
                        />
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ===== 底部按钮 ===== */}
      <AnimatePresence>
        {!isLoading && (
          <motion.div
            className="relative z-10 pb-8 pt-2 flex-shrink-0"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <motion.button
              className="btn-cosmic"
              onClick={onComplete}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              这礼物太棒了！继续 &rarr;
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AIGift;
