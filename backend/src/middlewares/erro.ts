import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function tratadorDeErrosGlobal(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): any {
  // Se o erro for uma falha de validação do Zod
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Falha na validação dos dados enviados.',
      detalhes: err.issues.map((issue) => ({
        campo: issue.path.join('.'),
        mensagem: issue.message
      }))
    });
  }

  // Captura de logs internos no console para o desenvolvedor analisar
  console.error('💥 Erro Interno Oculto:', err);

  // Resposta genérica segura para o usuário final
  return res.status(500).json({
    error: 'Ocorreu um erro interno no servidor. Tente novamente mais tarde.'
  });
}
