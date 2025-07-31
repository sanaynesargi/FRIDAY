import React, { useState, useEffect, useRef } from 'react';
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
  MenuItem,
  Collapse
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';

const BACKEND_URL = 'http://localhost:8000';

// Add type declarations for SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface Prompt {
  id: string;
  title: string;
  prompt: string;
  essay_link: string;
  backed_up: boolean;
  note_name: string;
  drafts: Draft[];
  folder?: string;
}

interface Draft {
  id: string;
  title: string;
  link: string;
  backed_up: boolean;
  note_name: string;
}

interface Folder {
  id: string;
  name: string;
  color: string;
}

function PromptsEssays() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  
  // Dialog states
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [newPrompt, setNewPrompt] = useState({ title: '', prompt: '', essay_link: '', folder: '' });
  const [draftDialogOpen, setDraftDialogOpen] = useState(false);
  const [selectedPromptId, setSelectedPromptId] = useState('');
  const [newDraft, setNewDraft] = useState({ title: '', link: '' });
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [newFolder, setNewFolder] = useState({ name: '', color: '#667eea' });
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [selectedPromptToMove, setSelectedPromptToMove] = useState<Prompt | null>(null);
  const [targetFolder, setTargetFolder] = useState('');

  // Voice recognition state
  const [isListening, setIsListening] = useState(false);
  const [voiceCommand, setVoiceCommand] = useState('');
  const recognitionRef = useRef<any>(null);

  // Predefined colors for random assignment
  const folderColors = [
    '#667eea', '#4caf50', '#ff9800', '#f44336', '#9c27b0', '#00bcd4',
    '#e91e63', '#3f51b5', '#009688', '#ff5722', '#795548', '#607d8b',
    '#8bc34a', '#ffc107', '#9e9e9e', '#673ab7', '#ff4081', '#2196f3'
  ];

  // Load prompts and folders on component mount
  useEffect(() => {
    fetchPrompts();
    fetchFolders();
    initializeVoiceRecognition();
  }, []);

  const initializeVoiceRecognition = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        setVoiceCommand('');
      };

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setVoiceCommand(transcript);
        processVoiceCommand(transcript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        setError('Voice recognition error. Please try again.');
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  };

  const processVoiceCommand = (command: string) => {
    const lowerCommand = command.toLowerCase();
    
    // Remove common words and clean up the command
    let cleanCommand = lowerCommand
      .replace(/show me /g, '')
      .replace(/show /g, '')
      .replace(/display /g, '')
      .replace(/open /g, '')
      .replace(/go to /g, '')
      .replace(/switch to /g, '')
      .trim();

    // Handle "all prompts" or "all" command
    if (cleanCommand.includes('all') || cleanCommand.includes('everything')) {
      setSelectedFolder('all');
      setSuccess('Showing all prompts');
      return;
    }

    // Find matching folder
    const matchingFolder = folders.find(folder => 
      folder.name.toLowerCase().includes(cleanCommand) ||
      cleanCommand.includes(folder.name.toLowerCase())
    );

    if (matchingFolder) {
      setSelectedFolder(matchingFolder.id);
      setSuccess(`Showing prompts in ${matchingFolder.name}`);
    } else {
      setError(`No folder found matching "${cleanCommand}". Available folders: ${folders.map(f => f.name).join(', ')}`);
    }
  };

  const startVoiceRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Error starting voice recognition:', error);
        setError('Could not start voice recognition. Please try again.');
      }
    } else {
      setError('Voice recognition is not supported in this browser.');
    }
  };

  const stopVoiceRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const toggleCardExpansion = (promptId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(promptId)) {
        newSet.delete(promptId);
      } else {
        newSet.add(promptId);
      }
      return newSet;
    });
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

  const fetchFolders = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/folders`);
      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders || []);
      }
    } catch (err) {
      console.error('Failed to fetch folders:', err);
    }
  };

  const getRandomColor = () => {
    const usedColors = new Set(folders.map(f => f.color));
    const availableColors = folderColors.filter(color => !usedColors.has(color));
    
    if (availableColors.length === 0) {
      // If all colors are used, return a random one from the original list
      return folderColors[Math.floor(Math.random() * folderColors.length)];
    }
    
    return availableColors[Math.floor(Math.random() * availableColors.length)];
  };

  const createFolder = async () => {
    try {
      const folderData = {
        name: newFolder.name,
        color: getRandomColor()
      };
      
      const res = await fetch(`${BACKEND_URL}/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(folderData)
      });
      if (res.ok) {
        setFolderDialogOpen(false);
        setNewFolder({ name: '', color: '#667eea' });
        fetchFolders();
        setSuccess('Folder created successfully!');
      }
    } catch (err: any) {
      setError(err.message || 'Error creating folder');
    }
  };

  const deleteFolder = async (folderId: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/folders/${folderId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchFolders();
        setSuccess('Folder deleted successfully!');
      }
    } catch (err: any) {
      setError(err.message || 'Error deleting folder');
    }
  };

  const movePrompt = async () => {
    if (!selectedPromptToMove) return;
    
    try {
      const res = await fetch(`${BACKEND_URL}/prompts/${selectedPromptToMove.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: targetFolder })
      });
      if (res.ok) {
        setMoveDialogOpen(false);
        setSelectedPromptToMove(null);
        setTargetFolder('');
        fetchPrompts();
        setSuccess('Prompt moved successfully!');
      }
    } catch (err: any) {
      setError(err.message || 'Error moving prompt');
    }
  };

  const handleMovePrompt = (prompt: Prompt) => {
    setSelectedPromptToMove(prompt);
    setTargetFolder(prompt.folder || '');
    setMoveDialogOpen(true);
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
        setNewPrompt({ title: '', prompt: '', essay_link: '', folder: '' });
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

  const handleOpenInObsidian = (noteName: string, noteType: string) => {
    const prefix = noteType === 'idea' ? 'Idea - ' : 'Piece - ';
    const fileName = `${prefix}${noteName}.md`;
    const vaultPath = localStorage.getItem('obsidianVaultPath');
    if (!vaultPath) {
      setError('Please set your Obsidian vault path in the main page');
      return;
    }
    const fullPath = `${vaultPath}/${fileName}`;
    window.location.href = `obsidian://open?path=${encodeURIComponent(fullPath)}`;
  };

  const formatUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname + urlObj.pathname;
    } catch {
      return url.length > 30 ? url.substring(0, 30) + '...' : url;
    }
  };

  const openUrl = (url: string) => {
    window.open(url, '_blank');
  };

  const filteredPrompts = selectedFolder === 'all' 
    ? prompts 
    : prompts.filter(prompt => prompt.folder === selectedFolder);

  return (
    <Container disableGutters sx={{ py: 4, minHeight: 'calc(100vh - 64px)', px: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h3" fontWeight={700} sx={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Prompts & Essays
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Button
            variant="outlined"
            onClick={() => setFolderDialogOpen(true)}
            sx={{
              borderColor: 'rgba(102, 126, 234, 0.5)',
              color: '#e0e0e0',
              borderRadius: 2,
              fontWeight: 600,
              '&:hover': {
                borderColor: '#667eea',
                background: 'rgba(102, 126, 234, 0.1)'
              }
            }}
          >
            Manage Folders
          </Button>
          <Button
            variant="outlined"
            onClick={isListening ? stopVoiceRecognition : startVoiceRecognition}
            startIcon={isListening ? <MicOffIcon /> : <MicIcon />}
            sx={{
              borderColor: isListening ? '#ff5252' : 'rgba(102, 126, 234, 0.5)',
              color: isListening ? '#ff5252' : '#e0e0e0',
              borderRadius: 2,
              fontWeight: 600,
              '&:hover': {
                borderColor: isListening ? '#ff5252' : '#667eea',
                background: isListening ? 'rgba(255, 82, 82, 0.1)' : 'rgba(102, 126, 234, 0.1)'
              }
            }}
          >
            {isListening ? 'Stop Listening' : 'Voice Commands'}
          </Button>
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
      </Box>

      {/* Folder Filter */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ color: '#e0e0e0', mb: 2 }}>
          Filter by Folder:
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            label="All Prompts"
            onClick={() => setSelectedFolder('all')}
            color={selectedFolder === 'all' ? 'primary' : 'default'}
            sx={{
              borderRadius: 2,
              fontWeight: 600,
              background: selectedFolder === 'all' 
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                : 'rgba(40, 40, 60, 0.8)',
              color: selectedFolder === 'all' ? 'white' : '#e0e0e0',
              border: '1px solid rgba(102, 126, 234, 0.3)',
              '&:hover': {
                background: selectedFolder === 'all'
                  ? 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)'
                  : 'rgba(102, 126, 234, 0.1)'
              }
            }}
          />
          {folders.map((folder) => (
            <Chip
              key={folder.id}
              label={folder.name}
              onClick={() => setSelectedFolder(folder.id)}
              onDelete={(e) => {
                e.stopPropagation();
                deleteFolder(folder.id);
              }}
              color={selectedFolder === folder.id ? 'primary' : 'default'}
              sx={{
                borderRadius: 2,
                fontWeight: 600,
                background: selectedFolder === folder.id 
                  ? folder.color
                  : 'rgba(40, 40, 60, 0.8)',
                color: selectedFolder === folder.id ? 'white' : '#e0e0e0',
                border: `1px solid ${folder.color}40`,
                '&:hover': {
                  background: selectedFolder === folder.id
                    ? folder.color
                    : `${folder.color}20`
                },
                '& .MuiChip-deleteIcon': {
                  color: '#ff5252',
                  '&:hover': {
                    background: 'rgba(255, 82, 82, 0.1)',
                    color: '#ff5252'
                  }
                }
              }}
            />
          ))}
        </Box>
        
        {/* Voice Command Status */}
        {isListening && (
          <Box sx={{ mt: 2, p: 2, borderRadius: 2, background: 'rgba(255, 82, 82, 0.1)', border: '1px solid rgba(255, 82, 82, 0.3)' }}>
            <Typography variant="body2" sx={{ color: '#ff5252', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
              <MicIcon fontSize="small" />
              Listening for voice commands...
            </Typography>
            <Typography variant="caption" sx={{ color: '#b0b0b0', mt: 0.5, display: 'block' }}>
              Try saying: "show me Stanford", "all prompts", or any folder name
            </Typography>
          </Box>
        )}
        
        {voiceCommand && !isListening && (
          <Box sx={{ mt: 2, p: 2, borderRadius: 2, background: 'rgba(102, 126, 234, 0.1)', border: '1px solid rgba(102, 126, 234, 0.3)' }}>
            <Typography variant="body2" sx={{ color: '#667eea', fontWeight: 600 }}>
              Command: "{voiceCommand}"
            </Typography>
          </Box>
        )}
      </Box>

      {/* Grid Layout */}
      <Box sx={{ 
        display: 'grid',
        gridTemplateColumns: selectedFolder === 'all' 
          ? { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' }
          : { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
        gap: 3,
        maxHeight: 'calc(100vh - 200px)',
        overflow: 'auto'
      }}>
        {filteredPrompts.length === 0 ? (
          <Box sx={{ 
            gridColumn: '1 / -1', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            py: 8,
            color: '#b0b0b0'
          }}>
            <Typography variant="h6" sx={{ mb: 2, fontStyle: 'italic' }}>
              No prompts yet
            </Typography>
            <Typography variant="body2" sx={{ textAlign: 'center' }}>
              Click "Add Prompt" to get started with your first prompt and essay
            </Typography>
          </Box>
        ) : (
          filteredPrompts.map((prompt) => (
            <Card key={prompt.id} sx={{ 
              height: 'fit-content',
              borderRadius: 3,
              background: 'rgba(30, 30, 50, 0.95)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(102, 126, 234, 0.3)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
                border: '1px solid rgba(102, 126, 234, 0.5)'
              },
              transition: 'all 0.3s ease'
            }}>
              <CardContent sx={{ p: 3 }}>
                {/* Header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box sx={{ flex: 1, mr: 1 }}>
                    <Typography variant="h6" fontWeight={600} sx={{ 
                      color: '#ffffff',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: expandedCards.has(prompt.id) ? 'unset' : 2,
                      WebkitBoxOrient: 'vertical',
                      lineHeight: 1.3
                    }}>
                      {prompt.title}
                    </Typography>
                    {prompt.folder && (
                      <Chip
                        label={folders.find(f => f.id === prompt.folder)?.name || 'Unknown Folder'}
                        size="small"
                        sx={{
                          mt: 0.5,
                          background: folders.find(f => f.id === prompt.folder)?.color || '#667eea',
                          color: 'white',
                          fontSize: '0.7rem',
                          height: 20
                        }}
                      />
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton 
                      onClick={() => toggleCardExpansion(prompt.id)}
                      size="small"
                      sx={{ 
                        color: '#b0b0b0',
                        '&:hover': { background: 'rgba(102, 126, 234, 0.1)' }
                      }}
                    >
                      {expandedCards.has(prompt.id) ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                    </IconButton>
                    <IconButton 
                      onClick={() => handleMovePrompt(prompt)}
                      size="small"
                      sx={{ 
                        color: '#b0b0b0',
                        '&:hover': { background: 'rgba(102, 126, 234, 0.1)' }
                      }}
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                    <IconButton 
                      onClick={() => deletePrompt(prompt.id)}
                      size="small"
                      sx={{ 
                        color: '#ff5252',
                        '&:hover': { background: 'rgba(255, 82, 82, 0.1)' }
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
                
                {/* Prompt Content */}
                <Typography variant="body2" sx={{ 
                  mb: 2, 
                  color: '#e0e0e0', 
                  lineHeight: 1.5,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: expandedCards.has(prompt.id) ? 'unset' : 3,
                  WebkitBoxOrient: 'vertical',
                  minHeight: expandedCards.has(prompt.id) ? 'auto' : '4.5em'
                }}>
                  {prompt.prompt}
                </Typography>
                
                {/* Essay Link */}
                {prompt.essay_link && (
                  <Box sx={{ mb: 2, p: 1.5, borderRadius: 2, background: 'rgba(20, 20, 40, 0.8)' }}>
                    <Typography variant="caption" color="#b0b0b0" sx={{ display: 'block', mb: 0.5 }}>
                      Essay Link:
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography 
                        variant="body2" 
                        onClick={() => openUrl(prompt.essay_link)}
                        sx={{ 
                          wordBreak: 'break-all', 
                          color: '#667eea',
                          fontSize: '0.75rem',
                          overflow: expandedCards.has(prompt.id) ? 'visible' : 'hidden',
                          textOverflow: expandedCards.has(prompt.id) ? 'unset' : 'ellipsis',
                          whiteSpace: expandedCards.has(prompt.id) ? 'normal' : 'nowrap',
                          flex: 1,
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          '&:hover': { 
                            color: '#8b9dc3',
                            textDecoration: 'underline'
                          }
                        }}
                      >
                        {formatUrl(prompt.essay_link)}
                      </Typography>
                      <IconButton 
                        size="small"
                        onClick={() => copyToClipboard(prompt.essay_link)}
                        sx={{ color: '#b0b0b0', p: 0.5 }}
                      >
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                )}
                
                {/* Drafts Section */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="#b0b0b0">
                    Drafts: {prompt.drafts?.length || 0}
                  </Typography>
                  {prompt.drafts && prompt.drafts.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      {prompt.drafts.map((draft: any) => (
                        <Box key={draft.id} sx={{ 
                          p: 1, 
                          mb: 0.5, 
                          borderRadius: 1, 
                          backgroundColor: 'rgba(20, 20, 40, 0.8)', 
                          border: '1px solid rgba(102, 126, 234, 0.1)' 
                        }}>
                          <Typography 
                            variant="caption" 
                            fontWeight={500} 
                            sx={{ 
                              color: '#667eea', 
                              display: 'block',
                              cursor: 'pointer',
                              textDecoration: 'underline',
                              '&:hover': { color: '#8b9dc3' }
                            }}
                            onClick={() => handleOpenInObsidian(draft.title, 'piece')}
                          >
                            {draft.title}
                          </Typography>
                          {expandedCards.has(prompt.id) && (
                            <Box sx={{ mt: 0.5 }}>
                              <Typography 
                                variant="caption" 
                                sx={{ 
                                  color: '#e0e0e0', 
                                  display: 'block', 
                                  mb: 0.5,
                                  cursor: 'pointer',
                                  textDecoration: 'underline',
                                  '&:hover': { color: '#ffffff' },
                                  wordBreak: 'break-all',
                                  fontSize: '0.7rem'
                                }}
                                onClick={() => openUrl(draft.link)}
                                title={draft.link}
                              >
                                {formatUrl(draft.link)}
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 0.5 }}>
                                <IconButton 
                                  size="small"
                                  onClick={() => copyToClipboard(draft.link)}
                                  sx={{ color: '#b0b0b0', p: 0.5 }}
                                >
                                  <ContentCopyIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() => deleteDraft(prompt.id, draft.id)}
                                  sx={{ color: '#ff5252', p: 0.5 }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            </Box>
                          )}
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
                
                {/* Action Buttons */}
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<SearchIcon />}
                    onClick={() => handleSearchPrompt(prompt.prompt)}
                    sx={{
                      borderColor: 'rgba(102, 126, 234, 0.5)',
                      color: '#e0e0e0',
                      fontSize: '0.75rem',
                      '&:hover': {
                        borderColor: '#667eea',
                        background: 'rgba(102, 126, 234, 0.1)'
                      }
                    }}
                  >
                    Search
                  </Button>
                  
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      setSelectedPromptId(prompt.id);
                      setDraftDialogOpen(true);
                    }}
                    sx={{
                      borderColor: 'rgba(76, 175, 80, 0.5)',
                      color: '#e0e0e0',
                      fontSize: '0.75rem',
                      '&:hover': {
                        borderColor: '#4caf50',
                        background: 'rgba(76, 175, 80, 0.1)'
                      }
                    }}
                  >
                    Add Draft
                  </Button>
                </Box>
                
                {/* Status */}
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
          <FormControl fullWidth sx={{ mt: 3 }}>
            <InputLabel id="folder-select-label" sx={{ color: '#b0b0b0' }}>Folder</InputLabel>
            <Select
              labelId="folder-select-label"
              value={newPrompt.folder}
              label="Folder"
              onChange={(e) => setNewPrompt({ ...newPrompt, folder: e.target.value as string })}
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
            >
              <MenuItem value="">None</MenuItem>
              {folders.map((folder) => (
                <MenuItem key={folder.id} value={folder.id}>
                  {folder.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
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

      {/* Manage Folders Dialog */}
      <Dialog open={folderDialogOpen} onClose={() => setFolderDialogOpen(false)} maxWidth="sm" fullWidth
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
          Manage Folders
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Add New Folder
          </Typography>
          <TextField
            label="Folder Name"
            value={newFolder.name}
            onChange={(e) => setNewFolder({ ...newFolder, name: e.target.value })}
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
            placeholder="Enter folder name"
          />
          <Button
            variant="contained"
            onClick={createFolder}
            disabled={!newFolder.name.trim()}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              '&:hover': {
                background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)'
              },
              '&:disabled': {
                background: 'rgba(80, 80, 100, 0.5)',
                color: '#666666'
              }
            }}
          >
            Create Folder
          </Button>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setFolderDialogOpen(false)} sx={{ 
            color: '#b0b0b0',
            '&:hover': { background: 'rgba(102, 126, 234, 0.1)' }
          }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Move Prompt Dialog */}
      <Dialog open={moveDialogOpen} onClose={() => setMoveDialogOpen(false)} maxWidth="sm" fullWidth
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
          Move Prompt
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Typography variant="body2" sx={{ mb: 2, color: '#e0e0e0' }}>
            Current Folder: <strong>{selectedPromptToMove?.folder ? folders.find(f => f.id === selectedPromptToMove.folder)?.name : 'None'}</strong>
          </Typography>
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel id="move-folder-select-label" sx={{ color: '#b0b0b0' }}>Move to Folder</InputLabel>
            <Select
              labelId="move-folder-select-label"
              value={targetFolder}
              label="Move to Folder"
              onChange={(e) => setTargetFolder(e.target.value as string)}
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
                },
                '& .MuiSelect-icon': {
                  color: '#b0b0b0'
                }
              }}
              MenuProps={{
                PaperProps: {
                  sx: {
                    background: 'rgba(40, 40, 60, 0.95)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(102, 126, 234, 0.3)',
                    '& .MuiMenuItem-root': {
                      color: '#ffffff',
                      '&:hover': {
                        background: 'rgba(102, 126, 234, 0.2)'
                      },
                      '&.Mui-selected': {
                        background: 'rgba(102, 126, 234, 0.3)',
                        '&:hover': {
                          background: 'rgba(102, 126, 234, 0.4)'
                        }
                      }
                    }
                  }
                }
              }}
            >
              <MenuItem value="">None (No Folder)</MenuItem>
              {folders.map((folder) => (
                <MenuItem key={folder.id} value={folder.id}>
                  {folder.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setMoveDialogOpen(false)} sx={{ 
            color: '#b0b0b0',
            '&:hover': { background: 'rgba(102, 126, 234, 0.1)' }
          }}>
            Cancel
          </Button>
          <Button onClick={movePrompt} variant="contained" sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            '&:hover': {
              background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)'
            }
          }}>
            Move Prompt
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