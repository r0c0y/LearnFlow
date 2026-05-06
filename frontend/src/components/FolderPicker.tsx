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
        <div style={{ width: '100%' }}>
            {!creating ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ position: 'relative', flex: 1, maxWidth: 200 }}>
                        <select
                            className="input"
                            style={{ width: '100%', height: 36, fontSize: 13, paddingLeft: 32, borderRadius: 10, appearance: 'none', background: 'var(--bg-muted)' }}
                            value={selected}
                            onChange={e => { setSelected(e.target.value); setSaved(false); }}
                        >
                            <option value="">Select folder...</option>
                            {folders.map(f => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                        </select>
                        <Folder size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-tertiary)' }} />
                    </div>

                    <button
                        className="btn btn-primary btn-sm"
                        onClick={handleSave}
                        disabled={!selected || saved}
                        style={{ height: 36, minWidth: 70, borderRadius: 10, fontSize: 13 }}
                    >
                        {saved ? <Check size={16} /> : 'Save'}
                    </button>
                    
                    <button
                        className="btn-icon"
                        style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-muted)', border: '1px solid var(--border)' }}
                        onClick={() => setCreating(true)}
                        title="New Folder"
                    >
                        <Plus size={16} />
                    </button>
                </div>
            ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 200ms ease' }}>
                    <input
                        className="input"
                        style={{ flex: 1, maxWidth: 200, height: 36, fontSize: 13, borderRadius: 10 }}
                        placeholder="New folder name..."
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
                        autoFocus
                    />
                    <button className="btn btn-primary btn-sm" onClick={handleCreateFolder} style={{ height: 36, borderRadius: 10 }}>Create</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setCreating(false); setNewName(''); }} style={{ height: 36, fontSize: 13 }}>×</button>
                </div>
            )}
        </div>
    );
}
