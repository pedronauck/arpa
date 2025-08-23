'use client';

import { Button } from '@/components/ui/button';
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input';
import { SquareIcon } from 'lucide-react';
import type { ChatStatus } from 'ai';

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  status: ChatStatus;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onStop: () => void;
}

export function ChatInput({ 
  input, 
  setInput, 
  status, 
  onSubmit, 
  onStop 
}: ChatInputProps) {
  return (
    <div className="border-t p-4 w-full max-w-full overflow-hidden">
      <PromptInput
        onSubmit={onSubmit}
        className="w-full max-w-3xl mx-auto overflow-hidden"
      >
        <PromptInputTextarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={status === 'streaming' || status === 'submitted'}
          className="min-h-[80px] w-full max-w-full"
        />
        <PromptInputToolbar>
          <PromptInputTools>
            {/* Add any tool buttons here if needed */}
          </PromptInputTools>
          {status === 'streaming' ? (
            <Button
              type="button"
              onClick={onStop}
              variant="destructive"
              size="icon"
            >
              <SquareIcon className="size-4" />
            </Button>
          ) : (
            <PromptInputSubmit
              disabled={!input.trim() || status === 'submitted'}
              status={status}
            />
          )}
        </PromptInputToolbar>
      </PromptInput>

      <div className="flex items-center justify-center gap-4 mt-2">
        <p className="text-xs text-muted-foreground">
          <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-muted rounded">Enter</kbd> to send
        </p>
        <p className="text-xs text-muted-foreground">
          <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-muted rounded">Shift</kbd> +
          <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-muted rounded ml-1">Enter</kbd> for new line
        </p>
      </div>
    </div>
  );
}