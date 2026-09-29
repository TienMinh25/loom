import { PlusOutlined } from "@ant-design/icons";
import { Button, Dropdown, Select, Tag } from "antd";
import { approvalModeOptions, type ApprovalMode } from "../approvalMode";

type Props = {
  model: string;
  reasoning: string;
  approvalMode: ApprovalMode;
  extensions: string[];
  onModelChange(value: string): void;
  onReasoningChange(value: string): void;
  onApprovalModeChange(value: ApprovalMode): void;
  onAddExtension(kind: "plugin" | "mcp"): void;
};

export function ComposerControls(props: Props) {
  return (
    <div className="composer-options">
      <Select
        aria-label="Model"
        value={props.model}
        onChange={props.onModelChange}
        options={[
          { value: "Gateway model", label: "Gateway model" },
          { value: "Gateway fast", label: "Gateway fast" },
          { value: "Gateway reasoning", label: "Gateway reasoning" },
        ]}
      />
      <Select
        aria-label="Reasoning effort"
        value={props.reasoning}
        onChange={props.onReasoningChange}
        options={[
          { value: "low", label: "Low reasoning" },
          { value: "medium", label: "Medium reasoning" },
          { value: "high", label: "High reasoning" },
        ]}
      />
      <Select
        aria-label="Approval mode"
        value={props.approvalMode}
        onChange={props.onApprovalModeChange}
        options={approvalModeOptions}
      />
      <Dropdown
        menu={{
          items: [
            { key: "plugin", label: "Add plugin" },
            { key: "mcp", label: "Add MCP server" },
          ],
          onClick: ({ key }) => props.onAddExtension(key === "mcp" ? "mcp" : "plugin"),
        }}
        trigger={["click"]}
      >
        <Button aria-label="Add plugin or MCP" icon={<PlusOutlined />} />
      </Dropdown>
      <div className="extension-tags">
        {props.extensions.map((extension) => (
          <Tag key={extension}>{extension}</Tag>
        ))}
      </div>
    </div>
  );
}
