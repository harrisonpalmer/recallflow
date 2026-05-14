import React, { useEffect, useMemo, useState } from 'react';
import { registerPlugin } from '@capacitor/core';
import { createRoot } from 'react-dom/client';
import {
  BarChart3,
  BookOpen,
  Brain,
  Check,
  ChevronRight,
  ClipboardList,
  Clock3,
  Download,
  Eye,
  FileInput,
  FileJson,
  Filter,
  Flame,
  Gauge,
  GraduationCap,
  Image,
  Import,
  Keyboard,
  Layers3,
  Library,
  Lightbulb,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings2,
  Shuffle,
  Sparkles,
  Star,
  Tag,
  Target,
  Trash2,
  Upload,
  Volume2,
  X,
  Zap,
} from 'lucide-react';
import './styles.css';

const storageKey = 'recallflow.v2';
const oldStorageKey = 'recallflow.v1';
const cloudStorageKey = 'recallflow.cloud.v2';
const todayKey = () => new Date().toISOString().slice(0, 10);
const dayMs = 24 * 60 * 60 * 1000;
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const defaultAiModel = 'gpt-5-mini';
const defaultAiBackendUrl = import.meta.env.VITE_RECALLFLOW_AI_ENDPOINT || '';
const ICloudSync = registerPlugin('ICloudSync');
const demoNotes = `Active recall means trying to retrieve an answer before looking at notes.
Spaced repetition works because reviews are scheduled right before forgetting.
Good flashcards test one idea at a time and use specific prompts.
Weak cards are often too broad, too long, or missing enough context.
Reflection after a missed card helps you repair the prompt instead of only repeating it.`;

const deckTemplates = [
  {
    title: 'Exam Cram',
    subject: 'School',
    color: '#4f46e5',
    goal: 30,
    tags: ['exam', 'priority'],
    sampleCards: [
      ['What is active recall?', 'Testing yourself from memory before looking at the answer.', 'retrieval'],
      ['Why space reviews over time?', 'Spacing creates desirable difficulty and improves long-term retention.', 'spacing'],
      ['What should a strong exam card test?', 'One specific fact, concept, formula, or contrast at a time.', 'quality'],
    ],
  },
  {
    title: 'Language Builder',
    subject: 'Language',
    color: '#d97706',
    goal: 25,
    tags: ['language', 'speaking'],
    sampleCards: [
      ['What should a language card include?', 'A short prompt, natural answer, and enough context to avoid ambiguity.', 'language'],
      ['How do you practice production?', 'Look at the meaning first, then recall or type the target phrase.', 'speaking'],
      ['What makes a phrase worth saving?', 'It is common, reusable, and tied to a situation you actually encounter.', 'phrases'],
    ],
  },
  {
    title: 'Medical Recall',
    subject: 'Health',
    color: '#dc2626',
    goal: 40,
    tags: ['medical', 'clinical'],
    sampleCards: [
      ['What is a contraindication?', 'A condition or factor that makes a treatment inadvisable or unsafe.', 'clinical'],
      ['What should clinical cards avoid?', 'Vague prompts that could produce multiple correct answers.', 'quality'],
      ['Why tag systems by topic?', 'Tags let you isolate weak areas before exams or clinical practice.', 'workflow'],
    ],
  },
  {
    title: 'Code Interview',
    subject: 'Tech',
    color: '#0f9f8f',
    goal: 20,
    tags: ['code', 'interview'],
    sampleCards: [
      ['When is a hash map useful?', 'When you need average constant-time lookup, counting, or membership checks.', 'data-structures'],
      ['What is the sliding window pattern?', 'A technique that moves two bounds over a sequence to maintain a valid range.', 'patterns'],
      ['What should you review after solving?', 'The invariant, complexity, edge cases, and why the approach terminates.', 'interview'],
    ],
  },
];

const legacySampleDeckTitles = new Set(['Biology Sprint', 'Spanish Essentials']);

function makeCard({
  front,
  back,
  tags = [],
  type = 'basic',
  hint = '',
  imageUrl = '',
  audioNote = '',
  source = 'manual',
}) {
  return {
    id: uid(),
    front,
    back,
    tags,
    type,
    hint,
    imageUrl,
    audioNote,
    source,
    starred: false,
    interval: 0,
    ease: 2.35,
    due: todayKey(),
    reviews: 0,
    lapses: 0,
    createdAt: new Date().toISOString(),
    lastGrade: null,
    history: [],
  };
}

function normalizeState(rawState) {
  const decks = (Array.isArray(rawState.decks) ? rawState.decks : []).map((deck) => ({
    id: deck.id || uid(),
    title: deck.title || 'Untitled Deck',
    subject: deck.subject || 'Custom',
    color: deck.color || '#4f46e5',
    goal: deck.goal || 20,
    examDate: deck.examDate || '',
    cards: (deck.cards || []).map((card) => ({
      ...makeCard({ front: card.front || 'Untitled prompt', back: card.back || '', tags: card.tags || [] }),
      ...card,
      tags: card.tags || [],
      type: card.type || (String(card.front || '').includes('{{c1::') ? 'cloze' : 'basic'),
      hint: card.hint || '',
      imageUrl: card.imageUrl || '',
      audioNote: card.audioNote || '',
      source: card.source || 'manual',
      starred: Boolean(card.starred),
      history: card.history || [],
    })),
  })).filter((deck) => !legacySampleDeckTitles.has(deck.title));

  return {
    decks,
    log: decks.length ? rawState.log || {} : {},
    backups: decks.length ? rawState.backups || [] : [],
    settings: {
      dailyGoal: rawState.settings?.dailyGoal || 40,
      autoBackup: rawState.settings?.autoBackup ?? true,
      haptics: rawState.settings?.haptics ?? true,
      aiEnabled: rawState.settings?.aiEnabled ?? false,
      aiUseBackend: rawState.settings?.aiUseBackend ?? true,
      aiBackendUrl: rawState.settings?.aiBackendUrl || defaultAiBackendUrl,
      aiModel: rawState.settings?.aiModel || defaultAiModel,
      aiKey: rawState.settings?.aiKey || '',
      iCloudSync: rawState.settings?.iCloudSync ?? true,
      supportEmail: rawState.settings?.supportEmail || '',
      privacyUrl: rawState.settings?.privacyUrl || '',
      supportUrl: rawState.settings?.supportUrl || '',
    },
    savedAt: rawState.savedAt || new Date(0).toISOString(),
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(storageKey) || localStorage.getItem(oldStorageKey);
    if (!raw) return normalizeState({ decks: [] });
    return normalizeState(JSON.parse(raw));
  } catch {
    return normalizeState({ decks: [] });
  }
}

function dueScore(card) {
  const due = new Date(card.due).getTime();
  const now = new Date(todayKey()).getTime();
  return Math.floor((now - due) / dayMs);
}

function isDue(card) {
  return dueScore(card) >= 0;
}

function isWeak(card) {
  return card.lapses > 0 || card.lastGrade === 'again' || card.lastGrade === 'hard' || card.ease < 2;
}

function nextDueLabel(card) {
  const days = dueScore(card);
  if (days > 0) return `${days} day${days === 1 ? '' : 's'} overdue`;
  if (days === 0) return 'due today';
  const ahead = Math.abs(days);
  return `due in ${ahead} day${ahead === 1 ? '' : 's'}`;
}

function schedule(card, grade) {
  const now = new Date();
  let interval = card.interval || 0;
  let ease = card.ease || 2.35;
  let lapses = card.lapses || 0;

  if (grade === 'again') {
    interval = 0;
    ease = Math.max(1.3, ease - 0.22);
    lapses += 1;
  } else if (grade === 'hard') {
    interval = Math.max(1, Math.ceil((interval || 1) * 1.25));
    ease = Math.max(1.3, ease - 0.08);
  } else if (grade === 'good') {
    interval = interval === 0 ? 1 : Math.ceil(interval * ease);
  } else {
    interval = interval === 0 ? 4 : Math.ceil(interval * (ease + 0.6));
    ease = Math.min(3.2, ease + 0.08);
  }

  return {
    ...card,
    interval,
    ease,
    lapses,
    due: new Date(now.getTime() + interval * dayMs).toISOString().slice(0, 10),
    reviews: card.reviews + 1,
    lastGrade: grade,
    history: [...(card.history || []), { day: todayKey(), grade }].slice(-60),
  };
}

function clozePrompt(text) {
  return text.replace(/\{\{c\d+::(.*?)(?:::.*?)?\}\}/g, '_____');
}

function clozeAnswer(text) {
  return text.replace(/\{\{c\d+::(.*?)(?:::.*?)?\}\}/g, '$1');
}

function visibleFront(card, reverse) {
  if (card.type === 'cloze') return reverse ? clozeAnswer(card.front) : clozePrompt(card.front);
  return reverse ? card.back : card.front;
}

function visibleBack(card, reverse) {
  if (card.type === 'cloze') return reverse ? clozePrompt(card.front) : clozeAnswer(card.front);
  return reverse ? card.front : card.back;
}

function smartCardsFromNotes(notes, mode) {
  const sentences = notes
    .split(/[\n.!?]+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 18)
    .slice(0, 16);

  if (!sentences.length) {
    return [makeCard({ front: 'What is the main idea?', back: notes.trim() || 'Paste notes to generate cards.', tags: ['generated'], source: 'smart-builder' })];
  }

  return sentences.map((sentence) => {
    const words = sentence.split(/\s+/);
    const keyword = words.find((word) => word.length > 7) || words[Math.min(2, words.length - 1)];
    if (mode === 'cloze' && keyword) {
      return makeCard({
        front: sentence.replace(keyword, `{{c1::${keyword}}}`),
        back: keyword,
        tags: ['generated', 'cloze'],
        type: 'cloze',
        source: 'smart-builder',
      });
    }

    return makeCard({
      front: keyword ? sentence.replace(keyword, '_____') : `Recall: ${sentence.slice(0, 48)}...`,
      back: sentence,
      tags: ['generated'],
      source: 'smart-builder',
    });
  });
}

function extractResponseText(response) {
  if (typeof response.output_text === 'string') return response.output_text;
  return (response.output || [])
    .flatMap((item) => item.content || [])
    .filter((part) => part.type === 'output_text' && part.text)
    .map((part) => part.text)
    .join('\n');
}

function parseAiCards(text) {
  const trimmed = text.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  const parsed = JSON.parse(trimmed);
  const cards = Array.isArray(parsed) ? parsed : parsed.cards;
  if (!Array.isArray(cards)) return [];

  return cards
    .slice(0, 24)
    .map((card) => makeCard({
      front: String(card.front || '').trim(),
      back: String(card.back || '').trim(),
      tags: Array.isArray(card.tags) ? card.tags.map((tag) => String(tag).trim()).filter(Boolean) : ['ai'],
      type: String(card.type || '').toLowerCase() === 'cloze' ? 'cloze' : 'basic',
      hint: String(card.hint || '').trim(),
      source: 'openai',
    }))
    .filter((card) => card.front && card.back);
}

async function generateAiCards({ notes, mode, apiKey, model }) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || defaultAiModel,
      instructions: [
        'You turn study notes into high quality flashcards.',
        'Return only compact JSON matching {"cards":[{"front":"...","back":"...","tags":["..."],"type":"basic|cloze","hint":"..."}]}.',
        'Create 6 to 14 cards. Keep prompts atomic, answers specific, and hints short.',
        mode === 'cloze' ? 'Prefer cloze cards using {{c1::answer}} syntax in the front field.' : 'Prefer basic question and answer cards.',
      ].join(' '),
      input: notes.slice(0, 12000),
      max_output_tokens: 2200,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `OpenAI request failed with status ${response.status}`);
  }

  const data = await response.json();
  const cards = parseAiCards(extractResponseText(data));
  if (!cards.length) throw new Error('The AI response did not include usable cards.');
  return cards;
}

function backendEndpoint(settings) {
  const explicit = settings.aiBackendUrl?.trim();
  if (explicit) return explicit;
  if (typeof window !== 'undefined' && /^https?:$/.test(window.location.protocol)) return '/api/generate-cards';
  return '';
}

async function generateBackendCards({ notes, mode, model, endpoint }) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      notes: notes.slice(0, 12000),
      mode,
      model: model || defaultAiModel,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Backend AI request failed with status ${response.status}`);
  }

  const data = await response.json();
  const cards = (Array.isArray(data.cards) ? data.cards : [])
    .slice(0, 24)
    .map((card) => makeCard({
      front: String(card.front || '').trim(),
      back: String(card.back || '').trim(),
      tags: Array.isArray(card.tags) ? card.tags.map((tag) => String(tag).trim()).filter(Boolean) : ['ai'],
      type: String(card.type || '').toLowerCase() === 'cloze' ? 'cloze' : 'basic',
      hint: String(card.hint || '').trim(),
      source: 'recallflow-ai',
    }))
    .filter((card) => card.front && card.back);
  if (!cards.length) throw new Error('The backend did not return usable cards.');
  return cards;
}

async function generateStudyCards({ notes, mode, settings }) {
  const endpoint = settings.aiUseBackend ? backendEndpoint(settings) : '';
  if (settings.aiEnabled && endpoint) {
    return generateBackendCards({
      notes,
      mode,
      model: settings.aiModel?.trim() || defaultAiModel,
      endpoint,
    });
  }

  if (settings.aiEnabled && settings.aiKey?.trim()) {
    return generateAiCards({
      notes,
      mode,
      apiKey: settings.aiKey.trim(),
      model: settings.aiModel?.trim() || defaultAiModel,
    });
  }

  return smartCardsFromNotes(notes, mode);
}

function aiStatusLabel(settings) {
  if (settings.aiEnabled && settings.aiUseBackend && backendEndpoint(settings)) return 'Asking RecallFlow AI...';
  if (settings.aiEnabled && settings.aiKey?.trim()) return 'Asking your OpenAI key...';
  return 'Using the local card builder...';
}

function cloudPayload(state) {
  return {
    ...state,
    savedAt: new Date().toISOString(),
    settings: {
      ...state.settings,
      aiKey: '',
    },
  };
}

function improveCard(front, back) {
  const cleanFront = front.trim().replace(/\s+/g, ' ');
  const cleanBack = back.trim().replace(/\s+/g, ' ');
  return {
    front: cleanFront.endsWith('?') ? cleanFront : `What should you remember about ${cleanFront.slice(0, 42)}?`,
    back: cleanBack.length > 180 ? `${cleanBack.slice(0, 176)}...` : cleanBack,
  };
}

function makeTemplateCards(template) {
  return (template.sampleCards || []).map(([front, back, tag]) => makeCard({
    front,
    back,
    tags: [...template.tags, tag].filter(Boolean),
    hint: 'Edit or delete this starter card once your own deck is ready.',
    source: 'template',
  }));
}

function cardQuality(card) {
  const issues = [];
  const front = String(card.front || '').trim();
  const back = String(card.back || '').trim();
  if (front.length < 12) issues.push('Prompt may be too vague');
  if (back.length < 2) issues.push('Missing answer');
  if (front.length > 180) issues.push('Prompt is too long');
  if (back.length > 260) issues.push('Answer may be too dense');
  if (!front.includes('{{c1::') && !front.includes('_____') && !front.endsWith('?')) issues.push('Prompt could ask a clearer question');
  if (!card.tags?.length) issues.push('Add a tag');
  return issues;
}

function deckHealth(deck) {
  const cards = deck?.cards || [];
  const due = cards.filter(isDue).length;
  const weak = cards.filter(isWeak).length;
  const needsRepair = cards.filter((card) => cardQuality(card).length).length;
  const forecast = cards.filter((card) => {
    const score = dueScore(card);
    return score >= -7;
  }).length;
  const mastered = cards.filter((card) => card.interval >= 14).length;
  const score = cards.length
    ? Math.max(0, Math.round(100 - (weak / cards.length) * 35 - (needsRepair / cards.length) * 30 + (mastered / cards.length) * 15))
    : 0;
  return { due, weak, needsRepair, forecast, mastered, score };
}

function daysUntil(dateString) {
  if (!dateString) return null;
  const target = new Date(dateString).getTime();
  if (Number.isNaN(target)) return null;
  return Math.ceil((target - new Date(todayKey()).getTime()) / dayMs);
}

function examPlan(deck) {
  const days = daysUntil(deck?.examDate);
  if (days === null) return null;
  const health = deckHealth(deck);
  const cards = deck?.cards?.length || 0;
  const daysLeft = Math.max(1, days);
  const pressure = health.due + health.weak * 2 + Math.max(0, cards - health.mastered);
  const dailyTarget = Math.max(deck.goal || 1, Math.ceil(pressure / daysLeft));
  const status = days < 0 ? 'Exam date passed' : days === 0 ? 'Exam today' : `${days} day${days === 1 ? '' : 's'} left`;
  return { days, dailyTarget, status, pressure };
}

function coachRecommendation(deck) {
  if (!deck?.cards?.length) return 'Build or import a small starter deck, then study ten cards.';
  const health = deckHealth(deck);
  if (health.due) return `Start with ${health.due} due card${health.due === 1 ? '' : 's'} before adding more.`;
  if (health.weak) return `Run a weak-card session to repair ${health.weak} shaky card${health.weak === 1 ? '' : 's'}.`;
  if (health.needsRepair) return `Repair ${health.needsRepair} card${health.needsRepair === 1 ? '' : 's'} with vague prompts or dense answers.`;
  return 'Review new or saved cards to keep momentum while the scheduler waits.';
}

function launchChecklist({ decks, allCards, settings }) {
  return [
    {
      label: 'Create at least one real deck',
      done: decks.length > 0,
      detail: decks.length ? `${decks.length} deck${decks.length === 1 ? '' : 's'} ready` : 'Add a starter deck or import cards.',
    },
    {
      label: 'Have study content ready',
      done: allCards.length >= 10,
      detail: `${allCards.length} card${allCards.length === 1 ? '' : 's'} in the library`,
    },
    {
      label: 'Set support contact',
      done: Boolean(settings.supportEmail || settings.supportUrl),
      detail: settings.supportUrl || settings.supportEmail || 'Add an email or support page.',
    },
    {
      label: 'Set privacy policy URL',
      done: Boolean(settings.privacyUrl),
      detail: settings.privacyUrl || 'Host public/privacy.html on any free static host, then paste the URL here.',
    },
    {
      label: 'Disclose optional AI',
      done: true,
      detail: 'AI is opt-in, user-key based, and has a local fallback.',
    },
  ];
}

function parseCsv(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [front = '', back = '', tagText = 'imported', hint = ''] = line.split(',');
      return makeCard({
        front: front.trim(),
        back: back.trim(),
        tags: tagText.split('|').map((tag) => tag.trim()).filter(Boolean),
        hint: hint.trim(),
        source: 'csv',
      });
    })
    .filter((card) => card.front && card.back);
}

function compactDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function App() {
  const [state, setState] = useState(loadState);
  const [selectedDeckId, setSelectedDeckId] = useState(state.decks[0]?.id);
  const [tab, setTab] = useState('study');
  const [query, setQuery] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);
  const [builderText, setBuilderText] = useState('');
  const [builderMode, setBuilderMode] = useState('basic');
  const [builderStatus, setBuilderStatus] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [quickDeckName, setQuickDeckName] = useState('');
  const [quickNotes, setQuickNotes] = useState('');
  const [quickMode, setQuickMode] = useState('basic');
  const [quickStatus, setQuickStatus] = useState('');
  const [isQuickGenerating, setIsQuickGenerating] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');
  const [newTags, setNewTags] = useState('');
  const [newHint, setNewHint] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [studyMode, setStudyMode] = useState('flashcard');
  const [sessionFilter, setSessionFilter] = useState('due');
  const [reverse, setReverse] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [checkedAnswer, setCheckedAnswer] = useState(false);
  const [scratchpad, setScratchpad] = useState('');
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudAvailable, setCloudAvailable] = useState(false);
  const [syncStatus, setSyncStatus] = useState('Checking iCloud sync...');
  const [lastCloudSync, setLastCloudSync] = useState('');

  useEffect(() => {
    const nextState = state.settings.autoBackup ? withBackup(state) : state;
    const savedState = { ...nextState, savedAt: new Date().toISOString() };
    localStorage.setItem(storageKey, JSON.stringify(savedState));

    if (!cloudReady || !cloudAvailable || !state.settings.iCloudSync) return undefined;
    const timer = window.setTimeout(async () => {
      try {
        const payload = cloudPayload(savedState);
        await ICloudSync.set({ key: cloudStorageKey, value: JSON.stringify(payload) });
        setLastCloudSync(new Date().toISOString());
        setSyncStatus('iCloud sync is up to date.');
      } catch (error) {
        setSyncStatus('iCloud sync is unavailable on this device.');
      }
    }, 700);

    return () => window.clearTimeout(timer);
  }, [state, cloudReady, cloudAvailable]);

  useEffect(() => {
    let cancelled = false;

    async function restoreFromCloud() {
      if (!state.settings.iCloudSync) {
        setCloudAvailable(false);
        setSyncStatus('iCloud sync is off.');
        setCloudReady(true);
        return;
      }

      try {
        const availability = await ICloudSync.isAvailable();
        if (!availability.available) {
          if (!cancelled) {
            setCloudAvailable(false);
            setSyncStatus('Sign in to iCloud to sync across devices.');
            setCloudReady(true);
          }
          return;
        }

        const localRaw = localStorage.getItem(storageKey);
        const localState = localRaw ? normalizeState(JSON.parse(localRaw)) : normalizeState({ decks: [] });
        const cloud = await ICloudSync.get({ key: cloudStorageKey });
        if (cloud.value) {
          const cloudState = normalizeState(JSON.parse(cloud.value));
          const cloudTime = new Date(cloudState.savedAt || 0).getTime();
          const localTime = new Date(localState.savedAt || 0).getTime();
          const shouldUseCloud = cloudTime > localTime || (!localState.decks.length && cloudState.decks.length);
          if (shouldUseCloud && !cancelled) {
            setState({
              ...cloudState,
              settings: {
                ...cloudState.settings,
                aiKey: state.settings.aiKey,
              },
            });
          }
        }

        if (!cancelled) {
          setCloudAvailable(true);
          setSyncStatus('iCloud sync is on.');
          setLastCloudSync(new Date().toISOString());
          setCloudReady(true);
        }
      } catch (error) {
        if (!cancelled) {
          setCloudAvailable(false);
          setSyncStatus('iCloud sync is unavailable on this device.');
          setCloudReady(true);
        }
      }
    }

    restoreFromCloud();
    return () => {
      cancelled = true;
    };
  }, [state.settings.iCloudSync]);

  const selectedDeck = state.decks.find((deck) => deck.id === selectedDeckId) || state.decks[0];
  const allCards = state.decks.flatMap((deck) => deck.cards.map((card) => ({ ...card, deckTitle: deck.title, deckId: deck.id })));
  const reviewedToday = state.log[todayKey()] || 0;
  const dueAll = allCards.filter(isDue).length;
  const retention = retentionScore(allCards);
  const streak = currentStreak(state.log);
  const sessionQueue = selectedDeck ? sessionCards(selectedDeck.cards, sessionFilter) : [];
  const activeCard = sessionQueue[0];
  const searchResults = useMemo(() => searchCards(allCards, query), [query, allCards]);
  const choices = useMemo(() => {
    if (!activeCard) return [];
    return makeChoices(activeCard, selectedDeck?.cards || [], reverse);
  }, [activeCard, selectedDeck, reverse]);
  const startButtonLabel = allCards.length ? (dueAll ? 'Start focus session' : 'Review any card') : 'Create deck';

  function withBackup(current) {
    const snapshot = {
      day: todayKey(),
      deckCount: current.decks.length,
      cardCount: current.decks.reduce((sum, deck) => sum + deck.cards.length, 0),
    };
    if (snapshot.deckCount === 0 && snapshot.cardCount === 0) return current;
    const backups = current.backups || [];
    if (backups[0]?.day === snapshot.day && backups[0]?.cardCount === snapshot.cardCount) return current;
    return { ...current, backups: [snapshot, ...backups].slice(0, 14) };
  }

  function updateDeck(deckId, updater) {
    setState((current) => ({
      ...current,
      decks: current.decks.map((deck) => deck.id === deckId ? updater(deck) : deck),
    }));
  }

  function updateSettings(patch) {
    setState((current) => ({
      ...current,
      settings: { ...current.settings, ...patch },
    }));
  }

  function handleStartFocus() {
    setShowAnswer(false);
    setTypedAnswer('');
    setCheckedAnswer(false);

    if (!state.decks.length || !allCards.length) {
      setTab('build');
      return;
    }

    setSessionFilter(dueAll ? 'due' : 'all');
    setTab('study');
  }

  function review(grade) {
    if (!activeCard || !selectedDeck) return;
    setState((current) => ({
      ...current,
      log: { ...current.log, [todayKey()]: (current.log[todayKey()] || 0) + 1 },
      decks: current.decks.map((deck) => deck.id === selectedDeck.id
        ? { ...deck, cards: deck.cards.map((card) => card.id === activeCard.id ? schedule(card, grade) : card) }
        : deck),
    }));
    setShowAnswer(false);
    setTypedAnswer('');
    setCheckedAnswer(false);
  }

  function addDeck() {
    const title = newDeckName.trim();
    if (!title) return;
    const deck = { id: uid(), title, subject: 'Custom', color: '#4f46e5', goal: 20, cards: [] };
    setState((current) => ({ ...current, decks: [deck, ...current.decks] }));
    setSelectedDeckId(deck.id);
    setNewDeckName('');
  }

  function addTemplate(template) {
    const deck = {
      id: uid(),
      title: template.title,
      subject: template.subject,
      color: template.color,
      goal: template.goal,
      cards: makeTemplateCards(template),
    };
    setState((current) => ({ ...current, decks: [deck, ...current.decks] }));
    setSelectedDeckId(deck.id);
  }

  async function createQuickDeck() {
    const title = quickDeckName.trim() || 'My First Deck';
    const notes = quickNotes.trim() || demoNotes;
    setIsQuickGenerating(true);
    setQuickStatus(state.settings.aiEnabled ? 'Building your first AI deck...' : 'Building your first deck locally...');

    try {
      const cards = await generateStudyCards({ notes, mode: quickMode, settings: state.settings });
      const deck = {
        id: uid(),
        title,
        subject: 'Quick start',
        color: '#4f46e5',
        goal: 20,
        examDate: '',
        cards,
      };
      setState((current) => ({ ...current, decks: [deck, ...current.decks] }));
      setSelectedDeckId(deck.id);
      setQuickDeckName('');
      setQuickNotes('');
      setQuickStatus(`Created ${title} with ${cards.length} study cards.`);
      setTab('study');
    } catch {
      const cards = smartCardsFromNotes(notes, quickMode);
      const deck = {
        id: uid(),
        title,
        subject: 'Quick start',
        color: '#4f46e5',
        goal: 20,
        examDate: '',
        cards,
      };
      setState((current) => ({ ...current, decks: [deck, ...current.decks] }));
      setSelectedDeckId(deck.id);
      setQuickStatus(`AI was unavailable, so RecallFlow created ${cards.length} local cards.`);
      setTab('study');
    } finally {
      setIsQuickGenerating(false);
    }
  }

  function addCard() {
    if (!selectedDeck || !newFront.trim() || !newBack.trim()) return;
    const tags = newTags.split(',').map((tag) => tag.trim()).filter(Boolean);
    updateDeck(selectedDeck.id, (deck) => ({
      ...deck,
      cards: [
        makeCard({
          front: newFront.trim(),
          back: newBack.trim(),
          tags,
          hint: newHint.trim(),
          imageUrl: newImageUrl.trim(),
          type: newFront.includes('{{c1::') ? 'cloze' : 'basic',
        }),
        ...deck.cards,
      ],
    }));
    setNewFront('');
    setNewBack('');
    setNewTags('');
    setNewHint('');
    setNewImageUrl('');
  }

  function improveDraft() {
    const improved = improveCard(newFront, newBack);
    setNewFront(improved.front);
    setNewBack(improved.back);
  }

  async function generateCards() {
    if (!selectedDeck) return;
    const notes = builderText.trim();
    if (!notes) {
      setBuilderStatus('Paste notes first, then generate cards.');
      return;
    }

    setIsGenerating(true);
    setBuilderStatus(aiStatusLabel(state.settings));

    try {
      const cards = await generateStudyCards({ notes, mode: builderMode, settings: state.settings });
      updateDeck(selectedDeck.id, (deck) => ({ ...deck, cards: [...cards, ...deck.cards] }));
      setBuilderText('');
      setBuilderStatus(`Added ${cards.length} cards to ${selectedDeck.title}.`);
      setTab('cards');
    } catch (error) {
      const cards = smartCardsFromNotes(notes, builderMode);
      updateDeck(selectedDeck.id, (deck) => ({ ...deck, cards: [...cards, ...deck.cards] }));
      setBuilderStatus(`AI was unavailable, so RecallFlow added ${cards.length} local cards instead.`);
    } finally {
      setIsGenerating(false);
    }
  }

  function importCsv(event) {
    const file = event.target.files?.[0];
    if (!file || !selectedDeck) return;
    const reader = new FileReader();
    reader.onload = () => {
      const cards = parseCsv(String(reader.result || ''));
      updateDeck(selectedDeck.id, (deck) => ({ ...deck, cards: [...cards, ...deck.cards] }));
    };
    reader.readAsText(file);
  }

  function importJson(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const restored = normalizeState(JSON.parse(String(reader.result || '{}')));
        setState(restored);
        setSelectedDeckId(restored.decks[0]?.id);
      } catch {
        window.alert('That backup could not be restored.');
      }
    };
    reader.readAsText(file);
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `recallflow-backup-${todayKey()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function mutateCard(deckId, cardId, updater) {
    updateDeck(deckId, (deck) => ({
      ...deck,
      cards: deck.cards.map((card) => card.id === cardId ? updater(card) : card),
    }));
  }

  function updateCard(deckId, cardId, patch) {
    mutateCard(deckId, cardId, (card) => ({
      ...card,
      ...patch,
      type: patch.front?.includes('{{c1::') ? 'cloze' : patch.type || card.type,
    }));
  }

  function deleteCard(deckId, cardId) {
    updateDeck(deckId, (deck) => ({ ...deck, cards: deck.cards.filter((card) => card.id !== cardId) }));
  }

  function toggleStar(deckId, cardId) {
    mutateCard(deckId, cardId, (card) => ({ ...card, starred: !card.starred }));
  }

  function rescheduleToday(deckId, cardId) {
    mutateCard(deckId, cardId, (card) => ({ ...card, due: todayKey() }));
  }

  function updateDeckMeta(deckId, patch) {
    updateDeck(deckId, (deck) => ({ ...deck, ...patch }));
  }

  function deleteDeck(deckId) {
    const deck = state.decks.find((item) => item.id === deckId);
    if (!deck) return;
    if (!window.confirm(`Delete "${deck.title}" and all cards in it?`)) return;
    const nextDecks = state.decks.filter((item) => item.id !== deckId);
    setState((current) => ({ ...current, decks: current.decks.filter((item) => item.id !== deckId) }));
    setSelectedDeckId(nextDecks[0]?.id);
  }

  useEffect(() => {
    function onStudyKey(event) {
      if (tab !== 'study' || !activeCard) return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName)) return;

      if (event.key === ' ') {
        event.preventDefault();
        if (!showAnswer && studyMode === 'flashcard') {
          setShowAnswer(true);
        } else if (showAnswer) {
          review('good');
        }
      }

      if (showAnswer && ['1', '2', '3', '4'].includes(event.key)) {
        event.preventDefault();
        review(['again', 'hard', 'good', 'easy'][Number(event.key) - 1]);
      }
    }

    window.addEventListener('keydown', onStudyKey);
    return () => window.removeEventListener('keydown', onStudyKey);
  }, [tab, activeCard, showAnswer, studyMode]);

  return (
    <main className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark"><Brain size={24} /></span>
          <div>
            <strong>RecallFlow</strong>
            <small>AI-assisted flashcards for phone-native studying</small>
          </div>
        </div>
        <button className="icon-button" aria-label="Settings" onClick={() => setTab('stats')}><Settings2 size={20} /></button>
      </header>

      <section className="hero-card">
        <div>
          <p>Today&apos;s study plan</p>
          <h1>{allCards.length ? (dueAll ? `${dueAll} cards ready` : 'All caught up') : 'Create your first deck'}</h1>
          <span>{allCards.length ? `${reviewedToday}/${state.settings.dailyGoal} daily goal · ${streak} day streak · auto-backup on` : 'Start empty, then import notes or create your own cards'}</span>
        </div>
        <button onClick={handleStartFocus}>{startButtonLabel} <ChevronRight size={18} /></button>
      </section>

      <section className="hero-strip">
        <Metric icon={<Flame size={18} />} label="Reviewed" value={`${reviewedToday}`} />
        <Metric icon={<Clock3 size={18} />} label="Due" value={`${dueAll}`} />
        <Metric icon={<Gauge size={18} />} label="Retention" value={`${retention}%`} />
        <Metric icon={<Target size={18} />} label="Weak" value={`${allCards.filter(isWeak).length}`} />
      </section>

      <section className="deck-rail" aria-label="Decks">
        {state.decks.map((deck) => (
          <button
            key={deck.id}
            className={`deck-pill ${selectedDeck?.id === deck.id ? 'selected' : ''}`}
            onClick={() => { setSelectedDeckId(deck.id); setShowAnswer(false); }}
            style={{ '--deck-color': deck.color }}
          >
            <span>{deck.title}</span>
            <small>{deck.cards.filter(isDue).length} due · {deck.cards.length} cards</small>
          </button>
        ))}
        <label className="quick-add">
          <Plus size={16} />
          <input value={newDeckName} onChange={(event) => setNewDeckName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addDeck()} placeholder="New deck" />
        </label>
      </section>

      <nav className="tabbar" aria-label="Main sections">
        <TabButton active={tab === 'study'} onClick={() => setTab('study')} icon={<GraduationCap size={17} />} label="Study" />
        <TabButton active={tab === 'build'} onClick={() => setTab('build')} icon={<Sparkles size={17} />} label="Build" />
        <TabButton active={tab === 'cards'} onClick={() => setTab('cards')} icon={<Library size={17} />} label="Cards" />
        <TabButton active={tab === 'stats'} onClick={() => setTab('stats')} icon={<BarChart3 size={17} />} label="Stats" />
      </nav>

      <section className="screen" key={tab}>
        {tab === 'study' && (
          <StudyScreen
            deck={selectedDeck}
            dueCount={sessionQueue.length}
            activeCard={activeCard}
            showAnswer={showAnswer}
            setShowAnswer={setShowAnswer}
            review={review}
            studyMode={studyMode}
            setStudyMode={setStudyMode}
            sessionFilter={sessionFilter}
            setSessionFilter={setSessionFilter}
            reverse={reverse}
            setReverse={setReverse}
            typedAnswer={typedAnswer}
            setTypedAnswer={setTypedAnswer}
            checkedAnswer={checkedAnswer}
            setCheckedAnswer={setCheckedAnswer}
            choices={choices}
            scratchpad={scratchpad}
            setScratchpad={setScratchpad}
          />
        )}
        {tab === 'build' && (
          <BuildScreen
            builderText={builderText}
            setBuilderText={setBuilderText}
            builderMode={builderMode}
            setBuilderMode={setBuilderMode}
            generateCards={generateCards}
            newFront={newFront}
            setNewFront={setNewFront}
            newBack={newBack}
            setNewBack={setNewBack}
            newTags={newTags}
            setNewTags={setNewTags}
            newHint={newHint}
            setNewHint={setNewHint}
            newImageUrl={newImageUrl}
            setNewImageUrl={setNewImageUrl}
            addCard={addCard}
            improveDraft={improveDraft}
            importCsv={importCsv}
            importJson={importJson}
            exportJson={exportJson}
            addTemplate={addTemplate}
            hasDeck={Boolean(selectedDeck)}
            selectedDeck={selectedDeck}
            updateDeckMeta={updateDeckMeta}
            deleteDeck={deleteDeck}
            newDeckName={newDeckName}
            setNewDeckName={setNewDeckName}
            addDeck={addDeck}
            settings={state.settings}
            updateSettings={updateSettings}
            builderStatus={builderStatus}
            isGenerating={isGenerating}
            quickDeckName={quickDeckName}
            setQuickDeckName={setQuickDeckName}
            quickNotes={quickNotes}
            setQuickNotes={setQuickNotes}
            quickMode={quickMode}
            setQuickMode={setQuickMode}
            quickStatus={quickStatus}
            isQuickGenerating={isQuickGenerating}
            createQuickDeck={createQuickDeck}
          />
        )}
        {tab === 'cards' && (
          <CardsScreen
            query={query}
            setQuery={setQuery}
            results={searchResults}
            deleteCard={deleteCard}
            toggleStar={toggleStar}
            rescheduleToday={rescheduleToday}
            updateCard={updateCard}
          />
        )}
        {tab === 'stats' && (
          <StatsScreen decks={state.decks} log={state.log} allCards={allCards} settings={state.settings} backups={state.backups} updateSettings={updateSettings} syncStatus={syncStatus} lastCloudSync={lastCloudSync} />
        )}
      </section>
    </main>
  );
}

function retentionScore(cards) {
  const reviewed = cards.filter((card) => card.lastGrade);
  if (!reviewed.length) return 100;
  return Math.round((reviewed.filter((card) => card.lastGrade === 'good' || card.lastGrade === 'easy').length / reviewed.length) * 100);
}

function currentStreak(log) {
  let streak = 0;
  const date = new Date();
  while (log[date.toISOString().slice(0, 10)]) {
    streak += 1;
    date.setDate(date.getDate() - 1);
  }
  return streak;
}

function sessionCards(cards, filter) {
  const pool = cards.filter((card) => {
    if (filter === 'due') return isDue(card);
    if (filter === 'weak') return isWeak(card);
    if (filter === 'new') return card.reviews === 0;
    if (filter === 'starred') return card.starred;
    return true;
  });
  return pool.sort((a, b) => {
    if (isWeak(a) !== isWeak(b)) return isWeak(a) ? -1 : 1;
    return dueScore(b) - dueScore(a);
  });
}

function searchCards(cards, query) {
  const needle = query.toLowerCase().trim();
  if (!needle) return cards.slice(0, 24);

  return cards.filter((card) => {
    if (needle === 'is:due') return isDue(card);
    if (needle === 'is:weak') return isWeak(card);
    if (needle === 'is:repair') return cardQuality(card).length > 0;
    if (needle === 'is:starred') return card.starred;
    if (needle.startsWith('tag:')) return card.tags.some((tag) => tag.toLowerCase().includes(needle.slice(4)));
    return `${card.front} ${card.back} ${card.tags.join(' ')} ${card.deckTitle}`.toLowerCase().includes(needle);
  }).slice(0, 80);
}

function makeChoices(activeCard, cards, reverse) {
  const correct = visibleBack(activeCard, reverse);
  const wrong = cards
    .filter((card) => card.id !== activeCard.id)
    .map((card) => visibleBack(card, reverse))
    .filter(Boolean)
    .slice(0, 3);
  const choices = [correct, ...wrong];
  return choices.sort(() => Math.random() - 0.5);
}

function answerSimilarity(typed, answer) {
  const clean = (value) => value.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  const a = clean(typed);
  const b = clean(answer);
  if (!a || !b) return 0;
  if (a === b) return 100;
  const shared = a.split(/\s+/).filter((word) => b.includes(word)).length;
  return Math.min(99, Math.round((shared / Math.max(1, b.split(/\s+/).length)) * 100));
}

function Metric({ icon, label, value }) {
  return (
    <article className="metric">
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function TabButton({ active, onClick, icon, label }) {
  return <button className={active ? 'active' : ''} onClick={onClick}>{icon}{label}</button>;
}

function Segmented({ value, onChange, options }) {
  return (
    <div className="segmented">
      {options.map((option) => (
        <button key={option.value} className={value === option.value ? 'active' : ''} onClick={() => onChange(option.value)}>
          {option.icon} {option.label}
        </button>
      ))}
    </div>
  );
}

function StudyScreen({
  deck,
  dueCount,
  activeCard,
  showAnswer,
  setShowAnswer,
  review,
  studyMode,
  setStudyMode,
  sessionFilter,
  setSessionFilter,
  reverse,
  setReverse,
  typedAnswer,
  setTypedAnswer,
  checkedAnswer,
  setCheckedAnswer,
  choices,
  scratchpad,
  setScratchpad,
}) {
  if (!deck) return <EmptyState title="Create your first deck" text="Add a deck and start building cards from notes, CSV, or manual entry." />;

  const prompt = activeCard ? visibleFront(activeCard, reverse) : '';
  const answer = activeCard ? visibleBack(activeCard, reverse) : '';
  const similarity = answerSimilarity(typedAnswer, answer);
  const health = deckHealth(deck);
  const activeIssues = activeCard ? cardQuality(activeCard) : [];
  const plan = examPlan(deck);

  return (
    <div className="study-grid">
      <section className="study-card">
        <div className="study-controls">
          <Segmented
            value={studyMode}
            onChange={(next) => { setStudyMode(next); setShowAnswer(false); setCheckedAnswer(false); }}
            options={[
              { value: 'flashcard', label: 'Flash', icon: <Eye size={15} /> },
              { value: 'type', label: 'Type', icon: <Keyboard size={15} /> },
              { value: 'choice', label: 'Quiz', icon: <Shuffle size={15} /> },
            ]}
          />
          <Segmented
            value={sessionFilter}
            onChange={(next) => { setSessionFilter(next); setShowAnswer(false); }}
            options={[
              { value: 'due', label: 'Due', icon: <Clock3 size={15} /> },
              { value: 'all', label: 'All', icon: <Layers3 size={15} /> },
              { value: 'weak', label: 'Weak', icon: <Target size={15} /> },
              { value: 'new', label: 'New', icon: <Sparkles size={15} /> },
              { value: 'starred', label: 'Saved', icon: <Star size={15} /> },
            ]}
          />
        </div>

        <div className="study-meta">
          <span><Layers3 size={16} /> {deck.title}</span>
          <span><Clock3 size={16} /> {dueCount} in session</span>
          <button className={reverse ? 'chip-button active' : 'chip-button'} onClick={() => setReverse(!reverse)}>
            <RotateCcw size={15} /> Reverse
          </button>
        </div>

        {activeCard ? (
          <>
            <div
              className={`flashcard ${showAnswer || checkedAnswer ? 'answered' : ''}`}
              onClick={() => studyMode === 'flashcard' && !showAnswer && setShowAnswer(true)}
              role="button"
              tabIndex={0}
            >
              <p className="card-side-label">{showAnswer || checkedAnswer ? 'Answer' : activeCard.type === 'cloze' ? 'Cloze prompt' : 'Prompt'}</p>
              {activeCard.imageUrl && <img className="card-image" src={activeCard.imageUrl} alt="" />}
              <h1>{showAnswer || checkedAnswer ? answer : prompt}</h1>
              {activeCard.hint && !(showAnswer || checkedAnswer) && <p className="hint-line"><Lightbulb size={16} /> {activeCard.hint}</p>}
              {activeCard.audioNote && <p className="hint-line"><Volume2 size={16} /> {activeCard.audioNote}</p>}
              {!!activeIssues.length && <p className="hint-line"><Lightbulb size={16} /> {activeIssues[0]}</p>}
              <div className="tag-row">
                {activeCard.tags.map((tag) => <span key={tag}><Tag size={13} /> {tag}</span>)}
                {activeCard.starred && <span><Star size={13} /> saved</span>}
              </div>
            </div>

            {studyMode === 'flashcard' && (
              !showAnswer ? (
                <button className="big-action" onClick={() => setShowAnswer(true)}>Show answer <ChevronRight size={20} /></button>
              ) : <ReviewButtons review={review} />
            )}

            {studyMode === 'type' && (
              <div className="type-answer">
                <input value={typedAnswer} onChange={(event) => setTypedAnswer(event.target.value)} placeholder="Type your answer before revealing" />
                {!checkedAnswer ? (
                  <button className="big-action" onClick={() => setCheckedAnswer(true)}>Check answer <Check size={18} /></button>
                ) : (
                  <>
                    <div className="score-card">
                      <strong>{similarity}% match</strong>
                      <span>Use your judgment: exact wording is less important than retrieval.</span>
                    </div>
                    <ReviewButtons review={review} />
                  </>
                )}
              </div>
            )}

            {studyMode === 'choice' && (
              !showAnswer ? (
                <div className="choice-grid">
                  {choices.map((choice) => (
                    <button key={choice} onClick={() => setShowAnswer(true)}>{choice}</button>
                  ))}
                </div>
              ) : <ReviewButtons review={review} />
            )}
          </>
        ) : (
          <div className="session-complete">
            <EmptyState
              title={deck.cards.length ? 'Session complete' : 'No cards yet'}
              text={deck.cards.length ? 'No cards match this session filter. Switch to All cards, New, or build more.' : 'Build from notes or import CSV to start studying.'}
            />
            {deck.cards.length > 0 && (
              <div className="session-summary">
                <span><strong>{health.score}%</strong> deck health</span>
                <span><strong>{health.needsRepair}</strong> repair</span>
                <span><strong>{health.forecast}</strong> next 7 days</span>
              </div>
            )}
            {deck.cards.length > 0 && (
              <div className="dual-actions">
                <button className="secondary" onClick={() => setSessionFilter('all')}><Layers3 size={18} /> All cards</button>
                <button className="primary" onClick={() => setSessionFilter('new')}><Sparkles size={18} /> New cards</button>
              </div>
            )}
          </div>
        )}
      </section>

      <aside className="coach-panel glass">
        <h2>Focus coach</h2>
        <p>{coachRecommendation(deck)}</p>
        <div className="coach-list">
          <span><Check size={16} /> Deck health <strong>{health.score}%</strong></span>
          <span><Check size={16} /> Due now <strong>{health.due}</strong></span>
          <span><Check size={16} /> Need repair <strong>{health.needsRepair}</strong></span>
          <span><Check size={16} /> Next 7 days <strong>{health.forecast}</strong></span>
          {plan && <span><Check size={16} /> Exam pace <strong>{plan.dailyTarget}/day</strong></span>}
        </div>
        <div className="scratchpad">
          <div className="panel-title">
            <div>
              <p>Scratchpad</p>
              <h2>Think before reveal</h2>
            </div>
            <Pencil size={20} />
          </div>
          <textarea value={scratchpad} onChange={(event) => setScratchpad(event.target.value)} placeholder="Jot a formula, sentence, or memory cue..." />
          <button className="secondary" onClick={() => setScratchpad('')}>Clear scratchpad</button>
        </div>
      </aside>
    </div>
  );
}

function ReviewButtons({ review }) {
  return (
    <div className="review-actions">
      <button className="again" onClick={() => review('again')}><RotateCcw size={18} /> Again</button>
      <button className="hard" onClick={() => review('hard')}><Zap size={18} /> Hard</button>
      <button className="good" onClick={() => review('good')}><Check size={18} /> Good</button>
      <button className="easy" onClick={() => review('easy')}><Star size={18} /> Easy</button>
    </div>
  );
}

function BuildScreen({
  builderText,
  setBuilderText,
  builderMode,
  setBuilderMode,
  generateCards,
  newFront,
  setNewFront,
  newBack,
  setNewBack,
  newTags,
  setNewTags,
  newHint,
  setNewHint,
  newImageUrl,
  setNewImageUrl,
  addCard,
  improveDraft,
  importCsv,
  importJson,
  exportJson,
  addTemplate,
  hasDeck,
  selectedDeck,
  updateDeckMeta,
  deleteDeck,
  newDeckName,
  setNewDeckName,
  addDeck,
  settings,
  updateSettings,
  builderStatus,
  isGenerating,
  quickDeckName,
  setQuickDeckName,
  quickNotes,
  setQuickNotes,
  quickMode,
  setQuickMode,
  quickStatus,
  isQuickGenerating,
  createQuickDeck,
}) {
  if (!hasDeck) {
    return (
      <div className="build-grid">
        <section className="panel feature-panel wide quickstart-panel">
          <div className="panel-title">
            <div>
              <p>One-minute deck</p>
              <h2>Paste notes, get a study session</h2>
            </div>
            <Sparkles size={22} />
          </div>
          <div className="quickstart-grid">
            <input value={quickDeckName} onChange={(event) => setQuickDeckName(event.target.value)} placeholder="Deck name, like Biology Midterm" />
            <Segmented
              value={quickMode}
              onChange={setQuickMode}
              options={[
                { value: 'basic', label: 'Basic', icon: <BookOpen size={15} /> },
                { value: 'cloze', label: 'Cloze', icon: <Filter size={15} /> },
              ]}
            />
            <textarea value={quickNotes} onChange={(event) => setQuickNotes(event.target.value)} placeholder="Paste notes here, or use the sample notes to try RecallFlow immediately..." />
            <div className="dual-actions">
              <button className="secondary" onClick={() => setQuickNotes(demoNotes)}><Lightbulb size={18} /> Sample notes</button>
              <button className="primary" onClick={createQuickDeck} disabled={isQuickGenerating}><Sparkles size={18} /> {isQuickGenerating ? 'Creating deck...' : 'Create and study'}</button>
            </div>
            {quickStatus && <p className="status-line">{quickStatus}</p>}
          </div>
        </section>

        <section className="panel wide">
          <div className="panel-title">
            <div>
              <p>Manual start</p>
              <h2>Create an empty deck instead</h2>
            </div>
            <Layers3 size={22} />
          </div>
          <div className="create-deck-row">
            <input
              value={newDeckName}
              onChange={(event) => setNewDeckName(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && addDeck()}
              placeholder="Deck name, like Biology Midterm or Spanish 101"
            />
            <button className="primary" onClick={addDeck}><Plus size={18} /> Create empty deck</button>
          </div>
        </section>

        <section className="panel wide">
          <div className="panel-title">
            <div>
              <p>Templates</p>
              <h2>Or start from an empty deck template</h2>
            </div>
            <Layers3 size={22} />
          </div>
          <div className="template-grid">
            {deckTemplates.map((template) => (
              <button key={template.title} onClick={() => addTemplate(template)} style={{ '--deck-color': template.color }}>
                <strong>{template.title}</strong>
                <span>{template.goal}/day · {template.subject} · starter cards included</span>
              </button>
            ))}
          </div>
        </section>

        <section className="panel wide">
          <div className="panel-title">
            <div>
              <p>Restore</p>
              <h2>Bring back an existing library</h2>
            </div>
            <FileInput size={22} />
          </div>
          <div className="import-row">
            <label className="file-button"><Upload size={18} /> Restore JSON<input type="file" accept=".json" onChange={importJson} /></label>
            <button className="secondary" onClick={exportJson}><Download size={18} /> Export empty backup</button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="build-grid">
      <section className="panel feature-panel">
        <div className="panel-title">
          <div>
            <p>AI-style builder</p>
            <h2>Turn messy notes into study-ready cards</h2>
          </div>
          <Sparkles size={22} />
        </div>
        <Segmented
          value={builderMode}
          onChange={setBuilderMode}
          options={[
            { value: 'basic', label: 'Basic', icon: <BookOpen size={15} /> },
            { value: 'cloze', label: 'Cloze', icon: <Filter size={15} /> },
          ]}
        />
        <textarea value={builderText} onChange={(event) => setBuilderText(event.target.value)} placeholder="Paste lecture notes, textbook bullets, a transcript, or study guide..." />
        <div className="dual-actions">
          <button className="secondary" onClick={() => setBuilderText(demoNotes)}><Lightbulb size={18} /> Try sample notes</button>
          <button className="primary" onClick={generateCards} disabled={isGenerating}><Sparkles size={18} /> {isGenerating ? 'Generating cards...' : settings.aiEnabled && settings.aiKey ? 'Generate with AI' : 'Generate local cards'}</button>
        </div>
        {builderStatus && <p className="status-line">{builderStatus}</p>}
      </section>

      <section className="panel">
        <div className="panel-title">
          <div>
            <p>AI engine</p>
            <h2>Bring your own OpenAI key</h2>
          </div>
          <Brain size={22} />
        </div>
        <label className="toggle-row">
          <input type="checkbox" checked={settings.aiEnabled} onChange={(event) => updateSettings({ aiEnabled: event.target.checked })} />
          <span>Use AI for note-to-card generation</span>
        </label>
        <label className="toggle-row">
          <input type="checkbox" checked={settings.aiUseBackend} onChange={(event) => updateSettings({ aiUseBackend: event.target.checked })} />
          <span>Use hosted backend AI first</span>
        </label>
        <input
          value={settings.aiBackendUrl}
          onChange={(event) => updateSettings({ aiBackendUrl: event.target.value })}
          placeholder="https://your-vercel-app.vercel.app/api/generate-cards"
        />
        <input
          type="password"
          value={settings.aiKey}
          onChange={(event) => updateSettings({ aiKey: event.target.value })}
          placeholder="OpenAI API key, stored only on this device"
          autoComplete="off"
        />
        <input
          value={settings.aiModel}
          onChange={(event) => updateSettings({ aiModel: event.target.value })}
          placeholder={defaultAiModel}
        />
        <p className="hint">Hosted AI keeps OpenAI keys off user devices. If the backend is unavailable, RecallFlow can fall back to a user key or local generation.</p>
      </section>

      <section className="panel">
        <div className="panel-title">
          <div>
            <p>Manual card</p>
            <h2>Create, improve, enrich</h2>
          </div>
          <Plus size={22} />
        </div>
        <input value={newFront} onChange={(event) => setNewFront(event.target.value)} placeholder="Front / prompt, or cloze: DNA stores {{c1::genetic information}}" />
        <textarea className="short" value={newBack} onChange={(event) => setNewBack(event.target.value)} placeholder="Back / answer" />
        <input value={newHint} onChange={(event) => setNewHint(event.target.value)} placeholder="Optional hint" />
        <input value={newImageUrl} onChange={(event) => setNewImageUrl(event.target.value)} placeholder="Optional image URL" />
        <input value={newTags} onChange={(event) => setNewTags(event.target.value)} placeholder="Tags, comma separated" />
        <div className="dual-actions">
          <button className="secondary" onClick={improveDraft}><Sparkles size={18} /> Improve</button>
          <button className="primary" onClick={addCard}><Plus size={18} /> Add card</button>
        </div>
      </section>

      <section className="panel wide">
        <div className="panel-title">
          <div>
            <p>Deck management</p>
            <h2>Rename, tune, or remove this deck</h2>
          </div>
          <Settings2 size={22} />
        </div>
        <div className="deck-settings-grid">
          <input value={selectedDeck.title} onChange={(event) => updateDeckMeta(selectedDeck.id, { title: event.target.value })} placeholder="Deck name" />
          <input value={selectedDeck.subject} onChange={(event) => updateDeckMeta(selectedDeck.id, { subject: event.target.value })} placeholder="Subject" />
          <input type="number" min="1" max="200" value={selectedDeck.goal} onChange={(event) => updateDeckMeta(selectedDeck.id, { goal: Number(event.target.value) || 1 })} placeholder="Daily goal" />
          <input type="date" value={selectedDeck.examDate || ''} onChange={(event) => updateDeckMeta(selectedDeck.id, { examDate: event.target.value })} aria-label="Exam date" />
          <input type="color" value={selectedDeck.color} onChange={(event) => updateDeckMeta(selectedDeck.id, { color: event.target.value })} aria-label="Deck color" />
        </div>
        <button className="danger-button" onClick={() => deleteDeck(selectedDeck.id)}><Trash2 size={18} /> Delete deck</button>
      </section>

      <section className="panel wide">
        <div className="panel-title">
          <div>
            <p>Templates</p>
            <h2>Start with a purpose-built deck</h2>
          </div>
          <Layers3 size={22} />
        </div>
        <div className="template-grid">
          {deckTemplates.map((template) => (
            <button key={template.title} onClick={() => addTemplate(template)} style={{ '--deck-color': template.color }}>
              <strong>{template.title}</strong>
              <span>{template.goal}/day · {template.subject} · starter cards included</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel wide">
        <div className="panel-title">
          <div>
            <p>Portability</p>
            <h2>Import, restore, and backup</h2>
          </div>
          <FileInput size={22} />
        </div>
        <div className="import-row three">
          <label className="file-button"><Import size={18} /> Import CSV<input type="file" accept=".csv,.txt" onChange={importCsv} /></label>
          <label className="file-button"><Upload size={18} /> Restore JSON<input type="file" accept=".json" onChange={importJson} /></label>
          <button className="secondary" onClick={exportJson}><Download size={18} /> Export backup</button>
        </div>
        <p className="hint">CSV format: front,back,tag1|tag2,hint. Backups are plain JSON so users can leave whenever they want.</p>
      </section>
    </div>
  );
}

function CardsScreen({ query, setQuery, results, deleteCard, toggleStar, rescheduleToday, updateCard }) {
  const [editingId, setEditingId] = useState(null);

  return (
    <div className="panel">
      <div className="panel-title">
        <div>
          <p>Library</p>
          <h2>Find, save, and repair cards</h2>
        </div>
        <Search size={22} />
      </div>
      <div className="search-box">
        <Search size={18} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search, tag:bio, is:due, is:weak, is:repair, is:starred" />
      </div>
      <div className="card-list">
        {results.map((card) => (
          <article className={`card-row ${card.starred ? 'starred' : ''}`} key={`${card.deckId}-${card.id}`}>
            {editingId === card.id ? (
              <div className="edit-card-form">
                <input value={card.front} onChange={(event) => updateCard(card.deckId, card.id, { front: event.target.value })} placeholder="Front" />
                <textarea value={card.back} onChange={(event) => updateCard(card.deckId, card.id, { back: event.target.value })} placeholder="Back" />
                <input value={card.hint || ''} onChange={(event) => updateCard(card.deckId, card.id, { hint: event.target.value })} placeholder="Hint" />
                <input value={card.imageUrl || ''} onChange={(event) => updateCard(card.deckId, card.id, { imageUrl: event.target.value })} placeholder="Image URL" />
                <input value={card.tags.join(', ')} onChange={(event) => updateCard(card.deckId, card.id, { tags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) })} placeholder="Tags" />
                <button className="primary" onClick={() => setEditingId(null)}><Check size={18} /> Done editing</button>
              </div>
            ) : (
              <div>
                <strong>{visibleFront(card, false)}</strong>
                <p>{visibleBack(card, false)}</p>
                <small>{card.deckTitle} · {nextDueLabel(card)} · {card.reviews} reviews · ease {card.ease.toFixed(2)}</small>
                <div className="tag-row mini">{card.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                {!!cardQuality(card).length && (
                  <div className="quality-row">
                    {cardQuality(card).slice(0, 2).map((issue) => <span key={issue}><Lightbulb size={13} /> {issue}</span>)}
                  </div>
                )}
              </div>
            )}
            <div className="row-actions">
              <button aria-label="Edit card" onClick={() => setEditingId(editingId === card.id ? null : card.id)}><Pencil size={17} /></button>
              <button aria-label="Save card" onClick={() => toggleStar(card.deckId, card.id)}><Star size={17} /></button>
              <button aria-label="Review today" onClick={() => rescheduleToday(card.deckId, card.id)}><Clock3 size={17} /></button>
              <button aria-label="Delete card" onClick={() => deleteCard(card.deckId, card.id)}><Trash2 size={17} /></button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function StatsScreen({ decks, log, allCards, settings, backups, updateSettings, syncStatus, lastCloudSync }) {
  const logEntries = Object.entries(log).slice(-7);
  const mastered = allCards.filter((card) => card.interval >= 14).length;
  const learning = allCards.filter((card) => card.reviews > 0 && card.interval < 14).length;
  const newCards = allCards.filter((card) => card.reviews === 0).length;
  const totalReviews = allCards.reduce((sum, card) => sum + card.reviews, 0);
  const checklist = launchChecklist({ decks, allCards, settings });
  const readyCount = checklist.filter((item) => item.done).length;
  const weakestDeck = decks
    .map((deck) => ({ deck, health: deckHealth(deck) }))
    .sort((a, b) => (b.health.weak + b.health.needsRepair) - (a.health.weak + a.health.needsRepair))[0];

  return (
    <div className="stats-grid">
      <section className="panel feature-panel">
        <div className="panel-title">
          <div>
            <p>Progress</p>
            <h2>Memory pipeline</h2>
          </div>
          <BarChart3 size={22} />
        </div>
        <div className="pipeline">
          <Progress label="New" value={newCards} total={allCards.length} />
          <Progress label="Learning" value={learning} total={allCards.length} />
          <Progress label="Mastered" value={mastered} total={allCards.length} />
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">
          <div>
            <p>Last 7 days</p>
            <h2>Review volume</h2>
          </div>
          <ClipboardList size={22} />
        </div>
        <div className="bars">
          {logEntries.length ? logEntries.map(([day, count]) => (
            <div className="bar-row" key={day}>
              <span>{day.slice(5)}</span>
              <div><i style={{ width: `${Math.min(100, count * 8)}%` }} /></div>
              <strong>{count}</strong>
            </div>
          )) : <p className="hint">Review cards to start building your study history.</p>}
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">
          <div>
            <p>Reliability</p>
            <h2>Backup and iCloud sync</h2>
          </div>
          <Save size={22} />
        </div>
        <label className="toggle-row">
          <input type="checkbox" checked={settings.iCloudSync} onChange={(event) => updateSettings({ iCloudSync: event.target.checked })} />
          <span>Sync library with iCloud</span>
        </label>
        <p className="status-line">{syncStatus}{lastCloudSync ? ` Last checked ${compactDate(lastCloudSync)}.` : ''}</p>
        <div className="backup-list">
          {(backups || []).slice(0, 5).map((backup) => (
            <span key={`${backup.day}-${backup.cardCount}`}><FileJson size={15} /> {backup.day} · {backup.cardCount} cards</span>
          ))}
          {!backups?.length && <p className="hint">Backups appear here after edits.</p>}
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">
          <div>
            <p>Goal</p>
            <h2>Study system</h2>
          </div>
          <Target size={22} />
        </div>
        <div className="stat-list">
          <label className="goal-input">
            <span>Daily goal</span>
            <input type="number" min="1" max="500" value={settings.dailyGoal} onChange={(event) => updateSettings({ dailyGoal: Number(event.target.value) || 1 })} />
          </label>
          <span>Total reviews <strong>{totalReviews}</strong></span>
          <span>Saved cards <strong>{allCards.filter((card) => card.starred).length}</strong></span>
        </div>
      </section>

      <section className="panel wide feature-panel">
        <div className="panel-title">
          <div>
            <p>Study coach</p>
            <h2>{weakestDeck ? coachRecommendation(weakestDeck.deck) : 'Create a deck to unlock recommendations'}</h2>
          </div>
          <Brain size={22} />
        </div>
        <div className="health-grid">
          {decks.length ? decks.map((deck) => {
            const health = deckHealth(deck);
            const plan = examPlan(deck);
            return (
              <article key={deck.id}>
                <span style={{ background: deck.color }} />
                <div>
                  <strong>{deck.title}</strong>
                  <p>{health.score}% health · {health.due} due · {health.weak} weak · {health.needsRepair} repair</p>
                  {plan && <p>{plan.status} · target {plan.dailyTarget}/day</p>}
                </div>
              </article>
            );
          }) : <p className="hint">Starter templates now include cards, so you can test a complete study loop immediately.</p>}
        </div>
      </section>

      <section className="panel wide">
        <div className="panel-title">
          <div>
            <p>Release readiness</p>
            <h2>Privacy, support, and local data</h2>
          </div>
          <Settings2 size={22} />
        </div>
        <div className="release-grid">
          <div>
            <strong>Privacy summary</strong>
            <p>RecallFlow stores decks, cards, settings, and backups locally on this device. OpenAI is contacted only when AI generation is enabled and an API key is entered.</p>
          </div>
          <div>
            <strong>Support contact</strong>
            <input value={settings.supportEmail} onChange={(event) => updateSettings({ supportEmail: event.target.value })} placeholder="support@example.com" />
          </div>
          <div>
            <strong>Support URL</strong>
            <input value={settings.supportUrl} onChange={(event) => updateSettings({ supportUrl: event.target.value })} placeholder="https://your-free-host/support.html" />
          </div>
          <div>
            <strong>Privacy policy URL</strong>
            <input value={settings.privacyUrl} onChange={(event) => updateSettings({ privacyUrl: event.target.value })} placeholder="https://your-free-host/privacy.html" />
          </div>
          <div>
            <strong>AI disclosure</strong>
            <p>AI-generated cards should be reviewed before studying. The app falls back to local card creation if the network or model is unavailable.</p>
          </div>
          <div>
            <strong>No-domain option</strong>
            <p>Use the included public/privacy.html and public/support.html files on Vercel, Netlify, or GitHub Pages before buying a custom domain.</p>
          </div>
        </div>
      </section>

      <section className="panel wide">
        <div className="panel-title">
          <div>
            <p>Launch checklist</p>
            <h2>{readyCount}/{checklist.length} app basics ready</h2>
          </div>
          <Check size={22} />
        </div>
        <div className="checklist">
          {checklist.map((item) => (
            <article key={item.label} className={item.done ? 'done' : ''}>
              <span>{item.done ? <Check size={17} /> : <Clock3 size={17} />}</span>
              <div>
                <strong>{item.label}</strong>
                <p>{item.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel wide">
        <div className="panel-title">
          <div>
            <p>Decks</p>
            <h2>Coverage</h2>
          </div>
          <BookOpen size={22} />
        </div>
        <div className="deck-stats">
          {decks.map((deck) => (
            <article key={deck.id}>
              <span style={{ background: deck.color }} />
              <strong>{deck.title}</strong>
              <small>{deck.cards.length} cards · {deck.cards.filter(isDue).length} due · {deck.cards.filter(isWeak).length} weak · goal {deck.goal}/day{deck.examDate ? ` · exam ${compactDate(deck.examDate)}` : ''}</small>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function Progress({ label, value, total }) {
  const percent = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="progress">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="track"><i style={{ width: `${percent}%` }} /></div>
    </div>
  );
}

function EmptyState({ title, text }) {
  return (
    <div className="empty">
      <X size={24} />
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
