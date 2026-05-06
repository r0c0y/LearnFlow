import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useLessonStore } from '../store/lessonStore';
import { useAssessmentStore } from '../store/assessmentStore';
import { useSpacedRepetition } from '../hooks/useSpacedRepetition';
import { useAuthStore } from '../store/authStore';
import { authFetch } from '../utils/api';
import { ChevronRight, Play, GripVertical } from 'lucide-react';
import FolderPicker from '../components/FolderPicker';

type AssessmentType = 'mcq' | 'written' | 'coding' | 'fill_blank' | 'drag_drop' | 'math';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API = API_BASE.replace(/\/$/, '').replace(/\/api$/, '');

export default function AssessmentPage() {
    const { lessons, lessonReady } = useLessonStore();
    const { assessmentType, setAssessmentType, questions, setQuestions, submitted, setSubmitted,
        currentIndex, nextQuestion, prevQuestion, answers, setAnswer, confidence, setConfidence,
        scoreReport, setScoreReport, addHint, hintDeductions, replaceQuestion, reset,
        retakeKey, bumpRetakeKey, viewingReport, setViewingReport } = useAssessmentStore();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [hintText, setHintText] = useState('');
    const [hintLoading, setHintLoading] = useState(false);
    const [hintLevel, setHintLevel] = useState(1);
    const navigate = useNavigate();

    const lesson = lessons[0];
    const { scheduleReview } = useSpacedRepetition();

    useEffect(() => {
        if (!lesson) return;
        setLoading(true);
        (async () => {
            // Classify topic and choose a safe fallback type
            const clsRes = await fetch(`${API}/api/classify/topic`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lesson_content: JSON.stringify(lesson).slice(0, 3000) }),
            });
            const cls = await clsRes.json();
            const defaultType = (cls.primary_type || 'mcq') as AssessmentType;
            setAssessmentType(defaultType);

            // Build a richer question set with fallbacks for missing content
            const baseQuestions = lessons.flatMap((l, i) => {
                const questionText = l.assessment?.question || (l.title ? `Summarize the primary concept of ${l.title}.` : `Summarize the primary concept from this lesson section.`);
                const questionType = (l.assessment?.type as AssessmentType) || defaultType;
                const hasOptions = Array.isArray(l.assessment?.options) && l.assessment.options.length > 0;

                const item = {
                    index: i,
                    question: questionText,
                    options: hasOptions ? l.assessment?.options || [] : [],
                    type: hasOptions ? questionType : questionType === 'mcq' ? 'written' as AssessmentType : questionType,
                    difficulty: 'medium' as const,
                    correct_answer: l.assessment?.correct_answer || '',
                    rubric: l.assessment?.rubric || 'Provide a concise, accurate response.',
                    starter_code: l.exercise?.starter_code || '',
                    expected_output: '',
                };

                const extras = [] as any[];
                if (l.objectives?.length) {
                    extras.push({
                        index: lessons.length + extras.length,
                        question: `Which objective does this section support? ${l.objectives[0]}`,
                        options: [],
                        type: 'written' as AssessmentType,
                        difficulty: 'medium' as const,
                        correct_answer: '',
                        rubric: 'Use the lesson objective to answer clearly.',
                        starter_code: '',
                        expected_output: '',
                    });
                }

                return [item, ...extras];
            }).filter(q => q.question);

            const minimumCount = 5;
            const fullQuestions = [...baseQuestions];
            while (fullQuestions.length < minimumCount && lessons.length > 0) {
                const source = lessons[fullQuestions.length % lessons.length];
                fullQuestions.push({
                    index: fullQuestions.length,
                    question: source.title ? `Review: what did you learn from "${source.title}"?` : `Review the section and summarize the key point.`,
                    options: [],
                    type: 'written' as AssessmentType,
                    difficulty: 'medium' as const,
                    correct_answer: '',
                    rubric: 'Write a short, accurate summary.',
                    starter_code: '',
                    expected_output: '',
                });
            }

            // On retakes (retakeKey > 0), ask AI for fresh questions
            if (retakeKey > 0) {
                try {
                    const freshRes = await fetch(`${API}/api/assess/next`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            current_concept: lesson.title || 'General review',
                            difficulty: 'medium',
                            lesson_context: lesson.explanation?.slice(0, 1000) || JSON.stringify(lesson).slice(0, 1000),
                        }),
                    });
                    const freshData = await freshRes.json();
                    if (freshData.question) {
                        // Replace first question with AI-generated one
                        fullQuestions[0] = {
                            ...fullQuestions[0],
                            question: freshData.question,
                            options: freshData.options || [],
                            correct_answer: freshData.correct_answer || '',
                            type: (freshData.options?.length > 0 ? 'mcq' : 'written') as AssessmentType,
                        };
                    }
                } catch (_) {}
                // Shuffle question order for variety
                for (let i = fullQuestions.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [fullQuestions[i], fullQuestions[j]] = [fullQuestions[j], fullQuestions[i]];
                }
                // Re-index
                fullQuestions.forEach((q, i) => q.index = i);
            }

            setQuestions(fullQuestions);
            setLoading(false);
        })();
    }, [lesson, retakeKey]);

    const { token } = useAuthStore();

    async function saveLessonResult(score: number) {
        if (!token || !lesson) return;
        try {
            await authFetch(`${API}/api/library/save`, {
                method: 'POST',
                body: JSON.stringify({
                    lesson: {
                        id: lesson.lesson_id,
                        title: lesson.title || 'Generated lesson',
                        subdomain: null,
                        content_json: lesson,
                        blueprint_json: null,
                        assessment_json: questions,
                        score,
                        date_assessed: new Date().toISOString(),
                        iterations_needed: 0,
                        status: 'complete',
                    },
                }),
            });
        } catch (error) {
            console.warn('Failed to save lesson result:', error);
        }
    }

    // Adaptive difficulty — after each answer
    async function handleAnswer(ans: string) {
        setAnswer(currentIndex, ans);
        const isCorrect = questions[currentIndex]?.correct_answer &&
            ans.trim().toUpperCase()[0] === questions[currentIndex].correct_answer.trim().toUpperCase()[0];

        if (currentIndex < questions.length - 1) {
            const targetDiff = isCorrect ? 'hard' : 'easy';
            try {
                const res = await fetch(`${API}/api/assess/next`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ current_concept: questions[currentIndex].question, difficulty: targetDiff, lesson_context: lesson?.explanation?.slice(0, 500) }),
                });
                const data = await res.json();
                if (data.question) replaceQuestion(currentIndex + 1, { ...questions[currentIndex + 1], ...data, index: currentIndex + 1 });
            } catch (_) { }
        }
    }

    async function handleSubmit() {
        setSubmitting(true);
        try {
            // Fill in empty answers so submission always works
            const filledAnswers: Record<number, string> = {};
            questions.forEach((_, i) => {
                filledAnswers[i] = answers[i] || '(no answer provided)';
            });

            const res = await fetch(`${API}/api/assess`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lesson_id: lesson?.lesson_id,
                    answers: Object.values(filledAnswers),
                    questions: questions.map(q => ({ question: q.question, options: q.options, correct_answer: q.correct_answer })),
                    rubric: questions.map(q => q.rubric).join('; '),
                }),
            });
            const data = await res.json();
            if (!res.ok || data.error) {
                setScoreReport({ overall_score: 0, per_question: [], weak_areas: [], summary: data.error || 'Assessment scoring failed — please retry.' });
            } else {
                setScoreReport(data);
                const finalScore = Number(data.overall_score || 0);
                // Save lesson result
                await saveLessonResult(finalScore);
                // Save assessment attempt to assessments table
                try {
                    await authFetch(`${API}/api/library/assessment`, {
                        method: 'POST',
                        body: JSON.stringify({
                            lesson_id: lesson.lesson_id,
                            questions,
                            answers: filledAnswers,
                            score_report: data,
                            score: finalScore,
                        }),
                    });
                } catch (e) {
                    console.warn('Failed to save assessment attempt:', e);
                }
                try {
                    await scheduleReview(lesson.lesson_id, data.concept_scores || {});
                } catch (_) {}
            }
        } catch (err) {
            console.error('Assessment submission error:', err);
            setScoreReport({ overall_score: 0, per_question: [], weak_areas: [], summary: 'Network error — please check your connection and retry.' });
        }
        setSubmitting(false);
        setSubmitted(true);
    }

    async function getHint() {
        setHintLoading(true);
        const cost = hintLevel === 1 ? 0 : hintLevel === 2 ? 5 : 10;
        addHint(cost);
        try {
            const res = await fetch(`${API}/api/hint`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question_context: questions[currentIndex]?.question, hint_level: hintLevel }),
            });
            const data = await res.json();
            setHintText(data.hint);
            // TTS
            window.speechSynthesis.speak(new SpeechSynthesisUtterance(data.hint));
            setHintLevel(l => Math.min(l + 1, 3));
        } finally { setHintLoading(false); }
    }

    if (!lessonReady) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', flexDirection: 'column', gap: 12 }}>
            <span className="badge badge-muted" style={{ fontSize: 13 }}>Complete the lesson first</span>
            <button className="btn btn-primary" onClick={() => navigate('/lesson')}>Go to Lesson</button>
        </div>
    );

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', gap: 8, color: 'var(--text-secondary)' }}>
            <span className="animate-spin" style={{ width: 16, height: 16, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', display: 'inline-block' }} />
            Preparing your assessment...
        </div>
    );

    function handleRetake() {
        setViewingReport(null);
        reset();
        bumpRetakeKey();
    }

    // Show saved assessment report if viewing from Library
    if (viewingReport) {
        const savedReport = viewingReport.score_report_json || {};
        const savedQuestions = viewingReport.questions_json || [];
        const savedAnswers = viewingReport.answers_json || {};
        const savedScore = viewingReport.score ?? 0;
        const scoreBadge = savedScore >= 70 ? 'badge-success' : savedScore >= 50 ? 'badge-warning' : 'badge-error';

        return (
            <div style={{ maxWidth: 700, margin: '48px auto', padding: '0 24px' }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{
                        width: 72, height: 72, borderRadius: '50%', margin: '0 auto 16px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: savedScore >= 70 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                        border: `2px solid ${savedScore >= 70 ? '#22c55e' : '#ef4444'}`,
                    }}>
                        <span style={{ fontSize: 28, fontWeight: 700, color: savedScore >= 70 ? '#22c55e' : '#ef4444' }}>
                            {savedScore}%
                        </span>
                    </div>
                    <h2 className="text-h2">Assessment Report</h2>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
                        {viewingReport.date_created?.slice(0, 10)} • {savedQuestions.length} questions
                    </p>
                </div>

                {/* Questions & Answers */}
                {savedQuestions.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                        {savedQuestions.map((q: any, i: number) => {
                            const pq = savedReport.per_question?.[i];
                            const userAnswer = savedAnswers[i] || savedAnswers[String(i)] || '—';
                            const qScore = pq?.score ?? '—';
                            const qBadge = typeof qScore === 'number' ? (qScore >= 70 ? 'badge-success' : qScore >= 50 ? 'badge-warning' : 'badge-error') : 'badge-muted';

                            return (
                                <div key={i} style={{
                                    borderBottom: '1px solid var(--border)', paddingBottom: 12,
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', minWidth: 24 }}>{i + 1}.</span>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
                                                {q.question}
                                            </p>
                                            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                                                Your answer: <span style={{ color: 'var(--text-primary)' }}>{userAnswer}</span>
                                            </p>
                                            {pq?.feedback && (
                                                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '4px 0 0', fontStyle: 'italic' }}>
                                                    {pq.feedback}
                                                </p>
                                            )}
                                        </div>
                                        <span className={`badge ${qBadge}`} style={{ fontSize: 11 }}>{qScore}{typeof qScore === 'number' ? '%' : ''}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Summary */}
                {savedReport.summary && (
                    <div style={{ padding: 16, background: 'var(--bg-subtle)', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 24 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>Summary</p>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>{savedReport.summary}</p>
                    </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setViewingReport(null); navigate('/lesson'); }}>
                        Re-study Lesson
                    </button>
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleRetake}>
                        Retake Assessment
                    </button>
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                    <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setViewingReport(null); navigate('/library'); }}>
                        Back to Library
                    </button>
                    <button className="btn btn-ghost" style={{ flex: 1 }} onClick={handleRetake}>
                        New Assessment
                    </button>
                </div>
            </div>
        );
    }

    if (submitted && scoreReport) return <ScoreReport report={scoreReport} questions={questions} hintDeductions={hintDeductions} lessonId={lesson?.lesson_id || ''} onRetake={handleRetake} />;

    const q = questions[currentIndex];
    if (!q) return null;

    const questionType = q.type || assessmentType;
    const progress = ((currentIndex) / questions.length) * 100;

    return (
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px' }}>
            {/* Header */}
            <div style={{ position: 'sticky', top: 52, background: 'var(--bg-base)', borderBottom: '1px solid var(--border)', padding: '12px 0', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16, zIndex: 10 }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Question {currentIndex + 1} of {questions.length}</span>
                <div style={{ flex: 1, height: 4, background: 'var(--bg-muted)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'var(--accent)', borderRadius: 2, width: `${progress}%`, transition: 'width 300ms ease' }} />
                </div>
                <span className="badge badge-muted" style={{ fontSize: 11 }}>{q.difficulty}</span>
            </div>

            {/* Question card */}
            <div className="card" style={{ marginBottom: 16 }}>
                <span className="badge badge-muted" style={{ marginBottom: 8, display: 'inline-block' }}>Q{currentIndex + 1}</span>
                {questionType === 'fill_blank' ? (
                    <FillBlankInterface question={q} answers={answers} currentIndex={currentIndex} onAnswer={setAnswer} />
                ) : (
                    <div style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.6, margin: 0 }} className="markdown-body">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{q.question}</ReactMarkdown>
                    </div>
                )}
            </div>

            {/* Interface by type */}
            {questionType === 'mcq' && (
                <MCQInterface
                    question={q}
                    selected={answers[currentIndex]}
                    onSelect={(ans: string) => { setAnswer(currentIndex, ans); handleAnswer(ans); }}
                    onConfidence={(c: string) => setConfidence(currentIndex, c)}
                    confidence={confidence[currentIndex]}
                />
            )}
            {questionType === 'written' && (
                <WrittenInterface value={answers[currentIndex] || ''} onChange={(v: string) => setAnswer(currentIndex, v)} />
            )}
            {questionType === 'coding' && (
                <CodingInterface question={q} answer={answers[currentIndex] || q.starter_code || ''} onChange={(v: string) => setAnswer(currentIndex, v || '')} />
            )}
            {questionType === 'drag_drop' && (
                <DragDropInterface question={q} onAnswer={(v: string) => setAnswer(currentIndex, v)} />
            )}
            {questionType === 'math' && (
                <MathInterface question={q} onAnswer={(v: string) => setAnswer(currentIndex, v)} />
            )}

            {/* Nav buttons */}
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                {currentIndex > 0 && (
                    <button className="btn btn-secondary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => { prevQuestion(); setHintText(''); setHintLevel(1); }}>
                        Back
                    </button>
                )}
                {currentIndex < questions.length - 1 ? (
                    <button className="btn btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => { nextQuestion(); setHintText(''); setHintLevel(1); }} disabled={!answers[currentIndex]}>
                        Next <ChevronRight size={14} />
                    </button>
                ) : (
                    <button className="btn btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={handleSubmit} disabled={submitting}>
                        {submitting ? (
                            <><span className="animate-spin" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block' }} /> Grading...</>
                        ) : 'Submit Assessment'}
                    </button>
                )}
            </div>

            {/* Hint display */}
            {hintText && (
                <div className="card-accent animate-fade-in" style={{ marginTop: 16, fontSize: 13 }}>
                    <strong>Hint (level {hintLevel - 1}):</strong> {hintText}
                </div>
            )}

            {/* Floating voice hint button */}
            <button
                onClick={getHint}
                className={hintLoading ? 'animate-pulse-ring' : ''}
                style={{
                    position: 'fixed', bottom: 24, right: 24,
                    padding: '10px 18px', borderRadius: 24, background: 'var(--accent)', color: '#fff',
                    border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                    display: 'flex', alignItems: 'center', gap: 6,
                    boxShadow: '0 2px 12px rgba(124,58,237,0.3)', transition: 'all 150ms ease',
                }}
                aria-label="Get hint"
            >
                {hintLoading ? <span className="animate-spin" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block' }} /> : 'Hint'}
                {hintLevel > 1 ? ` (-${hintLevel === 2 ? 5 : 10} pts)` : ''}
            </button>
        </div>
    );
}

/* ─── MCQ Interface ─── */
function MCQInterface({ question, selected, onSelect, onConfidence, confidence }: any) {
    const hasOptions = Array.isArray(question.options) && question.options.length > 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {hasOptions ? question.options.map((opt: string, i: number) => {
                const isSelected = selected === opt;
                return (
                    <button key={i} onClick={() => onSelect(opt)} style={{
                        padding: '14px 16px', borderRadius: 10, textAlign: 'left', cursor: 'pointer',
                        border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                        background: isSelected ? 'var(--accent-light)' : 'var(--bg-base)',
                        color: 'var(--text-primary)',
                        display: 'flex', alignItems: 'center', gap: 12, transition: 'all 150ms ease',
                        borderLeft: isSelected ? '3px solid var(--accent)' : '1px solid var(--border)',
                    }}>
                        <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border-strong)'}`, background: isSelected ? 'var(--accent)' : 'transparent', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {isSelected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                        </div>
                        <span style={{ fontSize: 14 }}>{opt}</span>
                    </button>
                );
            }) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>No answer options were provided. Please type the best response below.</p>
                    <textarea value={selected || ''} onChange={e => onSelect(e.target.value)}
                        className="textarea" style={{ minHeight: 120, fontSize: 14, padding: 14 }} />
                </div>
            )}

            {selected && (
                <div className="animate-fade-in" style={{ marginTop: 8 }}>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>How confident are you?</p>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {['Very sure', 'Somewhat sure', 'Guessing'].map(c => (
                            <button key={c} className={`badge ${confidence === c ? 'badge-accent' : 'badge-muted'}`}
                                style={{ cursor: 'pointer', padding: '5px 12px', fontSize: 12 }} onClick={() => onConfidence(c)}>
                                {c}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─── Coding Interface ─── */
function CodingInterface({ question, answer, onChange }: any) {
    const [output, setOutput] = useState('');

    async function runCode() {
        if (!(window as any).pyodide) {
            setOutput('⌛ Pyodide is still loading... please wait a few seconds.');
            // Try to trigger init if it hasn't started
            if ((window as any).initPyodide) (window as any).initPyodide();
            return;
        }
        
        setOutput('🚀 Running...');
        try {
            // @ts-ignore
            const pyodide = (window as any).pyodide;
            // Clear previous output/variables if possible or just run
            const result = await pyodide.runPythonAsync(answer);
            setOutput(String(result ?? '(Execution complete - no output)'));
        } catch (e: any) { 
            setOutput(`❌ Error: ${e.message}`); 
        }
    }

    return (
        <div>
            <div className="card-subtle" style={{ padding: 16, marginBottom: 12, fontSize: 14 }}>{question.question}</div>
            <Editor height="320px" language="python" theme="vs-dark" value={answer} onChange={onChange}
                options={{ minimap: { enabled: false }, fontSize: 13, fontFamily: 'JetBrains Mono', scrollBeyondLastLine: false }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                <button className="btn btn-primary btn-sm" onClick={runCode} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Play size={14} /> Run</button>
                <button className="btn btn-ghost btn-sm" onClick={() => onChange(question.starter_code || '')}>Reset</button>
                {!(window as any).pyodide && (
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span className="animate-spin" style={{ width: 10, height: 10, border: '1px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%' }} />
                        Initializing Python...
                    </span>
                )}
            </div>
            <pre style={{ background: '#0F0F10', borderRadius: 8, padding: 12, fontFamily: 'JetBrains Mono', fontSize: 13, marginTop: 8, minHeight: 48, color: output.includes('Error') ? '#F87171' : output.includes('Running') ? 'var(--text-tertiary)' : '#4ADE80', whiteSpace: 'pre-wrap', border: '1px solid var(--border)' }}>
                {output || '// Run your Python code to see the output here'}
            </pre>
        </div>
    );
}

/* ─── Fill Blank Interface ─── */
function FillBlankInterface({ question, answers, currentIndex, onAnswer }: any) {
    const parts = question.question.split(/(\[___\]|_{3,})/g);
    const numBlanks = parts.filter((p: string) => p === '[___]' || p.match(/_{3,}/)).length;
    
    const currentAns = answers[currentIndex] ? answers[currentIndex].split('|') : [];
    const blanks = Array(numBlanks).fill('').map((_, i) => currentAns[i] || '');

    return (
        <div style={{ fontSize: 16, fontWeight: 500, lineHeight: 2 }}>
            {parts.map((part: string, i: number) => {
                const isBlank = part === '[___]' || part.match(/_{3,}/);
                if (!isBlank) return <span key={i}>{part}</span>;
                
                const blankIdx = parts.slice(0, i).filter((p: string) => p === '[___]' || p.match(/_{3,}/)).length;
                return (
                    <input key={i} value={blanks[blankIdx]}
                        onChange={e => { 
                            const b = [...blanks]; 
                            b[blankIdx] = e.target.value; 
                            onAnswer(currentIndex, b.join('|')); 
                        }}
                        style={{ borderBottom: '2px solid var(--accent)', borderTop: 'none', borderLeft: 'none', borderRight: 'none', background: 'transparent', outline: 'none', minWidth: 100, textAlign: 'center', fontFamily: 'JetBrains Mono', fontSize: 14, color: 'var(--accent)', padding: '0 4px', margin: '0 4px' }} />
                );
            })}
        </div>
    );
}

/* ─── Drag Drop Interface ─── */
function DragDropInterface({ question, onAnswer }: any) {
    type DragItem = { id: string; label: string };
    const items: DragItem[] = question.options?.map((o: string, i: number) => ({ id: String(i), label: o })) || [];
    const [order, setOrder] = useState<DragItem[]>(items);

    function handleDragEnd(event: any) {
        const { active, over } = event;
        if (active.id !== over?.id) {
            setOrder((o: DragItem[]) => {
                const oldIdx = o.findIndex((i: DragItem) => i.id === active.id);
                const newIdx = o.findIndex((i: DragItem) => i.id === over.id);
                const newOrder = arrayMove(o, oldIdx, newIdx);
                onAnswer(newOrder.map((i: DragItem) => i.label).join('|'));
                return newOrder;
            });
        }
    }

    return (
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={order.map((i: DragItem) => i.id)} strategy={verticalListSortingStrategy}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {order.map((item: DragItem, idx: number) => <SortableItem key={item.id} id={item.id} idx={idx + 1} label={item.label} />)}
                </div>
            </SortableContext>
        </DndContext>
    );
}

function SortableItem({ id, idx, label }: { id: string; idx: number; label: string }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
    return (
        <div ref={setNodeRef} {...attributes} {...listeners}
            style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-base)', cursor: 'grab', display: 'flex', alignItems: 'center', gap: 12, transform: CSS.Transform.toString(transform), transition }}>
            <span className="badge badge-muted">{idx}</span>
            <span style={{ fontSize: 14 }}>{label}</span>
            <GripVertical size={16} color="var(--text-tertiary)" style={{ marginLeft: 'auto' }} />
        </div>
    );
}

/* ─── Written Interface ─── */
function WrittenInterface({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
        <div>
            <textarea className="textarea" style={{ minHeight: 160 }} value={value} onChange={e => onChange(e.target.value)} placeholder="Write your answer here..." />
            <p className="text-small" style={{ color: 'var(--text-tertiary)', marginTop: 4 }}>{value.split(' ').filter(Boolean).length} words</p>
        </div>
    );
}

/* ─── Math Interface ─── */
function MathInterface({ question, onAnswer }: { question: any; onAnswer: (v: string) => void }) {
    const [answer, setAnswer] = useState('');
    const [showSolution, setShowSolution] = useState(false);

    return (
        <div>
            <div className="card-subtle" style={{ padding: 16, marginBottom: 12 }}>
                <p style={{ fontSize: 16, marginBottom: 12 }}>{question.question}</p>
                {question.question.includes('$') && <BlockMath math={question.question.replace(/\$/g, '')} />}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input className="input" placeholder="Enter your answer..." value={answer} onChange={e => { setAnswer(e.target.value); onAnswer(e.target.value); }} />
                {answer && <InlineMath math={answer} />}
            </div>
            {question.correct_answer && (
                <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setShowSolution(!showSolution)}>
                    {showSolution ? 'Hide' : 'Show'} Solution
                </button>
            )}
            {showSolution && (
                <div className="card-accent animate-fade-in" style={{ marginTop: 8 }}>
                    <strong>Solution:</strong> <InlineMath math={question.correct_answer} />
                </div>
            )}
        </div>
    );
}

/* ─── Score Report ─── */
function ScoreReport({ report, questions, hintDeductions, lessonId, onRetake }: any) {
    const navigate = useNavigate();
    const finalScore = Math.max(0, (Number(report.overall_score) || 0) - (Number(hintDeductions) || 0));
    const passed = finalScore >= 70;

    return (
        <div style={{ maxWidth: 700, margin: '48px auto', padding: '0 24px' }}>
            {/* Header Dashboard */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
                <div style={{ flex: 1, background: passed ? 'var(--success-light)' : 'var(--error-light)', border: passed ? '1px solid var(--success)' : '1px solid var(--error)', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <p style={{ fontSize: 13, color: passed ? 'var(--success)' : 'var(--error)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, marginBottom: 4 }}>Assessment Score</p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <h2 style={{ fontSize: 48, fontWeight: 700, color: passed ? 'var(--success)' : 'var(--error)', lineHeight: 1 }}>{finalScore}</h2>
                        <span style={{ fontSize: 16, color: passed ? 'var(--success)' : 'var(--error)', opacity: 0.8 }}>/ 100</span>
                    </div>
                    <p style={{ marginTop: 12, fontSize: 14, color: passed ? 'var(--success)' : 'var(--error)', opacity: 0.9 }}>{passed ? 'Strong performance. Ready to move forward.' : 'Review recommended before proceeding.'}</p>
                </div>
                <div style={{ flex: 1, background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, marginBottom: 4 }}>Adjustments</p>
                    <h2 style={{ fontSize: 32, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1 }}>-{hintDeductions} pts</h2>
                    <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>Used hints during assessment.</p>
                </div>
            </div>

            {/* Weak areas */}
            {report.weak_areas?.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                    <p className="text-label" style={{ color: 'var(--text-tertiary)', marginBottom: 8 }}>Areas to review</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {report.weak_areas.map((a: string, i: number) => <span key={i} className="badge badge-error">{a}</span>)}
                    </div>
                </div>
            )}

            {/* Per-question breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                {report.per_question?.map((q: any, i: number) => (
                    <div key={i} style={{ borderBottom: '1px solid var(--border)', padding: '16px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', paddingTop: 2 }}>{i + 1}.</span>
                            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', flex: 1, lineHeight: 1.5 }}>
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{questions[i]?.question}</ReactMarkdown>
                            </span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: q.correct ? 'var(--success)' : 'var(--error)' }}>
                                {q.correct ? 'Correct' : 'Incorrect'}
                            </span>
                        </div>
                        {!q.correct && (
                            <div style={{ marginTop: 12, marginLeft: 24, padding: 12, background: 'var(--bg-subtle)', borderRadius: 8, border: '1px solid var(--border)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                                        You answered: <span style={{ color: 'var(--text-primary)' }}>{q.student_answer}</span>
                                    </p>
                                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                                        Correct answer: <span style={{ color: 'var(--success)', fontWeight: 600 }}>{q.correct_answer}</span>
                                    </p>
                                </div>
                                {q.explanation && (
                                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 10, margin: '10px 0 0 0', fontStyle: 'italic' }}>
                                        {q.explanation}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Spaced repetition */}
            <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--accent)', borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
                <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Recommended Review Schedule</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {report.weak_areas?.map((a: string, i: number) => {
                        const days = finalScore < 50 ? 1 : finalScore <= 75 ? 3 : 7;
                        return (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border)' }}>
                                <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{a}</span>
                                <span className="badge badge-accent">Review in {days} day{days > 1 ? 's' : ''}</span>
                            </div>
                        );
                    })}
                    {(!report.weak_areas || report.weak_areas.length === 0) && (
                        <div style={{ padding: '10px 14px', background: 'var(--bg-base)', borderRadius: 8, border: '1px dashed var(--border)', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            <span style={{ fontSize: 13 }}>No immediate reviews needed. Great job!</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Actions */}
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => navigate('/lesson')}>Re-study sections</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={onRetake}>Retake assessment</button>
            </div>

            {/* Subtle Folder Organization */}
            <div style={{ marginTop: 32, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 500 }}>Organize this lesson?</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate('/library')}>
                        View in Library
                    </button>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.015)', borderRadius: 12, padding: '4px 12px', border: '1px solid var(--border)' }}>
                    <FolderPicker lessonId={lessonId} />
                </div>
            </div>
        </div>
    );
}
