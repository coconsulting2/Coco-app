/**
 * @module RequestComment
 * @description Entidad de dominio del slice workflow. El content se almacena
 * cifrado en DB (AES-256-GCM) — los use-cases descifran al leer y cifran al
 * escribir. Esta entidad representa el shape PLANO (descifrado) que ven
 * los consumidores.
 */

export type RequestCommentUserView = {
  userId: number;
  userName: string;
  roleName: string;
};

export type RequestCommentRow = {
  id: number;
  at: Date;
  content: string;
  user: RequestCommentUserView;
};

export type RequestCommentPage = {
  users: Record<string, { name: string; role: string }>;
  messages: Array<{
    pageIndex: number;
    at: Date;
    user_key: string | number | undefined;
    content: string;
  }>;
};
