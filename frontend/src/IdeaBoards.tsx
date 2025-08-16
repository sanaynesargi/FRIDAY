import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import ForceGraph2D from 'react-force-graph-2d';
import type { ForceGraphMethods } from 'react-force-graph-2d';

const BACKEND_URL = 'http://localhost:8000';

interface Node {
  id: string;
  name: string;
  type: 'idea' | 'piece';
  external?: boolean;
  x?: number;
  y?: number;
  color?: string;
  size?: number;
}

interface Edge {
  source: string;
  target: string;
  id: string;
  note?: string;
  sourceName?: string;
  targetName?: string;
  color?: string;
  width?: number;
}

interface GraphData {
  nodes: Node[];
  links: Edge[];
}

interface IdeaBoard {
  id: string;
  name: string;
  description: string;
  nodes: Node[];
  edges: Edge[];
  created: number;
  modified: number;
}

interface Note {
  name: string;
  type: 'idea' | 'piece';
  external?: boolean;
}

function IdeaBoards() {
  const [boards, setBoards] = useState<IdeaBoard[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<IdeaBoard | null>(null);
  const [availableNotes, setAvailableNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  
  // Dialog states
  const [boardDialogOpen, setBoardDialogOpen] = useState(false);
  const [newBoard, setNewBoard] = useState({ name: '', description: '' });
  const [edgeDialogOpen, setEdgeDialogOpen] = useState(false);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [edgeNote, setEdgeNote] = useState('');
  const [addNodeDialogOpen, setAddNodeDialogOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState('');
  const [noteSearchQuery, setNoteSearchQuery] = useState('');
  
  // Graph interaction states
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const graphRef = useRef<ForceGraphMethods | undefined>(undefined);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [connectSource, setConnectSource] = useState('');
  const [connectTarget, setConnectTarget] = useState('');
  const [vaultPath, setVaultPath] = useState<string>(() => localStorage.getItem('obsidianVaultPath') || '');

  // Load boards and notes on component mount
  useEffect(() => {
    fetchBoards();
    fetchAvailableNotes();
  }, []);

  // Update graph data when selected board changes
  useEffect(() => {
    if (selectedBoard) {
      const nodes = selectedBoard.nodes.map(node => ({
        ...node,
        color: node.external ? '#ff9800' : (node.type === 'idea' ? '#4caf50' : '#2196f3'),
        size: node.external ? 12 : 8
      }));
      
      const links = selectedBoard.edges.map(edge => ({
        ...edge,
        color: edge.note ? '#ff9800' : '#b0b0b0',
        width: edge.note ? 3 : 1
      }));
      
      setGraphData({ nodes, links });
    }
  }, [selectedBoard]);

  const fetchBoards = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/idea_boards`);
      if (res.ok) {
        const data = await res.json();
        setBoards(data.boards || []);
      }
    } catch (err) {
      console.error('Failed to fetch boards:', err);
    }
  };

  const fetchAvailableNotes = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/all_notes`);
      if (res.ok) {
        const data = await res.json();
        setAvailableNotes(data.notes || []);
      }
    } catch (err) {
      console.error('Failed to fetch notes:', err);
    }
  };

  const createBoard = async () => {
    if (!newBoard.name.trim()) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/idea_boards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBoard)
      });
      if (res.ok) {
        setBoardDialogOpen(false);
        setNewBoard({ name: '', description: '' });
        fetchBoards();
        setSuccess('Board created successfully!');
      }
    } catch (err: any) {
      setError(err.message || 'Error creating board');
    } finally {
      setLoading(false);
    }
  };

  const deleteBoard = async (boardId: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/idea_boards/${boardId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        if (selectedBoard?.id === boardId) {
          setSelectedBoard(null);
        }
        fetchBoards();
        setSuccess('Board deleted successfully!');
      }
    } catch (err: any) {
      setError(err.message || 'Error deleting board');
    }
  };

  const addNodeToBoard = async () => {
    if (!selectedBoard || !selectedNote) return;
    
    const note = availableNotes.find(n => n.name === selectedNote);
    if (!note) return;
    
    const newNode: Node = {
      id: selectedNote,
      name: selectedNote,
      type: note.type,
      external: note.external
    };
    
    const updatedBoard = {
      ...selectedBoard,
      nodes: [...selectedBoard.nodes, newNode],
      modified: Date.now()
    };
    
    try {
      const res = await fetch(`${BACKEND_URL}/idea_boards/${selectedBoard.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedBoard)
      });
      if (res.ok) {
        setSelectedBoard(updatedBoard);
        setAddNodeDialogOpen(false);
        setSelectedNote('');
        fetchBoards();
        setSuccess('Node added successfully!');
      }
    } catch (err: any) {
      setError(err.message || 'Error adding node');
    }
  };

  const removeNodeFromBoard = async (nodeId: string) => {
    if (!selectedBoard) return;
    
    const updatedBoard = {
      ...selectedBoard,
      nodes: selectedBoard.nodes.filter(n => n.id !== nodeId),
      edges: selectedBoard.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
      modified: Date.now()
    };
    
    try {
      const res = await fetch(`${BACKEND_URL}/idea_boards/${selectedBoard.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedBoard)
      });
      if (res.ok) {
        setSelectedBoard(updatedBoard);
        fetchBoards();
        setSuccess('Node removed successfully!');
      }
    } catch (err: any) {
      setError(err.message || 'Error removing node');
    }
  };

  const addEdge = async (sourceId: string, targetId: string) => {
    if (!selectedBoard) return;
    
    const sourceNode = selectedBoard.nodes.find(n => n.id === sourceId);
    const targetNode = selectedBoard.nodes.find(n => n.id === targetId);
    
    if (!sourceNode || !targetNode) return;
    
    const edgeId = `${sourceId}-${targetId}`;
    const reverseEdgeId = `${targetId}-${sourceId}`;
    
    // Check if connection already exists
    const existingEdge = selectedBoard.edges.find(e => e.id === edgeId || e.id === reverseEdgeId);
    if (existingEdge) {
      setError('Connection already exists between these nodes');
      return;
    }
    
    const newEdge: Edge = {
      source: sourceId,
      target: targetId,
      id: edgeId,
      sourceName: sourceNode.name,
      targetName: targetNode.name
    };
    
    const updatedBoard = {
      ...selectedBoard,
      edges: [...selectedBoard.edges, newEdge],
      modified: Date.now()
    };
    
    try {
      const res = await fetch(`${BACKEND_URL}/idea_boards/${selectedBoard.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedBoard)
      });
      if (res.ok) {
        setSelectedBoard(updatedBoard);
        setConnectSource('');
        setConnectTarget('');
        fetchBoards();
        setSuccess('Connection created successfully!');
      }
    } catch (err: any) {
      setError(err.message || 'Error creating connection');
    }
  };

  const updateEdgeNote = async () => {
    if (!selectedBoard || !selectedEdge) return;
    
    const updatedBoard = {
      ...selectedBoard,
      edges: selectedBoard.edges.map(edge => 
        edge.id === selectedEdge.id 
          ? { ...edge, note: edgeNote }
          : edge
      ),
      modified: Date.now()
    };
    
    try {
      const res = await fetch(`${BACKEND_URL}/idea_boards/${selectedBoard.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedBoard)
      });
      if (res.ok) {
        setSelectedBoard(updatedBoard);
        setEdgeDialogOpen(false);
        setSelectedEdge(null);
        setEdgeNote('');
        fetchBoards();
        setSuccess('Edge note updated successfully!');
      }
    } catch (err: any) {
      setError(err.message || 'Error updating edge note');
    }
  };

  const removeEdge = async (edgeId: string) => {
    if (!selectedBoard) return;
    
    const updatedBoard = {
      ...selectedBoard,
      edges: selectedBoard.edges.filter(e => e.id !== edgeId),
      modified: Date.now()
    };
    
    try {
      const res = await fetch(`${BACKEND_URL}/idea_boards/${selectedBoard.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedBoard)
      });
      if (res.ok) {
        setSelectedBoard(updatedBoard);
        fetchBoards();
        setSuccess('Connection removed successfully!');
      }
    } catch (err: any) {
      setError(err.message || 'Error removing connection');
    }
  };

  const handleNodeClick = useCallback((node: Node) => {
    const prefix = node.type === 'idea' ? 'Idea - ' : 'Piece - ';
    const fileName = `${prefix}${node.name}.md`;
    if (!vaultPath) {
      setError('Please set your Obsidian vault path in the main page first');
      return;
    }
    const fullPath = `${vaultPath}/UndergraduateAdmission/${fileName}`;
    window.location.href = `obsidian://open?path=${encodeURIComponent(fullPath)}`;
  }, [vaultPath]);

  const handleLinkClick = useCallback((link: Edge) => {
    setSelectedEdge(link);
    setEdgeNote(link.note || '');
    setEdgeDialogOpen(true);
  }, []);

  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Function to handle opening in Obsidian
  const handleOpenInObsidian = (noteName: string, noteType: string) => {
    const prefix = noteType === 'idea' ? 'Idea - ' : 'Piece - ';
    const fileName = `${prefix}${noteName}.md`;
    if (!vaultPath) {
      setError('Please set your Obsidian vault path in the main page first');
      return;
    }
    const fullPath = `${vaultPath}/UndergraduateAdmission/${fileName}`;
    window.location.href = `obsidian://open?path=${encodeURIComponent(fullPath)}`;
  };

  return (
    <Container disableGutters sx={{ py: 4, height: 'calc(100vh - 64px)', overflow: 'hidden', px: 2 }}>
      <Typography variant="h3" gutterBottom fontWeight={700} sx={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        mb: 4
      }}>
        Idea Boards
      </Typography>

      <Box sx={{ display: 'flex', gap: 3, height: 'calc(100vh - 200px)', overflow: 'hidden' }}>
        {/* Left Panel - Board Management */}
        <Box sx={{ width: 300, display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
          <Card elevation={8} sx={{ 
            borderRadius: 3,
            background: 'rgba(30, 30, 50, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(102, 126, 234, 0.3)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            flexShrink: 0
          }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" fontWeight={600} sx={{ color: '#667eea' }}>
                  Boards
                </Typography>
                <Button
                  onClick={() => setBoardDialogOpen(true)}
                  sx={{
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #4caf50 0%, #66bb6a 100%)',
                    color: 'white',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #43a047 0%, #5cb85c 100%)'
                    }
                  }}
                >
                  New Board
                </Button>
              </Box>
              
              <List sx={{ maxHeight: 200, overflow: 'auto' }}>
                {boards.map((board) => (
                  <ListItem
                    key={board.id}
                    onClick={() => setSelectedBoard(board)}
                    sx={{
                      borderRadius: 2,
                      mb: 1,
                      background: selectedBoard?.id === board.id ? 'rgba(102, 126, 234, 0.2)' : 'transparent',
                      '&:hover': {
                        background: 'rgba(102, 126, 234, 0.1)'
                      },
                      cursor: 'pointer'
                    }}
                  >
                    <ListItemText
                      primary={board.name}
                      secondary={`${board.nodes.length} nodes, ${board.edges.length} connections`}
                      primaryTypographyProps={{ color: '#e0e0e0', fontWeight: 600 }}
                      secondaryTypographyProps={{ color: '#b0b0b0' }}
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteBoard(board.id);
                        }}
                        sx={{ color: '#ff5252' }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>

          {/* Selected Board Details */}
          {selectedBoard && (
            <Card elevation={8} sx={{ 
              borderRadius: 3,
              background: 'rgba(30, 30, 50, 0.95)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(102, 126, 234, 0.3)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
              flex: 1,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <CardContent sx={{ p: 3, overflow: 'auto', flex: 1 }}>
                <Typography variant="h6" fontWeight={600} sx={{ color: '#667eea', mb: 2 }}>
                  {selectedBoard.name}
                </Typography>
                <Typography variant="body2" color="#b0b0b0" sx={{ mb: 3 }}>
                  {selectedBoard.description}
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 1, mb: 3, flexShrink: 0 }}>
                  <Button
                    onClick={() => setAddNodeDialogOpen(true)}
                    size="small"
                    sx={{
                      borderRadius: 2,
                      background: 'linear-gradient(135deg, #4caf50 0%, #66bb6a 100%)',
                      color: 'white',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #43a047 0%, #5cb85c 100%)'
                      }
                    }}
                  >
                    Add Node
                  </Button>
                  <Button
                    onClick={() => setConnectDialogOpen(true)}
                    size="small"
                    sx={{
                      borderRadius: 2,
                      background: 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)',
                      color: 'white',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #f57c00 0%, #ffa726 100%)'
                      }
                    }}
                  >
                    Connect
                  </Button>
                </Box>

                {/* Nodes List */}
                <Typography variant="subtitle2" color="#b0b0b0" sx={{ mb: 1 }}>
                  Nodes ({selectedBoard.nodes.length})
                </Typography>
                <List dense sx={{ maxHeight: 120, overflow: 'auto', mb: 2 }}>
                  {selectedBoard.nodes.map((node) => (
                    <ListItem key={node.id} sx={{ py: 0.5 }}>
                      <ListItemText
                        primary={node.name}
                        secondary={node.type}
                        primaryTypographyProps={{ color: '#e0e0e0', fontSize: '0.875rem' }}
                        secondaryTypographyProps={{ color: '#b0b0b0', fontSize: '0.75rem' }}
                        sx={{ cursor: 'pointer' }}
                        onClick={() => handleOpenInObsidian(node.name, node.type)}
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          size="small"
                          onClick={() => removeNodeFromBoard(node.id)}
                          sx={{ color: '#ff5252' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>

                {/* Edges List */}
                <Typography variant="subtitle2" color="#b0b0b0" sx={{ mb: 1 }}>
                  Connections ({selectedBoard.edges.length})
                </Typography>
                <List dense sx={{ maxHeight: 120, overflow: 'auto' }}>
                  {selectedBoard.edges.map((edge) => (
                    <ListItem key={edge.id} sx={{ py: 0.5 }}>
                      <ListItemText
                        primary={`${edge.sourceName} → ${edge.targetName}`}
                        secondary={edge.note ? `Note: ${edge.note.substring(0, 30)}...` : 'No note'}
                        primaryTypographyProps={{ color: '#e0e0e0', fontSize: '0.875rem' }}
                        secondaryTypographyProps={{ color: '#b0b0b0', fontSize: '0.75rem' }}
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          size="small"
                          onClick={() => removeEdge(edge.id)}
                          sx={{ color: '#ff5252' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          )}
        </Box>

        {/* Right Panel - Graph Visualization */}
        <Box sx={{ flex: 1 }}>
          <Card elevation={8} sx={{ 
            borderRadius: 3,
            background: 'rgba(30, 30, 50, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(102, 126, 234, 0.3)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            height: '100%'
          }}>
            <CardContent sx={{ p: 3, height: '100%' }}>
              {selectedBoard ? (
                <Box sx={{ height: '100%', position: 'relative' }}>
                  <ForceGraph2D
                    ref={graphRef as any}
                    graphData={graphData}
                    nodeLabel={(node: Node) => `${node.name} (${node.type})`}
                    linkLabel={(link: Edge) => link.note || 'Click to add note'}
                    nodeColor={(node: Node) => node.color || '#667eea'}
                    linkColor={(link: Edge) => link.color || '#b0b0b0'}
                    linkWidth={(link: Edge) => link.width || 1}
                    onNodeClick={handleNodeClick}
                    onLinkClick={handleLinkClick}
                    onBackgroundClick={handleBackgroundClick}
                    backgroundColor="rgba(30, 30, 50, 0.95)"
                    linkDirectionalParticles={2}
                    linkDirectionalParticleSpeed={0.005}
                    cooldownTicks={100}
                    nodeCanvasObject={(node: Node, ctx, globalScale) => {
                      const label = node.name;
                      const fontSize = 12/globalScale;
                      ctx.font = `${fontSize}px Sans-Serif`;
                      const textWidth = ctx.measureText(label).width;
                      const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2);

                      ctx.fillStyle = 'rgba(30, 30, 50, 0.8)';
                      if (node.x !== undefined && node.y !== undefined) {
                        ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);

                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillStyle = '#e0e0e0';
                        ctx.fillText(label, node.x, node.y);

                        if (node.external) {
                          ctx.fillStyle = '#ff9800';
                          ctx.beginPath();
                          ctx.arc(node.x + bckgDimensions[0] / 2 + 5, node.y, 3, 0, 2 * Math.PI);
                          ctx.fill();
                        }

                        else if (node.type === 'idea') {
                          ctx.fillStyle = '#4caf50';
                          ctx.beginPath();
                          ctx.arc(node.x + bckgDimensions[0] / 2 + 5, node.y, 3, 0, 2 * Math.PI);
                          ctx.fill();
                        }

                        else if (node.type === 'piece') {
                          ctx.fillStyle = '#2196f3';
                          ctx.beginPath();
                          ctx.arc(node.x + bckgDimensions[0] / 2 + 5, node.y, 3, 0, 2 * Math.PI);
                          ctx.fill();
                        }
                      }
                    }}
                  />
                  
                  {/* Selected Node Info */}
                  {selectedNode && (
                    <Paper sx={{
                      position: 'absolute',
                      top: 16,
                      right: 16,
                      p: 2,
                      background: 'rgba(30, 30, 50, 0.95)',
                      border: '1px solid rgba(102, 126, 234, 0.3)',
                      borderRadius: 2
                    }}>
                      <Typography variant="h6" color="#667eea" fontWeight={600}>
                        {selectedNode.name}
                      </Typography>
                      <Chip 
                        label={selectedNode.type} 
                        size="small" 
                        color={selectedNode.type === 'idea' ? 'success' : 'info'}
                        sx={{ mt: 1 }}
                      />
                      {selectedNode.external && (
                        <Chip label="EXTERN" color="warning" size="small" sx={{ mt: 1, ml: 1 }} />
                      )}
                    </Paper>
                  )}
                </Box>
              ) : (
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  height: '100%',
                  color: '#b0b0b0'
                }}>
                  <Typography variant="h6">
                    Select a board to view the graph
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Create Board Dialog */}
      <Dialog 
        open={boardDialogOpen} 
        onClose={() => setBoardDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
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
          color: '#e0e0e0',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          fontWeight: 700
        }}>
          Create New Idea Board
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <TextField
            label="Board Name"
            value={newBoard.name}
            onChange={(e) => setNewBoard({ ...newBoard, name: e.target.value })}
            fullWidth
            sx={{ 
              mt: 2, 
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
          <TextField
            label="Description"
            value={newBoard.description}
            onChange={(e) => setNewBoard({ ...newBoard, description: e.target.value })}
            fullWidth
            multiline
            rows={3}
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
          />
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button 
            onClick={() => setBoardDialogOpen(false)}
            sx={{ 
              color: '#b0b0b0',
              '&:hover': { background: 'rgba(102, 126, 234, 0.1)' }
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={createBoard} 
            disabled={loading || !newBoard.name.trim()}
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
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Node Dialog */}
      <Dialog 
        open={addNodeDialogOpen} 
        onClose={() => setAddNodeDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
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
          color: '#e0e0e0',
          background: 'linear-gradient(135deg, #4caf50 0%, #66bb6a 100%)',
          fontWeight: 700
        }}>
          Add Node to Board
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <TextField
            label="Search Notes"
            value={noteSearchQuery}
            onChange={(e) => setNoteSearchQuery(e.target.value)}
            fullWidth
            sx={{ 
              mt: 2, 
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
            placeholder="Type to search for notes..."
          />
          
          <Box sx={{ maxHeight: 300, overflow: 'auto', mt: 2 }}>
            <List dense>
              {availableNotes
                .filter(note => !selectedBoard?.nodes.find(n => n.id === note.name))
                .filter(note => 
                  note.name.toLowerCase().includes(noteSearchQuery.toLowerCase()) ||
                  note.type.toLowerCase().includes(noteSearchQuery.toLowerCase())
                )
                .map((note) => (
                  <ListItem
                    key={note.name}
                    onClick={() => setSelectedNote(note.name)}
                    sx={{
                      borderRadius: 2,
                      mb: 1,
                      background: selectedNote === note.name ? 'rgba(102, 126, 234, 0.2)' : 'transparent',
                      '&:hover': {
                        background: 'rgba(102, 126, 234, 0.1)'
                      },
                      cursor: 'pointer'
                    }}
                  >
                    <ListItemText
                      primary={note.name}
                      secondary={note.type}
                      primaryTypographyProps={{ color: '#e0e0e0', fontWeight: 600 }}
                      secondaryTypographyProps={{ color: '#b0b0b0' }}
                    />
                    {note.external && (
                      <Chip label="EXTERN" size="small" color="warning" />
                    )}
                  </ListItem>
                ))}
            </List>
            {availableNotes
              .filter(note => !selectedBoard?.nodes.find(n => n.id === note.name))
              .filter(note => 
                note.name.toLowerCase().includes(noteSearchQuery.toLowerCase()) ||
                note.type.toLowerCase().includes(noteSearchQuery.toLowerCase())
              ).length === 0 && (
              <Typography variant="body2" color="#b0b0b0" sx={{ textAlign: 'center', py: 2 }}>
                No notes found matching your search
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button 
            onClick={() => {
              setAddNodeDialogOpen(false);
              setNoteSearchQuery('');
              setSelectedNote('');
            }}
            sx={{ 
              color: '#b0b0b0',
              '&:hover': { background: 'rgba(102, 126, 234, 0.1)' }
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={() => {
              addNodeToBoard();
              setNoteSearchQuery('');
            }}
            disabled={!selectedNote}
            sx={{
              background: 'linear-gradient(135deg, #4caf50 0%, #66bb6a 100%)',
              color: 'white',
              '&:hover': {
                background: 'linear-gradient(135deg, #43a047 0%, #5cb85c 100%)'
              },
              '&:disabled': {
                background: 'rgba(80, 80, 100, 0.5)',
                color: '#666666'
              }
            }}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Connect Dialog */}
      <Dialog 
        open={connectDialogOpen} 
        onClose={() => setConnectDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
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
          color: '#e0e0e0',
          background: 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)',
          fontWeight: 700
        }}>
          Create Connection
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <FormControl fullWidth sx={{ mt: 2, mb: 2 }}>
            <InputLabel sx={{ color: '#b0b0b0' }}>Source Node</InputLabel>
            <Select
              value={connectSource}
              onChange={(e: SelectChangeEvent) => setConnectSource(e.target.value)}
              label="Source Node"
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
              {selectedBoard?.nodes.map((node) => (
                <MenuItem key={node.id} value={node.id}>
                  {node.name} ({node.type})
                  {node.external && <Chip label="EXTERN" size="small" sx={{ ml: 1 }} />}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel sx={{ color: '#b0b0b0' }}>Target Node</InputLabel>
            <Select
              value={connectTarget}
              onChange={(e: SelectChangeEvent) => setConnectTarget(e.target.value)}
              label="Target Node"
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
              {selectedBoard?.nodes
                .filter(node => node.id !== connectSource)
                .map((node) => (
                  <MenuItem key={node.id} value={node.id}>
                    {node.name} ({node.type})
                    {node.external && <Chip label="EXTERN" size="small" sx={{ ml: 1 }} />}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button 
            onClick={() => setConnectDialogOpen(false)}
            sx={{ 
              color: '#b0b0b0',
              '&:hover': { background: 'rgba(102, 126, 234, 0.1)' }
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={() => {
              if (connectSource && connectTarget) {
                addEdge(connectSource, connectTarget);
                setConnectDialogOpen(false);
              }
            }}
            disabled={!connectSource || !connectTarget}
            sx={{
              background: 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)',
              color: 'white',
              '&:hover': {
                background: 'linear-gradient(135deg, #f57c00 0%, #ffa726 100%)'
              },
              '&:disabled': {
                background: 'rgba(80, 80, 100, 0.5)',
                color: '#666666'
              }
            }}
          >
            Connect
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edge Note Dialog */}
      <Dialog 
        open={edgeDialogOpen} 
        onClose={() => setEdgeDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
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
          color: '#e0e0e0',
          background: 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)',
          fontWeight: 700
        }}>
          {selectedEdge ? `Add Note to Connection: ${selectedEdge.sourceName} → ${selectedEdge.targetName}` : 'Add Note to Connection'}
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <TextField
            label="Connection Note"
            value={edgeNote}
            onChange={(e) => setEdgeNote(e.target.value)}
            fullWidth
            multiline
            rows={4}
            sx={{ 
              mt: 2,
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
            placeholder="Describe the relationship or connection between these notes..."
          />
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button 
            onClick={() => setEdgeDialogOpen(false)}
            sx={{ 
              color: '#b0b0b0',
              '&:hover': { background: 'rgba(102, 126, 234, 0.1)' }
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={updateEdgeNote}
            sx={{
              background: 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)',
              color: 'white',
              '&:hover': {
                background: 'linear-gradient(135deg, #f57c00 0%, #ffa726 100%)'
              }
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success/Error Messages */}
      <Snackbar open={!!success} autoHideDuration={6000} onClose={() => setSuccess('')}>
        <Alert onClose={() => setSuccess('')} severity="success">
          {success}
        </Alert>
      </Snackbar>
      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError('')}>
        <Alert onClose={() => setError('')} severity="error">
          {error}
        </Alert>
      </Snackbar>
    </Container>
  );
}

export default IdeaBoards; 