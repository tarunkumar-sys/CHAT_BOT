import { DuckDuckGoSearch } from "@langchain/community/tools/duckduckgo_search";
import { Calculator } from "@langchain/community/tools/calculator";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
// Assuming memoryStore is exported from your memory.ts
import { memoryStore } from "./memory"; 

// 1. Search Tool
export const searchTool = new DuckDuckGoSearch({
  maxResults: 3,
});

// 2. Calculator Tool
export const calculatorTool = new Calculator();

// 3. Personal Memory Tool (Using the modern 'tool' wrapper)
export const memoryTool = tool(
  async ({ action, key, value, query }) => {
    try {
      switch (action) {
        case "get":
          if (!key) return "Error: Key is required for get";
          return memoryStore.getMemory(key) || `No memory found for: ${key}`;

        case "search":
          if (!query) return "Error: Query is required for search";
          const results = memoryStore.searchMemories(query);
          return results.length > 0 
            ? results.map((r: any) => `${r.key}: ${r.value}`).join("\n")
            : "No matching memories.";

        case "add":
          if (!key || !value) return "Error: Key and value required";
          memoryStore.addMemory(key, value);
          return `Saved memory: ${key}`;

        default:
          return "Invalid action.";
      }
    } catch (error) {
      return `Memory error: ${error}`;
    }
  },
  {
    name: "personal_memory",
    description: "Access or store personal details and preferences.",
    schema: z.object({
      action: z.enum(["get", "search", "add"]),
      key: z.string().optional(),
      value: z.string().optional(),
      query: z.string().optional(),
    }),
  }
);

// 4. Time Tool
export const timeTool = tool(
  async () => {
    return new Date().toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  },
  {
    name: "current_time",
    description: "Returns the current date and time.",
    schema: z.object({}),
  }
);

export const tools = [searchTool, calculatorTool, memoryTool, timeTool];