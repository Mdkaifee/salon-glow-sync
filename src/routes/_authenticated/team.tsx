import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  BriefcaseBusiness,
  Check,
  CircleCheck,
  CircleOff,
  Clock3,
  Loader2,
  Mail,
  Pencil,
  Scissors,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
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
  gender: "male" | "female" | "other" | "all";
  experienceYears: number;
  about: string | null;
  address: string | null;
  joiningDate: string | null;
  profileImageUrl: string | null;
  employmentType: "full_time" | "part_time" | "contract";
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
  gender: "all" as const,
  experienceYears: 0,
  about: "",
  address: "",
  joiningDate: "",
  profileImageUrl: "",
  employmentType: "full_time" as const,
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

type TeamTab = "all" | "active" | "setup_required" | "invited";

function TeamPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirmation();
  const { salons, activeSalonId: salonId } = useSalonBranches();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TeamTab>("all");
  const [editing, setEditing] = useState<TeamMember | null | "new">(null);
  const [editStep, setEditStep] = useState<1 | 2 | 3 | 4>(1);
  const [inviting, setInviting] = useState(false);
  const [assigning, setAssigning] = useState<TeamMember | null>(null);
  const [assignStep, setAssignStep] = useState<1 | 2 | 3 | 4>(1);
  const [form, setForm] = useState(blankForm);
  const [inviteForm, setInviteForm] = useState(blankInvite);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [teamHours, setTeamHours] = useState<ScheduleHour[]>(defaultTeamHours);
  const [onlineBookingEnabled, setOnlineBookingEnabled] = useState(true);
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
  const members = useMemo(() => (membersQuery.data ?? []) as TeamMember[], [membersQuery.data]);
  const services = useMemo(
    () => (servicesQuery.data ?? []) as SelectableService[],
    [servicesQuery.data],
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

  function loadSchedule(teamMemberId?: string) {
    if (!salonId) return;
    void getTeamSchedule({ data: { salonId, teamMemberId } })
      .then((hours) => setTeamHours(hours as ScheduleHour[]))
      .catch(() => setTeamHours(defaultTeamHours));
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
        gender: member.gender ?? "all",
        experienceYears: member.experienceYears ?? 0,
        about: member.about ?? "",
        address: member.address ?? "",
        joiningDate: member.joiningDate ?? "",
        profileImageUrl: member.profileImageUrl ?? "",
        employmentType: member.employmentType,
        baseSalary: member.baseSalary,
        commissionType: member.commissionType,
        commissionValue: member.commissionValue,
        notes: member.notes ?? "",
      });
      setSelectedBranches(member.branchIds);
      setSelectedServices(
        member.serviceIds.filter((serviceId) => currentBranchServiceIds.has(serviceId)),
      );
      setOnlineBookingEnabled(member.onlineBookingEnabled);
      loadSchedule(member.invitationStatus === "invited" ? undefined : member.id);
    } else {
      setEditing("new");
      setForm(blankForm);
      setSelectedBranches(salonId ? [salonId] : []);
      setSelectedServices([]);
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
        },
      });
      const teamMemberId = result.id;
      const canSaveSetup =
        editing === "new" || (editing !== null && editing.invitationStatus !== "invited");
      if (canSaveSetup) {
        await assignBranches({
          data: {
            salonId: salonId!,
            teamMemberId,
            branchIds: selectedBranches,
          },
        });
        await saveSchedule({
          data: {
            salonId: salonId!,
            teamMemberId,
            hours: teamHours,
          },
        });
        await assignServices({
          data: {
            salonId: salonId!,
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
      toast.error(error instanceof Error ? error.message : "Could not save team member");
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
      toast.error(error instanceof Error ? error.message : "Could not invite team member");
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
      toast.error(error instanceof Error ? error.message : "Could not update status");
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
      toast.error(error instanceof Error ? error.message : "Could not delete team member");
    }
  }

  function openAssignment(member: TeamMember, startStep: 1 | 2 = 1) {
    if (member.invitationStatus === "invited") {
      toast.error("Team member must verify the invitation before assignment.");
      return;
    }
    setAssigning(member);
    setAssignStep(member.branchIds.length ? startStep : 1);
    setSelectedBranches(member.branchIds);
    setSelectedServices(
      member.serviceIds.filter((serviceId) => currentBranchServiceIds.has(serviceId)),
    );
    setOnlineBookingEnabled(member.onlineBookingEnabled);
    loadSchedule(member.id);
  }

  async function submitAssignment() {
    if (!assigning) return;
    try {
      await assignBranches({
        data: {
          salonId: salonId!,
          teamMemberId: assigning.id,
          branchIds: selectedBranches,
        },
      });
      await saveSchedule({
        data: {
          salonId: salonId!,
          teamMemberId: assigning.id,
          hours: teamHours,
        },
      });
      await assignServices({
        data: {
          salonId: salonId!,
          teamMemberId: assigning.id,
          serviceIds: selectedServices,
          onlineBookingEnabled,
        },
      });
      toast.success("Team assignment saved");
      setAssigning(null);
      void refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save team assignment");
    }
  }

  const editingMember = editing && editing !== "new" ? editing : null;
  const setupLocked = editingMember?.invitationStatus === "invited";
  const profileComplete = form.fullName.trim().length > 1 && form.roleTitle.trim().length > 1;
  const setupComplete = selectedBranches.length > 0 && selectedServices.length > 0;

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
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-primary">
              {editing === "new" ? "Add Team Member" : "Edit Team Member"}
            </DialogTitle>
            <DialogDescription>
              {setupLocked
                ? "Setup unlocks after the team member verifies their invitation."
                : "Complete profile, compensation, services and availability."}
            </DialogDescription>
          </DialogHeader>
          <TeamSetupSteps step={editStep} locked={Boolean(setupLocked)} />

          {editStep === 1 && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name">
                  <Input
                    value={form.fullName}
                    onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                    required
                  />
                </Field>
                <Field label="Role">
                  <Input
                    value={form.roleTitle}
                    onChange={(event) => setForm({ ...form, roleTitle: event.target.value })}
                    required
                  />
                </Field>
                <Field label="Phone">
                  <Input
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  />
                </Field>
                <Field label="Email">
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                  />
                </Field>
                <Field label="Gender">
                  <Select
                    value={form.gender}
                    onValueChange={(value: "male" | "female" | "other" | "all") =>
                      setForm({ ...form, gender: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Experience years">
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={form.experienceYears}
                    onChange={(event) =>
                      setForm({ ...form, experienceYears: Number(event.target.value) })
                    }
                  />
                </Field>
              </div>
              <Field label="Address">
                <Input
                  value={form.address}
                  onChange={(event) => setForm({ ...form, address: event.target.value })}
                />
              </Field>
              <Field label="About">
                <Textarea
                  value={form.about}
                  onChange={(event) => setForm({ ...form, about: event.target.value })}
                />
              </Field>
              <DialogFooter>
                <Button disabled={!profileComplete} onClick={() => setEditStep(2)}>
                  Continue
                </Button>
              </DialogFooter>
            </div>
          )}

          {editStep === 2 && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Employment">
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
                      <SelectItem value="full_time">Full time</SelectItem>
                      <SelectItem value="part_time">Part time</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Joining date">
                  <Input
                    type="date"
                    value={form.joiningDate}
                    onChange={(event) => setForm({ ...form, joiningDate: event.target.value })}
                  />
                </Field>
                <Field label="Base salary">
                  <Input
                    type="number"
                    min="0"
                    value={form.baseSalary}
                    onChange={(event) =>
                      setForm({ ...form, baseSalary: Number(event.target.value) })
                    }
                  />
                </Field>
                <Field label="Commission type">
                  <Select
                    value={form.commissionType}
                    onValueChange={(value: "percentage" | "fixed") =>
                      setForm({ ...form, commissionType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed">Fixed</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Commission value">
                  <Input
                    type="number"
                    min="0"
                    value={form.commissionValue}
                    onChange={(event) =>
                      setForm({ ...form, commissionValue: Number(event.target.value) })
                    }
                  />
                </Field>
                <Field label="Profile image URL">
                  <Input
                    value={form.profileImageUrl}
                    onChange={(event) => setForm({ ...form, profileImageUrl: event.target.value })}
                  />
                </Field>
              </div>
              <Field label="Notes">
                <Textarea
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                />
              </Field>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setEditStep(1)}>
                  Back
                </Button>
                {setupLocked ? (
                  <Button onClick={() => void submitMember()}>
                    {editing === "new" ? "Add member" : "Save changes"}
                  </Button>
                ) : (
                  <Button onClick={() => setEditStep(3)}>Continue</Button>
                )}
              </DialogFooter>
            </div>
          )}

          {editStep === 3 && !setupLocked && (
            <div className="space-y-4">
              <BranchPicker
                salons={salons}
                selectedBranches={selectedBranches}
                onChange={setSelectedBranches}
              />
              <BusinessServicePicker
                services={services}
                value={selectedServices}
                onChange={setSelectedServices}
              />
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setEditStep(2)}>
                  Back
                </Button>
                <Button
                  disabled={!selectedBranches.length || !selectedServices.length}
                  onClick={() => setEditStep(4)}
                >
                  Continue
                </Button>
              </DialogFooter>
            </div>
          )}

          {editStep === 4 && !setupLocked && (
            <div className="space-y-4">
              <ScheduleEditor hours={teamHours} onChange={setTeamHours} />
              <label className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
                <Checkbox
                  checked={onlineBookingEnabled}
                  onCheckedChange={(checked) => setOnlineBookingEnabled(Boolean(checked))}
                />
                <span className="font-medium text-foreground">Available for online booking</span>
              </label>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setEditStep(3)}>
                  Back
                </Button>
                <Button disabled={!setupComplete} onClick={() => void submitMember()}>
                  {editing === "new" ? "Add member" : "Save changes"}
                </Button>
              </DialogFooter>
            </div>
          )}
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
              <BranchPicker
                salons={salons}
                selectedBranches={selectedBranches}
                onChange={setSelectedBranches}
              />
              <DialogFooter>
                <Button disabled={!selectedBranches.length} onClick={() => setAssignStep(2)}>
                  Continue
                </Button>
              </DialogFooter>
            </div>
          )}

          {assignStep === 2 && (
            <div className="space-y-4">
              <BusinessServicePicker
                services={services}
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
              <ScheduleEditor hours={teamHours} onChange={setTeamHours} />
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setAssignStep(2)}>
                  Back
                </Button>
                <Button onClick={() => setAssignStep(4)}>Continue</Button>
              </DialogFooter>
            </div>
          )}

          {assignStep === 4 && (
            <div className="space-y-4">
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <Info label="Branches" value={`${selectedBranches.length} selected`} />
                <Info label="Services" value={`${selectedServices.length} selected`} />
                <Info
                  label="Schedule"
                  value={`${teamHours.filter((hour) => hour.isWorking).length} working days`}
                />
                <Info
                  label="Online Booking"
                  value={onlineBookingEnabled ? "Enabled" : "Disabled"}
                />
              </div>
              <label className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
                <Checkbox
                  checked={onlineBookingEnabled}
                  onCheckedChange={(checked) => setOnlineBookingEnabled(Boolean(checked))}
                />
                <span className="font-medium text-foreground">Available for online booking</span>
              </label>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setAssignStep(3)}>
                  Back
                </Button>
                <Button onClick={() => void submitAssignment()}>
                  <Check className="size-4" /> Save assignment
                </Button>
              </DialogFooter>
            </div>
          )}
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

function TeamSetupSteps({ step, locked }: { step: 1 | 2 | 3 | 4; locked: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
      <StepDot active={step === 1} done={step > 1} label="Profile" number={1} />
      <span className="h-px w-10 bg-border" />
      <StepDot active={step === 2} done={step > 2} label="Compensation" number={2} />
      {!locked && (
        <>
          <span className="h-px w-10 bg-border" />
          <StepDot active={step === 3} done={step > 3} label="Services" number={3} />
          <span className="h-px w-10 bg-border" />
          <StepDot active={step === 4} label="Availability" number={4} />
        </>
      )}
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
      <StepDot active={step === 4} label="Review" number={4} />
    </div>
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

function BranchPicker({
  salons,
  selectedBranches,
  onChange,
}: {
  salons: { id: string; name: string; parent_id: string | null }[];
  selectedBranches: string[];
  onChange: (branchIds: string[]) => void;
}) {
  return (
    <div className="grid gap-2">
      {salons.map((salon) => {
        const checked = selectedBranches.includes(salon.id);
        return (
          <label
            key={salon.id}
            className={cn(
              "flex items-center gap-3 rounded-lg border p-3 text-sm",
              checked ? "border-primary bg-gold-soft/50" : "border-border",
            )}
          >
            <Checkbox
              checked={checked}
              onCheckedChange={() =>
                onChange(
                  checked
                    ? selectedBranches.filter((id) => id !== salon.id)
                    : [...selectedBranches, salon.id],
                )
              }
            />
            <span>
              <span className="font-medium text-foreground">{salon.name}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {salon.parent_id ? "Branch" : "Main salon"}
              </span>
            </span>
          </label>
        );
      })}
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
