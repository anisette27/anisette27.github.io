'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { BirthdayData, ThemeType } from '../types';

// ============================================================================
// Props 接口定义
// ============================================================================
interface BirthdayTreeProps {
  /** 寿星完整数据 */
  data: BirthdayData;
  /** 游戏进度：0=初始, 1=输入信息, 2=小游戏, 3=AI祝福, 4=烟花 */
  gameProgress: number;
  /** 完成回调 */
  onComplete: () => void;
  /** 是否显示返回按钮（从图标进入时为 true） */
  showReturnButton?: boolean;
  /** 返回上一章节回调 */
  onReturn?: () => void;
}

// ============================================================================
// 主题颜色适配映射
// ============================================================================
const THEME_TREE_COLORS: Record<string, {
  leaf: string;
  leafAlt: string;
  flower: string;
  flowerAlt: string;
  fruit: string;
  trunk: string;
  particle: string;
}> = {
  starry:  { leaf: '#4facfe', leafAlt: '#a78bfa', flower: '#c084fc', flowerAlt: '#e879f9', fruit: '#fbbf24', trunk: '#8B5E3C', particle: '#4facfe' },
  sakura:  { leaf: '#4ade80', leafAlt: '#34d399', flower: '#f472b6', flowerAlt: '#fb7185', fruit: '#fbbf24', trunk: '#8B5E3C', particle: '#f472b6' },
  candy:   { leaf: '#fb923c', leafAlt: '#fbbf24', flower: '#f472b6', flowerAlt: '#e879f9', fruit: '#ef4444', trunk: '#92400e', particle: '#fb923c' },
  ocean:   { leaf: '#22d3ee', leafAlt: '#06b6d4', flower: '#60a5fa', flowerAlt: '#818cf8', fruit: '#fbbf24', trunk: '#78716c', particle: '#22d3ee' },
  forest:  { leaf: '#34d399', leafAlt: '#22c55e', flower: '#f472b6', flowerAlt: '#fb7185', fruit: '#fbbf24', trunk: '#5c3d2e', particle: '#34d399' },
  castle:  { leaf: '#c084fc', leafAlt: '#a78bfa', flower: '#f9a8d4', flowerAlt: '#f0abfc', fruit: '#fbbf24', trunk: '#78716c', particle: '#c084fc' },
  aurora:  { leaf: '#34d399', leafAlt: '#a78bfa', flower: '#f472b6', flowerAlt: '#60a5fa', fruit: '#fbbf24', trunk: '#6b7280', particle: '#a78bfa' },
  chinese: { leaf: '#22c55e', leafAlt: '#16a34a', flower: '#ef4444', flowerAlt: '#f97316', fruit: '#fbbf24', trunk: '#7c2d12', particle: '#ef4444' },
  tech:    { leaf: '#06b6d4', leafAlt: '#8b5cf6', flower: '#a78bfa', flowerAlt: '#ec4899', fruit: '#fbbf24', trunk: '#525252', particle: '#06b6d4' },
};

// ============================================================================
// 进度阶段标签
// ============================================================================
const STAGE_LABELS = ['种子', '发芽', '长叶', '开花', '结果'] as const;

// ============================================================================
// 工具函数
// ============================================================================
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** 线性插值 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 缓动函数 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// ============================================================================
// 萤火虫粒子数据结构
// ============================================================================
interface FireflyParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  color: string;
  life: number;
  maxLife: number;
  /** 随机相位偏移，让每个粒子动画不同步 */
  phase: number;
}

// ============================================================================
// BirthdayTree 组件
// ============================================================================
const BirthdayTree: React.FC<BirthdayTreeProps> = ({ data, gameProgress, onComplete, showReturnButton = false, onReturn }) => {
  // ======================== 状态 ========================
  const [showComplete, setShowComplete] = useState(false);

  // ======================== Refs ========================
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const currentGrowthRef = useRef<number>(0);   // 当前生长值（0-1），用于平滑插值
  const targetGrowthRef = useRef<number>(0);    // 目标生长值
  const dimensionsRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const particlesRef = useRef<FireflyParticle[]>([]);
  const startTimeRef = useRef<number>(0);

  // ======================== 主题颜色 ========================
  const themeColors = THEME_TREE_COLORS[data.theme] || THEME_TREE_COLORS['starry'];

  // --------------------------------------------------------------------------
  // 根据 gameProgress 计算目标 growth (0-1)
  // --------------------------------------------------------------------------
  useEffect(() => {
    // 每个阶段映射到 0~1 之间的一段
    const growthMap = [0, 0.15, 0.4, 0.7, 1.0];
    targetGrowthRef.current = growthMap[Math.min(gameProgress, 4)];

    // growth=1 时延迟显示完成状态
    if (gameProgress >= 4) {
      const timer = setTimeout(() => setShowComplete(true), 1200);
      return () => clearTimeout(timer);
    } else {
      setShowComplete(false);
    }
  }, [gameProgress]);

  // --------------------------------------------------------------------------
  // 创建萤火虫粒子
  // --------------------------------------------------------------------------
  const createParticles = useCallback((w: number, h: number, growth: number) => {
    // 只有在较高生长阶段才有粒子
    const particleCount = growth > 0.7 ? Math.floor(growth * 20) : 0;
    const particles: FireflyParticle[] = [];
    const colors = [themeColors.particle, themeColors.fruit, '#ffffff', themeColors.flower];

    for (let i = 0; i < particleCount; i++) {
      // 粒子在树冠范围内生成
      const treeCenterX = w / 2;
      const treeTop = h * 0.15;
      const treeBottom = h * 0.65;

      particles.push({
        x: treeCenterX + (Math.random() - 0.5) * w * 0.5,
        y: treeTop + Math.random() * (treeBottom - treeTop),
        vx: (Math.random() - 0.5) * 0.5,
        vy: Math.random() * -0.3 - 0.1, // 缓慢上升
        size: Math.random() * 3 + 1,
        opacity: 0,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 0,
        maxLife: Math.random() * 200 + 100,
        phase: Math.random() * Math.PI * 2,
      });
    }

    return particles;
  }, [themeColors]);

  // --------------------------------------------------------------------------
  // 绘制函数
  // --------------------------------------------------------------------------
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { w, h } = dimensionsRef.current;
    if (w === 0 || h === 0) return;

    const now = performance.now();

    // --- 平滑插值 growth ---
    const currentGrowth = currentGrowthRef.current;
    const targetGrowth = targetGrowthRef.current;
    const speed = 0.015; // 插值速度
    if (Math.abs(currentGrowth - targetGrowth) > 0.001) {
      currentGrowthRef.current = lerp(currentGrowth, targetGrowth, speed);
    } else {
      currentGrowthRef.current = targetGrowth;
    }
    const growth = currentGrowthRef.current;

    // --- 清空画布 ---
    ctx.clearRect(0, 0, w, h);

    // --- 坐标系参数 ---
    const baseX = w / 2;          // 树根底部中心 X
    const baseY = h * 0.75;      // 树根底部 Y
    const trunkHeight = h * 0.35 * Math.min(1, growth * 3);  // 主干高度，快速生长
    const trunkWidth = 8 + growth * 12; // 主干宽度

    // ====================== 阶段 0：种子 ======================
    if (growth < 0.05) {
      // 种子发光
      const seedGlow = ctx.createRadialGradient(baseX, baseY, 0, baseX, baseY, 20);
      seedGlow.addColorStop(0, hexToRgba(themeColors.fruit, 0.6));
      seedGlow.addColorStop(1, hexToRgba(themeColors.fruit, 0));
      ctx.fillStyle = seedGlow;
      ctx.beginPath();
      ctx.arc(baseX, baseY, 20, 0, Math.PI * 2);
      ctx.fill();

      // 种子本体
      ctx.fillStyle = themeColors.fruit;
      ctx.beginPath();
      ctx.arc(baseX, baseY, 6, 0, Math.PI * 2);
      ctx.fill();

      // 土壤
      ctx.fillStyle = hexToRgba('#5c3d2e', 0.6);
      ctx.beginPath();
      ctx.ellipse(baseX, baseY + 8, 30, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // ====================== 主干 ======================
    if (growth >= 0.05) {
      const trunkProgress = Math.min(1, (growth - 0.05) / 0.25); // growth 0.05~0.3 = 主干生长
      const actualHeight = trunkHeight * easeOutCubic(trunkProgress);
      const topY = baseY - actualHeight;

      // 主干贝塞尔曲线
      ctx.save();
      ctx.strokeStyle = themeColors.trunk;
      ctx.lineWidth = trunkWidth * (0.6 + trunkProgress * 0.4);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);

      // 微微弯曲的主干
      const bendX = Math.sin(now * 0.001) * 3 * growth; // 轻微摇摆
      ctx.bezierCurveTo(
        baseX + bendX - 5, baseY - actualHeight * 0.33,
        baseX + bendX + 5, baseY - actualHeight * 0.66,
        baseX + bendX, topY
      );
      ctx.stroke();

      // 主干纹理（深色线条）
      ctx.strokeStyle = hexToRgba('#000000', 0.15);
      ctx.lineWidth = trunkWidth * 0.3;
      ctx.beginPath();
      ctx.moveTo(baseX + 2, baseY);
      ctx.bezierCurveTo(
        baseX + bendX - 3, baseY - actualHeight * 0.33,
        baseX + bendX + 3, baseY - actualHeight * 0.66,
        baseX + bendX + 2, topY
      );
      ctx.stroke();
      ctx.restore();
    }

    // ====================== 分支 ======================
    if (growth > 0.2) {
      const branchGrowth = Math.min(1, (growth - 0.2) / 0.3); // growth 0.2~0.5 = 分支
      const trunkProgress = Math.min(1, (growth - 0.05) / 0.25);
      const actualHeight = trunkHeight * easeOutCubic(trunkProgress);
      const topY = baseY - actualHeight;

      // 分支数据：[起点高度比例, 角度, 长度, 左右]
      const branches = [
        { h: 0.3, angle: -35, len: 0.6, side: -1 },
        { h: 0.35, angle: 30, len: 0.55, side: 1 },
        { h: 0.55, angle: -45, len: 0.7, side: -1 },
        { h: 0.5, angle: 40, len: 0.65, side: 1 },
        { h: 0.7, angle: -25, len: 0.5, side: -1 },
        { h: 0.68, angle: 35, len: 0.45, side: 1 },
        { h: 0.85, angle: -50, len: 0.4, side: -1 },
        { h: 0.9, angle: 45, len: 0.35, side: 1 },
        { h: 0.95, angle: -15, len: 0.3, side: -1 },
        { h: 0.98, angle: 20, len: 0.25, side: 1 },
      ];

      const bendX = Math.sin(now * 0.001) * 3 * growth;

      for (let bi = 0; bi < branches.length; bi++) {
        const branch = branches[bi];
        if (branch.h > trunkProgress * 1.1) continue; // 超出主干高度的不画

        const branchDelay = branch.h; // 越高的分支越晚出现
        const branchProgress = Math.max(0, Math.min(1, (branchGrowth - branchDelay + 0.3) / 0.4));
        if (branchProgress <= 0) continue;

        const startX = baseX + bendX * branch.h;
        const startY = lerp(baseY, topY, branch.h);
        const angleRad = (branch.angle * branch.side) * (Math.PI / 180);
        const length = (30 + branch.len * 50) * easeOutCubic(branchProgress) * (0.5 + growth * 0.5);
        const endX = startX + Math.cos(angleRad) * length * branch.side;
        const endY = startY - Math.abs(Math.sin(angleRad)) * length;

        // 控制点（使用确定性偏移避免闪烁）
        const seed = bi * 7.3;
        const cpX = (startX + endX) / 2 + (Math.sin(seed) * 0.5) * 5;
        const cpY = (startY + endY) / 2 - 10;

        ctx.save();
        ctx.strokeStyle = themeColors.trunk;
        ctx.lineWidth = Math.max(2, trunkWidth * 0.3 * (1 - branch.h * 0.5));
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(cpX, cpY, endX, endY);
        ctx.stroke();
        ctx.restore();

        // 在分支末端画叶子（如果 growth > 0.4）
        if (growth > 0.4) {
          const leafGrowth = Math.min(1, (growth - 0.4) / 0.3);
          drawLeaf(ctx, endX, endY, leafGrowth, now, themeColors, bi);
        }

        // 在分支中段画花朵（如果 growth > 0.6），使用确定性条件
        if (growth > 0.6) {
          const flowerGrowth = Math.min(1, (growth - 0.6) / 0.2);
          const midX = (startX + endX) / 2;
          const midY = (startY + endY) / 2 - 5;
          const showFlower = (Math.sin(bi * 3.7 + 1.2) * 0.5 + 0.5) < flowerGrowth;
          if (showFlower) {
            drawFlower(ctx, midX, midY, flowerGrowth, now, themeColors, bi);
          }
        }

        // 在分支末端画果实（如果 growth > 0.85），使用确定性条件
        if (growth > 0.85) {
          const fruitGrowth = Math.min(1, (growth - 0.85) / 0.15);
          const showFruit = (Math.sin(bi * 5.1 + 2.3) * 0.5 + 0.5) < fruitGrowth;
          if (showFruit) {
            drawFruit(ctx, endX, endY + 5, fruitGrowth, now, themeColors, bi);
          }
        }
      }
    }

    // ====================== 萤火虫粒子 ======================
    if (growth > 0.6) {
      // 更新和绘制粒子
      const particles = particlesRef.current;
      // 如果粒子数量不够，创建新的
      if (particles.length < Math.floor(growth * 15)) {
        const newParticles = createParticles(w, h, growth);
        particlesRef.current = [...particles, ...newParticles];
      }

      for (const p of particlesRef.current) {
        p.life++;
        // 生命周期
        if (p.life > p.maxLife) {
          // 重置粒子
          p.x = w / 2 + (Math.random() - 0.5) * w * 0.5;
          p.y = h * 0.15 + Math.random() * (h * 0.5);
          p.life = 0;
          p.maxLife = Math.random() * 200 + 100;
          p.vx = (Math.random() - 0.5) * 0.5;
          p.vy = Math.random() * -0.3 - 0.1;
        }

        // 位移
        p.x += p.vx + Math.sin(now * 0.002 + p.phase) * 0.3;
        p.y += p.vy;

        // 透明度：呼吸效果
        const lifeRatio = p.life / p.maxLife;
        const fadeIn = Math.min(1, lifeRatio * 5);
        const fadeOut = Math.min(1, (1 - lifeRatio) * 5);
        const breathe = 0.5 + 0.5 * Math.sin(now * 0.005 + p.phase);
        p.opacity = fadeIn * fadeOut * breathe;

        // 绘制
        ctx.save();
        ctx.globalAlpha = p.opacity;

        // 发光光晕
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4);
        glow.addColorStop(0, hexToRgba(p.color, 0.4));
        glow.addColorStop(1, hexToRgba(p.color, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
        ctx.fill();

        // 核心
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }
    }

    // --- 继续下一帧 ---
    animFrameRef.current = requestAnimationFrame(draw);
  }, [themeColors, createParticles]);

  // --------------------------------------------------------------------------
  // 绘制叶子
  // --------------------------------------------------------------------------
  const drawLeaf = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    growth: number,
    time: number,
    colors: typeof THEME_TREE_COLORS['starry'],
    seed: number = 0,
  ) => {
    const size = (6 + Math.abs(Math.sin(seed * 4.1)) * 4) * growth;
    const sway = Math.sin(time * 0.002 + x * 0.01) * 2;

    ctx.save();
    ctx.translate(x + sway, y);
    ctx.rotate(Math.sin(time * 0.001 + y * 0.01) * 0.2);

    // 叶子主体（椭圆）
    const color = Math.sin(seed * 2.7) > 0 ? colors.leaf : colors.leafAlt;
    ctx.fillStyle = hexToRgba(color, 0.7 + growth * 0.3);
    ctx.beginPath();
    ctx.ellipse(0, 0, size, size * 0.5, Math.sin(seed * 1.3) * Math.PI, 0, Math.PI * 2);
    ctx.fill();

    // 叶子高光
    ctx.fillStyle = hexToRgba('#ffffff', 0.15);
    ctx.beginPath();
    ctx.ellipse(-size * 0.2, -size * 0.1, size * 0.4, size * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }, []);

  // --------------------------------------------------------------------------
  // 绘制花朵
  // --------------------------------------------------------------------------
  const drawFlower = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    growth: number,
    time: number,
    colors: typeof THEME_TREE_COLORS['starry'],
    seed: number = 0,
  ) => {
    const petalCount = 5;
    const petalSize = (4 + Math.abs(Math.sin(seed * 3.3)) * 3) * growth;
    const sway = Math.sin(time * 0.002 + x * 0.02) * 1.5;

    ctx.save();
    ctx.translate(x + sway, y);

    for (let i = 0; i < petalCount; i++) {
      const angle = (i / petalCount) * Math.PI * 2 + Math.sin(time * 0.001) * 0.1;
      const px = Math.cos(angle) * petalSize;
      const py = Math.sin(angle) * petalSize;

      const color = (i + seed) % 2 === 0 ? colors.flower : colors.flowerAlt;
      ctx.fillStyle = hexToRgba(color, 0.7 * growth);
      ctx.beginPath();
      ctx.ellipse(px, py, petalSize * 0.7, petalSize * 0.4, angle, 0, Math.PI * 2);
      ctx.fill();
    }

    // 花蕊
    ctx.fillStyle = hexToRgba('#fbbf24', 0.8 * growth);
    ctx.beginPath();
    ctx.arc(0, 0, petalSize * 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }, []);

  // --------------------------------------------------------------------------
  // 绘制果实
  // --------------------------------------------------------------------------
  const drawFruit = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    growth: number,
    time: number,
    colors: typeof THEME_TREE_COLORS['starry'],
    seed: number = 0,
  ) => {
    const size = (4 + Math.abs(Math.sin(seed * 5.7)) * 3) * growth;
    const sway = Math.sin(time * 0.0015 + x * 0.01) * 1;

    ctx.save();
    ctx.translate(x + sway, y);

    // 果实发光
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 3);
    glow.addColorStop(0, hexToRgba(colors.fruit, 0.3 * growth));
    glow.addColorStop(1, hexToRgba(colors.fruit, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, size * 3, 0, Math.PI * 2);
    ctx.fill();

    // 果实本体
    ctx.fillStyle = colors.fruit;
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();

    // 果实高光
    ctx.fillStyle = hexToRgba('#ffffff', 0.3 * growth);
    ctx.beginPath();
    ctx.arc(-size * 0.25, -size * 0.25, size * 0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }, []);

  // --------------------------------------------------------------------------
  // 处理画布尺寸
  // --------------------------------------------------------------------------
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const container = canvas.parentElement;
    const w = container ? container.clientWidth : window.innerWidth;
    const h = container ? container.clientHeight : window.innerHeight;

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
  // 初始化画布 + 启动动画循环
  // --------------------------------------------------------------------------
  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);

    // 初始化 growth
    const growthMap = [0, 0.15, 0.4, 0.7, 1.0];
    currentGrowthRef.current = growthMap[Math.min(gameProgress, 4)];
    targetGrowthRef.current = currentGrowthRef.current;

    startTimeRef.current = performance.now();
    animFrameRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [handleResize, draw, gameProgress]);

  // --------------------------------------------------------------------------
  // 组件卸载时清理动画帧
  // --------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // --------------------------------------------------------------------------
  // 渲染
  // --------------------------------------------------------------------------
  return (
    <motion.div
      className="fixed inset-0 w-screen h-screen overflow-hidden flex flex-col items-center"
      style={{ background: '#0a0a1a' }}
      initial={{ opacity: 0, y: 60, filter: 'blur(12px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -30, filter: 'blur(8px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* 背景渐变 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 60%, ${hexToRgba(themeColors.leaf, 0.06)} 0%, transparent 60%)`,
        }}
      />

      {/* ===== 标题 ===== */}
      <motion.div
        className="relative z-10 pt-8 pb-2 text-center"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6 }}
      >
        <h2
          className="text-2xl md:text-3xl font-bold"
          style={{
            background: `linear-gradient(135deg, ${themeColors.leaf}, ${themeColors.flower}, ${themeColors.fruit})`,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          你的生日之树
        </h2>
      </motion.div>

      {/* ===== Canvas 树区域 ===== */}
      <div className="relative z-10 flex-1 w-full max-w-lg mx-auto px-4 min-h-0">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ display: 'block' }}
          aria-label="生日树动画"
        />
      </div>

      {/* ===== 底部区域 ===== */}
      <div className="relative z-10 pb-6 flex flex-col items-center gap-4">
        {/* 进度指示器：5 个圆点 */}
        <div className="flex items-center gap-3">
          {STAGE_LABELS.map((label, index) => {
            const isActive = index <= gameProgress;
            const isCurrent = index === gameProgress;
            return (
              <div key={label} className="flex flex-col items-center gap-1">
                <motion.div
                  className="rounded-full"
                  style={{
                    width: isCurrent ? 14 : 10,
                    height: isCurrent ? 14 : 10,
                    background: isActive
                      ? index === 4
                        ? themeColors.fruit
                        : themeColors.leaf
                      : 'rgba(255,255,255,0.15)',
                    boxShadow: isActive
                      ? `0 0 10px ${hexToRgba(isCurrent ? themeColors.fruit : themeColors.leaf, 0.5)}`
                      : 'none',
                    border: isCurrent
                      ? `2px solid ${hexToRgba(themeColors.fruit, 0.6)}`
                      : 'none',
                  }}
                  animate={isCurrent ? { scale: [1, 1.2, 1] } : {}}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                />
                <span
                  className="text-xs"
                  style={{
                    color: isActive
                      ? hexToRgba(themeColors.leaf, 0.8)
                      : 'rgba(255,255,255,0.25)',
                  }}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {/* 完成状态文字 + 按钮 */}
        <AnimatePresence>
          {showComplete && (
            <motion.div
              className="flex flex-col items-center gap-4"
              initial={{ opacity: 0, y: 20, filter: 'blur(5px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            >
              <p
                className="text-lg md:text-xl font-medium text-center"
                style={{
                  color: '#ffffff',
                  textShadow: `0 0 20px ${hexToRgba(themeColors.fruit, 0.5)}, 0 0 40px ${hexToRgba(themeColors.leaf, 0.2)}`,
                }}
              >
                你的生日之树已成长为一棵参天大树
              </p>
              <motion.button
                className="btn-cosmic"
                onClick={onComplete}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                继续 &rarr;
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 返回按钮（从侧边图标进入时显示） */}
        {showReturnButton && onReturn && (
          <motion.button
            className="mt-4 px-6 py-2 rounded-full text-sm font-medium"
            style={{
              background: 'rgba(255,255,255,0.08)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#e2e8f0',
            }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            onClick={onReturn}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            ← 返回
          </motion.button>
        )}

        {/* 底部寓意文字 */}
        <motion.p
          className="text-sm opacity-40 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ delay: 1, duration: 1 }}
        >
          寓意：每一步经历，都是成长的养分
        </motion.p>
      </div>
    </motion.div>
  );
};

export default BirthdayTree;
