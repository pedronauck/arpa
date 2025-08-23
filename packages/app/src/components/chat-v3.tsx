'use client';

import { useState, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { UIMessage } from 'ai';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { toast } from 'sonner';

import {
  Conversation,
  ConversationContent,
} from '@/components/ai-elements/conversation';
import { Message, MessageContent } from '@/components/ai-elements/message';
import { Loader } from '@/components/ai-elements/loader';

import { ChatInput } from './chat/chat-input';
import { MessageRenderer } from './chat/message-renderer';
import { WorkflowContinuation } from './chat/workflow-continuation';
import { useChatSessions } from './chat/use-chat-sessions';

interface ChatV3Props {
  chatId: Id<'chats'>;
}

export function ChatV3({ chatId }: ChatV3Props) {
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState(() => {
    // Load saved model from localStorage or use default
    if (typeof window !== 'undefined') {
      const savedModel = localStorage.getItem('arpa-selected-model');
      return savedModel || 'anthropic/claude-4-opus';
    }
    return 'anthropic/claude-4-opus';
  });
  const [historicalMessagesLoaded, setHistoricalMessagesLoaded] = useState(false);
  const [savedMessageIds, setSavedMessageIds] = useState<Set<string>>(new Set());

  // Load historical messages from Convex
  const historicalMessages = useQuery(api.chats.getChatMessages, { chatId });
  const saveMessage = useMutation(api.chats.sendMessage);

  // Initialize chat with AI SDK
  const {
    messages,
    sendMessage,
    status,
    stop,
    setMessages,
  } = useChat({
    transport: new DefaultChatTransport({
      api: 'http://localhost:3001/api/chat',
      headers: {
        'X-Model': selectedModel,
      },
    }),
    onFinish: async (message) => {
      console.log('onFinish - Processing assistant response');

      if (message && message.message.role === 'assistant') {
        const msg = message.message as any;
        const messageContent = {
          parts: message.message.parts || [],
          id: message.message.id,
          createdAt: msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now(),
        };

        console.log('Saving assistant message:', messageContent);

        try {
          await saveMessage({
            chatId,
            content: messageContent,
            role: 'assistant',
          });
          console.log('✅ Assistant message saved successfully');
          setSavedMessageIds(prev => new Set(prev).add(message.message.id));
        } catch (error) {
          console.error('❌ Failed to save assistant message:', error);
          toast.error('Failed to save assistant response');
        }
      }
    },
  });

  // Use custom hook for session management
  const { suspendedSessions, setSuspendedSessions } = useChatSessions(messages);

  // Save selected model to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('arpa-selected-model', selectedModel);
    }
  }, [selectedModel]);

  // Create workflow continuation handler
  const workflowContinuation = new WorkflowContinuation({
    suspendedSessions,
    setSuspendedSessions,
    messages,
    chatId,
    saveMessage,
    sendMessage: async ({ text }: { text: string }) => {
      await sendMessage({ text });
    },
  });

  // Reset when chatId changes
  useEffect(() => {
    setInput('');
    setHistoricalMessagesLoaded(false);
    setMessages([]);
    setSavedMessageIds(new Set());
  }, [chatId, setMessages]);

  // Load historical messages when component mounts or chatId changes
  useEffect(() => {
    if (historicalMessages && !historicalMessagesLoaded) {
      // Convert Convex messages to UIMessage format
      const uiMessages: UIMessage[] = historicalMessages.map((msg: any) => {
        let parts;
        if (typeof msg.content === 'string') {
          // Legacy format - plain text
          parts = [{ type: 'text', text: msg.content }];
        } else if (msg.content && msg.content.parts) {
          // New format - structured with parts
          parts = msg.content.parts;
        } else {
          // Fallback
          parts = [{ type: 'text', text: JSON.stringify(msg.content) }];
        }

        return {
          id: msg._id,
          role: msg.role,
          parts: parts,
          createdAt: msg.content?.createdAt ? new Date(msg.content.createdAt) : new Date(msg.timestamp),
        };
      });

      if (uiMessages.length > 0) {
        setMessages(uiMessages);
        setHistoricalMessagesLoaded(true);
        const loadedIds = new Set(uiMessages.map(msg => msg.id));
        setSavedMessageIds(loadedIds);
        console.log(`Loaded ${uiMessages.length} historical messages`);
      } else {
        setHistoricalMessagesLoaded(true);
      }
    }
  }, [historicalMessages, historicalMessagesLoaded, chatId, setMessages]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || status === 'streaming' || status === 'submitted') return;

    const userMessage = input.trim();
    setInput('');

    // Save user message to Convex
    try {
      const messageContent = {
        parts: [{ type: 'text', text: userMessage }],
        createdAt: Date.now(),
      };

      await saveMessage({
        chatId,
        content: messageContent,
        role: 'user',
      });
      console.log('User message saved successfully');
    } catch (error) {
      console.error('Failed to save user message:', error);
      toast.error('Failed to save your message. It will not be persisted.');
    }

    // Send to AI
    try {
      await sendMessage({ text: userMessage });
    } catch (error) {
      console.error('Failed to send message to AI:', error);
      toast.error('Failed to send message. Please try again.');
      setInput(userMessage); // Restore input on failure
    }
  };

  return (
    <div className="flex flex-col h-full w-full max-w-100vw overflow-hidden">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 w-full max-w-full">
        {messages.length === 0 && status === 'ready' ? (
          <div className="text-center mt-8">
            <h2 className="text-2xl font-semibold mb-2">Start a conversation</h2>
            <p className="text-muted-foreground">
              Ask me to review code in any place of your project
            </p>
          </div>
        ) : (
          <Conversation className="w-full max-w-full overflow-hidden">
            <ConversationContent className="w-full max-w-full">
              {messages.map((message) => (
                <Message key={message.id} from={message.role} className="w-full max-w-full">
                  <MessageContent className="break-words overflow-hidden max-w-full">
                    <MessageRenderer
                      message={message}
                      messages={messages}
                      status={status}
                      workflowContinuation={workflowContinuation}
                    />
                  </MessageContent>
                </Message>
              ))}

              {(status === 'streaming' || status === 'submitted') && (
                <Message from="assistant">
                  <MessageContent>
                    <div className="flex items-center gap-2">
                      <Loader />
                      <span className="text-sm text-muted-foreground">Thinking...</span>
                    </div>
                  </MessageContent>
                </Message>
              )}
            </ConversationContent>
          </Conversation>
        )}
      </div>

      {/* Input Area */}
      <ChatInput
        input={input}
        setInput={setInput}
        status={status}
        onSubmit={handleSubmit}
        onStop={stop}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
      />
    </div>
  );
}
