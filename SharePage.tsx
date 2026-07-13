'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { BirthdayData, AIGeneratedContent } from '../types';

// ============================================================================
// Props 接口定义
// ============================================================================
interface SharePageProps {
  /** 寿星完整数据 */
  data: BirthdayData;
  /** AI 生成内容（可为 null） */
  aiContent: AIGeneratedContent | null;
}

// ============================================================================
// 留言数据结构
// ============================================================================
interface Message {
  /** 留言唯一 ID */
  id: string;
  /** 留言内容 */
  text: string;
  /** 留言时间 */
  timestamp: number;
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
// 本地生成诗句（当 aiContent.poem 不可用时作为兜底）
// ============================================================================
function generateLocalPoem(data: BirthdayData): string {
  const poems = [
    `在宇宙的${data.age}个光年里，\n${data.name}是最亮的那颗星。`,
    `岁月温柔，星辰作伴，\n祝${data.name}${data.age}岁生日快乐。`,
    `银河为你流淌，\n星光因你闪耀，\n${data.age}岁的宇宙因你而不同。`,
    `穿越${data.age}光年的距离，\n宇宙送来最温暖的祝福，\n给最特别的${data.name}。`,
  ];
  return poems[Math.floor(Math.random() * poems.length)];
}

// ============================================================================
// 海报绘制尺寸
// ============================================================================
const POSTER_WIDTH = 750;
const POSTER_HEIGHT = 1334; // 接近 9:16 比例

// ============================================================================
// 操作按钮数据
// ============================================================================
interface ActionButton {
  /** 图标 */
  icon: string;
  /** 按钮文字 */
  label: string;
  /** 操作类型 */
  action: 'save' | 'copy' | 'wechat' | 'restart' | 'message';
}

const ACTION_BUTTONS: ActionButton[] = [
  { icon: '\uD83D\uDCF8', label: '保存海报', action: 'save' },
  { icon: '\uD83D\uDD17', label: '复制链接', action: 'copy' },
  { icon: '\uD83D\uDCAC', label: '分享到微信', action: 'wechat' },
  { icon: '\u2728', label: '再来一次', action: 'restart' },
  { icon: '\uD83C\uDFA4', label: '留下祝福', action: 'message' },
];

// ============================================================================
// SharePage 组件 —— 分享页面
// ============================================================================
const SharePage: React.FC<SharePageProps> = ({ data, aiContent }) => {
  // ======================== 主题颜色 ========================
  const themeConfig = THEME_COLORS[data.theme] || THEME_COLORS['starry'];
  const colors = {
    primary: themeConfig.primary,
    secondary: themeConfig.secondary,
    accent: themeConfig.accent,
  };

  // ======================== 状态 ========================
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [showMessageInput, setShowMessageInput] = useState<boolean>(false);
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showWechatHint, setShowWechatHint] = useState<boolean>(false);

  // ======================== Refs ========================
  const posterCanvasRef = useRef<HTMLCanvasElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);

  // --------------------------------------------------------------------------
  // 获取诗句（优先使用 AI 内容第一句）
  // --------------------------------------------------------------------------
  const poemText = (() => {
    if (aiContent?.poem) {
      // 取 poem 的第一行
      const lines = aiContent.poem.split('\n').filter(l => l.trim().length > 0);
      return lines[0] || aiContent.poem.slice(0, 50);
    }
    return generateLocalPoem(data);
  })();

  // --------------------------------------------------------------------------
  // 显示 toast 通知
  // --------------------------------------------------------------------------
  const showToastNotification = useCallback((msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 2500);
  }, []);

  // --------------------------------------------------------------------------
  // 绘制海报到 Canvas
  // --------------------------------------------------------------------------
  const drawPoster = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = POSTER_WIDTH;
    const h = POSTER_HEIGHT;

    canvas.width = w;
    canvas.height = h;

    // --- 背景渐变 ---
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#0a0a1a');
    bgGrad.addColorStop(0.3, hexToRgba(colors.primary, 0.15));
    bgGrad.addColorStop(0.6, hexToRgba(colors.secondary, 0.1));
    bgGrad.addColorStop(1, '#0a0a1a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // --- 背景星星 ---
    for (let i = 0; i < 120; i++) {
      const sx = ((i * 137.508 + i * i * 0.7) % 1000) / 1000 * w;
      const sy = ((i * 97.31 + i * i * 0.3) % 1000) / 1000 * h;
      const sSize = 0.5 + Math.random() * 2;
      const sAlpha = 0.2 + Math.random() * 0.6;
      ctx.save();
      ctx.globalAlpha = sAlpha;
      ctx.fillStyle = Math.random() > 0.5 ? colors.primary : colors.secondary;
      ctx.beginPath();
      ctx.arc(sx, sy, sSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // --- 中心发光 ---
    const centerGlow = ctx.createRadialGradient(w / 2, h * 0.35, 0, w / 2, h * 0.35, 300);
    centerGlow.addColorStop(0, hexToRgba(colors.primary, 0.15));
    centerGlow.addColorStop(0.5, hexToRgba(colors.secondary, 0.05));
    centerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = centerGlow;
    ctx.fillRect(0, 0, w, h);

    // --- Logo ---
    ctx.save();
    ctx.font = 'bold 28px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const logoGrad = ctx.createLinearGradient(w / 2 - 80, h * 0.1, w / 2 + 80, h * 0.1);
    logoGrad.addColorStop(0, colors.primary);
    logoGrad.addColorStop(1, colors.secondary);
    ctx.fillStyle = logoGrad;
    ctx.fillText('Birthday Galaxy', w / 2, h * 0.1);
    ctx.restore();

    // --- 装饰线 ---
    const decoLineY = h * 0.14;
    const decoGrad = ctx.createLinearGradient(w * 0.2, 0, w * 0.8, 0);
    decoGrad.addColorStop(0, hexToRgba(colors.primary, 0));
    decoGrad.addColorStop(0.5, hexToRgba(colors.primary, 0.3));
    decoGrad.addColorStop(1, hexToRgba(colors.primary, 0));
    ctx.strokeStyle = decoGrad;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w * 0.2, decoLineY);
    ctx.lineTo(w * 0.8, decoLineY);
    ctx.stroke();

    // --- 主标题："{name} 的 {age} 岁生日" ---
    ctx.save();
    const titleSize = 48;
    ctx.font = `bold ${titleSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const titleGrad = ctx.createLinearGradient(
      w / 2 - titleSize * 3, h * 0.25,
      w / 2 + titleSize * 3, h * 0.25
    );
    titleGrad.addColorStop(0, '#ffffff');
    titleGrad.addColorStop(0.5, colors.primary);
    titleGrad.addColorStop(1, '#ffffff');
    ctx.fillStyle = titleGrad;
    ctx.shadowColor = hexToRgba(colors.primary, 0.5);
    ctx.shadowBlur = 30;
    ctx.fillText(`${data.name} 的 ${data.age} 岁生日`, w / 2, h * 0.25);
    ctx.shadowBlur = 0;
    ctx.restore();

    // --- 诗句区域（玻璃拟态背景） ---
    const poemBoxW = w * 0.75;
    const poemBoxH = 200;
    const poemBoxX = (w - poemBoxW) / 2;
    const poemBoxY = h * 0.35;

    // 玻璃拟态矩形
    ctx.save();
    const poemBgGrad = ctx.createLinearGradient(poemBoxX, poemBoxY, poemBoxX + poemBoxW, poemBoxY + poemBoxH);
    poemBgGrad.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
    poemBgGrad.addColorStop(1, 'rgba(255, 255, 255, 0.04)');
    ctx.fillStyle = poemBgGrad;
    // 圆角矩形
    const cr = 16;
    ctx.beginPath();
    ctx.moveTo(poemBoxX + cr, poemBoxY);
    ctx.lineTo(poemBoxX + poemBoxW - cr, poemBoxY);
    ctx.arcTo(poemBoxX + poemBoxW, poemBoxY, poemBoxX + poemBoxW, poemBoxY + cr, cr);
    ctx.lineTo(poemBoxX + poemBoxW, poemBoxY + poemBoxH - cr);
    ctx.arcTo(poemBoxX + poemBoxW, poemBoxY + poemBoxH, poemBoxX + poemBoxW - cr, poemBoxY + poemBoxH, cr);
    ctx.lineTo(poemBoxX + cr, poemBoxY + poemBoxH);
    ctx.arcTo(poemBoxX, poemBoxY + poemBoxH, poemBoxX, poemBoxY + poemBoxH - cr, cr);
    ctx.lineTo(poemBoxX, poemBoxY + cr);
    ctx.arcTo(poemBoxX, poemBoxY, poemBoxX + cr, poemBoxY, cr);
    ctx.closePath();
    ctx.fill();

    // 边框
    ctx.strokeStyle = hexToRgba(colors.primary, 0.3);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // 诗句文字
    ctx.save();
    ctx.font = '22px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';

    // 处理多行诗句
    const poemLines = poemText.split('\n');
    const lineHeight = 34;
    const poemStartY = poemBoxY + poemBoxH / 2 - (poemLines.length - 1) * lineHeight / 2;

    poemLines.forEach((line, i) => {
      ctx.fillText(line.trim(), w / 2, poemStartY + i * lineHeight);
    });
    ctx.restore();

    // --- 装饰光点 ---
    const lightDots = [
      { x: w * 0.15, y: h * 0.55, r: 4 },
      { x: w * 0.85, y: h * 0.6, r: 3 },
      { x: w * 0.25, y: h * 0.75, r: 5 },
      { x: w * 0.75, y: h * 0.8, r: 3 },
      { x: w * 0.5, y: h * 0.7, r: 4 },
    ];
    for (const dot of lightDots) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      const dotGlow = ctx.createRadialGradient(dot.x, dot.y, 0, dot.x, dot.y, dot.r * 4);
      dotGlow.addColorStop(0, hexToRgba(colors.primary, 0.8));
      dotGlow.addColorStop(0.5, hexToRgba(colors.secondary, 0.3));
      dotGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = dotGlow;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, dot.r * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // --- 底部文字 ---
    ctx.save();
    ctx.font = '14px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillText('在 Birthday Galaxy 开启你的生日旅行', w / 2, h * 0.9);
    ctx.restore();

    // --- 底部装饰线 ---
    const bottomDecoY = h * 0.92;
    const bottomDecoGrad = ctx.createLinearGradient(w * 0.3, 0, w * 0.7, 0);
    bottomDecoGrad.addColorStop(0, hexToRgba(colors.secondary, 0));
    bottomDecoGrad.addColorStop(0.5, hexToRgba(colors.secondary, 0.2));
    bottomDecoGrad.addColorStop(1, hexToRgba(colors.secondary, 0));
    ctx.strokeStyle = bottomDecoGrad;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w * 0.3, bottomDecoY);
    ctx.lineTo(w * 0.7, bottomDecoY);
    ctx.stroke();
  }, [colors, data.name, data.age, poemText]);

  // --------------------------------------------------------------------------
  // "保存海报" —— Canvas 绘制 → 下载图片
  // --------------------------------------------------------------------------
  const handleSavePoster = useCallback(() => {
    setIsSaving(true);

    // 创建离屏 Canvas 绘制海报
    const offscreenCanvas = document.createElement('canvas');
    drawPoster(offscreenCanvas);

    // 转换为 DataURL 并触发下载
    try {
      const dataUrl = offscreenCanvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${data.name}-birthday-galaxy.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToastNotification('海报已保存');
    } catch (err) {
      showToastNotification('保存失败，请重试');
    }

    setIsSaving(false);
  }, [drawPoster, data.name, showToastNotification]);

  // --------------------------------------------------------------------------
  // "复制链接" —— 复制当前页面 URL 到剪贴板
  // --------------------------------------------------------------------------
  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToastNotification('链接已复制');
    } catch {
      // 降级方案：使用 textarea + execCommand
      const textarea = document.createElement('textarea');
      textarea.value = window.location.href;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showToastNotification('链接已复制');
    }
  }, [showToastNotification]);

  // --------------------------------------------------------------------------
  // "分享到微信" —— 显示截图提示
  // --------------------------------------------------------------------------
  const handleWechatShare = useCallback(() => {
    setShowWechatHint(true);
    // 5秒后自动关闭提示
    setTimeout(() => {
      setShowWechatHint(false);
    }, 5000);
  }, []);

  // --------------------------------------------------------------------------
  // "再来一次" —— 刷新页面
  // --------------------------------------------------------------------------
  const handleRestart = useCallback(() => {
    window.location.reload();
  }, []);

  // --------------------------------------------------------------------------
  // "留下祝福" —— 切换留言输入框显示
  // --------------------------------------------------------------------------
  const handleToggleMessage = useCallback(() => {
    setShowMessageInput(prev => !prev);
    // 打开后聚焦输入框
    setTimeout(() => {
      if (messageInputRef.current) {
        messageInputRef.current.focus();
      }
    }, 100);
  }, []);

  // --------------------------------------------------------------------------
  // 提交留言
  // --------------------------------------------------------------------------
  const handleSubmitMessage = useCallback(() => {
    if (!inputText.trim()) return;

    const newMessage: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: inputText.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [newMessage, ...prev]);
    setInputText('');
    showToastNotification('祝福已送出');
  }, [inputText, showToastNotification]);

  // --------------------------------------------------------------------------
  // 按钮点击分发
  // --------------------------------------------------------------------------
  const handleAction = useCallback((action: ActionButton['action']) => {
    switch (action) {
      case 'save':
        handleSavePoster();
        break;
      case 'copy':
        handleCopyLink();
        break;
      case 'wechat':
        handleWechatShare();
        break;
      case 'restart':
        handleRestart();
        break;
      case 'message':
        handleToggleMessage();
        break;
    }
  }, [handleSavePoster, handleCopyLink, handleWechatShare, handleRestart, handleToggleMessage]);

  // --------------------------------------------------------------------------
  // 初始化隐藏的海报 Canvas（用于生成海报图片）
  // --------------------------------------------------------------------------
  useEffect(() => {
    const canvas = posterCanvasRef.current;
    if (canvas) {
      drawPoster(canvas);
    }
  }, [drawPoster]);

  // --------------------------------------------------------------------------
  // 渲染
  // --------------------------------------------------------------------------
  return (
    <div className="relative w-full min-h-screen flex flex-col items-center justify-start py-8 px-4 overflow-y-auto page-transition" style={{ background: '#0a0a1a' }}>

      {/* ============================================================ */}
      {/* 标题区域 */}
      {/* ============================================================ */}
      <motion.div
        className="text-center mb-8 mt-4"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        {/* 主标题 —— 渐变文字 */}
        <h1
          className="text-3xl md:text-4xl font-bold mb-3"
          style={{
            background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary}, ${colors.accent})`,
            backgroundSize: '200% 200%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: `drop-shadow(0 0 20px ${hexToRgba(colors.primary, 0.4)})`,
          }}
        >
          你的生日宇宙
        </h1>

        {/* 副标题 */}
        <p
          className="text-sm md:text-base font-light"
          style={{ color: 'rgba(226, 232, 240, 0.6)' }}
        >
          将这份独一无二的祝福分享给更多人
        </p>
      </motion.div>

      {/* ============================================================ */}
      {/* 海报预览区域 */}
      {/* ============================================================ */}
      <motion.div
        className="w-full max-w-sm md:max-w-md mb-8"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
      >
        <div className="glass-strong p-3 relative overflow-hidden">
          {/* 海报内容预览（使用 Canvas 渲染） */}
          <div className="relative w-full aspect-[9/16] rounded-2xl overflow-hidden">
            <canvas
              ref={posterCanvasRef}
              className="w-full h-full object-cover"
              style={{
                borderRadius: '16px',
                imageRendering: 'auto',
              }}
            />
          </div>

          {/* 海报装饰光效 */}
          <div
            className="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-20 blur-3xl pointer-events-none"
            style={{ background: colors.primary }}
          />
          <div
            className="absolute -bottom-20 -left-20 w-40 h-40 rounded-full opacity-15 blur-3xl pointer-events-none"
            style={{ background: colors.secondary }}
          />
        </div>
      </motion.div>

      {/* ============================================================ */}
      {/* 操作按钮区域（grid 布局） */}
      {/* ============================================================ */}
      <motion.div
        className="w-full max-w-sm md:max-w-md mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
      >
        <div className="glass px-6 py-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {ACTION_BUTTONS.map((btn, index) => (
              <motion.button
                key={btn.action}
                onClick={() => handleAction(btn.action)}
                className="flex flex-col items-center gap-2 px-4 py-4 rounded-2xl transition-all"
                style={{
                  background: btn.action === 'save'
                    ? `linear-gradient(135deg, ${hexToRgba(colors.primary, 0.2)}, ${hexToRgba(colors.secondary, 0.2)})`
                    : 'rgba(255, 255, 255, 0.04)',
                  border: `1px solid ${hexToRgba(colors.primary, btn.action === 'save' ? 0.3 : 0.1)}`,
                }}
                whileHover={{
                  scale: 1.05,
                  backgroundColor: hexToRgba(colors.primary, 0.15),
                  borderColor: hexToRgba(colors.primary, 0.4),
                }}
                whileTap={{ scale: 0.95 }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.5 + index * 0.08 }}
                disabled={btn.action === 'save' && isSaving}
              >
                <span className="text-xl">{btn.icon}</span>
                <span className="text-xs font-medium" style={{ color: '#e2e8f0' }}>
                  {isSaving && btn.action === 'save' ? '保存中...' : btn.label}
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ============================================================ */}
      {/* 留言区域 */}
      {/* ============================================================ */}
      <AnimatePresence>
        {showMessageInput && (
          <motion.div
            className="w-full max-w-sm md:max-w-md mb-8"
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            {/* 留言输入框 */}
            <div className="glass px-6 py-5 mb-4">
              <h3
                className="text-sm font-medium mb-3"
                style={{ color: 'rgba(226, 232, 240, 0.7)' }}
              >
                留下你的祝福
              </h3>
              <div className="flex flex-col gap-3">
                <textarea
                  ref={messageInputRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="写下你对 Ta 的祝福..."
                  className="glass-input resize-none"
                  rows={3}
                  maxLength={200}
                />
                <motion.button
                  onClick={handleSubmitMessage}
                  disabled={!inputText.trim()}
                  className="self-end px-5 py-2 rounded-full text-sm font-medium transition-all"
                  style={{
                    background: inputText.trim()
                      ? `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`
                      : 'rgba(255, 255, 255, 0.05)',
                    color: inputText.trim() ? '#ffffff' : 'rgba(255, 255, 255, 0.3)',
                    boxShadow: inputText.trim()
                      ? `0 0 15px ${hexToRgba(colors.primary, 0.3)}`
                      : 'none',
                    cursor: inputText.trim() ? 'pointer' : 'not-allowed',
                  }}
                  whileHover={inputText.trim() ? { scale: 1.05 } : {}}
                  whileTap={inputText.trim() ? { scale: 0.95 } : {}}
                >
                  发送祝福
                </motion.button>
              </div>
            </div>

            {/* 留言列表 */}
            <AnimatePresence>
              {messages.length > 0 && (
                <motion.div
                  className="glass px-6 py-4"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <h3
                    className="text-xs font-medium mb-3"
                    style={{ color: 'rgba(226, 232, 240, 0.5)' }}
                  >
                    祝福墙 ({messages.length})
                  </h3>
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {messages.map((msg) => (
                      <motion.div
                        key={msg.id}
                        className="flex items-start gap-3 p-3 rounded-xl"
                        style={{ background: 'rgba(255, 255, 255, 0.03)' }}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        {/* 头像占位 */}
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs"
                          style={{
                            background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                          }}
                        >
                          {'\u2728'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-sm leading-relaxed break-words"
                            style={{ color: 'rgba(226, 232, 240, 0.8)' }}
                          >
                            {msg.text}
                          </p>
                          <p
                            className="text-xs mt-1"
                            style={{ color: 'rgba(226, 232, 240, 0.3)' }}
                          >
                            {new Date(msg.timestamp).toLocaleString('zh-CN', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================ */}
      {/* 底部 */}
      {/* ============================================================ */}
      <motion.div
        className="text-center mt-auto pb-8 pt-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.8 }}
      >
        <p className="text-sm font-medium mb-1" style={{ color: 'rgba(226, 232, 240, 0.4)' }}>
          Made with {'\u2764\uFE0F'} by Birthday Galaxy
        </p>
        <p className="text-xs" style={{ color: 'rgba(226, 232, 240, 0.2)' }}>
          每一次分享，都是宇宙中最温暖的光
        </p>
      </motion.div>

      {/* ============================================================ */}
      {/* Toast 通知 */}
      {/* ============================================================ */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50"
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
              <span style={{ color: colors.primary }}>{'\u2728'}</span>
              <span className="text-sm font-medium" style={{ color: '#e2e8f0' }}>
                {toastMessage}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================ */}
      {/* 微信分享提示弹窗 */}
      {/* ============================================================ */}
      <AnimatePresence>
        {showWechatHint && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* 遮罩 */}
            <motion.div
              className="absolute inset-0"
              style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(8px)' }}
              onClick={() => setShowWechatHint(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            {/* 提示内容 */}
            <motion.div
              className="relative glass-strong px-8 py-8 max-w-sm w-full text-center"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              <h3
                className="text-xl font-bold mb-4"
                style={{
                  background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                分享到微信
              </h3>
              <p className="text-sm mb-6" style={{ color: 'rgba(226, 232, 240, 0.7)' }}>
                请截图上方海报，然后打开微信发送给朋友
              </p>

              {/* 示意图标 */}
              <div className="flex items-center justify-center gap-4 mb-6">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                  style={{
                    background: `linear-gradient(135deg, ${hexToRgba(colors.primary, 0.2)}, ${hexToRgba(colors.secondary, 0.2)})`,
                    border: `1px solid ${hexToRgba(colors.primary, 0.3)}`,
                  }}
                >
                  {'\uD83D\uDCF8'}
                </div>
                <span style={{ color: 'rgba(226, 232, 240, 0.4)' }}>{'→'}</span>
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                  style={{
                    background: `linear-gradient(135deg, ${hexToRgba('#07C160', 0.2)}, ${hexToRgba('#07C160', 0.1)})`,
                    border: `1px solid rgba(7, 193, 96, 0.3)`,
                  }}
                >
                  {'\uD83D\uDCAC'}
                </div>
              </div>

              <motion.button
                onClick={() => setShowWechatHint(false)}
                className="px-8 py-3 rounded-full text-sm font-medium transition-all"
                style={{
                  background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                  color: '#ffffff',
                  boxShadow: `0 0 15px ${hexToRgba(colors.primary, 0.3)}`,
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                我知道了
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SharePage;
