import { useMemo, useState } from "react";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useGithubBranches, useGithubRepos } from "@/hooks/use-connectors";

interface GitHubRepoPickerProps {
  connectorId: string;
  initialRepo?: string;
  initialBranch?: string;
  onSelect: (repo: string, branch: string) => void;
  onCancel?: () => void;
  saving?: boolean;
}

export default function GitHubRepoPicker({
  connectorId,
  initialRepo,
  initialBranch,
  onSelect,
  onCancel,
  saving
}: GitHubRepoPickerProps) {
  const [search, setSearch] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<string | null>(initialRepo ?? null);
  const [selectedBranch, setSelectedBranch] = useState(initialBranch ?? "");

  const reposQuery = useGithubRepos(connectorId);
  const branchesQuery = useGithubBranches(connectorId, selectedRepo ?? undefined);

  const repos = reposQuery.data?.data ?? [];
  const branches = branchesQuery.data?.data ?? [];

  const filtered = useMemo(
    () => (search ? repos.filter((r) => r.full_name.toLowerCase().includes(search.toLowerCase())) : repos),
    [repos, search]
  );

  const handleSelectRepo = (repo: (typeof repos)[number]) => {
    setSelectedRepo(repo.full_name);
    setSelectedBranch(repo.default_branch);
  };

  const handleConfirm = () => {
    if (!selectedRepo) return;
    const branch = selectedBranch || repos.find((r) => r.full_name === selectedRepo)?.default_branch || "main";
    onSelect(selectedRepo, branch);
  };

  // Update selectedBranch when branches load if it hasn't been manually changed
  const repoMeta = repos.find((r) => r.full_name === selectedRepo);
  if (branches.length > 0 && selectedBranch === repoMeta?.default_branch && !branches.includes(selectedBranch)) {
    setSelectedBranch(branches[0]);
  }

  if (reposQuery.isLoading) {
    return <LoadingSpinner label="Loading your repositories..." />;
  }

  if (reposQuery.isError) {
    return <p className="text-[13px] text-red-700">Failed to load repositories. Please try again.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-[var(--ink-soft)]">
        Choose the repository where the agent will create feature branches and pull requests.
      </p>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-lg border border-[var(--line)] px-3 py-2"
        placeholder="Search repositories..."
      />

      <div className="max-h-72 space-y-1 overflow-y-auto">
        {filtered.map((repo) => (
          <button
            key={repo.full_name}
            className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
              selectedRepo === repo.full_name
                ? "border-[var(--accent)] bg-blue-50"
                : "border-[var(--line)] hover:bg-[var(--accent-soft)]"
            }`}
            onClick={() => handleSelectRepo(repo)}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{repo.full_name}</span>
              <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] uppercase text-[var(--ink-soft)]">
                {repo.private ? "private" : "public"}
              </span>
            </div>
            {repo.description ? (
              <p className="mt-0.5 text-[11px] text-[var(--ink-soft)]">{repo.description}</p>
            ) : null}
          </button>
        ))}
        {filtered.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-[var(--ink-soft)]">No repositories found.</p>
        ) : null}
      </div>

      {selectedRepo ? (
        <div className="space-y-3 rounded-lg border border-[var(--line)] p-3">
          <div>
            <label className="text-[13px] font-medium">Selected Repository</label>
            <p className="text-[13px]">{selectedRepo}</p>
          </div>

          <div>
            <label className="text-[13px] font-medium">Base Branch</label>
            {branchesQuery.isLoading ? (
              <LoadingSpinner label="Loading branches..." />
            ) : (
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--line)] px-3 py-2"
              >
                {branches.map((branch) => (
                  <option key={branch} value={branch}>
                    {branch}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex gap-2">
            <button
              className="rounded-lg bg-[var(--ink)] px-3.5 py-2 text-[13px] font-medium text-white hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
              disabled={saving}
              onClick={handleConfirm}
            >
              {saving ? "Saving..." : "Connect Repository"}
            </button>
            {onCancel ? (
              <button
                className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[13px] font-medium hover:bg-[var(--accent-soft)] transition-colors"
                onClick={onCancel}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
