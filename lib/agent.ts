import { ChatOllama } from "@langchain/ollama";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { AIMessage, ToolMessage } from "@langchain/core/messages";
import { tools } from "./tools";

// const SYSTEM_PROMPT = `You are a helpful AI assistant. Use tools when available.
// If tools are not available for this model, answer directly and concisely.`;
const SYSTEM_PROMPT = `
You are a tool-using AI agent.

Rules:
- If a question needs real-time, external, factual, or numeric data → you MUST use a tool.
- If calculation is needed → use calculatorTool.
- If current date or time is needed → use current_time.
- Never guess real-world information.
- After using a tool, produce a clear final answer.
`;

// const MODEL_NAME = (process.env.OLLAMA_MODEL || "tinyllama").toLowerCase();
// const SUPPORTS_TOOLS = !/tinyllama|tiny/i.test(MODEL_NAME);
const SUPPORTS_TOOLS = true;

// export const llm = new ChatOllama({
//   model: process.env.OLLAMA_MODEL || "tinyllama",
//   baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
//   temperature: 0.0,
// });
export const llm = new ChatOllama({
  model: process.env.OLLAMA_MODEL || "qwen2.5:1.5b",
  baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  temperature: 0,
});


export async function runAgent(input: string) {
  // 1. User Input Log
  console.log("\n--- [LOG] User input received ---"); 

  try {
    const agent = createReactAgent({
      llm,
      // tools: SUPPORTS_TOOLS ? tools : [],
      tools,
      messageModifier: `${SYSTEM_PROMPT}\nToday: ${new Date().toLocaleDateString()}`,
    });

    const stream = await agent.stream(
      { messages: [{ role: "user", content: input }] },
      { streamMode: "values" }
    );

    let finalContent = "";

    for await (const chunk of stream) {
      const messages = chunk.messages;
      const lastMsg = messages[messages.length - 1];

      // Handle AI Message logic (Ollama generating or calling tools)
      if (lastMsg instanceof AIMessage) {
        if (lastMsg.tool_calls && lastMsg.tool_calls.length > 0) {
          // 2. Tool Calling Log
          lastMsg.tool_calls.forEach((tc) => {
            console.log(`--- [LOG] Ollama is calling tool: [${tc.name}] ---`);
          });
        } else if (lastMsg.content) {
          // 3. Generation Log
          console.log("--- [LOG] Ollama is generating response ---");
          finalContent = lastMsg.content as string;
        }
      } 
      
      // Handle Tool Message logic (The tool finishing its work)
      if (lastMsg instanceof ToolMessage) {
        // 4. Tool Success Log
        console.log(`--- [LOG] Tool [${lastMsg.name}] completed execution ---`);
      }
    }

    // 5. Final Output Log
    console.log("--- [LOG] Output generated successfully ---\n");
    return finalContent;

  } catch (error: any) {
    console.error("--- [LOG] Error occurred ---", error.message);
    
    // Fallback logic for small models
    if (!SUPPORTS_TOOLS) {
      console.log("--- [LOG] Falling back to direct LLM call ---");
      const out = await llm.invoke(`${SYSTEM_PROMPT}\nUser: ${input}`);
      return out.content;
    }

    throw new Error("Failed to process agent request.");
  }
}