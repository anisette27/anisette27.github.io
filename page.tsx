'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { BirthdayData, ChapterId, AIGeneratedContent, GameState } from '@/types';
import { AudioEngine } from '@/lib/audio';
import StarField from '@/components/StarField';
import WelcomePage from '@/components/WelcomePage';
import OpeningScene from '@/components/OpeningScene';
import StarGazing from '@/components/StarGazing';
import GiftBox from '@/components/GiftBox';
import CandleLight from '@/components/CandleLight';
import WishingStars from '@/components/WishingStars';
import LuckyCard from '@/components/LuckyCard';
import AIGift from '@/components/AIGift';
import BirthdayTree from '@/components/BirthdayTree';
import ClimaxScene from '@/components/ClimaxScene';
import UniverseScene from '@/components/UniverseScene';
import SharePage from '@/components/SharePage';

// ============================================================================
// 章节过渡动画配置
// ============================================================================
const CHAPTER_TRANSITION = {
  duration: 0.8,
  ease: [0.16, 1, 0.3, 1] as const,
};

// ============================================================================
// Home 主页面组件 - 管理整个应用的状态和章节流转
// ============================================================================
export default function Home() {
  // ------------------------------------------------------------------
  // 核心状态
  // ------------------------------------------------------------------
  const [currentChapter, setCurrentChapter] = useState<ChapterId>('welcome');
  const [birthdayData, setBirthdayData] = useState<BirthdayData | null>(null);
  const [aiContent, setAiContent] = useState<AIGeneratedContent | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    giftOpened: false,
    candlesLit: 0,
    wishesCollected: [],
    luckyCardDrawn: false,
  });

  // ------------------------------------------------------------------
  // games 阶段子游戏步骤管理
  // 0 = GiftBox, 1 = CandleLight, 2 = WishingStars, 3 = LuckyCard
  // ------------------------------------------------------------------
  const [gameStep, setGameStep] = useState(0);

  // ------------------------------------------------------------------
  // AI 内容加载状态
  // ------------------------------------------------------------------
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  // ------------------------------------------------------------------
  // AbortController ref（用于取消 AI 请求）
  // ------------------------------------------------------------------
  const abortControllerRef = useRef<AbortController | null>(null);

  // ------------------------------------------------------------------
  // 音频引擎 ref
  // ------------------------------------------------------------------
  const audioRef = useRef<AudioEngine | null>(null);
  const [muted, setMuted] = useState(false);

  // ------------------------------------------------------------------
  // 清理：组件卸载时取消未完成的请求
  // ------------------------------------------------------------------
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // ------------------------------------------------------------------
  // 调用 AI 生成接口获取内容
  // ------------------------------------------------------------------
  const fetchAIContent = useCallback(async (data: BirthdayData) => {
    setIsLoadingAI(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`AI 生成失败: ${response.status}`);
      }

      const content: AIGeneratedContent = await response.json();
      setAiContent(content);
    } catch (error) {
      // 请求被取消时不做处理
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      console.error('[Home] AI 内容获取失败:', error);
      // 失败时 aiContent 保持 null，AIGift 组件会使用占位内容
    } finally {
      setIsLoadingAI(false);
      abortControllerRef.current = null;
    }
  }, []);

  // ------------------------------------------------------------------
  // 章节完成回调
  // ------------------------------------------------------------------

  /** welcome -> opening */
  const handleWelcomeComplete = useCallback((data: BirthdayData) => {
    setBirthdayData(data);

    // 初始化音频引擎并启动 BGM
    const audio = AudioEngine.getInstance();
    audio.init();
    audio.startBgm(3);
    audioRef.current = audio;

    setCurrentChapter('opening');
  }, []);

  /** opening -> stargazing */
  const handleOpeningComplete = useCallback(() => {
    audioRef.current?.sceneTransition();
    setCurrentChapter('stargazing');
  }, []);

  /** stargazing -> games (step 0) */
  const handleStargazingComplete = useCallback(() => {
    audioRef.current?.sceneTransition();
    setCurrentChapter('games');
    setGameStep(0);
  }, []);

  /** GiftBox 完成 -> game step 1 (CandleLight) */
  const handleGiftBoxComplete = useCallback(() => {
    setGameState((prev) => ({ ...prev, giftOpened: true }));
    setGameStep(1);
  }, []);

  /** CandleLight 完成 -> game step 2 (WishingStars) */
  const handleCandleLightComplete = useCallback(() => {
    setGameState((prev) => ({ ...prev, candlesLit: 5 }));
    setGameStep(2);
  }, []);

  /** WishingStars 完成 -> game step 3 (LuckyCard) */
  const handleWishingStarsComplete = useCallback(() => {
    setGameState((prev) => ({ ...prev, wishesCollected: ['健康', '快乐', '勇敢', '梦想', '财富', '友情', '爱情', '自由'] }));
    setGameStep(3);
  }, []);

  /** LuckyCard 完成 -> ai-gift (触发 AI 生成) */
  const handleLuckyCardComplete = useCallback(() => {
    setGameState((prev) => ({ ...prev, luckyCardDrawn: true }));
    audioRef.current?.sceneTransition();
    setCurrentChapter('ai-gift');
  }, []);

  /** AIGift 完成 -> birthday-tree */
  const handleAIGiftComplete = useCallback(() => {
    audioRef.current?.sceneTransition();
    setCurrentChapter('birthday-tree');
  }, []);

  /** BirthdayTree 完成 -> climax */
  const handleBirthdayTreeComplete = useCallback(() => {
    audioRef.current?.sceneTransition();
    audioRef.current?.intensifyBgm();
    setCurrentChapter('climax');
  }, []);

  /** Climax 完成 -> universe */
  const handleClimaxComplete = useCallback(() => {
    audioRef.current?.sceneTransition();
    setCurrentChapter('universe');
  }, []);

  /** Universe 完成 -> share */
  const handleUniverseComplete = useCallback(() => {
    audioRef.current?.sceneTransition();
    audioRef.current?.softenBgm();
    setCurrentChapter('share');
  }, []);

  // ------------------------------------------------------------------
  // 计算 gameProgress（0-5）
  // 0=初始, 1=输入信息, 2=小游戏进行中, 3=AI祝福, 4=烟花, 5=全部完成
  // ------------------------------------------------------------------
  const gameProgress = [
    birthdayData ? 1 : 0,                                   // 1: 输入信息
    gameState.giftOpened || gameState.candlesLit > 0 ? 1 : 0, // 2: 小游戏
    gameState.wishesCollected.length >= 8 ? 1 : 0,          // 收集愿望
    aiContent ? 1 : 0,                                        // 3: AI 祝福
    currentChapter === 'share' ? 1 : 0,                      // 4: 完成
  ].reduce((a, b) => a + b, 0);

  // ------------------------------------------------------------------
  // 在进入 ai-gift 章节时触发 AI 内容获取
  // ------------------------------------------------------------------
  useEffect(() => {
    if (currentChapter === 'ai-gift' && birthdayData && !aiContent && !isLoadingAI) {
      fetchAIContent(birthdayData);
    }
  }, [currentChapter, birthdayData, aiContent, isLoadingAI, fetchAIContent]);

  // ------------------------------------------------------------------
  // 渲染 games 阶段的子游戏组件
  // ------------------------------------------------------------------
  const renderGameStep = () => {
    if (!birthdayData) return null;

    switch (gameStep) {
      case 0:
        return <GiftBox data={birthdayData} onComplete={handleGiftBoxComplete} />;
      case 1:
        return <CandleLight data={birthdayData} onComplete={handleCandleLightComplete} />;
      case 2:
        return <WishingStars data={birthdayData} onComplete={handleWishingStarsComplete} />;
      case 3:
        return (
          <LuckyCard
            data={birthdayData}
            aiContent={aiContent || {
              letter: '',
              poem: '',
              story: '',
              prediction: '',
              imageUrl: '',
              fortune: '',
              luckyCard: '',
            }}
            onComplete={handleLuckyCardComplete}
          />
        );
      default:
        return null;
    }
  };

  // ------------------------------------------------------------------
  // 渲染当前章节
  // ------------------------------------------------------------------
  const renderChapter = () => {
    switch (currentChapter) {
      case 'welcome':
        return <WelcomePage onStart={handleWelcomeComplete} />;

      case 'opening':
        return birthdayData
          ? <OpeningScene data={birthdayData} onComplete={handleOpeningComplete} />
          : null;

      case 'stargazing':
        return birthdayData
          ? <StarGazing data={birthdayData} aiContent={aiContent} onComplete={handleStargazingComplete} />
          : null;

      case 'games':
        return renderGameStep();

      case 'ai-gift':
        return birthdayData
          ? <AIGift data={birthdayData} aiContent={aiContent} onComplete={handleAIGiftComplete} />
          : null;

      case 'birthday-tree':
        return birthdayData
          ? (
            <BirthdayTree
              data={birthdayData}
              gameProgress={gameProgress}
              onComplete={treeFromIcon ? handleTreeReturn : handleBirthdayTreeComplete}
              showReturnButton={treeFromIcon}
              onReturn={handleTreeReturn}
            />
          )
          : null;

      case 'climax':
        return birthdayData
          ? <ClimaxScene data={birthdayData} aiContent={aiContent} onComplete={handleClimaxComplete} />
          : null;

      case 'universe':
        return birthdayData
          ? <UniverseScene data={birthdayData} onComplete={handleUniverseComplete} />
          : null;

      case 'share':
        return birthdayData
          ? <SharePage data={birthdayData} aiContent={aiContent} />
          : null;

      default:
        return null;
    }
  };

  // ------------------------------------------------------------------
  // 生日树侧边小图标 —— 记住来源章节，方便返回
  // ------------------------------------------------------------------
  const prevChapterRef = useRef<ChapterId | null>(null);
  const [treeFromIcon, setTreeFromIcon] = useState<boolean>(false);

  // ------------------------------------------------------------------
  // 生日树侧边小图标点击（展开/收起生日树面板）
  // ------------------------------------------------------------------
  const handleTreeIconClick = useCallback(() => {
    // 如果当前在非 birthday-tree 阶段，可以跳转到 birthday-tree 查看
    if (currentChapter !== 'birthday-tree') {
      prevChapterRef.current = currentChapter;
      setTreeFromIcon(true);
      setCurrentChapter('birthday-tree');
    }
  }, [currentChapter]);

  /** 从生日树返回之前的章节 */
  const handleTreeReturn = useCallback(() => {
    const prev = prevChapterRef.current;
    if (prev) {
      setCurrentChapter(prev);
    }
    prevChapterRef.current = null;
    setTreeFromIcon(false);
  }, []);

  // ==================================================================
  // 渲染
  // ==================================================================
  return (
    <main className="relative w-screen h-screen overflow-hidden">
      {/* 星空背景 - 始终显示，随主题变化 */}
      <StarField theme={birthdayData?.theme || 'starry'} interactive />

      {/* 章节内容 - 使用 AnimatePresence 实现丝滑过渡 */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentChapter}
          className="absolute inset-0 z-10"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{
            duration: CHAPTER_TRANSITION.duration,
            ease: CHAPTER_TRANSITION.ease,
          }}
        >
          {renderChapter()}
        </motion.div>
      </AnimatePresence>

      {/* AI 加载遮罩（仅在 ai-gift 阶段且正在加载时显示） */}
      <AnimatePresence>
        {isLoadingAI && (
          <motion.div
            key="ai-loading-overlay"
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
            style={{ background: 'rgba(0,0,0,0.3)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className="w-12 h-12 border-4 border-transparent rounded-full"
              style={{
                borderTopColor: '#4facfe',
                borderRightColor: '#a855f7',
                filter: 'drop-shadow(0 0 8px rgba(79,172,254,0.6))',
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 生日树侧边小图标（games 阶段后显示） */}
      <AnimatePresence>
        {gameProgress > 0 && currentChapter !== 'birthday-tree' && (
          <motion.button
            key="birthday-tree-icon"
            className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-lg cursor-pointer"
            style={{
              background: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
            initial={{ opacity: 0, scale: 0, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            onClick={handleTreeIconClick}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            title="查看生日树"
          >
            {/* 生日树小图标用 emoji 代替，实际项目可替换为 SVG */}
            <span role="img" aria-label="生日树">🎂</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* 全局静音/取消静音按钮 */}
      <button
        className="fixed top-4 right-4 z-[9999] w-10 h-10 rounded-full flex items-center justify-center text-xl cursor-pointer"
        style={{
          background: 'rgba(255,255,255,0.1)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.2)',
        }}
        onClick={() => {
          const isMuted = !muted;
          setMuted(isMuted);
          audioRef.current?.setMuted(isMuted);
        }}
        title={muted ? '取消静音' : '静音'}
      >
        {muted ? '🔇' : '🔊'}
      </button>
    </main>
  );
}
