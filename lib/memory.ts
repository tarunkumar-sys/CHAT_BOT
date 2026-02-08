// import { ConversationSummaryBufferMemory } from "@langchain/community/memory";
// import { ConversationSummaryBufferMemory } from "@langchain/memory";
// import { ConversationSummaryBufferMemory } from "langchain/memory/index";
// import { ConversationSummaryBufferMemory } from "@langchain/community/memory";
import { ConversationSummaryBufferMemory } from "@langchain/classic/memory";

import { ChatOllama } from "@langchain/ollama";
import { BaseMessage } from "@langchain/core/messages";

// Local storage for memory objects
const memoryStore = new Map<string, ConversationSummaryBufferMemory>();

/**
 * Gets or creates a memory instance for a specific user.
 */
export function getMemory(userId: string, llm: ChatOllama): ConversationSummaryBufferMemory {
  if (!memoryStore.has(userId)) {
    memoryStore.set(
      userId,
      new ConversationSummaryBufferMemory({
        llm,
        maxTokenLimit: 400,
        memoryKey: "chat_history",
        returnMessages: true,
      })
    );
  }
  return memoryStore.get(userId)!;
}

/**
 * Loads the history for a user to be passed into the LLM.
 */
export async function loadHistory(userId: string, llm: ChatOllama): Promise<BaseMessage[]> {
  const memory = getMemory(userId, llm);
  const data = await memory.loadMemoryVariables({});
  return data.chat_history || [];
}

/**
 * Saves the latest exchange to the user's memory.
 */
export async function saveExchange(userId: string, llm: ChatOllama, input: string, output: string) {
  const memory = getMemory(userId, llm);
  await memory.saveContext({ input }, { output });
}

/**
 * Resets memory for a specific user.
 */
export function clearMemory(userId: string) {
  memoryStore.delete(userId);
}