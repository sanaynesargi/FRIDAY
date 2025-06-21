import React, { useState, useEffect, useRef } from 'react';
import {
  Container,
  Typography,
  Box,
  TextField,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
  Chip,
  Stack,
  Snackbar,
  Alert,
  Paper,
  Card,
  CardContent,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Checkbox,
  FormControlLabel,
  AppBar,
  Toolbar,
  Tab,
  Tabs
} from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import AccountTreeIcon from '@mui/icons-material/AccountTree';

import IdeaBoards from './IdeaBoards';

const BACKEND_URL = 'http://localhost:8000'; // Change if backend runs elsewhere

function App() {
  const [currentPage, setCurrentPage] = useState<'main' | 'idea-boards'>('main');
  const [type, setType] = useState<'idea' | 'piece'>('idea');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [noteName, setNoteName] = useState('');
  const [connectLoading, setConnectLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    totalNotes: 0,
    ideas: 0,
    pieces: 0,
    connections: 0,
    topIdea: [] as Array<{name: string, connections: number}>,
    topPiece: [] as Array<{name: string, connections: number}>,
    externalPieces: 0
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'text' | 'prompt'>('text');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [prompts, setPrompts] = useState<any[]>([]);
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<any>(null);
  const [newPrompt, setNewPrompt] = useState({ title: '', prompt: '', essay_link: '' });
  const [draftDialogOpen, setDraftDialogOpen] = useState(false);
  const [selectedPromptId, setSelectedPromptId] = useState('');
  const [newDraft, setNewDraft] = useState({ title: '', link: '' });
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [vaultPath, setVaultPath] = useState<string>(() => localStorage.getItem('obsidianVaultPath') || '');
  const [vaultDialogOpen, setVaultDialogOpen] = useState(false);
  const [vaultInput, setVaultInput] = useState('');
  const [pendingNotePath, setPendingNotePath] = useState<string | null>(null);
  const [selectedNotes, setSelectedNotes] = useState<string[]>([]);
  const [batchTagDialogOpen, setBatchTagDialogOpen] = useState(false);
  const [batchTags, setBatchTags] = useState('');
  const [noteViewerOpen, setNoteViewerOpen] = useState(false);
  const [viewedNote, setViewedNote] = useState<any>(null);
  const [allNotesDialogOpen, setAllNotesDialogOpen] = useState(false);
  const [allNotes, setAllNotes] = useState<any[]>([]);
  const [allNotesLoading, setAllNotesLoading] = useState(false);
  const [selectedAllNotes, setSelectedAllNotes] = useState<string[]>([]);
  const [batchTagAllDialogOpen, setBatchTagAllDialogOpen] = useState(false);
  const [batchTagsAll, setBatchTagsAll] = useState('');
  const [external, setExternal] = useState(false);
  const [searchTags, setSearchTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const handleType = (_: any, newType: 'idea' | 'piece' | null) => {
    if (newType) setType(newType);
  };

  const hasInvalidChars = (name: string) => {
    return name.includes('|') || name.includes('/');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuggestions([]);
    setSelected([]);
    setNoteName('');
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${BACKEND_URL}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, content, note_name: noteName, external })
      });
      if (!res.ok) throw new Error('Submission failed');
      const data = await res.json();
      setSuggestions(data.suggestions || []);
      setNoteName(data.note_name || '');
      setSuccess('Note submitted successfully!');
      setContent('');
      setNoteName('');
      fetchStats(); // Refresh stats after successful submission
    } catch (err: any) {
      setError(err.message || 'Error submitting');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnectLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${BACKEND_URL}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_note: noteName, connections: selected })
      });
      if (!res.ok) throw new Error('Connection failed');
      setSuccess('Connections added!');
      setSuggestions([]);
      setSelected([]);
      setNoteName('');
      setContent('');
      fetchStats(); // Refresh stats after successful connection
    } catch (err: any) {
      setError(err.message || 'Error connecting');
    } finally {
      setConnectLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  // Fetch stats on component mount
  useEffect(() => {
    fetchStats();
    fetchPrompts();
  }, []);

  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: any) => {
      let transcript = event.results[0][0].transcript;
      
      // Remove "FRIDAY" or "Friday" from the query (case insensitive)
      transcript = transcript.replace(/\b(?:FRIDAY|Friday|friday)\b/gi, '').trim();
      
      setSearchQuery(transcript);
      setIsListening(false);
      
      // Auto-submit the search if there's content after removing FRIDAY
      if (transcript.trim()) {
        setTimeout(() => handleSearch(), 100); // Small delay to ensure state is updated
      }
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
  }, []);

  const handleMicClick = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() && searchTags.length === 0) return;
    
    setSearchLoading(true);
    setSearchResults([]); // Clear previous results at the start of new search
    try {
      let results: any[] = [];
      
      // Perform regular search if query is provided
      if (searchQuery.trim()) {
        const res = await fetch(`${BACKEND_URL}/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: searchQuery, mode: searchMode })
        });
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        results = data.results || [];
      }
      
      // Perform tag search if tags are provided
      if (searchTags.length > 0) {
        const tagRes = await fetch(`${BACKEND_URL}/search_by_tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tags: searchTags })
        });
        if (!tagRes.ok) throw new Error('Tag search failed');
        const tagData = await tagRes.json();
        const tagResults = tagData.results || [];
        
        // Merge results, avoiding duplicates
        const existingNames = new Set(results.map(r => r.name));
        for (const tagResult of tagResults) {
          if (!existingNames.has(tagResult.name)) {
            results.push(tagResult);
            existingNames.add(tagResult.name);
          }
        }
      }
      
      setSearchResults(results);
    } catch (err: any) {
      setError(err.message || 'Error searching');
    } finally {
      setSearchLoading(false);
      // Clear tags after search to reset interface
      setSearchTags([]);
    }
  };

  const fetchPrompts = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/prompts`);
      if (res.ok) {
        const data = await res.json();
        setPrompts(data.prompts || []);
      }
    } catch (err) {
      console.error('Failed to fetch prompts:', err);
    }
  };

  const createPrompt = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/prompts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPrompt)
      });
      if (res.ok) {
        setPromptDialogOpen(false);
        setNewPrompt({ title: '', prompt: '', essay_link: '' });
        fetchPrompts();
        setSuccess('Prompt created successfully!');
      }
    } catch (err: any) {
      setError(err.message || 'Error creating prompt');
    }
  };

  const updatePromptBackup = async (promptId: string, backedUp: boolean, noteName: string = '') => {
    try {
      const res = await fetch(`${BACKEND_URL}/prompts/${promptId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: promptId, backed_up: backedUp, note_name: noteName })
      });
      if (res.ok) {
        fetchPrompts();
        setSuccess('Prompt updated successfully!');
      }
    } catch (err: any) {
      setError(err.message || 'Error updating prompt');
    }
  };

  const deletePrompt = async (promptId: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/prompts/${promptId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchPrompts();
        setSuccess('Prompt deleted successfully!');
      }
    } catch (err: any) {
      setError(err.message || 'Error deleting prompt');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccess('Copied to clipboard!');
  };

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => {
      if (regex.test(part)) {
        return (
          <span key={index} style={{ backgroundColor: '#ffeb3b', fontWeight: 'bold' }}>
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const createDraft = async () => {
    try {
      console.log('Creating draft with data:', newDraft);
      const res = await fetch(`${BACKEND_URL}/prompts/${selectedPromptId}/drafts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDraft)
      });
      if (res.ok) {
        setDraftDialogOpen(false);
        setNewDraft({ title: '', link: '' });
        fetchPrompts();
        setSuccess('Draft created successfully!');
      } else {
        const errorData = await res.text();
        console.error('Draft creation failed:', res.status, errorData);
        setError(`Failed to create draft: ${res.status} - ${errorData}`);
      }
    } catch (err: any) {
      console.error('Draft creation error:', err);
      setError(err.message || 'Error creating draft');
    }
  };

  const updateDraftBackup = async (promptId: string, draftId: string, backedUp: boolean, noteName: string = '') => {
    try {
      const res = await fetch(`${BACKEND_URL}/prompts/${promptId}/drafts/${draftId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: draftId, backed_up: backedUp, note_name: noteName })
      });
      if (res.ok) {
        fetchPrompts();
        setSuccess('Draft updated successfully!');
      }
    } catch (err: any) {
      setError(err.message || 'Error updating draft');
    }
  };

  const deleteDraft = async (promptId: string, draftId: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/prompts/${promptId}/drafts/${draftId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchPrompts();
        setSuccess('Draft deleted successfully!');
      }
    } catch (err: any) {
      setError(err.message || 'Error deleting draft');
    }
  };

  // Function to handle opening in Obsidian
  const handleOpenInObsidian = (noteName: string, noteType: string) => {
    const prefix = noteType === 'idea' ? 'Idea - ' : 'Piece - ';
    const fileName = `${prefix}${noteName}.md`;
    if (!vaultPath) {
      setPendingNotePath(fileName);
      setVaultDialogOpen(true);
      return;
    }
    const fullPath = `${vaultPath}/${fileName}`;
    window.location.href = `obsidian://open?path=${encodeURIComponent(fullPath)}`;
  };

  // Save vault path from dialog
  const handleSaveVaultPath = () => {
    setVaultPath(vaultInput);
    localStorage.setItem('obsidianVaultPath', vaultInput);
    setVaultDialogOpen(false);
    if (pendingNotePath) {
      const fullPath = `${vaultInput}/${pendingNotePath}`;
      window.location.href = `obsidian://open?path=${encodeURIComponent(fullPath)}`;
      setPendingNotePath(null);
    }
  };

  // Batch tag handler
  const handleBatchTag = async () => {
    const tags = batchTags.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean);
    console.log("here")
    if (!tags.length) return;
    try {
      const res = await fetch(`${BACKEND_URL}/batch_tag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_names: selectedNotes, tags })
      });
      if (res.ok) {
        setBatchTagDialogOpen(false);
        setBatchTags('');
        setSelectedNotes([]);
        setSuccess('Tags added!');
        handleSearch(); // Refresh results
      } else {
        setError('Failed to add tags');
      }
    } catch (err) {
      setError('Failed to add tags');
    }
  };

  // Note viewer handler
  const handleViewNote = async (note: any) => {
    try {
      const prefix = note.type === 'idea' ? 'Idea - ' : 'Piece - ';
      const fileName = `${prefix}${note.name}.md`;
      const res = await fetch(`${BACKEND_URL}/note_content?file_name=${encodeURIComponent(fileName)}`);
      if (res.ok) {
        const content = await res.text();
        setViewedNote({ ...note, content });
        setNoteViewerOpen(true);
      } else {
        setError('Failed to load note');
      }
    } catch (err) {
      setError('Failed to load note');
    }
  };

  const fetchAllNotes = async () => {
    setAllNotesLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/all_notes`);
      if (res.ok) {
        const data = await res.json();
        setAllNotes(data.results || []);
      }
    } catch (err) {
      setError('Failed to fetch all notes');
    } finally {
      setAllNotesLoading(false);
    }
  };

  const handleBatchTagAll = async () => {
    const tags = batchTagsAll.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean);
    if (!tags.length) {
      return;
    };
    try {
      const res = await fetch(`${BACKEND_URL}/batch_tag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_names: selectedAllNotes, tags })
      });
      if (res.ok) {
        console.log(await res.json())
        setBatchTagAllDialogOpen(false);
        setBatchTagsAll('');
        setSelectedAllNotes([]);
        setSuccess('Tags added!');
        fetchAllNotes();
      } else {
        setError('Failed to add tags');
      }
    } catch (err) {
      setError('Failed to add tags');
    }
  };

  return (
    <>
      {/* Navigation Bar */}
      <AppBar position="static" sx={{ 
        background: 'rgba(30, 30, 50, 0.95)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(102, 126, 234, 0.3)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
      }}>
        <Toolbar>
          <Typography variant="h6" sx={{ 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontWeight: 700,
            mr: 4
          }}>
            FRIDAY
          </Typography>
          <Tabs 
            value={currentPage} 
            onChange={(_, newValue) => setCurrentPage(newValue)}
            sx={{
              '& .MuiTab-root': {
                color: '#b0b0b0',
                fontWeight: 600,
                textTransform: 'none',
                '&.Mui-selected': {
                  color: '#667eea'
                }
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#667eea'
              }
            }}
          >
            <Tab 
              value="main" 
              label="Main" 
              icon={<SearchIcon />}
              iconPosition="start"
            />
            <Tab 
              value="idea-boards" 
              label="Idea Boards" 
              icon={<AccountTreeIcon />}
              iconPosition="start"
            />
          </Tabs>
        </Toolbar>
      </AppBar>

      {/* Conditional Rendering */}
      {currentPage === 'idea-boards' ? (
        <IdeaBoards />
      ) : (
        <Container maxWidth="xl" sx={{ py: 4, minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
          <Box sx={{ display: 'flex', gap: 4, flexDirection: { xs: 'column', md: 'row' } }}>
            <Box sx={{ flex: 1 }}>
              <Paper elevation={8} sx={{ 
                p: 4, 
                borderRadius: 3,
                background: 'rgba(30, 30, 50, 0.95)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(102, 126, 234, 0.3)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
              }}>
                <Typography variant="h3" gutterBottom fontWeight={800} align="center" sx={{ 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  mb: 3,
                  textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                }}>
                  FRIDAY Idea Base
                </Typography>
                <Typography variant="h6" align="center" gutterBottom sx={{ 
                  color: '#e0e0e0',
                  mb: 4,
                  fontWeight: 300
                }}>
                  Integrated with Obsidian.
                </Typography>
                <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
                  <ToggleButtonGroup
                    value={type}
                    exclusive
                    onChange={handleType}
                    sx={{ 
                      mb: 3,
                      '& .MuiToggleButton-root': {
                        borderRadius: 2,
                        fontWeight: 600,
                        textTransform: 'none',
                        px: 3,
                        py: 1.5,
                        background: 'rgba(60, 60, 80, 0.8)',
                        color: '#e0e0e0',
                        border: '1px solid rgba(102, 126, 234, 0.3)',
                        '&:hover': {
                          background: 'rgba(80, 80, 100, 0.9)',
                          color: '#ffffff'
                        },
                        '&.Mui-selected': {
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: 'white',
                          '&:hover': {
                            background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)'
                          }
                        }
                      }
                    }}
                    fullWidth
                  >
                    <ToggleButton value="idea">Idea</ToggleButton>
                    <ToggleButton value="piece">Piece</ToggleButton>
                  </ToggleButtonGroup>
                  <TextField
                    label="Note Name"
                    value={noteName}
                    onChange={e => setNoteName(e.target.value)}
                    multiline
                    minRows={6}
                    fullWidth
                    sx={{ 
                      mb: 3,
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        background: 'rgba(40, 40, 60, 0.8)',
                        color: '#ffffff',
                        '& fieldset': {
                          borderColor: 'rgba(102, 126, 234, 0.3)'
                        },
                        '&:hover fieldset': {
                          borderColor: '#667eea'
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#667eea',
                          borderWidth: 2
                        }
                      },
                      '& .MuiInputLabel-root': {
                        color: '#b0b0b0'
                      },
                      '& .MuiInputLabel-root.Mui-focused': {
                        color: '#667eea'
                      },
                      '& .MuiFormHelperText-root': {
                        color: '#ff6b6b'
                      }
                    }}
                    placeholder="Enter the name for your new note"
                    helperText={hasInvalidChars(noteName) ? "Note name cannot contain '|' or '/' characters" : ""}
                    error={hasInvalidChars(noteName)}
                  />
                  <TextField
                    label={type === 'idea' ? 'Your Idea' : 'Your Essay'}
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    multiline
                    minRows={4}
                    fullWidth
                    required
                    sx={{ 
                      mb: 3,
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        background: 'rgba(40, 40, 60, 0.8)',
                        color: '#ffffff',
                        '& fieldset': {
                          borderColor: 'rgba(102, 126, 234, 0.3)'
                        },
                        '&:hover fieldset': {
                          borderColor: '#667eea'
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#667eea',
                          borderWidth: 2
                        }
                      },
                      '& .MuiInputLabel-root': {
                        color: '#b0b0b0'
                      },
                      '& .MuiInputLabel-root.Mui-focused': {
                        color: '#667eea'
                      }
                    }}
                  />
                  {type === 'piece' && (
                    <FormControlLabel
                      control={<Checkbox checked={external} onChange={e => setExternal(e.target.checked)} />}
                      label={<span style={{ color: '#b0b0b0' }}>External Piece</span>}
                      sx={{ mb: 2 }}
                    />
                  )}
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    fullWidth
                    disabled={loading || !content.trim() || hasInvalidChars(noteName)}
                    size="large"
                    sx={{
                      borderRadius: 2,
                      py: 1.5,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      textTransform: 'none',
                      fontWeight: 600,
                      fontSize: '1.1rem',
                      color: '#ffffff',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                        transform: 'translateY(-1px)',
                        boxShadow: '0 8px 25px rgba(102, 126, 234, 0.4)'
                      },
                      '&:disabled': {
                        background: 'rgba(80, 80, 100, 0.5)',
                        color: '#666666',
                        transform: 'none',
                        boxShadow: 'none'
                      }
                    }}
                  >
                    {loading ? <CircularProgress size={24} color="inherit" /> : 'Submit'}
                  </Button>
                </Box>
                {suggestions.length > 0 && (
                  <Box sx={{ mt: 4, p: 3, borderRadius: 2, background: 'rgba(102, 126, 234, 0.1)', border: '1px solid rgba(102, 126, 234, 0.3)' }}>
                    <Typography variant="h6" gutterBottom fontWeight={600} sx={{ color: '#667eea', mb: 2 }}>
                      AI-Suggested Connections
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 3 }}>
                      {suggestions.map(s => (
                        <Chip
                          key={s}
                          label={s}
                          icon={<LinkIcon />}
                          color={selected.includes(s) ? 'primary' : 'default'}
                          onClick={() =>
                            setSelected(sel =>
                              sel.includes(s)
                                ? sel.filter(x => x !== s)
                                : [...sel, s]
                            )
                          }
                          sx={{ 
                            mb: 1,
                            borderRadius: 2,
                            fontWeight: 500,
                            background: selected.includes(s) ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'rgba(60, 60, 80, 0.8)',
                            color: selected.includes(s) ? '#ffffff' : '#e0e0e0',
                            border: '1px solid rgba(102, 126, 234, 0.3)',
                            '&.MuiChip-clickable:hover': {
                              transform: 'translateY(-1px)',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                              background: selected.includes(s) ? 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)' : 'rgba(80, 80, 100, 0.9)'
                            }
                          }}
                        />
                      ))}
                    </Stack>
                    <Button
                      variant="contained"
                      color="secondary"
                      disabled={connectLoading || selected.length === 0}
                      onClick={handleConnect}
                      fullWidth
                      sx={{
                        borderRadius: 2,
                        py: 1.5,
                        background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
                        textTransform: 'none',
                        fontWeight: 600,
                        color: '#ffffff',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #ff5252 0%, #e64a19 100%)',
                          transform: 'translateY(-1px)',
                          boxShadow: '0 8px 25px rgba(255, 107, 107, 0.4)'
                        },
                        '&:disabled': {
                          background: 'rgba(80, 80, 100, 0.5)',
                          color: '#666666',
                          transform: 'none',
                          boxShadow: 'none'
                        }
                      }}
                    >
                      {connectLoading ? <CircularProgress size={24} color="inherit" /> : 'Approve Connections'}
                    </Button>
                  </Box>
                )}
              </Paper>
            </Box>
            
            {/* Search Panel */}
            <Box sx={{ width: { xs: '100%', md: 350 } }}>
              <Card elevation={8} sx={{ 
                borderRadius: 3,
                background: 'rgba(30, 30, 50, 0.95)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(102, 126, 234, 0.3)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
              }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h5" gutterBottom fontWeight={700} sx={{ 
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    mb: 3
                  }}>
                    Search Notes
                  </Typography>
                  
                  <Button
                    variant="outlined"
                    sx={{ mb: 2, borderRadius: 2, fontWeight: 600, background: 'rgba(30,30,50,0.8)', color: '#fff', borderColor: '#667eea' }}
                    onClick={() => {
                      setAllNotesDialogOpen(true);
                      fetchAllNotes();
                    }}
                  >
                    View All Notes
                  </Button>
                  
                  <ToggleButtonGroup
                    value={searchMode}
                    exclusive
                    onChange={(_, newMode) => {
                      if (newMode !== null) {
                        setSearchMode(newMode);
                        setSearchResults([]); // Clear results when switching modes
                        setSearchTags([]); // Clear tags when switching modes
                      }
                    }}
                    sx={{ 
                      mb: 3,
                      '& .MuiToggleButton-root': {
                        borderRadius: 2,
                        fontWeight: 600,
                        textTransform: 'none',
                        px: 2,
                        py: 1,
                        fontSize: '0.875rem',
                        background: 'rgba(60, 60, 80, 0.8)',
                        color: '#e0e0e0',
                        border: '1px solid rgba(102, 126, 234, 0.3)',
                        '&:hover': {
                          background: 'rgba(80, 80, 100, 0.9)',
                          color: '#ffffff'
                        },
                        '&.Mui-selected': {
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: 'white'
                        }
                      }
                    }}
                    fullWidth
                    size="small"
                  >
                    <ToggleButton value="text">Text Search</ToggleButton>
                    <ToggleButton value="prompt">Prompt Search</ToggleButton>
                  </ToggleButtonGroup>
                  
                  <TextField
                    label="Search query"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    fullWidth
                    sx={{ 
                      mb: 3,
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        background: 'rgba(40, 40, 60, 0.8)',
                        color: '#ffffff',
                        '& fieldset': {
                          borderColor: 'rgba(102, 126, 234, 0.3)'
                        },
                        '&:hover fieldset': {
                          borderColor: '#667eea'
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#667eea',
                          borderWidth: 2
                        }
                      },
                      '& .MuiInputLabel-root': {
                        color: '#b0b0b0'
                      },
                      '& .MuiInputLabel-root.Mui-focused': {
                        color: '#667eea'
                      }
                    }}
                    placeholder={searchMode === 'text' ? "Search for specific text..." : "Describe what you're looking for..."}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <Button
                            onClick={handleSearch}
                            disabled={searchLoading || (!searchQuery.trim() && searchTags.length === 0)}
                            sx={{ 
                              minWidth: 'auto',
                              borderRadius: 2,
                              background: searchLoading || (!searchQuery.trim() && searchTags.length === 0) ? 'rgba(80, 80, 100, 0.5)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              color: 'white',
                              '&:hover': {
                                background: searchLoading || (!searchQuery.trim() && searchTags.length === 0) ? 'rgba(80, 80, 100, 0.5)' : 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)'
                              }
                            }}
                          >
                            {searchLoading ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
                          </Button>
                          <IconButton
                            onClick={handleMicClick}
                            sx={{
                              ml: 1,
                              color: isListening ? '#ff5252' : '#b0b0b0',
                              background: isListening ? 'rgba(255,82,82,0.1)' : 'transparent',
                              borderRadius: 2,
                              border: isListening ? '1px solid #ff5252' : '1px solid rgba(102, 126, 234, 0.3)',
                              transition: 'all 0.2s',
                            }}
                            aria-label={isListening ? 'Stop listening' : 'Start voice input'}
                          >
                            {isListening ? <MicOffIcon /> : <MicIcon />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  
                  {/* Tag Input Section for Prompt Search */}
                  {searchMode === 'prompt' && (
                    <Box sx={{ mb: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <TextField
                          label="Add tags"
                          value={tagInput}
                          onChange={e => setTagInput(e.target.value)}
                          size="small"
                          sx={{ 
                            flex: 1,
                            mr: 1,
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 2,
                              background: 'rgba(40, 40, 60, 0.8)',
                              color: '#ffffff',
                              '& fieldset': {
                                borderColor: 'rgba(102, 126, 234, 0.3)'
                              },
                              '&:hover fieldset': {
                                borderColor: '#667eea'
                              },
                              '&.Mui-focused fieldset': {
                                borderColor: '#667eea',
                                borderWidth: 2
                              }
                            },
                            '& .MuiInputLabel-root': {
                              color: '#b0b0b0'
                            },
                            '& .MuiInputLabel-root.Mui-focused': {
                              color: '#667eea'
                            }
                          }}
                          placeholder="Enter tag name..."
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && tagInput.trim()) {
                              const newTag = tagInput.trim().replace(/^#/, '');
                              if (newTag && !searchTags.includes(newTag)) {
                                setSearchTags([...searchTags, newTag]);
                                setTagInput('');
                              }
                            }
                          }}
                        />
                        <Button
                          onClick={() => {
                            if (tagInput.trim()) {
                              const newTag = tagInput.trim().replace(/^#/, '');
                              if (newTag && !searchTags.includes(newTag)) {
                                setSearchTags([...searchTags, newTag]);
                                setTagInput('');
                              }
                            }
                          }}
                          disabled={!tagInput.trim() || searchTags.includes(tagInput.trim().replace(/^#/, ''))}
                          sx={{
                            borderRadius: 2,
                            background: 'linear-gradient(135deg, #4caf50 0%, #66bb6a 100%)',
                            color: 'white',
                            '&:hover': {
                              background: 'linear-gradient(135deg, #43a047 0%, #5cb85c 100%)'
                            }
                          }}
                        >
                          <AddIcon />
                        </Button>
                      </Box>
                      
                      {searchTags.length > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {searchTags.map((tag, index) => (
                            <Chip
                              key={index}
                              label={`#${tag}`}
                              onDelete={() => setSearchTags(searchTags.filter((_, i) => i !== index))}
                              sx={{
                                background: 'rgba(102, 126, 234, 0.2)',
                                color: '#667eea',
                                border: '1px solid rgba(102, 126, 234, 0.3)',
                                '& .MuiChip-deleteIcon': {
                                  color: '#667eea',
                                  '&:hover': {
                                    color: '#ff5252'
                                  }
                                }
                              }}
                            />
                          ))}
                        </Box>
                      )}
                    </Box>
                  )}
                  
                  {searchResults.length > 0 && (
                    <Box sx={{ mt: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6" fontWeight={600} sx={{ color: '#667eea', flex: 1 }}>
                          Results ({searchResults.length})
                        </Typography>
                        {selectedNotes.length > 0 && (
                          <Button
                            variant="contained"
                            color="primary"
                            sx={{ ml: 2, borderRadius: 2, fontWeight: 600 }}
                            onClick={() => setBatchTagDialogOpen(true)}
                          >
                            Batch Tag
                          </Button>
                        )}
                      </Box>
                      <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: 'rgba(102,126,234,0.08)' }}>
                              <th></th>
                              <th style={{ color: '#b0b0b0', fontWeight: 600, textAlign: 'left' }}>Name</th>
                              <th style={{ color: '#b0b0b0', fontWeight: 600 }}>Type</th>
                            </tr>
                          </thead>
                          <tbody>
                            {searchResults.map((result, index) => (
                              <tr key={index} style={{ background: selectedNotes.includes(result.name) ? 'rgba(102,126,234,0.15)' : 'transparent' }}>
                                <td>
                                  <Checkbox
                                    checked={selectedNotes.includes(result.name)}
                                    onChange={e => {
                                      setSelectedNotes(sel =>
                                        e.target.checked
                                          ? [...sel, result.name]
                                          : sel.filter(n => n !== result.name)
                                      );
                                    }}
                                    size="small"
                                  />
                                </td>
                                <td style={{ fontWeight: 700, color: '#fff', textAlign: 'left' }}>
                                  <Button
                                    onClick={() => handleOpenInObsidian(result.name, result.type)}
                                    sx={{ 
                                      textTransform: 'none', 
                                      color: '#667eea', 
                                      fontWeight: 700, 
                                      p: 0, 
                                      minWidth: 'auto',
                                      textDecoration: 'underline',
                                      textAlign: 'left',
                                      justifyContent: 'flex-start',
                                      maxWidth: '200px',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      '&:hover': {
                                        background: 'transparent',
                                        color: '#8b9dc3'
                                      }
                                    }}
                                  >
                                    {result.name}
                                  </Button>
                                  {result.external && <Chip label="EXTERN" color="warning" size="small" sx={{ ml: 1 }} />}
                                  {searchMode === 'prompt' && result.reason && (
                                    <Typography 
                                      variant="caption" 
                                      sx={{ 
                                        display: 'block', 
                                        color: '#b0b0b0', 
                                        mt: 0.5, 
                                        fontStyle: 'italic',
                                        maxWidth: '300px',
                                        whiteSpace: 'normal',
                                        wordWrap: 'break-word'
                                      }}
                                    >
                                      {result.reason}
                                    </Typography>
                                  )}
                                </td>
                                <td>
                                  <Chip label={result.type} size="small" color={result.type === 'idea' ? 'success' : 'info'} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </Box>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Box>
            
            <Box sx={{ width: { xs: '100%', md: 300 } }}>
              <Card elevation={8} sx={{ 
                borderRadius: 3,
                background: 'rgba(30, 30, 50, 0.95)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(102, 126, 234, 0.3)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
              }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h5" fontWeight={700} sx={{ 
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent'
                    }}>
                      Prompts & Essays
                    </Typography>
                    <IconButton 
                      onClick={() => setPromptDialogOpen(true)}
                      color="primary"
                      size="small"
                      sx={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                          transform: 'scale(1.1)'
                        }
                      }}
                    >
                      <AddIcon />
                    </IconButton>
                  </Box>
                  
                  <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                    {prompts.length === 0 ? (
                      <Typography variant="body2" color="#b0b0b0" align="center" sx={{ py: 4, fontStyle: 'italic' }}>
                        No prompts yet. Click + to add one.
                      </Typography>
                    ) : (
                      prompts.map((prompt) => (
                        <Card key={prompt.id} sx={{ 
                          mb: 2,
                          borderRadius: 2,
                          background: 'rgba(40, 40, 60, 0.8)',
                          border: '1px solid rgba(102, 126, 234, 0.2)',
                          '&:hover': {
                            background: 'rgba(50, 50, 70, 0.9)',
                            transform: 'translateY(-2px)',
                            boxShadow: '0 8px 25px rgba(0,0,0,0.3)'
                          }
                        }}>
                          <CardContent sx={{ p: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                              <Typography variant="h6" fontWeight={600} sx={{ flex: 1, color: '#ffffff' }}>
                                {prompt.title}
                              </Typography>
                              <IconButton 
                                onClick={() => deletePrompt(prompt.id)}
                                size="small"
                                color="error"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Box>
                            
                            <Typography variant="body2" sx={{ mb: 1, color: '#e0e0e0' }}>
                              {prompt.prompt}
                            </Typography>
                            
                            {prompt.essay_link && (
                              <Box sx={{ mb: 1 }}>
                                <Typography variant="caption" color="#b0b0b0">
                                  Essay Link:
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="body2" sx={{ wordBreak: 'break-all', color: '#e0e0e0' }}>
                                    {prompt.essay_link}
                                  </Typography>
                                  <IconButton 
                                    size="small"
                                    onClick={() => copyToClipboard(prompt.essay_link)}
                                    sx={{ color: '#b0b0b0' }}
                                  >
                                    <ContentCopyIcon fontSize="small" />
                                  </IconButton>
                                </Box>
                              </Box>
                            )}
                            
                            {/* Drafts Section */}
                            <Box sx={{ mb: 1 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                <Typography variant="caption" color="#b0b0b0">
                                  Drafts ({prompt.drafts?.length || 0}):
                                </Typography>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => {
                                    setSelectedPromptId(prompt.id);
                                    setDraftDialogOpen(true);
                                  }}
                                  sx={{
                                    borderColor: 'rgba(102, 126, 234, 0.5)',
                                    color: '#e0e0e0',
                                    '&:hover': {
                                      borderColor: '#667eea',
                                      background: 'rgba(102, 126, 234, 0.1)'
                                    }
                                  }}
                                >
                                  Add Draft
                                </Button>
                              </Box>
                              
                              {prompt.drafts && prompt.drafts.length > 0 && (
                                <Box sx={{ ml: 1 }}>
                                  {prompt.drafts.map((draft: any) => (
                                    <Card key={draft.id} sx={{ mb: 1, p: 1, backgroundColor: 'rgba(20, 20, 40, 0.8)', border: '1px solid rgba(102, 126, 234, 0.1)' }}>
                                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <Box sx={{ flex: 1 }}>
                                          <Typography variant="body2" fontWeight={500} sx={{ color: '#ffffff' }}>
                                            {draft.title}
                                          </Typography>
                                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                            <Typography variant="caption" sx={{ wordBreak: 'break-all', color: '#e0e0e0' }}>
                                              {draft.link}
                                            </Typography>
                                            <IconButton 
                                              size="small"
                                              onClick={() => copyToClipboard(draft.link)}
                                              sx={{ color: '#b0b0b0' }}
                                            >
                                              <ContentCopyIcon fontSize="small" />
                                            </IconButton>
                                          </Box>
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                          <FormControlLabel
                                            control={
                                              <Checkbox
                                                checked={draft.backed_up}
                                                onChange={(e) => updateDraftBackup(prompt.id, draft.id, e.target.checked, draft.note_name)}
                                                size="small"
                                                sx={{
                                                  color: '#b0b0b0',
                                                  '&.Mui-checked': {
                                                    color: '#667eea'
                                                  }
                                                }}
                                              />
                                            }
                                            label=""
                                          />
                                          <IconButton 
                                            size="small"
                                            color="error"
                                            onClick={() => deleteDraft(prompt.id, draft.id)}
                                          >
                                            <DeleteIcon fontSize="small" />
                                          </IconButton>
                                        </Box>
                                      </Box>
                                      
                                      {draft.backed_up && draft.note_name && (
                                        <Typography variant="caption" color="#4caf50">
                                          ✓ Stored as: {draft.note_name}
                                        </Typography>
                                      )}
                                    </Card>
                                  ))}
                                </Box>
                              )}
                            </Box>
                            
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    checked={prompt.backed_up}
                                    onChange={(e) => updatePromptBackup(prompt.id, e.target.checked, prompt.note_name)}
                                    size="small"
                                    sx={{
                                      color: '#b0b0b0',
                                      '&.Mui-checked': {
                                        color: '#667eea'
                                      }
                                    }}
                                  />
                                }
                                label={<Typography variant="body2" sx={{ color: '#e0e0e0' }}>Backed up to Obsidian</Typography>}
                              />
                              
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => {
                                    setSearchQuery(prompt.prompt);
                                    setSearchMode('prompt');
                                    handleSearch();
                                  }}
                                  startIcon={<SearchIcon />}
                                  sx={{
                                    borderColor: 'rgba(102, 126, 234, 0.5)',
                                    color: '#e0e0e0',
                                    '&:hover': {
                                      borderColor: '#667eea',
                                      background: 'rgba(102, 126, 234, 0.1)'
                                    }
                                  }}
                                >
                                  Search
                                </Button>
                                
                                {!prompt.backed_up && (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => {
                                      setNoteName(prompt.title);
                                      setContent(prompt.prompt);
                                      setType('piece');
                                    }}
                                    sx={{
                                      borderColor: 'rgba(102, 126, 234, 0.5)',
                                      color: '#e0e0e0',
                                      '&:hover': {
                                        borderColor: '#667eea',
                                        background: 'rgba(102, 126, 234, 0.1)'
                                      }
                                    }}
                                  >
                                    Add to Vault
                                  </Button>
                                )}
                              </Box>
                            </Box>
                            
                            {prompt.backed_up && prompt.note_name && (
                              <Typography variant="caption" color="#4caf50">
                                ✓ Stored as: {prompt.note_name}
                              </Typography>
                            )}
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Box>
            
            <Box sx={{ width: { xs: '100%', md: 300 } }}>
              <Card elevation={8} sx={{ 
                borderRadius: 3,
                background: 'rgba(30, 30, 50, 0.95)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(102, 126, 234, 0.3)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
              }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h5" gutterBottom fontWeight={700} sx={{ 
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    mb: 3
                  }}>
                    Statistics
                  </Typography>
                  <Box sx={{ mt: 2, p: 2, borderRadius: 2, background: 'rgba(102, 126, 234, 0.1)', mb: 3, border: '1px solid rgba(102, 126, 234, 0.2)' }}>
                    <Typography variant="h3" color="primary" fontWeight={800} sx={{ 
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent'
                    }}>
                      {stats.totalNotes}
                    </Typography>
                    <Typography variant="body2" color="#b0b0b0" sx={{ fontWeight: 500 }}>
                      Total Notes
                    </Typography>
                  </Box>
                  <Box sx={{ mt: 3, p: 2, borderRadius: 2, background: 'rgba(76, 175, 80, 0.1)', mb: 3, border: '1px solid rgba(76, 175, 80, 0.2)' }}>
                    <Typography variant="h4" color="success.main" fontWeight={700} sx={{ 
                      background: 'linear-gradient(135deg, #4caf50 0%, #66bb6a 100%)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent'
                    }}>
                      {stats.ideas}
                    </Typography>
                    <Typography variant="body2" color="#b0b0b0" sx={{ fontWeight: 500 }}>
                      Ideas
                    </Typography>
                  </Box>
                  <Box sx={{ mt: 3, p: 2, borderRadius: 2, background: 'rgba(33, 150, 243, 0.1)', mb: 3, border: '1px solid rgba(33, 150, 243, 0.2)' }}>
                    <Typography variant="h4" color="info.main" fontWeight={700} sx={{ 
                      background: 'linear-gradient(135deg, #2196f3 0%, #42a5f5 100%)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent'
                    }}>
                      {stats.pieces}
                    </Typography>
                    <Typography variant="body2" color="#b0b0b0" sx={{ fontWeight: 500 }}>
                      Pieces
                    </Typography>
                  </Box>
                  <Box sx={{ mt: 3, p: 2, borderRadius: 2, background: 'rgba(255, 152, 0, 0.1)', border: '1px solid rgba(255, 152, 0, 0.2)' }}>
                    <Typography variant="h4" color="warning.main" fontWeight={700} sx={{ 
                      background: 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent'
                    }}>
                      {stats.connections}
                    </Typography>
                    <Typography variant="body2" color="#b0b0b0" sx={{ fontWeight: 500 }}>
                      Connections Made
                    </Typography>
                  </Box>
                  <Box sx={{ mt: 3, p: 2, borderRadius: 2, background: 'rgba(255, 193, 7, 0.1)', mb: 3, border: '1px solid rgba(255, 193, 7, 0.2)' }}>
                    <Typography variant="h4" color="warning.main" fontWeight={700} sx={{ 
                      background: 'linear-gradient(135deg, #ffc107 0%, #ffb300 100%)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent'
                    }}>
                      {stats.externalPieces}
                    </Typography>
                    <Typography variant="body2" color="#b0b0b0" sx={{ fontWeight: 500 }}>
                      External Pieces
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
              
              {/* Top Connected Notes Display */}
              <Card elevation={8} sx={{ 
                mt: 2,
                borderRadius: 3,
                background: 'rgba(30, 30, 50, 0.95)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(102, 126, 234, 0.3)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
              }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h5" gutterBottom fontWeight={700} sx={{ 
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    mb: 3
                  }}>
                    Most Connected
                  </Typography>
                  
                  {/* Top Idea */}
                  <Box sx={{ 
                    mt: 2, 
                    p: 3, 
                    borderRadius: 3, 
                    background: 'linear-gradient(135deg, #4caf50 0%, #66bb6a 100%)',
                    color: 'white',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: '0 8px 25px rgba(76, 175, 80, 0.4)',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 12px 35px rgba(76, 175, 80, 0.5)'
                    }
                  }}>
                    <Box sx={{ 
                      position: 'absolute', 
                      top: -15, 
                      right: -15, 
                      width: 50, 
                      height: 50, 
                      borderRadius: '50%', 
                      background: 'rgba(255,255,255,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backdropFilter: 'blur(10px)'
                    }}>
                      <Typography variant="h6" fontWeight={800}>
                        {stats.topIdea.length > 0 ? stats.topIdea[0].connections : 0}
                      </Typography>
                    </Box>
                    <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                      Top Idea{stats.topIdea.length > 1 ? 's' : ''}
                    </Typography>
                    {stats.topIdea.length > 0 ? (
                      stats.topIdea.map((idea, index) => (
                        <Typography key={index} variant="body2" sx={{ opacity: 0.95, mb: index < stats.topIdea.length - 1 ? 1 : 0, fontWeight: 500 }}>
                          {idea.name}
                        </Typography>
                      ))
                    ) : (
                      <Typography variant="body2" sx={{ opacity: 0.9, fontStyle: 'italic' }}>
                        No ideas yet
                      </Typography>
                    )}
                  </Box>
                  
                  {/* Top Piece */}
                  <Box sx={{ 
                    mt: 3, 
                    p: 3, 
                    borderRadius: 3, 
                    background: 'linear-gradient(135deg, #2196f3 0%, #42a5f5 100%)',
                    color: 'white',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: '0 8px 25px rgba(33, 150, 243, 0.4)',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 12px 35px rgba(33, 150, 243, 0.5)'
                    }
                  }}>
                    <Box sx={{ 
                      position: 'absolute', 
                      top: -15, 
                      right: -15, 
                      width: 50, 
                      height: 50, 
                      borderRadius: '50%', 
                      background: 'rgba(255,255,255,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backdropFilter: 'blur(10px)'
                    }}>
                      <Typography variant="h6" fontWeight={800}>
                        {stats.topPiece.length > 0 ? stats.topPiece[0].connections : 0}
                      </Typography>
                    </Box>
                    <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                      Top Piece{stats.topPiece.length > 1 ? 's' : ''}
                    </Typography>
                    {stats.topPiece.length > 0 ? (
                      stats.topPiece.map((piece, index) => (
                        <Typography key={index} variant="body2" sx={{ opacity: 0.95, mb: index < stats.topPiece.length - 1 ? 1 : 0, fontWeight: 500 }}>
                          {piece.name}
                        </Typography>
                      ))
                    ) : (
                      <Typography variant="body2" sx={{ opacity: 0.9, fontStyle: 'italic' }}>
                        No pieces yet
                      </Typography>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Box>
          </Box>
          
          {/* Add Prompt Dialog */}
          <Dialog open={promptDialogOpen} onClose={() => setPromptDialogOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              fontWeight: 700
            }}>
              Add New Prompt
            </DialogTitle>
            <DialogContent sx={{ p: 3, background: 'rgba(30, 30, 50, 0.95)' }}>
              <TextField
                label="Title"
                value={newPrompt.title}
                onChange={(e) => setNewPrompt({ ...newPrompt, title: e.target.value })}
                fullWidth
                sx={{ 
                  mb: 3, 
                  mt: 1,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    background: 'rgba(40, 40, 60, 0.8)',
                    color: '#ffffff',
                    '& fieldset': {
                      borderColor: 'rgba(102, 126, 234, 0.3)'
                    },
                    '&:hover fieldset': {
                      borderColor: '#667eea'
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#667eea',
                      borderWidth: 2
                    }
                  },
                  '& .MuiInputLabel-root': {
                    color: '#b0b0b0'
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: '#667eea'
                  }
                }}
                placeholder="Enter prompt title"
              />
              <TextField
                label="Prompt"
                value={newPrompt.prompt}
                onChange={(e) => setNewPrompt({ ...newPrompt, prompt: e.target.value })}
                multiline
                minRows={4}
                fullWidth
                sx={{ 
                  mb: 3,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    background: 'rgba(40, 40, 60, 0.8)',
                    color: '#ffffff',
                    '& fieldset': {
                      borderColor: 'rgba(102, 126, 234, 0.3)'
                    },
                    '&:hover fieldset': {
                      borderColor: '#667eea'
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#667eea',
                      borderWidth: 2
                    }
                  },
                  '& .MuiInputLabel-root': {
                    color: '#b0b0b0'
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: '#667eea'
                  }
                }}
                placeholder="Enter your prompt"
              />
              <TextField
                label="Essay Link (optional)"
                value={newPrompt.essay_link}
                onChange={(e) => setNewPrompt({ ...newPrompt, essay_link: e.target.value })}
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    background: 'rgba(40, 40, 60, 0.8)',
                    color: '#ffffff',
                    '& fieldset': {
                      borderColor: 'rgba(102, 126, 234, 0.3)'
                    },
                    '&:hover fieldset': {
                      borderColor: '#667eea'
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#667eea',
                      borderWidth: 2
                    }
                  },
                  '& .MuiInputLabel-root': {
                    color: '#b0b0b0'
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: '#667eea'
                  }
                }}
                placeholder="Link to Google Docs, etc."
              />
            </DialogContent>
            <DialogActions sx={{ p: 3, background: 'rgba(30, 30, 50, 0.95)' }}>
              <Button 
                onClick={() => setPromptDialogOpen(false)}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 3,
                  color: '#e0e0e0',
                  '&:hover': {
                    background: 'rgba(102, 126, 234, 0.1)'
                  }
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={createPrompt} 
                variant="contained"
                disabled={!newPrompt.title.trim() || !newPrompt.prompt.trim()}
                sx={{
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 3,
                  color: '#ffffff',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)'
                  },
                  '&:disabled': {
                    background: 'rgba(80, 80, 100, 0.5)',
                    color: '#666666'
                  }
                }}
              >
                Create Prompt
              </Button>
            </DialogActions>
          </Dialog>
          
          {/* Add Draft Dialog */}
          <Dialog open={draftDialogOpen} onClose={() => setDraftDialogOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              fontWeight: 700
            }}>
              Add New Draft
            </DialogTitle>
            <DialogContent sx={{ p: 3, background: 'rgba(30, 30, 50, 0.95)' }}>
              <TextField
                label="Draft Title"
                value={newDraft.title}
                onChange={(e) => setNewDraft({ ...newDraft, title: e.target.value })}
                fullWidth
                sx={{ 
                  mb: 3, 
                  mt: 1,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    background: 'rgba(40, 40, 60, 0.8)',
                    color: '#ffffff',
                    '& fieldset': {
                      borderColor: 'rgba(102, 126, 234, 0.3)'
                    },
                    '&:hover fieldset': {
                      borderColor: '#667eea'
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#667eea',
                      borderWidth: 2
                    }
                  },
                  '& .MuiInputLabel-root': {
                    color: '#b0b0b0'
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: '#667eea'
                  }
                }}
                placeholder="Enter draft title"
              />
              <TextField
                label="Draft Link"
                value={newDraft.link}
                onChange={(e) => setNewDraft({ ...newDraft, link: e.target.value })}
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    background: 'rgba(40, 40, 60, 0.8)',
                    color: '#ffffff',
                    '& fieldset': {
                      borderColor: 'rgba(102, 126, 234, 0.3)'
                    },
                    '&:hover fieldset': {
                      borderColor: '#667eea'
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#667eea',
                      borderWidth: 2
                    }
                  },
                  '& .MuiInputLabel-root': {
                    color: '#b0b0b0'
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: '#667eea'
                  }
                }}
                placeholder="Link to Google Docs, etc."
              />
            </DialogContent>
            <DialogActions sx={{ p: 3, background: 'rgba(30, 30, 50, 0.95)' }}>
              <Button 
                onClick={() => setDraftDialogOpen(false)}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 3,
                  color: '#e0e0e0',
                  '&:hover': {
                    background: 'rgba(102, 126, 234, 0.1)'
                  }
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={createDraft} 
                variant="contained"
                disabled={!newDraft.title.trim() || !newDraft.link.trim()}
                sx={{
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 3,
                  color: '#ffffff',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)'
                  },
                  '&:disabled': {
                    background: 'rgba(80, 80, 100, 0.5)',
                    color: '#666666'
                  }
                }}
              >
                Create Draft
              </Button>
            </DialogActions>
          </Dialog>
          
          {/* Vault Path Dialog */}
          <Dialog open={vaultDialogOpen} onClose={() => setVaultDialogOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              fontWeight: 700
            }}>
              Set Obsidian Vault Path
            </DialogTitle>
            <DialogContent sx={{ p: 3, background: 'rgba(30, 30, 50, 0.95)' }}>
              <Typography variant="body2" sx={{ mb: 2, color: '#e0e0e0' }}>
                Enter the absolute path to your Obsidian vault (e.g., <code>/Users/yourname/ObsidianVault</code>). This is required to open notes directly in Obsidian.
              </Typography>
              <TextField
                label="Vault Path"
                value={vaultInput}
                onChange={e => setVaultInput(e.target.value)}
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    background: 'rgba(40, 40, 60, 0.8)',
                    color: '#ffffff',
                    '& fieldset': {
                      borderColor: 'rgba(102, 126, 234, 0.3)'
                    },
                    '&:hover fieldset': {
                      borderColor: '#667eea'
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#667eea',
                      borderWidth: 2
                    }
                  },
                  '& .MuiInputLabel-root': {
                    color: '#b0b0b0'
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: '#667eea'
                  }
                }}
                placeholder="/Users/yourname/ObsidianVault"
              />
            </DialogContent>
            <DialogActions sx={{ p: 3, background: 'rgba(30, 30, 50, 0.95)' }}>
              <Button 
                onClick={() => setVaultDialogOpen(false)}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 3,
                  color: '#e0e0e0',
                  '&:hover': {
                    background: 'rgba(102, 126, 234, 0.1)'
                  }
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveVaultPath} 
                variant="contained"
                disabled={!vaultInput.trim()}
                sx={{
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 3,
                  color: '#ffffff',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)'
                  },
                  '&:disabled': {
                    background: 'rgba(80, 80, 100, 0.5)',
                    color: '#666666'
                  }
                }}
              >
                Save
              </Button>
            </DialogActions>
          </Dialog>
          
          {/* Batch Tag Dialog */}
          <Dialog open={batchTagDialogOpen} onClose={() => setBatchTagDialogOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', fontWeight: 700 }}>
              Batch Add Tags
            </DialogTitle>
            <DialogContent sx={{ p: 3, background: 'rgba(30, 30, 50, 0.95)' }}>
              <Typography variant="body2" sx={{ mb: 2, color: '#e0e0e0' }}>
                Enter tags to add to the selected notes (comma separated, e.g. <code>#tag1, #tag2, #tag with spaces</code>):
              </Typography>
              <TextField
                label="Tags"
                value={batchTags}
                onChange={e => setBatchTags(e.target.value)}
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    background: 'rgba(40, 40, 60, 0.8)',
                    color: '#ffffff',
                    '& fieldset': {
                      borderColor: 'rgba(102, 126, 234, 0.3)'
                    },
                    '&:hover fieldset': {
                      borderColor: '#667eea'
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#667eea',
                      borderWidth: 2
                    }
                  },
                  '& .MuiInputLabel-root': {
                    color: '#b0b0b0'
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: '#667eea'
                  }
                }}
                placeholder="#tag1, #tag2, #tag with spaces"
              />
            </DialogContent>
            <DialogActions sx={{ p: 3, background: 'rgba(30, 30, 50, 0.95)' }}>
              <Button onClick={() => setBatchTagDialogOpen(false)} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, px: 3, color: '#e0e0e0', '&:hover': { background: 'rgba(102, 126, 234, 0.1)' } }}>
                Cancel
              </Button>
              <Button onClick={handleBatchTag} variant="contained" disabled={!batchTags.trim()} sx={{ borderRadius: 2, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', textTransform: 'none', fontWeight: 600, px: 3, color: '#ffffff', '&:hover': { background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)' }, '&:disabled': { background: 'rgba(80, 80, 100, 0.5)', color: '#666666' } }}>
                Add Tags
              </Button>
            </DialogActions>
          </Dialog>
          
          {/* Note Viewer Dialog */}
          <Dialog open={noteViewerOpen} onClose={() => setNoteViewerOpen(false)} maxWidth="md" fullWidth>
            <DialogTitle sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', fontWeight: 700 }}>
              {viewedNote?.name}
            </DialogTitle>
            <DialogContent sx={{ p: 3, background: 'rgba(30, 30, 50, 0.95)' }}>
              <Typography variant="body2" sx={{ color: '#b0b0b0', mb: 2 }}>
                <b>Type:</b> {viewedNote?.type} | <b>Created:</b> {viewedNote?.created ? new Date(viewedNote.created * 1000).toLocaleString() : ''} | <b>Modified:</b> {viewedNote?.modified ? new Date(viewedNote.modified * 1000).toLocaleString() : ''} | <b>Words:</b> {viewedNote?.word_count} | <b>Connections:</b> {viewedNote?.num_connections} | <b>External:</b> {viewedNote?.external ? 'Yes' : 'No'}
              </Typography>
              <Box sx={{ whiteSpace: 'pre-wrap', color: '#fff', fontFamily: 'monospace', fontSize: '1rem', background: 'rgba(40,40,60,0.8)', borderRadius: 2, p: 2 }}>
                {viewedNote?.content}
              </Box>
            </DialogContent>
            <DialogActions sx={{ p: 3, background: 'rgba(30, 30, 50, 0.95)' }}>
              <Button onClick={() => setNoteViewerOpen(false)} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, px: 3, color: '#e0e0e0', '&:hover': { background: 'rgba(102, 126, 234, 0.1)' } }}>
                Close
              </Button>
            </DialogActions>
          </Dialog>
          
          {/* All Notes Dialog */}
          <Dialog open={allNotesDialogOpen} onClose={() => setAllNotesDialogOpen(false)} maxWidth="xl" fullWidth>
            <DialogTitle sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', fontWeight: 700 }}>
              All Notes
            </DialogTitle>
            <DialogContent sx={{ p: 3, background: 'rgba(30, 30, 50, 0.95)' }}>
              {allNotesLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" fontWeight={600} sx={{ color: '#667eea', flex: 1 }}>
                      Notes ({allNotes.length})
                    </Typography>
                    {selectedAllNotes.length > 0 && (
                      <Button
                        variant="contained"
                        color="primary"
                        sx={{ ml: 2, borderRadius: 2, fontWeight: 600 }}
                        onClick={() => setBatchTagAllDialogOpen(true)}
                      >
                        Batch Tag
                      </Button>
                    )}
                  </Box>
                  <Box sx={{ maxHeight: 500, overflow: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'rgba(102,126,234,0.08)' }}>
                          <th></th>
                          <th style={{ color: '#b0b0b0', fontWeight: 600, textAlign: 'left' }}>Name</th>
                          <th style={{ color: '#b0b0b0', fontWeight: 600 }}>Type</th>
                          <th style={{ color: '#b0b0b0', fontWeight: 600 }}>Created</th>
                          <th style={{ color: '#b0b0b0', fontWeight: 600 }}>Modified</th>
                          <th style={{ color: '#b0b0b0', fontWeight: 600 }}>Words</th>
                          <th style={{ color: '#b0b0b0', fontWeight: 600 }}>Connections</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allNotes.map((note, index) => (
                          <tr key={index} style={{ background: selectedAllNotes.includes(note.name) ? 'rgba(102,126,234,0.15)' : 'transparent' }}>
                            <td>
                              <Checkbox
                                checked={selectedAllNotes.includes(note.name)}
                                onChange={e => {
                                  setSelectedAllNotes(sel =>
                                    e.target.checked
                                      ? [...sel, note.name]
                                      : sel.filter(n => n !== note.name)
                                  );
                                }}
                                size="small"
                              />
                            </td>
                            <td style={{ fontWeight: 700, color: '#fff', textAlign: 'left' }}>
                              <Button
                                onClick={() => handleOpenInObsidian(note.name, note.type)}
                                sx={{ 
                                  textTransform: 'none', 
                                  color: '#667eea', 
                                  fontWeight: 700, 
                                  p: 0, 
                                  minWidth: 'auto',
                                  textDecoration: 'underline',
                                  textAlign: 'left',
                                  justifyContent: 'flex-start',
                                  maxWidth: '200px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  '&:hover': {
                                    background: 'transparent',
                                    color: '#8b9dc3'
                                  }
                                }}
                              >
                                {note.name}
                              </Button>
                              {note.external && <Chip label="EXTERN" color="warning" size="small" sx={{ ml: 1 }} />}
                            </td>
                            <td>
                              <Chip label={note.type} size="small" color={note.type === 'idea' ? 'success' : 'info'} />
                            </td>
                            <td style={{ color: '#e0e0e0' }}>{note.created ? new Date(note.created * 1000).toLocaleString() : ''}</td>
                            <td style={{ color: '#e0e0e0' }}>{note.modified ? new Date(note.modified * 1000).toLocaleString() : ''}</td>
                            <td style={{ color: '#e0e0e0' }}>{note.word_count}</td>
                            <td style={{ color: '#e0e0e0' }}>{note.num_connections}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Box>
                </>
              )}
            </DialogContent>
            <DialogActions sx={{ p: 3, background: 'rgba(30, 30, 50, 0.95)' }}>
              <Button onClick={() => setAllNotesDialogOpen(false)} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, px: 3, color: '#e0e0e0', '&:hover': { background: 'rgba(102, 126, 234, 0.1)' } }}>
                Close
              </Button>
            </DialogActions>
          </Dialog>
          
          {/* Batch Tag All Dialog */}
          <Dialog open={batchTagAllDialogOpen} onClose={() => setBatchTagAllDialogOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', fontWeight: 700 }}>
              Batch Add Tags (All Notes)
            </DialogTitle>
            <DialogContent sx={{ p: 3, background: 'rgba(30, 30, 50, 0.95)' }}>
              <Typography variant="body2" sx={{ mb: 2, color: '#e0e0e0' }}>
                Enter tags to add to the selected notes (comma separated, e.g. <code>#tag1, #tag2, #tag with spaces</code>):
              </Typography>
              <TextField
                label="Tags"
                value={batchTagsAll}
                onChange={e => setBatchTagsAll(e.target.value)}
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    background: 'rgba(40, 40, 60, 0.8)',
                    color: '#ffffff',
                    '& fieldset': {
                      borderColor: 'rgba(102, 126, 234, 0.3)'
                    },
                    '&:hover fieldset': {
                      borderColor: '#667eea'
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#667eea',
                      borderWidth: 2
                    }
                  },
                  '& .MuiInputLabel-root': {
                    color: '#b0b0b0'
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: '#667eea'
                  }
                }}
                placeholder="#tag1, #tag2, #tag with spaces"
              />
            </DialogContent>
            <DialogActions sx={{ p: 3, background: 'rgba(30, 30, 50, 0.95)' }}>
              <Button onClick={() => setBatchTagAllDialogOpen(false)} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, px: 3, color: '#e0e0e0', '&:hover': { background: 'rgba(102, 126, 234, 0.1)' } }}>
                Cancel
              </Button>
              <Button onClick={async () => {await handleBatchTagAll()}} variant="contained" disabled={!batchTagsAll.trim()} sx={{ borderRadius: 2, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', textTransform: 'none', fontWeight: 600, px: 3, color: '#ffffff', '&:hover': { background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)' }, '&:disabled': { background: 'rgba(80, 80, 100, 0.5)', color: '#666666' } }}>
                Add Tags
              </Button>
            </DialogActions>
          </Dialog>
          
          <Snackbar
            open={!!success}
            autoHideDuration={4000}
            onClose={() => setSuccess('')}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert severity="success" onClose={() => setSuccess('')} sx={{ width: '100%' }}>
              {success}
            </Alert>
          </Snackbar>
          <Snackbar
            open={!!error}
            autoHideDuration={4000}
            onClose={() => setError('')}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert severity="error" onClose={() => setError('')} sx={{ width: '100%' }}>
              {error}
            </Alert>
          </Snackbar>
        </Container>
      )}
    </>
  );
}

export default App;
