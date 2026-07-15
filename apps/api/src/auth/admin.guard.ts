import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

/** Allows only agents with the `admin` role. Use after JwtAuthGuard. */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    if (req.user?.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
