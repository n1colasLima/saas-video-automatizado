import json
import sqlite3
import threading
import time
import traceback
from datetime import datetime
from pathlib import Path
from typing import Callable, Optional
from .config import OUTPUT_DIR

DB_PATH = OUTPUT_DIR / "queue.db"
_lock = threading.Lock()
_worker_started = False
_runner: Optional[Callable] = None


def _conn():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False, timeout=30)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with _lock, _conn() as c:
        c.execute("""
        CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            status TEXT NOT NULL,
            progress REAL DEFAULT 0,
            progress_msg TEXT DEFAULT '',
            params_json TEXT NOT NULL,
            result_json TEXT,
            error TEXT,
            video_path TEXT,
            title TEXT
        )
        """)
        c.execute("UPDATE jobs SET status='queued', progress=0, progress_msg='Reagendado' WHERE status='running'")
        c.commit()


def enqueue(params: dict) -> int:
    now = datetime.utcnow().isoformat()
    with _lock, _conn() as c:
        cur = c.execute(
            "INSERT INTO jobs(created_at, updated_at, status, params_json) VALUES(?,?,?,?)",
            (now, now, "queued", json.dumps(params, ensure_ascii=False)),
        )
        c.commit()
        return cur.lastrowid


def update_progress(job_id: int, pct: float, msg: str):
    now = datetime.utcnow().isoformat()
    with _lock, _conn() as c:
        c.execute(
            "UPDATE jobs SET progress=?, progress_msg=?, updated_at=? WHERE id=?",
            (pct, msg, now, job_id),
        )
        c.commit()


def set_status(job_id: int, status: str, **fields):
    now = datetime.utcnow().isoformat()
    cols = ["status=?", "updated_at=?"]
    vals = [status, now]
    for k, v in fields.items():
        cols.append(f"{k}=?")
        vals.append(v)
    vals.append(job_id)
    with _lock, _conn() as c:
        c.execute(f"UPDATE jobs SET {', '.join(cols)} WHERE id=?", vals)
        c.commit()


def list_jobs(limit: int = 50) -> list[dict]:
    with _lock, _conn() as c:
        rows = c.execute(
            "SELECT * FROM jobs ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
        return [dict(r) for r in rows]


def get_job(job_id: int) -> Optional[dict]:
    with _lock, _conn() as c:
        row = c.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
        return dict(row) if row else None


def get_metrics() -> dict:
    with _lock, _conn() as c:
        rows = c.execute(
            "SELECT status, COUNT(*) as n FROM jobs GROUP BY status"
        ).fetchall()
        counts = {r["status"]: r["n"] for r in rows}
        total = sum(counts.values())
        return {
            "total": total,
            "queued": counts.get("queued", 0),
            "running": counts.get("running", 0),
            "done": counts.get("done", 0),
            "failed": counts.get("failed", 0),
        }


def list_completed_videos(limit: int = 20) -> list[dict]:
    with _lock, _conn() as c:
        rows = c.execute(
            "SELECT * FROM jobs WHERE status='done' AND video_path IS NOT NULL ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]


def _pop_next() -> Optional[dict]:
    with _lock, _conn() as c:
        row = c.execute(
            "SELECT * FROM jobs WHERE status='queued' ORDER BY id ASC LIMIT 1"
        ).fetchone()
        if not row:
            return None
        c.execute("UPDATE jobs SET status='running', updated_at=? WHERE id=?",
                  (datetime.utcnow().isoformat(), row["id"]))
        c.commit()
        return dict(row)


def _worker_loop():
    while True:
        try:
            job = _pop_next()
            if not job:
                time.sleep(1.5)
                continue
            job_id = job["id"]
            params = json.loads(job["params_json"])

            def report(msg, pct):
                update_progress(job_id, pct, msg)

            try:
                if _runner is None:
                    raise RuntimeError("Runner não registrado")
                result = _runner(params=params, progress=report)
                set_status(
                    job_id, "done",
                    progress=100, progress_msg="Concluído",
                    result_json=json.dumps(result, ensure_ascii=False),
                    video_path=result.get("video_path"),
                    title=result.get("title"),
                )
            except Exception as e:
                tb = traceback.format_exc()
                set_status(job_id, "failed", error=f"{e}\n{tb}")
        except Exception:
            traceback.print_exc()
            time.sleep(2)


def start_worker(runner: Callable):
    global _worker_started, _runner
    _runner = runner
    if _worker_started:
        return
    init_db()
    t = threading.Thread(target=_worker_loop, daemon=True, name="video-auto-worker")
    t.start()
    _worker_started = True
