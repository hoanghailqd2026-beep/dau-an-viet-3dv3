import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import { HeritageSite } from '../types/heritage';
import { Language } from '../i18n/types';
import { useI18n } from '../i18n/I18nContext';
import { useAuth } from './AuthContext';
import { getCuratedAudioScript } from '../data/audioGuideScripts';
import {
  speechEngine,
  splitTextIntoSentences,
  SupportedPlaybackSpeed,
} from '../utils/chunkedSpeechEngine';
import {
  CMS_UPDATED_EVENT,
  loadCmsSiteOverrides,
  trackPlatformInteraction,
} from '../utils/adminPlatformStore';

export interface ComputedChapter {
  id: string;
  roman: string;
  title: string;
  durationLabel: string;
  durationSec: number;
  startSec: number;
  startPercent: number;
  endPercent: number;
  narration: string;
  sentences: string[];
  isHiddenForVisitors?: boolean;
}

export interface CustomAudioTrack {
  url: string;
  fileName: string;
  durationSec: number;
}

interface AudioGuideContextType {
  sites: HeritageSite[];
  activeSiteId: string;
  activeSite: HeritageSite;
  folioTitle: string;
  chapters: ComputedChapter[];
  selectedChapterIdx: number;
  activeChapter: ComputedChapter;
  sentences: string[];
  activeSentenceIndex: number;
  isPlaying: boolean;
  isMuted: boolean;
  playbackSpeed: SupportedPlaybackSpeed;
  totalDurationSec: number;
  getPlaybackProgress: () => number;
  getCurrentTimeSec: () => number;
  subscribePlaybackProgress: (
    listener: (progress: number, timeSec: number) => void
  ) => () => void;
  customAudio: CustomAudioTrack | null;
  isUsingCustomAudio: boolean;
  isModalOpen: boolean;
  isFloatingBarVisible: boolean;
  openModalForSite: (siteId: string) => void;
  startAudioGuideForSite: (siteId: string) => void;
  closeModalAndStop: () => void;
  minimizeModalKeepPlaying: () => void;
  dismissFloatingBar: () => void;
  selectSite: (siteId: string, autoPlay?: boolean) => void;
  togglePlayPause: () => void;
  toggleMute: () => void;
  play: () => void;
  pause: () => void;
  selectChapter: (chapterIdx: number, autoPlay?: boolean) => void;
  prevChapter: () => void;
  nextChapter: () => void;
  jumpToSentence: (sentenceIdx: number) => void;
  setSpeed: (speed: SupportedPlaybackSpeed) => void;
  cycleSpeed: () => void;
  seekToPercent: (percent: number) => void;
  seekBySeconds: (deltaSec: number) => void;
  uploadCustomAudio: (siteId: string, file: File) => void;
  removeCustomAudio: (siteId: string) => void;
  toggleCustomAudioSource: (useCustom: boolean) => void;
  getCustomAudioForSite: (siteId: string) => CustomAudioTrack | null;
}

const AudioGuideContext = createContext<AudioGuideContextType | null>(null);

function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export const AudioGuideProvider: React.FC<{
  sites: HeritageSite[];
  children: React.ReactNode;
}> = ({ sites, children }) => {
  const { lang, getLocalizedSite } = useI18n();
  const { isAdmin, isTesterPro } = useAuth();
  const canPreviewHidden = isAdmin || isTesterPro;

  const [activeSiteId, setActiveSiteId] = useState<string>(() => sites[0]?.id || 'HCM-DT-001');
  const [selectedChapterIdx, setSelectedChapterIdx] = useState<number>(0);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<SupportedPlaybackSpeed>(1);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [hasActiveSession, setHasActiveSession] = useState<boolean>(false);

  // Per-site uploaded MP3/WAV backup recordings
  const [customAudioMap, setCustomAudioMap] = useState<Record<string, CustomAudioTrack>>({});
  const [preferTtsBySite, setPreferTtsBySite] = useState<Record<string, boolean>>({});
  const [cmsScriptVersion, setCmsScriptVersion] = useState<number>(0);

  useEffect(() => {
    const onCmsUpdated = () => setCmsScriptVersion((v) => v + 1);
    window.addEventListener(CMS_UPDATED_EVENT, onCmsUpdated);
    return () => window.removeEventListener(CMS_UPDATED_EVENT, onCmsUpdated);
  }, []);

  // High-frequency playback progress isolated in refs + subscribers (zero root React re-renders)
  const playbackProgressRef = useRef<number>(0);
  const customAudioCurrentSecRef = useRef<number>(0);
  const progressSubscribersRef = useRef<
    Set<(progress: number, timeSec: number) => void>
  >(new Set());

  const htmlAudioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(isPlaying);
  const isMutedRef = useRef(isMuted);
  const selectedChapterIdxRef = useRef(selectedChapterIdx);
  const activeSentenceIndexRef = useRef(activeSentenceIndex);
  const playbackSpeedRef = useRef(playbackSpeed);
  const prevLangRef = useRef<Language>(lang);
  const customAudioUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    selectedChapterIdxRef.current = selectedChapterIdx;
  }, [selectedChapterIdx]);

  useEffect(() => {
    activeSentenceIndexRef.current = activeSentenceIndex;
  }, [activeSentenceIndex]);

  useEffect(() => {
    playbackSpeedRef.current = playbackSpeed;
  }, [playbackSpeed]);

  // Cleanup all speech & object URLs on unmount
  useEffect(() => {
    return () => {
      speechEngine.stop();
      if (htmlAudioRef.current) {
        htmlAudioRef.current.pause();
        htmlAudioRef.current.src = '';
      }
      customAudioUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      });
    };
  }, []);

  const activeSite = useMemo(
    () => sites.find((s) => s.id === activeSiteId) || sites[0],
    [sites, activeSiteId]
  );

  const localizedSite = useMemo(
    () => getLocalizedSite(activeSite),
    [activeSite, getLocalizedSite]
  );

  const customAudio = customAudioMap[activeSite.id] || null;
  const isUsingCustomAudio = Boolean(customAudio && !preferTtsBySite[activeSite.id]);

  // Build authentic 4 chapters in current language (VI / EN / ZH)
  const { folioTitle, chapters, ttsTotalDurationSec } = useMemo(() => {
    const curated = getCuratedAudioScript(activeSite.id, lang);
    const cmsOverrides = loadCmsSiteOverrides();
    const hiddenSet = new Set(cmsOverrides[activeSite.id]?.hiddenChapterIds || []);

    if (curated) {
      const visibleRaw = canPreviewHidden
        ? curated.chapters
        : curated.chapters.filter((ch) => !hiddenSet.has(ch.id));
      const effectiveRaw = visibleRaw.length > 0 ? visibleRaw : curated.chapters.slice(0, 1);
      const total = Math.max(
        1,
        effectiveRaw.reduce((sum, ch) => sum + ch.durationSec, 0)
      );
      let accSec = 0;
      const computed: ComputedChapter[] = effectiveRaw.map((ch, idx) => {
        const startSec = accSec;
        const startPercent = (startSec / total) * 100;
        accSec += ch.durationSec;
        const endPercent = idx === effectiveRaw.length - 1 ? 100 : (accSec / total) * 100;
        return {
          id: ch.id,
          roman: ch.roman,
          title: ch.title,
          durationLabel: formatClock(ch.durationSec),
          durationSec: ch.durationSec,
          startSec,
          startPercent,
          endPercent,
          narration: ch.narration,
          sentences: splitTextIntoSentences(ch.narration),
          isHiddenForVisitors: canPreviewHidden && hiddenSet.has(ch.id),
        };
      });

      return {
        folioTitle: curated.folioTitle,
        chapters: computed,
        ttsTotalDurationSec: total,
      };
    }

    // Fallback synthesis if an unknown site ID is ever added dynamically
    const fallbackTotal = 240;
    const rawNarration = localizedSite.summary || activeSite.summary;
    const fallbackChapters: ComputedChapter[] = [
      {
        id: 'ch1',
        roman: lang === 'zh' ? '第一章' : lang === 'en' ? 'CHAPTER I' : 'CHƯƠNG I',
        title: localizedSite.officialName,
        durationLabel: formatClock(fallbackTotal),
        durationSec: fallbackTotal,
        startSec: 0,
        startPercent: 0,
        endPercent: 100,
        narration: rawNarration,
        sentences: splitTextIntoSentences(rawNarration),
      },
    ];
    return {
      folioTitle: localizedSite.officialName,
      chapters: fallbackChapters,
      ttsTotalDurationSec: fallbackTotal,
    };
  }, [activeSite, localizedSite, lang, cmsScriptVersion, canPreviewHidden]);

  const chaptersRef = useRef(chapters);
  useEffect(() => {
    chaptersRef.current = chapters;
  }, [chapters]);

  const safeChapterIdx = Math.min(selectedChapterIdx, Math.max(0, chapters.length - 1));
  const activeChapter = chapters[safeChapterIdx] || chapters[0];
  const sentences = activeChapter?.sentences || [];

  const totalDurationSec = useMemo(() => {
    if (isUsingCustomAudio && customAudio && customAudio.durationSec > 0) {
      return customAudio.durationSec;
    }
    return ttsTotalDurationSec;
  }, [isUsingCustomAudio, customAudio, ttsTotalDurationSec]);

  const isUsingCustomAudioRef = useRef<boolean>(isUsingCustomAudio);
  const totalDurationSecRef = useRef<number>(totalDurationSec);

  const computeCurrentTimeSec = useCallback((progress: number, customSec?: number) => {
    if (isUsingCustomAudioRef.current) {
      return customSec !== undefined ? customSec : customAudioCurrentSecRef.current;
    }
    return (progress / 100) * totalDurationSecRef.current;
  }, []);

  const updatePlaybackProgress = useCallback(
    (nextProgress: number, nextCustomSec?: number) => {
      const clamped = Math.max(0, Math.min(100, nextProgress));
      playbackProgressRef.current = clamped;
      if (nextCustomSec !== undefined) {
        customAudioCurrentSecRef.current = nextCustomSec;
      }
      const timeSec = computeCurrentTimeSec(clamped, nextCustomSec);
      progressSubscribersRef.current.forEach((cb) => {
        try {
          cb(clamped, timeSec);
        } catch {
          // ignore subscriber errors
        }
      });
    },
    [computeCurrentTimeSec]
  );

  useEffect(() => {
    isUsingCustomAudioRef.current = isUsingCustomAudio;
    totalDurationSecRef.current = totalDurationSec;
    const timeSec = computeCurrentTimeSec(playbackProgressRef.current);
    progressSubscribersRef.current.forEach((cb) => {
      try {
        cb(playbackProgressRef.current, timeSec);
      } catch {
        // ignore subscriber errors
      }
    });
  }, [isUsingCustomAudio, totalDurationSec, computeCurrentTimeSec]);

  const getPlaybackProgress = useCallback(() => playbackProgressRef.current, []);
  const getCurrentTimeSec = useCallback(
    () => computeCurrentTimeSec(playbackProgressRef.current),
    [computeCurrentTimeSec]
  );
  const subscribePlaybackProgress = useCallback(
    (listener: (progress: number, timeSec: number) => void) => {
      progressSubscribersRef.current.add(listener);
      return () => {
        progressSubscribersRef.current.delete(listener);
      };
    },
    []
  );

  // Helper to start speaking a specific chapter & sentence index using chunked engine
  const startTtsAt = useCallback(
    (
      chapterIdx: number,
      sentenceIdx: number,
      targetLang: Language,
      speed: SupportedPlaybackSpeed,
      chaptersSnapshot?: ComputedChapter[]
    ) => {
      const list = chaptersSnapshot || chaptersRef.current;
      const ch = list[chapterIdx];
      if (!ch || ch.sentences.length === 0) {
        speechEngine.stop();
        setIsPlaying(false);
        return;
      }

      const clampedSentenceIdx = Math.max(0, Math.min(sentenceIdx, ch.sentences.length - 1));
      setSelectedChapterIdx(chapterIdx);
      setActiveSentenceIndex(clampedSentenceIdx);
      setIsPlaying(true);
      setHasActiveSession(true);

      const chapterSpan = Math.max(1, ch.endPercent - ch.startPercent);

      speechEngine.speakSentences(ch.sentences, {
        lang: targetLang,
        rate: speed,
        volume: isMutedRef.current ? 0 : 1,
        startIndex: clampedSentenceIdx,
        onSentenceStart: (idx) => {
          setActiveSentenceIndex(idx);
          const ratio = ch.sentences.length > 0 ? idx / ch.sentences.length : 0;
          updatePlaybackProgress(Math.min(99, ch.startPercent + ratio * chapterSpan));
        },
        onComplete: () => {
          const latestChapters = chaptersRef.current;
          const nextChapterIdx = chapterIdx + 1;
          if (nextChapterIdx < latestChapters.length) {
            startTtsAt(nextChapterIdx, 0, targetLang, playbackSpeedRef.current, latestChapters);
          } else {
            setIsPlaying(false);
            updatePlaybackProgress(100);
          }
        },
      });
    },
    [updatePlaybackProgress]
  );

  // Sync HTML5 <audio> element lifecycle for custom MP3 fallback
  useEffect(() => {
    if (!htmlAudioRef.current && typeof Audio !== 'undefined') {
      htmlAudioRef.current = new Audio();
    }
    const audioEl = htmlAudioRef.current;
    if (!audioEl) return;

    const handleTimeUpdate = () => {
      if (!audioEl.duration || isNaN(audioEl.duration)) return;
      updatePlaybackProgress(
        (audioEl.currentTime / audioEl.duration) * 100,
        audioEl.currentTime
      );
    };

    const handleLoadedMeta = () => {
      if (audioEl.duration && !isNaN(audioEl.duration)) {
        const dur = audioEl.duration;
        setCustomAudioMap((prev) => {
          const existing = prev[activeSite.id];
          if (!existing || Math.abs(existing.durationSec - dur) < 0.5) return prev;
          return {
            ...prev,
            [activeSite.id]: { ...existing, durationSec: dur },
          };
        });
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      updatePlaybackProgress(100);
    };

    audioEl.addEventListener('timeupdate', handleTimeUpdate);
    audioEl.addEventListener('loadedmetadata', handleLoadedMeta);
    audioEl.addEventListener('ended', handleEnded);

    return () => {
      audioEl.removeEventListener('timeupdate', handleTimeUpdate);
      audioEl.removeEventListener('loadedmetadata', handleLoadedMeta);
      audioEl.removeEventListener('ended', handleEnded);
    };
  }, [activeSite.id, updatePlaybackProgress]);

  // Ensure HTML5 <audio> plays/pauses cleanly when isUsingCustomAudio changes
  useEffect(() => {
    const audioEl = htmlAudioRef.current;
    if (!audioEl) return;

    if (isUsingCustomAudio && customAudio) {
      speechEngine.stop();
      if (audioEl.src !== customAudio.url) {
        audioEl.src = customAudio.url;
        audioEl.currentTime = 0;
        updatePlaybackProgress(0, 0);
      }
      audioEl.playbackRate = playbackSpeed;
      audioEl.muted = isMuted;
      if (isPlaying) {
        audioEl.play().catch(() => {
          setIsPlaying(false);
        });
      } else {
        audioEl.pause();
      }
    } else {
      audioEl.pause();
    }
  }, [isUsingCustomAudio, customAudio, isPlaying, playbackSpeed, isMuted, updatePlaybackProgress]);

  // Smooth progress micro-tick during TTS playback so scrubber feels alive between sentences
  useEffect(() => {
    if (!isPlaying || isUsingCustomAudio) return;

    const timer = window.setInterval(() => {
      const ch = chaptersRef.current[selectedChapterIdxRef.current];
      if (!ch) return;
      const step = (0.3 / totalDurationSec) * 100 * playbackSpeedRef.current;
      const prev = playbackProgressRef.current;
      const cap = Math.max(ch.startPercent, ch.endPercent - 0.5);
      if (prev < cap) {
        updatePlaybackProgress(Math.min(cap, prev + step));
      }
    }, 300);

    return () => window.clearInterval(timer);
  }, [isPlaying, isUsingCustomAudio, totalDurationSec, updatePlaybackProgress]);

  // CRITICAL: React immediately when global language VI | EN | ZH changes!
  useEffect(() => {
    if (prevLangRef.current === lang) return;
    prevLangRef.current = lang;

    // Reset sentence pointer to 0 in current chapter so new language text matches cleanly
    setActiveSentenceIndex(0);

    if (isPlayingRef.current && !isUsingCustomAudio) {
      // Cancel old voice + 80ms delay + restart from sentence 0 in the new language
      startTtsAt(selectedChapterIdxRef.current, 0, lang, playbackSpeedRef.current, chapters);
    } else if (!isUsingCustomAudio) {
      speechEngine.stop();
    }
  }, [lang, chapters, isUsingCustomAudio, startTtsAt]);

  const play = useCallback(() => {
    setHasActiveSession(true);
    trackPlatformInteraction('audio', activeSite.id);
    if (isUsingCustomAudio && customAudio && htmlAudioRef.current) {
      setIsPlaying(true);
      htmlAudioRef.current.playbackRate = playbackSpeedRef.current;
      htmlAudioRef.current.play().catch(() => setIsPlaying(false));
      return;
    }
    startTtsAt(
      selectedChapterIdxRef.current,
      activeSentenceIndexRef.current,
      lang,
      playbackSpeedRef.current
    );
  }, [activeSite.id, isUsingCustomAudio, customAudio, lang, startTtsAt]);

  const pause = useCallback(() => {
    speechEngine.stop();
    if (htmlAudioRef.current) {
      htmlAudioRef.current.pause();
    }
    setIsPlaying(false);
  }, []);

  const togglePlayPause = useCallback(() => {
    if (isPlayingRef.current) {
      pause();
    } else {
      play();
    }
  }, [play, pause]);

  const toggleMute = useCallback(() => {
    const nextMuted = !isMutedRef.current;
    isMutedRef.current = nextMuted;
    setIsMuted(nextMuted);

    if (htmlAudioRef.current) {
      htmlAudioRef.current.muted = nextMuted;
    }

    if (isPlayingRef.current && !isUsingCustomAudioRef.current) {
      startTtsAt(
        selectedChapterIdxRef.current,
        activeSentenceIndexRef.current,
        lang,
        playbackSpeedRef.current
      );
    }
  }, [lang, startTtsAt]);

  const selectSite = useCallback(
    (siteId: string, autoPlay?: boolean) => {
      if (siteId === activeSiteId) return;
      const wasPlaying = isPlayingRef.current;
      speechEngine.stop();
      if (htmlAudioRef.current) {
        htmlAudioRef.current.pause();
        htmlAudioRef.current.currentTime = 0;
      }

      setActiveSiteId(siteId);
      setSelectedChapterIdx(0);
      setActiveSentenceIndex(0);
      updatePlaybackProgress(0, 0);

      const shouldPlay = autoPlay ?? wasPlaying;
      if (shouldPlay) {
        const targetCustom = customAudioMap[siteId];
        const targetUseCustom = Boolean(targetCustom && !preferTtsBySite[siteId]);
        if (targetUseCustom && targetCustom) {
          setIsPlaying(true);
          setHasActiveSession(true);
        } else {
          const curated = getCuratedAudioScript(siteId, lang);
          if (curated) {
            const cmsOverrides = loadCmsSiteOverrides();
            const hiddenSet = new Set(cmsOverrides[siteId]?.hiddenChapterIds || []);
            const visibleRaw = canPreviewHidden
              ? curated.chapters
              : curated.chapters.filter((ch) => !hiddenSet.has(ch.id));
            const effectiveRaw = visibleRaw.length > 0 ? visibleRaw : curated.chapters.slice(0, 1);
            const total = Math.max(
              1,
              effectiveRaw.reduce((sum, ch) => sum + ch.durationSec, 0)
            );
            let accSec = 0;
            const nextChapters: ComputedChapter[] = effectiveRaw.map((ch, idx) => {
              const startSec = accSec;
              const startPercent = (startSec / total) * 100;
              accSec += ch.durationSec;
              const endPercent = idx === effectiveRaw.length - 1 ? 100 : (accSec / total) * 100;
              return {
                id: ch.id,
                roman: ch.roman,
                title: ch.title,
                durationLabel: formatClock(ch.durationSec),
                durationSec: ch.durationSec,
                startSec,
                startPercent,
                endPercent,
                narration: ch.narration,
                sentences: splitTextIntoSentences(ch.narration),
                isHiddenForVisitors: canPreviewHidden && hiddenSet.has(ch.id),
              };
            });
            startTtsAt(0, 0, lang, playbackSpeedRef.current, nextChapters);
          } else {
            const targetSite = sites.find((s) => s.id === siteId);
            if (targetSite) {
              const targetLoc = getLocalizedSite(targetSite);
              const fallbackTotal = 240;
              const rawNarration = targetLoc.summary || targetSite.summary;
              const fallbackChapters: ComputedChapter[] = [
                {
                  id: 'ch1',
                  roman: lang === 'zh' ? '第一章' : lang === 'en' ? 'CHAPTER I' : 'CHƯƠNG I',
                  title: targetLoc.officialName,
                  durationLabel: formatClock(fallbackTotal),
                  durationSec: fallbackTotal,
                  startSec: 0,
                  startPercent: 0,
                  endPercent: 100,
                  narration: rawNarration,
                  sentences: splitTextIntoSentences(rawNarration),
                },
              ];
              startTtsAt(0, 0, lang, playbackSpeedRef.current, fallbackChapters);
            }
          }
        }
      } else {
        setIsPlaying(false);
      }
    },
    [
      activeSiteId,
      customAudioMap,
      preferTtsBySite,
      lang,
      sites,
      getLocalizedSite,
      startTtsAt,
      updatePlaybackProgress,
      canPreviewHidden,
    ]
  );

  const startAudioGuideForSite = useCallback(
    (siteId: string) => {
      if (!siteId) return;
      setHasActiveSession(true);
      trackPlatformInteraction('audio', siteId);
      if (siteId !== activeSiteId) {
        selectSite(siteId, true);
        return;
      }

      if (isUsingCustomAudio && customAudio && htmlAudioRef.current) {
        htmlAudioRef.current.currentTime = 0;
        updatePlaybackProgress(0, 0);
        setIsPlaying(true);
        htmlAudioRef.current.playbackRate = playbackSpeedRef.current;
        htmlAudioRef.current.play().catch(() => setIsPlaying(false));
        return;
      }

      updatePlaybackProgress(0, 0);
      startTtsAt(0, 0, lang, playbackSpeedRef.current);
    },
    [
      activeSiteId,
      selectSite,
      isUsingCustomAudio,
      customAudio,
      lang,
      startTtsAt,
      updatePlaybackProgress,
    ]
  );

  const openModalForSite = useCallback(
    (siteId: string) => {
      if (siteId && siteId !== activeSiteId) {
        selectSite(siteId, false);
      }
      setIsModalOpen(true);
    },
    [activeSiteId, selectSite]
  );

  const closeModalAndStop = useCallback(() => {
    pause();
    setIsModalOpen(false);
    setHasActiveSession(false);
  }, [pause]);

  const minimizeModalKeepPlaying = useCallback(() => {
    setIsModalOpen(false);
    if (isPlayingRef.current || hasActiveSession) {
      setHasActiveSession(true);
    }
  }, [hasActiveSession]);

  const dismissFloatingBar = useCallback(() => {
    pause();
    setHasActiveSession(false);
  }, [pause]);

  const selectChapter = useCallback(
    (chapterIdx: number, autoPlay = true) => {
      const clamped = Math.max(0, Math.min(chapterIdx, chaptersRef.current.length - 1));
      const ch = chaptersRef.current[clamped];
      if (!ch) return;

      setSelectedChapterIdx(clamped);
      setActiveSentenceIndex(0);
      updatePlaybackProgress(ch.startPercent);

      if (isUsingCustomAudio && htmlAudioRef.current && htmlAudioRef.current.duration) {
        const targetTime = (ch.startPercent / 100) * htmlAudioRef.current.duration;
        htmlAudioRef.current.currentTime = targetTime;
        updatePlaybackProgress(ch.startPercent, targetTime);
        if (autoPlay) {
          setIsPlaying(true);
          setHasActiveSession(true);
          htmlAudioRef.current.play().catch(() => {});
        }
        return;
      }

      if (autoPlay || isPlayingRef.current) {
        startTtsAt(clamped, 0, lang, playbackSpeedRef.current);
      } else {
        speechEngine.stop();
      }
    },
    [isUsingCustomAudio, lang, startTtsAt, updatePlaybackProgress]
  );

  const prevChapter = useCallback(() => {
    selectChapter(Math.max(0, selectedChapterIdxRef.current - 1), true);
  }, [selectChapter]);

  const nextChapter = useCallback(() => {
    selectChapter(Math.min(chaptersRef.current.length - 1, selectedChapterIdxRef.current + 1), true);
  }, [selectChapter]);

  const jumpToSentence = useCallback(
    (sentenceIdx: number) => {
      if (isUsingCustomAudio) {
        // Switch smoothly to TTS from that clicked sentence if user taps Teleprompter
        setPreferTtsBySite((prev) => ({ ...prev, [activeSite.id]: true }));
        if (htmlAudioRef.current) htmlAudioRef.current.pause();
      }
      startTtsAt(selectedChapterIdxRef.current, sentenceIdx, lang, playbackSpeedRef.current);
    },
    [isUsingCustomAudio, activeSite.id, lang, startTtsAt]
  );

  const setSpeed = useCallback(
    (newSpeed: SupportedPlaybackSpeed) => {
      setPlaybackSpeed(newSpeed);
      playbackSpeedRef.current = newSpeed;

      if (isUsingCustomAudio && htmlAudioRef.current) {
        htmlAudioRef.current.playbackRate = newSpeed;
        return;
      }

      if (isPlayingRef.current) {
        startTtsAt(
          selectedChapterIdxRef.current,
          activeSentenceIndexRef.current,
          lang,
          newSpeed
        );
      }
    },
    [isUsingCustomAudio, lang, startTtsAt]
  );

  const cycleSpeed = useCallback(() => {
    const speeds: SupportedPlaybackSpeed[] = [1, 1.25, 1.5];
    const idx = speeds.indexOf(playbackSpeedRef.current);
    const next = speeds[(idx + 1) % speeds.length];
    setSpeed(next);
  }, [setSpeed]);

  const seekToPercent = useCallback(
    (percent: number) => {
      const clampedPct = Math.max(0, Math.min(100, percent));

      if (isUsingCustomAudio && htmlAudioRef.current && htmlAudioRef.current.duration) {
        const t = (clampedPct / 100) * htmlAudioRef.current.duration;
        htmlAudioRef.current.currentTime = t;
        updatePlaybackProgress(clampedPct, t);
        if (!isPlayingRef.current) {
          setIsPlaying(true);
          setHasActiveSession(true);
          htmlAudioRef.current.play().catch(() => {});
        }
        return;
      }

      updatePlaybackProgress(clampedPct);

      const list = chaptersRef.current;
      let targetChIdx = 0;
      for (let i = list.length - 1; i >= 0; i--) {
        if (clampedPct >= list[i].startPercent) {
          targetChIdx = i;
          break;
        }
      }
      const ch = list[targetChIdx];
      const span = Math.max(1, ch.endPercent - ch.startPercent);
      const localRatio = Math.max(0, Math.min(0.99, (clampedPct - ch.startPercent) / span));
      const targetSentIdx = Math.min(
        Math.max(0, ch.sentences.length - 1),
        Math.floor(localRatio * ch.sentences.length)
      );

      startTtsAt(targetChIdx, targetSentIdx, lang, playbackSpeedRef.current);
    },
    [isUsingCustomAudio, lang, startTtsAt, updatePlaybackProgress]
  );

  const seekBySeconds = useCallback(
    (deltaSec: number) => {
      if (isUsingCustomAudio && htmlAudioRef.current && htmlAudioRef.current.duration) {
        const nextT = Math.max(
          0,
          Math.min(htmlAudioRef.current.duration, htmlAudioRef.current.currentTime + deltaSec)
        );
        htmlAudioRef.current.currentTime = nextT;
        updatePlaybackProgress((nextT / htmlAudioRef.current.duration) * 100, nextT);
        return;
      }

      const ch = chaptersRef.current[selectedChapterIdxRef.current];
      if (!ch) return;
      const curSent = activeSentenceIndexRef.current;
      if (deltaSec < 0) {
        if (curSent > 0) {
          startTtsAt(selectedChapterIdxRef.current, curSent - 1, lang, playbackSpeedRef.current);
        } else if (selectedChapterIdxRef.current > 0) {
          const prevChIdx = selectedChapterIdxRef.current - 1;
          const prevCh = chaptersRef.current[prevChIdx];
          startTtsAt(
            prevChIdx,
            Math.max(0, prevCh.sentences.length - 1),
            lang,
            playbackSpeedRef.current
          );
        }
      } else {
        if (curSent + 1 < ch.sentences.length) {
          startTtsAt(selectedChapterIdxRef.current, curSent + 1, lang, playbackSpeedRef.current);
        } else if (selectedChapterIdxRef.current + 1 < chaptersRef.current.length) {
          startTtsAt(selectedChapterIdxRef.current + 1, 0, lang, playbackSpeedRef.current);
        }
      }
    },
    [isUsingCustomAudio, lang, startTtsAt]
  );

  const uploadCustomAudio = useCallback(
    (siteId: string, file: File) => {
      const objectUrl = URL.createObjectURL(file);
      customAudioUrlsRef.current.push(objectUrl);

      setCustomAudioMap((prev) => {
        const old = prev[siteId];
        if (old?.url) {
          try {
            URL.revokeObjectURL(old.url);
          } catch {
            // ignore
          }
        }
        return {
          ...prev,
          [siteId]: {
            url: objectUrl,
            fileName: file.name,
            durationSec: 0,
          },
        };
      });

      setPreferTtsBySite((prev) => ({ ...prev, [siteId]: false }));

      if (siteId === activeSiteId) {
        speechEngine.stop();
        updatePlaybackProgress(0, 0);
        setHasActiveSession(true);
        setIsPlaying(true);
      }
    },
    [activeSiteId, updatePlaybackProgress]
  );

  const removeCustomAudio = useCallback(
    (siteId: string) => {
      const existing = customAudioMap[siteId];
      if (existing?.url) {
        try {
          URL.revokeObjectURL(existing.url);
        } catch {
          // ignore
        }
      }
      setCustomAudioMap((prev) => {
        const copy = { ...prev };
        delete copy[siteId];
        return copy;
      });
      if (siteId === activeSiteId) {
        if (htmlAudioRef.current) {
          htmlAudioRef.current.pause();
          htmlAudioRef.current.src = '';
        }
        setIsPlaying(false);
        updatePlaybackProgress(0, 0);
      }
    },
    [customAudioMap, activeSiteId, updatePlaybackProgress]
  );

  const toggleCustomAudioSource = useCallback(
    (useCustom: boolean) => {
      setPreferTtsBySite((prev) => ({ ...prev, [activeSite.id]: !useCustom }));
      pause();
      updatePlaybackProgress(0, 0);
      setActiveSentenceIndex(0);
    },
    [activeSite.id, pause, updatePlaybackProgress]
  );

  const getCustomAudioForSite = useCallback(
    (siteId: string): CustomAudioTrack | null => {
      if (preferTtsBySite[siteId]) return null;
      return customAudioMap[siteId] || null;
    },
    [customAudioMap, preferTtsBySite]
  );

  const isFloatingBarVisible = !isModalOpen && (isPlaying || hasActiveSession);

  const value = useMemo<AudioGuideContextType>(
    () => ({
      sites,
      activeSiteId: activeSite.id,
      activeSite,
      folioTitle,
      chapters,
      selectedChapterIdx: safeChapterIdx,
      activeChapter,
      sentences,
      activeSentenceIndex,
      isPlaying,
      isMuted,
      playbackSpeed,
      totalDurationSec,
      getPlaybackProgress,
      getCurrentTimeSec,
      subscribePlaybackProgress,
      customAudio,
      isUsingCustomAudio,
      isModalOpen,
      isFloatingBarVisible,
      openModalForSite,
      startAudioGuideForSite,
      closeModalAndStop,
      minimizeModalKeepPlaying,
      dismissFloatingBar,
      selectSite,
      togglePlayPause,
      toggleMute,
      play,
      pause,
      selectChapter,
      prevChapter,
      nextChapter,
      jumpToSentence,
      setSpeed,
      cycleSpeed,
      seekToPercent,
      seekBySeconds,
      uploadCustomAudio,
      removeCustomAudio,
      toggleCustomAudioSource,
      getCustomAudioForSite,
    }),
    [
      sites,
      activeSite,
      folioTitle,
      chapters,
      safeChapterIdx,
      activeChapter,
      sentences,
      activeSentenceIndex,
      isPlaying,
      isMuted,
      playbackSpeed,
      totalDurationSec,
      getPlaybackProgress,
      getCurrentTimeSec,
      subscribePlaybackProgress,
      customAudio,
      isUsingCustomAudio,
      isModalOpen,
      isFloatingBarVisible,
      openModalForSite,
      startAudioGuideForSite,
      closeModalAndStop,
      minimizeModalKeepPlaying,
      dismissFloatingBar,
      selectSite,
      togglePlayPause,
      toggleMute,
      play,
      pause,
      selectChapter,
      prevChapter,
      nextChapter,
      jumpToSentence,
      setSpeed,
      cycleSpeed,
      seekToPercent,
      seekBySeconds,
      uploadCustomAudio,
      removeCustomAudio,
      toggleCustomAudioSource,
      getCustomAudioForSite,
    ]
  );

  return <AudioGuideContext.Provider value={value}>{children}</AudioGuideContext.Provider>;
};

export function useAudioGuide(): AudioGuideContextType {
  const ctx = useContext(AudioGuideContext);
  if (!ctx) {
    throw new Error('useAudioGuide must be used within an AudioGuideProvider');
  }
  return ctx;
}
