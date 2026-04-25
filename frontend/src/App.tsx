import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './shared/Navbar';
import InputPage from './pages/InputPage';
import PreLessonPage from './pages/PreLessonPage';
import LessonPage from './pages/LessonPage';
import AssessmentPage from './pages/AssessmentPage';
import LibraryPage from './pages/LibraryPage';

export default function App() {
    return (
        <BrowserRouter>
            <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
                <Navbar />
                <Routes>
                    <Route path="/" element={<InputPage />} />
                    <Route path="/prepare" element={<PreLessonPage />} />
                    <Route path="/lesson" element={<LessonPage />} />
                    <Route path="/assessment" element={<AssessmentPage />} />
                    <Route path="/library" element={<LibraryPage />} />
                </Routes>
            </div>
        </BrowserRouter>
    );
}
