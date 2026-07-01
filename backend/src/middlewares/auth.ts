import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Estende a interface Request do Express para reconhecer os dados do Token
export interface CustomRequest extends Request {
  usuarioLogado?: {
    id: number;
    bar_id: number;
    funcao: string;
  };
}

export function verificarToken(req: CustomRequest, res: Response, next: NextFunction): any {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido.' });
  }

  // O cabeçalho vem no formato: "Bearer TOKEN_AQUI"
  const partes = authHeader.split(' ');
  if (partes.length !== 2 || partes[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Token malformatado. Use o padrão Bearer.' });
  }

  const token = partes[1];
  const secret = process.env.JWT_SECRET || 'chave_reserva_segura';

  try {
    const decodificado = jwt.verify(token, secret) as { id: number; bar_id: number; funcao: string };
    
    // Injeta os dados decodificados na requisição para que as rotas usem depois
    req.usuarioLogado = decodificado;
    
    return next(); // Autorizado! Segue para a rota
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}

// Middleware complementar para travar rotas exclusivas do Dono do Bar
export function concederAcesso(funcoesPermitidas: string[]) {
  return (req: CustomRequest, res: Response, next: NextFunction): any => {
    if (!req.usuarioLogado) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    if (!funcoesPermitidas.includes(req.usuarioLogado.funcao)) {
      return res.status(403).json({ error: 'Acesso negado: Você não tem permissão para esta ação.' });
    }

    return next();
  };
}
