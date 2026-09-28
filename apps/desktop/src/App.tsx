import { useState } from "react";
import {
  AppstoreOutlined,
  ArrowUpOutlined,
  FileOutlined,
  FolderOpenOutlined,
  MessageOutlined,
  PlusOutlined,
  SearchOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { Button, ConfigProvider, Input, Layout, Select, Space, Tag, Typography, theme } from "antd";
import "./App.css";

const { Sider, Content } = Layout;
const { Text, Title } = Typography;

function App() {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<string[]>([]);

  function sendMessage() {
    const message = prompt.trim();
    if (!message) {
      return;
    }

    setMessages((current) => [...current, message]);
    setPrompt("");
  }

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: "#8b7cf6",
          colorBgBase: "#111318",
          colorBgContainer: "#191b22",
          colorTextBase: "#e7e8ee",
          borderRadius: 10,
          fontFamily: 'Inter, "Segoe UI", sans-serif',
        },
      }}
    >
      <Layout className="loom-app">
        <Sider width={248} className="left-sidebar">
          <div className="brand">
            <span className="brand-icon">
              <AppstoreOutlined />
            </span>
            <Text strong>Loom</Text>
          </div>

          <Button block icon={<PlusOutlined />} className="new-chat-button">
            New chat
          </Button>
          <Input
            aria-label="Search conversations"
            placeholder="Search"
            prefix={<SearchOutlined />}
            className="search-input"
          />

          <nav aria-label="Conversations" className="conversation-nav">
            <Text className="section-label">RECENT</Text>
            <Button type="text" block icon={<MessageOutlined />} className="conversation-item">
              Welcome to Loom
            </Button>
          </nav>

          <Button type="text" icon={<SettingOutlined />} className="settings-button">
            Settings
          </Button>
        </Sider>

        <Layout>
          <header className="topbar">
            <Space size="middle">
              <Text className="workspace-label">No workspace open</Text>
              <Tag variant="filled">Local prototype</Tag>
            </Space>
            <Space>
              <Select
                aria-label="Model"
                value="Gateway model"
                options={[{ value: "Gateway model", label: "Gateway model" }]}
              />
              <Tag color="purple">Ask before changes</Tag>
            </Space>
          </header>

          <Content className="conversation-area" role="main" aria-label="Conversation">
            {messages.length === 0 ? (
              <section className="welcome" aria-label="Welcome">
                <div className="welcome-mark">
                  <AppstoreOutlined />
                </div>
                <Title level={2}>What are we building today?</Title>
                <Text type="secondary">Open a folder and start working with your agent.</Text>
              </section>
            ) : (
              <section className="message-list" aria-label="Messages" role="log">
                {messages.map((message, index) => (
                  <div className="user-message" key={`${index}-${message}`}>
                    {message}
                  </div>
                ))}
                <Text type="secondary" className="prototype-note">
                  Preview only — the agent runtime is not connected yet.
                </Text>
              </section>
            )}

            <div className="composer-wrap">
              <Input.TextArea
                aria-label="Message Loom"
                placeholder="Ask Loom to change something..."
                autoSize={{ minRows: 2, maxRows: 5 }}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onPressEnter={(event) => {
                  if (!event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <div className="composer-footer">
                <Text type="secondary">Enter to send · Shift+Enter for a new line</Text>
                <Button
                  type="primary"
                  shape="circle"
                  aria-label="Send message"
                  icon={<ArrowUpOutlined />}
                  disabled={!prompt.trim()}
                  onClick={sendMessage}
                />
              </div>
            </div>
          </Content>
        </Layout>

        <Sider width={280} className="right-sidebar">
          <aside aria-label="Workspace explorer" className="explorer-panel">
            <div className="explorer-heading">
              <Text strong>Workspace explorer</Text>
            </div>
            <div className="explorer-empty">
              <FileOutlined />
              <Text type="secondary">No folder open</Text>
              <Button aria-label="Open folder" icon={<FolderOpenOutlined />}>
                Open folder
              </Button>
            </div>
            <div className="gateway-status">
              <span className="status-dot" />
              <div>
                <Text strong>Gateway required</Text>
                <br />
                <Text type="secondary">Sign in to start an agent run</Text>
              </div>
            </div>
          </aside>
        </Sider>
      </Layout>
    </ConfigProvider>
  );
}

export default App;
