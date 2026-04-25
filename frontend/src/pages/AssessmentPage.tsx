import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useLessonStore } from '../store/lessonStore';
import { useAssessmentStore } from '../store/assessmentStore';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const AGENT = import.meta.env.VITE_AGENT_URL || 'http://localhost:8000';

export default function AssessmentPage() {
    const { lessons, lessonReady } = useLessonStore();
    const { assessmentType, setAssessmentType, questions, setQuestions, submitted, setSubmitted,
        currentIndex, nextQuestion, answers, setAnswer, confidence, setConfidence,
        scoreReport, setScoreReport, addHint, hintDeductions, replaceQuestion } = useAssessmentStore();
    const [loading, setLoading] = useState(true);
    const [hintText, setHintText] = useState('');
    const [hintLoading, setHintLoading] = useState(false);
    const [hintLevel, setHintLevel] = useState(1);
    const navigate = useNavigate();

    const lesson = lessons[0];

    useEffect(() => {
        if (!lesson) return;
        (async () => {
            // Classify topic
            const clsRes = await fetch(`${AGENT}/classify/topic`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lesson_content: JSON.stringify(lesson).slice(0, 3000) }),
            });
            const cls = await clsRes.json();
            setAssessmentType(cls.primary_type || 'mcq');

            // Build questions from lessons
            const qs = lessons.map((l, i) => ({
                index: i,
                question: l.assessment?.question || '',
                options: l.assessment?.options || [],
                type: cls.primary_type || 'mcq',
                difficulty: 'medium' as const,
                correct_answer: l.assessment?.correct_answer,
                rubric: l.assessment?.rubric,
                starter_code: l.exercise?.starter_code || '',
                expected_output: '',
            })).filter(q => q.question);
            setQuestions(qs);
            setLoading(false);
        })();
    }, [lesson]);

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
        const res = await fetch(`${API}/api/assess`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                lesson_id: lesson?.lesson_id,
                answers: Object.values(answers),
                questions: questions.map(q => ({ question: q.question, options: q.options, correct_answer: q.correct_answer })),
                rubric: questions.map(q => q.rubric).join('; '),
            }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
            setScoreReport({ overall_score: 0, per_question: [], weak_areas: [], summary: data.error || 'Assessment scoring failed — please retry.' });
        } else {
            setScoreReport(data);
        }
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
            <span className="badge badge-muted" style={{ fontSize: 13 }}>🔒 Complete the lesson first</span>
            <button className="btn btn-primary" onClick={() => navigate('/lesson')}>Go to Lesson</button>
        </div>
    );

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', gap: 8, color: 'var(--text-secondary)' }}>
            <span className="animate-spin" style={{ width: 16, height: 16, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', display: 'inline-block' }} />
            Preparing your assessment...
        </div>
    );

    if (submitted && scoreReport) return <ScoreReport report={scoreReport} questions={questions} hintDeductions={hintDeductions} />;

    const q = questions[currentIndex];
    if (!q) return null;

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
                <p style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.6 }}>{q.question}</p>
            </div>

            {/* Interface by type */}
            {assessmentType === 'mcq' && (
                <MCQInterface question={q} selected={answers[currentIndex]} onSelect={(ans: string) => { setAnswer(currentIndex, ans); handleAnswer(ans); }} onConfidence={(c: string) => setConfidence(currentIndex, c)} confidence={confidence[currentIndex]} />
            )}
            {assessmentType === 'coding' && (
                <CodingInterface question={q} answer={answers[currentIndex] || q.starter_code || ''} onChange={(v: string) => setAnswer(currentIndex, v || '')} />
            )}
            {assessmentType === 'fill_blank' && (
                <FillBlankInterface question={q} answers={answers} currentIndex={currentIndex} onAnswer={setAnswer} />
            )}
            {assessmentType === 'drag_drop' && (
                <DragDropInterface question={q} onAnswer={(v: string) => setAnswer(currentIndex, v)} />
            )}
            {assessmentType === 'written' && (
                <WrittenInterface value={answers[currentIndex] || ''} onChange={(v: string) => setAnswer(currentIndex, v)} />
            )}

            {/* Nav buttons */}
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                {currentIndex < questions.length - 1 ? (
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { nextQuestion(); setHintText(''); setHintLevel(1); }} disabled={!answers[currentIndex]}>
                        Next →
                    </button>
                ) : (
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSubmit} disabled={!answers[currentIndex]}>
                        Submit Assessment
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
                {hintLoading ? <span className="animate-spin" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block' }} /> : '🎤'}
                Hint {hintLevel > 1 ? `(-${hintLevel === 2 ? 5 : 10}pts)` : ''}
            </button>
        </div>
    );
}

/* ─── MCQ Interface ─── */
function MCQInterface({ question, selected, onSelect, onConfidence, confidence }: any) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {question.options.map((opt: string, i: number) => {
                const isSelected = selected === opt;
                return (
                    <button key={i} onClick={() => onSelect(opt)} style={{
                        padding: '14px 16px', borderRadius: 10, textAlign: 'left', cursor: 'pointer',
                        border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                        background: isSelected ? 'var(--accent-light)' : 'var(--bg-base)',
                        display: 'flex', alignItems: 'center', gap: 12, transition: 'all 150ms ease',
                        borderLeft: isSelected ? '3px solid var(--accent)' : '1px solid var(--border)',
                    }}>
                        <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border-strong)'}`, background: isSelected ? 'var(--accent)' : 'transparent', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {isSelected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                        </div>
                        <span style={{ fontSize: 14 }}>{opt}</span>
                    </button>
                );
            })}

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
        setOutput('Running...');
        try {
            // @ts-ignore
            if ((window as any).pyodide) {
                const result = await (window as any).pyodide.runPythonAsync(answer);
                setOutput(String(result ?? '(no output)'));
            } else { setOutput('Run Python locally — Pyodide loading...'); }
        } catch (e: any) { setOutput(`Error: ${e.message}`); }
    }

    return (
        <div>
            <div className="card-subtle" style={{ padding: 16, marginBottom: 12, fontSize: 14 }}>{question.question}</div>
            <Editor height="320px" language="python" theme="vs-dark" value={answer} onChange={onChange}
                options={{ minimap: { enabled: false }, fontSize: 13, fontFamily: 'JetBrains Mono', scrollBeyondLastLine: false }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={runCode}>▶ Run</button>
                <button className="btn btn-ghost btn-sm" onClick={() => onChange(question.starter_code || '')}>Reset</button>
            </div>
            <pre style={{ background: '#0F0F10', borderRadius: 8, padding: 12, fontFamily: 'JetBrains Mono', fontSize: 13, marginTop: 8, minHeight: 48, color: output.startsWith('Error') ? '#F87171' : '#4ADE80' }}>
                {output || '// Run your code to see output'}
            </pre>
        </div>
    );
}

/* ─── Fill Blank Interface ─── */
function FillBlankInterface({ question, answers, currentIndex, onAnswer }: any) {
    const parts = question.question.split(/(\[___\])/g);
    const [blanks, setBlanks] = useState<string[]>(Array(parts.filter((p: string) => p === '[___]').length).fill(''));
    return (
        <div style={{ fontSize: 14, lineHeight: 2 }}>
            {parts.map((part: string, i: number) => {
                if (part !== '[___]') return <span key={i}>{part}</span>;
                const blankIdx = parts.slice(0, i).filter((p: string) => p === '[___]').length;
                return (
                    <input key={i} value={blanks[blankIdx]}
                        onChange={e => { const b = [...blanks]; b[blankIdx] = e.target.value; setBlanks(b); onAnswer(currentIndex, b.join('|')); }}
                        style={{ borderBottom: '2px solid var(--accent)', background: 'transparent', outline: 'none', minWidth: 80, textAlign: 'center', fontFamily: 'JetBrains Mono', fontSize: 13, color: 'var(--accent)', padding: '0 4px' }} />
                );
            })}
        </div>
    );
}

/* ─── Drag Drop Interface ─── */
function DragDropInterface({ question, onAnswer }: any) {
    const items = question.options?.map((o: string, i: number) => ({ id: String(i), label: o })) || [];
    const [order, setOrder] = useState(items);

    function handleDragEnd(event: any) {
        const { active, over } = event;
        if (active.id !== over?.id) {
            setOrder((o: typeof items) => {
                const oldIdx = o.findIndex((i: typeof items[0]) => i.id === active.id);
                const newIdx = o.findIndex((i: typeof items[0]) => i.id === over.id);
                const newOrder = arrayMove(o, oldIdx, newIdx);
                onAnswer(newOrder.map((i: typeof items[0]) => i.label).join('|'));
                return newOrder;
            });
        }
    }

    return (
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={order.map(i => i.id)} strategy={verticalListSortingStrategy}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {order.map((item, idx) => <SortableItem key={item.id} id={item.id} idx={idx + 1} label={item.label} />)}
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
            <span style={{ marginLeft: 'auto', color: 'var(--text-tertiary)' }}>⠿</span>
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

/* ─── Score Report ─── */
function ScoreReport({ report, questions, hintDeductions }: any) {
    const navigate = useNavigate();
    const finalScore = Math.max(0, (Number(report.overall_score) || 0) - (Number(hintDeductions) || 0));
    const passed = finalScore >= 70;

    // Animated ring
    const r = 40, c = 2 * Math.PI * r;
    const offset = c - (finalScore / 100) * c;

    return (
        <div style={{ maxWidth: 600, margin: '48px auto', padding: '0 24px' }}>
            {/* Score ring */}
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <svg width="96" height="96" viewBox="0 0 96 96" style={{ display: 'block', margin: '0 auto 16px' }}>
                    <circle cx="48" cy="48" r={r} fill="none" stroke="var(--bg-muted)" strokeWidth="6" />
                    <circle cx="48" cy="48" r={r} fill="none" stroke={passed ? 'var(--success)' : 'var(--error)'} strokeWidth="6"
                        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
                        transform="rotate(-90 48 48)"
                        style={{ transition: 'stroke-dashoffset 800ms ease-out' }} />
                    <text x="48" y="54" textAnchor="middle" fontSize="22" fontWeight="700" fill={passed ? 'var(--success)' : 'var(--error)'}>{finalScore}</text>
                </svg>
                <h2 className="text-h2">{passed ? '🎉 Great job!' : 'Keep practicing'}</h2>
                <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{report.overall_score} points · -{hintDeductions} hint deductions</p>
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
                    <div key={i} className="card" style={{ borderLeft: `3px solid ${q.correct ? 'var(--success)' : 'var(--error)'}`, padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="badge badge-muted">Q{i + 1}</span>
                            <span style={{ fontSize: 13, fontWeight: 500 }}>{questions[i]?.question?.slice(0, 60)}...</span>
                            <span style={{ marginLeft: 'auto' }}>{q.correct ? '✅' : '❌'}</span>
                        </div>
                        {!q.correct && (
                            <div style={{ marginTop: 8 }}>
                                <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>You: <em>{q.student_answer}</em> · Correct: <strong>{q.correct_answer}</strong></p>
                                {q.explanation && (
                                    <div style={{ background: 'var(--warning-light)', borderLeft: '3px solid var(--warning)', borderRadius: 6, padding: '8px 12px', marginTop: 6, fontSize: 12 }}>
                                        {q.explanation}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Spaced repetition */}
            <div className="card-accent" style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>📅 Recommended review schedule</p>
                {report.weak_areas?.map((a: string, i: number) => {
                    const days = finalScore < 50 ? 1 : finalScore <= 75 ? 3 : 7;
                    return <p key={i} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>● {a} — review in {days} day{days > 1 ? 's' : ''}</p>;
                })}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => navigate('/lesson')}>Re-study sections</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => window.location.reload()}>Retake assessment</button>
            </div>
            <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => navigate('/library')}>
                Save to library
            </button>
        </div>
    );
}
