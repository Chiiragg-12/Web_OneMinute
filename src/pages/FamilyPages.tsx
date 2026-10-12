import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { FamilyMember } from "../types/api";
import {
  ApiErrorState,
  Button,
  EmptyState,
  Field,
  LoadingState,
  SuccessMessage,
} from "../components/ui";

const sexLabel = (value: string | null) =>
  value
    ? value
        .replaceAll("_", " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Not added";
const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(
        new Date(value),
      )
    : "Not added";

function HealthFields({ member }: { member: FamilyMember }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="metric-card">
        <p className="label">Height</p>
        <p className="mt-2 font-semibold">
          {member.heightCm ? `${member.heightCm} cm` : "Not added"}
        </p>
      </div>
      <div className="metric-card">
        <p className="label">Weight</p>
        <p className="mt-2 font-semibold">
          {member.weightKg ? `${member.weightKg} kg` : "Not added"}
        </p>
      </div>
      <div className="metric-card">
        <p className="label">BMI</p>
        <p className="mt-2 font-semibold">{member.bmi ?? "Not available"}</p>
      </div>
      <div className="metric-card">
        <p className="label">Date of birth</p>
        <p className="mt-2 font-semibold">{formatDate(member.dob)}</p>
      </div>
      <div className="metric-card">
        <p className="label">Sex</p>
        <p className="mt-2 font-semibold">{sexLabel(member.sex)}</p>
      </div>
    </div>
  );
}

export function FamilyMembersPage() {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true);
    void api
      .listFamilyMembers()
      .then((result) => setMembers(result.familyMembers))
      .catch(setError)
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  if (loading) return <LoadingState label="Loading family members" />;
  if (error) return <ApiErrorState error={error} onRetry={load} />;
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Your care circle</div>
          <h1 className="page-title">Family members</h1>
          <p className="page-lead">
            Manage profiles and health records for people you care for.
          </p>
        </div>
        <Link className="button button-primary" to="/app/family/new">
          Add family member
        </Link>
      </div>
      {members.length ? (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {members.map((member) => (
            <Link
              className="surface block"
              to={`/app/family/${member.id}`}
              key={member.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-semibold break-words">
                    {member.fullName}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {member.relationship}
                  </p>
                </div>
                <span className="status-badge">Family</span>
              </div>
              <div className="mt-5">
                <HealthFields member={member} />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-8">
          <EmptyState
            title="No family members yet"
            message="Add someone you manage appointments for."
          />
        </div>
      )}
    </div>
  );
}

export function FamilyMemberPage() {
  const { familyMemberId } = useParams();
  const [member, setMember] = useState<FamilyMember | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState("old_prescription");
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [openingRecordId, setOpeningRecordId] = useState<string | null>(null);
  const load = () => {
    if (!familyMemberId) return;
    setLoading(true);
    void api
      .getFamilyMember(familyMemberId)
      .then((result) => setMember(result.familyMember))
      .catch(setError)
      .finally(() => setLoading(false));
  };
  useEffect(load, [familyMemberId]);
  if (loading) return <LoadingState label="Loading family member" />;
  if (error) return <ApiErrorState error={error} />;
  if (!member || !familyMemberId)
    return (
      <EmptyState
        title="Family member not found"
        message="This profile is unavailable."
      />
    );
  const upload = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) return;
    setUploading(true);
    setUploaded(false);
    try {
      await api.uploadHealthRecord(file, { type }, familyMemberId);
      setFile(null);
      setUploaded(true);
      load();
    } catch (nextError) {
      setError(nextError);
    } finally {
      setUploading(false);
    }
  };
  return (
    <div>
      <Link className="back-link" to="/app/family">
        Family members
      </Link>
      <div className="mt-6 eyebrow">Family member</div>
      <h1 className="page-title break-words">{member.fullName}</h1>
      <p className="page-lead">{member.relationship}</p>
      <section className="surface mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="section-title">Health profile</h2>
          <Link
            className="button button-quiet"
            to={`/app/family/${member.id}/edit`}
          >
            Edit details
          </Link>
        </div>
        <div className="mt-5">
          <HealthFields member={member} />
        </div>
      </section>
      <section className="surface mt-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="eyebrow">Health records</div>
            <h2 className="section-title">Previous documents</h2>
          </div>
          <span className="status-badge">
            {member.records?.length ?? 0} attached
          </span>
        </div>
        <div className="mt-5 space-y-3">
          {member.records?.map((record) => (
            <div className="action-card" key={record.id}>
              <span className="min-w-0 flex-1">
                <strong>
                  {record.title || record.type.replaceAll("_", " ")}
                </strong>
                <span>
                  {record.originalFilename} · {formatDate(record.documentDate)}
                </span>
              </span>
              <button
                className="button button-quiet"
                type="button"
                disabled={openingRecordId === record.id}
                onClick={async () => { setOpeningRecordId(record.id); try { const blob = await api.openHealthRecord(record.id); window.open(URL.createObjectURL(blob), '_blank', 'noopener,noreferrer'); } catch (nextError) { setError(nextError); } finally { setOpeningRecordId(null); } }}
              >
                {openingRecordId === record.id ? 'Opening…' : 'View'}
              </button>
            </div>
          ))}
        </div>
        <form className="mt-6 border-t border-slate-100 pt-6" onSubmit={upload}>
          <h3 className="font-display text-lg font-semibold">Add record</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">
                Document type
              </span>
              <select
                className="field"
                value={type}
                onChange={(event) => setType(event.target.value)}
              >
                <option value="old_prescription">Old Prescription</option>
                <option value="lab_report">Lab Report</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">
                Choose file
              </span>
              <input
                className="field"
                aria-label="Choose file"
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                capture="environment"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          {uploaded && (
            <div className="mt-4">
              <SuccessMessage>Health record uploaded.</SuccessMessage>
            </div>
          )}
          <Button className="mt-5" disabled={uploading || !file}>
            {uploading ? "Uploading…" : "Upload record"}
          </Button>
        </form>
      </section>
    </div>
  );
}

export function FamilyMemberFormPage() {
  const { familyMemberId } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(familyMemberId);
  const [form, setForm] = useState({
    fullName: "",
    relationship: "",
    heightCm: "",
    weightKg: "",
    dob: "",
    sex: "",
  });
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!familyMemberId) return;
    void api
      .getFamilyMember(familyMemberId)
      .then(({ familyMember }) =>
        setForm({
          fullName: familyMember.fullName,
          relationship: familyMember.relationship,
          heightCm: familyMember.heightCm?.toString() ?? "",
          weightKg: familyMember.weightKg?.toString() ?? "",
          dob: familyMember.dob?.slice(0, 10) ?? "",
          sex: familyMember.sex ?? "",
        }),
      )
      .catch(setError)
      .finally(() => setLoading(false));
  }, [familyMemberId]);
  if (loading) return <LoadingState label="Loading family member" />;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const input = {
        fullName: form.fullName,
        relationship: form.relationship,
        heightCm: form.heightCm ? Number(form.heightCm) : undefined,
        weightKg: form.weightKg ? Number(form.weightKg) : undefined,
        dob: form.dob
          ? new Date(`${form.dob}T00:00:00.000Z`).toISOString()
          : undefined,
        sex: form.sex || undefined,
      };
      const result = editing
        ? await api.updateFamilyMember(familyMemberId!, input)
        : await api.createFamilyMember(input);
      navigate(
        editing
          ? `/app/family/${familyMemberId}`
          : `/app/family/${result.familyMember.id}`,
      );
    } catch (nextError) {
      setError(nextError);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <Link className="back-link" to="/app/family">
        Family members
      </Link>
      <div className="mt-6 eyebrow">
        {editing ? "Edit family member" : "Add family member"}
      </div>
      <h1 className="page-title">Basic details</h1>
      {error ? (
        <div className="mt-5">
          <ApiErrorState error={error} />
        </div>
      ) : null}
      <form
        className="surface mt-8 grid gap-5 sm:grid-cols-2"
        onSubmit={submit}
      >
        <Field
          label="Name"
          value={form.fullName}
          required
          onChange={(event) =>
            setForm({ ...form, fullName: event.target.value })
          }
        />
        <Field
          label="Relationship"
          value={form.relationship}
          required
          onChange={(event) =>
            setForm({ ...form, relationship: event.target.value })
          }
        />
        <Field
          label="Height (cm)"
          type="number"
          min="50"
          max="250"
          value={form.heightCm}
          onChange={(event) =>
            setForm({ ...form, heightCm: event.target.value })
          }
        />
        <Field
          label="Weight (kg)"
          type="number"
          min="2"
          max="500"
          value={form.weightKg}
          onChange={(event) =>
            setForm({ ...form, weightKg: event.target.value })
          }
        />
        <Field
          label="Date of birth"
          type="date"
          value={form.dob}
          onChange={(event) => setForm({ ...form, dob: event.target.value })}
        />
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Sex</span>
          <select
            className="field"
            value={form.sex}
            onChange={(event) => setForm({ ...form, sex: event.target.value })}
          >
            <option value="">Not set</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>
        </label>
        <Button className="sm:col-span-2" disabled={busy}>
          {busy ? "Saving…" : editing ? "Save changes" : "Create family member"}
        </Button>
      </form>
    </div>
  );
}
