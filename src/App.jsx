import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import supabase from './supabaseClient';
import App from './App';
import DesignPanel from './components/DesignPanel';
import FinishingPanel from './components/FinishingPanel';
import KawanLamaTab from './components/KawanLamaTab';
import LabelGeneratorTab from './components/LabelGeneratorTab';
import Modals from './components/Modals';
import AdminApprovalPanel from './components/kawanlama/AdminApprovalPanel';
import AdminBranchMonitoring from './components/kawanlama/AdminBranchMonitoring';
import AdminMasterData from './components/kawanlama/AdminMasterData';
import AdminPromoManager from './components/kawanlama/AdminPromoManager';
import BranchOrderForm from './components/kawanlama/BranchOrderForm';
import BranchOrderHistory from './components/kawanlama/BranchOrderHistory';

function App() {
  const [spkList, setSpkList] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpkIds, setSelectedSpkIds] = useState([]);
  const [modalImageInfo, setModalImageInfo] = useState({ isOpen: false, url: '', title: '' });

  useEffect(() => {
    fetchSpkData();
  }, []);

  const fetchSpkData = async () => {
    const { data } = await supabase
      .from('spk_data')
      .select('*')
      .order('id', { ascending: false });

    if (data) { 
      setSpkList(data); 
      if (data.length > 0 && !selectedSpkId) initFinishingForm(data[0]); 
    }
  };

  const initFinishingForm = (item) => {
    if (!item) return; 
    setSelectedSpkId(item.id);
    setFinishingForm({ 
      finishing_type: item.finishing_type || 'inhouse', 
      sub_vendor_name: item.sub_vendor_name || '', 
      qty_finish_sub_out: item.qty_finish_sub_out || 0, 
      qty_finish: item.qty_finish || 0 
    });
  };

  const handleSelectSpk = (spkId) => {
    setSelectedSpkId(spkId); 
    const item = spkList.find(s => String(s.id) === String(spkId));
    if (item) {
      setFinishingForm({ 
        finishing_type: item.finishing_type || 'inhouse', 
        sub_vendor_name: item.sub_vendor_name || '', 
        qty_finish_sub_out: item.qty_finish_sub_out || 0, 
        qty_finish: item.qty_finish || 0 
      });
    }
  };

  const handleToggleCheck = (id) => {
    setSelectedSpkIds(prev => { 
      const exist = prev.includes(id); 
      if (!exist) handleSelectSpk(id); 
      return exist ? prev.filter(item => item !== id) : [...prev, id]; 
    });
  };

  const handleToggleSelectAll = (filteredItems) => {
    if (selectedSpkIds.length === filteredItems.length && filteredItems.length > 0) {
      setSelectedSpkIds([]);
    } else { 
      setSelectedSpkIds(filteredItems.map(item => item.id)); 
      if (filteredItems.length > 0) handleSelectSpk(filteredItems[0].id); 
    }
  };

  const handleUpdateField = async (id, payload) => {
    const { error } = await supabase.from('spk_data').update(payload).eq('id', id);
    if (!error) {
      setSpkList(prev => prev.map(item => item.id === id ? { ...item, ...payload } : item));
    } else {
      alert('Gagal memperbarui data: ' + error.message);
    }
  };

  const handleUpdateQty = async (id, field, value, maxAllowed, customErrorMessage) => {
    const val = Number(value) || 0;
    if (val > maxAllowed) return alert(customErrorMessage || `❌ Gagal: Jumlah tidak boleh melebihi ${maxAllowed}`);
    handleUpdateField(id, { [field]: val });
  };

  const handleDeleteSpk = async (id, noSpk) => {
    if (confirm(`⚠️ Hapus data SPK "${noSpk || id}" dari sistem?`)) {
      const { error } = await supabase.from('spk_data').delete().eq('id', id);
      if (!error) {
        setSpkList(prev => prev.filter(item => item.id !== id));
        setSelectedSpkIds(prev => prev.filter(selectedId => selectedId !== id));
        alert(`✅ SPK "${noSpk}" berhasil dihapus.`);
      } else {
        alert('Gagal menghapus SPK: ' + error.message);
      }
    }
  };

  const handleProcessScan = async (codeValue) => {
    if (!codeValue) return;
    const cleanCode = codeValue.toString().replace(/[\r\n]+/g, '').trim().toLowerCase();
    const targetItem = spkList.find(item => 
      (item.qr_address || '').toLowerCase().includes(cleanCode) || 
      (item.store_code || '').toLowerCase() === cleanCode || 
      (item.no_spk || '').toLowerCase().includes(cleanCode) || 
      (item.project || '').toLowerCase().includes(cleanCode)
    );
    if (!targetItem) { 
      alert('Item tidak ditemukan!');
      return;
    }
    handleSelectSpk(targetItem.id);
  };

  const handleUploadSuratJalan = async (e, item) => {
    const file = e.target.files[0]; 
    if (!file) return;
    const fileName = `sj_${item.no_spk}_${Date.now()}`;
    const { error } = await supabase.storage.from('surat-jalan').upload(fileName, file);
    if (!error) {
      const { data } = supabase.storage.from('surat-jalan').getPublicUrl(fileName);
      handleUpdateField(item.id, { surat_jalan_url: data.publicUrl });
      alert('Surat Jalan Diunggah!');
    }
  };

  const processImportData = async (rawData) => {
    const formattedData = rawData.filter(row => row['Store Name'] || row['Nama Project'] || row['CO
      no_spk: String(row['SPK/WPP'] || row['No SPK'] || '-').split('/')[0].trim(),
      client: String(row['COMPANY'] || 'Nama Klient' || '-'),
      project: String(row['Store Name'] || row['Nama Project'] || '-'),
      bahan: String(row['Nama Bahan'] || 'Art Paper'),
      ukuran: String(row['Ukuran'] || 'A5'),
      qty_order: Number(row['TOTAL QTY ORDER'] || 40),
      qty_print: 0, qty_finish: 0, qty_pack: 0, qty_ship: 0,
      store_code: String(row['NO. STORE'] || '-'), delivery_route: String(row['DELIVERY'] || 'DALAM
  };

  const getPercent = (qty, total) => (!total || total <= 0) ? 0 : Math.min(100, Math.round((qty / total) * 100));

  return (
    <Router>
      <Switch>
        <Route path="/design" component={DesignPanel} />
        <Route path="/finishing" component={FinishingPanel} />
        <Route path="/kawanlama" component={KawanLamaTab} />
        <Route path="/label-generator" component={LabelGeneratorTab} />
        <Route path="/modals" component={Modals} />
        <Route path="/admin/approval" component={AdminApprovalPanel} />
        <Route path="/admin/branch-monitoring" component={AdminBranchMonitoring} />
        <Route path="/admin/master-data" component={AdminMasterData} />
        <Route path="/admin/promo-manager" component={AdminPromoManager} />
        <Route path="/branch/order-form" component={BranchOrderForm} />
        <Route path="/branch/order-history" component={BranchOrderHistory} />
        <Route path="/" exact component={App} />
      </Switch>
    </Router>
  );
}

export default App;
