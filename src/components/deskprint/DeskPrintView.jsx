import React, { useState, useEffect } from 'react';
import {
  FolderKanban,
  FolderPlus,
  Image as ImageIcon,
  Upload,
  Trash2,
  Search,
  Plus,
  CheckCircle2,
  AlertCircle,
  Eye,
  RefreshCw,
  Folder,
  Layers,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { supabase } from '../../supabaseClient';

export default function DeskPrintView({ isDarkMode, onOpenImageModal }) {
  const [folders, setFolders] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDesc, setNewFolderDesc] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Load Initial Folders from LocalStorage & Supabase
  useEffect(() => {
    loadFolders();
  }, []);

  const extractCoreCode = (str) => {
    if (!str) return '';
    const cleanStr = String(str).replace(/\.[^/.]+$/, ''); // Strip extension
    const parts = cleanStr.split(/[-._]/);
    const lastPart = parts[parts.length - 1].trim();
    const match = lastPart.match(/(\d+)$/);
    return match ? match[1] : cleanStr;
  };

  const loadFolders = async () => {
    // 1. Load local fallback
    const localData = localStorage.getItem('desk_print_folders');
    let initialFolders = [];
    if (localData) {
      try {
        initialFolders = JSON.parse(localData);
      } catch (e) {
        console.error('Failed to parse local desk_print_folders:', e);
      }
    }

    // Default sample folder if empty
    if (initialFolders.length === 0) {
      initialFolders = [
        {
          id: 'folder-demo-01',
          name: 'Promo Kawan Lama Oktober 2026',
          description: 'Folder gambar desain promo master cabang Kawan Lama',
          created_at: new Date().toISOString(),
          images: []
        }
      ];
      localStorage.setItem('desk_print_folders', JSON.stringify(initialFolders));
    }

    setFolders(initialFolders);
    if (!selectedFolderId && initialFolders.length > 0) {
      setSelectedFolderId(initialFolders[0].id);
    }

    // Sync window global variable for Packing Station access
    syncGlobalFolders(initialFolders);

    // 2. Try fetching from Supabase table if available
    try {
      const { data, error } = await supabase.from('desk_print_folders').select('*').order('id', { ascending: false });
      if (!error && data && data.length > 0) {
        setFolders(data);
        syncGlobalFolders(data);
      }
    } catch (e) {
      // Supabase table fallback
    }
  };

  const syncGlobalFolders = (folderData) => {
    window.__DESK_PRINT_FOLDERS__ = folderData;
    // Map code -> url into active design urls map
    const activeUrls = {};
    folderData.forEach(folder => {
      (folder.images || []).forEach(img => {
        if (img.item_code) {
          const cleanKey = String(img.item_code).toLowerCase().replace(/[^a-z0-9]/g, '');
          activeUrls[cleanKey] = img.image_url;
        }
        if (img.core_code) {
          activeUrls[img.core_code] = img.image_url;
        }
      });
    });
    window.__ACTIVE_DESIGN_URLS__ = { ...(window.__ACTIVE_DESIGN_URLS__ || {}), ...activeUrls };
  };

  const saveFoldersState = async (updatedFolders) => {
    setFolders(updatedFolders);
    localStorage.setItem('desk_print_folders', JSON.stringify(updatedFolders));
    syncGlobalFolders(updatedFolders);

    // Try saving to Supabase if table exists
    try {
      await supabase.from('desk_print_folders').upsert(updatedFolders);
    } catch (e) {
      // Ignore if Supabase table not created yet
    }
  };

  const handleCreateFolder = (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return alert('⚠️ Silakan masukkan nama Folder Project.');

    const newFolder = {
      id: `folder-${Date.now()}`,
      name: newFolderName.trim(),
      description: newFolderDesc.trim() || 'Folder Gambar Desain Master',
      created_at: new Date().toISOString(),
      images: []
    };

    const updated = [newFolder, ...folders];
    saveFoldersState(updated);
    setSelectedFolderId(newFolder.id);

    setNewFolderName('');
    setNewFolderDesc('');
    setIsCreatingFolder(false);
  };

  const handleDeleteFolder = (folderId, folderName) => {
    if (!window.confirm(`Hapus folder project "${folderName}" beserta seluruh gambar di dalamnya?`)) return;

    const updated = folders.filter(f => f.id !== folderId);
    saveFoldersState(updated);

    if (selectedFolderId === folderId) {
      setSelectedFolderId(updated.length > 0 ? updated[0].id : null);
    }
  };

  const handleUploadImages = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !selectedFolderId) return;

    setIsUploading(true);

    try {
      const processedImages = await Promise.all(
        files.map(file => {
          return new Promise(resolve => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const fileName = file.name;
              const rawCode = fileName.replace(/\.[^/.]+$/, '');
              const coreCode = extractCoreCode(fileName);

              resolve({
                id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                file_name: fileName,
                item_code: rawCode,
                core_code: coreCode,
                image_url: reader.result,
                uploaded_at: new Date().toISOString(),
                size_kb: Math.round(file.size / 1024)
              });
            };
            reader.readAsDataURL(file);
          });
        })
      );

      const updatedFolders = folders.map(folder => {
        if (folder.id === selectedFolderId) {
          return {
            ...folder,
            images: [...processedImages, ...(folder.images || [])]
          };
        }
        return folder;
      });

      await saveFoldersState(updatedFolders);
      alert(`✅ Berhasil menambahkan ${processedImages.length} gambar ke Folder Project!`);
    } catch (err) {
      alert('❌ Gagal upload gambar: ' + err.message);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteImage = (folderId, imageId) => {
    const updatedFolders = folders.map(folder => {
      if (folder.id === folderId) {
        return {
          ...folder,
          images: (folder.images || []).filter(img => img.id !== imageId)
        };
      }
      return folder;
    });

    saveFoldersState(updatedFolders);
  };

  const selectedFolder = folders.find(f => f.id === selectedFolderId);

  const filteredImages = (selectedFolder?.images || []).filter(img => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (img.item_code || '').toLowerCase().includes(term) ||
      (img.file_name || '').toLowerCase().includes(term) ||
      (img.core_code || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className={`min-h-screen p-4 sm:p-6 transition-colors ${isDarkMode ? 'bg-neutral-900 text-stone-100' : 'bg-slate-50 text-stone-900'}`}>
      {/* Header Banner */}
      <div className={`rounded-3xl p-6 sm:p-8 mb-6 border shadow-lg relative overflow-hidden ${
        isDarkMode
          ? 'bg-gradient-to-r from-neutral-800 via-neutral-900 to-stone-900 border-neutral-700'
          : 'bg-gradient-to-r from-teal-700 via-emerald-800 to-slate-900 border-teal-800 text-white'
      }`}>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30 mb-3">
              <Sparkles className="w-3.5 h-3.5" /> Desk Print Repository
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <FolderKanban className="w-8 h-8 text-teal-400" />
              Desk Print
            </h1>
            <p className="text-xs sm:text-sm text-teal-100/80 mt-1 max-w-xl">
              Kelola folder project dan master gambar desain. Gambar di Desk Print otomatis dapat diambil oleh **Packing Station** saat import Excel / Google Sheet.
            </p>
          </div>

          <button
            onClick={() => setIsCreatingFolder(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-bold text-xs bg-teal-400 hover:bg-teal-300 text-stone-950 shadow-lg shadow-teal-500/20 transition-all cursor-pointer active:scale-95"
          >
            <FolderPlus className="w-4 h-4" />
            + Buat Folder Project Baru
          </button>
        </div>
      </div>

      {/* Main Grid: Left Sidebar Folders & Right Folder Contents */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: List of Folders */}
        <div className="lg:col-span-4 space-y-4">
          <div className={`p-5 rounded-3xl border shadow-sm ${
            isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between mb-4 pb-3 border-b dark:border-neutral-700">
              <h2 className="font-bold text-sm uppercase flex items-center gap-2">
                <Folder className="w-4 h-4 text-teal-500" />
                Folder Project ({folders.length})
              </h2>
              <button
                onClick={loadFolders}
                className="p-1.5 rounded-lg text-stone-400 hover:text-teal-500 hover:bg-stone-100 dark:hover:bg-neutral-700 transition-all cursor-pointer"
                title="Reload Folders"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Folder List */}
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {folders.length === 0 ? (
                <div className="text-center py-8 text-stone-400 text-xs">
                  Belum ada folder project. Klik "+ Buat Folder Project Baru".
                </div>
              ) : (
                folders.map(folder => {
                  const isSelected = folder.id === selectedFolderId;
                  const imgCount = (folder.images || []).length;

                  return (
                    <div
                      key={folder.id}
                      onClick={() => setSelectedFolderId(folder.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${
                        isSelected
                          ? 'bg-teal-500/10 border-teal-500/40 text-teal-600 dark:text-teal-300 font-bold shadow-sm'
                          : isDarkMode
                          ? 'bg-neutral-900/60 border-neutral-700/60 hover:bg-neutral-700/50 text-stone-300'
                          : 'bg-stone-50 border-stone-200/80 hover:bg-slate-100 text-stone-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`p-2.5 rounded-xl ${
                          isSelected
                            ? 'bg-teal-500 text-white'
                            : isDarkMode
                            ? 'bg-neutral-800 text-stone-400'
                            : 'bg-white text-stone-500 border border-stone-200'
                        }`}>
                          <Layers className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <h3 className="text-xs font-bold truncate">{folder.name}</h3>
                          <p className="text-[11px] text-stone-400 font-normal truncate mt-0.5">
                            {imgCount} gambar • {folder.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFolder(folder.id, folder.name);
                          }}
                          className="p-1.5 rounded-lg text-stone-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Hapus Folder"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Active Folder Images Gallery */}
        <div className="lg:col-span-8 space-y-4">
          <div className={`p-5 sm:p-6 rounded-3xl border shadow-sm ${
            isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-slate-200'
          }`}>
            {selectedFolder ? (
              <>
                {/* Active Folder Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b dark:border-neutral-700">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-teal-500">Folder Aktif</span>
                    <h2 className="text-lg font-bold flex items-center gap-2 text-stone-900 dark:text-white">
                      <FolderKanban className="w-5 h-5 text-teal-500" />
                      {selectedFolder.name}
                    </h2>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {selectedFolder.description} • {(selectedFolder.images || []).length} File Desain Tersimpan
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer active:scale-95">
                      <Upload className="w-4 h-4" />
                      {isUploading ? 'Mengunggah...' : '+ Upload Gambar Desain'}
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleUploadImages}
                        disabled={isUploading}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Filter & Search Bar */}
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      type="text"
                      placeholder="Cari kode item atau nama file gambar..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className={`w-full pl-10 pr-4 py-2.5 rounded-2xl border text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                        isDarkMode
                          ? 'bg-neutral-900 border-neutral-700 text-white'
                          : 'bg-stone-50 border-stone-200 text-stone-800'
                      }`}
                    />
                  </div>
                </div>

                {/* Image Grid */}
                {filteredImages.length === 0 ? (
                  <div className="text-center py-16 border-2 border-dashed rounded-3xl border-stone-200 dark:border-neutral-700">
                    <ImageIcon className="w-12 h-12 text-stone-300 dark:text-neutral-600 mx-auto mb-3" />
                    <h3 className="text-sm font-bold text-stone-500 dark:text-stone-400">Belum ada gambar di folder ini</h3>
                    <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
                      Klik tombol "+ Upload Gambar Desain" di atas untuk menambahkan gambar masal ke folder project ini.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {filteredImages.map(img => (
                      <div
                        key={img.id}
                        className={`group rounded-2xl border overflow-hidden transition-all duration-200 hover:shadow-lg flex flex-col ${
                          isDarkMode
                            ? 'bg-neutral-900 border-neutral-700'
                            : 'bg-stone-50 border-stone-200'
                        }`}
                      >
                        {/* Image Preview Container */}
                        <div className="relative aspect-square bg-stone-200 dark:bg-neutral-950 overflow-hidden flex items-center justify-center p-2">
                          <img
                            src={img.image_url}
                            alt={img.item_code}
                            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                              onClick={() => onOpenImageModal && onOpenImageModal(img.image_url, img.item_code, selectedFolder.name)}
                              className="p-2 bg-white/90 rounded-full text-stone-900 hover:bg-white transition-all cursor-pointer"
                              title="Lihat HD"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteImage(selectedFolder.id, img.id)}
                              className="p-2 bg-rose-600/90 rounded-full text-white hover:bg-rose-600 transition-all cursor-pointer"
                              title="Hapus Gambar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Details Footer */}
                        <div className="p-3 flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="inline-block px-2 py-0.5 text-[10px] font-black uppercase rounded bg-teal-500/10 text-teal-600 dark:text-teal-400">
                                {img.core_code ? `Core: ${img.core_code}` : 'ITEM'}
                              </span>
                              <span className="text-[10px] text-stone-400">{img.size_kb} KB</span>
                            </div>
                            <p className="text-xs font-bold truncate text-stone-900 dark:text-white" title={img.item_code}>
                              {img.item_code}
                            </p>
                            <p className="text-[10px] text-stone-400 truncate mt-0.5">{img.file_name}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-20 text-stone-400 text-sm">
                Silakan pilih atau buat Folder Project di sebelah kiri.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Buat Folder Project Baru */}
      {isCreatingFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-md rounded-3xl p-6 shadow-2xl border ${
            isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-stone-200 text-stone-900'
          }`}>
            <div className="flex justify-between items-center mb-4 pb-3 border-b dark:border-neutral-700">
              <h3 className="font-bold text-sm uppercase flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-teal-500" /> Buat Folder Project Baru
              </h3>
              <button
                onClick={() => setIsCreatingFolder(false)}
                className="w-8 h-8 rounded-full bg-stone-100 dark:bg-neutral-700 flex items-center justify-center font-bold text-stone-500 hover:bg-rose-500 hover:text-white transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1 text-stone-500 dark:text-stone-400">Nama Folder Project *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Promo Kawan Lama Oktober 2026"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-2xl border text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                    isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-stone-50 border-stone-200 text-stone-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-stone-500 dark:text-stone-400">Deskripsi / Catatan (Opsional)</label>
                <textarea
                  rows={3}
                  placeholder="Contoh: Folder gambar desain master untuk cabang Cikokol & Pasming"
                  value={newFolderDesc}
                  onChange={(e) => setNewFolderDesc(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-2xl border text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                    isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-stone-50 border-stone-200 text-stone-900'
                  }`}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingFolder(false)}
                  className="px-4 py-2 bg-stone-200 dark:bg-neutral-700 text-stone-700 dark:text-stone-300 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer"
                >
                  Simpan Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
