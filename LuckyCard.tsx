'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { BirthdayData, AIGeneratedContent } from '../types';

// ============================================================================
// Props 接口定义
// ============================================================================
interface LuckyCardProps {
  /** 寿星完整数据 */
  data: BirthdayData;
  /** AI 生成内容（可选） */
  aiContent: AIGeneratedContent;
  /** 小游戏完成回调 */
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
// 工具函数
// ============================================================================
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ============================================================================
// 祝福风格枚举
// ============================================================================
type BlessingStyle = 'poem' | 'letter' | 'quote' | 'story' | 'future';

// ============================================================================
// 本地祝福生成模板 —— 根据 data 个性化生成
// ============================================================================
const generateLocalBlessing = (
  data: BirthdayData,
  style: BlessingStyle,
): string => {
  const { name, interests, dream, favoriteAnimal } = data;

  switch (style) {
    case 'poem':
      return [
        `${name}，你是宇宙中最温柔的星光`,
        `在${interests}的世界里，`,
        `你追寻${dream}的脚步从未停歇，`,
        `愿你如${favoriteAnimal}般自由，`,
        `在每一个清晨醒来，都带着微笑与希望。`,
        `生日快乐，愿你的诗篇永远写满美好。`,
      ].join('\n');

    case 'letter':
      return [
        `亲爱的${name}：`,
        ``,
        `在你${data.age}岁生日这天，`,
        `我想告诉你，世界因为你的存在而更加美好。`,
        `你对${interests}的热爱，让周围的人感受到了生活的热情。`,
        `你心中那个关于"${dream}"的梦想，`,
        `正在一步步走向现实。`,
        `愿你的每一天都充满温暖，`,
        `像你最爱的${favoriteAnimal}一样，自由而坚定。`,
        ``,
        `生日快乐！`,
      ].join('\n');

    case 'quote':
      return [
        `"生命中最美好的事情，`,
        `往往发生在我们追逐梦想的路上。"`,
        ``,
        `${name}，祝你在新的一岁里，`,
        `带着对${interests}的执着，`,
        `继续勇敢地追逐${dream}。`,
        `愿${favoriteAnimal}的灵动与智慧，`,
        `永远伴随你的旅程。`,
        ``,
        `—— 来自宇宙的祝福`,
      ].join('\n');

    case 'story':
      return [
        `从前，有一颗热爱${interests}的小星星，`,
        `它的名字叫${name}。`,
        ``,
        `这颗星星每天都在想，`,
        `"如果有一天我能实现${dream}，`,
        `那该多好啊。"`,
        ``,
        `有一天，一只${favoriteAnimal}告诉它：`,
        `"你已经拥有了最珍贵的东西，`,
        `那就是永远不放弃的心。"`,
        ``,
        `${name}，你就是那颗永不放弃的星星。`,
        `生日快乐！`,
      ].join('\n');

    case 'future':
      return [
        `致 ${name} 的未来寄语：`,
        ``,
        `在不久的将来，`,
        `你将在${interests}的领域中大放异彩，`,
        `${dream}不再只是一个愿望，`,
        `而是触手可及的现实。`,
        ``,
        `你将像${favoriteAnimal}一样，`,
        `勇敢地跨过每一道难关，`,
        `在每一个黎明迎接新的希望。`,
        ``,
        `未来可期，生日快乐！`,
      ].join('\n');

    default:
      return `祝${name}生日快乐！愿你心想事成！`;
  }
};

// ============================================================================
// 风格标签映射
// ============================================================================
const STYLE_LABELS: Record<BlessingStyle, string> = {
  poem: '诗意祝福',
  letter: '温情书信',
  quote: '名言寄语',
  story: '星辰故事',
  future: '未来寄语',
};

// ============================================================================
// 所有风格列表
// ============================================================================
const ALL_STYLES: BlessingStyle[] = ['poem', 'letter', 'quote', 'story', 'future'];

// ============================================================================
// LuckyCard 组件
// ============================================================================
const LuckyCard: React.FC<LuckyCardProps> = ({ data, aiContent, onComplete }) => {
  // ======================== 状态 ========================
  const [isFlipped, setIsFlipped] = useState(false);
  const [drawCount, setDrawCount] = useState(0);
  const [currentContent, setCurrentContent] = useState('');
  const [currentStyle, setCurrentStyle] = useState<BlessingStyle | null>(null);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showButtons, setShowButtons] = useState(false);

  // ======================== Refs ========================
  const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef(false);

  // ======================== 主题颜色 ========================
  const colors = THEME_COLORS[data.theme] || THEME_COLORS['starry'];

  // --------------------------------------------------------------------------
  // 生成祝福内容
  // --------------------------------------------------------------------------
  const generateContent = useCallback((): { text: string; style: BlessingStyle } => {
    // 如果有 AI 内容且还没用完
    if (aiContent?.luckyCard && drawCount === 0) {
      return { text: aiContent.luckyCard, style: 'poem' };
    }

    // 本地生成：随机选择风格
    const usedStyles: BlessingStyle[] = [];
    if (currentStyle) usedStyles.push(currentStyle);

    // 从未使用的风格中选择
    const availableStyles = ALL_STYLES.filter(s => !usedStyles.includes(s));
    const style = availableStyles.length > 0
      ? availableStyles[Math.floor(Math.random() * availableStyles.length)]
      : ALL_STYLES[Math.floor(Math.random() * ALL_STYLES.length)];

    const text = generateLocalBlessing(data, style);
    return { text, style };
  }, [aiContent, data, drawCount, currentStyle]);

  // --------------------------------------------------------------------------
  // 打字机效果
  // --------------------------------------------------------------------------
  const startTypewriter = useCallback((text: string) => {
    setIsTyping(true);
    setDisplayedText('');
    let charIdx = 0;

    typingIntervalRef.current = setInterval(() => {
      if (charIdx < text.length) {
        charIdx++;
        setDisplayedText(text.slice(0, charIdx));
      } else {
        // 打字完成
        if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
        setIsTyping(false);
        setShowButtons(true);
      }
    }, 50); // 每50ms一个字符
  }, []);

  // --------------------------------------------------------------------------
  // 抽卡（翻转卡片）
  // --------------------------------------------------------------------------
  const handleDrawCard = useCallback(() => {
    setIsFlipped(false);
    setShowButtons(false);

    // 等待翻回正面后再翻到背面
    setTimeout(() => {
      const { text, style } = generateContent();
      setCurrentContent(text);
      setCurrentStyle(style);
      setDrawCount(prev => prev + 1);
      setIsFlipped(true);

      // 翻转动画后开始打字
      setTimeout(() => {
        startTypewriter(text);
      }, 600);
    }, 500);
  }, [generateContent, startTypewriter]);

  // --------------------------------------------------------------------------
  // 再抽一张
  // --------------------------------------------------------------------------
  const handleRedraw = useCallback(() => {
    if (drawCount >= 3) {
      // 达到上限，自动继续
      handleContinue();
      return;
    }
    handleDrawCard();
  }, [drawCount, handleDrawCard]);

  // --------------------------------------------------------------------------
  // 继续下一环节
  // --------------------------------------------------------------------------
  const handleContinue = useCallback(() => {
    if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    onComplete();
  }, [onComplete]);

  // --------------------------------------------------------------------------
  // 初始自动抽第一张卡
  // --------------------------------------------------------------------------
  useEffect(() => {
    const timer = setTimeout(() => {
      handleDrawCard();
    }, 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --------------------------------------------------------------------------
  // 达到3张自动继续
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (drawCount >= 3 && !isTyping && !completedRef.current) {
      completedRef.current = true;
      const timer = setTimeout(() => {
        handleContinue();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [drawCount, isTyping, handleContinue]);

  // --------------------------------------------------------------------------
  // 组件卸载清理
  // --------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    };
  }, []);

  // --------------------------------------------------------------------------
  // 渲染
  // --------------------------------------------------------------------------
  return (
    <motion.div
      className="fixed inset-0 w-screen h-screen overflow-hidden flex flex-col items-center justify-center px-4"
      style={{ background: '#0a0a1a' }}
      initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* 背景星空渐变 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 40%, ${hexToRgba(colors.secondary, 0.06)} 0%, transparent 60%)`,
        }}
      />

      {/* 标题 */}
      <motion.div
        className="absolute top-8 left-0 w-full text-center z-10"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        <h2
          className="text-lg md:text-xl font-light"
          style={{
            color: '#e2e8f0',
            textShadow: `0 0 15px ${hexToRgba(colors.primary, 0.4)}`,
          }}
        >
          {drawCount === 0 ? '翻开你的幸运卡片' : `第 ${Math.min(drawCount, 3)} / 3 张`}
        </h2>
      </motion.div>

      {/* ===== 3D 翻转卡片 ===== */}
      <div
        className="relative z-10"
        style={{
          perspective: '1200px',
          width: 'min(380px, 90vw)',
          height: 'min(520px, 65vh)',
        }}
      >
        <motion.div
          className="w-full h-full relative"
          style={{
            transformStyle: 'preserve-3d',
          }}
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* ---- 正面：神秘宇宙图案 ---- */}
          <div
            className="absolute inset-0 rounded-3xl overflow-hidden"
            style={{
              backfaceVisibility: 'hidden',
              background: `
                radial-gradient(circle at 30% 30%, ${hexToRgba(colors.primary, 0.4)}, transparent 50%),
                radial-gradient(circle at 70% 60%, ${hexToRgba(colors.secondary, 0.4)}, transparent 50%),
                radial-gradient(circle at 50% 50%, ${hexToRgba('#ec4899', 0.2)}, transparent 70%),
                linear-gradient(135deg, #0d0d2b, #1a1a3e)
              `,
              border: `1px solid ${hexToRgba(colors.primary, 0.3)}`,
              boxShadow: `
                0 0 40px ${hexToRgba(colors.primary, 0.2)},
                0 20px 60px rgba(0, 0, 0, 0.4),
                inset 0 0 60px ${hexToRgba(colors.secondary, 0.1)}
              `,
            }}
          >
            {/* 宇宙装饰图案 */}
            <div className="absolute inset-0 flex items-center justify-center">
              {/* 中心发光核心 */}
              <div
                className="absolute"
                style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  background: `radial-gradient(circle, ${hexToRgba(colors.primary, 0.4)}, ${hexToRgba(colors.secondary, 0.1)}, transparent)`,
                  animation: 'card-glow 3s ease-in-out infinite',
                }}
              />
              {/* 星云线条 */}
              <div
                className="absolute"
                style={{
                  width: '200px',
                  height: '2px',
                  background: `linear-gradient(90deg, transparent, ${hexToRgba(colors.primary, 0.4)}, transparent)`,
                  transform: 'rotate(-30deg)',
                }}
              />
              <div
                className="absolute"
                style={{
                  width: '160px',
                  height: '2px',
                  background: `linear-gradient(90deg, transparent, ${hexToRgba(colors.secondary, 0.3)}, transparent)`,
                  transform: 'rotate(45deg)',
                }}
              />
              {/* 问号 */}
              <span
                className="text-6xl font-light"
                style={{
                  color: hexToRgba(colors.primary, 0.6),
                  textShadow: `0 0 30px ${hexToRgba(colors.primary, 0.5)}, 0 0 60px ${hexToRgba(colors.secondary, 0.3)}`,
                }}
              >
                ?
              </span>
            </div>

            {/* 正面提示文字 */}
            <div className="absolute bottom-8 left-0 w-full text-center">
              <p
                className="text-sm opacity-50"
                style={{ color: colors.primary }}
              >
                点击翻开
              </p>
            </div>

            {/* 装饰星星 */}
            {[
              { top: '15%', left: '20%', size: 4 },
              { top: '25%', right: '15%', size: 3 },
              { top: '60%', left: '12%', size: 2 },
              { top: '70%', right: '20%', size: 5 },
              { top: '40%', left: '80%', size: 3 },
            ].map((star, i) => (
              <div
                key={i}
                className="absolute"
                style={{
                  ...star,
                  width: `${star.size}px`,
                  height: `${star.size}px`,
                  borderRadius: '50%',
                  background: i % 2 === 0 ? colors.primary : colors.secondary,
                  boxShadow: `0 0 ${star.size * 3}px ${i % 2 === 0 ? hexToRgba(colors.primary, 0.5) : hexToRgba(colors.secondary, 0.5)}`,
                  animation: `star-twinkle ${2 + i * 0.3}s ease-in-out infinite`,
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>

          {/* ---- 背面：祝福内容 ---- */}
          <div
            className="absolute inset-0 rounded-3xl overflow-hidden flex flex-col"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              background: `
                linear-gradient(135deg, 
                  ${hexToRgba(colors.primary, 0.1)}, 
                  ${hexToRgba(colors.secondary, 0.05)},
                  rgba(255, 255, 255, 0.03)
                )
              `,
              border: `1px solid ${hexToRgba(colors.primary, 0.25)}`,
              boxShadow: `
                0 0 40px ${hexToRgba(colors.primary, 0.15)},
                0 20px 60px rgba(0, 0, 0, 0.4)
              `,
            }}
          >
            {/* 风格标签 */}
            <div className="pt-6 px-6">
              {currentStyle && (
                <motion.span
                  className="inline-block text-xs px-3 py-1 rounded-full"
                  style={{
                    background: `linear-gradient(135deg, ${hexToRgba(colors.primary, 0.2)}, ${hexToRgba(colors.secondary, 0.2)})`,
                    border: `1px solid ${hexToRgba(colors.primary, 0.3)}`,
                    color: colors.primary,
                  }}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.3 }}
                >
                  {STYLE_LABELS[currentStyle]}
                </motion.span>
              )}
            </div>

            {/* 祝福文字 */}
            <div className="flex-1 flex items-center px-8 pb-8 overflow-hidden">
              <p
                className="text-base md:text-lg leading-relaxed whitespace-pre-line w-full"
                style={{
                  color: '#e2e8f0',
                  textShadow: `0 0 8px ${hexToRgba(colors.primary, 0.15)}`,
                }}
              >
                {displayedText}
                {/* 打字机光标 */}
                {isTyping && (
                  <span
                    className="inline-block ml-0.5"
                    style={{
                      color: colors.primary,
                      animation: 'blink 1s step-end infinite',
                    }}
                  >
                    |
                  </span>
                )}
              </p>
            </div>

            {/* 顶部装饰线 */}
            <div
              className="absolute top-0 left-0 w-full h-1"
              style={{
                background: `linear-gradient(90deg, transparent, ${colors.primary}, ${colors.secondary}, transparent)`,
              }}
            />
          </div>
        </motion.div>
      </div>

      {/* 底部按钮区域 */}
      <div className="relative z-10 mt-8 flex gap-4">
        <AnimatePresence>
          {showButtons && !isTyping && (
            <>
              {/* 再抽一张按钮（最多抽3张） */}
              {drawCount < 3 && (
                <motion.button
                  className="px-6 py-3 rounded-full text-sm font-medium"
                  style={{
                    background: `linear-gradient(135deg, ${hexToRgba(colors.primary, 0.2)}, ${hexToRgba(colors.secondary, 0.2)})`,
                    border: `1px solid ${hexToRgba(colors.primary, 0.3)}`,
                    color: colors.primary,
                  }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                  onClick={handleRedraw}
                  whileHover={{
                    scale: 1.05,
                    boxShadow: `0 0 20px ${hexToRgba(colors.primary, 0.3)}`,
                  }}
                  whileTap={{ scale: 0.95 }}
                >
                  再抽一张 ({drawCount}/3)
                </motion.button>
              )}

              {/* 继续按钮 */}
              <motion.button
                className="btn-cosmic px-8 py-3 text-sm"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.4, delay: drawCount < 3 ? 0.2 : 0.1 }}
                onClick={handleContinue}
              >
                {drawCount >= 3 ? '继续' : '不再抽了'}
              </motion.button>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* 动画 keyframes */}
      <style jsx global>{`
        @keyframes card-glow {
          0%, 100% { 
            transform: scale(1); 
            opacity: 0.8; 
          }
          50% { 
            transform: scale(1.2); 
            opacity: 1; 
          }
        }
        @keyframes star-twinkle {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </motion.div>
  );
};

export default LuckyCard;
