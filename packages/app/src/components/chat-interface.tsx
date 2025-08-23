import { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { cn } from '@/lib/utils';
import { ChatV3 } from './chat-v3';
import { ThemeToggle } from './theme-toggle';
import { MCPConnectionBadge } from './mcp-connection-badge';
import { Button } from '@/components/ui/button';
import { Badge, BadgeButton } from '@/components/ui/badge';

export function ChatInterface() {
  const [selectedChatId, setSelectedChatId] = useState<Id<'chats'> | null>(null);
  const chats = useQuery(api.chats.list, { userId: 'default-user' });
  const createChat = useMutation(api.chats.create);
  const deleteChat = useMutation(api.chats.remove);

  // Auto-select first chat or create one if none exist
  useEffect(() => {
    if (!selectedChatId && chats && chats.length > 0) {
      setSelectedChatId(chats[0]._id);
    }
  }, [chats, selectedChatId]);

  const handleNewChat = async () => {
    const chatId = await createChat({
      title: 'New Chat',
      userId: 'default-user',
    });
    setSelectedChatId(chatId);
  };

  const handleDeleteChat = async (chatId: Id<'chats'>, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteChat({ chatId });
    if (selectedChatId === chatId) {
      // Select another chat if available
      const remainingChats = chats?.filter(c => c._id !== chatId);
      if (remainingChats && remainingChats.length > 0) {
        setSelectedChatId(remainingChats[0]._id);
      } else {
        setSelectedChatId(null);
      }
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header with tabs */}
      <div className="border-b border-border bg-background">
        <div className="flex items-center justify-between px-3 h-10">
          {/* Left side - Chat title and tabs */}
          <div className="flex items-center gap-2 flex-1 overflow-hidden">
            <span className="text-xs font-medium text-muted-foreground">Chat</span>
            <div className="w-px h-4 bg-border" />

            {/* Tabs container */}
            <div className="flex items-center gap-1 flex-1 overflow-x-auto scrollbar-none">
              {chats?.map((chat) => (
                <div
                  key={chat._id}
                  onClick={() => setSelectedChatId(chat._id)}
                  className="cursor-pointer"
                >
                  <Badge
                    variant={selectedChatId === chat._id ? "secondary" : "outline"}
                    className={cn(
                      "group h-6 px-2 py-0 text-xs font-normal gap-1 hover:bg-secondary/80 transition-colors",
                      selectedChatId === chat._id && "font-medium"
                    )}
                  >
                    <span className="truncate max-w-[100px]">{chat.title}</span>
                    <BadgeButton
                      onClick={(e) => handleDeleteChat(chat._id, e)}
                    >
                      <X className="h-2.5 w-2.5" />
                    </BadgeButton>
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Right side - New chat button, Connection badge and theme toggle */}
          <div className="flex items-center gap-2 ml-2">
            <Button
              onClick={handleNewChat}
              variant="ghost"
              size="sm"
              mode="icon"
              className="h-6 w-6 p-0"
              title="New Chat"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <MCPConnectionBadge />
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedChatId ? (
          <ChatV3 chatId={selectedChatId} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p className="text-lg">No chat selected</p>
              <p className="text-sm mt-2">Create a new chat to get started</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
