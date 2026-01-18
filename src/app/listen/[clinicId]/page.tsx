"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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

const preferredAudioMimeTypes = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
];

const pickSupportedMimeType = () => {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) {
    return null;
  }

  return preferredAudioMimeTypes.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
};

const extensionFromMimeType = (mimeType: string) => {
  const normalized = mimeType.split(";")[0].toLowerCase();
  switch (normalized) {
    case "audio/webm":
      return "webm";
    case "audio/ogg":
      return "ogg";
    case "audio/mp4":
      return "mp4";
    case "audio/mpeg":
      return "mp3";
    default:
      return null;
  }
};

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
  const [isRefiningNotes, setIsRefiningNotes] = useState(false);
  const [hasStoppedRecording, setHasStoppedRecording] = useState(false);
  const [refineMessage, setRefineMessage] = useState<string | null>(null);
  const selectedPatient = patients.find((patient) => patient.id === selectedPatientId);
  const transcriptText = useMemo(
    () => transcript.map((segment) => segment.text).join(" ").trim(),
    [transcript]
  );

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
  const recordingMimeTypeRef = useRef<string>("audio/webm");
  const isTranscribingRef = useRef(false);

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

  const handleDischargePatient = async () => {
    if (!selectedPatient) return;
    const confirmed = window.confirm(`Discharge ${selectedPatient.patientName}?`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/submissions/${selectedPatient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to discharge patient");
      }

      await fetchClinicData();
      setSelectedPatientId("");
    } catch (error) {
      console.error("Failed to discharge patient:", error);
      alert(error instanceof Error ? error.message : "Failed to discharge patient.");
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
    if (isTranscribingRef.current) return;
    if (chunksRef.current.length <= lastTranscribedIndexRef.current) return;

    const currentMimeType = recordingMimeTypeRef.current || "audio/webm";
    const extension = extensionFromMimeType(currentMimeType) ?? "webm";
    const fullBlob = new Blob(chunksRef.current, { type: currentMimeType });

    // Skip if too small (less than ~0.5 seconds of audio)
    if (fullBlob.size < 5000) return;

    isTranscribingRef.current = true;
    setIsTranscribing(true);
    setTranscriptionError(null);

    try {
      const formData = new FormData();
      formData.append("audio", fullBlob, `recording.${extension}`);

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
        setTranscript([
          {
            id: `segment-${Date.now()}`,
            text: data.transcription.trim(),
            timestamp: 0,
          },
        ]);
      }

      lastTranscribedIndexRef.current = chunksRef.current.length;
    } catch (error) {
      console.error("Transcription error:", error);
      setTranscriptionError(error instanceof Error ? error.message : "Transcription failed");
    } finally {
      setIsTranscribing(false);
      isTranscribingRef.current = false;
    }
  }, []);

  const startRecording = async () => {
    try {
      setHasStoppedRecording(false);
      setRefineMessage(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up audio analysis
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      // Set up media recorder
      const supportedMimeType = pickSupportedMimeType();
      const mediaRecorder = supportedMimeType
        ? new MediaRecorder(stream, { mimeType: supportedMimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      recordingMimeTypeRef.current = mediaRecorder.mimeType || supportedMimeType || "audio/webm";
      chunksRef.current = [];
      lastTranscribedIndexRef.current = 0;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      // Request data every 5 seconds for near-real-time transcription
      mediaRecorder.start(5000);
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
    setHasStoppedRecording(true);

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

  const renderSummaryContent = (content?: string[] | string) => {
    if (!content || (Array.isArray(content) && content.length === 0)) {
      return (
        <p className="text-xs text-neutral-400 dark:text-neutral-500">
          Not available yet.
        </p>
      );
    }

    if (Array.isArray(content)) {
      return (
        <ul className="space-y-2">
          {content.map((item, index) => (
            <li key={`${item}-${index}`} className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
              • {item}
            </li>
          ))}
        </ul>
      );
    }

    return (
      <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-line">
        {content}
      </p>
    );
  };

  const copyTranscript = () => {
    const text = transcript.map(s => s.text).join(" ");
    navigator.clipboard.writeText(text);
  };

  const handleRefineNotes = async () => {
    if (!selectedPatient) {
      setRefineMessage("Select a patient to apply the refined notes.");
      return;
    }
    if (!transcriptText) {
      setRefineMessage("Transcript not ready yet. Please wait a moment and try again.");
      return;
    }
    setIsRefiningNotes(true);
    setRefineMessage(null);

    try {
      const response = await fetch(`/api/submissions/${selectedPatient.id}/refine-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcriptText }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to refine patient notes");
      }

      const data = await response.json();
      if (data.summary) {
        setPatients((prev) =>
          prev.map((patient) =>
            patient.id === selectedPatient.id
              ? { ...patient, summary: data.summary }
              : patient
          )
        );
      }

      await fetchClinicData();

      setRefineMessage("Patient notes refined using the latest recording.");
    } catch (error) {
      console.error("Refine notes error:", error);
      setRefineMessage(error instanceof Error ? error.message : "Failed to refine patient notes.");
    } finally {
      setIsRefiningNotes(false);
    }
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
        <HeaderBranding subtitle="Solace Ally" />
        <Button variant="ghost" onClick={() => router.push("/dashboard")}>
          ← Back to Dashboard
        </Button>
      </Header>

      <div className="mx-auto max-w-6xl px-6 py-12">
        {/* Clinic Name */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {clinicName || "Solace Ally"}
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-2">
            Record patient conversations for transcription and analysis
          </p>
        </div>

        {/* Patient Selector */}
        <Card className="mb-8">
          <div className="space-y-4">
            <div>
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2 block">
                Select Patient (Optional)
              </span>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
                  {patients
                    .filter((patient) => patient.status !== "archived")
                    .map((patient) => (
                      <option key={patient.id} value={patient.id}>
                        {patient.patientName}
                      </option>
                    ))}
                </select>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleDischargePatient}
                  disabled={!selectedPatient}
                  className="shrink-0"
                >
                  Discharge
                </Button>
              </div>
            </div>
            {patients.length === 0 && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                No patients have checked in yet. You can still record without selecting a patient.
              </p>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 items-stretch">
          {/* Patient Information */}
          <Card className="h-full">
            <div className="flex items-start justify-between gap-3 mb-6">
              <div>
                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  Patient Information
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  HPI, ROS, and predictive assessment plan
                </p>
              </div>
            </div>

            {selectedPatient ? (
              <div className="space-y-5">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400 dark:text-neutral-500 mb-2">
                    HPI
                  </p>
                  {renderSummaryContent(selectedPatient.summary?.hpi)}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400 dark:text-neutral-500 mb-2">
                    ROS
                  </p>
                  {renderSummaryContent(selectedPatient.summary?.ros)}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400 dark:text-neutral-500 mb-2">
                    Assessment & Plan
                  </p>
                  {renderSummaryContent(selectedPatient.summary?.assessmentPlan)}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400 dark:text-neutral-500 mb-2">
                    Scientific Context
                  </p>
                  {renderSummaryContent(selectedPatient.summary?.scientificContext)}
                </div>
              </div>
            ) : (
              <div className="text-sm text-neutral-500 dark:text-neutral-400">
                Select a patient to view their AI summary.
              </div>
            )}
          </Card>

          {/* Recording Interface */}
          <Card className="text-center py-12 h-full">
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

            {recordingState === "idle" && hasStoppedRecording && (
              <div className="mt-6 flex flex-col items-center gap-3">
                <div className="inline-flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 px-3 py-2 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-error-500" />
                  Recording stopped. Refine patient notes from this audio.
                </div>
                <Button
                  size="sm"
                  onClick={handleRefineNotes}
                  isLoading={isRefiningNotes}
                >
                  Refine patient notes
                </Button>
                {refineMessage && (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {refineMessage}
                  </p>
                )}
                {!selectedPatient && (
                  <p className="text-xs text-neutral-400 dark:text-neutral-500">
                    Select a patient to apply the refined notes.
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Transcription Error */}
        {transcriptionError && (
          <div className="mt-6 p-4 rounded-xl bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800">
            <p className="text-sm text-error-700 dark:text-error-300">
              {transcriptionError}
            </p>
          </div>
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
