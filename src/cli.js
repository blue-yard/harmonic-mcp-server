#!/usr/bin/env node
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} = require("@modelcontextprotocol/sdk/types.js");

const HARMONIC_API_BASE = "https://api.harmonic.ai";

class HarmonicClient {
  constructor(config) {
    this.apiKey = config.apiKey;
  }

  async makeRequest(endpoint, method = 'GET', body) {
    const url = `${HARMONIC_API_BASE}${endpoint}`;
    
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    const options = {
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

  async searchCompanies(query, limit = 10) {
    return this.makeRequest(`/companies?q=${encodeURIComponent(query)}&limit=${limit}`);
  }

  async getCompanyByDomain(domain) {
    return this.makeRequest(`/companies/${encodeURIComponent(domain)}`);
  }

  async searchPeople(query, limit = 10) {
    return this.makeRequest(`/people?q=${encodeURIComponent(query)}&limit=${limit}`);
  }

  async getPersonById(personId) {
    return this.makeRequest(`/people/${encodeURIComponent(personId)}`);
  }
}

class HarmonicMCPServer {
  constructor() {
    this.harmonicClient = null;
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

  setupErrorHandling() {
    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
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
            const { api_key } = args;
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
            const { query, limit = 10 } = args;
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
            const { domain } = args;
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
            const { query, limit = 10 } = args;
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
            const { person_id } = args;
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