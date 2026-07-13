'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { BirthdayData } from '../types';

// ============================================================================
// Props 接口定义
// ============================================================================
interface UniverseSceneProps {
  /** 寿星完整数据 */
  data: BirthdayData;
  /** 章节完成回调 */
  onComplete: () => void;
}

// ============================================================================
// 主题颜色映射表 —— 与项目其他组件保持一致
// ============================================================================
const THEME_COLORS: Record<string, { primary: string; secondary: string; accent: string }> = {
  starry:  { primary: '#4facfe', secondary: '#a855f7', accent: '#ec4899' },
  sakura:  { primary: '#f472b6', secondary: '#fb7185', accent: '#fda4af' },
  candy:   { primary: '#fb923c', secondary: '#f472b6', accent: '#fbbf24' },
  ocean:   { primary: '#22d3ee', secondary: '#3b82f6', accent: '#4facfe' },
  forest:  { primary: '#34d399', secondary: '#22c55e', accent: '#4facfe' },
  castle:  { primary: '#c084fc', secondary: '#e879f9', accent: '#f472b6' },
  aurora:  { primary: '#a78bfa', secondary: '#34d399', accent: '#22d3ee' },
  chinese: { primary: '#ef4444', secondary: '#fbbf24', accent: '#f97316' },
  tech:    { primary: '#06b6d4', secondary: '#8b5cf6', accent: '#4facfe' },
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
// 星星数据结构
// ============================================================================
interface Star {
  /** 基础 x 位置 (0~1 归一化) */
  baseX: number;
  /** 基础 y 位置 (0~1 归一化) */
  baseY: number;
  /** 星星大小 */
  size: number;
  /** 闪烁相位偏移 */
  twinkleOffset: number;
  /** 闪烁速度 */
  twinkleSpeed: number;
  /** 颜色 */
  color: string;
  /** 出现的缩放阈值 (0~1, 只有 zoom 达到后才显示) */
  revealThreshold: number;
}

// ============================================================================
// 银河粒子数据结构
// ============================================================================
interface GalaxyParticle {
  /** 极坐标角度 */
  angle: number;
  /** 极坐标半径 */
  radius: number;
  /** 粒子大小 */
  size: number;
  /** 亮度 */
  brightness: number;
  /** 颜色 */
  color: string;
}

// ============================================================================
// 卡片环绕粒子数据结构
// ============================================================================
interface CardParticle {
  /** x 坐标 */
  x: number;
  /** y 坐标 */
  y: number;
  /** 漂移速度 x */
  vx: number;
  /** 漂移速度 y */
  vy: number;
  /** 大小 */
  size: number;
  /** 透明度 */
  opacity: number;
  /** 颜色 */
  color: string;
}

// ============================================================================
// 缓动函数：平滑插值
// ============================================================================
function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

// ============================================================================
// UniverseScene 组件 —— 第七章节：生日宇宙
// ============================================================================
const UniverseScene: React.FC<UniverseSceneProps> = ({ data, onComplete }) => {
  // ======================== 主题颜色 ========================
  const themeConfig = THEME_COLORS[data.theme] || THEME_COLORS['starry'];
  const colors = {
    primary: themeConfig.primary,
    secondary: themeConfig.secondary,
    accent: themeConfig.accent,
  };

  // ======================== 状态 ========================
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [showButtons, setShowButtons] = useState<boolean>(false);

  // ======================== Refs ========================
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const dimensionsRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const startTimeRef = useRef<number>(0);
  const starsRef = useRef<Star[]>([]);
  const galaxyParticlesRef = useRef<GalaxyParticle[]>([]);
  const cardParticlesRef = useRef<CardParticle[]>([]);
  const buttonsVisibleRef = useRef<boolean>(false);

  // --------------------------------------------------------------------------
  // 初始化星星数据（一次性生成，按黄金角分布）
  // --------------------------------------------------------------------------
  const initStars = useCallback((count: number): Star[] => {
    const stars: Star[] = [];
    for (let i = 0; i < count; i++) {
      const t = i / count;
      stars.push({
        baseX: ((i * 137.508 + i * i * 0.7) % 1000) / 1000,
        baseY: ((i * 97.31 + i * i * 0.3) % 1000) / 1000,
        size: 0.5 + Math.random() * 2,
        twinkleOffset: Math.random() * Math.PI * 2,
        twinkleSpeed: 1 + Math.random() * 3,
        color: Math.random() > 0.7 ? colors.secondary : colors.primary,
        revealThreshold: Math.random(), // 随 zoom 层级显示
      });
    }
    return stars;
  }, [colors]);

  // --------------------------------------------------------------------------
  // 初始化银河粒子（螺旋臂分布）
  // --------------------------------------------------------------------------
  const initGalaxyParticles = useCallback((count: number): GalaxyParticle[] => {
    const particles: GalaxyParticle[] = [];
    const arms = 2; // 双螺旋臂

    for (let i = 0; i < count; i++) {
      const armIndex = i % arms;
      const t = (i / count) * Math.PI * 3; // 螺旋 1.5 圈
      const armOffset = (armIndex / arms) * Math.PI * 2;
      const radius = 0.05 + t * 0.15;
      const angleSpread = (Math.random() - 0.5) * 0.6;
      const rSpread = (Math.random() - 0.5) * 0.04;

      particles.push({
        angle: t + armOffset + angleSpread,
        radius: Math.max(0.02, radius + rSpread),
        size: 0.5 + Math.random() * 1.5,
        brightness: 0.3 + Math.random() * 0.7,
        color:
          Math.random() > 0.6
            ? colors.secondary
            : Math.random() > 0.3
              ? colors.primary
              : '#ffffff',
      });
    }
    return particles;
  }, [colors]);

  // --------------------------------------------------------------------------
  // 初始化卡片环绕粒子
  // --------------------------------------------------------------------------
  const initCardParticles = useCallback((w: number, h: number): CardParticle[] => {
    const particles: CardParticle[] = [];
    const cx = w / 2;
    const cy = h / 2;
    const cardW = Math.min(w * 0.7, 500);
    const cardH = Math.min(h * 0.5, 350);

    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 80;
      particles.push({
        x: cx + Math.cos(angle) * (cardW / 2 + dist) + (Math.random() - 0.5) * 40,
        y: cy + Math.sin(angle) * (cardH / 2 + dist) + (Math.random() - 0.5) * 40,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -0.2 - Math.random() * 0.5,
        size: 1 + Math.random() * 2.5,
        opacity: 0.3 + Math.random() * 0.7,
        color: Math.random() > 0.5 ? colors.primary : colors.secondary,
      });
    }
    return particles;
  }, [colors]);

  // --------------------------------------------------------------------------
  // 处理画布尺寸（高 DPI 支持）
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
  // 主绘制循环（Canvas 宇宙场景）
  // --------------------------------------------------------------------------
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { w, h } = dimensionsRef.current;
    if (w === 0 || h === 0) return;

    const elapsed = (performance.now() - startTimeRef.current) / 1000; // 秒
    const cx = w / 2;
    const cy = h / 2;

    // ==================================================================
    // 计算各阶段动画参数
    // ==================================================================

    // --- scale：镜头缩放级别 (1=近景 → 3=远景) ---
    let scale: number;
    if (elapsed < 5) {
      // 阶段1：从 1.0 缓慢拉远到 2.0
      scale = 1.0 + easeInOutCubic(elapsed / 5) * 1.0;
    } else if (elapsed < 8) {
      // 阶段2：继续拉远到 2.8
      scale = 2.0 + easeInOutCubic((elapsed - 5) / 3) * 0.8;
    } else if (elapsed < 10) {
      // 阶段3：轻微拉远到 3.0
      scale = 2.8 + easeOutQuart((elapsed - 8) / 2) * 0.2;
    } else {
      // 阶段4：固定 3.0
      scale = 3.0;
    }

    // --- cardProgress：卡片出现进度 (0=无 → 1=完全) ---
    let cardProgress: number;
    if (elapsed < 4) {
      cardProgress = 0;
    } else if (elapsed < 8) {
      cardProgress = easeInOutCubic((elapsed - 4) / 4);
    } else {
      cardProgress = 1;
    }

    // --- 银河 → 卡片角半径插值 ---
    // 从椭圆形(角半径=50%)到矩形(角半径=16px)
    const maxCornerRadius = Math.min(w * 0.35, 250);
    const cardCornerRadius = maxCornerRadius * (1 - cardProgress) + 16 * cardProgress;

    // ==================================================================
    // 清空画布
    // ==================================================================
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, w, h);

    // ==================================================================
    // 背景渐变 —— 深空氛围
    // ==================================================================
    const bgBrightness = Math.min(0.15, elapsed / 12 * 0.15);
    const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.7);
    bgGrad.addColorStop(0, hexToRgba(colors.secondary, bgBrightness));
    bgGrad.addColorStop(0.5, hexToRgba(colors.primary, bgBrightness * 0.3));
    bgGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // ==================================================================
    // 阶段1-3 (0-10秒)：星星（随 zoom 调整）
    // ==================================================================
    const time = elapsed * 60; // 帧时间

    for (const star of starsRef.current) {
      // 只显示在当前 zoom 层级内的星星
      if (star.revealThreshold > (scale - 1) / 2) continue;

      // 根据 scale 计算星星在屏幕上的位置
      const sx = ((star.baseX - 0.5) * w * scale + cx) % w;
      const sy = ((star.baseY - 0.5) * h * scale + cy) % h;
      const normalizedSx = sx < 0 ? sx + w : sx;
      const normalizedSy = sy < 0 ? sy + h : sy;

      // 闪烁效果
      const twinkle = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(time * 0.02 * star.twinkleSpeed + star.twinkleOffset));
      // 星星大小随 zoom 缩小
      const drawSize = Math.max(0.3, star.size * (1 / scale) * 1.5);

      ctx.save();
      ctx.globalAlpha = twinkle * Math.min(1, (elapsed / 3)) * 0.8;
      ctx.fillStyle = star.color;
      ctx.beginPath();
      ctx.arc(normalizedSx, normalizedSy, drawSize, 0, Math.PI * 2);
      ctx.fill();

      // 较大的星星增加发光效果
      if (drawSize > 1) {
        const glow = ctx.createRadialGradient(
          normalizedSx, normalizedSy, 0,
          normalizedSx, normalizedSy, drawSize * 3
        );
        glow.addColorStop(0, hexToRgba(star.color, 0.3));
        glow.addColorStop(1, hexToRgba(star.color, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(normalizedSx, normalizedSy, drawSize * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // ==================================================================
    // 阶段1 (0-5秒)：生日星球（中心发光球体）
    // ==================================================================
    const planetScale = 1 / scale;
    const planetRadius = 80 * planetScale;

    if (elapsed < 10 && planetRadius > 5) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, elapsed / 2);

      // 星球发光光晕
      const haloRadius = planetRadius * 2.5;
      const haloGrad = ctx.createRadialGradient(cx, cy, planetRadius * 0.8, cx, cy, haloRadius);
      haloGrad.addColorStop(0, hexToRgba(colors.primary, 0.3 * planetScale * 3));
      haloGrad.addColorStop(0.5, hexToRgba(colors.secondary, 0.1 * planetScale * 3));
      haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, haloRadius, 0, Math.PI * 2);
      ctx.fill();

      // 星球本体
      const planetGrad = ctx.createRadialGradient(
        cx - planetRadius * 0.3, cy - planetRadius * 0.3, 0,
        cx, cy, planetRadius
      );
      planetGrad.addColorStop(0, hexToRgba(colors.primary, 0.9));
      planetGrad.addColorStop(0.4, hexToRgba(colors.secondary, 0.7));
      planetGrad.addColorStop(0.7, hexToRgba('#0d3d6b', 0.8));
      planetGrad.addColorStop(1, hexToRgba('#0a1628', 1));
      ctx.fillStyle = planetGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, planetRadius, 0, Math.PI * 2);
      ctx.fill();

      // 大气光泽
      const atmoGrad = ctx.createRadialGradient(
        cx - planetRadius * 0.3, cy - planetRadius * 0.3, 0,
        cx, cy, planetRadius
      );
      atmoGrad.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
      atmoGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
      atmoGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = atmoGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, planetRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // ==================================================================
    // 阶段1-2 (2-8秒)：银河带效果
    // ==================================================================
    if (elapsed >= 1.5 && elapsed < 9) {
      const galaxyAlpha = elapsed < 3
        ? easeInOutCubic((elapsed - 1.5) / 1.5) * 0.4
        : elapsed < 7
          ? 0.4
          : (1 - easeInOutCubic((elapsed - 7) / 2)) * 0.4;

      ctx.save();
      ctx.globalAlpha = galaxyAlpha;
      ctx.globalCompositeOperation = 'lighter';

      // 绘制银河粒子
      for (const gp of galaxyParticlesRef.current) {
        const rotAngle = gp.angle + time * 0.001;
        const gx = cx + Math.cos(rotAngle) * gp.radius * scale * 120;
        const gy = cy + Math.sin(rotAngle) * gp.radius * scale * 60;

        // 随着卡片出现，银河逐渐收缩到中心
        const morphFactor = cardProgress;
        const mx = gx * (1 - morphFactor) + cx * morphFactor;
        const my = gy * (1 - morphFactor) + cy * morphFactor;

        ctx.save();
        ctx.globalAlpha = galaxyAlpha * gp.brightness;
        ctx.fillStyle = gp.color;
        ctx.beginPath();
        ctx.arc(mx, my, Math.max(0.3, gp.size * (1 - morphFactor * 0.5)), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    }

    // ==================================================================
    // 阶段2-4 (4-12秒)：卡片（玻璃拟态矩形，从银河变换而来）
    // ==================================================================
    if (cardProgress > 0) {
      const cardW = Math.min(w * 0.7, 500);
      const cardH = Math.min(h * 0.5, 350);
      const cardX = cx - cardW / 2;
      const cardY = cy - cardH / 2;

      // 卡片浮动动画（阶段3后）
      const floatOffset = elapsed > 8
        ? Math.sin(elapsed * 1.5) * 8
        : Math.sin(elapsed * 0.8) * 4;

      ctx.save();
      ctx.globalAlpha = cardProgress;

      // 移动到卡片位置并应用浮动
      ctx.translate(0, floatOffset);

      // --- 卡片背景（玻璃拟态） ---
      // 圆角矩形路径
      ctx.beginPath();
      const r = Math.max(1, cardCornerRadius);
      ctx.moveTo(cardX + r, cardY);
      ctx.lineTo(cardX + cardW - r, cardY);
      ctx.arcTo(cardX + cardW, cardY, cardX + cardW, cardY + r, r);
      ctx.lineTo(cardX + cardW, cardY + cardH - r);
      ctx.arcTo(cardX + cardW, cardY + cardH, cardX + cardW - r, cardY + cardH, r);
      ctx.lineTo(cardX + r, cardY + cardH);
      ctx.arcTo(cardX, cardY + cardH, cardX, cardY + cardH - r, r);
      ctx.lineTo(cardX, cardY + r);
      ctx.arcTo(cardX, cardY, cardX + r, cardY, r);
      ctx.closePath();

      // 玻璃拟态背景
      const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
      cardGrad.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
      cardGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
      cardGrad.addColorStop(1, 'rgba(255, 255, 255, 0.08)');
      ctx.fillStyle = cardGrad;
      ctx.fill();

      // 发光边框
      ctx.strokeStyle = hexToRgba(colors.primary, 0.4 * cardProgress);
      ctx.lineWidth = 2;
      ctx.stroke();

      // 外发光
      ctx.shadowColor = hexToRgba(colors.primary, 0.3 * cardProgress);
      ctx.shadowBlur = 30;
      ctx.strokeStyle = hexToRgba(colors.secondary, 0.2 * cardProgress);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // --- 卡片上的装饰星星 ---
      if (cardProgress > 0.5) {
        const decoAlpha = (cardProgress - 0.5) * 2;
        const starPositions = [
          { x: cardX + 20, y: cardY + 20 },
          { x: cardX + cardW - 25, y: cardY + 25 },
          { x: cardX + cardW - 20, y: cardY + cardH - 20 },
          { x: cardX + 25, y: cardY + cardH - 25 },
          { x: cardX + cardW / 2 - 80, y: cardY + 40 },
          { x: cardX + cardW / 2 + 80, y: cardY + cardH - 40 },
        ];

        for (const sp of starPositions) {
          ctx.save();
          ctx.globalAlpha = decoAlpha * (0.3 + 0.4 * Math.sin(time * 0.03 + sp.x));
          ctx.fillStyle = Math.random() > 0.5 ? colors.primary : colors.secondary;
          // 绘制四角星
          drawStar(ctx, sp.x, sp.y, 4, 3, 1.2);
          ctx.fill();
          ctx.restore();
        }
      }

      // --- 卡片文字 ---
      ctx.save();
      ctx.globalAlpha = cardProgress;

      // 标题："{name} Planet"
      const titleSize = Math.min(36, cardW * 0.09);
      ctx.font = `bold ${titleSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 标题渐变色
      const titleGrad = ctx.createLinearGradient(
        cx - titleSize * data.name.length * 0.3, cy - 50,
        cx + titleSize * data.name.length * 0.3, cy - 50
      );
      titleGrad.addColorStop(0, colors.primary);
      titleGrad.addColorStop(1, colors.secondary);
      ctx.fillStyle = titleGrad;
      ctx.shadowColor = hexToRgba(colors.primary, 0.6);
      ctx.shadowBlur = 20;
      ctx.fillText(`${data.name} Planet`, cx, cy - 50);
      ctx.shadowBlur = 0;

      // 副标题
      const subtitleSize = Math.min(16, cardW * 0.04);
      ctx.font = `300 ${subtitleSize}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.7 * cardProgress})`;
      ctx.fillText('今天，宇宙因为你，多了一岁。', cx, cy + 10);

      // 装饰线
      const lineWidth = cardW * 0.3;
      const lineGrad = ctx.createLinearGradient(cx - lineWidth / 2, 0, cx + lineWidth / 2, 0);
      lineGrad.addColorStop(0, hexToRgba(colors.primary, 0));
      lineGrad.addColorStop(0.5, hexToRgba(colors.primary, 0.5 * cardProgress));
      lineGrad.addColorStop(1, hexToRgba(colors.primary, 0));
      ctx.strokeStyle = lineGrad;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - lineWidth / 2, cy + 35);
      ctx.lineTo(cx + lineWidth / 2, cy + 35);
      ctx.stroke();

      ctx.restore();

      ctx.restore(); // 恢复浮动 translate
    }

    // ==================================================================
    // 阶段3 (8-12秒)：卡片周围散布粒子
    // ==================================================================
    if (elapsed > 8 && cardParticlesRef.current.length > 0) {
      const particleAlpha = Math.min(1, (elapsed - 8) / 2);

      for (const p of cardParticlesRef.current) {
        // 更新粒子位置
        p.x += p.vx;
        p.y += p.vy;

        // 边界循环
        if (p.y < -10) p.y = h + 10;
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;

        ctx.save();
        ctx.globalAlpha = particleAlpha * p.opacity * (0.5 + 0.5 * Math.sin(time * 0.03 + p.x));
        const pGlow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
        pGlow.addColorStop(0, hexToRgba(p.color, 0.8));
        pGlow.addColorStop(0.5, hexToRgba(p.color, 0.3));
        pGlow.addColorStop(1, hexToRgba(p.color, 0));
        ctx.fillStyle = pGlow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // --- 下一帧 ---
    animFrameRef.current = requestAnimationFrame(draw);
  }, [colors, data.name]);

  // --------------------------------------------------------------------------
  // 辅助绘制函数：四角星形状
  // --------------------------------------------------------------------------
  const drawStar = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    points: number,
    outerR: number,
    innerR: number
  ) => {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outerR : innerR;
      const angle = (Math.PI * i) / points - Math.PI / 2;
      const sx = x + Math.cos(angle) * radius;
      const sy = y + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
  }, []);

  // --------------------------------------------------------------------------
  // 阶段切换定时器
  // --------------------------------------------------------------------------
  useEffect(() => {
    startTimeRef.current = performance.now();

    // 初始化数据
    starsRef.current = initStars(400);
    galaxyParticlesRef.current = initGalaxyParticles(300);
    cardParticlesRef.current = initCardParticles(
      window.innerWidth,
      window.innerHeight
    );

    const timers: ReturnType<typeof setTimeout>[] = [];

    // 阶段4 (10秒)：显示按钮
    timers.push(setTimeout(() => {
      setShowButtons(true);
      buttonsVisibleRef.current = true;
    }, 10000));

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [initStars, initGalaxyParticles, initCardParticles]);

  // --------------------------------------------------------------------------
  // 初始化画布并启动动画循环
  // --------------------------------------------------------------------------
  useEffect(() => {
    handleResize();
    animFrameRef.current = requestAnimationFrame(draw);
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [handleResize, draw]);

  // --------------------------------------------------------------------------
  // "保存纪念" 点击处理 —— 显示 toast
  // --------------------------------------------------------------------------
  const handleSave = useCallback(() => {
    setToastMessage('纪念已保存到宇宙');
    setShowToast(true);
    // 3秒后自动隐藏 toast
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  }, []);

  // --------------------------------------------------------------------------
  // 渲染
  // --------------------------------------------------------------------------
  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden" style={{ background: '#0a0a1a' }}>
      {/* 全屏 Canvas —— 宇宙场景 */}
      <canvas
        ref={canvasRef}
        className="canvas-fullscreen"
        style={{ pointerEvents: 'none' }}
        aria-hidden="true"
      />

      {/* ============================================================ */}
      {/* 阶段4 (10-12秒)：操作按钮区域 */}
      {/* ============================================================ */}
      <AnimatePresence>
        {showButtons && (
          <motion.div
            className="absolute bottom-12 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-4"
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            {/* 按钮容器（玻璃拟态背景） */}
            <motion.div
              className="glass px-6 py-4 flex flex-col sm:flex-row items-center gap-4"
              initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.2 }}
            >
              {/* "保存纪念" 按钮 */}
              <motion.button
                onClick={handleSave}
                className="px-6 py-3 rounded-full text-sm font-medium transition-all"
                style={{
                  background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                  color: '#ffffff',
                  boxShadow: `0 0 20px ${hexToRgba(colors.primary, 0.3)}`,
                }}
                whileHover={{
                  scale: 1.05,
                  boxShadow: `0 0 30px ${hexToRgba(colors.primary, 0.5)}`,
                }}
                whileTap={{ scale: 0.95 }}
              >
                保存纪念
              </motion.button>

              {/* "分享给朋友" 按钮 */}
              <motion.button
                onClick={onComplete}
                className="px-6 py-3 rounded-full text-sm font-medium transition-all"
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: `1px solid ${hexToRgba(colors.primary, 0.3)}`,
                  color: '#e2e8f0',
                }}
                whileHover={{
                  scale: 1.05,
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  borderColor: hexToRgba(colors.primary, 0.5),
                }}
                whileTap={{ scale: 0.95 }}
              >
                分享给朋友
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================ */}
      {/* Toast 通知 */}
      {/* ============================================================ */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            className="absolute top-12 left-1/2 -translate-x-1/2 z-50"
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ duration: 0.4 }}
          >
            <div
              className="glass px-6 py-3 flex items-center gap-3"
              style={{
                boxShadow: `0 0 20px ${hexToRgba(colors.primary, 0.3)}`,
              }}
            >
              {/* 星星图标 */}
              <span style={{ color: colors.primary }}>&#10022;</span>
              <span className="text-sm font-medium" style={{ color: '#e2e8f0' }}>
                {toastMessage}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UniverseScene;
