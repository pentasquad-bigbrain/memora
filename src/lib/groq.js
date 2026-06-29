import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  dangerouslyAllowBrowser: true
})

const MODEL        = 'llama-3.3-70b-versatile'
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

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
- "expense" = any receipt/payment/money movement with an amount + vendor/person. Treat inward, credit, received, recieved, gave, paid back, refund, repayment, deposit, loan return, and transfer as expense records too.
- "person" = mention of someone to follow up with
- "note" = everything else
- For credit/inward/received/recieved/refund/payment-in records, make "amount" negative so receipts can show it as credit.
- For gave/paid/spent/outward/payment-out records, make "amount" positive.
- If the user speaks Malayalam or Tamil, translate the meaning into simple English for title/body.

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

export async function simplifySpokenEnglish(rawInput) {
  const prompt = `Translate or rewrite this spoken input into simple English. If it is already English, clean it up without changing the meaning.

Return ONLY this JSON:
{
  "english": "simple English sentence"
}

Input: "${rawInput}"`

  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 120,
      response_format: { type: 'json_object' }
    })
    return JSON.parse(completion.choices[0]?.message?.content)?.english || rawInput
  } catch {
    return rawInput
  }
}

// ────────────────────────────────────────────────────────────
// QUICK TASK PARSER
// Fast extraction of due date / person from a plain-text task title
// ────────────────────────────────────────────────────────────
export async function parseTaskQuick(text) {
  const prompt = `Extract task details from the input. Return ONLY this JSON:
{
  "title": "cleaned task title without date/person words",
  "due": "ISO datetime or null (parse: today, tomorrow, next week, Monday, 3pm, etc.)",
  "person": "person name mentioned or null",
  "priority": "high|normal|low"
}
Today: ${new Date().toISOString()}
Input: "${text}"`

  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 120,
      response_format: { type: 'json_object' }
    })
    return JSON.parse(completion.choices[0]?.message?.content)
  } catch {
    return { title: text, due: null, person: null, priority: 'normal' }
  }
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
export async function generateJournalSummary({ tasksCompleted, ideasCaptured, expenses, captures, logEntries }) {
  const logText = logEntries?.length
    ? logEntries.map(e => `[${new Date(e.time).toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'})}] ${e.text}`).join('\n')
    : null

  const prompt = `You are Memora's journal AI. Write a calm, brief daily summary.

Return ONLY this JSON:
{
  "headline": "one sentence summary of the day (max 80 chars)",
  "highlights": ["up to 4 highlights based on journal entries and activity"],
  "suggested_tasks": ["follow-up tasks or next steps from journal entries — max 5, or empty array"],
  "notes_followup": ["any follow-up notes, people to contact, or decisions to track — max 3, or empty array"]
}

Today's activity:
- Tasks completed: ${tasksCompleted.map(t => t.title).join(', ') || 'none'}
- Ideas captured: ${ideasCaptured.map(i => i.title).join(', ') || 'none'}
- Expenses: ${expenses.map(e => `₹${e.amount} at ${e.vendor}`).join(', ') || 'none'}
- Captures: ${captures?.map(c => c.raw_input || c.raw_text || c.title || '').filter(Boolean).join(', ') || 'none'}
${logText ? `\nJournal entries:\n${logText}` : ''}`

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
// IMAGE VISION ANALYZER
// Understands the image content — no OCR, pure visual understanding
// Returns classification + suggested actions for user to confirm
// ────────────────────────────────────────────────────────────
export async function analyzeImage(base64DataUrl) {
  const prompt = `You are Memora's image analyst. Look at this image carefully and understand what it contains.

Return ONLY this JSON — no explanation:
{
  "type": "reminder|task|receipt|expense|meeting|notes|screenshot|photo|other",
  "title": "short descriptive title (max 55 chars)",
  "summary": "1-2 sentence plain-English description of what you see",
  "tasks": ["any to-do items, reminders, or action items you can read, as individual strings"],
  "amount": null or number (only if it is a bill/receipt),
  "vendor": null or string (only if it is a bill/receipt),
  "date": null or ISO date string if a date is visible,
  "confidence": 0.0 to 1.0
}

Classification guide:
- "reminder" or "task"  → image shows a to-do list, reminder note, sticky note, or checklist
- "receipt" or "expense" → image is a bill, invoice, or purchase receipt with amounts
- "meeting"             → agenda, meeting notes, calendar invite, whiteboard
- "notes"               → handwritten or typed notes, study material
- "screenshot"          → app UI screenshot, website, chat
- "photo"               → real-world photo (food, place, people, product)
- "other"               → anything else

Today: ${new Date().toISOString().split('T')[0]}`

  const completion = await groq.chat.completions.create({
    model: VISION_MODEL,
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: base64DataUrl } },
        { type: 'text', text: prompt }
      ]
    }],
    temperature: 0.1,
    max_tokens: 600,
    response_format: { type: 'json_object' }
  })

  const raw = completion.choices[0]?.message?.content
  return JSON.parse(raw)
}

// ────────────────────────────────────────────────────────────
// BRAINSTORM SYNTHESIZER
// Combines multiple ideas/tasks/notes into emergent insights
// ────────────────────────────────────────────────────────────
export async function brainstormIdeas(inputs) {
  const context = inputs.map((item, i) =>
    `[${i + 1}] ${item.type.toUpperCase()}: ${item.title}\n${item.body || ''}`
  ).join('\n\n')

  const prompt = `You are Memora's brainstorm AI. Analyze these ${inputs.length} inputs and synthesize creative, actionable insights.

Return ONLY this JSON:
{
  "synthesis": "2-3 sentences explaining how these ideas connect, contrast, or combine",
  "theme": "the core thread or opportunity in 5-8 words",
  "tasks": ["next action 1", "next action 2", "next action 3"],
  "followups": ["follow-up question or research 1", "follow-up question 2"],
  "pipeline": ["stage 1", "stage 2", "stage 3", "stage 4"],
  "newIdeas": ["emergent idea combining inputs 1", "emergent idea 2"]
}

Be specific and use real content from the inputs — never generic advice.

Inputs:
${context}`

  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.6,
    max_tokens: 700,
    response_format: { type: 'json_object' }
  })
  return JSON.parse(completion.choices[0]?.message?.content)
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
