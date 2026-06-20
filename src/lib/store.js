import { create } from 'zustand'
import { supabase } from './supabase'

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
      ...task,
      user_id: user.id,
      space_id: activeSpace?.id || null
    }).select().single()
    if (!error) set((s) => ({ tasks: [data, ...s.tasks] }))
    return { data, error }
  },

  updateTask: async (id, updates) => {
    const { error } = await supabase.from('tasks').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
    if (!error) set((s) => ({ tasks: s.tasks.map(t => t.id === id ? { ...t, ...updates } : t) }))
    return { error }
  },

  // ── Ideas ─────────────────────────────────────────────────
  addIdea: async (idea) => {
    const { user, activeSpace } = get()
    const { data, error } = await supabase.from('ideas').insert({
      ...idea,
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
      ...person,
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
      ...expense,
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
      ...item,
      user_id: user.id,
      space_id: activeSpace?.id || null
    }).select().single()
    if (!error) set((s) => ({ vaultItems: [data, ...s.vaultItems] }))
    return { data, error }
  }
}))
