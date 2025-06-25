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

3. Restart Claude Desktop

4. In Claude, first set your API key:
```
Use the harmonic_set_api_key tool with your API key
```

5. Now you can use the Harmonic tools:
- `harmonic_search_companies` - Search for companies
- `harmonic_get_company` - Get company details by domain
- `harmonic_search_people` - Search for people
- `harmonic_get_person` - Get person details by ID

## Available Tools

### harmonic_set_api_key
Set your Harmonic API key for authentication.

Parameters:
- `api_key` (required): Your Harmonic API key

### harmonic_search_companies
Search for companies in the Harmonic database.

Parameters:
- `query` (required): Search query for companies
- `limit` (optional): Maximum number of results (default: 10)

### harmonic_get_company
Get detailed information about a company by its domain.

Parameters:
- `domain` (required): The domain of the company (e.g., example.com)

### harmonic_search_people
Search for people/professionals in the Harmonic database.

Parameters:
- `query` (required): Search query for people
- `limit` (optional): Maximum number of results (default: 10)

### harmonic_get_person
Get detailed information about a person by their ID.

Parameters:
- `person_id` (required): The ID of the person in Harmonic's database

## Development

Run in development mode:
```bash
npm run dev
```

## API Documentation

For more information about Harmonic's API, visit:
https://console.harmonic.ai/docs/api-reference/introduction