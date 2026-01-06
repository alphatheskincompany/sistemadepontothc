import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  updateDoc, 
  doc, 
  deleteDoc,
  getDocs, // Importante para buscar histórico
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { 
  MapPin, User, FileText, CheckCircle, XCircle, Clock, LogOut, Shield, Search, AlertTriangle, Loader2, Users, Briefcase, Plus, Trash2, Save, Edit, Calendar, X, Printer, Download, Archive, RefreshCw 
} from 'lucide-react';

// =================================================================================
// ⬇️ SUAS CHAVES DO FIREBASE ⬇️
// =================================================================================

const firebaseConfig = {
  apiKey: "AIzaSyArgWJbEegj_yoPRAjyJWnPwG5kfRb1ioA",
  authDomain: "sistema-ponto-rh.firebaseapp.com",
  projectId: "sistema-ponto-rh",
  storageBucket: "sistemapontorh.firebasestorage.app",
  messagingSenderId: "638828539578",
  appId: "1:638828539578:web:d1aa3e58e66b8d2236dc83"
};

// =================================================================================

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const COLLECTION_REGISTROS = "registros_ponto";
const COLLECTION_FUNCIONARIOS = "funcionarios";

// --- UTILITÁRIOS ---
const formatTime = (dateObj) => 
  dateObj ? dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '---';

const decimalToTime = (decimal) => {
  if (!decimal || isNaN(decimal)) return '00:00';
  const sign = decimal < 0 ? "-" : "+";
  const absDecimal = Math.abs(decimal);
  const hours = Math.floor(absDecimal);
  const minutes = Math.round((absDecimal - hours) * 60);
  return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const timeToDecimal = (timeStr) => {
  if(!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h + (m/60);
};

// --- ESTILOS DE IMPRESSÃO ---
const PrintStyles = () => (
  <style>{`
    @media print {
      @page { size: landscape; margin: 10mm; }
      body { background: white !important; -webkit-print-color-adjust: exact; }
      .no-print, header, button, .hidden-print { display: none !important; }
      .print-only { display: block !important; }
      .print-container { padding: 0 !important; margin: 0 !important; width: 100% !important; max-width: none !important; box-shadow: none !important; border: none !important; }
      table { width: 100% !important; border-collapse: collapse !important; font-size: 10pt !important; }
      th, td { border: 1px solid #ddd !important; padding: 4px 8px !important; text-align: center !important; color: #000 !important; }
      th { background-color: #f3f4f6 !important; font-weight: bold !important; }
      td:last-child, th:last-child { display: none !important; } 
    }
    .print-only { display: none; }
  `}</style>
);

// 1. LOGIN GESTOR
const ManagerLogin = ({ onLogin, onBack }) => {
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    if (pass === 'admin123') onLogin();
    else setError('Senha incorreta');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 no-print">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <div className="text-center mb-8">
          <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-blue-600"/>
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Acesso Restrito</h2>
          <p className="text-slate-500 text-sm mt-1">
            Área exclusiva para gestão de ponto e RH.
          </p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="password"
            value={pass}
            onChange={e=>setPass(e.target.value)}
            className="w-full border p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Senha do gestor..."
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition"
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={onBack}
            className="w-full text-slate-500 text-sm py-2 hover:text-slate-700"
          >
            Voltar para o App do Funcionário
          </button>
        </form>
      </div>
    </div>
  );
};

// 2. GESTÃO DE FUNCIONÁRIOS
const ManagerEmployees = () => {
  const [funcionarios, setFuncionarios] = useState([]);
  const [novoFunc, setNovoFunc] = useState({
    nome: '', escala: '5x2',
    entrada: '08:00', saidaAlmoco: '12:00', voltaAlmoco: '13:00', saida: '18:00',
    entradaSexta: '08:00', saidaAlmocoSexta: '12:00', voltaAlmocoSexta: '13:00', saidaSexta: '17:00'
  });
  const [editingFunc, setEditingFunc] = useState(null);
  const [loadingSync, setLoadingSync] = useState(false);

  useEffect(() => {
    const q = query(collection(db, COLLECTION_FUNCIONARIOS), orderBy('nome'));
    return onSnapshot(q, (snap) => 
      setFuncionarios(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }, []);

  const handleChangeNovo = (field, value) => {
    setNovoFunc(prev => ({ ...prev, [field]: value }));
  };

  const handleSalvar = async () => {
    if (!novoFunc.nome.trim()) {
      alert("Preencha o nome do funcionário");
      return;
    }
    await addDoc(collection(db, COLLECTION_FUNCIONARIOS), novoFunc);
    setNovoFunc(prev => ({ ...prev, nome: '' }));
  };

  const handleExcluir = async (id) => {
    if (confirm("Excluir funcionário? Isso não apaga o histórico de ponto.")) {
      await deleteDoc(doc(db, COLLECTION_FUNCIONARIOS, id));
    }
  };

  // --- NOVA FUNÇÃO: SINCRONIZAR DO HISTÓRICO ---
  const handleSyncFromHistory = async () => {
    setLoadingSync(true);
    try {
      // 1. Busca todos os registros de ponto já feitos
      const snapshot = await getDocs(collection(db, COLLECTION_REGISTROS));
      const nomesNoHistorico = new Set();
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.nome) nomesNoHistorico.add(data.nome);
      });

      // 2. Compara com os que já estão cadastrados
      const nomesAtuais = new Set(funcionarios.map(f => f.nome));
      const nomesParaAdicionar = [...nomesNoHistorico].filter(nome => !nomesAtuais.has(nome));

      if (nomesParaAdicionar.length === 0) {
        alert("Todos os funcionários do histórico já estão cadastrados.");
        setLoadingSync(false);
        return;
      }

      if (!confirm(`Encontrei ${nomesParaAdicionar.length} nomes no histórico que não estão cadastrados:\n\n${nomesParaAdicionar.join(', ')}\n\nDeseja cadastrá-los agora para recuperar os dados?`)) {
        setLoadingSync(false);
        return;
      }

      // 3. Cadastra automaticamente
      const promises = nomesParaAdicionar.map(nome => 
        addDoc(collection(db, COLLECTION_FUNCIONARIOS), {
          nome: nome,
          escala: '5x2', // Padrão
          entrada: '08:00', saidaAlmoco: '12:00', voltaAlmoco: '13:00', saida: '18:00',
          entradaSexta: '08:00', saidaAlmocoSexta: '12:00', voltaAlmocoSexta: '13:00', saidaSexta: '17:00'
        })
      );

      await Promise.all(promises);
      alert("Funcionários restaurados e sincronizados com sucesso!");

    } catch (e) {
      alert("Erro ao sincronizar: " + e.message);
    } finally {
      setLoadingSync(false);
    }
  };

  const handleOpenEdit = (func) => {
    setEditingFunc({ ...func });
  };

  const handleEditChange = (field, value) => {
    setEditingFunc(prev => ({ ...prev, [field]: value }));
  };

  const handleSalvarEdicao = async () => {
    if (!editingFunc || !editingFunc.id) return;
    await updateDoc(doc(db, COLLECTION_FUNCIONARIOS, editingFunc.id), {
      ...editingFunc
    });
    setEditingFunc(null);
  };

  const calcularHorasSemanais = (cfg) => {
    const base = cfg || novoFunc;
    const calcDia = (e, sa, va, s) => {
      const total = (timeToDecimal(sa) - timeToDecimal(e)) + (timeToDecimal(s) - timeToDecimal(va));
      return total > 0 ? total : 0;
    };
    const horasPadrao = calcDia(base.entrada, base.saidaAlmoco, base.voltaAlmoco, base.saida);

    if (base.escala === '5x2') {
      return (horasPadrao * 4) + calcDia(base.entradaSexta, base.saidaAlmocoSexta, base.voltaAlmocoSexta, base.saidaSexta);
    }
    if (base.escala === '6x1') {
      return (horasPadrao * 5) + calcDia(base.entradaSexta, base.saidaAlmocoSexta, base.voltaAlmocoSexta, base.saidaSexta);
    }
    // 12x36: média de 3,5 dias
    return horasPadrao * 3.5;
  };

  const horasSemanais = calcularHorasSemanais();
  const diff44 = horasSemanais - 44;
  const horasBadgeClass = (() => {
    const abs = Math.abs(diff44);
    if (abs < 0.6) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (horasSemanais > 44) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  })();

  return (
    <div className="space-y-6 no-print">
      {/* BOTÃO DE SINCRONIZAÇÃO */}
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-center justify-between">
        <div>
          <h4 className="font-bold text-blue-800 text-sm">Recuperação de Histórico</h4>
          <p className="text-xs text-blue-600">Se os registros antigos não aparecem, clique aqui para cadastrar os nomes automaticamente.</p>
        </div>
        <button 
          onClick={handleSyncFromHistory} 
          disabled={loadingSync}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 transition flex items-center gap-2"
        >
          {loadingSync ? <Loader2 className="animate-spin" size={16}/> : <RefreshCw size={16}/>}
          Sincronizar Nomes
        </button>
      </div>

      {/* CARD NOVO CADASTRO */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-700 flex items-center gap-2">
            <Plus size={18}/> Novo Cadastro
          </h3>
          <div className={`text-xs px-3 py-1 rounded-full border ${horasBadgeClass}`}>
            Estimativa semanal: <strong>{decimalToTime(horasSemanais)}h</strong>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Nome</label>
              <input
                type="text"
                value={novoFunc.nome}
                onChange={e=>handleChangeNovo('nome', e.target.value)}
                className="w-full border p-2 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Escala</label>
              <select
                value={novoFunc.escala}
                onChange={e=>handleChangeNovo('escala', e.target.value)}
                className="w-full border p-2 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="5x2">5x2</option>
                <option value="6x1">6x1</option>
                <option value="12x36">12x36</option>
              </select>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-xs font-bold text-blue-600 mb-2 uppercase">
              {novoFunc.escala === '12x36' ? 'Horário Plantão' : 'Horário Padrão'}
            </p>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] text-slate-400">Entrada</label>
                <input
                  type="time"
                  value={novoFunc.entrada}
                  onChange={e=>handleChangeNovo('entrada', e.target.value)}
                  className="w-full border p-1 rounded text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400">Saída Alm</label>
                <input
                  type="time"
                  value={novoFunc.saidaAlmoco}
                  onChange={e=>handleChangeNovo('saidaAlmoco', e.target.value)}
                  className="w-full border p-1 rounded text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400">Volta Alm</label>
                <input
                  type="time"
                  value={novoFunc.voltaAlmoco}
                  onChange={e=>handleChangeNovo('voltaAlmoco', e.target.value)}
                  className="w-full border p-1 rounded text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400">Saída</label>
                <input
                  type="time"
                  value={novoFunc.saida}
                  onChange={e=>handleChangeNovo('saida', e.target.value)}
                  className="w-full border p-1 rounded text-sm"
                />
              </div>
            </div>
          </div>

          {(novoFunc.escala === '5x2' || novoFunc.escala === '6x1') && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <p className="text-xs font-bold text-emerald-600 mb-2 uppercase">
                Sexta/Sábado (Reduzido)
              </p>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400">Entrada</label>
                  <input
                    type="time"
                    value={novoFunc.entradaSexta}
                    onChange={e=>handleChangeNovo('entradaSexta', e.target.value)}
                    className="w-full border p-1 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">Saída Alm</label>
                  <input
                    type="time"
                    value={novoFunc.saidaAlmocoSexta}
                    onChange={e=>handleChangeNovo('saidaAlmocoSexta', e.target.value)}
                    className="w-full border p-1 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">Volta Alm</label>
                  <input
                    type="time"
                    value={novoFunc.voltaAlmocoSexta}
                    onChange={e=>handleChangeNovo('voltaAlmocoSexta', e.target.value)}
                    className="w-full border p-1 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">Saída</label>
                  <input
                    type="time"
                    value={novoFunc.saidaSexta}
                    onChange={e=>handleChangeNovo('saidaSexta', e.target.value)}
                    className="w-full border p-1 rounded text-sm"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleSalvar}
          className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 w-full transition"
        >
          Salvar Configuração
        </button>
      </div>

      {/* TABELA FUNCIONÁRIOS */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-xs">
            <tr>
              <th className="p-3">Nome</th>
              <th className="p-3">Escala</th>
              <th className="p-3">Horário</th>
              <th className="p-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {funcionarios.map(f => {
              const hSemana = calcularHorasSemanais(f);
              return (
                <tr key={f.id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-700 flex flex-col">
                    <span>{f.nome}</span>
                    <span className="text-[10px] text-slate-400">
                      Estimativa semanal: {decimalToTime(hSemana)}h
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold border border-blue-100">
                      {f.escala || '5x2'}
                    </span>
                  </td>
                  <td className="p-3 text-slate-600 font-mono text-xs">
                    {f.entrada}-{f.saida}
                    {f.escala === '12x36'
                      ? ' (Plantão)'
                      : ` | ${f.entradaSexta}-${f.saidaSexta}`}
                  </td>
                  <td className="p-3 text-right space-x-1">
                    <button
                      onClick={()=>handleOpenEdit(f)}
                      className="inline-flex items-center justify-center text-blue-600 hover:bg-blue-50 p-2 rounded transition"
                      title="Editar"
                    >
                      <Edit size={16}/>
                    </button>
                    <button
                      onClick={()=>handleExcluir(f.id)}
                      className="inline-flex items-center justify-center text-red-500 hover:bg-red-50 p-2 rounded transition"
                      title="Excluir"
                    >
                      <Trash2 size={16}/>
                    </button>
                  </td>
                </tr>
              );
            })}
            {funcionarios.length === 0 && (
              <tr>
                <td colSpan={4} className="p-4 text-center text-slate-400">
                  Nenhum funcionário cadastrado. Use o botão acima para sincronizar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL EDITAR FUNCIONÁRIO */}
      {editingFunc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 no-print">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-slate-100 p-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Editar Funcionário</h3>
              <button onClick={()=>setEditingFunc(null)}>
                <X size={20} className="text-slate-500"/>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Nome</label>
                  <input
                    type="text"
                    value={editingFunc.nome}
                    onChange={e=>handleEditChange('nome', e.target.value)}
                    className="w-full border p-2 rounded"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Escala</label>
                  <select
                    value={editingFunc.escala}
                    onChange={e=>handleEditChange('escala', e.target.value)}
                    className="w-full border p-2 rounded bg-white"
                  >
                    <option value="5x2">5x2</option>
                    <option value="6x1">6x1</option>
                    <option value="12x36">12x36</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-2">
                <p className="text-xs font-bold text-blue-600 mb-1 uppercase">Horário padrão</p>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400">Entrada</label>
                    <input
                      type="time"
                      value={editingFunc.entrada}
                      onChange={e=>handleEditChange('entrada', e.target.value)}
                      className="w-full border p-1 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">Saída Alm</label>
                    <input
                      type="time"
                      value={editingFunc.saidaAlmoco}
                      onChange={e=>handleEditChange('saidaAlmoco', e.target.value)}
                      className="w-full border p-1 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">Volta Alm</label>
                    <input
                      type="time"
                      value={editingFunc.voltaAlmoco}
                      onChange={e=>handleEditChange('voltaAlmoco', e.target.value)}
                      className="w-full border p-1 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">Saída</label>
                    <input
                      type="time"
                      value={editingFunc.saida}
                      onChange={e=>handleEditChange('saida', e.target.value)}
                      className="w-full border p-1 rounded text-sm"
                    />
                  </div>
                </div>
              </div>

              {(editingFunc.escala === '5x2' || editingFunc.escala === '6x1') && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-2">
                  <p className="text-xs font-bold text-emerald-600 mb-1 uppercase">
                    Sexta/Sábado (Reduzido)
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400">Entrada</label>
                      <input
                        type="time"
                        value={editingFunc.entradaSexta}
                        onChange={e=>handleEditChange('entradaSexta', e.target.value)}
                        className="w-full border p-1 rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400">Saída Alm</label>
                      <input
                        type="time"
                        value={editingFunc.saidaAlmocoSexta}
                        onChange={e=>handleEditChange('saidaAlmocoSexta', e.target.value)}
                        className="w-full border p-1 rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400">Volta Alm</label>
                      <input
                        type="time"
                        value={editingFunc.voltaAlmocoSexta}
                        onChange={e=>handleEditChange('voltaAlmocoSexta', e.target.value)}
                        className="w-full border p-1 rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400">Saída</label>
                      <input
                        type="time"
                        value={editingFunc.saidaSexta}
                        onChange={e=>handleEditChange('saidaSexta', e.target.value)}
                        className="w-full border p-1 rounded text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleSalvarEdicao}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 3. GESTÃO DE AUSÊNCIAS
const ManagerAbsences = ({ registros }) => {
  const [modalAbono, setModalAbono] = useState(null);
  const [horasAbono, setHorasAbono] = useState("08:00");

  const ausenciasPendentes = registros.filter(
    r => r.action === 'ausencia' && r.status === 'Pendente'
  );

  const handleAprovar = async () => {
    if(!modalAbono) return;
    await updateDoc(doc(db, COLLECTION_REGISTROS, modalAbono), {
      status: 'Aprovado',
      horasAbonadas: horasAbono
    });
    setModalAbono(null);
  };

  const handleRejeitar = async (id) => {
    if(confirm("Rejeitar justificativa?")) {
      await updateDoc(doc(db, COLLECTION_REGISTROS, id), { status: 'Rejeitado' });
    }
  };

  return (
    <div className="space-y-6 no-print">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-700 text-lg flex items-center gap-2">
          <AlertTriangle size={18} className="text-amber-500"/>
          Justificativas Pendentes
        </h3>
        {ausenciasPendentes.length > 0 && (
          <span className="text-xs bg-amber-100 text-amber-700 px-3 py-1 rounded-full">
            {ausenciasPendentes.length} pendente(s)
          </span>
        )}
      </div>
      
      {ausenciasPendentes.length === 0 ? (
        <div className="text-center p-8 text-slate-400 bg-white rounded-xl border border-dashed border-slate-300">
          Nenhuma justificativa pendente no momento.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ausenciasPendentes.map(reg => (
            <div
              key={reg.id}
              className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-3"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-slate-800 flex items-center gap-2">
                    <User size={16} className="text-slate-400"/>
                    {reg.nome}
                  </h4>
                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                    {reg.tipoAusencia || 'Ausência'}
                  </span>
                </div>
                <div className="text-xs text-slate-500 text-right">
                  {reg.timestamp?.toDate().toLocaleDateString()}
                  <br/>
                  <span className="inline-flex items-center gap-1 mt-1">
                    <Clock size={10}/>
                    {reg.timestamp?.toDate().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg text-sm text-slate-600 italic border border-slate-100">
                "{reg.justificativa}"
              </div>

              {reg.fotoBase64 && (
                <div
                  className="h-32 bg-slate-200 rounded-lg overflow-hidden relative cursor-pointer group"
                  onClick={() => {
                    const w = window.open("");
                    w.document.write(`<img src="${reg.fotoBase64}" style="max-width:100%"/>`);
                  }}
                >
                  <img src={reg.fotoBase64} className="w-full h-full object-cover" alt="Comprovante"/>
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs">
                    Ver Comprovante
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  onClick={()=>handleRejeitar(reg.id)}
                  className="p-2 text-red-600 border border-red-200 rounded hover:bg-red-50 text-sm font-bold"
                >
                  Rejeitar
                </button>
                <button
                  onClick={()=>setModalAbono(reg.id)}
                  className="p-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 text-sm font-bold"
                >
                  Aprovar & Abonar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalAbono && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-sm">
            <h3 className="font-bold text-lg mb-4">Abonar Horas</h3>
            <p className="text-sm text-slate-600 mb-2">
              Quantas horas deseja abonar para esta ausência?
            </p>
            <input
              type="time"
              value={horasAbono}
              onChange={e=>setHorasAbono(e.target.value)}
              className="w-full border p-3 rounded-lg text-xl text-center font-bold mb-6"
            />
            <div className="flex gap-3">
              <button
                onClick={()=>setModalAbono(null)}
                className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleAprovar}
                className="flex-1 py-3 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 4. RELATÓRIOS E ESPELHO
const ManagerReports = ({ registros, funcionariosDb }) => {
  const [selectedFuncionario, setSelectedFuncionario] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [relatorio, setRelatorio] = useState([]);
  const [resumo, setResumo] = useState({ trabalhadas: 0, saldo: 0, abonadas: 0 });
  const [editingDay, setEditingDay] = useState(null);
  const [editTimes, setEditTimes] = useState({
    entrada: '',
    saidaAlmoco: '',
    voltaAlmoco: '',
    saida: ''
  });

  useEffect(() => {
    if(funcionariosDb.length > 0 && !selectedFuncionario) {
      setSelectedFuncionario(funcionariosDb[0].nome);
    }
  }, [funcionariosDb, selectedFuncionario]);

  useEffect(() => {
    if(!selectedFuncionario) return;

    const dadosFunc = funcionariosDb.find(f => f.nome === selectedFuncionario);

    const getJornadaDia = (diaDaSemana) => {
      if (!dadosFunc) return 8;
      const calc = (e, sa, va, s) => {
        const t = (timeToDecimal(sa) - timeToDecimal(e)) + (timeToDecimal(s) - timeToDecimal(va));
        return t > 0 ? t : 0;
      };
      if (diaDaSemana === 5 && dadosFunc.escala === '5x2') {
        return calc(
          dadosFunc.entradaSexta,
          dadosFunc.saidaAlmocoSexta,
          dadosFunc.voltaAlmocoSexta,
          dadosFunc.saidaSexta
        );
      }
      if (diaDaSemana === 6 && dadosFunc.escala === '6x1') {
        return calc(
          dadosFunc.entradaSexta,
          dadosFunc.saidaAlmocoSexta,
          dadosFunc.voltaAlmocoSexta,
          dadosFunc.saidaSexta
        );
      }
      return calc(
        dadosFunc.entrada,
        dadosFunc.saidaAlmoco,
        dadosFunc.voltaAlmoco,
        dadosFunc.saida
      );
    };

    const dates = [];
    const date = new Date(selectedYear, selectedMonth, 1);
    while (date.getMonth() === selectedMonth) {
      dates.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }

    let totalTrabalhado = 0, totalSaldo = 0, totalAbonado = 0;

    const processado = dates.map(d => {
      const dStr = d.toLocaleDateString('pt-BR');
      const regDia = registros.filter(
        r => r.nome === selectedFuncionario &&
          r.timestamp?.toDate().toLocaleDateString('pt-BR') === dStr
      );

      const entrada = regDia.find(r => r.tipo === 'Entrada');
      const saidaAlmoco = regDia.find(r => r.tipo === 'Saída Almoço');
      const voltaAlmoco = regDia.find(r => r.tipo === 'Entrada Almoço');
      const saida = regDia.find(r => r.tipo === 'Saída');
      const ausencia = regDia.find(r => r.action === 'ausencia' && r.status === 'Aprovado');

      let horasAbonadas = 0;
      if (ausencia && ausencia.horasAbonadas) {
        horasAbonadas = timeToDecimal(ausencia.horasAbonadas);
      }

      let trabalhado = 0;
      const diffHours = (s, e) => (e - s) / 36e5;

      if (entrada && saida) {
        if (saidaAlmoco && voltaAlmoco) {
          trabalhado =
            diffHours(entrada.timestamp.toDate(), saidaAlmoco.timestamp.toDate()) +
            diffHours(voltaAlmoco.timestamp.toDate(), saida.timestamp.toDate());
        } else {
          trabalhado = diffHours(entrada.timestamp.toDate(), saida.timestamp.toDate());
        }
      }

      const diaSemana = d.getDay();
      const isWeekend = diaSemana === 0 || (diaSemana === 6 && dadosFunc?.escala === '5x2');

      let jornadaEsperada = isWeekend ? 0 : getJornadaDia(diaSemana);

      // 12x36: só conta jornada quando houve plantão
      if (dadosFunc?.escala === '12x36') {
        jornadaEsperada = trabalhado > 0 || horasAbonadas > 0 ? getJornadaDia(diaSemana) : 0;
      }

      const saldo = (trabalhado + horasAbonadas) - jornadaEsperada;

      if (!isWeekend || trabalhado > 0 || horasAbonadas > 0) {
        totalTrabalhado += trabalhado;
        totalAbonado += horasAbonadas;
        totalSaldo += saldo;
      }

      return {
        date: d,
        entrada,
        saidaAlmoco,
        voltaAlmoco,
        saida,
        ausencia,
        trabalhado,
        abonado: horasAbonadas,
        saldo,
        isWeekend,
        jornadaEsperada
      };
    });

    setRelatorio(processado);
    setResumo({ trabalhadas: totalTrabalhado, abonadas: totalAbonado, saldo: totalSaldo });
  }, [registros, selectedFuncionario, selectedMonth, selectedYear, funcionariosDb]);

  const openEditDay = (day) => {
    setEditingDay(day);
    setEditTimes({
      entrada: day.entrada
        ? day.entrada.timestamp.toDate().toTimeString().slice(0,5)
        : '',
      saidaAlmoco: day.saidaAlmoco
        ? day.saidaAlmoco.timestamp.toDate().toTimeString().slice(0,5)
        : '',
      voltaAlmoco: day.voltaAlmoco
        ? day.voltaAlmoco.timestamp.toDate().toTimeString().slice(0,5)
        : '',
      saida: day.saida
        ? day.saida.timestamp.toDate().toTimeString().slice(0,5)
        : '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingDay) return;
    const { date, entrada, saidaAlmoco, voltaAlmoco, saida } = editingDay;
    const baseDate = new Date(date);

    const mapTipo = {
      entrada: 'Entrada',
      saidaAlmoco: 'Saída Almoço',
      voltaAlmoco: 'Entrada Almoço',
      saida: 'Saída'
    };

    const items = [
      { key: 'entrada', tipo: mapTipo.entrada },
      { key: 'saidaAlmoco', tipo: mapTipo.saidaAlmoco },
      { key: 'voltaAlmoco', tipo: mapTipo.voltaAlmoco },
      { key: 'saida', tipo: mapTipo.saida },
    ];

    for (const item of items) {
      const existingReg = editingDay[item.key];
      const valor = editTimes[item.key];

      if (valor) {
        const [h, m] = valor.split(':');
        const newDate = new Date(baseDate);
        newDate.setHours(parseInt(h, 10), parseInt(m, 10), 0);
        if (existingReg) {
          await updateDoc(doc(db, COLLECTION_REGISTROS, existingReg.id), {
            timestamp: Timestamp.fromDate(newDate),
            status: 'Ajuste Manual'
          });
        } else {
          await addDoc(collection(db, COLLECTION_REGISTROS), {
            action: 'ponto',
            nome: selectedFuncionario,
            tipo: item.tipo,
            timestamp: Timestamp.fromDate(newDate),
            status: 'Ajuste Manual',
            latitude: 'Manual',
            longitude: 'Manual',
            fotoBase64: null
          });
        }
      } else {
        if (existingReg) {
          await deleteDoc(doc(db, COLLECTION_REGISTROS, existingReg.id));
        }
      }
    }

    setEditingDay(null);
  };

  const handleApproveDay = async (dayData) => {
    const recordsToApprove = [
      dayData.entrada,
      dayData.saidaAlmoco,
      dayData.voltaAlmoco,
      dayData.saida,
      dayData.ausencia
    ].filter(r => r && r.id && r.status !== 'Aprovado');

    if (recordsToApprove.length === 0) {
      alert("Não há registros pendentes neste dia.");
      return;
    }
    if (!confirm(
      `Aprovar ${recordsToApprove.length} registros do dia ${dayData.date.toLocaleDateString('pt-BR')}?`
    )) return;

    try {
      await Promise.all(
        recordsToApprove.map(r =>
          updateDoc(doc(db, COLLECTION_REGISTROS, r.id), { status: 'Aprovado' })
        )
      );
      alert("Registros aprovados!");
    } catch (e) {
      alert("Erro ao aprovar: " + e.message);
    }
  };

  const handleClearMonth = async () => {
    const monthName = new Date(selectedYear, selectedMonth)
      .toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

    const idsToDelete = [];
    relatorio.forEach(day => {
      [day.entrada, day.saidaAlmoco, day.voltaAlmoco, day.saida, day.ausencia]
        .forEach(reg => {
          if (reg && reg.id) idsToDelete.push(reg.id);
        });
    });

    if (idsToDelete.length === 0) {
      alert(`Não encontrei registros de ${selectedFuncionario} em ${monthName}.`);
      return;
    }

    if (confirm(
      `ATENÇÃO: Apagar ${idsToDelete.length} registros de ${selectedFuncionario} em ${monthName}? ISSO É IRREVERSÍVEL. Já salvou o PDF?`
    )) {
      try {
        await Promise.all(idsToDelete.map(id =>
          deleteDoc(doc(db, COLLECTION_REGISTROS, id))
        ));
        alert("Registros apagados.");
      } catch (err) {
        alert("Erro: " + err.message);
      }
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <PrintStyles />

      <div className="print-only text-center mb-8">
        <h1 className="text-2xl font-bold text-black uppercase">Espelho de Ponto</h1>
        <div className="flex justify-between mt-4 px-10 border-b pb-4">
          <p className="text-black font-medium">
            Funcionário: <strong>{selectedFuncionario}</strong>
          </p>
          <p className="text-black">
            Período:{" "}
            <strong>
              {new Date(selectedYear, selectedMonth)
                .toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
            </strong>
          </p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-end no-print">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase">
            Funcionário
          </label>
          <select
            value={selectedFuncionario}
            onChange={e=>setSelectedFuncionario(e.target.value)}
            className="border p-2 rounded min-w-[180px]"
          >
            {funcionariosDb.map(f=>(
              <option key={f.id} value={f.nome}>{f.nome}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase">
            Mês
          </label>
          <select
            value={selectedMonth}
            onChange={e=>setSelectedMonth(parseInt(e.target.value,10))}
            className="border p-2 rounded"
          >
            {Array.from({length:12},(_,i)=>(
              <option key={i} value={i}>
                {new Date(0,i).toLocaleString('pt-BR',{month:'long'})}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase">
            Ano
          </label>
          <select
            value={selectedYear}
            onChange={e=>setSelectedYear(parseInt(e.target.value,10))}
            className="border p-2 rounded"
          >
            <option value={2024}>2024</option>
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
          </select>
        </div>
        <div className="flex-1 text-right flex justify-end gap-2">
          <button
            onClick={handleClearMonth}
            className="bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-red-100 transition"
          >
            <Archive size={18} /> Limpar Mês
          </button>
          <button
            onClick={handlePrint}
            className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-slate-900 transition"
          >
            <Download size={18} /> Exportar PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print-container">
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 print-container"><h4 className="text-blue-600 font-bold text-sm uppercase">Total + Abono</h4><p className="text-2xl font-bold text-blue-800 mt-1">{decimalToTime(resumo.trabalhadas + resumo.abonadas)}h</p></div>
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 print-container"><h4 className="text-slate-600 font-bold text-sm uppercase">Horas Abonadas</h4><p className="text-2xl font-bold text-slate-800 mt-1">{decimalToTime(resumo.abonadas)}h</p></div>
        <div className={`p-4 rounded-xl border print-container ${resumo.saldo >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}><h4 className="font-bold text-sm uppercase">Saldo Final</h4><p className={`text-2xl font-bold mt-1 ${resumo.saldo >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>{decimalToTime(resumo.saldo)}h</p></div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto print-container">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-xs"><tr><th className="p-3">Data</th><th className="p-3 text-center">Ent 1</th><th className="p-3 text-center">Sai 1</th><th className="p-3 text-center">Ent 2</th><th className="p-3 text-center">Sai 2</th><th className="p-3 text-center">Abono</th><th className="p-3 text-center">Saldo</th><th className="p-3 text-center no-print">Ações</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {relatorio.map((r, i) => (
              <tr key={i} className={`${r.isWeekend ? 'bg-slate-50/50' : ''} ${r.saldo < 0 ? 'border-l-2 border-l-red-400' : ''}`}>
                <td className="p-3 font-medium text-slate-700 flex flex-col"><span>{r.date.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})}</span><span className="text-[10px] text-slate-400 uppercase">{r.date.toLocaleDateString('pt-BR', {weekday:'short'})}</span></td>
                <td className="p-3 text-center text-slate-600">{formatTime(r.entrada?.timestamp.toDate())}</td>
                <td className="p-3 text-center text-slate-600">{formatTime(r.saidaAlmoco?.timestamp.toDate())}</td>
                <td className="p-3 text-center text-slate-600">{formatTime(r.voltaAlmoco?.timestamp.toDate())}</td>
                <td className="p-3 text-center text-slate-600">{formatTime(r.saida?.timestamp.toDate())}</td>
                <td className="p-3 text-center font-bold text-blue-600">{r.ausencia ? `${decimalToTime(r.abonado)}h` : '-'}</td>
                <td className={`p-3 text-center font-bold ${r.saldo>=0?'text-emerald-600':'text-red-500'}`}>{decimalToTime(r.saldo)}</td>
                <td className="p-3 text-center flex items-center justify-center gap-2 no-print">
                  <button onClick={()=>openEditDay(r)} className="text-blue-600 bg-blue-50 p-2 rounded hover:bg-blue-100 transition" title="Editar dia"><Edit size={16}/></button>
                  <button onClick={()=>handleApproveDay(r)} className="text-emerald-600 bg-emerald-50 p-2 rounded hover:bg-emerald-100 transition" title="Aprovar Dia"><CheckCircle size={16}/></button>
                </td>
              </tr>
            ))}
            {relatorio.length === 0 && <tr><td colSpan={8} className="p-4 text-center text-slate-400">Nenhum registro encontrado para este período.</td></tr>}
          </tbody>
        </table>
      </div>

      {editingDay && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 no-print">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-slate-100 p-4 border-b flex justify-between items-center">
              <div><h3 className="font-bold text-slate-800">Ajuste Manual</h3><p className="text-xs text-slate-500">Dia {editingDay.date.toLocaleDateString('pt-BR')}</p></div>
              <button onClick={()=>setEditingDay(null)}><X size={20} className="text-slate-500"/></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Entrada</label><input type="time" value={editTimes.entrada} onChange={e=>setEditTimes(t=>({...t, entrada:e.target.value}))} className="w-full border p-2 rounded text-center"/></div>
                <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Saída Alm</label><input type="time" value={editTimes.saidaAlmoco} onChange={e=>setEditTimes(t=>({...t, saidaAlmoco:e.target.value}))} className="w-full border p-2 rounded text-center"/></div>
                <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Volta Alm</label><input type="time" value={editTimes.voltaAlmoco} onChange={e=>setEditTimes(t=>({...t, voltaAlmoco:e.target.value}))} className="w-full border p-2 rounded text-center"/></div>
                <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Saída</label><input type="time" value={editTimes.saida} onChange={e=>setEditTimes(t=>({...t, saida:e.target.value}))} className="w-full border p-2 rounded text-center"/></div>
              </div>
              <button onClick={handleSaveEdit} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700">Salvar Ajustes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 5. PAINEL GESTÃO (ROTEADOR DE ABAS)
const ManagerDashboard = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState('visão-geral');
  const [registros, setRegistros] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);

  useEffect(() => {
    const unsub1 = onSnapshot(query(collection(db, COLLECTION_REGISTROS), orderBy('timestamp', 'desc')), s => {
      setRegistros(s.docs.map(d=>({id:d.id, ...d.data()})));
    });
    const unsub2 = onSnapshot(query(collection(db, COLLECTION_FUNCIONARIOS), orderBy('nome')), s => {
      setFuncionarios(s.docs.map(d=>({id:d.id, ...d.data()})));
    });
    return () => { unsub1(); unsub2(); };
  }, []);

  const hojeStr = new Date().toLocaleDateString('pt-BR');
  const registrosHoje = registros.filter(r => r.timestamp?.toDate().toLocaleDateString('pt-BR') === hojeStr && r.action === 'ponto');
  const ausenciasPendentes = registros.filter(r => r.action === 'ausencia' && r.status === 'Pendente');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center no-print">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white"><Shield size={20}/></div>
          <div><h1 className="font-bold text-slate-800 text-lg">RH System</h1><p className="text-xs text-slate-500">Painel do gestor • {new Date().toLocaleDateString('pt-BR')}</p></div>
        </div>
        <button onClick={onLogout} className="text-slate-500 hover:text-red-600 flex items-center gap-2 text-sm"><LogOut size={16}/> Sair</button>
      </header>
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-6 print-container">
        <div className="flex gap-2 overflow-x-auto pb-2 no-print">
          {[ {id:'visão-geral', label:'Visão Geral', icon:Clock}, {id:'funcionarios', label:'Funcionários', icon:Users}, {id:'ausencias', label:'Ausências', icon:AlertTriangle}, {id:'relatorios', label:'Espelho de Ponto', icon:FileText} ].map(tab => (
            <button key={tab.id} onClick={()=>setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition ${activeTab===tab.id?'bg-blue-600 text-white shadow-lg shadow-blue-200':'bg-white text-slate-600 hover:bg-slate-100'}`}>
              <tab.icon size={16}/> {tab.label}
              {tab.id === 'ausencias' && ausenciasPendentes.length > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full">{ausenciasPendentes.length}</span>}
            </button>
          ))}
        </div>

        {activeTab === 'visão-geral' && (
           <div className="space-y-6 no-print">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <div className="bg-white border rounded-xl p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center"><Clock className="text-blue-600" size={18}/></div><div><p className="text-xs text-slate-500 uppercase font-bold">Registros de ponto hoje</p><p className="text-2xl font-bold text-slate-800">{registrosHoje.length}</p></div></div>
               <div className="bg-white border rounded-xl p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center"><AlertTriangle className="text-amber-600" size={18}/></div><div><p className="text-xs text-slate-500 uppercase font-bold">Ausências pendentes</p><p className="text-2xl font-bold text-slate-800">{ausenciasPendentes.length}</p></div></div>
               <div className="bg-white border rounded-xl p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center"><Users className="text-emerald-600" size={18}/></div><div><p className="text-xs text-slate-500 uppercase font-bold">Colaboradores</p><p className="text-2xl font-bold text-slate-800">{funcionarios.length}</p></div></div>
             </div>
             <div className="bg-white rounded-xl shadow-sm border p-6">
               <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Clock size={18} className="text-blue-500"/> Atividade Recente</h3>
               <div className="space-y-3">
                 {registros.slice(0,10).map(r => (
                   <div key={r.id} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-100 transition">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center">{r.fotoBase64 ? <img src={r.fotoBase64} className="w-full h-full object-cover" alt="Foto"/> : <User className="text-slate-500" size={18}/>}</div>
                        <div><p className="font-bold text-sm text-slate-800">{r.nome}</p><p className="text-xs text-slate-500">{r.action === 'ausencia' ? (r.tipoAusencia || 'Ausência') : r.tipo || 'Ponto'}</p></div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-slate-600">{r.timestamp?.toDate().toLocaleTimeString('pt-BR').slice(0,5)}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1 mt-1 ${r.status==='Pendente'?'bg-yellow-100 text-yellow-700':r.status==='Rejeitado'?'bg-red-100 text-red-700':'bg-emerald-100 text-emerald-700'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${r.status==='Pendente'?'bg-yellow-500':r.status==='Rejeitado'?'bg-red-500':'bg-emerald-500'}`}/>{r.status}
                        </span>
                      </div>
                   </div>
                 ))}
                 {registros.length === 0 && <p className="text-center text-slate-400 text-sm">Nenhum registro encontrado ainda.</p>}
               </div>
             </div>
           </div>
        )}
        {activeTab === 'funcionarios' && <ManagerEmployees />}
        {activeTab === 'ausencias' && <ManagerAbsences registros={registros} />}
        {activeTab === 'relatorios' && <ManagerReports registros={registros} funcionariosDb={funcionarios} />}
      </main>
    </div>
  );
};

// 6. APP FUNCIONÁRIO
const EmployeeApp = ({ onGoToManager }) => {
  const [funcionarios, setFuncionarios] = useState([]);
  const [view, setView] = useState('home');
  const [formData, setFormData] = useState({ nome: '', tipo: '', justificativa: '', fotoBase64: null });
  const [loading, setLoading] = useState(false);
  const videoRef = useRef(null); const canvasRef = useRef(null); const [stream, setStream] = useState(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => { const unsub = onSnapshot(query(collection(db, COLLECTION_FUNCIONARIOS), orderBy('nome')), s => { setFuncionarios(s.docs.map(d => d.data().nome)); }); return () => unsub(); }, []);

  const handleCamera = async (mode) => {
    setView('camera');
    try { const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode } }); setStream(s); if(videoRef.current) videoRef.current.srcObject = s; } 
    catch(e) { alert("Erro ao acessar câmera. Verifique permissões do navegador."); setView('home'); }
  };

  const handleSubmit = async (foto) => {
    setLoading(true); setView('processing');
    let lat = 'N/D', long = 'N/D';
    try { const pos = await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{timeout:4000})); lat = pos.coords.latitude; long = pos.coords.longitude; } catch(e){}
    const action = formData.justificativa ? 'ausencia' : 'ponto';
    await addDoc(collection(db, COLLECTION_REGISTROS), { ...formData, fotoBase64: foto, latitude: lat, longitude: long, status: 'Pendente', timestamp: serverTimestamp(), action });
    setView('success'); setTimeout(() => { setView('home'); setFormData({nome:'', tipo:'', justificativa:'', fotoBase64: null}); setLoading(false); }, 1500);
  };

  const takePhoto = () => {
    const ctx = canvasRef.current.getContext('2d');
    canvasRef.current.width = videoRef.current.videoWidth; canvasRef.current.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current,0,0);
    const b64 = canvasRef.current.toDataURL('image/jpeg', 0.6);
    if(stream) stream.getTracks().forEach(t=>t.stop());
    handleSubmit(b64);
  };

  if(view==='camera') return <div className="fixed inset-0 bg-black flex flex-col"><video ref={videoRef} autoPlay playsInline className="flex-1 object-cover"/><canvas ref={canvasRef} className="hidden"/><button onClick={takePhoto} className="absolute bottom-8 left-1/2 -translate-x-1/2 w-20 h-20 bg-white rounded-full border-4 border-slate-300"/></div>;
  if(view==='processing' || loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600 w-10 h-10 mb-3"/><p className="text-slate-500 text-sm">Enviando seu registro...</p></div>;
  if(view==='success') return <div className="min-h-screen flex items-center justify-center bg-emerald-50"><CheckCircle className="w-16 h-16 text-emerald-600 mb-3"/><p className="font-bold text-emerald-700 text-lg">Registro enviado com sucesso!</p></div>;

  if(view==='form-ponto' || view==='form-ausencia') {
    const isPonto = view === 'form-ponto';
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white p-6 rounded-xl shadow space-y-4">
            <h2 className="font-bold text-lg flex items-center gap-2">{isPonto ? <MapPin className="text-blue-600"/> : <FileText className="text-emerald-600"/>} {isPonto ? 'Registro de Ponto' : 'Justificar Ausência'}</h2>
            <p className="text-xs text-slate-500">Preencha seus dados e tire uma foto para validar o registro.</p>
            <select value={formData.nome} onChange={e=>setFormData(prev=>({...prev, nome:e.target.value}))} className="w-full border p-3 rounded focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="">Selecione seu nome...</option>
              {funcionarios.map(f=><option key={f.id} value={f.nome}>{f.nome}</option>)}
            </select>
            {isPonto ? (
              <div className="grid gap-2">{['Entrada','Saída Almoço','Entrada Almoço','Saída'].map(t=><label key={t} className={`p-3 border rounded flex items-center cursor-pointer ${formData.tipo===t ? 'border-blue-500 bg-blue-50' : ''}`}><input type="radio" name="tp" checked={formData.tipo===t} onChange={()=>setFormData(prev=>({...prev, tipo:t, justificativa:''}))} className="mr-2"/>{t}</label>)}</div>
            ) : (
              <textarea placeholder="Descreva o motivo da sua ausência (obrigatório)..." value={formData.justificativa} onChange={e=>setFormData(prev=>({...prev, justificativa:e.target.value, tipo:''}))} className="w-full border p-3 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm" rows="3"/>
            )}
            <button onClick={()=>{ if (!formData.nome) { alert("Selecione seu nome primeiro."); return; } if (isPonto && !formData.tipo) { alert("Selecione o tipo de registro de ponto."); return; } if (!isPonto && !formData.justificativa.trim()) { alert("Informe a justificativa da ausência."); return; } handleCamera(isPonto ? 'user' : 'environment'); }} className="w-full bg-blue-600 text-white py-3 rounded font-bold hover:bg-blue-700 transition">Tirar Foto & Enviar</button>
            <button onClick={()=>setView('home')} className="w-full py-2 text-slate-500 hover:text-slate-700 text-sm">Voltar</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col">
      <header className="bg-transparent p-4 flex justify-between items-center no-print"><div className="flex items-center gap-2 text-white"><Clock size={18}/><span className="font-semibold">PontoApp</span></div><button onClick={onGoToManager} className="text-xs border border-slate-500 text-slate-100 px-2 py-1 rounded hover:bg-slate-700">Admin</button></header>
      <main className="flex-1 p-6 flex flex-col items-center justify-center gap-6 max-w-md mx-auto w-full no-print">
        <div className="bg-black/20 border border-white/10 rounded-2xl px-6 py-4 text-center text-white w-full">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-300">{now.toLocaleDateString('pt-BR',{weekday:'long', day:'2-digit', month:'2-digit', year:'numeric'})}</p>
          <p className="text-4xl font-bold mt-1 tabular-nums">{now.toLocaleTimeString('pt-BR',{hour:'2-digit', minute:'2-digit', second:'2-digit'})}</p>
          <p className="text-[11px] text-slate-300 mt-2">Lembre-se de registrar sempre na entrada, intervalos e saída.</p>
        </div>
        <button onClick={()=>setView('form-ponto')} className="bg-white p-5 rounded-2xl shadow-lg border border-slate-200 hover:border-blue-500 hover:shadow-blue-200 transition w-full text-left"><MapPin className="text-blue-600 mb-2"/><h3 className="font-bold text-slate-800 text-lg">Registrar Ponto</h3><p className="text-xs text-slate-500 mt-1">Entrada, saída para almoço, retorno e saída final.</p></button>
        <button onClick={()=>setView('form-ausencia')} className="bg-slate-900/60 p-5 rounded-2xl border border-slate-600 hover:border-emerald-500 transition w-full text-left text-white"><FileText className="text-emerald-400 mb-2"/><h3 className="font-bold text-lg">Justificar Ausência</h3><p className="text-xs text-slate-300 mt-1">Envie uma justificativa e comprovante para análise do RH.</p></button>
      </main>
    </div>
  );
};

// --- APP PRINCIPAL ---
const App = () => {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('employee');

  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600 w-8 h-8"/>
      </div>
    );
  }

  if (view === 'manager-login') {
    return (
      <ManagerLogin
        onLogin={() => setView('manager-dash')}
        onBack={() => setView('employee')}
      />
    );
  }
  if (view === 'manager-dash') {
    return (
      <ManagerDashboard
        onLogout={() => setView('employee')}
      />
    );
  }

  return (
    <EmployeeApp
      onGoToManager={() => setView('manager-login')}
    />
  );
};

export default App;
