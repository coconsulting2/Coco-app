/**
 * @module JwtSessionTokenSigner
 * @description Adapter JWT del port `SessionTokenSigner`. Wraps el módulo
 * `jsonwebtoken` de Node.js. La verificación cruza tipos a `UserIdentity`
 * (el domain del slice).
 *
 * El secret se lee de `process.env.JWT_SECRET` al instanciar; falla rápido si
 * no está configurado. TTL configurable; default 1h (paridad con legacy).
 */
import jwt, { type SignOptions } from "jsonwebtoken";
import type { SessionTokenSigner } from "~/contexts/identity/domain/ports/SessionTokenSigner.js";
import type { UserIdentity } from "~/contexts/identity/domain/entities/User.js";
import type { UserRole } from "~/shared/types/roles.js";

export class JwtSessionTokenSigner implements SessionTokenSigner {
  private readonly secret: string;
  private readonly options: SignOptions;

  constructor(opts?: { secret?: string; expiresIn?: SignOptions["expiresIn"] }) {
    const secret = opts?.secret ?? process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET no configurado");
    }
    this.secret = secret;
    this.options = { expiresIn: opts?.expiresIn ?? "1h" };
  }

  sign(payload: UserIdentity & { ip?: string | null }): string {
    return jwt.sign(
      {
        user_id: payload.userId,
        organization_id:
          payload.organizationId != null ? String(payload.organizationId) : null,
        organization_kind: payload.isRoot ? "ROOT" : "CLIENT",
        role: payload.role,
        username: payload.username,
        ip: payload.ip ?? null,
      },
      this.secret,
      this.options,
    );
  }

  async verify(token: string): Promise<UserIdentity> {
    const decoded = jwt.verify(token, this.secret) as {
      user_id: number;
      organization_id: string | null;
      organization_kind: string;
      role: string;
      username: string;
    };
    return {
      userId: decoded.user_id,
      username: decoded.username,
      role: decoded.role as UserRole,
      organizationId: decoded.organization_id != null ? BigInt(decoded.organization_id) : null,
      isRoot: decoded.organization_kind === "ROOT",
    };
  }
}
