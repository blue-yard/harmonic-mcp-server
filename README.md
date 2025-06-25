# Harmonic MCP Server

A Model Context Protocol (MCP) server that provides access to Harmonic.ai's API for searching companies and people/professionals.

## Features

- Search companies in Harmonic's database
- Get detailed company information by domain
- Search for people/professionals
- Get detailed person information by ID
- Standalone package with all dependencies included

## Building

Install dependencies:
```bash
npm install
```

Build the server:
```bash
npm run build
```

This creates a standalone package in `dist/standalone/` with all dependencies included.

## Usage with Claude Desktop

1. Get your Harmonic API key from https://console.harmonic.ai/docs/dashboard

2. Add the server to your Claude Desktop configuration:

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "harmonic": {
      "command": "node",
      "args": ["/absolute/path/to/HarmonicMCPServer/dist/standalone/index.js"]
    }
  }
}
```

**Important**: 
- Replace `/absolute/path/to/HarmonicMCPServer` with the actual path to your project
- Use the full path to node (find it with `which node`)
- Make sure the path has no spaces or special characters

3. Restart Claude Desktop

4. In Claude, first set your API key:
```
Use the harmonic_set_api_key tool with your API key
```

5. Now you can use the Harmonic tools:
- `harmonic_search_company_by_domain` - Search for a company by its website domain
- `harmonic_search_companies` - Search for companies by query
- `harmonic_search_people` - Search for people/professionals
- `harmonic_get_saved_search_results` - Get results from a saved search
- `harmonic_get_company_employees` - Get all active employees from a company

## Available Tools

### harmonic_set_api_key
Set your Harmonic API key for authentication.

Parameters:
- `api_key` (required): Your Harmonic API key

### harmonic_search_company_by_domain
Search for a company by its website domain using POST method.

Parameters:
- `domain` (required): The website domain of the company (e.g., harmonic.ai)

### harmonic_search_companies
Search for companies by query using GET method.

Parameters:
- `query` (required): Search query for companies
- `size` (optional): Number of results to return (default: 50)
- `cursor` (optional): Cursor for pagination

### harmonic_search_people
Search for people/professionals using GET method.

Parameters:
- `query` (required): Search query for people
- `size` (optional): Number of results to return (default: 50)
- `cursor` (optional): Cursor for pagination

### harmonic_get_saved_search_results
Get results from a saved search.

Parameters:
- `search_id` (required): The ID of the saved search
- `size` (optional): Number of results to return (default: 50)
- `cursor` (optional): Cursor for pagination

### harmonic_get_company_employees
Get all active employees from a company.

Parameters:
- `company_id` (required): The ID of the company
- `size` (optional): Number of results to return (default: 50)
- `cursor` (optional): Cursor for pagination

## Development

Run in development mode:
```bash
npm run dev
```

## API Documentation

For more information about Harmonic's API, visit:
https://console.harmonic.ai/docs/api-reference/introduction