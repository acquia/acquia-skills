"""Sync acli/* SKILL.md docs with the current ACLI command surface.

Driven by the acquia-skills receiver workflow (.github/workflows/sync-skills.yml),
which is triggered by a repository_dispatch from acquia/cli on each ACLI release.

For each mapped acli skill this script:
  1. Filters `acli list --format=json` output down to the skill's namespaces.
  2. Skips the skill if the hash of that command surface matches the last-synced
     hash (no command change -> no Claude call, no churn), unless --force.
  3. Asks Claude to return a corrected SKILL.md reflecting the current commands.
  4. Validates the result (reusing validate_manifests.validate_skill_file) and
     writes it only if it changed and still passes validation.

The whole run is first gated by a version check: if acli_version and spec_version
match the last-synced state (and --force is not set) the script exits early
without any API calls.

State lives in one small file under .github/:
  - skills-sync-state.json : last-synced acli_version / spec_version / last_run,
    plus skill_hashes (a short SHA-256 per skill of its command surface, used to
    skip skills whose commands did not change).

The Anthropic API key is read from the ANTHROPIC_API_KEY environment variable only
(never a CLI arg, never logged). See the receiver workflow for how it is injected
from the repo secret.
"""

import argparse
import hashlib
import json
import os
import sys

# Reuse the canonical SKILL.md contract instead of reimplementing it.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from validate_manifests import validate_skill_file  # noqa: E402

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_SKILLS_DIR = os.path.join(_REPO_ROOT, "skills", "acli")
_STATE_FILE = os.path.join(_REPO_ROOT, ".github", "skills-sync-state.json")

MODEL = "claude-sonnet-5"
FALLBACK_MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 64000

# Length guardrails — SKILL.md files are quick-reference docs, not exhaustive API
# docs. Today's processed files run 133-410 lines; a result that blows past these
# is bloat and is rejected (reverted), never committed.
MAX_SKILL_LINES = 500  # absolute ceiling (comfortably above the current max of 410)
MAX_GROWTH_FACTOR = 1.5  # reject if the file grows to >1.5x its previous length
MIN_GROWTH_FLOOR_LINES = 60  # ...but always allow growth up to this many lines
# (so small files can still gain a few commands without tripping the ratio)

# Skill directory -> selector describing which acli commands belong to it.
#   {"prefixes": [...]}                 match commands whose name starts with any prefix
#   {"prefixes": [...],                 additionally match commands under keyword_scope
#    "keyword_scope": "...",            whose name contains any of the keywords
#    "keywords": [...]}                 (used for MEO skills whose CDN/SSO rules live
#                                        under the shared api:v3:subscriptions: group)
#   None                                skip (conceptual/style skills, not command-driven)
#
# ACE (api:*, V2) skills and their top-level namespaces:
SKILL_COMMAND_MAP = {
    "getting-started": {"prefixes": ["auth:", "self:"]},
    "application-management": {"prefixes": ["app:", "archive:"]},
    "environment-management": {"prefixes": ["env:"]},
    "ide-management": {"prefixes": ["ide:"]},
    "pull-push": {"prefixes": ["pull:", "push:"]},
    "remote-access": {"prefixes": ["remote:"]},
    "ssh-key-management": {"prefixes": ["ssh-key:"]},
    "codestudio": {"prefixes": ["codestudio:"]},
    "scripting": None,  # style guide, not command-specific
    "troubleshooting": None,  # debugging patterns, not command-specific
    # MEO (api:v3:*, V3) skills. Most map cleanly to a command group; a few share
    # groups (environments, subscriptions) and use keyword augmentation.
    "meo-overview": None,  # ACE-vs-MEO concepts, not command-specific
    "meo-sites": {"prefixes": ["api:v3:sites:", "api:v3:sites "]},
    "meo-codebases": {"prefixes": ["api:v3:codebases:", "api:v3:codebases "]},
    "meo-environments": {"prefixes": ["api:v3:environments:", "api:v3:environments "]},
    "meo-site-instances": {
        "prefixes": ["api:v3:site-instances:", "api:v3:site-instances "]
    },
    "meo-deployments": {"prefixes": ["api:v3:deployments:", "api:v3:deployments "]},
    "meo-cdn-security": {
        "prefixes": ["api:v3:failover-groups:", "api:v3:failover-groups "],
        # subscription-scoped CDN/security rules live under api:v3:subscriptions:*
        "keyword_scope": "api:v3:subscriptions:",
        "keywords": ["cdn", "custom-rule", "ip-rule", "rate-limiting", "failover", "domain"],
    },
    "meo-identity-access": {
        "prefixes": [
            "api:v3:identity-providers:",
            "api:v3:identity-providers ",
            "api:v3:sso-domains:",
            "api:v3:sso-domains ",
        ],
        # subscription-scoped SSO/identity commands
        "keyword_scope": "api:v3:subscriptions:",
        "keywords": ["sso", "identity-provider"],
    },
}


def load_json(path, default):
    """Read a JSON file, returning default if it is missing."""
    try:
        with open(path) as f:
            return json.load(f)
    except FileNotFoundError:
        return default


def write_json(path, data):
    """Write data as pretty JSON with a trailing newline (stable diffs)."""
    with open(path, "w") as f:
        json.dump(data, f, indent=2, sort_keys=True)
        f.write("\n")


def load_commands(path):
    """Load `acli list --format=json` output and normalize to a name->command map.

    Symfony's JSON descriptor emits {"commands": [{"name": ..., "usage": [...],
    "description": ...}, ...]}. We keep only the fields that describe the command
    surface and feed them to Claude.

    `acli` may prepend a human-readable notice (e.g. an update-available banner)
    to stdout before the JSON, so we skip to the first '{' rather than assuming
    the payload starts at byte 0.
    """
    with open(path) as f:
        raw = f.read()
    start = raw.find("{")
    if start == -1:
        raise json.JSONDecodeError("no JSON object found in acli output", raw, 0)
    data = json.loads(raw[start:])
    commands = {}
    for cmd in data.get("commands", []):
        name = cmd.get("name")
        if not name:
            continue
        commands[name] = {
            "name": name,
            "description": cmd.get("description", ""),
            "usage": cmd.get("usage", []),
            "definition": cmd.get("definition", {}),
        }
    return commands


def select_commands(commands, selector):
    """Return the sorted subset of commands matching a skill's selector."""
    if not selector:
        return []
    prefixes = selector.get("prefixes", [])
    keywords = selector.get("keywords")
    keyword_scope = selector.get("keyword_scope")
    selected = []
    for name, cmd in commands.items():
        if any(name.startswith(p.rstrip()) or name == p.rstrip() for p in prefixes):
            selected.append(cmd)
        elif (
            keywords
            and keyword_scope
            and name.startswith(keyword_scope)
            and any(kw in name for kw in keywords)
        ):
            selected.append(cmd)
    return sorted(selected, key=lambda c: c["name"])


def command_surface_hash(selected):
    """Short, stable SHA-256 of a skill's command surface for change detection."""
    payload = json.dumps(selected, sort_keys=True)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


SYSTEM_PROMPT = """\
You maintain Agent Skills (SKILL.md files) for the Acquia CLI (acli).

You are given the current contents of one SKILL.md file and the JSON definitions
of the acli commands that belong to that skill (name, description, usage, and
argument/option definitions).

Your job: return the COMPLETE, corrected SKILL.md so that its documented commands,
flags, arguments, and examples match the provided command definitions exactly.

Rules:
- Add commands that exist in the JSON but are missing from the doc.
- Remove commands/flags from the doc that no longer exist in the JSON.
- Fix changed flags, arguments, and option names.
- NEVER invent commands, flags, or behavior that are not in the JSON.
- Preserve the file's existing structure, YAML frontmatter, headings, tone, and
  prose wherever the commands have not changed.
- Keep the frontmatter `name` identical to the current file (it must match the
  directory name).
- If nothing needs to change, return the file byte-for-byte identical.
- Output ONLY the raw file contents. No markdown code fences, no commentary,
  no preamble.

Be concise. This is a quick-reference skill, not exhaustive API documentation:
- Keep it SHORT and meaningful. Match the length and density of the existing
  file — do NOT balloon it to hundreds of lines.
- One tight entry per command: name, a one-line purpose, and its key flags/args.
  A single representative example only where it genuinely aids use.
- Do NOT add filler: no long intros, no restating the same option across every
  command, no exhaustive enumeration of every edge case, no duplicated examples.
- Group related commands compactly (e.g. a table) rather than a verbose section
  per command.
- If the file is already concise and complete, make only the minimal edits the
  command changes require — do not rewrite or expand it.
"""


def build_user_prompt(skill, current_content, selected_commands):
    return (
        f"Skill: acli/{skill}\n\n"
        f"=== CURRENT SKILL.md ===\n{current_content}\n\n"
        f"=== ACLI COMMANDS FOR THIS SKILL (JSON) ===\n"
        f"{json.dumps(selected_commands, indent=2)}\n"
    )


def check_length(original, proposed):
    """Return an error string if the proposed file is bloated, else None.

    Guards against the model expanding a concise quick-reference skill into
    hundreds of lines. Rejects on either an absolute line ceiling or excessive
    growth relative to the original.
    """
    orig_lines = original.count("\n") + 1
    new_lines = proposed.count("\n") + 1
    if new_lines > MAX_SKILL_LINES:
        return (
            f"proposed file is {new_lines} lines, exceeds the {MAX_SKILL_LINES}-line "
            "ceiling for a quick-reference skill"
        )
    allowed = max(int(orig_lines * MAX_GROWTH_FACTOR), orig_lines + MIN_GROWTH_FLOOR_LINES)
    if new_lines > allowed:
        return (
            f"proposed file grew from {orig_lines} to {new_lines} lines "
            f"(> allowed {allowed}); likely bloat"
        )
    return None


def strip_code_fences(text):
    """Defensively remove a wrapping ``` fence if the model added one."""
    stripped = text.strip()
    if stripped.startswith("```"):
        lines = stripped.splitlines()
        # drop opening fence (``` or ```markdown)
        lines = lines[1:]
        # drop closing fence if present
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        return "\n".join(lines) + "\n"
    return text


def call_claude(client, model, current_content, selected_commands, skill):
    """Ask Claude for the corrected SKILL.md. Returns the proposed content string."""
    with client.messages.stream(
        model=model,
        max_tokens=MAX_TOKENS,
        thinking={"type": "adaptive"},
        output_config={"effort": "high"},
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": build_user_prompt(skill, current_content, selected_commands),
            }
        ],
    ) as stream:
        message = stream.get_final_message()
    text = "".join(
        block.text for block in message.content if getattr(block, "type", None) == "text"
    )
    return strip_code_fences(text)


def make_client():
    """Build the Anthropic client. Key comes from the environment only."""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print(
            "ERROR: ANTHROPIC_API_KEY is not set in the environment.", file=sys.stderr
        )
        sys.exit(2)
    from anthropic import Anthropic  # imported lazily so --help / early-exit need no dep

    return Anthropic()


def sync_skill(client, skill, selector, commands, prior_hashes, force):
    """Process one skill. Returns (status, command_hash).

    status is one of: "skipped" (not command-driven), "skipped-unchanged"
    (commands identical to last sync), "unchanged" (Claude proposed no change),
    "updated", "error". command_hash is the current command-surface hash to store
    in state (None when the skill is not command-driven).
    """
    if selector is None:
        return "skipped", None

    skill_path = os.path.join(_SKILLS_DIR, skill, "SKILL.md")
    if not os.path.exists(skill_path):
        print(f"WARN: {skill}: SKILL.md not found, skipping", file=sys.stderr)
        return "error", None

    selected = select_commands(commands, selector)
    if not selected:
        print(
            f"WARN: {skill}: no matching commands in acli list output; skipping",
            file=sys.stderr,
        )
        return "error", None

    current_hash = command_surface_hash(selected)

    # Skip the Claude call when this skill's commands are unchanged since the last
    # sync — avoids both API cost and cosmetic churn.
    if not force and prior_hashes.get(skill) == current_hash:
        print(f"  {skill}: command surface unchanged, skipping Claude call")
        return "skipped-unchanged", current_hash

    with open(skill_path) as f:
        original = f.read()

    # Try the primary model, fall back once if it is unavailable (404/400 on model id).
    try:
        proposed = call_claude(client, MODEL, original, selected, skill)
    except Exception as primary_err:  # noqa: BLE001 - isolate per skill
        try:
            from anthropic import NotFoundError

            model_missing = isinstance(primary_err, NotFoundError)
        except Exception:  # noqa: BLE001
            model_missing = False
        if not model_missing:
            print(f"ERROR: {skill}: Claude API call failed: {primary_err}", file=sys.stderr)
            return "error", current_hash
        print(
            f"  {skill}: {MODEL} unavailable, retrying with {FALLBACK_MODEL}",
            file=sys.stderr,
        )
        try:
            proposed = call_claude(client, FALLBACK_MODEL, original, selected, skill)
        except Exception as fallback_err:  # noqa: BLE001
            print(
                f"ERROR: {skill}: Claude API call failed: {fallback_err}",
                file=sys.stderr,
            )
            return "error", current_hash

    if proposed.strip() == original.strip():
        print(f"  {skill}: no changes proposed")
        return "unchanged", current_hash

    # Reject bloat before writing — keep skills short and meaningful.
    length_error = check_length(original, proposed)
    if length_error:
        print(f"ERROR: {skill}: discarded change, {length_error}", file=sys.stderr)
        return "error", current_hash

    # Write, then validate. Revert if the result violates the SKILL.md contract.
    with open(skill_path, "w") as f:
        f.write(proposed)
    errors = validate_skill_file(skill_path)
    if errors:
        with open(skill_path, "w") as f:
            f.write(original)
        for e in errors:
            print(f"ERROR: {skill}: discarded change, validation failed: {e}", file=sys.stderr)
        return "error", current_hash

    print(f"  {skill}: updated")
    return "updated", current_hash


def main():
    parser = argparse.ArgumentParser(
        description="Sync acli SKILL.md docs with the current ACLI command surface."
    )
    parser.add_argument("--acli-version", required=True, help="ACLI release version being synced")
    parser.add_argument("--spec-version", required=True, help="acquia-spec.version at that release")
    parser.add_argument(
        "--commands",
        default="/tmp/acli-commands.json",
        help="Path to `acli list --format=json` output (default: /tmp/acli-commands.json)",
    )
    parser.add_argument(
        "--last-run",
        default=None,
        help="Date string to record in the state file (e.g. from `date -u +%%F`)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Run the sync even if acli_version and spec_version are unchanged",
    )
    args = parser.parse_args()

    state = load_json(_STATE_FILE, {"acli_version": "", "spec_version": "", "last_run": None})

    # AC1: exit early with no API calls when nothing changed.
    if (
        not args.force
        and state.get("acli_version") == args.acli_version
        and state.get("spec_version") == args.spec_version
    ):
        print(
            f"Already synced acli {args.acli_version} / spec {args.spec_version[:12]}; "
            "nothing to do (use --force to override)."
        )
        return 0

    try:
        commands = load_commands(args.commands)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"ERROR: could not read commands from {args.commands}: {e}", file=sys.stderr)
        return 2
    print(f"Loaded {len(commands)} acli commands from {args.commands}")

    client = make_client()

    prior_hashes = state.get("skill_hashes", {})
    new_hashes = dict(prior_hashes)  # start from prior; overwrite per outcome
    counts = {"updated": 0, "unchanged": 0, "skipped-unchanged": 0, "skipped": 0, "error": 0}
    attempted = 0

    for skill, selector in SKILL_COMMAND_MAP.items():
        status, command_hash = sync_skill(
            client, skill, selector, commands, prior_hashes, args.force
        )
        counts[status] += 1
        if selector is None:
            continue
        attempted += 1
        # Record the current hash only when the skill is in a good state, so an
        # errored skill keeps its old hash and gets retried next run.
        if status in ("updated", "unchanged", "skipped-unchanged") and command_hash:
            new_hashes[skill] = command_hash

    print(
        "Done: "
        f"{counts['updated']} updated, {counts['unchanged']} unchanged, "
        f"{counts['skipped-unchanged']} skipped (no command change), "
        f"{counts['error']} errors."
    )

    # Fail only if every command-driven skill we attempted errored — a partial
    # sync should still let the workflow open a PR (AC3).
    command_driven = sum(1 for s in SKILL_COMMAND_MAP.values() if s is not None)
    if attempted > 0 and counts["error"] == command_driven:
        print("ERROR: all skills failed; not updating state.", file=sys.stderr)
        return 1

    # Persist the per-skill hashes so unchanged skills are skipped next run.
    state["skill_hashes"] = new_hashes

    # Only mark the release fully synced (advance acli_version/spec_version) when
    # every skill succeeded. Advancing on a partial failure would trip the AC1
    # early-exit on the next run with the same versions, so the failed skills
    # would never be retried without --force. On partial success we still record
    # last_run and the successful hashes, but leave the versions unadvanced so the
    # next release run reprocesses the stragglers.
    state["last_run"] = args.last_run
    if counts["error"] == 0:
        state["acli_version"] = args.acli_version
        state["spec_version"] = args.spec_version
        write_json(_STATE_FILE, state)
        print(f"State updated: acli {args.acli_version}, spec {args.spec_version[:12]}.")
    else:
        write_json(_STATE_FILE, state)
        print(
            f"Partial sync ({counts['error']} skill(s) failed): versions NOT advanced "
            "so failed skills retry on the next run. Use --force to retry now.",
            file=sys.stderr,
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
