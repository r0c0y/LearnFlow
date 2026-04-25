import { create } from 'zustand';

export type AssessmentType = 'mcq' | 'coding' | 'fill_blank' | 'drag_drop' | 'written' | 'math';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Question {
    index: number;
    question: string;
    options: string[];
    type: AssessmentType;
    difficulty: Difficulty;
    correct_answer?: string;
    rubric?: string;
    starter_code?: string;
    expected_output?: string;
}

export interface QuestionResult {
    question_index: number;
    correct: boolean;
    student_answer: string;
    correct_answer: string;
    explanation: string;
    score: number;
}

interface AssessmentStore {
    assessmentType: AssessmentType;
    questions: Question[];
    currentIndex: number;
    answers: Record<number, string>;
    confidence: Record<number, string>;
    hintsUsed: number;
    hintDeductions: number;
    scoreReport: {
        overall_score: number;
        per_question: QuestionResult[];
        weak_areas: string[];
        summary: string;
    } | null;
    submitted: boolean;

    setAssessmentType: (t: AssessmentType) => void;
    setQuestions: (q: Question[]) => void;
    nextQuestion: () => void;
    setAnswer: (idx: number, ans: string) => void;
    setConfidence: (idx: number, conf: string) => void;
    addHint: (deduction: number) => void;
    setScoreReport: (r: any) => void;
    setSubmitted: (v: boolean) => void;
    replaceQuestion: (idx: number, q: Question) => void;
    reset: () => void;
}

export const useAssessmentStore = create<AssessmentStore>((set) => ({
    assessmentType: 'mcq',
    questions: [],
    currentIndex: 0,
    answers: {},
    confidence: {},
    hintsUsed: 0,
    hintDeductions: 0,
    scoreReport: null,
    submitted: false,

    setAssessmentType: (assessmentType) => set({ assessmentType }),
    setQuestions: (questions) => set({ questions }),
    nextQuestion: () => set((s) => ({ currentIndex: Math.min(s.currentIndex + 1, s.questions.length - 1) })),
    setAnswer: (idx, ans) => set((s) => ({ answers: { ...s.answers, [idx]: ans } })),
    setConfidence: (idx, conf) => set((s) => ({ confidence: { ...s.confidence, [idx]: conf } })),
    addHint: (deduction) => set((s) => ({ hintsUsed: s.hintsUsed + 1, hintDeductions: s.hintDeductions + deduction })),
    setScoreReport: (scoreReport) => set({ scoreReport }),
    setSubmitted: (submitted) => set({ submitted }),
    replaceQuestion: (idx, q) => set((s) => {
        const qs = [...s.questions];
        qs[idx] = q;
        return { questions: qs };
    }),
    reset: () => set({
        questions: [], currentIndex: 0, answers: {}, confidence: {},
        hintsUsed: 0, hintDeductions: 0, scoreReport: null, submitted: false,
    }),
}));
