'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { BirthdayData } from '../types';
import { AudioEngine } from '../lib/audio';

// ============================================================================
// Props 接口定义
// ============================================================================
interface GiftBoxProps {
  /** 寿星完整数据 */
  data: BirthdayData;
  /** 小游戏完成回调 */
  onComplete: () => void;
}

// ============================================================================
// 主题颜色映射 —— 与 OpeningScene 保持一致
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
// 粒子数据结构 —— 从礼盒飞出并排列成名字
// ============================================================================
interface GiftParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  originX: number;
  originY: number;
  size: number;
  opacity: number;
  color: string;
  life: number;
  /** 动画阶段：'burst' 飞散阶段, 'converge' 聚合到名字阶段, 'done' 完成 */
  phase: 'burst' | 'converge' | 'done';
}

// ============================================================================
// 礼盒状态枚举
// ============================================================================
type BoxPhase = 'idle' | 'opening' | 'bursting' | 'forming' | 'complete';

// ============================================================================
// GiftBox 组件
// ============================================================================
const GiftBox: React.FC<GiftBoxProps> = ({ data, onComplete }) => {
  // ======================== 状态 ========================
  const [boxPhase, setBoxPhase] = useState<BoxPhase>('idle');
  const [showBlessing, setShowBlessing] = useState(false);
  const [showButton, setShowButton] = useState(false);

  // ======================== Refs ========================
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const particlesRef = useRef<GiftParticle[]>([]);
  const startTimeRef = useRef<number>(0);
  const dimensionsRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const phaseRef = useRef<BoxPhase>('idle');

  // ======================== 主题颜色 ========================
  const colors = THEME_COLORS[data.theme] || THEME_COLORS['starry'];

  // --------------------------------------------------------------------------
  // 从名字文字中采样像素点 —— 与 OpeningScene 采样技术一致
  // --------------------------------------------------------------------------
  const sampleNamePixels = useCallback((name: string, w: number, h: number) => {
    const offCanvas = document.createElement('canvas');
    const fontSize = Math.min(w / (name.length * 0.8), h * 0.12, 100);
    offCanvas.width = w;
    offCanvas.height = h;
    const ctx = offCanvas.getContext('2d');
    if (!ctx) return [];

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${fontSize}px "Inter", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, w / 2, h / 2);

    const imageData = ctx.getImageData(0, 0, w, h);
    const pixels = imageData.data;
    const points: { x: number; y: number }[] = [];

    const step = Math.max(5, Math.floor(Math.min(w, h) / 120));
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const idx = (y * w + x) * 4;
        if (pixels[idx + 3] > 128) {
          points.push({ x, y });
        }
      }
    }

    // 随机裁剪到合理数量
    const maxPoints = 400;
    if (points.length > maxPoints) {
      for (let i = points.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [points[i], points[j]] = [points[j], points[i]];
      }
      return points.slice(0, maxPoints);
    }

    return points;
  }, []);

  // --------------------------------------------------------------------------
  // 缓动函数
  // --------------------------------------------------------------------------
  const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
  const easeInOutCubic = (t: number): number =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  // --------------------------------------------------------------------------
  // 创建粒子 —— 从盒子中心爆发
  // --------------------------------------------------------------------------
  const createParticles = useCallback(() => {
    const { w, h } = dimensionsRef.current;
    const cx = w / 2;
    const cy = h / 2;

    // 采样名字像素点
    const namePoints = sampleNamePixels(data.name, w, h);

    const particles: GiftParticle[] = [];
    const particleColors = [colors.primary, colors.secondary, '#fbbf24', '#ec4899', '#ffffff'];

    for (let i = 0; i < 250; i++) {
      // 随机方向和速度的爆发
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8 + 4;
      const p: GiftParticle = {
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - Math.random() * 4, // 偏上方飞出
        targetX: 0,
        targetY: 0,
        originX: cx,
        originY: cy,
        size: Math.random() * 4 + 2,
        opacity: 1,
        color: particleColors[Math.floor(Math.random() * particleColors.length)],
        life: 1,
        phase: 'burst',
      };

      // 部分粒子有名字目标（用于排列阶段）
      if (i < namePoints.length) {
        p.targetX = namePoints[i].x;
        p.targetY = namePoints[i].y;
      }

      particles.push(p);
    }

    particlesRef.current = particles;
  }, [data.name, colors, sampleNamePixels]);

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

    const elapsed = performance.now() - startTimeRef.current;
    const currentPhase = phaseRef.current;

    // 清空画布
    ctx.clearRect(0, 0, w, h);

    // --- 爆发和聚合阶段 ---
    if (currentPhase === 'bursting' || currentPhase === 'forming' || currentPhase === 'complete') {
      // 爆发阶段计时
      const burstDuration = 2000; // 2秒爆发
      const convergeDuration = 2500; // 2.5秒聚合
      const burstElapsed = elapsed; // 从粒子创建开始

      // 在爆发阶段结束后切换到聚合
      if (currentPhase === 'bursting' && burstElapsed > burstDuration) {
        phaseRef.current = 'forming';
        setBoxPhase('forming');
        // 设置聚合阶段起始时间
        for (const p of particlesRef.current) {
          p.originX = p.x;
          p.originY = p.y;
        }
        startTimeRef.current = performance.now();
      }

      if (phaseRef.current === 'forming') {
        const formElapsed = performance.now() - startTimeRef.current;
        const progress = Math.min(1, formElapsed / convergeDuration);
        const eased = easeInOutCubic(progress);

        for (const p of particlesRef.current) {
          if (p.targetX !== 0 || p.targetY !== 0) {
            // 有目标的粒子向名字位置移动
            p.x = p.originX + (p.targetX - p.originX) * eased;
            p.y = p.originY + (p.targetY - p.originY) * eased;
            p.opacity = 0.5 + eased * 0.5;
            p.size = Math.max(1.5, p.size * (1 - eased * 0.3));
          } else {
            // 无目标的粒子逐渐消失
            p.opacity = Math.max(0, p.opacity - 0.008);
          }
        }

        // 聚合完成后
        if (progress >= 1 && currentPhase === 'forming') {
          phaseRef.current = 'complete';
          setBoxPhase('complete');
          setShowBlessing(true);
          setTimeout(() => setShowButton(true), 800);
        }
      }

      // 绘制所有粒子
      for (const p of particlesRef.current) {
        if (p.opacity <= 0) continue;

        ctx.save();
        ctx.globalAlpha = p.opacity;

        // 粒子光晕
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
        glow.addColorStop(0, hexToRgba(p.color, 0.6));
        glow.addColorStop(1, hexToRgba(p.color, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        ctx.fill();

        // 粒子核心
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      // 爆发阶段的粒子物理
      if (phaseRef.current === 'bursting') {
        for (const p of particlesRef.current) {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.15; // 重力
          p.vx *= 0.98; // 空气阻力
          p.opacity = Math.max(0, p.opacity - 0.002);
          p.size = Math.max(1, p.size * 0.998);
        }
      }
    }

    // --- 完成阶段：名字粒子持续发光闪烁 ---
    if (phaseRef.current === 'complete') {
      const time = performance.now();
      for (const p of particlesRef.current) {
        if ((p.targetX === 0 && p.targetY === 0) || p.opacity <= 0) continue;

        // 闪烁效果
        const twinkle = 0.7 + 0.3 * Math.sin(time * 0.003 + p.targetX * 0.01);

        ctx.save();
        ctx.globalAlpha = p.opacity * twinkle;

        // 发光光晕
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4);
        glow.addColorStop(0, hexToRgba(p.color, 0.5));
        glow.addColorStop(0.5, hexToRgba(p.color, 0.15));
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

    // 继续下一帧
    animFrameRef.current = requestAnimationFrame(draw);
  }, [colors]);

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
  // 初始化画布
  // --------------------------------------------------------------------------
  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  // --------------------------------------------------------------------------
  // 点击礼盒 → 开启
  // --------------------------------------------------------------------------
  const handleBoxClick = useCallback(() => {
    if (boxPhase !== 'idle') return;

    setBoxPhase('opening');
    AudioEngine.getInstance().giftOpen();

    // 开盖动画后开始粒子爆发
    setTimeout(() => {
      setBoxPhase('bursting');
      phaseRef.current = 'bursting';
      createParticles();
      startTimeRef.current = performance.now();
      animFrameRef.current = requestAnimationFrame(draw);
      AudioEngine.getInstance().particleBurst();
    }, 1200);
  }, [boxPhase, createParticles, draw]);

  // --------------------------------------------------------------------------
  // 组件卸载时清理
  // --------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // --------------------------------------------------------------------------
  // 继续按钮
  // --------------------------------------------------------------------------
  const handleContinue = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    onComplete();
  }, [onComplete]);

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
      {/* 背景径向渐变 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, ${hexToRgba(colors.secondary, 0.08)} 0%, transparent 60%)`,
        }}
      />

      {/* Canvas 粒子层 */}
      <canvas
        ref={canvasRef}
        className="canvas-fullscreen"
        style={{ zIndex: 5 }}
        aria-hidden="true"
      />

      {/* 礼盒区域 */}
      <div className="relative z-10 flex flex-col items-center justify-center">
        <AnimatePresence>
          {boxPhase !== 'complete' && (
            <motion.div
              className="cursor-pointer"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -100, scale: 0.5 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              onClick={handleBoxClick}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {/* ===== 3D 礼盒 ===== */}
              <div className="relative" style={{ perspective: '800px' }}>
                {/* 礼盒主体 */}
                <div
                  className="relative"
                  style={{
                    width: '180px',
                    height: '180px',
                    background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                    borderRadius: '12px',
                    boxShadow: `
                      0 20px 60px ${hexToRgba(colors.primary, 0.3)},
                      inset 0 -10px 30px ${hexToRgba('#000000', 0.2)},
                      inset 0 10px 30px ${hexToRgba('#ffffff', 0.1)}
                    `,
                    animation: boxPhase === 'idle' ? 'gift-wobble 2s ease-in-out infinite' : 'none',
                  }}
                >
                  {/* 竖丝带 */}
                  <div
                    className="absolute top-0 left-1/2 -translate-x-1/2"
                    style={{
                      width: '28px',
                      height: '100%',
                      background: `linear-gradient(90deg, ${hexToRgba('#fbbf24', 0.8)}, #fbbf24, ${hexToRgba('#fbbf24', 0.8)})`,
                      borderRadius: '2px',
                    }}
                  />
                  {/* 横丝带 */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 left-0"
                    style={{
                      width: '100%',
                      height: '28px',
                      background: `linear-gradient(180deg, ${hexToRgba('#fbbf24', 0.8)}, #fbbf24, ${hexToRgba('#fbbf24', 0.8)})`,
                      borderRadius: '2px',
                    }}
                  />
                  {/* 中心蝴蝶结 */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                    <div
                      className="absolute"
                      style={{
                        width: '40px',
                        height: '24px',
                        background: `linear-gradient(135deg, #fbbf24, #f59e0b)`,
                        borderRadius: '50% 50% 50% 50%',
                        transform: 'rotate(-20deg) translateX(-15px)',
                        boxShadow: `0 0 15px ${hexToRgba('#fbbf24', 0.5)}`,
                      }}
                    />
                    <div
                      className="absolute"
                      style={{
                        width: '40px',
                        height: '24px',
                        background: `linear-gradient(135deg, #fbbf24, #f59e0b)`,
                        borderRadius: '50% 50% 50% 50%',
                        transform: 'rotate(20deg) translateX(15px)',
                        boxShadow: `0 0 15px ${hexToRgba('#fbbf24', 0.5)}`,
                      }}
                    />
                    <div
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                      style={{
                        width: '12px',
                        height: '12px',
                        background: '#f59e0b',
                        borderRadius: '50%',
                      }}
                    />
                  </div>
                </div>

                {/* 礼盒盖子 */}
                <motion.div
                  className="absolute"
                  style={{
                    width: '200px',
                    height: '36px',
                    left: '-10px',
                    top: '-36px',
                    background: `linear-gradient(135deg, ${hexToRgba(colors.primary, 0.9)}, ${hexToRgba(colors.secondary, 0.9)})`,
                    borderRadius: '8px 8px 2px 2px',
                    boxShadow: `0 -5px 20px ${hexToRgba(colors.primary, 0.2)}`,
                    transformOrigin: 'bottom center',
                  }}
                  animate={
                    boxPhase === 'opening' || boxPhase === 'bursting'
                      ? { rotateX: -120, y: -20, opacity: 0 }
                      : { rotateX: 0, y: 0, opacity: 1 }
                  }
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                >
                  {/* 盖子丝带 */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2"
                    style={{
                      width: '200px',
                      height: '14px',
                      background: `linear-gradient(180deg, ${hexToRgba('#fbbf24', 0.8)}, #fbbf24, ${hexToRgba('#fbbf24', 0.8)})`,
                    }}
                  />
                </motion.div>
              </div>

              {/* 点击提示文字 */}
              {boxPhase === 'idle' && (
                <motion.p
                  className="mt-8 text-center text-sm md:text-base"
                  style={{ color: hexToRgba(colors.primary, 0.7) }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.5 }}
                >
                  点击礼盒，打开你的生日礼物
                </motion.p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 祝福语 */}
        <AnimatePresence>
          {showBlessing && (
            <motion.div
              className="flex flex-col items-center mt-8"
              initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            >
              <p
                className="text-2xl md:text-3xl font-semibold mb-2"
                style={{
                  color: '#ffffff',
                  textShadow: `0 0 20px ${hexToRgba(colors.primary, 0.6)}, 0 0 40px ${hexToRgba(colors.secondary, 0.3)}`,
                }}
              >
                第一份祝福已送达
              </p>
              <p
                className="text-base md:text-lg opacity-60"
                style={{ color: colors.primary }}
              >
                致 {data.name}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 继续按钮 */}
        <AnimatePresence>
          {showButton && (
            <motion.button
              className="btn-cosmic mt-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              onClick={handleContinue}
            >
              继续
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* 礼盒摇晃动画 keyframes（通过 style 标签注入） */}
      <style jsx global>{`
        @keyframes gift-wobble {
          0%, 100% { transform: rotate(0deg); }
          15% { transform: rotate(-3deg); }
          30% { transform: rotate(3deg); }
          45% { transform: rotate(-2deg); }
          60% { transform: rotate(2deg); }
          75% { transform: rotate(-1deg); }
          90% { transform: rotate(1deg); }
        }
      `}</style>
    </motion.div>
  );
};

export default GiftBox;
