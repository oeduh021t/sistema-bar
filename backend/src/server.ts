import express from 'express';
import type { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { verificarToken, concederAcesso } from './middlewares/auth';
import type { CustomRequest } from './middlewares/auth';
import { tratadorDeErrosGlobal } from './middlewares/erro';
import cors from 'cors';

dotenv.config();

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'chave_reserva_segura';

// ==========================================
// FUNÇÕES UTILITÁRIAS
// ==========================================
const capturarErro = (fn: Function) => (req: CustomRequest, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// ==========================================
// SCHEMAS DE VALIDAÇÃO (ZOD)
// ==========================================
const loginSchema = z.object({
  email: z.string().email({ message: 'E-mail inválido.' }),
  senha: z.string().min(6, { message: 'A senha deve conter no mínimo 6 caracteres.' })
});

const produtoSchema = z.object({
  nome: z.string().min(2, { message: 'O nome do produto deve ter pelo menos 2 caracteres.' }),
  preco_venda: z.union([z.string(), z.number()]).transform((val) => String(val)),
  quantidade_estoque: z.number().int().nonnegative({ message: 'A quantidade em estoque não pode ser negativa.' }),
  codigo_barras: z.string().optional()
});

const fechamentoSchema = z.object({
  mesa_id: z.union([z.string(), z.number()]).transform((val) => Number(val)),
  forma_pagamento: z.enum(['DINHEIRO', 'PIX', 'CARTAO', 'FIADO']),
  cliente_fiado_id: z.union([z.string(), z.number()]).optional().transform((val) => val ? Number(val) : undefined)
});

const caixaAberturaSchema = z.object({
  valor_abertura: z.union([z.string(), z.number()]).transform((val) => Number(val))
});

const caixaFechamentoSchema = z.object({
  valor_fechamento: z.union([z.string(), z.number()]).transform((val) => Number(val))
});

const loginSaasSchema = z.object({
  email: z.string().email({ message: 'E-mail inválido.' }),
  senha: z.string().min(6)
});

const cadastroBarSchema = z.object({
  nome_fantasia: z.string().min(2, { message: 'Nome do bar inválido.' }),
  cnpj: z.string().optional(),
  nome_dono: z.string().min(2),
  email_dono: z.string().email(),
  senha_dono: z.string().min(6),
  meses_iniciais: z.number().int().positive().default(1) // 🟢 Opcional: define quantos meses de cortesia o bar inicia
});

// ==========================================
// MÓDULO PORTAL SAAS - MASTER ADMIN
// ==========================================

// 1. LOGIN DO SUPER ADMINISTRADOR DO SOFTWARE
app.post('/saas/login', capturarErro(async (req: CustomRequest, res: Response) => {
  const { email, senha } = loginSaasSchema.parse(req.body);

  const admin = await prisma.saas_admins.findUnique({ where: { email } });
  if (!admin) {
    return res.status(401).json({ error: 'Acesso negado. Administrador não encontrado.' });
  }

  const senhaValida = await bcrypt.compare(senha, admin.senha);
  if (!senhaValida) {
    return res.status(401).json({ error: 'Senha incorreta.' });
  }

  const token = jwt.sign(
    { id: admin.id, nome: admin.nome, isSuperAdmin: true },
    JWT_SECRET,
    { expiresIn: '12h' }
  );

  return res.json({
    message: 'Bem-vindo ao Painel Controle Master!',
    token,
    admin: { nome: admin.nome }
  });
}));

// 2. ONBOARDING AUTOMATIZADO: CRIA O BAR (COM VENCIMENTO FUTURO) AND PRIMEIRO DONO
app.post('/saas/cadastrar-bar', capturarErro(async (req: CustomRequest, res: Response) => {
  const { nome_fantasia, cnpj, nome_dono, email_dono, senha_dono, meses_iniciais } = cadastroBarSchema.parse(req.body);

  const emailExiste = await prisma.usuarios.findUnique({ where: { email: email_dono } });
  if (emailExiste) {
    return res.status(400).json({ error: 'Este e-mail de dono já está cadastrado no ecossistema.' });
  }

  const saltos = await bcrypt.genSalt(10);
  const senhaDonoCripto = await bcrypt.hash(senha_dono, saltos);

  // Calcula data de vencimento inicial com base nos meses cortesia/iniciais contratados
  const vencimentoInicial = new Date();
  vencimentoInicial.setMonth(vencimentoInicial.getMonth() + meses_iniciais);

  const resultado = await prisma.$transaction(async (tx) => {
    const novoBar = await tx.bares.create({
      data: { 
        nome: nome_fantasia, 
        cnpj,
        status: "ATIVO",
        data_vencimento: vencimentoInicial
      }
    });

    const usuarioDono = await tx.usuarios.create({
      data: {
        nome: nome_dono,
        email: email_dono,
        senha: senhaDonoCripto,
        funcao: 'DONO',
        status: 'ATIVO',
        bar_id: novoBar.id
      }
    });

    return { novoBar, usuarioDono };
  });

  return res.status(201).json({
    message: `Instância criada com sucesso para o estabelecimento ID #${resultado.novoBar.id}!`,
    bar: resultado.novoBar,
    dono: { id: resultado.usuarioDono.id, nome: resultado.usuarioDono.nome, email: resultado.usuarioDono.email }
  });
}));

// 3. LISTAR TODOS OS BARES ASSINANTES DA PLATAFORMA
app.get('/saas/bares', capturarErro(async (req: CustomRequest, res: Response) => {
  const listaBares = await prisma.bares.findMany({ 
    orderBy: { criado_em: 'desc' } 
  });
  return res.json(listaBares);
}));

// 4. REGISTRAR PAGAMENTO DE MENSALIDADE (RENOVAÇÃO DE ASSINATURA)
app.post('/saas/bares/:id/pagamentos', capturarErro(async (req: CustomRequest, res: Response) => {
  const barId = Number(req.params.id);
  const { valor_pago, meses_adicionais } = z.object({
    valor_pago: z.number().positive(),
    meses_adicionais: z.number().int().positive().default(1)
  }).parse(req.body);

  const bar = await prisma.bares.findUnique({ where: { id: barId } });
  if (!bar) return res.status(404).json({ error: 'Bar não encontrado.' });

  // Se o bar já estiver vencido, calcula a partir de hoje. Se não, estende a partir do vencimento futuro atual.
  const dataBase = bar.data_vencimento && new Date(bar.data_vencimento) > new Date() ? new Date(bar.data_vencimento) : new Date();
  const novoVencimento = new Date(dataBase);
  novoVencimento.setMonth(novoVencimento.getMonth() + meses_adicionais);

  const historicoPagamento = await prisma.$transaction(async (tx) => {
    // 1. Registra o histórico na tabela de mensalidades
    const historico = await tx.mensalidades.create({
      data: {
        bar_id: barId,
        valor_pago,
        proximo_vencimento: novoVencimento,
        status: 'PAGO'
      }
    });

    // 2. Atualiza a data de vencimento e garante o status ATIVO
    await tx.bares.update({
      where: { id: barId },
      data: {
        data_vencimento: novoVencimento,
        status: 'ATIVO'
      }
    });

    return historico;
  });

  return res.status(201).json({ 
    message: 'Pagamento registrado e licença renovada com sucesso!', 
    novo_vencimento: novoVencimento,
    pagamento: historicoPagamento 
  });
}));

// ==========================================
// MÓDULO DE CONTROLE DE CAIXA (PROTEGIDO)
// ==========================================

app.get('/caixa/status', verificarToken, capturarErro(async (req: CustomRequest, res: Response) => {
  const bar_id = Number(req.usuarioLogado?.bar_id);

  const caixaAberto = await prisma.caixas.findFirst({
    where: { bar_id, status: 'ABERTO' }
  });

  if (!caixaAberto) {
    return res.json({ aberto: false });
  }

  const movimentacoes = await prisma.movimentacoes_caixa.findMany({
    where: { caixa_id: caixaAberto.id }
  });

  return res.json({
    aberto: true,
    caixa: caixaAberto,
    movimentacoes
  });
}));

app.post('/caixa/abrir', verificarToken, capturarErro(async (req: CustomRequest, res: Response) => {
  const bar_id = Number(req.usuarioLogado?.bar_id);
  const usuario_id = Number(req.usuarioLogado?.id);
  const { valor_abertura } = caixaAberturaSchema.parse(req.body);

  const caixaExistente = await prisma.caixas.findFirst({
    where: { bar_id, status: 'ABERTO' }
  });

  if (caixaExistente) {
    return res.status(400).json({ error: 'Já existe um caixa aberto para este estabelecimento.' });
  }

  const novoCaixa = await prisma.caixas.create({
    data: { 
      bar_id, 
      usuario_id, 
      valor_abertura, 
      status: 'ABERTO',
      total_dinheiro_sistema: valor_abertura
    }
  });

  return res.status(201).json({ message: 'Caixa aberto com sucesso!', caixa: novoCaixa });
}));

app.post('/caixa/fechar', verificarToken, capturarErro(async (req: CustomRequest, res: Response) => {
  const bar_id = Number(req.usuarioLogado?.bar_id);
  const { valor_fechamento } = caixaFechamentoSchema.parse(req.body);

  const caixaAberto = await prisma.caixas.findFirst({
    where: { bar_id, status: 'ABERTO' }
  });

  if (!caixaAberto) {
    return res.status(400).json({ error: 'Não há nenhum caixa aberto para realizar o fechamento.' });
  }

  const totalSistemaEsperado = Number(caixaAberto.total_dinheiro_sistema);
  const diferenca = valor_fechamento - totalSistemaEsperado;

  const caixaAtualizado = await prisma.caixas.update({
    where: { id: caixaAberto.id },
    data: {
      status: 'FECHADO',
      valor_fechamento_real: valor_fechamento,
      diferenca_caixa: diferenca,
      data_fechamento: new Date()
    }
  });

  return res.json({ 
    message: 'Caixa encerrado com sucesso!', 
    caixa: caixaAtualizado,
    auditoria: {
      esperado_sistema: totalSistemaEsperado,
      informado_operador: valor_fechamento,
      resultado: diferenca === 0 ? 'Perfeito' : diferenca > 0 ? `Sobra de R$ ${diferenca}` : `Falta de R$ ${Math.abs(diferenca)}`
    }
  });
}));

app.post('/caixa/movimentacao', verificarToken, capturarErro(async (req: CustomRequest, res: Response) => {
  const bar_id = Number(req.usuarioLogado?.bar_id);
  const { tipo, valor, meio_pagto, descricao } = req.body;

  if (!tipo || !valor || !meio_pagto) {
    return res.status(400).json({ error: 'Campos obrigatórios: tipo, valor e meio_pagto.' });
  }

  const caixaAberto = await prisma.caixas.findFirst({ where: { bar_id, status: 'ABERTO' } });
  if (!caixaAberto) return res.status(400).json({ error: 'Não há caixa aberto para movimentar.' });

  const valorNum = Number(valor);
  let campoIncremento = 'total_dinheiro_sistema';
  if (meio_pagto === 'PIX') campoIncremento = 'total_pix_sistema';
  if (meio_pagto === 'CARTAO') campoIncremento = 'total_cartao_sistema';

  const modificacaoValor = tipo === 'SANGRIA' ? -valorNum : valorNum;

  await prisma.$transaction([
    prisma.movimentacoes_caixa.create({
      data: { bar_id, caixa_id: caixaAberto.id, tipo, meio_pagto, valor: valorNum, descricao }
    }),
    prisma.caixas.update({
      where: { id: caixaAberto.id },
      data: { [campoIncremento]: { increment: modificacaoValor } }
    })
  ]);

  return res.json({ message: 'Movimentação avulsa registrada com sucesso!' });
}));

// ==========================================
// MÓDULO DE AUTENTICAÇÃO (ROTAS PÚBLICAS)
// ==========================================

app.post('/auth/registrar', capturarErro(async (req: CustomRequest, res: Response) => {
  const { bar_id, nome, email, senha, funcao } = req.body;

  if (!bar_id || !nome || !email || !senha) {
    return res.status(400).json({ error: 'Campos obrigatórios: bar_id, nome, email e senha.' });
  }

  const usuarioExiste = await prisma.usuarios.findUnique({ where: { email } });
  if (usuarioExiste) {
    return res.status(400).json({ error: 'Este e-mail já está cadastrado no sistema.' });
  }

  const senhaCriptografada = await bcrypt.hash(senha, 10);

  const novoUsuario = await prisma.usuarios.create({
    data: {
      bar_id: Number(bar_id),
      nome,
      email,
      senha: senhaCriptografada,
      funcao: funcao || 'GARCOM',
      status: 'ATIVO'
    }
  });

  return res.status(201).json({
    message: 'Usuário criado com sucesso!',
    usuario: { id: novoUsuario.id, nome: novoUsuario.nome, email: novoUsuario.email, funcao: novoUsuario.funcao }
  });
}));

app.post('/auth/login', capturarErro(async (req: CustomRequest, res: Response) => {
  const dadosValidados = loginSchema.parse(req.body);

  const usuario = await prisma.usuarios.findUnique({ 
    where: { email: dadosValidados.email },
    include: { bares: true } // 🟢 Traz as informações do bar unificado para validar a licença
  });

  if (!usuario) {
    return res.status(401).json({ error: 'Credenciais inválidas (E-mail não encontrado).' });
  }

  // 🟢 TRAVA 1: USUÁRIO DESATIVADO PELO DONO DO BAR
  if (usuario.status === 'INATIVO') {
    return res.status(403).json({ error: 'Seu acesso foi desativado pelo administrador do estabelecimento.' });
  }

  const barDoUsuario = usuario.bares;

  // 🟢 TRAVA 2: BLOQUEIO AUTOMÁTICO SE A MENSALIDADE DO SAAS ESTIVER VENCIDA
  if (barDoUsuario && barDoUsuario.data_vencimento && new Date() > new Date(barDoUsuario.data_vencimento)) {
    if (barDoUsuario.status !== 'BLOQUEADO') {
      await prisma.bares.update({ where: { id: barDoUsuario.id }, data: { status: 'BLOQUEADO' } });
    }
    return res.status(402).json({ error: 'Acesso suspenso. Constatamos pendências no pagamento da licença de uso do sistema.' });
  }

  const senhaValida = await bcrypt.compare(dadosValidados.senha, usuario.senha);
  if (!senhaValida) {
    return res.status(401).json({ error: 'Credenciais inválidas (Senha incorreta).' });
  }

  // 🟢 CÁLCULO INTELIGENTE DO AVISO DE VENCIMENTO (10 DIAS ANTES)
  let mensagemAlerta: string | null = null;
  if (barDoUsuario && barDoUsuario.data_vencimento) {
    const hoje = new Date();
    const dataVenc = new Date(barDoUsuario.data_vencimento);
    const diferencaTempo = dataVenc.getTime() - hoje.getTime();
    const diasRestantes = Math.ceil(diferencaTempo / (1000 * 60 * 60 * 24));

    if (diasRestantes <= 10 && diasRestantes >= 0) {
      mensagemAlerta = `Aviso Financeiro: Faltam ${diasRestantes} dias para o vencimento da sua mensalidade (${dataVenc.toLocaleDateString('pt-BR')}). Realize o pagamento para evitar suspensões de serviço.`;
    }
  }

  const token = jwt.sign(
    { id: usuario.id, bar_id: usuario.bar_id, funcao: usuario.funcao },
    JWT_SECRET,
    { expiresIn: '1d' }
  );

  return res.json({
    message: 'Login bem-sucedido!',
    token,
    usuario: { nome: usuario.nome, funcao: usuario.funcao },
    alerta_financeiro: mensagemAlerta // 🟢 O Frontend capta este campo para exibir um Toast ou Alert Banner
  });
}));

// ==========================================
// MÓDULO DE PRODUTOS / ESTOQUE (PROTEGIDO)
// ==========================================

app.get('/produtos', verificarToken, capturarErro(async (req: CustomRequest, res: Response) => {
  const bar_id = req.usuarioLogado?.bar_id;
  const produtos = await prisma.produtos.findMany({ where: { bar_id: Number(bar_id) }, orderBy: { nome: 'asc' } });
  return res.json(produtos);
}));

app.post('/produtos', verificarToken, concederAcesso(['DONO']), capturarErro(async (req: CustomRequest, res: Response) => {
  const bar_id = req.usuarioLogado?.bar_id;
  const dadosValidados = produtoSchema.parse(req.body);

  const novoProduto = await prisma.produtos.create({
    data: {
      bar_id: Number(bar_id),
      nome: dadosValidados.nome,
      preco_venda: dadosValidados.preco_venda,
      quantidade_estoque: dadosValidados.quantidade_estoque,
      codigo_barras: dadosValidados.codigo_barras || null
    }
  });
  return res.status(201).json(novoProduto);
}));

// 🟢 1. NOVA ROTA: DELETAR UM PRODUTO DO BANCO (DONO APENAS)
app.delete('/produtos/:id', verificarToken, concederAcesso(['DONO']), capturarErro(async (req: CustomRequest, res: Response) => {
  const produtoId = Number(req.params.id);
  const bar_id = Number(req.usuarioLogado?.bar_id);

  // Segurança: Garante que o dono só pode deletar um produto do próprio bar dele
  const produto = await prisma.produtos.findUnique({ where: { id: produtoId } });
  
  if (!produto || produto.bar_id !== bar_id) {
    return res.status(404).json({ error: 'Produto não encontrado neste estabelecimento.' });
  }

  // Deleta fisicamente o produto do banco
  await prisma.produtos.delete({
    where: { id: produtoId }
  });

  return res.json({ message: 'Produto removido com sucesso do estoque!' });
}));

// 🟢 2. NOVA ROTA: PATCH PARA ATUALIZAR SÓ O ESTOQUE (BALANÇO / INVENTÁRIO)
app.patch('/produtos/:id/estoque', verificarToken, capturarErro(async (req: CustomRequest, res: Response) => {
  const produtoId = Number(req.params.id);
  const bar_id = Number(req.usuarioLogado?.bar_id);
  
  // Valida que o corpo da requisição traz a quantidade correta em formato numérico inteiro
  const { quantidade_estoque } = z.object({
    quantidade_estoque: z.number().int().nonnegative()
  }).parse(req.body);

  // Segurança: Garante que o funcionário/dono está mexendo no produto do bar dele
  const produto = await prisma.produtos.findUnique({ where: { id: produtoId } });
  
  if (!produto || produto.bar_id !== bar_id) {
    return res.status(404).json({ error: 'Produto não localizado neste estabelecimento.' });
  }

  // Atualiza apenas a coluna de estoque no Postgres
  const produtoAtualizado = await prisma.produtos.update({
    where: { id: produtoId },
    data: { quantidade_estoque }
  });

  return res.json({ 
    message: 'Balanço de estoque sincronizado com sucesso!', 
    quantidade_atual: produtoAtualizado.quantidade_estoque 
  });
}));

// ==========================================
// MÓDULO DE PENDÊNCIAS / CRÉDITO (PROTEGIDO)
// ==========================================

app.get('/clientes-fiado', verificarToken, capturarErro(async (req: CustomRequest, res: Response) => {
  const bar_id = req.usuarioLogado?.bar_id;
  const clientes = await prisma.clientes_fiado.findMany({ where: { bar_id: Number(bar_id) }, orderBy: { nome: 'asc' } });
  return res.json(clientes);
}));

app.post('/clientes-fiado', verificarToken, capturarErro(async (req: CustomRequest, res: Response) => {
  const bar_id = req.usuarioLogado?.bar_id;
  const { nome, telefone, limite_credito } = req.body;

  if (!nome) return res.status(400).json({ error: 'O campo nome é obrigatório.' });

  const novoCliente = await prisma.clientes_fiado.create({
    data: {
      bar_id: Number(bar_id),
      nome,
      telefone,
      limite_credito: limite_credito ? Number(limite_credito) : 200.00
    }
  });
  return res.status(201).json(novoCliente);
}));

app.post('/fiado/movimentacao', verificarToken, capturarErro(async (req: CustomRequest, res: Response) => {
  const bar_id = req.usuarioLogado?.bar_id;
  const { cliente_id, tipo, valor, descricao } = req.body;

  if (!cliente_id || !tipo || !valor) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando: cliente_id, tipo, valor.' });
  }

  const valorNum = Number(valor);
  const cliente = await prisma.clientes_fiado.findUnique({ where: { id: Number(cliente_id) } });

  if (!cliente || cliente.bar_id !== Number(bar_id)) {
    return res.status(404).json({ error: 'Cliente não cadastrado ou não pertence a este bar.' });
  }

  const saldoAtual = Number(cliente.saldo_devedor);
  const limite = Number(cliente.limite_credito);

  if (tipo === 'DEBITO' && (saldoAtual + valorNum) > limite) {
    return res.status(400).json({
      error: 'Operação negada: Esta compra excede o limite de crédito do cliente!',
      limite_disponivel: (limite - saldoAtual)
    });
  }

  const novoSaldo = tipo === 'DEBITO' ? saldoAtual + valorNum : saldoAtual - valorNum;

  const [clienteAtualizado] = await prisma.$transaction([
    prisma.clientes_fiado.update({ where: { id: Number(cliente_id) }, data: { saldo_devedor: novoSaldo } }),
    prisma.historico_fiado.create({
      data: { bar_id: Number(bar_id), cliente_id: Number(cliente_id), tipo, valor: valorNum, descricao }
    })
  ]);

  return res.json({
    message: 'Movimentação registrada!',
    cliente: clienteAtualizado.nome,
    novo_saldo_devedor: clienteAtualizado.saldo_devedor
  });
}));

app.post('/fiado/pagamento', verificarToken, capturarErro(async (req: CustomRequest, res: Response) => {
  const bar_id = Number(req.usuarioLogado?.bar_id);
  const { cliente_id, valor, meio_pagto } = req.body;

  if (!cliente_id || !valor || !meio_pagto) {
    return res.status(400).json({ error: 'Campos obrigatórios: cliente_id, valor e meio_pagto.' });
  }

  const valorNum = Number(valor);
  if (valorNum <= 0) {
    return res.status(400).json({ error: 'O valor do pagamento deve ser maior que zero.' });
  }

  const cliente = await prisma.clientes_fiado.findUnique({ where: { id: Number(cliente_id) } });
  if (!cliente || cliente.bar_id !== bar_id) {
    return res.status(404).json({ error: 'Cliente não encontrado neste estabelecimento.' });
  }

  const caixaAberto = await prisma.caixas.findFirst({ where: { bar_id, status: 'ABERTO' } });
  if (!caixaAberto) {
    return res.status(400).json({ error: 'Bloqueado: Não é possível receber pagamentos sem um caixa aberto.' });
  }

  let campoIncremento = 'total_dinheiro_sistema';
  if (meio_pagto === 'PIX') campoIncremento = 'total_pix_sistema';
  if (meio_pagto === 'CARTAO') campoIncremento = 'total_cartao_sistema';

  await prisma.$transaction([
    prisma.clientes_fiado.update({
      where: { id: Number(cliente_id) },
      data: { saldo_devedor: { decrement: valorNum } }
    }),
    prisma.historico_fiado.create({
      data: {
        bar_id,
        cliente_id: Number(cliente_id),
        tipo: 'CREDITO',
        valor: valorNum,
        descricao: `Abatimento parcial/total via ${meio_pagto}`
      }
    }),
    prisma.movimentacoes_caixa.create({
      data: {
        bar_id,
        caixa_id: caixaAberto.id,
        tipo: 'ENTRADA',
        meio_pagto,
        valor: valorNum,
        descricao: `Recebimento de Fiado - Cliente: ${cliente.nome}`
      }
    }),
    prisma.caixas.update({
      where: { id: caixaAberto.id },
      data: { [campoIncremento]: { increment: valorNum } }
    })
  ]);

  return res.json({ message: 'Pagamento processado e injetado no caixa com sucesso!' });
}));

// ==========================================
// MÓDULO DE MESAS E PEDIDOS (PROTEGIDO)
// ==========================================

app.get('/mesas', verificarToken, capturarErro(async (req: CustomRequest, res: Response) => {
  const bar_id = req.usuarioLogado?.bar_id;
  const listaMesas = await prisma.mesas.findMany({
    where: { bar_id: Number(bar_id) },
    orderBy: { numero: 'asc' }
  });
  return res.json(listaMesas);
}));

app.post('/mesas', verificarToken, concederAcesso(['DONO']), capturarErro(async (req: CustomRequest, res: Response) => {
  const bar_id = req.usuarioLogado?.bar_id;
  const { numero } = req.body;

  if (!numero) return res.status(400).json({ error: 'O campo numero é obrigatório.' });

  const novaMesa = await prisma.mesas.create({
    data: { bar_id: Number(bar_id), numero: Number(numero), status: 'LIVRE' }
  });
  return res.status(201).json(novaMesa);
}));

app.post('/mesas/status', verificarToken, capturarErro(async (req: CustomRequest, res: Response) => {
  const bar_id = req.usuarioLogado?.bar_id;
  const { mesa_id, status } = req.body;

  const mesa = await prisma.mesas.findUnique({ where: { id: Number(mesa_id) } });
  if (!mesa || mesa.bar_id !== Number(bar_id)) {
    return res.status(404).json({ error: 'Mesa não encontrada neste bar.' });
  }

  const mesaAtualizada = await prisma.mesas.update({
    where: { id: Number(mesa_id) },
    data: { status }
  });

  return res.json({ message: `Mesa agora está ${status}`, mesa: mesaAtualizada });
}));

app.get('/mesas/:id/pedidos', verificarToken, capturarErro(async (req: CustomRequest, res: Response) => {
  const bar_id = req.usuarioLogado?.bar_id;
  const mesa_id = Number(req.params.id);

  const pedidos = await prisma.pedidos_mesa.findMany({
    where: { mesa_id, bar_id: Number(bar_id) },
    include: { produtos: true }
  });

  const consumoFormatado = pedidos.map((item: any) => {
    const produtoRelacionado = item.produtos;
    const precoUn = produtoRelacionado ? Number(produtoRelacionado.preco_venda) : 0;
    const qtdFinal = Number(item.quantidade || item.quantity || 1);
    return {
      produto: produtoRelacionado ? produtoRelacionado.nome : 'Produto Removido',
      qtd: qtdFinal,
      precoUn: precoUn,
      total: precoUn * qtdFinal
    };
  });

  return res.json(consumoFormatado);
}));

app.post('/mesas/pedido', verificarToken, capturarErro(async (req: CustomRequest, res: Response) => {
  const bar_id = req.usuarioLogado?.bar_id;
  const { mesa_id, produto_id, quantity } = req.body;
  const qtdLancada = Number(quantity || 1);

  const mesa = await prisma.mesas.findUnique({ where: { id: Number(mesa_id) } });
  if (!mesa || mesa.bar_id !== Number(bar_id)) {
    return res.status(404).json({ error: 'Mesa não encontrada neste bar.' });
  }

  const produto = await prisma.produtos.findUnique({ where: { id: Number(produto_id) } });
  if (!produto || produto.bar_id !== Number(bar_id)) {
    return res.status(404).json({ error: 'Produto não encontrado neste bar.' });
  }

  if (produto.quantidade_estoque < qtdLancada) {
    return res.status(400).json({ error: `Estoque insuficiente! Estoque atual: ${produto.quantidade_estoque}` });
  }

  const [novoPedido] = await prisma.$transaction([
    prisma.pedidos_mesa.create({
      data: { 
        bar_id: Number(bar_id), 
        mesa_id: Number(mesa_id), 
        produto_id: Number(produto_id), 
        quantity: qtdLancada, 
        quantidade: qtdLancada 
      }
    }),
    prisma.produtos.update({
      where: { id: Number(produto_id) },
      data: { quantidade_estoque: produto.quantidade_estoque - qtdLancada }
    })
  ]);

  return res.status(201).json({ message: 'Item lançado com sucesso!', pedido: novoPedido });
}));

app.post('/mesas/fechamento', verificarToken, capturarErro(async (req: CustomRequest, res: Response) => {
  const { mesa_id, forma_pagamento, cliente_fiado_id } = fechamentoSchema.parse(req.body);
  const bar_id = Number(req.usuarioLogado?.bar_id);

  const mesaExiste = await prisma.mesas.findUnique({ where: { id: mesa_id } });
  if (!mesaExiste || mesaExiste.bar_id !== bar_id) {
    return res.status(404).json({ error: 'Mesa não cadastrada ou pertencente a outro estabelecimento.' });
  }

  const pedidos = await prisma.pedidos_mesa.findMany({
    where: { mesa_id, bar_id },
    include: { produtos: true }
  });

  if (pedidos.length === 0) {
    return res.status(400).json({ error: 'A mesa não possui pedidos ativos para encerramento.' });
  }

  const totalConsumo = pedidos.reduce((acc: number, item: any) => {
    const preco = item.produtos ? Number(item.produtos.preco_venda) : 0;
    const qtd = Number(item.quantidade || item.quantity || 1);
    return acc + (preco * qtd);
  }, 0);

  if (forma_pagamento === 'FIADO') {
    if (!cliente_fiado_id) {
      return res.status(400).json({ error: 'Para fechar como pendência, selecione um devedor cadastrado.' });
    }

    const cliente = await prisma.clientes_fiado.findUnique({ where: { id: cliente_fiado_id } });

    if (!cliente || cliente.bar_id !== bar_id) {
      return res.status(404).json({ error: 'Devedor não encontrado no sistema ou pertencente a outro estabelecimento.' });
    }

    if (Number(cliente.saldo_devedor) + totalConsumo > Number(cliente.limite_credito)) {
      return res.status(400).json({ error: 'Bloqueado: O valor desta comanda excede o limite de crédito disponível para o devedor.' });
    }

    await prisma.$transaction([
      prisma.historico_fiado.create({
        data: { 
          bar_id, 
          cliente_id: cliente_fiado_id, 
          tipo: 'DEBITO', 
          valor: totalConsumo, 
          descricao: `Consumo na Mesa ${mesaExiste.numero}` 
        }
      }),
      prisma.clientes_fiado.update({
        where: { id: cliente_fiado_id },
        data: { saldo_devedor: { increment: totalConsumo } }
      }),
      prisma.pedidos_mesa.deleteMany({ where: { mesa_id } }),
      prisma.mesas.update({ where: { id: mesa_id }, data: { status: 'LIVRE' } })
    ]);

  } else {
    const caixaAberto = await prisma.caixas.findFirst({ where: { bar_id, status: 'ABERTO' } });

    if (caixaAberto) {
      let campoAtualizar = 'total_dinheiro_sistema';
      if (forma_pagamento === 'PIX') campoAtualizar = 'total_pix_sistema';
      if (forma_pagamento === 'CARTAO') campoAtualizar = 'total_cartao_sistema';

      await prisma.$transaction([
        prisma.movimentacoes_caixa.create({
          data: {
            bar_id,
            caixa_id: caixaAberto.id,
            tipo: 'ENTRADA',
            meio_pagto: forma_pagamento,
            valor: totalConsumo,
            descricao: `Encerramento da Mesa ${mesaExiste.numero}`
          }
        }),
        prisma.caixas.update({
          where: { id: caixaAberto.id },
          data: { [campoAtualizar]: { increment: totalConsumo } }
        }),
        prisma.pedidos_mesa.deleteMany({ where: { mesa_id } }),
        prisma.mesas.update({ where: { id: mesa_id }, data: { status: 'LIVRE' } })
      ]);
    } else {
      await prisma.$transaction([
        prisma.pedidos_mesa.deleteMany({ where: { mesa_id } }),
        prisma.mesas.update({ where: { id: mesa_id }, data: { status: 'LIVRE' } })
      ]);
    }
  }

  return res.json({ message: 'Mesa finalizada e conta encerrada com sucesso!', total: totalConsumo });
}));

// ==========================================
// MÓDULO DE GESTÃO DE USUÁRIOS (DONO APENAS)
// ==========================================

app.post('/usuarios/cadastro', verificarToken, capturarErro(async (req: CustomRequest, res: Response) => {
  const bar_id = Number(req.usuarioLogado?.bar_id);
  const funcaoCriador = req.usuarioLogado?.funcao;

  if (funcaoCriador !== 'DONO') {
    return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem cadastrar novos usuários.' });
  }

  const { nome, email, senha, funcao } = req.body;

  if (!nome || !email || !senha || !funcao) {
    return res.status(400).json({ error: 'Todos os campos (nome, email, senha, funcao) são obrigatórios.' });
  }

  const usuarioExistente = await prisma.usuarios.findUnique({ where: { email } });
  if (usuarioExistente) {
    return res.status(400).json({ error: 'Este e-mail já está cadastrado no sistema.' });
  }

  const saltos = await bcrypt.genSalt(10);
  const senhaCriptografada = await bcrypt.hash(senha, saltos);

  const novoUsuario = await prisma.usuarios.create({
    data: {
      nome,
      email,
      senha: senhaCriptografada,
      funcao: funcao.toUpperCase(),
      status: 'ATIVO',
      bar_id
    }
  });

  return res.status(201).json({
    message: 'Funcionário cadastrado com sucesso!',
    usuario: { id: novoUsuario.id, nome: novoUsuario.nome, email: novoUsuario.email, funcao: novoUsuario.funcao }
  });
}));

// 🟢 NOVA ROTA: ALTERAR STATUS DE UM USUÁRIO (ATIVAR/DESATIVAR ACESSO)
app.patch('/usuarios/:id/status', verificarToken, concederAcesso(['DONO']), capturarErro(async (req: CustomRequest, res: Response) => {
  const { status } = z.object({ status: z.enum(['ATIVO', 'INATIVO']) }).parse(req.body);
  const usuarioId = Number(req.params.id);
  const bar_id = Number(req.usuarioLogado?.bar_id);

  // Impede que o dono busque e desative um usuário pertencente a outro bar assinante
  const usuario = await prisma.usuarios.findUnique({ where: { id: usuarioId } });
  if (!usuario || usuario.bar_id !== bar_id) {
    return res.status(404).json({ error: 'Usuário não localizado neste estabelecimento.' });
  }

  // Regra de segurança opcional: impede o dono de desativar a si mesmo por engano nesta rota
  if (usuario.id === req.usuarioLogado?.id) {
    return res.status(400).json({ error: 'Ação revogada: Você não pode desativar o seu próprio perfil de administrador principal.' });
  }

  const usuarioAtualizado = await prisma.usuarios.update({
    where: { id: usuarioId },
    data: { status }
  });

  return res.json({ 
    message: `Acesso do usuário ${usuarioAtualizado.nome} alterado para ${status} com sucesso!`, 
    usuario: { id: usuarioAtualizado.id, nome: usuarioAtualizado.nome, status: usuarioAtualizado.status } 
  });
}));

// ==========================================
// RELATÓRIOS DO DASHBOARD
// ==========================================
app.get('/relatorios/dashboard', verificarToken, concederAcesso(['DONO']), capturarErro(async (req: CustomRequest, res: Response) => {
  const bar_id = req.usuarioLogado?.bar_id;

  const topDevedores = await prisma.clientes_fiado.findMany({
    where: { bar_id: Number(bar_id), saldo_devedor: { gt: 0 } },
    orderBy: { saldo_devedor: 'desc' },
    take: 5,
    select: { nome: true, saldo_devedor: true, limite_credito: true }
  });

  const movimentacoesFiado = await prisma.historico_fiado.findMany({
    where: { bar_id: Number(bar_id) },
    select: { tipo: true, valor: true }
  });

  const totalPenduradoNoFiado = movimentacoesFiado.filter((m: any) => m.tipo === 'DEBITO').reduce((acc: number, m: any) => acc + Number(m.valor), 0);
  const totalPagoNoFiado = movimentacoesFiado.filter((m: any) => m.tipo === 'CREDITO').reduce((acc: number, m: any) => acc + Number(m.valor), 0);
  
  const pedidosEmMesas = await prisma.pedidos_mesa.findMany({ where: { bar_id: Number(bar_id) } });
  const produtosDoBar = await prisma.produtos.findMany({ where: { bar_id: Number(bar_id) } });

  const totalEmMesasAbertas = pedidosEmMesas.reduce((acc: number, pedido: any) => {
    const produto = produtosDoBar.find(p => p.id === pedido.produto_id);
    const preco = produto ? Number(produto.preco_venda) : 0;
    const qtd = Number(pedido.quantidade || pedido.quantity || 1);
    return acc + (preco * qtd);
  }, 0);

  return res.json({
    resumo_financeiro: {
      total_atualmente_pendurado: totalPenduradoNoFiado - totalPagoNoFiado,
      total_historico_fiado_recebido: totalPagoNoFiado,
      faturamento_potencial_mesas_abertas: totalEmMesasAbertas
    },
    top_clientes_inadimplentes: topDevedores
  });
}));

app.use(tratadorDeErrosGlobal);

process.on('SIGINT', async () => { await prisma.$disconnect(); process.exit(0); });
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`🚀 Servidor rodando na porta ${PORT}`); });