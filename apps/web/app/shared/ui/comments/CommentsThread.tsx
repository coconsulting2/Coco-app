/**
 * @file CommentsThread.tsx
 * @description Hilo de comentarios de una solicitud. Loader-driven: recibe
 * `initialComments` desde el loader de la route padre y publica nuevos
 * comentarios vía `useFetcher` (intent `add-comment`). Tras el POST, RR7
 * revalida el loader y los comentarios se actualizan. Sin SSE, sin llamadas al
 * API legacy, sin token (degradación acordada: SSE no es requirement actual).
 */
import React, { type ChangeEvent, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { useFetcher } from "react-router";
import CommentMessage from "~/shared/ui/comments/CommentMessage";
import CommentMessageGroup from "~/shared/ui/comments/CommentMessageGroup";
import CommentInput from "~/shared/ui/comments/CommentInput";
import { groupMessages, formatTime, type ChatGroup } from "~/shared/ui/comments/comments.utils.ts";
import type { RequestComments } from "~/shared/ui/comments/comments.utils.ts";
import Error from "~/shared/ui/comments/Error.tsx";

interface CommentsThreadProps {
  requestId: number;
  name: string;
  currentUserId: number;
  initialComments: RequestComments;
}

type AddCommentResult = { ok: true } | { ok: false; error: string };

/**
 * Main CommentsThread component
 */
export default function CommentsThread({
  name,
  currentUserId,
  initialComments,
}: CommentsThreadProps): React.ReactElement {
  const fetcher = useFetcher<AddCommentResult>();
  const [msg, setMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const containerRef: RefObject<HTMLDivElement | null> = useRef(null);

  const groupedMessages: ChatGroup[] = useMemo(
    () => groupMessages(initialComments.messages, initialComments.users, currentUserId),
    [initialComments, currentUserId],
  );

  const scrollBottom = () => {
    if (!containerRef.current) return;
    containerRef.current.scroll({
      top: containerRef.current.scrollHeight + 100,
      behavior: "smooth",
    });
  };

  // Cuando el POST falla, el action devuelve { ok:false, error }.
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok) {
      setMsg("");
      setError(null);
      setTimeout(scrollBottom, 50);
    } else {
      setError(fetcher.data.error);
    }
  }, [fetcher.state, fetcher.data]);

  const handleSendMessage = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    const content = msg.trim();
    if (!content) return;
    fetcher.submit({ intent: "add-comment", content }, { method: "post" });
  };

  const handleChangeInput = (e: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setMsg(e.target.value);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-neutral-200">
      <div className="px-6 py-4 border-b border-neutral-200 bg-surface-white">
        <h3 className="text-lg font-serif font-editorial text-ink">Comentarios de la solicitud</h3>
      </div>

      <div
        ref={containerRef}
        className="min-h-100 min-w-0 max-h-100 flex-1 flex flex-col space-y-6 overflow-y-scroll px-6 py-4 scrollable"
      >
        {groupedMessages.length === 0 && (
          <p className="text-sm text-ink-muted">Aún no hay comentarios en esta solicitud.</p>
        )}

        {groupedMessages.map((group, groupIndex) => (
          <CommentMessageGroup
            key={`${groupIndex}:${group.send ? name : group.name ?? "user"}`}
            send={group.send}
            name={group.name ?? name}
            role={group.role}
          >
            {group.messages.map((m) => (
              <CommentMessage key={m.pageIndex} time={formatTime(m.at)}>
                {m.content}
              </CommentMessage>
            ))}
          </CommentMessageGroup>
        ))}
      </div>

      {error && <Error error={error} />}

      <CommentInput
        id="1"
        onKeyDown={handleSendMessage}
        onChange={handleChangeInput}
        value={msg}
      />
    </div>
  );
}
