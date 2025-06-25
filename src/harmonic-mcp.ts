#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

const HARMONIC_API_BASE = "https://api.harmonic.ai";

interface HarmonicConfig {
  apiKey: string;
}

class HarmonicClient {
  private apiKey: string;

  constructor(config: HarmonicConfig) {
    this.apiKey = config.apiKey;
  }

  private async makeRequest(endpoint: string, method: string = 'GET', body?: any) {
    const url = `${HARMONIC_API_BASE}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Harmonic API error: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Failed to make Harmonic API request: ${error}`);
    }
  }

  async searchCompanies(query: string, limit: number = 10) {
    return this.makeRequest(`/companies?q=${encodeURIComponent(query)}&limit=${limit}`);
  }

  async getCompanyByDomain(domain: string) {
    return this.makeRequest(`/companies/${encodeURIComponent(domain)}`);
  }

  async searchPeople(query: string, limit: number = 10) {
    return this.makeRequest(`/people?q=${encodeURIComponent(query)}&limit=${limit}`);
  }

  async getPersonById(personId: string) {
    return this.makeRequest(`/people/${encodeURIComponent(personId)}`);
  }
}

class HarmonicMCPServer {
  private server: Server;
  private harmonicClient: HarmonicClient | null = null;

  constructor() {
    this.server = new Server(
      {
        name: "harmonic-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling() {
    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "harmonic_search_companies",
          description: "Search for companies in the Harmonic database",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query for companies",
              },
              limit: {
                type: "number",
                description: "Maximum number of results to return (default: 10)",
                default: 10,
              },
            },
            required: ["query"],
          },
        },
        {
          name: "harmonic_get_company",
          description: "Get detailed information about a company by its domain",
          inputSchema: {
            type: "object",
            properties: {
              domain: {
                type: "string",
                description: "The domain of the company (e.g., example.com)",
              },
            },
            required: ["domain"],
          },
        },
        {
          name: "harmonic_search_people",
          description: "Search for people/professionals in the Harmonic database",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query for people",
              },
              limit: {
                type: "number",
                description: "Maximum number of results to return (default: 10)",
                default: 10,
              },
            },
            required: ["query"],
          },
        },
        {
          name: "harmonic_get_person",
          description: "Get detailed information about a person by their ID",
          inputSchema: {
            type: "object",
            properties: {
              person_id: {
                type: "string",
                description: "The ID of the person in Harmonic's database",
              },
            },
            required: ["person_id"],
          },
        },
        {
          name: "harmonic_set_api_key",
          description: "Set the Harmonic API key for authentication",
          inputSchema: {
            type: "object",
            properties: {
              api_key: {
                type: "string",
                description: "Your Harmonic API key",
              },
            },
            required: ["api_key"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "harmonic_set_api_key": {
            const { api_key } = args as { api_key: string };
            this.harmonicClient = new HarmonicClient({ apiKey: api_key });
            return {
              content: [
                {
                  type: "text",
                  text: "Harmonic API key has been set successfully.",
                },
              ],
            };
          }

          case "harmonic_search_companies": {
            if (!this.harmonicClient) {
              throw new McpError(
                ErrorCode.InvalidRequest,
                "Harmonic API key not set. Please use harmonic_set_api_key first."
              );
            }
            const { query, limit = 10 } = args as { query: string; limit?: number };
            const results = await this.harmonicClient.searchCompanies(query, limit);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(results, null, 2),
                },
              ],
            };
          }

          case "harmonic_get_company": {
            if (!this.harmonicClient) {
              throw new McpError(
                ErrorCode.InvalidRequest,
                "Harmonic API key not set. Please use harmonic_set_api_key first."
              );
            }
            const { domain } = args as { domain: string };
            const company = await this.harmonicClient.getCompanyByDomain(domain);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(company, null, 2),
                },
              ],
            };
          }

          case "harmonic_search_people": {
            if (!this.harmonicClient) {
              throw new McpError(
                ErrorCode.InvalidRequest,
                "Harmonic API key not set. Please use harmonic_set_api_key first."
              );
            }
            const { query, limit = 10 } = args as { query: string; limit?: number };
            const results = await this.harmonicClient.searchPeople(query, limit);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(results, null, 2),
                },
              ],
            };
          }

          case "harmonic_get_person": {
            if (!this.harmonicClient) {
              throw new McpError(
                ErrorCode.InvalidRequest,
                "Harmonic API key not set. Please use harmonic_set_api_key first."
              );
            }
            const { person_id } = args as { person_id: string };
            const person = await this.harmonicClient.getPersonById(person_id);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(person, null, 2),
                },
              ],
            };
          }

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error}`
        );
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Harmonic MCP server running on stdio");
  }
}

const server = new HarmonicMCPServer();
server.run().catch(console.error);