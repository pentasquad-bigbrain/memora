const SUPABASE_URL = 'https://cqmietxgwafqfckjbrep.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWlldHhnd2FmcWZja2picmVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4OTkyNjUsImV4cCI6MjA5NzQ3NTI2NX0.-NTbPG8nG2nkzaV0w7qiFHaqtewVbrjHxLnEw1tl8FM';

const DEMO_EMAIL = 'demo@memora.app';
const DEMO_PASSWORD = 'MemoraDemo2026!';

async function api(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...opts,
    headers: {
      'apikey': ANON_KEY,
      'Content-Type': 'application/json',
      ...opts.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${opts.method || 'GET'} ${path} -> ${res.status}: ${text}`);
  }
  return res.status === 204 ? null : res.json();
}

async function main() {
  // Sign up (or sign in if it already exists)
  let session;
  try {
    const signup = await api('/auth/v1/signup', {
      method: 'POST',
      body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
    });
    session = signup;
  } catch (e) {
    console.log('signup failed (likely already exists), trying sign-in:', e.message);
  }

  if (!session || !session.access_token) {
    session = await api('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
    });
  }

  const accessToken = session.access_token;
  const userId = session.user.id;
  console.log('Demo user id:', userId);

  const authed = (path, opts = {}) => api(path, {
    ...opts,
    headers: { Authorization: `Bearer ${accessToken}`, Prefer: 'return=representation', ...opts.headers },
  });

  // Wipe any existing demo data so re-running this script is idempotent
  for (const table of ['nudges', 'journal_entries', 'captures', 'expenses', 'vault_items', 'ideas', 'tasks', 'projects', 'people', 'spaces']) {
    await authed(`/rest/v1/${table}?user_id=eq.${userId}`, { method: 'DELETE' });
  }

  const spaces = await authed('/rest/v1/spaces', {
    method: 'POST',
    body: JSON.stringify([
      { user_id: userId, name: 'Personal', type: 'personal', color: '#3B82F6' },
      { user_id: userId, name: 'Work', type: 'work', color: '#10B981' },
    ]),
  });
  const [personalSpace, workSpace] = spaces;

  const people = await authed('/rest/v1/people', {
    method: 'POST',
    body: JSON.stringify([
      { user_id: userId, space_id: workSpace.id, name: 'Aarav Mehta', role: 'client', last_interaction: new Date(Date.now() - 86400000).toISOString() },
      { user_id: userId, space_id: workSpace.id, name: 'Priya Nair', role: 'team', last_interaction: new Date(Date.now() - 3600000).toISOString() },
      { user_id: userId, space_id: personalSpace.id, name: 'Rohan Gupta', role: 'personal', last_interaction: null },
    ]),
  });

  const projects = await authed('/rest/v1/projects', {
    method: 'POST',
    body: JSON.stringify([
      { user_id: userId, space_id: workSpace.id, name: 'Memora Launch', description: 'Ship the MVP and onboard first users', status: 'active' },
      { user_id: userId, space_id: personalSpace.id, name: 'Home Renovation', description: 'Kitchen + living room repaint', status: 'paused' },
    ]),
  });

  await authed('/rest/v1/tasks', {
    method: 'POST',
    body: JSON.stringify([
      { user_id: userId, space_id: workSpace.id, project_id: projects[0].id, person_id: people[0].id, title: 'Send proposal to Aarav', notes: 'Include pricing tiers', due_at: new Date(Date.now() + 86400000).toISOString(), progress: 40, status: 'in_progress', source: 'manual' },
      { user_id: userId, space_id: workSpace.id, project_id: projects[0].id, person_id: people[1].id, title: 'Review onboarding flow with Priya', notes: null, due_at: null, progress: 0, status: 'todo', source: 'ai_capture' },
      { user_id: userId, space_id: workSpace.id, project_id: projects[0].id, person_id: null, title: 'Fix Google OAuth setup', notes: null, due_at: null, progress: 100, status: 'done', source: 'manual' },
      { user_id: userId, space_id: personalSpace.id, project_id: projects[1].id, person_id: null, title: 'Buy paint samples', notes: null, due_at: new Date(Date.now() + 2 * 86400000).toISOString(), progress: 0, status: 'todo', source: 'voice' },
    ]),
  });

  await authed('/rest/v1/ideas', {
    method: 'POST',
    body: JSON.stringify([
      { user_id: userId, space_id: workSpace.id, project_id: projects[0].id, title: 'Daily journal auto-summary via AI', body: 'Use Groq to summarize the day from captures + tasks completed.', tags: ['ai', 'journal'], status: 'developing', source: 'capture' },
      { user_id: userId, space_id: personalSpace.id, project_id: null, title: 'Weekend trip to Goa', body: 'Check flights for next long weekend.', tags: ['travel'], status: 'raw', source: 'manual' },
    ]),
  });

  await authed('/rest/v1/expenses', {
    method: 'POST',
    body: JSON.stringify([
      { user_id: userId, space_id: workSpace.id, project_id: projects[0].id, vendor: 'Vercel', amount: 1499.00, currency: 'INR', category: 'Hosting', date: new Date().toISOString().slice(0, 10), notes: 'Pro plan renewal' },
      { user_id: userId, space_id: personalSpace.id, project_id: null, vendor: 'Asian Paints', amount: 3200.00, currency: 'INR', category: 'Home', date: new Date(Date.now() - 86400000).toISOString().slice(0, 10), notes: null },
    ]),
  });

  await authed('/rest/v1/journal_entries', {
    method: 'POST',
    body: JSON.stringify([
      { user_id: userId, date: new Date().toISOString().slice(0, 10), auto_summary: { tasks_done: 1, ideas_captured: 1, mood: 'focused' }, personal_note: 'Good progress on the launch checklist today.' },
    ]),
  });

  await authed('/rest/v1/nudges', {
    method: 'POST',
    body: JSON.stringify([
      { user_id: userId, type: 'followup', message: "You haven't followed up with Aarav Mehta in a day — want to send a check-in?", entity_type: 'people', entity_id: people[0].id, dismissed: false },
      { user_id: userId, type: 'idea_prompt', message: 'Your "Daily journal auto-summary" idea is still in draft — flesh it out?', entity_type: 'ideas', entity_id: null, dismissed: false },
    ]),
  });

  console.log('Demo data seeded successfully.');
  console.log('Login with: email =', DEMO_EMAIL, ' password =', DEMO_PASSWORD);
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
