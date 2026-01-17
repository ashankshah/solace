"use client";

import { useState, useEffect, useCallback } from "react";
import type { ClinicWithStats, PatientSubmission } from "@/types/clinic";

export default function DashboardPage() {
  const [clinics, setClinics] = useState<ClinicWithStats[]>([]);
  const [selectedClinic, setSelectedClinic] = useState<ClinicWithStats | null>(null);
  const [submissions, setSubmissions] = useState<PatientSubmission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<PatientSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [showNewClinicModal, setShowNewClinicModal] = useState(false);
  const [newClinicName, setNewClinicName] = useState("");
  const [newClinicAddress, setNewClinicAddress] = useState("");
  const [showLinkCopied, setShowLinkCopied] = useState(false);

  // Fetch clinics on mount
  useEffect(() => {
    fetchClinics();
  }, []);

  const fetchClinics = async () => {
    try {
      const res = await fetch("/api/clinics");
      const data = await res.json();
      setClinics(data);
      if (data.length > 0 && !selectedClinic) {
        setSelectedClinic(data[0]);
      }
    } catch (err) {
      console.error("Failed to fetch clinics:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch submissions when clinic changes
  const fetchSubmissions = useCallback(async () => {
    if (!selectedClinic) return;
    
    setSubmissionsLoading(true);
    try {
      const res = await fetch(`/api/clinics/${selectedClinic.id}/submissions`);
      const data = await res.json();
      setSubmissions(data);
      setSelectedSubmission(null);
    } catch (err) {
      console.error("Failed to fetch submissions:", err);
    } finally {
      setSubmissionsLoading(false);
    }
  }, [selectedClinic]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const handleCreateClinic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClinicName.trim()) return;

    try {
      const res = await fetch("/api/clinics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newClinicName.trim(),
          address: newClinicAddress.trim() || undefined,
        }),
      });
      
      if (res.ok) {
        const newClinic = await res.json();
        setClinics((prev) => [...prev, { ...newClinic, patientCount: 0, pendingCount: 0 }]);
        setSelectedClinic({ ...newClinic, patientCount: 0, pendingCount: 0 });
        setNewClinicName("");
        setNewClinicAddress("");
        setShowNewClinicModal(false);
      }
    } catch (err) {
      console.error("Failed to create clinic:", err);
    }
  };

  const copyCheckInLink = () => {
    if (!selectedClinic) return;
    const link = `${window.location.origin}/checkin/${selectedClinic.id}`;
    navigator.clipboard.writeText(link);
    setShowLinkCopied(true);
    setTimeout(() => setShowLinkCopied(false), 2000);
  };

  const openCheckInLink = () => {
    if (!selectedClinic) return;
    const link = `${window.location.origin}/checkin/${selectedClinic.id}`;
    window.open(link, "_blank");
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
      case "reviewed":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "archived":
        return "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-500";
      default:
        return "bg-neutral-100 text-neutral-500";
    }
  };

  const updateSubmissionStatus = async (submissionId: string, status: string) => {
    try {
      const res = await fetch(`/api/submissions/${submissionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      
      if (res.ok) {
        const updated = await res.json();
        setSubmissions((prev) =>
          prev.map((s) => (s.id === submissionId ? updated : s))
        );
        if (selectedSubmission?.id === submissionId) {
          setSelectedSubmission(updated);
        }
        // Refresh clinic stats
        fetchClinics();
      }
    } catch (err) {
      console.error("Failed to update submission:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900 dark:border-neutral-700 dark:border-t-neutral-100" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      {/* Header */}
      <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 dark:bg-neutral-100">
              <svg className="h-4 w-4 text-white dark:text-neutral-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <span className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Solace</span>
            <span className="mx-2 text-neutral-300 dark:text-neutral-600">·</span>
            <span className="text-sm text-neutral-500 dark:text-neutral-400">Clinical Dashboard</span>
          </div>
          <button
            onClick={() => setShowNewClinicModal(true)}
            className="flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Clinic
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Clinic Selector */}
          <div className="lg:col-span-1">
            <div className="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 overflow-hidden">
              <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
                <h2 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 tracking-wide uppercase">
                  Clinics
                </h2>
              </div>
              <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {clinics.map((clinic) => (
                  <button
                    key={clinic.id}
                    onClick={() => setSelectedClinic(clinic)}
                    className={`w-full p-4 text-left transition-colors ${
                      selectedClinic?.id === clinic.id
                        ? "bg-neutral-100 dark:bg-neutral-800"
                        : "hover:bg-neutral-50 dark:hover:bg-neutral-850"
                    }`}
                  >
                    <p className="font-medium text-neutral-900 dark:text-neutral-100 text-sm">
                      {clinic.name}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                      {clinic.patientCount} patients · {clinic.pendingCount} pending
                    </p>
                  </button>
                ))}
                {clinics.length === 0 && (
                  <p className="p-4 text-sm text-neutral-500 dark:text-neutral-400">
                    No clinics yet. Create one to get started.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {selectedClinic ? (
              <div className="space-y-6">
                {/* Clinic Header with Check-in Link */}
                <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
                  <div className="flex items-start justify-between">
                    <div>
                      <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                        {selectedClinic.name}
                      </h1>
                      {selectedClinic.address && (
                        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                          {selectedClinic.address}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={fetchSubmissions}
                        className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                        title="Refresh"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Check-in Link Section */}
                  <div className="mt-6 p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                          Patient Check-in Link
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 font-mono">
                          {typeof window !== "undefined" ? `${window.location.origin}/checkin/${selectedClinic.id}` : `/checkin/${selectedClinic.id}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={copyCheckInLink}
                          className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-600"
                        >
                          {showLinkCopied ? (
                            <>
                              <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                              Copied!
                            </>
                          ) : (
                            <>
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Copy
                            </>
                          )}
                        </button>
                        <button
                          onClick={openCheckInLink}
                          className="flex items-center gap-2 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          Open
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Patient Submissions Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Patient List */}
                  <div className="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 overflow-hidden">
                    <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                      <h2 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 tracking-wide uppercase">
                        Patient Check-ins
                      </h2>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        {submissions.length} total
                      </span>
                    </div>
                    
                    {submissionsLoading ? (
                      <div className="p-8 flex justify-center">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900 dark:border-neutral-700 dark:border-t-neutral-100" />
                      </div>
                    ) : submissions.length === 0 ? (
                      <div className="p-8 text-center">
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">
                          No patient check-ins yet.
                        </p>
                        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2">
                          Share the check-in link with patients to get started.
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-neutral-200 dark:divide-neutral-800 max-h-96 overflow-y-auto">
                        {submissions.map((submission) => (
                          <button
                            key={submission.id}
                            onClick={() => setSelectedSubmission(submission)}
                            className={`w-full p-4 text-left transition-colors ${
                              selectedSubmission?.id === submission.id
                                ? "bg-neutral-100 dark:bg-neutral-800"
                                : "hover:bg-neutral-50 dark:hover:bg-neutral-850"
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium text-neutral-900 dark:text-neutral-100 text-sm">
                                  {submission.patientName}
                                </p>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                                  {formatDate(submission.submittedAt)}
                                </p>
                              </div>
                              <span className={`text-xs font-medium px-2 py-1 rounded-full ${getStatusColor(submission.status)}`}>
                                {submission.status}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Submission Detail */}
                  <div className="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 overflow-hidden">
                    <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
                      <h2 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 tracking-wide uppercase">
                        {selectedSubmission ? "Form Responses" : "Select a Patient"}
                      </h2>
                    </div>
                    
                    {selectedSubmission ? (
                      <div className="p-4">
                        {/* Patient Info */}
                        <div className="mb-4 pb-4 border-b border-neutral-200 dark:border-neutral-700">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                                {selectedSubmission.patientName}
                              </p>
                              {selectedSubmission.patientEmail && (
                                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                                  {selectedSubmission.patientEmail}
                                </p>
                              )}
                              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                                Submitted {formatDate(selectedSubmission.submittedAt)}
                              </p>
                            </div>
                            <select
                              value={selectedSubmission.status}
                              onChange={(e) => updateSubmissionStatus(selectedSubmission.id, e.target.value)}
                              className={`text-xs font-medium px-2 py-1 rounded-lg border-0 ${getStatusColor(selectedSubmission.status)} cursor-pointer`}
                            >
                              <option value="pending">pending</option>
                              <option value="reviewed">reviewed</option>
                              <option value="archived">archived</option>
                            </select>
                          </div>
                        </div>

                        {/* Responses */}
                        <div className="space-y-4 max-h-80 overflow-y-auto">
                          {selectedSubmission.questions.length > 0 ? (
                            selectedSubmission.questions.map((question, index) => {
                              const answer = selectedSubmission.answers[question.id];
                              return (
                                <div key={question.id} className="text-sm">
                                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 uppercase tracking-wide">
                                    {question.category || `Question ${index + 1}`}
                                  </p>
                                  <p className="text-neutral-700 dark:text-neutral-300 mb-1">
                                    {question.question}
                                  </p>
                                  <p className="font-medium text-neutral-900 dark:text-neutral-100">
                                    {answer
                                      ? answer.type === "multiple_choice"
                                        ? answer.selectedValue
                                        : answer.type === "slider"
                                        ? answer.value
                                        : answer.value || "—"
                                      : "—"}
                                  </p>
                                </div>
                              );
                            })
                          ) : (
                            // Fallback: show answers without questions
                            Object.entries(selectedSubmission.answers).map(([questionId, answer]) => (
                              <div key={questionId} className="text-sm">
                                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                                  {questionId.replace(/_/g, " ")}
                                </p>
                                <p className="font-medium text-neutral-900 dark:text-neutral-100">
                                  {answer.type === "multiple_choice"
                                    ? answer.selectedValue
                                    : answer.type === "slider"
                                    ? answer.value
                                    : answer.value || "—"}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 text-center">
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">
                          Select a patient from the list to view their form responses.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-neutral-200 bg-white p-8 dark:border-neutral-800 dark:bg-neutral-900 text-center">
                <p className="text-neutral-500 dark:text-neutral-400">
                  Select a clinic from the sidebar or create a new one.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Clinic Modal */}
      {showNewClinicModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 dark:bg-neutral-900 shadow-xl">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              Add New Clinic
            </h2>
            <form onSubmit={handleCreateClinic} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Clinic Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newClinicName}
                  onChange={(e) => setNewClinicName(e.target.value)}
                  placeholder="e.g., Solace Medical Center"
                  required
                  className="w-full rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 focus:border-neutral-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Address <span className="text-neutral-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={newClinicAddress}
                  onChange={(e) => setNewClinicAddress(e.target.value)}
                  placeholder="e.g., 123 Main St, City"
                  className="w-full rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 focus:border-neutral-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewClinicModal(false);
                    setNewClinicName("");
                    setNewClinicAddress("");
                  }}
                  className="flex-1 rounded-lg border border-neutral-200 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newClinicName.trim()}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                    newClinicName.trim()
                      ? "bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
                      : "bg-neutral-100 text-neutral-400 cursor-not-allowed dark:bg-neutral-800 dark:text-neutral-600"
                  }`}
                >
                  Create Clinic
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
