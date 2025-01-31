import React from "react";
import { ChatMessageProps } from "./chat-message";
import { Prisma } from "@prisma/client";
import { cn } from "@/src/lib/utils";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { marked } from "marked";
import { useUser } from "@clerk/nextjs";

const extendedAI = Prisma.validator<Prisma.AIDefaultArgs>()({
  include: {
    dataSources: {
      include: {
        dataSource: true,
      },
    },
  },
});

type ExtendedAI = Prisma.AIGetPayload<typeof extendedAI>;

interface Props {
  messages: ChatMessageProps[];
  ai: ExtendedAI | null;
  className?: string;
}

export const ExampleChat = ({ messages = [], ai, className }: Props) => {
  return (
    <div
      className={cn(
        "flex-1 overflow-y-auto px-4 w-full h-full overflow-hidden border border-primary/10 rounded-md",
        className
      )}
    >
      <ExampleChatMessage
        src={ai?.src}
        role="system"
        content={`Hello, I am ${ai?.name}, ${ai?.description}`}
      />
      {messages.map((message, index) => (
        <ExampleChatMessage
          key={`chat-msg-${index}`}
          src={ai?.src}
          content={message.content}
          role={message.role}
        />
      ))}
    </div>
  );
};

export interface ExampleChatMessageProps {
  role: "system" | "user";
  content?: string;
  src?: string;
}

export const ExampleChatMessage = ({
  role,
  content,
  src,
}: ExampleChatMessageProps) => {
  const { user } = useUser();
  return (
    <div
      className={cn(
        "group flex items-start w-full text-nano gap-x-px py-2",
        role === "user" && "justify-end"
      )}
    >
      {role !== "user" && src && (
        <Avatar className="h-4 w-4">
          <AvatarImage src={src} crop="w_48,h_48" />
        </Avatar>
      )}
      <div className="bg-primary/10 rounded-sm px-2 mx-1">
        <div
          className="markdown-chat-message"
          dangerouslySetInnerHTML={{
            __html: content ? marked.parse(content) : "",
          }}
        ></div>
      </div>
      {role === "user" && (
        <Avatar className="h-4 w-4">
          <AvatarImage src={user?.imageUrl} crop="w_48,h_48" />
        </Avatar>
      )}
    </div>
  );
};
