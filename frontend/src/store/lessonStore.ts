import { create } from 'zustand';

export type InputType = 'prompt' | 'url' | 'text' | 'file' | 'youtube';
export type Framework = 'gagne' | 'merrill';
export type LearnerLevel = 'beginner' | 'intermediate' | 'expert';
export type PipelineStatus =
    | 'idle' | 'ingesting' | 'chunking' | 'architect' | 'content'
    | 'testing' | 'refining' | 'complete' | 'failed';

export interface LessonContent {
    lesson_id: string;
    title: string;
    hook: string;
    objectives: string[];
    prior_knowledge_check: string;
    explanation: string;
    worked_example: { setup: string; code: string; walkthrough: string };
    exercise: { instructions: string; starter_code: string; hints: string[]; solution?: string };
    assessment: { type: string; question: string; options: string[]; correct_answer?: string; rubric?: string };
    review_needed?: boolean;
}

export interface Chunk { id: string; text: string; index: number; }

interface LessonStore {
    // Input
    inputType: InputType;
    inputContent: string;
    framework: Framework;
    learnerLevel: LearnerLevel;

    // Pipeline
    status: PipelineStatus;
    stageMessage: string;
    progress: number; // 0-100
    chunks: Chunk[];

    // Pre-lesson
    priorKnowledge: { known: string[]; gaps: string[] };
    prerequisites: Array<{ concept: string; importance: string; definition: string }>;
    advisorResult: {
        topic_name: string;
        complexity_level: string;
        recommended_framework: string;
        estimated_minutes: number;
        is_too_broad: boolean;
        focused_angles: string[];
    } | null;

    // Lesson
    lessons: LessonContent[];
    currentLessonIndex: number;
    currentSectionId: string | null;
    lessonId: string | null;
    lessonReady: boolean;

    // Actions
    setInputType: (t: InputType) => void;
    setInputContent: (c: string) => void;
    setFramework: (f: Framework) => void;
    setLearnerLevel: (l: LearnerLevel) => void;
    setStatus: (s: PipelineStatus, message?: string) => void;
    setProgress: (n: number) => void;
    setChunks: (c: Chunk[]) => void;
    setPriorKnowledge: (pk: { known: string[]; gaps: string[] }) => void;
    setPrerequisites: (p: any[]) => void;
    setAdvisorResult: (r: any) => void;
    setLessons: (l: LessonContent[]) => void;
    setCurrentLessonIndex: (i: number) => void;
    setCurrentSectionId: (id: string | null) => void;
    setLessonId: (id: string) => void;
    setLessonReady: (v: boolean) => void;
    reset: () => void;
}

export const useLessonStore = create<LessonStore>((set) => ({
    inputType: 'prompt',
    inputContent: '',
    framework: 'gagne',
    learnerLevel: 'beginner',
    status: 'idle',
    stageMessage: '',
    progress: 0,
    chunks: [],
    priorKnowledge: { known: [], gaps: [] },
    prerequisites: [],
    advisorResult: null,
    lessons: [],
    currentLessonIndex: 0,
    currentSectionId: null,
    lessonId: null,
    lessonReady: false,

    setInputType: (inputType) => set({ inputType }),
    setInputContent: (inputContent) => set({ inputContent }),
    setFramework: (framework) => set({ framework }),
    setLearnerLevel: (learnerLevel) => set({ learnerLevel }),
    setStatus: (status, stageMessage = '') => set({ status, stageMessage }),
    setProgress: (progress) => set({ progress }),
    setChunks: (chunks) => set({ chunks }),
    setPriorKnowledge: (priorKnowledge) => set({ priorKnowledge }),
    setPrerequisites: (prerequisites) => set({ prerequisites }),
    setAdvisorResult: (advisorResult) => set({ advisorResult }),
    setLessons: (lessons) => set({ lessons }),
    setCurrentLessonIndex: (currentLessonIndex) => set({ currentLessonIndex }),
    setCurrentSectionId: (currentSectionId) => set({ currentSectionId }),
    setLessonId: (lessonId) => set({ lessonId }),
    setLessonReady: (lessonReady) => set({ lessonReady }),
    reset: () => set({
        status: 'idle', stageMessage: '', progress: 0, chunks: [],
        lessons: [], lessonId: null, lessonReady: false,
        currentLessonIndex: 0, currentSectionId: null,
    }),
}));
