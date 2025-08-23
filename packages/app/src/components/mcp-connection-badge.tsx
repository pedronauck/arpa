import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

type ConnectionStatus = {
  status: "connected" | "disconnected" | "connecting";
  hasTools: boolean;
  toolCount: number;
};

export function MCPConnectionBadge() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    status: "disconnected",
    hasTools: false,
    toolCount: 0,
  });

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch("http://localhost:3001/api/mcp/status");
        if (response.ok) {
          const data = await response.json();
          setConnectionStatus(data);
        } else {
          setConnectionStatus({
            status: "disconnected",
            hasTools: false,
            toolCount: 0,
          });
        }
      } catch (error) {
        setConnectionStatus({
          status: "disconnected",
          hasTools: false,
          toolCount: 0,
        });
      }
    };

    // Initial check
    checkConnection();

    // Poll every 5 seconds
    const interval = setInterval(checkConnection, 5000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = () => {
    switch (connectionStatus.status) {
      case "connected":
        return "bg-green-500";
      case "connecting":
        return "bg-yellow-500";
      case "disconnected":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusText = () => {
    switch (connectionStatus.status) {
      case "connected":
        return `MCP Connected (${connectionStatus.toolCount} tools)`;
      case "connecting":
        return "MCP Connecting...";
      case "disconnected":
        return "MCP Disconnected";
      default:
        return "MCP Unknown";
    }
  };

  return (
    <Badge 
      variant="outline" 
      className="flex items-center gap-1 px-1.5 py-0 h-5 text-[10px] border-border/50"
    >
      <span 
        className={`w-1.5 h-1.5 rounded-full ${getStatusColor()} ${
          connectionStatus.status === "connecting" ? "animate-pulse" : ""
        }`}
      />
      <span className="font-medium">{getStatusText()}</span>
    </Badge>
  );
}