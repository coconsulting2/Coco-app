/**
 * @module jwt.server
 * @description Verificación y firma de JWT — wrapper TypeScript sobre la
 * misma librería `jsonwebtoken` usada por el backend legacy. Conserva el
 * grace period multi-tenant (24h post-deploy) para tokens sin organization_id.
 *
 * Se usa desde:
 *   - actions/login (firma el JWT al autenticar)
 *   - requireUser.server.ts (verifica el JWT en cada loader/action protegido)
 *   - external API key flow (no JWT, pero comparte AuthError)
 */
import jwt, { type SignOptions } from "jsonwebtoken";
import {
  MissingTokenError,
  ExpiredTokenError,
  InvalidTokenError,
  TokenMismatchError,
} from "~/platform/http/errors.server.js";

const IS_DEV = process.env.NODE_ENV === "development";
const MOCK_AUTH_ENABLED = IS_DEV && process.env.MOCK_AUTH === "true";

export type SessionUser = {
  user_id: number;
  organization_id: string | number | null;
  organization_kind?: string | null;
  role: string;
  ip?: string | null;
  email?: string | null;
  department_id?: number | string | null;
  username?: string | null;
  no_empleado?: string | null;
  iat?: number;
  exp?: number;
  isMock?: boolean;
  /** Permission codes resueltos via permission-service y cacheados por request. */
  permissionSet?: Set<string>;
};

const MOCK_USER: SessionUser = Object.freeze({
  user_id: 1,
  organization_id: "1",
  organization_kind: "ROOT",
  role: "Admin Ditta",
  ip: "127.0.0.1",
  isMock: true,
}) as SessionUser;

// Grace period igual al legacy: tokens sin organization_id se aceptan durante 24h post-deploy.
const TOKEN_GRACE_PERIOD_END = process.env.TOKEN_GRACE_PERIOD_END
  ? Date.parse(process.env.TOKEN_GRACE_PERIOD_END)
  : Date.now() + 24 * 60 * 60 * 1000;

function jwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET no configurado");
  return s;
}

/**
 * Verifica un JWT y devuelve el payload tipado. Lanza errores tipados
 * (ExpiredTokenError, InvalidTokenError) que el caller propaga a la respuesta
 * HTTP.
 */
export function verifyToken(token: string): Promise<SessionUser> {
  return new Promise((resolve, reject) => {
    jwt.verify(token, jwtSecret(), (err, decoded) => {
      if (err) {
        if (err.name === "TokenExpiredError") return reject(new ExpiredTokenError());
        return reject(new InvalidTokenError());
      }
      resolve(decoded as SessionUser);
    });
  });
}

/**
 * Firma un JWT con el mismo shape que el legacy. Incluye IP binding cuando
 * se proporciona (puede omitirse en SSR si el IP del browser no coincide con el del server).
 */
export function signToken(payload: Omit<SessionUser, "iat" | "exp">, opts: SignOptions = {}): string {
  return jwt.sign(payload, jwtSecret(), {
    expiresIn: "7d",
    ...opts,
  });
}

/**
 * Devuelve el JWT decodificado tras validar:
 *   - Existencia del token (Bearer header o cookie).
 *   - Firma + expiración.
 *   - IP binding (opcional; deshabilitable con JWT_SKIP_IP_CHECK o NODE_ENV=development).
 *   - organization_id presente o dentro del grace period.
 *
 * @throws MissingTokenError | ExpiredTokenError | InvalidTokenError | TokenMismatchError
 */
export async function decodeRequestUser(
  rawToken: string | null,
  requestIp: string | null,
): Promise<SessionUser> {
  if (MOCK_AUTH_ENABLED && !rawToken) {
    return { ...MOCK_USER };
  }
  if (!rawToken) throw new MissingTokenError();

  const decoded = await verifyToken(rawToken);

  const skipIpCheck =
    process.env.NODE_ENV === "development" ||
    process.env.JWT_SKIP_IP_CHECK === "true";

  if (!skipIpCheck && decoded.ip && requestIp && decoded.ip !== requestIp) {
    throw new TokenMismatchError();
  }

  if (decoded.organization_id == null && Date.now() > TOKEN_GRACE_PERIOD_END) {
    throw new InvalidTokenError();
  }

  return decoded;
}

export function extractRequestIp(request: Request): string | null {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? null;
  return request.headers.get("x-real-ip") ?? null;
}
