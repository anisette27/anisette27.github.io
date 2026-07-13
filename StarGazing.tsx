'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { BirthdayData, AIGeneratedContent } from '../types';

// ============================================================================
// Props 接口定义
// ============================================================================
interface StarGazingProps {
  /** 寿星完整数据 */
  data: BirthdayData;
  /** AI 生成的运势内容（可为 null） */
  aiContent: AIGeneratedContent | null;
  /** 章节完成回调 */
  onComplete: () => void;
}

// ============================================================================
// 主题颜色映射表 —— 与 StarField / OpeningScene 保持一致
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
// 工具函数：十六进制颜色 → rgba 字符串
// ============================================================================
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ============================================================================
// 可交互星星数据结构
// ============================================================================
interface InteractiveStar {
  /** 相对于画布宽度的 x 坐标 (0~1) */
  rx: number;
  /** 相对于画布高度的 y 坐标 (0~1) */
  ry: number;
  /** 基础半径 (较大，5~10px) */
  baseSize: number;
  /** 脉冲动画相位偏移 */
  pulsePhase: number;
  /** 脉冲速度 */
  pulseSpeed: number;
  /** 颜色类型 */
  colorType: 'primary' | 'secondary';
  /** 是否已被点亮 */
  lit: boolean;
  /** 点击放大动画进度 (0~1，1 为完全放大) */
  scaleAnim: number;
  /** 关联的运势签文本 */
  fortuneText: string;
}

// ============================================================================
// 背景星星数据结构（与 StarField 类似，纯装饰）
// ============================================================================
interface BgStar {
  rx: number;
  ry: number;
  size: number;
  baseOpacity: number;
  twinkleSpeed: number;
  twinklePhase: number;
  depth: number;
}

// ============================================================================
// 银河粒子数据结构
// ============================================================================
interface GalaxyParticle {
  distance: number;
  angle: number;
  size: number;
  opacity: number;
  colorType: 'primary' | 'secondary';
}

// ============================================================================
// 本地生成个性化运势签（当 aiContent.fortune 不可用时作为兜底）
// ============================================================================
function generateLocalFortunes(data: BirthdayData): string[] {
  const fortunes: string[] = [
    `今日宜：拥抱梦想，${data.name}的宇宙正在为你展开新篇章。`,
    `好运提示：${data.favoriteColor}色能量场今日特别强，适合做重要决定。`,
    `宇宙来信：${data.favoriteAnimal}的灵性在指引你，前方的路充满光明。`,
    `今日运势：${data.dream ? `关于"${data.dream}"的梦想正在加速实现` : '内心深处的愿望即将成真'}。`,
    `星光预言：${data.age}岁的你，正处于人生最闪耀的阶段，请尽情绽放。`,
    `大吉签：今日社交运极佳，${data.interests}领域将有意外收获。`,
    `上上签：宇宙为${data.name}准备了一份特别礼物，请保持期待。`,
    `紫微星动：你近期的付出即将获得丰厚回报，坚持就是胜利。`,
    `天机星照：今日适合反思与规划，${data.name}的未来由你亲手书写。`,
    `幸运加持：心中有爱，眼里有光，${data.name}的每一天都值得纪念。`,
    `吉星高照：新的机遇正在向你走来，勇敢迎接属于你的精彩。`,
    `福星临门：今日正能量满满，${data.interests}将为你带来欢乐与灵感。`,
    `天赐良缘：${data.name}，今天是你与美好事物相遇的最佳时机。`,
    `瑞气盈门：${data.favoriteAnimal}守护星为你带来平安与幸福。`,
    `锦上添花：${data.dream ? `"${data.dream}"的梦想触手可及` : '一切美好正在路上'}，继续前行吧。`,
    `鸿运当头：宇宙为你铺设了一条闪耀的道路，勇敢迈步。`,
    `万事胜意：${data.name}，你就是自己最好的幸运符。`,
    `吉人天相：今日贵人运旺盛，留意身边的每一份善意。`,
    `紫气东来：属于${data.name}的黄金时代正在到来。`,
    `福禄双全：今日财运与桃花运双双在线，尽情享受生活的美好。`,
    `日月交辉：${data.name}的光芒无人能挡，前路一片坦途。`,
    `否极泰来：任何困难都只是暂时的，美好终将如期而至。`,
    `祥云瑞彩：今日宜出行、宜社交、宜做自己热爱的事。`,
    `贵人星临：${data.interests}方面的贵人即将出现，请敞开心扉。`,
    `天降鸿福：${data.name}，宇宙为你准备的惊喜正在路上。`,
  ];
  return fortunes;
}

// ============================================================================
// StarGazing 组件 —— 第二章节：星空互动
// ============================================================================
const StarGazing: React.FC<StarGazingProps> = ({ data, aiContent, onComplete }) => {
  // ======================== 主题颜色 ========================
  const colors = THEME_COLORS[data.theme] || THEME_COLORS['starry'];

  // ======================== 状态 ========================
  /** 已点亮的星星数量 */
  const [litCount, setLitCount] = useState<number>(0);
  /** 当前弹出的运势签文本 */
  const [activeFortune, setActiveFortune] = useState<string | null>(null);
  /** 是否显示运势签卡片 */
  const [showFortuneCard, setShowFortuneCard] = useState<boolean>(false);
  /** 是否已进入银河变亮阶段 (点亮 >= 1) */
  const [galaxyBrightening, setGalaxyBrightening] = useState<boolean>(false);
  /** 是否显示新星球飞入动画 */
  const [showNewPlanet, setShowNewPlanet] = useState<boolean>(false);
  /** 是否显示提示文字 */
  const [showHint, setShowHint] = useState<boolean>(false);
  /** 是否可以继续到下一章节 */
  const [canContinue, setCanContinue] = useState<boolean>(false);

  // ======================== Refs ========================
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const bgStarsRef = useRef<BgStar[]>([]);
  const galaxyRef = useRef<GalaxyParticle[]>([]);
  const interactiveStarsRef = useRef<InteractiveStar[]>([]);
  const timeRef = useRef<number>(0);
  const dimensionsRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const galaxyBrightnessRef = useRef<number>(0); // 银河亮度过渡 (0~1)
  const fortunePoolRef = useRef<string[]>([]);

  // --------------------------------------------------------------------------
  // 初始化运势签池
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (aiContent?.fortune) {
      // AI 内容可用时，以 AI fortune 为基础，再补充本地签
      const base = aiContent.fortune.split('\n').filter(s => s.trim().length > 0);
      const local = generateLocalFortunes(data);
      // 混合排列：AI签在前，本地签在后
      fortunePoolRef.current = [...base, ...local];
    } else {
      // 无 AI 内容，使用本地签
      fortunePoolRef.current = generateLocalFortunes(data);
    }
  }, [aiContent, data]);

  // --------------------------------------------------------------------------
  // 初始化背景星星
  // --------------------------------------------------------------------------
  const initBgStars = useCallback(() => {
    const stars: BgStar[] = [];
    const count = 400;
    for (let i = 0; i < count; i++) {
      stars.push({
        rx: Math.random(),
        ry: Math.random(),
        size: Math.random() * 2 + 0.5,
        baseOpacity: Math.random() * 0.6 + 0.3,
        twinkleSpeed: Math.random() * 0.03 + 0.005,
        twinklePhase: Math.random() * Math.PI * 2,
        depth: Math.random(),
      });
    }
    bgStarsRef.current = stars;
  }, []);

  // --------------------------------------------------------------------------
  // 初始化银河粒子
  // --------------------------------------------------------------------------
  const initGalaxy = useCallback(() => {
    const particles: GalaxyParticle[] = [];
    const count = 500;
    for (let i = 0; i < count; i++) {
      const spread = (Math.random() + Math.random() + Math.random()) / 3 * 2 - 1;
      particles.push({
        distance: Math.random(),
        angle: Math.PI * 0.25 + spread * 0.35,
        size: Math.random() * 1.8 + 0.3,
        opacity: Math.random() * 0.4 + 0.1,
        colorType: Math.random() > 0.5 ? 'primary' : 'secondary',
      });
    }
    galaxyRef.current = particles;
  }, []);

  // --------------------------------------------------------------------------
  // 初始化可交互星星（20~30 颗，避免边缘区域）
  // --------------------------------------------------------------------------
  const initInteractiveStars = useCallback(() => {
    const stars: InteractiveStar[] = [];
    // 生成 25 颗可点击星星
    const count = 20 + Math.floor(Math.random() * 11); // 20~30
    for (let i = 0; i < count; i++) {
      // 保持在安全区域内（距边缘 10%~90%）
      const rx = 0.1 + Math.random() * 0.8;
      const ry = 0.1 + Math.random() * 0.8;
      stars.push({
        rx,
        ry,
        baseSize: 5 + Math.random() * 5, // 5~10px
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.02 + Math.random() * 0.02,
        colorType: Math.random() > 0.5 ? 'primary' : 'secondary',
        lit: false,
        scaleAnim: 0,
        fortuneText: '', // 点击时再分配
      });
    }
    interactiveStarsRef.current = stars;
  }, []);

  // --------------------------------------------------------------------------
  // 处理画布尺寸（支持高 DPI）
  // --------------------------------------------------------------------------
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }

    dimensionsRef.current = { w, h };
  }, []);

  // --------------------------------------------------------------------------
  // 绘制单颗可交互星星（含脉冲发光效果）
  // --------------------------------------------------------------------------
  const drawInteractiveStar = (
    ctx: CanvasRenderingContext2D,
    star: InteractiveStar,
    w: number,
    h: number,
    time: number,
  ) => {
    const x = star.rx * w;
    const y = star.ry * h;
    const color = star.colorType === 'primary' ? colors.primary : colors.secondary;

    // 脉冲效果（未点亮时闪烁，点亮后持续发光）
    let pulse = 0;
    if (!star.lit) {
      // 未点亮：脉冲闪烁
      pulse = 0.5 + 0.5 * Math.sin(time * star.pulseSpeed + star.pulsePhase);
    } else {
      // 已点亮：持续稳定发光，带微弱呼吸
      pulse = 0.8 + 0.2 * Math.sin(time * 0.01 + star.pulsePhase);
    }

    // 点击放大动画
    const scale = 1 + star.scaleAnim * 0.8;
    const currentSize = star.baseSize * scale;

    // 外层光晕
    const glowRadius = currentSize * (star.lit ? 6 : 4) * pulse;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
    glow.addColorStop(0, hexToRgba(color, (star.lit ? 0.6 : 0.3) * pulse));
    glow.addColorStop(0.4, hexToRgba(color, (star.lit ? 0.3 : 0.15) * pulse));
    glow.addColorStop(1, hexToRgba(color, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // 中层光环（点亮后更明显）
    if (star.lit) {
      const ringRadius = currentSize * 3;
      const ring = ctx.createRadialGradient(x, y, currentSize * 0.5, x, y, ringRadius);
      ring.addColorStop(0, hexToRgba('#ffffff', 0.15 * pulse));
      ring.addColorStop(1, hexToRgba(color, 0));
      ctx.fillStyle = ring;
      ctx.beginPath();
      ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // 星星核心（十字光芒）
    ctx.save();
    ctx.globalAlpha = (star.lit ? 1 : 0.7 + 0.3 * pulse);
    ctx.fillStyle = hexToRgba('#ffffff', 1);
    ctx.beginPath();
    ctx.arc(x, y, currentSize * 0.6, 0, Math.PI * 2);
    ctx.fill();

    // 十字光芒线
    const lineLen = currentSize * (star.lit ? 2.5 : 1.8) * pulse;
    ctx.strokeStyle = hexToRgba(color, 0.6 * pulse);
    ctx.lineWidth = star.lit ? 1.5 : 1;
    ctx.beginPath();
    ctx.moveTo(x - lineLen, y);
    ctx.lineTo(x + lineLen, y);
    ctx.moveTo(x, y - lineLen);
    ctx.lineTo(x, y + lineLen);
    ctx.stroke();

    ctx.restore();
  };

  // --------------------------------------------------------------------------
  // 主绘制循环
  // --------------------------------------------------------------------------
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { w, h } = dimensionsRef.current;
    if (w === 0 || h === 0) return;

    timeRef.current += 1;
    const t = timeRef.current;

    // --- 清空画布 ---
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, w, h);

    // --- 微弱背景径向渐变 ---
    const bgGrad = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.7);
    bgGrad.addColorStop(0, hexToRgba(colors.secondary, 0.05 + galaxyBrightnessRef.current * 0.15));
    bgGrad.addColorStop(0.5, hexToRgba(colors.primary, 0.02 + galaxyBrightnessRef.current * 0.08));
    bgGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // --- 银河变亮叠加渐变 ---
    if (galaxyBrightnessRef.current > 0) {
      const brightGrad = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.5);
      brightGrad.addColorStop(0, hexToRgba(colors.secondary, galaxyBrightnessRef.current * 0.12));
      brightGrad.addColorStop(0.6, hexToRgba(colors.primary, galaxyBrightnessRef.current * 0.06));
      brightGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = brightGrad;
      ctx.fillRect(0, 0, w, h);
    }

    // ==============================
    // 绘制银河粒子
    // ==============================
    const cx = w * 0.5;
    const cy = h * 0.5;
    const galaxyLength = Math.max(w, h) * 0.85;
    const galaxyRotation = t * 0.0003;
    // 银河亮度：基础亮度 + 额外亮度（点亮 5 颗星后）
    const galaxyAlphaMultiplier = 1 + galaxyBrightnessRef.current * 1.5;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    for (const p of galaxyRef.current) {
      const pos = p.distance * galaxyLength;
      const a = p.angle + galaxyRotation;
      const px = cx + Math.cos(a) * pos;
      const py = cy + Math.sin(a) * pos;

      const distFade = 1 - Math.abs(p.distance - 0.5) * 1.4;
      const flicker = 0.7 + 0.3 * Math.sin(t * 0.02 + p.distance * 10);
      const alpha = Math.max(0, p.opacity * distFade * flicker * galaxyAlphaMultiplier);
      const color = p.colorType === 'primary' ? colors.primary : colors.secondary;

      const grad = ctx.createRadialGradient(px, py, 0, px, py, p.size * 2);
      grad.addColorStop(0, hexToRgba(color, alpha));
      grad.addColorStop(0.5, hexToRgba(color, alpha * 0.3));
      grad.addColorStop(1, hexToRgba(color, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, p.size * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // ==============================
    // 绘制背景星星（闪烁）
    // ==============================
    for (const star of bgStarsRef.current) {
      const twinkle = Math.sin(t * star.twinkleSpeed + star.twinklePhase);
      const opacity = star.baseOpacity * (0.6 + 0.4 * twinkle);
      const sx = star.rx * w;
      const sy = star.ry * h;
      const color = star.depth > 0.5 ? colors.primary : colors.secondary;

      ctx.save();
      ctx.globalAlpha = opacity;

      if (star.size > 1.5) {
        const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, star.size * 3);
        glow.addColorStop(0, hexToRgba(color, 0.4));
        glow.addColorStop(1, hexToRgba(color, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(sx, sy, star.size * 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = hexToRgba(color, 1);
      ctx.beginPath();
      ctx.arc(sx, sy, star.size, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // ==============================
    // 绘制可交互星星（脉冲发光，可点击）
    // ==============================
    for (const star of interactiveStarsRef.current) {
      // 更新点击放大动画衰减
      if (star.scaleAnim > 0 && star.lit) {
        // 放大动画：先快速放大到 1，然后缓慢回到 0（保持放大效果由 lit 状态处理）
        star.scaleAnim = Math.max(0, star.scaleAnim - 0.02);
      }
      drawInteractiveStar(ctx, star, w, h, t);
    }

    // --- 下一帧 ---
    animFrameRef.current = requestAnimationFrame(draw);
  }, [colors]);

  // --------------------------------------------------------------------------
  // 处理画布点击事件 —— 判断是否点击到星星
  // --------------------------------------------------------------------------
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / rect.width;
    const clickY = (e.clientY - rect.top) / rect.height;

    const { w, h } = dimensionsRef.current;

    // 遍历星星，找到距离最近且在点击半径内的星星
    let closestStar: InteractiveStar | null = null;
    let closestDist = Infinity;

    for (const star of interactiveStarsRef.current) {
      // 已点亮的星星不响应点击
      if (star.lit) continue;

      const sx = star.rx * w;
      const sy = star.ry * h;
      const dist = Math.hypot(e.clientX - (rect.left + star.rx * rect.width), e.clientY - (rect.top + star.ry * rect.height));
      // 点击判定半径：星星半径的 2 倍 + 额外容差
      const hitRadius = star.baseSize * 3 + 15;

      if (dist < hitRadius && dist < closestDist) {
        closestDist = dist;
        closestStar = star;
      }
    }

    if (!closestStar) return;

    // 点亮星星
    closestStar.lit = true;
    closestStar.scaleAnim = 1; // 触发放大动画

    // 分配运势签（从签池中按顺序取，循环使用）
    const currentLitCount = interactiveStarsRef.current.filter(s => s.lit).length;
    const fortuneIndex = (currentLitCount - 1) % fortunePoolRef.current.length;
    closestStar.fortuneText = fortunePoolRef.current[fortuneIndex];

    // 更新已点亮数量
    setLitCount(currentLitCount);

    // 显示运势签
    setActiveFortune(closestStar.fortuneText);
    setShowFortuneCard(true);

    // 检查是否达到 1 颗阈值
    if (currentLitCount >= 1 && !galaxyBrightnessRef.current) {
      setGalaxyBrightening(true);
      // 2 秒后显示新星球和提示
      setTimeout(() => {
        setShowNewPlanet(true);
        setShowHint(true);
      }, 2000);
      // 5 秒后允许继续
      setTimeout(() => {
        setCanContinue(true);
      }, 5000);
    }
  }, []);

  // --------------------------------------------------------------------------
  // 关闭运势签卡片
  // --------------------------------------------------------------------------
  const closeFortuneCard = useCallback(() => {
    setShowFortuneCard(false);
    setActiveFortune(null);
  }, []);

  // --------------------------------------------------------------------------
  // 银河变亮动画（galaxyBrightness 从 0 渐变到 1）
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!galaxyBrightening) return;

    const interval = setInterval(() => {
      if (galaxyBrightnessRef.current < 1) {
        galaxyBrightnessRef.current = Math.min(1, galaxyBrightnessRef.current + 0.01);
      } else {
        clearInterval(interval);
      }
    }, 30);

    return () => clearInterval(interval);
  }, [galaxyBrightening]);

  // --------------------------------------------------------------------------
  // 初始化并启动动画循环
  // --------------------------------------------------------------------------
  useEffect(() => {
    handleResize();
    const { w, h } = dimensionsRef.current;

    initBgStars();
    initGalaxy();
    initInteractiveStars();

    animFrameRef.current = requestAnimationFrame(draw);
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [handleResize, initBgStars, initGalaxy, initInteractiveStars, draw]);

  // --------------------------------------------------------------------------
  // 渲染
  // --------------------------------------------------------------------------
  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden" style={{ background: '#0a0a1a' }}>
      {/* 全屏 Canvas —— 银河背景 + 可点击星星 */}
      <canvas
        ref={canvasRef}
        className="canvas-fullscreen"
        style={{ cursor: 'pointer', pointerEvents: 'auto' }}
        onClick={handleCanvasClick}
        aria-label="星空互动画布，点击星星查看运势签"
      />

      {/* 章节标题提示 */}
      <motion.div
        className="absolute top-8 left-1/2 -translate-x-1/2 z-10 pointer-events-none"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.5 }}
      >
        <p
          className="text-lg md:text-xl font-light text-center whitespace-nowrap"
          style={{
            color: hexToRgba(colors.primary, 0.8),
            textShadow: `0 0 20px ${hexToRgba(colors.secondary, 0.4)}`,
          }}
        >
          点击星星，发现你的运势
        </p>
      </motion.div>

      {/* 已点亮星星计数 */}
      <motion.div
        className="absolute top-16 left-1/2 -translate-x-1/2 z-10 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: litCount > 0 ? 1 : 0 }}
        transition={{ duration: 0.5 }}
      >
        <p
          className="text-sm font-light text-center"
          style={{
            color: hexToRgba(colors.secondary, 0.6),
          }}
        >
          已点亮 {litCount} 颗星星
        </p>
      </motion.div>

      {/* ============================================================ */}
      {/* 运势签卡片 —— glass-strong 玻璃拟态弹窗 */}
      {/* ============================================================ */}
      <AnimatePresence>
        {showFortuneCard && activeFortune && (
          <motion.div
            className="absolute inset-0 z-20 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* 半透明遮罩（点击可关闭） */}
            <motion.div
              className="absolute inset-0 bg-black/40"
              onClick={closeFortuneCard}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            {/* 玻璃拟态签卡 */}
            <motion.div
              className="glass-strong relative z-30 p-8 md:p-10 max-w-md w-[90%]"
              initial={{ scale: 0.7, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            >
              {/* 关闭按钮 */}
              <button
                onClick={closeFortuneCard}
                className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all"
                aria-label="关闭运势签"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="4" y1="4" x2="12" y2="12" />
                  <line x1="12" y1="4" x2="4" y2="12" />
                </svg>
              </button>

              {/* 签标题 */}
              <h2
                className="text-center text-xl md:text-2xl font-semibold mb-6"
                style={{
                  background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  textShadow: 'none',
                }}
              >
                {'\u2728'} 今日大吉上上签 {'\u2728'}
              </h2>

              {/* 分隔线 */}
              <div
                className="w-16 h-px mx-auto mb-6"
                style={{
                  background: `linear-gradient(90deg, transparent, ${colors.primary}, transparent)`,
                }}
              />

              {/* 签内容 */}
              <p className="text-center text-base md:text-lg leading-relaxed" style={{ color: '#e2e8f0' }}>
                {activeFortune}
              </p>

              {/* 底部装饰 */}
              <div
                className="w-full h-px mt-6"
                style={{
                  background: `linear-gradient(90deg, transparent, ${colors.secondary}40, transparent)`,
                }}
              />
              <p className="text-center text-xs mt-3" style={{ color: hexToRgba(colors.secondary, 0.4) }}>
                Birthday Galaxy {'\u00B7'} Star Fortune
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================ */}
      {/* 新星球飞入动画（点亮 1 颗后出现） */}
      {/* ============================================================ */}
      <AnimatePresence>
        {showNewPlanet && (
          <motion.div
            className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"
          >
            {/* 发光球体 */}
            <motion.div
              className="relative"
              initial={{ scale: 0, opacity: 0, x: 200, y: -200 }}
              animate={{ scale: 1, opacity: 1, x: 0, y: 0 }}
              transition={{ type: 'spring', damping: 15, stiffness: 80, duration: 2 }}
            >
              {/* 外层光晕 */}
              <motion.div
                className="absolute -inset-16 rounded-full"
                style={{
                  background: `radial-gradient(circle, ${hexToRgba(colors.primary, 0.2)}, transparent 70%)`,
                }}
                animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.9, 0.6] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              />
              {/* 球体本身 */}
              <div
                className="w-24 h-24 md:w-32 md:h-32 rounded-full relative"
                style={{
                  background: `radial-gradient(circle at 35% 35%, ${hexToRgba(colors.primary, 0.9)}, ${colors.secondary} 60%, ${hexToRgba('#1a1a40', 1)})`,
                  boxShadow: `0 0 40px ${hexToRgba(colors.primary, 0.6)}, 0 0 80px ${hexToRgba(colors.secondary, 0.3)}, inset 0 0 20px rgba(255,255,255,0.1)`,
                }}
              >
                {/* 模拟陆地纹理 */}
                <div
                  className="absolute w-8 h-6 rounded-full top-4 left-6 opacity-30"
                  style={{ background: `radial-gradient(ellipse, ${hexToRgba(colors.secondary, 0.5)}, transparent)` }}
                />
                <div
                  className="absolute w-6 h-4 rounded-full bottom-6 right-4 opacity-20"
                  style={{ background: `radial-gradient(ellipse, ${hexToRgba(colors.primary, 0.4)}, transparent)` }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 提示文字：新星球出现 */}
      <AnimatePresence>
        {showHint && (
          <motion.div
            className="absolute bottom-32 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.5 }}
          >
            <p
              className="text-center text-base md:text-lg font-light whitespace-nowrap"
              style={{
                color: hexToRgba(colors.primary, 0.8),
                textShadow: `0 0 15px ${hexToRgba(colors.secondary, 0.5)}`,
              }}
            >
              你已点亮了 {litCount} 颗星星，新的星球正在出现...
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 继续按钮（可手动继续，或点亮 5 颗后自动出现） */}
      <AnimatePresence>
        {canContinue && (
          <motion.div
            className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1 }}
          >
            <button
              onClick={onComplete}
              className="btn-cosmic"
            >
              继续旅程
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StarGazing;
