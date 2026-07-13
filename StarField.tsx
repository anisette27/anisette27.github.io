'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import type { ThemeType } from '../types';

// ============================================================================
// 主题颜色映射表 - 与 tailwind.config 保持一致
// ============================================================================
const THEME_COLORS: Record<ThemeType, { primary: string; secondary: string }> = {
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
// 工具函数：将十六进制颜色转为 rgba 字符串
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
  /** 相对于画布宽度的 x 坐标 (0~1) */
  rx: number;
  /** 相对于画布高度的 y 坐标 (0~1) */
  ry: number;
  /** 星星半径 */
  size: number;
  /** 基础透明度 (0~1) */
  baseOpacity: number;
  /** 当前透明度 */
  opacity: number;
  /** 闪烁速度 (越大越快) */
  twinkleSpeed: number;
  /** 闪烁相位偏移 */
  twinklePhase: number;
  /** 视差深度层 (0~1, 0=最远, 1=最近) */
  depth: number;
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
  /** 颜色 (primary 或 secondary) */
  colorType: 'primary' | 'secondary';
}

// ============================================================================
// 流星数据结构
// ============================================================================
interface Meteor {
  /** 起点 x (像素) */
  x: number;
  /** 起点 y (像素) */
  y: number;
  /** 速度 (像素/帧) */
  speed: number;
  /** 移动方向角度 (弧度) */
  angle: number;
  /** 长度 (像素) */
  length: number;
  /** 当前生命值 (递减至 0) */
  life: number;
  /** 最大生命值 */
  maxLife: number;
  /** 透明度 */
  opacity: number;
}

// ============================================================================
// Props 接口
// ============================================================================
interface StarFieldProps {
  /** 当前主题类型 */
  theme: ThemeType;
  /** 是否启用鼠标视差交互效果，默认 false */
  interactive?: boolean;
}

// ============================================================================
// StarField 组件
// ============================================================================
export const StarField: React.FC<StarFieldProps> = ({
  theme,
  interactive = false,
}) => {
  // ---------- Refs ----------
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const starsRef = useRef<Star[]>([]);
  const galaxyRef = useRef<GalaxyParticle[]>([]);
  const meteorsRef = useRef<Meteor[]>([]);
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
  const timeRef = useRef<number>(0);
  const dimensionsRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  // --------------------------------------------------------------------------
  // 初始化星星数据
  // --------------------------------------------------------------------------
  const initStars = useCallback(() => {
    const stars: Star[] = [];
    const count = 500; // 500 颗闪烁星星
    for (let i = 0; i < count; i++) {
      stars.push({
        rx: Math.random(),
        ry: Math.random(),
        size: Math.random() * 2.5 + 0.5,          // 0.5 ~ 3px
        baseOpacity: Math.random() * 0.6 + 0.4,      // 0.4 ~ 1.0
        opacity: 1,
        twinkleSpeed: Math.random() * 0.03 + 0.005,  // 闪烁频率
        twinklePhase: Math.random() * Math.PI * 2,     // 随机相位
        depth: Math.random(),                          // 视差深度
      });
    }
    starsRef.current = stars;
  }, []);

  // --------------------------------------------------------------------------
  // 初始化银河粒子（沿对角线分布的发光粒子带）
  // --------------------------------------------------------------------------
  const initGalaxy = useCallback(() => {
    const particles: GalaxyParticle[] = [];
    const count = 600; // 银河粒子数量
    for (let i = 0; i < count; i++) {
      // 粒子沿中心对角线分布，添加高斯噪声模拟银河宽度
      const distance = Math.random();
      // 使用正态分布偏移让银河中间更密集
      const spread = (Math.random() + Math.random() + Math.random()) / 3 * 2 - 1;
      particles.push({
        distance,
        angle: Math.PI * 0.25 + spread * 0.35, // 对角线方向 ± 偏移
        size: Math.random() * 1.8 + 0.3,
        opacity: Math.random() * 0.4 + 0.1,
        colorType: Math.random() > 0.5 ? 'primary' : 'secondary',
      });
    }
    galaxyRef.current = particles;
  }, []);

  // --------------------------------------------------------------------------
  // 生成一颗新流星
  // --------------------------------------------------------------------------
  const spawnMeteor = useCallback((w: number, h: number): Meteor => {
    // 随机起点，偏向画布上方和右侧
    const startX = Math.random() * w * 1.2;
    const startY = Math.random() * h * 0.5;
    return {
      x: startX,
      y: startY,
      speed: Math.random() * 8 + 6,
      angle: Math.PI * 0.6 + Math.random() * 0.4, // 向左下方划过
      length: Math.random() * 80 + 40,
      life: 1,
      maxLife: Math.random() * 60 + 40,
      opacity: 1,
    };
  }, []);

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

    const colors = THEME_COLORS[theme];
    timeRef.current += 1;
    const t = timeRef.current;

    // --- 清空画布，绘制深色背景 ---
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, w, h);

    // --- 绘制微弱的背景径向渐变，增加深度感 ---
    const bgGrad = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.7);
    bgGrad.addColorStop(0, hexToRgba(colors.secondary, 0.06));
    bgGrad.addColorStop(0.5, hexToRgba(colors.primary, 0.03));
    bgGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // ==============================
    // 绘制银河（旋转发光粒子带）
    // ==============================
    const cx = w * 0.5;
    const cy = h * 0.5;
    const galaxyLength = Math.max(w, h) * 0.85;

    // 银河整体缓慢旋转
    const galaxyRotation = t * 0.0003;

    ctx.save();
    ctx.globalCompositeOperation = 'screen'; // 叠加发光效果

    for (const p of galaxyRef.current) {
      const pos = p.distance * galaxyLength;
      const a = p.angle + galaxyRotation;
      const px = cx + Math.cos(a) * pos;
      const py = cy + Math.sin(a) * pos;

      // 距离中心越远，透明度渐弱
      const distFade = 1 - Math.abs(p.distance - 0.5) * 1.4;
      const flicker = 0.7 + 0.3 * Math.sin(t * 0.02 + p.distance * 10);
      const alpha = Math.max(0, p.opacity * distFade * flicker);

      const color = p.colorType === 'primary' ? colors.primary : colors.secondary;

      // 绘制发光粒子（带光晕）
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
    // 绘制闪烁星星
    // ==============================
    const { x: mx, y: my } = mouseRef.current;

    for (const star of starsRef.current) {
      // 闪烁动画：用正弦函数调制透明度
      const twinkle = Math.sin(t * star.twinkleSpeed + star.twinklePhase);
      star.opacity = star.baseOpacity * (0.6 + 0.4 * twinkle);

      // 视差效果：鼠标移动时，不同深度的星星偏移不同距离
      let sx = star.rx * w;
      let sy = star.ry * h;

      if (interactive) {
        const parallaxStrength = star.depth * 20; // 最近层偏移 20px
        sx += (mx - 0.5) * parallaxStrength;
        sy += (my - 0.5) * parallaxStrength;
      }

      // 交替使用 primary 和 secondary 颜色
      const color = star.depth > 0.5 ? colors.primary : colors.secondary;

      ctx.save();
      ctx.globalAlpha = star.opacity;

      // 较大的星星添加光晕
      if (star.size > 1.5) {
        const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, star.size * 3);
        glow.addColorStop(0, hexToRgba(color, 0.4));
        glow.addColorStop(1, hexToRgba(color, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(sx, sy, star.size * 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // 绘制星星核心
      ctx.fillStyle = hexToRgba(color, 1);
      ctx.beginPath();
      ctx.arc(sx, sy, star.size, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // ==============================
    // 绘制流星
    // ==============================
    // 偶尔生成新流星（约每 120 帧一颗）
    if (Math.random() < 0.008) {
      meteorsRef.current.push(spawnMeteor(w, h));
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; // 流星叠加发光

    // 更新并绘制每颗流星
    for (let i = meteorsRef.current.length - 1; i >= 0; i--) {
      const m = meteorsRef.current[i];

      // 更新位置
      m.x += Math.cos(m.angle) * m.speed;
      m.y += Math.sin(m.angle) * m.speed;

      // 递减生命值
      m.life -= 1 / m.maxLife;
      m.opacity = Math.max(0, m.life);

      // 移除已消亡的流星
      if (m.life <= 0) {
        meteorsRef.current.splice(i, 1);
        continue;
      }

      // 计算尾迹终点
      const tailX = m.x - Math.cos(m.angle) * m.length * m.opacity;
      const tailY = m.y - Math.sin(m.angle) * m.length * m.opacity;

      // 绘制流星尾迹（渐变线段）
      const grad = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
      grad.addColorStop(0, hexToRgba(colors.primary, m.opacity * 0.9));
      grad.addColorStop(0.3, hexToRgba(colors.secondary, m.opacity * 0.5));
      grad.addColorStop(1, hexToRgba(colors.secondary, 0));

      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();

      // 流星头部发光点
      const headGlow = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, 4);
      headGlow.addColorStop(0, hexToRgba('#ffffff', m.opacity * 0.8));
      headGlow.addColorStop(0.5, hexToRgba(colors.primary, m.opacity * 0.3));
      headGlow.addColorStop(1, hexToRgba(colors.primary, 0));
      ctx.fillStyle = headGlow;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // --- 继续下一帧 ---
    animationFrameRef.current = requestAnimationFrame(draw);
  }, [theme, interactive, spawnMeteor]);

  // --------------------------------------------------------------------------
  // 处理画布尺寸变化 (高 DPI 支持)
  // --------------------------------------------------------------------------
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;

    canvas.width = w * dpr;
    canvas.height = h * dpr;

    // 使用 CSS 尺寸避免缩放
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }

    dimensionsRef.current = { w, h };
  }, []);

  // --------------------------------------------------------------------------
  // 鼠标移动事件处理
  // --------------------------------------------------------------------------
  const handleMouseMove = useCallback((e: MouseEvent) => {
    // 将鼠标位置归一化到 0~1 范围
    mouseRef.current = {
      x: e.clientX / window.innerWidth,
      y: e.clientY / window.innerHeight,
    };
  }, []);

  // --------------------------------------------------------------------------
  // 初始化与清理
  // --------------------------------------------------------------------------
  useEffect(() => {
    // 初始化数据
    initStars();
    initGalaxy();

    // 设置画布尺寸
    handleResize();

    // 启动动画循环
    animationFrameRef.current = requestAnimationFrame(draw);

    // 监听窗口大小变化
    window.addEventListener('resize', handleResize);

    // 如果启用交互，监听鼠标移动
    if (interactive) {
      window.addEventListener('mousemove', handleMouseMove);
    }

    // 清理：卸载时移除所有事件监听并取消动画帧
    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [initStars, initGalaxy, draw, handleResize, handleMouseMove, interactive]);

  // --------------------------------------------------------------------------
  // 当 theme 或 interactive 变化时重启动画
  // --------------------------------------------------------------------------
  useEffect(() => {
    // 取消当前帧，draw 函数依赖会触发重绘
    return () => {
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [theme, interactive]);

  // --------------------------------------------------------------------------
  // 渲染：固定全屏 canvas，位于层 0
  // --------------------------------------------------------------------------
  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: interactive ? 'auto' : 'none',
      }}
      aria-hidden="true"
    />
  );
};

export default StarField;
