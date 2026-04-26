import React from 'react';

export function Spinner({ size = 16 }: { size?: number }) {
    return (
        <span
            className="animate-spin"
            style={{
                width: size,
                height: size,
                border: `${size / 4}px solid var(--border)`,
                borderTopColor: 'var(--accent)',
                borderRadius: '50%',
                display: 'inline-block',
            }}
        />
    );
}

export function ErrorMessage({ error, onRetry }: { error: string; onRetry?: () => void }) {
    return (
        <div className="card-accent" style={{ borderColor: 'var(--error)', background: 'rgba(239, 68, 68, 0.1)' }}>
            <strong>Error:</strong> {error}
            {onRetry && (
                <button className="btn btn-secondary" onClick={onRetry} style={{ marginTop: 8 }}>
                    Try Again
                </button>
            )}
        </div>
    );
}