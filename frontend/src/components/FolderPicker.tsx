import { useState, useEffect } from 'react';
import { authFetch } from '../utils/api';
import { Folder, Plus, Check } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

interface FolderOption {
    id: string;
    name: string;
}

interface FolderPickerProps {
    lessonId: string;
    currentFolderId?: string | null;
    onSaved?: (folderId: string) => void;
}

export default function FolderPicker({ lessonId, currentFolderId, onSaved }: FolderPickerProps) {
    const [folders, setFolders] = useState<FolderOption[]>([]);
    const [selected, setSelected] = useState(currentFolderId || '');
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        authFetch(`${API}/api/library`)
            .then(r => r.json())
            .then(data => {
                const flatFolders = flattenFolders(data.folders || []);
                setFolders(flatFolders);
                // Find current folder of this lesson
                const lesson = (data.lessons || []).find((l: any) => l.id === lessonId);
                if (lesson?.folder_id && !selected) {
                    setSelected(lesson.folder_id);
                }
            })
            .catch(console.warn);
    }, []);

    function flattenFolders(tree: any[], result: FolderOption[] = []): FolderOption[] {
        for (const f of tree) {
            result.push({ id: f.id, name: f.name });
            if (f.children?.length) flattenFolders(f.children, result);
        }
        return result;
    }

    async function handleSave() {
        if (!selected) return;
        try {
            await authFetch(`${API}/api/library/lesson/${lessonId}/folder`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folder_id: selected }),
            });
            setSaved(true);
            onSaved?.(selected);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.warn('Failed to move lesson to folder:', err);
        }
    }

    async function handleCreateFolder() {
        if (!newName.trim()) return;
        try {
            const res = await authFetch(`${API}/api/library/folder`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName.trim() }),
            });
            const newFolder = await res.json();
            setFolders(prev => [...prev, { id: newFolder.id, name: newFolder.name }]);
            setSelected(newFolder.id);
            setNewName('');
            setCreating(false);
        } catch (err) {
            console.warn('Failed to create folder:', err);
        }
    }

    return (
        <div style={{
            background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 12,
            padding: 16, marginTop: 16,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Folder size={16} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Save to folder</span>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                    className="input"
                    style={{ flex: 1, height: 36, fontSize: 13 }}
                    value={selected}
                    onChange={e => { setSelected(e.target.value); setSaved(false); }}
                >
                    <option value="">Select a folder...</option>
                    {folders.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                </select>

                <button
                    className="btn btn-primary btn-sm"
                    onClick={handleSave}
                    disabled={!selected || saved}
                    style={{ minWidth: 80, display: 'flex', alignItems: 'center', gap: 4 }}
                >
                    {saved ? <><Check size={14} /> Saved</> : 'Save'}
                </button>
            </div>

            {!creating ? (
                <button
                    className="btn btn-ghost btn-sm"
                    style={{ marginTop: 8, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                    onClick={() => setCreating(true)}
                >
                    <Plus size={12} /> Create new folder
                </button>
            ) : (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <input
                        className="input"
                        style={{ flex: 1, height: 32, fontSize: 12 }}
                        placeholder="Folder name..."
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
                        autoFocus
                    />
                    <button className="btn btn-primary btn-sm" onClick={handleCreateFolder} style={{ fontSize: 12 }}>Create</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setCreating(false); setNewName(''); }} style={{ fontSize: 12 }}>Cancel</button>
                </div>
            )}
        </div>
    );
}
