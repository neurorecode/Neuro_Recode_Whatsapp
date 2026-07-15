import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/**
 * Accepts the JWT from the `Authorization` header OR a `?t=` query param, so
 * media URLs can be used directly in <img>/<audio>/<video>/<a> tags (which
 * cannot set headers).
 */
@Injectable()
export class MediaTokenGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers?.authorization;
    const fromHeader = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    const token = fromHeader || (req.query?.t as string | undefined);
    if (!token) throw new UnauthorizedException('Missing token');
    try {
      req.user = await this.jwt.verifyAsync(token);
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
