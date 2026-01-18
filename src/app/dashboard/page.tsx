"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { ClinicWithStats, PatientSubmission } from "@/types/clinic";
import type { ClinicLayout } from "@/types/layout";
import { formatDate } from "@/lib/utils";
import { createEmptyLayout } from "@/types/layout";
import { LayoutViewer } from "@/components/LayoutViewer";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Modal,
  ModalFooter,
  Input,
  PageLoader,
  Spinner,
  EmptyState,
  UsersIcon,
  DocumentIcon,
  BuildingIcon,
  Badge,
  StatusBadge,
  Header,
  HeaderBranding,
  PlusIcon,
  RefreshIcon,
  CopyIcon,
  CheckIcon,
  ExternalLinkIcon,
} from "@/components/ui";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
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
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [clinicLayout, setClinicLayout] = useState<ClinicLayout>(createEmptyLayout());

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Fetch clinics on mount
  useEffect(() => {
    if (status === "authenticated") {
      fetchClinics();
      fetchLayout();
    }
  }, [status]);

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

  const fetchLayout = async () => {
    try {
      const res = await fetch("/api/layout");
      if (res.ok) {
        const data = await res.json();
        setClinicLayout({
          ...data,
          createdAt: new Date(data.createdAt),
          updatedAt: new Date(data.updatedAt),
        });
      }
    } catch (err) {
      console.error("Failed to fetch layout:", err);
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
        handleCloseModal();
      }
    } catch (err) {
      console.error("Failed to create clinic:", err);
    }
  };

  const handleCloseModal = () => {
    setShowNewClinicModal(false);
    setNewClinicName("");
    setNewClinicAddress("");
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

  if (loading || status === "loading") {
    return <PageLoader label="Loading clinics..." />;
  }

  if (status === "unauthenticated") {
    return <PageLoader label="Redirecting to login..." />;
  }

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <Header>
        <HeaderBranding subtitle="Clinical Dashboard" />
        <div className="flex items-center gap-4">
          <Button onClick={() => setShowNewClinicModal(true)} leftIcon={<PlusIcon />}>
            Add Clinic
          </Button>
          
          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center">
                <span className="text-accent-600 dark:text-accent-400 font-semibold text-sm">
                  {session?.user?.name?.charAt(0).toUpperCase() || "U"}
                </span>
              </div>
              <span className="hidden sm:block max-w-[120px] truncate">
                {session?.user?.name || "User"}
              </span>
              <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showUserMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowUserMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-lg z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                      {session?.user?.name}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                      {session?.user?.email}
                    </p>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        router.push("/settings");
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Account Settings
                    </button>
                    <button
                      onClick={handleSignOut}
                      className="w-full text-left px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </Header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Clinic Selector */}
          <div className="lg:col-span-1">
            <Card padding="none" className="overflow-hidden">
              <CardHeader>
                <CardTitle>Clinics</CardTitle>
              </CardHeader>
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {clinics.map((clinic) => (
                  <button
                    key={clinic.id}
                    onClick={() => setSelectedClinic(clinic)}
                    className={`w-full px-5 py-4 text-left transition-all duration-150 ${
                      selectedClinic?.id === clinic.id
                        ? "bg-accent-50 border-l-[3px] border-l-accent-500 dark:bg-accent-500/10"
                        : "border-l-[3px] border-l-transparent hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                    }`}
                  >
                    <p className={`font-medium text-sm ${
                      selectedClinic?.id === clinic.id 
                        ? "text-accent-700 dark:text-accent-400" 
                        : "text-neutral-900 dark:text-neutral-100"
                    }`}>
                      {clinic.name}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                      {clinic.patientCount} patients · {clinic.pendingCount} pending
                    </p>
                  </button>
                ))}
                {clinics.length === 0 && (
                  <EmptyState
                    size="sm"
                    title="No clinics yet"
                    description="Create one to get started"
                  />
                )}
              </div>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {selectedClinic ? (
              <div className="space-y-6">
                {/* Clinic Header with Check-in Link */}
                <Card>
                  <div className="flex items-start justify-between">
                    <div>
                      <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 tracking-tight">
                        {selectedClinic.name}
                      </h1>
                      {selectedClinic.address && (
                        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                          {selectedClinic.address}
                        </p>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={fetchSubmissions} title="Refresh">
                      <RefreshIcon />
                    </Button>
                  </div>

                  {/* Check-in Link Section */}
                  <div className="mt-6 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-700/50">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                          Patient Check-in Link
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                          Share this link with patients for digital intake
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button variant="ghost" size="sm" onClick={copyCheckInLink}>
                          {showLinkCopied ? (
                            <>
                              <CheckIcon />
                              Copied!
                            </>
                          ) : (
                            <>
                              <CopyIcon />
                              Copy
                            </>
                          )}
                        </Button>
                        <Button size="sm" onClick={openCheckInLink} leftIcon={<ExternalLinkIcon />}>
                          Open
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Solace Listen Section */}
                  <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-accent-50 to-accent-100/50 dark:from-accent-900/20 dark:to-accent-800/10 border border-accent-200/50 dark:border-accent-700/30">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-accent-500 flex items-center justify-center shrink-0">
                          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-accent-700 dark:text-accent-300">
                            Solace Listen
                          </p>
                          <p className="text-xs text-accent-600/70 dark:text-accent-400/70 mt-0.5">
                            Record and transcribe patient conversations
                          </p>
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        onClick={() => router.push(`/listen/${selectedClinic.id}`)}
                        leftIcon={<ExternalLinkIcon />}
                      >
                        Open
                      </Button>
                    </div>
                  </div>
                </Card>

                {/* Patient Submissions Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Patient List */}
                  <Card padding="none" className="overflow-hidden">
                    <CardHeader className="flex items-center justify-between">
                      <CardTitle>Patient Check-ins</CardTitle>
                      <Badge variant="secondary" size="sm">{submissions.length}</Badge>
                    </CardHeader>
                    
                    {submissionsLoading ? (
                      <div className="p-8">
                        <Spinner size="sm" label="Loading patients..." />
                      </div>
                    ) : submissions.length === 0 ? (
                      <EmptyState
                        icon={<UsersIcon className="h-full w-full" />}
                        title="No patient check-ins yet"
                        description="Share the check-in link to get started"
                      />
                    ) : (
                      <div className="divide-y divide-neutral-100 dark:divide-neutral-800 max-h-96 overflow-y-auto">
                        {submissions.map((submission) => (
                          <button
                            key={submission.id}
                            onClick={() => setSelectedSubmission(submission)}
                            className={`w-full px-5 py-4 text-left transition-all duration-150 ${
                              selectedSubmission?.id === submission.id
                                ? "bg-accent-50 border-l-[3px] border-l-accent-500 dark:bg-accent-500/10"
                                : "border-l-[3px] border-l-transparent hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className={`font-medium text-sm truncate ${
                                  selectedSubmission?.id === submission.id 
                                    ? "text-accent-700 dark:text-accent-400" 
                                    : "text-neutral-900 dark:text-neutral-100"
                                }`}>
                                  {submission.patientName}
                                </p>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                                  {formatDate(submission.submittedAt)}
                                </p>
                              </div>
                              <StatusBadge status={submission.status as "pending" | "reviewed" | "archived"} />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </Card>

                  {/* Submission Detail */}
                  <Card padding="none" className="overflow-hidden">
                    <CardHeader>
                      <CardTitle>
                        {selectedSubmission ? "Patient Details" : "Select a Patient"}
                      </CardTitle>
                    </CardHeader>
                    
                    {selectedSubmission ? (
                      <CardContent>
                        {/* Patient Info */}
                        <div className="mb-5 pb-5 border-b border-neutral-100 dark:border-neutral-800">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-neutral-900 dark:text-neutral-100 text-base">
                                {selectedSubmission.patientName}
                              </p>
                              {selectedSubmission.patientEmail && (
                                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
                                  {selectedSubmission.patientEmail}
                                </p>
                              )}
                              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2">
                                Submitted {formatDate(selectedSubmission.submittedAt)}
                              </p>
                            </div>
                            <select
                              value={selectedSubmission.status}
                              onChange={(e) => updateSubmissionStatus(selectedSubmission.id, e.target.value)}
                              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 cursor-pointer focus:ring-2 focus:ring-accent-500 focus:ring-offset-1 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                            >
                              <option value="pending">pending</option>
                              <option value="reviewed">reviewed</option>
                              <option value="archived">archived</option>
                            </select>
                          </div>
                        </div>

                        {/* Responses */}
                        <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                          {selectedSubmission.questions.length > 0 ? (
                            selectedSubmission.questions.map((question, index) => {
                              const answer = selectedSubmission.answers[question.id];
                              return (
                                <div key={question.id} className="group">
                                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mb-1 uppercase tracking-wider font-medium">
                                    {question.category || `Question ${index + 1}`}
                                  </p>
                                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1.5 leading-relaxed">
                                    {question.question}
                                  </p>
                                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg px-3 py-2">
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
                              <div key={questionId}>
                                <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mb-1.5 uppercase tracking-wider font-medium">
                                  {questionId.replace(/_/g, " ")}
                                </p>
                                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg px-3 py-2">
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
                      </CardContent>
                    ) : (
                      <EmptyState
                        icon={<DocumentIcon className="h-full w-full" />}
                        title="No patient selected"
                        description="Select a patient to view their responses"
                      />
                    )}
                  </Card>
                </div>
              </div>
            ) : (
              <Card className="text-center p-12">
                <EmptyState
                  size="lg"
                  icon={<BuildingIcon className="h-full w-full" />}
                  title="Select a clinic to view patients"
                  description="Or create a new clinic to get started"
                />
              </Card>
            )}
          </div>
        </div>

        {/* Clinic Layout Viewer */}
        <div className="mt-8">
          <LayoutViewer
            layout={clinicLayout}
            onEditClick={() => router.push("/settings")}
          />
        </div>
      </div>

      {/* New Clinic Modal */}
      <Modal
        isOpen={showNewClinicModal}
        onClose={handleCloseModal}
        title="Add New Clinic"
        description="Create a clinic to start receiving patient check-ins."
      >
        <form onSubmit={handleCreateClinic} className="space-y-5">
          <Input
            label="Clinic Name"
            value={newClinicName}
            onChange={(e) => setNewClinicName(e.target.value)}
            placeholder="e.g., Solace Medical Center"
            required
          />
          <Input
            label="Address"
            hint="Optional"
            value={newClinicAddress}
            onChange={(e) => setNewClinicAddress(e.target.value)}
            placeholder="e.g., 123 Main St, City"
          />
          <ModalFooter>
            <Button type="button" variant="ghost" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button type="submit" disabled={!newClinicName.trim()}>
              Create Clinic
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
