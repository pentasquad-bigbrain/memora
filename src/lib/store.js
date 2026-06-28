import { create } from 'zustand'
import { supabase } from './supabase'

const pickKnown = (input, keys) =>
  Object.fromEntries(
    keys
      .filter((key) => input[key] !== undefined)
      .map((key) => [key, input[key]])
  )

const normalizeTask = (task) => ({
  ...pickKnown(task, ['project_id', 'person_id', 'title', 'notes', 'due_at', 'progress', 'status', 'source']),
  source: ['manual', 'ai_capture', 'voice', 'screenshot'].includes(task.source) ? task.source : 'manual'
})

const normalizeIdea = (idea) => ({
  ...pickKnown(idea, ['project_id', 'title', 'body', 'tags', 'status', 'source']),
  source: ['capture', 'screenshot', 'voice', 'manual'].includes(idea.source) ? idea.source : 'manual'
})

const normalizePerson = (person) => ({
  ...pickKnown(person, ['name', 'role', 'avatar_url', 'last_interaction']),
  role: ['client', 'team', 'personal', 'other'].includes(person.role) ? person.role : 'other'
})

const normalizeVaultItem = (item) => ({
  ...pickKnown(item, ['project_id', 'idea_id', 'type', 'title', 'file_url', 'ocr_text', 'tags']),
  type: ['screenshot', 'document', 'receipt', 'image', 'note'].includes(item.type) ? item.type : 'note'
})

const normalizeExpense = (expense) =>
  pickKnown(expense, ['project_id', 'vault_item_id', 'vendor', 'amount', 'currency', 'category', 'date', 'notes'])

export const useStore = create((set, get) => ({
  // ── Auth ──────────────────────────────────────────────────
  user: null,
  setUser: (user) => set({ user }),

  // ── Active space ──────────────────────────────────────────
  spaces: [],
  activeSpace: null,
  setActiveSpace: (space) => {
    set({ activeSpace: space })
    get().fetchAll()
  },

  // ── Data ──────────────────────────────────────────────────
  tasks: [],
  ideas: [],
  people: [],
  expenses: [],
  vaultItems: [],
  nudges: [],
  captures: [],
  journalEntry: null,

  loading: false,
  setLoading: (loading) => set({ loading }),

  // ── Fetch all data for active space ───────────────────────
  fetchAll: async () => {
    const { user, activeSpace } = get()
    if (!user) return

    set({ loading: true })

    const spaceFilter = activeSpace?.id
      ? { space_id: activeSpace.id }
      : {}

    const [
      { data: tasks },
      { data: ideas },
      { data: people },
      { data: expenses },
      { data: vaultItems },
      { data: nudges },
      { data: captures }
    ] = await Promise.all([
      supabase.from('tasks').select('*, person:people(name,role)').eq('user_id', user.id).match(spaceFilter).order('created_at', { ascending: false }),
      supabase.from('ideas').select('*').eq('user_id', user.id).match(spaceFilter).order('created_at', { ascending: false }),
      supabase.from('people').select('*').eq('user_id', user.id).match(spaceFilter).order('last_interaction', { ascending: false }),
      supabase.from('expenses').select('*').eq('user_id', user.id).match(spaceFilter).order('date', { ascending: false }),
      supabase.from('vault_items').select('*').eq('user_id', user.id).match(spaceFilter).order('created_at', { ascending: false }),
      supabase.from('nudges').select('*').eq('user_id', user.id).eq('dismissed', false).order('created_at', { ascending: false }).limit(5),
      supabase.from('captures').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10)
    ])

    set({
      tasks: tasks || [],
      ideas: ideas || [],
      people: people || [],
      expenses: expenses || [],
      vaultItems: vaultItems || [],
      nudges: nudges || [],
      captures: captures || [],
      loading: false
    })
  },

  fetchSpaces: async () => {
    const { user } = get()
    if (!user) return
    const { data } = await supabase.from('spaces').select('*').eq('user_id', user.id)
    const spaces = data || []
    set({ spaces, activeSpace: spaces[0] || null })
  },

  // ── Tasks ─────────────────────────────────────────────────
  addTask: async (task) => {
    const { user, activeSpace } = get()
    const { data, error } = await supabase.from('tasks').insert({
      ...normalizeTask(task),
      user_id: user.id,
      space_id: activeSpace?.id || null
    }).select().single()
    if (!error) set((s) => ({ tasks: [data, ...s.tasks] }))
    return { data, error }
  },

  updateTask: async (id, updates) => {
    const cleaned = normalizeTask(updates)
    const { error } = await supabase.from('tasks').update({ ...cleaned, updated_at: new Date().toISOString() }).eq('id', id)
    if (!error) set((s) => ({ tasks: s.tasks.map(t => t.id === id ? { ...t, ...cleaned } : t) }))
    return { error }
  },

  // ── Ideas ─────────────────────────────────────────────────
  addIdea: async (idea) => {
    const { user, activeSpace } = get()
    const { data, error } = await supabase.from('ideas').insert({
      ...normalizeIdea(idea),
      user_id: user.id,
      space_id: activeSpace?.id || null
    }).select().single()
    if (!error) set((s) => ({ ideas: [data, ...s.ideas] }))
    return { data, error }
  },

  // ── People ────────────────────────────────────────────────
  addPerson: async (person) => {
    const { user, activeSpace } = get()
    const { data, error } = await supabase.from('people').insert({
      ...normalizePerson(person),
      user_id: user.id,
      space_id: activeSpace?.id || null
    }).select().single()
    if (!error) set((s) => ({ people: [data, ...s.people] }))
    return { data, error }
  },

  // ── Expenses ──────────────────────────────────────────────
  addExpense: async (expense) => {
    const { user, activeSpace } = get()
    const { data, error } = await supabase.from('expenses').insert({
      ...normalizeExpense(expense),
      user_id: user.id,
      space_id: activeSpace?.id || null
    }).select().single()
    if (!error) set((s) => ({ expenses: [data, ...s.expenses] }))
    return { data, error }
  },

  // ── Captures ──────────────────────────────────────────────
  addCapture: async (capture) => {
    const { user } = get()
    const { data, error } = await supabase.from('captures').insert({
      ...capture,
      user_id: user.id
    }).select().single()
    if (!error) set((s) => ({ captures: [data, ...s.captures.slice(0, 9)] }))
    return { data, error }
  },

  // ── Nudges ────────────────────────────────────────────────
  dismissNudge: async (id) => {
    await supabase.from('nudges').update({ dismissed: true }).eq('id', id)
    set((s) => ({ nudges: s.nudges.filter(n => n.id !== id) }))
  },

  addNudges: async (nudgeList) => {
    const { user } = get()
    const rows = nudgeList.map(n => ({ ...n, user_id: user.id }))
    const { data } = await supabase.from('nudges').insert(rows).select()
    if (data) set((s) => ({ nudges: [...data, ...s.nudges].slice(0, 5) }))
  },

  // ── Vault ─────────────────────────────────────────────────
  addVaultItem: async (item) => {
    const { user, activeSpace } = get()
    const { data, error } = await supabase.from('vault_items').insert({
      ...normalizeVaultItem(item),
      user_id: user.id,
      space_id: activeSpace?.id || null
    }).select().single()
    if (!error) set((s) => ({ vaultItems: [data, ...s.vaultItems] }))
    return { data, error }
  },

  // ── People (extended) ────────────────────────────────────
  findOrCreatePerson: async (name) => {
    const trimmed = name.trim()
    const { people } = get()
    const existing = people.find(p => p.name.toLowerCase() === trimmed.toLowerCase())
    if (existing) return existing
    const { data } = await get().addPerson({ name: trimmed, role: 'other' })
    return data
  },

  // ── Spaces ────────────────────────────────────────────────
  addSpace: async (name) => {
    const { user } = get()
    const { data, error } = await supabase.from('spaces').insert({
      name,
      user_id: user.id,
      type: 'custom'
    }).select().single()
    if (!error) set((s) => ({ spaces: [...s.spaces, data] }))
    return { data, error }
  },

  // ── Deletes ───────────────────────────────────────────────
  deleteTask: async (id) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (!error) set(s => ({ tasks: s.tasks.filter(t => t.id !== id) }))
    return { error }
  },
  deleteIdea: async (id) => {
    const { error } = await supabase.from('ideas').delete().eq('id', id)
    if (!error) set(s => ({ ideas: s.ideas.filter(i => i.id !== id) }))
    return { error }
  },
  deleteVaultItem: async (id) => {
    const { error } = await supabase.from('vault_items').delete().eq('id', id)
    if (!error) set(s => ({ vaultItems: s.vaultItems.filter(v => v.id !== id) }))
    return { error }
  },
  updateVaultItem: async (id, updates) => {
    const cleaned = normalizeVaultItem(updates)
    const { error } = await supabase.from('vault_items').update(cleaned).eq('id', id)
    if (!error) set(s => ({ vaultItems: s.vaultItems.map(v => v.id === id ? { ...v, ...updates } : v) }))
    return { error }
  },
  updateIdea: async (id, updates) => {
    const { error } = await supabase.from('ideas').update(updates).eq('id', id)
    if (!error) set(s => ({ ideas: s.ideas.map(i => i.id === id ? { ...i, ...updates } : i) }))
    return { error }
  },
  deleteSpace: async (id) => {
    const { error } = await supabase.from('spaces').delete().eq('id', id)
    if (!error) set(s => {
      const spaces = s.spaces.filter(sp => sp.id !== id)
      return { spaces, activeSpace: s.activeSpace?.id === id ? (spaces[0] || null) : s.activeSpace }
    })
    return { error }
  },
  deleteExpense: async (id) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (!error) set(s => ({ expenses: s.expenses.filter(e => e.id !== id) }))
    return { error }
  },

  // ── Journal ───────────────────────────────────────────────
  fetchJournalEntry: async (date) => {
    const { user } = get()
    const { data } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', date)
      .maybeSingle()
    return data
  },

  saveJournalEntry: async ({ date, personalNote, autoSummary, journalImages, logEntries }) => {
    const { user } = get()
    const summaryPayload = autoSummary
      ? { ...autoSummary, journal_images: journalImages || [], log_entries: logEntries || [] }
      : ((journalImages?.length || logEntries?.length)
          ? { journal_images: journalImages || [], log_entries: logEntries || [] }
          : null)

    const { data, error } = await supabase
      .from('journal_entries')
      .upsert({
        user_id: user.id,
        date,
        personal_note: personalNote || null,
        auto_summary: summaryPayload
      }, { onConflict: 'user_id,date' })
      .select()
      .single()
    return { data, error }
  }
}))
