-- Playground tables. Run in the Supabase SQL editor (after the base schema, which defines students).

CREATE TABLE IF NOT EXISTS playground_problems (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('easy','medium','hard')),
    style TEXT NOT NULL CHECK (style IN ('word','plain')),
    prompt TEXT NOT NULL,
    answer_type TEXT NOT NULL CHECK (answer_type IN ('number','expression','equation','solution_set','ordered_pair')),
    answer TEXT NOT NULL,
    accepted_variants_json TEXT NOT NULL DEFAULT '[]',
    required_form TEXT NOT NULL DEFAULT 'none',
    unit TEXT,
    solution_steps_json TEXT NOT NULL,
    source_doc TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_playground_problems_node_diff ON playground_problems(node_id, difficulty);

CREATE TABLE IF NOT EXISTS playground_solved (
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    problem_id TEXT NOT NULL REFERENCES playground_problems(id) ON DELETE CASCADE,
    solved_at TEXT NOT NULL,
    PRIMARY KEY (student_id, problem_id)
);
