import React, { useState, useEffect } from 'react';
import {
  FolderKanban,
  FolderPlus,
  Image as ImageIcon,
  Upload,
  Trash2,
  Search,
  Eye,
  RefreshCw,
  Folder,
  Layers
} from 'lucide-react';

export default function DeskPrintView({ isDarkMode, onOpenImageModal }) {
  const [folders, setFolders] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDesc, setNewFolderDesc] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    loadFolders();
  }, []);

  const extractCoreCode = (str) => {
    if (!str) return '';
    const cleanStr = String(str).replace(/\.[^/.]+$/, '');
    const parts = cleanStr.split(/[-._]/);
    const lastPart = parts[parts.length - 1].trim();
    const match = lastPart.match(/(\d+)$/);
    return match ? match[1] : cleanStr;
  };

  const loadFolders = async () => {
    const localData = localStorage.getItem('desk_print_folders');
    let initialFolders = [];
    if (localData) {
      try {
        initialFolders = JSON.parse(localData);
      } catch (e) {
        console.error('Gagal membaca data folder pracetak lokal:', e);
      }
    }

    if (initialFolders.length === 0) {
      initialFolders = [
        {
          id: 'folder-demo-01',
          name: 'Program Promosi Kawan Lama Oktober 2026',
          description: 'Penyimpanan berkas gambar desain master cabang Kawan Lama',
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

    syncGlobalFolders(initialFolders);
  };

  const syncGlobalFolders = (folderData) => {
    window.__DESK_PRINT_FOLDERS__ = folderData;
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
  };

  const handleCreateFolder = (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return alert('Silakan masukkan nama folder proyek terlebih dahulu.');

    const newFolder = {
      id: `folder-${Date.now()}`,
      name: newFolderName.trim(),
      description: newFolderDesc.trim() || 'Folder Berkas Desain Master',
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
    if (!window.confirm(`Apakah Anda yakin ingin menghapus folder proyek "${folderName}" beserta seluruh berkas gambar di dalamnya?`)) return;

    const updated = folders.filter(f => f.id !== folderId);
    saveFoldersState(updated);

    if (selectedFolderId === folderId) {
      setSelectedFolderId(updated.length > 0 ? updated[0].id : null);
    }
  };

  const handleUploadImages = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0 || !selectedFolderId) return;

    setIsUploading(true);
    try {
      const processedImages = await Promise.all(
        files.map((file) => {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (event) => {
              const base64Str = event.target.result;
              const fileName = file.name;
              const itemCode = fileName.replace(/\.[^/.]+$/, '');
              const coreCode = extractCoreCode(fileName);
              const sizeKb = Math.round(file.size / 1024);

              resolve({
                id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                file_name: fileName,
                item_code: itemCode,
                core_code: coreCode,
                image_url: base64Str,
                size_kb: sizeKb,
                uploaded_at: new Date().toISOString()
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
      alert(`Berhasil menambahkan ${processedImages.length} berkas gambar ke dalam folder proyek.`);
    } catch (err) {
      alert('Gagal mengunggah berkas gambar: ' + err.message);
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
    <div className="space-y-6 w-full max-w-full">
      {/* Header Banner */}
      <div className={`rounded-3xl p-6 sm:p-7 border shadow-xs transition-colors ${
        isDarkMode
          ? 'bg-neutral-800/90 border-neutral-700/80 text-white'
          : 'bg-white border-slate-200/80 text-slate-800'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border mb-2.5 ${
              isDarkMode ? 'bg-blue-950/40 text-blue-300 border-blue-800/60' : 'bg-blue-50/90 text-blue-700 border-blue-200/80'
            }`}>
              <Layers className="w-3.5 h-3.5" /> Penyimpanan Master Pracetak
            </div>
            <h2 className={`text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2.5 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              <FolderKanban className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              Manajemen Berkas Pracetak (Desk Print)
            </h2>
            <p className={`text-xs sm:text-sm mt-1 max-w-2xl font-normal leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              Kelola direktori proyek dan berkas gambar desain master. Seluruh gambar yang tersimpan dapat dicocokkan secara otomatis oleh <strong className="font-semibold">Packing Station</strong> saat proses impor jadwal kerja.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsCreatingFolder(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl font-semibold text-xs bg-blue-50/90 hover:bg-blue-100/90 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/60 shadow-2xs transition-all cursor-pointer active:scale-95 shrink-0"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Buat Folder Proyek Baru</span>
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: List of Folders */}
        <div className="lg:col-span-4 space-y-4">
          <div className={`p-5 rounded-3xl border shadow-xs ${
            isDarkMode ? 'bg-neutral-800/90 border-neutral-700/80' : 'bg-white border-slate-200/80'
          }`}>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-neutral-700/70">
              <h3 className="font-semibold text-xs uppercase tracking-wider flex items-center gap-2 text-slate-700 dark:text-slate-200">
                <Folder className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Daftar Folder Proyek ({folders.length})
              </h3>
              <button
                type="button"
                onClick={loadFolders}
                className="p-1.5 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-700 transition-all cursor-pointer"
                title="Muat Ulang Daftar Folder"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {folders.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Belum ada folder proyek. Silakan klik tombol "Buat Folder Proyek Baru".
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
                          ? (isDarkMode ? 'bg-blue-950/40 border-blue-800/70 text-blue-200 font-semibold shadow-2xs' : 'bg-blue-50/70 border-blue-200/90 text-blue-900 font-semibold shadow-2xs')
                          : (isDarkMode ? 'bg-neutral-900/50 border-neutral-700/60 hover:bg-neutral-700/40 text-slate-300' : 'bg-slate-50/50 border-slate-200/70 hover:bg-slate-100/70 text-slate-700')
                      }`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`p-2.5 rounded-xl border ${
                          isSelected
                            ? 'bg-blue-100/80 text-blue-700 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800'
                            : isDarkMode
                            ? 'bg-neutral-800 text-slate-400 border-neutral-700'
                            : 'bg-white text-slate-500 border-slate-200/80'
                        }`}>
                          <Layers className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <h4 className="text-xs font-semibold truncate">{folder.name}</h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-normal truncate mt-0.5">
                            {imgCount} berkas • {folder.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFolder(folder.id, folder.name);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
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
          <div className={`p-5 sm:p-6 rounded-3xl border shadow-xs ${
            isDarkMode ? 'bg-neutral-800/90 border-neutral-700/80' : 'bg-white border-slate-200/80'
          }`}>
            {selectedFolder ? (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-neutral-700/70">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">Direktori Aktif</span>
                    <h3 className="text-base sm:text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-white mt-0.5">
                      <FolderKanban className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      {selectedFolder.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {selectedFolder.description} • {(selectedFolder.images || []).length} Berkas Desain Tersimpan
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <label htmlFor="desk-print-upload" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800/60 font-semibold text-xs shadow-2xs transition-all cursor-pointer active:scale-95">
                      <Upload className="w-4 h-4" />
                      <span>{isUploading ? 'Mengunggah Berkas...' : 'Unggah Gambar Desain'}</span>
                      <input
                        id="desk-print-upload"
                        name="deskPrintUpload"
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
                    <label htmlFor="desk-print-search" className="sr-only">Cari kode item atau nama berkas gambar</label>
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="desk-print-search"
                      name="deskPrintSearch"
                      type="text"
                      placeholder="Cari kode item atau nama berkas gambar..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className={`w-full pl-10 pr-4 py-2.5 rounded-2xl border text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                        isDarkMode
                          ? 'bg-neutral-900 border-neutral-700 text-white placeholder-slate-400'
                          : 'bg-slate-50/70 border-slate-200/80 text-slate-800 placeholder-slate-400'
                      }`}
                    />
                  </div>
                </div>

                {/* Image Grid */}
                {filteredImages.length === 0 ? (
                  <div className="text-center py-16 border border-dashed rounded-3xl border-slate-200 dark:border-neutral-700 bg-slate-50/40 dark:bg-neutral-900/30">
                    <ImageIcon className="w-10 h-10 text-slate-300 dark:text-neutral-600 mx-auto mb-3" />
                    <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-300">Belum ada berkas gambar pada folder ini</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                      Gunakan tombol "Unggah Gambar Desain" di kanan atas untuk menambahkan gambar master ke dalam folder ini.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {filteredImages.map(img => (
                      <div
                        key={img.id}
                        className={`group rounded-2xl border overflow-hidden transition-all duration-200 hover:shadow-md flex flex-col ${
                          isDarkMode
                            ? 'bg-neutral-900/70 border-neutral-700/80'
                            : 'bg-white border-slate-200/80'
                        }`}
                      >
                        <div className="relative aspect-square bg-slate-50 dark:bg-neutral-950 overflow-hidden flex items-center justify-center p-2">
                          <img
                            src={img.image_url}
                            alt={img.item_code}
                            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => onOpenImageModal && onOpenImageModal(img.image_url, img.item_code, selectedFolder.name)}
                              className="p-2 bg-white/95 rounded-full text-slate-700 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 transition-all cursor-pointer shadow-sm"
                              title="Pratinjau Resolusi Penuh"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteImage(selectedFolder.id, img.id)}
                              className="p-2 bg-rose-50/95 rounded-full text-rose-700 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer shadow-sm"
                              title="Hapus Berkas Gambar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="p-3 flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="inline-block px-2 py-0.5 text-[10px] font-semibold uppercase rounded bg-blue-50/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/50">
                                {img.core_code ? `Kode: ${img.core_code}` : 'ITEM'}
                              </span>
                              <span className="text-[10px] text-slate-400 tabular-nums">{img.size_kb} KB</span>
                            </div>
                            <h5 className="text-xs font-semibold truncate text-slate-800 dark:text-slate-200" title={img.item_code}>
                              {img.item_code}
                            </h5>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono mt-1 block truncate">
                            {img.file_name}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-20 text-slate-400 text-xs">
                Silakan pilih atau buat folder proyek di panel sebelah kiri.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Create Folder */}
      {isCreatingFolder && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[100] p-4">
          <div className={`w-full max-w-sm p-6 rounded-2xl border shadow-xl transition-all ${
            isDarkMode ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <h3 className="font-bold text-base mb-1">Buat Folder Proyek Baru</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Tambahkan direktori baru untuk mengelompokkan gambar desain master.</p>

            <form onSubmit={handleCreateFolder} className="space-y-3.5">
              <div>
                <label htmlFor="new-folder-name" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Nama Folder Proyek</label>
                <input
                  id="new-folder-name"
                  name="newFolderName"
                  type="text"
                  placeholder="Contoh: Program Promosi Nasional November 2026"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className={`w-full px-3 py-2.5 rounded-xl border text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                    isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                />
              </div>

              <div>
                <label htmlFor="new-folder-desc" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Keterangan (Opsional)</label>
                <input
                  id="new-folder-desc"
                  name="newFolderDesc"
                  type="text"
                  placeholder="Deskripsi singkat isi folder..."
                  value={newFolderDesc}
                  onChange={(e) => setNewFolderDesc(e.target.value)}
                  className={`w-full px-3 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                    isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingFolder(false)}
                  className="flex-1 py-2.5 border border-slate-200 dark:border-neutral-700 rounded-xl font-semibold text-xs text-slate-700 dark:text-slate-300 bg-slate-50 hover:bg-slate-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-50/90 hover:bg-blue-100/90 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/60 font-semibold rounded-xl text-xs shadow-2xs transition-all cursor-pointer active:scale-95"
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
