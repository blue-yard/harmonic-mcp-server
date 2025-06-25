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

// Global state to persist the API key
let globalHarmonicClient = null;

class HarmonicClient {
  constructor(config) {
    this.apiKey = config.apiKey;
    console.error(`[DEBUG] API key set: ${this.apiKey.substring(0, 8)}...`);
  }

  async makeRequest(endpoint, method = 'GET', queryParams = {}) {
    // Add API key to query parameters
    const params = new URLSearchParams({
      ...queryParams,
      apikey: this.apiKey
    });
    
    const url = `${HARMONIC_API_BASE}${endpoint}?${params}`;
    
    const headers = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
    };

    const options = {
      method,
      headers,
    };

    console.error(`[DEBUG] Making ${method} request to: ${url}`);

    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[DEBUG] API Response: ${response.status} - ${errorText}`);
        
        if (response.status === 403) {
          throw new Error(`Authentication failed (403). Please check your API key. Response: ${errorText}`);
        } else if (response.status === 401) {
          throw new Error(`Unauthorized (401). API key may be invalid or expired. Response: ${errorText}`);
        }
        
        throw new Error(`Harmonic API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.error(`[DEBUG] API call successful`);
      return data;
    } catch (error) {
      console.error(`[DEBUG] API call failed: ${error.message}`);
      throw new Error(`Failed to make Harmonic API request: ${error.message || error}`);
    }
  }

  async searchCompaniesByDomain(domain) {
    // Using POST method as shown in the docs
    return this.makeRequest('/companies', 'POST', { website_domain: domain });
  }

  async searchCompanies(query, size = 50, cursor = null) {
    const params = { q: query, size };
    if (cursor) params.cursor = cursor;
    return this.makeRequest('/companies', 'GET', params);
  }

  async searchPeople(query, size = 50, cursor = null) {
    const params = { q: query, size };
    if (cursor) params.cursor = cursor;
    return this.makeRequest('/people', 'GET', params);
  }

  async getSavedSearchResults(searchId, size = 50, cursor = null) {
    const params = { size };
    if (cursor) params.cursor = cursor;
    return this.makeRequest(`/saved_searches:results/${searchId}`, 'GET', params);
  }

  async getEmployeesFromCompany(companyId, size = 50, cursor = null) {
    const params = { size };
    if (cursor) params.cursor = cursor;
    return this.makeRequest(`/companies/${companyId}/employees`, 'GET', params);
  }
}

class HarmonicMCPServer {
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
    
    console.error("[DEBUG] Harmonic MCP server initialized");
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
        {
          name: "harmonic_search_company_by_domain",
          description: "Search for a company by its website domain",
          inputSchema: {
            type: "object",
            properties: {
              domain: {
                type: "string",
                description: "The website domain of the company (e.g., harmonic.ai)",
              },
            },
            required: ["domain"],
          },
        },
        {
          name: "harmonic_search_companies",
          description: "Search for companies by query",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query for companies",
              },
              size: {
                type: "number",
                description: "Number of results to return (default: 50)",
                default: 50,
              },
              cursor: {
                type: "string",
                description: "Cursor for pagination (optional)",
              },
            },
            required: ["query"],
          },
        },
        {
          name: "harmonic_search_people",
          description: "Search for people/professionals",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query for people",
              },
              size: {
                type: "number",
                description: "Number of results to return (default: 50)",
                default: 50,
              },
              cursor: {
                type: "string",
                description: "Cursor for pagination (optional)",
              },
            },
            required: ["query"],
          },
        },
        {
          name: "harmonic_get_saved_search_results",
          description: "Get results from a saved search",
          inputSchema: {
            type: "object",
            properties: {
              search_id: {
                type: "string",
                description: "The ID of the saved search",
              },
              size: {
                type: "number",
                description: "Number of results to return (default: 50)",
                default: 50,
              },
              cursor: {
                type: "string",
                description: "Cursor for pagination (optional)",
              },
            },
            required: ["search_id"],
          },
        },
        {
          name: "harmonic_get_company_employees",
          description: "Get all active employees from a company",
          inputSchema: {
            type: "object",
            properties: {
              company_id: {
                type: "string",
                description: "The ID of the company",
              },
              size: {
                type: "number",
                description: "Number of results to return (default: 50)",
                default: 50,
              },
              cursor: {
                type: "string",
                description: "Cursor for pagination (optional)",
              },
            },
            required: ["company_id"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      console.error(`[DEBUG] Tool called: ${name}`);
      console.error(`[DEBUG] Current client state: ${globalHarmonicClient ? 'SET' : 'NOT SET'}`);

      try {
        switch (name) {
          case "harmonic_set_api_key": {
            const { api_key } = args;
            globalHarmonicClient = new HarmonicClient({ apiKey: api_key });
            console.error(`[DEBUG] API key has been set globally`);
            return {
              content: [
                {
                  type: "text",
                  text: "Harmonic API key has been set successfully. You can now use the other Harmonic tools.",
                },
              ],
            };
          }

          case "harmonic_search_company_by_domain": {
            if (!globalHarmonicClient) {
              throw new McpError(
                ErrorCode.InvalidRequest,
                "Harmonic API key not set. Please use harmonic_set_api_key first."
              );
            }
            const { domain } = args;
            console.error(`[DEBUG] Searching company by domain: ${domain}`);
            const results = await globalHarmonicClient.searchCompaniesByDomain(domain);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(results, null, 2),
                },
              ],
            };
          }

          case "harmonic_search_companies": {
            if (!globalHarmonicClient) {
              throw new McpError(
                ErrorCode.InvalidRequest,
                "Harmonic API key not set. Please use harmonic_set_api_key first."
              );
            }
            const { query, size = 50, cursor } = args;
            console.error(`[DEBUG] Searching companies: query="${query}", size=${size}`);
            const results = await globalHarmonicClient.searchCompanies(query, size, cursor);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(results, null, 2),
                },
              ],
            };
          }

          case "harmonic_search_people": {
            if (!globalHarmonicClient) {
              throw new McpError(
                ErrorCode.InvalidRequest,
                "Harmonic API key not set. Please use harmonic_set_api_key first."
              );
            }
            const { query, size = 50, cursor } = args;
            console.error(`[DEBUG] Searching people: query="${query}", size=${size}`);
            const results = await globalHarmonicClient.searchPeople(query, size, cursor);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(results, null, 2),
                },
              ],
            };
          }

          case "harmonic_get_saved_search_results": {
            if (!globalHarmonicClient) {
              throw new McpError(
                ErrorCode.InvalidRequest,
                "Harmonic API key not set. Please use harmonic_set_api_key first."
              );
            }
            const { search_id, size = 50, cursor } = args;
            console.error(`[DEBUG] Getting saved search results: id=${search_id}`);
            const results = await globalHarmonicClient.getSavedSearchResults(search_id, size, cursor);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(results, null, 2),
                },
              ],
            };
          }

          case "harmonic_get_company_employees": {
            if (!globalHarmonicClient) {
              throw new McpError(
                ErrorCode.InvalidRequest,
                "Harmonic API key not set. Please use harmonic_set_api_key first."
              );
            }
            const { company_id, size = 50, cursor } = args;
            console.error(`[DEBUG] Getting company employees: id=${company_id}`);
            const results = await globalHarmonicClient.getEmployeesFromCompany(company_id, size, cursor);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(results, null, 2),
                },
              ],
            };
          }

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        console.error(`[DEBUG] Tool execution error:`, error);
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error.message || error}`
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