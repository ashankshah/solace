import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabaseAuth";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File;
    
    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    // Convert File to Buffer for API calls
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Try Wispr API first if key is available
    const wisprApiKey = process.env.WISPR_API_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    let transcription = "";

    // For now, use OpenAI Whisper API since Wispr Flow doesn't have a public web API
    // The Wispr key is stored for future integration when their API becomes available
    if (openaiApiKey) {
      transcription = await transcribeWithOpenAI(buffer, openaiApiKey, audioFile.type);
    } else if (wisprApiKey) {
      // Placeholder for Wispr API integration
      // When Wispr releases a web API, implement here:
      // transcription = await transcribeWithWispr(buffer, wisprApiKey);
      return NextResponse.json({ 
        error: "Wispr web API not yet available. Please add OPENAI_API_KEY for transcription." 
      }, { status: 501 });
    } else {
      return NextResponse.json({ 
        error: "No transcription API key configured" 
      }, { status: 500 });
    }

    return NextResponse.json({ transcription });
  } catch (error) {
    console.error("Transcription error:", error);
    return NextResponse.json({ 
      error: "Failed to transcribe audio" 
    }, { status: 500 });
  }
}

async function transcribeWithOpenAI(
  audioBuffer: Buffer, 
  apiKey: string,
  mimeType: string
): Promise<string> {
  // Create a FormData for the OpenAI API
  const formData = new FormData();
  
  // Determine file extension from mime type
  const extension = mimeType.includes("webm") ? "webm" : 
                    mimeType.includes("mp4") ? "mp4" : 
                    mimeType.includes("wav") ? "wav" : "webm";
  
  const blob = new Blob([audioBuffer], { type: mimeType });
  formData.append("file", blob, `audio.${extension}`);
  formData.append("model", "whisper-1");
  formData.append("language", "en");
  formData.append("response_format", "text");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("OpenAI Whisper error:", error);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const transcription = await response.text();
  return transcription.trim();
}
