import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  BriefcaseBusiness,
  Check,
  CircleCheck,
  CircleOff,
  Clock3,
  Eye,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Scissors,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import {
  BusinessServicePicker,
  type SelectableService,
} from "@/components/business-service-picker";
import { useConfirmation } from "@/components/confirmation-provider";
import { SalonBranchTabs, useSalonBranches } from "@/components/salon-branch-selector";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  assignTeamMemberBranches,
  assignTeamMemberServices,
  deleteTeamMember,
  inviteTeamMember,
  listSelectableServices,
  listTeamMembers,
  listTeamMemberSchedule,
  saveTeamMember,
  saveTeamMemberSchedule,
  setTeamMemberActiveStatus,
} from "@/lib/business.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Team - Glowante Business" },
      { name: "description", content: "Add stylists, assign services and manage commissions." },
    ],
  }),
  component: TeamPage,
});

type TeamMember = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  roleTitle: string;
  roles: string[];
  gender: "male" | "female" | "other" | "all";
  experienceYears: number;
  about: string | null;
  address: string | null;
  joiningDate: string | null;
  careerStartDate: string | null;
  profileImageUrl: string | null;
  employmentType: "full_time" | "part_time" | "contract";
  payType: "monthly_salary" | "salary_commission" | "commission_only";
  effectiveFrom: string | null;
  compensationLater: boolean;
  baseSalary: number;
  commissionType: "percentage" | "fixed";
  commissionValue: number;
  notes: string | null;
  isActive: boolean;
  invitationStatus: "invited" | "setup_required" | "active";
  setupRequired: boolean;
  source: "manual" | "invite" | "owner_stylist";
  invitedAt: string | null;
  verifiedAt: string | null;
  onlineBookingEnabled: boolean;
  branchIds: string[];
  branches: { id: string; name: string; parent_id: string | null }[];
  serviceIds: string[];
  services: { id: string; name: string }[];
};

type ScheduleHour = {
  dayOfWeek: number;
  isWorking: boolean;
  startTime: string;
  endTime: string;
  source?: "team" | "branch";
};

const blankForm = {
  fullName: "",
  phone: "",
  email: "",
  roleTitle: "Stylist",
  roles: ["salon_stylist"],
  gender: "all" as const,
  experienceYears: 0,
  about: "",
  address: "",
  joiningDate: "",
  careerStartDate: "",
  profileImageUrl: "",
  employmentType: "full_time" as const,
  payType: "monthly_salary" as const,
  effectiveFrom: "",
  compensationLater: false,
  baseSalary: 0,
  commissionType: "percentage" as const,
  commissionValue: 5,
  notes: "",
};

const blankInvite = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  message: "",
};

const defaultTeamHours: ScheduleHour[] = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  isWorking: dayOfWeek < 6,
  startTime: "10:00",
  endTime: "20:00",
}));

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FULL_DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const ROLE_OPTIONS = [
  { value: "salon_owner", label: "Salon Owner" },
  { value: "salon_manager", label: "Salon Manager" },
  { value: "salon_stylist", label: "Salon Stylist" },
  { value: "salon_receptionist", label: "Salon Receptionist" },
  { value: "salon_staff", label: "Salon Staff" },
];

type ScheduleMode = "branch" | "custom";
type AssignMode = "branch" | "services";

type TeamTab = "all" | "active" | "setup_required" | "invited";

function TeamPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirmation();
  const { salons, activeSalonId: salonId } = useSalonBranches();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TeamTab>("all");
  const [editing, setEditing] = useState<TeamMember | null | "new">(null);
  const [editStep, setEditStep] = useState<1 | 2 | 3>(1);
  const [inviting, setInviting] = useState(false);
  const [assigning, setAssigning] = useState<TeamMember | null>(null);
  const [assignStep, setAssignStep] = useState<1 | 2 | 3 | 4>(1);
  const [assignMode, setAssignMode] = useState<AssignMode>("branch");
  const [form, setForm] = useState(blankForm);
  const [inviteForm, setInviteForm] = useState(blankInvite);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [teamHours, setTeamHours] = useState<ScheduleHour[]>(defaultTeamHours);
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("custom");
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [onlineBookingEnabled, setOnlineBookingEnabled] = useState(true);
  const [viewingMember, setViewingMember] = useState<TeamMember | null>(null);
  const [viewingSchedule, setViewingSchedule] = useState<ScheduleHour[]>(defaultTeamHours);
  const getMembers = useServerFn(listTeamMembers);
  const getServices = useServerFn(listSelectableServices);
  const getTeamSchedule = useServerFn(listTeamMemberSchedule);
  const saveMember = useServerFn(saveTeamMember);
  const saveSchedule = useServerFn(saveTeamMemberSchedule);
  const inviteMember = useServerFn(inviteTeamMember);
  const toggleMember = useServerFn(setTeamMemberActiveStatus);
  const removeMember = useServerFn(deleteTeamMember);
  const assignServices = useServerFn(assignTeamMemberServices);
  const assignBranches = useServerFn(assignTeamMemberBranches);
  const membersQuery = useQuery({
    queryKey: ["team-members", salonId],
    queryFn: () => getMembers({ data: { salonId: salonId! } }),
    enabled: Boolean(salonId),
  });
  const servicesQuery = useQuery({
    queryKey: ["selectable-services", salonId],
    queryFn: () => getServices({ data: { salonId: salonId! } }),
    enabled: Boolean(salonId),
  });
  const selectedBranchId = selectedBranches[0] ?? salonId;
  const selectedBranchServicesQuery = useQuery({
    queryKey: ["selectable-services", selectedBranchId],
    queryFn: () => getServices({ data: { salonId: selectedBranchId! } }),
    enabled: Boolean(selectedBranchId && (editing || assigning)),
  });
  const members = useMemo(() => (membersQuery.data ?? []) as TeamMember[], [membersQuery.data]);
  const services = useMemo(
    () => (servicesQuery.data ?? []) as SelectableService[],
    [servicesQuery.data],
  );
  const setupServices = useMemo(
    () => (selectedBranchServicesQuery.data ?? services) as SelectableService[],
    [selectedBranchServicesQuery.data, services],
  );
  const currentBranchServiceIds = useMemo(
    () => new Set(services.map((service) => service.id)),
    [services],
  );
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return members.filter((member) => {
      const assignedHere = !salonId || member.branchIds.includes(salonId);
      const tabMatch =
        tab === "all" ||
        (tab === "active" && member.isActive && member.invitationStatus !== "invited") ||
        (tab === "setup_required" &&
          member.setupRequired &&
          member.invitationStatus !== "invited") ||
        (tab === "invited" && member.invitationStatus === "invited");
      return (
        assignedHere &&
        tabMatch &&
        (!term ||
          `${member.fullName} ${member.roleTitle} ${member.phone ?? ""} ${member.email ?? ""}`
            .toLowerCase()
            .includes(term))
      );
    });
  }, [members, salonId, search, tab]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["team-members", salonId] });
  const stats = {
    all: members.filter((member) => !salonId || member.branchIds.includes(salonId)).length,
    active: members.filter(
      (member) =>
        (!salonId || member.branchIds.includes(salonId)) &&
        member.isActive &&
        member.invitationStatus !== "invited",
    ).length,
    setup: members.filter(
      (member) =>
        (!salonId || member.branchIds.includes(salonId)) &&
        member.setupRequired &&
        member.invitationStatus !== "invited",
    ).length,
    invited: members.filter(
      (member) =>
        (!salonId || member.branchIds.includes(salonId)) && member.invitationStatus === "invited",
    ).length,
  };

  function loadSchedule(teamMemberId?: string, branchId = salonId) {
    if (!branchId) return;
    void getTeamSchedule({ data: { salonId: branchId, teamMemberId } })
      .then((hours) => setTeamHours(hours as ScheduleHour[]))
      .catch(() => setTeamHours(defaultTeamHours));
  }

  function openView(member: TeamMember) {
    setViewingMember(member);
    setViewingSchedule(defaultTeamHours);
    if (!salonId) return;
    void getTeamSchedule({ data: { salonId, teamMemberId: member.id } })
      .then((hours) => setViewingSchedule(hours as ScheduleHour[]))
      .catch(() => setViewingSchedule(defaultTeamHours));
  }

  function openEdit(member?: TeamMember) {
    setEditStep(1);
    if (member) {
      setEditing(member);
      setForm({
        fullName: member.fullName,
        phone: member.phone ?? "",
        email: member.email ?? "",
        roleTitle: member.roleTitle,
        roles: member.roles?.length ? member.roles : ["salon_stylist"],
        gender: member.gender ?? "all",
        experienceYears: member.experienceYears ?? 0,
        about: member.about ?? "",
        address: member.address ?? "",
        joiningDate: member.joiningDate ?? "",
        careerStartDate: member.careerStartDate ?? "",
        profileImageUrl: member.profileImageUrl ?? "",
        employmentType: member.employmentType,
        payType: member.payType ?? "monthly_salary",
        effectiveFrom: member.effectiveFrom ?? "",
        compensationLater: member.compensationLater ?? false,
        baseSalary: member.baseSalary,
        commissionType: member.commissionType,
        commissionValue: member.commissionValue,
        notes: member.notes ?? "",
      });
      const branchId = salonId ?? member.branchIds[0];
      setSelectedBranches(branchId ? [branchId] : []);
      setSelectedServices(
        member.serviceIds.filter((serviceId) => currentBranchServiceIds.has(serviceId)),
      );
      setScheduleMode("custom");
      setOnlineBookingEnabled(member.onlineBookingEnabled);
      loadSchedule(member.invitationStatus === "invited" ? undefined : member.id, branchId);
    } else {
      setEditing("new");
      setForm(blankForm);
      setSelectedBranches(salonId ? [salonId] : []);
      setSelectedServices([]);
      setScheduleMode("branch");
      setOnlineBookingEnabled(true);
      loadSchedule();
    }
  }

  async function submitMember() {
    try {
      const result = await saveMember({
        data: {
          salonId: salonId!,
          id: editing && editing !== "new" ? editing.id : undefined,
          ...form,
          roleTitle: roleTitleFromRoles(form.roles),
        },
      });
      const teamMemberId = result.id;
      const canSaveSetup =
        editing === "new" || (editing !== null && editing.invitationStatus !== "invited");
      const setupBranchId = selectedBranches[0] ?? salonId!;
      if (canSaveSetup) {
        const branchIds =
          editing && editing !== "new"
            ? Array.from(new Set([...editing.branchIds, setupBranchId]))
            : [setupBranchId];
        await assignBranches({
          data: {
            salonId: salonId!,
            teamMemberId,
            branchIds,
          },
        });
        await saveSchedule({
          data: {
            salonId: setupBranchId,
            teamMemberId,
            hours: teamHours,
          },
        });
        await assignServices({
          data: {
            salonId: setupBranchId,
            teamMemberId,
            serviceIds: selectedServices,
            onlineBookingEnabled,
          },
        });
      }
      toast.success(editing === "new" ? "Team member added" : "Team member updated");
      setEditing(null);
      void refresh();
    } catch (error) {
      toast.error(errorMessage(error, "Could not save team member"));
    }
  }

  async function submitInvite(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await inviteMember({
        data: { salonId: salonId!, ...inviteForm, appOrigin: window.location.origin },
      });
      toast.success("Invitation email sent", {
        description: `Sent to ${result.sentTo}`,
      });
      setInviting(false);
      setInviteForm(blankInvite);
      void refresh();
    } catch (error) {
      toast.error(errorMessage(error, "Could not invite team member"));
    }
  }

  async function toggleStatus(member: TeamMember) {
    const isActive = !member.isActive;
    if (
      !(await confirm({
        title: `${isActive ? "Activate" : "Deactivate"} ${member.fullName}?`,
        description: isActive
          ? "This team member can be assigned to bookings again."
          : "This team member will not be available for new bookings.",
        confirmLabel: isActive ? "Activate" : "Deactivate",
        destructive: !isActive,
      }))
    )
      return;
    try {
      await toggleMember({ data: { salonId: salonId!, id: member.id, isActive } });
      toast.success(`${member.fullName} ${isActive ? "activated" : "deactivated"}`);
      void refresh();
    } catch (error) {
      toast.error(errorMessage(error, "Could not update status"));
    }
  }

  async function handleDelete(member: TeamMember) {
    if (
      !(await confirm({
        title: `Delete ${member.fullName}?`,
        description:
          "This removes branch, service and booking assignment links. This cannot be undone.",
        confirmLabel: "Delete member",
        destructive: true,
      }))
    )
      return;
    try {
      await removeMember({ data: { salonId: salonId!, id: member.id } });
      toast.success("Team member deleted");
      void refresh();
    } catch (error) {
      toast.error(errorMessage(error, "Could not delete team member"));
    }
  }

  function openAssignment(member: TeamMember, startStep: 1 | 2 = 1) {
    if (member.invitationStatus === "invited") {
      toast.error("Team member must verify the invitation before assignment.");
      return;
    }
    const branchId =
      startStep === 1
        ? (salons.find((salon) => !member.branchIds.includes(salon.id))?.id ??
          salonId ??
          member.branchIds[0])
        : (salonId ?? member.branchIds[0]);
    setAssigning(member);
    setAssignMode(startStep === 1 ? "branch" : "services");
    setAssignStep(member.branchIds.length ? startStep : 1);
    setForm({
      fullName: member.fullName,
      phone: member.phone ?? "",
      email: member.email ?? "",
      roleTitle: member.roleTitle,
      roles: member.roles?.length ? member.roles : ["salon_stylist"],
      gender: member.gender ?? "all",
      experienceYears: member.experienceYears ?? 0,
      about: member.about ?? "",
      address: member.address ?? "",
      joiningDate: member.joiningDate ?? "",
      careerStartDate: member.careerStartDate ?? "",
      profileImageUrl: member.profileImageUrl ?? "",
      employmentType: member.employmentType,
      payType: member.payType ?? "monthly_salary",
      effectiveFrom: member.effectiveFrom ?? "",
      compensationLater: member.compensationLater ?? false,
      baseSalary: member.baseSalary,
      commissionType: member.commissionType,
      commissionValue: member.commissionValue,
      notes: member.notes ?? "",
    });
    setSelectedBranches(branchId ? [branchId] : []);
    setSelectedServices(
      member.serviceIds.filter((serviceId) => currentBranchServiceIds.has(serviceId)),
    );
    setScheduleMode("custom");
    setOnlineBookingEnabled(member.onlineBookingEnabled);
    loadSchedule(member.id, branchId);
  }

  async function submitAssignment() {
    if (!assigning) return;
    const setupBranchId = selectedBranches[0] ?? salonId!;
    try {
      if (assignMode === "branch" && assigning.branchIds.includes(setupBranchId)) {
        throw new Error("User is already assigned to this branch");
      }
      await saveMember({
        data: {
          salonId: salonId!,
          id: assigning.id,
          ...form,
          roleTitle: roleTitleFromRoles(form.roles),
        },
      });
      await saveSchedule({
        data: {
          salonId: setupBranchId,
          teamMemberId: assigning.id,
          hours: teamHours,
        },
      });
      await assignBranches({
        data: {
          salonId: salonId!,
          teamMemberId: assigning.id,
          branchIds: Array.from(new Set([...assigning.branchIds, setupBranchId])),
        },
      });
      await assignServices({
        data: {
          salonId: setupBranchId,
          teamMemberId: assigning.id,
          serviceIds: selectedServices,
          onlineBookingEnabled,
        },
      });
      toast.success("Team assignment saved");
      setAssigning(null);
      void refresh();
    } catch (error) {
      toast.error(errorMessage(error, "Could not save team assignment"));
    }
  }

  const editingMember = editing && editing !== "new" ? editing : null;
  const setupLocked = editingMember?.invitationStatus === "invited";
  const profileComplete = Boolean(
    form.gender !== "all" && form.address.trim() && form.careerStartDate && selectedServices.length,
  );
  const setupComplete =
    selectedBranches.length > 0 && selectedServices.length > 0 && form.roles.length;
  const employmentComplete = Boolean(
    form.compensationLater ||
    (form.effectiveFrom && (form.payType === "commission_only" || form.baseSalary > 0)),
  );

  return (
    <div className="w-full px-4 py-7">
      <SalonBranchTabs className="mb-7" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">Team</p>
          <h1 className="font-display text-4xl text-primary">Team Members</h1>
          <p className="mt-1 text-muted-foreground">
            Add staff, assign branches and control service availability.
          </p>
        </div>
        <Button
          size="lg"
          onClick={() => {
            setInviting(true);
            setInviteForm(blankInvite);
          }}
        >
          <UserPlus className="size-4" /> Invite Team Member
        </Button>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <Metric icon={<Users className="size-4" />} label="All Members" value={stats.all} />
        <Metric icon={<CircleCheck className="size-4" />} label="Active" value={stats.active} />
        <Metric icon={<Clock3 className="size-4" />} label="Setup Required" value={stats.setup} />
        <Metric icon={<Mail className="size-4" />} label="Invited" value={stats.invited} />
      </div>
      <div className="mt-5 flex gap-6 border-b border-border text-sm">
        <TabButton
          active={tab === "all"}
          onClick={() => setTab("all")}
          label="All Members"
          count={stats.all}
        />
        <TabButton
          active={tab === "active"}
          onClick={() => setTab("active")}
          label="Active"
          count={stats.active}
        />
        <TabButton
          active={tab === "setup_required"}
          onClick={() => setTab("setup_required")}
          label="Setup Required"
          count={stats.setup}
        />
        <TabButton
          active={tab === "invited"}
          onClick={() => setTab("invited")}
          label="Invited"
          count={stats.invited}
        />
      </div>
      <div className="mt-6 rounded-2xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search team"
            className="max-w-sm"
          />
        </div>
        {membersQuery.isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        ) : filtered.length ? (
          <div className="grid gap-4 p-4 xl:grid-cols-2">
            {filtered.map((member) => {
              const canAssign = member.invitationStatus !== "invited";
              return (
                <article key={member.id} className="rounded-xl border border-border p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-2xl text-primary">{member.fullName}</h2>
                        <Status member={member} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {member.roleTitle} - {member.employmentType.replace("_", " ")}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <IconButton label="View" onClick={() => openView(member)}>
                        <Eye className="size-4" />
                      </IconButton>
                      <IconButton label="Edit" onClick={() => openEdit(member)}>
                        <Pencil className="size-4" />
                      </IconButton>
                      {member.invitationStatus !== "invited" && (
                        <IconButton
                          label={member.isActive ? "Deactivate" : "Activate"}
                          onClick={() => void toggleStatus(member)}
                        >
                          {member.isActive ? (
                            <CircleOff className="size-4" />
                          ) : (
                            <CircleCheck className="size-4" />
                          )}
                        </IconButton>
                      )}
                      <IconButton
                        label="Delete"
                        destructive
                        onClick={() => void handleDelete(member)}
                      >
                        <Trash2 className="size-4" />
                      </IconButton>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <Info
                      label="Contact"
                      value={
                        [member.phone, member.email].filter(Boolean).join(" / ") || "Not added"
                      }
                    />
                    <Info
                      label="Commission"
                      value={`${member.commissionType === "percentage" ? `${member.commissionValue}%` : `Rs ${member.commissionValue.toLocaleString("en-IN")}`}`}
                    />
                    <Info
                      label="Branches"
                      value={
                        member.branches.map((branch) => branch.name).join(", ") ||
                        "No branches assigned"
                      }
                    />
                    <Info
                      label="Services"
                      value={
                        member.services.length
                          ? `${member.services.length} assigned`
                          : member.setupRequired
                            ? "Setup required"
                            : "No services assigned"
                      }
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {canAssign ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openAssignment(member, 1)}
                        >
                          <BriefcaseBusiness className="size-4" /> Assign Branches
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openAssignment(member, 2)}
                        >
                          <Scissors className="size-4" /> Assign Services
                        </Button>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Assignment unlocks after the invitation is verified.
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="px-5 py-16 text-center text-muted-foreground">
            No team members found for this branch.
          </div>
        )}
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto rounded-2xl p-8">
          <DialogHeader className="sr-only">
            <DialogTitle>{editing === "new" ? "Add Team Member" : "Edit Team Member"}</DialogTitle>
            <DialogDescription>Complete team member setup.</DialogDescription>
          </DialogHeader>
          <button
            type="button"
            className="mb-5 text-sm text-primary"
            onClick={() => setEditing(null)}
          >
            Back
          </button>
          <div className="grid gap-4 md:grid-cols-[230px_1fr]">
            <TeamSetupSidebar member={editingMember} form={form} step={editStep} />
            <section className="rounded-2xl border border-border p-6">
              {editStep === 1 && (
                <div className="space-y-5">
                  <PanelHeader
                    title="Member Information"
                    description="Personal and professional details."
                  />
                  <PhotoPicker />
                  <Field label="Gender *">
                    <GenderPicker
                      value={form.gender}
                      onChange={(gender) => setForm({ ...form, gender })}
                    />
                  </Field>
                  <Field label="Address *">
                    <AddressAutocomplete
                      value={form.address}
                      onChange={(address) => setForm({ ...form, address })}
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Career Start Date *">
                      <Input
                        type="date"
                        value={form.careerStartDate}
                        onChange={(event) =>
                          setForm({ ...form, careerStartDate: event.target.value })
                        }
                      />
                    </Field>
                    <Field label="Specialities *">
                      <BusinessServicePicker
                        label="Select specialities"
                        services={setupServices}
                        value={selectedServices}
                        onChange={setSelectedServices}
                      />
                    </Field>
                  </div>
                  <StepFooter
                    backDisabled
                    nextDisabled={!profileComplete}
                    nextLabel="Save & Continue"
                    onNext={() => setEditStep(2)}
                  />
                </div>
              )}

              {editStep === 2 && !setupLocked && (
                <div className="space-y-5">
                  <PanelHeader
                    title="Branch Setup"
                    description="Assign branch, roles, services and working hours."
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Assign Branch *">
                      <BranchSelect
                        salons={salons}
                        value={selectedBranches[0] ?? ""}
                        disabled={Boolean(editingMember)}
                        onChange={(branchId) => {
                          setSelectedBranches(branchId ? [branchId] : []);
                          setSelectedServices([]);
                          loadSchedule(
                            editingMember && editingMember.invitationStatus !== "invited"
                              ? editingMember.id
                              : undefined,
                            branchId,
                          );
                        }}
                      />
                      {editingMember && (
                        <p className="text-xs text-muted-foreground">
                          Branch can&apos;t be changed while editing. Use Assign Branch to add this
                          member to a different branch.
                        </p>
                      )}
                    </Field>
                    <Field label="Assign Role(s) *">
                      <RolePicker
                        value={form.roles}
                        onChange={(roles) =>
                          setForm({ ...form, roles, roleTitle: roleTitleFromRoles(roles) })
                        }
                      />
                    </Field>
                  </div>
                  <ServiceCard
                    services={setupServices}
                    value={selectedServices}
                    onChange={setSelectedServices}
                  />
                  <WorkingHoursChoice
                    mode={scheduleMode}
                    memberName={form.fullName}
                    onUseBranch={() => {
                      setScheduleMode("branch");
                      loadSchedule(undefined, selectedBranches[0] ?? salonId);
                    }}
                    onCustom={() => {
                      setScheduleMode("custom");
                      setScheduleDialogOpen(true);
                    }}
                  />
                  <OnlineBookingSwitch
                    checked={onlineBookingEnabled}
                    memberName={form.fullName}
                    onChange={setOnlineBookingEnabled}
                  />
                  <StepFooter
                    onBack={() => setEditStep(1)}
                    nextDisabled={!setupComplete}
                    nextLabel="Save & Continue"
                    onNext={() => setEditStep(3)}
                  />
                </div>
              )}

              {editStep === 3 && !setupLocked && (
                <div className="space-y-5">
                  <PanelHeader
                    title="Employment Details"
                    description="Finalize employment and compensation."
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Employment Type *">
                      <Select
                        value={form.employmentType}
                        onValueChange={(value: "full_time" | "part_time" | "contract") =>
                          setForm({ ...form, employmentType: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full_time">Full Time</SelectItem>
                          <SelectItem value="part_time">Part Time</SelectItem>
                          <SelectItem value="contract">Contract</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Joining Date *">
                      <Input
                        type="date"
                        value={form.joiningDate}
                        onChange={(event) => setForm({ ...form, joiningDate: event.target.value })}
                      />
                    </Field>
                    <Field label="Pay Type *">
                      <Select
                        value={form.payType}
                        onValueChange={(
                          value: "monthly_salary" | "salary_commission" | "commission_only",
                        ) => setForm({ ...form, payType: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly_salary">Monthly Salary</SelectItem>
                          <SelectItem value="salary_commission">Salary + Commission</SelectItem>
                          <SelectItem value="commission_only">Commission Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Base Salary (Rs)">
                      <Input
                        type="number"
                        min="0"
                        disabled={form.payType === "commission_only" || form.compensationLater}
                        value={form.baseSalary}
                        onChange={(event) =>
                          setForm({ ...form, baseSalary: Number(event.target.value) })
                        }
                      />
                    </Field>
                    <Field label="Effective From *">
                      <Input
                        type="date"
                        value={form.effectiveFrom}
                        onChange={(event) =>
                          setForm({ ...form, effectiveFrom: event.target.value })
                        }
                      />
                    </Field>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox
                      checked={form.compensationLater}
                      onCheckedChange={(checked) =>
                        setForm({ ...form, compensationLater: Boolean(checked) })
                      }
                    />
                    Set compensation later
                  </label>
                  <StepFooter
                    onBack={() => setEditStep(2)}
                    nextDisabled={!setupComplete || !employmentComplete || !form.joiningDate}
                    nextLabel="Save & Continue"
                    onNext={() => void submitMember()}
                  />
                </div>
              )}

              {setupLocked && (
                <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                  Setup unlocks after the team member verifies their invitation.
                </div>
              )}
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold">Custom Working Hours</DialogTitle>
            <DialogDescription>
              Set this member&apos;s availability within the branch working hours.
            </DialogDescription>
          </DialogHeader>
          <ScheduleEditor hours={teamHours} onChange={setTeamHours} />
          <DialogFooter className="gap-2 border-t border-border pt-4">
            <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setScheduleDialogOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={inviting} onOpenChange={(open) => !open && setInviting(false)}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto rounded-2xl">
          <DialogHeader className="items-center text-center">
            <DialogTitle className="font-display text-2xl text-primary">
              Invite Team Member
            </DialogTitle>
            <DialogDescription className="sr-only">
              Send an invitation email for a stylist to verify their phone.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(event) => void submitInvite(event)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First Name *">
                <Input
                  placeholder="Enter first name"
                  value={inviteForm.firstName}
                  onChange={(event) =>
                    setInviteForm({ ...inviteForm, firstName: event.target.value })
                  }
                  required
                />
              </Field>
              <Field label="Last Name *">
                <Input
                  placeholder="Enter last name"
                  value={inviteForm.lastName}
                  onChange={(event) =>
                    setInviteForm({ ...inviteForm, lastName: event.target.value })
                  }
                  required
                />
              </Field>
              <Field label="Phone Number">
                <Input
                  placeholder="9876543210"
                  value={inviteForm.phone}
                  onChange={(event) => setInviteForm({ ...inviteForm, phone: event.target.value })}
                />
              </Field>
              <Field label="Email *">
                <Input
                  type="email"
                  placeholder="Enter email"
                  value={inviteForm.email}
                  onChange={(event) => setInviteForm({ ...inviteForm, email: event.target.value })}
                  required
                />
              </Field>
            </div>
            <Field label="Message">
              <Textarea
                maxLength={200}
                placeholder="Optional message to include in the invitation email"
                value={inviteForm.message}
                onChange={(event) => setInviteForm({ ...inviteForm, message: event.target.value })}
              />
              <p className="text-right text-xs text-muted-foreground">
                {inviteForm.message.length}/200 words
              </p>
            </Field>
            <DialogFooter className="justify-center">
              <Button type="submit" className="rounded-full px-8">
                Send Invitation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(assigning)} onOpenChange={(open) => !open && setAssigning(null)}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-primary">
              Assign Team Member
            </DialogTitle>
            <DialogDescription>{assigning?.fullName}</DialogDescription>
          </DialogHeader>
          <AssignmentSteps step={assignStep} />

          {assignStep === 1 && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Assign Branch *">
                  <BranchSelect
                    salons={salons}
                    value={selectedBranches[0] ?? ""}
                    onChange={(branchId) => {
                      setSelectedBranches(branchId ? [branchId] : []);
                      setSelectedServices([]);
                      if (assigning) loadSchedule(assigning.id, branchId);
                    }}
                  />
                </Field>
                <Field label="Assign Role(s) *">
                  <RolePicker
                    value={form.roles}
                    onChange={(roles) =>
                      setForm({ ...form, roles, roleTitle: roleTitleFromRoles(roles) })
                    }
                  />
                </Field>
              </div>
              <ServiceCard
                services={setupServices}
                value={selectedServices}
                onChange={setSelectedServices}
              />
              <WorkingHoursChoice
                mode={scheduleMode}
                memberName={assigning?.fullName ?? form.fullName}
                onUseBranch={() => {
                  setScheduleMode("branch");
                  loadSchedule(undefined, selectedBranches[0] ?? salonId);
                }}
                onCustom={() => {
                  setScheduleMode("custom");
                  setScheduleDialogOpen(true);
                }}
              />
              <OnlineBookingSwitch
                checked={onlineBookingEnabled}
                memberName={assigning?.fullName ?? form.fullName}
                onChange={setOnlineBookingEnabled}
              />
              <DialogFooter>
                <Button
                  disabled={
                    !selectedBranches.length || !selectedServices.length || !form.roles.length
                  }
                  onClick={() => setAssignStep(4)}
                >
                  Save & Continue
                </Button>
              </DialogFooter>
            </div>
          )}

          {assignStep === 2 && (
            <div className="space-y-4">
              <ServiceCard
                services={setupServices}
                value={selectedServices}
                onChange={setSelectedServices}
              />
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setAssignStep(1)}>
                  Back
                </Button>
                <Button disabled={!selectedServices.length} onClick={() => setAssignStep(3)}>
                  Continue
                </Button>
              </DialogFooter>
            </div>
          )}

          {assignStep === 3 && (
            <div className="space-y-4">
              <WorkingHoursChoice
                mode={scheduleMode}
                memberName={assigning?.fullName ?? form.fullName}
                onUseBranch={() => {
                  setScheduleMode("branch");
                  loadSchedule(undefined, selectedBranches[0] ?? salonId);
                }}
                onCustom={() => {
                  setScheduleMode("custom");
                  setScheduleDialogOpen(true);
                }}
              />
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setAssignStep(2)}>
                  Back
                </Button>
                <Button onClick={() => setAssignStep(4)}>Continue</Button>
              </DialogFooter>
            </div>
          )}

          {assignStep === 4 && (
            <div className="space-y-5">
              <PanelHeader
                title="Employment Details"
                description="Finalize employment and compensation."
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Employment Type *">
                  <Select
                    value={form.employmentType}
                    onValueChange={(value: "full_time" | "part_time" | "contract") =>
                      setForm({ ...form, employmentType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_time">Full Time</SelectItem>
                      <SelectItem value="part_time">Part Time</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Joining Date *">
                  <Input
                    type="date"
                    value={form.joiningDate}
                    onChange={(event) => setForm({ ...form, joiningDate: event.target.value })}
                  />
                </Field>
                <Field label="Pay Type *">
                  <Select
                    value={form.payType}
                    onValueChange={(
                      value: "monthly_salary" | "salary_commission" | "commission_only",
                    ) => setForm({ ...form, payType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly_salary">Monthly Salary</SelectItem>
                      <SelectItem value="salary_commission">Salary + Commission</SelectItem>
                      <SelectItem value="commission_only">Commission Only</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Base Salary (Rs)">
                  <Input
                    type="number"
                    min="0"
                    disabled={form.payType === "commission_only" || form.compensationLater}
                    value={form.baseSalary}
                    onChange={(event) =>
                      setForm({ ...form, baseSalary: Number(event.target.value) })
                    }
                  />
                </Field>
                <Field label="Effective From *">
                  <Input
                    type="date"
                    value={form.effectiveFrom}
                    onChange={(event) => setForm({ ...form, effectiveFrom: event.target.value })}
                  />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox
                  checked={form.compensationLater}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, compensationLater: Boolean(checked) })
                  }
                />
                Set compensation later
              </label>
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => setAssignStep(assignMode === "branch" ? 1 : 3)}
                >
                  Back
                </Button>
                <Button
                  disabled={!setupComplete || !employmentComplete || !form.joiningDate}
                  onClick={() => void submitAssignment()}
                >
                  <Check className="size-4" /> Save & Continue
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(viewingMember)}
        onOpenChange={(open) => !open && setViewingMember(null)}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[640px] overflow-y-auto rounded-lg px-9 py-8 sm:px-12">
          {viewingMember && <TeamMemberView member={viewingMember} schedule={viewingSchedule} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-3xl font-semibold text-primary">{value}</p>
    </div>
  );
}

function TeamSetupSidebar({
  member,
  form,
  step,
}: {
  member: TeamMember | null;
  form: typeof blankForm;
  step: 1 | 2 | 3;
}) {
  const name = (member?.fullName ?? form.fullName) || "Team Member";
  return (
    <aside className="rounded-2xl border border-border p-4">
      <div className="rounded-xl border border-border p-4 text-center">
        <p className="font-semibold text-foreground">{name}</p>
        <p className="mt-2 text-xs text-muted-foreground">{member?.email ?? form.email}</p>
        <p className="mt-1 text-xs text-muted-foreground">{member?.phone ?? form.phone}</p>
        <span className="mt-3 inline-flex rounded-full bg-orange-50 px-3 py-1 text-xs font-medium text-orange-600">
          {member?.setupRequired ? "Setup Required" : "Active"}
        </span>
      </div>
      <TeamSetupSteps step={step} />
    </aside>
  );
}

function TeamSetupSteps({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="mt-5 space-y-4 text-xs">
      <StepDot active={step === 1} done={step > 1} label="Personal Information" number={1} />
      <StepDot active={step === 2} done={step > 2} label="Branch Setup" number={2} />
      <StepDot active={step === 3} label="Employment Details" number={3} />
    </div>
  );
}

function AssignmentSteps({ step }: { step: 1 | 2 | 3 | 4 }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
      <StepDot active={step === 1} done={step > 1} label="Branches" number={1} />
      <span className="h-px w-12 bg-border" />
      <StepDot active={step === 2} done={step > 2} label="Services" number={2} />
      <span className="h-px w-12 bg-border" />
      <StepDot active={step === 3} done={step > 3} label="Schedule" number={3} />
      <span className="h-px w-12 bg-border" />
      <StepDot active={step === 4} label="Employment" number={4} />
    </div>
  );
}

function PanelHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function PhotoPicker() {
  return (
    <div className="flex flex-col items-center gap-3 py-2 text-center">
      <div className="grid size-24 place-items-center rounded-full border border-dashed border-primary/30 text-xs text-muted-foreground">
        No file
      </div>
      <Button type="button" size="sm" className="rounded-full">
        Choose File
      </Button>
      <p className="text-xs text-muted-foreground">Upload the team member photo here.</p>
    </div>
  );
}

function GenderPicker({
  value,
  onChange,
}: {
  value: "male" | "female" | "other" | "all";
  onChange: (value: "male" | "female" | "other") => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {(["male", "female", "other"] as const).map((gender) => (
        <button
          key={gender}
          type="button"
          className={cn(
            "rounded-full border px-4 py-2 text-sm capitalize",
            value === gender ? "border-primary bg-gold-soft text-primary" : "border-border",
          )}
          onClick={() => onChange(gender)}
        >
          {gender}
        </button>
      ))}
    </div>
  );
}

function AddressAutocomplete({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<{ label: string; lat: number; lon: number }[]>([]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 3) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=in&limit=6&q=${encodeURIComponent(term)}`,
          { signal: controller.signal, headers: { Accept: "application/json" } },
        );
        const json = (await response.json()) as {
          display_name: string;
          lat: string;
          lon: string;
        }[];
        setSuggestions(
          json.map((item) => ({
            label: item.display_name,
            lat: Number(item.lat),
            lon: Number(item.lon),
          })),
        );
        setOpen(true);
      } catch {
        // Search is best-effort; manual address entry remains available.
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="relative">
      <MapPin className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-primary" />
      <Input
        value={value}
        autoComplete="off"
        placeholder="Search Address"
        className="pl-9 pr-9"
        onFocus={() => suggestions.length && setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onChange={(event) => {
          onChange(event.target.value);
          setQuery(event.target.value);
        }}
      />
      {searching && (
        <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-primary" />
      )}
      {open && suggestions.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-card py-1 shadow-lg">
          {suggestions.map((item) => (
            <li key={`${item.lat}-${item.lon}-${item.label}`}>
              <button
                type="button"
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-gold-soft"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(item.label.slice(0, 300));
                  setQuery("");
                  setSuggestions([]);
                  setOpen(false);
                }}
              >
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BranchSelect({
  salons,
  value,
  disabled,
  onChange,
}: {
  salons: { id: string; name: string; parent_id: string | null }[];
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value || undefined} disabled={disabled} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select branch" />
      </SelectTrigger>
      <SelectContent>
        {salons.map((salon) => (
          <SelectItem key={salon.id} value={salon.id}>
            {salon.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function RolePicker({ value, onChange }: { value: string[]; onChange: (roles: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const selected = new Set(value);
  const selectedLabel = value.length
    ? ROLE_OPTIONS.filter((role) => selected.has(role.value))
        .map((role) => role.label)
        .join(", ")
    : "Select roles";
  return (
    <div className="relative">
      <button
        type="button"
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-card px-3 text-left text-sm"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="truncate">{selectedLabel}</span>
        <span className="text-muted-foreground">⌄</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-border bg-card p-3 shadow-lg">
          <div className="space-y-3">
            {ROLE_OPTIONS.map((role) => (
              <label key={role.value} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selected.has(role.value)}
                  onCheckedChange={() => {
                    const next = selected.has(role.value)
                      ? value.filter((item) => item !== role.value)
                      : [...value, role.value];
                    onChange(next.length ? next : ["salon_stylist"]);
                  }}
                />
                {role.label}
              </label>
            ))}
          </div>
          <div className="mt-4 border-t border-border pt-3 text-right">
            <Button type="button" size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ServiceCard({
  services,
  value,
  onChange,
}: {
  services: SelectableService[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <Field label="Services *">
      <div className="rounded-xl border border-border p-4">
        <div className="mx-auto max-w-xs">
          <BusinessServicePicker
            label="Select Services"
            services={services}
            value={value}
            onChange={onChange}
          />
        </div>
        {value.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {services
              .filter((service) => value.includes(service.id))
              .map((service) => (
                <span key={service.id} className="rounded-full bg-secondary px-2.5 py-1 text-xs text-foreground">
                  {service.name} · {service.durationMins} min
                </span>
              ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No services selected</p>
        )}
      </div>
    </Field>
  );
}

function WorkingHoursChoice({
  mode,
  memberName,
  onUseBranch,
  onCustom,
}: {
  mode: ScheduleMode;
  memberName: string;
  onUseBranch: () => void;
  onCustom: () => void;
}) {
  return (
    <Field label="Working Hours *">
      <div className="space-y-3 rounded-xl border border-border p-3">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left"
          onClick={onUseBranch}
        >
          <span
            className={cn(
              "size-4 rounded-full border",
              mode === "branch" && "border-primary bg-primary",
            )}
          />
          <span>
            <span className="block text-sm font-medium">Keep branch timings</span>
            <span className="text-xs text-muted-foreground">
              Use branch working hours for all days
            </span>
          </span>
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left"
          onClick={onCustom}
        >
          <span
            className={cn(
              "size-4 rounded-full border",
              mode === "custom" && "border-primary bg-primary",
            )}
          />
          <span>
            <span className="block text-sm font-medium">Custom schedule</span>
            <span className="text-xs text-muted-foreground">Open custom working hours setup</span>
          </span>
        </button>
        {mode === "custom" && (
          <button
            type="button"
            className="w-full rounded-lg border border-dashed border-border p-3 text-left"
            onClick={onCustom}
          >
            <span className="block text-sm font-medium text-primary">Custom schedule selected</span>
            <span className="text-xs text-muted-foreground">
              Open the schedule modal to edit availability for {memberName || "this member"}.
            </span>
          </button>
        )}
      </div>
    </Field>
  );
}

function OnlineBookingSwitch({
  checked,
  memberName,
  onChange,
}: {
  checked: boolean;
  memberName: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Field label="Online Booking *">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm">
        <span>Allow customers to book {memberName || "this member"} online</span>
        <Switch checked={checked} onCheckedChange={onChange} />
      </div>
    </Field>
  );
}

function roleTitleFromRoles(roles: string[]) {
  const labels = ROLE_OPTIONS.filter((role) => roles.includes(role.value)).map(
    (role) => role.label,
  );
  return labels[0] ?? "Salon Stylist";
}

function errorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  try {
    const parsed = JSON.parse(error.message) as {
      message?: string;
      error?: { message?: string };
    };
    return parsed.message ?? parsed.error?.message ?? fallback;
  } catch {
    return error.message || fallback;
  }
}

function StepFooter({
  backDisabled,
  nextDisabled,
  nextLabel,
  onBack,
  onNext,
}: {
  backDisabled?: boolean;
  nextDisabled?: boolean;
  nextLabel: string;
  onBack?: () => void;
  onNext: () => void;
}) {
  return (
    <DialogFooter className="border-t border-border pt-5">
      <Button type="button" variant="outline" disabled={backDisabled} onClick={onBack}>
        Back
      </Button>
      <Button type="button" disabled={nextDisabled} onClick={onNext}>
        {nextLabel}
      </Button>
    </DialogFooter>
  );
}

function StepDot({
  active,
  done,
  number,
  label,
}: {
  active: boolean;
  done?: boolean;
  number: number;
  label: string;
}) {
  return (
    <div
      className={cn("flex items-center gap-2", active ? "text-primary" : "text-muted-foreground")}
    >
      <span
        className={cn(
          "grid size-6 place-items-center rounded-full border text-xs font-semibold",
          active || done
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card",
        )}
      >
        {done ? <Check className="size-3.5" /> : number}
      </span>
      {label}
    </div>
  );
}

function ScheduleEditor({
  hours,
  onChange,
}: {
  hours: ScheduleHour[];
  onChange: (hours: ScheduleHour[]) => void;
}) {
  function update(dayOfWeek: number, patch: Partial<ScheduleHour>) {
    onChange(hours.map((hour) => (hour.dayOfWeek === dayOfWeek ? { ...hour, ...patch } : hour)));
  }

  return (
    <div className="space-y-2">
      {hours.map((hour) => (
        <div
          key={hour.dayOfWeek}
          className="grid gap-3 rounded-lg border border-border p-3 text-sm sm:grid-cols-[90px_1fr_1fr]"
        >
          <label className="flex items-center gap-2 font-medium text-foreground">
            <Checkbox
              checked={hour.isWorking}
              onCheckedChange={(checked) => update(hour.dayOfWeek, { isWorking: Boolean(checked) })}
            />
            {DAY_NAMES[hour.dayOfWeek]}
          </label>
          <Input
            type="time"
            value={hour.startTime}
            disabled={!hour.isWorking}
            onChange={(event) => update(hour.dayOfWeek, { startTime: event.target.value })}
          />
          <Input
            type="time"
            value={hour.endTime}
            disabled={!hour.isWorking}
            onChange={(event) => update(hour.dayOfWeek, { endTime: event.target.value })}
          />
        </div>
      ))}
    </div>
  );
}

function TabButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "border-b-2 px-1 pb-3 font-medium",
        active ? "border-primary text-primary" : "border-transparent text-muted-foreground",
      )}
      onClick={onClick}
    >
      {label}{" "}
      <span className="rounded-full bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
        {count}
      </span>
    </button>
  );
}

function TeamMemberView({ member, schedule }: { member: TeamMember; schedule: ScheduleHour[] }) {
  const payTypeLabel =
    member.payType === "monthly_salary"
      ? `Rs ${member.baseSalary.toLocaleString("en-IN")}/mo`
      : member.payType === "commission_only"
        ? "Commission only"
        : "Salary + commission";
  return (
    <>
      <DialogHeader className="items-center text-center">
        <span className="grid size-16 place-items-center rounded-full bg-gold-soft text-xl font-semibold text-primary">
          {member.fullName[0]}
        </span>
        <DialogTitle className="mt-2 flex items-center gap-2 text-2xl">
          {member.fullName} <Status member={member} />
        </DialogTitle>
        <DialogDescription>
          {member.roleTitle} · {member.employmentType.replace("_", " ")}
        </DialogDescription>
      </DialogHeader>

      <div className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
        <Info
          label="Contact"
          value={[member.phone, member.email].filter(Boolean).join(" / ") || "Not added"}
        />
        <Info
          label="Gender"
          value={member.gender === "all" ? "Not specified" : capitalize(member.gender)}
        />
        <Info label="Experience" value={experienceFromCareerStart(member.careerStartDate, member.experienceYears)} />
        <Info
          label="Roles"
          value={
            member.roles
              .map((role) => ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role)
              .join(", ") || "—"
          }
        />
        <Info
          label="Joining Date"
          value={member.joiningDate ? formatDate(member.joiningDate) : "Not set"}
        />
        <Info
          label="Career Start"
          value={member.careerStartDate ? formatDate(member.careerStartDate) : "Not set"}
        />
        <Info label="Pay Type" value={payTypeLabel} />
        <Info
          label="Commission"
          value={
            member.commissionType === "percentage"
              ? `${member.commissionValue}%`
              : `Rs ${member.commissionValue.toLocaleString("en-IN")}`
          }
        />
        <Info label="Online Booking" value={member.onlineBookingEnabled ? "Enabled" : "Disabled"} />
        <Info label="Address" value={member.address || "Not added"} />
        <Info
          label="Branches"
          value={member.branches.map((branch) => branch.name).join(", ") || "No branches assigned"}
        />
      </div>

      {member.about && (
        <div className="mt-4">
          <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            About
          </p>
          <p className="mt-1 text-sm text-foreground">{member.about}</p>
        </div>
      )}

      {member.services.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            Assigned Services
          </p>
          <div className="flex flex-wrap gap-2">
            {member.services.map((service) => (
              <span
                key={service.id}
                className="rounded-full bg-secondary px-3 py-1 text-xs text-foreground"
              >
                {service.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
        <p className="mb-2 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          Weekly Schedule
        </p>
        <div className="space-y-1.5">
          {schedule.map((hour) => (
            <div
              key={hour.dayOfWeek}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
            >
              <span className="font-medium text-foreground">{FULL_DAY_NAMES[hour.dayOfWeek]}</span>
              <span className={hour.isWorking ? "text-foreground" : "text-muted-foreground"}>
                {hour.isWorking ? `${hour.startTime} - ${hour.endTime}` : "Off"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function experienceFromCareerStart(careerStartDate: string | null, fallbackYears: number) {
  if (!careerStartDate) return `${fallbackYears} ${fallbackYears === 1 ? "yr" : "yrs"}`;

  const [year, month, day] = careerStartDate.split("-").map(Number);
  if (!year || !month || !day) return `${fallbackYears} ${fallbackYears === 1 ? "yr" : "yrs"}`;

  const today = new Date();
  let months = (today.getFullYear() - year) * 12 + today.getMonth() - (month - 1);
  if (today.getDate() < day) months -= 1;
  months = Math.max(0, months);

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (!years) return remainingMonths ? `${remainingMonths} ${remainingMonths === 1 ? "month" : "months"}` : "Less than a month";
  return `${years} ${years === 1 ? "yr" : "yrs"}${remainingMonths ? ` ${remainingMonths} ${remainingMonths === 1 ? "mo" : "mos"}` : ""}`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function Status({ member }: { member: TeamMember }) {
  const label =
    member.invitationStatus === "invited"
      ? "Invited"
      : member.setupRequired
        ? "Setup Required"
        : member.isActive
          ? "Active"
          : "Inactive";
  const style =
    member.invitationStatus === "invited"
      ? "bg-blue-50 text-blue-700"
      : member.setupRequired
        ? "bg-amber-50 text-amber-700"
        : member.isActive
          ? "bg-emerald-50 text-emerald-700"
          : "bg-secondary text-muted-foreground";
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", style)}>{label}</span>
  );
}

function IconButton({
  label,
  destructive,
  children,
  onClick,
}: {
  label: string;
  destructive?: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "rounded-lg border border-border p-2 hover:bg-secondary",
        destructive && "text-destructive hover:bg-destructive/10",
      )}
    >
      {children}
    </button>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/45 p-3">
      <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 text-foreground">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
