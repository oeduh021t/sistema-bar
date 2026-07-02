import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShieldAlert, Building2, UserPlus, LogOut, RefreshCw, Layers, DollarSign, Calendar, Ban, CheckCircle, AlertTriangle } from 'lucide-react';

interface BarAssinante {
  id: number;
  nome: string;
  cnpj: string | null;
  status: string;
  data_vencimento: string | null;
  criado_em: string;
}

export function SaasDashboard() {
  const adminNome = localStorage.getItem('@SaaSBar:adminNome') || 'Super Admin';
  
  // Estados para listagem
  const [bares, setBares] = useState<BarAssinante[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Estados para o formulário de Onboarding
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [nomeDono, setNomeDono] = useState('');
  const [emailDono, setEmailDono] = useState('');
  const [senhaDono, setSenhaDono] = useState('');
  const [mesesIniciais, setMesesIniciais] = useState('1');

  // Estados para o Modal de Lançamento de Mensalidade
  const [barFinanceiro, setBarFinanceiro] = useState<BarAssinante | null>(null);
  const [valorPago, setValorPago] = useState('150.00'); // Valor sugerido padrão
  const [mesesAdicionais, setMesesAdicionais] = useState('1');

  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [salvando, setSalvando] = useState(false);

  const buscarBares = async () => {
    try {
      setCarregando(true);
      const { data } = await axios.get('http://192.168.100.50:3000/saas/bares');
      setBares(data);
    } catch (err) {
      console.error('Erro ao listar estabelecimentos:', err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    buscarBares();
  }, []);

  const lidarComOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setSucesso('');
    setSalvando(true);

    try {
      const { data } = await axios.post('http://192.168.100.50:3000/saas/cadastrar-bar', {
        nome_fantasia: nomeFantasia,
        cnpj: cnpj || undefined,
        nome_dono: nomeDono,
        email_dono: emailDono,
        senha_dono: senhaDono,
        meses_iniciais: Number(mesesIniciais)
      });

      setSucesso(data.message || 'Nova instância de bar criada com sucesso!');
      setNomeFantasia('');
      setCnpj('');
      setNomeDono('');
      setEmailDono('');
      setSenhaDono('');
      setMesesIniciais('1');
      buscarBares();
    } catch (err: any) {
      setErro(err.response?.data?.error || 'Erro ao realizar o onboarding do bar.');
    } finally {
      setSalvando(false);
    }
  };

  const lancarPagamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barFinanceiro) return;
    setErro('');
    setSucesso('');

    try {
      const { data } = await axios.post(`http://192.168.100.50:3000/saas/bares/${barFinanceiro.id}/pagamentos`, {
        valor_pago: Number(valorPago),
        meses_adicionais: Number(mesesAdicionais)
      });

      setSucesso(`Licença renovada para o ${barFinanceiro.nome}! Novo Vencimento: ${new Date(data.novo_vencimento).toLocaleDateString('pt-BR')}`);
      setBarFinanceiro(null);
      buscarBares();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao registrar pagamento.');
    }
  };

  const fazerLogout = () => {
    localStorage.removeItem('@SaaSBar:adminToken');
    localStorage.removeItem('@SaaSBar:adminNome');
    window.location.href = '/saas-login';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Topbar do Super Admin */}
      <header className="bg-slate-900 border-b border-slate-800 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-7 h-7 text-amber-500" />
          <div>
            <h1 className="font-bold tracking-tight text-lg">SaaS Bar Core</h1>
            <p className="text-xs text-slate-500 font-mono">Ambiente de Controle Global</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-slate-300">Olá, <span className="text-amber-500 font-bold">{adminNome}</span></span>
          <button onClick={fazerLogout} className="flex items-center gap-2 bg-red-950/20 border border-red-900/40 text-red-400 hover:bg-red-900/20 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all">
            <LogOut className="w-3.5 h-3.5" /> Sair do Core
          </button>
        </div>
      </header>

      <main className="flex-1 p-8 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Painel Esquerdo: Formulário de Onboarding (Novo Bar) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl h-fit">
          <div className="flex items-center gap-2 text-amber-500 mb-4">
            <UserPlus className="w-5 h-5" />
            <h2 className="text-md font-bold text-slate-200 uppercase tracking-wide">Onboarding de Cliente</h2>
          </div>

          {erro && <div className="bg-red-950/40 border border-red-800 text-red-400 p-3 rounded-xl mb-4 text-xs font-medium">{erro}</div>}
          {sucesso && <div className="bg-emerald-950/40 border border-emerald-800 text-emerald-400 p-3 rounded-xl mb-4 text-xs font-medium flex items-center gap-1.5"><CheckCircle className="w-4 h-4 shrink-0 text-emerald-400"/> {sucesso}</div>}

          <form onSubmit={lidarComOnboarding} className="space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-3">1. Dados da Empresa</span>
              <div className="space-y-3">
                <input type="text" required placeholder="Nome Fantasia do Bar" value={nomeFantasia} onChange={(e) => setNomeFantasia(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"/>
                <input type="text" placeholder="CNPJ (Opcional)" value={cnpj} onChange={(e) => setCnpj(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"/>
              </div>
            </div>

            <div className="border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-3">2. Administrador Local (Dono)</span>
              <div className="space-y-3">
                <input type="text" required placeholder="Nome Completo do Dono" value={nomeDono} onChange={(e) => setNomeDono(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"/>
                <input type="email" required placeholder="E-mail de Acesso Master" value={emailDono} onChange={(e) => setEmailDono(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"/>
                <input type="password" required placeholder="Senha Inicial do Cliente" value={senhaDono} onChange={(e) => setSenhaDono(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"/>
              </div>
            </div>

            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">3. Vigência Inicial da Licença</span>
              <select value={mesesIniciais} onChange={(e) => setMesesIniciais(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500">
                <option value="1">1 Mês (Padrão)</option>
                <option value="3">3 Meses (Trimestral)</option>
                <option value="6">6 Meses (Semestral)</option>
                <option value="12">12 Meses (Anual)</option>
              </select>
            </div>

            <button type="submit" disabled={salvando} className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2.5 rounded-xl text-sm shadow-md transition-colors mt-2">
              {salvando ? 'Criando Instâncias...' : 'Ativar Sistema e Contrato'}
            </button>
          </form>
        </div>

        {/* Painel Direito: Listagem de Bares, Prazos e Cobrança */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between shadow-md">
            <div className="flex items-center gap-4">
              <div className="bg-amber-500/10 p-3 rounded-xl"><Layers className="w-6 h-6 text-amber-500" /></div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Métricas do Ecossistema</p>
                <h3 className="text-xl font-bold mt-0.5 text-slate-200">Total de Instâncias Ativas: <span className="text-amber-400 font-mono font-black">{bares.length}</span></h3>
              </div>
            </div>
            <button onClick={buscarBares} className="p-2 hover:bg-slate-800 rounded-xl text-slate-500 hover:text-slate-200 transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-2 text-slate-400 mb-4">
              <Building2 className="w-4 h-4" />
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-300">Gestão Contratual e Financeira</h3>
            </div>

            {carregando ? (
              <p className="text-sm text-slate-500 font-mono">Lendo tabelas relacionais...</p>
            ) : bares.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum bar parceiro cadastrado na plataforma.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase font-bold">
                      <th className="py-2.5">Estabelecimento</th>
                      <th className="py-2.5">Vencimento</th>
                      <th className="py-2.5">Status Sistema</th>
                      <th className="py-2.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40 text-slate-300">
                    {bares.map((bar) => {
                      const vencimento = bar.data_vencimento ? new Date(bar.data_vencimento) : null;
                      const vencido = vencimento ? new Date() > vencimento : false;
                      return (
                        <tr key={bar.id} className="hover:bg-slate-800/10 transition-colors">
                          <td className="py-3">
                            <p className="font-semibold text-slate-200">{bar.nome}</p>
                            <p className="text-[11px] text-slate-500 font-mono">ID Tenant: #00{bar.id}</p>
                          </td>
                          <td className="py-3 font-mono text-xs">
                            {vencimento ? (
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                                <span className={vencido ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                                  {vencimento.toLocaleDateString('pt-BR')}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-600">Não definido</span>
                            )}
                          </td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                              bar.status === 'ATIVO' && !vencido
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-950'
                                : 'bg-rose-500/10 text-rose-400 border-rose-950'
                            }`}>
                              {vencido ? 'BLOQUEADO (VENCIDO)' : bar.status}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <button
                              onClick={() => setBarFinanceiro(bar)}
                              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs px-2.5 py-1.5 rounded-lg transition-all inline-flex items-center gap-1"
                            >
                              <DollarSign className="w-3.5 h-3.5" /> Receber / Renovar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* MODAL: REGISTRAR COBRANÇA / RENOVAÇÃO DE ASSINATURA */}
      {barFinanceiro && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full shadow-2xl">
            <h3 className="text-md font-bold text-emerald-400 mb-1 flex items-center gap-1.5">
              <DollarSign className="w-5 h-5"/> Baixa de Cobrança (Assinatura)
            </h3>
            <p className="text-xs text-slate-400 mb-4">Lance o pagamento recebido para estender a vigência da licença deste bar no ecossistema.</p>
            
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1 mb-4">
              <p className="text-slate-400">Cliente SaaS: <span className="text-slate-100 font-semibold">{barFinanceiro.nome}</span></p>
              <p className="text-slate-400">Vencimento Atual: <span className="text-slate-200 font-mono font-bold">{barFinanceiro.data_vencimento ? new Date(barFinanceiro.data_vencimento).toLocaleDateString('pt-BR') : 'Expirado'}</span></p>
            </div>
            
            <form onSubmit={lancarPagamento} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-medium">Valor Recebido (R$):</label>
                <input 
                  type="number" 
                  step="0.01" 
                  required
                  value={valorPago} 
                  onChange={(e) => setValorPago(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-medium">Tempo de Extensão:</label>
                <select 
                  value={mesesAdicionais} 
                  onChange={(e) => setMesesAdicionais(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 text-sm cursor-pointer"
                >
                  <option value="1">+ 1 Mês (Mensal)</option>
                  <option value="3">+ 3 Meses (Trimestral)</option>
                  <option value="6">+ 6 Meses (Semestral)</option>
                  <option value="12">+ 12 Meses (Anual)</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setBarFinanceiro(null)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-xl text-sm transition-colors font-medium">Cancelar</button>
                <button type="submit" className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2 rounded-xl text-sm transition-colors">Confirmar Pagamento</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}