// /app/tools/duckduckgo.ts - Custom implementation
import { tool } from "@langchain/core/tools";

export const duckDuckGoTool = tool(
  async ({ query }: { query: string }) => {
    console.log("DuckDuckGo search called:", query);
    
    try {
      // Using DuckDuckGo's HTML API
      const encodedQuery = encodeURIComponent(query);
      const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      
      const html = await response.text();
      
      // Simple HTML parsing to extract results
      const results: string[] = [];
      const resultPattern = /class="result__snippet">([^<]+)</g;
      let match;
      let count = 0;
      
      while ((match = resultPattern.exec(html)) !== null && count < 3) {
        results.push(match[1].trim());
        count++;
      }
      
      if (results.length > 0) {
        return `Search results for "${query}":\n\n${results.map((r, i) => `${i + 1}. ${r}`).join('\n')}`;
      } else {
        // Fallback to using a search API
        const fallbackRes = await fetch(
          `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1`
        );
        const data = await fallbackRes.json();
        
        if (data.AbstractText) {
          return `${data.AbstractText}\n\nSource: ${data.AbstractURL || 'DuckDuckGo'}`;
        }
        
        return `I searched for "${query}" but couldn't find specific results. Try rephrasing your question.`;
      }
      
    } catch (error: any) {
      console.error("Search error:", error);
      return `Unable to perform search at the moment. Please try again later.`;
    }
  },
  {
    name: "search_web",
    description: "Search the web for current information",
    schema: {
      type: "object",
      properties: {
        query: { type: "string" }
      },
      required: ["query"]
    } as const,
  }
);