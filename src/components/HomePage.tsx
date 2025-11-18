import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, CheckCircle, Clock, Play, Download } from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import TaskCreationForm from './TaskCreationForm';
import ManagerTasksTable from './ManagerTasksTable';
import { formatDuration } from '@/lib/utils';
import { Link, useSearchParams } from 'react-router-dom';

interface HomePageProps {
  user: User | null;
  session: Session | null;
}

interface Task {
  id: number;
  user_id: string;
  task_description: string;
  status: string;
  created_at: string;
  updated_at: string;
  completion_time: unknown;
  total_time_taken: unknown;
  assigned_by: string | null;
  estimated_end_time: string | null;
}

interface TaskStats {
  yetToStart: number;
  started: number;
  wip: number;
  blocked: number;
  inReview: number;
  completed: number;
}

interface TeamMember {
  user_id: string;
  display_name: string;
}

const HomePage = ({ user, session }: HomePageProps) => {
  const [userTasks, setUserTasks] = useState<Task[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [managerTasks, setManagerTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [userStats, setUserStats] = useState<TaskStats>({ yetToStart: 0, started: 0, wip: 0, blocked: 0, inReview: 0, completed: 0 });
  const [allStats, setAllStats] = useState<TaskStats>({ yetToStart: 0, started: 0, wip: 0, blocked: 0, inReview: 0, completed: 0 });
  const [teamMemberCount, setTeamMemberCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [userRole, setUserRole] = useState<string>('member');
  const [statusFilter, setStatusFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [sortKey, setSortKey] = useState<'name' | 'started' | 'wip' | 'completed' | 'total'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    const s = searchParams.get('status') || 'all';
    const u = searchParams.get('user') || 'all';
    setStatusFilter(s);
    setUserFilter(u);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user) {
      fetchData();
      setupRealtimeSubscription();
    }
  }, [user]);

  const fetchTeamMembers = async () => {
    try {
      const { data, error } = await supabase.rpc('get_team_members');
      if (error) {
        console.log(`User name filter query error: ${error.message}`);
        throw error;
      }
      console.log(`User names fetched: [${(data || []).map(m => m.display_name).join(', ')}]`);
      setTeamMembers(data || []);
      return data || [];
    } catch (error) {
      console.log(`Error fetching team members: ${error}`);
      return [];
    }
  };

  const getUserDisplayName = (userId: string) => {
    const member = teamMembers.find(m => m.user_id === userId);
    return member ? member.display_name : userId.substring(0, 8) + '...';
  };

  const fetchData = async () => {
    try {
      console.log(`Querying role for user ID: ${user?.id}`);
      
      // Fetch team members first
      const teamMembersData = await fetchTeamMembers();
      
      // Check user role by querying user_roles table with comprehensive logging
      const { data: userRoleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user?.id)
        .single();

      let adminCheck = false;
      let managerCheck = false;
      let currentRole = 'member';

      if (roleError) {
        if (roleError.code === 'PGRST116') {
          console.log('No role found, defaulting to member');
        } else {
          console.log(`Query error: ${roleError.message}`);
        }
        console.log('Defaulting to member role');
      } else if (userRoleData?.role) {
        console.log(`Role found: ${userRoleData.role}`);
        currentRole = userRoleData.role;
        adminCheck = userRoleData.role === 'admin' || userRoleData.role.toLowerCase().includes('admin');
        managerCheck = userRoleData.role === 'manager' || userRoleData.role.toLowerCase().includes('manager');
      } else {
        console.log('No role found, defaulting to member');
        console.log('Defaulting to member role');
      }
      
      setUserRole(currentRole);
      setIsAdmin(adminCheck);
      setIsManager(managerCheck);

      // Fetch user's tasks
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (tasksError) {
        console.log(`Query error: ${tasksError.message}`);
        throw tasksError;
      }
      
      setUserTasks(tasks || []);

      // Calculate user stats
      const stats = (tasks || []).reduce((acc, task) => {
        if (task.status === 'Yet to Start') acc.yetToStart++;
        if (task.status === 'Started') acc.started++;
        if (task.status === 'WIP') acc.wip++;
        if (task.status === 'Blocked') acc.blocked++;
        if (task.status === 'In Review') acc.inReview++;
        if (task.status === 'Completed') acc.completed++;
        return acc;
      }, { yetToStart: 0, started: 0, wip: 0, blocked: 0, inReview: 0, completed: 0 });
      setUserStats(stats);

      // If admin, fetch all tasks and team member count
      if (adminCheck) {
        const { data: allTasksData, error: allTasksError } = await supabase
          .from('tasks')
          .select('*')
          .order('created_at', { ascending: false });

        if (allTasksError) {
          console.log(`Query error: ${allTasksError.message}`);
          throw allTasksError;
        }
        
        setAllTasks(allTasksData || []);

        // Calculate all stats
        const allStatsCalc = (allTasksData || []).reduce((acc, task) => {
          if (task.status === 'Yet to Start') acc.yetToStart++;
          if (task.status === 'Started') acc.started++;
          if (task.status === 'WIP') acc.wip++;
          if (task.status === 'Blocked') acc.blocked++;
          if (task.status === 'In Review') acc.inReview++;
          if (task.status === 'Completed') acc.completed++;
          return acc;
        }, { yetToStart: 0, started: 0, wip: 0, blocked: 0, inReview: 0, completed: 0 });
        setAllStats(allStatsCalc);

        // Get team member count from unique user_ids in tasks table
        const uniqueUsers = new Set((allTasksData || []).map(t => t.user_id));
        setTeamMemberCount(uniqueUsers.size);
      }

      // If manager, fetch tasks assigned by this manager
      if (managerCheck) {
        const { data: assignedTasks, error: assignedError } = await supabase
          .from('tasks')
          .select('*')
          .eq('assigned_by', user?.id)
          .order('created_at', { ascending: false });

        if (assignedError) {
          console.log(`Query error: ${assignedError.message}`);
          throw assignedError;
        }
        
        setManagerTasks(assignedTasks || []);
      }

    } catch (error) {
      console.log(`Query error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('tasks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks'
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      'Yet to Start': 'bg-gray-100 text-gray-800',
      'Started': 'bg-blue-100 text-blue-800',
      'WIP': 'bg-yellow-100 text-yellow-800',
      'Blocked': 'bg-red-100 text-red-800',
      'In Review': 'bg-purple-100 text-purple-800',
      'Completed': 'bg-green-100 text-green-800'
    };
    return variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status: string) => {
    const icons = {
      'Yet to Start': <Clock className="w-4 h-4" />,
      'Started': <Play className="w-4 h-4" />,
      'WIP': <Clock className="w-4 h-4" />,
      'Blocked': <Clock className="w-4 h-4" />,
      'In Review': <Clock className="w-4 h-4" />,
      'Completed': <CheckCircle className="w-4 h-4" />
    };
    return icons[status as keyof typeof icons] || <Clock className="w-4 h-4" />;
  };

  const getFilteredTasks = () => {
    let filteredTasks = allTasks;
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filteredTasks = filteredTasks.filter(task => task.status.toLowerCase() === statusFilter.toLowerCase());
    }
    
    // Apply user filter
    if (userFilter !== 'all') {
      const selectedMember = teamMembers.find(member => member.display_name === userFilter);
      if (selectedMember) {
        filteredTasks = filteredTasks.filter(task => task.user_id === selectedMember.user_id);
      }
    }
    
    return filteredTasks;
  };

  const getSummaryData = () => {
    console.log('Fetching user status counts');
    const filtered = getFilteredTasks();
    const map = new Map<string, { yetToStart: number; started: number; wip: number; blocked: number; inReview: number; completed: number }>();
    filtered.forEach((t) => {
      if (!map.has(t.user_id)) {
        map.set(t.user_id, { yetToStart: 0, started: 0, wip: 0, blocked: 0, inReview: 0, completed: 0 });
      }
      const entry = map.get(t.user_id)!;
      if (t.status === 'Yet to Start') entry.yetToStart += 1;
      else if (t.status === 'Started') entry.started += 1;
      else if (t.status === 'WIP') entry.wip += 1;
      else if (t.status === 'Blocked') entry.blocked += 1;
      else if (t.status === 'In Review') entry.inReview += 1;
      else if (t.status === 'Completed') entry.completed += 1;
    });
    return Array.from(map.entries()).map(([user_id, counts]) => ({ user_id, ...counts }));
  };

  const handleStatusFilterChange = (val: string) => {
    setStatusFilter(val);
    const next = new URLSearchParams(searchParams);
    next.set('status', val);
    setSearchParams(next, { replace: true });
  };

  const handleUserFilterChange = (val: string) => {
    setUserFilter(val);
    const next = new URLSearchParams(searchParams);
    next.set('user', val);
    setSearchParams(next, { replace: true });
  };

  const handleSort = (key: 'name' | 'started' | 'wip' | 'completed' | 'total') => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortDir('asc');
      }
      console.log(`Sorting by ${key}`);
      return key;
    });
  };

  const getSortedSummaryData = () => {
    const data = getSummaryData().map((row) => ({
      ...row,
      total: row.yetToStart + row.started + row.wip + row.blocked + row.inReview + row.completed,
    }));

    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

    const sorted = [...data].sort((a, b) => {
      if (sortKey === 'name') {
        const aName = getUserDisplayName(a.user_id);
        const bName = getUserDisplayName(b.user_id);
        const cmp = collator.compare(aName, bName);
        return sortDir === 'asc' ? cmp : -cmp;
      } else {
        const aVal = a[sortKey] as number;
        const bVal = b[sortKey] as number;
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
    });

    return sorted;
  };

  const formatCompletionTime = (completionTime: unknown) => {
    if (!completionTime) return '-';
    if (typeof completionTime === 'string') {
      try {
        return format(new Date(completionTime), 'MMM d, yyyy h:mm a');
      } catch {
        return completionTime;
      }
    }
    return '-';
  };
  const exportToExcel = async () => {
    try {
      console.log('Starting Excel export...');
      
      // Get filtered tasks
      const filteredTasks = getFilteredTasks();
      
      if (filteredTasks.length === 0) {
        console.log('No tasks to export');
        return;
      }

      // Prepare data for Excel export
      const exportData = filteredTasks.map(task => ({
        'User Name': getUserDisplayName(task.user_id),
        'Assigned By': task.assigned_by ? getUserDisplayName(task.assigned_by) : '-',
        'Estimated End Time': task.estimated_end_time ? format(new Date(task.estimated_end_time), 'MMM d, yyyy h:mm a') : '-',
        'Task Description': task.task_description,
        'Status': task.status,
        'Created At': format(new Date(task.created_at), 'MMM d, yyyy h:mm a'),
        'Updated At': format(new Date(task.updated_at), 'MMM d, yyyy h:mm a'),
        'Completion Time': formatCompletionTime(task.completion_time),
        'Total Time Taken': formatDuration(task.total_time_taken as string | null)
      }));

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Auto-size columns
      const colWidths = [
        { wch: 20 }, // User Name
        { wch: 40 }, // Task Description
        { wch: 12 }, // Status
        { wch: 20 }, // Created At
        { wch: 20 }, // Updated At
        { wch: 20 }, // Completion Time
        { wch: 18 }  // Total Time Taken
      ];
      worksheet['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Tasks');

      // Generate filename with current date
      const currentDate = format(new Date(), 'yyyy-MM-dd');
      const filename = `tasks-export-${currentDate}.xlsx`;

      // Save file
      XLSX.writeFile(workbook, filename);

      console.log(`Tasks exported: ${exportData.length} rows`);
    } catch (error) {
      console.log(`Export query error: ${error}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {user?.email?.split('@')[0] || 'Team Member'}!
        </h1>
        <p className="text-gray-600">Here's your daily standup overview</p>
        {/* Debug info */}
        <div className="mt-2 text-xs text-gray-500">
          Current Role: {isAdmin ? 'admin' : isManager ? 'manager' : 'member'} 
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamMemberCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Your Started Tasks</CardTitle>
            <Play className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{userStats.started}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Your WIP Tasks</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{userStats.wip}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Your Completed Tasks</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{userStats.completed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Manager Section */}
      {isManager && !isAdmin && (
        <div className="space-y-8 mb-8">
          {/* Task Creation Form */}
          <TaskCreationForm user={user} onTaskCreated={fetchData} />
          
          {/* Manager's Assigned Tasks */}
          <ManagerTasksTable tasks={managerTasks} teamMembers={teamMembers} onTaskUpdated={fetchData} />
        </div>
      )}

      {/* Task Update Button for Non-Admins/Non-Managers */}
      {!isAdmin && !isManager && (
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Manage your daily tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full sm:w-auto">
                <a href="/tasks">Update Your Tasks</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Admin Dashboard */}
      {isAdmin && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Badge className="mr-2">Admin</Badge>
              Team Dashboard
            </CardTitle>
            <CardDescription>Overview of all team tasks</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Admin Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">{allStats.yetToStart}</div>
                <div className="text-sm text-gray-600">Yet to Start</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{allStats.started}</div>
                <div className="text-sm text-gray-600">Started</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{allStats.wip}</div>
                <div className="text-sm text-gray-600">WIP</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{allStats.blocked}</div>
                <div className="text-sm text-gray-600">Blocked</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{allStats.inReview}</div>
                <div className="text-sm text-gray-600">In Review</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{allStats.completed}</div>
                <div className="text-sm text-gray-600">Completed</div>
              </div>
            </div>

            {/* Filters and Export */}
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tasks</SelectItem>
                  <SelectItem value="yet to start">Yet to Start</SelectItem>
                  <SelectItem value="started">Started</SelectItem>
                  <SelectItem value="wip">WIP</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                  <SelectItem value="in review">In Review</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={userFilter} onValueChange={handleUserFilterChange}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.user_id} value={member.display_name}>
                      {member.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button 
                onClick={exportToExcel}
                variant="outline"
                className="w-full sm:w-auto"
              >
                <Download className="w-4 h-4 mr-2" />
                Export to Excel
              </Button>

              <Button asChild variant="secondary" className="w-full sm:w-auto">
                <Link to={`/admin/task-details?status=${statusFilter}&user=${userFilter}`}>
                  View Task Details
                </Link>
              </Button>
            </div>

            {/* User-wise Status Summary Table */}
            <div className="overflow-x-auto">
              <Table className="w-full border border-gray-300 text-center">
                <TableHeader>
                  <TableRow className="bg-gray-200 text-center">
                    <TableHead
                      className="border border-gray-300 font-bold cursor-pointer select-none text-center w-auto"
                      onClick={() => handleSort('name')}
                    >
                      User Name
                    </TableHead>
                    <TableHead
                      className="border border-gray-300 font-bold cursor-pointer select-none text-center w-24"
                      onClick={() => handleSort('started')}
                    >
                      Started
                    </TableHead>
                    <TableHead
                      className="border border-gray-300 font-bold cursor-pointer select-none text-center w-24"
                      onClick={() => handleSort('wip')}
                    >
                      WIP
                    </TableHead>
                    <TableHead
                      className="border border-gray-300 font-bold cursor-pointer select-none text-center w-24"
                      onClick={() => handleSort('completed')}
                    >
                      Completed
                    </TableHead>
                    <TableHead
                      className="border border-gray-300 font-bold cursor-pointer select-none text-center w-24"
                      onClick={() => handleSort('total')}
                    >
                      Total
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getSortedSummaryData().length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                        No data for current filters
                      </TableCell>
                    </TableRow>
                  ) : (
                    getSortedSummaryData().map((row) => (
                      <TableRow key={row.user_id} className="odd:bg-white even:bg-gray-100 hover:bg-gray-50">
                        <TableCell className="font-bold border border-gray-300 text-center w-auto">
                          {getUserDisplayName(row.user_id)}
                        </TableCell>
                        <TableCell className="text-sm text-gray-700 border border-gray-300 text-center w-24">{row.started}</TableCell>
                        <TableCell className="text-sm text-gray-700 border border-gray-300 text-center w-24">{row.wip}</TableCell>
                        <TableCell className="text-sm text-gray-700 border border-gray-300 text-center w-24">{row.completed}</TableCell>
                        <TableCell className="text-sm text-gray-700 border border-gray-300 text-center w-24">{row.total}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default HomePage;
