import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  dangerouslyAllowBrowser: true
})

const MODEL = 'llama-3.3-70b-versatile'

// ────────────────────────────────────────────────────────────
// CAPTURE PARSER
// Core function: raw text → structured data
// ────────────────────────────────────────────────────────────
export async function parseCapture(rawInput) {
  const prompt = `You are Memora's AI parser. Analyze the user's input and return ONLY a JSON object.

Classify the input as one of: task, idea, expense, note, person

Rules:
- "task" = action to be done, has a verb + deadline hint
- "idea" = creative thought, concept, something to explore
- "expense" = money spent, includes amount + vendor
- "person" = mention of someone to follow up with
- "note" = everything else

Return ONLY this JSON, no explanation:
{
  "type": "task|idea|expense|note|person",
  "title": "clean short title (max 60 chars)",
  "body": "any extra detail, or null",
  "person": "detected person name or null",
  "amount": null or number (for expenses only),
  "currency": "INR",
  "vendor": "vendor name or null",
  "due": "ISO date string or null (parse relative dates like 'tomorrow', 'next week')",
  "tags": ["array", "of", "relevant", "tags"],
  "confidence": 0.0 to 1.0
}

Today's date: ${new Date().toISOString().split('T')[0]}
User input: "${rawInput}"`

  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
    max_tokens: 400,
    response_format: { type: 'json_object' }
  })

  const raw = completion.choices[0]?.message?.content
  return JSON.parse(raw)
}

// ────────────────────────────────────────────────────────────
// NUDGE GENERATOR
// Analyzes user data and returns smart suggestions
// ────────────────────────────────────────────────────────────
export async function generateNudges({ tasks, people, expenses, ideas }) {
  const context = JSON.stringify({ tasks, people, expenses, ideas }, null, 2)

  const prompt = `You are Memora's nudge engine. Analyze the user's data and return 3 smart, brief nudges.

Return ONLY a JSON array:
[
  {
    "type": "followup|stuck_task|expense_alert|idea_prompt|general",
    "message": "short, actionable nudge (max 60 chars)",
    "entity_type": "task|person|expense|idea or null",
    "entity_id": "id from data or null"
  }
]

Be specific, not generic. Use real names and numbers from the data.
Currency is INR (₹).

User data:
${context}`

  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 600,
    response_format: { type: 'json_object' }
  })

  const raw = completion.choices[0]?.message?.content
  const parsed = JSON.parse(raw)
  return Array.isArray(parsed) ? parsed : parsed.nudges ?? []
}

// ────────────────────────────────────────────────────────────
// IDEA EXPANDER
// Takes an idea and expands it into a plan
// ────────────────────────────────────────────────────────────
export async function expandIdea(idea) {
  const prompt = `You are Memora's IdeaLab AI. Expand this idea into actionable content.

Return ONLY this JSON:
{
  "expanded": "2-3 sentence expansion of the idea",
  "tasks": ["task 1", "task 2", "task 3"],
  "questions": ["key question to explore 1", "key question 2"],
  "tags": ["tag1", "tag2"]
}

Idea title: "${idea.title}"
Idea body: "${idea.body || ''}"
Tags: ${JSON.stringify(idea.tags || [])}`

  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.5,
    max_tokens: 500,
    response_format: { type: 'json_object' }
  })

  const raw = completion.choices[0]?.message?.content
  return JSON.parse(raw)
}

// ────────────────────────────────────────────────────────────
// JOURNAL SUMMARIZER
// Auto-generates daily journal summary from activity
// ────────────────────────────────────────────────────────────
export async function generateJournalSummary({ tasksCompleted, ideasCaptured, expenses, captures }) {
  const prompt = `You are Memora's journal AI. Write a calm, brief daily summary.

Return ONLY this JSON:
{
  "headline": "one sentence summary of the day (max 80 chars)",
  "highlights": ["highlight 1", "highlight 2", "highlight 3"],
  "stats": {
    "tasks_completed": ${tasksCompleted.length},
    "ideas_captured": ${ideasCaptured.length},
    "total_spent": ${expenses.reduce((s, e) => s + (e.amount || 0), 0)}
  }
}

Today's activity:
- Tasks completed: ${tasksCompleted.map(t => t.title).join(', ') || 'none'}
- Ideas captured: ${ideasCaptured.map(i => i.title).join(', ') || 'none'}
- Expenses: ${expenses.map(e => `₹${e.amount} at ${e.vendor}`).join(', ') || 'none'}`

  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.4,
    max_tokens: 300,
    response_format: { type: 'json_object' }
  })

  const raw = completion.choices[0]?.message?.content
  return JSON.parse(raw)
}

// ────────────────────────────────────────────────────────────
// OCR TEXT PARSER (after Tesseract extracts text from receipt)
// ────────────────────────────────────────────────────────────
export async function parseReceiptOCR(ocrText) {
  const prompt = `Extract expense data from this receipt OCR text.

Return ONLY this JSON:
{
  "vendor": "store/restaurant name or null",
  "amount": total amount as number or null,
  "currency": "INR",
  "date": "ISO date string or null",
  "items": ["item 1", "item 2"],
  "category": "food|transport|shopping|utilities|other"
}

OCR text:
${ocrText}`

  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
    max_tokens: 300,
    response_format: { type: 'json_object' }
  })

  const raw = completion.choices[0]?.message?.content
  return JSON.parse(raw)
}
