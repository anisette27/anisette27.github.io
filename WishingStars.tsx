'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { BirthdayData } from '../types';

// ============================================================================
// Props 接口定义
// ============================================================================
interface WishingStarsProps {
  /** 寿星完整数据 */
  data: BirthdayData;
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
// 愿望列表
// ============================================================================
const WISHES = ['健康', '快乐', '勇敢', '梦想', '财富', '友情', '爱情', '自由'];

// ============================================================================
// 星星数据结构
// ============================================================================
interface WishStar {
  /** 愿望名称 */
  label: string;
  /** 当前 x 坐标 */
  x: number;
  /** 当前 y 坐标 */
  y: number;
  /** 起始 x */
  originX: number;
  /** 起始 y */
  originY: number;
  /** 目标 x（收集目标位置） */
  targetX: number;
  /** 目标 y（收集目标位置） */
  targetY: number;
  /** 星星大小 */
  size: number;
  /** 透明度 */
  opacity: number;
  /** 浮动相位（sine wave 偏移） */
  floatPhase: number;
  /** 浮动速度 */
  floatSpeed: number;
  /** 浮动振幅 */
  floatAmplitude: number;
  /** 是否已被收集 */
  collected: boolean;
  /** 收集动画进度 0~1 */
  collectProgress: number;
  /** 闪烁相位 */
  twinklePhase: number;
  /** 颜色 */
  color: string;
}

// ============================================================================
// 爱心形状点生成 —— 参数方程
// ============================================================================
function getHeartPoints(cx: number, cy: number, scale: number, count: number) {
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2;
    // 心形参数方程
    const hx = 16 * Math.pow(Math.sin(t), 3);
    const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    points.push({
      x: cx + hx * scale,
      y: cy + hy * scale,
    });
  }
  return points;
}

// ============================================================================
// 动画阶段
// ============================================================================
type StarPhase = 'floating' | 'heart-forming' | 'complete';

// ============================================================================
// WishingStars 组件
// ============================================================================
const WishingStars: React.FC<WishingStarsProps> = ({ data, onComplete }) => {
  // ======================== 状态 ========================
  const [phase, setPhase] = useState<StarPhase>('floating');
  const [collectedWishes, setCollectedWishes] = useState<string[]>([]);

  // ======================== Refs ========================
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const starsRef = useRef<WishStar[]>([]);
  const dimensionsRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const phaseRef = useRef<StarPhase>('floating');
  const heartFormStartTimeRef = useRef<number>(0);
  const collectedRef = useRef<string[]>([]);

  // ======================== 主题颜色 ========================
  const colors = THEME_COLORS[data.theme] || THEME_COLORS['starry'];

  // --------------------------------------------------------------------------
  // 缓动函数
  // --------------------------------------------------------------------------
  const easeInOutCubic = (t: number): number =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  // --------------------------------------------------------------------------
  // 二次贝塞尔曲线点
  // --------------------------------------------------------------------------
  const bezierPoint = (
    t: number,
    p0: { x: number; y: number },
    p1: { x: number; y: number },
    p2: { x: number; y: number },
  ) => {
    const mt = 1 - t;
    return {
      x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
      y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
    };
  };

  // --------------------------------------------------------------------------
  // 初始化星星
  // --------------------------------------------------------------------------
  const initStars = useCallback((w: number, h: number) => {
    const stars: WishStar[] = [];
    const starColors = [colors.primary, colors.secondary, '#fbbf24', '#ec4899', '#ffffff'];
    // 收集目标位置：底部中央的蛋糕图标位置
    const targetX = w / 2;
    const targetY = h * 0.85;

    for (let i = 0; i < WISHES.length; i++) {
      // 均匀分布在画面中
      const col = i % 4;
      const row = Math.floor(i / 4);
      const marginX = w * 0.15;
      const marginY = h * 0.15;
      const areaW = w - marginX * 2;
      const areaH = h * 0.5;
      const spacingX = areaW / 3;
      const spacingY = areaH;

      stars.push({
        label: WISHES[i],
        x: marginX + col * spacingX + (Math.random() - 0.5) * 40,
        y: marginY + row * spacingY + (Math.random() - 0.5) * 40,
        originX: marginX + col * spacingX + (Math.random() - 0.5) * 40,
        originY: marginY + row * spacingY + (Math.random() - 0.5) * 40,
        targetX,
        targetY,
        size: Math.random() * 6 + 8,
        opacity: 1,
        floatPhase: Math.random() * Math.PI * 2,
        floatSpeed: Math.random() * 0.015 + 0.008,
        floatAmplitude: Math.random() * 20 + 15,
        collected: false,
        collectProgress: 0,
        twinklePhase: Math.random() * Math.PI * 2,
        color: starColors[i % starColors.length],
      });
    }

    starsRef.current = stars;
  }, [colors]);

  // --------------------------------------------------------------------------
  // 绘制五角星路径
  // --------------------------------------------------------------------------
  const drawStarShape = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    size: number,
  ) => {
    const spikes = 5;
    const outerRadius = size;
    const innerRadius = size * 0.4;
    let rot = -Math.PI / 2;

    ctx.beginPath();
    for (let i = 0; i < spikes; i++) {
      const xOuter = cx + Math.cos(rot) * outerRadius;
      const yOuter = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(xOuter, yOuter);
      rot += Math.PI / spikes;

      const xInner = cx + Math.cos(rot) * innerRadius;
      const yInner = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(xInner, yInner);
      rot += Math.PI / spikes;
    }
    ctx.closePath();
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

    const time = performance.now();
    const currentPhase = phaseRef.current;

    // 清空画布
    ctx.clearRect(0, 0, w, h);

    // --- 浮动阶段 ---
    if (currentPhase === 'floating') {
      for (const star of starsRef.current) {
        if (star.collected && star.collectProgress >= 1) continue;

        if (!star.collected) {
          // Sine wave 浮动
          const floatX = Math.sin(time * star.floatSpeed + star.floatPhase) * star.floatAmplitude * 0.5;
          const floatY = Math.cos(time * star.floatSpeed * 0.7 + star.floatPhase) * star.floatAmplitude;
          star.x = star.originX + floatX;
          star.y = star.originY + floatY;
        }

        // 收集动画：沿贝塞尔曲线飞向目标
        if (star.collected && star.collectProgress < 1) {
          star.collectProgress = Math.min(1, star.collectProgress + 0.02);
          const t = easeInOutCubic(star.collectProgress);

          // 控制点在起始和终点之间偏上
          const controlPoint = {
            x: (star.originX + star.targetX) / 2 + (star.originX - star.targetX) * 0.2,
            y: Math.min(star.originY, star.targetY) - 100,
          };
          const point = bezierPoint(
            t,
            { x: star.originX, y: star.originY },
            controlPoint,
            { x: star.targetX, y: star.targetY },
          );
          star.x = point.x;
          star.y = point.y;
          star.opacity = 1 - t * 0.3;
          star.size = Math.max(4, star.size * (1 - t * 0.3));
        }

        if (star.collectProgress >= 1) continue;

        // 闪烁
        const twinkle = 0.7 + 0.3 * Math.sin(time * 0.003 + star.twinklePhase);

        ctx.save();
        ctx.globalAlpha = star.opacity * twinkle;

        // 星星光晕
        const glowSize = star.collected ? star.size * 6 : star.size * 4;
        const glow = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, glowSize);
        glow.addColorStop(0, hexToRgba(star.color, star.collected ? 0.6 : 0.35));
        glow.addColorStop(1, hexToRgba(star.color, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(star.x, star.y, glowSize, 0, Math.PI * 2);
        ctx.fill();

        // 五角星形状
        drawStarShape(ctx, star.x, star.y, star.size);
        ctx.fillStyle = star.color;
        ctx.fill();

        // 愿望文字标签
        ctx.font = '12px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * twinkle})`;
        ctx.fillText(star.label, star.x, star.y + star.size + 6);

        ctx.restore();
      }

      // 底部蛋糕图标
      drawCakeIcon(ctx, w / 2, h * 0.88, time);
    }

    // --- 爱心形成阶段 ---
    if (currentPhase === 'heart-forming' || currentPhase === 'complete') {
      const elapsed = time - heartFormStartTimeRef.current;
      const heartDuration = 2500; // 2.5秒形成爱心
      const progress = Math.min(1, elapsed / heartDuration);
      const eased = easeInOutCubic(progress);

      // 获取爱心形状上的目标点
      const heartPoints = getHeartPoints(w / 2, h * 0.45, Math.min(w, h) * 0.018, WISHES.length);

      // 绘制从蛋糕位置到爱心位置飞行的星星
      for (let i = 0; i < starsRef.current.length; i++) {
        const star = starsRef.current[i];
        const heartPt = heartPoints[i % heartPoints.length];
        const startX = w / 2;
        const startY = h * 0.85;

        // 当前位置插值
        star.x = startX + (heartPt.x - startX) * eased;
        star.y = startY + (heartPt.y - startY) * eased;

        // 闪烁
        const twinkle = 0.7 + 0.3 * Math.sin(time * 0.005 + star.twinklePhase);
        const size = star.size * (0.8 + eased * 0.5);

        ctx.save();
        ctx.globalAlpha = twinkle;

        // 星星光晕
        const glow = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, size * 5);
        glow.addColorStop(0, hexToRgba(star.color, 0.5));
        glow.addColorStop(1, hexToRgba(star.color, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(star.x, star.y, size * 5, 0, Math.PI * 2);
        ctx.fill();

        // 五角星
        drawStarShape(ctx, star.x, star.y, size);
        ctx.fillStyle = star.color;
        ctx.fill();

        ctx.restore();
      }

      // 爱心形成后的发光效果
      if (progress >= 1) {
        phaseRef.current = 'complete';
        setPhase('complete');

        // 绘制整体爱心光晕
        const pulseIntensity = 0.3 + 0.15 * Math.sin(time * 0.002);
        const heartGlow = ctx.createRadialGradient(
          w / 2, h * 0.45, 0,
          w / 2, h * 0.45, Math.min(w, h) * 0.25,
        );
        heartGlow.addColorStop(0, hexToRgba(colors.primary, pulseIntensity));
        heartGlow.addColorStop(0.5, hexToRgba(colors.secondary, pulseIntensity * 0.3));
        heartGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = heartGlow;
        ctx.fillRect(0, 0, w, h);

        // 调用 onComplete（仅一次）
        setTimeout(() => {
          cancelAnimationFrame(animFrameRef.current);
          onComplete();
        }, 2000);
      }

      // 绘制底部蛋糕图标
      drawCakeIcon(ctx, w / 2, h * 0.88, time);
    }

    // 继续下一帧
    animFrameRef.current = requestAnimationFrame(draw);
  }, [colors, onComplete]);

  // --------------------------------------------------------------------------
  // 绘制底部蛋糕图标（简易）
  // --------------------------------------------------------------------------
  const drawCakeIcon = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    time: number,
  ) => {
    const pulse = 1 + 0.03 * Math.sin(time * 0.003);

    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.translate(x, y);
    ctx.scale(pulse, pulse);

    // 蛋糕体
    ctx.fillStyle = '#f783ac';
    ctx.beginPath();
    ctx.roundRect(-25, -15, 50, 25, 4);
    ctx.fill();

    // 上层
    ctx.fillStyle = '#ff9ec5';
    ctx.beginPath();
    ctx.roundRect(-20, -25, 40, 14, 4);
    ctx.fill();

    // 蜡烛
    ctx.fillStyle = colors.primary;
    ctx.fillRect(-1, -38, 2, 14);

    // 烛火
    ctx.fillStyle = '#ff9500';
    ctx.beginPath();
    ctx.arc(0, -40, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  // --------------------------------------------------------------------------
  // 点击星星收集
  // --------------------------------------------------------------------------
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (phaseRef.current !== 'floating') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // 查找被点击的星星
    for (const star of starsRef.current) {
      if (star.collected) continue;

      const dx = clickX - star.x;
      const dy = clickY - star.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // 点击范围在星星大小 + 20px 内
      if (distance < star.size + 25) {
        star.collected = true;
        star.collectProgress = 0;
        collectedRef.current = [...collectedRef.current, star.label];
        setCollectedWishes([...collectedRef.current]);

        // 检查是否全部收集
        if (collectedRef.current.length === WISHES.length) {
          // 全部收集 → 进入爱心形成阶段
          setTimeout(() => {
            phaseRef.current = 'heart-forming';
            setPhase('heart-forming');
            heartFormStartTimeRef.current = performance.now();
          }, 1000);
        }
        break; // 每次只点击一颗
      }
    }
  }, []);

  // --------------------------------------------------------------------------
  // 处理画布尺寸
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
  // 初始化
  // --------------------------------------------------------------------------
  useEffect(() => {
    handleResize();
    const { w, h } = dimensionsRef.current;
    initStars(w, h);

    animFrameRef.current = requestAnimationFrame(draw);

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [handleResize, initStars, draw]);

  // --------------------------------------------------------------------------
  // 渲染
  // --------------------------------------------------------------------------
  return (
    <motion.div
      className="fixed inset-0 w-screen h-screen overflow-hidden flex flex-col items-center justify-center"
      style={{ background: '#0a0a1a' }}
      initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* 背景深空渐变 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 30%, ${hexToRgba(colors.secondary, 0.05)} 0%, transparent 60%)`,
        }}
      />

      {/* Canvas 星星层 */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full"
        style={{ zIndex: 5, cursor: phase === 'floating' ? 'pointer' : 'default' }}
        onClick={handleCanvasClick}
        aria-label="愿望星空画布，点击星星收集愿望"
      />

      {/* UI 层 */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col">
        {/* 标题 */}
        <motion.div
          className="flex justify-center pt-8"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <h2
            className="text-xl md:text-2xl font-light"
            style={{
              color: '#e2e8f0',
              textShadow: `0 0 20px ${hexToRgba(colors.primary, 0.4)}`,
            }}
          >
            {phase === 'floating'
              ? '点击星星，收集你的愿望'
              : phase === 'heart-forming'
                ? '愿望正在汇聚...'
                : '所有愿望已送达'}
          </h2>
        </motion.div>

        {/* 底部进度条 */}
        <AnimatePresence>
          {phase === 'floating' && (
            <motion.div
              className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-auto"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ duration: 0.5 }}
            >
              <div className="glass flex items-center gap-3 px-6 py-4">
                <span className="text-sm opacity-60">已收集：</span>
                <div className="flex gap-2">
                  {WISHES.map((wish) => (
                    <motion.span
                      key={wish}
                      className="text-sm px-3 py-1 rounded-full"
                      style={{
                        background: collectedWishes.includes(wish)
                          ? `linear-gradient(135deg, ${hexToRgba(colors.primary, 0.3)}, ${hexToRgba(colors.secondary, 0.3)})`
                          : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${
                          collectedWishes.includes(wish)
                            ? hexToRgba(colors.primary, 0.5)
                            : 'rgba(255,255,255,0.1)'
                        }`,
                        color: collectedWishes.includes(wish) ? '#ffffff' : 'rgba(255,255,255,0.3)',
                      }}
                      animate={
                        collectedWishes.includes(wish)
                          ? { scale: [1, 1.2, 1], opacity: 1 }
                          : {}
                      }
                      transition={{ duration: 0.3 }}
                    >
                      {wish}
                    </motion.span>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 爱心阶段提示 */}
        <AnimatePresence>
          {(phase === 'heart-forming' || phase === 'complete') && (
            <motion.div
              className="absolute bottom-8 left-1/2 -translate-x-1/2"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ duration: 0.6 }}
            >
              <p
                className="text-lg md:text-xl font-light"
                style={{
                  color: '#ffffff',
                  textShadow: `0 0 15px ${hexToRgba(colors.primary, 0.5)}`,
                }}
              >
                {phase === 'heart-forming' ? '愿望正在汇聚成爱...' : '所有的爱，都送给你'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default WishingStars;
