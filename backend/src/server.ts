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
// FUNÇÕES UTILITÁRIAS (No topo para evitar problemas de hoisting)
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

// SCHEMAS DE VALIDAÇÃO DO CAIXA
const caixaAberturaSchema = z.object({
  valor_abertura: z.union([z.string(), z.number()]).transform((val) => Number(val))
});

const caixaFechamentoSchema = z.object({
  valor_fechamento: z.union([z.string(), z.number()]).transform((val) => Number(val))
});

// ==========================================
// MÓDULO DE CONTROLE DE CAIXA (PROTEGIDO)
// ==========================================

// 1. VERIFICAR STATUS DO CAIXA ATUAL
app.get('/caixa/status', verificarToken, capturarErro(async (req: CustomRequest, res: Response) => {
  const bar_id = Number(req.usuarioLogado?.bar_id);

  const caixaAberto = await prisma.caixas.findFirst({
    where: { bar_id, status: 'ABERTO' }
  });

  return res.json(caixaAberto ? { aberto: true, caixa: caixaAberto } : { aberto: false });
}));

// 2. ABRIR O CAIXA DO DIA
app.post('/caixa/abrir', verificarToken, capturarErro(async (req: CustomRequest, res: Response) => {
  const bar_id = Number(req.usuarioLogado?.bar_id);
  const usuario_id = Number(req.usuarioLogado?.id);
  const { valor_abertura } = caixaAberturaSchema.parse(req.body);

  const caixaExistente = await prisma.caixas.findFirst({
    where: { bar_id, status: 'ABERTO' }
  });

  if (caixaExistente) {
    return res.status(400).json({ error: 'Já existe um caixa aberto para este establishment.' });
  }

  const novoCaixa = await prisma.caixas.create({
    data: { bar_id, usuario_id, valor_abertura, status: 'ABERTO' }
  });

  return res.status(201).json({ message: 'Caixa aberto com sucesso!', caixa: novoCaixa });
}));

// 3. FECHAR O CAIXA DO DIA
app.post('/caixa/fechar', verificarToken, capturarErro(async (req: CustomRequest, res: Response) => {
  const bar_id = Number(req.usuarioLogado?.bar_id);
  const { valor_fechamento } = caixaFechamentoSchema.parse(req.body);

  const caixaAberto = await prisma.caixas.findFirst({
    where: { bar_id, status: 'ABERTO' }
  });

  if (!caixaAberto) {
    return res.status(400).json({ error: 'Não há nenhum caixa aberto para realizar o fechamento.' });
  }

  const caixaAtualizado = await prisma.caixas.update({
    where: { id: caixaAberto.id },
    data: {
      status: 'FECHADO',
      valor_fechamento,
      data_fechamento: new Date()
    }
  });

  return res.json({ message: 'Caixa encerrado com sucesso!', caixa: caixaAtualizado });
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
      funcao: funcao || 'GARCOM'
    }
  });

  return res.status(201).json({
    message: 'Usuário criado com sucesso!',
    usuario: { id: novoUsuario.id, nome: novoUsuario.nome, email: novoUsuario.email, funcao: novoUsuario.funcao }
  });
}));

app.post('/auth/login', capturarErro(async (req: CustomRequest, res: Response) => {
  const dadosValidados = loginSchema.parse(req.body);

  const usuario = await prisma.usuarios.findUnique({ where: { email: dadosValidados.email } });
  if (!usuario) {
    return res.status(401).json({ error: 'Credenciais inválidas (E-mail não encontrado).' });
  }

  const senhaValida = await bcrypt.compare(dadosValidados.senha, usuario.senha);
  if (!senhaValida) {
    return res.status(401).json({ error: 'Credenciais inválidas (Senha incorreta).' });
  }

  const token = jwt.sign(
    { id: usuario.id, bar_id: usuario.bar_id, funcao: usuario.funcao },
    JWT_SECRET,
    { expiresIn: '1d' }
  );

  return res.json({
    message: 'Login bem-sucedido!',
    token,
    usuario: { nome: usuario.nome, funcao: usuario.funcao }
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
    await prisma.$transaction([
      prisma.pedidos_mesa.deleteMany({ where: { mesa_id } }),
      prisma.mesas.update({ where: { id: mesa_id }, data: { status: 'LIVRE' } })
    ]);
  }

  return res.json({ message: 'Mesa finalizada e conta encerrada com sucesso!', total: totalConsumo });
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