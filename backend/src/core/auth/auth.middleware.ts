import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    name: string;
    email: string;
    sectorId: string | null;
    roleId: string | null;
  };
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acesso não autorizado: Token não fornecido.' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'super_secreto_alterar_em_producao', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Acesso negado: Token inválido ou expirado.' });
    }
    req.user = user as AuthenticatedRequest['user'];
    next();
  });
}