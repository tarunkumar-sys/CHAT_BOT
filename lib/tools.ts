import { DuckDuckGoSearch } from "@langchain/community/tools/duckduckgo_search";
import { Calculator } from "@langchain/community/tools/calculator";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

// 1. Search Tool
export const searchTool = new DuckDuckGoSearch({
  maxResults: 3,
});

// 2. Calculator Tool
export const calculatorTool = new Calculator();


// 4. Time Tool
export const timeTool = tool(
  async () => {
    return new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  },
  {
    name: "current_time",
    description: "Returns the current date and time in Indian Standard Time (IST).",
    schema: z.object({}),
  }
);


export const tools = [searchTool, calculatorTool, timeTool];