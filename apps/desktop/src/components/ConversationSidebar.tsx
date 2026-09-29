import {
  DeleteOutlined,
  LeftOutlined,
  MessageOutlined,
  PlusOutlined,
  RightOutlined,
  SearchOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { Button, Dropdown, Input, Typography } from "antd";
import type { Conversation } from "../types/conversation";

const { Text } = Typography;

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
  if (props.collapsed) {
    return (
      <aside aria-label="Conversation tools" className="left-sidebar left-sidebar-collapsed">
        <div className="sidebar-rail-top">
          <Button
            type="text"
            aria-label="Show conversations"
            icon={<RightOutlined />}
            onClick={props.onExpand}
          />
          <Button
            type="text"
            aria-label="New chat"
            icon={<PlusOutlined />}
            disabled={!props.canCreateConversation}
            onClick={props.onNewConversation}
          />
          <Button
            type="text"
            aria-label="Search conversations"
            icon={<SearchOutlined />}
            onClick={props.onExpand}
          />
        </div>
        <Button
          type="text"
          aria-label="Open settings"
          className="rail-settings-button"
          icon={<SettingOutlined />}
          onClick={props.onOpenSettings}
        />
      </aside>
    );
  }

  const visibleConversations = props.conversations.filter((conversation) =>
    `${conversation.title} ${conversation.messages.map((message) => message.content).join(" ")}`
      .toLowerCase()
      .includes(props.searchQuery.toLowerCase()),
  );

  return (
    <aside className="left-sidebar">
      <div className="brand">
        <span className="brand-icon">
          <img src="/loom-avatar.png" alt="Loom red panda" />
        </span>
        <Text strong>Loom</Text>
        <Button
          type="text"
          className="collapse-sidebar-button"
          aria-label="Hide conversations"
          icon={<LeftOutlined />}
          onClick={props.onCollapse}
        />
      </div>
      <Button
        block
        icon={<PlusOutlined />}
        className="new-chat-button"
        disabled={!props.canCreateConversation}
        onClick={props.onNewConversation}
      >
        New chat
      </Button>
      <Input
        aria-label="Search conversations"
        placeholder="Search"
        prefix={<SearchOutlined />}
        className="search-input"
        value={props.searchQuery}
        onChange={(event) => props.onSearchChange(event.target.value)}
      />
      <nav aria-label="Conversations" className="conversation-nav">
        <Text className="section-label">RECENT</Text>
        {visibleConversations.map((conversation) => (
          <div className="conversation-list-item" key={conversation.id}>
            <Dropdown
              trigger={["contextMenu"]}
              menu={{
                items: [
                  { key: "delete", label: "Delete chat", icon: <DeleteOutlined />, danger: true },
                ],
                onClick: () => props.onDeleteConversation(conversation.id),
              }}
            >
              <Button
                type="text"
                block
                icon={<MessageOutlined />}
                aria-current={conversation.id === props.activeConversationId ? "page" : undefined}
                className={`conversation-item${conversation.id === props.activeConversationId ? " active" : ""}`}
                onClick={() => props.onSelectConversation(conversation.id)}
              >
                {conversation.title}
              </Button>
            </Dropdown>
            <Button
              type="text"
              aria-label={`Delete chat ${conversation.title}`}
              icon={<DeleteOutlined />}
              onClick={() => props.onDeleteConversation(conversation.id)}
            />
          </div>
        ))}
      </nav>
      <Button
        type="text"
        icon={<SettingOutlined />}
        className="settings-button"
        onClick={props.onOpenSettings}
      >
        Settings
      </Button>
    </aside>
  );
}
