import express, { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { verificarToken, concederAcesso, CustomRequest } from './middlewares/auth';
import { tratadorDeErrosGlobal } from './middlewares/erro';
import cors from 'cors';

// Carrega as variáveis de ambiente
dotenv.config();

const app = express();
const prisma = new PrismaClient();

// Configura o CORS e o Parser de JSON na ordem correta
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'chave_reserva_segura';

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

// Helper para encapsular o tratamento de erros assíncronos no Express v4
const capturarErro = (fn: Function) => (req: CustomRequest, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

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
  const produtos = await prisma.produtos.findMany({ where: { bar_id } });
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
      codigo_barras: dadosValidados.codigo_barras
    }
  });
  return res.status(201).json(novoProduto);
}));

// ==========================================
// MÓDULO DE FIADO (PROTEGIDO)
// ==========================================

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

  if (!cliente || cliente.bar_id !== bar_id) {
    return res.status(404).json({ error: 'Cliente não cadastrado ou não pertence a este bar.' });
  }

  const saldoAtual = Number(cliente.saldo_devedor);
  const limite = Number(cliente.limite_credito);

  if (tipo === 'DEBITO' && (saldoAtual + valorNum) > limite) {
    return res.status(400).json({
      error: 'Operação negada: Esta compra excede o limite de fiado do cliente!',
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
  if (!mesa || mesa.bar_id !== bar_id) {
    return res.status(404).json({ error: 'Mesa não encontrada neste bar.' });
  }

  const mesaAtualizada = await prisma.mesas.update({
    where: { id: Number(mesa_id) },
    data: { status }
  });

  return res.json({ message: `Mesa agora está ${status}`, mesa: mesaAtualizada });
}));

app.post('/mesas/pedido', verificarToken, capturarErro(async (req: CustomRequest, res: Response) => {
  const bar_id = req.usuarioLogado?.bar_id;
  const { mesa_id, produto_id, quantidade } = req.body;
  const qtdLançada = Number(quantidade || 1);

  const mesa = await prisma.mesas.findUnique({ where: { id: Number(mesa_id) } });
  if (!mesa || mesa.bar_id !== bar_id) {
    return res.status(404).json({ error: 'Mesa não encontrada neste bar.' });
  }

  const produto = await prisma.produtos.findUnique({ where: { id: Number(produto_id) } });
  if (!produto || produto.bar_id !== bar_id) {
    return res.status(404).json({ error: 'Produto não encontrado neste bar.' });
  }

  if (produto.quantidade_estoque < qtdLançada) {
    return res.status(400).json({ error: `Estoque insuficiente! Estoque atual: ${produto.quantidade_estoque}` });
  }

  const [novoPedido] = await prisma.$transaction([
    prisma.pedidos_mesa.create({
      data: { bar_id: Number(bar_id), mesa_id: Number(mesa_id), produto_id: Number(produto_id), quantidade: qtdLançada }
    }),
    prisma.produtos.update({
      where: { id: Number(produto_id) },
      data: { quantidade_estoque: produto.quantidade_estoque - qtdLançada }
    })
  ]);

  return res.status(201).json({ message: 'Item launched with success!', pedido: novoPedido });
}));

app.post('/mesas/fechamento', verificarToken, capturarErro(async (req: CustomRequest, res: Response) => {
  const bar_id = req.usuarioLogado?.bar_id;
  const { mesa_id, forma_pagamento, cliente_fiado_id } = req.body;

  if (!mesa_id || !forma_pagamento) {
    return res.status(400).json({ error: 'Campos obrigatórios: mesa_id e forma_pagamento.' });
  }

  const pedidos = await prisma.pedidos_mesa.findMany({
    where: { bar_id, mesa_id: Number(mesa_id) },
    include: { Survey_produtos: { select: { preco_venda: true } } } as any
  });

  if (pedidos.length === 0) {
    return res.status(400).json({ error: 'Esta mesa não possui pedidos ativos para fechamento.' });
  }

  const valorTotal = pedidos.reduce((acc: number, pedido: any) => {
    const produto = pedido.produtos || pedido.Survey_produtos;
    return acc + (Number(produto.preco_venda) * pedido.quantidade);
  }, 0);

  if (forma_pagamento === 'FIADO') {
    if (!cliente_fiado_id) return res.status(400).json({ error: 'O cliente_fiado_id é obrigatório.' });

    const cliente = await prisma.clientes_fiado.findUnique({ where: { id: Number(cliente_fiado_id) } });
    if (!cliente || cliente.bar_id !== bar_id) return res.status(404).json({ error: 'Cliente de fiado inválido.' });

    const saldoAtual = Number(cliente.saldo_devedor);
    if ((saldoAtual + valorTotal) > Number(cliente.limite_credito)) {
      return res.status(400).json({ error: 'Mesa não pode ser fechada: Limite do fiado excedido.' });
    }

    await prisma.$transaction([
      prisma.clientes_fiado.update({ where: { id: cliente.id }, data: { saldo_devedor: saldoAtual + valorTotal } }),
      prisma.historico_fiado.create({
        data: { bar_id: Number(bar_id), cliente_id: cliente.id, tipo: 'DEBITO', valor: valorTotal, descricao: `Mesa ${mesa_id}` }
      }),
      prisma.pedidos_mesa.deleteMany({ where: { mesa_id: Number(mesa_id) } }),
      prisma.mesas.update({ where: { id: Number(mesa_id) }, data: { status: 'LIVRE' } })
    ]);

    return res.json({ message: 'Mesa fechada no Fiado!', total_pago: valorTotal });
  }

  await prisma.$transaction([
    prisma.pedidos_mesa.deleteMany({ where: { mesa_id: Number(mesa_id) } }),
    prisma.mesas.update({ where: { id: Number(mesa_id) }, data: { status: 'LIVRE' } })
  ]);

  return res.json({ message: `Mesa fechada via ${forma_pagamento}!`, total_pago: valorTotal });
}));

// RELATÓRIOS DO DASHBOARD
app.get('/relatorios/dashboard', verificarToken, concederAcesso(['DONO']), capturarErro(async (req: CustomRequest, res: Response) => {
  const bar_id = req.usuarioLogado?.bar_id;

  const topDevedores = await prisma.clientes_fiado.findMany({
    where: { bar_id, saldo_devedor: { gt: 0 } },
    orderBy: { saldo_devedor: 'desc' },
    take: 5,
    select: { nome: true, saldo_devedor: true, limite_credito: true }
  });

  const movimentacoesFiado = await prisma.historico_fiado.findMany({
    where: { bar_id },
    select: { tipo: true, valor: true }
  });

  const totalPenduradoNoFiado = movimentacoesFiado.filter((m: any) => m.tipo === 'DEBITO').reduce((acc: number, m: any) => acc + Number(m.valor), 0);
  const totalPagoNoFiado = movimentacoesFiado.filter((m: any) => m.tipo === 'CREDITO').reduce((acc: number, m: any) => acc + Number(m.valor), 0);
  
  const itensEmMesas = await prisma.pedidos_mesa.findMany({ 
    where: { bar_id }, 
    include: { Survey_produtos: { select: { preco_venda: true } } } as any 
  });
  
  const totalEmMesasAbertas = itensEmMesas.reduce((acc: number, pedido: any) => {
    const produto = pedido.produtos || pedido.Survey_produtos;
    return acc + (Number(produto.preco_venda) * pedido.quantidade);
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

// ==========================================
// 🚨 INTERCEPTADOR DE ERROS
// ==========================================
app.use(tratadorDeErrosGlobal);

// ENCERRAMENTO SEGURO
process.on('SIGINT', async () => { await prisma.$disconnect(); process.exit(0); });
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`🚀 Servidor rodando na porta ${PORT}`); });
