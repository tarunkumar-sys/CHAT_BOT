import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { crawlWebsite } from './crawler';
import { chunkText } from './chunker';
import { createVectorstore, resolveWebsiteDomain } from './vectorstore';
import { getQaChain } from './qa';

export const websiteQATool = tool(
  async ({ question, website }: { question: string; website: string }) => {
    try {
      console.log(`[Website Q&A] Processing question: "${question}" for website: ${website}`);

      // Build full URL for crawling
      let fullUrl = website;
      if (!website.startsWith('http://') && !website.startsWith('https://')) {
        fullUrl = `https://${website}`;
      }

      // Try to find if already indexed under a partial/fuzzy name
      const resolvedDomain = await resolveWebsiteDomain(website);
      const alreadyIndexed = resolvedDomain !== null;

      if (!alreadyIndexed) {
        console.log(`[Website Q&A] Not indexed. Starting crawl of ${fullUrl}...`);
        const pages = await crawlWebsite(fullUrl, { maxPages: 15 });
        console.log(`[Website Q&A] Crawled ${pages.length} pages`);

        const chunks = await chunkText(pages);
        console.log(`[Website Q&A] Created ${chunks.length} chunks`);

        await createVectorstore(chunks, fullUrl);
        console.log(`[Website Q&A] Indexed successfully`);
      } else {
        console.log(`[Website Q&A] Using existing index for domain: ${resolvedDomain}`);
      }

      // Pass resolved domain (or full URL) to getQaChain — it handles both
      console.log(`[Website Q&A] Generating answer...`);
      const chain = await getQaChain(resolvedDomain ?? fullUrl);
      const result = await chain.invoke({ input: question });

      console.log(`[Website Q&A] Answer generated successfully`);
      return result.answer;
    } catch (error: any) {
      console.error(`[Website Q&A] Error:`, error);
      return `I encountered an error while processing the website: ${error.message}. Please make sure the website URL is correct and accessible.`;
    }
  },
  {
    name: 'website_qa',
    description: 'Use this tool to answer questions about a specific website. This tool will crawl the website (if not already indexed), extract all content, and answer questions based on that content. Use this when the user asks about information on a specific website, such as pricing, features, or any other content. You must provide both the question and the website URL.',
    schema: z.object({
      question: z.string().describe('The specific question to answer about the website'),
      website: z.string().describe('The website URL or name (e.g., https://example.com, example.com, or just "example")'),
    }),
  }
);
