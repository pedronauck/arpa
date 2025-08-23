import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { toast } from 'sonner';
import { useCallback, useState } from 'react';

interface UseAppChatOptions {
  chatId: Id<'chats'>;
  onMessageSent?: () => void;
}

export function useAppChat({ chatId, onMessageSent }: UseAppChatOptions) {
  const sendMessage = useMutation(api.chats.sendMessage);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const chatHelpers = useChat({
    transport: new DefaultChatTransport({
      api: 'http://localhost:3001/api/chat',
    }),
  });

  const sendUserMessage = useCallback(async (content: string) => {
    try {
      setIsSubmitting(true);
      
      // First, save the user message to Convex (optimistic UI)
      await sendMessage({
        chatId,
        content,
        role: 'user',
      });

      // Clear the input and trigger callback
      onMessageSent?.();

      // Then send to AI backend
      await chatHelpers.sendMessage({ text: content });
      
      // Save assistant response when it arrives
      const lastMessage = chatHelpers.messages[chatHelpers.messages.length - 1];
      if (lastMessage?.role === 'assistant') {
        const assistantText = lastMessage.parts
          .filter(part => part.type === 'text')
          .map(part => (part as any).text)
          .join('');
        
        if (assistantText) {
          await sendMessage({
            chatId,
            content: assistantText,
            role: 'assistant',
          });
        }
      }
      
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [chatId, sendMessage, chatHelpers, onMessageSent]);

  return {
    ...chatHelpers,
    sendUserMessage,
    isSubmitting: isSubmitting || chatHelpers.status !== 'ready',
  };
}