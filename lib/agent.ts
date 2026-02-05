import { ChatOllama } from "@langchain/ollama";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { tools } from "./tools";

// System prompt used when falling back to non-tool responses
const SYSTEM_PROMPT = `You are a helpful AI assistant. Use tools when available.
If tools are not available for this model, answer directly and concisely.`;

// Determine model and whether to pass tools (some Ollama models like `tinyllama` don't support tools)
const MODEL_NAME = (process.env.OLLAMA_MODEL || "tinyllama").toLowerCase();
const SUPPORTS_TOOLS = !/tinyllama|tiny/i.test(MODEL_NAME);

// Initialize the Chat Model
export const llm = new ChatOllama({
  model: process.env.OLLAMA_MODEL || "tinyllama",
  baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  temperature: 0.0,
});

/**
 * Runs the agent. If the configured Ollama model does not support tools
 * (common for very small models), the function will fallback to a
 * direct LLM response without invoking tools.
 */
export async function runAgent(input: string) {
  try {
    // Create agent with tools only when model supports them
    const agent = createReactAgent({
      llm,
      tools: SUPPORTS_TOOLS ? tools : [],
      messageModifier: `${SYSTEM_PROMPT}\nToday: ${new Date().toLocaleDateString()}`,
    });

    const response = await agent.invoke({
      messages: [{ role: "user", content: input }],
    });

    // If the agent returns structured messages, return last content
    const msgs = (response as any).messages;
    if (Array.isArray(msgs) && msgs.length > 0) {
      return msgs[msgs.length - 1].content;
    }

    // Fallback to generic output extraction
    return (response as any).output || "No response generated";
  } catch (error: any) {
    console.error("Agent Error Details:", error);

    // If error indicates the model doesn't support tools, fallback to direct LLM call
    const message = (error?.message || error?.error || "").toString();
    if (
      message.toLowerCase().includes("does not support tools") ||
      !SUPPORTS_TOOLS
    ) {
      try {
        const prompt = `${SYSTEM_PROMPT}\nUser: ${input}`;
        // Use dynamic call on llm to avoid strict typing issues across versions
        const anyLlm = llm as any;
        if (typeof anyLlm.call === "function") {
          const out = await anyLlm.call(prompt);
          return out?.toString?.() || String(out);
        }

        if (typeof anyLlm.generate === "function") {
          const gen = await anyLlm.generate([
            { role: "user", content: prompt },
          ]);
          // Try common generation shape
          const text =
            gen?.generations?.[0]?.[0]?.text || gen?.generations?.[0]?.text;
          return text || JSON.stringify(gen);
        }

        // Last resort: return an informative error
        return "The configured model does not support tools and an automatic fallback failed. Please change OLLAMA_MODEL to a model that supports tools (e.g. 'llama3').";
      } catch (fallbackError) {
        console.error("Fallback LLM call failed:", fallbackError);
        throw new Error("Failed to process agent request.");
      }
    }

    throw new Error("Failed to process agent request.");
  }
}
