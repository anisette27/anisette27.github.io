'use client';

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { BirthdayData } from '../types';
import { AudioEngine } from '../lib/audio';

// ============================================================================
// Props 接口定义
// ============================================================================
interface OpeningSceneProps {
  /** 寿星完整数据（包含名字、年龄、主题等） */
  data: BirthdayData;
  /** 开场动画全部完成后的回调 */
  onComplete: () => void;
}

// ============================================================================
// 主题颜色映射 —— 复用项目中已有的配色方案
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
// 星星粒子数据结构
// ============================================================================
interface SceneStar {
  /** 当前 x 坐标（像素） */
  x: number;
  /** 当前 y 坐标（像素） */
  y: number;
  /** 目标 x 坐标（像素，用于名字排列阶段） */
  targetX: number;
  /** 目标 y 坐标（像素，用于名字排列阶段） */
  targetY: number;
  /** 初始 x 坐标（动画起始位置） */
  originX: number;
  /** 初始 y 坐标（动画起始位置） */
  originY: number;
  /** 星星半径 */
  size: number;
  /** 当前透明度 */
  opacity: number;
  /** 基础透明度 */
  baseOpacity: number;
  /** 闪烁速度 */
  twinkleSpeed: number;
  /** 闪烁相位 */
  twinklePhase: number;
  /** 颜色 (primary / secondary) */
  colorType: 'primary' | 'secondary';
  /** 是否参与名字排列 */
  isNameStar: boolean;
  /** 出场时间（毫秒） */
  appearTime: number;
}

// ============================================================================
// 流星数据结构
// ============================================================================
interface Meteor {
  x: number;
  y: number;
  speed: number;
  angle: number;
  length: number;
  life: number;
  maxLife: number;
  opacity: number;
}

// ============================================================================
// 银河粒子数据结构
// ============================================================================
interface GalaxyParticle {
  /** 到中心的距离 (0~1) */
  distance: number;
  /** 角度 */
  angle: number;
  /** 粒子半径 */
  size: number;
  /** 透明度 */
  opacity: number;
  colorType: 'primary' | 'secondary';
}

// ============================================================================
// 动画阶段枚举
// ============================================================================
type AnimPhase =
  | 'darkness'       // 0-3s：黑暗到星光
  | 'name-forming'   // 3-6s：星星组成名字
  | 'name-scatter'   // 6-7s：名字散开
  | 'meteor-galaxy'  // 7-9s：流星 + 银河
  | 'typewriter'     // 9-15s：打字机文字
  | 'complete';       // 15s：完成

// ============================================================================
// OpeningScene 组件
// ============================================================================
const OpeningScene: React.FC<OpeningSceneProps> = ({ data, onComplete }) => {
  // ======================== 状态 ========================
  const [phase, setPhase] = useState<AnimPhase>('darkness');
  const [typewriterLines, setTypewriterLines] = useState<string[]>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [showTypewriter, setShowTypewriter] = useState(false);

  // ======================== Refs ========================
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number>(0);
  const starsRef = useRef<SceneStar[]>([]);
  const meteorsRef = useRef<Meteor[]>([]);
  const galaxyParticlesRef = useRef<GalaxyParticle[]>([]);
  const startTimeRef = useRef<number>(0);
  const dimensionsRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const phaseRef = useRef<AnimPhase>('darkness');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef<boolean>(false);

  // ======================== 主题颜色 ========================
  const colors = THEME_COLORS[data.theme] || THEME_COLORS['starry'];

  // ======================== 打字机文本 ========================
  const typewriterTexts = useMemo(
    () => [
      '今天，是一个特别的日子……',
      `${data.age}年前，`,
      '宇宙因为你的诞生，多了一颗闪耀的星星。',
    ],
    [data.age],
  );

  // --------------------------------------------------------------------------
  // 从名字文字中采样像素点，返回星星目标坐标数组
  // --------------------------------------------------------------------------
  const sampleNamePixels = useCallback((name: string, w: number, h: number) => {
    // 创建离屏 canvas
    const offCanvas = document.createElement('canvas');
    const fontSize = Math.min(w / (name.length * 0.8), h * 0.15, 120);
    offCanvas.width = w;
    offCanvas.height = h;
    const ctx = offCanvas.getContext('2d');
    if (!ctx) return [];

    // 设置字体并绘制文字
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${fontSize}px "Inter", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, w / 2, h / 2);

    // 获取像素数据
    const imageData = ctx.getImageData(0, 0, w, h);
    const pixels = imageData.data;
    const points: { x: number; y: number }[] = [];

    // 以固定间隔采样非透明像素
    const step = Math.max(4, Math.floor(Math.min(w, h) / 150));
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const idx = (y * w + x) * 4;
        if (pixels[idx + 3] > 128) {
          points.push({ x, y });
        }
      }
    }

    // 如果采样点太多，随机裁剪到合理数量
    const maxPoints = 500;
    if (points.length > maxPoints) {
      // Fisher-Yates 随机采样
      for (let i = points.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [points[i], points[j]] = [points[j], points[i]];
      }
      return points.slice(0, maxPoints);
    }

    return points;
  }, []);

  // --------------------------------------------------------------------------
  // 初始化星星数据
  // --------------------------------------------------------------------------
  const initStars = useCallback((w: number, h: number) => {
    const stars: SceneStar[] = [];
    const bgStarCount = 300; // 背景星星数量

    // --- 生成背景星星 ---
    for (let i = 0; i < bgStarCount; i++) {
      const appearTime = 2000 + (i / bgStarCount) * 1000; // 2~3秒之间陆续出现
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        targetX: 0,
        targetY: 0,
        originX: Math.random() * w,
        originY: Math.random() * h,
        size: Math.random() * 2 + 0.5,
        opacity: 0,
        baseOpacity: Math.random() * 0.6 + 0.4,
        twinkleSpeed: Math.random() * 0.03 + 0.005,
        twinklePhase: Math.random() * Math.PI * 2,
        colorType: Math.random() > 0.5 ? 'primary' : 'secondary',
        isNameStar: false,
        appearTime,
      });
    }

    // --- 生成用于名字排列的星星 ---
    const namePoints = sampleNamePixels(data.name, w, h);
    for (const point of namePoints) {
      // 这些星星从随机位置出发，目标是名字像素位置
      const startX = Math.random() * w;
      const startY = Math.random() * h;
      stars.push({
        x: startX,
        y: startY,
        targetX: point.x,
        targetY: point.y,
        originX: startX,
        originY: startY,
        size: Math.random() * 1.5 + 1,
        opacity: 0,
        baseOpacity: Math.random() * 0.4 + 0.6,
        twinkleSpeed: Math.random() * 0.02 + 0.01,
        twinklePhase: Math.random() * Math.PI * 2,
        colorType: Math.random() > 0.5 ? 'primary' : 'secondary',
        isNameStar: true,
        appearTime: 0, // 在名字阶段统一出现
      });
    }

    starsRef.current = stars;
  }, [data.name, sampleNamePixels]);

  // --------------------------------------------------------------------------
  // 初始化银河粒子
  // --------------------------------------------------------------------------
  const initGalaxy = useCallback(() => {
    const particles: GalaxyParticle[] = [];
    const count = 400;
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
    galaxyParticlesRef.current = particles;
  }, []);

  // --------------------------------------------------------------------------
  // 缓动函数：easeInOutCubic
  // --------------------------------------------------------------------------
  const easeInOutCubic = (t: number): number => {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  // --------------------------------------------------------------------------
  // 线性插值
  // --------------------------------------------------------------------------
  const lerp = (a: number, b: number, t: number): number => {
    return a + (b - a) * t;
  };

  // --------------------------------------------------------------------------
  // 绘制单颗星星（含光晕）
  // --------------------------------------------------------------------------
  const drawStar = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    opacity: number,
    color: string,
    glowMultiplier: number = 1,
  ) => {
    ctx.save();
    ctx.globalAlpha = opacity;

    // 较大或需要发光的星星绘制光晕
    if (size > 1.2 || glowMultiplier > 1) {
      const glowRadius = size * 3 * glowMultiplier;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
      glow.addColorStop(0, hexToRgba(color, 0.4 * glowMultiplier));
      glow.addColorStop(1, hexToRgba(color, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // 星星核心
    ctx.fillStyle = hexToRgba(color, 1);
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  // --------------------------------------------------------------------------
  // 主绘制循环（由 requestAnimationFrame 驱动）
  // --------------------------------------------------------------------------
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { w, h } = dimensionsRef.current;
    if (w === 0 || h === 0) return;

    // 计算从动画开始至今的毫秒数
    const elapsed = performance.now() - startTimeRef.current;
    const currentPhase = phaseRef.current;

    // --- 清空画布 ---
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, w, h);

    // --- 微弱背景径向渐变 ---
    const bgGrad = ctx.createRadialGradient(
      w * 0.5, h * 0.5, 0,
      w * 0.5, h * 0.5, Math.max(w, h) * 0.7,
    );
    bgGrad.addColorStop(0, hexToRgba(colors.secondary, 0.05));
    bgGrad.addColorStop(0.5, hexToRgba(colors.primary, 0.02));
    bgGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // ==================================================================
    // 阶段 0-3s：黑暗到星光 —— 星星陆续出现并闪烁
    // ==================================================================
    if (elapsed < 3000) {
      const starColor = (s: SceneStar) =>
        s.colorType === 'primary' ? colors.primary : colors.secondary;

      for (const star of starsRef.current) {
        if (star.isNameStar) continue; // 名字星星此阶段不参与

        // 星星在出场时间之后渐入
        if (elapsed >= star.appearTime) {
          const fadeIn = Math.min(1, (elapsed - star.appearTime) / 500);
          // 正弦波闪烁
          const twinkle = 0.6 + 0.4 * Math.sin(elapsed * star.twinkleSpeed + star.twinklePhase);
          star.opacity = fadeIn * star.baseOpacity * twinkle;

          drawStar(ctx, star.x, star.y, star.size, star.opacity, starColor(star));
        }
      }

      // 前3颗手动出现的星星（0.5s、1s、1.5s）
      const manualStars = [
        { time: 500, pos: { x: w * 0.5, y: h * 0.4 } },
        { time: 1000, pos: { x: w * 0.35, y: h * 0.3 } },
        { time: 1500, pos: { x: w * 0.65, y: h * 0.5 } },
      ];

      for (const ms of manualStars) {
        if (elapsed >= ms.time) {
          const fadeIn = Math.min(1, (elapsed - ms.time) / 400);
          const twinkle = 0.6 + 0.4 * Math.sin(elapsed * 0.02);
          const glow = elapsed >= ms.time + 300 ? 2 : 1;
          drawStar(ctx, ms.pos.x, ms.pos.y, 2.5, fadeIn * twinkle, colors.primary, glow);
        }
      }
    }

    // ==================================================================
    // 阶段 3-6s：星星飞向名字位置
    // ==================================================================
    if (elapsed >= 3000 && elapsed < 6000) {
      const phaseProgress = Math.min(1, (elapsed - 3000) / 2500); // 2.5秒完成飞行
      const eased = easeInOutCubic(phaseProgress);

      // 背景星星继续闪烁（淡出一些）
      const starColor = (s: SceneStar) =>
        s.colorType === 'primary' ? colors.primary : colors.secondary;

      for (const star of starsRef.current) {
        if (!star.isNameStar) {
          // 背景星星保持闪烁但降低亮度
          const twinkle = 0.6 + 0.4 * Math.sin(elapsed * star.twinkleSpeed + star.twinklePhase);
          const bgFade = Math.max(0.2, 1 - eased * 0.6);
          star.opacity = star.baseOpacity * twinkle * bgFade;
          drawStar(ctx, star.x, star.y, star.size, star.opacity, starColor(star));
        } else {
          // 名字星星从起始位置飞向目标位置
          star.x = lerp(star.originX, star.targetX, eased);
          star.y = lerp(star.originY, star.targetY, eased);
          star.opacity = eased * star.baseOpacity;
          drawStar(ctx, star.x, star.y, star.size, star.opacity, starColor(star));
        }
      }

      // 到达后发光脉冲（6秒前的短暂效果）
      if (elapsed >= 5500) {
        const pulseAlpha = Math.max(0, 1 - (elapsed - 5500) / 500) * 0.3;
        for (const star of starsRef.current) {
          if (star.isNameStar) {
            const grad = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, star.size * 8);
            grad.addColorStop(0, hexToRgba(colors.primary, pulseAlpha));
            grad.addColorStop(1, hexToRgba(colors.primary, 0));
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size * 8, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    // ==================================================================
    // 阶段 6-7s：名字散开
    // ==================================================================
    if (elapsed >= 6000 && elapsed < 7000) {
      const scatterProgress = Math.min(1, (elapsed - 6000) / 1000);
      const eased = easeInOutCubic(scatterProgress);

      const starColor = (s: SceneStar) =>
        s.colorType === 'primary' ? colors.primary : colors.secondary;

      for (const star of starsRef.current) {
        if (!star.isNameStar) {
          const twinkle = 0.6 + 0.4 * Math.sin(elapsed * star.twinkleSpeed + star.twinklePhase);
          star.opacity = star.baseOpacity * twinkle * 0.3;
          drawStar(ctx, star.x, star.y, star.size, star.opacity, starColor(star));
        } else {
          // 从名字位置散开到随机远处
          const scatterX = star.targetX + (star.targetX - w / 2) * 2 * eased;
          const scatterY = star.targetY + (star.targetY - h / 2) * 2 * eased;
          star.x = scatterX;
          star.y = scatterY;
          star.opacity = star.baseOpacity * (1 - eased);
          drawStar(ctx, star.x, star.y, star.size * (1 - eased * 0.5), star.opacity, starColor(star));
        }
      }
    }

    // ==================================================================
    // 阶段 7-9s：流星 + 银河推进
    // ==================================================================
    if (elapsed >= 7000 && elapsed < 9000) {
      const galaxyProgress = Math.min(1, (elapsed - 7000) / 2000);

      // --- 绘制背景星星 ---
      const starColor = (s: SceneStar) =>
        s.colorType === 'primary' ? colors.primary : colors.secondary;
      for (const star of starsRef.current) {
        if (!star.isNameStar) {
          const twinkle = 0.6 + 0.4 * Math.sin(elapsed * star.twinkleSpeed + star.twinklePhase);
          star.opacity = star.baseOpacity * twinkle * (0.2 + galaxyProgress * 0.3);
          drawStar(ctx, star.x, star.y, star.size, star.opacity, starColor(star));
        }
      }

      // --- 银河缩放效果（推进感） ---
      const scale = 1 + galaxyProgress * 0.3; // 从 1.0 缩放到 1.3
      const cx = w * 0.5;
      const cy = h * 0.5;
      const galaxyLength = Math.max(w, h) * 0.85;
      const galaxyRotation = elapsed * 0.0003;

      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      for (const p of galaxyParticlesRef.current) {
        const pos = p.distance * galaxyLength * scale;
        const a = p.angle + galaxyRotation;
        const px = cx + Math.cos(a) * pos;
        const py = cy + Math.sin(a) * pos;

        const distFade = 1 - Math.abs(p.distance - 0.5) * 1.4;
        const flicker = 0.7 + 0.3 * Math.sin(elapsed * 0.02 + p.distance * 10);
        const alpha = Math.max(0, p.opacity * distFade * flicker * galaxyProgress);
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

      // --- 流星（从右上划向左下） ---
      // 在 7s 时生成一颗大流星
      if (elapsed >= 7000 && elapsed < 7200 && meteorsRef.current.length === 0) {
        meteorsRef.current.push({
          x: w * 0.85,
          y: h * 0.05,
          speed: 12,
          angle: Math.PI * 0.7,
          length: 150,
          life: 1,
          maxLife: 80,
          opacity: 1,
        });
      }

      // 绘制流星
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      for (let i = meteorsRef.current.length - 1; i >= 0; i--) {
        const m = meteorsRef.current[i];
        m.x += Math.cos(m.angle) * m.speed;
        m.y += Math.sin(m.angle) * m.speed;
        m.life -= 1 / m.maxLife;
        m.opacity = Math.max(0, m.life);

        if (m.life <= 0) {
          meteorsRef.current.splice(i, 1);
          continue;
        }

        const tailX = m.x - Math.cos(m.angle) * m.length * m.opacity;
        const tailY = m.y - Math.sin(m.angle) * m.length * m.opacity;

        const grad = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
        grad.addColorStop(0, hexToRgba(colors.primary, m.opacity * 0.9));
        grad.addColorStop(0.3, hexToRgba(colors.secondary, m.opacity * 0.5));
        grad.addColorStop(1, hexToRgba(colors.secondary, 0));

        ctx.strokeStyle = grad;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();

        // 流星头部发光
        const headGlow = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, 8);
        headGlow.addColorStop(0, hexToRgba('#ffffff', m.opacity * 0.9));
        headGlow.addColorStop(0.4, hexToRgba(colors.primary, m.opacity * 0.4));
        headGlow.addColorStop(1, hexToRgba(colors.primary, 0));
        ctx.fillStyle = headGlow;
        ctx.beginPath();
        ctx.arc(m.x, m.y, 8, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    // ==================================================================
    // 阶段 9-15s：银河持续可见 + 背景星星
    // ==================================================================
    if (elapsed >= 9000) {
      // 保持银河和背景星星
      const starColor = (s: SceneStar) =>
        s.colorType === 'primary' ? colors.primary : colors.secondary;

      // 背景星星
      for (const star of starsRef.current) {
        if (!star.isNameStar) {
          const twinkle = 0.6 + 0.4 * Math.sin(elapsed * star.twinkleSpeed + star.twinklePhase);
          star.opacity = star.baseOpacity * twinkle * 0.5;
          drawStar(ctx, star.x, star.y, star.size, star.opacity, starColor(star));
        }
      }

      // 银河保持
      const cx = w * 0.5;
      const cy = h * 0.5;
      const galaxyLength = Math.max(w, h) * 0.85 * 1.3;
      const galaxyRotation = elapsed * 0.0003;

      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      for (const p of galaxyParticlesRef.current) {
        const pos = p.distance * galaxyLength;
        const a = p.angle + galaxyRotation;
        const px = cx + Math.cos(a) * pos;
        const py = cy + Math.sin(a) * pos;

        const distFade = 1 - Math.abs(p.distance - 0.5) * 1.4;
        const flicker = 0.7 + 0.3 * Math.sin(elapsed * 0.02 + p.distance * 10);
        const alpha = Math.max(0, p.opacity * distFade * flicker);
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
    }

    // --- 继续下一帧 ---
    animFrameRef.current = requestAnimationFrame(draw);
  }, [colors]);

  // --------------------------------------------------------------------------
  // 打字机效果逻辑
  // --------------------------------------------------------------------------
  const startTypewriter = useCallback(() => {
    setShowTypewriter(true);
    setCurrentLineIndex(0);
    setDisplayedText('');

    let lineIdx = 0;
    let charIdx = 0;
    let totalCharCount = 0;
    let lineDelay = 0;

    // 逐字符显示当前行
    intervalRef.current = setInterval(() => {
      if (lineIdx >= typewriterTexts.length) {
        // 所有文字显示完毕，停止
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      }

      // 行间延迟：每行开始前等待 1 秒（10次 * 100ms）
      if (lineDelay < 10 && charIdx === 0 && lineIdx > 0) {
        lineDelay++;
        return;
      }
      lineDelay = 0;

      const currentLine = typewriterTexts[lineIdx];

      if (charIdx < currentLine.length) {
        // 逐字添加
        charIdx++;
        totalCharCount++;
        setDisplayedText(currentLine.slice(0, charIdx));
        setCurrentLineIndex(lineIdx);

        // 每3个字符播放一次 typewriterClick
        if (totalCharCount % 3 === 0) {
          AudioEngine.getInstance().typewriterClick();
        }
      } else {
        // 当前行完毕，换到下一行
        charIdx = 0;
        lineIdx++;
        setTypewriterLines(prev => [...prev, currentLine]);
        setDisplayedText('');
      }
    }, 100); // 每100ms一个字符
  }, [typewriterTexts]);

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
  // 阶段切换定时器
  // --------------------------------------------------------------------------
  useEffect(() => {
    startTimeRef.current = performance.now();

    // 阶段切换时间表
    const timers: ReturnType<typeof setTimeout>[] = [];

    timers.push(
      setTimeout(() => {
        setPhase('name-forming');
        phaseRef.current = 'name-forming';
        AudioEngine.getInstance().starAppear();
      }, 3000),
    );

    // 5.5秒：名字发光脉冲 - 播放 starFormName
    timers.push(
      setTimeout(() => {
        AudioEngine.getInstance().starFormName();
      }, 5500),
    );

    timers.push(
      setTimeout(() => {
        setPhase('name-scatter');
        phaseRef.current = 'name-scatter';
      }, 6000),
    );

    timers.push(
      setTimeout(() => {
        setPhase('meteor-galaxy');
        phaseRef.current = 'meteor-galaxy';
        AudioEngine.getInstance().meteorShoot();
      }, 7000),
    );

    timers.push(
      setTimeout(() => {
        setPhase('typewriter');
        phaseRef.current = 'typewriter';
        startTypewriter();
      }, 9000),
    );

    timers.push(
      setTimeout(() => {
        setPhase('complete');
        phaseRef.current = 'complete';
      }, 15000),
    );

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [startTypewriter]);

  // --------------------------------------------------------------------------
  // 初始化画布、星星、银河粒子并启动动画循环
  // --------------------------------------------------------------------------
  useEffect(() => {
    handleResize();
    const { w, h } = dimensionsRef.current;

    // 初始化数据
    initStars(w, h);
    initGalaxy();

    // 启动动画循环
    animFrameRef.current = requestAnimationFrame(draw);

    // 监听窗口大小变化
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [handleResize, initStars, initGalaxy, draw]);

  // --------------------------------------------------------------------------
  // 15秒后调用 onComplete
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (phase === 'complete' && !completedRef.current) {
      completedRef.current = true;
      // 稍微延迟以确保最后一帧渲染完毕
      const timer = setTimeout(() => {
        onComplete();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [phase, onComplete]);

  // --------------------------------------------------------------------------
  // 组件卸载时清理所有资源
  // --------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // --------------------------------------------------------------------------
  // 渲染
  // --------------------------------------------------------------------------
  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden" style={{ background: '#0a0a1a' }}>
      {/* 全屏 Canvas —— 绘制星星、流星、银河 */}
      <canvas
        ref={canvasRef}
        className="canvas-fullscreen"
        aria-hidden="true"
      />

      {/* 打字机文字层 */}
      <AnimatePresence>
        {showTypewriter && (
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none px-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.5 }}
          >
            {/* 已完成的行 */}
            {typewriterLines.map((line, index) => (
              <motion.p
                key={`line-${index}`}
                className="text-center text-xl md:text-2xl lg:text-3xl font-light mb-6"
                style={{
                  color: '#e2e8f0',
                  textShadow: `0 0 20px ${hexToRgba(colors.primary, 0.6)}, 0 0 40px ${hexToRgba(colors.secondary, 0.3)}`,
                }}
                initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              >
                {line}
              </motion.p>
            ))}

            {/* 正在打字的当前行 */}
            {currentLineIndex < typewriterTexts.length && (
              <motion.p
                key={`current-${currentLineIndex}`}
                className="text-center text-xl md:text-2xl lg:text-3xl font-light mb-6 typewriter-cursor"
                style={{
                  color: '#e2e8f0',
                  textShadow: `0 0 20px ${hexToRgba(colors.primary, 0.6)}, 0 0 40px ${hexToRgba(colors.secondary, 0.3)}`,
                }}
                initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              >
                {displayedText}
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 背景音乐渐入提示（预留接口） */}
      {/* TODO: 集成音频时，取消注释并连接 AudioContext */}
      {/* <audio ref={audioRef} src="/audio/opening-bgm.mp3" preload="auto" /> */}
    </div>
  );
};

export default OpeningScene;
