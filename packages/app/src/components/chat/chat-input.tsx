'use client';

import { Button } from '@/components/ui/button';
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputModelSelect,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectValue,
} from '@/components/ai-elements/prompt-input';
import { SquareIcon } from 'lucide-react';
import type { ChatStatus } from 'ai';

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  status: ChatStatus;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onStop: () => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
}

export function ChatInput({
  input,
  setInput,
  status,
  onSubmit,
  onStop,
  selectedModel,
  onModelChange
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
            <PromptInputModelSelect value={selectedModel} onValueChange={onModelChange}>
              <PromptInputModelSelectTrigger className="h-8" size="sm">
                <PromptInputModelSelectValue placeholder="Select model" />
              </PromptInputModelSelectTrigger>
              <PromptInputModelSelectContent>
                <PromptInputModelSelectItem value="anthropic/claude-4-opus">
                  Claude 4 Opus
                </PromptInputModelSelectItem>
                <PromptInputModelSelectItem value="anthropic/claude-sonnet-4">
                  Claude Sonnet 4
                </PromptInputModelSelectItem>
                <PromptInputModelSelectItem value="anthropic/claude-3-5-sonnet-20241022">
                  Claude 3.5 Sonnet
                </PromptInputModelSelectItem>
                <PromptInputModelSelectItem value="openai/gpt-4-turbo">
                  GPT-4 Turbo
                </PromptInputModelSelectItem>
                <PromptInputModelSelectItem value="openai/gpt-4o">
                  GPT-4o
                </PromptInputModelSelectItem>
                <PromptInputModelSelectItem value="openai/gpt-4o-mini">
                  GPT-4o Mini
                </PromptInputModelSelectItem>
                <PromptInputModelSelectItem value="openai/gpt-3.5-turbo">
                  GPT-3.5 Turbo
                </PromptInputModelSelectItem>
                <PromptInputModelSelectItem value="google/gemini-2.5-pro">
                  Gemini 2.5 Pro
                </PromptInputModelSelectItem>
                <PromptInputModelSelectItem value="google/gemini-1.5-pro">
                  Gemini 1.5 Pro
                </PromptInputModelSelectItem>
              </PromptInputModelSelectContent>
            </PromptInputModelSelect>
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
