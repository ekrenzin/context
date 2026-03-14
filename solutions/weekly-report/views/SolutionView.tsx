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
  Grid,
  LinearProgress,
  Divider,
  Paper
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Assignment,
  Group,
  CheckCircle,
  Schedule
} from '@mui/icons-material';

interface TeamMember {
  id: string;
  name: string;
  tasksCompleted: number;
  tasksTotal: number;
  hoursLogged: number;
}

interface ProjectMetric {
  id: string;
  name: string;
  progress: number;
  status: 'on-track' | 'at-risk' | 'delayed';
  completedTasks: number;
  totalTasks: number;
}

interface WeeklyReportData {
  weekStart: string;
  weekEnd: string;
  summary: {
    totalTasks: number;
    completedTasks: number;
    totalHours: number;
    teamProductivity: number;
    previousWeekComparison: number;
  };
  teamMembers: TeamMember[];
  projects: ProjectMetric[];
  highlights: string[];
  blockers: string[];
}

export default function WeeklyReport() {
  const [data, setData] = useState<WeeklyReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWeeklyReport = async () => {
      try {
        setLoading(true);
        const response = await fetch('http://localhost:3000/weekly-report');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const reportData = await response.json();
        setData(reportData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch weekly report');
      } finally {
        setLoading(false);
      }
    };

    fetchWeeklyReport();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'on-track': return 'success';
      case 'at-risk': return 'warning';
      case 'delayed': return 'error';
      default: return 'default';
    }
  };

  const getTrendIcon = (comparison: number) => {
    return comparison >= 0 ? <TrendingUp color="success" /> : <TrendingDown color="error" />;
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="text" width="60%" height={40} sx={{ mb: 3 }} />
        <Grid container spacing={3}>
          {[1, 2, 3, 4].map((i) => (
            <Grid item xs={12} md={6} lg={3} key={i}>
              <Card>
                <CardContent>
                  <Skeleton variant="text" width="80%" />
                  <Skeleton variant="text" width="60%" />
                  <Skeleton variant="rectangular" height={60} sx={{ mt: 1 }} />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          Error loading weekly report: {error}
        </Alert>
      </Box>
    );
  }

  if (!data) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          No weekly report data available
        </Alert>
      </Box>
    );
  }

  const completionRate = (data.summary.completedTasks / data.summary.totalTasks) * 100;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Weekly Report
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
        {new Date(data.weekStart).toLocaleDateString()} - {new Date(data.weekEnd).toLocaleDateString()}
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6} lg={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <Assignment color="primary" />
                <Typography variant="h6">Tasks</Typography>
              </Stack>
              <Typography variant="h4">
                {data.summary.completedTasks}/{data.summary.totalTasks}
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={completionRate} 
                sx={{ mt: 1 }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {completionRate.toFixed(1)}% completion rate
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <Schedule color="primary" />
                <Typography variant="h6">Hours Logged</Typography>
              </Stack>
              <Typography variant="h4">{data.summary.totalHours}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Total team hours
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <Group color="primary" />
                <Typography variant="h6">Team Size</Typography>
              </Stack>
              <Typography variant="h4">{data.teamMembers.length}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Active team members
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <CheckCircle color="primary" />
                <Typography variant="h6">Productivity</Typography>
                {getTrendIcon(data.summary.previousWeekComparison)}
              </Stack>
              <Typography variant="h4">{data.summary.teamProductivity}%</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {data.summary.previousWeekComparison >= 0 ? '+' : ''}{data.summary.previousWeekComparison}% vs last week
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Team Performance
              </Typography>
              <Stack spacing={2}>
                {data.teamMembers.map((member) => (
                  <Paper key={member.id} sx={{ p: 2 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                      <Typography variant="subtitle1">{member.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {member.hoursLogged}h logged
                      </Typography>
                    </Stack>
                    <LinearProgress 
                      variant="determinate" 
                      value={(member.tasksCompleted / member.tasksTotal) * 100} 
                      sx={{ mb: 1 }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      {member.tasksCompleted}/{member.tasksTotal} tasks completed
                    </Typography>
                  </Paper>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Project Status
              </Typography>
              <Stack spacing={2}>
                {data.projects.map((project) => (
                  <Paper key={project.id} sx={{ p: 2 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                      <Typography variant="subtitle1">{project.name}</Typography>
                      <Chip 
                        label={project.status.replace('-', ' ')} 
                        color={getStatusColor(project.status)}
                        size="small"
                      />
                    </Stack>
                    <LinearProgress 
                      variant="determinate" 
                      value={project.progress} 
                      sx={{ mb: 1 }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      {project.completedTasks}/{project.totalTasks} tasks • {project.progress}% complete
                    </Typography>
                  </Paper>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom color="success.main">
                Week Highlights
              </Typography>
              <Stack spacing={1}>
                {data.highlights.length > 0 ? (
                  data.highlights.map((highlight, index) => (
                    <Typography key={index} variant="body2" sx={{ pl: 2 }}>
                      • {highlight}
                    </Typography>
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No highlights recorded this week
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom color="warning.main">
                Blockers & Issues
              </Typography>
              <Stack spacing={1}>
                {data.blockers.length > 0 ? (
                  data.blockers.map((blocker, index) => (
                    <Typography key={index} variant="body2" sx={{ pl: 2 }}>
                      • {blocker}
                    </Typography>
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No blockers reported this week
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}