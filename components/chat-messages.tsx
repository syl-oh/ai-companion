"use client";

import { ElementRef, useEffect, useRef, useState } from "react";

import { ChatMessage } from "@/components/chat-message";
import { AISummaryDto } from "@/src/domain/ports/api/AIApi";
import { ChatMessageDto } from "@/src/domain/ports/api/ChatsApi";

interface ChatMessagesProps {
  messages: ChatMessageDto[];
  isLoading: boolean;
  ai: AISummaryDto;
  stream: string;
}

export const ChatMessages = ({
  messages = [],
  isLoading,
  ai,
  stream,
}: ChatMessagesProps) => {
  const scrollRef = useRef<ElementRef<"div">>(null);

  const [fakeLoading, setFakeLoading] = useState(
    messages.length === 0 ? true : false
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFakeLoading(false);
    }, 1000);

    return () => {
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    scrollRef?.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="flex-1 overflow-y-auto px-4">
      <ChatMessage
        isLoading={fakeLoading}
        src={ai.src}
        role="system"
        content={`Hello, I am ${ai.name}, ${ai.description}`}
      />
      {messages.map((message, index) => (
        <ChatMessage
          key={`chat-msg-${index}`}
          src={ai.src}
          content={message.content}
          role={message.role}
        />
      ))}
      {isLoading && <ChatMessage src={ai.src} role="system" isLoading />}
      {stream && <ChatMessage src={ai.src} role="system" content={stream} />}
      <div ref={scrollRef} />
    </div>
  );
};
