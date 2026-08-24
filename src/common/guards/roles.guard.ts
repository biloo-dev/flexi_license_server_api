import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../constants/roles.constant';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { BusinessException } from '../exceptions/business.exception';
import { ErrorCode } from '../constants/error-codes.constant';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.role) {
      throw new BusinessException(
        ErrorCode.AUTH_REQUIRED,
        'Authentication required to verify permissions',
        401,
      );
    }

    const hasRole = requiredRoles.includes(user.role as UserRole);

    if (!hasRole) {
      throw new BusinessException(
        ErrorCode.FORBIDDEN,
        `Access denied. Requires one of the following roles: [${requiredRoles.join(', ')}]. Current role: '${user.role}'`,
        403,
      );
    }

    return true;
  }
}
