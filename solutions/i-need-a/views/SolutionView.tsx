import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Stack,
  Alert,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  LinearProgress,
  IconButton,
  Skeleton
} from '@mui/material';
import {
  ScreenShare,
  Cast,
  Stop,
  Settings,
  Refresh,
  PlayArrow,
  Pause
} from '@mui/icons-material';

interface Screen {
  id: string;
  name: string;
  type: 'display' | 'window' | 'tab';
  thumbnail?: string;
}

interface CastDevice {
  id: string;
  name: string;
  type: 'chromecast' | 'airplay';
  status: 'available' | 'connected' | 'busy';
}

interface StreamSession {
  id: string;
  status: 'idle' | 'capturing' | 'streaming' | 'error';
  primaryScreen?: string;
  secondaryScreen?: string;
  castDevice?: string;
  layout: 'side-by-side' | 'picture-in-picture' | 'overlay';
  quality: 'low' | 'medium' | 'high';
}

export default function ScreenShareCasting() {
  const [screens, setScreens] = useState<Screen[]>([]);
  const [castDevices, setCastDevices] = useState<CastDevice[]>([]);
  const [session, setSession] = useState<StreamSession>({
    id: '',
    status: 'idle',
    layout: 'side-by-side',
    quality: 'medium'
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchScreens();
    fetchCastDevices();
  }, []);

  const fetchScreens = async () => {
    try {
      const response = await fetch('http://localhost:3000/screens');
      if (!response.ok) throw new Error('Failed to fetch screens');
      const data = await response.json();
      setScreens(data);
    } catch (err) {
      setError('Failed to load available screens');
    }
  };

  const fetchCastDevices = async () => {
    try {
      const response = await fetch('http://localhost:3000/cast-devices');
      if (!response.ok) throw new Error('Failed to fetch cast devices');
      const data = await response.json();
      setCastDevices(data);
      setLoading(false);
    } catch (err) {
      setError('Failed to load cast devices');
      setLoading(false);
    }
  };

  const startCapture = async () => {
    if (!session.primaryScreen || !session.castDevice) {
      setError('Please select at least one screen and a cast device');
      return;
    }

    try {
      setSession(prev => ({ ...prev, status: 'capturing' }));
      const response = await fetch('http://localhost:3000/stream/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryScreen: session.primaryScreen,
          secondaryScreen: session.secondaryScreen,
          castDevice: session.castDevice,
          layout: session.layout,
          quality: session.quality
        })
      });

      if (!response.ok) throw new Error('Failed to start streaming');
      const data = await response.json();
      setSession(prev => ({ ...prev, id: data.sessionId, status: 'streaming' }));
      setError(null);
    } catch (err) {
      setSession(prev => ({ ...prev, status: 'error' }));
      setError('Failed to start screen sharing');
    }
  };

  const stopCapture = async () => {
    try {
      await fetch(`http://localhost:3000/stream/${session.id}/stop`, {
        method: 'POST'
      });
      setSession(prev => ({ ...prev, status: 'idle', id: '' }));
    } catch (err) {
      setError('Failed to stop streaming');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'streaming': return 'success';
      case 'capturing': return 'warning';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="text" width={300} height={40} />
        <Stack spacing={2} sx={{ mt: 2 }}>
          <Skeleton variant="rectangular" height={200} />
          <Skeleton variant="rectangular" height={150} />
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
        <ScreenShare sx={{ fontSize: 32, color: 'primary.main' }} />
        <Typography variant="h4" component="h1">
          Multi-Screen Casting
        </Typography>
        <Chip 
          label={session.status.toUpperCase()} 
          color={getStatusColor(session.status)}
          size="small"
        />
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Stack spacing={3}>
        {/* Screen Selection */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Screen Selection
            </Typography>
            <Stack spacing={2}>
              <FormControl fullWidth>
                <InputLabel>Primary Screen</InputLabel>
                <Select
                  value={session.primaryScreen || ''}
                  onChange={(e) => setSession(prev => ({ ...prev, primaryScreen: e.target.value }))}
                  disabled={session.status === 'streaming'}
                >
                  {screens.map((screen) => (
                    <MenuItem key={screen.id} value={screen.id}>
                      {screen.name} ({screen.type})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Secondary Screen (Optional)</InputLabel>
                <Select
                  value={session.secondaryScreen || ''}
                  onChange={(e) => setSession(prev => ({ ...prev, secondaryScreen: e.target.value }))}
                  disabled={session.status === 'streaming'}
                >
                  <MenuItem value="">None</MenuItem>
                  {screens.filter(s => s.id !== session.primaryScreen).map((screen) => (
                    <MenuItem key={screen.id} value={screen.id}>
                      {screen.name} ({screen.type})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Stack direction="row" spacing={1}>
                <IconButton onClick={fetchScreens} size="small">
                  <Refresh />
                </IconButton>
                <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
                  {screens.length} screens available
                </Typography>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {/* Cast Device Selection */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Cast Device
            </Typography>
            <Stack spacing={2}>
              <FormControl fullWidth>
                <InputLabel>Target Device</InputLabel>
                <Select
                  value={session.castDevice || ''}
                  onChange={(e) => setSession(prev => ({ ...prev, castDevice: e.target.value }))}
                  disabled={session.status === 'streaming'}
                >
                  {castDevices.map((device) => (
                    <MenuItem key={device.id} value={device.id} disabled={device.status === 'busy'}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Cast />
                        <Typography>{device.name}</Typography>
                        <Chip 
                          label={device.type} 
                          size="small" 
                          variant="outlined"
                        />
                        <Chip 
                          label={device.status} 
                          size="small" 
                          color={device.status === 'available' ? 'success' : 'default'}
                        />
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {castDevices.length === 0 && (
                <Alert severity="info">
                  No cast devices found. Make sure your Apple TV or Chromecast is on the same network.
                </Alert>
              )}
            </Stack>
          </CardContent>
        </Card>

        {/* Stream Configuration */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Stream Configuration
            </Typography>
            <Stack spacing={2}>
              <FormControl>
                <InputLabel>Layout</InputLabel>
                <Select
                  value={session.layout}
                  onChange={(e) => setSession(prev => ({ ...prev, layout: e.target.value as any }))}
                  disabled={session.status === 'streaming'}
                >
                  <MenuItem value="side-by-side">Side by Side</MenuItem>
                  <MenuItem value="picture-in-picture">Picture in Picture</MenuItem>
                  <MenuItem value="overlay">Overlay</MenuItem>
                </Select>
              </FormControl>

              <FormControl>
                <InputLabel>Quality</InputLabel>
                <Select
                  value={session.quality}
                  onChange={(e) => setSession(prev => ({ ...prev, quality: e.target.value as any }))}
                  disabled={session.status === 'streaming'}
                >
                  <MenuItem value="low">Low (720p)</MenuItem>
                  <MenuItem value="medium">Medium (1080p)</MenuItem>
                  <MenuItem value="high">High (4K)</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </CardContent>
        </Card>

        {/* Controls */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Streaming Controls
            </Typography>
            
            {session.status === 'capturing' && (
              <LinearProgress sx={{ mb: 2 }} />
            )}

            <Stack direction="row" spacing={2}>
              {session.status === 'idle' || session.status === 'error' ? (
                <Button
                  variant="contained"
                  startIcon={<PlayArrow />}
                  onClick={startCapture}
                  disabled={!session.primaryScreen || !session.castDevice}
                >
                  Start Casting
                </Button>
              ) : (
                <Button
                  variant="outlined"
                  startIcon={<Stop />}
                  onClick={stopCapture}
                  color="error"
                >
                  Stop Casting
                </Button>
              )}

              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={() => {
                  fetchScreens();
                  fetchCastDevices();
                }}
              >
                Refresh Devices
              </Button>
            </Stack>

            {session.status === 'streaming' && (
              <Alert severity="success" sx={{ mt: 2 }}>
                Successfully casting to {castDevices.find(d => d.id === session.castDevice)?.name}
              </Alert>
            )}
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}