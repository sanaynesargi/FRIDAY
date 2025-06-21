# Backend (FastAPI)

Handles:
- Accepting ideas/pieces from the frontend
- Creating notes in Obsidian via MCP
- Using OpenAI to suggest connections
- Updating notes with [[note name]] links

## Setup

1. Create a `.env` file in this folder with:
   ```
   OBSIDIAN_API_KEY=your_obsidian_api_key_here
   OBSIDIAN_HOST=your_obsidian_host_here
   OPENAI_API_KEY=your_openai_api_key_here
   ```
2. Install dependencies:
   ```sh
   pip install -r requirements.txt
   ```
3. Run the server:
   ```sh
   uvicorn main:app --reload
   ``` 