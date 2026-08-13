import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../auth/auth.middleware';
import { db } from '../database';
import { permissions } from '../database/schema';
import { eq, and, or } from 'drizzle-orm';

export function checkPermission(moduleName: string, actionName: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({ error: 'Usuário não autenticado.' });
      }

      // Se for Admin (sem verificação específica restritiva necessária ou se permissão existe no banco)
      const userPermissions = await db
        .select()
        .from(permissions)
        .where(
          and(
            eq(permissions.module, moduleName),
            eq(permissions.action, actionName),
            or(
              user.roleId ? eq(permissions.roleId, user.roleId) : undefined,
              user.sectorId ? eq(permissions.sectorId, user.sectorId) : undefined
            )
          )
        );

      // Se existir regra explicitamente negando
      const isDenied = userPermissions.some(p => p.allowed === false);
      if (isDenied) {
        return res.status(403).json({ error: 'Acesso negado para esta ação/módulo.' });
      }

      next();
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao verificar permissões de acesso.' });
    }
  };
}