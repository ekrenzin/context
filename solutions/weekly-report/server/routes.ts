import { FastifyInstance } from 'fastify';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  tasksCompleted: number;
  tasksInProgress: number;
  hoursLogged: number;
}

interface WeeklyReport {
  weekOf: string;
  teamMembers: TeamMember[];
  totalTasksCompleted: number;
  totalHoursLogged: number;
  productivity: number;
  blockers: string[];
  achievements: string[];
}

interface ReportConfig {
  includeMetrics: string[];
  teamIds: string[];
  dateRange: {
    start: string;
    end: string;
  };
}

const mockTeamData: TeamMember[] = [
  {
    id: '1',
    name: 'Alice Johnson',
    role: 'Frontend Developer',
    tasksCompleted: 8,
    tasksInProgress: 3,
    hoursLogged: 40
  },
  {
    id: '2',
    name: 'Bob Smith',
    role: 'Backend Developer',
    tasksCompleted: 6,
    tasksInProgress: 2,
    hoursLogged: 38
  },
  {
    id: '3',
    name: 'Carol Davis',
    role: 'QA Engineer',
    tasksCompleted: 12,
    tasksInProgress: 4,
    hoursLogged: 42
  }
];

export const registerRoutes = (server: FastifyInstance) => {
  server.get('/health', async () => {
    return { ok: true };
  });

  server.get<{ Querystring: { week?: string } }>('/reports', async (request) => {
    const { week } = request.query;
    const weekOf = week || new Date().toISOString().split('T')[0];
    
    const totalTasksCompleted = mockTeamData.reduce((sum, member) => sum + member.tasksCompleted, 0);
    const totalHoursLogged = mockTeamData.reduce((sum, member) => sum + member.hoursLogged, 0);
    const productivity = totalTasksCompleted / (totalHoursLogged / 8);
    
    const report: WeeklyReport = {
      weekOf,
      teamMembers: mockTeamData,
      totalTasksCompleted,
      totalHoursLogged,
      productivity: Math.round(productivity * 100) / 100,
      blockers: ['API rate limits', 'Database migration pending'],
      achievements: ['Feature X deployed', 'Performance improved by 15%']
    };
    
    return report;
  });

  server.get('/reports/summary', async () => {
    const totalTasks = mockTeamData.reduce((sum, member) => sum + member.tasksCompleted, 0);
    const totalHours = mockTeamData.reduce((sum, member) => sum + member.hoursLogged, 0);
    
    return {
      teamSize: mockTeamData.length,
      totalTasksCompleted: totalTasks,
      totalHoursLogged: totalHours,
      averageTasksPerMember: Math.round((totalTasks / mockTeamData.length) * 100) / 100,
      averageHoursPerMember: Math.round((totalHours / mockTeamData.length) * 100) / 100
    };
  });

  server.get('/team-members', async () => {
    return mockTeamData;
  });

  server.post<{ Body: ReportConfig }>('/reports/generate', async (request) => {
    const config = request.body;
    
    const filteredData = mockTeamData.filter(member => 
      config.teamIds.length === 0 || config.teamIds.includes(member.id)
    );
    
    const report: WeeklyReport = {
      weekOf: config.dateRange.start,
      teamMembers: filteredData,
      totalTasksCompleted: filteredData.reduce((sum, member) => sum + member.tasksCompleted, 0),
      totalHoursLogged: filteredData.reduce((sum, member) => sum + member.hoursLogged, 0),
      productivity: 0.85,
      blockers: ['Custom blocker from config'],
      achievements: ['Custom achievement from config']
    };
    
    return report;
  });

  server.get('/metrics', async () => {
    return {
      availableMetrics: [
        'tasksCompleted',
        'hoursLogged',
        'productivity',
        'blockers',
        'achievements'
      ],
      defaultDateRange: {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
      }
    };
  });
};