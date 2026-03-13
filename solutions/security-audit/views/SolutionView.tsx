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
  Checkbox,
  FormControlLabel,
  LinearProgress,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Security as SecurityIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';

interface AuditItem {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  completed: boolean;
  notes?: string;
}

interface AuditSession {
  id: string;
  name: string;
  status: 'active' | 'completed' | 'draft';
  progress: number;
  items: AuditItem[];
  createdAt: string;
  updatedAt: string;
}

const securityAuditChecklist: AuditItem[] = [
  {
    id: 'auth-1',
    title: 'Authentication Implementation',
    description: 'Verify proper authentication mechanisms are in place',
    category: 'Authentication',
    severity: 'critical',
    completed: false
  },
  {
    id: 'auth-2',
    title: 'Session Management',
    description: 'Check session timeout and secure session handling',
    category: 'Authentication',
    severity: 'high',
    completed: false
  },
  {
    id: 'input-1',
    title: 'Input Validation',
    description: 'Validate all user inputs and sanitize data',
    category: 'Input Validation',
    severity: 'critical',
    completed: false
  },
  {
    id: 'input-2',
    title: 'SQL Injection Prevention',
    description: 'Use parameterized queries and ORM protection',
    category: 'Input Validation',
    severity: 'critical',
    completed: false
  },
  {
    id: 'xss-1',
    title: 'XSS Prevention',
    description: 'Implement proper output encoding and CSP headers',
    category: 'XSS Protection',
    severity: 'high',
    completed: false
  },
  {
    id: 'data-1',
    title: 'Data Encryption',
    description: 'Ensure sensitive data is encrypted at rest and in transit',
    category: 'Data Protection',
    severity: 'critical',
    completed: false
  },
  {
    id: 'access-1',
    title: 'Access Control',
    description: 'Verify proper authorization and role-based access',
    category: 'Access Control',
    severity: 'high',
    completed: false
  },
  {
    id: 'logging-1',
    title: 'Security Logging',
    description: 'Implement comprehensive security event logging',
    category: 'Logging',
    severity: 'medium',
    completed: false
  }
];

export default function SecurityAudit() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [auditSession, setAuditSession] = useState<AuditSession | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['Authentication']);

  useEffect(() => {
    loadAuditSession();
  }, []);

  const loadAuditSession = async () => {
    try {
      setLoading(true);
      setError(null);

      // Try to load existing session
      const sessionsResponse = await fetch('/api/sessions?type=security-audit');
      const sessions = await sessionsResponse.json();
      
      let currentSession = sessions.find((s: AuditSession) => s.status === 'active');
      
      if (!currentSession) {
        // Create new audit session
        currentSession = {
          id: `audit-${Date.now()}`,
          name: `Security Audit - ${new Date().toLocaleDateString()}`,
          status: 'active' as const,
          progress: 0,
          items: [...securityAuditChecklist],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }

      setAuditSession(currentSession);
    } catch (err) {
      setError('Failed to load security audit session');
      console.error('Error loading audit session:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleItemToggle = async (itemId: string) => {
    if (!auditSession) return;

    const updatedItems = auditSession.items.map(item =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );

    const completedCount = updatedItems.filter(item => item.completed).length;
    const progress = Math.round((completedCount / updatedItems.length) * 100);

    const updatedSession = {
      ...auditSession,
      items: updatedItems,
      progress,
      status: progress === 100 ? 'completed' as const : 'active' as const,
      updatedAt: new Date().toISOString()
    };

    setAuditSession(updatedSession);

    // Save to backend
    try {
      await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSession)
      });
    } catch (err) {
      console.error('Error saving audit session:', err);
    }
  };

  const handleCategoryToggle = (category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const getStatusIcon = (completed: boolean, severity: string) => {
    if (completed) return <CheckCircleIcon color="success" />;
    if (severity === 'critical') return <ErrorIcon color="error" />;
    if (severity === 'high') return <WarningIcon color="warning" />;
    return <SecurityIcon color="action" />;
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Skeleton variant="text" width="60%" height={40} />
          <Skeleton variant="rectangular" height={100} />
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent>
                <Skeleton variant="text" width="40%" />
                <Skeleton variant="text" width="80%" />
                <Skeleton variant="rectangular" height={60} />
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
        <Alert 
          severity="error" 
          action={
            <Button color="inherit" size="small" onClick={loadAuditSession}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      </Box>
    );
  }

  if (!auditSession) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          No security audit session found. 
          <Button onClick={loadAuditSession} sx={{ ml: 1 }}>
            Create New Audit
          </Button>
        </Alert>
      </Box>
    );
  }

  const categories = [...new Set(auditSession.items.map(item => item.category))];
  const completedItems = auditSession.items.filter(item => item.completed).length;
  const criticalItems = auditSession.items.filter(item => item.severity === 'critical' && !item.completed).length;

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <SecurityIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Box>
              <Typography variant="h4" component="h1">
                Security Audit
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {auditSession.name}
              </Typography>
            </Box>
          </Box>
          <Tooltip title="Refresh">
            <IconButton onClick={loadAuditSession}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Progress Overview */}
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">Audit Progress</Typography>
                <Chip 
                  label={auditSession.status.toUpperCase()} 
                  color={auditSession.status === 'completed' ? 'success' : 'primary'}
                  variant="outlined"
                />
              </Box>
              
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">
                    {completedItems} of {auditSession.items.length} items completed
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {auditSession.progress}%
                  </Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={auditSession.progress}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>

              <Stack direction="row" spacing={2}>
                <Chip 
                  label={`${criticalItems} Critical Issues`}
                  color={criticalItems > 0 ? 'error' : 'success'}
                  size="small"
                />
                <Chip 
                  label={`${categories.length} Categories`}
                  color="info"
                  size="small"
                />
                <Chip 
                  label={`Updated ${new Date(auditSession.updatedAt).toLocaleString()}`}
                  variant="outlined"
                  size="small"
                />
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {/* Critical Items Alert */}
        {criticalItems > 0 && (
          <Alert severity="error">
            <Typography variant="subtitle2">
              {criticalItems} critical security items require immediate attention
            </Typography>
          </Alert>
        )}

        {/* Audit Checklist by Category */}
        <Stack spacing={2}>
          {categories.map(category => {
            const categoryItems = auditSession.items.filter(item => item.category === category);
            const categoryCompleted = categoryItems.filter(item => item.completed).length;
            const isExpanded = expandedCategories.includes(category);

            return (
              <Accordion 
                key={category}
                expanded={isExpanded}
                onChange={() => handleCategoryToggle(category)}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                    <Typography variant="h6">{category}</Typography>
                    <Chip 
                      label={`${categoryCompleted}/${categoryItems.length}`}
                      size="small"
                      color={categoryCompleted === categoryItems.length ? 'success' : 'default'}
                    />
                  </Box>
                </AccordionSummary>
                
                <AccordionDetails>
                  <Stack spacing={2}>
                    {categoryItems.map(item => (
                      <Card 
                        key={item.id}
                        variant="outlined"
                        sx={{ 
                          opacity: item.completed ? 0.7 : 1,
                          borderColor: item.completed ? 'success.main' : 'divider'
                        }}
                      >
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={item.completed}
                                  onChange={() => handleItemToggle(item.id)}
                                />
                              }
                              label=""
                              sx={{ m: 0 }}
                            />
                            
                            <Box sx={{ flex: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                {getStatusIcon(item.completed, item.severity)}
                                <Typography 
                                  variant="subtitle1" 
                                  sx={{ 
                                    textDecoration: item.completed ? 'line-through' : 'none',
                                    fontWeight: item.completed ? 'normal' : 'medium'
                                  }}
                                >
                                  {item.title}
                                </Typography>
                                <Chip 
                                  label={item.severity.toUpperCase()}
                                  size="small"
                                  color={getSeverityColor(item.severity) as any}
                                  variant="outlined"
                                />
                              </Box>
                              
                              <Typography 
                                variant="body2" 
                                color="text.secondary"
                                sx={{ mb: 1 }}
                              >
                                {item.description}
                              </Typography>
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Stack>

        {/* Completion Actions */}
        {auditSession.status === 'completed' && (
          <Alert severity="success">
            <Typography variant="subtitle2">
              Security audit completed successfully! All items have been reviewed.
            </Typography>
          </Alert>
        )}
      </Stack>
    </Box>
  );
}