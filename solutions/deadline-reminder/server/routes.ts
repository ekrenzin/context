import { FastifyInstance } from 'fastify';

interface Deadline {
  id: string;
  title: string;
  description?: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'completed' | 'overdue';
  createdAt: string;
  updatedAt: string;
}

let deadlines: Deadline[] = [];
let nextId = 1;

export default async function routes(fastify: FastifyInstance) {
  fastify.get('/health', async () => {
    return { ok: true };
  });

  fastify.get('/deadlines', async () => {
    const now = new Date();
    const updatedDeadlines = deadlines.map(deadline => {
      if (new Date(deadline.dueDate) < now && deadline.status === 'pending') {
        return { ...deadline, status: 'overdue' as const };
      }
      return deadline;
    });
    deadlines = updatedDeadlines;
    return { deadlines: updatedDeadlines };
  });

  fastify.get('/deadlines/upcoming', async (request) => {
    const { days = '7' } = request.query as { days?: string };
    const daysAhead = parseInt(days, 10);
    const now = new Date();
    const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    
    const upcoming = deadlines.filter(deadline => {
      const dueDate = new Date(deadline.dueDate);
      return dueDate >= now && dueDate <= futureDate && deadline.status === 'pending';
    }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    
    return { deadlines: upcoming };
  });

  fastify.post('/deadlines', async (request) => {
    const { title, description, dueDate, priority = 'medium' } = request.body as {
      title: string;
      description?: string;
      dueDate: string;
      priority?: 'low' | 'medium' | 'high';
    };
    
    const now = new Date().toISOString();
    const deadline: Deadline = {
      id: (nextId++).toString(),
      title,
      description,
      dueDate,
      priority,
      status: 'pending',
      createdAt: now,
      updatedAt: now
    };
    
    deadlines.push(deadline);
    return { deadline };
  });

  fastify.put('/deadlines/:id', async (request) => {
    const { id } = request.params as { id: string };
    const updates = request.body as Partial<Omit<Deadline, 'id' | 'createdAt' | 'updatedAt'>>;
    
    const index = deadlines.findIndex(d => d.id === id);
    if (index === -1) {
      throw new Error('Deadline not found');
    }
    
    deadlines[index] = {
      ...deadlines[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    return { deadline: deadlines[index] };
  });

  fastify.delete('/deadlines/:id', async (request) => {
    const { id } = request.params as { id: string };
    const index = deadlines.findIndex(d => d.id === id);
    
    if (index === -1) {
      throw new Error('Deadline not found');
    }
    
    deadlines.splice(index, 1);
    return { success: true };
  });

  fastify.get('/deadlines/stats', async () => {
    const now = new Date();
    const stats = {
      total: deadlines.length,
      pending: deadlines.filter(d => d.status === 'pending').length,
      completed: deadlines.filter(d => d.status === 'completed').length,
      overdue: deadlines.filter(d => d.status === 'overdue' || (new Date(d.dueDate) < now && d.status === 'pending')).length,
      dueToday: deadlines.filter(d => {
        const dueDate = new Date(d.dueDate);
        const today = new Date();
        return dueDate.toDateString() === today.toDateString() && d.status === 'pending';
      }).length
    };
    
    return { stats };
  });
}