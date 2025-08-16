from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Literal
import os
import requests
from dotenv import load_dotenv
import ollama
import re
import json
import uuid
from openai import OpenAI
from pydantic import BaseModel
import logging
from datetime import datetime
import warnings

warnings.filterwarnings("ignore")


logger = logging.getLogger('uvicorn.error')
logger.setLevel(logging.DEBUG)

load_dotenv()

OBSIDIAN_API_KEY = os.getenv("OBSIDIAN_API_KEY", "")
OBSIDIAN_HOST = os.getenv("OBSIDIAN_HOST", "http://localhost:27123")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

client = OpenAI()

class Connection(BaseModel):
    name: str
    reason: str

class SelectedConnections(BaseModel):
    names: list[Connection]

app = FastAPI()

# Add CORS middleware to allow OPTIONS requests (for CORS preflight) from the frontend (e.g. http://localhost:5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # adjust if your frontend runs on a different origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Submission(BaseModel):
    type: Literal["idea", "piece"]
    content: str
    note_name: str = ""
    external: bool = False

class ConnectionRequest(BaseModel):
    new_note: str
    connections: List[str]

class SearchRequest(BaseModel):
    query: str
    mode: Literal["text", "prompt"]

class TagSearchRequest(BaseModel):
    tags: List[str]

class SearchResult(BaseModel):
    name: str
    content: str
    type: str
    score: float = 0.0
    reason: str = ""
    created: float = 0.0
    modified: float = 0.0
    word_count: int = 0
    num_connections: int = 0
    external: bool = False

class PromptEntry(BaseModel):
    id: str = ""
    title: str
    prompt: str
    essay_link: str = ""
    backed_up: bool = False
    note_name: str = ""
    drafts: List[dict] = []

class Draft(BaseModel):
    id: str = ""
    title: str
    link: str
    backed_up: bool = False
    note_name: str = ""

class PromptRequest(BaseModel):
    title: str
    prompt: str
    essay_link: str = ""

class DraftRequest(BaseModel):
    title: str

class PromptUpdateRequest(BaseModel):
    id: str
    backed_up: bool
    note_name: str = ""

class BatchTagRequest(BaseModel):
    note_names: List[str]
    tags: List[str]

class IdeaBoardRequest(BaseModel):
    name: str
    description: str

class IdeaBoard(BaseModel):
    id: str = ""
    name: str
    description: str
    nodes: List[dict] = []
    edges: List[dict] = []
    created: float = 0.0
    modified: float = 0.0

class IdeaBoardUpdateRequest(BaseModel):
    id: str
    name: str
    description: str
    nodes: List[dict]
    edges: List[dict]
    created: float
    modified: float

@app.post("/submit")
def submit(sub: Submission):
    # 1. Create note in Obsidian via Local REST API (POST /vault/append)
    content = sub.content
    if sub.type == "piece" and sub.external:
        # Add #extern tag at the top
        content = "#extern\n" + content
        
    note_name = create_obsidian_note(sub.type, content, sub.note_name)

    # 2. Get existing notes for context (GET /vault/list)
    existing_notes = list_obsidian_notes()
    # 3. Use OpenAI to suggest connections, skip the new note itself
    suggestions = suggest_connections(sub.content, existing_notes, new_note_name=note_name)

    # 4. For each suggestion, append the connection to the new note
    if suggestions and hasattr(suggestions, 'names'):
        for conn in suggestions.names:
            add_connection(note_name, conn.name, conn.reason)

    return {"note_name": note_name, "suggestions": suggestions}

@app.post("/connect")
def connect(req: ConnectionRequest):
    # Append [[connection]] to the new note (using POST /vault/append)
    for conn in req.connections:
        if isinstance(conn, dict):
            add_connection(req.new_note, conn.get("name"), conn.get("reason", ""))
        else:
            add_connection(req.new_note, conn, "")
    return {"status": "connections added"}

@app.get("/stats")
def get_stats():
    print(os.getenv("OBSIDIAN_VAULT_PATH", "."))
    try:
        # Get all notes from the vault
        existing_notes = list_obsidian_notes()
        # Filter to only include notes with "Idea" or "Piece" in the name
        filtered_notes = [note for note in existing_notes if "Idea" in note or "Piece" in note]
        
        # Count different types
        total_notes = len(filtered_notes)
        ideas = len([note for note in filtered_notes if note.startswith("Idea -")])
        pieces = len([note for note in filtered_notes if note.startswith("Piece -")])
        
        # Count connections
        total_connections = 0
        for note in filtered_notes:
            content = get_note_content(note)
            total_connections += content.count('[[')
        
        external_pieces = len([note for note in filtered_notes if is_external_note(get_note_content(note))])
        
        return {
            "totalNotes": total_notes,
            "ideas": ideas,
            "pieces": pieces,
            "connections": total_connections,
            "externalPieces": external_pieces
        }
    except Exception as e:
        print("Error getting stats:", e)
        return {
            "totalNotes": 0,
            "ideas": 0,
            "pieces": 0,
            "connections": 0,
            "externalPieces": 0
        }

@app.post("/search")
def search(req: SearchRequest):
    try:
        existing_notes = list_obsidian_notes()
        # Filter to only include notes with "Idea" or "Piece" in the name
        filtered_notes = [note for note in existing_notes if "Idea" in note or "Piece" in note]
        results = []
        # Build note content and connection maps for connection counting
        note_contents = {}
        for note in filtered_notes:
            note_contents[note] = get_note_content(note)
        for note in filtered_notes:
            content = note_contents[note]
            # Remove connections for text search
            content_without_connections = re.sub(r'\[\[.*?\]\]', '', content)
            note_type = "idea" if note.startswith("Idea -") else "piece"
            # Metadata
            file_path = os.path.join(os.getenv("OBSIDIAN_VAULT_PATH", "."), note)
            try:
                stat = os.stat(file_path)
                created = stat.st_ctime
                modified = stat.st_mtime
            except Exception:
                created = 0.0
                modified = 0.0
            word_count = len(content.split())
            # Count connections (outgoing + incoming)
            outgoing = content.count('[[')
            incoming = 0
            note_name_without_ext = note.replace(".md", "")
            note_name_without_prefix = note_name_without_ext.replace("Idea - ", "").replace("Piece - ", "")
            for other_note, other_content in note_contents.items():
                if other_note != note:
                    incoming += other_content.count(f'[[{note_name_without_ext}]]')
                    incoming += other_content.count(f'[[{note_name_without_prefix}]]')
            num_connections = outgoing + incoming
            # Text search
            if req.mode == "text":
                if req.query.lower() in content_without_connections.lower():
                    results.append(SearchResult(
                        name=note.replace("Idea - ", "").replace("Piece - ", "").replace(".md", ""),
                        content=content_without_connections[:200] + "..." if len(content_without_connections) > 200 else content_without_connections,
                        type=note_type,
                        created=created,
                        modified=modified,
                        word_count=word_count,
                        num_connections=num_connections,
                        external=is_external_note(content)
                    ))
            # Prompt search
            elif req.mode == "prompt":
                if content_without_connections.strip():
                    try:
                        response = client.chat.completions.create(
                            model="gpt-4o-mini",
                            messages=[
                                {"role": "system", "content": "You are a helpful assistant that rates the associativity of a piece (e.g. an essay) with an essay prompt. Return a JSON object with 'score' (number 0-1) and 'reason' (brief explanation of why it's relevant)."},
                                {"role": "user", "content": f"Query: {req.query}\nNote content: {content_without_connections[:1000]}\n\nReturn JSON: {{'score': 0.8, 'reason': 'brief explanation'}}"}
                            ],
                            max_tokens=100,
                            temperature=0
                        )
                        response_text = response.choices[0].message.content.strip()
                        try:
                            # Try to parse JSON response
                            import json
                            result_data = json.loads(response_text)
                            score = float(result_data.get('score', 0))
                            reason = result_data.get('reason', 'Relevant to query')
                        except:
                            # Fallback: try to extract score from text
                            score = float(response_text.split()[0]) if response_text.split() else 0
                            reason = "Relevant to query"
                        
                        if score > 0.3:
                            results.append(SearchResult(
                                name=note.replace("Idea - ", "").replace("Piece - ", "").replace(".md", ""),
                                content=content_without_connections[:200] + "..." if len(content_without_connections) > 200 else content_without_connections,
                                type=note_type,
                                score=score,
                                reason=reason,
                                created=created,
                                modified=modified,
                                word_count=word_count,
                                num_connections=num_connections,
                                external=is_external_note(content)
                            ))
                    except Exception as e:
                        print(f"Error getting similarity for {note}: {e}")
                        continue
        # Sort
        if req.mode == "prompt":
            results.sort(key=lambda x: x.score, reverse=True)
        else:
            results.sort(key=lambda x: x.name.lower())
        return {"results": results[:10]}
    except Exception as e:
        print("Error in search:", e)
        raise HTTPException(status_code=500, detail=f"Search error: {e}")

@app.post("/search_by_tags")
def search_by_tags(req: TagSearchRequest):
    try:
        existing_notes = list_obsidian_notes()
        # Filter to only include notes with "Idea" or "Piece" in the name
        filtered_notes = [note for note in existing_notes if "Idea" in note or "Piece" in note]
        results = []
        
        for note in filtered_notes:
            content = get_note_content(note)
            note_type = "idea" if note.startswith("Idea -") else "piece"
            
            # Extract tags from the first line
            lines = content.splitlines()
            note_tags = set()
            if lines and lines[0].startswith('#'):
                first_line = lines[0]
                tag_matches = re.findall(r'#([^#\s]+)', first_line)
                note_tags = set(tag_matches)
            
            # Check if any of the requested tags are in this note's tags
            matching_tags = note_tags.intersection(set(req.tags))
            if matching_tags:
                # Metadata
                file_path = os.path.join(os.getenv("OBSIDIAN_VAULT_PATH", "."), note)
                try:
                    stat = os.stat(file_path)
                    created = stat.st_ctime
                    modified = stat.st_mtime
                except Exception:
                    created = 0.0
                    modified = 0.0
                
                word_count = len(content.split())
                
                # Count connections
                outgoing = content.count('[[')
                incoming = 0
                note_name_without_ext = note.replace(".md", "")
                note_name_without_prefix = note_name_without_ext.replace("Idea - ", "").replace("Piece - ", "")
                
                for other_note in filtered_notes:
                    if other_note != note:
                        other_content = get_note_content(other_note)
                        incoming += other_content.count(f'[[{note_name_without_ext}]]')
                        incoming += other_content.count(f'[[{note_name_without_prefix}]]')
                
                num_connections = outgoing + incoming
                
                results.append(SearchResult(
                    name=note.replace("Idea - ", "").replace("Piece - ", "").replace(".md", ""),
                    content=content[:200] + "..." if len(content) > 200 else content,
                    type=note_type,
                    score=len(matching_tags),  # Score based on number of matching tags
                    reason=f"Contains tags: {', '.join(matching_tags)}",
                    created=created,
                    modified=modified,
                    word_count=word_count,
                    num_connections=num_connections,
                    external=is_external_note(content)
                ))
        
        # Sort by score (number of matching tags) descending
        results.sort(key=lambda x: x.score, reverse=True)
        return {"results": results}
        
    except Exception as e:
        print("Error in tag search:", e)
        raise HTTPException(status_code=500, detail=f"Tag search error: {e}")

@app.post("/batch_tag")
def batch_tag(req: BatchTagRequest):
    logger.debug(f"Checking for file")

    try:
        for note_name in req.note_names:
            # Determine full note file name
            for prefix in ["Idea - ", "Piece - "]:
                file_name = f"{prefix}{note_name}.md"
                file_path = os.path.join(os.getenv("OBSIDIAN_VAULT_PATH", "."), file_name)

                if os.path.exists(file_path):
                    break
            else:
                continue  # skip if not found

            content = get_note_content(file_name)
            lines = content.splitlines()
            
            # Extract existing tags from the first line
            existing_tags = set()
            if lines and lines[0].startswith('#'):
                # Parse existing tags from the first line
                first_line = lines[0]
                # Extract hashtags using regex - capture everything after # until next # or end
                existing_tag_matches = re.findall(r'#([^#\s]+)', first_line)
                existing_tags = set(existing_tag_matches)
                # Remove the first line since we'll recreate it
                lines = lines[1:]
            
            # Combine existing tags with new tags, avoiding duplicates
            all_tags = existing_tags.union(set(req.tags))
            
            # Create new tag line - handle spaces by wrapping in quotes if needed
            tag_line = ' '.join(f'#{tag}' for tag in sorted(all_tags))
            
            # Reconstruct content with preserved tags
            new_content = tag_line + '\n' + '\n'.join(lines)
            
            # Save back
            url = f"{OBSIDIAN_HOST}/vault/{file_name}"
            headers = {
                "Authorization": f"Bearer {OBSIDIAN_API_KEY}",
                "Content-Type": "text/markdown",
                "accept": "*/*"
            }
            resp = requests.put(url, data=new_content, headers=headers, verify=False)
            if not resp.ok:
                print(f"Failed to update tags for {file_name}: {resp.text}")
        return {"status": "tags updated"}
    except Exception as e:
        print("Error in batch_tag:", e)
        raise HTTPException(status_code=500, detail=f"Batch tag error: {e}")

# --- Prompts Management ---
PROMPTS_FILE = "prompts.json"

def load_prompts():
    try:
        if os.path.exists(PROMPTS_FILE):
            with open(PROMPTS_FILE, 'r') as f:
                data = json.load(f)
                # Handle both old format (list) and new format (dict with prompts key)
                if isinstance(data, list):
                    return data
                elif isinstance(data, dict) and "prompts" in data:
                    return data["prompts"]
                else:
                    return []
        return []
    except Exception as e:
        print(f"Error loading prompts: {e}")
        return []

def save_prompts(prompts):
    try:
        # Save in new format with prompts key
        data = {"prompts": prompts}
        with open(PROMPTS_FILE, 'w') as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"Error saving prompts: {e}")
        raise HTTPException(status_code=500, detail=f"Error saving prompts: {e}")

@app.get("/prompts")
def get_prompts():
    prompts = load_prompts()
    return {"prompts": prompts}

@app.post("/prompts")
def create_prompt(prompt: dict):
    try:
        # Load existing prompts
        try:
            with open("prompts.json", "r") as f:
                data = json.load(f)
        except FileNotFoundError:
            data = {"prompts": []}
 
        # Create new prompt with ID
        new_prompt = {
            "id": str(uuid.uuid4()),
            "title": prompt["title"],
            "prompt": prompt["prompt"],
            "essay_link": prompt.get("essay_link", ""),
            "backed_up": False,
            "note_name": "",
            "drafts": [],
            "folder": prompt.get("folder", "")
        }
 
        data.append(new_prompt)
        
        # Save back to file
        with open("prompts.json", "w") as f:
            json.dump(data, f, indent=2)
        
        return {"message": "Prompt created successfully", "prompt": new_prompt}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/prompts/{prompt_id}")
def update_prompt(prompt_id: str, update_data: dict):
    try:
        # Load existing prompts
        try:
            with open("prompts.json", "r") as f:
                data = json.load(f)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="Prompt not found")
        # Find and update prompt
        prompts = data
        prompt_to_update = None
        for prompt in prompts:
            if prompt["id"] == prompt_id:
                prompt_to_update = prompt
                break
        
        if not prompt_to_update:
            raise HTTPException(status_code=404, detail="Prompt not found")
        
        # Update fields
        if "backed_up" in update_data:
            prompt_to_update["backed_up"] = update_data["backed_up"]
        if "note_name" in update_data:
            prompt_to_update["note_name"] = update_data["note_name"]
        if "folder" in update_data:
            if not prompt_to_update.get("folder"):
                prompt_to_update["folder"] = {}

            prompt_to_update["folder"] = update_data["folder"]
        

        # Save back to file
        with open("prompts.json", "w") as f:
            json.dump(data, f, indent=2)
        
        return {"message": "Prompt updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/prompts/{prompt_id}")
def delete_prompt(prompt_id: str):
    try:
        # Load existing prompts
        try:
            with open("prompts.json", "r") as f:
                data = json.load(f)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="Prompt not found")
        
        # Find and remove prompt
        prompts = data.get("prompts", [])
        prompt_to_delete = None
        for prompt in prompts:
            if prompt["id"] == prompt_id:
                prompt_to_delete = prompt
                break
        
        if not prompt_to_delete:
            raise HTTPException(status_code=404, detail="Prompt not found")
        
        prompts.remove(prompt_to_delete)
        data["prompts"] = prompts
        
        # Save back to file
        with open("prompts.json", "w") as f:
            json.dump(data, f, indent=2)
        
        return {"message": "Prompt deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/prompts/{prompt_id}/drafts")
def create_draft(prompt_id: str, req: DraftRequest):
    try:
        # Load existing prompts
        try:
            with open("prompts.json", "r") as f:
                data = json.load(f)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="Prompt not found")
        
        # Handle both old format (list) and new format (dict with prompts key)
        if isinstance(data, list):
            prompts = data
        elif isinstance(data, dict) and "prompts" in data:
            prompts = data["prompts"]
        else:
            prompts = []
        
        # Find prompt and add draft
        prompt_found = False
        for prompt in prompts:
            if prompt["id"] == prompt_id:
                new_draft = {
                    "id": str(uuid.uuid4()),
                    "title": req.title,
                    "link": prompt.get("essay_link", ""),  # Use the prompt's essay_link
                    "backed_up": False,
                    "note_name": ""
                }
                prompt["drafts"].append(new_draft)
                prompt_found = True
                break
        
        if not prompt_found:
            raise HTTPException(status_code=404, detail="Prompt not found")
        
        # Save back to file - maintain the same format
        if isinstance(data, list):
            # Save as list directly
            with open("prompts.json", "w") as f:
                json.dump(prompts, f, indent=2)
        else:
            # Save with prompts key
            data["prompts"] = prompts
            with open("prompts.json", "w") as f:
                json.dump(data, f, indent=2)
        
        return {"draft": new_draft}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating draft: {e}")
        print(f"Request data: {req}")
        raise HTTPException(status_code=500, detail=f"Error creating draft: {e}")

@app.put("/prompts/{prompt_id}/drafts/{draft_id}")
def update_draft(prompt_id: str, draft_id: str, req: PromptUpdateRequest):
    try:
        # Load existing prompts
        try:
            with open("prompts.json", "r") as f:
                data = json.load(f)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="Prompt not found")
        
        # Handle both old format (list) and new format (dict with prompts key)
        if isinstance(data, list):
            prompts = data
        elif isinstance(data, dict) and "prompts" in data:
            prompts = data["prompts"]
        else:
            prompts = []
        
        # Find prompt and update draft
        draft_found = False
        for prompt in prompts:
            if prompt["id"] == prompt_id:
                for draft in prompt["drafts"]:
                    if draft["id"] == draft_id:
                        draft["backed_up"] = req.backed_up
                        draft["note_name"] = req.note_name
                        draft_found = True
                        break
                if draft_found:
                    break
        
        if not draft_found:
            raise HTTPException(status_code=404, detail="Draft not found")
        
        # Save back to file - maintain the same format
        if isinstance(data, list):
            # Save as list directly
            with open("prompts.json", "w") as f:
                json.dump(prompts, f, indent=2)
        else:
            # Save with prompts key
            data["prompts"] = prompts
            with open("prompts.json", "w") as f:
                json.dump(data, f, indent=2)
        
        return {"message": "Draft updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/prompts/{prompt_id}/drafts/{draft_id}")
def delete_draft(prompt_id: str, draft_id: str):
    try:
        # Load existing prompts
        try:
            with open("prompts.json", "r") as f:
                data = json.load(f)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="Prompt not found")
        
        # Handle both old format (list) and new format (dict with prompts key)
        if isinstance(data, list):
            prompts = data
        elif isinstance(data, dict) and "prompts" in data:
            prompts = data["prompts"]
        else:
            prompts = []
        
        # Find prompt and remove draft
        draft_found = False
        for prompt in prompts:
            if prompt["id"] == prompt_id:
                original_length = len(prompt["drafts"])
                prompt["drafts"] = [d for d in prompt["drafts"] if d["id"] != draft_id]
                if len(prompt["drafts"]) < original_length:
                    draft_found = True
                break
        
        if not draft_found:
            raise HTTPException(status_code=404, detail="Draft not found")
        
        # Save back to file - maintain the same format
        if isinstance(data, list):
            # Save as list directly
            with open("prompts.json", "w") as f:
                json.dump(prompts, f, indent=2)
        else:
            # Save with prompts key
            data["prompts"] = prompts
            with open("prompts.json", "w") as f:
                json.dump(data, f, indent=2)
        
        return {"message": "Draft deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Idea Boards Management ---
IDEA_BOARDS_FILE = "idea_boards.json"

def load_idea_boards():
    try:
        if os.path.exists(IDEA_BOARDS_FILE):
            with open(IDEA_BOARDS_FILE, 'r') as f:
                return json.load(f)
        return []
    except Exception as e:
        print(f"Error loading idea boards: {e}")
        return []

def save_idea_boards(boards):
    try:
        with open(IDEA_BOARDS_FILE, 'w') as f:
            json.dump(boards, f, indent=2)
    except Exception as e:
        print(f"Error saving idea boards: {e}")
        raise HTTPException(status_code=500, detail=f"Error saving idea boards: {e}")

@app.get("/idea_boards")
def get_idea_boards():
    return {"boards": load_idea_boards()}

@app.post("/idea_boards")
def create_idea_board(req: IdeaBoardRequest):
    boards = load_idea_boards()
    new_board = {
        "id": str(uuid.uuid4()),
        "name": req.name,
        "description": req.description,
        "nodes": [],
        "edges": [],
        "created": datetime.now().timestamp(),
        "modified": datetime.now().timestamp()
    }
    boards.append(new_board)
    save_idea_boards(boards)
    return {"board": new_board}

@app.put("/idea_boards/{board_id}")
def update_idea_board(board_id: str, req: IdeaBoardUpdateRequest):
    boards = load_idea_boards()
    for i, board in enumerate(boards):
        if board["id"] == board_id:
            boards[i] = {
                "id": board_id,
                "name": req.name,
                "description": req.description,
                "nodes": req.nodes,
                "edges": req.edges,
                "created": req.created,
                "modified": req.modified
            }
            save_idea_boards(boards)
            return {"board": boards[i]}
    raise HTTPException(status_code=404, detail="Board not found")

@app.delete("/idea_boards/{board_id}")
def delete_idea_board(board_id: str):
    boards = load_idea_boards()
    boards = [board for board in boards if board["id"] != board_id]
    save_idea_boards(boards)
    return {"status": "board deleted"}

# Folder management
@app.get("/folders")
def get_folders():
    try:
        with open("folders.json", "r") as f:
            data = json.load(f)
        return {"folders": data.get("folders", [])}
    except FileNotFoundError:
        return {"folders": []}

@app.post("/folders")
def create_folder(folder: dict):
    try:
        # Load existing folders
        try:
            with open("folders.json", "r") as f:
                data = json.load(f)
        except FileNotFoundError:
            data = {"folders": []}
        
        # Create new folder with ID
        new_folder = {
            "id": str(uuid.uuid4()),
            "name": folder["name"],
            "color": folder["color"]
        }
        
        data["folders"].append(new_folder)
        
        # Save back to file
        with open("folders.json", "w") as f:
            json.dump(data, f, indent=2)
        
        return {"message": "Folder created successfully", "folder": new_folder}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/folders/{folder_id}")
def delete_folder(folder_id: str):
    try:
        # Load existing folders
        try:
            with open("folders.json", "r") as f:
                data = json.load(f)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="Folder not found")
        
        # Find and remove folder
        folders = data.get("folders", [])
        folder_to_delete = None
        for folder in folders:
            if folder["id"] == folder_id:
                folder_to_delete = folder
                break
        
        if not folder_to_delete:
            raise HTTPException(status_code=404, detail="Folder not found")
        
        folders.remove(folder_to_delete)
        data["folders"] = folders
        
        # Save back to file
        with open("folders.json", "w") as f:
            json.dump(data, f, indent=2)
        
        return {"message": "Folder deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Helper functions ---
def create_obsidian_note(note_type, content, custom_note_name=""):
    # Use Local REST API (PUT /vault/{note_name}) to create a new note
    if custom_note_name:
        # Use the custom note name with prefix
        note_name = f"UndergraduateAdmission/{note_type.title()} - {custom_note_name}.md"
    else:
        # Fallback to auto-generated name
        note_name = f"UndergraduateAdmission/{note_type.title()} - {content[:30].replace(' ', '_')}.md"
    url = f"{OBSIDIAN_HOST}/vault/{note_name}"
    headers = {
        "Authorization": f"Bearer {OBSIDIAN_API_KEY}",
        "Content-Type": "text/markdown",
        "accept": "*/*"
    }
    try:
        resp = requests.put(url, data=content, headers=headers, verify=False)
        if not resp.ok:
            print(f"Obsidian Local REST API error (create_obsidian_note): {resp.text}")
            raise Exception(f"Obsidian Local REST API error: {resp.text}")
        return note_name
    except Exception as e:
        print(f"Exception in create_obsidian_note: {e}")
        raise HTTPException(status_code=500, detail=f"Obsidian Local REST API error: {e}")

def list_obsidian_notes():
    # Use Local REST API (GET /vault/) to list files in vault
    url = f"{OBSIDIAN_HOST}/vault/UndergraduateAdmission/"
    headers = {
        "Authorization": f"Bearer {OBSIDIAN_API_KEY}",
        "accept": "application/json"
    }
    try:
        resp = requests.get(url, headers=headers, verify=False)
        if not resp.ok:
            raise Exception(f"Obsidian Local REST API error: {resp.text}")
        
        all_files = resp.json().get("files", [])
        # Filter to only include files in the "UndergraduateAdmission" directory
        undergraduate_files = all_files
        # Remove the "UndergraduateAdmission/" prefix from file names
        root_files = [file.replace("UndergraduateAdmission/", "") for file in undergraduate_files]

        return root_files
    except Exception as e:
        print(e)
        return []

def get_note_content(note_name):
    # Fetch the content of a note from Obsidian
    # Add "UndergraduateAdmission/" prefix if not already present
    if not note_name.startswith("UndergraduateAdmission/"):
        note_name = f"UndergraduateAdmission/{note_name}"
    
    url = f"{OBSIDIAN_HOST}/vault/{note_name}"
    headers = {
        "Authorization": f"Bearer {OBSIDIAN_API_KEY}",
        "accept": "text/markdown"
    }
    try:
        resp = requests.get(url, headers=headers, verify=False)
        if not resp.ok:
            print(f"Obsidian Local REST API error (get_note_content) for {note_name}:", resp.text)
            return ""
        return resp.text
    except Exception as e:
        print(f"Exception in get_note_content for {note_name}:", e)
        return ""

def summarize_note_with_ollama(note_content):
    # Use Ollama's Llama2 model to summarize note content
    prompt = f"Summarize the following note in 3-4 sentences:\n\n{note_content}"
    try:
        response = ollama.generate(model='llama3.2:latest', prompt=prompt)
        return response['response'].strip()
    except Exception as e:
        print("Ollama summarization error:", e)
        return note_content[:200]  # fallback: truncate

def suggest_connections(content, existing_notes, new_note_name=None):
    # Filter to only include notes with "Idea" or "Piece" in the name
    filtered_notes = [note for note in existing_notes if "Idea" in note or "Piece" in note]
    # Fetch and summarize each note, skipping the new note itself
    summarized_notes = {}
    for note_name in filtered_notes:
        if new_note_name and note_name == new_note_name:
            continue
        note_content = get_note_content(note_name)
        summary = summarize_note_with_ollama(note_content)
        summarized_notes[note_name] = summary
    # Use OpenAI to suggest relevant note names
    response = client.responses.parse(
        model="gpt-4o-2024-08-06",
        input=[
            {"role": "system", "content": "Take the following note summaries and select relevant note names for thematic and otherwise relevant connections across ideas, give a short reason why. Be selective, these connections are meant to be helpful in writing essays. Not eveything connects to everything else. Return full note names."},
            {"role": "user", "content": f"Notes: {str(summarized_notes)}"},
            {"role": "user", "content": "Content: " + content},
        ],
        text_format=SelectedConnections,
    )
    notes = response.output_parsed
    print(content, notes)
    return notes

def add_connection(note_name, connection, reason):
    # Fetch current note content
    # Add "UndergraduateAdmission/" prefix if not already present
    if not note_name.startswith("UndergraduateAdmission/"):
        note_name = f"UndergraduateAdmission/{note_name}"
    
    current_content = get_note_content(note_name)
    # Append the connection with reason
    appended_content = f"\n[[{connection}]] — {reason}"
    new_content = current_content + appended_content
    # Update the note using PUT
    url = f"{OBSIDIAN_HOST}/vault/{note_name}"
    headers = {
        "Authorization": f"Bearer {OBSIDIAN_API_KEY}",
        "Content-Type": "text/markdown",
        "accept": "*/*"
    }
    try:
        resp = requests.put(url, data=new_content, headers=headers, verify=False)
        if not resp.ok:
            print("Obsidian Local REST API error (add_connection):", resp.text)
            raise Exception(f"Obsidian Local REST API error: {resp.text}")
    except Exception as e:
        print("Exception in add_connection:", e)
        raise HTTPException(status_code=500, detail=f"Obsidian Local REST API error: {e}")

@app.get("/all_notes")
def all_notes():
    try:
        existing_notes = list_obsidian_notes()
        # Filter to only include notes with "Idea" or "Piece" in the name
        filtered_notes = [note for note in existing_notes if "Idea" in note or "Piece" in note]
        results = []
        
        for note in filtered_notes:
            content = get_note_content(note)
            note_type = "idea" if note.startswith("Idea -") else "piece"
            
            # Metadata - use the full path with UndergraduateAdmission prefix
            full_note_path = f"UndergraduateAdmission/{note}"
            file_path = os.path.join(os.getenv("OBSIDIAN_VAULT_PATH", "."), full_note_path)
            try:
                stat = os.stat(file_path)
                created = stat.st_ctime
                modified = stat.st_mtime
            except Exception:
                created = 0.0
                modified = 0.0
            
            word_count = len(content.split())
            
            # Count connections
            outgoing = content.count('[[')
            incoming = 0
            note_name_without_ext = note.replace(".md", "")
            note_name_without_prefix = note_name_without_ext.replace("Idea - ", "").replace("Piece - ", "")
            
            for other_note in filtered_notes:
                if other_note != note:
                    other_content = get_note_content(other_note)
                    incoming += other_content.count(f'[[{note_name_without_ext}]]')
                    incoming += other_content.count(f'[[{note_name_without_prefix}]]')
            
            num_connections = outgoing + incoming
            
            results.append({
                "name": note.replace("Idea - ", "").replace("Piece - ", "").replace(".md", ""),
                "type": note_type,
                "content": content,
                "created": created,
                "modified": modified,
                "word_count": word_count,
                "num_connections": num_connections,
                "external": is_external_note(content)
            })
        
        return {"notes": results}
    except Exception as e:
        print("Error in all_notes:", e)
        raise HTTPException(status_code=500, detail=f"Error fetching notes: {e}")

@app.get("/note_content/{note_name}")
def get_note_content_by_name(note_name: str):
    try:
        # Try to find the note with different prefixes in the UndergraduateAdmission directory
        for prefix in ["Idea - ", "Piece - "]:
            file_name = f"UndergraduateAdmission/{prefix}{note_name}.md"
            content = get_note_content(file_name)
            if content:  # If content is not empty, we found the note
                return {"content": content}
        
        raise HTTPException(status_code=404, detail="Note not found")
    except Exception as e:
        print("Error getting note content:", e)
        raise HTTPException(status_code=500, detail=f"Error getting note content: {e}")

def is_external_note(content):
    return content.splitlines()[0].strip() == "#extern" if content else False