import { create } from 'zustand';

export interface SavedLesson {
    id: string;
    title: string;
    domain: string;
    subdomain: string;
    score: number | null;
    date_created: string;
    date_assessed: string | null;
    status: string;
    folder_id: string | null;
    content_json: any;
    assessment_json: any;
}

export interface Folder {
    id: string;
    name: string;
    parent_id: string | null;
    children: Folder[];
}

export interface DueReview {
    lesson_id: string;
    title: string;
    review_date: string;
    score: number;
}

interface LibraryStore {
    lessons: SavedLesson[];
    folders: Folder[];
    activeFolderId: string | null;
    dueReviews: DueReview[];
    searchQuery: string;
    statsData: any | null;

    setLessons: (l: SavedLesson[]) => void;
    setFolders: (f: Folder[]) => void;
    setActiveFolderId: (id: string | null) => void;
    setDueReviews: (r: DueReview[]) => void;
    setSearchQuery: (q: string) => void;
    setStatsData: (d: any) => void;
    addLesson: (l: SavedLesson) => void;
}

export const useLibraryStore = create<LibraryStore>((set) => ({
    lessons: [],
    folders: [],
    activeFolderId: null,
    dueReviews: [],
    searchQuery: '',
    statsData: null,

    setLessons: (lessons) => set({ lessons }),
    setFolders: (folders) => set({ folders }),
    setActiveFolderId: (activeFolderId) => set({ activeFolderId }),
    setDueReviews: (dueReviews) => set({ dueReviews }),
    setSearchQuery: (searchQuery) => set({ searchQuery }),
    setStatsData: (statsData) => set({ statsData }),
    addLesson: (l) => set((s) => ({ lessons: [l, ...s.lessons] })),
}));
