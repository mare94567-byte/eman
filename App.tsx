import React, { useState, useEffect } from 'react';
import { 
  Menu, 
  X, 
  Home, 
  BookOpen, 
  Upload, 
  Download, 
  History, 
  User as UserIcon, 
  LogIn, 
  LogOut,
  Sun,
  Moon,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  MoreVertical,
  Heart,
  Eye,
  Star,
  MessageSquare,
  Edit,
  ArrowRight,
  TrendingUp,
  Wallet,
  Settings,
  ShieldCheck,
  CheckCircle2,
  DollarSign,
  BarChart3,
  RefreshCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from './contexts/AuthContext';
import { 
  loginWithGoogle, 
  logout, 
  db, 
  loginWithEmail, 
  registerWithEmail 
} from './firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  updateDoc, 
  doc, 
  setDoc,
  deleteDoc,
  getDocs,
  where,
  increment,
  arrayUnion,
  arrayRemove,
  limit
} from 'firebase/firestore';
import { Manga, Chapter, Comment, LibraryCategory, UserProfile } from './types';
import { cn, formatDate } from './lib/utils';
import { useLocalStorage } from './hooks/useLocalStorage';
import { saveChapterOffline, getOfflineChapters, removeOfflineChapter, OfflineChapter } from './lib/offlineDB';

// --- Constants ---
const ADMIN_EMAIL = 'e4988682@gmail.com';
const FREE_DOWNLOAD_LIMIT = 4;
const AFTER_AD_LIMIT = 3;

const MANGA_GENRES = [
  'أكشن', 'مغامرة', 'كوميديا', 'دراما', 'فانتازيا', 'رعب', 
  'غموض', 'رومانسية', 'خيال علمي', 'شريحة من الحياة', 
  'رياضة', 'خارق للطبيعة', 'إثارة', 'تاريخي', 'فنون قتالية', 'إيسيكاي',
  'البقاء على قيد الحياة', 'تجسد', 'تناسخ', 'نظام', 'زراعة', 'أبراج', 'قوة خارقة',
  'مستوى', 'زنزانة', 'سحر', 'مدرسية', 'ويب تون', 'رومانسي مانهوا'
];

// --- Components ---

const Button = ({ className, children, ...props }: any) => (
  <button 
    className={cn(
      "px-4 py-2 rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50",
      className
    )} 
    {...props}
  >
    {children}
  </button>
);

const Input = ({ label, ...props }: any) => (
  <div className="flex flex-col gap-1 w-full">
    {label && <label className="text-sm font-medium text-zinc-400">{label}</label>}
    <input 
      className="bg-zinc-800 border-none rounded-lg px-4 py-2 outline-none focus:ring-2 ring-blue-500 text-white" 
      {...props} 
    />
  </div>
);

const TextArea = ({ label, ...props }: any) => (
  <div className="flex flex-col gap-1 w-full">
    {label && <label className="text-sm font-medium text-zinc-400">{label}</label>}
    <textarea 
      className="bg-zinc-800 border-none rounded-lg px-4 py-2 outline-none focus:ring-2 ring-blue-500 text-white min-h-[100px]" 
      {...props} 
    />
  </div>
);

// Helper to check if a date is within the last 24 hours
const isWithin24Hours = (timestamp: any) => {
  if (!timestamp) return false;
  const now = new Date().getTime();
  const date = timestamp?.seconds ? timestamp.seconds * 1000 : timestamp;
  const diff = now - date;
  return diff < 1000 * 60 * 60 * 24;
};

// --- Main App ---

export default function App() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const [theme, setTheme] = useLocalStorage<'light' | 'dark'>('samaq_theme', 'dark');
  const [activeTab, setActiveTab] = useState<'home' | 'library' | 'upload' | 'downloads' | 'history' | 'manga-detail' | 'chapter-view' | 'admin'>('home');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [selectedManga, setSelectedManga] = useState<Manga | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [mangas, setMangas] = useState<Manga[]>([]);
  const [offlineChapters, setOfflineChapters] = useState<OfflineChapter[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selectedTranslator, setSelectedTranslator] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showAdPopup, setShowAdPopup] = useState(false);

  const isAdmin = user?.email === ADMIN_EMAIL;

  // Set/Clear no-ads flag for index.html
  useEffect(() => {
    if (isAdmin) {
      localStorage.setItem('samaq_no_ads', 'true');
    } else {
      localStorage.removeItem('samaq_no_ads');
    }
  }, [isAdmin]);

  // Fetch Mangas
  useEffect(() => {
    const q = query(collection(db, 'mangas'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const mangasData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Manga));
      setMangas(mangasData);
    });
    return unsubscribe;
  }, []);

  // Fetch Offline Chapters
  useEffect(() => {
    const fetchOffline = async () => {
      const data = await getOfflineChapters();
      setOfflineChapters(data);
    };
    fetchOffline();
  }, [activeTab]);

  // Theme support
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleLibraryAction = async (mangaId: string, category: LibraryCategory) => {
    if (!user || !profile) {
      alert('يرجى تسجيل الدخول أولاً');
      return;
    }
    const userRef = doc(db, 'users', user.uid);
    const isInLibrary = profile.library?.[category]?.includes(mangaId);
    
    await updateDoc(userRef, {
      [`library.${category}`]: isInLibrary ? arrayRemove(mangaId) : arrayUnion(mangaId)
    });
    refreshProfile();
  };

  const handleDownload = async (manga: Manga, chapter: Chapter) => {
    if (!user || !profile) {
      alert('يرجى تسجيل الدخول أولاً');
      setIsAuthModalOpen(true);
      return;
    }

    // Check limits for non-admin
    if (!isAdmin) {
      if (profile.downloadCount >= FREE_DOWNLOAD_LIMIT) {
        setShowAdPopup(true);
        // Direct link to the ad to ensure view/popup
        window.open('https://pl29218810.profitablecpmratenetwork.com/bd/66/08/bd6608f59da8755f7367b432f9eefc97.js', '_blank');
        return;
      }
    }

    try {
      const offlineDoc: OfflineChapter = {
        id: chapter.id,
        mangaId: manga.id,
        mangaTitle: manga.title,
        chapterTitle: chapter.title,
        chapterNumber: chapter.number,
        coverUrl: manga.coverUrl,
        images: chapter.images,
        savedAt: Date.now()
      };

      await saveChapterOffline(offlineDoc);
      
      // Update download count in Firestore
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        downloadCount: increment(1)
      });
      
      refreshProfile();
      alert('تم تحميل الفصل بنجاح!');
    } catch (error) {
      console.error("Download error:", error);
      alert('حدث خطأ أثناء التحميل');
    }
  };

  const unlockNextDownloads = async () => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    // Reset or reduce count to allow more downloads
    await updateDoc(userRef, {
      downloadCount: profile!.downloadCount - AFTER_AD_LIMIT
    });
    setShowAdPopup(false);
    refreshProfile();
  };

  const removeDownload = async (chapterId: string) => {
    await removeOfflineChapter(chapterId);
    const data = await getOfflineChapters();
    setOfflineChapters(data);
  };

  const clearHistory = async () => {
    if (!user) return;
    if (!window.confirm('هل أنت متأكد من مسح سجل المشاهدة بالكامل؟')) return;
    const q = query(collection(db, 'users', user.uid, 'history'));
    const snap = await getDocs(q);
    const deletePromises = snap.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
  };

  const handleDeleteManga = async (id: string) => {
    try {
      const chaptersRef = collection(db, 'mangas', id, 'chapters');
      const chaptersSnap = await getDocs(chaptersRef);
      const deletePromises = chaptersSnap.docs.map(c => deleteDoc(doc(db, 'mangas', id, 'chapters', c.id)));
      
      const commentsRef = collection(db, 'mangas', id, 'comments');
      const commentsSnap = await getDocs(commentsRef);
      deletePromises.push(...commentsSnap.docs.map(c => deleteDoc(doc(db, 'mangas', id, 'comments', c.id))));
      
      await Promise.all(deletePromises);
      await deleteDoc(doc(db, 'mangas', id));
      alert('تم حذف العمل بنجاح');
    } catch (error) {
      console.error("Delete error:", error);
      alert('فشل في حذف العمل');
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home': return (
        <HomeView 
          mangas={mangas} 
          onSelectManga={(m: Manga) => { setSelectedManga(m); setActiveTab('manga-detail'); }} 
          onLibraryAction={handleLibraryAction}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedGenre={selectedGenre}
          setSelectedGenre={setSelectedGenre}
          selectedTranslator={selectedTranslator}
          setSelectedTranslator={setSelectedTranslator}
          isSearchOpen={isSearchOpen}
          setIsSearchOpen={setIsSearchOpen}
          onDeleteManga={isAdmin ? handleDeleteManga : undefined}
        />
      );
      case 'library': return <LibraryView mangas={mangas} profile={profile} onSelectManga={(m) => { setSelectedManga(m); setActiveTab('manga-detail'); }} onLibraryAction={handleLibraryAction} />;
      case 'history': return <HistoryView onSelectManga={(id: string) => { 
        const m = mangas.find(m => m.id === id);
        if (m) { setSelectedManga(m); setActiveTab('manga-detail'); }
      }} onHistoryClear={clearHistory} />;
      case 'upload': return <UploadView onMangaCreated={() => setActiveTab('home')} />;
      case 'downloads': return <DownloadsView downloads={offlineChapters} mangas={mangas} onRemove={removeDownload} onSelectChapter={(m, c) => { setSelectedManga(m); setSelectedChapter(c); setActiveTab('chapter-view'); }} />;
      case 'admin': return isAdmin ? <AdminDashboard profile={profile!} /> : (
        <HomeView 
          mangas={mangas} 
          onSelectManga={(m) => { setSelectedManga(m); setActiveTab('manga-detail'); }} 
          onLibraryAction={handleLibraryAction}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedGenre={selectedGenre}
          setSelectedGenre={setSelectedGenre}
          selectedTranslator={selectedTranslator}
          setSelectedTranslator={setSelectedTranslator}
          isSearchOpen={isSearchOpen}
          setIsSearchOpen={setIsSearchOpen}
        />
      );
      case 'manga-detail': return <MangaDetailView 
        manga={selectedManga!} 
        onBack={() => setActiveTab('home')} 
        onRead={(c: any) => { setSelectedChapter(c); setActiveTab('chapter-view'); }}
        onLibraryAction={handleLibraryAction}
        isFavorite={profile?.library?.favorites?.includes(selectedManga?.id || '')}
        isReadingNow={profile?.library?.readingNow?.includes(selectedManga?.id || '')}
        isReadLater={profile?.library?.readLater?.includes(selectedManga?.id || '')}
        onDownload={handleDownload}
        user={user}
        onTranslatorClick={(name: string) => {
          setSelectedTranslator(name);
          setActiveTab('home');
        }}
      />;
      case 'chapter-view': return <ChapterView 
        chapter={selectedChapter!} 
        manga={selectedManga!} 
        onBack={() => setActiveTab('manga-detail')} 
      />;
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-blue-500/30 overflow-x-hidden">
      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        className={cn(
          "fixed top-0 right-0 h-full w-72 bg-zinc-900 border-l border-zinc-800 z-50 transition-all",
          isSidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        )}
      >
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-black bg-gradient-to-l from-blue-500 to-blue-300 bg-clip-text text-transparent">SAMAQ</h1>
            <div className="flex items-center gap-2">
              <button 
                onClick={toggleTheme}
                className="p-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl transition-all"
              >
                {theme === 'dark' ? <Sun size={18} className="text-blue-500" /> : <Moon size={18} className="text-blue-600" />}
              </button>
              <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 hover:bg-zinc-800 rounded-lg">
                <X size={24} />
              </button>
            </div>
          </div>

          <nav className="flex flex-col gap-2 flex-grow">
            <NavItem active={activeTab === 'home'} icon={<Home size={20}/>} label="الرئيسية" onClick={() => { setActiveTab('home'); setIsSidebarOpen(false); }} />
            <NavItem active={activeTab === 'library'} icon={<BookOpen size={20}/>} label="المكتبة" onClick={() => { setActiveTab('library'); setIsSidebarOpen(false); }} />
            <NavItem active={activeTab === 'history'} icon={<History size={20}/>} label="سجل المشاهدة" onClick={() => { setActiveTab('history'); setIsSidebarOpen(false); }} />
            <NavItem active={activeTab === 'upload'} icon={<Upload size={20}/>} label="انشر أعمالك" onClick={() => { setActiveTab('upload'); setIsSidebarOpen(false); }} />
            <NavItem active={activeTab === 'downloads'} icon={<Download size={20}/>} label="التحميلات" onClick={() => { setActiveTab('downloads'); setIsSidebarOpen(false); }} />
            {isAdmin && (
              <NavItem active={activeTab === 'admin'} icon={<ShieldCheck size={20} className="text-yellow-500" />} label="لوحة الأرباح" onClick={() => { setActiveTab('admin'); setIsSidebarOpen(false); }} />
            )}
          </nav>

          <div className="mt-auto border-t border-zinc-800 pt-6">
            {loading ? (
              <div className="animate-pulse bg-zinc-800 h-12 rounded-xl" />
            ) : user ? (
              <div className="flex items-center gap-3">
                <img src={user.photoURL || ''} alt="" className="w-10 h-10 rounded-full border-2 border-blue-500" />
                <div className="flex-grow min-w-0">
                  <p className="font-bold truncate text-sm">{user.displayName}</p>
                  <button onClick={logout} className="text-xs text-blue-500 hover:text-blue-400 flex items-center gap-1">
                    <LogOut size={12} /> تسجيل الخروج
                  </button>
                </div>
              </div>
            ) : (
              <Button onClick={() => setIsAuthModalOpen(true)} className="bg-blue-600 hover:bg-blue-500 flex items-center justify-center gap-2 w-full py-3 rounded-xl shadow-lg shadow-blue-950/20">
                <LogIn size={20} /> تسجيل الدخول
              </Button>
            )}
          </div>
        </div>
      </motion.aside>

      {/* Ad Unlock Popup */}
      <AnimatePresence>
        {showAdPopup && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl max-w-sm w-full text-center space-y-6"
            >
              <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto">
                <TrendingUp size={40} className="text-blue-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black">انتهت التحميلات المجانية</h3>
                <p className="text-zinc-400 font-medium">شاهد إعلان قصير لفتح 3 تحميلات إضافية فوراً ومساعدتنا في الاستمرار</p>
              </div>
              <Button 
                onClick={unlockNextDownloads}
                className="w-full bg-blue-600 hover:bg-blue-500 py-4 font-black text-lg rounded-2xl shadow-xl shadow-blue-900/40"
              >
                شاهد الإعلان وافتح الآن
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isAuthModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAuthModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <AuthModal onClose={() => setIsAuthModalOpen(false)} />
          </div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="lg:pr-72 min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-900 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 hover:bg-zinc-900 rounded-lg transition-colors">
                <Menu size={24} />
              </button>
              <h1 className="text-2xl font-black bg-gradient-to-l from-blue-500 to-blue-300 bg-clip-text text-transparent">SAMAQ</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative flex items-center">
              <AnimatePresence>
                {isSearchOpen && (
                  <motion.div 
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 180, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <input 
                      autoFocus
                      type="text"
                      placeholder="بحث..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onBlur={() => !searchQuery && setIsSearchOpen(false)}
                      className="bg-zinc-900 border-none rounded-full pr-10 pl-4 py-2 text-xs w-full outline-none ring-1 ring-zinc-800 focus:ring-2 ring-blue-500/50 transition-all font-bold text-white mr-2"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
              <button 
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                className={cn(
                  "p-2 rounded-xl transition-all relative z-10",
                  isSearchOpen ? "text-blue-500" : "text-zinc-400 hover:text-white"
                )}
              >
                <Search size={20} />
              </button>
            </div>
            <button 
              onClick={toggleTheme}
              className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl transition-all hover:scale-105 active:scale-95 shrink-0"
              title={theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}
            >
              {theme === 'dark' ? <Sun size={18} className="text-blue-500" /> : <Moon size={18} className="text-blue-600" />}
            </button>
          </div>
        </header>

        {/* Views */}
        <div className="p-4 md:p-6">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

// --- View Components ---

function NavItem({ active, icon, label, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group",
        active 
          ? "bg-blue-600/10 text-blue-500 shadow-[inset_0_0_20px_rgba(37,99,235,0.05)]" 
          : "text-zinc-500 hover:text-white hover:bg-zinc-800/50"
      )}
    >
      <span className={cn(
        "transition-transform",
        active ? "scale-110" : "group-hover:scale-110"
      )}>{icon}</span>
      <span className="font-bold text-sm">{label}</span>
      {active && <motion.div layoutId="nav-pill" className="mr-auto w-1.5 h-6 bg-blue-500 rounded-full" />}
    </button>
  );
}

function AuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
      } else {
        await registerWithEmail(email, password, name);
      }
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'حدث خطأ ما، يرجى المحاولة مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    try {
      await loginWithGoogle();
      onClose();
    } catch (err: any) {
      setError(err.message || 'فشل تسجيل الدخول بجوجل');
    }
  };

  return (
    <motion.div 
      initial={{ scale: 0.9, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.9, opacity: 0, y: 20 }}
      className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl overflow-hidden"
    >
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/20 blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/10 blur-[100px] pointer-events-none" />

      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-black text-white">{mode === 'login' ? 'مرحباً بك' : 'حساب جديد'}</h2>
          <p className="text-zinc-500 text-sm font-bold mt-1">SAMAQ - عالم المانجا</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-500">
          <X size={24} />
        </button>
      </div>

      <div className="space-y-6">
        <button 
          type="button"
          onClick={handleGoogle}
          className="w-full bg-white text-black py-3.5 rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-zinc-100 transition-all active:scale-95 shadow-lg"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="" />
          الدخول بجوجل
        </button>

        <div className="flex items-center gap-4 py-2">
          <div className="flex-grow h-px bg-zinc-800" />
          <span className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">أو بالبريد</span>
          <div className="flex-grow h-px bg-zinc-800" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <Input 
              label="اسم المستخدم"
              type="text" 
              value={name}
              onChange={(e: any) => setName(e.target.value)}
              placeholder="أدخل اسمك"
              required
            />
          )}

          <Input 
            label="البريد الإلكتروني"
            type="email" 
            value={email}
            onChange={(e: any) => setEmail(e.target.value)}
            placeholder="email@example.com"
            required
          />

          <Input 
            label="كلمة المرور"
            type="password" 
            value={password}
            onChange={(e: any) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          {error && <p className="text-red-500 text-xs font-bold bg-red-500/10 p-3 rounded-xl border border-red-500/20">{error}</p>}

          <Button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-black text-base shadow-xl shadow-blue-950/20 transition-all font-sans"
          >
            {loading ? 'جاري التحميل...' : (mode === 'login' ? 'تسجيل الدخول' : 'إنشاء الحساب')}
          </Button>
        </form>

        <p className="text-center text-zinc-500 text-sm font-bold">
          {mode === 'login' ? 'ليس لديك حساب؟' : 'لديك حساب بالفعل؟'}
          <button 
            type="button"
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
            className="text-blue-500 mr-2 hover:underline"
          >
            {mode === 'login' ? 'سجل الآن' : 'سجل دخولك'}
          </button>
        </p>
      </div>
    </motion.div>
  );
}

function HomeView({ 
  mangas, 
  onSelectManga, 
  onLibraryAction,
  searchQuery,
  setSearchQuery,
  selectedGenre,
  setSelectedGenre,
  selectedTranslator,
  setSelectedTranslator,
  isSearchOpen,
  setIsSearchOpen,
  onDeleteManga
}: any) {
  const [subTab, setSubTab] = useState<'latest' | 'popular' | 'genres'>('latest');

  // Filtering Logic
  let filteredMangas = mangas;

  if (selectedGenre) {
    filteredMangas = filteredMangas.filter((m: Manga) => m.genres?.includes(selectedGenre));
  }

  if (selectedTranslator) {
    filteredMangas = filteredMangas.filter((m: Manga) => m.creatorName === selectedTranslator);
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filteredMangas = filteredMangas.filter((m: Manga) => 
      m.title.toLowerCase().includes(q) || 
      m.creatorName?.toLowerCase().includes(q) ||
      m.author.toLowerCase().includes(q) ||
      m.otherNames?.toLowerCase().includes(q)
    );
  }

  const latestMangas = [...filteredMangas].sort((a, b) => {
    const timeA = a.updatedAt?.seconds || a.createdAt?.seconds || 0;
    const timeB = b.updatedAt?.seconds || b.createdAt?.seconds || 0;
    return timeB - timeA;
  });

  const popularMangas = [...filteredMangas].sort((a, b) => {
    const scoreA = (a.views || 0) * 1 + (a.likes || 0) * 5; // Likes weighted more for "rating"
    const scoreB = (b.views || 0) * 1 + (b.likes || 0) * 5;
    return scoreB - scoreA;
  });

  const handleSwipe = (direction: 'left' | 'right') => {
    const tabs: ('latest' | 'popular' | 'genres')[] = ['latest', 'popular', 'genres'];
    const currentIndex = tabs.indexOf(subTab);
    if (direction === 'left' && currentIndex < tabs.length - 1) {
      setSubTab(tabs[currentIndex + 1]);
    } else if (direction === 'right' && currentIndex > 0) {
      setSubTab(tabs[currentIndex - 1]);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Tabs Navigation - Moved to Top */}
      <div className="flex items-center justify-center p-1.5 bg-zinc-900/50 backdrop-blur-md rounded-[24px] border border-zinc-800/50 w-full max-w-sm mx-auto sticky top-4 z-40 shadow-2xl">
        <button 
          onClick={() => setSubTab('latest')}
          className={cn(
            "flex-1 py-3 rounded-[18px] text-[10px] font-black transition-all flex items-center justify-center gap-2",
            subTab === 'latest' ? "bg-blue-600 text-white shadow-xl shadow-blue-900/20" : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          <History size={14} /> آخر الفصول
        </button>
        <button 
          onClick={() => setSubTab('popular')}
          className={cn(
            "flex-1 py-3 rounded-[18px] text-[10px] font-black transition-all flex items-center justify-center gap-2",
            subTab === 'popular' ? "bg-blue-600 text-white shadow-xl shadow-blue-900/20" : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          <TrendingUp size={14} /> الأكثر شعبية
        </button>
        <button 
          onClick={() => setSubTab('genres')}
          className={cn(
            "flex-1 py-3 rounded-[18px] text-[10px] font-black transition-all flex items-center justify-center gap-2",
            subTab === 'genres' ? "bg-blue-600 text-white shadow-xl shadow-blue-900/20" : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          <Menu size={14} /> التصنيفات
        </button>
      </div>

      {(selectedGenre || selectedTranslator || searchQuery) && (
        <div className="flex items-center justify-center gap-2 px-4">
          <button 
            onClick={() => {
              setSelectedGenre(null);
              setSelectedTranslator(null);
              setSearchQuery('');
            }}
            className="bg-blue-600/10 text-blue-500 px-4 py-2 rounded-full text-xs font-black flex items-center gap-2 hover:bg-blue-600 hover:text-white transition-all shadow-lg"
          >
            تصفية: {selectedGenre || selectedTranslator || 'بحث'} <X size={14} />
          </button>
        </div>
      )}

      {/* Content Area with Swipe Support */}
      <div className="pt-4 px-1 min-h-[60vh]">
        {subTab === 'latest' && (
          <div className="space-y-6">
            {latestMangas.length === 0 ? (
              <div className="py-20 text-center text-zinc-500 font-bold">لا توجد نتائج تطابق بحثك</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {latestMangas.map(manga => (
                  <MangaCard 
                    key={manga.id} 
                    manga={manga} 
                    onClick={() => onSelectManga(manga)} 
                    onLibraryAction={onLibraryAction} 
                    onTranslatorClick={(name: string) => {
                      setSelectedTranslator(name);
                      setSubTab('latest');
                    }}
                    onDeleteManga={onDeleteManga}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {subTab === 'popular' && (
          <div className="space-y-6">
            {popularMangas.length === 0 ? (
              <div className="py-20 text-center text-zinc-500 font-bold">لا توجد أعمال مشهورة هنا حالياً</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {popularMangas.map(manga => (
                  <MangaCard 
                    key={manga.id} 
                    manga={manga} 
                    onClick={() => onSelectManga(manga)} 
                    onLibraryAction={onLibraryAction}
                    onTranslatorClick={(name: string) => {
                      setSelectedTranslator(name);
                      setSubTab('latest');
                    }}
                    onDeleteManga={onDeleteManga}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {subTab === 'genres' && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {MANGA_GENRES.map(genre => (
                <button
                  key={genre}
                  onClick={() => {
                    setSelectedGenre(genre);
                    setSubTab('latest');
                  }}
                  className={cn(
                    "relative overflow-hidden group aspect-[2/1] rounded-2xl border transition-all flex items-center justify-center p-4",
                    selectedGenre === genre 
                      ? "bg-blue-600 border-blue-400 shadow-xl shadow-blue-900/40 text-white" 
                      : "bg-zinc-900 border-zinc-800 hover:border-blue-500/50 text-zinc-400"
                  )}
                >
                  <span className="relative z-10 font-black text-sm">{genre}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MangaCard({ manga, onClick, onLibraryAction, onTranslatorClick, onDeleteManga }: { 
  manga: Manga, 
  onClick: () => void, 
  onLibraryAction?: (id: string, cat: LibraryCategory) => void,
  onTranslatorClick?: (name: string) => void,
  onDeleteManga?: (id: string) => void
}) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <motion.div 
      whileHover={{ y: -8 }}
      className="group relative flex flex-col h-full"
    >
      <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl bg-zinc-900 border border-zinc-800 transition-all group-hover:border-blue-500/50 shrink-0">
        <div onClick={onClick} className="absolute inset-0 z-10" />
        <img src={manga.coverUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt={manga.title} />
        
        {isWithin24Hours(manga.updatedAt || manga.createdAt) && (
          <div className="absolute top-3 right-0 z-30 pointer-events-none">
            <div className="bg-blue-600 text-[10px] font-black px-2 py-0.5 rounded-l-lg shadow-lg flex items-center gap-1 text-white">
              جديد
            </div>
          </div>
        )}

        {/* Stats Overlays */}
        <div className="absolute top-3 right-3 z-20 flex flex-col gap-1 pointer-events-none">
          <span className="bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1"><Eye size={10} className="text-blue-500" /> {manga.views || 0}</span>
          <span className="bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1"><Heart size={10} className="text-red-500" /> {manga.likes || 0}</span>
        </div>

        {/* 3 Dots Menu */}
        <div className="absolute top-3 left-3 z-30">
          <button 
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="p-1.5 bg-black/60 backdrop-blur-md rounded-lg text-white hover:bg-blue-600 transition-colors shadow-lg"
          >
            <MoreVertical size={16} />
          </button>
          
          <AnimatePresence>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, x: -10 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9, x: -10 }}
                  className="absolute left-0 mt-2 w-40 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden"
                >
                  <button onClick={(e) => { e.stopPropagation(); onLibraryAction?.(manga.id, 'readingNow'); setShowMenu(false); }} className="w-full px-4 py-2.5 text-right text-xs font-bold hover:bg-zinc-800 flex items-center justify-between transition-colors">
                    اقرأ الآن <Eye size={12} className="text-zinc-500"/>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onLibraryAction?.(manga.id, 'readLater'); setShowMenu(false); }} className="w-full px-4 py-2.5 text-right text-xs font-bold hover:bg-zinc-800 flex items-center justify-between border-t border-zinc-800 transition-colors">
                    اقرأ لاحقاً <History size={12} className="text-zinc-500"/>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onLibraryAction?.(manga.id, 'favorites'); setShowMenu(false); }} className="w-full px-4 py-2.5 text-right text-xs font-bold hover:bg-zinc-800 flex items-center justify-between border-t border-zinc-800 transition-colors text-red-400">
                    المفضلة <Heart size={12} className="text-red-500"/>
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <div onClick={onClick} className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
          <span className="text-[10px] font-black uppercase text-white tracking-widest bg-blue-600 px-2 py-1 rounded">ابدأ القراءة</span>
        </div>
      </div>
      
      <div className="mt-3 px-1 space-y-1.5 flex flex-col flex-grow">
        <h4 onClick={onClick} className="font-black text-xs md:text-sm line-clamp-1 group-hover:text-blue-500 transition-colors uppercase leading-tight cursor-pointer">{manga.title}</h4>
        
        <div className="flex flex-col gap-1 items-start">
          {manga.creatorName && (
            <button 
              onClick={() => onTranslatorClick?.(manga.creatorName)}
              className="text-[9px] text-zinc-500 font-bold hover:text-blue-500 transition-colors flex items-center gap-1"
            >
              <UserIcon size={8} /> {manga.creatorName}
            </button>
          )}
          <div className="flex items-center justify-between w-full">
            <span className="text-[10px] text-zinc-600 font-bold">الفصل {manga.lastChapterNumber || 1}</span>
            <div className="flex items-center gap-1 text-[9px] font-bold text-blue-500">
              <RefreshCcw size={10} /> جديد
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function LibraryView({ mangas, profile, onSelectManga, onLibraryAction }: any) {
  const [activeCategory, setActiveCategory] = useState<LibraryCategory>('readingNow');
  
  const categories = [
    { id: 'readingNow', label: 'اقرأ الآن', icon: <Eye size={18}/> },
    { id: 'readLater', label: 'اقرأ لاحقاً', icon: <History size={18}/> },
    { id: 'favorites', label: 'المفضلة', icon: <Heart size={18}/> },
  ];

  const filteredMangas = mangas.filter((m: any) => profile?.library?.[activeCategory]?.includes(m.id));

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-900 pb-6">
        <h2 className="text-4xl font-black">مكتبتي</h2>
        <div className="flex bg-zinc-900 p-1.5 rounded-2xl">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as any)}
              className={cn(
                "flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-black transition-all",
                activeCategory === cat.id ? "bg-blue-600 text-white shadow-lg shadow-blue-950/20" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>
      </div>

      {filteredMangas.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {filteredMangas.map((m: any) => (
            <MangaCard key={m.id} manga={m} onClick={() => onSelectManga(m)} onLibraryAction={onLibraryAction} />
          ))}
        </div>
      ) : (
        <div className="py-20 flex flex-col items-center gap-4 text-zinc-500">
          <div className="w-20 h-20 rounded-full bg-zinc-900 flex items-center justify-center">
            {categories.find(c => c.id === activeCategory)?.icon}
          </div>
          <p className="font-bold">لا توجد أعمال في هذه القائمة بعد</p>
        </div>
      )}
    </div>
  );
}

function UploadView({ onMangaCreated }: { onMangaCreated: () => void }) {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [mode, setMode] = useState<'manga' | 'chapter' | 'manage'>('manga');
  const [editingManga, setEditingManga] = useState<Manga | null>(null);
  const [viewingChaptersFor, setViewingChaptersFor] = useState<Manga | null>(null);
  const [chapterList, setChapterList] = useState<Chapter[]>([]);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [myMangas, setMyMangas] = useState<Manga[]>([]);
  
  // Manga Form
  const [mangaTitle, setMangaTitle] = useState('');
  const [mangaAuthor, setMangaAuthor] = useState('');
  const [mangaDesc, setMangaDesc] = useState('');
  const [mangaCoverUrl, setMangaCoverUrl] = useState('');
  const [otherNames, setOtherNames] = useState('');
  const [mangaGenres, setMangaGenres] = useState<string[]>([]);

  // Chapter Form
  const [selectedMangaId, setSelectedMangaId] = useState('');
  const [chapterTitle, setChapterTitle] = useState('');
  const [chapterNumber, setChapterNumber] = useState(1);
  const [chapterImages, setChapterImages] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'mangas'), where('creatorId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snap) => {
      setMyMangas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Manga)));
    });
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!viewingChaptersFor) return;
    const q = query(collection(db, 'mangas', viewingChaptersFor.id, 'chapters'), orderBy('number', 'asc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setChapterList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chapter)));
    });
    return unsubscribe;
  }, [viewingChaptersFor]);

  const handleMangaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !mangaTitle || !mangaAuthor || !mangaCoverUrl) return;
    setIsUploading(true);
    try {
      await addDoc(collection(db, 'mangas'), {
        title: mangaTitle,
        author: mangaAuthor,
        description: mangaDesc,
        coverUrl: mangaCoverUrl,
        otherNames,
        creatorId: user.uid,
        creatorName: user.displayName,
        createdAt: serverTimestamp(),
        views: 0,
        likes: 0
      });
      onMangaCreated();
    } catch (error) {
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleChapterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMangaId || !chapterTitle || chapterImages.length === 0) return;
    setIsUploading(true);
    try {
      await addDoc(collection(db, 'mangas', selectedMangaId, 'chapters'), {
        title: chapterTitle,
        number: Number(chapterNumber),
        images: chapterImages,
        createdAt: serverTimestamp()
      });
      // Update lastChapterNumber in main document
      await updateDoc(doc(db, 'mangas', selectedMangaId), {
        lastChapterNumber: Number(chapterNumber),
        updatedAt: serverTimestamp()
      });
      alert('تم نشر الفصل بنجاح');
      setMode('manga');
    } catch (error) {
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  const applyWatermark = async (base64: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Limit dimensions for faster processing and lower storage if needed
        const MAX_WIDTH = 1200;
        let width = img.width;
        let height = img.height;
        if (width > MAX_WIDTH) {
          height = (MAX_WIDTH / width) * height;
          width = MAX_WIDTH;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { alpha: false }); // Disable alpha for speed
        if (!ctx) return resolve(base64);

        ctx.drawImage(img, 0, 0, width, height);
        const fontSize = Math.max(16, width / 25);
        ctx.font = `bold ${fontSize}px Inter, sans-serif`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 2;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        
        ctx.strokeText('SAMAQ-TEAM', width - 15, height - 15);
        ctx.fillText('SAMAQ-TEAM', width - 15, height - 15);
        
        // Use 0.7 quality for faster encoding and smaller size
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => resolve(base64);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isCover: boolean = false) => {
    const files = e.target.files;
    if (!files) return;
    setIsUploading(true);

    try {
      const results = await Promise.all(
        Array.from(files).map(async (file) => {
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
          // Only watermark chapter images, not covers
          return isCover ? base64 : await applyWatermark(base64);
        })
      );

      if (isCover) {
        setMangaCoverUrl(results[0]);
      } else {
        setChapterImages((prev) => [...prev, ...results]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-top-4 duration-500 relative">
      <AnimatePresence>
        {isUploading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 text-center"
          >
            <div className="bg-zinc-900 p-10 rounded-3xl border border-zinc-800 shadow-2xl flex flex-col items-center gap-6 max-w-sm">
              <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
              <div>
                <h3 className="text-2xl font-black text-blue-500">جاري المعالجة...</h3>
                <p className="text-zinc-500 font-bold mt-2">نقوم بإضافة العلامة المائية وتجهيز الفصول للنشر، يرجى الانتظار قليلاً</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex bg-zinc-900 p-1.5 rounded-2xl w-fit">
        <button onClick={() => { setMode('manga'); setEditingManga(null); setViewingChaptersFor(null); }} className={cn("px-6 py-2 rounded-xl text-sm font-black transition-all", mode === 'manga' ? "bg-blue-600 text-white" : "text-zinc-500")}>عمل جديد</button>
        <button onClick={() => { setMode('chapter'); setEditingChapter(null); setViewingChaptersFor(null); }} className={cn("px-6 py-2 rounded-xl text-sm font-black transition-all", mode === 'chapter' ? "bg-blue-600 text-white" : "text-zinc-500")}>فصل جديد</button>
        <button onClick={() => { setMode('manage'); setViewingChaptersFor(null); }} className={cn("px-6 py-2 rounded-xl text-sm font-black transition-all", mode === 'manage' ? "bg-blue-600 text-white" : "text-zinc-500")}>إدارة أعمالي</button>
      </div>

      {mode === 'manage' && !viewingChaptersFor && (
        <div className="grid gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {myMangas.length === 0 ? (
            <div className="py-20 text-center text-zinc-500 font-bold bg-zinc-900/50 rounded-3xl border border-dashed border-zinc-800">
              لم تنشر أي أعمال بعد
            </div>
          ) : (
            myMangas.map(m => (
              <div key={m.id} className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-blue-500/50 transition-all">
                <div className="flex items-center gap-4">
                  <img src={m.coverUrl} className="w-16 h-20 object-cover rounded-xl shadow-lg" alt="" />
                  <div>
                    <h3 className="text-xl font-black">{m.title}</h3>
                    <p className="text-zinc-500 text-sm font-bold flex items-center gap-3">
                      <Eye size={14} /> {m.views} • <Heart size={14} /> {m.likes}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <button 
                    onClick={() => setViewingChaptersFor(m)}
                    className="p-3 bg-zinc-800 rounded-xl hover:bg-blue-600 transition-all text-zinc-400 hover:text-white flex items-center gap-2 text-sm font-bold"
                  >
                    <BookOpen size={20} /> الفصول
                  </button>
                  <button 
                    onClick={() => {
                      setEditingManga(m);
                      setMangaTitle(m.title);
                      setMangaAuthor(m.author);
                      setMangaDesc(m.description);
                      setMangaCoverUrl(m.coverUrl);
                      setOtherNames(m.otherNames);
                      setMode('manga');
                    }}
                    className="p-3 bg-zinc-800 rounded-xl hover:bg-blue-600 transition-all text-zinc-400 hover:text-white"
                  >
                    <Edit size={20} />
                  </button>
                </div>
          </div>
        ))
      )}
    </div>
  )}

      {mode === 'manage' && viewingChaptersFor && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
            <div className="flex items-center gap-3">
              <button onClick={() => setViewingChaptersFor(null)} className="p-2 hover:bg-zinc-800 rounded-lg"><ArrowRight size={20} /></button>
              <h3 className="font-black text-xl">إدارة فصول: {viewingChaptersFor.title}</h3>
            </div>
            <button 
              onClick={() => {
                setSelectedMangaId(viewingChaptersFor.id);
                setChapterTitle('');
                setChapterNumber(chapterList.length + 1);
                setChapterImages([]);
                setEditingChapter(null);
                setMode('chapter');
              }}
              className="bg-blue-600 px-4 py-2 rounded-xl text-sm font-black flex items-center gap-2"
            >
              <Plus size={18} /> إضافة فصل
            </button>
          </div>

          <div className="grid gap-3">
            {chapterList.map(chap => (
              <div key={chap.id} className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 flex items-center justify-between">
                <div>
                  <h4 className="font-black">فصل {chap.number}: {chap.title}</h4>
                  <p className="text-xs text-zinc-500">{chap.images.length} صورة • {formatDate(chap.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      setEditingChapter(chap);
                      setSelectedMangaId(viewingChaptersFor.id);
                      setChapterTitle(chap.title);
                      setChapterNumber(chap.number);
                      setChapterImages(chap.images);
                      setMode('chapter');
                    }}
                    className="p-2 hover:bg-blue-600/20 text-blue-500 rounded-lg transition-all"
                  >
                    <Edit size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {mode === 'manga' ? (
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (!user || !mangaTitle || !mangaAuthor || !mangaCoverUrl) return;
          setIsUploading(true);
          try {
            if (editingManga) {
              await updateDoc(doc(db, 'mangas', editingManga.id), {
                title: mangaTitle,
                author: mangaAuthor,
                description: mangaDesc,
                coverUrl: mangaCoverUrl,
                otherNames,
                genres: mangaGenres
              });
              alert('تم تحديث العمل بنجاح');
              setMode('manage');
            } else {
              await addDoc(collection(db, 'mangas'), {
                title: mangaTitle,
                author: mangaAuthor,
                description: mangaDesc,
                coverUrl: mangaCoverUrl,
                otherNames,
                genres: mangaGenres,
                creatorId: user.uid,
                creatorName: user.displayName,
                createdAt: serverTimestamp(),
                views: 0,
                likes: 0
              });
              onMangaCreated();
            }
            setEditingManga(null);
            setMangaTitle('');
            setMangaAuthor('');
            setMangaDesc('');
            setMangaCoverUrl('');
            setOtherNames('');
          } catch (error) {
            console.error(error);
          } finally {
            setIsUploading(false);
          }
        }} className="bg-zinc-900 p-8 rounded-3xl space-y-6 border border-zinc-800">
          <h2 className="text-2xl font-black">{editingManga ? 'تعديل العمل' : 'إضافة عمل جديد'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Input label="اسم العمل" value={mangaTitle} onChange={(e: any) => setMangaTitle(e.target.value)} required />
              <Input label="أسماء أخرى" value={otherNames} onChange={(e: any) => setOtherNames(e.target.value)} />
              <Input label="المؤلف" value={mangaAuthor} onChange={(e: any) => setMangaAuthor(e.target.value)} required />
              <TextArea label="الوصف" value={mangaDesc} onChange={(e: any) => setMangaDesc(e.target.value)} required />
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-400">التصنيفات</label>
                <div className="flex flex-wrap gap-2">
                  {MANGA_GENRES.map(genre => (
                    <button
                      key={genre}
                      type="button"
                      onClick={() => {
                        setMangaGenres(prev => 
                          prev.includes(genre) 
                            ? prev.filter(g => g !== genre)
                            : [...prev, genre]
                        );
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border",
                        mangaGenres.includes(genre)
                          ? "bg-blue-600 border-blue-500 text-white"
                          : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600"
                      )}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <label className="text-sm font-medium text-zinc-400">صورة الغلاف</label>
              <div 
                onClick={() => document.getElementById('cover-upload')?.click()}
                className="aspect-[3/4] bg-zinc-800 rounded-3xl border-2 border-dashed border-zinc-700 hover:border-blue-500 transition-all flex flex-col items-center justify-center cursor-pointer overflow-hidden p-2 group"
              >
                {mangaCoverUrl ? (
                  <img src={mangaCoverUrl} className="w-full h-full object-cover rounded-2xl" alt="" />
                ) : (
                  <>
                    <Plus size={48} className="text-zinc-600 group-hover:text-blue-500 group-hover:scale-110 transition-all" />
                    <span className="text-zinc-500 font-bold mt-2">اختر صورة</span>
                  </>
                )}
              </div>
              <input id="cover-upload" type="file" hidden accept="image/*" onChange={(e) => handleFileUpload(e, true)} />
            </div>
          </div>
          <Button disabled={isUploading} className="w-full bg-blue-600 py-4 rounded-2xl text-lg font-black">{isUploading ? 'جاري التنفيذ...' : (editingManga ? 'حفظ التعديلات' : 'نشر العمل')}</Button>
        </form>
      ) : mode === 'chapter' ? (
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (!selectedMangaId || !chapterTitle || chapterImages.length === 0) return;
          setIsUploading(true);
          try {
            if (editingChapter) {
              await updateDoc(doc(db, 'mangas', selectedMangaId, 'chapters', editingChapter.id), {
                title: chapterTitle,
                number: Number(chapterNumber),
                images: chapterImages
              });
              alert('تم تحديث الفصل بنجاح');
              setMode('manage');
            } else {
              await addDoc(collection(db, 'mangas', selectedMangaId, 'chapters'), {
                title: chapterTitle,
                number: Number(chapterNumber),
                images: chapterImages,
                createdAt: serverTimestamp()
              });
              await updateDoc(doc(db, 'mangas', selectedMangaId), {
                updatedAt: serverTimestamp(),
                lastChapterNumber: Number(chapterNumber)
              });
              alert('تم نشر الفصل بنجاح');
              setMode('manage');
            }
            setEditingChapter(null);
            setChapterTitle('');
            setChapterImages([]);
          } catch (error) {
            console.error(error);
          } finally {
            setIsUploading(false);
          }
        }} className="bg-zinc-900 p-8 rounded-3xl space-y-6 border border-zinc-800">
          <h2 className="text-2xl font-black">{editingChapter ? `تعديل الفصل: ${editingChapter.number}` : 'نشر فصل جديد'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-zinc-400">اختر المانجا</label>
                <select 
                  className="bg-zinc-800 border-none rounded-lg px-4 py-2 outline-none focus:ring-2 ring-blue-500 text-white"
                  value={selectedMangaId}
                  onChange={(e) => setSelectedMangaId(e.target.value)}
                  required
                >
                  <option value="">-- اختر --</option>
                  {myMangas.map(m => (
                    <option key={m.id} value={m.id}>{m.title}</option>
                  ))}
                </select>
              </div>
              <Input label="عنوان الفصل" value={chapterTitle} onChange={(e: any) => setChapterTitle(e.target.value)} required />
              <Input label="رقم الفصل" type="number" value={chapterNumber} onChange={(e: any) => setChapterNumber(e.target.value)} required />
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-zinc-400">صور الفصل ({chapterImages.length})</label>
                <button type="button" onClick={() => setChapterImages([])} className="text-xs text-red-500 hover:underline">مسح الكل</button>
              </div>
              <div 
                onClick={() => document.getElementById('chapter-upload')?.click()}
                className="grid grid-cols-3 gap-2 min-h-[200px] p-4 bg-zinc-800 rounded-2xl border-2 border-dashed border-zinc-700 hover:border-blue-500 transition-colors cursor-pointer"
              >
                {chapterImages.map((src, i) => (
                  <div key={i} className="aspect-[2/3] relative rounded-lg overflow-hidden group">
                    <img src={src} className="w-full h-full object-cover" alt="" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-white font-black text-xl">{i + 1}</span>
                    </div>
                  </div>
                ))}
                <div className="aspect-[2/3] flex items-center justify-center bg-zinc-700 rounded-lg">
                  <Plus size={24} />
                </div>
              </div>
              <input id="chapter-upload" type="file" hidden multiple accept="image/*" onChange={(e) => handleFileUpload(e)} />
            </div>
          </div>
          <Button disabled={isUploading} className="w-full bg-blue-600 py-4 rounded-2xl text-lg font-black">{isUploading ? 'جاري الرفع...' : 'نشر الفصل'}</Button>
        </form>
      ) : null}
    </div>
  );
}

function DownloadsView({ downloads, mangas, onRemove, onSelectChapter }: any) {
  // Group downloads by manga
  const groupedDownloads = downloads.reduce((acc: any, curr: OfflineChapter) => {
    if (!acc[curr.mangaId]) {
      acc[curr.mangaId] = {
        mangaId: curr.mangaId,
        mangaTitle: curr.mangaTitle,
        coverUrl: curr.coverUrl,
        chapters: []
      };
    }
    acc[curr.mangaId].chapters.push(curr);
    return acc;
  }, {});

  const downloadList = Object.values(groupedDownloads);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between">
        <h2 className="text-4xl font-black">تحميلاتي (أوفلاين)</h2>
        <div className="bg-blue-600/10 text-blue-500 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border border-blue-500/20">
          وضع عدم الاتصال نشط
        </div>
      </div>
      
      {downloadList.length > 0 ? (
        <div className="grid gap-6">
          {downloadList.map((manga: any) => (
            <div key={manga.mangaId} className="bg-zinc-900 rounded-[32px] overflow-hidden border border-zinc-800 shadow-2xl">
              <div className="p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
                <img src={manga.coverUrl} className="w-24 h-32 object-cover rounded-2xl shadow-2xl border border-zinc-800" alt="" />
                <div className="flex-grow text-center md:text-right">
                  <h3 className="text-2xl font-black mb-1">{manga.mangaTitle}</h3>
                  <p className="text-zinc-500 font-bold">{manga.chapters.length} فصول محفوظة محلياً</p>
                </div>
              </div>
              
              <div className="border-t border-zinc-800 bg-zinc-950/40 divide-y divide-zinc-800/50">
                {manga.chapters.map((chap: OfflineChapter) => (
                  <div key={chap.id} className="flex items-center justify-between p-4 md:px-8 hover:bg-zinc-900/80 transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center font-black text-zinc-500 group-hover:text-blue-500 transition-colors">
                        {chap.chapterNumber}
                      </div>
                      <button 
                        onClick={() => {
                          const originalManga = mangas.find((m: any) => m.id === manga.mangaId);
                          if (originalManga) {
                            onSelectChapter(originalManga, { 
                              id: chap.id, 
                              title: chap.chapterTitle, 
                              number: chap.chapterNumber, 
                              images: chap.images 
                            });
                          }
                        }} 
                        className="text-lg font-black group-hover:text-blue-500 transition-colors"
                      >
                        {chap.chapterTitle}
                      </button>
                    </div>
                    <button 
                      onClick={() => onRemove(chap.id)} 
                      className="p-3 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded-2xl transition-all"
                      title="حذف من الجهاز"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-24 text-center bg-zinc-900/50 rounded-[40px] border border-dashed border-zinc-800">
          <Download size={80} className="mx-auto text-zinc-800 mb-6" />
          <h3 className="text-2xl font-black text-zinc-500">لا يوجد محتوى أوفلاين</h3>
          <p className="text-zinc-600 font-medium mt-2">حمل فصولك المفضلة لقراءتها في أي مكان وبدون إنترنت</p>
        </div>
      )}
    </div>
  );
}

function AdminDashboard({ profile }: { profile: UserProfile }) {
  const [isWiping, setIsWiping] = useState(false);
  const stats = [
    { label: 'رصيد USDT المتاح', value: `$${profile.usdtBalance.toFixed(2)}`, icon: <Wallet className="text-green-500" />, sub: 'رصيد محفظة الأرباح' },
    { label: 'إجمالي المشاهدات', value: '12.4K', icon: <Eye className="text-blue-500" />, sub: 'جميع أعمالك' },
    { label: 'تحويلات معلقة', value: '0', icon: <RefreshCcw className="text-yellow-500" />, sub: 'قيد المراجعة' },
    { label: 'إجمالي الأرباح', value: '$84.20', icon: <DollarSign className="text-emerald-500" />, sub: 'منذ الانضمام' }
  ];

  const transactions = [
    { id: '1', date: '2024-03-20', amount: '+ $15.00', status: 'مكتمل', method: 'USDT (TRC20)' },
    { id: '2', date: '2024-03-15', amount: '+ $10.00', status: 'مكتمل', method: 'USDT (TRC20)' },
    { id: '3', date: '2024-03-10', amount: '+ $25.50', status: 'مكتمل', method: 'USDT (TRC20)' }
  ];

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-l from-blue-600/20 to-transparent p-8 rounded-[40px] border border-blue-500/20">
        <div>
          <h2 className="text-4xl font-black mb-2 flex items-center gap-3">
            <ShieldCheck className="text-blue-500" size={36} />
            لوحة تحكم المسؤول
          </h2>
          <p className="text-zinc-400 font-bold">مرحباً بك مجدداً. إليك تفاصيل أرباحك وإحصائياتك.</p>
        </div>
        <div className="flex items-center gap-4">
          <Button 
            disabled={isWiping}
            onClick={async () => {
              if (confirm('هل أنت متأكد من حذف *جميع* الأعمال والفصول والتعليقات نهائياً من قاعدة البيانات؟ لا يمكن التراجع عن هذا!')) {
                setIsWiping(true);
                try {
                  const q = query(collection(db, 'mangas'));
                  const snap = await getDocs(q);
                  
                  // Delete things in parallel batches to be faster
                  const deleteTasks = snap.docs.map(async (docSnap) => {
                    const mangaId = docSnap.id;
                    
                    // Parallel subcollection cleanup
                    const [cSnap, commSnap] = await Promise.all([
                      getDocs(collection(db, 'mangas', mangaId, 'chapters')),
                      getDocs(collection(db, 'mangas', mangaId, 'comments'))
                    ]);
                    
                    const subDeletes = [];
                    cSnap.forEach(c => subDeletes.push(deleteDoc(doc(db, 'mangas', mangaId, 'chapters', c.id))));
                    commSnap.forEach(c => subDeletes.push(deleteDoc(doc(db, 'mangas', mangaId, 'comments', c.id))));
                    
                    await Promise.all(subDeletes);
                    await deleteDoc(doc(db, 'mangas', mangaId));
                  });

                  await Promise.all(deleteTasks);
                  alert('تم تنظيف قاعدة البيانات بالكامل.');
                  window.location.reload();
                } catch (err: any) {
                  alert('فشل الحذف: ' + err.message);
                } finally {
                  setIsWiping(false);
                }
              }
            }}
            className={cn(
              "bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white px-6 py-4 rounded-2xl font-black transition-all flex items-center gap-2 border border-red-500/20 shadow-xl shadow-red-900/10",
              isWiping && "opacity-50 cursor-wait"
            )}
          >
            {isWiping ? <RefreshCcw className="animate-spin" size={20} /> : <Trash2 size={20} />}
            {isWiping ? 'جاري المسح...' : 'مسح كل البيانات'}
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-500 px-8 py-4 rounded-2xl font-black text-lg flex items-center gap-3 shadow-2xl shadow-blue-900/40">
            <Wallet size={20} /> سحب الأرباح (USDT)
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-zinc-900 p-6 rounded-[32px] border border-zinc-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="p-3 bg-zinc-800 rounded-2xl">{stat.icon}</div>
              <TrendingUp size={16} className="text-green-500" />
            </div>
            <div>
              <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest mb-1">{stat.label}</p>
              <h4 className="text-3xl font-black">{stat.value}</h4>
              <p className="text-[10px] text-zinc-600 font-bold mt-1">{stat.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-2xl font-black flex items-center gap-3">
             <BarChart3 className="text-blue-500" />
             سجل السحوبات والمعاملات
          </h3>
          <div className="bg-zinc-900 rounded-[32px] border border-zinc-800 overflow-hidden shadow-2xl">
            <table className="w-full text-right">
              <thead>
                <tr className="bg-zinc-800/50">
                  <th className="px-6 py-4 font-black text-sm text-zinc-500">التاريخ</th>
                  <th className="px-6 py-4 font-black text-sm text-zinc-500">القيمة</th>
                  <th className="px-6 py-4 font-black text-sm text-zinc-500">الوسيلة</th>
                  <th className="px-6 py-4 font-black text-sm text-zinc-500">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-sm">{tx.date}</td>
                    <td className="px-6 py-4 font-black text-green-500">{tx.amount}</td>
                    <td className="px-6 py-4 font-bold text-xs text-zinc-400">{tx.method}</td>
                    <td className="px-6 py-4">
                       <span className="bg-green-500/10 text-green-500 px-3 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 w-fit">
                         <CheckCircle2 size={10} /> {tx.status}
                       </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
           <h3 className="text-2xl font-black flex items-center gap-3">
             <Settings className="text-blue-500" />
             إعدادات الدفع
          </h3>
          <div className="bg-zinc-900 p-8 rounded-[32px] border border-zinc-800 shadow-2xl space-y-6">
            <div className="space-y-4">
               <div>
                 <label className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-2 block">عنوان محفظة USDT (TRC20)</label>
                 <div className="flex gap-2">
                   <div className="bg-zinc-800 px-4 py-3 rounded-xl flex-grow font-mono text-xs truncate border border-zinc-700">TXvQ...8eK9</div>
                   <button className="bg-blue-600/20 text-blue-500 p-3 rounded-xl hover:bg-blue-600/30 transition-all"><Edit size={16}/></button>
                 </div>
               </div>
            </div>
            <div className="p-4 bg-yellow-500/10 rounded-2xl border border-yellow-500/20 text-xs font-bold leading-relaxed text-yellow-500/80">
              تنبيه: يرجى التأكد من أن العنوان يدعم شبكة TRC20 لتجنب ضياع الأرباح عند السحب.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MangaDetailView({ manga, onBack, onRead, onLibraryAction, isFavorite, isReadingNow, isReadLater, onDownload, user, onTranslatorClick }: any) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(manga.title);
  const [editedCover, setEditedCover] = useState(manga.coverUrl);
  const [editedDesc, setEditedDesc] = useState(manga.description);
  const [showOptions, setShowOptions] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'mangas', manga.id, 'chapters'), orderBy('number', 'asc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setChapters(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chapter)));
    });
    // Increment views
    updateDoc(doc(db, 'mangas', manga.id), { views: increment(1) });
    return unsubscribe;
  }, [manga.id]);

  useEffect(() => {
    const q = query(collection(db, 'mangas', manga.id, 'comments'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setComments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment)));
    });
    return unsubscribe;
  }, [manga.id]);

  const handlePostComment = async () => {
    if (!user || !commentText) return;
    await addDoc(collection(db, 'mangas', manga.id, 'comments'), {
      userId: user.uid,
      userName: user.displayName,
      userAvatar: user.photoURL,
      text: commentText,
      createdAt: serverTimestamp()
    });
    setCommentText('');
  };

  const handleLike = async () => {
    if (!user) return alert('يرجى تسجيل الدخول');
    await updateDoc(doc(db, 'mangas', manga.id), { likes: increment(1) });
  };

  const handleUpdateManga = async () => {
    await updateDoc(doc(db, 'mangas', manga.id), {
      title: editedTitle,
      coverUrl: editedCover,
      description: editedDesc
    });
    setIsEditing(false);
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-left-4 duration-700 max-w-7xl mx-auto pb-20">
      <button onClick={onBack} className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors group">
        <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
          <ChevronRight size={20} /> 
        </div>
        العودة
      </button>

      <div className="flex flex-col lg:flex-row gap-12">
        <div className="lg:w-1/3 space-y-8">
          <div className="space-y-6">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-t from-blue-600 to-blue-400 rounded-3xl blur opacity-25" />
              <img src={isEditing ? editedCover : manga.coverUrl} className="relative w-full aspect-[3/4] object-cover rounded-2xl shadow-2xl border border-zinc-800" alt="" />
              {isEditing && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-2xl z-20">
                   <button onClick={() => document.getElementById('edit-cover')?.click()} className="bg-white/10 backdrop-blur-md p-4 rounded-full hover:bg-white/20 transition-all">
                    <Edit size={24} />
                   </button>
                   <input id="edit-cover" type="file" hidden onChange={(e: any) => {
                      const file = e.target.files[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => setEditedCover(reader.result as string);
                        reader.readAsDataURL(file);
                      }
                   }} />
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex-grow">
                  {isEditing ? (
                    <Input value={editedTitle} onChange={(e: any) => setEditedTitle(e.target.value)} className="text-2xl font-black bg-zinc-800/50 p-2 rounded-xl" />
                  ) : (
                    <h2 className="text-3xl font-black text-white leading-tight">{manga.title}</h2>
                  )}
                  <p className="text-zinc-500 font-bold text-sm mt-1">{manga.author}</p>
                  {manga.creatorName && (
                    <button 
                      onClick={() => onTranslatorClick(manga.creatorName)}
                      className="text-blue-500 font-black text-xs mt-2 hover:underline flex items-center gap-1"
                    >
                      المترجم: {manga.creatorName}
                    </button>
                  )}
                </div>
                
                <div className="relative">
                  <button 
                    onClick={() => setShowOptions(!showOptions)}
                    className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-xl border border-zinc-800 text-zinc-400 transition-all"
                  >
                    <MoreVertical size={24} />
                  </button>

                  <AnimatePresence>
                    {showOptions && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowOptions(false)} />
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.9, x: 20 }}
                          animate={{ opacity: 1, scale: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.9, x: 20 }}
                          className="absolute left-0 top-12 w-56 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden"
                        >
                          <button onClick={() => { onLibraryAction(manga.id, 'readingNow'); setShowOptions(false); }} className={cn("w-full px-5 py-3.5 text-right font-bold hover:bg-zinc-800 flex items-center justify-between transition-colors", isReadingNow ? "text-blue-500" : "text-white")}>
                            {isReadingNow ? 'أقرأه حالياً' : 'اقرأ الآن'} <Eye size={18}/>
                          </button>
                          <button onClick={() => { onLibraryAction(manga.id, 'readLater'); setShowOptions(false); }} className={cn("w-full px-5 py-3.5 text-right font-bold hover:bg-zinc-800 flex items-center justify-between border-t border-zinc-800 transition-colors", isReadLater ? "text-blue-500" : "text-white")}>
                            {isReadLater ? 'سأقرأه' : 'اقرأ لاحقاً'} <History size={18}/>
                          </button>
                          <button onClick={() => { onLibraryAction(manga.id, 'favorites'); setShowOptions(false); }} className={cn("w-full px-5 py-3.5 text-right font-bold hover:bg-zinc-800 flex items-center justify-between border-t border-zinc-800 transition-colors", isFavorite ? "text-red-500" : "text-white")}>
                            {isFavorite ? 'بالمفضلة' : 'إضافة للمفضلة'} <Heart size={18}/>
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {isEditing ? (
                <TextArea value={editedDesc} onChange={(e: any) => setEditedDesc(e.target.value)} className="bg-zinc-800 border-zinc-700 min-h-[150px] text-sm" />
              ) : (
                <p className="text-zinc-400 leading-relaxed text-sm font-medium">
                  {manga.description}
                </p>
              )}

              <div className="flex flex-wrap gap-3 pt-2">
                <div className="flex items-center gap-1.5 bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-800">
                  <Star size={14} className="text-yellow-500" fill="currentColor" />
                  <span className="text-xs font-black">4.9</span>
                </div>
                <div className="flex items-center gap-1.5 bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-800">
                  <Eye size={14} className="text-blue-500" />
                  <span className="text-xs font-black">{manga.views}</span>
                </div>
                <button 
                  onClick={handleLike}
                  className="flex items-center gap-1.5 bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-800 hover:bg-zinc-800 transition-colors"
                >
                  <Heart size={14} className="text-red-500" />
                  <span className="text-xs font-black">{manga.likes}</span>
                </button>
              </div>
            </div>

            {user?.uid === manga.creatorId && (
              <div className="pt-4">
                {isEditing ? (
                  <div className="flex gap-2">
                    <Button onClick={handleUpdateManga} className="flex-grow bg-green-600 py-3 rounded-xl font-black">حفظ</Button>
                    <button onClick={() => setIsEditing(false)} className="bg-zinc-900 px-6 rounded-xl border border-zinc-800 font-black">إلغاء</button>
                  </div>
                ) : (
                  <Button onClick={() => setIsEditing(true)} className="w-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 flex items-center justify-center gap-2 py-3 rounded-xl font-black">
                    <Edit size={18} /> تعديل العمل
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="lg:w-2/3 space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
            <h3 className="text-2xl font-black flex items-center gap-3">
              <BookOpen className="text-blue-500" size={24} /> 
              الفصول المتاحة ({chapters.length})
            </h3>
          </div>
          
          <div className="grid gap-3 overflow-y-auto max-h-[600px] custom-scrollbar pr-2">
            {chapters.map(chap => (
              <div key={chap.id} className="group relative bg-zinc-900/40 p-5 rounded-2xl flex items-center justify-between hover:bg-zinc-900 transition-all border border-transparent hover:border-zinc-800 shadow-sm">
                 <div className="flex items-center gap-4">
                   <span className="text-zinc-600 font-black text-2xl group-hover:text-blue-500/20 transition-colors">#{chap.number}</span>
                   <div>
                     <button onClick={() => onRead(chap)} className="text-lg font-black group-hover:text-blue-500 transition-colors text-right">{chap.title}</button>
                     <p className="text-[10px] text-zinc-500 mt-1 font-bold">{formatDate(chap.createdAt)}</p>
                   </div>
                 </div>
                 <div className="flex items-center gap-2">
                   <button 
                     onClick={() => onDownload(manga, chap)}
                     className="p-3 text-zinc-500 hover:text-blue-500 hover:bg-blue-500/10 rounded-xl transition-all"
                     title="تحميل الفصل"
                   >
                     <Download size={20} />
                   </button>
                   <button onClick={() => onRead(chap)} className="bg-zinc-800 group-hover:bg-blue-600 p-3 rounded-xl transition-all">
                     <ChevronLeft size={20} />
                   </button>
                 </div>
              </div>
            ))}
          </div>
          
          <div className="pt-8 border-t border-zinc-900 space-y-8">
            <h3 className="text-2xl font-black flex items-center gap-3">
              <MessageSquare className="text-blue-500" size={24} />
              التعليقات
            </h3>
            
            {user ? (
              <div className="flex gap-4 items-start">
                <img src={user.photoURL || ''} className="w-10 h-10 rounded-full border-2 border-blue-500" alt="" />
                <div className="flex-grow space-y-3">
                  <textarea 
                    placeholder="شاركنا رأيك في هذا العمل..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 outline-none focus:ring-2 ring-blue-500 text-white min-h-[100px]"
                  />
                  <div className="flex justify-end">
                    <Button onClick={handlePostComment} className="bg-blue-600 hover:bg-blue-500 py-2 px-8 rounded-xl font-black">نشر التعليق</Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-zinc-900/50 p-6 rounded-3xl text-center border border-dashed border-zinc-800">
                <p className="text-zinc-500 font-bold text-sm mb-4">يجب عليك تسجيل الدخول للمشاركة في النقاش</p>
                <Button onClick={() => loginWithGoogle()} className="bg-blue-600 px-8 rounded-xl text-sm">تسجيل الدخول</Button>
              </div>
            )}

            <div className="space-y-6">
              {comments.map(comment => (
                <div key={comment.id} className="flex gap-4 animate-in slide-in-from-bottom-2 duration-300">
                  <img src={comment.userAvatar || ''} className="w-10 h-10 rounded-full border border-zinc-800" alt="" />
                  <div className="flex-grow bg-zinc-900/50 p-4 rounded-2xl rounded-tr-none border border-zinc-900">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black text-sm text-blue-500">{comment.userName}</span>
                      <span className="text-[10px] text-zinc-500">{formatDate(comment.createdAt)}</span>
                    </div>
                    <div className="text-zinc-300 text-sm font-medium">
                      {comment.text}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryView({ onSelectManga, onHistoryClear }: any) {
  const { user } = useAuth();
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'users', user.uid, 'history'),
      orderBy('readAt', 'desc'),
      limit(50)
    );
    return onSnapshot(q, (snap) => {
      setHistory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, [user]);

  if (!user) {
    return (
      <div className="py-20 flex flex-col items-center gap-4 text-zinc-500">
        <LogIn size={64} className="opacity-20" />
        <p className="font-bold">سجل دخولك لمشاهدة سجل القراءة</p>
      </div>
    );
  }

  return (
     <div className="space-y-8 animate-in fade-in duration-500">
       <div className="flex items-center justify-between">
         <h2 className="text-4xl font-black">سجل المشاهدة</h2>
         {history.length > 0 && (
            <button onClick={onHistoryClear} className="text-zinc-500 hover:text-red-500 text-sm font-bold flex items-center gap-2">
              <Trash2 size={16} /> مسح السجل
            </button>
         )}
       </div>
       
       {history.length > 0 ? (
         <div className="grid gap-4">
           {history.map(item => (
             <div key={item.id} className="bg-zinc-900/50 p-4 rounded-3xl border border-zinc-800 flex items-center gap-4 hover:bg-zinc-900 transition-all group">
               <img src={item.mangaCover} className="w-16 h-20 object-cover rounded-xl shadow-lg" alt="" />
               <div className="flex-grow">
                 <h4 className="font-black text-lg group-hover:text-blue-500 transition-colors cursor-pointer" onClick={() => onSelectManga(item.mangaId)}>{item.mangaTitle}</h4>
                 <p className="text-sm text-zinc-500 font-bold">الفصل {item.chapterNumber}: {item.chapterTitle}</p>
                 <p className="text-[10px] text-zinc-600 mt-1">{formatDate(item.readAt)}</p>
               </div>
               <button 
                 onClick={() => onSelectManga(item.mangaId)}
                 className="bg-zinc-800 p-3 rounded-xl hover:bg-blue-600 transition-all"
               >
                 <Eye size={20} />
               </button>
             </div>
           ))}
         </div>
       ) : (
         <div className="py-20 flex flex-col items-center gap-4 text-zinc-500">
           <History size={64} className="opacity-20" />
           <p className="font-bold">لا يوجد سجل مشاهدة حالياً</p>
         </div>
       )}
     </div>
  );
}

function ChapterView({ chapter, manga, onBack }: { chapter: Chapter, manga: Manga, onBack: () => void }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [reactions, setReactions] = useState<any>({});
  const [userReaction, setUserReaction] = useState<string | null>(null);

  const EMOJIS = ['❤️', '🔥', '😂', '😮', '😢', '👏'];

  useEffect(() => {
    if (!user) return;
    const recordHistory = async () => {
      const historyRef = collection(db, 'users', user.uid, 'history');
      await setDoc(doc(historyRef, manga.id), {
        mangaId: manga.id,
        mangaTitle: manga.title,
        mangaCover: manga.coverUrl,
        chapterId: chapter.id,
        chapterNumber: chapter.number,
        chapterTitle: chapter.title,
        readAt: serverTimestamp()
      });
    };
    recordHistory();
  }, [user, manga.id, chapter.id]);

  useEffect(() => {
    const q = query(collection(db, 'mangas', manga.id, 'chapters', chapter.id, 'comments'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setComments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment)));
    });
    return unsubscribe;
  }, [manga.id, chapter.id]);

  useEffect(() => {
    const q = collection(db, 'mangas', manga.id, 'chapters', chapter.id, 'reactions');
    const unsubscribe = onSnapshot(q, (snap) => {
      const counts: any = {};
      snap.docs.forEach(doc => {
        const type = doc.data().type;
        counts[type] = (counts[type] || 0) + 1;
        if (user && doc.id === user.uid) {
          setUserReaction(type);
        }
      });
      setReactions(counts);
    });
    return unsubscribe;
  }, [manga.id, chapter.id, user]);

  const handlePostComment = async () => {
    if (!user || !commentText) return;
    await addDoc(collection(db, 'mangas', manga.id, 'chapters', chapter.id, 'comments'), {
      userId: user.uid,
      userName: user.displayName,
      userAvatar: user.photoURL,
      text: commentText,
      createdAt: serverTimestamp()
    });
    setCommentText('');
  };

  const handleReact = async (type: string) => {
    if (!user) return alert('يرجى تسجيل الدخول للتفاعل');
    const reactionRef = doc(db, 'mangas', manga.id, 'chapters', chapter.id, 'reactions', user.uid);
    if (userReaction === type) {
      await deleteDoc(reactionRef);
      setUserReaction(null);
    } else {
      await setDoc(reactionRef, { type, createdAt: serverTimestamp() });
      setUserReaction(type);
    }
  };

  return (
    <div className="space-y-8 max-w-screen-md mx-auto animate-in fade-in duration-700">
      <div className="sticky top-20 z-40 flex items-center justify-between bg-zinc-950/80 backdrop-blur-md p-4 rounded-2xl border border-zinc-900 shadow-2xl transition-all">
        <button onClick={onBack} className="p-2 hover:bg-zinc-900 rounded-lg transition-colors"><ChevronRight size={24} /></button>
        <div className="text-center">
          <h4 className="font-black text-sm uppercase text-blue-500">{manga.title}</h4>
          <p className="font-bold underline cursor-default">الفصل {chapter.number}: {chapter.title}</p>
        </div>
        <div className="w-10" />
      </div>

      <div className="flex flex-col items-center gap-0">
        {chapter.images.map((img, i) => (
          <img key={i} src={img} className="w-full h-auto select-none" alt={`Page ${i + 1}`} referrerPolicy="no-referrer" />
        ))}
      </div>

      <div className="py-12 space-y-12">
        <div className="flex flex-col items-center gap-6">
          <div className="w-20 h-1 bg-zinc-900 rounded-full" />
          <h3 className="text-xl font-black text-zinc-400">تفاعل مع الفصل</h3>
          
          <div className="flex flex-wrap justify-center gap-3">
            {EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => handleReact(emoji)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-2xl border transition-all active:scale-90",
                  userReaction === emoji 
                    ? "bg-blue-600 border-blue-500 scale-110 shadow-lg shadow-blue-950/40" 
                    : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
                )}
              >
                <span className="text-2xl">{emoji}</span>
                <span className="font-black text-sm">{reactions[emoji] || 0}</span>
              </button>
            ))}
          </div>

          <Button onClick={onBack} className="bg-blue-600 px-12 py-4 rounded-2xl text-lg font-black shadow-2xl shadow-blue-950/40 mt-4">العودة للتفاصيل</Button>
        </div>

        {/* Chapter Comments */}
        <div className="border-t border-zinc-900 pt-12 space-y-8">
          <h3 className="text-2xl font-black flex items-center gap-3">
            <MessageSquare className="text-blue-500" size={24} />
            تعليقات الفصل ({comments.length})
          </h3>

          {user ? (
            <div className="flex gap-4 items-start">
              <img src={user.photoURL || ''} className="w-10 h-10 rounded-full border-2 border-blue-500" alt="" />
              <div className="flex-grow space-y-3">
                <textarea 
                  placeholder="رأيك في الفصل..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 outline-none focus:ring-2 ring-blue-500 text-white min-h-[100px]"
                />
                <div className="flex justify-end">
                  <Button onClick={handlePostComment} className="bg-blue-600 hover:bg-blue-500 py-2 px-6 rounded-xl text-sm font-black">نشر</Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-zinc-900/50 p-6 rounded-3xl text-center border border-dashed border-zinc-800">
              <p className="text-zinc-500 font-bold text-sm">سجل دخولك لتشاركنا رأيك!</p>
            </div>
          )}

          <div className="space-y-6">
            {comments.map(comment => (
              <div key={comment.id} className="flex gap-3">
                <img src={comment.userAvatar || ''} className="w-10 h-10 rounded-full border border-zinc-800 shadow-lg" alt="" />
                <div className="flex-grow bg-zinc-900/50 p-4 rounded-2xl rounded-tr-none border border-zinc-900">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-black text-sm text-blue-500">{comment.userName}</span>
                    <span className="text-[10px] text-zinc-500">{formatDate(comment.createdAt)}</span>
                  </div>
                  <div className="text-zinc-300 text-sm font-medium">
                    {comment.text}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
