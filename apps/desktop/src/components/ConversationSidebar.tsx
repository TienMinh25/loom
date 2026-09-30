import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { Conversation } from "../types/conversation";
import { Button, IconButton, TextField } from "./ui";

const buttonBase = "cursor-pointer border-0 bg-transparent font-[inherit] p-0";

function SidebarIcon({
  name,
}: {
  name: "back" | "delete" | "forward" | "plus" | "search" | "settings";
}) {
  const paths: Record<typeof name, ReactNode> = {
    back: <path d="m14 18-6-6 6-6" />,
    delete: (
      <>
        <path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" />
      </>
    ),
    forward: <path d="m10 18 6-6-6-6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.8-.6a8 8 0 0 1-1.6.9l-.3 1.9h-2.8l-.3-1.9a8 8 0 0 1-1.6-.9l-1.8.6-1.4-2.4 1.4-1.1a8 8 0 0 1 0-1.9l-1.4-1.2 1.4-2.4 1.8.7a8 8 0 0 1 1.6-.9l.3-1.9h2.8l.3 1.9a8 8 0 0 1 1.6.9l1.8-.7 1.4 2.4-1.4 1.2a8 8 0 0 1 0 1.8Z" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

function ConversationTitle({ title, animate }: { title: string; animate: boolean }) {
  const titleRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);

  useLayoutEffect(() => {
    const titleElement = titleRef.current;
    const titleTrack = titleElement?.parentElement;
    if (!titleElement || !titleTrack) {
      return;
    }

    const measure = () => {
      const nextOverflow = Math.max(0, titleElement.scrollWidth - titleTrack.clientWidth);
      setOverflow((current) => (current === nextOverflow ? current : nextOverflow));
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(titleTrack);
    observer.observe(titleElement);
    return () => observer.disconnect();
  }, [title]);

  useEffect(() => {
    const titleElement = titleRef.current;
    if (
      !animate ||
      overflow === 0 ||
      !titleElement ||
      typeof titleElement.animate !== "function" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const animation = titleElement.animate(
      [{ transform: "translateX(0)" }, { transform: `translateX(${-overflow}px)` }],
      { duration: 7000, direction: "alternate", iterations: Infinity, easing: "ease-in-out" },
    );
    return () => animation.cancel();
  }, [animate, overflow]);

  return (
    <span
      ref={titleRef}
      className={`conversation-title-text block w-max min-w-full whitespace-nowrap ${animate && overflow > 0 ? "max-w-none overflow-visible text-clip" : "max-w-full overflow-hidden text-ellipsis"}`}
      title={title}
    >
      {title}
    </span>
  );
}

type ConversationRowProps = {
  conversation: Conversation;
  active: boolean;
  onSelect(): void;
  onDelete(): void;
};

function ConversationRow({ conversation, active, onSelect, onDelete }: ConversationRowProps) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const revealed = focused || hovered;

  return (
    <div
      className={`conversation-list-item group/row relative flex min-w-0 items-center rounded-lg p-[2px] pr-1 transition-colors ${active ? "active bg-[var(--loom-panel-raised)]" : "bg-transparent hover:bg-[var(--loom-panel-raised)] focus-within:bg-[var(--loom-panel-raised)]"}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (
          !(event.relatedTarget instanceof Node) ||
          !event.currentTarget.contains(event.relatedTarget)
        ) {
          setFocused(false);
        }
      }}
    >
      <div className="conversation-row-content flex min-w-0 flex-1 items-center overflow-hidden">
        <button
          type="button"
          aria-current={active ? "page" : undefined}
          className={`${buttonBase} conversation-item flex h-8 min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-md px-2 text-left text-[13px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violet-500 ${active ? "text-[var(--loom-text)]" : "text-[var(--loom-muted)]"}`}
          onClick={onSelect}
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-current"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" />
            <path d="M8 12h.01M12 12h.01M16 12h.01" />
          </svg>
          <span className="conversation-title-track block min-w-0 overflow-hidden whitespace-nowrap">
            <ConversationTitle title={conversation.title} animate={revealed} />
          </span>
        </button>
      </div>
      <IconButton
        type="button"
        aria-label={`Delete chat ${conversation.title}`}
        variant="ghost"
        className={`conversation-delete-button !h-7 !min-h-7 !w-7 !flex-none !rounded-md !p-0 text-[var(--loom-muted)] opacity-0 transition-opacity duration-150 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500 ${revealed ? "pointer-events-auto opacity-100" : "pointer-events-none"}`}
        onClick={onDelete}
      >
        <SidebarIcon name="delete" />
      </IconButton>
    </div>
  );
}

type Props = {
  conversations: Conversation[];
  activeConversationId: string;
  searchQuery: string;
  onSearchChange(value: string): void;
  onSelectConversation(id: string): void;
  onNewConversation(): void;
  canCreateConversation: boolean;
  onDeleteConversation(id: string): void;
  onOpenSettings(): void;
  onCollapse(): void;
  collapsed?: boolean;
  onExpand?(): void;
};

export function ConversationSidebar(props: Props) {
  const conversationListRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleConversationNavigation = (event: KeyboardEvent) => {
      const navigation = conversationListRef.current;
      const target = event.target as Element;
      const activeButton =
        typeof target.closest === "function"
          ? target.closest<HTMLButtonElement>(".conversation-item")
          : null;
      if (!navigation || !activeButton || !navigation.contains(activeButton)) {
        return;
      }
      const buttons = Array.from(
        navigation.querySelectorAll<HTMLButtonElement>(".conversation-item"),
      );
      const currentIndex = buttons.indexOf(activeButton);
      let nextIndex: number | undefined;
      if (event.key === "ArrowDown") {
        nextIndex = Math.min(buttons.length - 1, currentIndex + 1);
      } else if (event.key === "ArrowUp") {
        nextIndex = Math.max(0, currentIndex - 1);
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = buttons.length - 1;
      }
      if (nextIndex === undefined || buttons.length === 0 || nextIndex === currentIndex) {
        return;
      }
      event.preventDefault();
      const next = buttons[nextIndex];
      next?.focus();
      next?.click();
    };
    window.addEventListener("keydown", handleConversationNavigation);
    return () => window.removeEventListener("keydown", handleConversationNavigation);
  }, []);

  if (props.collapsed) {
    return (
      <aside
        aria-label="Conversation tools"
        className="flex h-full w-full flex-col items-start overflow-hidden bg-[var(--loom-panel)] p-2"
      >
        <div className="flex flex-col items-start gap-2">
          <IconButton
            type="button"
            aria-label="Show conversations"
            variant="ghost"
            className="!h-9 !min-h-9 !w-9 !rounded-md !p-0"
            onClick={props.onExpand}
          >
            <SidebarIcon name="forward" />
          </IconButton>
          <IconButton
            type="button"
            aria-label="New chat"
            variant="ghost"
            className="!h-9 !min-h-9 !w-9 !rounded-md !p-0"
            disabled={!props.canCreateConversation}
            onClick={props.onNewConversation}
          >
            <SidebarIcon name="plus" />
          </IconButton>
          <IconButton
            type="button"
            aria-label="Search conversations"
            variant="ghost"
            className="!h-9 !min-h-9 !w-9 !rounded-md !p-0"
            onClick={props.onExpand}
          >
            <SidebarIcon name="search" />
          </IconButton>
        </div>
        <IconButton
          type="button"
          aria-label="Open settings"
          variant="ghost"
          className="mt-auto !h-9 !min-h-9 !w-9 !rounded-md !p-0"
          onClick={props.onOpenSettings}
        >
          <SidebarIcon name="settings" />
        </IconButton>
      </aside>
    );
  }

  const searchQuery = props.searchQuery.trim().toLowerCase();
  const visibleConversations = props.conversations.filter((conversation) =>
    `${conversation.title} ${conversation.messages.map((message) => message.content).join(" ")}`
      .toLowerCase()
      .includes(searchQuery),
  );

  return (
    <aside className="flex h-full w-full min-w-0 flex-col overflow-hidden bg-[var(--loom-panel)] px-3.5 py-5">
      <div className="mx-1 mb-5 flex min-h-[34px] items-center gap-2.5">
        <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px] border border-[#9388df] bg-[var(--loom-panel-raised)] text-[#7565e8]">
          <img
            className="h-full w-full overflow-hidden rounded-[inherit] object-cover"
            src="/loom-avatar.png"
            alt="Loom red panda"
          />
        </span>
        <span className="font-semibold">Loom</span>
        <IconButton
          type="button"
          variant="ghost"
          className="ml-auto !h-8 !min-h-8 !w-8 !rounded-md !p-0"
          aria-label="Hide conversations"
          onClick={props.onCollapse}
        >
          <SidebarIcon name="back" />
        </IconButton>
      </div>
      <div className="flex w-full justify-start">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mb-3 !h-9 !min-h-9 !justify-start self-start rounded-lg !px-3 text-[13px]"
          disabled={!props.canCreateConversation}
          onClick={props.onNewConversation}
        >
          <SidebarIcon name="plus" />
          New chat
        </Button>
      </div>
      {props.conversations.length > 0 && (
        <div className="search-input mb-6 flex h-9 w-full items-center gap-2 rounded-lg border border-[var(--loom-line)] px-2.5 focus-within:border-violet-500">
          <SidebarIcon name="search" />
          <TextField
            aria-label="Search conversations"
            placeholder="Search"
            className="!h-8 !w-0 !min-w-0 !flex-1 !rounded-none !border-0 !bg-transparent !px-0 !py-0 text-[13px] !shadow-none !outline-none placeholder:text-[var(--loom-muted)] focus:!border-0 focus:!outline-none focus:!ring-0"
            value={props.searchQuery}
            onChange={(event) => props.onSearchChange(event.target.value)}
          />
        </div>
      )}
      <nav
        aria-label="Conversations"
        className="grid min-h-0 min-w-0 flex-1 content-start gap-2 overflow-x-hidden overflow-y-auto"
        ref={conversationListRef}
      >
        {props.conversations.length > 0 && (
          <>
            <span className="justify-self-start px-2 text-[10px] tracking-[0.1em] text-[var(--loom-muted)]">
              RECENT
            </span>
            {visibleConversations.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                active={conversation.id === props.activeConversationId}
                onSelect={() => props.onSelectConversation(conversation.id)}
                onDelete={() => props.onDeleteConversation(conversation.id)}
              />
            ))}
            {searchQuery && visibleConversations.length === 0 && (
              <div
                role="status"
                className="mx-2 mt-2 grid justify-items-start gap-2 text-[12px] text-[var(--loom-muted)]"
              >
                <span>No conversations match your search.</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="!h-7 !min-h-7 !justify-start !px-2 text-[12px]"
                  onClick={() => props.onSearchChange("")}
                >
                  Clear search
                </Button>
              </div>
            )}
          </>
        )}
      </nav>
      <Button
        type="button"
        variant="ghost"
        className="mt-auto !h-9 !min-h-9 self-start !justify-start rounded-md !px-2 text-left text-[13px]"
        onClick={props.onOpenSettings}
      >
        <SidebarIcon name="settings" />
        Settings
      </Button>
    </aside>
  );
}
