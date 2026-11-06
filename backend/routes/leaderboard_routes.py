from typing import Optional

from fastapi import APIRouter, Depends, Query

from backend.auth import get_current_student
from backend.database import get_db, release_db

router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])

LEADERBOARD_SQL = """
WITH best AS (
  SELECT student_id, node_id, MAX(score) AS best_score
  FROM history_logs
  WHERE kind = 'quiz' AND score IS NOT NULL
    AND ($3::text IS NULL OR node_id = $3)
  GROUP BY student_id, node_id
),
totals AS (
  SELECT student_id, SUM(best_score) AS points, COUNT(*) AS topics_done
  FROM best
  GROUP BY student_id
),
ranked AS (
  SELECT t.student_id, s.name, t.points, t.topics_done,
         RANK() OVER (ORDER BY t.points DESC) AS rank,
         COUNT(*) OVER () AS total_ranked
  FROM totals t
  JOIN students s ON s.id = t.student_id
)
SELECT * FROM ranked
WHERE rank <= $1 OR student_id = $2
ORDER BY rank, name
"""


@router.get("")
async def get_leaderboard(
    limit: int = Query(10, ge=1, le=50),
    node_id: Optional[str] = Query(None),
    student=Depends(get_current_student),
):
    """Overall board (sum of best score per topic), or one topic if node_id is given."""
    conn = await get_db()
    try:
        rows = await conn.fetch(LEADERBOARD_SQL, limit, student["id"], node_id)
    finally:
        await release_db(conn)

    entries, me = [], None
    for r in rows:
        item = {
            "rank": r["rank"],
            "name": r["name"],
            "points": r["points"],
            "topics_done": r["topics_done"],
            "is_me": r["student_id"] == student["id"],
        }
        if item["is_me"]:
            me = item
        if r["rank"] <= limit:
            entries.append(item)

    return {
        "node_id": node_id,
        "entries": entries,
        "me": me,
        "total_ranked": rows[0]["total_ranked"] if rows else 0,
    }