-- Run this in your Supabase SQL editor

CREATE TABLE public.feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  candidate_id text,
  candidate_name text,
  exam_id uuid,
  exam_name text,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT feedback_pkey PRIMARY KEY (id),
  CONSTRAINT feedback_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(id),
  CONSTRAINT feedback_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(id)
);
