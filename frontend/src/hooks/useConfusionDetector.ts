import { useEffect, useRef, useState } from 'react';

interface ConfusionState {
    triggered: boolean;
    timeOnSection: number;
    explainClicks: number;
}

export function useConfusionDetector(sectionId: string, timeThreshold = 240) {
    const [state, setState] = useState<ConfusionState>({
        triggered: false,
        timeOnSection: 0,
        explainClicks: 0,
    });
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeRef = useRef<number>(Date.now());

    // Reset when section changes
    useEffect(() => {
        startTimeRef.current = Date.now();
        setState({ triggered: false, timeOnSection: 0, explainClicks: 0 });

        intervalRef.current = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
            setState((prev) => {
                const next = { ...prev, timeOnSection: elapsed };
                if ((elapsed > timeThreshold || prev.explainClicks > 2) && !prev.triggered) {
                    next.triggered = true;
                }
                return next;
            });
        }, 1000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [sectionId, timeThreshold]);

    const recordExplainClick = () => {
        setState((prev) => {
            const next = { ...prev, explainClicks: prev.explainClicks + 1 };
            if (next.explainClicks > 2) next.triggered = true;
            return next;
        });
    };

    const dismiss = () => {
        setState((prev) => ({ ...prev, triggered: false }));
        startTimeRef.current = Date.now();
    };

    const reset = () => {
        startTimeRef.current = Date.now();
        setState({ triggered: false, timeOnSection: 0, explainClicks: 0 });
    };

    return { ...state, recordExplainClick, dismiss, reset };
}
