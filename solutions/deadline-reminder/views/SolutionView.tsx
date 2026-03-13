import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Alert,
  Stack,
  Skeleton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';

interface Deadline {
  id: string;
  title: string;
  description?: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'completed' | 'overdue';
  category?: string;
}

export default function DeadlineReminder() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState<Deadline | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dueDate: '',
    priority: 'medium' as const,
    category: ''
  });

  useEffect(() => {
    fetchDeadlines();
  }, []);

  const fetchDeadlines = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3000/deadlines');
      if (!response.ok) throw new Error('Failed to fetch deadlines');
      const data = await response.json();
      setDeadlines(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDeadline = async () => {
    try {
      const method = editingDeadline ? 'PUT' : 'POST';
      const url = editingDeadline 
        ? `http://localhost:3000/deadlines/${editingDeadline.id}`
        : 'http://localhost:3000/deadlines';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Failed to save deadline');
      
      await fetchDeadlines();
      handleCloseDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save deadline');
    }
  };

  const handleDeleteDeadline = async (id: string) => {
    try {
      const response = await fetch(`http://localhost:3000/deadlines/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete deadline');
      await fetchDeadlines();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete deadline');
    }
  };

  const handleOpenDialog = (deadline?: Deadline) => {
    if (deadline) {
      setEditingDeadline(deadline);
      setFormData({
        title: deadline.title,
        description: deadline.description || '',
        dueDate: deadline.dueDate.split('T')[0],
        priority: deadline.priority,
        category: deadline.category || ''
      });
    } else {
      setEditingDeadline(null);
      setFormData({
        title: '',
        description: '',
        dueDate: '',
        priority: 'medium',
        category: ''
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingDeadline(null);
  };

  const getDaysUntilDeadline = (dueDate: string) => {
    const today = new Date();
    const deadline = new Date(dueDate);
    const diffTime = deadline.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string, daysUntil: number) => {
    if (status === 'overdue' || daysUntil < 0) return 'error';
    if (daysUntil <= 3) return 'warning';
    if (status === 'completed') return 'success';
    return 'default';
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Skeleton variant="text" width={200} height={40} />
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={120} />
          ))}
        </Stack>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={fetchDeadlines}>
          Retry
        </Button>
      </Box>
    );
  }

  const upcomingDeadlines = deadlines
    .filter(d => d.status !== 'completed')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1">
          Deadline Reminders
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add Deadline
        </Button>
      </Stack>

      {upcomingDeadlines.length === 0 ? (
        <Alert severity="info" sx={{ display: 'flex', alignItems: 'center' }}>
          <ScheduleIcon sx={{ mr: 1 }} />
          No upcoming deadlines. You're all caught up!
        </Alert>
      ) : (
        <Stack spacing={2}>
          {upcomingDeadlines.map((deadline) => {
            const daysUntil = getDaysUntilDeadline(deadline.dueDate);
            const isUrgent = daysUntil <= 3 && daysUntil >= 0;
            const isOverdue = daysUntil < 0;

            return (
              <Card
                key={deadline.id}
                sx={{
                  border: isOverdue ? '2px solid' : isUrgent ? '1px solid' : 'none',
                  borderColor: isOverdue ? 'error.main' : isUrgent ? 'warning.main' : 'transparent',
                  bgcolor: isOverdue ? 'error.light' : isUrgent ? 'warning.light' : 'background.paper',
                  opacity: isOverdue ? 0.9 : 1
                }}
              >
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box sx={{ flex: 1 }}>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                        <Typography variant="h6" component="h3">
                          {deadline.title}
                        </Typography>
                        {(isUrgent || isOverdue) && (
                          <WarningIcon color={isOverdue ? 'error' : 'warning'} fontSize="small" />
                        )}
                      </Stack>

                      {deadline.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {deadline.description}
                        </Typography>
                      )}

                      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1 }}>
                        <Chip
                          label={deadline.priority.toUpperCase()}
                          color={getPriorityColor(deadline.priority) as any}
                          size="small"
                        />
                        <Chip
                          label={
                            isOverdue
                              ? `${Math.abs(daysUntil)} days overdue`
                              : daysUntil === 0
                              ? 'Due today'
                              : daysUntil === 1
                              ? 'Due tomorrow'
                              : `${daysUntil} days left`
                          }
                          color={getStatusColor(deadline.status, daysUntil) as any}
                          size="small"
                        />
                        {deadline.category && (
                          <Chip label={deadline.category} variant="outlined" size="small" />
                        )}
                      </Stack>

                      <Typography variant="caption" color="text.secondary">
                        Due: {new Date(deadline.dueDate).toLocaleDateString()}
                      </Typography>
                    </Box>

                    <Stack direction="row" spacing={1}>
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(deadline)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteDeadline(deadline.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingDeadline ? 'Edit Deadline' : 'Add New Deadline'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              multiline
              rows={2}
            />
            <TextField
              label="Due Date"
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              fullWidth
              required
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Priority"
              select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
              fullWidth
            >
              <MenuItem value="low">Low</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="high">High</MenuItem>
            </TextField>
            <TextField
              label="Category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSaveDeadline}
            variant="contained"
            disabled={!formData.title || !formData.dueDate}
          >
            {editingDeadline ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}