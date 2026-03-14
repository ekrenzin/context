import { FastifyInstance } from 'fastify';
import { spawn, ChildProcess } from 'child_process';
import { WebSocket } from 'ws';

interface ScreenSource {
  id: string;
  name: string;
  type: 'display' | 'window';
  bounds?: { x: number; y: number; width: number; height: number };
}

interface StreamSession {
  id: string;
  sources: ScreenSource[];
  layout: 'side-by-side' | 'picture-in-picture' | 'overlay';
  target: 'chromecast' | 'airplay';
  status: 'idle' | 'capturing' | 'streaming' | 'error';
  process?: ChildProcess;
}

const sessions = new Map<string, StreamSession>();
let sessionCounter = 0;

export default async function routes(fastify: FastifyInstance) {
  fastify.get('/health', async () => {
    return { ok: true };
  });

  fastify.get('/screens', async () => {
    const screens: ScreenSource[] = [
      { id: 'display-0', name: 'Primary Display', type: 'display', bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
      { id: 'display-1', name: 'Secondary Display', type: 'display', bounds: { x: 1920, y: 0, width: 1920, height: 1080 } }
    ];
    return { screens };
  });

  fastify.post<{
    Body: {
      sources: string[];
      layout: 'side-by-side' | 'picture-in-picture' | 'overlay';
      target: 'chromecast' | 'airplay';
    }
  }>('/sessions', async (request) => {
    const { sources, layout, target } = request.body;
    const sessionId = `session-${++sessionCounter}`;
    
    const screenSources: ScreenSource[] = sources.map(id => ({
      id,
      name: id.includes('display') ? `Display ${id.split('-')[1]}` : `Window ${id}`,
      type: id.includes('display') ? 'display' : 'window'
    }));

    const session: StreamSession = {
      id: sessionId,
      sources: screenSources,
      layout,
      target,
      status: 'idle'
    };

    sessions.set(sessionId, session);
    return { sessionId, session };
  });

  fastify.get('/sessions', async () => {
    return { sessions: Array.from(sessions.values()) };
  });

  fastify.get<{ Params: { id: string } }>('/sessions/:id', async (request) => {
    const session = sessions.get(request.params.id);
    if (!session) {
      throw new Error('Session not found');
    }
    return { session };
  });

  fastify.post<{ Params: { id: string } }>('/sessions/:id/start', async (request) => {
    const session = sessions.get(request.params.id);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status === 'streaming') {
      return { message: 'Session already streaming' };
    }

    session.status = 'capturing';
    
    const ffmpegArgs = buildFFmpegArgs(session);
    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
    
    ffmpegProcess.on('error', (error) => {
      console.error('FFmpeg error:', error);
      session.status = 'error';
    });

    ffmpegProcess.on('exit', (code) => {
      console.log('FFmpeg exited with code:', code);
      session.status = 'idle';
      session.process = undefined;
    });

    session.process = ffmpegProcess;
    session.status = 'streaming';
    
    return { message: 'Stream started', sessionId: session.id };
  });

  fastify.post<{ Params: { id: string } }>('/sessions/:id/stop', async (request) => {
    const session = sessions.get(request.params.id);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.process) {
      session.process.kill('SIGTERM');
      session.process = undefined;
    }
    
    session.status = 'idle';
    return { message: 'Stream stopped', sessionId: session.id };
  });

  fastify.delete<{ Params: { id: string } }>('/sessions/:id', async (request) => {
    const session = sessions.get(request.params.id);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.process) {
      session.process.kill('SIGTERM');
    }
    
    sessions.delete(request.params.id);
    return { message: 'Session deleted' };
  });

  fastify.get('/cast-devices', async () => {
    const devices = [
      { id: 'chromecast-1', name: 'Living Room TV', type: 'chromecast', available: true },
      { id: 'appletv-1', name: 'Apple TV', type: 'airplay', available: true }
    ];
    return { devices };
  });
}

function buildFFmpegArgs(session: StreamSession): string[] {
  const args: string[] = [];
  
  session.sources.forEach((source, index) => {
    if (source.type === 'display') {
      args.push('-f', 'avfoundation');
      args.push('-i', `${index}:`);
    }
  });

  if (session.layout === 'side-by-side' && session.sources.length === 2) {
    args.push('-filter_complex', '[0:v][1:v]hstack=inputs=2[v]');
    args.push('-map', '[v]');
  } else if (session.layout === 'picture-in-picture' && session.sources.length === 2) {
    args.push('-filter_complex', '[1:v]scale=320:240[pip];[0:v][pip]overlay=W-w-10:10[v]');
    args.push('-map', '[v]');
  }

  args.push('-c:v', 'libx264');
  args.push('-preset', 'ultrafast');
  args.push('-tune', 'zerolatency');
  args.push('-f', 'mpegts');
  
  if (session.target === 'chromecast') {
    args.push('udp://224.1.1.1:1234');
  } else {
    args.push('udp://239.255.255.250:1900');
  }

  return args;
}