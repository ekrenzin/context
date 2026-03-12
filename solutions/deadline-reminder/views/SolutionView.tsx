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
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Notifications as NotificationsIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';

interface Deadline {
  id: string;
  title: string;
  description?: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
  category: string;
  status: 'pending' | 'completed' | 'overdue';
  reminderDays: number;
  createdAt: string;
}

interface DeadlineFormData {
  title: string;
  description: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
  category: string;
  reminderDays: number;
}

export default function DeadlineReminder() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState<Deadline | null>(null);
  const [formData, setFormData] = useState<DeadlineFormData>({
    title: '',
    description: '',
    dueDate: '',
    priority: 'medium',
    category: '',
    reminderDays: 3
  });

  useEffect(() => {
    fetchDeadlines();
  }, []);

  const fetchDeadlines = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3000/api/deadlines');
      if (!response.ok) throw new Error('Failed to fetch deadlines');
      const data = await response.json();
      setDeadlines(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deadlines');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const url = editingDeadline 
        ? `http://localhost:3000/api/deadlines/${editingDeadline.id}`
        : 'http://localhost:3000/api/deadlines';
      
      const method = editingDeadline ? 'PUT' : 'POST';
      
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

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`http://localhost:3000/api/deadlines/${id}`, {
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
        category: deadline.category,
        reminderDays: deadline.reminderDays
      });
    } else {
      setEditingDeadline(null);
      setFormData({
        title: '',
        description: '',
        dueDate: '',
        priority: 'medium',
        category: '',
        reminderDays: 3
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'overdue': return 'error';
      case 'pending': return 'primary';
      default: return 'default';
    }
  };

  const upcomingDeadlines = deadlines
    .filter(d => d.status === 'pending')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5);

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Skeleton variant="text" width={200} height={40} />
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent>
                <Skeleton variant="text" width="60%" height={24} />
                <Skeleton variant="text" width="40%" height={20} />
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <Skeleton variant="rectangular" width={60} height={24} />
                  <Skeleton variant="rectangular" width={80} height={24} />
                </Stack>
              </CardContent>
            </Card>
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

      {upcomingDeadlines.length > 0 && (
        <Card sx={{ mb: 3, bgcolor: 'warning.light', color: 'warning.contrastText' }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <WarningIcon />
              <Typography variant="h6">Upcoming Deadlines</Typography>
            </Stack>
            <Stack spacing={1}>
              {upcomingDeadlines.map(deadline => {
                const daysLeft = getDaysUntilDeadline(deadline.dueDate);
                return (
                  <Box key={deadline.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">
                      {deadline.title}
                    </Typography>
                    <Chip
                      label={daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft} days`}
                      size="small"
                      color={daysLeft <= 1 ? 'error' : daysLeft <= 3 ? 'warning' : 'info'}
                    />
                  </Box>
                );
              })}
            </Stack>
          </CardContent>
        </Card>
      )}

      {deadlines.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <ScheduleIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No deadlines yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Add your first deadline to start tracking important dates
            </Typography>
            <Button variant="contained" onClick={() => handleOpenDialog()}>
              Add Deadline
            </Button>
          </CardContent>
        </Card>
      ) : (
        <List>
          {deadlines.map(deadline => {
            const daysLeft = getDaysUntilDeadline(deadline.dueDate);
            return (
              <ListItem key={deadline.id} sx={{ px: 0 }}>
                <Card sx={{ width: '100%' }}>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" gutterBottom>
                          {deadline.title}
                        </Typography>
                        {deadline.description && (
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            {deadline.description}
                          </Typography>
                        )}
                        <Typography variant="body2" color="text.secondary">
                          Due: {new Date(deadline.dueDate).toLocaleDateString()}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1}>
                        <IconButton size="small" onClick={() => handleOpenDialog(deadline)}>
                          <EditIcon />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDelete(deadline.id)}>
                          <DeleteIcon />
                        </IconButton>
                      </Stack>
                    </Stack>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Chip
                        label={deadline.priority}
                        size="small"
                        color={getPriorityColor(deadline.priority) as any}
                      />
                      <Chip
                        label={deadline.status}
                        size="small"
                        color={getStatusColor(deadline.status) as any}
                      />
                      {deadline.category && (
                        <Chip label={deadline.category} size="small" variant="outlined" />
                      )}
                      {deadline.status === 'pending' && (
                        <Chip
                          icon={<NotificationsIcon />}
                          label={`${deadline.reminderDays} days notice`}
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </ListItem>
            );
          })}
        </List>
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
            <TextField
              label="Reminder Days"
              type="number"
              value={formData.reminderDays}
              onChange={(e) => setFormData({ ...formData, reminderDays: parseInt(e.target.value) })}
              fullWidth
              inputProps={{ min: 0, max: 30 }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingDeadline ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}