import {
  AppstoreOutlined,
  FileOutlined,
  FileAddOutlined,
  FolderOpenOutlined,
  LeftOutlined,
  RightOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Button, Dropdown, Tree, Typography } from "antd";
import type { DataNode } from "antd/es/tree";
import type { WorkspaceEntry } from "../../shared/desktopApi";

const { Text } = Typography;

type Props = {
  open: boolean;
  workspaceRoot: string | null;
  gatewayConnected: boolean;
  workspaceError: string | null;
  treeData: DataNode[];
  workspaceFiles: { path: string }[];
  onOpenFolder(): void;
  onRefresh(): void;
  onCreateFile(initialPath?: string): void;
  onCreateDirectory(initialPath?: string): void;
  onDelete(path: string): void;
  onOpenFile(path: string): void;
  onCollapse(): void;
  onExpand(): void;
  onLoadDirectory(path: string): Promise<WorkspaceEntry[]>;
};

export function WorkspaceExplorer(props: Props) {
  const withContextMenu = (nodes: DataNode[]): DataNode[] =>
    nodes.map((node) => ({
      ...node,
      title: (
        <Dropdown
          trigger={["contextMenu"]}
          menu={{
            items: [
              { key: "new-file", label: "New File" },
              { key: "new-folder", label: "New Folder" },
              ...(String(node.key) === "."
                ? []
                : [{ key: "delete", label: "Delete", danger: true }]),
            ],
            onClick: ({ key }) => {
              const path = String(node.key);
              const parent = node.isLeaf === true ? path.split("/").slice(0, -1).join("/") : path;
              const prefix = parent ? `${parent}/` : "";
              if (key === "new-file") props.onCreateFile(prefix);
              if (key === "new-folder") props.onCreateDirectory(prefix);
              if (key === "delete") props.onDelete(String(node.key));
            },
          }}
        >
          <span>{node.title}</span>
        </Dropdown>
      ),
      children: node.children ? withContextMenu(node.children) : undefined,
    }));

  return (
    <aside
      aria-label={props.open ? "Workspace explorer" : "Workspace tools"}
      className={`explorer-panel${props.open ? "" : " explorer-panel-collapsed"}`}
    >
      <div className="explorer-heading">
        {props.open && <Text strong>Workspace explorer</Text>}
        <Button
          type="text"
          aria-label={props.open ? "Hide workspace explorer" : "Show workspace explorer"}
          icon={props.open ? <RightOutlined /> : <LeftOutlined />}
          onClick={props.open ? props.onCollapse : props.onExpand}
        />
        {props.open && props.workspaceRoot && (
          <>
            <Button
              type="text"
              aria-label="New file"
              icon={<FileAddOutlined />}
              onClick={props.onCreateFile}
            />
            <Button
              type="text"
              aria-label="Refresh workspace files"
              icon={<ReloadOutlined />}
              onClick={props.onRefresh}
            />
            <Button
              type="text"
              aria-label="Open another folder"
              icon={<FolderOpenOutlined />}
              onClick={props.onOpenFolder}
            />
          </>
        )}
      </div>
      {!props.open && (
        <>
          <Button
            type="text"
            aria-label="Show file explorer"
            icon={<AppstoreOutlined />}
            onClick={props.onExpand}
          />
          <Button
            type="text"
            aria-label={props.workspaceRoot ? "Open another folder" : "Open folder"}
            icon={<FolderOpenOutlined />}
            onClick={props.onOpenFolder}
          />
        </>
      )}
      {props.open &&
        (props.workspaceRoot ? (
          <div className="workspace-tree" aria-label="Workspace files">
            {props.workspaceError && (
              <div className="workspace-error" role="alert">
                {props.workspaceError}
              </div>
            )}
            <Dropdown
              trigger={["contextMenu"]}
              menu={{
                items: [
                  { key: "new-file", label: "New File" },
                  { key: "new-folder", label: "New Folder" },
                ],
                onClick: ({ key }) =>
                  key === "new-file" ? props.onCreateFile() : props.onCreateDirectory(),
              }}
            >
              <div className="workspace-root-label" aria-label="Workspace root actions">
                <FolderOpenOutlined /> <Text strong>{props.workspaceRoot}</Text>
              </div>
            </Dropdown>
            <Tree
              aria-label="Workspace files"
              showIcon
              defaultExpandAll={false}
              treeData={withContextMenu(props.treeData)}
              loadData={(node) => props.onLoadDirectory(String(node.key)).then(() => undefined)}
              onSelect={(keys) => {
                const path = String(keys[0] ?? "");
                if (props.workspaceFiles.some((file) => file.path === path)) {
                  props.onOpenFile(path);
                }
              }}
            />
          </div>
        ) : (
          <div className="explorer-empty">
            <FileOutlined />
            <Text type="secondary">No folder open</Text>
            <Button
              aria-label="Open folder"
              icon={<FolderOpenOutlined />}
              onClick={props.onOpenFolder}
            >
              Open folder
            </Button>
          </div>
        ))}
      {props.open && (
        <div className="gateway-status">
          <span className={`status-dot${props.gatewayConnected ? " connected" : ""}`} />
          <div>
            <Text strong>
              {props.gatewayConnected ? "Provider connected" : "Provider required"}
            </Text>
            <br />
            <Text type="secondary">
              {props.gatewayConnected
                ? "OpenAI-compatible provider"
                : "Configure a provider to start an agent run"}
            </Text>
          </div>
        </div>
      )}
    </aside>
  );
}
