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
import DescriptionIcon from '@mui/icons-material/Description';

import IdeaBoards from './IdeaBoards';
import PromptsEssays from './PromptsEssays';

const BACKEND_URL = 'http://localhost:8000'; // Change if backend runs elsewhere

function App() {
  const [currentPage, setCurrentPage] = useState<'main' | 'idea-boards' | 'prompts-essays'>('main');
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
    externalPieces: 0
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'text' | 'prompt'>('text');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
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

  const fetchAllNotes = async () => {
    setAllNotesLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/all_notes`);
      if (res.ok) {
        const data = await res.json();
        setAllNotes(data.notes || []);
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

  return (
    <Box sx={{ 
      minHeight: '100vh',
      minWidth: '100vw',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      backgroundAttachment: 'fixed'
    }}>
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
            <Tab 
              value="prompts-essays" 
              label="Prompts & Essays" 
              icon={<DescriptionIcon />}
              iconPosition="start"
            />
          </Tabs>
        </Toolbar>
      </AppBar>

      {/* Conditional Rendering */}
      {currentPage === 'idea-boards' ? (
        <IdeaBoards />
      ) : currentPage === 'prompts-essays' ? (
        <PromptsEssays />
      ) : (
        <Container disableGutters sx={{ py: 3, minHeight: 'calc(100vh - 64px)', px: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}>
            {/* Top Row: Form and Search */}
            <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', lg: 'row' }, width: '100%' }}>
              {/* FRIDAY Idea Base Form */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Paper elevation={8} sx={{ 
                  p: 3, 
                  borderRadius: 3,
                  background: 'rgba(30, 30, 50, 0.95)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(102, 126, 234, 0.3)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
                }}>
                  <Typography variant="h4" gutterBottom fontWeight={800} align="center" sx={{ 
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    mb: 2,
                    textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                  }}>
                    FRIDAY Idea Base
                  </Typography>
                  <Typography variant="h6" align="center" gutterBottom sx={{ 
                    color: '#e0e0e0',
                    mb: 3,
                    fontWeight: 300
                  }}>
                    Integrated with Obsidian.
                  </Typography>
                  <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
                    <ToggleButtonGroup
                      value={type}
                      exclusive
                      onChange={handleType}
                      sx={{ 
                        mb: 2,
                        '& .MuiToggleButton-root': {
                          borderRadius: 2,
                          fontWeight: 600,
                          px: 2,
                          py: 1,
                          color: '#b0b0b0',
                          borderColor: 'rgba(102, 126, 234, 0.3)',
                          background: 'rgba(40, 40, 60, 0.8)',
                          '&.Mui-selected': {
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            '&:hover': {
                              background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)'
                            }
                          },
                          '&:hover': {
                            background: 'rgba(102, 126, 234, 0.1)',
                            borderColor: '#667eea'
                          }
                        }
                      }}
                    >
                      <ToggleButton value="idea">Idea</ToggleButton>
                      <ToggleButton value="piece">Essay</ToggleButton>
                    </ToggleButtonGroup>
                    
                    <TextField
                      label="Note Name"
                      value={noteName}
                      onChange={e => setNoteName(e.target.value)}
                      fullWidth
                      required
                      sx={{ 
                        mb: 2,
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
                      error={hasInvalidChars(noteName)}
                    />
                    <TextField
                      label={type === 'idea' ? 'Your Idea' : 'Your Essay'}
                      value={content}
                      onChange={e => setContent(e.target.value)}
                      multiline
                      minRows={3}
                      fullWidth
                      required
                      sx={{ 
                        mb: 2,
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
                      disabled={loading || hasInvalidChars(noteName)}
                      sx={{
                        borderRadius: 2,
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        textTransform: 'none',
                        fontWeight: 600,
                        px: 3,
                        py: 1,
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
                      {loading ? <CircularProgress size={20} color="inherit" /> : 'Submit'}
                    </Button>
                  </Box>
                </Paper>
                
                {/* Suggestions Section */}
                {suggestions.length > 0 && (
                  <Paper elevation={8} sx={{ 
                    mt: 3, 
                    p: 3, 
                    borderRadius: 3,
                    background: 'rgba(30, 30, 50, 0.95)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(102, 126, 234, 0.3)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
                  }}>
                    <Typography variant="h6" gutterBottom fontWeight={600} sx={{ 
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      mb: 2
                    }}>
                      Suggested Connections
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {suggestions.map((suggestion, index) => (
                        <Chip
                          key={index}
                          label={suggestion}
                          onClick={() => {
                            setSelected(prev => 
                              prev.includes(suggestion) 
                                ? prev.filter(s => s !== suggestion)
                                : [...prev, suggestion]
                            );
                          }}
                          color={selected.includes(suggestion) ? 'primary' : 'default'}
                          sx={{
                            borderRadius: 2,
                            fontWeight: 600,
                            background: selected.includes(suggestion) 
                              ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                              : 'rgba(40, 40, 60, 0.8)',
                            color: selected.includes(suggestion) ? 'white' : '#e0e0e0',
                            border: '1px solid rgba(102, 126, 234, 0.3)',
                            '&:hover': {
                              background: selected.includes(suggestion)
                                ? 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)'
                                : 'rgba(102, 126, 234, 0.1)'
                            }
                          }}
                        />
                      ))}
                    </Stack>
                    {selected.length > 0 && (
                      <Button
                        onClick={handleConnect}
                        disabled={connectLoading}
                        variant="contained"
                        sx={{
                          mt: 2,
                          borderRadius: 2,
                          background: 'linear-gradient(135deg, #4caf50 0%, #66bb6a 100%)',
                          textTransform: 'none',
                          fontWeight: 600,
                          px: 3,
                          py: 1,
                          color: '#ffffff',
                          '&:hover': {
                            background: 'linear-gradient(135deg, #43a047 0%, #5cb85c 100%)'
                          },
                          '&:disabled': {
                            background: 'rgba(80, 80, 100, 0.5)',
                            color: '#666666'
                          }
                        }}
                      >
                        {connectLoading ? <CircularProgress size={20} color="inherit" /> : `Connect to ${selected.length} note${selected.length > 1 ? 's' : ''}`}
                      </Button>
                    )}
                  </Paper>
                )}
              </Box>
              
              {/* Search Section */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Paper elevation={8} sx={{ 
                  p: 3, 
                  borderRadius: 3,
                  background: 'rgba(30, 30, 50, 0.95)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(102, 126, 234, 0.3)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
                }}>
                  <Typography variant="h6" gutterBottom fontWeight={600} sx={{ 
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    mb: 2
                  }}>
                    Search Notes
                  </Typography>
                  
                  <ToggleButtonGroup
                    value={searchMode}
                    exclusive
                    onChange={(_, newValue) => {
                      if (newValue) {
                        setSearchMode(newValue);
                        setSearchResults([]);
                      }
                    }}
                    sx={{ 
                      mb: 2,
                      '& .MuiToggleButton-root': {
                        borderRadius: 2,
                        fontWeight: 600,
                        px: 2,
                        py: 1,
                        color: '#b0b0b0',
                        borderColor: 'rgba(102, 126, 234, 0.3)',
                        background: 'rgba(40, 40, 60, 0.8)',
                        '&.Mui-selected': {
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: 'white',
                          '&:hover': {
                            background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)'
                          }
                        },
                        '&:hover': {
                          background: 'rgba(102, 126, 234, 0.1)',
                          borderColor: '#667eea'
                        }
                      }
                    }}
                  >
                    <ToggleButton value="text">Text Search</ToggleButton>
                    <ToggleButton value="prompt">Prompt Search</ToggleButton>
                  </ToggleButtonGroup>
                  
                  <TextField
                    label="Search Query"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    fullWidth
                    sx={{ 
                      mb: 2,
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
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={handleMicClick}
                            sx={{ color: isListening ? '#ff5252' : '#b0b0b0' }}
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
                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
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
                              setSearchTags(prev => [...prev, tagInput.trim()]);
                              setTagInput('');
                            }
                          }}
                        />
                        <Button
                          onClick={() => {
                            if (tagInput.trim()) {
                              setSearchTags(prev => [...prev, tagInput.trim()]);
                              setTagInput('');
                            }
                          }}
                          variant="outlined"
                          size="small"
                          sx={{
                            borderColor: 'rgba(102, 126, 234, 0.5)',
                            color: '#e0e0e0',
                            '&:hover': {
                              borderColor: '#667eea',
                              background: 'rgba(102, 126, 234, 0.1)'
                            }
                          }}
                        >
                          Add
                        </Button>
                      </Box>
                      
                      {searchTags.length > 0 && (
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          {searchTags.map((tag, index) => (
                            <Chip
                              key={index}
                              label={tag}
                              onDelete={() => setSearchTags(prev => prev.filter((_, i) => i !== index))}
                              sx={{
                                borderRadius: 2,
                                background: 'rgba(102, 126, 234, 0.2)',
                                color: '#e0e0e0',
                                border: '1px solid rgba(102, 126, 234, 0.3)',
                                '& .MuiChip-deleteIcon': {
                                  color: '#b0b0b0',
                                  '&:hover': { color: '#ff5252' }
                                }
                              }}
                            />
                          ))}
                        </Stack>
                      )}
                    </Box>
                  )}
                  
                  <Button
                    onClick={handleSearch}
                    disabled={searchLoading || !searchQuery.trim()}
                    variant="contained"
                    sx={{
                      borderRadius: 2,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      textTransform: 'none',
                      fontWeight: 600,
                      px: 3,
                      py: 1,
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
                    {searchLoading ? <CircularProgress size={20} color="inherit" /> : 'Search'}
                  </Button>
                  
                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <Box sx={{ mt: 3 }}>
                      <Typography variant="h6" gutterBottom fontWeight={600} sx={{ color: '#e0e0e0', mb: 2 }}>
                        Results ({searchResults.length})
                      </Typography>
                      <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                        {searchResults.map((result, index) => (
                          <Card key={index} sx={{ 
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
                                <Typography 
                                  variant="h6" 
                                  fontWeight={600} 
                                  sx={{ 
                                    color: '#667eea',
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                    flex: 1,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    '&:hover': { color: '#8b9dc3' }
                                  }}
                                  onClick={() => handleOpenInObsidian(result.name, result.type)}
                                >
                                  {result.name}
                                </Typography>
                                <Chip 
                                  label={result.type} 
                                  size="small" 
                                  color={result.type === 'idea' ? 'success' : 'info'}
                                  sx={{ ml: 1 }}
                                />
                              </Box>
                              
                              {searchMode === 'prompt' && result.reason && (
                                <Typography variant="body2" sx={{ 
                                  color: '#e0e0e0', 
                                  mb: 1,
                                  wordWrap: 'break-word',
                                  whiteSpace: 'pre-wrap'
                                }}>
                                  {result.reason}
                                </Typography>
                              )}
                              
                              {searchMode === 'text' && result.content && (
                                <Typography variant="body2" sx={{ 
                                  color: '#e0e0e0',
                                  wordWrap: 'break-word',
                                  whiteSpace: 'pre-wrap'
                                }}>
                                  {highlightText(result.content, searchQuery)}
                                </Typography>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </Box>
                    </Box>
                  )}
                </Paper>
              </Box>
            </Box>
            
            {/* Bottom Row: Statistics */}
            <Box sx={{ width: '100%' }}>
              <Card elevation={8} sx={{ 
                borderRadius: 3,
                background: 'rgba(30, 30, 50, 0.95)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(102, 126, 234, 0.3)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
              }}>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="h5" gutterBottom fontWeight={700} sx={{ 
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    mb: 2
                  }}>
                    Statistics
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'space-around' }}>
                    <Box sx={{ p: 1.5, borderRadius: 2, background: 'rgba(102, 126, 234, 0.1)', border: '1px solid rgba(102, 126, 234, 0.2)', minWidth: 120, textAlign: 'center' }}>
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
                    <Box sx={{ p: 1.5, borderRadius: 2, background: 'rgba(76, 175, 80, 0.1)', border: '1px solid rgba(76, 175, 80, 0.2)', minWidth: 120, textAlign: 'center' }}>
                      <Typography variant="h3" color="success.main" fontWeight={700} sx={{ 
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
                    <Box sx={{ p: 1.5, borderRadius: 2, background: 'rgba(33, 150, 243, 0.1)', border: '1px solid rgba(33, 150, 243, 0.2)', minWidth: 120, textAlign: 'center' }}>
                      <Typography variant="h3" color="info.main" fontWeight={700} sx={{ 
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
                    <Box sx={{ p: 1.5, borderRadius: 2, background: 'rgba(255, 152, 0, 0.1)', border: '1px solid rgba(255, 152, 0, 0.2)', minWidth: 120, textAlign: 'center' }}>
                      <Typography variant="h3" color="warning.main" fontWeight={700} sx={{ 
                        background: 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                      }}>
                        {stats.connections}
                      </Typography>
                      <Typography variant="body2" color="#b0b0b0" sx={{ fontWeight: 500 }}>
                        Connections
                      </Typography>
                    </Box>
                    <Box sx={{ p: 1.5, borderRadius: 2, background: 'rgba(255, 193, 7, 0.1)', border: '1px solid rgba(255, 193, 7, 0.2)', minWidth: 120, textAlign: 'center' }}>
                      <Typography variant="h3" color="warning.main" fontWeight={700} sx={{ 
                        background: 'linear-gradient(135deg, #ffc107 0%, #ffb300 100%)',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                      }}>
                        {stats.externalPieces}
                      </Typography>
                      <Typography variant="body2" color="#b0b0b0" sx={{ fontWeight: 500 }}>
                        External
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          </Box>
          
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
    </Box>
  );
}

export default App;
