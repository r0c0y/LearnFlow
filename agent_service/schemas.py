import json
from typing import Any
from pydantic import BaseModel, Field


class FrameworkEvent(BaseModel):
    gain_attention: str = ""
    objectives: list[str] = Field(default_factory=list)
    prior_recall: str = ""
    content_chunks: list[str] = Field(default_factory=list)
    guided_example: str = ""
    exercise: dict[str, Any] = Field(default_factory=dict)
    feedback_rubric: str = ""
    assessment: dict[str, Any] = Field(default_factory=dict)
    real_world: str = ""


class BlueprintLesson(BaseModel):
    lesson_id: str
    title: str
    framework_events: FrameworkEvent = Field(default_factory=FrameworkEvent)


class Blueprint(BaseModel):
    lessons: list[BlueprintLesson] = Field(default_factory=list)


class WorkedExample(BaseModel):
    setup: str = ""
    code: str = ""
    walkthrough: str = ""


class Exercise(BaseModel):
    instructions: str = ""
    starter_code: str = ""
    hints: list[str] = Field(default_factory=list)
    solution: str = ""


class Assessment(BaseModel):
    type: str = "mcq"
    question: str = ""
    options: list[str] = Field(default_factory=list)
    correct_answer: str = ""
    rubric: str = ""


class LessonContent(BaseModel):
    lesson_id: str
    title: str
    hook: str = ""
    objectives: list[str] = Field(default_factory=list)
    prior_knowledge_check: str = ""
    explanation: str = ""
    worked_example: WorkedExample = Field(default_factory=WorkedExample)
    exercise: Exercise = Field(default_factory=Exercise)
    assessment: Assessment = Field(default_factory=Assessment)


class StudentResult(BaseModel):
    exercise_attempt: str = ""
    assessment_answer: str = ""
    confidence_score: int = 5
    confusion_points: list[str] = Field(default_factory=list)


class EvaluatorOutput(BaseModel):
    lesson_id: str
    passed: bool
    score: int = 0
    errors: list[str] = Field(default_factory=list)
    missing_concepts: list[str] = Field(default_factory=list)


class PipelineState(BaseModel):
    raw_input: dict[str, Any] = Field(default_factory=dict)
    chunks: list[dict[str, Any]] = Field(default_factory=list)
    framework: str = "gagne"
    learner_level: str = "beginner"
    prior_knowledge: dict[str, Any] = Field(default_factory=dict)
    blueprint: dict[str, Any] = Field(default_factory=dict)
    lessons: list[dict[str, Any]] = Field(default_factory=list)
    student_results: list[dict[str, Any]] = Field(default_factory=list)
    failure_logs: list[dict[str, Any]] = Field(default_factory=list)
    iteration: int = 0
    max_iterations: int = 3
    status: str = "idle"
    assessment_type: str = "mcq"
    assessment_results: dict[str, Any] = Field(default_factory=dict)
    saved_lessons: list[Any] = Field(default_factory=list)
