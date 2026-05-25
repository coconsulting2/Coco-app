/**
 * @module CommentsService
 * @description Puerto para publicar un comentario en el chat de una
 * solicitud. El adapter por defecto wrappea el slice `workflow`.
 */
export type PostRequestCommentInput = {
  userId: number;
  requestId: number;
  content: string;
};

export type PostRequestCommentResult =
  | { success: true }
  | { success: false; error: string };

export interface CommentsService {
  postRequestComment(input: PostRequestCommentInput): Promise<PostRequestCommentResult>;
}
