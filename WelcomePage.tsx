'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BirthdayData, ThemeType } from '../types';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */
interface WelcomePageProps {
  onStart: (data: BirthdayData) => void;
}

/* ------------------------------------------------------------------ */
/*  主题列表配置                                                        */
/* ------------------------------------------------------------------ */
const THEME_LIST: { type: ThemeType; emoji: string; label: string }[] = [
  { type: 'starry',  emoji: '🌌', label: '星空' },
  { type: 'sakura',  emoji: '🌸', label: '樱花' },
  { type: 'candy',   emoji: '🍬', label: '糖果' },
  { type: 'ocean',   emoji: '🌊', label: '海洋' },
  { type: 'forest',  emoji: '🌲', label: '森林' },
  { type: 'castle',  emoji: '🏰', label: '城堡' },
  { type: 'aurora',  emoji: '✨', label: '极光' },
  { type: 'chinese', emoji: '🏮', label: '中国风' },
  { type: 'tech',    emoji: '🔮', label: '科技风' },
];

/* 性别选项 */
const GENDER_OPTIONS: { value: BirthdayData['gender']; label: string }[] = [
  { value: 'male',   label: '男' },
  { value: 'female', label: '女' },
  { value: 'other',  label: '其他' },
];

/* ------------------------------------------------------------------ */
/*  组件                                                               */
/* ------------------------------------------------------------------ */
export default function WelcomePage({ onStart }: WelcomePageProps) {
  /* ---- 表单状态 ---- */
  const [name, setName]           = useState('');
  const [age, setAge]             = useState('');
  const [gender, setGender]       = useState<BirthdayData['gender']>('male');
  const [interests, setInterests]       = useState('');
  const [favoriteColor, setFavoriteColor] = useState('');
  const [favoriteAnimal, setFavoriteAnimal] = useState('');
  const [dream, setDream]               = useState('');
  const [blessing, setBlessing]         = useState('');
  const [selectedTheme, setSelectedTheme] = useState<ThemeType | null>(null);

  /* ---- 校验状态（记录哪些字段未通过验证） ---- */
  const [errors, setErrors] = useState<Record<string, string>>({});

  /* ---- 按钮粒子扩散状态 ---- */
  const [bursting, setBursting] = useState(false);

  /* ---- 生成粒子数组（用于按钮点击时的扩散效果） ---- */
  const [particles, setParticles] = useState<
    { id: number; x: number; y: number; size: number; color: string }[]
  >([]);

  /** 校验必填字段，返回是否通过 */
  const validate = useCallback((): boolean => {
    const next: Record<string, string> = {};
    if (!name.trim())     next.name = '请输入姓名';
    if (!age.trim() || isNaN(Number(age)) || Number(age) <= 0) next.age = '请输入有效年龄';
    if (!selectedTheme)   next.theme = '请选择一个主题';

    setErrors(next);
    return Object.keys(next).length === 0;
  }, [name, age, selectedTheme]);

  /** 处理开始按钮点击 */
  const handleStart = useCallback(() => {
    if (!validate()) return;

    // 触发粒子扩散效果
    setBursting(true);
    const newParticles = Array.from({ length: 18 }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 200,
      y: (Math.random() - 0.5) * 200,
      size: Math.random() * 8 + 4,
      color: ['#4facfe', '#a855f7', '#ec4899', '#fbbf24'][i % 4],
    }));
    setParticles(newParticles);

    // 短暂延迟后调用 onStart，让用户看到粒子效果
    setTimeout(() => {
      onStart({
        name: name.trim(),
        age: Number(age),
        gender,
        interests: interests.trim(),
        favoriteColor: favoriteColor.trim(),
        favoriteAnimal: favoriteAnimal.trim(),
        dream: dream.trim(),
        blessing: blessing.trim(),
        theme: selectedTheme!,
      });
    }, 600);
  }, [validate, name, age, gender, interests, favoriteColor, favoriteAnimal, dream, blessing, selectedTheme, onStart]);

  return (
    <AnimatePresence>
      <motion.div
        className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* ============================================================ */}
        {/*  1. Logo / 标题区域                                            */}
        {/* ============================================================ */}
        <div className="text-center mb-8">
          {/* 主标题 —— 从下方淡入 + 缩放 */}
          <motion.h1
            className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4"
            style={{
              background: 'linear-gradient(135deg, var(--cosmic-blue), var(--cosmic-purple))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
            initial={{ opacity: 0, y: 40, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            Birthday Galaxy
          </motion.h1>

          {/* 副标题 —— 延迟出现 */}
          <motion.p
            className="text-base sm:text-lg text-white/60 max-w-md mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            今天，我们一起创造一场独一无二的生日仪式。
          </motion.p>
        </div>

        {/* ============================================================ */}
        {/*  2. 玻璃拟态表单卡片                                           */}
        {/* ============================================================ */}
        <motion.div
          className="glass-strong w-full max-w-lg p-6 sm:p-8"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* 可滚动表单区域 */}
          <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-5">
            {/* ----- 姓名 ----- */}
            <div>
              <label className="block text-sm text-white/70 mb-1.5">姓名 *</label>
              <input
                className="glass-input"
                placeholder="寿星的名字"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {errors.name && (
                <motion.p
                  className="text-xs text-red-400 mt-1"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {errors.name}
                </motion.p>
              )}
            </div>

            {/* ----- 年龄 ----- */}
            <div>
              <label className="block text-sm text-white/70 mb-1.5">年龄 *</label>
              <input
                className="glass-input"
                type="number"
                min={1}
                placeholder="几岁啦？"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
              {errors.age && (
                <motion.p
                  className="text-xs text-red-400 mt-1"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {errors.age}
                </motion.p>
              )}
            </div>

            {/* ----- 性别（自定义玻璃拟态单选按钮） ----- */}
            <div>
              <label className="block text-sm text-white/70 mb-1.5">性别</label>
              <div className="flex gap-3">
                {GENDER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setGender(opt.value)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 border ${
                      gender === opt.value
                        ? 'bg-white/15 border-[var(--cosmic-blue)] shadow-[0_0_16px_rgba(79,172,254,0.25)] text-white'
                        : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ----- 兴趣 ----- */}
            <div>
              <label className="block text-sm text-white/70 mb-1.5">兴趣</label>
              <input
                className="glass-input"
                placeholder="喜欢做什么？"
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
              />
            </div>

            {/* ----- 喜欢颜色 ----- */}
            <div>
              <label className="block text-sm text-white/70 mb-1.5">喜欢颜色</label>
              <input
                className="glass-input"
                placeholder="最喜欢的颜色"
                value={favoriteColor}
                onChange={(e) => setFavoriteColor(e.target.value)}
              />
            </div>

            {/* ----- 最喜欢的动物 ----- */}
            <div>
              <label className="block text-sm text-white/70 mb-1.5">最喜欢的动物</label>
              <input
                className="glass-input"
                placeholder="小猫？小狗？或者…"
                value={favoriteAnimal}
                onChange={(e) => setFavoriteAnimal(e.target.value)}
              />
            </div>

            {/* ----- 梦想 ----- */}
            <div>
              <label className="block text-sm text-white/70 mb-1.5">梦想</label>
              <input
                className="glass-input"
                placeholder="你的梦想是什么？"
                value={dream}
                onChange={(e) => setDream(e.target.value)}
              />
            </div>

            {/* ----- 想送给自己的一句话（textarea） ----- */}
            <div>
              <label className="block text-sm text-white/70 mb-1.5">想送给自己的一句话</label>
              <textarea
                className="glass-input resize-none"
                rows={3}
                placeholder="写一句送给自己的话吧…"
                value={blessing}
                onChange={(e) => setBlessing(e.target.value)}
              />
            </div>

            {/* ======================================================== */}
            {/*  3. 主题选择区域                                             */}
            {/* ======================================================== */}
            <div>
              <label className="block text-sm text-white/70 mb-2.5">选择主题 *</label>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                {THEME_LIST.map((t) => {
                  const isSelected = selectedTheme === t.type;
                  return (
                    <motion.button
                      key={t.type}
                      type="button"
                      onClick={() => setSelectedTheme(t.type)}
                      className={`relative flex flex-col items-center gap-1.5 py-3 rounded-2xl text-sm border transition-all duration-300 ${
                        isSelected
                          ? 'bg-white/15 border-[var(--cosmic-blue)] shadow-[0_0_20px_rgba(79,172,254,0.35)] text-white'
                          : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                      }`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <span className="text-2xl">{t.emoji}</span>
                      <span className="text-xs">{t.label}</span>

                      {/* 选中发光边框指示器 */}
                      {isSelected && (
                        <motion.div
                          className="absolute inset-0 rounded-2xl border-2 border-[var(--cosmic-blue)]"
                          layoutId="theme-glow"
                          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        />
                      )}
                    </motion.button>
                  );
                })}
              </div>
              {errors.theme && (
                <motion.p
                  className="text-xs text-red-400 mt-1.5"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {errors.theme}
                </motion.p>
              )}
            </div>
          </div>

          {/* ========================================================== */}
          {/*  4. 开始按钮                                                 */}
          {/* ========================================================== */}
          <div className="mt-6 flex justify-center">
            <motion.button
              className="btn-cosmic relative"
              onClick={handleStart}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
            >
              {/* 按钮文字 */}
              <span className="relative z-10">开始生日旅行 ✨</span>

              {/* 点击后的粒子扩散效果 */}
              <AnimatePresence>
                {bursting &&
                  particles.map((p) => (
                    <motion.span
                      key={p.id}
                      className="absolute rounded-full pointer-events-none"
                      style={{
                        width: p.size,
                        height: p.size,
                        backgroundColor: p.color,
                        top: '50%',
                        left: '50%',
                      }}
                      initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
                      animate={{ x: p.x, y: p.y, opacity: 0, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      onAnimationComplete={() => {
                        // 所有粒子动画完成后清除状态
                        if (p.id === particles.length - 1) {
                          setBursting(false);
                          setParticles([]);
                        }
                      }}
                    />
                  ))}
              </AnimatePresence>
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
