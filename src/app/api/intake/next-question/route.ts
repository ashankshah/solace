import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { Question } from "@/types/intake";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MAX_QUESTIONS = 10;

// System prompt for the intake question generator
const SYSTEM_PROMPT = `You are a medical intake AI assistant for Solace, a healthcare clinic. Generate ONE question at a time to gather patient information for clinical documentation.

## PRIMARY OBJECTIVE
Collect high-yield information for HPI and a predictive Assessment & Plan within a hard cap of ${MAX_QUESTIONS} total questions.

## PRIORITY ORDER (stop once sufficient)
1) Chief complaint / primary reason for visit
2) HPI essentials for the main complaint:
   - onset and duration
   - location and character/quality
   - severity (numeric scale)
   - aggravating/relieving factors, what they've tried
   - associated symptoms relevant to the complaint
3) Safety/triage red flags only if complaint implies risk
4) Medications and allergies (only if not already provided and not denied)
5) Relevant medical history ONLY if it changes management

## FOLLOW-UP QUALITY RULES
- Every follow-up must directly build on the most recent answer and uncover NEW, relevant information.
- Do NOT ask broad, generic questions if the last answer suggests a specific follow-up.
- Ask for details ONLY when the patient answered "Yes" or gave a clue that indicates more detail is needed.

## ABSOLUTE RULES
1) READ PRIOR ANSWERS CAREFULLY and do not repeat anything already covered.
2) RESPECT NEGATIVE ANSWERS:
   - If patient says "No" to meds, allergies, or a condition, do NOT ask follow-ups on that topic.
3) HARD CAP: NEVER exceed ${MAX_QUESTIONS} total questions.
4) ASK ONLY ONE QUESTION at a time.
5) Prefer simple, clear language. Avoid jargon.

## QUESTION TYPE RULES
- Use multiple_choice for Yes/No and categorical selections.
- Use slider for numeric ratings (pain 0-10, duration in days, frequency).
- Use short_answer ONLY for specific details (max 2 short answers total).

## BEST-PRACTICE FOLLOW-UP EXAMPLES
Correct:
- If patient says "chest pain" -> ask location or onset, then severity.
- If patient says "Yes, I take meds" -> ask for list/dosages (short_answer).
Incorrect:
- Asking for meds after "No medications."
- Asking "Do you have allergies?" after they already answered "No known allergies."

## STOP CONDITIONS
Return {"complete": true} if:
- You have the chief complaint and at least 3 HPI essentials, OR
- You have only 1 question left and no high-yield gaps remain.

## JSON RESPONSE FORMAT (ONLY JSON)
Multiple choice:
{"type": "multiple_choice", "question": "...", "options": ["Option 1", "Option 2", "Option 3", "Option 4"], "category": "chief_complaint|symptoms|severity|medications|allergies|history", "required": true}

Slider:
{"type": "slider", "question": "...", "min": 0, "max": 10, "step": 1, "minLabel": "None", "maxLabel": "Severe", "unit": "pain level", "category": "severity", "required": true}

Short answer:
{"type": "short_answer", "question": "...", "placeholder": "Example...", "maxLength": 300, "category": "...", "required": true}

Done:
{"complete": true}`;

export async function POST(request: NextRequest) {
  try {
    const { answers, questionCount, questionHistory } = await request.json();

    // Debug logging
    console.log("[next-question API] Received:", {
      questionCount,
      answerCount: Object.keys(answers || {}).length,
      historyLength: questionHistory?.length || 0,
      answerKeys: Object.keys(answers || {}),
    });

    // Check if API key is configured
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "your_openai_api_key_here") {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    // Force completion at max questions
    if (questionCount >= MAX_QUESTIONS) {
      return NextResponse.json({ complete: true });
    }

    // Build comprehensive context from previous Q&A
    let context = "";
    
    if (Object.keys(answers).length === 0) {
      context = `This is QUESTION 1 of ${MAX_QUESTIONS} maximum.
      
Start by asking the patient their main reason for visiting today (chief complaint). Use multiple choice with common visit reasons.`;
    } else {
      context = `## Current Intake Progress: Question ${questionCount + 1} of ${MAX_QUESTIONS} maximum

## Complete Q&A History (DO NOT ask about any of this information again):

`;
      // Include full question and answer history for context
      if (questionHistory && Array.isArray(questionHistory) && questionHistory.length > 0) {
        let qNumber = 0;
        questionHistory.forEach((q: { id?: string; question: string; category?: string; type?: string }) => {
          // Find the answer by matching question ID
          const answer = q.id ? answers[q.id] : null;
          
          // Only include questions that have been answered
          if (answer) {
            qNumber++;
            let answerText: string;
            if (answer.type === "multiple_choice") {
              answerText = answer.selectedValue;
            } else if (answer.type === "slider") {
              answerText = `${answer.value}`;
            } else {
              answerText = answer.value || "(no response)";
            }
            
            context += `Q${qNumber} [${q.category || 'general'}] (${q.type || 'unknown'}): "${q.question}"
→ PATIENT ANSWERED: ${answerText}

`;
          }
        });
      } else {
        // Fallback if questionHistory not provided - use answer keys
        Object.entries(answers).forEach(([questionId, answer], index) => {
          const ans = answer as { type: string; selectedValue?: string; value?: string | number };
          let answerText: string;
          if (ans.type === "multiple_choice") {
            answerText = ans.selectedValue || "";
          } else if (ans.type === "slider") {
            answerText = `${ans.value}`;
          } else {
            answerText = String(ans.value) || "(no response)";
          }
          context += `Q${index + 1}: ${questionId.replace(/_/g, " ")}
→ PATIENT ANSWERED: ${answerText}

`;
        });
      }

      // Analyze answers for negative responses to guide the AI
      const answersStr = JSON.stringify(answers).toLowerCase();
      const negativeTopics: string[] = [];
      const coveredTopics: string[] = [];
      
      // Check for negative responses
      if (answersStr.includes('"no"') || answersStr.includes('no medication') || answersStr.includes('not taking') || answersStr.includes('none')) {
        if (answersStr.includes('medication')) negativeTopics.push('medications (patient said NO - do not ask for medication list)');
      }
      if (answersStr.includes('no known allerg') || answersStr.includes('no allerg') || answersStr.includes('"none"')) {
        if (answersStr.includes('allerg')) negativeTopics.push('allergies (patient said NO - do not ask for allergy details)');
      }
      
      // Check what topics have been covered
      if (answersStr.includes('medication')) coveredTopics.push('medications');
      if (answersStr.includes('allerg')) coveredTopics.push('allergies');
      if (answersStr.includes('pain') || answersStr.includes('sever')) coveredTopics.push('severity/pain');
      if (answersStr.includes('start') || answersStr.includes('began') || answersStr.includes('onset') || answersStr.includes('long') || answersStr.includes('duration')) coveredTopics.push('onset/duration');

      if (negativeTopics.length > 0) {
        context += `## ⚠️ NEGATIVE RESPONSES - DO NOT ASK FOLLOW-UP QUESTIONS ON THESE:
${negativeTopics.map(t => `- ${t}`).join('\n')}

`;
      }

      // Add remaining questions warning
      const remaining = MAX_QUESTIONS - questionCount;
      context += `## Instructions for next question:
- Questions remaining: ${remaining}
- Topics already covered: ${coveredTopics.length > 0 ? coveredTopics.join(', ') : 'none yet'}
- DO NOT repeat any questions or ask for details on denied topics
`;

      if (remaining <= 3) {
        context += `- WRAPPING UP: Only ${remaining} questions left. Focus on critical missing information.
`;
      }

      if (remaining === 1) {
        context += `- FINAL QUESTION: This is the last question. Make it count or complete the intake.
`;
      }

      // Guide based on what's missing (but not denied)
      const missingInfo = [];
      
      if (!coveredTopics.includes('medications') && !negativeTopics.some(t => t.includes('medication'))) {
        missingInfo.push("medications");
      }
      if (!coveredTopics.includes('allergies') && !negativeTopics.some(t => t.includes('allerg'))) {
        missingInfo.push("allergies");
      }
      if (!coveredTopics.includes('severity/pain')) {
        missingInfo.push("severity/pain level");
      }
      if (!coveredTopics.includes('onset/duration')) {
        missingInfo.push("onset/duration");
      }
      
      if (missingInfo.length > 0 && remaining > 1) {
        context += `- Potentially missing for HPI/A&P: ${missingInfo.join(", ")}
`;
      }
    }

    // Debug: Log the context being sent to OpenAI
    console.log("[next-question API] Context for OpenAI:\n", context);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: context },
      ],
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    const responseText = completion.choices[0]?.message?.content;
    
    console.log("[next-question API] OpenAI response:", responseText);
    
    if (!responseText) {
      throw new Error("No response from OpenAI");
    }

    const parsed = JSON.parse(responseText);

    // Check if intake is complete
    if (parsed.complete) {
      return NextResponse.json({ complete: true });
    }

    // Validate and format the question based on type
    let question: Question;

    if (parsed.type === "slider") {
      question = {
        id: `q_${questionCount + 1}_${Date.now()}`,
        type: "slider",
        question: parsed.question,
        category: parsed.category || "severity",
        required: parsed.required ?? true,
        min: parsed.min ?? 0,
        max: parsed.max ?? 10,
        step: parsed.step ?? 1,
        minLabel: parsed.minLabel,
        maxLabel: parsed.maxLabel,
        unit: parsed.unit,
      };
    } else if (parsed.type === "short_answer") {
      question = {
        id: `q_${questionCount + 1}_${Date.now()}`,
        type: "short_answer",
        question: parsed.question,
        category: parsed.category || "screening",
        required: parsed.required ?? true,
        placeholder: parsed.placeholder || "Type your answer here...",
        maxLength: parsed.maxLength || 300,
      };
    } else {
      // Default to multiple_choice
      question = {
        id: `q_${questionCount + 1}_${Date.now()}`,
        type: "multiple_choice",
        question: parsed.question,
        category: parsed.category || "screening",
        required: parsed.required ?? true,
        options: parsed.options || [],
      };
    }

    return NextResponse.json({ question });
  } catch (error) {
    console.error("Error generating question:", error);
    return NextResponse.json(
      { error: "Failed to generate question" },
      { status: 500 }
    );
  }
}
