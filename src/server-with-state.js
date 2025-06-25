#!/usr/bin/env node
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} = require("@modelcontextprotocol/sdk/types.js");

// Note: The actual API base URL might be different
// This needs to be confirmed from Harmonic's documentation
const HARMONIC_API_BASE = "https://api.harmonic.ai/v1";

// Global state to persist the API key
let globalHarmonicClient = null;

class HarmonicClient {
  constructor(config) {
    this.apiKey = config.apiKey;
    console.error(`[DEBUG] API key set: ${this.apiKey.substring(0, 8)}...`);
  }

  async makeRequest(endpoint, method = 'GET', body) {
    const url = `${HARMONIC_API_BASE}${endpoint}`;
    
    const headers = {
      'apikey': this.apiKey,
      'Content-Type': 'application/json',
      'website_domain': 'harmonic.ai'
    };

    const options = {
      method,
      headers,
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    console.error(`[DEBUG] Making request to: ${url}`);
    console.error(`[DEBUG] Headers: ${JSON.stringify(headers, null, 2)}`);

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
        {
          name: "harmonic_test_connection",
          description: "Test the API connection and check available endpoints",
          inputSchema: {
            type: "object",
            properties: {},
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

          case "harmonic_search_companies": {
            if (!globalHarmonicClient) {
              console.error(`[DEBUG] No API key set when calling search_companies`);
              throw new McpError(
                ErrorCode.InvalidRequest,
                "Harmonic API key not set. Please use harmonic_set_api_key first."
              );
            }
            const { query, limit = 10 } = args;
            console.error(`[DEBUG] Searching companies: query="${query}", limit=${limit}`);
            const results = await globalHarmonicClient.searchCompanies(query, limit);
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
            if (!globalHarmonicClient) {
              console.error(`[DEBUG] No API key set when calling get_company`);
              throw new McpError(
                ErrorCode.InvalidRequest,
                "Harmonic API key not set. Please use harmonic_set_api_key first."
              );
            }
            const { domain } = args;
            console.error(`[DEBUG] Getting company: domain="${domain}"`);
            const company = await globalHarmonicClient.getCompanyByDomain(domain);
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
            if (!globalHarmonicClient) {
              console.error(`[DEBUG] No API key set when calling search_people`);
              throw new McpError(
                ErrorCode.InvalidRequest,
                "Harmonic API key not set. Please use harmonic_set_api_key first."
              );
            }
            const { query, limit = 10 } = args;
            console.error(`[DEBUG] Searching people: query="${query}", limit=${limit}`);
            const results = await globalHarmonicClient.searchPeople(query, limit);
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
            if (!globalHarmonicClient) {
              console.error(`[DEBUG] No API key set when calling get_person`);
              throw new McpError(
                ErrorCode.InvalidRequest,
                "Harmonic API key not set. Please use harmonic_set_api_key first."
              );
            }
            const { person_id } = args;
            console.error(`[DEBUG] Getting person: id="${person_id}"`);
            const person = await globalHarmonicClient.getPersonById(person_id);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(person, null, 2),
                },
              ],
            };
          }

          case "harmonic_test_connection": {
            if (!globalHarmonicClient) {
              throw new McpError(
                ErrorCode.InvalidRequest,
                "Harmonic API key not set. Please use harmonic_set_api_key first."
              );
            }
            
            console.error(`[DEBUG] Testing connection...`);
            
            // Try different possible endpoints
            const testEndpoints = [
              "/companies?q=google&limit=1",
              "/company?q=google&limit=1",
              "/search/companies?q=google&limit=1",
              "/",
              "/api/v1/companies?q=google&limit=1"
            ];
            
            const results = [];
            
            for (const endpoint of testEndpoints) {
              try {
                console.error(`[DEBUG] Testing endpoint: ${endpoint}`);
                const response = await globalHarmonicClient.makeRequest(endpoint);
                results.push({ endpoint, status: "success", response });
              } catch (error) {
                results.push({ endpoint, status: "failed", error: error.message });
              }
            }
            
            return {
              content: [
                {
                  type: "text",
                  text: `Connection test results:\n${JSON.stringify(results, null, 2)}`,
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