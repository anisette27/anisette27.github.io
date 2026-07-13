'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { BirthdayData, AIGeneratedContent } from '../types';

// ============================================================================
// Props 接口定义
// ============================================================================
interface ClimaxSceneProps {
  /** 寿星完整数据 */
  data: BirthdayData;
  /** AI 生成内容（可为 null） */
  aiContent: AIGeneratedContent | null;
  /** 章节完成回调 */
  onComplete: () => void;
}

// ============================================================================
// 主题颜色映射表 —— 与项目其他组件保持一致
// ============================================================================
const THEME_COLORS: Record<string, { primary: string; secondary: string; fireworks: string[] }> = {
  starry:  { primary: '#4facfe', secondary: '#a855f7', fireworks: ['#4facfe', '#a855f7', '#ec4899', '#fbbf24', '#34d399'] },
  sakura:  { primary: '#f472b6', secondary: '#fb7185', fireworks: ['#f472b6', '#fb7185', '#fda4af', '#fbbf24', '#c084fc'] },
  candy:   { primary: '#fb923c', secondary: '#f472b6', fireworks: ['#fb923c', '#f472b6', '#fbbf24', '#a78bfa', '#34d399'] },
  ocean:   { primary: '#22d3ee', secondary: '#3b82f6', fireworks: ['#22d3ee', '#3b82f6', '#4facfe', '#34d399', '#a78bfa'] },
  forest:  { primary: '#34d399', secondary: '#22c55e', fireworks: ['#34d399', '#22c55e', '#4facfe', '#fbbf24', '#a78bfa'] },
  castle:  { primary: '#c084fc', secondary: '#e879f9', fireworks: ['#c084fc', '#e879f9', '#f472b6', '#fbbf24', '#4facfe'] },
  aurora:  { primary: '#a78bfa', secondary: '#34d399', fireworks: ['#a78bfa', '#34d399', '#22d3ee', '#f472b6', '#fbbf24'] },
  chinese: { primary: '#ef4444', secondary: '#fbbf24', fireworks: ['#ef4444', '#fbbf24', '#f97316', '#ec4899', '#a855f7'] },
  tech:    { primary: '#06b6d4', secondary: '#8b5cf6', fireworks: ['#06b6d4', '#8b5cf6', '#4facfe', '#34d399', '#fbbf24'] },
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
// 烟花发射阶段数据结构
// ============================================================================
interface FireworkRocket {
  /** 当前 x 坐标 */
  x: number;
  /** 当前 y 坐标 */
  y: number;
  /** 上升速度 */
  vy: number;
  /** 水平漂移速度 */
  vx: number;
  /** 目标爆炸高度 (y 坐标) */
  targetY: number;
  /** 火箭颜色 */
  color: string;
  /** 尾迹粒子历史位置 */
  trail: { x: number; y: number; opacity: number }[];
  /** 是否已到达爆炸点 */
  exploded: boolean;
}

// ============================================================================
// 爆炸粒子数据结构
// ============================================================================
interface ExplosionParticle {
  /** 当前 x 坐标 */
  x: number;
  /** 当前 y 坐标 */
  y: number;
  /** x 方向速度 */
  vx: number;
  /** y 方向速度 */
  vy: number;
  /** 粒子半径 */
  size: number;
  /** 当前透明度 */
  opacity: number;
  /** 生命值 (1.0 → 0.0) */
  life: number;
  /** 衰减速度 */
  decay: number;
  /** 颜色 */
  color: string;
  /** 拖尾历史位置 */
  trail: { x: number; y: number }[];
  /** 最大拖尾长度 */
  maxTrail: number;
}

// ============================================================================
// 单朵烟花数据结构（管理火箭 + 爆炸粒子）
// ============================================================================
interface Firework {
  /** 发射阶段的火箭数据 */
  rocket: FireworkRocket | null;
  /** 爆炸后的粒子数组 */
  particles: ExplosionParticle[];
  /** 是否已完全消亡 */
  dead: boolean;
}

// ============================================================================
// 星座连线数据结构
// ============================================================================
interface ConstellationLine {
  /** 起点 */
  x1: number;
  y1: number;
  /** 终点 */
  x2: number;
  y2: number;
  /** 动画进度 (0~1) */
  progress: number;
  /** 透明度 */
  opacity: number;
}

// ============================================================================
// 动画阶段枚举
// ============================================================================
type ClimaxPhase =
  | 'planet-approach'   // 0-5s：镜头拉远 + 生日星球
  | 'fireworks'         // 5-12s：烟花
  | 'text-display'      // 10-15s：文字显示
  | 'blessing-tts'      // 15-18s：AI 朗读祝福
  | 'complete';          // 18-20s：完成

// ============================================================================
// 本地生成祝福语（当 aiContent.letter 不可用时作为兜底）
// ============================================================================
function generateLocalBlessing(data: BirthdayData): string {
  return `亲爱的${data.name}，在这个特别的日子里，` +
    `宇宙为你点亮了${data.age}颗最耀眼的星星。` +
    `愿你心中${data.dream ? `关于"${data.dream}"的梦想` : '所有的梦想'}都能照进现实，` +
    `愿${data.favoriteAnimal}的灵性永远守护在你身旁，` +
    `愿每一个明天都比今天更加闪耀。` +
    `生日快乐！`;
}

// ============================================================================
// ClimaxScene 组件 —— 第六章节：高潮
// ============================================================================
const ClimaxScene: React.FC<ClimaxSceneProps> = ({ data, aiContent, onComplete }) => {
  // ======================== 主题颜色 ========================
  const themeConfig = THEME_COLORS[data.theme] || THEME_COLORS['starry'];
  const colors = { primary: themeConfig.primary, secondary: themeConfig.secondary };
  const fireworkColors = themeConfig.fireworks;

  // ======================== 状态 ========================
  const [phase, setPhase] = useState<ClimaxPhase>('planet-approach');
  const [showPlanet, setShowPlanet] = useState<boolean>(false);
  const [showPlanetLabel, setShowPlanetLabel] = useState<boolean>(false);
  const [showHappyBirthday, setShowHappyBirthday] = useState<boolean>(false);
  const [showName, setShowName] = useState<boolean>(false);
  const [showBlessing, setShowBlessing] = useState<boolean>(false);
  const [showContinueBtn, setShowContinueBtn] = useState<boolean>(false);
  const [displayedBlessing, setDisplayedBlessing] = useState<string>('');
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [highlightedLine, setHighlightedLine] = useState<number>(-1);

  // ======================== Refs ========================
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const fireworksRef = useRef<Firework[]>([]);
  const constellationRef = useRef<ConstellationLine[]>([]);
  const dimensionsRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const startTimeRef = useRef<number>(0);
  const phaseRef = useRef<ClimaxPhase>('planet-approach');
  const fireworkSpawnRef = useRef<number>(0);
  const blessingLinesRef = useRef<string[]>([]);
  const typewriterIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef<boolean>(false);

  // --------------------------------------------------------------------------
  // 获取祝福文字（优先使用 AI 内容第一段）
  // --------------------------------------------------------------------------
  useEffect(() => {
    let blessingText = '';
    if (aiContent?.letter) {
      // 取 AI letter 的第一段（按换行符分割）
      const paragraphs = aiContent.letter.split('\n').filter(p => p.trim().length > 0);
      blessingText = paragraphs[0] || paragraphs.slice(0, 2).join(' ');
    }
    if (!blessingText) {
      blessingText = generateLocalBlessing(data);
    }
    // 按逗号/句号分段用于逐行高亮
    blessingLinesRef.current = blessingText.match(/[^，。！？、；]+[，。！？、；]?/g) || [blessingText];
  }, [aiContent, data]);

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
  // 生成一颗新烟花（发射阶段）
  // --------------------------------------------------------------------------
  const spawnFirework = useCallback((w: number, h: number): Firework => {
    const startX = w * 0.2 + Math.random() * w * 0.6; // 从底部中间区域发射
    const startY = h;
    const targetY = h * 0.1 + Math.random() * h * 0.35; // 在上方爆炸
    const color = fireworkColors[Math.floor(Math.random() * fireworkColors.length)];
    const speed = 6 + Math.random() * 4; // 上升速度

    return {
      rocket: {
        x: startX,
        y: startY,
        vy: -speed,
        vx: (Math.random() - 0.5) * 1.5,
        targetY,
        color,
        trail: [],
        exploded: false,
      },
      particles: [],
      dead: false,
    };
  }, [fireworkColors]);

  // --------------------------------------------------------------------------
  // 将火箭爆炸为粒子
  // --------------------------------------------------------------------------
  const explodeRocket = useCallback((rocket: FireworkRocket): ExplosionParticle[] => {
    const particles: ExplosionParticle[] = [];
    const count = 80 + Math.floor(Math.random() * 60); // 80~140 个粒子

    for (let i = 0; i < count; i++) {
      // 极坐标初始化：随机角度 + 随机速度
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 2 + Math.random() * 4;
      // 随机选择颜色（同色系或混合）
      const useBaseColor = Math.random() > 0.3;
      const color = useBaseColor
        ? rocket.color
        : fireworkColors[Math.floor(Math.random() * fireworkColors.length)];

      particles.push({
        x: rocket.x,
        y: rocket.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 1.5 + Math.random() * 2,
        opacity: 1,
        life: 1,
        decay: 0.008 + Math.random() * 0.012, // 衰减速度
        color,
        trail: [],
        maxTrail: 5 + Math.floor(Math.random() * 5),
      });
    }

    return particles;
  }, [fireworkColors]);

  // --------------------------------------------------------------------------
  // 生成星座连线
  // --------------------------------------------------------------------------
  const spawnConstellation = useCallback((w: number, h: number) => {
    const cx = w * 0.3 + Math.random() * w * 0.4;
    const cy = h * 0.15 + Math.random() * h * 0.3;
    const lineCount = 3 + Math.floor(Math.random() * 4);
    const lines: ConstellationLine[] = [];

    let prevX = cx + (Math.random() - 0.5) * 60;
    let prevY = cy + (Math.random() - 0.5) * 40;

    for (let i = 0; i < lineCount; i++) {
      const nextX = prevX + 30 + Math.random() * 60;
      const nextY = prevY + (Math.random() - 0.5) * 50;
      lines.push({
        x1: prevX,
        y1: prevY,
        x2: nextX,
        y2: nextY,
        progress: 0,
        opacity: 0.6 + Math.random() * 0.3,
      });
      prevX = nextX;
      prevY = nextY;
    }

    constellationRef.current = lines;
  }, []);

  // --------------------------------------------------------------------------
  // 主绘制循环（Canvas 烟花 + 星座 + 背景）
  // --------------------------------------------------------------------------
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { w, h } = dimensionsRef.current;
    if (w === 0 || h === 0) return;

    const elapsed = (performance.now() - startTimeRef.current) / 1000; // 秒
    const currentPhase = phaseRef.current;

    // --- 尾迹效果：不完全清除画布 ---
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;

    // 阶段1开始时完全清除（避免尾迹残留）
    if (elapsed < 0.1) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#0a0a1a';
      ctx.fillRect(0, 0, w, h);
    }

    // ==================================================================
    // 阶段1 (0-5s)：镜头拉远 —— 背景从深空逐渐变亮
    // ==================================================================
    if (elapsed < 5) {
      const brightness = Math.min(1, elapsed / 5) * 0.08;
      const bgGrad = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.6);
      bgGrad.addColorStop(0, hexToRgba(colors.secondary, brightness));
      bgGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // 背景星星闪烁
      const time = elapsed * 60;
      for (let i = 0; i < 100; i++) {
        const sx = ((i * 137.508) % w); // 使用黄金角分布
        const sy = ((i * 97.31 + i * i * 0.3) % h);
        const twinkle = 0.3 + 0.7 * Math.sin(time * 0.02 + i * 1.7);
        ctx.save();
        ctx.globalAlpha = twinkle * (elapsed / 5) * 0.5;
        ctx.fillStyle = hexToRgba(colors.primary, 1);
        ctx.beginPath();
        ctx.arc(sx, sy, 1 + Math.random() * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // ==================================================================
    // 阶段2 (5-12s)：烟花 Canvas 绘制
    // ==================================================================
    if (elapsed >= 4.5 && elapsed <= 19) {
      // 发射新烟花（每 0.8 秒一波）
      fireworkSpawnRef.current += 1;
      if (fireworkSpawnRef.current % 48 === 0) { // ~0.8s at 60fps
        fireworksRef.current.push(spawnFirework(w, h));
      }

      // 随机穿插星座连线（每 3 秒）
      if (Math.floor(elapsed * 60) % 180 === 0 && Math.random() > 0.5) {
        spawnConstellation(w, h);
      }

      // 使用 lighter 混合模式产生发光效果
      ctx.globalCompositeOperation = 'lighter';

      // 更新并绘制所有烟花
      for (let fi = fireworksRef.current.length - 1; fi >= 0; fi--) {
        const fw = fireworksRef.current[fi];

        // --- 火箭阶段 ---
        if (fw.rocket && !fw.rocket.exploded) {
          const r = fw.rocket;

          // 更新位置
          r.x += r.vx;
          r.y += r.vy;
          // 重力减速
          r.vy += 0.02;

          // 记录尾迹
          r.trail.push({ x: r.x, y: r.y, opacity: 1 });
          if (r.trail.length > 12) r.trail.shift();

          // 到达目标高度 → 爆炸
          if (r.y <= r.targetY) {
            r.exploded = true;
            fw.particles = explodeRocket(r);
            fw.rocket = null;
          } else {
            // 绘制火箭尾迹
            for (let ti = 0; ti < r.trail.length; ti++) {
              const tp = r.trail[ti];
              const trailAlpha = (ti / r.trail.length) * 0.6;
              ctx.save();
              ctx.globalAlpha = trailAlpha;
              ctx.fillStyle = r.color;
              ctx.beginPath();
              ctx.arc(tp.x, tp.y, 2, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }

            // 绘制火箭头部发光点
            ctx.save();
            const headGlow = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, 6);
            headGlow.addColorStop(0, hexToRgba('#ffffff', 0.9));
            headGlow.addColorStop(0.4, hexToRgba(r.color, 0.5));
            headGlow.addColorStop(1, hexToRgba(r.color, 0));
            ctx.fillStyle = headGlow;
            ctx.beginPath();
            ctx.arc(r.x, r.y, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }

        // --- 爆炸粒子阶段 ---
        if (fw.particles.length > 0) {
          let allDead = true;

          for (let pi = fw.particles.length - 1; pi >= 0; pi--) {
            const p = fw.particles[pi];

            // 更新物理
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.04; // 重力
            p.vx *= 0.985; // 阻力
            p.vy *= 0.985;
            p.life -= p.decay;
            p.opacity = Math.max(0, p.life);
            p.size = Math.max(0.1, p.size * 0.995);

            if (p.life <= 0) {
              fw.particles.splice(pi, 1);
              continue;
            }

            allDead = false;

            // 记录拖尾
            p.trail.push({ x: p.x, y: p.y });
            if (p.trail.length > p.maxTrail) p.trail.shift();

            // 绘制拖尾
            for (let ti = 0; ti < p.trail.length - 1; ti++) {
              const tp = p.trail[ti];
              const trailAlpha = (ti / p.trail.length) * p.opacity * 0.3;
              ctx.save();
              ctx.globalAlpha = trailAlpha;
              ctx.fillStyle = p.color;
              ctx.beginPath();
              ctx.arc(tp.x, tp.y, p.size * 0.5, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }

            // 绘制粒子本体（发光）
            ctx.save();
            ctx.globalAlpha = p.opacity;
            const pGlow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
            pGlow.addColorStop(0, hexToRgba('#ffffff', 0.6 * p.opacity));
            pGlow.addColorStop(0.3, hexToRgba(p.color, p.opacity));
            pGlow.addColorStop(1, hexToRgba(p.color, 0));
            ctx.fillStyle = pGlow;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          if (allDead && !fw.rocket) {
            fw.dead = true;
          }
        }

        // 移除已消亡的烟花
        if (fw.dead) {
          fireworksRef.current.splice(fi, 1);
        }
      }

      // --- 星座连线绘制 ---
      ctx.globalCompositeOperation = 'lighter';
      for (let ci = constellationRef.current.length - 1; ci >= 0; ci--) {
        const cl = constellationRef.current[ci];
        cl.progress = Math.min(1, cl.progress + 0.03);
        cl.opacity -= 0.003;

        if (cl.opacity <= 0) {
          constellationRef.current.splice(ci, 1);
          continue;
        }

        const currentX = cl.x1 + (cl.x2 - cl.x1) * cl.progress;
        const currentY = cl.y1 + (cl.y2 - cl.y1) * cl.progress;

        ctx.save();
        ctx.globalAlpha = cl.opacity * 0.4;
        ctx.strokeStyle = colors.primary;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cl.x1, cl.y1);
        ctx.lineTo(currentX, currentY);
        ctx.stroke();

        // 连线两端发光点
        const dotGlow = ctx.createRadialGradient(cl.x1, cl.y1, 0, cl.x1, cl.y1, 3);
        dotGlow.addColorStop(0, hexToRgba(colors.secondary, cl.opacity));
        dotGlow.addColorStop(1, hexToRgba(colors.secondary, 0));
        ctx.fillStyle = dotGlow;
        ctx.beginPath();
        ctx.arc(cl.x1, cl.y1, 3, 0, Math.PI * 2);
        ctx.fill();

        if (cl.progress > 0.8) {
          const endGlow = ctx.createRadialGradient(cl.x2, cl.y2, 0, cl.x2, cl.y2, 3);
          endGlow.addColorStop(0, hexToRgba(colors.secondary, cl.opacity));
          endGlow.addColorStop(1, hexToRgba(colors.secondary, 0));
          ctx.fillStyle = endGlow;
          ctx.beginPath();
          ctx.arc(cl.x2, cl.y2, 3, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      ctx.globalCompositeOperation = 'source-over';
    }

    // ==================================================================
    // 阶段4 末尾 (18-20s)：烟花逐渐减弱
    // ==================================================================
    if (elapsed >= 18) {
      // 停止发射新烟花（通过不再生成）
      // 现有烟花自然消亡
    }

    // --- 下一帧 ---
    animFrameRef.current = requestAnimationFrame(draw);
  }, [colors, fireworkColors, spawnFirework, explodeRocket, spawnConstellation]);

  // --------------------------------------------------------------------------
  // TTS 朗读功能（Web Speech API）
  // --------------------------------------------------------------------------
  const handleTTS = useCallback(() => {
    if (isSpeaking) {
      // 停止朗读
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setHighlightedLine(-1);
      return;
    }

    const text = blessingLinesRef.current.join('');
    if (!text) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.9;
    utterance.pitch = 1.1;

    // 尝试使用中文语音
    const voices = window.speechSynthesis.getVoices();
    const zhVoice = voices.find(v => v.lang.startsWith('zh'));
    if (zhVoice) {
      utterance.voice = zhVoice;
    }

    // 逐行高亮逻辑
    let charOffset = 0;
    utterance.onboundary = (event) => {
      if (event.name === 'word' || event.name === 'sentence') {
        const currentChar = event.charIndex;
        // 计算当前高亮行
        let accumulated = 0;
        for (let i = 0; i < blessingLinesRef.current.length; i++) {
          accumulated += blessingLinesRef.current[i].length;
          if (currentChar < accumulated) {
            setHighlightedLine(i);
            break;
          }
        }
      }
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setHighlightedLine(-1);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setHighlightedLine(-1);
    };

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, [isSpeaking]);

  // --------------------------------------------------------------------------
  // 打字机效果（阶段4：逐字显示祝福文字）
  // --------------------------------------------------------------------------
  const startTypewriter = useCallback(() => {
    const fullText = blessingLinesRef.current.join('');
    let charIndex = 0;

    typewriterIntervalRef.current = setInterval(() => {
      if (charIndex <= fullText.length) {
        setDisplayedBlessing(fullText.slice(0, charIndex));
        charIndex++;
      } else {
        if (typewriterIntervalRef.current) {
          clearInterval(typewriterIntervalRef.current);
          typewriterIntervalRef.current = null;
        }
      }
    }, 60); // 每 60ms 一个字符
  }, []);

  // --------------------------------------------------------------------------
  // 阶段切换定时器
  // --------------------------------------------------------------------------
  useEffect(() => {
    startTimeRef.current = performance.now();

    const timers: ReturnType<typeof setTimeout>[] = [];

    // 阶段1：星球出现 (0.5s)
    timers.push(setTimeout(() => setShowPlanet(true), 500));

    // 阶段1：星球标签渐入 (2s)
    timers.push(setTimeout(() => setShowPlanetLabel(true), 2000));

    // 阶段2：烟花开始 (4.5s)
    timers.push(setTimeout(() => {
      setPhase('fireworks');
      phaseRef.current = 'fireworks';
    }, 4500));

    // 阶段3：Happy Birthday 文字 (10s)
    timers.push(setTimeout(() => {
      setPhase('text-display');
      phaseRef.current = 'text-display';
      setShowHappyBirthday(true);
    }, 10000));

    // 阶段3：姓名文字 (11s)
    timers.push(setTimeout(() => setShowName(true), 11000));

    // 阶段4：祝福 + 打字机 (15s)
    timers.push(setTimeout(() => {
      setPhase('blessing-tts');
      phaseRef.current = 'blessing-tts';
      setShowBlessing(true);
      startTypewriter();
    }, 15000));

    // 阶段5：完成 (18s)
    timers.push(setTimeout(() => {
      setPhase('complete');
      phaseRef.current = 'complete';
      setShowContinueBtn(true);
    }, 18000));

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [startTypewriter]);

  // --------------------------------------------------------------------------
  // 初始化画布并启动动画循环
  // --------------------------------------------------------------------------
  useEffect(() => {
    handleResize();
    animFrameRef.current = requestAnimationFrame(draw);
    window.addEventListener('resize', handleResize);

    // 预加载语音列表（某些浏览器需要异步加载）
    window.speechSynthesis.getVoices();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
      // 清理 TTS
      window.speechSynthesis.cancel();
      // 清理打字机定时器
      if (typewriterIntervalRef.current) {
        clearInterval(typewriterIntervalRef.current);
      }
    };
  }, [handleResize, draw]);

  // --------------------------------------------------------------------------
  // 渲染
  // --------------------------------------------------------------------------
  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden" style={{ background: '#0a0a1a' }}>
      {/* 全屏 Canvas —— 烟花 + 背景 */}
      <canvas
        ref={canvasRef}
        className="canvas-fullscreen"
        style={{ pointerEvents: 'none' }}
        aria-hidden="true"
      />

      {/* ============================================================ */}
      {/* 阶段1 (0-5s)：生日星球 —— CSS 径向渐变 + 粒子环绕 */}
      {/* ============================================================ */}
      <AnimatePresence>
        {showPlanet && (
          <motion.div
            className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"
          >
            {/* 星球球体 */}
            <motion.div
              className="relative"
              initial={{ scale: 0.1, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 4, ease: 'easeOut' }}
            >
              {/* 外层发光光环（粒子环绕模拟） */}
              <motion.div
                className="absolute -inset-20 rounded-full"
                style={{
                  background: `radial-gradient(circle, ${hexToRgba(colors.primary, 0.15)}, transparent 60%)`,
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              >
                {/* 环绕粒子 */}
                {[0, 60, 120, 180, 240, 300].map((deg) => (
                  <motion.div
                    key={deg}
                    className="absolute w-2 h-2 rounded-full"
                    style={{
                      background: deg % 120 === 0 ? colors.primary : colors.secondary,
                      boxShadow: `0 0 6px ${deg % 120 === 0 ? colors.primary : colors.secondary}`,
                      top: '50%',
                      left: '50%',
                      transform: `rotate(${deg}deg) translateY(-120px)`,
                    }}
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 2, repeat: Infinity, delay: deg / 360 * 2 }}
                  />
                ))}
              </motion.div>

              {/* 星球本体 —— CSS 径向渐变模拟陆地和海洋 */}
              <motion.div
                className="w-40 h-40 md:w-56 md:h-56 rounded-full relative overflow-hidden"
                style={{
                  background: `
                    radial-gradient(circle at 30% 30%, ${hexToRgba(colors.primary, 0.9)} 0%, transparent 40%),
                    radial-gradient(ellipse at 60% 50%, ${hexToRgba('#1a5c3a', 0.6)} 0%, transparent 35%),
                    radial-gradient(ellipse at 35% 65%, ${hexToRgba('#1a5c3a', 0.5)} 0%, transparent 30%),
                    radial-gradient(circle at 70% 70%, ${hexToRgba(colors.secondary, 0.8)} 0%, transparent 45%),
                    radial-gradient(circle at 50% 50%, ${hexToRgba('#0d3d6b', 0.9)} 0%, ${hexToRgba('#0a1628', 1)} 100%)
                  `,
                  boxShadow: `
                    0 0 60px ${hexToRgba(colors.primary, 0.5)},
                    0 0 120px ${hexToRgba(colors.secondary, 0.25)},
                    inset -20px -20px 40px rgba(0,0,0,0.5),
                    inset 10px 10px 30px ${hexToRgba(colors.primary, 0.15)}
                  `,
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
              >
                {/* 大气层光泽 */}
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `radial-gradient(circle at 25% 25%, rgba(255,255,255,0.15), transparent 50%)`,
                  }}
                />
              </motion.div>
            </motion.div>

            {/* 星球标签 */}
            <AnimatePresence>
              {showPlanetLabel && (
                <motion.div
                  className="absolute -bottom-16 left-1/2 -translate-x-1/2 whitespace-nowrap"
                  initial={{ opacity: 0, y: 10, filter: 'blur(10px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ duration: 1.5 }}
                >
                  <p
                    className="text-2xl md:text-3xl font-semibold text-center"
                    style={{
                      background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      textShadow: 'none',
                      filter: `drop-shadow(0 0 20px ${hexToRgba(colors.primary, 0.4)})`,
                    }}
                  >
                    {'\u2728'} {data.name} Planet {'\u2728'}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================ */}
      {/* 阶段3 (10-15s)：Happy Birthday + 姓名文字 */}
      {/* ============================================================ */}
      <AnimatePresence>
        {showHappyBirthday && (
          <motion.div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none"
          >
            {/* "Happy Birthday" 大字 */}
            <motion.h1
              className="text-5xl md:text-7xl lg:text-8xl font-bold mb-4 text-center"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 12, stiffness: 200, duration: 1.5 }}
              style={{
                background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary}, ${colors.primary})`,
                backgroundSize: '200% 200%',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                animation: 'gradientShift 3s ease infinite',
                textShadow: 'none',
                filter: `drop-shadow(0 0 30px ${hexToRgba(colors.primary, 0.5)}) drop-shadow(0 0 60px ${hexToRgba(colors.secondary, 0.3)})`,
              }}
            >
              Happy Birthday
            </motion.h1>

            {/* 寿星姓名 */}
            <AnimatePresence>
              {showName && (
                <motion.p
                  className="text-3xl md:text-5xl lg:text-6xl font-light mb-2 text-center"
                  initial={{ scale: 0.5, opacity: 0, y: 30 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={{ type: 'spring', damping: 15, stiffness: 150, delay: 0.3 }}
                  style={{
                    background: `linear-gradient(90deg, ${colors.secondary}, ${colors.primary})`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    filter: `drop-shadow(0 0 25px ${hexToRgba(colors.secondary, 0.6)})`,
                  }}
                >
                  {data.name}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================ */}
      {/* 阶段4 (15-18s)：AI 朗读祝福 + 打字机效果 */}
      {/* ============================================================ */}
      <AnimatePresence>
        {showBlessing && (
          <motion.div
            className="absolute inset-0 z-30 flex flex-col items-center justify-end pb-32 px-8 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
          >
            {/* 祝福文字容器 */}
            <motion.div
              className="glass-strong p-6 md:p-8 max-w-lg w-full mb-6"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 1, delay: 0.3 }}
            >
              {/* 逐行显示祝福 */}
              <div className="space-y-2">
                {blessingLinesRef.current.map((line, index) => {
                  // 判断该行是否已被打字机显示到
                  const fullText = blessingLinesRef.current.slice(0, index + 1).join('');
                  const isLineVisible = displayedBlessing.length >= fullText.trimEnd().length - line.trimEnd().length;

                  return (
                    <motion.p
                      key={index}
                      className="text-sm md:text-base leading-relaxed transition-all duration-300"
                      style={{
                        color: highlightedLine === index
                          ? colors.primary
                          : isLineVisible ? '#e2e8f0' : 'rgba(226, 232, 240, 0)',
                        textShadow: highlightedLine === index
                          ? `0 0 15px ${hexToRgba(colors.primary, 0.6)}`
                          : 'none',
                        fontWeight: highlightedLine === index ? 600 : 400,
                      }}
                    >
                      {line}
                    </motion.p>
                  );
                })}
              </div>

              {/* 打字机光标（文字未显示完毕时） */}
              {displayedBlessing.length < blessingLinesRef.current.join('').length && (
                <span className="typewriter-cursor" />
              )}
            </motion.div>

            {/* TTS 朗读按钮 */}
            <motion.div
              className="pointer-events-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1 }}
            >
              <button
                onClick={handleTTS}
                className="glass px-5 py-3 rounded-full flex items-center gap-3 mx-auto hover:bg-white/10 transition-all group"
                style={{
                  borderColor: isSpeaking ? colors.primary : 'rgba(255,255,255,0.1)',
                  boxShadow: isSpeaking ? `0 0 20px ${hexToRgba(colors.primary, 0.3)}` : 'none',
                }}
                aria-label={isSpeaking ? '停止朗读' : '朗读祝福'}
              >
                {/* 声音图标 */}
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={isSpeaking ? colors.primary : 'rgba(255,255,255,0.7)'}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {isSpeaking ? (
                    <>
                      <line x1="6" y1="4" x2="6" y2="20" />
                      <line x1="10" y1="8" x2="10" y2="16" />
                      <line x1="14" y1="5" x2="14" y2="19" />
                      <line x1="18" y1="9" x2="18" y2="15" />
                    </>
                  ) : (
                    <>
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                    </>
                  )}
                </svg>
                <span
                  className="text-sm font-medium"
                  style={{ color: isSpeaking ? colors.primary : 'rgba(255,255,255,0.7)' }}
                >
                  {isSpeaking ? '停止朗读' : '朗读祝福'}
                </span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================ */}
      {/* 阶段5 (18-20s)：继续按钮 */}
      {/* ============================================================ */}
      <AnimatePresence>
        {showContinueBtn && (
          <motion.div
            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40"
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            <button onClick={onComplete} className="btn-cosmic">
              继续旅程
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 内嵌渐变动画关键帧 */}
      <style jsx global>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
};

export default ClimaxScene;
