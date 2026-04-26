import { useCallback } from 'react';

const API = import.meta.env.VITE_API_URL || '';

/**
 * Calculate review date offset (days) based on score.
 * < 50% → 1 day, 50-75% → 3 days, > 75% → 7 days
 */
export function reviewDaysFromScore(score: number): number {
    if (score < 50) return 1;
    if (score <= 75) return 3;
    return 7;
}

export function useSpacedRepetition() {
    const scheduleReview = useCallback(async (lessonId: string, conceptScores: Record<string, number>) => {
        const reviews = Object.entries(conceptScores).map(([concept, score]) => {
            const days = reviewDaysFromScore(score);
            const reviewDate = new Date();
            reviewDate.setDate(reviewDate.getDate() + days);
            return {
                lesson_id: lessonId,
                concept,
                score,
                review_date: reviewDate.toISOString().split('T')[0],
                days_until_review: days,
            };
        });

        // POST each review to backend
        for (const review of reviews) {
            try {
                await fetch(`${API}/api/reviews/schedule`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(review),
                });
            } catch (_) { /* silent */ }
        }

        return reviews;
    }, []);

    const checkDueReviews = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/reviews/due`);
            const data = await res.json();
            return data.due || [];
        } catch {
            return [];
        }
    }, []);

    return { scheduleReview, checkDueReviews, reviewDaysFromScore };
}
