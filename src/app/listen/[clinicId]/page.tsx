"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSupabaseAuth } from "@/components/SupabaseAuthProvider";
import {
  Button,
  PageLoader,
  Card,
  Header,
  HeaderBranding,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import type { PatientSubmission } from "@/types/clinic";

type RecordingState = "idle" | "recording" | "paused";

interface TranscriptSegment {
  id: string;
  text: string;
  timestamp: number;
}

export default function ListenPage() {
  const { user, isLoading: authLoading } = useSupabaseAuth();
  const router = useRouter();
  const params = useParams();
  const clinicId = params.clinicId as string;

  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const [patients, setPatients] = useState<PatientSubmission[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [clinicName, setClinicName] = useState<string>("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isTranscriptExpanded, setIsTranscriptExpanded] = useState(true);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const transcriptionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastTranscribedIndexRef = useRef<number>(0);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const durationRef = useRef<number>(0);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  // Fetch clinic info and patients
  useEffect(() => {
    if (!authLoading && user && clinicId) {
      fetchClinicData();
    }
  }, [authLoading, user, clinicId]);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptEndRef.current && isTranscriptExpanded) {
      transcriptEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [transcript, isTranscriptExpanded]);

  // Keep duration ref in sync
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  const fetchClinicData = async () => {
    try {
      const clinicRes = await fetch(`/api/clinics/${clinicId}`);
      if (clinicRes.ok) {
        const clinic = await clinicRes.json();
        setClinicName(clinic.name);
      }

      const submissionsRes = await fetch(`/api/clinics/${clinicId}/submissions`);
      if (submissionsRes.ok) {
        const submissions = await submissionsRes.json();
        setPatients(submissions);
      }
    } catch (err) {
      console.error("Failed to fetch clinic data:", err);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (transcriptionIntervalRef.current) clearInterval(transcriptionIntervalRef.current);
    };
  }, []);

  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    setAudioLevel(average / 255);

    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
  }, []);

  const transcribeChunk = useCallback(async () => {
    if (chunksRef.current.length <= lastTranscribedIndexRef.current) return;
    
    // Get new chunks since last transcription
    const newChunks = chunksRef.current.slice(lastTranscribedIndexRef.current);
    lastTranscribedIndexRef.current = chunksRef.current.length;
    
    if (newChunks.length === 0) return;
    
    const audioBlob = new Blob(newChunks, { type: "audio/webm" });
    
    // Skip if too small (less than ~0.5 seconds of audio)
    if (audioBlob.size < 5000) return;
    
    const currentTimestamp = durationRef.current;
    
    setIsTranscribing(true);
    setTranscriptionError(null);
    
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "chunk.webm");
      
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Transcription failed");
      }
      
      const data = await response.json();
      
      if (data.transcription && data.transcription.trim()) {
        const newSegment: TranscriptSegment = {
          id: `segment-${Date.now()}`,
          text: data.transcription.trim(),
          timestamp: currentTimestamp,
        };
        setTranscript(prev => [...prev, newSegment]);
      }
    } catch (error) {
      console.error("Transcription error:", error);
      setTranscriptionError(error instanceof Error ? error.message : "Transcription failed");
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up audio analysis
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      // Set up media recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      lastTranscribedIndexRef.current = 0;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      // Request data every 1 second for near-real-time transcription
      mediaRecorder.start(1000);
      setRecordingState("recording");
      setDuration(0);
      durationRef.current = 0;
      setTranscript([]);
      setTranscriptionError(null);

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          durationRef.current = prev + 1;
          return prev + 1;
        });
      }, 1000);

      // Start audio level visualization
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      
      // Start transcription interval (every 5 seconds)
      transcriptionIntervalRef.current = setInterval(() => {
        transcribeChunk();
      }, 5000);
      
    } catch (err) {
      console.error("Failed to start recording:", err);
      alert("Could not access microphone. Please check your permissions.");
    }
  };

  const stopRecording = async () => {
    // Stop transcription interval first
    if (transcriptionIntervalRef.current) {
      clearInterval(transcriptionIntervalRef.current);
      transcriptionIntervalRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    setRecordingState("idle");
    setAudioLevel(0);

    // Transcribe any remaining audio
    if (chunksRef.current.length > lastTranscribedIndexRef.current) {
      await transcribeChunk();
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const copyTranscript = () => {
    const text = transcript.map(s => s.text).join(" ");
    navigator.clipboard.writeText(text);
  };

  if (authLoading) {
    return <PageLoader label="Loading..." />;
  }

  if (!user) {
    return <PageLoader label="Redirecting to login..." />;
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <Header>
        <HeaderBranding subtitle="Solace Listen" />
        <Button variant="ghost" onClick={() => router.push("/dashboard")}>
          ← Back to Dashboard
        </Button>
      </Header>

      <div className="mx-auto max-w-3xl px-6 py-12">
        {/* Clinic Name */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {clinicName || "Solace Listen"}
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-2">
            Record patient conversations for transcription and analysis
          </p>
        </div>

        {/* Patient Selector */}
        <Card className="mb-8">
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2 block">
                Select Patient (Optional)
              </span>
              <select
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className={cn(
                  "w-full px-4 py-3 rounded-xl border bg-white dark:bg-neutral-900",
                  "border-neutral-200 dark:border-neutral-700",
                  "text-neutral-900 dark:text-neutral-100",
                  "focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500",
                  "transition-all duration-150"
                )}
              >
                <option value="">-- No patient selected --</option>
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.patientName}
                  </option>
                ))}
              </select>
            </label>
            {patients.length === 0 && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                No patients have checked in yet. You can still record without selecting a patient.
              </p>
            )}
          </div>
        </Card>

        {/* Recording Interface */}
        <Card className="text-center py-12">
          {/* Duration Display */}
          <div className="mb-8">
            <p className={cn(
              "text-5xl font-mono font-semibold tracking-wider",
              recordingState === "recording" 
                ? "text-error-500" 
                : "text-neutral-300 dark:text-neutral-600"
            )}>
              {formatDuration(duration)}
            </p>
            {recordingState === "recording" && (
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="w-2 h-2 rounded-full bg-error-500 animate-pulse" />
                <span className="text-sm text-error-500">Recording</span>
                {isTranscribing && (
                  <span className="text-sm text-accent-500 ml-2">• Transcribing...</span>
                )}
              </div>
            )}
          </div>

          {/* Audio Level Visualization */}
          {recordingState === "recording" && (
            <div className="flex items-center justify-center gap-1 h-16 mb-8">
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className="w-2 bg-accent-500 rounded-full transition-all duration-75"
                  style={{
                    height: `${Math.max(8, audioLevel * 64 * (0.5 + Math.random() * 0.5))}px`,
                    opacity: audioLevel > 0.05 ? 1 : 0.3,
                  }}
                />
              ))}
            </div>
          )}

          {/* Record/Stop Button */}
          <div className="flex justify-center">
            {recordingState === "idle" ? (
              <button
                onClick={startRecording}
                className={cn(
                  "w-32 h-32 rounded-full flex items-center justify-center transition-all duration-200",
                  "bg-gradient-to-br from-error-500 to-error-600",
                  "hover:from-error-400 hover:to-error-500 hover:scale-105",
                  "shadow-lg shadow-error-500/30 hover:shadow-xl hover:shadow-error-500/40",
                  "focus:outline-none focus:ring-4 focus:ring-error-500/30"
                )}
              >
                <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className={cn(
                  "w-32 h-32 rounded-full flex items-center justify-center transition-all duration-200",
                  "bg-gradient-to-br from-neutral-700 to-neutral-800",
                  "hover:from-neutral-600 hover:to-neutral-700 hover:scale-105",
                  "shadow-lg shadow-neutral-500/30 hover:shadow-xl hover:shadow-neutral-500/40",
                  "focus:outline-none focus:ring-4 focus:ring-neutral-500/30",
                  "animate-pulse"
                )}
              >
                <div className="w-10 h-10 rounded-lg bg-white" />
              </button>
            )}
          </div>

          {/* Instructions */}
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-8">
            {recordingState === "idle"
              ? "Click the button to start recording"
              : "Click the stop button to end the recording"}
          </p>
        </Card>

        {/* Transcription Error */}
        {transcriptionError && (
          <div className="mt-6 p-4 rounded-xl bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800">
            <p className="text-sm text-error-700 dark:text-error-300">
              {transcriptionError}
            </p>
          </div>
        )}

        {/* Live Transcript */}
        {(transcript.length > 0 || recordingState === "recording") && (
          <Card className="mt-8" padding="none">
            {/* Header */}
            <button
              onClick={() => setIsTranscriptExpanded(!isTranscriptExpanded)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center">
                  <svg className="w-4 h-4 text-accent-600 dark:text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    Live Transcript
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {transcript.length} segment{transcript.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {transcript.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyTranscript();
                    }}
                    className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                    title="Copy transcript"
                  >
                    <svg className="w-4 h-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                )}
                <svg 
                  className={cn(
                    "w-5 h-5 text-neutral-400 transition-transform",
                    isTranscriptExpanded && "rotate-180"
                  )} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {/* Content */}
            {isTranscriptExpanded && (
              <div className="border-t border-neutral-100 dark:border-neutral-800">
                <div className="max-h-64 overflow-y-auto p-6">
                  {transcript.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">
                        {recordingState === "recording" 
                          ? "Listening... Transcript will appear here"
                          : "No transcript available"}
                      </p>
                      {recordingState === "recording" && (
                        <div className="mt-3 flex justify-center">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-accent-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                            <div className="w-2 h-2 bg-accent-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                            <div className="w-2 h-2 bg-accent-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {transcript.map((segment) => (
                        <div key={segment.id} className="flex gap-3">
                          <span className="text-xs text-accent-500 font-mono shrink-0 mt-0.5">
                            {formatTimestamp(segment.timestamp)}
                          </span>
                          <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                            {segment.text}
                          </p>
                        </div>
                      ))}
                      <div ref={transcriptEndRef} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Privacy Notice */}
        <div className="mt-8 p-4 rounded-xl bg-accent-500/10 dark:bg-accent-500/5 border border-accent-500/20 dark:border-accent-500/10 backdrop-blur-sm">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-accent-500/70 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-accent-600/90 dark:text-accent-400/90">
                Privacy Notice
              </p>
              <p className="text-xs text-accent-600/70 dark:text-accent-400/70 mt-1">
                Ensure you have patient consent before recording. All recordings are processed 
                securely and in compliance with healthcare privacy regulations.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
