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
  saveTeamMember,
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

const blankForm = {
  fullName: "",
  phone: "",
  email: "",
  roleTitle: "Stylist",
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

type TeamTab = "all" | "active" | "setup_required" | "invited";

function TeamPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirmation();
  const { salons, activeSalonId: salonId } = useSalonBranches();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TeamTab>("all");
  const [editing, setEditing] = useState<TeamMember | null | "new">(null);
  const [inviting, setInviting] = useState(false);
  const [assignServicesFor, setAssignServicesFor] = useState<TeamMember | null>(null);
  const [assignBranchesFor, setAssignBranchesFor] = useState<TeamMember | null>(null);
  const [form, setForm] = useState(blankForm);
  const [inviteForm, setInviteForm] = useState(blankInvite);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const getMembers = useServerFn(listTeamMembers);
  const getServices = useServerFn(listSelectableServices);
  const saveMember = useServerFn(saveTeamMember);
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
        (tab === "active" && member.isActive && !member.setupRequired) ||
        (tab === "setup_required" && member.setupRequired) ||
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
        !member.setupRequired,
    ).length,
    setup: members.filter(
      (member) => (!salonId || member.branchIds.includes(salonId)) && member.setupRequired,
    ).length,
    invited: members.filter(
      (member) =>
        (!salonId || member.branchIds.includes(salonId)) && member.invitationStatus === "invited",
    ).length,
  };

  function openEdit(member?: TeamMember) {
    if (member) {
      setEditing(member);
      setForm({
        fullName: member.fullName,
        phone: member.phone ?? "",
        email: member.email ?? "",
        roleTitle: member.roleTitle,
        employmentType: member.employmentType,
        baseSalary: member.baseSalary,
        commissionType: member.commissionType,
        commissionValue: member.commissionValue,
        notes: member.notes ?? "",
      });
    } else {
      setEditing("new");
      setForm(blankForm);
    }
  }

  async function submitMember(event: FormEvent) {
    event.preventDefault();
    try {
      await saveMember({
        data: {
          salonId: salonId!,
          id: editing && editing !== "new" ? editing.id : undefined,
          ...form,
        },
      });
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

  async function submitServices() {
    if (!assignServicesFor) return;
    try {
      await assignServices({
        data: {
          salonId: salonId!,
          teamMemberId: assignServicesFor.id,
          serviceIds: selectedServices,
        },
      });
      toast.success("Services assigned");
      setAssignServicesFor(null);
      void refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not assign services");
    }
  }

  async function submitBranches() {
    if (!assignBranchesFor) return;
    try {
      await assignBranches({
        data: {
          salonId: salonId!,
          teamMemberId: assignBranchesFor.id,
          branchIds: selectedBranches,
        },
      });
      toast.success("Branches assigned");
      setAssignBranchesFor(null);
      void refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not assign branches");
    }
  }

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
            {filtered.map((member) => (
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
                    value={[member.phone, member.email].filter(Boolean).join(" / ") || "Not added"}
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAssignBranchesFor(member);
                      setSelectedBranches(member.branchIds);
                    }}
                  >
                    <BriefcaseBusiness className="size-4" /> Assign Branches
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAssignServicesFor(member);
                      setSelectedServices(
                        member.serviceIds.filter((serviceId) =>
                          currentBranchServiceIds.has(serviceId),
                        ),
                      );
                    }}
                  >
                    <Scissors className="size-4" /> Assign Services
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="px-5 py-16 text-center text-muted-foreground">
            No team members found for this branch.
          </div>
        )}
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-primary">
              {editing === "new" ? "Add Team Member" : "Edit Team Member"}
            </DialogTitle>
            <DialogDescription>
              Staff records are owned by this web project and stored in Supabase.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(event) => void submitMember(event)}>
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
              <Field label="Base salary">
                <Input
                  type="number"
                  min="0"
                  value={form.baseSalary}
                  onChange={(event) => setForm({ ...form, baseSalary: Number(event.target.value) })}
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
            </div>
            <Field label="Notes">
              <Textarea
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </Field>
            <DialogFooter>
              <Button type="submit">{editing === "new" ? "Add member" : "Save changes"}</Button>
            </DialogFooter>
          </form>
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

      <Dialog
        open={Boolean(assignServicesFor)}
        onOpenChange={(open) => !open && setAssignServicesFor(null)}
      >
        <DialogContent className="max-w-3xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-primary">
              Assign Services
            </DialogTitle>
            <DialogDescription>{assignServicesFor?.fullName}</DialogDescription>
          </DialogHeader>
          <BusinessServicePicker
            services={services}
            value={selectedServices}
            onChange={setSelectedServices}
          />
          <DialogFooter>
            <Button onClick={() => void submitServices()}>
              <Check className="size-4" /> Save assignments
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(assignBranchesFor)}
        onOpenChange={(open) => !open && setAssignBranchesFor(null)}
      >
        <DialogContent className="max-w-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-primary">
              Assign Branches
            </DialogTitle>
            <DialogDescription>{assignBranchesFor?.fullName}</DialogDescription>
          </DialogHeader>
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
                      setSelectedBranches(
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
          <DialogFooter>
            <Button onClick={() => void submitBranches()}>
              <Check className="size-4" /> Save assignments
            </Button>
          </DialogFooter>
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
