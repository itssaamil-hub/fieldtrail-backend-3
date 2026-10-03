import { test, expect } from '@playwright/test';

const apiBase = 'http://127.0.0.1:9999';
const ADMIN_ID = '00000000-0000-4000-8000-000000000001';
const AAMIL_ID = '00000000-0000-4000-8000-000000000002';
const ANAND_ID = '00000000-0000-4000-8000-000000000003';
const TASK_ID = '00000000-0000-4000-8000-000000000010';
const TASK_TWO_ID = '00000000-0000-4000-8000-000000000011';
const NEXT_TASK_ID = '00000000-0000-4000-8000-000000000012';

const employees = [
  { id: AAMIL_ID, full_name: 'Aamil', is_active: true },
  { id: ANAND_ID, full_name: 'Anand', is_active: true },
];

const taskTemplate = () => ({
  id: TASK_ID,
  title: 'Visit Walnut Cafe',
  notes: 'Take the latest quotation.',
  lead_id: null,
  business_name: 'General task',
  assigned_to: ANAND_ID,
  assignee_name: 'Anand',
  created_by: ADMIN_ID,
  due_at: '2026-10-04T06:30:00.000Z',
  priority: 'high',
  recurrence: 'daily',
  recurrence_day: 4,
  status: 'pending',
  completed_at: null,
  completion_note: null,
});

function genericResponse(pathname, method) {
  if (pathname === '/admin/salesmen') return { salesmen: employees };
  if (pathname === '/admin/dashboard/summary') return { conversationLeads: 0 };
  if (pathname.startsWith('/admin/leads')) return { leads: [], total: 0 };
  if (pathname.startsWith('/admin/expenses')) return [];
  if (pathname === '/day-closing/reports') return { reports: [], hasMore: false };
  if (pathname.startsWith('/day-closing/permissions/')) return { require_closing: false, allow_skip: true, require_skip_reason: false, allow_multiple_starts: true, allow_lead_without_start_day: false };
  if (pathname === '/admin/reports/performance-targets') return { targets: [] };
  if (pathname === '/tasks/notifications') return { notifications: [] };
  if (pathname.includes('/notifications')) return {};
  if (pathname === '/salesman/leads-summary') return {};
  if (pathname === '/salesman/leads') return { leads: [], total: 0 };
  if (pathname === '/salesman/tasks') return { tasks: [], hasMore: false };
  if (pathname === '/salesman/messages') return { messages: [] };
  if (pathname.includes('/attendance')) return {};
  if (pathname.includes('/settings')) return {};
  if (pathname === '/quotations/alerts') return { alerts: [] };
  if (pathname === '/quotations') return { quotes: [], hasMore: false };
  if (pathname === '/onboarding/customers') return { customers: [], hasMore: false };
  if (pathname === '/collections') return { accounts: [], summary: { collected: 0, pending: 0, overdue: 0 }, employees: [], hasMore: false };
  if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') return { ok: true };
  return {};
}

async function boot(page, role = 'admin', initialTasks = [taskTemplate()]) {
  const state = {
    tasks: structuredClone(initialTasks),
    createBodies: [],
    statusBodies: [],
    completeCalls: 0,
    rescheduleBodies: [],
    events: new Map(),
  };

  await page.route(`${apiBase}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    let body = {};
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      try { body = request.postDataJSON() || {}; } catch { body = {}; }
    }

    if (path === '/tasks' && method === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tasks: state.tasks, hasMore: false, pending: state.tasks.filter(t => t.status !== 'completed').length, workflowVersion: 2 }) });
    }
    if (path === '/tasks' && method === 'POST') {
      state.createBodies.push(body);
      const created = {
        id: TASK_TWO_ID,
        title: body.title,
        notes: body.notes || '',
        lead_id: body.leadId || null,
        business_name: null,
        assigned_to: body.assignedTo || AAMIL_ID,
        assignee_name: employees.find(e => e.id === (body.assignedTo || AAMIL_ID))?.full_name || 'Aamil',
        created_by: ADMIN_ID,
        due_at: body.dueAt,
        priority: body.priority || 'medium',
        recurrence: body.recurrence || 'none',
        recurrence_day: 4,
        status: 'pending',
        completed_at: null,
        completion_note: null,
      };
      state.tasks.push(created);
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ task: created }) });
    }
    if (path === '/tasks/leads' && method === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ leads: [] }) });
    }

    const taskMatch = path.match(/^\/tasks\/([0-9a-f-]+)$/i);
    if (taskMatch && method === 'GET') {
      const task = state.tasks.find(t => t.id === taskMatch[1]);
      return route.fulfill({ status: task ? 200 : 404, contentType: 'application/json', body: JSON.stringify(task ? { task, events: state.events.get(task.id) || [], workflowAvailable: true } : { error: 'Task not found' }) });
    }

    const statusMatch = path.match(/^\/tasks\/([0-9a-f-]+)\/status$/i);
    if (statusMatch && method === 'PATCH') {
      state.statusBodies.push({ id: statusMatch[1], ...body });
      const task = state.tasks.find(t => t.id === statusMatch[1]);
      if (task && task.status !== 'completed') task.status = body.status;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    }

    const completeMatch = path.match(/^\/tasks\/([0-9a-f-]+)\/complete$/i);
    if (completeMatch && method === 'PATCH') {
      state.completeCalls += 1;
      const task = state.tasks.find(t => t.id === completeMatch[1]);
      if (task && task.status !== 'completed') {
        task.status = 'completed';
        task.completed_at = '2026-10-03T17:30:00.000Z';
        task.completion_note = body.note || '';
        if (task.recurrence !== 'none' && !state.tasks.some(t => t.id === NEXT_TASK_ID)) {
          state.tasks.push({ ...task, id: NEXT_TASK_ID, status: 'pending', completed_at: null, completion_note: null, due_at: '2026-10-05T06:30:00.000Z', repeat_of: task.id });
        }
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    }

    const rescheduleMatch = path.match(/^\/tasks\/([0-9a-f-]+)\/reschedule$/i);
    if (rescheduleMatch && method === 'PATCH') {
      state.rescheduleBodies.push({ id: rescheduleMatch[1], ...body });
      const task = state.tasks.find(t => t.id === rescheduleMatch[1]);
      if (task) {
        const old = task.due_at;
        task.due_at = body.dueAt;
        const events = state.events.get(task.id) || [];
        events.unshift({ id: `event-${events.length + 1}`, action: 'rescheduled', old_value: old, new_value: body.dueAt, reason: body.reason, actor_name: role === 'admin' ? 'Admin' : 'Aamil', created_at: '2026-10-03T17:31:00.000Z' });
        state.events.set(task.id, events);
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    }

    const fallback = genericResponse(path, method);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fallback) });
  });

  const session = role === 'admin'
    ? { id: ADMIN_ID, role: 'admin', name: 'Admin', fullName: 'Admin', token: 'test-token' }
    : { id: AAMIL_ID, role: 'salesman', name: 'Aamil', fullName: 'Aamil', token: 'test-token' };
  await page.addInitScript(value => localStorage.setItem('fieldtrail:session', JSON.stringify(value)), session);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  return state;
}

async function openTasks(page) {
  await page.getByRole('button', { name: /^Tasks(?:,|$)/ }).click();
  await expect(page.getByRole('heading', { name: /Team Tasks|My Tasks/ })).toBeVisible();
}

test('admin creates a fully specified task for the selected employee', async ({ page }) => {
  const state = await boot(page, 'admin', []);
  await openTasks(page);
  await page.getByRole('button', { name: '+ Create Task' }).click();
  const createForm = page.locator('form.ft-task-form').filter({ has: page.getByRole('heading', { name: 'Create task' }) });
  await createForm.getByLabel('Task title').fill('Send revised quotation');
  await createForm.getByLabel('Assign to').selectOption({ label: 'Anand' });
  await createForm.getByLabel('Due date and time (IST)').fill('2026-10-05T15:30');
  await createForm.getByLabel('Priority').selectOption('high');
  await createForm.getByLabel('Repeat').selectOption('weekly');
  await createForm.getByLabel('Notes (optional)').fill('Confirm the final module list before sending.');
  await createForm.getByRole('button', { name: 'Save task' }).click();

  await expect.poll(() => state.createBodies.length).toBe(1);
  expect(state.createBodies[0]).toMatchObject({
    title: 'Send revised quotation',
    assignedTo: ANAND_ID,
    priority: 'high',
    recurrence: 'weekly',
    notes: 'Confirm the final module list before sending.',
  });
  expect(state.createBodies[0].dueAt).toBe('2026-10-05T10:00:00.000Z');
});

test('task progress can move from To do to In progress and then complete only once', async ({ page }) => {
  const state = await boot(page);
  await openTasks(page);
  await page.getByRole('button', { name: /Visit Walnut Cafe/ }).click();
  await expect(page.getByRole('complementary', { name: 'Task details' })).toBeVisible();

  await page.getByRole('button', { name: 'Start task' }).click();
  await expect.poll(() => state.statusBodies.at(-1)?.status).toBe('in_progress');

  await page.getByRole('button', { name: 'Mark complete' }).click();
  await page.getByLabel('Completion note (optional)').fill('Owner approved the quotation.');
  const confirm = page.getByRole('button', { name: 'Confirm completion' });
  await confirm.dblclick({ delay: 25 });

  await expect.poll(() => state.completeCalls).toBe(1);
  expect(state.tasks.filter(t => t.repeat_of === TASK_ID)).toHaveLength(1);
  expect(state.tasks.find(t => t.id === TASK_ID)?.status).toBe('completed');
});

test('reschedule cannot submit without a reason and records the approved change', async ({ page }) => {
  const state = await boot(page);
  await openTasks(page);
  await page.getByRole('button', { name: /Visit Walnut Cafe/ }).click();
  await page.getByRole('button', { name: 'Reschedule' }).click();
  await page.getByLabel('New due date and time (IST)').fill('2026-10-06T16:00');
  await page.getByRole('button', { name: /Save|Reschedule/i }).last().click();
  await page.waitForTimeout(100);
  expect(state.rescheduleBodies).toHaveLength(0);

  await page.getByLabel('Reason (required)').fill('Customer requested a later visit.');
  await page.getByRole('button', { name: /Save|Reschedule/i }).last().click();
  await expect.poll(() => state.rescheduleBodies.length).toBe(1);
  expect(state.rescheduleBodies[0].reason).toBe('Customer requested a later visit.');
  expect(state.rescheduleBodies[0].dueAt).toBe('2026-10-06T10:30:00.000Z');
});

test('desktop board drag updates To do to In progress through the workflow API', async ({ page }) => {
  const state = await boot(page);
  await openTasks(page);
  await expect(page.getByRole('group', { name: 'Task layout' })).toBeVisible();
  const source = page.getByRole('button', { name: /Visit Walnut Cafe/ });
  const target = page.getByRole('region', { name: 'In progress' });
  await source.dragTo(target);
  await expect.poll(() => state.statusBodies.at(-1)?.status).toBe('in_progress');
});

test('salesman mobile task view stays scoped and exposes mobile filters without admin employee filter', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page, 'salesman', [{ ...taskTemplate(), assigned_to: AAMIL_ID, assignee_name: 'Aamil', created_by: AAMIL_ID }]);
  await openTasks(page);
  await expect(page.getByRole('heading', { name: 'My Tasks' })).toBeVisible();
  await page.getByRole('button', { name: /^Filter/ }).click();
  const filters = page.getByRole('dialog', { name: 'Task filters' });
  await expect(filters).toBeVisible();
  await expect(filters.getByLabel('Employee')).toHaveCount(0);
  await expect(filters.getByLabel('Priority')).toBeVisible();
  await expect(filters.getByLabel('Progress')).toBeVisible();
  await expect(filters.getByLabel('Due from · IST')).toBeVisible();
  await expect(filters.getByLabel('Due through · IST')).toBeVisible();
});
