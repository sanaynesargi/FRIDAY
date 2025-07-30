import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
  Stack,
  Snackbar,
  Alert,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SearchIcon from '@mui/icons-material/Search';

const BACKEND_URL = 'http://localhost:8000';

interface Prompt {
  id: string;
  title: string;
  prompt: string;
  essay_link: string;
  backed_up: boolean;
  note_name: string;
  drafts: Draft[];
}

interface Draft {
  id: string;
  title: string;
  link: string;
  backed_up: boolean;
  note_name: string;
}

function PromptsEssays() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  
  // Dialog states
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [newPrompt, setNewPrompt] = useState({ title: '', prompt: '', essay_link: '' });
  const [draftDialogOpen, setDraftDialogOpen] = useState(false);
  const [selectedPromptId, setSelectedPromptId] = useState('');
  const [newDraft, setNewDraft] = useState({ title: '', link: '' });

  // Load prompts on component mount
  useEffect(() => {
    fetchPrompts();
  }, []);

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

  const createDraft = async () => {
    try {
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

  const handleSearchPrompt = async (promptText: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: promptText, mode: 'prompt' })
      });
      if (res.ok) {
        const data = await res.json();
        console.log('Search results:', data);
        setSuccess(`Found ${data.results?.length || 0} relevant notes`);
      }
    } catch (err: any) {
      setError('Failed to search for relevant notes');
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4, minHeight: 'calc(100vh - 64px)' }}>
      <Typography variant="h3" gutterBottom fontWeight={700} sx={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        mb: 4
      }}>
        Prompts & Essays
      </Typography>

      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', lg: 'row' } }}>
        {/* Main Content Area */}
        <Box sx={{ flex: 1 }}>
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
                  Your Prompts & Essays
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setPromptDialogOpen(true)}
                  sx={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    borderRadius: 2,
                    fontWeight: 600,
                    '&:hover': {
                      background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                      transform: 'scale(1.05)'
                    }
                  }}
                >
                  Add Prompt
                </Button>
              </Box>
              
              <Box sx={{ maxHeight: '70vh', overflow: 'auto' }}>
                {prompts.length === 0 ? (
                  <Typography variant="body2" color="#b0b0b0" align="center" sx={{ py: 4, fontStyle: 'italic' }}>
                    No prompts yet. Click "Add Prompt" to get started.
                  </Typography>
                ) : (
                  prompts.map((prompt) => (
                    <Card key={prompt.id} sx={{ 
                      mb: 3,
                      borderRadius: 3,
                      background: 'rgba(40, 40, 60, 0.8)',
                      border: '1px solid rgba(102, 126, 234, 0.2)',
                      '&:hover': {
                        background: 'rgba(50, 50, 70, 0.9)',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 8px 25px rgba(0,0,0,0.3)'
                      }
                    }}>
                      <CardContent sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                          <Typography variant="h6" fontWeight={600} sx={{ flex: 1, color: '#ffffff' }}>
                            {prompt.title}
                          </Typography>
                          <IconButton 
                            onClick={() => deletePrompt(prompt.id)}
                            size="small"
                            color="error"
                            sx={{ color: '#ff5252' }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                        
                        <Typography variant="body2" sx={{ mb: 2, color: '#e0e0e0', lineHeight: 1.6 }}>
                          {prompt.prompt}
                        </Typography>
                        
                        {prompt.essay_link && (
                          <Box sx={{ mb: 2, p: 2, borderRadius: 2, background: 'rgba(20, 20, 40, 0.8)' }}>
                            <Typography variant="caption" color="#b0b0b0" sx={{ display: 'block', mb: 1 }}>
                              Essay Link:
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" sx={{ wordBreak: 'break-all', color: '#e0e0e0', flex: 1 }}>
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
                        <Box sx={{ mb: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="subtitle2" color="#b0b0b0">
                              Drafts ({prompt.drafts?.length || 0})
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
                                <Card key={draft.id} sx={{ mb: 1, p: 2, backgroundColor: 'rgba(20, 20, 40, 0.8)', border: '1px solid rgba(102, 126, 234, 0.1)', borderRadius: 2 }}>
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <Box sx={{ flex: 1 }}>
                                      <Typography variant="body2" fontWeight={500} sx={{ color: '#ffffff', mb: 1 }}>
                                        {draft.title}
                                      </Typography>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography variant="caption" sx={{ wordBreak: 'break-all', color: '#e0e0e0', flex: 1 }}>
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
                                    
                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                      <IconButton
                                        size="small"
                                        onClick={() => deleteDraft(prompt.id, draft.id)}
                                        sx={{ color: '#ff5252' }}
                                      >
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </Box>
                                  </Box>
                                </Card>
                              ))}
                            </Box>
                          )}
                        </Box>
                        
                        {/* Action Buttons */}
                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<SearchIcon />}
                            onClick={() => handleSearchPrompt(prompt.prompt)}
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
                                // This would need to be handled by the parent component
                                // For now, just show a message
                                setSuccess('Use the main page to add this to your vault');
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
                        
                        {prompt.backed_up && prompt.note_name && (
                          <Typography variant="caption" color="#4caf50" sx={{ display: 'block', mt: 1 }}>
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
      </Box>

      {/* Add Prompt Dialog */}
      <Dialog open={promptDialogOpen} onClose={() => setPromptDialogOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{
          sx: {
            background: 'rgba(30, 30, 50, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(102, 126, 234, 0.3)',
            borderRadius: 3
          }
        }}
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          fontWeight: 700
        }}>
          Add New Prompt
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
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
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setPromptDialogOpen(false)} sx={{ 
            color: '#b0b0b0',
            '&:hover': { background: 'rgba(102, 126, 234, 0.1)' }
          }}>
            Cancel
          </Button>
          <Button onClick={createPrompt} variant="contained" disabled={!newPrompt.title.trim() || !newPrompt.prompt.trim()} sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            '&:hover': {
              background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)'
            },
            '&:disabled': {
              background: 'rgba(80, 80, 100, 0.5)',
              color: '#666666'
            }
          }}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Draft Dialog */}
      <Dialog open={draftDialogOpen} onClose={() => setDraftDialogOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{
          sx: {
            background: 'rgba(30, 30, 50, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(102, 126, 234, 0.3)',
            borderRadius: 3
          }
        }}
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          fontWeight: 700
        }}>
          Add New Draft
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <TextField
            label="Title"
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
            label="Link"
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
            placeholder="Link to draft document"
          />
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setDraftDialogOpen(false)} sx={{ 
            color: '#b0b0b0',
            '&:hover': { background: 'rgba(102, 126, 234, 0.1)' }
          }}>
            Cancel
          </Button>
          <Button onClick={createDraft} variant="contained" disabled={!newDraft.title.trim() || !newDraft.link.trim()} sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            '&:hover': {
              background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)'
            },
            '&:disabled': {
              background: 'rgba(80, 80, 100, 0.5)',
              color: '#666666'
            }
          }}>
            Create
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
  );
}

export default PromptsEssays; 