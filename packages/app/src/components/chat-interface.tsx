import { useState, useEffect } from 'react';
import { Plus, MessageSquare, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { cn } from '@/lib/utils';
import { ChatV2 } from './chat-v2';
import { ThemeToggle } from './theme-toggle';

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

  const handleDeleteChat = async (chatId: Id<'chats'>) => {
    await deleteChat({ chatId });
    if (selectedChatId === chatId) {
      setSelectedChatId(null);
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-sidebar flex flex-col">
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Chats</h2>
            <ThemeToggle />
          </div>
          <Button
            onClick={handleNewChat}
            className="w-full justify-start gap-2"
            variant="ghost"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </div>

        <ScrollArea className="flex-1 px-2">
          <div className="space-y-1 p-2">
            {chats?.map((chat) => (
              <div
                key={chat._id}
                className={cn(
                  "group flex items-center justify-between rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors",
                  selectedChatId === chat._id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-primary/50"
                )}
                onClick={() => setSelectedChatId(chat._id)}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  <span className="truncate">{chat.title}</span>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteChat(chat._id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete chat</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedChatId ? (
          // Use the new ChatV2 component with proper AI SDK Elements
          <ChatV2 chatId={selectedChatId} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select a chat or create a new one to get started</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
