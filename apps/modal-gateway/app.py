"""craft-cloud-runs — Modal fallback gateway (PRD docs/cloud-runs-prd.md, phase G4).

Mirrors the Cloudflare gateway HTTP contract exactly so CloudflareComputerProvider
works against it unchanged (subclassed as ModalProvider in packages/cloud-runner):

  POST   /runs                        create run (idempotent by spec.id)
  GET    /runs/{id}/status
  DELETE /runs/{id}                   cancel (subtask-granular; driver honors the flag)
  GET    /runs/{id}/artifacts         list
  GET    /runs/{id}/artifacts/{path}  fetch

Execution model: the web endpoint spawns the driver function per run; the
driver walks subtasks sequentially, spawning one Modal Sandbox per subtask
with a baked-in runner that calls the LLM gateway. State lives in
modal.Dict; artifacts on a modal.Volume; per-subtask done.marker files
give the same crash-resume / cancel-wins semantics as the RunDO alarm chain.

Secrets (modal secret "craft-cloud-runs"):
  CLOUD_RUNS_TOKEN, LLM_BASE_URL, LLM_API_KEY, LLM_MODEL
"""

import hmac
import json
import os
import time
from pathlib import Path

import modal

app = modal.App("craft-cloud-runs")
volume = modal.Volume.from_name("craft-cloud-runs-data", create_if_missing=True)
state = modal.Dict.from_name("craft-cloud-runs-state", create_if_missing=True)
secret = modal.Secret.from_name("craft-cloud-runs")

runner_image = modal.Image.debian_slim().pip_install("httpx==0.28.1")
DATA_ROOT = Path("/data/runs")

DEFAULT_WALL_CLOCK_SEC = 1800
SUBTASK_TIMEOUT_SEC = 300

RUNNER_SOURCE = r'''
import json, os, sys, time
from pathlib import Path
import httpx

workspace = Path(sys.argv[1])
config = json.loads((workspace / ".craft-run" / "config.json").read_text())
subtask = config["subtask"]
base = config["baseUrl"].rstrip("/")
model = config["model"]
key = config.get("apiKey") or ""
headers = {"content-type": "application/json"}
if key:
    headers["authorization"] = f"Bearer {key}"

body = {
    "model": model,
    "stream": False,
    "messages": [
        {"role": "system", "content": "You are a research sub-agent. Produce a thorough, source-aware markdown brief for the given subtask."},
        {"role": "user", "content": subtask["prompt"]},
    ],
}
resp = httpx.post(f"{base}/chat/completions", headers=headers, json=body, timeout=240)
if resp.status_code != 200:
    print(f"LLM gateway error {resp.status_code}: {resp.text[:500]}", file=sys.stderr)
    sys.exit(1)

if "text/event-stream" in resp.headers.get("content-type", ""):
    content = "".join(
        json.loads(line[6:])["choices"][0]["delta"].get("content", "")
        for line in resp.text.splitlines()
        if line.startswith("data: ") and line != "data: [DONE]"
    )
    usage = None
else:
    payload = resp.json()
    content = payload["choices"][0]["message"]["content"]
    usage = payload.get("usage")

out = workspace / "artifacts" / subtask["id"]
out.mkdir(parents=True, exist_ok=True)
(out / "answer.md").write_text(
    f"# {subtask.get('title') or subtask['id']}\n\n## Prompt\n\n{subtask['prompt']}\n\n## Brief\n\n{content}\n"
)
(out / "done.marker").write_text(time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()) + "\n")
usage_dir = workspace / "artifacts" / "_usage"
usage_dir.mkdir(parents=True, exist_ok=True)
(usage_dir / f"{subtask['id']}.json").write_text(
    json.dumps(usage or {"note": "usage unavailable (SSE fallback)"}) + "\n"
)
print(f"subtask {subtask['id']} done")
'''


def _run_dir(run_id: str) -> Path:
    return DATA_ROOT / run_id


def _state_key(run_id: str) -> str:
    return f"run:{run_id}"


def _cancel_key(run_id: str) -> str:
    return f"cancel:{run_id}"


def _authorized(headers) -> bool:
    want = os.environ.get("CLOUD_RUNS_TOKEN", "")
    got = (headers.get("authorization") or "").removeprefix("Bearer ")
    return bool(want) and hmac.compare_digest(got, want)


@app.function(volumes={"/data": volume}, secrets=[secret], timeout=3600)
def driver(spec: dict):
    run_id = spec["id"]
    wall_clock = spec.get("limits", {}).get("maxWallClockSec") or DEFAULT_WALL_CLOCK_SEC
    deadline = time.monotonic() + wall_clock
    workspace = _run_dir(run_id)
    workspace.mkdir(parents=True, exist_ok=True)
    (workspace / "spec.json").write_text(json.dumps(spec))

    def set_status(**fields):
        cur = dict(state.get(_state_key(run_id), {}))
        cur.update(fields)
        state[_state_key(run_id)] = cur

    set_status(id=run_id, state="running", startedAt=int(time.time() * 1000))
    subtasks = spec["subtasks"]
    completed = 0

    for subtask in subtasks:
        if state.get(_cancel_key(run_id)):
            set_status(state="cancelled", failureReason="cancelled", finishedAt=int(time.time() * 1000))
            return
        if time.monotonic() > deadline:
            set_status(
                state="failed",
                failureReason="budget_exceeded",
                failureDetail=f"wall-clock budget {wall_clock}s exceeded",
                finishedAt=int(time.time() * 1000),
            )
            return
        volume.reload()  # sandbox-side writes land on the shared volume asynchronously
        marker = workspace / "artifacts" / subtask["id"] / "done.marker"
        if marker.exists():  # crash-resume: skip finished subtasks
            completed += 1
            continue

        (workspace / ".craft-run").mkdir(exist_ok=True)
        (workspace / ".craft-run" / "config.json").write_text(json.dumps({
            "baseUrl": os.environ["LLM_BASE_URL"],
            "apiKey": os.environ.get("LLM_API_KEY", ""),
            "model": spec.get("model", {}).get("modelId") or os.environ.get("LLM_MODEL", "kimi-K3"),
            "subtask": subtask,
        }))
        volume.commit()

        try:
            sb = modal.Sandbox.create(
                "python", "-c", RUNNER_SOURCE, str(workspace),
                app=app,
                image=runner_image,
                volumes={"/data": volume},
                timeout=SUBTASK_TIMEOUT_SEC + 60,
            )
            sb.wait()
            exit_code = sb.returncode
            stderr = sb.stderr.read() if exit_code else ""
        except Exception as exc:
            set_status(state="failed", failureReason="runner_error", failureDetail=str(exc)[:1000],
                       finishedAt=int(time.time() * 1000))
            return

        if state.get(_cancel_key(run_id)):
            set_status(state="cancelled", failureReason="cancelled", finishedAt=int(time.time() * 1000))
            return
        volume.reload()  # sandbox writes land asynchronously on the shared volume
        if exit_code != 0 or not marker.exists():
            set_status(
                state="failed",
                failureReason="runner_error",
                failureDetail=f"subtask {subtask['id']} exit {exit_code}: {stderr[-1000:]}",
                finishedAt=int(time.time() * 1000),
            )
            return
        completed += 1
        usage_file = workspace / "artifacts" / "_usage" / f"{subtask['id']}.json"
        if usage_file.exists():
            try:
                usage = json.loads(usage_file.read_text())
                cur = state.get(_state_key(run_id), {}).get("usage", {"promptTokens": 0, "completionTokens": 0})
                cur["promptTokens"] += usage.get("prompt_tokens", 0)
                cur["completionTokens"] += usage.get("completion_tokens", 0)
                set_status(usage=cur)
            except (json.JSONDecodeError, KeyError):
                pass
        set_status(progress={"completed": completed, "total": len(subtasks)})

    volume.commit()
    set_status(state="done", finishedAt=int(time.time() * 1000),
               progress={"completed": len(subtasks), "total": len(subtasks)})


# ---------------------------------------------------------------------------
# HTTP surface (same contract as the Cloudflare gateway). One ASGI app so
# route paths match exactly (/runs/{id}/status etc.) — provider-agnostic.
# ---------------------------------------------------------------------------

web_image = modal.Image.debian_slim().pip_install("fastapi[standard]==0.115.*")


@app.function(volumes={"/data": volume}, secrets=[secret], image=web_image)
@modal.concurrent(max_inputs=100)
@modal.asgi_app()
def gateway_api():
    import fastapi
    from fastapi import Depends, Header, Response

    api = fastapi.FastAPI(title="craft-cloud-runs")

    def auth(authorization: str = Header(default="")) -> None:
        if not _authorized({"authorization": authorization}):
            raise fastapi.HTTPException(status_code=401, detail="unauthorized")

    @api.post("/runs")
    async def post_run(spec: dict, _=Depends(auth)):
        run_id = spec.get("id")
        if not run_id or ".." in run_id or "/" in run_id or not spec.get("subtasks"):
            raise fastapi.HTTPException(status_code=400, detail="invalid_spec")
        key = _state_key(run_id)
        existing = state.get(key)
        if existing:
            return {"id": run_id, "createdAt": existing.get("createdAt", int(time.time() * 1000))}
        now = int(time.time() * 1000)
        state[key] = {"id": run_id, "state": "queued", "createdAt": now}
        driver.spawn(spec)
        return {"id": run_id, "createdAt": now}

    @api.get("/runs/{run_id}/status")
    async def status_of(run_id: str, _=Depends(auth)):
        cur = state.get(_state_key(run_id))
        if not cur:
            raise fastapi.HTTPException(status_code=404, detail="run not found")
        return cur

    @api.delete("/runs/{run_id}")
    async def delete_run(run_id: str, _=Depends(auth)):
        cur = state.get(_state_key(run_id))
        if not cur:
            raise fastapi.HTTPException(status_code=404, detail="run not found")
        if cur.get("state") in ("queued", "running"):
            state[_cancel_key(run_id)] = True
            state[_state_key(run_id)] = {
                **cur, "state": "cancelled", "failureReason": "cancelled",
                "finishedAt": int(time.time() * 1000),
            }
        return {"ok": True}

    @api.get("/runs/{run_id}/artifacts")
    async def artifacts_of(run_id: str, _=Depends(auth)):
        if not state.get(_state_key(run_id)):
            raise fastapi.HTTPException(status_code=404, detail="run not found")
        volume.reload()
        root = _run_dir(run_id) / "artifacts"
        out = []
        if root.exists():
            for path in sorted(root.rglob("*")):
                if path.is_file():
                    out.append({"path": str(path.relative_to(root)), "size": path.stat().st_size})
        return out

    @api.get("/runs/{run_id}/artifacts/{artifact_path:path}")
    async def artifact_file(run_id: str, artifact_path: str, _=Depends(auth)):
        if not state.get(_state_key(run_id)):
            raise fastapi.HTTPException(status_code=404, detail="run not found")
        if artifact_path.startswith(("/", "\\")) or ".." in artifact_path.split("/"):
            raise fastapi.HTTPException(status_code=400, detail="unsafe artifact path")
        volume.reload()
        target = (_run_dir(run_id) / "artifacts" / artifact_path).resolve()
        if not str(target).startswith(str((_run_dir(run_id) / "artifacts").resolve())) or not target.is_file():
            raise fastapi.HTTPException(status_code=404, detail="artifact not found")
        return Response(content=target.read_bytes(), media_type="application/octet-stream")

    @api.get("/healthz")
    async def healthz():
        return {"ok": True}

    return api
