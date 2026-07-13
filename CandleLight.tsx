'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { BirthdayData } from '../types';
import { AudioEngine } from '../lib/audio';

// ============================================================================
// Props 接口定义
// ============================================================================
interface CandleLightProps {
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
// 预定义祝福语 —— 每点亮一根蜡烛显示一条
// ============================================================================
const BLESSINGS = [
  '愿你被世界温柔以待',
  '愿所有美好如期而至',
  '愿你的每一天都闪闪发光',
  '愿梦想照进现实',
  '愿你永远快乐如初',
];

// ============================================================================
// 烟雾粒子数据结构
// ============================================================================
interface SmokeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  life: number;
  maxLife: number;
}

// ============================================================================
// 蜡烛状态
// ============================================================================
interface CandleState {
  id: number;
  lit: boolean;
}

// ============================================================================
// CandleLight 组件
// ============================================================================
const CandleLight: React.FC<CandleLightProps> = ({ data, onComplete }) => {
  // ======================== 状态 ========================
  const [candles, setCandles] = useState<CandleState[]>(
    Array.from({ length: 5 }, (_, i) => ({ id: i, lit: false })),
  );
  const [blessingIndex, setBlessingIndex] = useState(-1);
  const [showWishHint, setShowWishHint] = useState(false);
  const [showBlowBtn, setShowBlowBtn] = useState(false);
  const [isBlowing, setIsBlowing] = useState(false);

  // ======================== Refs ========================
  const smokeCanvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const smokeParticlesRef = useRef<SmokeParticle[]>([]);
  const dimensionsRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const smokeActiveRef = useRef(false);
  const candlePositionsRef = useRef<{ x: number; y: number }[]>([]);

  // ======================== 主题颜色 ========================
  const colors = THEME_COLORS[data.theme] || THEME_COLORS['starry'];

  // --------------------------------------------------------------------------
  // 点亮单根蜡烛
  // --------------------------------------------------------------------------
  const handleCandleClick = useCallback((id: number) => {
    setCandles(prev => {
      if (prev[id].lit) return prev;
      const next = [...prev];
      next[id] = { id, lit: true };
      return next;
    });

    // 显示对应的祝福语
    setBlessingIndex(id);

    // 播放点亮蜡烛音效
    AudioEngine.getInstance().candleLight();

    // 检查是否全部点亮
    const updatedCount = candles.filter((_, idx) => idx <= id && !candles[idx].lit).length;
    const allLit = id === 4;

    if (allLit) {
      // 全部点亮后播放生日歌
      AudioEngine.getInstance().playBirthdaySong();
      // 全部点亮后显示许愿提示
      setTimeout(() => setShowWishHint(true), 600);
      // 2秒后显示吹蜡烛按钮
      setTimeout(() => setShowBlowBtn(true), 2600);
    }
  }, [candles]);

  // --------------------------------------------------------------------------
  // 吹灭蜡烛 —— 启动烟雾粒子
  // --------------------------------------------------------------------------
  const handleBlow = useCallback(() => {
    setIsBlowing(true);
    setShowBlowBtn(false);
    setShowWishHint(false);
    setBlessingIndex(-1);

    // 播放吹蜡烛音效
    AudioEngine.getInstance().candleBlow();

    // 熄灭所有蜡烛
    setCandles(prev => prev.map(c => ({ ...c, lit: false })));

    // 创建烟雾粒子
    createSmokeParticles();
    smokeActiveRef.current = true;
    animFrameRef.current = requestAnimationFrame(drawSmoke);

    // 烟雾散尽后完成
    setTimeout(() => {
      smokeActiveRef.current = false;
      cancelAnimationFrame(animFrameRef.current);
      setTimeout(() => onComplete(), 500);
    }, 3500);
  }, [onComplete]);

  // --------------------------------------------------------------------------
  // 创建烟雾粒子
  // --------------------------------------------------------------------------
  const createSmokeParticles = useCallback(() => {
    const particles: SmokeParticle[] = [];

    // 每根蜡烛位置生成烟雾
    for (let i = 0; i < 5; i++) {
      const baseX = candlePositionsRef.current[i]?.x || 0;
      const baseY = candlePositionsRef.current[i]?.y || 0;

      for (let j = 0; j < 20; j++) {
        particles.push({
          x: baseX + (Math.random() - 0.5) * 10,
          y: baseY,
          vx: (Math.random() - 0.5) * 1.5,
          vy: -(Math.random() * 2 + 1),
          size: Math.random() * 8 + 4,
          opacity: Math.random() * 0.5 + 0.3,
          life: 0,
          maxLife: 120 + Math.random() * 60,
        });
      }
    }

    smokeParticlesRef.current = particles;
  }, []);

  // --------------------------------------------------------------------------
  // 绘制烟雾粒子
  // --------------------------------------------------------------------------
  const drawSmoke = useCallback(() => {
    const canvas = smokeCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { w, h } = dimensionsRef.current;
    if (w === 0 || h === 0) return;

    ctx.clearRect(0, 0, w, h);

    const particles = smokeParticlesRef.current;

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life++;
      p.x += p.vx;
      p.y += p.vy;
      p.vx += (Math.random() - 0.5) * 0.1; // 随机飘动
      p.size += 0.15; // 烟雾逐渐扩大
      p.opacity = Math.max(0, (1 - p.life / p.maxLife) * 0.4);

      if (p.life >= p.maxLife) {
        particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = p.opacity;

      // 柔和的烟雾渐变
      const smokeGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      smokeGrad.addColorStop(0, 'rgba(200, 200, 220, 0.3)');
      smokeGrad.addColorStop(0.5, 'rgba(180, 180, 200, 0.15)');
      smokeGrad.addColorStop(1, 'rgba(160, 160, 180, 0)');
      ctx.fillStyle = smokeGrad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    if (smokeActiveRef.current || particles.length > 0) {
      animFrameRef.current = requestAnimationFrame(drawSmoke);
    }
  }, []);

  // --------------------------------------------------------------------------
  // 处理画布尺寸
  // --------------------------------------------------------------------------
  const handleResize = useCallback(() => {
    const canvas = smokeCanvasRef.current;
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
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [handleResize]);

  // --------------------------------------------------------------------------
  // 渲染
  // --------------------------------------------------------------------------
  const allLit = candles.every(c => c.lit);

  return (
    <motion.div
      className="fixed inset-0 w-screen h-screen overflow-hidden flex flex-col items-center justify-center"
      style={{ background: '#0a0a1a' }}
      initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* 背景暖色径向渐变 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center bottom, ${hexToRgba(colors.secondary, 0.06)} 0%, transparent 50%)`,
        }}
      />

      {/* Canvas 烟雾层 */}
      <canvas
        ref={smokeCanvasRef}
        className="canvas-fullscreen"
        style={{ zIndex: 15 }}
        aria-hidden="true"
      />

      {/* 祝福语飘浮层 */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-20 overflow-hidden">
        <AnimatePresence mode="wait">
          {blessingIndex >= 0 && !isBlowing && (
            <motion.div
              key={`blessing-${blessingIndex}`}
              className="absolute w-full flex justify-center"
              style={{ top: '15%' }}
              initial={{ opacity: 0, y: 30, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -50, filter: 'blur(8px)' }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            >
              <span
                className="text-lg md:text-xl lg:text-2xl font-light px-6 py-3 rounded-full"
                style={{
                  color: '#ffffff',
                  textShadow: `0 0 15px ${hexToRgba(colors.primary, 0.5)}, 0 0 30px ${hexToRgba(colors.secondary, 0.2)}`,
                  background: `linear-gradient(135deg, ${hexToRgba(colors.primary, 0.15)}, ${hexToRgba(colors.secondary, 0.15)})`,
                  border: `1px solid ${hexToRgba(colors.primary, 0.2)}`,
                }}
              >
                {BLESSINGS[blessingIndex]}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 蛋糕 + 蜡烛主体 */}
      <div className="relative z-10 flex flex-col items-center">
        {/* ===== 生日蛋糕（CSS 绘制） ===== */}
        <motion.div
          className="relative flex flex-col items-center"
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
        >
          {/* ---- 蜡烛区域 ---- */}
          <div className="flex items-end justify-center gap-6 mb-[-8px] relative" style={{ zIndex: 5 }}>
            {candles.map((candle, idx) => (
              <div
                key={candle.id}
                className="flex flex-col items-center cursor-pointer"
                onClick={() => handleCandleClick(idx)}
                ref={(el) => {
                  // 记录蜡烛顶部位置（用于烟雾粒子起始坐标）
                  if (el) {
                    const rect = el.getBoundingClientRect();
                    candlePositionsRef.current[idx] = {
                      x: rect.left + rect.width / 2,
                      y: rect.top,
                    };
                  }
                }}
              >
                {/* 火焰 */}
                <AnimatePresence>
                  {candle.lit && !isBlowing && (
                    <motion.div
                      className="relative"
                      initial={{ opacity: 0, scale: 0, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0, y: -20 }}
                      transition={{ duration: 0.4, ease: 'easeOut' }}
                    >
                      {/* 外焰 */}
                      <div
                        className="absolute -top-1 left-1/2 -translate-x-1/2"
                        style={{
                          width: '16px',
                          height: '28px',
                          background: 'radial-gradient(ellipse at bottom, #ff9500 0%, #ff6b00 40%, rgba(255,100,0,0) 100%)',
                          borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
                          filter: 'blur(1px)',
                          animation: 'candle-flicker 0.15s ease-in-out infinite alternate',
                        }}
                      />
                      {/* 内焰 */}
                      <div
                        className="absolute -top-0 left-1/2 -translate-x-1/2"
                        style={{
                          width: '8px',
                          height: '16px',
                          background: 'radial-gradient(ellipse at bottom, #ffffff 0%, #ffe566 40%, #ff9500 80%, rgba(255,100,0,0) 100%)',
                          borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
                        }}
                      />
                      {/* 光晕效果 */}
                      <div
                        className="absolute left-1/2 -translate-x-1/2"
                        style={{
                          width: '60px',
                          height: '60px',
                          top: '-30px',
                          background: 'radial-gradient(circle, rgba(255,150,0,0.3) 0%, rgba(255,100,0,0) 70%)',
                          borderRadius: '50%',
                          animation: 'glow-pulse 1.5s ease-in-out infinite',
                        }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 蜡烛体 */}
                <motion.div
                  className="relative"
                  style={{
                    width: '10px',
                    height: '50px',
                    background: candle.lit
                      ? `linear-gradient(180deg, ${colors.primary}, ${colors.secondary})`
                      : 'linear-gradient(180deg, #a0a0b0, #808090)',
                    borderRadius: '3px 3px 2px 2px',
                    boxShadow: candle.lit
                      ? `0 0 10px ${hexToRgba(colors.primary, 0.4)}`
                      : 'inset 0 1px 3px rgba(255,255,255,0.1)',
                    transition: 'background 0.5s, box-shadow 0.5s',
                  }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  {/* 烛芯 */}
                  <div
                    className="absolute top-[-6px] left-1/2 -translate-x-1/2"
                    style={{
                      width: '2px',
                      height: '8px',
                      background: '#333',
                      borderRadius: '1px',
                    }}
                  />
                </motion.div>
              </div>
            ))}
          </div>

          {/* ---- 蛋糕第三层（顶层） ---- */}
          <div
            className="relative"
            style={{
              width: '180px',
              height: '45px',
              background: 'linear-gradient(180deg, #ff9ec5, #ff7eb3)',
              borderRadius: '12px 12px 4px 4px',
              boxShadow: 'inset 0 -5px 15px rgba(0,0,0,0.1), inset 0 5px 15px rgba(255,255,255,0.15)',
              zIndex: 4,
            }}
          >
            {/* 奶油装饰波浪 */}
            <div
              className="absolute -top-2 left-0 w-full"
              style={{
                height: '12px',
                background: 'repeating-radial-gradient(circle at 10px 6px, #fff5f5 0px, #fff5f5 6px, transparent 6px, transparent 14px)',
                backgroundSize: '28px 12px',
              }}
            />
          </div>

          {/* ---- 蛋糕第二层 ---- */}
          <div
            className="relative"
            style={{
              width: '220px',
              height: '50px',
              background: 'linear-gradient(180deg, #fbb4d0, #f989b8)',
              borderRadius: '6px',
              boxShadow: 'inset 0 -5px 15px rgba(0,0,0,0.1), inset 0 5px 15px rgba(255,255,255,0.1)',
              zIndex: 3,
            }}
          >
            {/* 奶油装饰线 */}
            <div
              className="absolute top-0 left-0 w-full"
              style={{
                height: '6px',
                background: 'linear-gradient(90deg, transparent, #fff5f5, transparent)',
                borderRadius: '3px 3px 0 0',
              }}
            />
            {/* 小装饰点 */}
            {[30, 70, 110, 150, 190].map((left, i) => (
              <div
                key={i}
                className="absolute"
                style={{
                  left: `${left}px`,
                  top: '50%',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: colors.primary,
                  boxShadow: `0 0 6px ${hexToRgba(colors.primary, 0.5)}`,
                  transform: 'translateY(-50%)',
                }}
              />
            ))}
          </div>

          {/* ---- 蛋糕底层 ---- */}
          <div
            className="relative"
            style={{
              width: '260px',
              height: '55px',
              background: 'linear-gradient(180deg, #f783ac, #f06292)',
              borderRadius: '6px',
              boxShadow: 'inset 0 -5px 15px rgba(0,0,0,0.15), inset 0 5px 15px rgba(255,255,255,0.1)',
              zIndex: 2,
            }}
          >
            {/* 奶油装饰线 */}
            <div
              className="absolute top-0 left-0 w-full"
              style={{
                height: '6px',
                background: 'linear-gradient(90deg, transparent, #ffe4ec, transparent)',
                borderRadius: '3px 3px 0 0',
              }}
            />
          </div>

          {/* ---- 底部托盘 ---- */}
          <div
            className="relative"
            style={{
              width: '300px',
              height: '14px',
              background: 'linear-gradient(180deg, #e0e0e0, #c0c0c0)',
              borderRadius: '0 0 8px 8px',
              boxShadow: '0 8px 25px rgba(0,0,0,0.3)',
              zIndex: 1,
            }}
          />
        </motion.div>

        {/* 许愿提示 */}
        <AnimatePresence>
          {showWishHint && !isBlowing && (
            <motion.div
              className="flex flex-col items-center mt-8"
              initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -20, filter: 'blur(8px)' }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            >
              <p
                className="text-xl md:text-2xl font-semibold mb-2"
                style={{
                  color: '#ffffff',
                  textShadow: `0 0 15px ${hexToRgba(colors.primary, 0.5)}`,
                }}
              >
                许个愿望吧
              </p>
              <p className="text-sm opacity-50">闭上眼睛，在心中默默许愿...</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 吹蜡烛按钮 */}
        <AnimatePresence>
          {showBlowBtn && !isBlowing && (
            <motion.button
              className="btn-cosmic mt-6"
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              onClick={handleBlow}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              吹灭蜡烛
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* 蜡烛火焰闪烁动画 */}
      <style jsx global>{`
        @keyframes candle-flicker {
          0% { transform: scaleY(1) scaleX(1) translateY(0); }
          50% { transform: scaleY(1.1) scaleX(0.9) translateY(-2px); }
          100% { transform: scaleY(0.95) scaleX(1.05) translateY(1px); }
        }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.6; transform: translateX(-50%) scale(1); }
          50% { opacity: 1; transform: translateX(-50%) scale(1.15); }
        }
      `}</style>
    </motion.div>
  );
};

export default CandleLight;
