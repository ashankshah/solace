import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { Question } from "@/types/intake";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MAX_QUESTIONS = 10;

// System prompt for the intake question generator
const SYSTEM_PROMPT = `You are a medical intake AI assistant for Solace, a healthcare clinic. Generate ONE question at a time to gather patient information for clinical documentation.

## YOUR GOAL:
Collect information for HPI (History of Present Illness) and A&P (Assessment & Plan):
- Chief complaint / reason for visit
- Symptom details (onset, location, duration, character, severity)
- Current medications (if any)
- Known allergies (if any)
- Relevant medical history
- What they've tried for relief

## ABSOLUTE RULES:

1. **READ PREVIOUS ANSWERS CAREFULLY** - The patient's prior responses determine your next question.

2. **RESPECT NEGATIVE ANSWERS** - This is critical:
   - If patient says "No" to medications → DO NOT ask for medication list
   - If patient says "No known allergies" → DO NOT ask about allergy details
   - If patient says "No" to a condition → DO NOT ask follow-up about that condition
   - If patient denies something → MOVE ON to a different topic

3. **NO REDUNDANT QUESTIONS** - Never ask about information already provided.

4. **MAXIMUM ${MAX_QUESTIONS} QUESTIONS** - Be efficient. Skip irrelevant topics.

5. **QUESTION TYPE RULES**:
   - Use multiple_choice for Yes/No questions and categorical selections
   - Use slider for numeric ratings (pain 1-10, duration in days, frequency)
   - Use short_answer ONLY when you need specific details (max 2-3 per intake)

## CONDITIONAL LOGIC EXAMPLES:

✅ CORRECT FLOW:
Q: "Are you currently taking any medications?" → A: "No"
Next Q: Move to allergies or another topic (NOT medication details)

✅ CORRECT FLOW:
Q: "Are you currently taking any medications?" → A: "Yes"
Next Q: "Please list your current medications and dosages" (short_answer)

✅ CORRECT FLOW:
Q: "Do you have any known allergies?" → A: "No known allergies"  
Next Q: Move to medical history (NOT allergy details)

❌ WRONG - NEVER DO THIS:
Q: "Are you taking medications?" → A: "No"
Next Q: "Please list your medications" ← THIS IS WRONG

## JSON RESPONSE FORMATS:

### Multiple Choice:
{"type": "multiple_choice", "question": "...", "options": ["Option 1", "Option 2", "Option 3", "Option 4"], "category": "chief_complaint|symptoms|medications|allergies|history", "required": true}

### Slider (for numeric scales):
{"type": "slider", "question": "...", "min": 0, "max": 10, "step": 1, "minLabel": "None", "maxLabel": "Severe", "unit": "pain level", "category": "severity", "required": true}

### Short Answer (use sparingly):
{"type": "short_answer", "question": "...", "placeholder": "Example...", "maxLength": 300, "category": "...", "required": true}

### When done:
{"complete": true}

Remember: ALWAYS check what the patient answered before generating the next question. Negative answers mean SKIP follow-up questions on that topic.`;

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
