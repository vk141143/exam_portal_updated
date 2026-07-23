export type Exam = {
  id: string;
  name: string;
  subject: string | null;
  duration_minutes: number;
  question_count: number;
  candidate_count: number;
  starts_at: string | null;
  ends_at: string | null;
  status: string;
  exam_code: string | null;
  room_id: string | null;
  created_at: string;
};

export type Candidate = {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  department: string | null;
  password_hash: string | null;
  status: string;
  assigned_exam_id: string | null;
  roll_number: string | null;
  batch: string | null;
  created_at: string;
};

export type Question = {
  id: string;
  exam_id: string | null;
  question_text: string;
  subject: string | null;
  difficulty: string | null;
  marks: number | null;
  options: string[] | null;
  correct_option: number | null;
  created_at: string;
};

export type AuditLog = {
  id: string;
  actor: string | null;
  event: string | null;
  severity: string | null;
  ip_address: string | null;
  client: string | null;
  created_at: string;
};

export type ExamSession = {
  candidate_id: string;
  candidate_name: string;
  exam_id: string | null;
  exam_name: string | null;
  room_id: string | null;
  question_index: number;
  total_questions: number;
  warnings: number;
  status: string;
  started_at: string;
  candidate_room_id: string | null;
};

export type Feedback = {
  id: string;
  candidate_id: string | null;
  candidate_name: string | null;
  exam_id: string | null;
  exam_name: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
};

export type Result = {
  id: string;
  candidate_id: string | null;
  candidate_name: string | null;
  exam_id: string | null;
  exam_name: string | null;
  score: number | null;
  time_taken: string | null;
  warnings: number | null;
  status: string | null;
  created_at: string;
};
