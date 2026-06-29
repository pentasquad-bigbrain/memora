import { create } from 'zustand'
import { supabase } from './supabase'

const pickKnown = (input, keys) =>
  Object.fromEntries(
    keys
      .filter((key) => input[key] !== undefined)
      .map((key) => [key, input[key]])
  )

const normalizeTask = (task) => ({
  ...pickKnown(task, ['project_id', 'person_id', 'title', 'notes', 'due_at', 'reminder_at', 'priority', 'progress', 'status', 'source']),
  ...(task.priority !== undefined
    ? { priority: task.priority === 'normal' ? 'med' : task.priority }
    : {}),
  ...(task.source !== undefined
    ? { source: ['manual', 'ai_capture', 'voice', 'screenshot'].includes(task.source) ? task.source : 'manual' }
    : {})
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

const isMissingTaskColumnError = (error) => {
  const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase()
  return message.includes('priority') || message.includes('reminder_at')
}

const stripTaskCompatFields = (task) => {
  const { priority, reminder_at, ...rest } = task
  return rest
}

const TAG_CACHE_KEYS = {
  ideas: 'memora_idea_tags_cache',
  vaultItems: 'memora_vault_tags_cache'
}
const TASK_META_CACHE_KEY = 'memora_task_meta_cache'

const isMissingTagsColumnError = (error) => {
  const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase()
  return message.includes('tags')
}

const readTagCache = (key) => {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(window.localStorage.getItem(key) || '{}') } catch { return {} }
}

const writeTagCache = (key, value) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify(value))
}

const cacheEntityTags = (key, id, tags) => {
  if (!id || tags === undefined) return
  const cache = readTagCache(key)
  cache[id] = tags
  writeTagCache(key, cache)
}

const mergeEntityTags = (items, key) => {
  const cache = readTagCache(key)
  return (items || []).map((item) => ({
    ...item,
    tags: Array.isArray(item.tags) && item.tags.length ? item.tags : (cache[item.id] || item.tags || [])
  }))
}

const readTaskMetaCache = () => {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(window.localStorage.getItem(TASK_META_CACHE_KEY) || '{}') } catch { return {} }
}

const writeTaskMetaCache = (value) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(TASK_META_CACHE_KEY, JSON.stringify(value))
}

const cacheTaskMeta = (id, updates) => {
  if (!id) return
  const meta = pickKnown(updates, ['priority', 'reminder_at'])
  if (!Object.keys(meta).length) return
  const cache = readTaskMetaCache()
  cache[id] = { ...(cache[id] || {}), ...meta }
  writeTaskMetaCache(cache)
}

const mergeTaskMeta = (tasks) => {
  const cache = readTaskMetaCache()
  const nextCache = { ...cache }
  const merged = (tasks || []).map((task) => {
    if (task.priority || task.reminder_at) {
      nextCache[task.id] = {
        ...(nextCache[task.id] || {}),
        ...(task.priority ? { priority: task.priority } : {}),
        ...(task.reminder_at ? { reminder_at: task.reminder_at } : {})
      }
    }
    return {
      ...task,
      ...(!task.reminder_at && cache[task.id]?.reminder_at ? { reminder_at: cache[task.id].reminder_at } : {}),
      priority: task.priority || cache[task.id]?.priority || 'med'
    }
  })
  writeTaskMetaCache(nextCache)
  return merged
}

const stripTagsField = (input) => {
  const { tags, ...rest } = input
  return rest
}

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
      tasks: mergeTaskMeta(tasks),
      ideas: mergeEntityTags(ideas, TAG_CACHE_KEYS.ideas),
      people: people || [],
      expenses: expenses || [],
      vaultItems: mergeEntityTags(vaultItems, TAG_CACHE_KEYS.vaultItems),
      nudges: nudges || [],
      captures: captures || [],
      loading: false
    })
  },

  fetchSpaces: async () => {
    const { user } = get()
    if (!user) return
    let { data } = await supabase.from('spaces').select('*').eq('user_id', user.id)
    if (!data?.length) {
      const { data: created } = await supabase
        .from('spaces')
        .insert([
          { name: 'Personal', type: 'personal', user_id: user.id },
          { name: 'Work', type: 'work', user_id: user.id }
        ])
        .select('*')
      data = created || []
    }
    const spaces = data || []
    set({ spaces, activeSpace: spaces[0] || null })
  },

  // ── Tasks ─────────────────────────────────────────────────
  addTask: async (task) => {
    const { user, activeSpace } = get()
    const payload = {
      ...normalizeTask({ ...task, priority: task.priority || 'med' }),
      user_id: user.id,
      space_id: activeSpace?.id || null
    }
    let { data, error } = await supabase.from('tasks').insert(payload).select().single()
    if (error && isMissingTaskColumnError(error)) {
      ;({ data, error } = await supabase.from('tasks').insert(stripTaskCompatFields(payload)).select().single())
    }
    if (!error) {
      const merged = { ...data, priority: payload.priority, reminder_at: payload.reminder_at }
      cacheTaskMeta(data?.id, merged)
      set((s) => ({ tasks: [merged, ...s.tasks] }))
    }
    return { data, error }
  },

  updateTask: async (id, updates) => {
    const cleaned = normalizeTask(updates)
    const payload = { ...cleaned, updated_at: new Date().toISOString() }
    let { error } = await supabase.from('tasks').update(payload).eq('id', id)
    if (error && isMissingTaskColumnError(error)) {
      ;({ error } = await supabase.from('tasks').update(stripTaskCompatFields(payload)).eq('id', id))
    }
    if (!error) {
      cacheTaskMeta(id, cleaned)
      set((s) => ({ tasks: s.tasks.map(t => t.id === id ? { ...t, ...cleaned } : t) }))
    }
    return { error }
  },

  // ── Ideas ─────────────────────────────────────────────────
  addIdea: async (idea) => {
    const { user, activeSpace } = get()
    const payload = {
      ...normalizeIdea(idea),
      user_id: user.id,
      space_id: activeSpace?.id || null
    }
    let { data, error } = await supabase.from('ideas').insert(payload).select().single()
    if (error && isMissingTagsColumnError(error)) {
      ;({ data, error } = await supabase.from('ideas').insert(stripTagsField(payload)).select().single())
    }
    if (!error && idea.tags !== undefined) cacheEntityTags(TAG_CACHE_KEYS.ideas, data?.id, idea.tags)
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
    const payload = {
      ...normalizeVaultItem(item),
      user_id: user.id,
      space_id: activeSpace?.id || null
    }
    let { data, error } = await supabase.from('vault_items').insert(payload).select().single()
    if (error && isMissingTagsColumnError(error)) {
      ;({ data, error } = await supabase.from('vault_items').insert(stripTagsField(payload)).select().single())
    }
    if (!error && item.tags !== undefined) cacheEntityTags(TAG_CACHE_KEYS.vaultItems, data?.id, item.tags)
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
    if (!error) {
      const cache = readTagCache(TAG_CACHE_KEYS.ideas)
      delete cache[id]
      writeTagCache(TAG_CACHE_KEYS.ideas, cache)
      set(s => ({ ideas: s.ideas.filter(i => i.id !== id) }))
    }
    return { error }
  },
  deleteVaultItem: async (id) => {
    const { error } = await supabase.from('vault_items').delete().eq('id', id)
    if (!error) {
      const cache = readTagCache(TAG_CACHE_KEYS.vaultItems)
      delete cache[id]
      writeTagCache(TAG_CACHE_KEYS.vaultItems, cache)
      set(s => ({ vaultItems: s.vaultItems.filter(v => v.id !== id) }))
    }
    return { error }
  },
  updateVaultItem: async (id, updates) => {
    const cleaned = normalizeVaultItem(updates)
    let { error } = await supabase.from('vault_items').update(cleaned).eq('id', id)
    if (error && isMissingTagsColumnError(error)) {
      ;({ error } = await supabase.from('vault_items').update(stripTagsField(cleaned)).eq('id', id))
    }
    if (!error && updates.tags !== undefined) cacheEntityTags(TAG_CACHE_KEYS.vaultItems, id, updates.tags)
    if (!error) set(s => ({ vaultItems: s.vaultItems.map(v => v.id === id ? { ...v, ...updates } : v) }))
    return { error }
  },
  updateIdea: async (id, updates) => {
    let { error } = await supabase.from('ideas').update(updates).eq('id', id)
    if (error && isMissingTagsColumnError(error)) {
      ;({ error } = await supabase.from('ideas').update(stripTagsField(updates)).eq('id', id))
    }
    if (!error && updates.tags !== undefined) cacheEntityTags(TAG_CACHE_KEYS.ideas, id, updates.tags)
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
