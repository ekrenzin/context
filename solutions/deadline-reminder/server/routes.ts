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
      const dueDate = new Date(deadline.dueDate);
      if (dueDate < now && deadline.status === 'pending') {
        return { ...deadline, status: 'overdue' as const };
      }
      return deadline;
    });
    deadlines = updatedDeadlines;
    return { deadlines: updatedDeadlines };
  });

  fastify.post<{ Body: Omit<Deadline, 'id' | 'createdAt' | 'updatedAt'> }>('/deadlines', async (request) => {
    const now = new Date().toISOString();
    const deadline: Deadline = {
      id: (nextId++).toString(),
      ...request.body,
      createdAt: now,
      updatedAt: now
    };
    deadlines.push(deadline);
    return { deadline };
  });

  fastify.put<{ Params: { id: string }; Body: Partial<Omit<Deadline, 'id' | 'createdAt'>> }>('/deadlines/:id', async (request) => {
    const { id } = request.params;
    const index = deadlines.findIndex(d => d.id === id);
    if (index === -1) {
      throw new Error('Deadline not found');
    }
    deadlines[index] = {
      ...deadlines[index],
      ...request.body,
      updatedAt: new Date().toISOString()
    };
    return { deadline: deadlines[index] };
  });

  fastify.delete<{ Params: { id: string } }>('/deadlines/:id', async (request) => {
    const { id } = request.params;
    const index = deadlines.findIndex(d => d.id === id);
    if (index === -1) {
      throw new Error('Deadline not found');
    }
    deadlines.splice(index, 1);
    return { success: true };
  });

  fastify.get('/deadlines/upcoming', async (request) => {
    const now = new Date();
    const days = parseInt((request.query as any)?.days || '7', 10);
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    
    const upcoming = deadlines.filter(deadline => {
      const dueDate = new Date(deadline.dueDate);
      return dueDate >= now && dueDate <= futureDate && deadline.status === 'pending';
    }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    
    return { deadlines: upcoming };
  });
}