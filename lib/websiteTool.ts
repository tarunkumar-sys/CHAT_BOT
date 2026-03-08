import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { crawlWebsite } from './crawler';
import { chunkText } from './chunker';
import { createVectorstore, websiteExists } from './vectorstore';
import { getQaChain } from './qa';

export const websiteQATool = tool(
  async ({ question, website }: { question: string; website: string }) => {
    try {
      console.log(`[Website Q&A] Processing question: "${question}" for website: ${website}`);
      
      // Ensure URL has protocol
      let fullUrl = website;
      if (!website.startsWith('http://') && !website.startsWith('https://')) {
        fullUrl = `https://${website}`;
      }

      // Check if website already indexed
      console.log(`[Website Q&A] Checking if ${fullUrl} is already indexed...`);
      const exists = await websiteExists(fullUrl);
      
      if (!exists) {
        console.log(`[Website Q&A] Website not indexed. Starting crawl...`);
        // Crawl and index - increased to 15 pages
        const pages = await crawlWebsite(fullUrl, { maxPages: 15 });
        console.log(`[Website Q&A] Crawled ${pages.length} pages`);
        
        const chunks = await chunkText(pages);
        console.log(`[Website Q&A] Created ${chunks.length} chunks`);
        
        await createVectorstore(chunks, fullUrl);
        console.log(`[Website Q&A] Indexed successfully`);
      } else {
        console.log(`[Website Q&A] Using existing index`);
      }

      // Answer question
      console.log(`[Website Q&A] Generating answer...`);
      const chain = await getQaChain(fullUrl);
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
      website: z.string().describe('The website URL (e.g., https://example.com or just example.com)'),
    }),
  }
);